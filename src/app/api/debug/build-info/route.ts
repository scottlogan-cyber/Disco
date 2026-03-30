import { NextResponse } from "next/server";

/**
 * Debug-only: exposes Vercel build metadata (no secrets). Remove after deploy issues are resolved.
 */
export async function GET() {
  const body = {
    vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    vercelGitCommitRef: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    nodeEnv: process.env.NODE_ENV,
  };
  const res = NextResponse.json(body);
  res.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, max-age=0",
  );
  return res;
}
