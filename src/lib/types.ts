export interface ManifestData {
  app_title: string;
  generated_at: string;
  defaults: {
    default_station_id: string;
    default_model_key: string;
    default_field_key: string;
  };
  summary: {
    stations: number;
    timeseries: number;
    fault_patches: number;
    models: number;
    snapshots: number;
  };
  sources: {
    config_path: string;
    source_data_dir: string;
  };
}

export interface StationSummary {
  station_id: string;
  label: string;
  category: string;
  reference_system: string;
  latitude: number;
  longitude: number;
  utm_e_m: number;
  utm_n_m: number;
  local_xyz_m?: [number, number, number];
  coordinates_source: string;
  is_fallback_coordinate: boolean;
  networks?: string;
  distance_km_from_laquila?: number | null;
  available_date_range: {
    start: string;
    end: string;
  };
  timeseries_path: string;
  sample_count: number;
  source_file: string;
}

export interface StationsResponse {
  default_station_id: string;
  summary: {
    station_count: number;
    category_counts: Record<string, number>;
    coordinate_source: string;
    real_coordinate_count?: number;
    fallback_coordinate_count?: number;
    total_time_series_samples: number;
  };
  stations: StationSummary[];
}

export interface StationTimeseries {
  station_id: string;
  label: string;
  category: string;
  source_file: string;
  reference_system: string;
  units: {
    displacement: string;
  };
  date_range: {
    start: string;
    end: string;
  };
  has_cleaned: boolean;
  dates: string[];
  raw: {
    E: Array<number | null>;
    N: Array<number | null>;
    U: Array<number | null>;
  };
  cleaned: {
    E: Array<number | null>;
    N: Array<number | null>;
    U: Array<number | null>;
  };
}

export interface FaultPatch {
  id: number;
  row: number;
  col: number;
  center_enu_m: [number, number, number];
  center_local_xyz_m: [number, number, number];
  center_lon_lat: [number, number];
  depth_m: number;
  corners_enu_m: [number, number, number][];
  corners_local_xyz_m: [number, number, number][];
  triangles_enu_m: [number, number, number][][];
  triangles_local_xyz_m: [number, number, number][][];
}

export interface FaultPatchesData {
  meta: {
    patch_count: number;
    triangle_count: number;
    grid: {
      nx: number;
      ny: number;
    };
    utm_epsg: number;
    local_origin_utm_en_m: [number, number];
    fault_meta: {
      strike_deg: number;
      dip_deg: number;
      rake_deg: number;
      top_depth_m: number;
      bottom_depth_m: number;
      length_m: number;
      width_m: number;
      origin_en: [number, number];
    };
    elastic: {
      mu?: number;
      nu?: number;
    };
    notes: Record<string, string>;
  };
  surface_trace_local_xyz_m?: [number, number, number][];
  patches: FaultPatch[];
}

export interface SnapshotFieldMeta {
  label: string;
  units: string;
  color_map: string;
  scale: "linear" | "log" | "symmetric";
  min: number;
  max: number;
}

export interface ModelSummary {
  key: string;
  label: string;
  checkpoint?: string | null;
  snapshot_count: number;
  default_snapshot_key: string;
  time_range: {
    start: string;
    end: string;
  };
  field_keys: string[];
  metrics_summary?: Record<string, number | null | string | Record<string, string | null> | undefined>;
  history_summary?: Record<string, number | null | string | Record<string, string | null> | undefined>;
}

export interface ModelsResponse {
  default_model_key: string;
  default_field_key: string;
  models: ModelSummary[];
}

export interface SnapshotDescriptor {
  date: string;
  date_key: string;
}

export interface ModelDetail extends ModelSummary {
  default_field_key: string;
  fields: Record<string, SnapshotFieldMeta>;
  static_fields?: Record<string, number[]>;
  snapshots: SnapshotDescriptor[];
}

export interface SnapshotData {
  date: string;
  time_seconds: number;
  fields: Record<string, number[]>;
  surface_predictions?: {
    station_ids: string[];
    u_surface_m: [number, number, number][];
    v_surface_m_per_s: [number, number, number][];
  };
}

