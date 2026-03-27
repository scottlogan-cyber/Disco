import { describe, expect, it } from "vitest";
import {
  buildGraphFromDiscovery,
  graphHasRenderableContent,
  MAX_VISIBLE_SYSTEMS,
} from "./buildGraphFromDiscovery";
import type { DiscoveryPayload } from "@/lib/schema/discovery";

const basePayload = (): DiscoveryPayload => ({
  meta: {
    title: "Acme sync",
    clientOrg: "Acme",
    painAndOutcome: "Keep tasks aligned",
  },
  systems: [
    { name: "Wrike", role: "hub", deployment: "saas" },
    { name: "Salesforce", role: "destination", deployment: "saas" },
  ],
  wrike: {},
  pattern: { tool: "workato" },
  flows: [
    {
      fromSystem: "Wrike",
      toSystem: "Salesforce",
      objects: "Tasks",
      trigger: "event",
      direction: "one_way",
    },
  ],
  dataRules: {},
  operations: {},
});

describe("buildGraphFromDiscovery", () => {
  it("places center and systems and one edge", () => {
    const g = buildGraphFromDiscovery(basePayload());
    expect(g.centerLabel).toBe("Acme sync");
    expect(g.nodes.find((n) => n.kind === "center")).toBeDefined();
    expect(g.nodes.filter((n) => n.kind === "system").map((n) => n.label)).toEqual(
      ["Salesforce", "Wrike"]
    );
    expect(g.edges).toHaveLength(1);
    expect(g.edges[0].label).toContain("Tasks");
  });

  it("merges duplicate from→to edges", () => {
    const p = basePayload();
    p.flows.push({
      fromSystem: "Wrike",
      toSystem: "Salesforce",
      objects: "Comments",
      trigger: "schedule",
      direction: "one_way",
      frequency: "hourly",
    });
    const g = buildGraphFromDiscovery(p);
    expect(g.edges).toHaveLength(1);
    expect(g.edges[0].label).toContain("Tasks");
    expect(g.edges[0].label).toContain("Comments");
  });

  it("caps overflow systems", () => {
    const p = basePayload();
    const many = Array.from({ length: MAX_VISIBLE_SYSTEMS + 3 }, (_, i) => ({
      name: `Sys${i}`,
      role: "source" as const,
      deployment: "saas" as const,
    }));
    p.systems = many;
    p.flows = [
      {
        fromSystem: "Sys0",
        toSystem: "Sys1",
        objects: "A",
        trigger: "manual",
        direction: "one_way",
      },
    ];
    const g = buildGraphFromDiscovery(p);
    expect(g.overflowSystemCount).toBe(3);
    expect(g.nodes.filter((n) => n.kind === "system")).toHaveLength(
      MAX_VISIBLE_SYSTEMS
    );
  });
});

describe("graphHasRenderableContent", () => {
  it("is false when only center", () => {
    const p = basePayload();
    p.flows = [];
    const g = buildGraphFromDiscovery({ ...p, flows: [] });
    expect(graphHasRenderableContent(g)).toBe(false);
  });

  it("is true with center, systems, and edges", () => {
    expect(graphHasRenderableContent(buildGraphFromDiscovery(basePayload()))).toBe(
      true
    );
  });
});
