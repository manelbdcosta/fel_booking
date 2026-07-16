import { NextResponse } from "next/server";

import { bookingRules } from "@/lib/booking-config";
import { createCoachNotification } from "@/lib/coach-notifications";
import { cleanText, createId, requireDatabase } from "@/lib/database";
import {
  parseCorrespondenceEvent,
  sendCorrespondenceEmail,
} from "@/lib/outbound-email";
import {
  addDays,
  cleanSessionDate,
  dateLabel,
  materializeRegularBookingsForWeek,
  normalizeWeekStart,
} from "@/lib/schedule-data";
import {
  forbiddenResponse,
  getSessionUser,
  unauthorizedResponse,
} from "@/lib/server-auth";

type BookedMemberRow = {
  booking_id: string;
  member_id: string;
  first_name: string;
  last_name: string;
  email: string;
};

function validSlotTime(value: string) {
  return bookingRules.slotTimes.includes(
    value as (typeof bookingRules.slotTimes)[number],
  );
}

export async function POST(request: Request) {
  const db = await requireDatabase();
  const user = await getSessionUser(db);

  if (!user) {
    return unauthorizedResponse();
  }

  if (user.role !== "coach") {
    return forbiddenResponse();
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const sessionDate = cleanSessionDate(record.sessionDate);
  const startTime = cleanText(record.startTime, 5);
  const confirmOccupied = record.confirmOccupied === true;

  if (!sessionDate || !validSlotTime(startTime)) {
    return NextResponse.json(
      { error: "Session date and time are required." },
      { status: 400 },
    );
  }

  await materializeRegularBookingsForWeek(db, normalizeWeekStart(sessionDate));

  const bookedMembers = (
    await db
      .prepare(
        `
          select
            bookings.id as booking_id,
            members.id as member_id,
            members.first_name,
            members.last_name,
            members.email
          from bookings
          join members on members.id = bookings.member_id
          where
            bookings.session_date = ?1
            and bookings.start_time = ?2
            and bookings.status = 'booked'
          order by members.first_name, members.last_name
        `,
      )
      .bind(sessionDate, startTime)
      .all<BookedMemberRow>()
  ).results;

  if (bookedMembers.length > 0 && !confirmOccupied) {
    return NextResponse.json(
      {
        bookings: bookedMembers.map((member) => ({
          email: member.email,
          memberName: `${member.first_name} ${member.last_name}`,
        })),
        error: "This slot has booked members.",
        requiresConfirmation: true,
      },
      { status: 409 },
    );
  }

  const statements: ReturnType<typeof db.prepare>[] = [
    db
      .prepare(
        `
          insert or ignore into slot_closures (
            id,
            session_date,
            start_time,
            closed_by
          ) values (?1, ?2, ?3, ?4)
        `,
      )
      .bind(createId("slot-closure"), sessionDate, startTime, user.id),
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
            session_date = ?2
            and start_time = ?3
            and status = 'booked'
        `,
      )
      .bind(user.id, sessionDate, startTime),
    db
      .prepare(
        `
          delete from waitlist_entries
          where session_date = ?1 and start_time = ?2
        `,
      )
      .bind(sessionDate, startTime),
    ...bookedMembers.map((member) =>
      db
        .prepare(
          `
            insert or ignore into credits (
              id,
              member_id,
              origin_booking_id,
              origin,
              expires_on
            ) values (?1, ?2, ?3, 'closure', ?4)
          `,
        )
        .bind(
          createId("credit"),
          member.member_id,
          member.booking_id,
          addDays(sessionDate, bookingRules.creditExpiryDays),
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

  const coachNotificationResults = await Promise.allSettled(
    bookedMembers.map((member) =>
      createCoachNotification(db, {
        body: "Booking cancelled because the slot was closed. Credit issued.",
        kind: "slot-closed",
        memberId: member.member_id,
        memberName: `${member.first_name} ${member.last_name}`,
        sessionDate,
        startTime,
        title: `${member.first_name} ${member.last_name} was displaced from ${dateLabel(
          sessionDate,
        )} at ${startTime}`,
      }),
    ),
  );
  const failedCoachNotification = coachNotificationResults.find(
    (result) => result.status === "rejected",
  );

  if (failedCoachNotification) {
    console.error(
      "Unable to create slot closure notification",
      failedCoachNotification.reason,
    );
  }

  const notificationResults = await Promise.all(
    bookedMembers.map((member) => {
      const event = parseCorrespondenceEvent({
        kind: "slot-closed",
        bookingDate: dateLabel(sessionDate),
        memberName: `${member.first_name} ${member.last_name}`,
        time: startTime,
      });

      return event
        ? sendCorrespondenceEmail(event, { to: [member.email] })
        : Promise.resolve({
            error: "Invalid correspondence event.",
            ok: false,
            status: 400,
          } as const);
    }),
  );
  const failedNotification = notificationResults.find((result) => !result.ok);

  return NextResponse.json({
    emailError:
      failedNotification && !failedNotification.ok
        ? failedNotification.error
        : null,
    notificationSent:
      bookedMembers.length === 0 ? true : !failedNotification,
    notifiedCount: notificationResults.filter((result) => result.ok).length,
    ok: true,
  });
}

export async function DELETE(request: Request) {
  const db = await requireDatabase();
  const user = await getSessionUser(db);

  if (!user) {
    return unauthorizedResponse();
  }

  if (user.role !== "coach") {
    return forbiddenResponse();
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const sessionDate = cleanSessionDate(record.sessionDate);
  const startTime = cleanText(record.startTime, 5);

  if (!sessionDate || !validSlotTime(startTime)) {
    return NextResponse.json(
      { error: "Session date and time are required." },
      { status: 400 },
    );
  }

  await db
    .prepare(
      `
        delete from slot_closures
        where session_date = ?1 and start_time = ?2
      `,
    )
    .bind(sessionDate, startTime)
    .run();

  // Reopening only clears the closure. Members whose bookings were cancelled
  // when the slot closed keep the credits they were issued and can rebook.
  await materializeRegularBookingsForWeek(db, normalizeWeekStart(sessionDate));

  return NextResponse.json({ ok: true });
}
