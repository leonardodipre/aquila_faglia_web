# aquila_faglia_web

Web app autonoma per:
- overview GNSS sull'Italia con selezione stazione e serie temporale
- vista 3D della faglia di L'Aquila con modelli PINN curati
- backend `FastAPI` che espone API JSON e serve il build del frontend

## Struttura

- `backend/app`: API FastAPI
- `src`: frontend React + Vite + TypeScript
- `config/curation.json`: allowlist modelli/snapshot
- `scripts/import_curated_assets.py`: importa i dati curati dal repo sorgente
- `data`: dataset locale generato e servito dal backend

## Setup

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
npm install
python3 scripts/import_curated_assets.py
```

## Sviluppo

Terminale 1:

```bash
.venv/bin/uvicorn backend.app.main:app --reload
```

Terminale 2:

```bash
npm run dev
```

Vite inoltra `/api` verso `http://127.0.0.1:8000`.

## Build

```bash
npm run build
```

Il backend serve il contenuto di `dist/` quando il build è presente.

## Test

```bash
.venv/bin/pytest backend/tests -q
npm test
```
