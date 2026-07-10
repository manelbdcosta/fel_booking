import { NextResponse } from "next/server";

import {
  createRawToken,
  createTokenId,
  hashToken,
  isoInDays,
} from "@/lib/auth-tokens";
import { bookingRules } from "@/lib/booking-config";
import {
  cleanText,
  createId,
  normalizeEmail,
  requireDatabase,
  type D1DatabaseBinding,
} from "@/lib/database";
import {
  parseCorrespondenceEvent,
  sendCorrespondenceEmail,
} from "@/lib/outbound-email";
import { todayIsoDate, weekStartFromIso } from "@/lib/schedule-data";
import { forbiddenResponse, getSessionUser, unauthorizedResponse } from "@/lib/server-auth";

type InviteRole = "member" | "coach";

type IncomingSlot = {
  day?: unknown;
  id?: unknown;
  time?: unknown;
};

type ExistingMemberRow = {
  id: string;
};

type RecurringSlotCountRow = {
  count: number;
  start_time: string;
  weekday: number;
};

const weekdayNumbers: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
};
const allowedTimes = new Set<string>(bookingRules.slotTimes);

function invalidInvitation(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function parseRole(value: unknown): InviteRole | null {
  return value === "member" || value === "coach" ? value : null;
}

function parseName(value: unknown) {
  const name = cleanText(value, 160).replace(/\s+/g, " ");
  const parts = name.split(" ").filter(Boolean);

  return {
    firstName: parts[0] ?? "",
    fullName: name,
    lastName: parts.slice(1).join(" "),
  };
}

function parseOptionalWeeklyQuota(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const quota = Number(value);

  return Number.isFinite(quota) ? Math.round(quota) : NaN;
}

function parseSlots(value: unknown) {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    return null;
  }

  return value.map((slot) => {
    const record =
      slot && typeof slot === "object" ? (slot as IncomingSlot) : {};

    return {
      day: cleanText(record.day, 20),
      id: cleanText(record.id, 120),
      time: cleanText(record.time, 5),
    };
  });
}

