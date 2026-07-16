import { allRows, createId, type D1DatabaseBinding } from "@/lib/database";

export type CoachNotificationKind =
  | "booking-created"
  | "booking-cancelled"
  | "waitlist-joined"
  | "waitlist-left"
  | "slot-closed"
  | "regular-slot-change-requested";

export type CoachNotificationSummary = {
  id: string;
  kind: CoachNotificationKind;
  memberId: string | null;
  memberName: string;
  sessionDate: string | null;
  startTime: string | null;
  regularSlotRequestId: string | null;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

type CoachNotificationRow = {
  id: string;
  kind: CoachNotificationKind;
  member_id: string | null;
  member_name: string;
  session_date: string | null;
  start_time: string | null;
  regular_slot_request_id: string | null;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

type MemberNameRow = {
  email: string;
  id: string;
  first_name: string;
  last_name: string;
};

export async function readMemberNotificationTarget(
  db: D1DatabaseBinding,
  memberId: string,
) {
  const member = await db
    .prepare(
      `
        select id, first_name, last_name, email
        from members
        where id = ?1 and role = 'member'
      `,
    )
    .bind(memberId)
    .first<MemberNameRow>();

  return member
    ? {
        email: member.email,
        id: member.id,
        name: `${member.first_name} ${member.last_name}`.trim(),
      }
    : null;
}

export async function createCoachNotification(
  db: D1DatabaseBinding,
  notification: {
    kind: CoachNotificationKind;
    memberId?: string | null;
    memberName: string;
    sessionDate?: string | null;
    startTime?: string | null;
    regularSlotRequestId?: string | null;
    title: string;
    body: string;
  },
) {
  await db
    .prepare(
      `
        insert into coach_notifications (
          id,
          kind,
          member_id,
          member_name,
          session_date,
          start_time,
          regular_slot_request_id,
          title,
          body
        ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
      `,
    )
    .bind(
      createId("coach-notification"),
      notification.kind,
      notification.memberId ?? null,
      notification.memberName,
      notification.sessionDate ?? null,
      notification.startTime ?? null,
      notification.regularSlotRequestId ?? null,
      notification.title,
      notification.body,
    )
    .run();
}

export async function readCoachNotifications(
  db: D1DatabaseBinding,
  limit = 30,
): Promise<CoachNotificationSummary[]> {
  const rows = await allRows<CoachNotificationRow>(
    db,
    `
      select
        id,
        kind,
        member_id,
        member_name,
        session_date,
        start_time,
        regular_slot_request_id,
        title,
        body,
        read_at,
        created_at
      from coach_notifications
      order by datetime(created_at) desc
      limit ?1
    `,
    Math.min(100, Math.max(1, limit)),
  );

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    memberId: row.member_id,
    memberName: row.member_name,
    sessionDate: row.session_date,
    startTime: row.start_time,
    regularSlotRequestId: row.regular_slot_request_id,
    title: row.title,
    body: row.body,
    readAt: row.read_at,
    createdAt: row.created_at,
  }));
}

export async function markCoachNotificationsRead(db: D1DatabaseBinding) {
  await db
    .prepare(
      `
        update coach_notifications
        set read_at = datetime('now')
        where read_at is null
      `,
    )
    .run();
}
