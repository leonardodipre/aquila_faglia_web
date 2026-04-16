import type {
  FaultPatchesData,
  ManifestData,
  ModelDetail,
  ModelsResponse,
  SnapshotData,
  StationSummary,
  StationsResponse,
  StationTimeseries,
} from "./types";

const jsonCache = new Map<string, Promise<unknown>>();
const staticPath = (path: string) => `./${path}`;

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
  const payload = await fetchJson<StationsResponse>(staticPath("stations.json"));
  return {
    ...payload,
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

export function loadModelDetail(modelKey: string) {
  return fetchJson<ModelDetail>(staticPath(`model_snapshots/${modelKey}/index.json`));
}

export function loadModelSnapshot(modelKey: string, snapshotKey: string) {
  return fetchJson<SnapshotData>(staticPath(`model_snapshots/${modelKey}/${snapshotKey}.json`));
}
