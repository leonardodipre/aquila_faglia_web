import { useEffect, useMemo, useRef, useState } from "react";
import uPlot from "uplot";
import { formatDateLabel } from "../lib/format";

interface PatchSeriesChartProps {
  title: string;
  dates: string[];
  values: number[];
  units: string;
  color: string;
  sharedYRange: [number, number] | null;
  testId: string;
}

export function PatchSeriesChart({
  title,
  dates,
  values,
  units,
  color,
  sharedYRange,
  testId,
}: PatchSeriesChartProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [chartError, setChartError] = useState<string | null>(null);

  const alignedData = useMemo(() => {
    const timestamps = dates.map((date) => new Date(date).getTime() / 1000);
    const cleanedValues = values.map((value) => (Number.isFinite(value) ? value : null));
    return [timestamps, cleanedValues] as uPlot.AlignedData;
  }, [dates, values]);

  useEffect(() => {
    const node = hostRef.current;
    if (!node) {
      return;
    }

    const resize = () => {
      setWidth(Math.max(node.clientWidth, 320));
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = hostRef.current;
    if (!node || width === 0 || !sharedYRange) {
      return;
    }

    try {
      setChartError(null);
      node.innerHTML = "";
      const [sharedYMin, sharedYMax] = sharedYRange;
      const plot = new uPlot(
        {
          width,
          height: 250,
          padding: [18, 14, 24, 10],
          tzDate: (timestamp) => new Date(timestamp * 1000),
          series: [{}, { label: title, stroke: color, width: 2.2 }],
          scales: {
            x: { time: true },
            y: {
              auto: false,
              range: () => [sharedYMin, sharedYMax],
            },
          },
          axes: [
            {
              stroke: "#53606d",
              grid: { stroke: "#d7ddd7", width: 1 },
              values: (_self, ticks) =>
                ticks.map((tick) => {
                  const date = new Date(Number(tick) * 1000).toISOString();
                  return formatDateLabel(date);
                }),
            },
            {
              stroke: "#53606d",
              grid: { stroke: "#d7ddd7", width: 1 },
              label: units || "unitless",
            },
          ],
          legend: { show: false },
        },
        alignedData,
        node,
      );

      return () => plot.destroy();
    } catch (error) {
      console.error("Failed to render patch series chart", error);
      setChartError("Impossibile renderizzare il grafico patch.");
      node.innerHTML = "";
    }
  }, [alignedData, color, sharedYRange, title, units, width]);

  return (
    <div className="patch-series-card">
      <div className="fault-compare-head">
        <h4>{title}</h4>
        <span className="pill-muted">{units || "unitless"}</span>
      </div>
      {chartError ? (
        <div className="runtime-error" role="alert">
          <strong>Chart non disponibile.</strong>
          <p>{chartError}</p>
        </div>
      ) : (
        <div ref={hostRef} className="patch-series-chart-host" data-testid={testId} />
      )}
    </div>
  );
}
