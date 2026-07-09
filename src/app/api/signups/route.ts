import { NextResponse } from "next/server";

import { cleanSignupPayload } from "@/lib/auth-tokens";
import { createId, requireDatabase } from "@/lib/database";
import {
  parseCorrespondenceEvent,
  sendCorrespondenceEmail,
} from "@/lib/outbound-email";

type ExistingMemberRow = {
  id: string;
  role: "member" | "coach";
  status: "pending" | "active" | "archived";
};

function invalidSignup(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return invalidSignup("Invalid JSON body.");
  }

  const signup = cleanSignupPayload(body);

  if (!signup.firstName || !signup.lastName || !signup.email) {
    return invalidSignup("First name, last name, and email are required.");
  }

  const db = await requireDatabase();
  const existing = await db
    .prepare("select id, role, status from members where email = ?1")
    .bind(signup.email)
    .first<ExistingMemberRow>();

  if (existing?.role === "coach") {
    return NextResponse.json(
      { error: "This email belongs to a coach account." },
      { status: 409 },
    );
  }

  let memberId = existing?.id;
  let status = existing?.status ?? "pending";

  if (existing) {
    if (existing.status === "pending") {
      await db
        .prepare(
          `
            update members
            set
              first_name = ?1,
              last_name = ?2,
              phone = ?3,
              updated_at = datetime('now')
            where id = ?4
          `,
        )
        .bind(signup.firstName, signup.lastName, signup.phone || null, existing.id)
        .run();
    }
  } else {
    memberId = createId("member");
    status = "pending";
    await db
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
          ) values (?1, ?2, ?3, ?4, ?5, 1, 'member', 'pending')
        `,
      )
      .bind(
        memberId,
        signup.firstName,
        signup.lastName,
        signup.phone || null,
        signup.email,
      )
      .run();
  }

  const event = parseCorrespondenceEvent({
    kind: "member-access-requested",
    firstName: signup.firstName,
    lastName: signup.lastName,
    email: signup.email,
    phone: signup.phone,
    reviewLink: `${process.env.APP_URL ?? "https://fiteast-scheduling.intentionalsets.com"}/?reviewMember=${encodeURIComponent(memberId ?? "")}`,
  });
  const notification = event
    ? await sendCorrespondenceEmail(event)
    : ({ ok: false, error: "Invalid correspondence event." } as const);

  return NextResponse.json(
    {
      member: {
        id: memberId,
        firstName: signup.firstName,
        lastName: signup.lastName,
        email: signup.email,
        phone: signup.phone,
        status,
        weeklyQuota: 1,
      },
      notificationSent: notification.ok,
      notificationError: notification.ok ? null : notification.error,
    },
    { status: existing ? 200 : 201 },
  );
}
