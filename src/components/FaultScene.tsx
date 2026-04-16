import { useEffect, useMemo, useRef } from "react";
import { Canvas, ThreeEvent, useThree } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import { BufferAttribute, BufferGeometry, DoubleSide } from "three";
import { colorForValue } from "../lib/colors";
import type { FaultPatch, FaultPatchesData, SnapshotFieldMeta, StationSummary } from "../lib/types";

const STATION_COLORS: Record<string, string> = {
  accepted: "#2563eb",
  modified: "#d97706",
  acc_test: "#be123c",
};

export type ViewPreset = "top" | "oblique";

interface FaultSceneProps {
  fault: FaultPatchesData;
  stations: StationSummary[];
  fieldMeta: SnapshotFieldMeta;
  fieldValues: number[];
  viewPreset: ViewPreset;
  hoveredPatchId: number | null;
  selectedPatchId: number | null;
  onHoverPatch: (patchId: number | null) => void;
  onSelectPatch: (patchId: number | null) => void;
}

function sceneExtent(fault: FaultPatchesData, stations: StationSummary[]) {
  const values: number[] = [];
  fault.patches.forEach((patch) => {
    values.push(Math.abs(patch.center_local_xyz_m[0]), Math.abs(patch.center_local_xyz_m[2]));
  });
  stations.forEach((station) => {
    if (station.local_xyz_m) {
      values.push(Math.abs(station.local_xyz_m[0]), Math.abs(station.local_xyz_m[2]));
    }
  });
  return Math.max(...values, 45000) * 2.2;
}

function CameraPresetController({
  preset,
  controlsRef,
  extent,
}: {
  preset: ViewPreset;
  controlsRef: React.MutableRefObject<any>;
  extent: number;
}) {
  const { camera } = useThree();

  useEffect(() => {
    if (preset === "top") {
      camera.position.set(0, extent * 1.05, 0.01);
      camera.up.set(0, 0, 1);
    } else {
      camera.position.set(-extent * 0.34, extent * 0.52, extent * 0.44);
      camera.up.set(0, 1, 0);
    }

    camera.lookAt(0, -4000, 0);
    camera.updateProjectionMatrix();

    if (controlsRef.current) {
      controlsRef.current.target.set(0, -4000, 0);
      controlsRef.current.enableRotate = preset !== "top";
      controlsRef.current.minDistance = Math.max(extent * 0.1, 4000);
      controlsRef.current.maxDistance = extent * 3;
      controlsRef.current.update();
    }
  }, [camera, controlsRef, extent, preset]);

  return null;
}

function FaultMesh({
  fault,
  fieldMeta,
  fieldValues,
  onHoverPatch,
  onSelectPatch,
}: {
  fault: FaultPatchesData;
  fieldMeta: SnapshotFieldMeta;
  fieldValues: number[];
  onHoverPatch: (patchId: number | null) => void;
  onSelectPatch: (patchId: number | null) => void;
}) {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];

    fault.patches.forEach((patch, patchIndex) => {
      const value = fieldValues[patchIndex] ?? 0;
      const hex = colorForValue(value, fieldMeta).replace("#", "");
      const rgb = [
        Number.parseInt(hex.slice(0, 2), 16) / 255,
        Number.parseInt(hex.slice(2, 4), 16) / 255,
        Number.parseInt(hex.slice(4, 6), 16) / 255,
      ];

      patch.triangles_local_xyz_m.forEach((triangle) => {
        triangle.forEach(([x, y, z]) => {
          positions.push(x, y, z);
          colors.push(rgb[0], rgb[1], rgb[2]);
        });
      });
    });

    const nextGeometry = new BufferGeometry();
    nextGeometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    nextGeometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
    nextGeometry.computeVertexNormals();
    return nextGeometry;
  }, [fault, fieldMeta, fieldValues]);

  const resolvePatchId = (event: ThreeEvent<PointerEvent>) => {
    if (event.faceIndex == null) {
      return null;
    }
    return Math.floor(event.faceIndex / 2);
  };

  return (
    <mesh
      geometry={geometry}
      onPointerMove={(event) => {
        event.stopPropagation();
        onHoverPatch(resolvePatchId(event));
      }}
      onPointerLeave={() => onHoverPatch(null)}
      onClick={(event) => {
        event.stopPropagation();
        onSelectPatch(resolvePatchId(event));
      }}
    >
      <meshStandardMaterial vertexColors side={DoubleSide} metalness={0.1} roughness={0.78} />
    </mesh>
  );
}

