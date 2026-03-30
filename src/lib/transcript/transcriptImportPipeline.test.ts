import { describe, expect, it } from "vitest";
import { discoverySchema } from "@/lib/schema/discovery";

/** Minimal object that matches what the API returns after validation — used to guard the schema. */
const apiStylePayload = {
  meta: {
    title: "Acme integration",
    clientOrg: "Acme",
    date: "",
    stakeholders: "",
    painAndOutcome: "Keep work visible in both tools.",
    facilitatorNotes: "",
  },
  systems: [
    {
      name: "Wrike",
      role: "hub" as const,
      owner: "",
      deployment: "saas" as const,
      adminAccess: "unknown" as const,
    },
  ],
  wrike: {
    spacesFolders: "",
    itemTypes: "",
    customFields: "",
    permissions: "",
  },
  pattern: {
    tool: "unknown" as const,
    existingRefs: "",
  },
  flows: [
    {
      fromSystem: "Wrike",
      toSystem: "Jira",
      objects: "Tasks",
      trigger: "event" as const,
      triggerDetail: "",
      direction: "one_way" as const,
      frequency: "",
      volumeEstimate: "",
    },
  ],
  dataRules: {
    identity: "",
    deduping: "",
    deletes: "",
    confidential: "",
  },
  operations: {
    monitoring: "",
    supportOwner: "",
    rollback: "",
    goLive: "",
  },
  openQuestions: "",
};

describe("transcript import pipeline", () => {
  it("accepts a typical API-style payload with discoverySchema", () => {
    const r = discoverySchema.safeParse(apiStylePayload);
    expect(r.success).toBe(true);
  });
});
