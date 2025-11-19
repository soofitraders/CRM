import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    
    // Redirect to login if no token
    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    // Check if user is active
    if (token.status !== 'ACTIVE') {
      return NextResponse.redirect(new URL('/login?error=inactive', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => {
        // Check if user is authenticated and active
        return !!token && token.status === 'ACTIVE'
      },
    },
    pages: {
      signIn: '/login',
    },
  }
)

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - login page
     * - public folder
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|login|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

