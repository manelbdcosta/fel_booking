import { bookingRules } from "@/lib/booking-config";
import {
  allRows,
  cleanText,
  createId,
  type D1DatabaseBinding,
} from "@/lib/database";
import type { SessionUser } from "@/lib/server-auth";

export type ScheduleSlotData = {
  closed?: boolean;
  time: string;
  names: string[];
  memberIds: string[];
};

export type ScheduleDayData = {
  day: string;
  date: string;
  isoDate: string;
  slots: ScheduleSlotData[];
};

export type ScheduleBookingSummary = {
  id: string;
  isoDate: string;
  date: string;
  time: string;
  kind: "Regular" | "Makeup" | "Coach override";
};

export type ScheduleCreditSummary = {
  id: string;
  label: string;
  expiry: string;
};

export type ScheduleWaitlistSummary = {
  id: string;
  isoDate: string;
  date: string;
  time: string;
};

export type ScheduleData = {
  credits: ScheduleCreditSummary[];
  upcoming: ScheduleBookingSummary[];
  waitlist: ScheduleWaitlistSummary[];
  week: ScheduleDayData[];
  weekStart: string;
};

type TargetMemberRow = {
  id: string;
  first_name: string;
  last_name: string;
  weekly_quota: number;
  status: "pending" | "active" | "archived";
};

type BookingRow = {
  id: string;
  member_id: string;
  first_name: string;
  last_name: string;
  session_date: string;
  start_time: string;
  kind: "regular" | "makeup" | "coach_override";
};

type CreditRow = {
  id: string;
  expires_on: string;
  session_date: string;
};

type WaitlistRow = {
  id: string;
  session_date: string;
  start_time: string;
};

type HolidayBookingRow = {
  id: string;
  session_date: string;
};

type SlotClosureRow = {
  session_date: string;
  start_time: string;
};

type RecurringSlotCandidateRow = {
  id: string;
  member_id: string;
  start_time: string;
};

type BookingActionResult =
  | {
      ok: true;
      bookingKind?: ScheduleBookingSummary["kind"];
      creditIssued?: boolean;
      schedule: ScheduleData;
    }
  | { ok: false; status: number; error: string };

type HolidayActionResult =
  | {
      ok: true;
      cancelledCount: number;
      creditCount: number;
      endsOn: string;
      schedule: ScheduleData;
      startsOn: string;
    }
  | { ok: false; status: number; error: string };

const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const validSlotTimes = new Set<string>(bookingRules.slotTimes);
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export function addDays(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));

  return date.toISOString().slice(0, 10);
}

function isoDateToUtcMs(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);

  return Date.UTC(year, month - 1, day, 12);
}

export function shortDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: bookingRules.timeZone,
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function todayIsoDate() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    timeZone: bookingRules.timeZone,
    year: "numeric",
  }).formatToParts(new Date());
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const year = parts.find((part) => part.type === "year")?.value ?? "2026";

  return `${year}-${month}-${day}`;
}

export function dayIndexFromIso(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utcDay = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();

  return utcDay === 0 ? 6 : utcDay - 1;
}

export function weekStartFromIso(isoDate: string) {
  return addDays(isoDate, -dayIndexFromIso(isoDate));
}

export function dateLabel(isoDate: string) {
  const dayIndex = dayIndexFromIso(isoDate);
  const dayName = dayNames[dayIndex] ?? "Mon";

  return `${dayName} ${shortDate(isoDate)}`;
}

export function normalizeWeekStart(value: unknown) {
  const maybeDate = cleanText(value, 10);
  const source = isoDatePattern.test(maybeDate) ? maybeDate : todayIsoDate();

  return weekStartFromIso(source);
}

export function cleanSessionDate(value: unknown) {
  const maybeDate = cleanText(value, 10);

  return isoDatePattern.test(maybeDate) ? maybeDate : "";
}

export function cleanSlotTime(value: unknown) {
  const maybeTime = cleanText(value, 5);

  return validSlotTimes.has(maybeTime) ? maybeTime : "";
}

