import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/app", "/onboarding", "/admin", "/saved", "/account"];
const SESSION_COOKIE = "__session";
const AUTH_HINT_COOKIE = "bf_auth";

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
  const res = NextResponse.next();
  // Sessions created before the hint cookie existed: add it so the static
  // public header shows the signed-in state. It grants nothing.
  if (request.cookies.has(SESSION_COOKIE) && !request.cookies.has(AUTH_HINT_COOKIE)) {
    res.cookies.set(AUTH_HINT_COOKIE, "1", { path: "/", sameSite: "lax", secure: request.nextUrl.protocol === "https:", maxAge: 14 * 24 * 3600 });
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp)$).*)"],
};
