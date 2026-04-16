# aquila_faglia_web

Web app per:
- overview GNSS sull'Italia con selezione stazione e serie temporale
- vista 3D della faglia di L'Aquila con modelli PINN curati
- deploy statico su GitHub Pages

## Struttura

- `src`: frontend React + Vite + TypeScript
- `data`: dataset locale versionato e copiato nel build statico
- `config/curation.json`: allowlist modelli e snapshot
- `scripts/import_curated_assets.py`: aggiorna il dataset curato dal repo sorgente
- `backend/app`: API FastAPI opzionale

## Setup

```bash
npm install
python3 scripts/import_curated_assets.py
```

## Sviluppo Frontend

```bash
npm run dev
```

Il frontend legge direttamente i JSON in `data/`, quindi per lo sviluppo UI non serve piu il proxy `/api`.

## Build Statico

```bash
npm run build
```

Il build copia il dataset dentro `dist/` e usa `HashRouter`, quindi funziona su GitHub Pages anche sotto il path del repository.

## GitHub Pages

Il workflow [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml) pubblica `dist/` su GitHub Pages a ogni push su `main`.

In GitHub:
- vai in `Settings > Pages`
- imposta `Source` su `GitHub Actions`

## Backend Opzionale

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn backend.app.main:app --reload
```

Il backend resta disponibile se vuoi continuare a esporre le API JSON o servire il build localmente.

## Test

```bash
.venv/bin/pytest backend/tests -q
npm test
```
