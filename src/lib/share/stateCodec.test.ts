import { describe, expect, it } from "vitest";
import { defaultDiscoveryPayload } from "@/lib/schema/discovery";
import { decodeHashToDiscovery, encodeDiscoveryToHash } from "./stateCodec";

describe("stateCodec", () => {
  it("round-trips a valid payload", () => {
    const data = {
      ...defaultDiscoveryPayload,
      meta: {
        ...defaultDiscoveryPayload.meta,
        title: "Test",
        clientOrg: "Co",
        painAndOutcome: "Sync work",
      },
      flows: [
        {
          fromSystem: "Wrike",
          toSystem: "Jira",
          objects: "Tasks",
          trigger: "event" as const,
          direction: "one_way" as const,
        },
      ],
    };
    const hash = encodeDiscoveryToHash(data);
    const decoded = decodeHashToDiscovery(hash);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.data.meta.title).toBe("Test");
    }
  });

  it("rejects garbage", () => {
    const r = decodeHashToDiscovery("s=!!!");
    expect(r.ok).toBe(false);
  });
});
