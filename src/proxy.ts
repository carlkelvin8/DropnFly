import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// API-level role enforcement is handled in the API routes (e.g., /api/employees, /api/settings).
// Page-level role checks are done client-side via useSession in the dashboard layout.
const protectedRoutes = ["/dashboard"];
const publicRoutes = ["/", "/login", "/register", "/book", "/track", "/api/public", "/api/auth"];

export default function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isProtectedRoute = protectedRoutes.some((route) =>
    path.startsWith(route)
  );
  const isPublicRoute = publicRoutes.some((route) =>
    path.startsWith(route)
  );

  if (isPublicRoute) {
    return NextResponse.next();
  }

  const sessionToken =
    req.cookies.get("next-auth.session-token")?.value ||
    req.cookies.get("__Secure-next-auth.session-token")?.value;

  if (isProtectedRoute && !sessionToken) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(loginUrl);
  }

  if (
    path === "/" &&
    sessionToken
  ) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
