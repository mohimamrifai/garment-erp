import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Proxy (dulu middleware) — HANYA pengecekan optimistis: keberadaan cookie
 * sesi. Pengecekan sesi & izin yang sebenarnya dilakukan di Data Access Layer
 * (`src/lib/auth/session.ts`) pada setiap halaman dan route handler.
 */
export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    if (request.nextUrl.pathname !== "/") {
      loginUrl.searchParams.set("next", request.nextUrl.pathname);
    }
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  // Semua halaman dilindungi kecuali /login, API, dan aset statis.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login).*)"],
};
