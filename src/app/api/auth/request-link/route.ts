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
  role: "member" | "coach";
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
        select id, first_name, last_name, email, role, status
        from members
        where email = ?1
      `,
    )
    .bind(email)
    .first<MemberRow>();

  if (!member) {
    return NextResponse.json(
      { error: "No account found for that email." },
      { status: 404 },
    );
  }

  if (member.status !== "active") {
    return NextResponse.json(
      { error: "This account is waiting for coach approval." },
      { status: 403 },
    );
  }

  const rawToken = createRawToken();
  const tokenHash = await hashToken(rawToken);
  const expiresAt = isoInMinutes(20);
  const appUrl =
    process.env.APP_URL ?? "https://fiteast-scheduling.intentionalsets.com";
  const signInLink = `${appUrl}/?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(email)}`;

  await db
    .prepare(
      `
        insert into auth_tokens (
          id,
          member_id,
          email,
          token_hash,
          purpose,
          expires_at
        ) values (?1, ?2, ?3, ?4, 'sign-in', ?5)
      `,
    )
    .bind(createTokenId(), member.id, email, tokenHash, expiresAt)
    .run();

  const event = parseCorrespondenceEvent({
    kind: "sign-in-link-created",
    actorEmail: email,
    memberName: `${member.first_name} ${member.last_name}`,
    signInLink,
  });
  const notification = event
    ? await sendCorrespondenceEmail(event, { to: [member.email] })
    : ({ ok: false, error: "Invalid correspondence event." } as const);

  return NextResponse.json(
    {
      emailSent: notification.ok,
      error: notification.ok ? null : notification.error,
    },
    { status: notification.ok ? 200 : 502 },
  );
}
