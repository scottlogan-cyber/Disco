import { z } from "zod";

export const systemRoleSchema = z.enum([
  "hub",
  "source",
  "destination",
  "bidirectional",
]);

export const deploymentSchema = z.enum(["saas", "onprem", "unknown"]);

export const triggerTypeSchema = z.enum([
  "event",
  "schedule",
  "manual",
  "other",
]);

export const flowDirectionSchema = z.enum(["one_way", "bidirectional"]);

export const patternToolSchema = z.enum([
  "workato",
  "unito",
  "both",
  "unknown",
]);

export const systemEntrySchema = z.object({
  name: z.string().min(1, "System name is required"),
  role: systemRoleSchema,
  owner: z.string().optional(),
  deployment: deploymentSchema,
  adminAccess: z.enum(["yes", "no", "unknown"]).optional(),
});

export const flowEntrySchema = z.object({
  fromSystem: z.string().min(1, "Source system is required"),
  toSystem: z.string().min(1, "Target system is required"),
  objects: z
    .string()
    .min(1, "Say in plain language what should stay in sync between the tools"),
  trigger: triggerTypeSchema,
  triggerDetail: z.string().optional(),
  direction: flowDirectionSchema,
  frequency: z.string().optional(),
  volumeEstimate: z.string().optional(),
});

export const discoverySchema = z.object({
  meta: z.object({
    title: z.string().min(1, "Give this discovery a short title"),
    clientOrg: z.string().min(1, "Client or organization name"),
    date: z.string().optional(),
    stakeholders: z.string().optional(),
    painAndOutcome: z
      .string()
      .min(1, "Describe the pain and the outcome you want"),
    facilitatorNotes: z.string().optional(),
  }),
  systems: z
    .array(systemEntrySchema)
    .min(1, "Add at least one system or tool"),
  wrike: z.object({
    spacesFolders: z.string().optional(),
    itemTypes: z.string().optional(),
    customFields: z.string().optional(),
    permissions: z.string().optional(),
  }),
  pattern: z.object({
    tool: patternToolSchema,
    existingRefs: z.string().optional(),
  }),
  flows: z.array(flowEntrySchema).min(1, "Add at least one integration flow"),
  dataRules: z.object({
    identity: z.string().optional(),
    deduping: z.string().optional(),
    deletes: z.string().optional(),
    confidential: z.string().optional(),
  }),
  operations: z.object({
    monitoring: z.string().optional(),
    supportOwner: z.string().optional(),
    rollback: z.string().optional(),
    goLive: z.string().optional(),
  }),
  openQuestions: z.string().optional(),
});

export type DiscoveryPayload = z.infer<typeof discoverySchema>;

export const defaultDiscoveryPayload: DiscoveryPayload = {
  meta: {
    title: "",
    clientOrg: "",
    date: "",
    stakeholders: "",
    painAndOutcome: "",
    facilitatorNotes: "",
  },
  systems: [
    {
      name: "Wrike",
      role: "hub",
      owner: "",
      deployment: "saas",
      adminAccess: "unknown",
    },
  ],
  wrike: {
    spacesFolders: "",
    itemTypes: "",
    customFields: "",
    permissions: "",
  },
  pattern: {
    tool: "unknown",
    existingRefs: "",
  },
  flows: [
    {
      fromSystem: "Wrike",
      toSystem: "",
      objects: "",
      trigger: "event",
      triggerDetail: "",
      direction: "one_way",
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

/** Field paths per wizard step (0-based). Empty = no required gate for that step. Three pages total. */
export const DISCOVERY_STEP_FIELDS: string[][] = [
  ["meta.title", "meta.clientOrg", "meta.painAndOutcome", "systems"],
  ["pattern.tool", "flows"],
  [],
];

export const DISCOVERY_STEP_TITLES = [
  "You, your tools, and Wrike",
  "Patterns and connections",
  "Data, launch, and follow-ups",
];
