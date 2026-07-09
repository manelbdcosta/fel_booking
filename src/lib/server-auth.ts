import { cookies } from "next/headers";

import { sessionCookieName } from "@/lib/auth-tokens";
import type { D1DatabaseBinding } from "@/lib/database";

export type SessionUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "member" | "coach";
};

type SessionUserRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: "member" | "coach";
};

export async function getSessionUser(db: D1DatabaseBinding) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(sessionCookieName)?.value;

  if (!sessionId) {
    return null;
  }

  const user = await db
    .prepare(
      `
        select
          members.id,
          members.first_name,
          members.last_name,
          members.email,
          members.role
        from sessions
        join members on members.id = sessions.member_id
        where
          sessions.id = ?1
          and unixepoch(sessions.expires_at) > unixepoch('now')
          and members.status = 'active'
      `,
    )
    .bind(sessionId)
    .first<SessionUserRow>();

  if (!user) {
    cookieStore.delete(sessionCookieName);
    return null;
  }

  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    role: user.role,
  } satisfies SessionUser;
}

export function unauthorizedResponse() {
  return Response.json({ error: "Sign in required." }, { status: 401 });
}

export function forbiddenResponse() {
  return Response.json({ error: "Coach access required." }, { status: 403 });
}