export function isSessionWeekday(isoDate: string) {
  const weekday = dayIndexFromIso(isoDate) + 1;

  return bookingRules.sessionWeekdays.includes(
    weekday as (typeof bookingRules.sessionWeekdays)[number],
  );
}

function clientBookingKind(kind: BookingRow["kind"]) {
  if (kind === "makeup") {
    return "Makeup" as const;
  }

  if (kind === "coach_override") {
    return "Coach override" as const;
  }

  return "Regular" as const;
}

function runBatch(db: D1DatabaseBinding, statements: ReturnType<D1DatabaseBinding["prepare"]>[]) {
  if (statements.length === 0) {
    return Promise.resolve([]);
  }

  if (db.batch) {
    return db.batch(statements);
  }

  return Promise.all(statements.map((statement) => statement.run()));
}

async function expireOldCredits(db: D1DatabaseBinding) {
  await db
    .prepare(
      `
        update credits
        set status = 'expired', updated_at = datetime('now')
        where status = 'available' and expires_on < ?1
      `,
    )
    .bind(todayIsoDate())
    .run();
}

async function getTargetMember(
  db: D1DatabaseBinding,
  user: SessionUser,
  requestedMemberId?: string,
) {
  const memberId =
    user.role === "member" ? user.id : cleanText(requestedMemberId, 120) || user.id;

  const member = await db
    .prepare(
      `
        select id, first_name, last_name, weekly_quota, status
        from members
        where id = ?1 and role = 'member'
      `,
    )
    .bind(memberId)
    .first<TargetMemberRow>();

  if (!member) {
    return null;
  }

  if (user.role === "member" && member.id !== user.id) {
    return null;
  }

  return member;
}

async function activeBookingCountForWeek(
  db: D1DatabaseBinding,
  memberId: string,
  weekStart: string,
) {
  const row = await db
    .prepare(
      `
        select count(*) as count
        from bookings
        where
          member_id = ?1
          and session_date between ?2 and ?3
          and status = 'booked'
      `,
    )
    .bind(memberId, weekStart, addDays(weekStart, 4))
    .first<{ count: number }>();

  return Number(row?.count ?? 0);
}

async function activeBookingCountForSlot(
  db: D1DatabaseBinding,
  sessionDate: string,
  startTime: string,
) {
  const row = await db
    .prepare(
      `
        select count(*) as count
        from bookings
        where
          session_date = ?1
          and start_time = ?2
          and status = 'booked'
      `,
    )
    .bind(sessionDate, startTime)
    .first<{ count: number }>();

  return Number(row?.count ?? 0);
}

async function isSlotClosed(
  db: D1DatabaseBinding,
  sessionDate: string,
  startTime: string,
) {
  const closure = await db
    .prepare(
      `
        select id
        from slot_closures
        where session_date = ?1 and start_time = ?2
      `,
    )
    .bind(sessionDate, startTime)
    .first<{ id: string }>();

  return Boolean(closure);
}

async function isMemberOnHoliday(
  db: D1DatabaseBinding,
  memberId: string,
  sessionDate: string,
) {
  const holiday = await db
    .prepare(
      `
        select id
        from member_holidays
        where member_id = ?1 and ?2 between starts_on and ends_on
        limit 1
      `,
    )
    .bind(memberId, sessionDate)
    .first<{ id: string }>();

  return Boolean(holiday);
}

async function availableCreditIdFor(
  db: D1DatabaseBinding,
  memberId: string,
  sessionDate: string,
) {
  const credit = await db
    .prepare(
      `
        select id
        from credits
        where
          member_id = ?1
          and status = 'available'
          and expires_on >= ?2
        order by expires_on, created_at
        limit 1
      `,
    )
    .bind(memberId, sessionDate)
    .first<{ id: string }>();

  return credit?.id ?? null;
}

