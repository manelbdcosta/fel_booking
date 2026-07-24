import { absoluteAppLink } from "@/lib/app-links";
import {
  parseCorrespondenceEvent,
  sendCorrespondenceEmail,
} from "@/lib/outbound-email";

type PasswordSetMember = {
  email: string;
  first_name: string;
  last_name: string;
};

export async function sendPasswordSetConfirmationEmail(
  member: PasswordSetMember,
) {
  const event = parseCorrespondenceEvent({
    kind: "password-set-confirmed",
    loginLink: absoluteAppLink("/"),
    memberName: `${member.first_name} ${member.last_name}`,
  });
  const notification = event
    ? await sendCorrespondenceEmail(event, { to: [member.email] })
    : ({ ok: false, status: 400, error: "Invalid correspondence event." } as const);

  if (!notification.ok) {
    console.error("Password set confirmation email failed", {
      email: member.email,
      error: notification.error,
      status: notification.status,
    });
  }

  return notification;
}
