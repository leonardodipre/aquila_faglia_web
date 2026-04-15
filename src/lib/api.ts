import type {
  FaultPatchesData,
  ManifestData,
  ModelDetail,
  ModelsResponse,
  SnapshotData,
  StationsResponse,
  StationTimeseries,
} from "./types";

const jsonCache = new Map<string, Promise<unknown>>();

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
  return fetchJson<ManifestData>("/api/manifest");
}

export function loadStations() {
  return fetchJson<StationsResponse>("/api/stations");
}

export function loadStationTimeseries(stationId: string) {
  return fetchJson<StationTimeseries>(`/api/stations/${stationId}/timeseries`);
}

export function loadFaultTrace() {
  return fetchJson<GeoJSON.FeatureCollection>("/api/fault/trace");
}

export function loadFaultPatches() {
  return fetchJson<FaultPatchesData>("/api/fault/patches");
}

export function loadModels() {
  return fetchJson<ModelsResponse>("/api/models");
}

export function loadModelDetail(modelKey: string) {
  return fetchJson<ModelDetail>(`/api/models/${modelKey}`);
}

export function loadModelSnapshot(modelKey: string, snapshotKey: string) {
  return fetchJson<SnapshotData>(`/api/models/${modelKey}/snapshots/${snapshotKey}`);
}

