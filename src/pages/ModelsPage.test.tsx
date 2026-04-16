import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ModelsPage } from "./ModelsPage";

const modelsFixture = {
  default_model_key: "best_sweep",
  default_field_key: "slip_m",
  models: [
    {
      key: "best_sweep",
      label: "Best Sweep",
      checkpoint: "best_sweep.pt",
      snapshot_count: 2,
      default_snapshot_key: "2020-01-01",
      time_range: { start: "2020-01-01", end: "2024-12-31" },
      field_keys: ["slip_m", "theta_s"],
    },
    {
      key: "ab_prior",
      label: "a-b Prior",
      checkpoint: "ab_prior.pt",
      snapshot_count: 2,
      default_snapshot_key: "2020-01-01",
      time_range: { start: "2020-01-01", end: "2024-12-31" },
      field_keys: ["slip_m", "theta_s"],
    },
  ],
};

const stationsFixture = {
  default_station_id: "AQUI00ITA",
  summary: {
    station_count: 1,
    category_counts: { accepted: 1 },
    coordinate_source: "source",
    total_time_series_samples: 4,
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
      available_date_range: { start: "2020-01-01", end: "2024-12-31" },
      timeseries_path: "timeseries/AQUI00ITA.json",
      sample_count: 4,
      source_file: "AQUI00ITA.csv",
    },
  ],
};

const faultFixture = {
  meta: {
    patch_count: 1,
    triangle_count: 2,
    grid: { nx: 1, ny: 1 },
    utm_epsg: 32633,
    local_origin_utm_en_m: [0, 0],
    fault_meta: {
      strike_deg: 0,
      dip_deg: 45,
      rake_deg: 90,
      top_depth_m: 0,
      bottom_depth_m: 1000,
      length_m: 1000,
      width_m: 1000,
      origin_en: [0, 0],
    },
    elastic: {},
    notes: {},
  },
  patches: [
    {
      id: 0,
      row: 0,
      col: 0,
      center_enu_m: [0, 0, 0],
      center_local_xyz_m: [0, -100, 0],
      center_lon_lat: [13.4, 42.35],
      depth_m: 100,
      corners_enu_m: [],
      corners_local_xyz_m: [
        [0, -100, 0],
        [100, -100, 0],
        [100, -100, 100],
        [0, -100, 100],
      ],
      triangles_enu_m: [],
      triangles_local_xyz_m: [
        [
          [0, -100, 0],
          [100, -100, 0],
          [100, -100, 100],
        ],
        [
          [0, -100, 0],
          [100, -100, 100],
          [0, -100, 100],
        ],
      ],
    },
  ],
  surface_trace_local_xyz_m: [
    [0, 0, 0],
    [100, 0, 100],
  ],
};

const makeDetail = (key: string, label: string) => ({
  key,
  label,
  checkpoint: `${key}.pt`,
  snapshot_count: 2,
  default_snapshot_key: "2020-01-01",
  default_field_key: "slip_m",
  time_range: { start: "2020-01-01", end: "2024-12-31" },
  field_keys: ["slip_m", "theta_s"],
  fields: {
    slip_m: {
      label: "Slip",
      units: "m",
      color_map: "viridis",
      scale: "linear",
      min: 0,
      max: 1,
    },
    theta_s: {
      label: "Theta",
      units: "s",
      color_map: "plasma",
      scale: "linear",
      min: 0,
      max: 2,
    },
  },
  snapshots: [
    { date: "2020-01-01", date_key: "2020-01-01" },
    { date: "2024-12-31", date_key: "2024-12-31" },
  ],
});

const makeSnapshot = (value: number) => ({
  date: "2020-01-01",
  time_seconds: 1,
  fields: {
    slip_m: [value],
    theta_s: [value + 1],
  },
});

describe("ModelsPage", () => {
  beforeEach(() => {
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      let payload: unknown = null;

      if (url === "./models/index.json") {
        payload = modelsFixture;
      } else if (url === "./fault_patches.json") {
        payload = faultFixture;
      } else if (url === "./stations.json") {
        payload = stationsFixture;
      } else if (url === "./model_snapshots/best_sweep/index.json") {
        payload = makeDetail("best_sweep", "Best Sweep");
      } else if (url === "./model_snapshots/ab_prior/index.json") {
        payload = makeDetail("ab_prior", "a-b Prior");
      } else if (url === "./model_snapshots/best_sweep/2020-01-01.json") {
        payload = makeSnapshot(0.25);
      } else if (url === "./model_snapshots/ab_prior/2020-01-01.json") {
        payload = makeSnapshot(0.55);
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

  it("loads model data and reacts to model and field selection", async () => {
    render(<ModelsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText("Modello")).toHaveValue("best_sweep");
    });
    expect(await screen.findByTestId("fault-canvas")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Campo fisico"), {
      target: { value: "theta_s" },
    });
    expect(screen.getByRole("heading", { name: "Theta" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Modello"), {
      target: { value: "ab_prior" },
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("./model_snapshots/ab_prior/index.json");
      expect(global.fetch).toHaveBeenCalledWith("./model_snapshots/ab_prior/2020-01-01.json");
    });

    expect(screen.getByLabelText("Modello")).toHaveValue("ab_prior");
  });
});
