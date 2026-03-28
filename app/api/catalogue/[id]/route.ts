import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return NextResponse.json({ success: false, message: `Catalogue detail route not implemented yet for id ${id}.` }, { status: 501 });
}

export async function PATCH(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return NextResponse.json({ success: false, message: `Catalogue update route not implemented yet for id ${id}.` }, { status: 501 });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return NextResponse.json({ success: false, message: `Catalogue delete route not implemented yet for id ${id}.` }, { status: 501 });
}
