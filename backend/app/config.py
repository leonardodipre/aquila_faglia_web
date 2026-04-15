from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class Settings:
    app_title: str
    root_dir: Path
    data_dir: Path
    frontend_dist_dir: Path
    dev_origins: tuple[str, ...]


def get_settings() -> Settings:
    return Settings(
        app_title="Aquila Fault + GNSS Explorer",
        root_dir=ROOT_DIR,
        data_dir=Path(os.getenv("AQUILA_DATA_DIR", ROOT_DIR / "data")).resolve(),
        frontend_dist_dir=Path(os.getenv("AQUILA_FRONTEND_DIST_DIR", ROOT_DIR / "dist")).resolve(),
        dev_origins=(
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ),
    )