function PatchOutline({ patch, color }: { patch: FaultPatch; color: string }) {
  const points = useMemo(() => {
    const corners = patch.corners_local_xyz_m.map(([x, y, z]) => [x, y + 60, z] as [number, number, number]);
    return [...corners, corners[0]];
  }, [patch]);

  return <Line points={points} color={color} lineWidth={2.2} />;
}

function StationCloud({ stations }: { stations: StationSummary[] }) {
  return (
    <group>
      {stations.map((station) => {
        if (!station.local_xyz_m) {
          return null;
        }
        const [x, y, z] = station.local_xyz_m;
        return (
          <mesh
            key={station.station_id}
            position={[x, Math.max(y, 0) + 180, z]}
            scale={520}
          >
            <sphereGeometry args={[1, 10, 10]} />
            <meshStandardMaterial color={STATION_COLORS[station.category] ?? "#475569"} />
          </mesh>
        );
      })}
    </group>
  );
}

function SurfaceTrace({ fault }: { fault: FaultPatchesData }) {
  if (!fault.surface_trace_local_xyz_m || fault.surface_trace_local_xyz_m.length < 2) {
    return null;
  }
  const points = fault.surface_trace_local_xyz_m.map(([x, y, z]) => [x, y + 120, z] as [number, number, number]);
  return <Line points={points} color="#f59e0b" lineWidth={2.4} />;
}

export function FaultScene({
  fault,
  stations,
  fieldMeta,
  fieldValues,
  viewPreset,
  hoveredPatchId,
  selectedPatchId,
  onHoverPatch,
  onSelectPatch,
}: FaultSceneProps) {
  const controlsRef = useRef<any>(null);
  const extent = useMemo(() => sceneExtent(fault, stations), [fault, stations]);
  const hoveredPatch = hoveredPatchId != null ? fault.patches[hoveredPatchId] : null;
  const selectedPatch = selectedPatchId != null ? fault.patches[selectedPatchId] : null;

  return (
    <Canvas
      camera={{ position: [0, extent * 1.05, 0.01], fov: 38, near: 10, far: extent * 10 }}
      className="fault-canvas"
      onPointerMissed={() => onSelectPatch(null)}
    >
      <color attach="background" args={["#f4f2eb"]} />
      <ambientLight intensity={1.2} />
      <directionalLight position={[0, extent, extent]} intensity={1.3} />
      <directionalLight position={[-extent, extent * 0.4, -extent * 0.2]} intensity={0.6} />
      <CameraPresetController preset={viewPreset} controlsRef={controlsRef} extent={extent} />
      <FaultMesh
        fault={fault}
        fieldMeta={fieldMeta}
        fieldValues={fieldValues}
        onHoverPatch={onHoverPatch}
        onSelectPatch={onSelectPatch}
      />
      <StationCloud stations={stations} />
      <SurfaceTrace fault={fault} />
      {hoveredPatch && (!selectedPatch || selectedPatch.id !== hoveredPatch.id) ? (
        <PatchOutline patch={hoveredPatch} color="#f97316" />
      ) : null}
      {selectedPatch ? <PatchOutline patch={selectedPatch} color="#111827" /> : null}
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableZoom={false}
        enablePan={false}
        rotateSpeed={0.7}
      />
    </Canvas>
  );
}
