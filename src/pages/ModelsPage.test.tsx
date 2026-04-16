import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModelsPage } from "./ModelsPage";

const modelsFixture = {
  default_model_key: "seed_sweep_baseline_qd_seed42",
  default_field_key: "slip_m",
  models: [
    {
      key: "seed_sweep_baseline_qd_seed42",
      label: "baseline_qd_seed42",
      checkpoint: "checkpoints/seed_sweep/baseline_qd_seed42.pt",
      snapshot_count: 2,
      default_snapshot_key: "2000-01-01",
      time_range: { start: "2000-01-01", end: "2025-12-31" },
      field_keys: ["slip_m", "theta_s", "tau_rsf_pa"],
    },
    {
      key: "seed_sweep_baseline_seed42",
      label: "baseline_seed42",
      checkpoint: "checkpoints/seed_sweep/baseline_seed42.pt",
      snapshot_count: 2,
      default_snapshot_key: "2000-01-01",
      time_range: { start: "2000-01-01", end: "2025-12-31" },
      field_keys: ["slip_m", "theta_s", "tau_rsf_pa"],
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
  checkpoint: `checkpoints/seed_sweep/${label}.pt`,
  snapshot_count: 26,
  default_snapshot_key: "2000-01-01",
  default_field_key: "slip_m",
  time_range: { start: "2000-01-01", end: "2025-12-31" },
  field_keys: [
    "slip_m",
    "slip_rate_m_per_s",
    "a",
    "b",
    "a_minus_b",
    "D_c_m",
    "tau_elastic_pa",
    "tau_rsf_pa",
    "aging_residual",
    "theta_s",
  ],
  fields: {
    slip_m: {
      label: "Slip",
      units: "m",
      color_map: "viridis",
      scale: "linear",
      min: 0,
      max: 1,
    },
    slip_rate_m_per_s: {
      label: "V",
      units: "m/s",
      color_map: "hot",
      scale: "log",
      min: 0.01,
      max: 2,
    },
    a: {
      label: "a",
      units: "unitless",
      color_map: "ylorred",
      scale: "linear",
      min: 0,
      max: 1,
    },
    b: {
      label: "b",
      units: "unitless",
      color_map: "ylorred",
      scale: "linear",
      min: 0,
      max: 1,
    },
    a_minus_b: {
      label: "a-b",
      units: "unitless",
      color_map: "rdbu",
      scale: "symmetric",
      min: -1,
      max: 1,
    },
    D_c_m: {
      label: "Dc",
      units: "m",
      color_map: "ylgnbu",
      scale: "linear",
      min: 0,
      max: 1,
    },
    tau_elastic_pa: {
      label: "Tau elastic",
      units: "Pa",
      color_map: "cividis",
      scale: "linear",
      min: 0,
      max: 1,
    },
    tau_rsf_pa: {
      label: "Tau RSF",
      units: "Pa",
      color_map: "cividis",
      scale: "linear",
      min: 0,
      max: 2,
    },
    aging_residual: {
      label: "Aging law",
      units: "unitless",
      color_map: "rdbu",
      scale: "symmetric",
      min: -1,
      max: 1,
    },
    theta_s: {
      label: "RSF",
      units: "s",
      color_map: "plasma",
      scale: "linear",
      min: 0,
      max: 2,
    },
  },
  snapshots: [
    { date: "2000-01-01", date_key: "2000-01-01" },
    { date: "2001-01-01", date_key: "2001-01-01" },
    { date: "2025-01-01", date_key: "2025-01-01" },
  ],
});

const makeSnapshot = (value: number) => ({
  date: "2000-01-01",
  time_seconds: 1,
  fields: {
    slip_m: [value],
    theta_s: [value + 1],
    tau_rsf_pa: [value + 2],
    slip_rate_m_per_s: [value + 0.01],
    a: [value + 0.1],
    b: [value + 0.2],
    a_minus_b: [value - 0.1],
    D_c_m: [value + 0.3],
    tau_elastic_pa: [value + 0.4],
    aging_residual: [value - 0.5],
  },
});

describe("ModelsPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      let payload: unknown = null;

      if (url === "/aquila_faglia_web/models/index.json") {
        payload = modelsFixture;
      } else if (url === "/aquila_faglia_web/fault_patches.json") {
        payload = faultFixture;
      } else if (url === "/aquila_faglia_web/model_snapshots/seed_sweep_baseline_qd_seed42/index.json") {
        payload = makeDetail("seed_sweep_baseline_qd_seed42", "baseline_qd_seed42");
      } else if (url === "/aquila_faglia_web/model_snapshots/seed_sweep_baseline_seed42/index.json") {
        payload = makeDetail("seed_sweep_baseline_seed42", "baseline_seed42");
      } else if (url === "/aquila_faglia_web/model_snapshots/seed_sweep_baseline_qd_seed42/2000-01-01.json") {
        payload = makeSnapshot(0.25);
      } else if (url === "/aquila_faglia_web/model_snapshots/seed_sweep_baseline_seed42/2000-01-01.json") {
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
      expect(screen.getByLabelText("Modello")).toHaveValue("seed_sweep_baseline_qd_seed42");
    });
    expect(await screen.findByTestId("fault-canvas")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Campo fisico"), {
      target: { value: "theta_s" },
    });
    expect(screen.getByRole("heading", { name: "RSF" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Modello"), {
      target: { value: "seed_sweep_baseline_seed42" },
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/aquila_faglia_web/model_snapshots/seed_sweep_baseline_seed42/index.json");
      expect(global.fetch).toHaveBeenCalledWith("/aquila_faglia_web/model_snapshots/seed_sweep_baseline_seed42/2000-01-01.json");
    });

    expect(screen.getByLabelText("Modello")).toHaveValue("seed_sweep_baseline_seed42");
  });

  it("shows only the curated ten fields in the selector", async () => {
    render(<ModelsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText("Modello")).toHaveValue("seed_sweep_baseline_qd_seed42");
    });
    const [fieldSelect] = await screen.findAllByLabelText("Campo fisico");

    const optionValues = Array.from(fieldSelect.querySelectorAll("option")).map((option) => option.getAttribute("value"));
    expect(optionValues).toEqual([
      "slip_m",
      "slip_rate_m_per_s",
      "a",
      "b",
      "a_minus_b",
      "D_c_m",
      "tau_elastic_pa",
      "tau_rsf_pa",
      "aging_residual",
      "theta_s",
    ]);
  });
});