async function assertRegularSlotCapacity(
  db: D1DatabaseBinding,
  slots: Array<{ day: string; time: string }>,
) {
  if (slots.length === 0) {
    return null;
  }

  const seenSlots = new Set<string>();
  const proposedCounts = new Map<string, number>();

  for (const slot of slots) {
    const weekday = weekdayNumbers[slot.day];

    if (!weekday || !allowedTimes.has(slot.time)) {
      return "Regular slots must use a valid weekday and time.";
    }

    const signature = `${weekday}|${slot.time}`;

    if (seenSlots.has(signature)) {
      return "Duplicate regular slots are not allowed.";
    }

    seenSlots.add(signature);
    proposedCounts.set(signature, Number(proposedCounts.get(signature) ?? 0) + 1);
  }

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
            recurring_slots.effective_until is null
            and members.role = 'member'
            and members.status <> 'archived'
          group by recurring_slots.weekday, recurring_slots.start_time
        `,
      )
      .all<RecurringSlotCountRow>()
  ).results;
  const occupancyBySlot = new Map(
    occupancyRows.map((row) => [
      `${row.weekday}|${row.start_time}`,
      Number(row.count),
    ]),
  );

  for (const [signature, proposedCount] of proposedCounts) {
    const assigned = Number(occupancyBySlot.get(signature) ?? 0) + proposedCount;

    if (assigned > bookingRules.slotCapacity) {
      const [weekday, time] = signature.split("|");
      const day =
        Object.entries(weekdayNumbers).find(([, value]) => value === Number(weekday))
          ?.[0] ?? "This slot";

      return `${day} ${time} is full (${bookingRules.slotCapacity}/${bookingRules.slotCapacity}).`;
    }
  }

  return null;
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return invalidInvitation("Invalid JSON body.");
  }

  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const { firstName, fullName, lastName } = parseName(record.name);
  const email = normalizeEmail(record.email);
  const role = parseRole(record.role);
  const parsedSlots = parseSlots(record.slots);
  const requestedWeeklyQuota = parseOptionalWeeklyQuota(record.weeklyQuota);

  if (!firstName || !email || !role) {
    return invalidInvitation("Name, email, and role are required.");
  }

  if (!parsedSlots) {
    return invalidInvitation("Regular slots must be sent as a list.");
  }

  if (Number.isNaN(requestedWeeklyQuota)) {
    return invalidInvitation("Sessions per week must be a number.");
  }

  const slots = role === "member" ? parsedSlots : [];
  const weeklyQuota =
    role === "member"
      ? (requestedWeeklyQuota ?? Math.max(1, slots.length))
      : 1;

  if (weeklyQuota < 1 || weeklyQuota > 5) {
    return invalidInvitation("Sessions per week must be between 1 and 5.");
  }

  if (slots.length > weeklyQuota) {
    return invalidInvitation("Regular slots cannot exceed sessions per week.");
  }

  const db = await requireDatabase();
  const user = await getSessionUser(db);

  if (!user) {
    return unauthorizedResponse();
  }

  if (user.role !== "coach") {
    return forbiddenResponse();
  }

  const existing = await db
    .prepare("select id from members where email = ?1")
    .bind(email)
    .first<ExistingMemberRow>();

  if (existing) {
    return NextResponse.json(
      { error: "An account already exists for this email." },
      { status: 409 },
    );
  }

  const capacityError = await assertRegularSlotCapacity(db, slots);

  if (capacityError) {
    return invalidInvitation(capacityError);
  }

  const memberId = createId(role);
  const rawToken = createRawToken();
  const tokenHash = await hashToken(rawToken);
  const inviteId = createTokenId();
  const expiresAt = isoInDays(7);
  const createdAt = new Date().toISOString();
  const effectiveFrom = weekStartFromIso(todayIsoDate());
  const appUrl =
    process.env.APP_URL ?? "https://fiteast-scheduling.intentionalsets.com";
  const inviteLink = `${appUrl}/?inviteToken=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(email)}`;
  const savedSlots = slots.map((slot) => ({
    ...slot,
    id: slot.id || createId("regular"),
  }));
  const statements = [
    db
      .prepare(
        `
          insert into members (
            id,
            first_name,
            last_name,
            phone,
            email,
            weekly_quota,
            role,
            status
          ) values (?1, ?2, ?3, null, ?4, ?5, ?6, 'pending')
        `,
      )
      .bind(memberId, firstName, lastName, email, weeklyQuota, role),
    ...savedSlots.map((slot) =>
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
          slot.id,
          memberId,
          weekdayNumbers[slot.day],
          slot.time,
          effectiveFrom,
        ),
    ),
    db
      .prepare(
        `
          insert into account_invites (
            id,
            member_id,
            email,
            role,
            token_hash,
            expires_at,
            created_by
          ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        `,
      )
      .bind(inviteId, memberId, email, role, tokenHash, expiresAt, user.id),
  ];

  if (db.batch) {
    await db.batch(statements);
  } else {
    for (const statement of statements) {
      await statement.run();
    }
  }

  const event = parseCorrespondenceEvent({
    kind: "account-invited",
    actorEmail: user.email,
    email,
    inviteLink,
    memberName: fullName,
    role,
    weeklyQuota: role === "member" ? String(weeklyQuota) : "",
  });
  const notification = event
    ? await sendCorrespondenceEmail(event, { to: [email] })
    : ({ ok: false, status: 400, error: "Invalid correspondence event." } as const);

  return NextResponse.json(
    {
      member: {
        email,
        firstName,
        id: memberId,
        lastName,
        status: "pending",
        weeklyQuota,
      },
      notificationSent: notification.ok,
      notificationError: notification.ok ? null : notification.error,
      pendingInvite: {
        id: inviteId,
        memberId,
        name: fullName,
        email,
        role,
        expiresAt,
        createdAt,
      },
      regularSlots: savedSlots,
      role,
    },
    { status: 201 },
  );
}
