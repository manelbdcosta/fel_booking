import { describe, expect, it } from "vitest";

import {
  buildCorrespondenceEmail,
  parseCorrespondenceEvent,
} from "@/lib/outbound-email";

describe("outbound email correspondence", () => {
  it("builds a safe regular slot request email", () => {
    const event = parseCorrespondenceEvent({
      kind: "regular-slot-change-requested",
      memberName: "Maddie Cannon",
      requestedDay: "Friday",
      requestedTime: "08:30",
      reviewLink: "https://fiteast-scheduling.intentionalsets.com/?reviewRequest=req-1&reviewMember=maddie",
      note: "<script>alert('x')</script>",
    });

    expect(event).toBeTruthy();

    const email = buildCorrespondenceEmail(event!);

    expect(email.subject).toBe(
      "[FEL Booking] Regular slot change requested",
    );
    expect(email.text).toContain("Member: Maddie Cannon");
    expect(email.text).toContain("Review this request in the coach dashboard");
    expect(email.html).toContain("Review request");
    expect(email.html).toContain("reviewRequest=req-1&amp;reviewMember=maddie");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).not.toContain("<script>");
  });

  it("builds an invite email with a setup link", () => {
    const event = parseCorrespondenceEvent({
      kind: "account-invited",
      inviteLink: "https://example.com/?inviteToken=abc&email=maddie@example.com",
      memberName: "Maddie Cannon",
      role: "member",
    });

    expect(event).toBeTruthy();

    const email = buildCorrespondenceEmail(event!);

    expect(email.subject).toBe("[FEL Booking] You're invited");
    expect(email.text).toContain("Role: member");
    expect(email.html).toContain("Create password");
    expect(email.html).toContain("inviteToken=abc&amp;email=maddie@example.com");
  });

  it("builds a password-set confirmation email with a login link", () => {
    const event = parseCorrespondenceEvent({
      kind: "password-set-confirmed",
      loginLink: "https://example.com/?next=/dashboard&email=maddie@example.com",
      memberName: "Maddie Cannon",
    });

    expect(event).toBeTruthy();

    const email = buildCorrespondenceEmail(event!);

    expect(email.subject).toBe("[FEL Booking] Your password is set");
    expect(email.text).toContain("Use this link to log in");
    expect(email.html).toContain("Log in");
    expect(email.html).toContain(
      "https://example.com/?next=/dashboard&amp;email=maddie@example.com",
    );
  });

  it("builds a member holiday email with dates and credit count", () => {
    const event = parseCorrespondenceEvent({
      cancelledCount: "3",
      creditCount: "3",
      holidayEnd: "2026-07-24 (24 Jul)",
      holidayStart: "2026-07-13 (13 Jul)",
      kind: "member-holiday-set",
      memberName: "Maddie Cannon",
    });

    expect(event).toBeTruthy();

    const email = buildCorrespondenceEmail(event!);

    expect(email.subject).toBe("[FEL Booking] Maddie Cannon holiday");
    expect(email.text).toContain("Away from: 2026-07-13 (13 Jul)");
    expect(email.text).toContain("Credits accrued: 3");
    expect(email.html).toContain("Holiday start");
    expect(email.html).toContain("Credits accrued");
  });

  it("rejects unknown event kinds", () => {
    expect(parseCorrespondenceEvent({ kind: "send-anything" })).toBeNull();
  });
});
