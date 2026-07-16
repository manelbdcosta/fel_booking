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
import { dateLabel, joinWaitlist, leaveWaitlist } from "@/lib/schedule-data";
import { getSessionUser, unauthorizedResponse } from "@/lib/server-auth";

async function parseAction(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return null;
  }

  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  return {
    memberId: cleanText(record.memberId, 120),
    sessionDate: cleanText(record.sessionDate, 10),
    startTime: cleanText(record.startTime, 5),
  };
}

export async function POST(request: Request) {
  const db = await requireDatabase();
  const user = await getSessionUser(db);

  if (!user) {
    return unauthorizedResponse();
  }

  const action = await parseAction(request);

  if (!action) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = await joinWaitlist(db, user, action);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  const notificationMemberId = user.role === "member" ? user.id : action.memberId;
  const member = notificationMemberId
    ? await readMemberNotificationTarget(db, notificationMemberId)
    : null;

  if (member) {
    const memberEvent = parseCorrespondenceEvent({
      bookingDate: dateLabel(action.sessionDate),
      kind: "waitlist-joined",
      memberName: member.name,
      time: action.startTime,
    });

    try {
      await createCoachNotification(db, {
        body: "Waitlist entry added.",
        kind: "waitlist-joined",
        memberId: member.id,
        memberName: member.name,
        sessionDate: action.sessionDate,
        startTime: action.startTime,
        title: `${member.name} joined the waitlist for ${dateLabel(
          action.sessionDate,
        )} at ${action.startTime}`,
      });
    } catch (error) {
      console.error("Unable to create waitlist notification", error);
    }

    if (memberEvent) {
      const emailResult = await sendCorrespondenceEmail(memberEvent, {
        to: [member.email],
      });

      if (!emailResult.ok) {
        console.error("Unable to send waitlist email", emailResult.error);
      }
    }
  }

  return NextResponse.json(result);
}

export async function DELETE(request: Request) {
  const db = await requireDatabase();
  const user = await getSessionUser(db);

  if (!user) {
    return unauthorizedResponse();
  }

  const action = await parseAction(request);

  if (!action) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = await leaveWaitlist(db, user, action);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  const notificationMemberId = user.role === "member" ? user.id : action.memberId;
  const member = notificationMemberId
    ? await readMemberNotificationTarget(db, notificationMemberId)
    : null;

  if (member) {
    const memberEvent = parseCorrespondenceEvent({
      bookingDate: dateLabel(action.sessionDate),
      kind: "waitlist-left",
      memberName: member.name,
      time: action.startTime,
    });

    try {
      await createCoachNotification(db, {
        body: "Waitlist entry removed.",
        kind: "waitlist-left",
        memberId: member.id,
        memberName: member.name,
        sessionDate: action.sessionDate,
        startTime: action.startTime,
        title: `${member.name} left the waitlist for ${dateLabel(
          action.sessionDate,
        )} at ${action.startTime}`,
      });
    } catch (error) {
      console.error("Unable to create waitlist removal notification", error);
    }

    if (memberEvent) {
      const emailResult = await sendCorrespondenceEmail(memberEvent, {
        to: [member.email],
      });

      if (!emailResult.ok) {
        console.error("Unable to send waitlist removal email", emailResult.error);
      }
    }
  }

  return NextResponse.json(result);
}
