import { useEffect, useMemo, useState } from "react";
import { ColorLegend } from "../components/ColorLegend";
import { MetricCard } from "../components/MetricCard";
import {
  loadValidationGeometry,
  loadValidationModelCatalog,
  loadValidationSnapshot,
  loadValidationSnapshotIndex,
} from "../lib/api";
import { colorForValue } from "../lib/colors";
import { formatCompactNumber, formatDateLabel, formatScientific } from "../lib/format";
import type {
  SnapshotFieldMeta,
  ValidationGeometryData,
  ValidationModelCatalog,
  ValidationSnapshotData,
  ValidationSnapshotDescriptor,
  ValidationSnapshotIndex,
} from "../lib/types";

export type FamilyKey = "V1" | "V2" | "V3" | "V4";
export type EpochKey = "final" | "step010000" | "step020000" | "step030000" | "step040000" | "step050000";

interface FamilyConfig {
  originalLabel: string;
  validationLabel: string;
  title: string;
  seed: number;
  regime: "quasi-static" | "dynamic";
  summary: string;
  tauConfig: string;
}

interface EpochOption {
  key: EpochKey;
  label: string;
  modelSuffix: string;
}

export const FAMILY_COMPARE_CONFIG: Record<FamilyKey, FamilyConfig> = {
  V1: {
    originalLabel: "Original_seed42_V_new_quasi_static",
    validationLabel: "Validation__seed_42_V_ref_new_quesi_static",
    title: "Seed 42 - Quasi-static",
    seed: 42,
    regime: "quasi-static",
    summary: "Run con seed 42 in configurazione quasi-statica.",
    tauConfig:
      "Configurazione tau elastica quasi-statica (tau_elastic_qs_pa), con confronto frizionale su tau_rsf_pa.",
  },
  V2: {
    originalLabel: "Original_seed42_V_new_quasi_dynamic",
    validationLabel: "Validation__seed_42_new_V_quasi_dynamic",
    title: "Seed 42 - Dynamic",
    seed: 42,
    regime: "dynamic",
    summary: "Run con seed 42 in configurazione dinamica.",
    tauConfig:
      "Configurazione tau dinamica più ampia: tau_elastic_pa + tau_radiation_pa, con confronto su tau_rsf_pa.",
  },
  V3: {
    originalLabel: "Original_seed7_V_new_quasi_static",
    validationLabel: "Validation_seed_7_V_ref_new_quesi_static",
    title: "Seed 7 - Quasi-static",
    seed: 7,
    regime: "quasi-static",
    summary: "Run con seed 7 in configurazione quasi-statica.",
    tauConfig:
      "Configurazione tau elastica quasi-statica (tau_elastic_qs_pa), con confronto frizionale su tau_rsf_pa.",
  },
  V4: {
    originalLabel: "Original_seed7_V_new_quasi_dynamic",
    validationLabel: "Validation_seed_7_V_ref_new_quasi_dynamic",
    title: "Seed 7 - Dynamic",
    seed: 7,
    regime: "dynamic",
    summary: "Run con seed 7 in configurazione dinamica.",
    tauConfig:
      "Configurazione tau dinamica più ampia: tau_elastic_pa + tau_radiation_pa, con confronto su tau_rsf_pa.",
  },
};

export const EPOCH_OPTIONS: EpochOption[] = [
  { key: "final", label: "Finale", modelSuffix: "" },
  { key: "step010000", label: "10 000", modelSuffix: " / model.step010000" },
  { key: "step020000", label: "20 000", modelSuffix: " / model.step020000" },
  { key: "step030000", label: "30 000", modelSuffix: " / model.step030000" },
  { key: "step040000", label: "40 000", modelSuffix: " / model.step040000" },
  { key: "step050000", label: "50 000", modelSuffix: " / model.step050000" },
];

const FIELD_PRIORITY = [
  "slip_m",
  "delta_slip_m",
  "slip_rate_m_per_s",
  "theta_s",
  "a",
  "b",
  "a_minus_b",
  "tau_rsf_pa",
  "tau_elastic_pa",
  "tau_elastic_qs_pa",
  "tau_radiation_pa",
  "tau_residual_over_sigma_n",
  "aging_residual",
  "D_c_m",
];

