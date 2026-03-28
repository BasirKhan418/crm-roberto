import { NextRequest, NextResponse } from 'next/server';

export async function GET(_request: NextRequest) {
  return NextResponse.json({ success: false, message: 'Quotes list route not implemented yet.' }, { status: 501 });
}

export async function POST(_request: NextRequest) {
  return NextResponse.json({ success: false, message: 'Quote create route not implemented yet.' }, { status: 501 });
}
