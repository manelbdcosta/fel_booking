import { describe, expect, it } from "vitest";

import { cutoffInstantForSession, isBeforeMemberCutoff } from "@/lib/timezone";

describe("Europe/London booking cutoff", () => {
  it("uses 20:00 local time the day before a winter session", () => {
    expect(cutoffInstantForSession("2026-01-12").toISOString()).toBe(
      "2026-01-11T20:00:00.000Z",
    );
  });

  it("keeps the cutoff at 20:00 local time after the spring DST shift", () => {
    expect(cutoffInstantForSession("2026-03-30").toISOString()).toBe(
      "2026-03-29T19:00:00.000Z",
    );
  });

  it("keeps the cutoff at 20:00 local time after the autumn DST shift", () => {
    expect(cutoffInstantForSession("2026-10-26").toISOString()).toBe(
      "2026-10-25T20:00:00.000Z",
    );
  });

  it("allows member self-service at the cutoff instant", () => {
    expect(
      isBeforeMemberCutoff(
        "2026-03-30",
        new Date("2026-03-29T19:00:00.000Z"),
      ),
    ).toBe(true);
  });
});
