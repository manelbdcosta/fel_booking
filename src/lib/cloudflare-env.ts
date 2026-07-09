type EmailAddress = {
  email: string;
  name?: string;
};

type EmailMessage = {
  to: string | EmailAddress | Array<string | EmailAddress>;
  from: string | EmailAddress;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string | EmailAddress;
};

type EmailSendResult = {
  messageId?: string;
};

export type CloudflareEmailBinding = {
  send(message: EmailMessage): Promise<EmailSendResult>;
};

export type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
};

export type D1DatabaseBinding = {
  prepare(query: string): D1PreparedStatement;
  batch?(statements: D1PreparedStatement[]): Promise<unknown[]>;
};

export type CloudflareBindings = {
  DB?: D1DatabaseBinding;
  EMAIL?: CloudflareEmailBinding;
};

export async function getCloudflareBindings() {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");

    return getCloudflareContext().env as CloudflareBindings;
  } catch {
    return {} satisfies CloudflareBindings;
  }
}
