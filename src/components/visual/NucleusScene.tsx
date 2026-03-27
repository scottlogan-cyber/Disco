"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Html,
  Line,
  OrbitControls,
} from "@react-three/drei";
import { Suspense, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { IntegrationGraph } from "@/lib/graph/buildGraphFromDiscovery";
import { graphHasRenderableContent } from "@/lib/graph/buildGraphFromDiscovery";
import type { DiscoveryPayload } from "@/lib/schema/discovery";

const SPHERE_SEG = 64;

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

function CenterOrb({
  position,
  label,
  radius,
}: {
  position: THREE.Vector3;
  label: string;
  radius: number;
}) {
  const short = truncateLabel(label, 22);
  const glowRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!glowRef.current?.material) return;
    const m = glowRef.current.material as THREE.MeshStandardMaterial;
    const w = 0.42 + Math.sin(state.clock.elapsedTime * 0.9) * 0.06;
    m.emissiveIntensity = w;
  });

  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[radius, SPHERE_SEG, SPHERE_SEG]} />
        <meshPhysicalMaterial
          color="#ffd4c4"
          emissive="#ff6b4a"
          emissiveIntensity={0.48}
          roughness={0.18}
          metalness={0.22}
          clearcoat={0.85}
          clearcoatRoughness={0.15}
          reflectivity={0.9}
          envMapIntensity={1.1}
        />
      </mesh>
      <mesh ref={glowRef} scale={1.42}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshStandardMaterial
          color="#ff8a65"
          emissive="#ff6b4a"
          emissiveIntensity={0.42}
          transparent
          opacity={0.22}
          depthWrite={false}
        />
      </mesh>
      <Html
        position={[0, radius + 0.62, 0]}
        center
        distanceFactor={8}
        zIndexRange={[100, 0]}
        occlude={false}
        style={{ pointerEvents: "none" }}
        className="select-none"
      >
        <span
          title={label}
          className="inline-block max-w-[150px] rounded-full border border-[#e8a090]/80 bg-white/95 px-3 py-1.5 text-center text-[11px] font-semibold leading-tight text-[#4a3428] shadow-[0_4px_20px_rgba(224,122,95,0.35)]"
        >
          {short}
        </span>
      </Html>
    </group>
  );
}

function SatelliteOrb({
  position,
  label,
  radius,
}: {
  position: THREE.Vector3;
  label: string;
  radius: number;
}) {
  const short = truncateLabel(label, 22);
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[radius, SPHERE_SEG, SPHERE_SEG]} />
        <meshPhysicalMaterial
          color="#fff5eb"
          emissive="#d4a574"
          emissiveIntensity={0.22}
          roughness={0.28}
          metalness={0.35}
          clearcoat={0.55}
          clearcoatRoughness={0.25}
          envMapIntensity={0.95}
        />
      </mesh>
      <Html
        position={[0, radius + 0.52, 0]}
        center
        distanceFactor={8}
        zIndexRange={[100, 0]}
        occlude={false}
        style={{ pointerEvents: "none" }}
        className="select-none"
      >
        <span
          title={label}
          className="inline-block max-w-[140px] rounded-full border border-[#e5d4c8] bg-white/95 px-2.5 py-1 text-center text-[11px] font-medium leading-tight text-[#4a3428] shadow-[0_3px_14px_rgba(180,140,100,0.25)]"
        >
          {short}
        </span>
      </Html>
    </group>
  );
}

function EdgeArc({ from, to }: { from: THREE.Vector3; to: THREE.Vector3 }) {
  const points = useMemo(() => {
    const mid = from.clone().add(to).multiplyScalar(0.5);
    mid.y += 1.2;
    const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
    return curve.getPoints(48);
  }, [from, to]);

  return (
    <Line
      points={points}
      color="#e09050"
      lineWidth={2.5}
      transparent
      opacity={0.95}
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
      <color attach="background" args={["#fff5ec"]} />
      <fog attach="fog" args={["#fff5ec", 12, 38]} />
      <hemisphereLight intensity={0.55} color="#fff8f0" groundColor="#ffd4c8" />
      <ambientLight intensity={0.35} color="#fff0e6" />
      <directionalLight
        position={[8, 14, 10]}
        intensity={1.35}
        color="#ffffff"
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <pointLight position={[-6, 4, 6]} intensity={0.85} color="#ffb090" distance={22} />
      <pointLight position={[4, -2, -4]} intensity={0.45} color="#a8c8ff" distance={16} />

      <Suspense fallback={null}>
        <Environment preset="sunset" environmentIntensity={0.65} />
      </Suspense>

      <CenterOrb
        position={positions.get("center")!}
        label={graph.nodes.find((n) => n.id === "center")?.label ?? ""}
        radius={0.56}
      />
      {graph.nodes
        .filter((n) => n.kind === "system")
        .map((n) => (
          <SatelliteOrb
            key={n.id}
            position={positions.get(n.id)!}
            label={n.label}
            radius={0.41}
          />
        ))}
      {graph.edges.map((e) => {
        const a = positions.get(e.fromId);
        const b = positions.get(e.toId);
        if (!a || !b) return null;
        return <EdgeArc key={e.id} from={a} to={b} />;
      })}

      <ContactShadows
        position={[0, -2.35, 0]}
        opacity={0.45}
        scale={16}
        blur={2.2}
        far={5}
        color="#8a6048"
      />

      <OrbitControls
        enableZoom
        enablePan={false}
        minPolarAngle={Math.PI / 3.4}
        maxPolarAngle={Math.PI / 2.05}
        autoRotate={false}
        enableDamping
        dampingFactor={0.055}
        minDistance={8}
        maxDistance={24}
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
    <div className="border-t border-[#edd9cc] bg-gradient-to-b from-white/90 to-[#fff8f2] px-3 py-3">
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
            <li
              key={i}
              className="rounded-lg border border-border/60 bg-white/80 px-2 py-2 shadow-sm"
            >
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

function useDevicePixelRatioRange(): [number, number] {
  return useState<[number, number]>(() => {
    if (typeof window === "undefined") return [1.5, 2.25];
    const r = window.devicePixelRatio || 1;
    return [1.25, Math.min(2.5, Math.max(1.5, r))];
  })[0];
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
  const dprRange = useDevicePixelRatioRange();

  return (
    <div className="relative flex h-full min-h-[280px] w-full flex-col overflow-hidden rounded-2xl border border-[#edd9cc] bg-gradient-to-br from-[#fffaf5] via-[#fff3e8] to-[#ffe8dc] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_8px_32px_rgba(200,120,80,0.12)]">
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
                shadows
                camera={{ position: [0, 2.5, 13.5], fov: 38 }}
                dpr={dprRange}
                gl={{
                  antialias: true,
                  alpha: false,
                  depth: true,
                  powerPreference: "high-performance",
                  stencil: false,
                }}
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
