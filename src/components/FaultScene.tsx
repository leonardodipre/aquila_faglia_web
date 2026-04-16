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
const VIEWBOX_HEIGHT = 260;
const OUTER_PADDING = 32;
const HORIZONTAL_INSET = 26;
const VERTICAL_FLATTENING = 0.82;

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
  const drawableWidth = VIEWBOX_WIDTH - OUTER_PADDING * 2 - HORIZONTAL_INSET * 2;
  const drawableHeight = VIEWBOX_HEIGHT - OUTER_PADDING * 2;
  const faultWidth = drawableWidth;
  const faultHeight = Math.min(
    drawableHeight,
    drawableWidth * (ny / nx) * VERTICAL_FLATTENING,
  );
  const cellWidth = faultWidth / nx;
  const cellHeight = faultHeight / ny;
  const leftOffset = (VIEWBOX_WIDTH - faultWidth) / 2;
  const topOffset = (VIEWBOX_HEIGHT - faultHeight) / 2;

  const cells = useMemo(
    () =>
      fault.patches.map((patch) => {
        const x = leftOffset + patch.col * cellWidth;
        const y = topOffset + patch.row * cellHeight;
        return {
          patch,
          x,
          y,
          width: cellWidth,
          height: cellHeight,
          fill: colorForValue(fieldValues[patch.id] ?? 0, fieldMeta),
        };
      }),
    [cellHeight, cellWidth, fault.patches, fieldMeta, fieldValues, leftOffset, topOffset],
  );

  return (
    <svg
      data-testid="fault-canvas"
      className="fault-canvas"
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      width="100%"
      height="100%"
      role="img"
      aria-label="Fault rectangle view"
      preserveAspectRatio="xMidYMid meet"
      onMouseLeave={() => onHoverPatch(null)}
    >
      <rect x={0} y={0} width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill="#f4f2eb" />
      <rect
        x={leftOffset - 12}
        y={topOffset - 12}
        width={faultWidth + 24}
        height={faultHeight + 24}
        rx={18}
        fill="#efe7d8"
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
