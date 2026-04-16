import { Line, OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Path,
  Shape,
  Vector2,
} from "three";
import { colorForValue } from "../lib/colors";
import type { FaultPatchesData, SnapshotFieldMeta, StationSummary } from "../lib/types";

const STATION_COLORS: Record<string, string> = {
  accepted: "#2563eb",
  modified: "#d97706",
  acc_test: "#be123c",
};

export type ViewPreset = "top" | "oblique";

interface FaultSceneProps {
  fault: FaultPatchesData;
  faultTrace: GeoJSON.FeatureCollection | null;
  stations: StationSummary[];
  fieldMeta: SnapshotFieldMeta;
  fieldValues: number[];
  viewPreset: ViewPreset;
  hoveredPatchId: number | null;
  selectedPatchId: number | null;
  onHoverPatch: (patchId: number | null) => void;
  onSelectPatch: (patchId: number | null) => void;
}

interface LocalMapTransform {
  project: (longitude: number, latitude: number) => [number, number];
}

interface ProjectedSurfaceReference {
  outlines: [number, number, number][][];
  fills: Shape[];
}

function solveLinear3x3(matrix: number[][], rhs: number[]) {
  const augmented = matrix.map((row, rowIndex) => [...row, rhs[rowIndex]]);

  for (let pivotIndex = 0; pivotIndex < 3; pivotIndex += 1) {
    let maxRow = pivotIndex;
    let maxValue = Math.abs(augmented[pivotIndex][pivotIndex]);
    for (let candidate = pivotIndex + 1; candidate < 3; candidate += 1) {
      const value = Math.abs(augmented[candidate][pivotIndex]);
      if (value > maxValue) {
        maxValue = value;
        maxRow = candidate;
      }
    }
    if (maxValue < 1e-12) {
      return null;
    }
    if (maxRow != pivotIndex) {
      [augmented[pivotIndex], augmented[maxRow]] = [augmented[maxRow], augmented[pivotIndex]];
    }

    const pivot = augmented[pivotIndex][pivotIndex];
    for (let column = pivotIndex; column < 4; column += 1) {
      augmented[pivotIndex][column] /= pivot;
    }

    for (let row = 0; row < 3; row += 1) {
      if (row === pivotIndex) {
        continue;
      }
      const factor = augmented[row][pivotIndex];
      for (let column = pivotIndex; column < 4; column += 1) {
        augmented[row][column] -= factor * augmented[pivotIndex][column];
      }
    }
  }

  return [augmented[0][3], augmented[1][3], augmented[2][3]] as [number, number, number];
}

function fitLocalMapTransform(fault: FaultPatchesData): LocalMapTransform | null {
  if (fault.patches.length < 3) {
    return null;
  }

  const normalMatrix = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const rhsX = [0, 0, 0];
  const rhsZ = [0, 0, 0];

  fault.patches.forEach((patch) => {
    const [longitude, latitude] = patch.center_lon_lat;
    const x = patch.center_local_xyz_m[0];
    const z = patch.center_local_xyz_m[2];
    const basis = [longitude, latitude, 1];

    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        normalMatrix[row][column] += basis[row] * basis[column];
      }
      rhsX[row] += basis[row] * x;
      rhsZ[row] += basis[row] * z;
    }
  });

  const coeffX = solveLinear3x3(
    normalMatrix.map((row) => [...row]),
    rhsX,
  );
  const coeffZ = solveLinear3x3(
    normalMatrix.map((row) => [...row]),
    rhsZ,
  );
  if (!coeffX || !coeffZ) {
    return null;
  }

  return {
    project: (longitude: number, latitude: number) => [
      coeffX[0] * longitude + coeffX[1] * latitude + coeffX[2],
      coeffZ[0] * longitude + coeffZ[1] * latitude + coeffZ[2],
    ],
  };
}

