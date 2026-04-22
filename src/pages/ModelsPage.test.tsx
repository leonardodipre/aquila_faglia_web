import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModelsPage } from "./ModelsPage";

const base = "/aquila_faglia_web";

const modelKeys = {
  v1OriginalFinal: "green_out_validation_original_seed42_v_new_quasi_static",
  v1ValidationFinal: "green_out_validation_validation_seed_42_v_ref_new_quesi_static",
  v1OriginalStep: "green_out_validation_original_seed42_v_new_quasi_static_model_step010000",
  v1ValidationStep: "green_out_validation_validation_seed_42_v_ref_new_quesi_static_model_step010000",
  v2OriginalFinal: "green_out_validation_original_seed42_v_new_quasi_dynamic",
  v2ValidationFinal: "green_out_validation_validation_seed_42_new_v_quasi_dynamic",
};

const catalogFixture = {
  default_model_key: modelKeys.v1OriginalFinal,
  models: [
    {
      key: modelKeys.v1OriginalFinal,
      label: "Original_seed42_V_new_quasi_static",
      folder_key: "green_out_validation",
      folder_label: "green_out_validation",
      checkpoint: "x",
      green_dir: "green_out",
      geometry_path: "",
      snapshot_index_path: "",
      snapshot_count: 2,
      patch_count: 2,
      reference_date: "2000-01-01T00:00:00",
      time_range: { start: "2000-01-01T00:00:00", end: "2025-12-31T00:00:00" },
    },
    {
      key: modelKeys.v1ValidationFinal,
      label: "Validation__seed_42_V_ref_new_quesi_static",
      folder_key: "green_out_validation",
      folder_label: "green_out_validation",
      checkpoint: "x",
      green_dir: "green_out",
      geometry_path: "",
      snapshot_index_path: "",
      snapshot_count: 2,
      patch_count: 2,
      reference_date: "2000-01-01T00:00:00",
      time_range: { start: "2000-01-01T00:00:00", end: "2025-12-31T00:00:00" },
    },
    {
      key: modelKeys.v1OriginalStep,
      label: "Original_seed42_V_new_quasi_static / model.step010000",
      folder_key: "green_out_validation",
      folder_label: "green_out_validation",
      checkpoint: "x",
      green_dir: "green_out",
      geometry_path: "",
      snapshot_index_path: "",
      snapshot_count: 2,
      patch_count: 2,
      reference_date: "2000-01-01T00:00:00",
      time_range: { start: "2000-01-01T00:00:00", end: "2025-12-31T00:00:00" },
    },
    {
      key: modelKeys.v1ValidationStep,
      label: "Validation__seed_42_V_ref_new_quesi_static / model.step010000",
      folder_key: "green_out_validation",
      folder_label: "green_out_validation",
      checkpoint: "x",
      green_dir: "green_out",
      geometry_path: "",
      snapshot_index_path: "",
      snapshot_count: 2,
      patch_count: 2,
      reference_date: "2000-01-01T00:00:00",
      time_range: { start: "2000-01-01T00:00:00", end: "2025-12-31T00:00:00" },
    },
    {
      key: modelKeys.v2OriginalFinal,
      label: "Original_seed42_V_new_quasi_dynamic",
      folder_key: "green_out_validation",
      folder_label: "green_out_validation",
      checkpoint: "x",
      green_dir: "green_out",
      geometry_path: "",
      snapshot_index_path: "",
      snapshot_count: 2,
      patch_count: 2,
      reference_date: "2000-01-01T00:00:00",
      time_range: { start: "2000-01-01T00:00:00", end: "2025-12-31T00:00:00" },
    },
    {
      key: modelKeys.v2ValidationFinal,
      label: "Validation__seed_42_new_V_quasi_dynamic",
      folder_key: "green_out_validation",
      folder_label: "green_out_validation",
      checkpoint: "x",
      green_dir: "green_out",
      geometry_path: "",
      snapshot_index_path: "",
      snapshot_count: 2,
      patch_count: 2,
      reference_date: "2000-01-01T00:00:00",
      time_range: { start: "2000-01-01T00:00:00", end: "2025-12-31T00:00:00" },
    },
  ],
};

