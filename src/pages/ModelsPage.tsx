import { useEffect, useMemo, useState } from "react";
import { ColorLegend } from "../components/ColorLegend";
import { FaultScene, type ViewPreset } from "../components/FaultScene";
import { MetricCard } from "../components/MetricCard";
import {
  loadFaultPatches,
  loadFaultTrace,
  loadModelDetail,
  loadModels,
  loadModelSnapshot,
  loadStations,
} from "../lib/api";
import { formatCompactNumber, formatDateLabel, formatScientific } from "../lib/format";
import type {
  FaultPatchesData,
  ModelDetail,
  ModelsResponse,
  SnapshotData,
  StationSummary,
} from "../lib/types";

export function ModelsPage() {
  const [modelsPayload, setModelsPayload] = useState<ModelsResponse | null>(null);
  const [faultPatches, setFaultPatches] = useState<FaultPatchesData | null>(null);
  const [faultTrace, setFaultTrace] = useState<GeoJSON.FeatureCollection | null>(null);
  const [stations, setStations] = useState<StationSummary[]>([]);
  const [selectedModelKey, setSelectedModelKey] = useState("");
  const [modelDetail, setModelDetail] = useState<ModelDetail | null>(null);
  const [selectedFieldKey, setSelectedFieldKey] = useState("");
  const [selectedSnapshotKey, setSelectedSnapshotKey] = useState("");
  const [snapshotData, setSnapshotData] = useState<SnapshotData | null>(null);
  const [viewPreset, setViewPreset] = useState<ViewPreset>("oblique");
  const [hoveredPatchId, setHoveredPatchId] = useState<number | null>(null);
  const [selectedPatchId, setSelectedPatchId] = useState<number | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  useEffect(() => {
    void Promise.all([loadModels(), loadFaultPatches(), loadFaultTrace(), loadStations()]).then(
      ([modelsData, faultData, faultTraceData, stationsData]) => {
        setModelsPayload(modelsData);
        setFaultPatches(faultData);
        setFaultTrace(faultTraceData);
        setStations(stationsData.stations);
        setSelectedModelKey(modelsData.default_model_key);
      },
    );
  }, []);

  useEffect(() => {
    if (!selectedModelKey) {
      return;
    }
    setSelectedPatchId(null);
    setHoveredPatchId(null);
    void loadModelDetail(selectedModelKey).then((detail) => {
      setModelDetail(detail);
      setSelectedFieldKey((current) => (current && detail.fields[current] ? current : detail.default_field_key));
      setSelectedSnapshotKey((current) => {
        const allowedKeys = new Set(detail.snapshots.map((snapshot) => snapshot.date_key));
        return allowedKeys.has(current) ? current : detail.default_snapshot_key;
      });
    });
  }, [selectedModelKey]);

  useEffect(() => {
    if (!selectedModelKey || !selectedSnapshotKey) {
      return;
    }
    setSnapshotLoading(true);
    void loadModelSnapshot(selectedModelKey, selectedSnapshotKey)
      .then((payload) => setSnapshotData(payload))
      .finally(() => setSnapshotLoading(false));
  }, [selectedModelKey, selectedSnapshotKey]);

  const fieldMeta = modelDetail?.fields[selectedFieldKey] ?? null;
  const fieldValues = useMemo(() => {
    if (!modelDetail || !selectedFieldKey) {
      return [];
    }
    return snapshotData?.fields[selectedFieldKey] ?? modelDetail.static_fields?.[selectedFieldKey] ?? [];
  }, [modelDetail, selectedFieldKey, snapshotData]);

  const inspectedPatch = useMemo(() => {
    if (!faultPatches) {
      return null;
    }
    const resolvedId = selectedPatchId ?? hoveredPatchId;
    if (resolvedId == null) {
      return null;
    }
    return faultPatches.patches[resolvedId] ?? null;
  }, [faultPatches, hoveredPatchId, selectedPatchId]);

  return (
    <section className="page-grid models-grid">
      <section className="hero-panel rise">
        <div className="hero-copy">
          <p className="eyebrow">Modelli PINN</p>
          <h2>Vista 3D della faglia con mesh reale e campi fisici selezionabili</h2>
          <p>
            Viewer 3D basato sulla web app di riferimento: mesh triangolare reale, stazioni GNSS,
            overlay della superficie di faglia e navigazione top/oblique.
          </p>
        </div>

        <div className="metric-grid">
          <MetricCard
            label="Modelli"
            value={modelsPayload ? formatCompactNumber(modelsPayload.models.length, 0) : "…"}
            hint="checkpoint seed sweep curati"
          />
          <MetricCard
            label="Snapshot modello"
            value={modelDetail ? formatCompactNumber(modelDetail.snapshot_count, 0) : "…"}
            hint="snapshot ridotti per i 5 modelli"
          />
          <MetricCard
            label="Campi fisici"
            value={modelDetail ? formatCompactNumber(Object.keys(modelDetail.fields).length, 0) : "…"}
            hint="derivati dinamicamente dal metadata del modello"
          />
          <MetricCard
            label="Patch"
            value={faultPatches ? formatCompactNumber(faultPatches.meta.patch_count, 0) : "…"}
            hint="mesh 3D esportata per il piano di faglia"
          />
        </div>
      </section>

      <aside className="panel rise controls-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Controlli modello</p>
            <h3>Selezione dinamica</h3>
          </div>
          {modelDetail ? <span className="pill-muted">{modelDetail.label}</span> : null}
        </div>

        <label className="field-group">
          <span>Modello</span>
          <select
            className="select-input"
            value={selectedModelKey}
            onChange={(event) => setSelectedModelKey(event.target.value)}
          >
            {modelsPayload?.models.map((model) => (
              <option key={model.key} value={model.key}>
                {model.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field-group">
          <span>Campo fisico</span>
          <select
            className="select-input"
            value={selectedFieldKey}
            onChange={(event) => setSelectedFieldKey(event.target.value)}
            disabled={!modelDetail}
          >
            {modelDetail
              ? Object.entries(modelDetail.fields).map(([fieldKey, meta]) => (
                  <option key={fieldKey} value={fieldKey}>
                    {meta.label}
                  </option>
                ))
              : null}
          </select>
        </label>

        <label className="field-group">
          <span>Snapshot</span>
          <select
            className="select-input"
            value={selectedSnapshotKey}
            onChange={(event) => setSelectedSnapshotKey(event.target.value)}
            disabled={!modelDetail}
          >
            {modelDetail?.snapshots.map((snapshot) => (
              <option key={snapshot.date_key} value={snapshot.date_key}>
                {formatDateLabel(snapshot.date)}
              </option>
            ))}
          </select>
        </label>

        <div className="toggle-row">
          <button
            type="button"
            className={viewPreset === "top" ? "toggle-chip toggle-chip-active" : "toggle-chip"}
            onClick={() => setViewPreset("top")}
          >
            Top
          </button>
          <button
            type="button"
            className={viewPreset === "oblique" ? "toggle-chip toggle-chip-active" : "toggle-chip"}
            onClick={() => setViewPreset("oblique")}
          >
            Oblique
          </button>
        </div>

        {modelDetail ? (
          <div className="detail-stack">
            <div className="detail-card">
              <span className="meta-label">Checkpoint</span>
              <strong>{modelDetail.checkpoint || "n/a"}</strong>
            </div>
            <div className="detail-card">
              <span className="meta-label">Range temporale</span>
              <strong>
                {formatDateLabel(modelDetail.time_range.start)} - {formatDateLabel(modelDetail.time_range.end)}
              </strong>
            </div>
            <div className="detail-card">
              <span className="meta-label">Snapshot attiva</span>
              <strong>{snapshotData ? formatDateLabel(snapshotData.date) : "Loading…"}</strong>
            </div>
          </div>
        ) : null}

        {fieldMeta ? <ColorLegend meta={fieldMeta} /> : null}
      </aside>

      <section className="panel rise scene-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Scena 3D</p>
            <h3>Faglia, colori per patch e overlay stazioni</h3>
          </div>
          {snapshotLoading ? <span className="pill-muted">Loading snapshot…</span> : null}
        </div>

        <div className="scene-shell">
          {faultPatches && modelDetail && fieldMeta ? (
            <FaultScene
              fault={faultPatches}
              faultTrace={faultTrace}
              stations={stations}
              fieldMeta={fieldMeta}
              fieldValues={fieldValues}
              viewPreset={viewPreset}
              hoveredPatchId={hoveredPatchId}
              selectedPatchId={selectedPatchId}
              onHoverPatch={setHoveredPatchId}
              onSelectPatch={setSelectedPatchId}
            />
          ) : (
            <div className="loading-state">Loading 3D scene…</div>
          )}
        </div>
      </section>

      <section className="panel rise patch-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Patch detail</p>
            <h3>{inspectedPatch ? `Patch ${inspectedPatch.id}` : "Hover or select a patch"}</h3>
          </div>
          {selectedPatchId != null ? <span className="pill-muted">selected</span> : null}
        </div>

        {inspectedPatch && fieldMeta ? (
          <div className="station-meta-grid">
            <div>
              <span className="meta-label">Value</span>
              <strong>{formatScientific(fieldValues[inspectedPatch.id] ?? 0)}</strong>
            </div>
            <div>
              <span className="meta-label">Units</span>
              <strong>{fieldMeta.units || "unitless"}</strong>
            </div>
            <div>
              <span className="meta-label">Depth</span>
              <strong>{formatCompactNumber(inspectedPatch.depth_m, 0)} m</strong>
            </div>
            <div>
              <span className="meta-label">Grid</span>
              <strong>
                row {inspectedPatch.row}, col {inspectedPatch.col}
              </strong>
            </div>
            <div>
              <span className="meta-label">Lon / Lat</span>
              <strong>
                {formatCompactNumber(inspectedPatch.center_lon_lat[0], 3)},{" "}
                {formatCompactNumber(inspectedPatch.center_lon_lat[1], 3)}
              </strong>
            </div>
            <div>
              <span className="meta-label">Center XYZ</span>
              <strong>
                {formatCompactNumber(inspectedPatch.center_local_xyz_m[0], 0)},{" "}
                {formatCompactNumber(inspectedPatch.center_local_xyz_m[1], 0)},{" "}
                {formatCompactNumber(inspectedPatch.center_local_xyz_m[2], 0)}
              </strong>
            </div>
          </div>
        ) : (
          <p className="panel-note">
            Seleziona una patch dalla scena per leggere valore del campo, profondità e posizione nel
            reticolo della faglia.
          </p>
        )}
      </section>
    </section>
  );
}