function projectSurfaceReference(
  faultGeoJSON: GeoJSON.FeatureCollection | null,
  fault: FaultPatchesData,
): ProjectedSurfaceReference | null {
  if (!faultGeoJSON) {
    return null;
  }

  const transform = fitLocalMapTransform(fault);
  if (!transform) {
    return null;
  }

  const outlines: [number, number, number][][] = [];
  const fills: Shape[] = [];

  const pushPolygon = (rings: number[][][]) => {
    const [outerRing, ...holeRings] = rings;
    if (!outerRing || outerRing.length < 3) {
      return;
    }

    const outerPoints = outerRing.map(([longitude, latitude]) => {
      const [x, z] = transform.project(longitude, latitude);
      return new Vector2(x, z);
    });
    const shape = new Shape(outerPoints);

    holeRings.forEach((holeRing) => {
      if (holeRing.length < 3) {
        return;
      }
      const holePoints = holeRing.map(([longitude, latitude]) => {
        const [x, z] = transform.project(longitude, latitude);
        return new Vector2(x, z);
      });
      shape.holes.push(new Path(holePoints));
    });

    outlines.push(outerPoints.map((point) => [point.x, 34, point.y]));
    fills.push(shape);
  };

  faultGeoJSON.features.forEach((feature) => {
    if (!feature.geometry) {
      return;
    }
    if (feature.geometry.type === "Polygon") {
      pushPolygon(feature.geometry.coordinates as number[][][]);
    }
    if (feature.geometry.type === "MultiPolygon") {
      feature.geometry.coordinates.forEach((polygon) => {
        pushPolygon(polygon as number[][][]);
      });
    }
  });

  return fills.length > 0 || outlines.length > 0 ? { outlines, fills } : null;
}

function sceneHorizontalExtent(fault: FaultPatchesData, stations: StationSummary[]) {
  const values: number[] = [];
  stations.forEach((station) => {
    if (station.local_xyz_m) {
      values.push(Math.abs(station.local_xyz_m[0]), Math.abs(station.local_xyz_m[2]));
    }
  });
  fault.patches.forEach((patch) => {
    values.push(Math.abs(patch.center_local_xyz_m[0]), Math.abs(patch.center_local_xyz_m[2]));
  });
  return Math.max(...values, 45000) * 2.3;
}

function CameraPresetController({
  preset,
  controlsRef,
  sceneExtent,
}: {
  preset: ViewPreset;
  controlsRef: { current: { target: { set: (...args: number[]) => void }; [key: string]: unknown } | null };
  sceneExtent: number;
}) {
  const { camera } = useThree();

  useLayoutEffect(() => {
    if (preset === "top") {
      camera.up.set(0, 0, 1);
      camera.position.set(0, sceneExtent * 1.08, 0.01);
    } else {
      camera.up.set(0, 1, 0);
      camera.position.set(-sceneExtent * 0.34, Math.max(sceneExtent * 0.52, 18000), sceneExtent * 0.44);
    }
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();

    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.enableRotate = preset !== "top";
      controlsRef.current.enablePan = true;
      controlsRef.current.enableZoom = true;
      controlsRef.current.minDistance = Math.max(sceneExtent * 0.12, 5000);
      controlsRef.current.maxDistance = sceneExtent * 3.5;
      controlsRef.current.minPolarAngle = preset === "top" ? 0.0001 : 0.18;
      controlsRef.current.maxPolarAngle = preset === "top" ? 0.0001 : Math.PI * 0.65;
      if (typeof controlsRef.current.update === "function") {
        controlsRef.current.update();
      }
    }
  }, [camera, controlsRef, preset, sceneExtent]);

  return null;
}

function FaultMesh({
  fault,
  fieldMeta,
  fieldValues,
  hoveredPatchId,
  selectedPatchId,
  onHoverPatch,
  onSelectPatch,
}: {
  fault: FaultPatchesData;
  fieldMeta: SnapshotFieldMeta;
  fieldValues: number[];
  hoveredPatchId: number | null;
  selectedPatchId: number | null;
  onHoverPatch: (patchId: number | null) => void;
  onSelectPatch: (patchId: number | null) => void;
}) {
  const positions = useMemo(() => {
    const values = fault.patches.flatMap((patch) =>
      patch.triangles_local_xyz_m.flatMap((triangle) => triangle.flatMap(([x, y, z]) => [x, y, z])),
    );
    return new Float32Array(values);
  }, [fault.patches]);

  const colors = useMemo(() => {
    const packed: number[] = [];
    fault.patches.forEach((patch) => {
      const color = colorForValue(fieldValues[patch.id] ?? 0, fieldMeta);
      const channels = color
        .replace("#", "")
        .match(/.{2}/g)!
        .map((component) => Number.parseInt(component, 16) / 255);

      const activePatch = patch.id === selectedPatchId || patch.id === hoveredPatchId;
      const tint = activePatch ? 0.18 : 0;
      const [r, g, b] = channels.map((channel) => Math.min(channel + tint, 1));
      for (let index = 0; index < 6; index += 1) {
        packed.push(r, g, b);
      }
    });
    return new Float32Array(packed);
  }, [fault.patches, fieldMeta, fieldValues, hoveredPatchId, selectedPatchId]);

  const highlightedPatch = hoveredPatchId ?? selectedPatchId;
  const overlayPositions = useMemo(() => {
    if (highlightedPatch == null) {
      return null;
    }
    const patch = fault.patches[highlightedPatch];
    const values = patch.triangles_local_xyz_m.flatMap((triangle) => triangle.flatMap(([x, y, z]) => [x, y, z]));
    return new Float32Array(values);
  }, [fault.patches, highlightedPatch]);

  return (
    <group>
      <mesh
        onPointerMove={(event) => {
          event.stopPropagation();
          onHoverPatch(Math.floor((event.faceIndex ?? 0) / 2));
        }}
        onPointerOut={() => onHoverPatch(null)}
        onClick={(event) => {
          event.stopPropagation();
          onSelectPatch(Math.floor((event.faceIndex ?? 0) / 2));
        }}
      >
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <meshStandardMaterial
          vertexColors
          side={DoubleSide}
          roughness={0.38}
          metalness={0.06}
          transparent
          opacity={0.9}
        />
      </mesh>

      {overlayPositions ? (
        <mesh>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[overlayPositions, 3]} />
          </bufferGeometry>
          <meshBasicMaterial color="#f8fafc" wireframe transparent opacity={1} side={DoubleSide} />
        </mesh>
      ) : null}
    </group>
  );
}

