const rawBasePath = process.env.NEXT_PUBLIC_APP_BASE_PATH ?? "";

export function publicAppPath(path: string) {
  const basePath = rawBasePath.trim().replace(/^\/+|\/+$/g, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return basePath ? `/${basePath}${normalizedPath}` : normalizedPath;
}
