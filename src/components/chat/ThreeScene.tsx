"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Edges } from "@react-three/drei";
import * as THREE from "three";

type LabelSpec = { vertex: string; position: [number, number, number] };

type ShapeSpec =
  | { type: "cube"; params: { side: number }; vertexNames?: string[]; labels?: LabelSpec[] }
  | { type: "sphere"; params: { radius: number }; vertexNames?: string[]; labels?: LabelSpec[] }
  | { type: "cylinder"; params: { radius: number; height: number }; vertexNames?: string[]; labels?: LabelSpec[] }
  | { type: "cone"; params: { radius: number; height: number }; vertexNames?: string[]; labels?: LabelSpec[] }
  | { type: "prism"; params: { base: number; height: number; depth: number }; vertexNames?: string[]; labels?: LabelSpec[] }
  | { type: "pyramid"; params: { base: number; height: number }; vertexNames?: string[]; labels?: LabelSpec[] };

function getCanonicalVertices(spec: ShapeSpec): [number, number, number][] {
  switch (spec.type) {
    case "cube": {
      const L = spec.params.side, h = L / 2;
      return [[-h,0,-h],[h,0,-h],[h,0,h],[-h,0,h],[-h,L,-h],[h,L,-h],[h,L,h],[-h,L,h]];
    }
    case "pyramid": {
      const b = spec.params.base / 2, ht = spec.params.height;
      return [[-b,0,-b],[b,0,-b],[b,0,b],[-b,0,b],[0,ht,0]];
    }
    case "cone": {
      const { radius: r, height: ht } = spec.params;
      return [[0,ht,0],[0,0,0],[r,0,0],[-r,0,0],[0,0,r],[0,0,-r]];
    }
    case "cylinder": {
      const { radius: r, height: ht } = spec.params;
      return [[0,ht,0],[0,0,0],[r,ht,0],[r,0,0],[-r,ht,0],[-r,0,0],[0,ht,r],[0,0,r]];
    }
    case "prism": {
      const { base: bx, height: ht, depth: bz } = spec.params;
      const hx = bx / 2, hz = bz / 2;
      return [[-hx,0,-hz],[hx,0,-hz],[hx,0,hz],[-hx,0,hz],[-hx,ht,-hz],[hx,ht,-hz],[hx,ht,hz],[-hx,ht,hz]];
    }
    case "sphere": return [];
  }
}

function resolveLabels(spec: ShapeSpec): LabelSpec[] {
  if (spec.vertexNames && spec.vertexNames.length > 0) {
    const positions = getCanonicalVertices(spec);
    return spec.vertexNames.map((vertex, i) => ({
      vertex,
      position: (positions[i] ?? [0, 0, 0]) as [number, number, number],
    }));
  }
  if (spec.labels && spec.labels.length > 0) return spec.labels;
  return [];
}

interface Props {
  spec: ShapeSpec;
}

const FILL_COLOR = "#6366f1";
const EDGE_COLOR = "#1e1b4b";

function RotatingGroup({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.3;
  });
  return <group ref={ref}>{children}</group>;
}

function PyramidMesh({ base, height }: { base: number; height: number }) {
  const geometry = useMemo(() => {
    const b = base / 2;
    const h = height;
    const geo = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      // base (two triangles)
      -b, 0, -b,  b, 0, -b,  b, 0, b,
      -b, 0, -b,  b, 0, b,  -b, 0, b,
      // front
      -b, 0, b,  b, 0, b,  0, h, 0,
      // right
      b, 0, b,  b, 0, -b,  0, h, 0,
      // back
      b, 0, -b,  -b, 0, -b,  0, h, 0,
      // left
      -b, 0, -b,  -b, 0, b,  0, h, 0,
    ]);
    geo.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    geo.computeVertexNormals();
    return geo;
  }, [base, height]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={FILL_COLOR} transparent opacity={0.82} side={THREE.DoubleSide} />
    </mesh>
  );
}

function ShapeMesh({ spec }: Props) {
  switch (spec.type) {
    case "cube": {
      const s = spec.params.side;
      return (
        <mesh position={[0, s / 2, 0]}>
          <boxGeometry args={[s, s, s]} />
          <meshStandardMaterial color={FILL_COLOR} transparent opacity={0.82} />
          <Edges color={EDGE_COLOR} />
        </mesh>
      );
    }
    case "sphere": {
      const r = spec.params.radius;
      return (
        <mesh position={[0, r, 0]}>
          <sphereGeometry args={[r, 32, 32]} />
          <meshStandardMaterial color={FILL_COLOR} transparent opacity={0.75} />
        </mesh>
      );
    }
    case "cylinder": {
      const { radius, height } = spec.params;
      return (
        <mesh position={[0, height / 2, 0]}>
          <cylinderGeometry args={[radius, radius, height, 32]} />
          <meshStandardMaterial color={FILL_COLOR} transparent opacity={0.82} />
          <Edges color={EDGE_COLOR} />
        </mesh>
      );
    }
    case "cone": {
      const { radius, height } = spec.params;
      return (
        <mesh position={[0, height / 2, 0]}>
          <coneGeometry args={[radius, height, 32]} />
          <meshStandardMaterial color={FILL_COLOR} transparent opacity={0.82} />
          <Edges color={EDGE_COLOR} />
        </mesh>
      );
    }
    case "prism": {
      const { base, height, depth } = spec.params;
      return (
        <mesh position={[0, height / 2, 0]}>
          <boxGeometry args={[base, height, depth]} />
          <meshStandardMaterial color={FILL_COLOR} transparent opacity={0.82} />
          <Edges color={EDGE_COLOR} />
        </mesh>
      );
    }
    case "pyramid": {
      return <PyramidMesh base={spec.params.base} height={spec.params.height} />;
    }
  }
}

function Labels({ labels }: { labels: LabelSpec[] }) {
  return (
    <>
      {labels.map((l) => (
        <Text
          key={l.vertex}
          position={l.position}
          fontSize={0.35}
          color="#1e1b4b"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.04}
          outlineColor="#ffffff"
        >
          {l.vertex}
        </Text>
      ))}
    </>
  );
}

export function ThreeScene({ spec }: Props) {
  const resolvedLabels = useMemo(() => resolveLabels(spec), [spec]);
  const maxParam = useMemo(() => {
    switch (spec.type) {
      case "cube":        return spec.params.side;
      case "sphere":      return spec.params.radius * 2;
      case "cylinder":
      case "cone":        return Math.max(spec.params.radius * 2, spec.params.height);
      case "prism":       return Math.max(spec.params.base, spec.params.height, spec.params.depth);
      case "pyramid":     return Math.max(spec.params.base, spec.params.height);
    }
  }, [spec]);

  const camDist = maxParam * 2.5;

  return (
    <div style={{ height: 400, width: "100%", borderRadius: 8, overflow: "hidden", background: "#f8f8fc" }}>
      <Canvas camera={{ position: [camDist, camDist * 0.8, camDist], fov: 45 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} />
        <directionalLight position={[-5, 5, -5]} intensity={0.5} />
        <RotatingGroup>
          <ShapeMesh spec={spec} />
          {resolvedLabels.length > 0 && <Labels labels={resolvedLabels} />}
        </RotatingGroup>
        <OrbitControls enablePan={false} />
        <gridHelper args={[maxParam * 3, 10, "#cccccc", "#eeeeee"]} />
      </Canvas>
    </div>
  );
}
