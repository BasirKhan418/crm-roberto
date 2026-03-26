import { NextRequest, NextResponse } from 'next/server';

import { useMe } from './utils/middlewares/useMe';

const protectedRoutePrefixes = ['/dashboard', '/clients', '/suppliers', '/notes', '/follow-up-tracking', '/profile'];
const publicRoutes = ['/', '/login', '/signup', '/forgot-password'];

function matchesExactRoute(pathname: string, route: string): boolean {
  return pathname === route;
}

function matchesRoutePrefix(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (protectedRoutePrefixes.some((route) => matchesRoutePrefix(pathname, route))) {
    const res = await useMe(false);

    if (!res.success) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  if (publicRoutes.some((route) => matchesExactRoute(pathname, route))) {
    const res = await useMe(false);

    if (res.success && pathname !== '/dashboard') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  if (pathname === '/onboarding') {
    const res = await useMe(true);

    if (!res.success) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    if (res.user?.isOnboardingComplete) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};