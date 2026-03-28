import { NextRequest, NextResponse } from 'next/server';

export async function GET(_request: NextRequest) {
  return NextResponse.json({ success: false, message: 'Quote next-number route not implemented yet.' }, { status: 501 });
}
