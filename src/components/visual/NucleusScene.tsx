"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import type { IntegrationGraph } from "@/lib/graph/buildGraphFromDiscovery";
import { graphHasRenderableContent } from "@/lib/graph/buildGraphFromDiscovery";
import type { DiscoveryPayload } from "@/lib/schema/discovery";

function layoutPositions(
  graph: IntegrationGraph
): Map<string, THREE.Vector3> {
  const map = new Map<string, THREE.Vector3>();
  map.set("center", new THREE.Vector3(0, 0, 0));
  const systems = graph.nodes.filter((n) => n.kind === "system");
  const n = systems.length;
  const r = n <= 1 ? 4.2 : Math.min(5.8, 3.4 + n * 0.45);
  systems.forEach((node, i) => {
    const t = (i / Math.max(n, 1)) * Math.PI * 2;
    map.set(
      node.id,
      new THREE.Vector3(Math.cos(t) * r, 0, Math.sin(t) * r)
    );
  });
  return map;
}

function FloatingGroup({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.y = Math.sin(t * 0.22) * 0.04;
  });
  return <group ref={ref}>{children}</group>;
}

function truncateLabel(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function SphereNode({
  position,
  label,
  radius,
  color,
  emissive,
}: {
  position: THREE.Vector3;
  label: string;
  radius: number;
  color: string;
  emissive: string;
}) {
  const short = truncateLabel(label, 22);
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[radius, 40, 40]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={0.35}
          roughness={0.45}
          metalness={0.05}
        />
      </mesh>
      <Html
        position={[0, radius + 0.55, 0]}
        center
        distanceFactor={8}
        zIndexRange={[100, 0]}
        occlude={false}
        style={{ pointerEvents: "none" }}
        className="select-none"
      >
        <span
          title={label}
          className="inline-block max-w-[140px] rounded-full border border-border bg-card/98 px-2.5 py-1 text-center text-[11px] font-medium leading-tight text-foreground shadow-md"
        >
          {short}
        </span>
      </Html>
    </group>
  );
}

/** Lines only — copy lives in the legend below to avoid overlap and occlusion. */
function EdgeArc({ from, to }: { from: THREE.Vector3; to: THREE.Vector3 }) {
  const points = useMemo(() => {
    const mid = from.clone().add(to).multiplyScalar(0.5);
    mid.y += 1.15;
    const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
    return curve.getPoints(40);
  }, [from, to]);

  return (
    <Line
      points={points}
      color="#c49a6c"
      lineWidth={2}
      transparent
      opacity={0.9}
    />
  );
}

function SceneContent({
  graph,
  reducedMotion,
}: {
  graph: IntegrationGraph;
  reducedMotion: boolean;
}) {
  const positions = useMemo(() => layoutPositions(graph), [graph]);

  const inner = (
    <>
      <ambientLight intensity={0.88} color="#fff5eb" />
      <directionalLight
        position={[6, 12, 8]}
        intensity={1.05}
        color="#fff0e0"
      />
      <pointLight position={[-5, 2, 5]} intensity={0.45} color="#ffd4c4" />
      <SphereNode
        position={positions.get("center")!}
        label={graph.nodes.find((n) => n.id === "center")?.label ?? ""}
        radius={0.55}
        color="#f4d4c8"
        emissive="#e07a5f"
      />
      {graph.nodes
        .filter((n) => n.kind === "system")
        .map((n) => (
          <SphereNode
            key={n.id}
            position={positions.get(n.id)!}
            label={n.label}
            radius={0.4}
            color="#fff7f0"
            emissive="#c9a87c"
          />
        ))}
      {graph.edges.map((e) => {
        const a = positions.get(e.fromId);
        const b = positions.get(e.toId);
        if (!a || !b) return null;
        return <EdgeArc key={e.id} from={a} to={b} />;
      })}
      <OrbitControls
        enableZoom
        enablePan={false}
        minPolarAngle={Math.PI / 3.4}
        maxPolarAngle={Math.PI / 2.1}
        autoRotate={false}
        enableDamping
        dampingFactor={0.05}
        minDistance={8}
        maxDistance={22}
      />
    </>
  );

  if (reducedMotion) {
    return <group>{inner}</group>;
  }
  return <FloatingGroup>{inner}</FloatingGroup>;
}

function FlowLegend({
  flows,
}: {
  flows: DiscoveryPayload["flows"];
}) {
  if (!flows.length) return null;
  return (
    <div className="border-t border-border bg-card/60 px-3 py-3">
      <p className="mb-2 text-xs font-semibold text-foreground">
        What this map is showing
      </p>
      <ul className="space-y-2 text-xs leading-snug text-muted">
        {flows.map((f, i) => {
          const from = f.fromSystem.trim();
          const to = f.toSystem.trim();
          const what = f.objects.trim() || "—";
          const when =
            f.trigger === "other" && f.triggerDetail?.trim()
              ? f.triggerDetail.trim()
              : f.trigger === "event"
                ? "when something changes"
                : f.trigger === "schedule"
                  ? "on a schedule"
                  : f.trigger === "manual"
                    ? "when someone runs it"
                    : f.trigger;
          return (
            <li key={i} className="rounded-lg bg-background/80 px-2 py-2">
              <span className="font-medium text-foreground">
                {from} → {to}
              </span>
              <span className="text-muted"> — {what}. </span>
              <span className="text-muted">Runs {when}.</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function NucleusScene({
  graph,
  flows,
  reducedMotion = false,
}: {
  graph: IntegrationGraph;
  flows?: DiscoveryPayload["flows"];
  reducedMotion?: boolean;
}) {
  const ready = graphHasRenderableContent(graph);

  return (
    <div className="relative flex h-full min-h-[280px] w-full flex-col overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-[#fff8f2] to-[#fff0e6]">
      {!ready ? (
        <div className="flex min-h-[280px] flex-1 items-center justify-center px-6 text-center">
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            Add systems and at least one flow to see your integration nucleus.
            Use the same names here as you used for your tools so the picture
            lines up.
          </p>
        </div>
      ) : (
        <>
          <div className="min-h-[240px] flex-1 sm:min-h-[320px]">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-sm text-muted">
                  Loading scene…
                </div>
              }
            >
              <Canvas
                camera={{ position: [0, 2.4, 13], fov: 40 }}
                dpr={[1, 1.5]}
                gl={{ antialias: true, alpha: true, depth: true }}
                className="h-full w-full"
              >
                <SceneContent graph={graph} reducedMotion={reducedMotion} />
              </Canvas>
            </Suspense>
          </div>
          {flows && flows.length > 0 ? <FlowLegend flows={flows} /> : null}
        </>
      )}
    </div>
  );
}
