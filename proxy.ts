import { NextRequest, NextResponse } from 'next/server';
const URL11= ["/dashboard", "/clients", "/suppliers", "/notes", "/follow-up-tracking", "/profile"];
import { useMe } from './utils/middlewares/useMe';
export default async function proxy (request: NextRequest) {
  if(URL11.some((url) => request.nextUrl.pathname.startsWith(url))) {
    const res = await useMe(false);
    if(!res.success){
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }
}