const PLACE_MARKERS = [
  { label: "L'Aquila", color: "rgba(12, 44, 132, 0.82)" },
  { label: "Preturo", color: "rgba(146, 64, 14, 0.82)" },
  { label: "Pizzoli", color: "rgba(21, 128, 61, 0.82)" },
] as const;

interface FamilyModelKeys {
  originalKey: string;
  validationKey: string;
}

interface FaultPlotProps {
  title: string;
  geometry: ValidationGeometryData | null;
  fieldMeta: SnapshotFieldMeta | null;
  values: number[];
  globalLengthExtent: [number, number] | null;
  lengthOffsetKm: number;
  hoveredPatchId: number | null;
  selectedPatchId: number | null;
  onHoverPatch: (patchId: number | null) => void;
  onSelectPatch: (patchId: number | null) => void;
  testId: string;
}

function normalizeLabel(label: string) {
  return label.trim().replace(/\s+/g, " ").toLowerCase();
}

function findModelKeyByLabel(catalog: ValidationModelCatalog, expectedLabel: string) {
  const expected = normalizeLabel(expectedLabel);
  const matched = catalog.models.find((model) => normalizeLabel(model.label) === expected);
  return matched?.key ?? null;
}

function findEpochOption(epochKey: EpochKey) {
  return EPOCH_OPTIONS.find((option) => option.key === epochKey) ?? EPOCH_OPTIONS[0];
}

function buildModelLabel(baseLabel: string, epochKey: EpochKey) {
  return `${baseLabel}${findEpochOption(epochKey).modelSuffix}`;
}

export function resolveFamilyModelKeys(
  catalog: ValidationModelCatalog,
  familyKey: FamilyKey,
  epochKey: EpochKey,
): FamilyModelKeys | null {
  const family = FAMILY_COMPARE_CONFIG[familyKey];
  const originalKey = findModelKeyByLabel(catalog, buildModelLabel(family.originalLabel, epochKey));
  const validationKey = findModelKeyByLabel(catalog, buildModelLabel(family.validationLabel, epochKey));

  if (!originalKey || !validationKey) {
    return null;
  }

  return { originalKey, validationKey };
}

function findReferenceLength(geometry: ValidationGeometryData | null, placeLabel: string) {
  if (!geometry) {
    return null;
  }
  const expected = normalizeLabel(placeLabel);
  const place = geometry.reference_places.find((entry) => normalizeLabel(entry.label) === expected);
  return place?.projected_length_km ?? null;
}

export function computeOriginalOffsetKm(
  validationGeometry: ValidationGeometryData | null,
  originalGeometry: ValidationGeometryData | null,
) {
  if (!validationGeometry || !originalGeometry) {
    return 0;
  }

  const validationLquila = findReferenceLength(validationGeometry, "L'Aquila");
  const originalLquila = findReferenceLength(originalGeometry, "L'Aquila");

  if (validationLquila != null && originalLquila != null) {
    return validationLquila - originalLquila;
  }

  const [validationMin, validationMax] = validationGeometry.meta.length_extent_km;
  const [originalMin, originalMax] = originalGeometry.meta.length_extent_km;
  return (validationMin + validationMax) / 2 - (originalMin + originalMax) / 2;
}

function intersectFieldKeys(
  validationIndex: ValidationSnapshotIndex | null,
  originalIndex: ValidationSnapshotIndex | null,
) {
  if (!validationIndex || !originalIndex) {
    return [] as string[];
  }

  const originalFields = new Set(Object.keys(originalIndex.fields));
  return Object.keys(validationIndex.fields).filter((fieldKey) => originalFields.has(fieldKey));
}

function fieldSortKey(fieldKey: string) {
  const priorityIndex = FIELD_PRIORITY.indexOf(fieldKey);
  return priorityIndex === -1 ? Number.POSITIVE_INFINITY : priorityIndex;
}

