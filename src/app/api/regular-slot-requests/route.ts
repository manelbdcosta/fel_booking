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
  const abandonedDay = cleanText(record.abandonedDay, 20);
  const abandonedTime = cleanText(record.abandonedTime, 5);
  const requestedDay = cleanText(record.requestedDay, 20);
  const requestedTime = cleanText(record.requestedTime, 5);
  const effectiveWeek = cleanText(record.effectiveWeek, 10);
  const note = cleanText(record.note, 500);
  const abandonedWeekday = weekdayNumbers[abandonedDay];
  const requestedWeekday = weekdayNumbers[requestedDay];

  if (
    !memberId ||
    !abandonedWeekday ||
    !allowedTimes.has(abandonedTime) ||
    !requestedWeekday ||
    !allowedTimes.has(requestedTime) ||
    !effectiveWeek
  ) {
    return NextResponse.json(
      {
        error:
          "Member, current slot, requested slot, and effective week are required.",
      },
      { status: 400 },
    );
  }

  if (abandonedWeekday === requestedWeekday && abandonedTime === requestedTime) {
    return NextResponse.json(
      { error: "Requested slot must be different from the current slot." },
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

  const abandonedSlot = await db
    .prepare(
      `
        select id
        from recurring_slots
        where
          member_id = ?1
          and weekday = ?2
          and start_time = ?3
          and effective_until is null
      `,
    )
    .bind(memberId, abandonedWeekday, abandonedTime)
    .first<{ id: string }>();

  if (!abandonedSlot) {
    return NextResponse.json(
      { error: "Choose one of the member's current regular slots to change." },
      { status: 400 },
    );
  }

  const existingRequestedSlot = await db
    .prepare(
      `
        select id
        from recurring_slots
        where
          member_id = ?1
          and weekday = ?2
          and start_time = ?3
          and effective_until is null
      `,
    )
    .bind(memberId, requestedWeekday, requestedTime)
    .first<{ id: string }>();

  if (existingRequestedSlot) {
    return NextResponse.json(
      { error: "The requested slot is already one of the member's regular slots." },
      { status: 400 },
    );
  }

  const requestId = createId("regular-request");

  await db
    .prepare(
      `
        insert into regular_slot_change_requests (
          id,
          member_id,
          abandoned_weekday,
          abandoned_start_time,
          requested_weekday,
          requested_start_time,
          effective_from,
          note,
          status
        ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'pending')
      `,
    )
    .bind(
      requestId,
      memberId,
      abandonedWeekday,
      abandonedTime,
      requestedWeekday,
      requestedTime,
      effectiveWeek,
      note || null,
    )
    .run();

  return NextResponse.json({ id: requestId }, { status: 201 });
}
