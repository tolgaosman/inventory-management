import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Coarse route gate. The cookie only says "a token exists" — every API call is
 * still authorized server-side by Laravel, so a forged cookie buys nothing but
 * an app shell that fails its first request.
 */
const PUBLIC_PATHS = ["/giris", "/sifremi-unuttum", "/sifre-sifirla"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasToken = Boolean(request.cookies.get("net_auth_token")?.value);
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!hasToken && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/giris";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (hasToken && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/panel";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next internals, the rates route handler, and static files.
  matcher: ["/((?!_next/static|_next/image|api/|favicon.ico|.*\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)"],
};
