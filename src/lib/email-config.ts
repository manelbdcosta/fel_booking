const fallbackCorrespondenceEmail = "manu@intentionalsets.com";

function splitEmails(value: string | undefined) {
  return (value ?? fallbackCorrespondenceEmail)
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

export const emailConfig = {
  correspondenceEmail:
    process.env.CORRESPONDENCE_EMAIL ?? fallbackCorrespondenceEmail,
  from:
    process.env.EMAIL_FROM ??
    `Fit East London <${fallbackCorrespondenceEmail}>`,
  replyTo:
    process.env.EMAIL_REPLY_TO ??
    process.env.CORRESPONDENCE_EMAIL ??
    fallbackCorrespondenceEmail,
  coachNotificationEmails: splitEmails(process.env.COACH_NOTIFICATION_EMAILS),
};
