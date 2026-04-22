import type {
  FaultPatchesData,
  ManifestData,
  ModelDetail,
  ModelsResponse,
  SnapshotData,
  StationSummary,
  StationsResponse,
  StationTimeseries,
  ValidationGeometryData,
  ValidationModelCatalog,
  ValidationSnapshotData,
  ValidationSnapshotIndex,
} from "./types";

const jsonCache = new Map<string, Promise<unknown>>();
const staticBase = import.meta.env.BASE_URL;
const staticPath = (path: string) => `${staticBase}${path}`;

interface StaticStationsPayload {
  default_station_id?: string;
  summary?: StationsResponse["summary"];
  meta?: StationsResponse["summary"];
  stations: StationSummary[];
}

interface StaticModelIndexPayload {
  meta?: {
    model_key?: string;
    model_label?: string;
    checkpoint?: string | null;
  };
  fields: ModelDetail["fields"];
  static_fields?: ModelDetail["static_fields"];
  snapshots: ModelDetail["snapshots"];
}

function normalizeTimeseriesPath(path: string) {
  if (path.startsWith("/data/")) {
    return path.slice("/data/".length);
  }
  if (path.startsWith("data/")) {
    return path.slice("data/".length);
  }
  return path;
}

function normalizeStation(station: StationSummary): StationSummary {
  return {
    ...station,
    timeseries_path: normalizeTimeseriesPath(station.timeseries_path),
  };
}

async function fetchJson<T>(path: string): Promise<T> {
  const cached = jsonCache.get(path);
  if (cached) {
    return cached as Promise<T>;
  }

  const pending = fetch(path).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Failed to fetch ${path}: ${response.status}`);
    }
    return (await response.json()) as T;
  });
  jsonCache.set(path, pending);
  return pending;
}

export function loadManifest() {
  return fetchJson<ManifestData>(staticPath("manifest.json"));
}

export async function loadStations() {
  const payload = await fetchJson<StaticStationsPayload>(staticPath("stations.json"));
  const defaultStationId =
    payload.default_station_id ??
    payload.stations.find((station) => station.station_id === "AQUI00ITA")?.station_id ??
    payload.stations[0]?.station_id ??
    "";
  return {
    default_station_id: defaultStationId,
    summary: payload.summary ?? payload.meta ?? {
      station_count: payload.stations.length,
      category_counts: {},
      coordinate_source: "unknown",
      total_time_series_samples: 0,
    },
    stations: payload.stations.map(normalizeStation),
  };
}

export function loadStationTimeseries(stationId: string) {
  return fetchJson<StationTimeseries>(staticPath(`timeseries/${stationId}.json`));
}

export function loadFaultTrace() {
  return fetchJson<GeoJSON.FeatureCollection>(staticPath("fault.geojson"));
}

export function loadFaultPatches() {
  return fetchJson<FaultPatchesData>(staticPath("fault_patches.json"));
}

export function loadModels() {
  return fetchJson<ModelsResponse>(staticPath("models/index.json"));
}

export async function loadModelDetail(modelKey: string) {
  const [modelsPayload, modelIndex] = await Promise.all([
    loadModels(),
    fetchJson<StaticModelIndexPayload>(staticPath(`model_snapshots/${modelKey}/index.json`)),
  ]);
  const modelSummary = modelsPayload.models.find((model) => model.key === modelKey);

  if (!modelSummary) {
    throw new Error(`Model '${modelKey}' not found in catalog.`);
  }

  return {
    ...modelSummary,
    label: modelIndex.meta?.model_label ?? modelSummary.label,
    checkpoint: modelIndex.meta?.checkpoint ?? modelSummary.checkpoint,
    default_field_key: modelsPayload.default_field_key,
    fields: modelIndex.fields,
    static_fields: modelIndex.static_fields,
    snapshots: modelIndex.snapshots,
  } satisfies ModelDetail;
}

export function loadModelSnapshot(modelKey: string, snapshotKey: string) {
  return fetchJson<SnapshotData>(staticPath(`model_snapshots/${modelKey}/${snapshotKey}.json`));
}

export function loadValidationModelCatalog() {
  return fetchJson<ValidationModelCatalog>(staticPath("validation/models/index.json"));
}

export function loadValidationGeometry(modelKey: string) {
  return fetchJson<ValidationGeometryData>(staticPath(`validation/models/${modelKey}/geometry.json`));
}

export function loadValidationSnapshotIndex(modelKey: string) {
  return fetchJson<ValidationSnapshotIndex>(staticPath(`validation/models/${modelKey}/index.json`));
}

export function loadValidationSnapshot(modelKey: string, snapshotKey: string) {
  return fetchJson<ValidationSnapshotData>(staticPath(`validation/models/${modelKey}/snapshots/${snapshotKey}.json`));
}
