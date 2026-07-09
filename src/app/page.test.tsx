import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import Home from "@/app/page";

afterEach(() => {
  cleanup();
});

function renderHome() {
  return userEvent.setup({ delay: null });
}

describe("demo account entry", () => {
  it("supports magic-link sign-in copy and member access requests", async () => {
    const user = renderHome();
    render(<Home />);

    await user.type(screen.getByLabelText("Email"), "coach@example.com");
    await user.click(screen.getByRole("button", { name: "Send magic link" }));

    expect(
      screen.getByText("Magic link queued to manu@intentionalsets.com."),
    ).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Request access" }));
    await user.type(screen.getByLabelText("First name"), "New");
    await user.type(screen.getByLabelText("Last name"), "Member");
    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Phone"), "07123 456789");
    await user.click(screen.getByRole("button", { name: "Submit request" }));

    expect(screen.getByText("Waiting for approval")).toBeTruthy();
    expect(
      screen.getByText("Approval correspondence is routed to manu@intentionalsets.com."),
    ).toBeTruthy();
  });
});

describe("demo member journey", () => {
  it("lets a member request regular-slot changes, book, cancel, and waitlist", async () => {
    const user = renderHome();
    render(<Home />);

    await user.click(screen.getByRole("button", { name: /Demo member/ }));

    expect(screen.getByText("Member schedule")).toBeTruthy();
    expect(screen.getByText("Coach approval required")).toBeTruthy();
    expect(screen.queryByText("Maya, Tom, Liv, Noah")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Request change" }));
    await user.selectOptions(screen.getByLabelText("Day"), "Friday");
    await user.selectOptions(screen.getByLabelText("Time"), "08:30");
    await user.selectOptions(screen.getByLabelText("Effective week"), "2026-07-27");
    await user.type(screen.getByLabelText("Note"), "Shift pattern changed.");
    await user.click(screen.getByRole("button", { name: "Submit request" }));

    expect(
      screen.getByText("Regular slot change request sent to the coaches."),
    ).toBeTruthy();
    expect(screen.getByText(/Friday 08:30 from Mon 27 Jul/)).toBeTruthy();

    await user.click(
      screen.getAllByRole("button", { name: /07:30.*Open/ })[0],
    );
    await user.click(screen.getByRole("button", { name: "Book spot" }));

    expect(
      screen.getByText("Makeup booked for Amira Khan on Mon 13 Jul at 07:30."),
    ).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /06:30.*Your booking/ }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
      screen.getByText(
        "Cancelled Mon 13 Jul at 06:30. Credit issued. Pick a new slot now or decide later.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Book a session")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Close booking" }));

    await user.click(screen.getByRole("button", { name: /07:00.*Waitlist.*Full/ }));
    await user.click(screen.getByRole("button", { name: "Join waitlist" }));

    expect(
      screen.getByText("Joined waitlist for Amira Khan on Mon 13 Jul at 07:00."),
    ).toBeTruthy();
    const waitlistSection = screen.getByRole("heading", { name: "Waitlist" })
      .parentElement?.parentElement;
    expect(waitlistSection).toBeTruthy();
    expect(within(waitlistSection as HTMLElement).getByText("Mon 13 Jul")).toBeTruthy();
  });
});

describe("demo coach journey", () => {
  it("lets a coach manage regular slots and override a full booking", async () => {
    const user = renderHome();
    render(<Home />);

    await user.click(screen.getByRole("button", { name: /Demo coach/ }));

    expect(screen.getByText("Coach schedule")).toBeTruthy();
    expect(screen.getByText("Coach managed for Amira Khan")).toBeTruthy();
    expect(screen.getByText("10 total")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Ben Taylor/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Jonah Bell/ })).toBeTruthy();
    expect(screen.getByText("Maya, Tom, Liv, Noah")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Ben Taylor/ }));
    expect(screen.getByText(/Managing Ben Taylor/)).toBeTruthy();
    expect(screen.getByText("Coach managed for Ben Taylor")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Amira Khan/ }));
    await user.click(screen.getByRole("button", { name: "Assign regular slot" }));
    await user.selectOptions(screen.getByLabelText("Day"), "Friday");
    await user.selectOptions(screen.getByLabelText("Time"), "08:30");
    await user.click(screen.getByRole("button", { name: "Assign slot" }));

    expect(
      screen.getByText(/Coach assigned Amira Khan to Friday 08:30 from Mon 20 Jul/),
    ).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Approve" }));

    expect(
      screen.getByText(/Approved Amira Khan's regular slot request for Tuesday 07:30/),
    ).toBeTruthy();
    expect(screen.getByText("approved")).toBeTruthy();

    await user.click(
      screen.getByRole("button", { name: /07:00.*Maya, Tom, Liv, Noah/ }),
    );
    await user.click(screen.getByRole("button", { name: "Override add" }));

    expect(
      screen.getByText(/Coach override booked Amira Khan for Mon 13 Jul at 07:00/),
    ).toBeTruthy();
  });
});
