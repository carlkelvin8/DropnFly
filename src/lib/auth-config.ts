import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { verifyTotp } from "./totp";
import { clearRateLimit, rateLimit, requestKey } from "./rate-limit";
import crypto from "node:crypto";
const secret =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  (() => {
    throw new Error(
      "AUTH_SECRET or NEXTAUTH_SECRET environment variable is required. " +
      "Generate one with: openssl rand -base64 32"
    );
  })();

export const PASSWORD_MAX_AGE_DAYS = 180;

function isPasswordExpired(user: { role: string; passwordChangedAt?: Date | null; createdAt: Date }): boolean {
  if (user.role !== "ADMIN") return false;
  const changed = user.passwordChangedAt ?? user.createdAt;
  const ageMs = Date.now() - new Date(changed).getTime();
  return ageMs >= PASSWORD_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

type CurrentUser = {
  isActive: boolean;
  isApproved: boolean;
  role: string;
  authVersion: number;
  passwordChangedAt: Date | null;
};

// Every auth() call runs the jwt callback, i.e. one database round trip per API request and
// page load. Cache the result briefly per server instance. Deactivation, role changes and
// password resets (authVersion) therefore take effect within CURRENT_USER_TTL_MS.
const CURRENT_USER_TTL_MS = 10_000;
const currentUserCache = new Map<string, { at: number; user: CurrentUser | null }>();

async function loadCurrentUser(id: string): Promise<CurrentUser | null> {
  const hit = currentUserCache.get(id);
  if (hit && Date.now() - hit.at < CURRENT_USER_TTL_MS) return hit.user;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { isActive: true, isApproved: true, role: true, authVersion: true, passwordChangedAt: true },
  });
  if (currentUserCache.size > 500) currentUserCache.clear();
  currentUserCache.set(id, { at: Date.now(), user });
  return user;
}

export const config = {
  secret,
  trustHost: true,
  basePath: "/api/auth",
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totpCode: { label: "2FA Code", type: "text" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;

        const identifier = String(credentials.email).trim().toLowerCase();
        const identifierHash = crypto.createHash("sha256").update(identifier).digest("hex").slice(0, 24);
        const attemptKey = `staff-login:${requestKey(request, identifierHash)}`;
        const attempt = await rateLimit(attemptKey, 5, 15 * 60 * 1000);
        if (!attempt.allowed) return null;

        const user = await prisma.user.findUnique({
          where: { email: String(credentials.email).trim().toLowerCase() },
        });

        if (!user) return null;

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!passwordMatch) return null;

        if (!user.isApproved) return null;
        if (!user.isActive) return null;

        if (user.totpEnabled) {
          const code = credentials.totpCode as string | undefined;
          if (!user.totpSecret || !code || !verifyTotp(user.totpSecret, code)) {
            return null;
          }
        }

        // A completed login starts a fresh attempt window. Without this,
        // successful logins also counted toward the limit and users could be
        // rejected later despite providing valid credentials.
        await clearRateLimit(attemptKey);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          passwordExpired: isPasswordExpired(user),
          authVersion: user.authVersion,
        };
      },
    }),
  ],
  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async jwt({ token, user }: { token: any; user?: any }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.passwordExpired = user.passwordExpired;
        token.authVersion = user.authVersion;
      } else if (token.id) {
        const current = await loadCurrentUser(token.id as string);
        if (!current?.isActive || !current.isApproved || current.authVersion !== token.authVersion) {
          token.disabled = true;
        } else {
          token.role = current.role;
          token.disabled = false;
          // Only clear passwordExpired when a real password change is
          // detected (passwordChangedAt newer than this token's issue
          // time). Client-driven session updates must never clear it.
          const changedAtSec = current.passwordChangedAt
            ? Math.floor(new Date(current.passwordChangedAt).getTime() / 1000)
            : null;
          if (changedAtSec && typeof token.iat === "number" && changedAtSec > token.iat) {
            token.passwordExpired = false;
          }
        }
      }
      // passwordExpired is intentionally NOT cleared on session update:
      // clearing it here let users bypass forced password expiry without
      // actually changing their password. It only resets when a real
      // password change is detected above, or via re-login.
      return token;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        if (token.disabled || !token.id) return { ...session, user: undefined };
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.passwordExpired = token.passwordExpired === true;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt" as const,
  },
};