export async function materializeRegularBookingsForWeek(
  db: D1DatabaseBinding,
  weekStart: string,
) {
  await expireOldCredits(db);

  const statements: ReturnType<D1DatabaseBinding["prepare"]>[] = [];

  for (let index = 0; index < 5; index += 1) {
    const sessionDate = addDays(weekStart, index);
    const weekday = index + 1;
    const candidates = await allRows<RecurringSlotCandidateRow>(
      db,
      `
        select recurring_slots.id, recurring_slots.member_id, recurring_slots.start_time
        from recurring_slots
        join members on members.id = recurring_slots.member_id
        where
          recurring_slots.weekday = ?1
          and recurring_slots.effective_from <= ?2
          and (
            recurring_slots.effective_until is null
            or recurring_slots.effective_until >= ?2
          )
          and members.role = 'member'
          and members.status = 'active'
        order by recurring_slots.created_at, recurring_slots.id
      `,
      weekday,
      sessionDate,
    );

    for (const candidate of candidates) {
      statements.push(
        db
          .prepare(
            `
              insert into bookings (
                id,
                member_id,
                session_date,
                start_time,
                kind,
                source_recurring_slot_id
              )
              select ?1, ?2, ?3, ?4, 'regular', ?5
              where
                not exists (
                  select 1
                  from bookings existing
                  where
                    existing.member_id = ?2
                    and existing.session_date = ?3
                    and existing.start_time = ?4
                )
                and (
                  select count(*)
                  from bookings existing_slot
                  where
                    existing_slot.session_date = ?3
                    and existing_slot.start_time = ?4
                    and existing_slot.status = 'booked'
                ) < ?6
                and not exists (
                  select 1
                  from slot_closures closure
                  where
                    closure.session_date = ?3
                    and closure.start_time = ?4
                )
                and not exists (
                  select 1
                  from member_holidays holiday
                  where
                    holiday.member_id = ?2
                    and ?3 between holiday.starts_on and holiday.ends_on
                )
            `,
          )
          .bind(
            `booking-${sessionDate}-${candidate.id}`,
            candidate.member_id,
            sessionDate,
            candidate.start_time,
            candidate.id,
            bookingRules.slotCapacity,
          ),
      );
    }
  }

  await runBatch(db, statements);
}

