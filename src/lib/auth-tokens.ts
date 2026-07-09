import { cleanText, createId, normalizeEmail } from "@/lib/database";

export const sessionCookieName = "fel_session";

export type AuthTokenPurpose = "sign-in";

export function cleanSignupPayload(value: unknown) {
  const record =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    firstName: cleanText(record.firstName, 80),
    lastName: cleanText(record.lastName, 80),
    email: normalizeEmail(record.email),
    phone: cleanText(record.phone, 80),
  };
}

export async function hashToken(token: string) {
  const pepper = process.env.AUTH_TOKEN_PEPPER ?? "";
  const encoded = new TextEncoder().encode(`${pepper}:${token}`);
  const digest = await crypto.subtle.digest("SHA-256", encoded);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function createRawToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function createTokenId() {
  return createId("auth-token");
}

export function createSessionId() {
  return createId("session");
}

export function isoInMinutes(minutes: number) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

export function isoInDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60_000).toISOString();
}
