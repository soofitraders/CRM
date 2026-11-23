import { withAuth } from 'next-auth/middleware'
import { getToken } from 'next-auth/jwt'
import { NextResponse, type NextRequest } from 'next/server'
import { isApiAllowed, isPageAllowed, homePathFor } from '@/lib/security/roleAccess'

// Pages: must be signed in, active, and allowed to open the page for their role
const pageMiddleware = withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    // Check if user is active
    if (token && token.status !== 'ACTIVE') {
      return NextResponse.redirect(new URL('/login?error=inactive', req.url))
    }

    const role = token?.role as string | undefined

    // Customers have no portal: never let one into the app (also covers old sessions)
    if (role === 'CUSTOMER') {
      return NextResponse.redirect(new URL('/login?error=denied', req.url))
    }

    // Investors only get their own screens
    if (role && !isPageAllowed(role, path)) {
      return NextResponse.redirect(new URL(homePathFor(role), req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Allow access to login page without authentication
        if (req.nextUrl.pathname === '/login') {
          return true
        }
        // Check if user is authenticated and active for other routes
        return !!token && token.status === 'ACTIVE'
      },
    },
    pages: {
      signIn: '/login',
    },
  }
)

export default async function middleware(req: NextRequest, event: any) {
  const path = req.nextUrl.pathname

  // API: role gate for every endpoint. Not signed in -> let the route answer 401 itself.
  if (path.startsWith('/api/')) {
    if (path.startsWith('/api/auth')) return NextResponse.next()

    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    if (!token) return NextResponse.next()

    if (token.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isApiAllowed(token.role as string | undefined, path)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.next()
  }

  return (pageMiddleware as any)(req, event)
}

export const config = {
  matcher: [
    /*
     * Pages: everything except
     * - api (handled below)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - login page
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|login|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    // API routes (role gate above)
    '/api/:path*',
  ],
}