function sortFieldKeys(
  fieldKeys: string[],
  validationIndex: ValidationSnapshotIndex | null,
  originalIndex: ValidationSnapshotIndex | null,
) {
  return [...fieldKeys].sort((left, right) => {
    const leftPriority = fieldSortKey(left);
    const rightPriority = fieldSortKey(right);
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    const leftLabel = validationIndex?.fields[left]?.label ?? originalIndex?.fields[left]?.label ?? left;
    const rightLabel = validationIndex?.fields[right]?.label ?? originalIndex?.fields[right]?.label ?? right;
    return leftLabel.localeCompare(rightLabel);
  });
}

function intersectSnapshots(
  validationIndex: ValidationSnapshotIndex | null,
  originalIndex: ValidationSnapshotIndex | null,
) {
  if (!validationIndex || !originalIndex) {
    return [] as ValidationSnapshotDescriptor[];
  }

  const originalByKey = new Map(originalIndex.snapshots.map((snapshot) => [snapshot.date_key, snapshot]));
  return validationIndex.snapshots.filter((snapshot) => originalByKey.has(snapshot.date_key));
}

export function buildSharedFieldMeta(
  baseMeta: SnapshotFieldMeta,
  validationValues: number[],
  originalValues: number[],
): SnapshotFieldMeta {
  const values = [...validationValues, ...originalValues].filter((value) => Number.isFinite(value));
  if (values.length === 0) {
    return baseMeta;
  }

  if (baseMeta.scale === "symmetric") {
    const maxAbs = Math.max(...values.map((value) => Math.abs(value)), 1e-12);
    return {
      ...baseMeta,
      min: -maxAbs,
      max: maxAbs,
    };
  }

  if (baseMeta.scale === "log") {
    const positiveValues = values.filter((value) => value > 0);
    if (positiveValues.length === 0) {
      return baseMeta;
    }
    const min = Math.min(...positiveValues);
    const max = Math.max(...positiveValues);
    if (min === max) {
      return {
        ...baseMeta,
        min,
        max: min * 10,
      };
    }
    return {
      ...baseMeta,
      min,
      max,
    };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    const pad = Math.max(Math.abs(min) * 0.05, 1e-12);
    return {
      ...baseMeta,
      min: min - pad,
      max: max + pad,
    };
  }

  return {
    ...baseMeta,
    min,
    max,
  };
}

function resolvePatch(
  geometry: ValidationGeometryData | null,
  selectedPatchId: number | null,
  hoveredPatchId: number | null,
) {
  if (!geometry) {
    return null;
  }
  const patchId = hoveredPatchId ?? selectedPatchId;
  if (patchId == null) {
    return null;
  }
  return geometry.patches.find((patch) => patch.id === patchId) ?? null;
}

