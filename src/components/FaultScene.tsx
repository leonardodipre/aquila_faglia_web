import { useMemo } from "react";
import { colorForValue } from "../lib/colors";
import type { FaultPatchesData, SnapshotFieldMeta, StationSummary } from "../lib/types";

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

const VIEWBOX_WIDTH = 1200;
const VIEWBOX_HEIGHT = 520;
const PADDING = 28;

export function FaultScene({
  fault,
  fieldMeta,
  fieldValues,
  hoveredPatchId,
  selectedPatchId,
  onHoverPatch,
  onSelectPatch,
}: FaultSceneProps) {
  const nx = Math.max(fault.meta.grid.nx, 1);
  const ny = Math.max(fault.meta.grid.ny, 1);
  const cellWidth = (VIEWBOX_WIDTH - PADDING * 2) / nx;
  const cellHeight = (VIEWBOX_HEIGHT - PADDING * 2) / ny;

  const cells = useMemo(
    () =>
      fault.patches.map((patch) => {
        const x = PADDING + patch.col * cellWidth;
        const y = PADDING + patch.row * cellHeight;
        return {
          patch,
          x,
          y,
          width: cellWidth,
          height: cellHeight,
          fill: colorForValue(fieldValues[patch.id] ?? 0, fieldMeta),
        };
      }),
    [cellHeight, cellWidth, fault.patches, fieldMeta, fieldValues],
  );

  return (
    <svg
      data-testid="fault-canvas"
      className="fault-canvas"
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      role="img"
      aria-label="Fault rectangle view"
      onMouseLeave={() => onHoverPatch(null)}
    >
      <rect x={0} y={0} width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill="#f4f2eb" />
      <rect
        x={PADDING}
        y={PADDING}
        width={VIEWBOX_WIDTH - PADDING * 2}
        height={VIEWBOX_HEIGHT - PADDING * 2}
        rx={16}
        fill="#e8e1d2"
        stroke="rgba(24, 33, 43, 0.14)"
        strokeWidth={2}
      />

      {cells.map(({ patch, x, y, width, height, fill }) => {
        const active = patch.id === hoveredPatchId || patch.id === selectedPatchId;
        return (
          <rect
            key={patch.id}
            x={x}
            y={y}
            width={width}
            height={height}
            fill={fill}
            stroke={active ? "#f8fafc" : "rgba(24, 33, 43, 0.12)"}
            strokeWidth={active ? 2.2 : 0.8}
            vectorEffect="non-scaling-stroke"
            onMouseEnter={() => onHoverPatch(patch.id)}
            onClick={() => onSelectPatch(patch.id)}
          />
        );
      })}
    </svg>
  );
}
