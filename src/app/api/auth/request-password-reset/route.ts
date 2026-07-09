import { NextResponse } from "next/server";

import {
  createRawToken,
  createTokenId,
  hashToken,
  isoInMinutes,
} from "@/lib/auth-tokens";
import { normalizeEmail, requireDatabase } from "@/lib/database";
import {
  parseCorrespondenceEvent,
  sendCorrespondenceEmail,
} from "@/lib/outbound-email";

type MemberRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: "pending" | "active" | "archived";
};

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const email = normalizeEmail(record.email);

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const db = await requireDatabase();
  const member = await db
    .prepare(
      `
        select id, first_name, last_name, email, status
        from members
        where email = ?1
      `,
    )
    .bind(email)
    .first<MemberRow>();

  if (!member || member.status === "archived") {
    return NextResponse.json({ ok: true });
  }

  const rawToken = createRawToken();
  const tokenHash = await hashToken(rawToken);
  const expiresAt = isoInMinutes(30);
  const appUrl =
    process.env.APP_URL ?? "https://fiteast-scheduling.intentionalsets.com";
  const resetLink = `${appUrl}/?resetToken=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(email)}`;

  await db
    .prepare(
      `
        insert into password_reset_tokens (
          id,
          member_id,
          email,
          token_hash,
          expires_at
        ) values (?1, ?2, ?3, ?4, ?5)
      `,
    )
    .bind(createTokenId(), member.id, email, tokenHash, expiresAt)
    .run();

  const event = parseCorrespondenceEvent({
    kind: "password-reset-requested",
    actorEmail: email,
    memberName: `${member.first_name} ${member.last_name}`,
    resetLink,
  });
  const notification = event
    ? await sendCorrespondenceEmail(event, { to: [member.email] })
    : ({ ok: false, status: 400, error: "Invalid correspondence event." } as const);

  if (!notification.ok) {
    return NextResponse.json(
      { error: notification.error },
      { status: notification.status },
    );
  }

  return NextResponse.json({ ok: true });
}
