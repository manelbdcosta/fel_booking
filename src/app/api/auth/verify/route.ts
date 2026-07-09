import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Password sign-in is now required. Use password reset if needed." },
    { status: 410 },
  );
}