function FaultPlot({
  title,
  geometry,
  fieldMeta,
  values,
  globalLengthExtent,
  lengthOffsetKm,
  hoveredPatchId,
  selectedPatchId,
  onHoverPatch,
  onSelectPatch,
  testId,
}: FaultPlotProps) {
  if (!geometry || !fieldMeta || !globalLengthExtent) {
    return <div className="loading-state">Loading panel...</div>;
  }

  const [globalMinLength, globalMaxLength] = globalLengthExtent;
  const [minDepth, maxDepth] = geometry.meta.depth_extent_km;

  const viewWidth = 1240;
  const viewHeight = 320;
  const paddingLeft = 58;
  const paddingRight = 24;
  const paddingTop = 24;
  const paddingBottom = 40;
  const drawWidth = viewWidth - paddingLeft - paddingRight;
  const drawHeight = viewHeight - paddingTop - paddingBottom;

  const xDenominator = Math.max(globalMaxLength - globalMinLength, 1e-9);
  const depthDenominator = Math.max(maxDepth - minDepth, 1e-9);

  const xScale = (value: number) => paddingLeft + ((value - globalMinLength) / xDenominator) * drawWidth;
  const depthScale = (depth: number) => paddingTop + ((depth - minDepth) / depthDenominator) * drawHeight;
  const midDepthY = depthScale((minDepth + maxDepth) / 2);
  const midLengthX = xScale((globalMinLength + globalMaxLength) / 2);
  const placeMarkers = PLACE_MARKERS.map((place) => {
    const placeLength = findReferenceLength(geometry, place.label);
    return {
      ...place,
      x: placeLength == null ? null : xScale(placeLength + lengthOffsetKm),
    };
  });

  return (
    <div className="fault-compare-card">
      <div className="fault-compare-head">
        <h4>{title}</h4>
        <span className="pill-muted">
          {formatCompactNumber(geometry.meta.patch_count, 0)} patch | L={formatCompactNumber(geometry.meta.length_extent_km[1], 2)} km
        </span>
      </div>
      <div className="fault-compare-shell">
        <svg
          data-testid={testId}
          className="fault-compare-svg"
          viewBox={`0 0 ${viewWidth} ${viewHeight}`}
          role="img"
          aria-label={`${title} fault panel`}
          onMouseLeave={() => onHoverPatch(null)}
        >
          <rect x={0} y={0} width={viewWidth} height={viewHeight} fill="#f4f1ea" />
          <rect
            x={paddingLeft}
            y={paddingTop}
            width={drawWidth}
            height={drawHeight}
            rx={18}
            fill="#e9e4d7"
            stroke="rgba(24, 33, 43, 0.16)"
          />

          {geometry.patches.map((patch) => {
            const points = patch.polygon_length_depth_km
              .map(([lengthKm, depthKm]) => `${xScale(lengthKm + lengthOffsetKm)},${depthScale(depthKm)}`)
              .join(" ");
            const patchValue = values[patch.id] ?? Number.NaN;
            const active = patch.id === hoveredPatchId || patch.id === selectedPatchId;
            return (
              <polygon
                key={patch.id}
                points={points}
                fill={colorForValue(patchValue, fieldMeta)}
                stroke={active ? "#f8fafc" : "rgba(24, 33, 43, 0.15)"}
                strokeWidth={active ? 2.1 : 0.85}
                vectorEffect="non-scaling-stroke"
                onMouseEnter={() => onHoverPatch(patch.id)}
                onClick={() => onSelectPatch(patch.id)}
              />
            );
          })}

          <line
            x1={paddingLeft}
            y1={midDepthY}
            x2={paddingLeft + drawWidth}
            y2={midDepthY}
            className="fault-guide-line"
          />
          <line
            x1={midLengthX}
            y1={paddingTop}
            x2={midLengthX}
            y2={paddingTop + drawHeight}
            className="fault-guide-line"
          />

          {placeMarkers.map((place, index) =>
            place.x == null ? null : (
              <g key={place.label}>
                <line
                  x1={place.x}
                  y1={paddingTop}
                  x2={place.x}
                  y2={paddingTop + drawHeight}
                  stroke={place.color}
                  strokeDasharray="7 5"
                  strokeWidth={1.5}
                />
                <text
                  x={place.x + 6}
                  y={paddingTop + 16 + index * 13}
                  className="fault-marker-label"
                  style={{ fill: place.color }}
                >
                  {place.label}
                </text>
              </g>
            ),
          )}

          <text x={paddingLeft} y={viewHeight - 8} className="fault-axis-label">
            Along fault (km)
          </text>
          <text x={8} y={paddingTop + 14} className="fault-axis-label">
            Depth (km)
          </text>
        </svg>
      </div>
    </div>
  );
}

