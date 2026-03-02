# Build Manifest — Speculative Trade Generator

**Project:** Speculative Trade Generator  
**Owner / Handle:** Codemonki  
**Hosting:** GitHub Pages (served from `/docs`)  
**UI modes:** Minimal + Advanced

## Purpose

A small, static web app that loads speculative trade tables from JSON and generates lots using a **1D6 column + 1D6 row** workflow. Supports random dice or prompted/manual rolls.

## Feature Checklist

### Core UX
- [x] Minimal mode UI
- [x] Advanced mode UI (toggleable)
- [x] Trade code selection: Ind, nInd, Ag, Desert, Water, Vacc
- [x] Generation parameters:
  - [x] Number of lots
  - [x] Law level (for legality checks)
  - [x] Random dice vs manual prompts
- [x] Results panel output

### Navigation / Modals
- [x] About modal
- [x] Help modal
- [x] Legal modal (loads `docs/NOTICE`)
- [x] Theme toggle (light/dark)

### Data / Tables
- [x] Tables stored as JSON files (no inline tables)
- [x] Loads JSON at runtime via `fetch()` from the published site
- [x] Displays “Loaded N merchandise entries” status

### Licensing / Compliance
- [x] Dual license model:
  - [x] Code: MIT
  - [x] Data (table, transcription, image): CC BY-SA 4.0
- [x] SPDX identifiers:
  - [x] `docs/index.html` → `SPDX-License-Identifier: MIT`
  - [x] `docs/app.js` → `SPDX-License-Identifier: MIT`
  - [x] `docs/styles.css` → `SPDX-License-Identifier: MIT`
  - [x] JSON data contains `_spdx` metadata (no JSON comments)
- [x] Attribution and notice:
  - [x] `NOTICE` at repo root
  - [x] `docs/NOTICE` for GitHub Pages modal display

## Repository Layout (Expected)

```
.
├── docs
│   ├── app.js
│   ├── index.html
│   ├── merchandise.json
│   ├── styles.css
│   ├── trade-columns.json
│   ├── NOTICE
│   └── assets
│       └── speculative-trade-original.jpeg
├── LICENSE
├── LICENSE-CC-BY-SA-4.0
├── LICENSE-MIT
├── NOTICE
└── README.md
```

## GitHub Pages

**Source:** Deploy from branch  
**Folder:** `/docs`  

Expected live URL form:
`https://<username>.github.io/<repo>/`

## Data Sources & Attribution

The speculative trade table used to create the JSON transcription is attributed to:

- **u/InterceptSpaceCombat** (Reddit r/traveller)
- Source thread: https://www.reddit.com/r/traveller/comments/1rimleq/speculative_trade_table/

The repository includes:
- The original table image (`docs/assets/speculative-trade-original.jpeg`)
- A structured JSON transcription (`docs/*.json`)

## Known Constraints / Notes

- This is a **static** GitHub Pages app: no backend, no persistence (beyond theme in localStorage).
- JSON transcription should be treated as “best effort” until verified against the canonical source.
- Legal modal depends on `docs/NOTICE` being present (repo root `NOTICE` is not served by Pages).

## Smoke Test

1. Open the GitHub Pages URL.
2. Confirm header buttons: **About / Help / Legal / Theme**
3. Confirm status reads: “Loaded N merchandise entries.”
4. Generate with random dice; results appear.
5. Toggle Advanced mode; panel appears (if implemented).
6. Open Legal; NOTICE text appears.
7. Toggle Theme; UI switches.