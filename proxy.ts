import { NextRequest, NextResponse } from 'next/server';
const URL11= ["/dashboard", "/clients", "/suppliers", "/notes", "/follow-up-tracking", "/profile"];
const URL12= ["/login", "/forgot-password", "/signup"];
import { useMe } from './utils/middlewares/useMe';
export default async function proxy (request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if(URL11.some((url) => request.nextUrl.pathname.startsWith(url))) {
    const res = await useMe(false);
    if(!res.success){
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }
  if(pathname === '/' || URL12.some((url) => pathname.startsWith(url))) {
    const res = await useMe(true);
    if(res.success && res.user&&res.user.isEmailVerified&&res.user.isOnboardingComplete){
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    if(res.success && res.user&&res.user.isEmailVerified&&!res.user.isOnboardingComplete && pathname !== '/onboarding'){
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }
  }
  if(pathname=="/onboarding"){
    const res = await useMe(true);
    if(!res.success){
      return NextResponse.redirect(new URL('/login', request.url));
    }
    if(res.success && res.user && res.user.isEmailVerified && res.user.isOnboardingComplete){
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }
}