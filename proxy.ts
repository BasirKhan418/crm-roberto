import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

interface TokenPayload {
  sub: string;
  name: string;
  email: string;
  isOnboardingComplete?: boolean;
  isEmailVerified?: boolean;
  kind?: string;
  role?: string;
  companyId?: string | null;
}

const bypassRoutePrefixes = ['/sign'];
const protectedRoutePrefixes = [
  '/dashboard',
  '/clients',
  '/suppliers',
  '/notes',
  '/follow-up-tracking',
  '/profile',
  '/products',
  '/quotes',
  '/invoices',
  '/expenses',
  '/tickets',
  '/catalogue',
  '/settings',
];
const adminProtectedPrefixes = ['/admin'];
const adminPublicRoutes = ['/admin/login'];
const accountantPortalProtectedPrefixes = ['/accountant-portal'];
const accountantPortalPublicRoutes = ['/accountant-portal/login'];
const publicRoutes = ['/', '/login', '/signup', '/workspace-setup', '/forgot-password'];

function matchesRoutePrefix(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? '');
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

function isExternalAccountant(payload: TokenPayload | null): boolean {
  return payload?.role === 'external_accountant';
}

function isValidAccountantPortalSession(payload: TokenPayload | null): boolean {
  return Boolean(payload && payload.kind === 'accountant_portal' && payload.role === 'external_accountant');
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('token')?.value;
  const accountantToken = request.cookies.get('accountant-token')?.value;

  if (bypassRoutePrefixes.some((route) => matchesRoutePrefix(pathname, route))) {
    return NextResponse.next();
  }

  // ── Admin routes (separate auth) ──────────────────────────────────────
  if (adminProtectedPrefixes.some((route) => matchesRoutePrefix(pathname, route))) {
    // Let the admin login page through
    if (adminPublicRoutes.includes(pathname)) {
      const adminPayload = request.cookies.get('admin-token')?.value
        ? await verifyToken(request.cookies.get('admin-token')!.value)
        : null;
      if (adminPayload && adminPayload.kind === 'admin') {
        return NextResponse.redirect(new URL('/admin', request.url));
      }
      return NextResponse.next();
    }
    // All other /admin/* pages require admin-token
    const adminToken = request.cookies.get('admin-token')?.value;
    const adminPayload = adminToken ? await verifyToken(adminToken) : null;
    if (!adminPayload || adminPayload.kind !== 'admin') {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
    return NextResponse.next();
  }

  if (accountantPortalProtectedPrefixes.some((route) => matchesRoutePrefix(pathname, route))) {
    const accountantPayload = accountantToken ? await verifyToken(accountantToken) : null;

    if (accountantPortalPublicRoutes.includes(pathname)) {
      if (isValidAccountantPortalSession(accountantPayload)) {
        return NextResponse.redirect(new URL('/accountant-portal', request.url));
      }
      return NextResponse.next();
    }

    if (!isValidAccountantPortalSession(accountantPayload)) {
      const response = NextResponse.redirect(new URL('/accountant-portal/login', request.url));
      response.cookies.delete('accountant-token');
      return response;
    }

    return NextResponse.next();
  }

  if (protectedRoutePrefixes.some((route) => matchesRoutePrefix(pathname, route))) {
    const payload = token ? await verifyToken(token) : null;
    if (!payload) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    if (isExternalAccountant(payload)) {
      const response = NextResponse.redirect(new URL('/accountant-portal/login', request.url));
      response.cookies.delete('token');
      return response;
    }
    if(payload.isEmailVerified && !payload.isOnboardingComplete){
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }
    return NextResponse.next();
  }

  if (publicRoutes.includes(pathname)) {
    const payload = token ? await verifyToken(token) : null;
    if (payload) {
      if (isExternalAccountant(payload)) {
        const response = NextResponse.redirect(new URL('/accountant-portal/login', request.url));
        response.cookies.delete('token');
        return response;
      }
      if (payload.isEmailVerified && !payload.isOnboardingComplete) {
        return NextResponse.redirect(new URL('/onboarding', request.url));
      }
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  if (pathname === '/onboarding') {
    const payload = token ? await verifyToken(token) : null;
    if (!payload) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    if (isExternalAccountant(payload)) {
      const response = NextResponse.redirect(new URL('/accountant-portal/login', request.url));
      response.cookies.delete('token');
      return response;
    }
    if (payload.isOnboardingComplete) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|sign(?:/|$)).*)'],
};