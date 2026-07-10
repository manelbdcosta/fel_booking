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
      note: "<script>alert('x')</script>",
    });

    expect(event).toBeTruthy();

    const email = buildCorrespondenceEmail(event!);

    expect(email.subject).toBe(
      "[FEL Booking] Regular slot change requested",
    );
    expect(email.text).toContain("Member: Maddie Cannon");
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

  it("rejects unknown event kinds", () => {
    expect(parseCorrespondenceEvent({ kind: "send-anything" })).toBeNull();
  });
});
