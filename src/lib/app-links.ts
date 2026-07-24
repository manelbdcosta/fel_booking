const defaultAppUrl = "https://fiteast-scheduling.intentionalsets.com";

export function absoluteAppLink(path = "/") {
  const appUrl = (process.env.APP_URL ?? defaultAppUrl).replace(/\/+$/g, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${appUrl}${normalizedPath}`;
}
