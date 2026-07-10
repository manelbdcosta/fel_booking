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
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
      screen.getByText(
        "Cancelled Mon 6 Jul at 06:30. Credit issued. Pick a new slot now or decide later.",
      ),
    ).toBeTruthy();
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
        .getByRole("button", { name: /Maddie Cannon/ })
        .className.includes("border-[var(--mint)]"),
    ).toBe(false);
    expect(screen.getByText("Studio calendar")).toBeTruthy();
    expect(screen.queryByText(/Coach managed for Maddie Cannon/)).toBeNull();
    expect(screen.getByText("Coaches: Ben, Manu, Ennor, Mel")).toBeTruthy();
    expect(screen.getByText("3 total")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Invite person" }));
    expect(screen.getByRole("heading", { name: "Invite person" })).toBeTruthy();
    expect(screen.getByText("Role")).toBeTruthy();
    expect(screen.getByText("Slot availability")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Invite Monday 06:30 1/4 assigned" }),
    ).toBeTruthy();
    expect(screen.getByRole("option", { name: "Set later" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Coach" }));
    expect(screen.queryByText("Slot availability")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Close invite" }));
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

    await user.click(screen.getByRole("button", { name: /Emma Richierich/ }));
    expect(screen.getByText("Coach schedule")).toBeTruthy();
    expect(screen.getByText("Today's sessions")).toBeTruthy();
    expect(screen.getByText(/Managing Emma Richierich/)).toBeTruthy();
    expect(screen.getByText(/Coach managed for Emma Richierich/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Maddie Cannon/ }));
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
  });
});
