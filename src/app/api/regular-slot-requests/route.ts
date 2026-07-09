import { NextResponse } from "next/server";

import { cleanText, createId, requireDatabase } from "@/lib/database";
import { getSessionUser, unauthorizedResponse } from "@/lib/server-auth";

const weekdayNumbers: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
};

const allowedTimes = new Set(["06:30", "07:00", "07:30", "08:00", "08:30"]);

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const memberId = cleanText(record.memberId, 120);
  const requestedDay = cleanText(record.requestedDay, 20);
  const requestedTime = cleanText(record.requestedTime, 5);
  const effectiveWeek = cleanText(record.effectiveWeek, 10);
  const note = cleanText(record.note, 500);
  const weekday = weekdayNumbers[requestedDay];

  if (!memberId || !weekday || !allowedTimes.has(requestedTime) || !effectiveWeek) {
    return NextResponse.json(
      { error: "Member, day, time, and effective week are required." },
      { status: 400 },
    );
  }

  const db = await requireDatabase();
  const user = await getSessionUser(db);

  if (!user) {
    return unauthorizedResponse();
  }

  if (user.role !== "coach" && user.id !== memberId) {
    return NextResponse.json(
      { error: "Members can only request changes for their own account." },
      { status: 403 },
    );
  }

  const requestId = createId("regular-request");

  await db
    .prepare(
      `
        insert into regular_slot_change_requests (
          id,
          member_id,
          requested_weekday,
          requested_start_time,
          effective_from,
          note,
          status
        ) values (?1, ?2, ?3, ?4, ?5, ?6, 'pending')
      `,
    )
    .bind(requestId, memberId, weekday, requestedTime, effectiveWeek, note || null)
    .run();

  return NextResponse.json({ id: requestId }, { status: 201 });
}
