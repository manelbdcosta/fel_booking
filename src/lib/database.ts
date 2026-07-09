import { getCloudflareBindings, type D1DatabaseBinding } from "@/lib/cloudflare-env";

export type { D1DatabaseBinding } from "@/lib/cloudflare-env";

export async function getDatabase() {
  const bindings = await getCloudflareBindings();

  return bindings.DB ?? null;
}

export async function requireDatabase() {
  const db = await getDatabase();

  if (!db) {
    throw new Error("Cloudflare D1 binding DB is not configured.");
  }

  return db;
}

export async function allRows<T>(
  db: D1DatabaseBinding,
  query: string,
  ...values: unknown[]
) {
  const statement = db.prepare(query).bind(...values);
  const result = await statement.all<T>();

  return result.results;
}

export function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function cleanText(value: unknown, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
