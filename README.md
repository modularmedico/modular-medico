# OpenScreen
Open-source, fully client-side systematic-review tool (import, dedup, screening, export). No backend.

## Status
v0.3: working UI - import (RIS/BibTeX/CSV/TSV), deduplication with review queue, merge/undo, manual screening with keyword highlighting, table, CSV export, PRISMA counts. Data persists in IndexedDB.

## Roadmap
Workers, nbib/EndNote/JSON, RIS/XLSX export, AI assist, collaboration (shared folder, P2P, file exchange), blinding, kappa.

## (older notes)
Increment 1: core library (types, normalizer, RIS parser, staged dedup engine) + tests.
Next: remaining parsers, workers + IndexedDB, merge/undo, UI, screening, export, AI, collaboration.

## Develop
    npm install
    npm test

## Dedup stages
1 normalize -> 2 exact (DOI / PMID / title+year) -> 3 blocking (first 3 title tokens, year +/-1)
-> 4 weighted fuzzy score (missing fields neutral, DOI conflict x0.5) -> 5 tiers (>=0.95 auto, 0.80-0.95 possible).
Errata/retractions never merge with originals; preprint-vs-published is capped at "possible".

## Run / deploy
    npm install && npm run dev      # local
    npm run build                   # outputs dist/
Vercel: framework Vite, build `npm run build`, output `dist`. GitHub Pages: publish `dist/` (base is `./`).
Repo root must contain package.json and index.html.
