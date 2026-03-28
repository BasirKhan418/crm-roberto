import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return NextResponse.json({ success: false, message: `Quote status route not implemented yet for id ${id}.` }, { status: 501 });
}
