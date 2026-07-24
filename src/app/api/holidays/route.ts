import { NextResponse } from "next/server";

import { requireDatabase } from "@/lib/database";
import {
  parseCorrespondenceEvent,
  sendCorrespondenceEmail,
} from "@/lib/outbound-email";
import { setMemberHoliday, shortDate } from "@/lib/schedule-data";
import { getSessionUser, unauthorizedResponse } from "@/lib/server-auth";

export async function POST(request: Request) {
  const db = await requireDatabase();
  const user = await getSessionUser(db);

  if (!user) {
    return unauthorizedResponse();
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const result = await setMemberHoliday(db, user, {
    endsOn: typeof record.endsOn === "string" ? record.endsOn : "",
    startsOn: typeof record.startsOn === "string" ? record.startsOn : "",
    weekStart: typeof record.weekStart === "string" ? record.weekStart : undefined,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  const event = parseCorrespondenceEvent({
    cancelledCount: String(result.cancelledCount),
    creditCount: String(result.creditCount),
    holidayEnd: `${result.endsOn} (${shortDate(result.endsOn)})`,
    holidayStart: `${result.startsOn} (${shortDate(result.startsOn)})`,
    kind: "member-holiday-set",
    memberName: `${user.firstName} ${user.lastName}`.trim(),
  });
  const notification = event
    ? await sendCorrespondenceEmail(event)
    : ({ ok: false, status: 400, error: "Invalid correspondence event." } as const);

  if (!notification.ok) {
    console.error("Unable to send holiday email", notification.error);
  }

  return NextResponse.json({
    cancelledCount: result.cancelledCount,
    creditCount: result.creditCount,
    endsOn: result.endsOn,
    notificationError: notification.ok ? null : notification.error,
    notificationSent: notification.ok,
    ok: true,
    schedule: result.schedule,
    startsOn: result.startsOn,
  });
}
