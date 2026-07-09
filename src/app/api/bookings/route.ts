import { NextResponse } from "next/server";

import { cleanText, requireDatabase } from "@/lib/database";
import { createBooking } from "@/lib/schedule-data";
import { getSessionUser, unauthorizedResponse } from "@/lib/server-auth";

export async function POST(request: Request) {
  const db = await requireDatabase();
  const user = await getSessionUser(db);

  if (!user) {
    return unauthorizedResponse();
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const result = await createBooking(db, user, {
    coachOverride: record.coachOverride === true,
    memberId: cleanText(record.memberId, 120),
    sessionDate: cleanText(record.sessionDate, 10),
    startTime: cleanText(record.startTime, 5),
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json(result);
}
