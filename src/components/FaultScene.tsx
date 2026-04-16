import { useEffect, useMemo, useRef, useState } from "react";
import { colorForValue } from "../lib/colors";
import type { FaultPatch, FaultPatchesData, SnapshotFieldMeta, StationSummary } from "../lib/types";

const STATION_COLORS: Record<string, string> = {
  accepted: "#2563eb",
  modified: "#d97706",
  acc_test: "#be123c",
};

const VIEWPORT_WIDTH = 1000;
const VIEWPORT_HEIGHT = 700;
const PADDING = 60;

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

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function projectPoint([x, , z]: [number, number, number], viewPreset: ViewPreset): [number, number] {
  if (viewPreset === "top") {
    return [x, -z];
  }

  return [x, -z * 0.82];
}

function computeBounds(fault: FaultPatchesData, stations: StationSummary[], viewPreset: ViewPreset): Bounds {
  const xs: number[] = [];
  const ys: number[] = [];

  fault.patches.forEach((patch) => {
    patch.corners_local_xyz_m.forEach((corner) => {
      const [x, y] = projectPoint(corner, viewPreset);
      xs.push(x);
      ys.push(y);
    });
  });

  stations.forEach((station) => {
    if (!station.local_xyz_m) {
      return;
    }
    const [x, y] = projectPoint(station.local_xyz_m, viewPreset);
    xs.push(x);
    ys.push(y);
  });

  if (fault.surface_trace_local_xyz_m) {
    fault.surface_trace_local_xyz_m.forEach((point) => {
      const [x, y] = projectPoint(point, viewPreset);
      xs.push(x);
      ys.push(y);
    });
  }

  if (xs.length === 0 || ys.length === 0) {
    return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
  }

  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function fitScale(bounds: Bounds) {
  const width = Math.max(bounds.maxX - bounds.minX, 1);
  const height = Math.max(bounds.maxY - bounds.minY, 1);
  return Math.min((VIEWPORT_WIDTH - PADDING * 2) / width, (VIEWPORT_HEIGHT - PADDING * 2) / height);
}

function polygonPoints(patch: FaultPatch, viewPreset: ViewPreset) {
  return patch.corners_local_xyz_m.map((corner) => projectPoint(corner, viewPreset));
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
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const bounds = useMemo(() => computeBounds(fault, stations, viewPreset), [fault, stations, viewPreset]);
  const baseScale = useMemo(() => fitScale(bounds), [bounds]);
  const baseCenter = useMemo(
    () => ({
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
    }),
    [bounds],
  );

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [viewPreset, fault]);

  const scale = baseScale * zoom;

  const toScreen = (point: [number, number]) => ({
    x: (point[0] - baseCenter.x) * scale + VIEWPORT_WIDTH / 2 + pan.x,
    y: (point[1] - baseCenter.y) * scale + VIEWPORT_HEIGHT / 2 + pan.y,
  });

  const patchPolygons = useMemo(
    () =>
      fault.patches.map((patch, index) => {
        const points = polygonPoints(patch, viewPreset);
        const screenPoints = points.map(toScreen);
        return {
          patch,
          value: fieldValues[index] ?? 0,
          points: screenPoints.map(({ x, y }) => `${x},${y}`).join(" "),
          center: toScreen(projectPoint(patch.center_local_xyz_m, viewPreset)),
        };
      }),
    [fault.patches, fieldValues, scale, pan, baseCenter, viewPreset],
  );

  const tracePoints = useMemo(() => {
    if (!fault.surface_trace_local_xyz_m || fault.surface_trace_local_xyz_m.length < 2) {
      return "";
    }
    return fault.surface_trace_local_xyz_m
      .map((point) => {
        const projected = toScreen(projectPoint(point, viewPreset));
        return `${projected.x},${projected.y}`;
      })
      .join(" ");
  }, [fault.surface_trace_local_xyz_m, scale, pan, baseCenter, viewPreset]);

  const stationPoints = useMemo(
    () =>
      stations
        .filter((station) => station.local_xyz_m)
        .map((station) => ({
          station,
          point: toScreen(projectPoint(station.local_xyz_m as [number, number, number], viewPreset)),
        })),
    [stations, scale, pan, baseCenter, viewPreset],
  );

  return (
    <svg
      ref={svgRef}
      data-testid="fault-canvas"
      className="fault-canvas"
      viewBox={`0 0 ${VIEWPORT_WIDTH} ${VIEWPORT_HEIGHT}`}
      onMouseLeave={() => {
        dragRef.current = null;
        onHoverPatch(null);
      }}
      onMouseDown={(event) => {
        dragRef.current = { x: event.clientX, y: event.clientY };
      }}
      onMouseMove={(event) => {
        if (!dragRef.current) {
          return;
        }

        const dx = event.clientX - dragRef.current.x;
        const dy = event.clientY - dragRef.current.y;
        dragRef.current = { x: event.clientX, y: event.clientY };
        setPan((current) => ({ x: current.x + dx, y: current.y + dy }));
      }}
      onMouseUp={() => {
        dragRef.current = null;
      }}
      onWheel={(event) => {
        event.preventDefault();
        const direction = event.deltaY > 0 ? 0.92 : 1.08;
        setZoom((current) => Math.min(Math.max(current * direction, 0.6), 8));
      }}
      role="img"
      aria-label="2D fault map"
    >
      <rect x={0} y={0} width={VIEWPORT_WIDTH} height={VIEWPORT_HEIGHT} fill="#f4f2eb" />

      <g>
        {patchPolygons.map(({ patch, value, points }) => {
          const isSelected = selectedPatchId === patch.id;
          const isHovered = hoveredPatchId === patch.id;
          return (
            <polygon
              key={patch.id}
              points={points}
              fill={colorForValue(value, fieldMeta)}
              stroke={isSelected ? "#111827" : isHovered ? "#f97316" : "rgba(24, 33, 43, 0.18)"}
              strokeWidth={isSelected ? 3 : isHovered ? 2.2 : 1}
              vectorEffect="non-scaling-stroke"
              onMouseEnter={() => onHoverPatch(patch.id)}
              onMouseLeave={() => onHoverPatch(null)}
              onClick={() => onSelectPatch(patch.id)}
            />
          );
        })}

        {tracePoints ? (
          <polyline
            points={tracePoints}
            fill="none"
            stroke="#f59e0b"
            strokeWidth={3}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}

        {stationPoints.map(({ station, point }) => (
          <circle
            key={station.station_id}
            cx={point.x}
            cy={point.y}
            r={5}
            fill={STATION_COLORS[station.category] ?? "#475569"}
            stroke="#fbfdff"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
    </svg>
  );
}
