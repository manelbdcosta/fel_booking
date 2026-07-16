import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Home from "@/app/page";

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-07-09T08:00:00+01:00"));
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }),
      ),
    ),
  );
});

function renderHome() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime, delay: null });
}

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
      status,
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("demo account entry", () => {
  it("supports password reset copy and member access requests", async () => {
    const user = renderHome();
    render(<Home />);

    await user.click(screen.getByRole("button", { name: "Forgot password?" }));
    await user.type(screen.getByLabelText("Email"), "coach@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(
      screen.getByText("Password reset email sent to coach@example.com."),
    ).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Back to log in" }));
    await user.click(screen.getByRole("button", { name: "Create account" }));
    await user.type(screen.getByLabelText("First name"), "New");
    await user.type(screen.getByLabelText("Last name"), "Member");
    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Phone"), "07123 456789");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm password"), "password123");
    await user.click(screen.getByRole("button", { name: "Submit request" }));

    expect(screen.getByText("Waiting for approval")).toBeTruthy();
    expect(
      screen.getByText(
        "Your request was saved. Coach notification email is still being configured.",
      ),
    ).toBeTruthy();
  });
});

describe("demo member journey", () => {
  it("lets a member request regular-slot changes, book, cancel, and waitlist", async () => {
    const user = renderHome();
    render(<Home />);

    await user.click(screen.getByRole("button", { name: /Preview member/ }));

    expect(screen.getByText("Member schedule")).toBeTruthy();
    expect(screen.getByText("Coach approval required")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Notifications" })).toBeNull();
    expect(screen.queryByText("Emma, Gemma, Reserved, Drop-in")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Request change" }));
    await user.selectOptions(screen.getByLabelText("Current regular slot"), "Monday|06:30");
    await user.selectOptions(screen.getByLabelText("New day"), "Friday");
    await user.selectOptions(screen.getByLabelText("New time"), "08:30");
    await user.selectOptions(screen.getByLabelText("Effective week"), "2026-07-27");
    await user.type(screen.getByLabelText("Note"), "Shift pattern changed.");
    await user.click(screen.getByRole("button", { name: "Submit request" }));

    expect(
      screen.getByText("Regular slot change request sent to the coaches."),
    ).toBeTruthy();
    expect(screen.getByText(/From Monday 06:30 to Friday 08:30/)).toBeTruthy();
    expect(screen.getByText(/Effective Mon 27 Jul/)).toBeTruthy();

    await user.click(
      screen.getAllByRole("button", { name: /07:30.*Open/ })[0],
    );
    await user.click(screen.getByRole("button", { name: "Book spot" }));

    expect(
      screen.getByText("Makeup booked for Maddie Cannon on Mon 6 Jul at 07:30."),
    ).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /06:30.*Your booking/ }));
    await user.click(screen.getByRole("button", { name: "Cancel booking" }));

    expect(
      screen.getByText(
        "Cancelled Mon 6 Jul at 06:30. Credit issued. It expires 3 Aug.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Book a new session now?")).toBeTruthy();
    expect(screen.getByText("Your credit expires 3 Aug.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Book now" }));
    expect(screen.getByText("Book a session")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Close booking" }));

    await user.click(screen.getByRole("button", { name: /07:00.*Waitlist.*Full/ }));
    await user.click(screen.getByRole("button", { name: "Join waitlist" }));

    expect(
      screen.getByText("Joined waitlist for Maddie Cannon on Mon 6 Jul at 07:00."),
    ).toBeTruthy();
    const waitlistSection = screen.getByRole("heading", { name: "Waitlist" })
      .parentElement?.parentElement;
    expect(waitlistSection).toBeTruthy();
    expect(within(waitlistSection as HTMLElement).getByText("Mon 6 Jul")).toBeTruthy();
  });
});

