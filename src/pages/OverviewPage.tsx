import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { CircleMarker, GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { MetricCard } from "../components/MetricCard";
import { TimeSeriesChart } from "../components/TimeSeriesChart";
import { loadFaultTrace, loadManifest, loadStations, loadStationTimeseries } from "../lib/api";
import { formatCompactNumber, formatDateLabel } from "../lib/format";
import type { ManifestData, StationsResponse, StationSummary, StationTimeseries } from "../lib/types";

const CATEGORY_COLORS: Record<string, string> = {
  accepted: "#2563eb",
  modified: "#d97706",
  acc_test: "#be123c",
};

const ITALY_BOUNDS = L.latLngBounds(
  [35.2, 6.5],
  [47.3, 18.8],
);

function MapViewportController({
  focusTarget,
  faultGeoJSON,
}: {
  focusTarget: "italy" | "fault";
  faultGeoJSON: GeoJSON.FeatureCollection | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (focusTarget === "fault" && faultGeoJSON) {
      const bounds = L.geoJSON(faultGeoJSON).getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(1.4), { animate: true });
        return;
      }
    }
    map.fitBounds(ITALY_BOUNDS, { animate: true });
  }, [faultGeoJSON, focusTarget, map]);

  return null;
}

export function OverviewPage() {
  const [manifest, setManifest] = useState<ManifestData | null>(null);
  const [stationsPayload, setStationsPayload] = useState<StationsResponse | null>(null);
  const [faultGeoJSON, setFaultGeoJSON] = useState<GeoJSON.FeatureCollection | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedStationId, setSelectedStationId] = useState("");
  const [selectedSeries, setSelectedSeries] = useState<StationTimeseries | null>(null);
  const [search, setSearch] = useState("");
  const [useCleaned, setUseCleaned] = useState(true);
  const [normalized, setNormalized] = useState(false);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [mapFocus, setMapFocus] = useState<"italy" | "fault">("italy");
  const deferredSearch = useDeferredValue(search.trim().toUpperCase());

  useEffect(() => {
    void Promise.all([loadManifest(), loadStations(), loadFaultTrace()])
      .then(([manifestPayload, stationsData, faultTrace]) => {
        setLoadError(null);
        setManifest(manifestPayload);
        setStationsPayload(stationsData);
        setFaultGeoJSON(faultTrace);
        setSelectedStationId(stationsData.default_station_id);
      })
      .catch((error) => {
        console.error("Failed to load overview payloads", error);
        setLoadError("Impossibile caricare i dati iniziali della pagina.");
      });
  }, []);

  useEffect(() => {
    if (!selectedStationId) {
      return;
    }
    setSeriesLoading(true);
    void loadStationTimeseries(selectedStationId)
      .then((payload) => {
        setLoadError(null);
        setSelectedSeries(payload);
      })
      .catch((error) => {
        console.error(`Failed to load station timeseries for ${selectedStationId}`, error);
        setSelectedSeries(null);
        setLoadError(`Impossibile caricare la serie temporale per ${selectedStationId}.`);
      })
      .finally(() => setSeriesLoading(false));
  }, [selectedStationId]);

  const filteredStations = useMemo(() => {
    const stations = stationsPayload?.stations ?? [];
    if (!deferredSearch) {
      return stations;
    }
    return stations.filter((station) => {
      return (
        station.station_id.toUpperCase().includes(deferredSearch) ||
        station.label.toUpperCase().includes(deferredSearch)
      );
    });
  }, [deferredSearch, stationsPayload?.stations]);

  const selectedStation = useMemo(() => {
    return stationsPayload?.stations.find((station) => station.station_id === selectedStationId) ?? null;
  }, [selectedStationId, stationsPayload?.stations]);

  if (loadError && !stationsPayload) {
    return (
      <section className="page-grid overview-grid">
        <section className="panel rise">
          <div className="runtime-error" role="alert">
            <strong>Errore di caricamento.</strong>
            <p>{loadError}</p>
          </div>
        </section>
      </section>
    );
  }

  return (
    <section className="page-grid overview-grid">
      <section className="hero-panel rise">
        <div className="hero-copy">
          <p className="eyebrow">Overview GNSS</p>
          <h2>Mappa Italia, stazioni GNSS e dettaglio della serie selezionata</h2>
          <p>
            La pagina carica solo il tracciato di faglia, i metadati delle stazioni e la singola
            time series richiesta dall&apos;utente.
          </p>
        </div>

        <div className="metric-grid">
          <MetricCard
            label="Stazioni"
            value={
              stationsPayload
                ? formatCompactNumber(stationsPayload.summary.station_count, 0)
                : "…"
            }
            hint="rete GNSS visualizzata sulla mappa Italia"
          />
          <MetricCard
            label="Modelli curati"
            value={manifest ? formatCompactNumber(manifest.summary.models, 0) : "…"}
            hint="subset statico versionato nel repo"
          />
          <MetricCard
            label="Snapshot curate"
            value={manifest ? formatCompactNumber(manifest.summary.snapshots, 0) : "…"}
            hint="caricate lazy dalla pagina 3D"
          />
          <MetricCard
            label="Patch di faglia"
            value={manifest ? formatCompactNumber(manifest.summary.fault_patches, 0) : "…"}
            hint="mesh fisica per la scena modelli"
          />
        </div>
      </section>

      <aside className="panel rise controls-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Filtri stazioni</p>
            <h3>Ricerca e selezione</h3>
          </div>
          <span className="pill-muted">{filteredStations.length} visibili</span>
        </div>

        <label className="field-group">
          <span>Ricerca per station id o label</span>
          <input
            className="text-input"
            type="search"
            placeholder="AQUI00ITA"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <div className="toggle-row">
          <button
            type="button"
            className={mapFocus === "italy" ? "toggle-chip toggle-chip-active" : "toggle-chip"}
            onClick={() => setMapFocus("italy")}
          >
            Focus Italia
          </button>
          <button
            type="button"
            className={mapFocus === "fault" ? "toggle-chip toggle-chip-active" : "toggle-chip"}
            onClick={() => setMapFocus("fault")}
          >
            Focus faglia
          </button>
        </div>

        <div className="category-legend">
          {Object.entries(CATEGORY_COLORS).map(([category, color]) => (
            <div key={category} className="legend-item">
              <span className="legend-swatch" style={{ backgroundColor: color }} />
              <span>{category}</span>
            </div>
          ))}
        </div>

        <div className="station-list">
          {filteredStations.slice(0, 80).map((station) => (
            <button
              key={station.station_id}
              type="button"
              className={
                station.station_id === selectedStationId ? "station-button station-button-active" : "station-button"
              }
              onClick={() => setSelectedStationId(station.station_id)}
            >
              <span>{station.station_id}</span>
              <small>{station.category}</small>
            </button>
          ))}
          {filteredStations.length > 80 ? (
            <p className="panel-note">Mostro solo i primi 80 risultati. Affina la ricerca per restringere.</p>
          ) : null}
        </div>
      </aside>

      <section className="panel rise map-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Mappa regionale</p>
            <h3>Italia GNSS con overlay faglia</h3>
          </div>
          <span className="pill-muted">EPSG:4326</span>
        </div>

        <MapContainer className="map-view" center={[42.7, 12.8]} zoom={6} scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {faultGeoJSON ? (
            <GeoJSON
              data={faultGeoJSON}
              style={{
                color: "#b45309",
                weight: 3,
                opacity: 0.95,
                fillColor: "#f59e0b",
                fillOpacity: 0.12,
              }}
            />
          ) : null}

          {filteredStations.map((station: StationSummary) => (
            <CircleMarker
              key={station.station_id}
              center={[station.latitude, station.longitude]}
              radius={station.station_id === selectedStationId ? 7 : 5}
              pathOptions={{
                color: "#fbfdff",
                weight: station.station_id === selectedStationId ? 2 : 1,
                fillColor: CATEGORY_COLORS[station.category] ?? "#475569",
                fillOpacity: 0.88,
              }}
              eventHandlers={{
                click: () => setSelectedStationId(station.station_id),
              }}
            />
          ))}

          <MapViewportController focusTarget={mapFocus} faultGeoJSON={faultGeoJSON} />
        </MapContainer>
      </section>

      <section className="panel rise station-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Dettaglio stazione</p>
            <h3>{selectedStation?.station_id ?? "Seleziona una stazione"}</h3>
          </div>
          {selectedStation ? <span className="pill-muted">{selectedStation.category}</span> : null}
        </div>

        {selectedStation ? (
          <div className="station-meta-grid">
            <div>
              <span className="meta-label">Range disponibile</span>
              <strong>
                {formatDateLabel(selectedStation.available_date_range.start)} -{" "}
                {formatDateLabel(selectedStation.available_date_range.end)}
              </strong>
            </div>
            <div>
              <span className="meta-label">Samples</span>
              <strong>{formatCompactNumber(selectedStation.sample_count, 0)}</strong>
            </div>
            <div>
              <span className="meta-label">Reference system</span>
              <strong>{selectedStation.reference_system}</strong>
            </div>
            <div>
              <span className="meta-label">Coordinate source</span>
              <strong>{selectedStation.coordinates_source}</strong>
            </div>
            <div>
              <span className="meta-label">Networks</span>
              <strong>{selectedStation.networks || "n/a"}</strong>
            </div>
            <div>
              <span className="meta-label">Distance from L&apos;Aquila</span>
              <strong>
                {selectedStation.distance_km_from_laquila != null
                  ? `${formatCompactNumber(selectedStation.distance_km_from_laquila, 1)} km`
                  : "n/a"}
              </strong>
            </div>
          </div>
        ) : null}

        <div className="toggle-row">
          <button
            type="button"
            className={useCleaned ? "toggle-chip toggle-chip-active" : "toggle-chip"}
            onClick={() => setUseCleaned(true)}
          >
            Cleaned
          </button>
          <button
            type="button"
            className={!useCleaned ? "toggle-chip toggle-chip-active" : "toggle-chip"}
            onClick={() => setUseCleaned(false)}
          >
            Raw
          </button>
          <button
            type="button"
            className={normalized ? "toggle-chip toggle-chip-active" : "toggle-chip"}
            onClick={() => setNormalized((current) => !current)}
          >
            Normalize
          </button>
        </div>

        <div className="chart-shell">
          {loadError && selectedSeries == null ? (
            <div className="runtime-error" role="alert">
              <strong>Serie temporale non disponibile.</strong>
              <p>{loadError}</p>
            </div>
          ) : null}
          {selectedSeries && !seriesLoading ? (
            <TimeSeriesChart series={selectedSeries} useCleaned={useCleaned} normalized={normalized} />
          ) : (
            <div className="loading-state">Loading time series…</div>
          )}
        </div>
      </section>
    </section>
  );
}
