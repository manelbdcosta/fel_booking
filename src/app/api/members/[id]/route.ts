import { NextResponse } from "next/server";

import { cleanText, requireDatabase } from "@/lib/database";
import { todayIsoDate } from "@/lib/schedule-data";
import { forbiddenResponse, getSessionUser, unauthorizedResponse } from "@/lib/server-auth";

type MemberParams = {
  params: Promise<{ id: string }>;
};

type MemberStatus = "pending" | "active" | "archived";

type MemberRow = {
  id: string;
  weekly_quota: number;
};

function isMemberStatus(value: unknown): value is MemberStatus {
  return value === "pending" || value === "active" || value === "archived";
}

export async function PATCH(request: Request, { params }: MemberParams) {
  const { id } = await params;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const status = record.status;
  const weeklyQuota = Number(record.weeklyQuota);

  if (!isMemberStatus(status)) {
    return NextResponse.json({ error: "Invalid member status." }, { status: 400 });
  }

  if (
    status !== "archived" &&
    (!Number.isFinite(weeklyQuota) || weeklyQuota < 1 || weeklyQuota > 5)
  ) {
    return NextResponse.json(
      { error: "Weekly quota must be between 1 and 5." },
      { status: 400 },
    );
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
  const member = await db
    .prepare(
      `
        select id, weekly_quota
        from members
        where id = ?1 and role = 'member'
      `,
    )
    .bind(memberId)
    .first<MemberRow>();

  if (!member) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  if (status === "archived") {
    const today = todayIsoDate();
    const statements = [
      db
        .prepare(
          `
            update members
            set status = 'archived', updated_at = datetime('now')
            where id = ?1 and role = 'member'
          `,
        )
        .bind(memberId),
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
          `,
        )
        .bind(user.id, memberId, today),
      db
        .prepare("delete from waitlist_entries where member_id = ?1 and session_date >= ?2")
        .bind(memberId, today),
      db
        .prepare(
          "delete from recurring_slots where member_id = ?1 and effective_until is null",
        )
        .bind(memberId),
      db
        .prepare(
          `
            update regular_slot_change_requests
            set status = 'cancelled', updated_at = datetime('now')
            where member_id = ?1 and status = 'pending'
          `,
        )
        .bind(memberId),
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

  await db
    .prepare(
      `
        update members
        set
          status = ?1,
          weekly_quota = ?2,
          updated_at = datetime('now')
        where id = ?3 and role = 'member'
      `,
    )
    .bind(status, Math.round(weeklyQuota), memberId)
    .run();

  return NextResponse.json({ ok: true });
}