export function ModelsPage() {
  const [catalog, setCatalog] = useState<ValidationModelCatalog | null>(null);
  const [selectedFamily, setSelectedFamily] = useState<FamilyKey>("V1");
  const [selectedEpoch, setSelectedEpoch] = useState<EpochKey>("final");

  const [validationGeometry, setValidationGeometry] = useState<ValidationGeometryData | null>(null);
  const [validationIndex, setValidationIndex] = useState<ValidationSnapshotIndex | null>(null);
  const [validationSnapshot, setValidationSnapshot] = useState<ValidationSnapshotData | null>(null);

  const [originalGeometry, setOriginalGeometry] = useState<ValidationGeometryData | null>(null);
  const [originalIndex, setOriginalIndex] = useState<ValidationSnapshotIndex | null>(null);
  const [originalSnapshot, setOriginalSnapshot] = useState<ValidationSnapshotData | null>(null);

  const [selectedFieldKey, setSelectedFieldKey] = useState("");
  const [selectedSnapshotKey, setSelectedSnapshotKey] = useState("");

  const [hoveredValidationPatchId, setHoveredValidationPatchId] = useState<number | null>(null);
  const [selectedValidationPatchId, setSelectedValidationPatchId] = useState<number | null>(null);
  const [hoveredOriginalPatchId, setHoveredOriginalPatchId] = useState<number | null>(null);
  const [selectedOriginalPatchId, setSelectedOriginalPatchId] = useState<number | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadValidationModelCatalog()
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setCatalog(payload);
        setLoadError(null);
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setLoadError(error.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const familyKeys = useMemo(() => Object.keys(FAMILY_COMPARE_CONFIG) as FamilyKey[], []);

  const selectedPair = useMemo(() => {
    if (!catalog) {
      return null;
    }
    return resolveFamilyModelKeys(catalog, selectedFamily, selectedEpoch);
  }, [catalog, selectedEpoch, selectedFamily]);

  useEffect(() => {
    if (!catalog) {
      return;
    }

    if (!selectedPair) {
      setLoadError(`Pair not available for ${selectedFamily} ${selectedEpoch}.`);
      setValidationGeometry(null);
      setValidationIndex(null);
      setOriginalGeometry(null);
      setOriginalIndex(null);
      return;
    }

    setModelsLoading(true);
    setValidationSnapshot(null);
    setOriginalSnapshot(null);
    setHoveredValidationPatchId(null);
    setHoveredOriginalPatchId(null);

    let cancelled = false;

    Promise.all([
      loadValidationGeometry(selectedPair.validationKey),
      loadValidationSnapshotIndex(selectedPair.validationKey),
      loadValidationGeometry(selectedPair.originalKey),
      loadValidationSnapshotIndex(selectedPair.originalKey),
    ])
      .then(([validationGeometryPayload, validationIndexPayload, originalGeometryPayload, originalIndexPayload]) => {
        if (cancelled) {
          return;
        }

        setValidationGeometry(validationGeometryPayload);
        setValidationIndex(validationIndexPayload);
        setOriginalGeometry(originalGeometryPayload);
        setOriginalIndex(originalIndexPayload);

        const sharedFields = sortFieldKeys(
          intersectFieldKeys(validationIndexPayload, originalIndexPayload),
          validationIndexPayload,
          originalIndexPayload,
        );
        const sharedSnapshots = intersectSnapshots(validationIndexPayload, originalIndexPayload);

        setSelectedFieldKey((current) =>
          sharedFields.includes(current) ? current : (sharedFields[0] ?? ""),
        );

        setSelectedSnapshotKey((current) => {
          const available = new Set(sharedSnapshots.map((snapshot) => snapshot.date_key));
          if (available.has(current)) {
            return current;
          }
          return sharedSnapshots[sharedSnapshots.length - 1]?.date_key ?? "";
        });

        setSelectedValidationPatchId(
          validationGeometryPayload.patches[Math.floor(validationGeometryPayload.patches.length / 2)]?.id ?? null,
        );
        setSelectedOriginalPatchId(
          originalGeometryPayload.patches[Math.floor(originalGeometryPayload.patches.length / 2)]?.id ?? null,
        );

        setLoadError(null);
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setLoadError(error.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setModelsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [catalog, selectedPair, selectedFamily, selectedEpoch]);

  useEffect(() => {
    if (!selectedPair || !selectedSnapshotKey) {
      return;
    }

    setSnapshotLoading(true);
    let cancelled = false;

    Promise.all([
      loadValidationSnapshot(selectedPair.validationKey, selectedSnapshotKey),
      loadValidationSnapshot(selectedPair.originalKey, selectedSnapshotKey),
    ])
      .then(([validationSnapshotPayload, originalSnapshotPayload]) => {
        if (cancelled) {
          return;
        }
        setValidationSnapshot(validationSnapshotPayload);
        setOriginalSnapshot(originalSnapshotPayload);
        setLoadError(null);
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setLoadError(error.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSnapshotLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPair, selectedSnapshotKey]);

  const sharedFieldKeys = useMemo(
    () => sortFieldKeys(intersectFieldKeys(validationIndex, originalIndex), validationIndex, originalIndex),
    [validationIndex, originalIndex],
  );

  const sharedSnapshots = useMemo(
    () => intersectSnapshots(validationIndex, originalIndex),
    [validationIndex, originalIndex],
  );

  const selectedSnapshot = useMemo(
    () => sharedSnapshots.find((snapshot) => snapshot.date_key === selectedSnapshotKey) ?? null,
    [selectedSnapshotKey, sharedSnapshots],
  );

  const selectedSnapshotIndex = useMemo(() => {
    if (sharedSnapshots.length === 0) {
      return 0;
    }
    return Math.max(0, sharedSnapshots.findIndex((snapshot) => snapshot.date_key === selectedSnapshotKey));
  }, [selectedSnapshotKey, sharedSnapshots]);

  const baseFieldMeta =
    validationIndex?.fields[selectedFieldKey] ?? originalIndex?.fields[selectedFieldKey] ?? null;

  const validationValues = validationSnapshot?.fields[selectedFieldKey] ?? [];
  const originalValues = originalSnapshot?.fields[selectedFieldKey] ?? [];

  const sharedFieldMeta = useMemo(() => {
    if (!baseFieldMeta) {
      return null;
    }
    return buildSharedFieldMeta(baseFieldMeta, validationValues, originalValues);
  }, [baseFieldMeta, originalValues, validationValues]);

  const originalOffsetKm = useMemo(
    () => computeOriginalOffsetKm(validationGeometry, originalGeometry),
    [validationGeometry, originalGeometry],
  );

  const globalLengthExtent = useMemo(() => {
    if (!validationGeometry || !originalGeometry) {
      return null;
    }

    const [validationMin, validationMax] = validationGeometry.meta.length_extent_km;
    const [originalMin, originalMax] = originalGeometry.meta.length_extent_km;

    return [
      Math.min(validationMin, originalMin + originalOffsetKm),
      Math.max(validationMax, originalMax + originalOffsetKm),
    ] as [number, number];
  }, [originalGeometry, originalOffsetKm, validationGeometry]);

  const validationPatch = useMemo(
    () => resolvePatch(validationGeometry, selectedValidationPatchId, hoveredValidationPatchId),
    [hoveredValidationPatchId, selectedValidationPatchId, validationGeometry],
  );

  const originalPatch = useMemo(
    () => resolvePatch(originalGeometry, selectedOriginalPatchId, hoveredOriginalPatchId),
    [hoveredOriginalPatchId, originalGeometry, selectedOriginalPatchId],
  );

  const validationPatchValue =
    validationPatch && validationPatch.id < validationValues.length
      ? validationValues[validationPatch.id]
      : null;

  const originalPatchValue =
    originalPatch && originalPatch.id < originalValues.length ? originalValues[originalPatch.id] : null;

  const controlsDisabled = !catalog || !validationIndex || !originalIndex || !selectedPair;

  return (
    <section className="page-grid models-grid compare-grid">
      <section className="hero-panel rise">
        <div className="hero-copy">
          <p className="eyebrow">Confronto V1-V4</p>
          <h2>Validation sopra, Original sotto, con scala colori unica condivisa</h2>
          <p>
            Scegli famiglia, epoca, campo e snapshot: i due pannelli restano sincronizzati e l'Original viene
            allineata in lunghezza usando il riferimento di L'Aquila.
          </p>
        </div>

        <div className="metric-grid">
          <MetricCard label="Famiglie" value={formatCompactNumber(familyKeys.length, 0)} hint="V1, V2, V3, V4" />
          <MetricCard label="Epoche" value={formatCompactNumber(EPOCH_OPTIONS.length, 0)} hint="finale + step 10k..50k" />
          <MetricCard
            label="Campi condivisi"
            value={formatCompactNumber(sharedFieldKeys.length, 0)}
            hint="intersezione Original/Validation"
          />
          <MetricCard
            label="Snapshot condivisi"
            value={formatCompactNumber(sharedSnapshots.length, 0)}
            hint="selettore unico data"
          />
        </div>
      </section>

      <aside className="panel rise controls-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Controlli compare</p>
            <h3>Famiglia + epoca sincronizzate</h3>
          </div>
          {selectedPair ? <span className="pill-muted">{selectedFamily}</span> : null}
        </div>

        <label className="field-group">
          <span>Famiglia</span>
          <select
            className="select-input"
            value={selectedFamily}
            onChange={(event) => setSelectedFamily(event.target.value as FamilyKey)}
            aria-label="Famiglia"
          >
            {familyKeys.map((familyKey) => (
              <option key={familyKey} value={familyKey}>
                {familyKey}
              </option>
            ))}
          </select>
        </label>

        <label className="field-group">
          <span>Epoca</span>
          <select
            className="select-input"
            value={selectedEpoch}
            onChange={(event) => setSelectedEpoch(event.target.value as EpochKey)}
            aria-label="Epoca"
          >
            {EPOCH_OPTIONS.map((epoch) => (
              <option key={epoch.key} value={epoch.key}>
                {epoch.label}
              </option>
            ))}
          </select>
        </label>

        <div className="family-info-block">
          <span className="meta-label">Info run V1-V4 (seed + configurazione)</span>
          <div className="family-info-grid">
            {familyKeys.map((familyKey) => {
              const family = FAMILY_COMPARE_CONFIG[familyKey];
              const active = selectedFamily === familyKey;
              return (
                <article
                  key={familyKey}
                  className={active ? "family-info-card family-info-card-active" : "family-info-card"}
                >
                  <h4>{familyKey}</h4>
                  <p className="family-info-title">{family.title}</p>
                  <p>
                    Seed: <strong>{family.seed}</strong> | Regime: <strong>{family.regime}</strong>
                  </p>
                  <p>{family.summary}</p>
                  <p>{family.tauConfig}</p>
                </article>
              );
            })}
          </div>
        </div>

        <label className="field-group">
          <span>Campo fisico</span>
          <select
            className="select-input"
            value={selectedFieldKey}
            onChange={(event) => setSelectedFieldKey(event.target.value)}
            disabled={controlsDisabled}
            aria-label="Campo fisico"
          >
            {sharedFieldKeys.map((fieldKey) => {
              const label = validationIndex?.fields[fieldKey]?.label ?? originalIndex?.fields[fieldKey]?.label ?? fieldKey;
              return (
                <option key={fieldKey} value={fieldKey}>
                  {label}
                </option>
              );
            })}
          </select>
        </label>

        <label className="field-group">
          <span>Snapshot</span>
          <select
            className="select-input"
            value={selectedSnapshotKey}
            onChange={(event) => setSelectedSnapshotKey(event.target.value)}
            disabled={controlsDisabled || sharedSnapshots.length === 0}
            aria-label="Snapshot"
          >
            {sharedSnapshots.map((snapshot) => (
              <option key={snapshot.date_key} value={snapshot.date_key}>
                {formatDateLabel(snapshot.date)}
              </option>
            ))}
          </select>
        </label>

        <label className="field-group">
          <span>Barra snapshot</span>
          <input
            className="slider-input"
            type="range"
            min={0}
            max={Math.max(sharedSnapshots.length - 1, 0)}
            step={1}
            value={selectedSnapshotIndex}
            aria-label="Barra snapshot"
            disabled={controlsDisabled || sharedSnapshots.length === 0}
            onChange={(event) => {
              const snapshot = sharedSnapshots[Number(event.target.value)];
              if (snapshot) {
                setSelectedSnapshotKey(snapshot.date_key);
              }
            }}
          />
          <span className="meta-label">
            {selectedSnapshot ? formatDateLabel(selectedSnapshot.date) : "n/a"}
          </span>
        </label>

        <div className="detail-stack">
          <div className="detail-card">
            <span className="meta-label">Model key Validation</span>
            <strong data-testid="validation-model-key">{selectedPair?.validationKey ?? "n/a"}</strong>
          </div>
          <div className="detail-card">
            <span className="meta-label">Model key Original</span>
            <strong data-testid="original-model-key">{selectedPair?.originalKey ?? "n/a"}</strong>
          </div>
          <div className="detail-card">
            <span className="meta-label">Offset Original (km)</span>
            <strong data-testid="alignment-offset-km">{formatCompactNumber(originalOffsetKm, 6)}</strong>
          </div>
          <div className="detail-card">
            <span className="meta-label">Scale range condiviso</span>
            <strong data-testid="shared-scale-range">
              {sharedFieldMeta ? `${sharedFieldMeta.min}|${sharedFieldMeta.max}` : "n/a"}
            </strong>
          </div>
          <div className="detail-card">
            <span className="meta-label">Stato loading</span>
            <strong>{modelsLoading || snapshotLoading ? "Loading..." : "Ready"}</strong>
          </div>
        </div>

        {sharedFieldMeta ? <ColorLegend meta={sharedFieldMeta} /> : null}

        {loadError ? <p className="panel-note">{loadError}</p> : null}
      </aside>

      <section className="panel rise scene-panel compare-scene-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Confronto fault</p>
            <h3>Validation (top) + Original allineata (bottom)</h3>
          </div>
          {snapshotLoading ? <span className="pill-muted">Loading snapshot...</span> : null}
        </div>

        <div className="compare-scene-stack">
          <FaultPlot
            title="Validation"
            geometry={validationGeometry}
            fieldMeta={sharedFieldMeta}
            values={validationValues}
            globalLengthExtent={globalLengthExtent}
            lengthOffsetKm={0}
            hoveredPatchId={hoveredValidationPatchId}
            selectedPatchId={selectedValidationPatchId}
            onHoverPatch={setHoveredValidationPatchId}
            onSelectPatch={setSelectedValidationPatchId}
            testId="validation-fault-canvas"
          />

          <FaultPlot
            title="Original"
            geometry={originalGeometry}
            fieldMeta={sharedFieldMeta}
            values={originalValues}
            globalLengthExtent={globalLengthExtent}
            lengthOffsetKm={originalOffsetKm}
            hoveredPatchId={hoveredOriginalPatchId}
            selectedPatchId={selectedOriginalPatchId}
            onHoverPatch={setHoveredOriginalPatchId}
            onSelectPatch={setSelectedOriginalPatchId}
            testId="original-fault-canvas"
          />
        </div>
      </section>

      <section className="panel rise patch-panel compare-inspector-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Inspector</p>
            <h3>Patch hover/click side-by-side</h3>
          </div>
          {selectedFieldKey ? <span className="pill-muted">{selectedFieldKey}</span> : null}
        </div>

        <div className="compare-inspector-grid">
          <div className="compare-inspector-card">
            <h4>Validation</h4>
            {validationPatch && sharedFieldMeta ? (
              <div className="station-meta-grid">
                <div>
                  <span className="meta-label">Patch</span>
                  <strong>{validationPatch.id}</strong>
                </div>
                <div>
                  <span className="meta-label">Value</span>
                  <strong>{validationPatchValue != null ? formatScientific(validationPatchValue) : "n/a"}</strong>
                </div>
                <div>
                  <span className="meta-label">Center (L,D)</span>
                  <strong>
                    {formatCompactNumber(validationPatch.center_length_km, 3)}, {formatCompactNumber(validationPatch.center_depth_km, 3)}
                  </strong>
                </div>
                <div>
                  <span className="meta-label">Units</span>
                  <strong>{sharedFieldMeta.units || "unitless"}</strong>
                </div>
              </div>
            ) : (
              <p className="panel-note">Hover o click su una patch del pannello Validation.</p>
            )}
          </div>

          <div className="compare-inspector-card">
            <h4>Original</h4>
            {originalPatch && sharedFieldMeta ? (
              <div className="station-meta-grid">
                <div>
                  <span className="meta-label">Patch</span>
                  <strong>{originalPatch.id}</strong>
                </div>
                <div>
                  <span className="meta-label">Value</span>
                  <strong>{originalPatchValue != null ? formatScientific(originalPatchValue) : "n/a"}</strong>
                </div>
                <div>
                  <span className="meta-label">Center (L,D)</span>
                  <strong>
                    {formatCompactNumber(originalPatch.center_length_km + originalOffsetKm, 3)}, {formatCompactNumber(originalPatch.center_depth_km, 3)}
                  </strong>
                </div>
                <div>
                  <span className="meta-label">Units</span>
                  <strong>{sharedFieldMeta.units || "unitless"}</strong>
                </div>
              </div>
            ) : (
              <p className="panel-note">Hover o click su una patch del pannello Original.</p>
            )}
          </div>
        </div>
      </section>
    </section>
  );
}
