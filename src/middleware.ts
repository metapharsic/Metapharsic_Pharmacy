import { NextResponse } from 'next/server'
import { withAuth } from 'next-auth/middleware'

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl
    const token = req.nextauth.token

    // Strict platform super-admin route protection:
    // Block non-super-admins from accessing /platform and any subroutes
    if (pathname.startsWith('/platform')) {
      const isSuperAdmin = Boolean(
        token?.isSuperAdmin || token?.roles?.includes('super_admin')
      )
      if (!isSuperAdmin) {
        return NextResponse.redirect(new URL('/', req.url))
      }
    }

    // If accessing /pos route group, verify POS permission
    if (pathname.startsWith('/pos') && !token?.permissions?.includes('sales:create')) {
      return NextResponse.redirect(new URL('/', req.url))
    }

    return NextResponse.next()
  },
  {
    pages: {
      signIn: '/login',
      error: '/login',
    },
    callbacks: {
      authorized({ token }) {
        // Token exists = authenticated
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - /login, /register, /reset-password (auth pages)
     * - /api/auth (NextAuth API)
     * - /api/reports/daily-closing, /api/cron (automated EOD report and cron triggers)
     * - /_next/static, /_next/image, /favicon.ico (static files)
     */
    '/((?!login|register|reset-password|pos-camera|api/pos2/strip-camera-bridge|api/auth|api/login-threads|api/territory|api/tax|api/reset-password|api/reports/daily-closing|api/cron|_next/static|_next/image|favicon.ico|public).*)',
  ],
}
