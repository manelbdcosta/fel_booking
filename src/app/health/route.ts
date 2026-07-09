import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    app: "Fit East London Booking",
    timestamp: new Date().toISOString(),
  });
}
