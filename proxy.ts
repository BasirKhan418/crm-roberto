import { NextRequest, NextResponse } from 'next/server';

const URL11= ["/dashboard", "/clients", "/suppliers", "/notes", "/follow-up-tracking", "/profile"];
const URL12= ["/login", "/forgot-password", "/signup"];
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
  if(URL12.some((url) => request.nextUrl.pathname.startsWith(url))) {
    const res = await useMe(false);
    if(res.success){
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    if(res.success && res.user&&res.user.isEmailVerified&&!res.user.isOnboardingComplete && pathname !== '/onboarding'){
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }
  }
  if(request.nextUrl.pathname=="/onboarding"){
    const res = await useMe(true);

    if (!res.success) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    if(res.success && res.user && res.user.isOnboardingComplete){
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};