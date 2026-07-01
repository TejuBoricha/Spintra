import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const pathname = url.pathname.replace(/\/+$/, "");

  if (pathname === "/room") {
    const roomCode = url.searchParams.get("code")?.trim();
    if (roomCode) {
      return NextResponse.redirect(
        new URL(`/room/${encodeURIComponent(roomCode.toUpperCase())}`, request.url)
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/room", "/room/"],
};
