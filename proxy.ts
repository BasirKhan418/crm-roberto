import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

interface TokenPayload {
  sub: string;
  name: string;
  email: string;
  isOnboardingComplete?: boolean;
  isEmailVerified?: boolean;
}

const protectedRoutePrefixes = ['/dashboard', '/clients', '/suppliers', '/notes', '/follow-up-tracking', '/profile', '/products', '/quotes'];
const publicRoutes = ['/', '/login', '/signup', '/forgot-password'];

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

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('token')?.value;

  if (protectedRoutePrefixes.some((route) => matchesRoutePrefix(pathname, route))) {
    const payload = token ? await verifyToken(token) : null;
    if (!payload) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    if(payload.isEmailVerified && !payload.isOnboardingComplete){
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }
    return NextResponse.next();
  }

  if (publicRoutes.includes(pathname)) {
    const payload = token ? await verifyToken(token) : null;
    if (payload) {
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
    if (payload.isOnboardingComplete) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};