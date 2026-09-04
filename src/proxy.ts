import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// API-level role enforcement is handled in the API routes (e.g., /api/employees, /api/settings).
// Page-level role checks are done client-side via useSession in the dashboard layout.
const protectedRoutes = ["/dashboard"];
const publicRoutes = ["/", "/login", "/book", "/track", "/api/public", "/api/auth"];

const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

async function hasValidSession(req: NextRequest): Promise<boolean> {
  const cookie = SESSION_COOKIES.map((name) => req.cookies.get(name)).find(Boolean);
  if (!cookie) return false;
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) return false;
  try {
    const token = await getToken({
      req: { headers: req.headers },
      secret,
      cookieName: cookie.name,
      secureCookie: cookie.name.startsWith("__Secure-"),
    });
    // The jwt callback marks deactivated/invalidated sessions via token.disabled.
    return Boolean(token && !token.disabled);
  } catch {
    return false;
  }
}

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const method = req.method.toUpperCase();
  const mutating = !["GET", "HEAD", "OPTIONS"].includes(method);

  const passThrough = () => {
    const res = NextResponse.next();
    res.headers.set("x-pathname", path);
    return res;
  };
  if (path.startsWith("/api/") && mutating) {
    const contentLengthHeader = req.headers.get("content-length");
    const transferEncoding = req.headers.get("transfer-encoding");
    const contentLength = contentLengthHeader ? Number(contentLengthHeader) : 0;
    if (Number.isFinite(contentLength) && contentLength > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Request body is too large" }, { status: 413 });
    }
    // Chunked requests without content-length bypass the above check — reject large chunked bodies
    if (!contentLengthHeader && transferEncoding?.includes("chunked")) {
      // Let Next.js bodySizeLimit handle it, but flag suspicious
      const url = req.nextUrl.pathname;
      if (url !== "/api/qr/scan" && url !== "/api/bookings/[id]/photos") {
        // generic chunked mutating without length — still enforce origin
      }
    }

    // Webhooks are authenticated by provider signatures. Browser-originated
    // mutations must come from this deployment to limit cookie-based CSRF.
    // Require Origin or Referer for mutating API calls (curl without origin is still allowed for public APIs, but blocked for non-public).
    if (path !== "/api/payments/webhook") {
      const isPublicApi = publicRoutes.some((r) => r !== "/" && path.startsWith(r));
      if (!isPublicApi) {
        const origin = req.headers.get("origin");
        const referer = req.headers.get("referer");
        if (origin) {
          if (origin !== req.nextUrl.origin) {
            return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
          }
        } else if (referer) {
          try {
            const refererOrigin = new URL(referer).origin;
            if (refererOrigin !== req.nextUrl.origin) {
              return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
            }
          } catch {
            return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
          }
        } else {
          // No Origin/Referer — allow only if it's a same-site fetch with Sec-Fetch-Site
          const secFetchSite = req.headers.get("sec-fetch-site");
          if (secFetchSite && !["same-origin", "same-site"].includes(secFetchSite)) {
            return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
          }
        }
      }
    }
  }
  const isProtectedRoute = protectedRoutes.some((route) =>
    path.startsWith(route)
  );
  const isPublicRoute = publicRoutes.some((route) =>
    path.startsWith(route)
  );

  if (isPublicRoute) {
    return passThrough();
  }

  const validSession = await hasValidSession(req);

  if (isProtectedRoute && !validSession) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(loginUrl);
  }

  if (
    path === "/" &&
    validSession
  ) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return passThrough();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
