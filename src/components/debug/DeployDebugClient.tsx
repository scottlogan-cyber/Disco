"use client";

import { useEffect, useState } from "react";

const INGEST =
  "http://127.0.0.1:7362/ingest/e957df7c-3666-4037-aca6-74dde6bf796c";
const SESSION = "d3ea27";

type BuildInfo = {
  vercelGitCommitSha: string | null;
  vercelGitCommitRef: string | null;
  vercelEnv: string | null;
  nodeEnv: string | undefined;
};

function send(payload: Record<string, unknown>) {
  fetch(INGEST, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": SESSION,
    },
    body: JSON.stringify({
      sessionId: SESSION,
      timestamp: Date.now(),
      ...payload,
    }),
  }).catch(() => {});
}

/**
 * One-shot client log: build metadata + current URL (debug session d3ea27).
 * Append ?debugDeploy=1 to see deployed commit/ref on-screen (no localhost ingest).
 */
export function DeployDebugClient() {
  const [debugBanner, setDebugBanner] = useState<BuildInfo | null>(null);

  useEffect(() => {
    const href =
      typeof window !== "undefined" ? window.location.href : "";
    const host =
      typeof window !== "undefined" ? window.location.host : "";
    const showBanner =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("debugDeploy") === "1";

    // #region agent log
    send({
      location: "DeployDebugClient.tsx:mount",
      message: "page_load",
      hypothesisId: "H2_H3",
      data: { href, host, showBanner },
    });
    // #endregion

    fetch("/api/debug/build-info")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((info: BuildInfo) => {
        // #region agent log
        send({
          location: "DeployDebugClient.tsx:build-info-ok",
          message: "vercel_build_metadata",
          hypothesisId: "H1_H4",
          data: {
            ...info,
            href,
            buildInfoFetch: "ok",
          },
        });
        // #endregion
        if (showBanner) setDebugBanner(info);
      })
      .catch((e: Error) => {
        // #region agent log
        send({
          location: "DeployDebugClient.tsx:build-info-err",
          message: "build_info_fetch_failed",
          hypothesisId: "H4",
          data: { error: e.message, href },
        });
        // #endregion
      });
  }, []);

  if (!debugBanner) return null;

  const short =
    debugBanner.vercelGitCommitSha?.slice(0, 7) ?? "(no sha — not a Vercel build?)";

  return (
    <div
      role="status"
      className="fixed bottom-2 left-2 z-[9999] max-w-[min(100vw-1rem,24rem)] rounded border border-amber-500/80 bg-amber-950/95 px-2 py-1.5 font-mono text-[10px] leading-snug text-amber-100 shadow-lg"
    >
      <div className="font-semibold text-amber-50">debugDeploy</div>
      <div>sha {short}</div>
      <div>ref {debugBanner.vercelGitCommitRef ?? "—"}</div>
      <div>env {debugBanner.vercelEnv ?? "—"}</div>
    </div>
  );
}
