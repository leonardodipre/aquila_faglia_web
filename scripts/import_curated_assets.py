from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG_PATH = ROOT_DIR / "config" / "curation.json"
DEFAULT_OUTPUT_DIR = ROOT_DIR / "data"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import a curated subset of static assets for the web app.")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG_PATH))
    parser.add_argument("--source-data-dir", default=None)
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    return parser.parse_args()


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=True) + "\n", encoding="utf-8")


def resolve_path(raw_path: str | None, *, relative_to: Path) -> Path:
    if raw_path is None:
        raise ValueError("Missing required path.")
    candidate = Path(raw_path)
    if not candidate.is_absolute():
        candidate = (relative_to / candidate).resolve()
    return candidate


def reset_output_dir(output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    for child in ("timeseries", "models", "model_snapshots", "validation"):
        target = output_dir / child
        if target.exists():
            shutil.rmtree(target)
    for file_name in ("manifest.json", "stations.json", "fault.geojson", "fault_patches.json"):
        target = output_dir / file_name
        if target.exists():
            target.unlink()


def select_model_entry(source_catalog: dict[str, Any], model_key: str) -> dict[str, Any]:
    for model in source_catalog["models"]:
        if model["key"] == model_key:
            return model
    raise KeyError(f"Model '{model_key}' not found in source catalog.")


def relative_manifest_path(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT_DIR))
    except ValueError:
        return path.name


def resolve_snapshot_keys(
    model_config: dict[str, Any],
    snapshots_by_key: dict[str, Any],
    snapshot_strategy: dict[str, Any] | None,
) -> list[str]:
    if model_config.get("snapshot_keys"):
        return list(model_config["snapshot_keys"])

    if not snapshot_strategy:
        raise KeyError(f"No snapshot selection configured for model '{model_config['key']}'.")

    if snapshot_strategy.get("mode") != "yearly_jan":
        raise ValueError(f"Unsupported snapshot strategy: {snapshot_strategy.get('mode')}")

    start_year = int(snapshot_strategy["start_year"])
    end_year = int(snapshot_strategy["end_year"])
    selected = [f"{year}-01-01" for year in range(start_year, end_year + 1)]
    missing = [snapshot_key for snapshot_key in selected if snapshot_key not in snapshots_by_key]
    if missing:
        raise KeyError(f"Snapshot keys {missing} missing for model '{model_config['key']}'.")
    return selected


