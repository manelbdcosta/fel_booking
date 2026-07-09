import { cookies } from "next/headers";

import { createSessionId, isoInDays, sessionCookieName } from "@/lib/auth-tokens";
import type { D1DatabaseBinding } from "@/lib/database";

export type AuthenticatedMember = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: "member" | "coach";
};

export async function createSessionCookie(
  db: D1DatabaseBinding,
  member: AuthenticatedMember,
) {
  const sessionId = createSessionId();
  const expiresAt = isoInDays(30);

  await db
    .prepare("insert into sessions (id, member_id, expires_at) values (?1, ?2, ?3)")
    .bind(sessionId, member.id, expiresAt)
    .run();

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, sessionId, {
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export function sessionUserPayload(member: AuthenticatedMember) {
  return {
    id: member.id,
    firstName: member.first_name,
    lastName: member.last_name,
    email: member.email,
    role: member.role,
  };
}
