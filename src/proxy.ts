import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/app", "/onboarding", "/admin", "/saved", "/account"];
const SESSION_COOKIE = "__session";

// Cheap gate only: the cookie is fully verified (signature + revocation)
// by getSession() on the server before any data is read.
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (!request.cookies.has(SESSION_COOKIE) && PROTECTED.some((p) => path === p || path.startsWith(p + "/"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp)$).*)"],
};