export async function readScheduleData(
  db: D1DatabaseBinding,
  user: SessionUser,
  options: { memberId?: string; weekStart?: string } = {},
) {
  const weekStart = normalizeWeekStart(options.weekStart);
  const targetMember = await getTargetMember(db, user, options.memberId);

  if (!targetMember || targetMember.status !== "active") {
    throw new Error("Active member not found.");
  }

  await materializeRegularBookingsForWeek(db, weekStart);

  const weekEnd = addDays(weekStart, 4);
  const today = todayIsoDate();
  const closureRows = await allRows<SlotClosureRow>(
    db,
    `
      select session_date, start_time
      from slot_closures
      where session_date between ?1 and ?2
    `,
    weekStart,
    weekEnd,
  );
  const closedSlots = new Set(
    closureRows.map((closure) => `${closure.session_date}:${closure.start_time}`),
  );
  const bookingRows = await allRows<BookingRow>(
    db,
    `
      select
        bookings.id,
        bookings.member_id,
        members.first_name,
        members.last_name,
        bookings.session_date,
        bookings.start_time,
        bookings.kind
      from bookings
      join members on members.id = bookings.member_id
      where
        bookings.session_date between ?1 and ?2
        and bookings.status = 'booked'
      order by bookings.start_time, members.first_name, members.last_name
    `,
    weekStart,
    weekEnd,
  );

  const week = dayNames.map((day, index) => {
    const isoDate = addDays(weekStart, index);

    return {
      day,
      date: shortDate(isoDate),
      isoDate,
      slots: bookingRules.slotTimes.map((time) => {
        const slotBookings = bookingRows.filter(
          (booking) => booking.session_date === isoDate && booking.start_time === time,
        );
        const closed = closedSlots.has(`${isoDate}:${time}`);

        if (user.role === "coach") {
          return {
            closed,
            time,
            names: slotBookings.map((booking) => booking.first_name),
            memberIds: slotBookings.map((booking) => booking.member_id),
          };
        }

        return {
          closed,
          time,
          names: slotBookings.map((booking) =>
            booking.member_id === user.id ? booking.first_name : "Booked",
          ),
          memberIds: slotBookings
            .filter((booking) => booking.member_id === user.id)
            .map((booking) => booking.member_id),
        };
      }),
    };
  });

  const upcomingRows = await allRows<BookingRow>(
    db,
    `
      select
        bookings.id,
        bookings.member_id,
        members.first_name,
        members.last_name,
        bookings.session_date,
        bookings.start_time,
        bookings.kind
      from bookings
      join members on members.id = bookings.member_id
      where
        bookings.member_id = ?1
        and bookings.session_date >= ?2
        and bookings.status = 'booked'
      order by bookings.session_date, bookings.start_time
      limit 20
    `,
    targetMember.id,
    today,
  );
  const credits = await allRows<CreditRow>(
    db,
    `
      select credits.id, credits.expires_on, bookings.session_date
      from credits
      join bookings on bookings.id = credits.origin_booking_id
      where
        credits.member_id = ?1
        and credits.status = 'available'
        and credits.expires_on >= ?2
      order by credits.expires_on, credits.created_at
    `,
    targetMember.id,
    today,
  );
  const waitlistRows = await allRows<WaitlistRow>(
    db,
    `
      select id, session_date, start_time
      from waitlist_entries
      where member_id = ?1 and session_date >= ?2
      order by session_date, start_time
    `,
    targetMember.id,
    today,
  );

  return {
    credits: credits.map((credit) => ({
      id: credit.id,
      label: dateLabel(credit.session_date),
      expiry: shortDate(credit.expires_on),
    })),
    upcoming: upcomingRows.map((booking) => ({
      id: booking.id,
      isoDate: booking.session_date,
      date: dateLabel(booking.session_date),
      time: booking.start_time,
      kind: clientBookingKind(booking.kind),
    })),
    waitlist: waitlistRows.map((entry) => ({
      id: entry.id,
      isoDate: entry.session_date,
      date: dateLabel(entry.session_date),
      time: entry.start_time,
    })),
    week,
    weekStart,
  } satisfies ScheduleData;
}

