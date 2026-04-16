import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OverviewPage } from "./OverviewPage";

const manifestFixture = {
  app_title: "Aquila Fault + GNSS Explorer",
  generated_at: "2026-04-15T00:00:00Z",
  defaults: {
    default_station_id: "AQUI00ITA",
    default_model_key: "best_sweep",
    default_field_key: "slip_m",
  },
  summary: {
    stations: 2,
    timeseries: 2,
    fault_patches: 3,
    models: 4,
    snapshots: 32,
  },
  sources: {
    config_path: "config/curation.json",
    source_data_dir: "../Erthquake_physics/we-app/public/data",
  },
};

const stationsFixture = {
  default_station_id: "AQUI00ITA",
  summary: {
    station_count: 2,
    category_counts: { accepted: 1, modified: 1 },
    coordinate_source: "source",
    total_time_series_samples: 8,
  },
  stations: [
    {
      station_id: "AQUI00ITA",
      label: "L'Aquila",
      category: "accepted",
      reference_system: "ITRF",
      latitude: 42.35,
      longitude: 13.4,
      utm_e_m: 0,
      utm_n_m: 0,
      local_xyz_m: [0, 0, 0],
      coordinates_source: "source",
      is_fallback_coordinate: false,
      networks: "RING",
      distance_km_from_laquila: 0,
      available_date_range: { start: "2020-01-01", end: "2024-12-31" },
      timeseries_path: "timeseries/AQUI00ITA.json",
      sample_count: 4,
      source_file: "AQUI00ITA.csv",
    },
    {
      station_id: "ACQU01ITA",
      label: "Acquasanta",
      category: "modified",
      reference_system: "ITRF",
      latitude: 42.4,
      longitude: 13.5,
      utm_e_m: 0,
      utm_n_m: 0,
      local_xyz_m: [10, 0, 20],
      coordinates_source: "source",
      is_fallback_coordinate: false,
      networks: "RING",
      distance_km_from_laquila: 12.4,
      available_date_range: { start: "2020-01-01", end: "2024-12-31" },
      timeseries_path: "timeseries/ACQU01ITA.json",
      sample_count: 4,
      source_file: "ACQU01ITA.csv",
    },
  ],
};

const faultFixture = {
  type: "FeatureCollection",
  features: [],
};

const makeSeries = (stationId: string) => ({
  station_id: stationId,
  label: stationId,
  category: "accepted",
  source_file: `${stationId}.csv`,
  reference_system: "ITRF",
  units: { displacement: "m" },
  date_range: { start: "2020-01-01", end: "2020-01-04" },
  has_cleaned: true,
  dates: ["2020-01-01", "2020-01-02", "2020-01-03", "2020-01-04"],
  raw: {
    E: [0, 1, 2, 3],
    N: [0, 1, 2, 3],
    U: [0, 1, 2, 3],
  },
  cleaned: {
    E: [0, 1, 2, 3],
    N: [0, 1, 2, 3],
    U: [0, 1, 2, 3],
  },
});

describe("OverviewPage", () => {
  beforeEach(() => {
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      let payload: unknown = null;

      if (url === "/aquila_faglia_web/manifest.json") {
        payload = manifestFixture;
      } else if (url === "/aquila_faglia_web/stations.json") {
        payload = stationsFixture;
      } else if (url === "/aquila_faglia_web/fault.geojson") {
        payload = faultFixture;
      } else if (url === "/aquila_faglia_web/timeseries/AQUI00ITA.json") {
        payload = makeSeries("AQUI00ITA");
      } else if (url === "/aquila_faglia_web/timeseries/ACQU01ITA.json") {
        payload = makeSeries("ACQU01ITA");
      }

      if (payload == null) {
        return Promise.resolve(new Response(null, { status: 404 }));
      }

      return Promise.resolve(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }) as typeof fetch;
  });

  it("loads stations and allows switching the selected time series", async () => {
    render(<OverviewPage />);

    expect(await screen.findByRole("heading", { name: "AQUI00ITA" })).toBeInTheDocument();
    expect(await screen.findByLabelText("GNSS time series chart")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /ACQU01ITA/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/aquila_faglia_web/timeseries/ACQU01ITA.json");
    });

    expect(screen.getByRole("heading", { name: "ACQU01ITA" })).toBeInTheDocument();
  });
});