function makeGeometry(referenceLength: number, lengthExtent: [number, number]) {
  return {
    meta: {
      model_key: "x",
      model_label: "x",
      folder_key: "f",
      folder_label: "f",
      checkpoint: "c",
      green_dir: "g",
      reference_date: "2000-01-01T00:00:00",
      patch_count: 2,
      grid: { nx: 2, ny: 1 },
      strike_deg: 130,
      dip_deg: 50,
      top_depth_km: 0,
      bottom_depth_km: 14,
      length_extent_km: lengthExtent,
      depth_extent_km: [0, 14] as [number, number],
    },
    reference_places: [
      {
        label: "L'Aquila",
        longitude: 13.3995,
        latitude: 42.3498,
        projected_length_km: referenceLength,
        projected_depth_km: 0,
        source: "test",
      },
    ],
    patches: [
      {
        id: 0,
        row: 0,
        col: 0,
        center_length_km: lengthExtent[0] + 1,
        center_depth_km: 3,
        polygon_length_depth_km: [
          [lengthExtent[0], 0],
          [lengthExtent[0] + 2, 0],
          [lengthExtent[0] + 2, 7],
          [lengthExtent[0], 7],
        ],
      },
      {
        id: 1,
        row: 0,
        col: 1,
        center_length_km: lengthExtent[0] + 3,
        center_depth_km: 9,
        polygon_length_depth_km: [
          [lengthExtent[0] + 2, 7],
          [lengthExtent[0] + 4, 7],
          [lengthExtent[0] + 4, 14],
          [lengthExtent[0] + 2, 14],
        ],
      },
    ],
  };
}

const indexFixture = {
  meta: {
    model_key: "x",
    model_label: "x",
    folder_key: "f",
    folder_label: "f",
    checkpoint: "c",
    green_dir: "g",
    reference_date: "2000-01-01T00:00:00",
    snapshot_count: 2,
    patch_count: 2,
  },
  fields: {
    slip_m: {
      label: "Slip",
      units: "m",
      color_map: "viridis",
      scale: "linear" as const,
      min: 0,
      max: 1,
    },
    theta_s: {
      label: "Theta",
      units: "s",
      color_map: "plasma",
      scale: "log" as const,
      min: 1,
      max: 10,
    },
  },
  snapshots: [
    { date: "2000-01-01T00:00:00", date_key: "2000-01-01", path: "x" },
    { date: "2025-12-31T00:00:00", date_key: "2025-12-31", path: "x" },
  ],
};

function makeSnapshot(values: [number, number], date: string) {
  return {
    date,
    time_seconds: 0,
    fields: {
      slip_m: [values[0], values[1]],
      theta_s: [values[0] + 1, values[1] + 1],
    },
    stats: {
      slip_m: { min: Math.min(...values), max: Math.max(...values), mean: (values[0] + values[1]) / 2 },
    },
  };
}

const snapshotByPath: Record<string, unknown> = {
  [modelKeys.v1ValidationFinal]: {
    "2025-12-31": makeSnapshot([1, 2], "2025-12-31T00:00:00"),
    "2000-01-01": makeSnapshot([3, 4], "2000-01-01T00:00:00"),
  },
  [modelKeys.v1OriginalFinal]: {
    "2025-12-31": makeSnapshot([10, 20], "2025-12-31T00:00:00"),
    "2000-01-01": makeSnapshot([30, 40], "2000-01-01T00:00:00"),
  },
  [modelKeys.v1ValidationStep]: {
    "2025-12-31": makeSnapshot([5, 6], "2025-12-31T00:00:00"),
    "2000-01-01": makeSnapshot([7, 8], "2000-01-01T00:00:00"),
  },
  [modelKeys.v1OriginalStep]: {
    "2025-12-31": makeSnapshot([11, 12], "2025-12-31T00:00:00"),
    "2000-01-01": makeSnapshot([13, 14], "2000-01-01T00:00:00"),
  },
  [modelKeys.v2ValidationFinal]: {
    "2025-12-31": makeSnapshot([0.5, 0.7], "2025-12-31T00:00:00"),
    "2000-01-01": makeSnapshot([0.2, 0.3], "2000-01-01T00:00:00"),
  },
  [modelKeys.v2OriginalFinal]: {
    "2025-12-31": makeSnapshot([1.5, 1.7], "2025-12-31T00:00:00"),
    "2000-01-01": makeSnapshot([1.2, 1.3], "2000-01-01T00:00:00"),
  },
};

