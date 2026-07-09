import { NextResponse } from "next/server";

import {
  parseCorrespondenceEvent,
  sendCorrespondenceEmail,
} from "@/lib/outbound-email";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const event = parseCorrespondenceEvent(body);

  if (!event) {
    return NextResponse.json(
      { error: "Unsupported correspondence event." },
      { status: 400 },
    );
  }

  const result = await sendCorrespondenceEmail(event);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json({ ok: true, id: result.id });
}
