from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from .config import Settings


class RepositoryNotFoundError(FileNotFoundError):
    pass


class DataRepository:
    def __init__(self, settings: Settings):
        self.settings = settings

    @staticmethod
    @lru_cache(maxsize=1024)
    def _load_json_cached(path_str: str) -> Any:
        path = Path(path_str)
        return json.loads(path.read_text(encoding="utf-8"))

    def _read_json(self, path: Path) -> Any:
        if not path.exists():
            raise RepositoryNotFoundError(path)
        return self._load_json_cached(str(path.resolve()))

    def data_ready(self) -> bool:
        return self.path_for("manifest.json").exists()

    def path_for(self, *parts: str) -> Path:
        return self.settings.data_dir.joinpath(*parts)

    def get_manifest(self) -> dict[str, Any]:
        return self._read_json(self.path_for("manifest.json"))

    def get_stations_payload(self) -> dict[str, Any]:
        return self._read_json(self.path_for("stations.json"))

    def get_station_timeseries(self, station_id: str) -> dict[str, Any]:
        stations_payload = self.get_stations_payload()
        valid_ids = {station["station_id"] for station in stations_payload["stations"]}
        if station_id not in valid_ids:
            raise KeyError(station_id)
        return self._read_json(self.path_for("timeseries", f"{station_id}.json"))

    def get_fault_trace(self) -> dict[str, Any]:
        return self._read_json(self.path_for("fault.geojson"))

    def get_fault_patches(self) -> dict[str, Any]:
        return self._read_json(self.path_for("fault_patches.json"))

    def get_models_catalog(self) -> dict[str, Any]:
        return self._read_json(self.path_for("models", "index.json"))

    def get_model_entry(self, model_key: str) -> dict[str, Any]:
        catalog = self.get_models_catalog()
        for model in catalog["models"]:
            if model["key"] == model_key:
                return model
        raise KeyError(model_key)

    def get_model_index(self, model_key: str) -> dict[str, Any]:
        self.get_model_entry(model_key)
        return self._read_json(self.path_for("model_snapshots", model_key, "index.json"))

    def get_model_detail(self, model_key: str) -> dict[str, Any]:
        manifest = self.get_manifest()
        model_entry = self.get_model_entry(model_key)
        model_index = self.get_model_index(model_key)
        return {
            **model_entry,
            "default_field_key": manifest["defaults"]["default_field_key"],
            "fields": model_index["fields"],
            "static_fields": model_index.get("static_fields"),
            "snapshots": model_index["snapshots"],
        }

    def get_model_snapshot(self, model_key: str, snapshot_key: str) -> dict[str, Any]:
        model_index = self.get_model_index(model_key)
        allowed_keys = {snapshot["date_key"] for snapshot in model_index["snapshots"]}
        if snapshot_key not in allowed_keys:
            raise KeyError(snapshot_key)
        return self._read_json(self.path_for("model_snapshots", model_key, f"{snapshot_key}.json"))

