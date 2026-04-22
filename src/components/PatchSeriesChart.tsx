import { useEffect, useMemo, useRef, useState } from "react";
import uPlot from "uplot";
import { formatDateLabel } from "../lib/format";

interface PatchSeriesChartProps {
  dates: string[];
  validationValues: number[];
  originalValues: number[];
  units: string;
  yRange: [number, number] | null;
  testId: string;
}

export function PatchSeriesChart({
  dates,
  validationValues,
  originalValues,
  units,
  yRange,
  testId,
}: PatchSeriesChartProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [chartError, setChartError] = useState<string | null>(null);

  const alignedData = useMemo(() => {
    const timestamps = dates.map((date) => new Date(date).getTime() / 1000);
    const cleanedValidationValues = validationValues.map((value) => (Number.isFinite(value) ? value : null));
    const cleanedOriginalValues = originalValues.map((value) => (Number.isFinite(value) ? value : null));
    return [timestamps, cleanedValidationValues, cleanedOriginalValues] as uPlot.AlignedData;
  }, [dates, originalValues, validationValues]);

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
    if (!node || width === 0 || !yRange) {
      return;
    }

    try {
      setChartError(null);
      node.innerHTML = "";
      const [plotYMin, plotYMax] = yRange;
      const plot = new uPlot(
        {
          width,
          height: 250,
          padding: [18, 14, 24, 10],
          tzDate: (timestamp) => new Date(timestamp * 1000),
          series: [
            {},
            { label: "Validation", stroke: "#0f4c5c", width: 2.2 },
            { label: "Original", stroke: "#c37211", width: 2.2 },
          ],
          scales: {
            x: { time: true },
            y: {
              auto: false,
              range: () => [plotYMin, plotYMax],
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
          legend: { show: true },
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
  }, [alignedData, units, width, yRange]);

  return (
    <div className="patch-series-card">
      <div className="fault-compare-head">
        <h4>Validation vs Original</h4>
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
