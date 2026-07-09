import { emailConfig } from "@/lib/email-config";

type CorrespondenceKind =
  | "password-reset-requested"
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
  reviewLink?: string;
  resetLink?: string;
};

export type BuiltCorrespondenceEmail = {
  subject: string;
  text: string;
  html: string;
};

type SendCorrespondenceResult =
  | { ok: true; id: string | undefined }
  | { ok: false; status: number; error: string };

type SendCorrespondenceOptions = {
  to?: string[];
};

const kindLabels: Record<CorrespondenceKind, string> = {
  "password-reset-requested": "Password reset requested",
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

async function sendViaResend(
  email: BuiltCorrespondenceEmail,
  options: SendCorrespondenceOptions = {},
): Promise<SendCorrespondenceResult> {
  if (!process.env.RESEND_API_KEY) {
    return {
      ok: false,
      status: 503,
      error: "RESEND_API_KEY is not configured.",
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({
      from: emailConfig.from,
      to: options.to?.length ? options.to : emailConfig.coachNotificationEmails,
      reply_to: emailConfig.replyTo,
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const responseBody = await response.text();

  if (!response.ok) {
    console.error("Resend email send failed", {
      body: responseBody,
      status: response.status,
    });

    return {
      ok: false as const,
      status: response.status,
      error: `Resend failed with ${response.status}: ${responseBody}`,
    };
  }

  let data: { id?: string } = {};

  try {
    data = JSON.parse(responseBody) as { id?: string };
  } catch {
    data = {};
  }

  return { ok: true, id: data.id };
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
    row("Review link", event.reviewLink),
    row("Reset link", event.resetLink),
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
    reviewLink: cleanText(record.reviewLink),
    resetLink: cleanText(record.resetLink),
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

  if (event.kind === "password-reset-requested") {
    return {
      subject: "[FEL Booking] Reset your password",
      text: [
        "Reset your Fit East London booking password",
        "",
        "Use this secure link to create a new password. The link expires in 30 minutes.",
        "",
        event.resetLink,
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#09242c">
          <h1 style="font-size:20px;margin:0 0 12px">Reset your password</h1>
          <p style="margin:0 0 16px">Use this secure link to create a new Fit East London booking password. The link expires in 30 minutes.</p>
          <p style="margin:0 0 16px"><a href="${escapeHtml(event.resetLink ?? "")}" style="display:inline-block;border-radius:6px;background:#00ffb8;color:#01161c;font-weight:700;padding:10px 14px;text-decoration:none">Create new password</a></p>
          <p style="margin:0;color:#49666e;font-size:13px">${escapeHtml(event.resetLink ?? "")}</p>
        </div>
      `,
    } satisfies BuiltCorrespondenceEmail;
  }

  if (event.kind === "member-access-requested") {
    const memberName = [event.firstName, event.lastName].filter(Boolean).join(" ");

    return {
      subject: "[FEL Booking] Member access requested",
      text: [
        "A new member requested access.",
        "",
        memberName ? `Name: ${memberName}` : "",
        event.email ? `Email: ${event.email}` : "",
        event.phone ? `Phone: ${event.phone}` : "",
        "",
        "Review this signup in the coach dashboard:",
        event.reviewLink,
      ]
        .filter(Boolean)
        .join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#09242c">
          <h1 style="font-size:20px;margin:0 0 12px">Member access requested</h1>
          <p style="margin:0 0 16px">A new member requested access.</p>
          <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:640px">
            ${htmlRows}
          </table>
          <p style="margin:18px 0 0"><a href="${escapeHtml(event.reviewLink ?? "")}" style="display:inline-block;border-radius:6px;background:#00ffb8;color:#01161c;font-weight:700;padding:10px 14px;text-decoration:none">Review signup</a></p>
        </div>
      `,
    } satisfies BuiltCorrespondenceEmail;
  }

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
  options: SendCorrespondenceOptions = {},
): Promise<SendCorrespondenceResult> {
  const email = buildCorrespondenceEmail(event);

  return sendViaResend(email, options);
}
