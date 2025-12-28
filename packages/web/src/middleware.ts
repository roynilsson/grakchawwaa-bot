import { auth } from "./lib/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isAuthRoute = req.nextUrl.pathname.startsWith("/api/auth")
  const isRootRoute = req.nextUrl.pathname === "/"

  // Allow auth routes
  if (isAuthRoute) {
    return NextResponse.next()
  }

  // Allow root/login page
  if (isRootRoute) {
    // If already logged in, redirect to guild members
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/guild-members", req.url))
    }
    return NextResponse.next()
  }

  // Protect all other routes
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/", req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
