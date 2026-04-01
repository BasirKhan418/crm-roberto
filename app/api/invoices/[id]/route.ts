import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ success: false, message: "Not implemented" }, { status: 501 });
}

export async function PATCH() {
  return NextResponse.json({ success: false, message: "Not implemented" }, { status: 501 });
}

export async function DELETE() {
  return NextResponse.json({ success: false, message: "Not implemented" }, { status: 501 });
}
