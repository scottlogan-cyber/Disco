import type { DiscoveryPayload } from "@/lib/schema/discovery";

export const MAX_VISIBLE_SYSTEMS = 8;

export type GraphNode = {
  id: string;
  label: string;
  kind: "center" | "system";
};

export type GraphEdge = {
  id: string;
  fromId: string;
  toId: string;
  label: string;
};

export type IntegrationGraph = {
  centerLabel: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  overflowSystemCount: number;
};

function slugId(label: string, index: number): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base ? `sys-${base}` : `sys-${index}`;
}

function mergeEdgeLabels(existing: string, next: string): string {
  if (!existing) return next;
  if (existing.includes(next)) return existing;
  return `${existing}; ${next}`;
}

/**
 * Builds a nucleus-oriented graph: center = integration title,
 * satellites = unique systems (capped). Edges follow declared flows.
 */
export function buildGraphFromDiscovery(
  data: DiscoveryPayload
): IntegrationGraph {
  const centerLabel =
    data.meta.title.trim() ||
    `${data.meta.clientOrg.trim() || "Integration"} hub`;

  const systemNames = new Set<string>();
  data.systems.forEach((s) => {
    if (s.name.trim()) systemNames.add(s.name.trim());
  });
  data.flows.forEach((f) => {
    if (f.fromSystem.trim()) systemNames.add(f.fromSystem.trim());
    if (f.toSystem.trim()) systemNames.add(f.toSystem.trim());
  });

  const sorted = [...systemNames].sort((a, b) => a.localeCompare(b));
  const overflow = Math.max(0, sorted.length - MAX_VISIBLE_SYSTEMS);
  const visible = sorted.slice(0, MAX_VISIBLE_SYSTEMS);

  const idByLabel = new Map<string, string>();
  visible.forEach((label, i) => {
    idByLabel.set(label, slugId(label, i));
  });

  const nodes: GraphNode[] = [
    { id: "center", label: centerLabel, kind: "center" },
    ...visible.map((label) => ({
      id: idByLabel.get(label)!,
      label,
      kind: "system" as const,
    })),
  ];

  const edgeMap = new Map<string, GraphEdge>();

  data.flows.forEach((flow, idx) => {
    const from = flow.fromSystem.trim();
    const to = flow.toSystem.trim();
    if (!from || !to) return;

    const fromId = idByLabel.get(from);
    const toId = idByLabel.get(to);
    if (!fromId || !toId) return;

    const parts = [
      flow.objects.trim(),
      flow.trigger !== "other" ? flow.trigger : flow.triggerDetail,
      flow.frequency?.trim(),
    ].filter(Boolean);

    const label = parts.join(" · ") || "flow";

    const key = `${fromId}->${toId}`;
    const existing = edgeMap.get(key);
    if (existing) {
      edgeMap.set(key, {
        ...existing,
        label: mergeEdgeLabels(existing.label, label),
      });
    } else {
      edgeMap.set(key, {
        id: `edge-${idx}-${key}`,
        fromId,
        toId,
        label,
      });
    }
  });

  return {
    centerLabel,
    nodes,
    edges: [...edgeMap.values()],
    overflowSystemCount: overflow,
  };
}

export function graphHasRenderableContent(graph: IntegrationGraph): boolean {
  return graph.nodes.length > 1 && graph.edges.length > 0;
}