describe("demo coach journey", () => {
  it("lets Manu remove coach accounts", async () => {
    const user = renderHome();
    const fetchMock = vi.fn((input: Parameters<typeof fetch>[0]) => {
      const url = String(input);

      if (url.includes("/api/auth/me")) {
        return jsonResponse({ user: null }, 401);
      }

      if (url.includes("/api/auth/login")) {
        return jsonResponse({
          user: {
            email: "manu@intentionalsets.com",
            firstName: "Manu",
            id: "coach-manu",
            lastName: "",
            role: "coach",
          },
        });
      }

      if (url.includes("/api/bootstrap")) {
        return jsonResponse({
          coachAccounts: [
            {
              email: "ben@example.com",
              firstName: "Ben",
              id: "coach-ben",
              lastName: "",
              status: "active",
            },
            {
              email: "manu@intentionalsets.com",
              firstName: "Manu",
              id: "coach-manu",
              lastName: "",
              status: "active",
            },
          ],
          coaches: ["Ben", "Manu"],
          members: [],
          pendingInvites: [],
          regularSlotRequests: [],
          regularSlotsByMember: {},
          weeklyQuotasByMember: {},
        });
      }

      if (url.includes("/api/members/coach-ben")) {
        return jsonResponse({ ok: true });
      }

      return jsonResponse({ ok: true });
    });

    vi.stubGlobal("fetch", fetchMock);
    render(<Home />);

    await user.type(screen.getByLabelText("Email"), "manu@intentionalsets.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    const loginButtons = screen.getAllByRole("button", { name: "Log in" });
    await user.click(loginButtons[loginButtons.length - 1]);

    expect(await screen.findByText("Coach team")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove Ben" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remove Manu" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Remove Ben" }));

    expect(screen.getByText("Remove Ben?")).toBeTruthy();
    expect(
      screen.getByText("They will no longer be able to log in as a coach."),
    ).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Confirm removal" }));

    expect(await screen.findByText(/Removed Ben from coaches/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remove Ben" })).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/members/coach-ben"),
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("shows the coach team to non-super-admin coaches without removal controls", async () => {
    const user = renderHome();
    const fetchMock = vi.fn((input: Parameters<typeof fetch>[0]) => {
      const url = String(input);

      if (url.includes("/api/auth/me")) {
        return jsonResponse({ user: null }, 401);
      }

      if (url.includes("/api/auth/login")) {
        return jsonResponse({
          user: {
            email: "ben@example.com",
            firstName: "Ben",
            id: "coach-ben",
            lastName: "",
            role: "coach",
          },
        });
      }

      if (url.includes("/api/bootstrap")) {
        return jsonResponse({
          coachAccounts: [
            {
              email: "ben@example.com",
              firstName: "Ben",
              id: "coach-ben",
              lastName: "",
              status: "active",
            },
            {
              email: "manu@intentionalsets.com",
              firstName: "Manu",
              id: "coach-manu",
              lastName: "",
              status: "active",
            },
          ],
          coaches: ["Ben", "Manu"],
          members: [],
          pendingInvites: [],
          regularSlotRequests: [],
          regularSlotsByMember: {},
          weeklyQuotasByMember: {},
        });
      }

      return jsonResponse({ ok: true });
    });

    vi.stubGlobal("fetch", fetchMock);
    render(<Home />);

    await user.type(screen.getByLabelText("Email"), "ben@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    const loginButtons = screen.getAllByRole("button", { name: "Log in" });
    await user.click(loginButtons[loginButtons.length - 1]);

    const coachTeam = (await screen.findByText("Coach team")).closest("div")
      ?.parentElement;

    expect(coachTeam).toBeTruthy();
    expect(within(coachTeam as HTMLElement).getByText("Ben")).toBeTruthy();
    expect(within(coachTeam as HTMLElement).getByText("You")).toBeTruthy();
    expect(within(coachTeam as HTMLElement).getByText("Manu")).toBeTruthy();
    expect(within(coachTeam as HTMLElement).getByText("Super admin")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remove Ben" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove Manu" })).toBeNull();
  });

  it("lets a coach remove a selected member with confirmation", async () => {
    const user = renderHome();
    render(<Home />);

    await user.click(screen.getByRole("button", { name: /Preview coach/ }));
    await user.click(screen.getByRole("button", { name: /Emma Richierich/ }));
    await user.click(screen.getByRole("button", { name: "Remove member" }));

    expect(screen.getByText("Remove Emma Richierich?")).toBeTruthy();
    expect(
      screen.getByText(
        "Future bookings, waitlist entries, pending regular-slot requests, and regular slots will be removed.",
      ),
    ).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Keep member" }));
    expect(screen.getByRole("button", { name: /Emma Richierich/ })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Remove member" }));
    await user.click(screen.getByRole("button", { name: "Confirm removal" }));

    expect(screen.queryByRole("button", { name: /Emma Richierich/ })).toBeNull();
    expect(
      await screen.findByText(/Removed Emma Richierich from members/),
    ).toBeTruthy();
    expect(screen.getByText("Studio calendar")).toBeTruthy();
  });

  it("lets a coach remove a pending invited member", async () => {
    const user = renderHome();
    const fetchMock = vi.fn(
      (
        input: Parameters<typeof fetch>[0],
        init?: Parameters<typeof fetch>[1],
      ) => {
        const url = String(input);

        if (url.includes("/api/invitations") && init?.method === "POST") {
          return jsonResponse(
            {
              member: {
                email: "nia@example.com",
                firstName: "Nia",
                id: "invited-member",
                lastName: "Guest",
                status: "pending",
                weeklyQuota: 1,
              },
              notificationSent: true,
              pendingInvite: {
                createdAt: "2026-07-09T08:00:00Z",
                email: "nia@example.com",
                expiresAt: "2026-07-16T08:00:00Z",
                id: "invite-nia",
                memberId: "invited-member",
                name: "Nia Guest",
                role: "member",
              },
              regularSlots: [],
              role: "member",
            },
            201,
          );
        }

        if (url.includes("/api/members/invited-member")) {
          return jsonResponse({ ok: true });
        }

        return jsonResponse({ ok: true });
      },
    );

    vi.stubGlobal("fetch", fetchMock);
    render(<Home />);

    await user.click(screen.getByRole("button", { name: /Preview coach/ }));
    await user.click(screen.getByRole("button", { name: "Invite person" }));
    expect(screen.getByRole("button", { name: "Send invite" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Member" }));
    await user.type(screen.getByLabelText("Name"), "Nia Guest");
    await user.type(screen.getByLabelText("Email"), "nia@example.com");
    await user.click(screen.getByRole("button", { name: "Send invite" }));

    expect(await screen.findByText(/Invitation sent to nia@example.com/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Nia Guest/ }));
    await user.click(screen.getByRole("button", { name: "Remove member" }));

    expect(screen.getByText("This member has not joined yet.")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Confirm removal" }));

    expect(await screen.findByText(/Removed Nia Guest from members/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Nia Guest/ })).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/members/invited-member"),
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("lets a coach manage regular slots and override a full booking", async () => {
    const user = renderHome();
    render(<Home />);

    await user.click(screen.getByRole("button", { name: /Preview coach/ }));

    expect(screen.getByRole("heading", { name: "Studio" })).toBeTruthy();
    expect(screen.getAllByText("Mission control").length).toBeGreaterThan(0);
    const membersSection = screen
      .getByRole("heading", { name: "Members" })
      .closest("section");
    expect(membersSection).toBeTruthy();
    expect(
      within(membersSection as HTMLElement).queryByText("Mission control"),
    ).toBeNull();
    expect(
      screen
        .getByRole("button", { name: /Maddie Cannon.*2x.*Active/ })
        .className.includes("border-[var(--mint)]"),
    ).toBe(false);
    expect(screen.getByText("Studio calendar")).toBeTruthy();
    expect(screen.queryByText(/Coach managed for Maddie Cannon/)).toBeNull();
    expect(screen.getByText("Coaches: Ben, Manu, Ennor, Mel")).toBeTruthy();
    expect(screen.getByText("3 total")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Invite person" }));
    expect(screen.getByRole("heading", { name: "Invite person" })).toBeTruthy();
    expect(screen.getByText("Account type")).toBeTruthy();
    expect(screen.queryByText("Slot availability")).toBeNull();
    expect(screen.getByRole("button", { name: "Send invite" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Member" }));
    expect(screen.getByText("Slot availability")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Invite Monday 06:30 1/4 assigned" }),
    ).toBeTruthy();
    expect(screen.getByRole("option", { name: "Set later" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Coach" }));
    expect(screen.queryByText("Slot availability")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Close invite" }));
    expect(screen.getByText("Regular slot requests")).toBeTruthy();
    await user.click(
      screen.getByRole("button", {
        name: /Maddie Cannon.*Monday 06:30 to Tuesday 07:30/,
      }),
    );
    expect(screen.getByText("Requested slot")).toBeTruthy();
    expect(screen.getByText("0/4 already assigned")).toBeTruthy();
    expect(screen.getByText("0 left after approval")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Approve request" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Mission control/ }));
    expect(screen.getByRole("button", { name: /Emma Richierich/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Gemma Partridge/ })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /07:00.*Maddie.*Gemma/ }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: /07:00.*Emma.*Gemma.*Reserved.*Drop-in/,
      }),
    ).toBeTruthy();

    await user.click(
      screen.getByRole("button", {
        name: /07:00.*Emma.*Gemma.*Reserved.*Drop-in/,
      }),
    );
    await user.click(screen.getByRole("button", { name: "Close slot" }));
    expect(screen.getByText("This slot has bookings.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Keep open" }));

    await user.click(screen.getAllByRole("button", { name: /08:30.*Open/ })[0]);
    await user.click(screen.getByRole("button", { name: "Close slot" }));
    expect(screen.getByText(/Closed .* at 08:30/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Reopen slot" }));
    expect(screen.getByText(/Reopened .* at 08:30/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Emma Richierich/ }));
    expect(screen.getByText("Coach schedule")).toBeTruthy();
    expect(screen.getByText("Today's sessions")).toBeTruthy();
    expect(screen.getByText(/Managing Emma Richierich/)).toBeTruthy();
    expect(screen.getByText(/Coach managed for Emma Richierich/)).toBeTruthy();

    await user.click(
      screen.getByRole("button", { name: /Maddie Cannon.*2x.*Active/ }),
    );
    await user.click(screen.getByRole("button", { name: "Manage regular slots" }));
    expect(screen.getByText(/2\/2 assigned for Maddie Cannon/)).toBeTruthy();
    expect(screen.getByText("Slot availability")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Friday 08:00 1/4 assigned" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add session" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Sessions per week"), {
      target: { value: "1" },
    });
    expect(
      screen.getByText(
        /Remove regular slots before reducing Maddie Cannon below 2 sessions per week/,
      ),
    ).toBeTruthy();

    await user.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    expect(screen.getByText("Unsaved changes. Press Save changes to keep them.")).toBeTruthy();
    expect(screen.getByText(/1\/2 assigned for Maddie Cannon/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Sessions per week"), {
      target: { value: "1" },
    });
    expect(screen.getByText(/1\/1 assigned for Maddie Cannon/)).toBeTruthy();

    await user.selectOptions(screen.getByLabelText(/Thursday 07:00 time/), "08:00");

    fireEvent.change(screen.getByLabelText("Sessions per week"), {
      target: { value: "3" },
    });
    await user.selectOptions(screen.getByLabelText("New day"), "Friday");
    await user.selectOptions(screen.getByLabelText("New time"), "08:30");
    await user.click(screen.getByRole("button", { name: "Add session" }));
    await user.selectOptions(screen.getByLabelText("New day"), "Tuesday");
    await user.selectOptions(screen.getByLabelText("New time"), "07:30");
    await user.click(screen.getByRole("button", { name: "Add session" }));
    expect(screen.getByText(/3\/3 assigned for Maddie Cannon/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      screen.getByText(/Saved regular slot changes for Maddie Cannon/),
    ).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Approve" }));

    expect(
      screen.getByText(
        /Approved Maddie Cannon's regular slot change from Monday 06:30 to Tuesday 07:30/,
      ),
    ).toBeTruthy();
    expect(screen.getByText("approved")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Mon.*6 Jul/ }));
    expect(screen.getByText("Day sessions")).toBeTruthy();

    await user.click(
      screen.getByRole("button", {
        name: /07:00.*Emma.*Gemma.*Reserved.*Drop-in/,
      }),
    );
    await user.click(screen.getByRole("button", { name: "Override add" }));

    expect(
      screen.getByText(/Coach override booked Maddie Cannon for Mon 6 Jul at 07:00/),
    ).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Emma Richierich/ }));
    expect(screen.getByText(/Managing Emma Richierich/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Notifications" }));
    await user.click(
      screen.getByRole("button", {
        name: /Maddie Cannon booked Mon 6 Jul at 07:00/,
      }),
    );

    expect(
      screen.getByText(/Showing Maddie Cannon's Mon 6 Jul 07:00 booking change/),
    ).toBeTruthy();
    expect(screen.getByText("Mon 6 Jul at 07:00")).toBeTruthy();
  });
});
