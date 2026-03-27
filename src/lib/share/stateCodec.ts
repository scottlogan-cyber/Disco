import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import { discoverySchema, type DiscoveryPayload } from "@/lib/schema/discovery";

const HASH_PREFIX = "s=";

export type CodecResult =
  | { ok: true; data: DiscoveryPayload }
  | { ok: false; error: string };

export function encodeDiscoveryToHash(data: DiscoveryPayload): string {
  const parsed = discoverySchema.parse(data);
  const json = JSON.stringify(parsed);
  return HASH_PREFIX + compressToEncodedURIComponent(json);
}

export function decodeHashToDiscovery(hash: string): CodecResult {
  const raw = hash.trim();
  if (!raw.startsWith(HASH_PREFIX)) {
    return { ok: false, error: "Share link is missing state." };
  }
  const compressed = raw.slice(HASH_PREFIX.length);
  let json: string;
  try {
    json = decompressFromEncodedURIComponent(compressed) ?? "";
  } catch {
    return { ok: false, error: "Could not read compressed state." };
  }
  if (!json) {
    return { ok: false, error: "State was empty or corrupted." };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "State was not valid JSON." };
  }
  const result = discoverySchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, error: "State did not match the current form version." };
  }
  return { ok: true, data: result.data };
}

export function readHashFromWindow(): string {
  if (typeof window === "undefined") return "";
  return window.location.hash.replace(/^#/, "");
}