export async function createBooking(
  db: D1DatabaseBinding,
  user: SessionUser,
  input: {
    coachOverride?: boolean;
    memberId?: string;
    sessionDate: string;
    startTime: string;
  },
): Promise<BookingActionResult> {
  const sessionDate = cleanSessionDate(input.sessionDate);
  const startTime = cleanSlotTime(input.startTime);
  const weekStart = normalizeWeekStart(sessionDate);

  if (!sessionDate || !isSessionWeekday(sessionDate) || !startTime) {
    return { ok: false, status: 400, error: "Use a valid session date and time." };
  }

  const coachOverride = input.coachOverride === true;

  if (coachOverride && user.role !== "coach") {
    return { ok: false, status: 403, error: "Coach access required." };
  }

  const targetMember = await getTargetMember(db, user, input.memberId);

  if (!targetMember || targetMember.status !== "active") {
    return { ok: false, status: 404, error: "Active member not found." };
  }

  if (await isSlotClosed(db, sessionDate, startTime)) {
    return { ok: false, status: 409, error: "This session is closed." };
  }

  if (await isMemberOnHoliday(db, targetMember.id, sessionDate)) {
    return {
      ok: false,
      status: 409,
      error: "This member is marked away for this date.",
    };
  }

  await materializeRegularBookingsForWeek(db, weekStart);

  const existing = await db
    .prepare(
      `
        select id
        from bookings
        where
          member_id = ?1
          and session_date = ?2
          and start_time = ?3
          and status = 'booked'
      `,
    )
    .bind(targetMember.id, sessionDate, startTime)
    .first<{ id: string }>();

  if (existing) {
    return { ok: false, status: 409, error: "This member is already booked." };
  }

  const slotCount = await activeBookingCountForSlot(db, sessionDate, startTime);

  if (slotCount >= bookingRules.slotCapacity && !coachOverride) {
    return { ok: false, status: 409, error: "This session is full." };
  }

  const weeklyCount = await activeBookingCountForWeek(
    db,
    targetMember.id,
    weekStart,
  );
  const needsCredit = !coachOverride && weeklyCount >= targetMember.weekly_quota;
  const creditId = needsCredit
    ? await availableCreditIdFor(db, targetMember.id, sessionDate)
    : null;

  if (needsCredit && !creditId) {
    return {
      ok: false,
      status: 409,
      error: "Weekly quota reached. A coach override would be needed.",
    };
  }

  const bookingId = createId("booking");
  const kind = coachOverride ? "coach_override" : needsCredit ? "makeup" : "regular";
  const statements: ReturnType<D1DatabaseBinding["prepare"]>[] = [
    db
      .prepare(
        `
          insert into bookings (
            id,
            member_id,
            session_date,
            start_time,
            kind,
            redeemed_credit_id,
            coach_override
          ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        `,
      )
      .bind(
        bookingId,
        targetMember.id,
        sessionDate,
        startTime,
        kind,
        creditId,
        coachOverride ? 1 : 0,
      ),
    db
      .prepare(
        `
          delete from waitlist_entries
          where member_id = ?1 and session_date = ?2 and start_time = ?3
        `,
      )
      .bind(targetMember.id, sessionDate, startTime),
  ];

  if (creditId) {
    statements.push(
      db
        .prepare(
          `
            update credits
            set
              status = 'redeemed',
              redeemed_by_booking_id = ?1,
              updated_at = datetime('now')
            where id = ?2 and status = 'available'
          `,
        )
        .bind(bookingId, creditId),
    );
  }

  try {
    await runBatch(db, statements);
  } catch (error) {
    return {
      ok: false,
      status: 409,
      error:
        error instanceof Error
          ? error.message
          : "Unable to create this booking.",
    };
  }

  return {
    ok: true,
    bookingKind: clientBookingKind(kind),
    schedule: await readScheduleData(db, user, {
      memberId: targetMember.id,
      weekStart,
    }),
  };
}

export async function cancelBooking(
  db: D1DatabaseBinding,
  user: SessionUser,
  input: {
    memberId?: string;
    sessionDate: string;
    startTime: string;
  },
): Promise<BookingActionResult> {
  const sessionDate = cleanSessionDate(input.sessionDate);
  const startTime = cleanSlotTime(input.startTime);
  const weekStart = normalizeWeekStart(sessionDate);

  if (!sessionDate || !isSessionWeekday(sessionDate) || !startTime) {
    return { ok: false, status: 400, error: "Use a valid session date and time." };
  }

  const targetMember = await getTargetMember(db, user, input.memberId);

  if (!targetMember) {
    return { ok: false, status: 404, error: "Member not found." };
  }

  await materializeRegularBookingsForWeek(db, weekStart);

  const booking = await db
    .prepare(
      `
        select id, kind
        from bookings
        where
          member_id = ?1
          and session_date = ?2
          and start_time = ?3
          and status = 'booked'
      `,
    )
    .bind(targetMember.id, sessionDate, startTime)
    .first<{ id: string; kind: BookingRow["kind"] }>();

  if (!booking) {
    return { ok: false, status: 404, error: "Booking not found." };
  }

  const creditIssued = booking.kind === "regular";
  const statements: ReturnType<D1DatabaseBinding["prepare"]>[] = [
    db
      .prepare(
        `
          update bookings
          set
            status = 'cancelled',
            cancelled_at = datetime('now'),
            cancelled_by = ?1,
            updated_at = datetime('now')
          where id = ?2 and status = 'booked'
        `,
      )
      .bind(user.id, booking.id),
  ];

  if (creditIssued) {
    statements.push(
      db
        .prepare(
          `
            insert or ignore into credits (
              id,
              member_id,
              origin_booking_id,
              origin,
              expires_on
            ) values (?1, ?2, ?3, 'cancellation', ?4)
          `,
        )
        .bind(
          createId("credit"),
          targetMember.id,
          booking.id,
          addDays(sessionDate, bookingRules.creditExpiryDays),
        ),
    );
  }

  await runBatch(db, statements);

  return {
    ok: true,
    bookingKind: clientBookingKind(booking.kind),
    creditIssued,
    schedule: await readScheduleData(db, user, {
      memberId: targetMember.id,
      weekStart,
    }),
  };
}

