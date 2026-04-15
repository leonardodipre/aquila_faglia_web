from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response

from .config import Settings, get_settings
from .data_access import DataRepository, RepositoryNotFoundError


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved_settings = settings or get_settings()
    repository = DataRepository(resolved_settings)

    app = FastAPI(title=resolved_settings.app_title)
    app.state.settings = resolved_settings
    app.state.repository = repository
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(resolved_settings.dev_origins),
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    def _require_data() -> None:
        if not repository.data_ready():
            raise HTTPException(status_code=503, detail="Curated dataset not found. Run scripts/import_curated_assets.py.")

    @app.get("/api/health")
    def health() -> dict[str, object]:
        return {
            "status": "ok",
            "data_ready": repository.data_ready(),
            "frontend_ready": resolved_settings.frontend_dist_dir.joinpath("index.html").exists(),
        }

    @app.get("/api/manifest")
    def manifest() -> dict[str, object]:
        _require_data()
        return repository.get_manifest()

    @app.get("/api/stations")
    def stations() -> dict[str, object]:
        _require_data()
        manifest_payload = repository.get_manifest()
        stations_payload = repository.get_stations_payload()
        return {
            "default_station_id": manifest_payload["defaults"]["default_station_id"],
            "summary": stations_payload["meta"],
            "stations": stations_payload["stations"],
        }

    @app.get("/api/stations/{station_id}/timeseries")
    def station_timeseries(station_id: str) -> dict[str, object]:
        _require_data()
        try:
            return repository.get_station_timeseries(station_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=f"Station '{station_id}' not found.") from exc

    @app.get("/api/fault/trace")
    def fault_trace() -> dict[str, object]:
        _require_data()
        return repository.get_fault_trace()

    @app.get("/api/fault/patches")
    def fault_patches() -> dict[str, object]:
        _require_data()
        return repository.get_fault_patches()

    @app.get("/api/models")
    def models() -> dict[str, object]:
        _require_data()
        return repository.get_models_catalog()

    @app.get("/api/models/{model_key}")
    def model(model_key: str) -> dict[str, object]:
        _require_data()
        try:
            return repository.get_model_detail(model_key)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=f"Model '{model_key}' not found.") from exc

    @app.get("/api/models/{model_key}/snapshots/{snapshot_key}")
    def model_snapshot(model_key: str, snapshot_key: str) -> dict[str, object]:
        _require_data()
        try:
            return repository.get_model_snapshot(model_key, snapshot_key)
        except KeyError as exc:
            raise HTTPException(
                status_code=404,
                detail=f"Snapshot '{snapshot_key}' not found for model '{model_key}'.",
            ) from exc

    @app.get("/{full_path:path}", include_in_schema=False, response_model=None)
    def serve_frontend(full_path: str) -> Response:
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404)

        dist_dir = resolved_settings.frontend_dist_dir
        index_path = dist_dir / "index.html"
        candidate_path = (dist_dir / full_path).resolve()

        if full_path:
            try:
                candidate_path.relative_to(dist_dir.resolve())
            except ValueError as exc:
                raise HTTPException(status_code=404) from exc
            if candidate_path.is_file():
                return FileResponse(candidate_path)

        if index_path.exists():
            return FileResponse(index_path)

        return JSONResponse(status_code=503, content={"detail": "Frontend build not found."})

    @app.exception_handler(RepositoryNotFoundError)
    def missing_file_handler(_, exc: RepositoryNotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": f"Data file not found: {Path(exc.args[0]).name}"})

    return app


app = create_app()
