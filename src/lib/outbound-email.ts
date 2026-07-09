import { Resend } from "resend";

import { emailConfig } from "@/lib/email-config";

type CorrespondenceKind =
  | "magic-link-requested"
  | "member-access-requested"
  | "regular-slot-change-requested"
  | "regular-slot-assigned"
  | "regular-slot-updated"
  | "regular-slot-removed"
  | "regular-slot-request-approved"
  | "regular-slot-request-declined"
  | "weekly-quota-updated"
  | "booking-created"
  | "booking-cancelled"
  | "waitlist-joined"
  | "waitlist-left";

export type CorrespondenceEvent = {
  kind: CorrespondenceKind;
  actorEmail?: string;
  memberName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  requestedDay?: string;
  requestedTime?: string;
  day?: string;
  time?: string;
  effectiveWeek?: string;
  note?: string;
  bookingDate?: string;
  bookingKind?: string;
  weeklyQuota?: string;
};

export type BuiltCorrespondenceEmail = {
  subject: string;
  text: string;
  html: string;
};

type SendCorrespondenceResult =
  | { ok: true; id: string | undefined }
  | { ok: false; status: number; error: string };

const kindLabels: Record<CorrespondenceKind, string> = {
  "magic-link-requested": "Magic link requested",
  "member-access-requested": "Member access requested",
  "regular-slot-change-requested": "Regular slot change requested",
  "regular-slot-assigned": "Regular slot assigned",
  "regular-slot-updated": "Regular slot updated",
  "regular-slot-removed": "Regular slot removed",
  "regular-slot-request-approved": "Regular slot request approved",
  "regular-slot-request-declined": "Regular slot request declined",
  "weekly-quota-updated": "Weekly entitlement updated",
  "booking-created": "Booking created",
  "booking-cancelled": "Booking cancelled",
  "waitlist-joined": "Waitlist joined",
  "waitlist-left": "Waitlist left",
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 500) : "";
}

function isCorrespondenceKind(value: unknown): value is CorrespondenceKind {
  return typeof value === "string" && value in kindLabels;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function row(label: string, value: unknown) {
  const cleaned = cleanText(value);

  return cleaned ? ([label, cleaned] as const) : null;
}

function rowsForEvent(event: CorrespondenceEvent) {
  return [
    row("Member", event.memberName),
    row("First name", event.firstName),
    row("Last name", event.lastName),
    row("Email", event.email),
    row("Phone", event.phone),
    row("Actor email", event.actorEmail),
    row("Requested day", event.requestedDay),
    row("Requested time", event.requestedTime),
    row("Assigned day", event.day),
    row("Assigned time", event.time),
    row("Effective week", event.effectiveWeek),
    row("Booking date", event.bookingDate),
    row("Booking time", event.time),
    row("Booking kind", event.bookingKind),
    row("Weekly entitlement", event.weeklyQuota),
    row("Note", event.note),
  ].filter(Boolean) as Array<readonly [string, string]>;
}

export function parseCorrespondenceEvent(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (!isCorrespondenceKind(record.kind)) {
    return null;
  }

  return {
    kind: record.kind,
    actorEmail: cleanText(record.actorEmail),
    memberName: cleanText(record.memberName),
    firstName: cleanText(record.firstName),
    lastName: cleanText(record.lastName),
    email: cleanText(record.email),
    phone: cleanText(record.phone),
    requestedDay: cleanText(record.requestedDay),
    requestedTime: cleanText(record.requestedTime),
    day: cleanText(record.day),
    time: cleanText(record.time),
    effectiveWeek: cleanText(record.effectiveWeek),
    note: cleanText(record.note),
    bookingDate: cleanText(record.bookingDate),
    bookingKind: cleanText(record.bookingKind),
    weeklyQuota: cleanText(record.weeklyQuota),
  } satisfies CorrespondenceEvent;
}

export function buildCorrespondenceEmail(event: CorrespondenceEvent) {
  const title = kindLabels[event.kind];
  const rows = rowsForEvent(event);
  const textRows = rows.map(([label, value]) => `${label}: ${value}`);
  const htmlRows = rows
    .map(
      ([label, value]) =>
        `<tr><th align="left" style="padding:8px;border-bottom:1px solid #d7e2e7">${escapeHtml(label)}</th><td style="padding:8px;border-bottom:1px solid #d7e2e7">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  return {
    subject: `[FEL Booking] ${title}`,
    text: [
      title,
      "",
      "A Fit East London booking event needs attention.",
      "",
      ...textRows,
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#09242c">
        <h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(title)}</h1>
        <p style="margin:0 0 16px">A Fit East London booking event needs attention.</p>
        <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:640px">
          ${htmlRows}
        </table>
      </div>
    `,
  } satisfies BuiltCorrespondenceEmail;
}

export async function sendCorrespondenceEmail(
  event: CorrespondenceEvent,
): Promise<SendCorrespondenceResult> {
  if (!process.env.RESEND_API_KEY) {
    return {
      ok: false,
      status: 503,
      error: "RESEND_API_KEY is not configured.",
    };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const email = buildCorrespondenceEmail(event);
  const { data, error } = await resend.emails.send({
    from: emailConfig.from,
    to: emailConfig.coachNotificationEmails,
    replyTo: emailConfig.replyTo,
    subject: email.subject,
    text: email.text,
    html: email.html,
    tags: [{ name: "category", value: "booking-correspondence" }],
  });

  if (error) {
    return {
      ok: false,
      status: error.statusCode ?? 502,
      error: error.message,
    };
  }

  return { ok: true, id: data?.id };
}