function daySpanInclusive(startsOn: string, endsOn: string) {
  return (isoDateToUtcMs(endsOn) - isoDateToUtcMs(startsOn)) / 86_400_000 + 1;
}

async function materializeRegularBookingsForRange(
  db: D1DatabaseBinding,
  startsOn: string,
  endsOn: string,
) {
  let weekStart = weekStartFromIso(startsOn);
  const finalWeekStart = weekStartFromIso(endsOn);

  while (weekStart <= finalWeekStart) {
    await materializeRegularBookingsForWeek(db, weekStart);
    weekStart = addDays(weekStart, 7);
  }
}

export async function setMemberHoliday(
  db: D1DatabaseBinding,
  user: SessionUser,
  input: {
    endsOn: string;
    startsOn: string;
    weekStart?: string;
  },
): Promise<HolidayActionResult> {
  if (user.role !== "member") {
    return { ok: false, status: 403, error: "Member access required." };
  }

  const startsOn = cleanSessionDate(input.startsOn);
  const endsOn = cleanSessionDate(input.endsOn);

  if (!startsOn || !endsOn) {
    return {
      ok: false,
      status: 400,
      error: "Holiday start and end dates are required.",
    };
  }

  const today = todayIsoDate();

  if (startsOn < today) {
    return {
      ok: false,
      status: 400,
      error: "Holiday start must be today or later.",
    };
  }

  if (endsOn < startsOn) {
    return {
      ok: false,
      status: 400,
      error: "Holiday end must be on or after the start date.",
    };
  }

  if (daySpanInclusive(startsOn, endsOn) > 366) {
    return {
      ok: false,
      status: 400,
      error: "Holiday range cannot be longer than 366 days.",
    };
  }

  const targetMember = await getTargetMember(db, user, user.id);

  if (!targetMember || targetMember.status !== "active") {
    return { ok: false, status: 404, error: "Active member not found." };
  }

  await materializeRegularBookingsForRange(db, startsOn, endsOn);

  const bookedSessions = await allRows<HolidayBookingRow>(
    db,
    `
      select id, session_date
      from bookings
      where
        member_id = ?1
        and session_date between ?2 and ?3
        and session_date >= ?4
        and status = 'booked'
      order by session_date, start_time
    `,
    targetMember.id,
    startsOn,
    endsOn,
    today,
  );
  const creditCount = bookedSessions.length;
  const statements: ReturnType<D1DatabaseBinding["prepare"]>[] = [
    db
      .prepare(
        `
          insert into member_holidays (
            id,
            member_id,
            starts_on,
            ends_on,
            cancelled_booking_count,
            credit_count
          ) values (?1, ?2, ?3, ?4, ?5, ?6)
        `,
      )
      .bind(
        createId("holiday"),
        targetMember.id,
        startsOn,
        endsOn,
        bookedSessions.length,
        creditCount,
      ),
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
            member_id = ?1
            and session_date between ?2 and ?3
            and session_date >= ?4
            and status = 'booked'
        `,
      )
      .bind(targetMember.id, startsOn, endsOn, today),
    db
      .prepare(
        `
          delete from waitlist_entries
          where
            member_id = ?1
            and session_date between ?2 and ?3
            and session_date >= ?4
        `,
      )
      .bind(targetMember.id, startsOn, endsOn, today),
    ...bookedSessions.map((booking) =>
      db
        .prepare(
          `
            insert or ignore into credits (
              id,
              member_id,
              origin_booking_id,
              origin,
              expires_on
            ) values (?1, ?2, ?3, 'cancellation', ?4)
          `,
        )
        .bind(
          createId("credit"),
          targetMember.id,
          booking.id,
          addDays(booking.session_date, bookingRules.creditExpiryDays),
        ),
    ),
  ];

  await runBatch(db, statements);

  return {
    ok: true,
    cancelledCount: bookedSessions.length,
    creditCount,
    endsOn,
    schedule: await readScheduleData(db, user, {
      memberId: targetMember.id,
      weekStart: input.weekStart ?? startsOn,
    }),
    startsOn,
  };
}

export async function joinWaitlist(
  db: D1DatabaseBinding,
  user: SessionUser,
  input: {
    memberId?: string;
    sessionDate: string;
    startTime: string;
  },
): Promise<BookingActionResult> {
  const sessionDate = cleanSessionDate(input.sessionDate);
  const startTime = cleanSlotTime(input.startTime);
  const weekStart = normalizeWeekStart(sessionDate);

  if (!sessionDate || !isSessionWeekday(sessionDate) || !startTime) {
    return { ok: false, status: 400, error: "Use a valid session date and time." };
  }

  const targetMember = await getTargetMember(db, user, input.memberId);

  if (!targetMember || targetMember.status !== "active") {
    return { ok: false, status: 404, error: "Active member not found." };
  }

  if (await isSlotClosed(db, sessionDate, startTime)) {
    return { ok: false, status: 409, error: "This session is closed." };
  }

  if (await isMemberOnHoliday(db, targetMember.id, sessionDate)) {
    return {
      ok: false,
      status: 409,
      error: "This member is marked away for this date.",
    };
  }

  await materializeRegularBookingsForWeek(db, weekStart);

  const existingBooking = await db
    .prepare(
      `
        select id
        from bookings
        where
          member_id = ?1
          and session_date = ?2
          and start_time = ?3
          and status = 'booked'
      `,
    )
    .bind(targetMember.id, sessionDate, startTime)
    .first<{ id: string }>();

  if (existingBooking) {
    return { ok: false, status: 409, error: "This member is already booked." };
  }

  const slotCount = await activeBookingCountForSlot(db, sessionDate, startTime);

  if (slotCount < bookingRules.slotCapacity) {
    return { ok: false, status: 409, error: "This session has space to book." };
  }

  const weeklyCount = await activeBookingCountForWeek(
    db,
    targetMember.id,
    weekStart,
  );
  const hasCredit =
    weeklyCount < targetMember.weekly_quota ||
    Boolean(await availableCreditIdFor(db, targetMember.id, sessionDate));

  if (!hasCredit) {
    return {
      ok: false,
      status: 409,
      error: "Weekly quota reached. A coach override would be needed.",
    };
  }

  await db
    .prepare(
      `
        insert or ignore into waitlist_entries (
          id,
          member_id,
          session_date,
          start_time
        ) values (?1, ?2, ?3, ?4)
      `,
    )
    .bind(createId("waitlist"), targetMember.id, sessionDate, startTime)
    .run();

  return {
    ok: true,
    schedule: await readScheduleData(db, user, {
      memberId: targetMember.id,
      weekStart,
    }),
  };
}

export async function leaveWaitlist(
  db: D1DatabaseBinding,
  user: SessionUser,
  input: {
    memberId?: string;
    sessionDate: string;
    startTime: string;
  },
): Promise<BookingActionResult> {
  const sessionDate = cleanSessionDate(input.sessionDate);
  const startTime = cleanSlotTime(input.startTime);
  const weekStart = normalizeWeekStart(sessionDate);

  if (!sessionDate || !isSessionWeekday(sessionDate) || !startTime) {
    return { ok: false, status: 400, error: "Use a valid session date and time." };
  }

  const targetMember = await getTargetMember(db, user, input.memberId);

  if (!targetMember) {
    return { ok: false, status: 404, error: "Member not found." };
  }

  await db
    .prepare(
      `
        delete from waitlist_entries
        where member_id = ?1 and session_date = ?2 and start_time = ?3
      `,
    )
    .bind(targetMember.id, sessionDate, startTime)
    .run();

  return {
    ok: true,
    schedule: await readScheduleData(db, user, {
      memberId: targetMember.id,
      weekStart,
    }),
  };
}
