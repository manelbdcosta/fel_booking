import { allRows, type D1DatabaseBinding } from "@/lib/database";

export type MemberStatus = "pending" | "active" | "archived";
export type MemberRole = "member" | "coach";

export type MemberRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  weekly_quota: number;
  role: MemberRole;
  status: MemberStatus;
  attended_count: number;
  missed_count: number;
};

type RecurringSlotRow = {
  id: string;
  member_id: string;
  weekday: number;
  start_time: string;
};

type RegularSlotRequestRow = {
  id: string;
  first_name: string;
  last_name: string;
  abandoned_weekday: number | null;
  abandoned_start_time: string | null;
  requested_weekday: number;
  requested_start_time: string;
  effective_from: string;
  note: string | null;
  status: "pending" | "approved" | "declined" | "cancelled";
};

type AccountInviteRow = {
  id: string;
  member_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: MemberRole;
  expires_at: string;
  created_at: string;
};

const weekdaysByNumber: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
};

export function fullName(row: Pick<MemberRow, "first_name" | "last_name">) {
  return `${row.first_name} ${row.last_name}`;
}

export async function readBootstrapData(db: D1DatabaseBinding) {
  const memberRows = await allRows<MemberRow>(
    db,
    `
      select
        id,
        first_name,
        last_name,
        email,
        phone,
        weekly_quota,
        role,
        status,
        attended_count,
        missed_count
      from members
      where status <> 'archived'
      order by
        case role when 'coach' then 0 else 1 end,
        case status when 'pending' then 0 else 1 end,
        first_name,
        last_name
    `,
  );
  const recurringSlotRows = await allRows<RecurringSlotRow>(
    db,
    `
      select id, member_id, weekday, start_time
      from recurring_slots
      where effective_until is null
      order by member_id, weekday, start_time
    `,
  );
  const requestRows = await allRows<RegularSlotRequestRow>(
    db,
    `
      select
        regular_slot_change_requests.id,
        members.first_name,
        members.last_name,
        regular_slot_change_requests.abandoned_weekday,
        regular_slot_change_requests.abandoned_start_time,
        regular_slot_change_requests.requested_weekday,
        regular_slot_change_requests.requested_start_time,
        regular_slot_change_requests.effective_from,
        regular_slot_change_requests.note,
        regular_slot_change_requests.status
      from regular_slot_change_requests
      join members on members.id = regular_slot_change_requests.member_id
      where regular_slot_change_requests.status <> 'cancelled'
      order by regular_slot_change_requests.created_at desc
    `,
  );
  const inviteRows = await allRows<AccountInviteRow>(
    db,
    `
      select
        account_invites.id,
        account_invites.member_id,
        members.first_name,
        members.last_name,
        account_invites.email,
        account_invites.role,
        account_invites.expires_at,
        account_invites.created_at
      from account_invites
      join members on members.id = account_invites.member_id
      where
        account_invites.accepted_at is null
        and members.status <> 'archived'
      order by account_invites.created_at desc
    `,
  );

  const members = memberRows
    .filter((row) => row.role === "member")
    .map((row) => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone ?? "",
      weeklyQuota: row.weekly_quota,
      status: row.status,
      attended: row.attended_count,
      missed: row.missed_count,
    }));
  const coaches = memberRows
    .filter((row) => row.role === "coach" && row.status === "active")
    .map((row) => row.first_name);
  const coachAccounts = memberRows
    .filter((row) => row.role === "coach")
    .map((row) => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      status: row.status,
    }));
  const weeklyQuotasByMember = Object.fromEntries(
    members.map((member) => [member.id, member.weeklyQuota]),
  );
  const regularSlotsByMember = Object.fromEntries(
    members.map((member) => [
      member.id,
      recurringSlotRows
        .filter((slot) => slot.member_id === member.id)
        .map((slot) => ({
          id: slot.id,
          day: weekdaysByNumber[slot.weekday] ?? "Monday",
          time: slot.start_time,
        })),
    ]),
  );
  const regularSlotRequests = requestRows.map((row) => ({
    id: row.id,
    memberName: fullName(row),
    abandonedDay: row.abandoned_weekday
      ? (weekdaysByNumber[row.abandoned_weekday] ?? "")
      : "",
    abandonedTime: row.abandoned_start_time ?? "",
    requestedDay: weekdaysByNumber[row.requested_weekday] ?? "Monday",
    requestedTime: row.requested_start_time,
    effectiveWeek: row.effective_from,
    note: row.note ?? "",
    status:
      row.status === "cancelled"
        ? ("declined" as const)
        : (row.status as "pending" | "approved" | "declined"),
  }));
  const pendingInvites = inviteRows.map((row) => ({
    id: row.id,
    memberId: row.member_id,
    name: fullName(row),
    email: row.email,
    role: row.role,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }));

  return {
    coachAccounts,
    coaches,
    members,
    pendingInvites,
    regularSlotsByMember,
    regularSlotRequests,
    weeklyQuotasByMember,
  };
}
