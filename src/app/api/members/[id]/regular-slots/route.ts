import { NextResponse } from "next/server";

import { bookingRules } from "@/lib/booking-config";
import { cleanText, createId, requireDatabase } from "@/lib/database";
import { forbiddenResponse, getSessionUser, unauthorizedResponse } from "@/lib/server-auth";

type MemberRegularSlotParams = {
  params: Promise<{ id: string }>;
};

type IncomingSlot = {
  id?: unknown;
  day?: unknown;
  time?: unknown;
};

const weekdayNumbers: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
};

const allowedTimes = new Set(["06:30", "07:00", "07:30", "08:00", "08:30"]);

function parseSlots(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  return value.map((slot: IncomingSlot) => ({
    id: cleanText(slot.id, 120),
    day: cleanText(slot.day, 20),
    time: cleanText(slot.time, 5),
  }));
}

export async function PUT(request: Request, { params }: MemberRegularSlotParams) {
  const { id } = await params;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const weeklyQuota = Number(record.weeklyQuota);
  const slots = parseSlots(record.slots);
  const effectiveFrom = cleanText(record.effectiveFrom, 10) || "2026-07-06";

  if (!Number.isFinite(weeklyQuota) || weeklyQuota < 1 || weeklyQuota > 5) {
    return NextResponse.json(
      { error: "Weekly quota must be between 1 and 5." },
      { status: 400 },
    );
  }

  if (!slots) {
    return NextResponse.json({ error: "Slots are required." }, { status: 400 });
  }

  if (slots.length > weeklyQuota) {
    return NextResponse.json(
      { error: "Regular slots cannot exceed weekly quota." },
      { status: 400 },
    );
  }

  const seenSlots = new Set<string>();

  for (const slot of slots) {
    const weekday = weekdayNumbers[slot.day];

    if (!weekday || !allowedTimes.has(slot.time)) {
      return NextResponse.json(
        { error: "Regular slots must use a valid weekday and time." },
        { status: 400 },
      );
    }

    const signature = `${slot.day}:${slot.time}`;

    if (seenSlots.has(signature)) {
      return NextResponse.json(
        { error: "Duplicate regular slots are not allowed." },
        { status: 400 },
      );
    }

    seenSlots.add(signature);
  }

  const db = await requireDatabase();
  const user = await getSessionUser(db);

  if (!user) {
    return unauthorizedResponse();
  }

  if (user.role !== "coach") {
    return forbiddenResponse();
  }

  const memberId = cleanText(id, 120);
  const occupancyRows = (
    await db
      .prepare(
        `
          select
            recurring_slots.weekday,
            recurring_slots.start_time,
            count(*) as count
          from recurring_slots
          join members on members.id = recurring_slots.member_id
          where
            recurring_slots.member_id <> ?1
            and recurring_slots.effective_until is null
            and members.role = 'member'
            and members.status <> 'archived'
          group by recurring_slots.weekday, recurring_slots.start_time
        `,
      )
      .bind(memberId)
      .all<{ weekday: number; start_time: string; count: number }>()
  ).results;
  const occupancyBySlot = new Map(
    occupancyRows.map((row) => [
      `${row.weekday}:${row.start_time}`,
      Number(row.count),
    ]),
  );

  for (const slot of slots) {
    const weekday = weekdayNumbers[slot.day];
    const assigned =
      Number(occupancyBySlot.get(`${weekday}:${slot.time}`) ?? 0) + 1;

    if (assigned > bookingRules.slotCapacity) {
      return NextResponse.json(
        {
          error: `${slot.day} ${slot.time} is full (${bookingRules.slotCapacity}/${bookingRules.slotCapacity}).`,
        },
        { status: 400 },
      );
    }
  }

  const statements = [
    db
      .prepare(
        `
          update members
          set weekly_quota = ?1, updated_at = datetime('now')
          where id = ?2 and role = 'member'
        `,
      )
      .bind(Math.round(weeklyQuota), memberId),
    db
      .prepare(
        `
          update bookings
          set
            status = 'cancelled',
            cancelled_at = datetime('now'),
            cancelled_by = ?1,
            updated_at = datetime('now')
          where
            member_id = ?2
            and session_date >= ?3
            and status = 'booked'
            and kind = 'regular'
            and source_recurring_slot_id is not null
        `,
      )
      .bind(user.id, memberId, effectiveFrom),
    db
      .prepare(
        "delete from recurring_slots where member_id = ?1 and effective_until is null",
      )
      .bind(memberId),
    ...slots.map((slot) =>
      db
        .prepare(
          `
            insert into recurring_slots (
              id,
              member_id,
              weekday,
              start_time,
              effective_from
            ) values (?1, ?2, ?3, ?4, ?5)
          `,
        )
        .bind(
          slot.id || createId("regular"),
          memberId,
          weekdayNumbers[slot.day],
          slot.time,
          effectiveFrom,
        ),
    ),
  ];

  if (db.batch) {
    await db.batch(statements);
  } else {
    for (const statement of statements) {
      await statement.run();
    }
  }

  return NextResponse.json({ ok: true });
}
