import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const isGitHubPages = process.env.GITHUB_PAGES === "true";
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "fel_booking";
const gitHubPagesBasePath = `/${repositoryName}`;
const configuredBasePath = normalizeBasePath(process.env.NEXT_PUBLIC_APP_BASE_PATH);

function normalizeBasePath(value: string | undefined) {
  if (!value) {
    return "";
  }

  const trimmed = value.trim().replace(/^\/+|\/+$/g, "");

  return trimmed ? `/${trimmed}` : "";
}

if (!isGitHubPages) {
  initOpenNextCloudflareForDev();
}

const nextConfig: NextConfig = {
  ...(configuredBasePath ? { basePath: configuredBasePath } : {}),
  ...(isGitHubPages
    ? {
        assetPrefix: `${gitHubPagesBasePath}/`,
        basePath: gitHubPagesBasePath,
        images: {
          unoptimized: true,
        },
        output: "export" as const,
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
