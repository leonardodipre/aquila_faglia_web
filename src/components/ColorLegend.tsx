import { gradientForMeta } from "../lib/colors";
import { formatScientific } from "../lib/format";
import type { SnapshotFieldMeta } from "../lib/types";

interface ColorLegendProps {
  meta: SnapshotFieldMeta;
}

export function ColorLegend({ meta }: ColorLegendProps) {
  return (
    <div className="legend-block">
      <div className="legend-head">
        <div>
          <span className="eyebrow">Field legend</span>
          <h3>{meta.label}</h3>
        </div>
        <span className="pill-muted">{meta.units || "unitless"}</span>
      </div>

      <div className="legend-gradient" style={{ backgroundImage: gradientForMeta(meta) }} />

      <div className="legend-scale">
        <span>{formatScientific(meta.min)}</span>
        <span>{meta.scale}</span>
        <span>{formatScientific(meta.max)}</span>
      </div>
    </div>
  );
}

