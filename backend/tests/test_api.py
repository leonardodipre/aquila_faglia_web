from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient


ROOT_DIR = Path(__file__).resolve().parents[2]


def test_manifest_valid(client: TestClient) -> None:
    response = client.get("/api/manifest")
    assert response.status_code == 200
    payload = response.json()
    assert payload["app_title"] == "Aquila Fault + GNSS Explorer"
    assert payload["defaults"]["default_model_key"] == "best_sweep"
    assert payload["summary"]["models"] == 4
    assert payload["summary"]["snapshots"] == 32


def test_allowlist_matches_curation(client: TestClient) -> None:
    response = client.get("/api/models")
    assert response.status_code == 200
    payload = response.json()

    config = json.loads((ROOT_DIR / "config" / "curation.json").read_text(encoding="utf-8"))
    expected_model_keys = [model["key"] for model in config["models"]]

    assert payload["default_model_key"] == config["default_model_key"]
    assert [model["key"] for model in payload["models"]] == expected_model_keys
    assert all(model["snapshot_count"] == 8 for model in payload["models"])

    detail = client.get("/api/models/best_sweep")
    assert detail.status_code == 200
    detail_payload = detail.json()
    assert [snapshot["date_key"] for snapshot in detail_payload["snapshots"]] == config["models"][0]["snapshot_keys"]


def test_404_for_unknown_station_model_and_snapshot(client: TestClient) -> None:
    assert client.get("/api/stations/NOPE/timeseries").status_code == 404
    assert client.get("/api/models/not-a-model").status_code == 404
    assert client.get("/api/models/best_sweep/snapshots/1900-01-01").status_code == 404


def test_endpoint_shapes_are_coherent(client: TestClient) -> None:
    stations_response = client.get("/api/stations")
    assert stations_response.status_code == 200
    stations_payload = stations_response.json()
    assert "default_station_id" in stations_payload
    assert "summary" in stations_payload
    assert "stations" in stations_payload
    assert stations_payload["stations"][0]["station_id"]

    station_id = stations_payload["default_station_id"]
    series_response = client.get(f"/api/stations/{station_id}/timeseries")
    assert series_response.status_code == 200
    series_payload = series_response.json()
    assert set(series_payload["raw"]) == {"E", "N", "U"}
    assert len(series_payload["dates"]) == len(series_payload["raw"]["E"])

    fault_response = client.get("/api/fault/patches")
    assert fault_response.status_code == 200
    fault_payload = fault_response.json()
    assert fault_payload["meta"]["patch_count"] > 0
    assert fault_payload["patches"][0]["triangles_local_xyz_m"]

    model_detail = client.get("/api/models/best_sweep")
    assert model_detail.status_code == 200
    detail_payload = model_detail.json()
    assert "fields" in detail_payload
    assert "snapshots" in detail_payload

    snapshot_key = detail_payload["snapshots"][0]["date_key"]
    snapshot_response = client.get(f"/api/models/best_sweep/snapshots/{snapshot_key}")
    assert snapshot_response.status_code == 200
    snapshot_payload = snapshot_response.json()
    assert "fields" in snapshot_payload
    assert "slip_m" in snapshot_payload["fields"]
