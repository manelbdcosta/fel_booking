import { NextResponse } from "next/server";

import {
  createCoachNotification,
  readMemberNotificationTarget,
} from "@/lib/coach-notifications";
import { cleanText, requireDatabase } from "@/lib/database";
import {
  parseCorrespondenceEvent,
  sendCorrespondenceEmail,
} from "@/lib/outbound-email";
import { createBooking, dateLabel } from "@/lib/schedule-data";
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
  const memberId = cleanText(record.memberId, 120);
  const sessionDate = cleanText(record.sessionDate, 10);
  const startTime = cleanText(record.startTime, 5);
  const result = await createBooking(db, user, {
    coachOverride: record.coachOverride === true,
    memberId,
    sessionDate,
    startTime,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  const notificationMemberId = user.role === "member" ? user.id : memberId;
  const member = notificationMemberId
    ? await readMemberNotificationTarget(db, notificationMemberId)
    : null;

  if (member) {
    const memberEvent = parseCorrespondenceEvent({
      bookingDate: dateLabel(sessionDate),
      bookingKind: result.bookingKind ?? "Regular",
      kind: "booking-created",
      memberName: member.name,
      time: startTime,
    });

    try {
      await createCoachNotification(db, {
        body: `${result.bookingKind ?? "Regular"} booking created${
          user.role === "coach" ? " by a coach" : ""
        }.`,
        kind: "booking-created",
        memberId: member.id,
        memberName: member.name,
        sessionDate,
        startTime,
        title: `${member.name} booked ${dateLabel(sessionDate)} at ${startTime}`,
      });
    } catch (error) {
      console.error("Unable to create booking notification", error);
    }

    if (memberEvent) {
      const emailResult = await sendCorrespondenceEmail(memberEvent, {
        to: [member.email],
      });

      if (!emailResult.ok) {
        console.error("Unable to send booking email", emailResult.error);
      }
    }
  }

  return NextResponse.json(result);
}
