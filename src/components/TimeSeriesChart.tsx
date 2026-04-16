import { useEffect, useMemo, useRef, useState } from "react";
import uPlot from "uplot";
import type { StationTimeseries } from "../lib/types";

interface TimeSeriesChartProps {
  series: StationTimeseries;
  useCleaned: boolean;
  normalized: boolean;
}

function normalize(values: Array<number | null>) {
  const first = values.find((value): value is number => typeof value === "number");
  if (first === undefined) {
    return values;
  }
  return values.map((value) => (typeof value === "number" ? value - first : value));
}

export function TimeSeriesChart({ series, useCleaned, normalized }: TimeSeriesChartProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [chartError, setChartError] = useState<string | null>(null);
  const source = useCleaned && series.has_cleaned ? series.cleaned : series.raw;

  const alignedData = useMemo(() => {
    const values = normalized
      ? {
          E: normalize(source.E),
          N: normalize(source.N),
          U: normalize(source.U),
        }
      : source;

    return [
      series.dates.map((date) => new Date(date).getTime() / 1000),
      values.E,
      values.N,
      values.U,
    ] as uPlot.AlignedData;
  }, [normalized, series.dates, source]);

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
    if (!node || width === 0) {
      return;
    }

    try {
      setChartError(null);
      node.innerHTML = "";
      const plot = new uPlot(
        {
          width,
          height: 320,
          padding: [18, 12, 10, 8],
          tzDate: (timestamp) => new Date(timestamp * 1000),
          series: [
            {},
            { label: "East", stroke: "#2563eb", width: 2 },
            { label: "North", stroke: "#ea580c", width: 2 },
            { label: "Up", stroke: "#0f766e", width: 2 },
          ],
          scales: {
            x: { time: true },
          },
          axes: [
            {
              stroke: "#53606d",
              grid: { stroke: "#d7ddd7", width: 1 },
            },
            {
              stroke: "#53606d",
              grid: { stroke: "#d7ddd7", width: 1 },
              label: normalized ? "Displacement relative to first point [m]" : "Displacement [m]",
            },
          ],
          legend: {
            show: true,
          },
        },
        alignedData,
        node,
      );

      return () => plot.destroy();
    } catch (error) {
      console.error("Failed to render time series chart", error);
      setChartError("Impossibile renderizzare la serie temporale nel browser corrente.");
      node.innerHTML = "";
    }
  }, [alignedData, normalized, width]);

  if (chartError) {
    return (
      <div className="runtime-error" role="alert">
        <strong>Chart non disponibile.</strong>
        <p>{chartError}</p>
      </div>
    );
  }

  return <div ref={hostRef} className="timeseries-chart" aria-label="GNSS time series chart" />;
}
