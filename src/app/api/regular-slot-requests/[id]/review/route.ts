import { NextResponse } from "next/server";

import { bookingRules } from "@/lib/booking-config";
import { cleanText, requireDatabase } from "@/lib/database";
import {
  forbiddenResponse,
  getSessionUser,
  unauthorizedResponse,
} from "@/lib/server-auth";

type ReviewParams = {
  params: Promise<{ id: string }>;
};

type RequestRow = {
  member_id: string;
  abandoned_weekday: number | null;
  abandoned_start_time: string | null;
  requested_weekday: number;
  requested_start_time: string;
  effective_from: string;
};

type SlotRow = {
  id: string;
  weekday: number;
  start_time: string;
};

export async function POST(request: Request, { params }: ReviewParams) {
  const { id } = await params;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const status = cleanText(record.status, 20);

  if (status !== "approved" && status !== "declined") {
    return NextResponse.json({ error: "Invalid review status." }, { status: 400 });
  }

  const db = await requireDatabase();
  const user = await getSessionUser(db);

  if (!user) {
    return unauthorizedResponse();
  }

  if (user.role !== "coach") {
    return forbiddenResponse();
  }

  const requestId = cleanText(id, 120);
  const requestRow = await db
    .prepare(
      `
        select
          regular_slot_change_requests.member_id,
          regular_slot_change_requests.abandoned_weekday,
          regular_slot_change_requests.abandoned_start_time,
          regular_slot_change_requests.requested_weekday,
          regular_slot_change_requests.requested_start_time,
          regular_slot_change_requests.effective_from
        from regular_slot_change_requests
        join members on members.id = regular_slot_change_requests.member_id
        where regular_slot_change_requests.id = ?1
      `,
    )
    .bind(requestId)
    .first<RequestRow>();

  if (!requestRow) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  const statements = [
    db
      .prepare(
        `
          update regular_slot_change_requests
          set
            status = ?1,
            reviewed_by = ?2,
            reviewed_at = datetime('now'),
            updated_at = datetime('now')
          where id = ?3 and status = 'pending'
        `,
      )
      .bind(status, user.id, requestId),
  ];

  if (status === "approved") {
    if (!requestRow.abandoned_weekday || !requestRow.abandoned_start_time) {
      return NextResponse.json(
        {
          error:
            "This request does not record which regular slot is being abandoned.",
        },
        { status: 409 },
      );
    }

    const currentSlots = (
      await db
        .prepare(
          `
            select id, weekday, start_time
            from recurring_slots
            where member_id = ?1 and effective_until is null
            order by weekday, start_time
          `,
        )
        .bind(requestRow.member_id)
        .all<SlotRow>()
    ).results;
    const slotToReplace = currentSlots.find(
      (slot) =>
        slot.weekday === requestRow.abandoned_weekday &&
        slot.start_time === requestRow.abandoned_start_time,
    );
    const duplicate = currentSlots.some(
      (slot) =>
        slot.weekday === requestRow.requested_weekday &&
        slot.start_time === requestRow.requested_start_time,
    );

    if (!slotToReplace) {
      return NextResponse.json(
        { error: "The abandoned regular slot is no longer assigned." },
        { status: 409 },
      );
    }

    if (duplicate) {
      return NextResponse.json(
        { error: "The requested regular slot is already assigned." },
        { status: 409 },
      );
    }

    const requestedSlotCount = await db
      .prepare(
        `
          select count(*) as count
          from recurring_slots
          join members on members.id = recurring_slots.member_id
          where
            recurring_slots.member_id <> ?1
            and recurring_slots.weekday = ?2
            and recurring_slots.start_time = ?3
            and recurring_slots.effective_until is null
            and members.role = 'member'
            and members.status <> 'archived'
        `,
      )
      .bind(
        requestRow.member_id,
        requestRow.requested_weekday,
        requestRow.requested_start_time,
      )
      .first<{ count: number }>();

    if (Number(requestedSlotCount?.count ?? 0) >= bookingRules.slotCapacity) {
      return NextResponse.json(
        { error: "The requested regular slot is full." },
        { status: 409 },
      );
    }

    statements.push(
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
              and source_recurring_slot_id = ?4
          `,
        )
        .bind(user.id, requestRow.member_id, requestRow.effective_from, slotToReplace.id),
      db.prepare("delete from recurring_slots where id = ?1").bind(slotToReplace.id),
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
          `regular-${requestId}`,
          requestRow.member_id,
          requestRow.requested_weekday,
          requestRow.requested_start_time,
          requestRow.effective_from,
        ),
    );
  }

  if (db.batch) {
    await db.batch(statements);
  } else {
    for (const statement of statements) {
      await statement.run();
    }
  }

  return NextResponse.json({ ok: true });
}