function payloadForUrl(url: string) {
  if (url === `${base}/validation/models/index.json`) {
    return catalogFixture;
  }

  const geometryMatch = url.match(new RegExp(`${base}/validation/models/(.+)/geometry\\.json$`));
  if (geometryMatch) {
    const modelKey = geometryMatch[1];
    if (modelKey.includes("_original_")) {
      return makeGeometry(5, [0, 65]);
    }
    return makeGeometry(30, [0, 120]);
  }

  const indexMatch = url.match(new RegExp(`${base}/validation/models/(.+)/index\\.json$`));
  if (indexMatch) {
    return indexFixture;
  }

  const snapshotMatch = url.match(new RegExp(`${base}/validation/models/(.+)/snapshots/([0-9-]+)\\.json$`));
  if (snapshotMatch) {
    const modelKey = snapshotMatch[1];
    const snapshotKey = snapshotMatch[2];
    const snapshotBucket = snapshotByPath[modelKey] as Record<string, unknown> | undefined;
    return snapshotBucket?.[snapshotKey] ?? null;
  }

  return null;
}

describe("ModelsPage compare", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const payload = payloadForUrl(url);
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

  it("maps default family V1 to the correct Original/Validation pair", async () => {
    render(<ModelsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("validation-model-key")).toHaveTextContent(modelKeys.v1ValidationFinal);
      expect(screen.getByTestId("original-model-key")).toHaveTextContent(modelKeys.v1OriginalFinal);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `${base}/validation/models/${modelKeys.v1ValidationFinal}/geometry.json`,
    );
    expect(global.fetch).toHaveBeenCalledWith(
      `${base}/validation/models/${modelKeys.v1OriginalFinal}/geometry.json`,
    );
  });

  it("switches to V2 and loads the mapped pair", async () => {
    render(<ModelsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("validation-model-key")).toHaveTextContent(modelKeys.v1ValidationFinal);
    });

    fireEvent.change(screen.getByLabelText("Famiglia"), { target: { value: "V2" } });

    await waitFor(() => {
      expect(screen.getByTestId("validation-model-key")).toHaveTextContent(modelKeys.v2ValidationFinal);
      expect(screen.getByTestId("original-model-key")).toHaveTextContent(modelKeys.v2OriginalFinal);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `${base}/validation/models/${modelKeys.v2ValidationFinal}/index.json`,
    );
    expect(global.fetch).toHaveBeenCalledWith(
      `${base}/validation/models/${modelKeys.v2OriginalFinal}/index.json`,
    );
  });

  it("keeps epoch synchronized and switches both keys to step010000", async () => {
    render(<ModelsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("validation-model-key")).toHaveTextContent(modelKeys.v1ValidationFinal);
    });

    fireEvent.change(screen.getByLabelText("Epoca"), { target: { value: "step010000" } });

    await waitFor(() => {
      expect(screen.getByTestId("validation-model-key")).toHaveTextContent(modelKeys.v1ValidationStep);
      expect(screen.getByTestId("original-model-key")).toHaveTextContent(modelKeys.v1OriginalStep);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `${base}/validation/models/${modelKeys.v1ValidationStep}/snapshots/2025-12-31.json`,
    );
    expect(global.fetch).toHaveBeenCalledWith(
      `${base}/validation/models/${modelKeys.v1OriginalStep}/snapshots/2025-12-31.json`,
    );
  });

  it("loads shared snapshot for both faults when snapshot selector changes", async () => {
    render(<ModelsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText("Snapshot")).toHaveValue("2025-12-31");
    });

    fireEvent.change(screen.getByLabelText("Snapshot"), { target: { value: "2000-01-01" } });

    await waitFor(() => {
      expect(screen.getByLabelText("Snapshot")).toHaveValue("2000-01-01");
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `${base}/validation/models/${modelKeys.v1ValidationFinal}/snapshots/2000-01-01.json`,
    );
    expect(global.fetch).toHaveBeenCalledWith(
      `${base}/validation/models/${modelKeys.v1OriginalFinal}/snapshots/2000-01-01.json`,
    );
  });

  it("computes shared scale min/max and L'Aquila offset for alignment", async () => {
    render(<ModelsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("shared-scale-range")).toHaveTextContent("1|20");
      expect(screen.getByTestId("alignment-offset-km")).toHaveTextContent("25.000000");
    });
  });
});
