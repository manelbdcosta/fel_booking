import { NextResponse } from "next/server";

import { cleanText, requireDatabase } from "@/lib/database";
import { joinWaitlist, leaveWaitlist } from "@/lib/schedule-data";
import { getSessionUser, unauthorizedResponse } from "@/lib/server-auth";

async function parseAction(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return null;
  }

  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  return {
    memberId: cleanText(record.memberId, 120),
    sessionDate: cleanText(record.sessionDate, 10),
    startTime: cleanText(record.startTime, 5),
  };
}

export async function POST(request: Request) {
  const db = await requireDatabase();
  const user = await getSessionUser(db);

  if (!user) {
    return unauthorizedResponse();
  }

  const action = await parseAction(request);

  if (!action) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = await joinWaitlist(db, user, action);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json(result);
}

export async function DELETE(request: Request) {
  const db = await requireDatabase();
  const user = await getSessionUser(db);

  if (!user) {
    return unauthorizedResponse();
  }

  const action = await parseAction(request);

  if (!action) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = await leaveWaitlist(db, user, action);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json(result);
}