function SpatialContext({ stations }: { stations: StationSummary[] }) {
  const stationPoints = stations.filter((station) => station.local_xyz_m != null);

  return (
    <group>
      {stationPoints.map((station) => (
        <mesh
          key={station.station_id}
          position={[station.local_xyz_m![0], 180, station.local_xyz_m![2]]}
        >
          <sphereGeometry args={[190, 10, 10]} />
          <meshStandardMaterial color={STATION_COLORS[station.category] ?? "#475569"} transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function SurfaceReference({
  fault,
  faultTrace,
}: {
  fault: FaultPatchesData;
  faultTrace: GeoJSON.FeatureCollection | null;
}) {
  const projected = useMemo(() => projectSurfaceReference(faultTrace, fault), [fault, faultTrace]);

  if (!projected) {
    return null;
  }

  return (
    <group>
      {projected.fills.map((shape, index) => (
        <mesh key={`surface-fill-${index}`} rotation={[Math.PI / 2, 0, 0]} position={[0, 18, 0]} renderOrder={2}>
          <shapeGeometry args={[shape]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.16} depthWrite={false} side={DoubleSide} />
        </mesh>
      ))}
      {projected.outlines.map((points, index) => (
        <Line key={`surface-outline-${index}`} points={points} color="#d97706" lineWidth={2.4} />
      ))}
    </group>
  );
}

function SceneContents(props: FaultSceneProps) {
  const controlsRef = useRef<{
    target: { set: (...args: number[]) => void };
    enableRotate?: boolean;
    enablePan?: boolean;
    enableZoom?: boolean;
    minDistance?: number;
    maxDistance?: number;
    minPolarAngle?: number;
    maxPolarAngle?: number;
    update?: () => void;
  } | null>(null);
  const sceneExtent = useMemo(() => sceneHorizontalExtent(props.fault, props.stations), [props.fault, props.stations]);

  return (
    <>
      <color attach="background" args={["#f4f2eb"]} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[9000, 18000, 9000]} intensity={1.1} />
      <directionalLight position={[-9000, 8000, -3000]} intensity={0.35} />

      <CameraPresetController preset={props.viewPreset} controlsRef={controlsRef} sceneExtent={sceneExtent} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -10, 0]}>
        <planeGeometry args={[sceneExtent, sceneExtent]} />
        <meshStandardMaterial color="#8ba7b6" transparent opacity={0.12} side={DoubleSide} />
      </mesh>

      <SurfaceReference fault={props.fault} faultTrace={props.faultTrace} />
      <FaultMesh
        fault={props.fault}
        fieldMeta={props.fieldMeta}
        fieldValues={props.fieldValues}
        hoveredPatchId={props.hoveredPatchId}
        selectedPatchId={props.selectedPatchId}
        onHoverPatch={props.onHoverPatch}
        onSelectPatch={props.onSelectPatch}
      />
      <SpatialContext stations={props.stations} />

      <OrbitControls ref={controlsRef} makeDefault />
    </>
  );
}

export function FaultScene(props: FaultSceneProps) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ fov: 36, near: 10, far: 400000 }}
      gl={{ antialias: true }}
    >
      <SceneContents {...props} />
    </Canvas>
  );
}