def import_curated_assets(config_path: Path, source_data_dir: Path, output_dir: Path) -> dict[str, Any]:
    config = load_json(config_path)
    field_allowlist = config.get("field_allowlist")
    field_overrides = config.get("field_overrides", {})
    snapshot_strategy = config.get("snapshot_strategy")
    source_catalog = load_json(source_data_dir / "models" / "index.json")
    validation_catalog = load_json(source_data_dir / "validation" / "models" / "index.json")
    stations_payload = load_json(source_data_dir / "stations.json")
    fault_trace = load_json(source_data_dir / "fault.geojson")
    fault_patches = load_json(source_data_dir / "fault_patches.json")

    station_ids = {station["station_id"] for station in stations_payload["stations"]}
    if config["default_station_id"] not in station_ids:
        raise KeyError(f"Default station '{config['default_station_id']}' is not present in the source dataset.")

    reset_output_dir(output_dir)
    normalized_stations_payload = {
        **stations_payload,
        "stations": [
            {
                **station,
                "timeseries_path": f"timeseries/{station['station_id']}.json",
            }
            for station in stations_payload["stations"]
        ],
    }
    write_json(output_dir / "stations.json", normalized_stations_payload)
    write_json(output_dir / "fault.geojson", fault_trace)
    write_json(output_dir / "fault_patches.json", fault_patches)
    shutil.copytree(source_data_dir / "validation" / "models", output_dir / "validation" / "models")

    timeseries_count = 0
    for station in stations_payload["stations"]:
        station_id = station["station_id"]
        source_path = source_data_dir / "timeseries" / f"{station_id}.json"
        if not source_path.exists():
            raise FileNotFoundError(f"Missing time series for station '{station_id}'.")
        write_json(output_dir / "timeseries" / f"{station_id}.json", load_json(source_path))
        timeseries_count += 1

    curated_models: list[dict[str, Any]] = []
    total_snapshots = 0

    for model_config in config["models"]:
        model_key = model_config["key"]
        source_model = select_model_entry(source_catalog, model_key)
        source_index = load_json(source_data_dir / "model_snapshots" / model_key / "index.json")
        field_keys = list(source_index["fields"].keys())
        if field_allowlist:
            missing_fields = [field_key for field_key in field_allowlist if field_key not in source_index["fields"]]
            if missing_fields:
                raise KeyError(f"Fields {missing_fields} are not available for model '{model_key}'.")
            field_keys = [field_key for field_key in field_allowlist if field_key in source_index["fields"]]
        if config["default_field_key"] not in field_keys:
            raise KeyError(
                f"Default field '{config['default_field_key']}' is not available for model '{model_key}'."
            )

        curated_fields = {}
        for field_key in field_keys:
            curated_fields[field_key] = {
                **source_index["fields"][field_key],
                **field_overrides.get(field_key, {}),
            }

        curated_static_fields = None
        if source_index.get("static_fields"):
            curated_static_fields = {
                field_key: source_index["static_fields"][field_key]
                for field_key in field_keys
                if field_key in source_index["static_fields"]
            }

        snapshots_by_key = {snapshot["date_key"]: snapshot for snapshot in source_index["snapshots"]}
        snapshot_keys = resolve_snapshot_keys(model_config, snapshots_by_key, snapshot_strategy)
        selected_snapshots = []
        for snapshot_key in snapshot_keys:
            if snapshot_key not in snapshots_by_key:
                raise KeyError(f"Snapshot '{snapshot_key}' missing for model '{model_key}'.")
            source_snapshot = snapshots_by_key[snapshot_key]
            source_snapshot_path = source_data_dir / "model_snapshots" / model_key / f"{snapshot_key}.json"
            if not source_snapshot_path.exists():
                raise FileNotFoundError(f"Missing snapshot file '{source_snapshot_path}'.")
            snapshot_payload = load_json(source_snapshot_path)
            write_json(
                output_dir / "model_snapshots" / model_key / f"{snapshot_key}.json",
                {
                    **snapshot_payload,
                    "fields": {
                        field_key: snapshot_payload["fields"][field_key]
                        for field_key in field_keys
                        if field_key in snapshot_payload["fields"]
                    },
                },
            )
            selected_snapshots.append(
                {
                    "date": source_snapshot["date"],
                    "date_key": source_snapshot["date_key"],
                }
            )

        curated_index = {
            "meta": {
                **source_index["meta"],
                "model_key": model_key,
                "model_label": model_config.get("label") or source_model["label"],
                "snapshot_count": len(selected_snapshots),
            },
            "fields": curated_fields,
            "static_fields": curated_static_fields,
            "snapshots": selected_snapshots,
        }
        write_json(output_dir / "model_snapshots" / model_key / "index.json", curated_index)

        curated_models.append(
            {
                "key": model_key,
                "label": model_config.get("label") or source_model["label"],
                "checkpoint": source_model.get("checkpoint"),
                "snapshot_count": len(selected_snapshots),
                "default_snapshot_key": selected_snapshots[0]["date_key"],
                "time_range": {
                    "start": selected_snapshots[0]["date"],
                    "end": selected_snapshots[-1]["date"],
                },
                "field_keys": field_keys,
                "metrics_summary": source_model.get("metrics_summary"),
                "history_summary": source_model.get("history_summary"),
            }
        )
        total_snapshots += len(selected_snapshots)

    model_keys = {model["key"] for model in curated_models}
    if config["default_model_key"] not in model_keys:
        raise KeyError(f"Default model '{config['default_model_key']}' is not present in curated models.")

    models_catalog = {
        "default_model_key": config["default_model_key"],
        "default_field_key": config["default_field_key"],
        "models": curated_models,
    }
    write_json(output_dir / "models" / "index.json", models_catalog)

    manifest = {
        "app_title": "Aquila Fault + GNSS Explorer",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "defaults": {
            "default_station_id": config["default_station_id"],
            "default_model_key": config["default_model_key"],
            "default_field_key": config["default_field_key"],
        },
        "summary": {
            "stations": stations_payload["meta"]["station_count"],
            "timeseries": timeseries_count,
            "fault_patches": fault_patches["meta"]["patch_count"],
            "models": len(curated_models),
            "snapshots": total_snapshots,
            "validation_models": len(validation_catalog.get("models", [])),
        },
        "sources": {
            "config_path": relative_manifest_path(config_path),
            "source_data_dir": relative_manifest_path(source_data_dir),
        },
    }
    write_json(output_dir / "manifest.json", manifest)
    return manifest


def main() -> int:
    args = parse_args()
    config_path = resolve_path(args.config, relative_to=ROOT_DIR)
    config = load_json(config_path)
    source_data_dir = resolve_path(args.source_data_dir or config.get("source_data_dir"), relative_to=ROOT_DIR)
    output_dir = resolve_path(args.output_dir, relative_to=ROOT_DIR)

    manifest = import_curated_assets(config_path=config_path, source_data_dir=source_data_dir, output_dir=output_dir)
    print(
        f"Imported {manifest['summary']['models']} models, "
        f"{manifest['summary']['snapshots']} snapshots, "
        f"and {manifest['summary']['stations']} stations into {output_dir}",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
