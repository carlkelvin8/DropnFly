import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { verifyTotp } from "./totp";
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
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
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
    async jwt({ token, user, trigger }: { token: any; user?: any; trigger?: any }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.passwordExpired = user.passwordExpired;
        token.authVersion = user.authVersion;
      } else if (token.id) {
        const current = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { isActive: true, isApproved: true, role: true, authVersion: true },
        });
        if (!current?.isActive || !current.isApproved || current.authVersion !== token.authVersion) {
          token.disabled = true;
        } else {
          token.role = current.role;
          token.disabled = false;
        }
      }
      if (trigger === "update" && token.passwordExpired !== false) {
        token.passwordExpired = false;
      }
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
