"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import type { IntegrationGraph } from "@/lib/graph/buildGraphFromDiscovery";
import { graphHasRenderableContent } from "@/lib/graph/buildGraphFromDiscovery";

function layoutPositions(
  graph: IntegrationGraph
): Map<string, THREE.Vector3> {
  const map = new Map<string, THREE.Vector3>();
  map.set("center", new THREE.Vector3(0, 0, 0));
  const systems = graph.nodes.filter((n) => n.kind === "system");
  const n = systems.length;
  const r = n <= 1 ? 2.8 : 3.6;
  systems.forEach((node, i) => {
    const t = (i / Math.max(n, 1)) * Math.PI * 2
    map.set(node.id, new THREE.Vector3(Math.cos(t) * r, 0, Math.sin(t) * r));
  });
  return map;
}

function FloatingGroup({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.y = Math.sin(t * 0.35) * 0.08;
  });
  return <group ref={ref}>{children}</group>;
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
        position={[0, radius + 0.42, 0]}
        center
        distanceFactor={10}
        className="pointer-events-none select-none"
      >
        <span className="max-w-[160px] rounded-full border border-border bg-card/95 px-3 py-1 text-center text-xs font-medium text-foreground shadow-sm">
          {label}
        </span>
      </Html>
    </group>
  );
}

function EdgeArc({
  from,
  to,
  label,
}: {
  from: THREE.Vector3;
  to: THREE.Vector3;
  label: string;
}) {
  const { points, midPoint } = useMemo(() => {
    const mid = from.clone().add(to).multiplyScalar(0.5);
    mid.y += 0.9;
    const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
    return {
      points: curve.getPoints(32),
      midPoint: curve.getPoint(0.5),
    };
  }, [from, to]);

  return (
    <group>
      <Line
        points={points}
        color="#d4a27f"
        lineWidth={2}
        dashed={false}
        transparent
        opacity={0.95}
      />
      <Html
        position={[midPoint.x, midPoint.y + 0.35, midPoint.z]}
        center
        distanceFactor={10}
        className="pointer-events-none select-none"
      >
        <span className="max-w-[200px] rounded-md bg-accent-soft/95 px-2 py-1 text-[10px] leading-snug text-foreground shadow-sm">
          {label}
        </span>
      </Html>
    </group>
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
      <ambientLight intensity={0.85} color="#fff5eb" />
      <directionalLight
        position={[6, 10, 6]}
        intensity={1.1}
        color="#fff0e0"
      />
      <pointLight position={[-4, 0, 4]} intensity={0.6} color="#ffd4c4" />
      <SphereNode
        position={positions.get("center")!}
        label={graph.nodes.find((n) => n.id === "center")?.label ?? ""}
        radius={0.62}
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
            radius={0.42}
            color="#fff7f0"
            emissive="#c9a87c"
          />
        ))}
      {graph.edges.map((e) => {
        const a = positions.get(e.fromId);
        const b = positions.get(e.toId);
        if (!a || !b) return null;
        return (
          <EdgeArc key={e.id} from={a} to={b} label={e.label} />
        );
      })}
      <OrbitControls
        enableZoom={true}
        enablePan={false}
        minPolarAngle={Math.PI / 3.2}
        maxPolarAngle={Math.PI / 2.05}
        autoRotate={!reducedMotion}
        autoRotateSpeed={0.35}
      />
    </>
  );

  if (reducedMotion) {
    return <group>{inner}</group>;
  }
  return <FloatingGroup>{inner}</FloatingGroup>;
}

export default function NucleusScene({
  graph,
  reducedMotion = false,
}: {
  graph: IntegrationGraph;
  reducedMotion?: boolean;
}) {
  const ready = graphHasRenderableContent(graph);

  return (
    <div className="relative h-full min-h-[280px] w-full overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-[#fff8f2] to-[#fff0e6]">
      {!ready ? (
        <div className="flex h-full min-h-[280px] w-full items-center justify-center px-6 text-center">
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            Add systems and at least one flow to see your integration nucleus.
            Names should match across systems and flows so the map can connect
            the dots.
          </p>
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-sm text-muted">
              Loading scene…
            </div>
          }
        >
          <Canvas
            camera={{ position: [0, 2.2, 11], fov: 42 }}
            dpr={[1, 1.75]}
            gl={{ antialias: true, alpha: true }}
            className="h-full w-full"
          >
            <SceneContent graph={graph} reducedMotion={reducedMotion} />
          </Canvas>
        </Suspense>
      )}
    </div>
  );
}
