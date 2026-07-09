import { NextResponse } from "next/server";

import { hashToken } from "@/lib/auth-tokens";
import { normalizeEmail, requireDatabase } from "@/lib/database";
import { cleanPassword, hashPassword, validatePassword } from "@/lib/passwords";
import { createSessionCookie, sessionUserPayload } from "@/lib/session";

type ResetTokenRow = {
  id: string;
  member_id: string;
};

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
  const token = typeof record.token === "string" ? record.token.trim() : "";
  const password = cleanPassword(record.password);
  const passwordError = validatePassword(password);

  if (!email || !token) {
    return NextResponse.json(
      { error: "Email and reset token are required." },
      { status: 400 },
    );
  }

  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const db = await requireDatabase();
  const tokenHash = await hashToken(token);
  const resetToken = await db
    .prepare(
      `
        select id, member_id
        from password_reset_tokens
        where
          email = ?1
          and token_hash = ?2
          and used_at is null
          and unixepoch(expires_at) > unixepoch('now')
      `,
    )
    .bind(email, tokenHash)
    .first<ResetTokenRow>();

  if (!resetToken) {
    return NextResponse.json(
      { error: "This reset link is invalid or expired." },
      { status: 401 },
    );
  }

  const member = await db
    .prepare(
      `
        select id, first_name, last_name, email, role, status
        from members
        where id = ?1
      `,
    )
    .bind(resetToken.member_id)
    .first<MemberRow>();

  if (!member || member.status === "archived") {
    return NextResponse.json(
      { error: "This account is not available." },
      { status: 403 },
    );
  }

  const passwordHash = await hashPassword(password);

  await db
    .prepare(
      `
        update members
        set
          password_hash = ?1,
          password_set_at = datetime('now'),
          updated_at = datetime('now')
        where id = ?2
      `,
    )
    .bind(passwordHash, member.id)
    .run();
  await db
    .prepare("update password_reset_tokens set used_at = datetime('now') where id = ?1")
    .bind(resetToken.id)
    .run();

  if (member.status !== "active") {
    return NextResponse.json({ ok: true, user: null });
  }

  await createSessionCookie(db, member);

  return NextResponse.json({ ok: true, user: sessionUserPayload(member) });
}
