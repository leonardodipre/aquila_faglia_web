from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.app.config import Settings
from backend.app.main import create_app


@pytest.fixture(scope="session")
def curated_data_dir(tmp_path_factory: pytest.TempPathFactory) -> Path:
    output_dir = tmp_path_factory.mktemp("curated-data")
    subprocess.run(
        [
            sys.executable,
            str(ROOT_DIR / "scripts" / "import_curated_assets.py"),
            "--output-dir",
            str(output_dir),
        ],
        check=True,
        cwd=ROOT_DIR,
    )
    return output_dir


@pytest.fixture(scope="session")
def client(curated_data_dir: Path, tmp_path_factory: pytest.TempPathFactory) -> TestClient:
    dist_dir = tmp_path_factory.mktemp("frontend-dist")
    (dist_dir / "index.html").write_text("<!doctype html><html><body>frontend</body></html>\n", encoding="utf-8")

    app = create_app(
        Settings(
            app_title="Aquila Fault + GNSS Explorer",
            root_dir=ROOT_DIR,
            data_dir=curated_data_dir,
            frontend_dist_dir=dist_dir,
            dev_origins=(),
        )
    )
    with TestClient(app) as test_client:
        yield test_client
