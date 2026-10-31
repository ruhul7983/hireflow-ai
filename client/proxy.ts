import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { BACKEND_URL } from "@/lib/backend";

const PUBLIC_PATHS = ["/login"];

async function rotateSession(refreshToken: string) {
  try {
    const response = await fetch(`${BACKEND_URL}/auth/refresh`, {
      method: "POST",
      headers: { cookie: `refresh_token=${refreshToken}` },
    });
    return response.ok ? response.headers.getSetCookie() : null;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  // This only checks that cookies exist. getSessionUser validates them.
  if (request.cookies.has("access_token")) {
    return NextResponse.next();
  }

  const refreshToken = request.cookies.get("refresh_token")?.value;
  const setCookies = refreshToken ? await rotateSession(refreshToken) : null;

  if (setCookies) {
    // Pass the new tokens to this render as well as back to the browser
    for (const setCookie of setCookies) {
      const [pair] = setCookie.split(";");
      const separator = pair.indexOf("=");
      request.cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }

    const headers = new Headers(request.headers);
    headers.set("cookie", request.cookies.toString());

    const response = NextResponse.next({ request: { headers } });
    setCookies.forEach((value) => response.headers.append("set-cookie", value));
    return response;
  }

  const response = PUBLIC_PATHS.includes(request.nextUrl.pathname)
    ? NextResponse.next()
    : NextResponse.redirect(new URL("/login", request.url));

  if (refreshToken) {
    response.cookies.delete("refresh_token");
  }
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
