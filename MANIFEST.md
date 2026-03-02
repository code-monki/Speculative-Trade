# Build Manifest — Speculative Trade Generator

**Project:** Speculative Trade Generator  
**Owner / Handle:** Codemonki  
**Hosting:** GitHub Pages (served from `/docs`)  
**Build:** Static (no build step)

## Purpose

A small, static web app that loads speculative trade tables from JSON and generates lots using a **1D6 column + 1D6 row** workflow. Supports random dice or prompted/manual rolls.

World input is provided as a single **world profile line**:
`<UWP> [codes/tags...]`  
Example: `A867A74-C Ag Ri In Inner Amber`

Optional dropdown context (zone, travel zone, etc.) can add conditions used by modifiers.

## Feature Checklist

### Core UX
- [x] Single world-profile input (UWP + tokens)
- [x] Derived display from UWP:
  - [x] Starport
  - [x] TL
  - [x] Law level (used for legality checks)
- [x] Generation parameters:
  - [x] Number of lots
  - [x] Random dice vs manual prompts
- [x] Results panel output (one card per generated lot)
- [x] Optional world context section (dropdowns)
  - [x] Zone: Inner / Outer
  - [x] Habitability: Habitable / Inhabitable (Habitable may affect modifiers; Inhabitable is inert unless rules change)
  - [x] Travel zone: Green / Amber / Red (Amber/Red become conditions; Green is inert)
  - [x] Government type (SRD list; Gov 7 maps to `Balkanized`)
  - [x] World economic status: Rich / Poor

### Rules Implementation
- [x] Column selection uses world trade classes (Ind, nInd, Ag, Desert, Water, Vacc)
- [x] If rolled trade class is not present on the world, treat as **None**
- [x] Per-column modifiers (DMs) are **always applied** when their conditions match
- [x] After applying column DM, trade class is re-selected from adjusted column roll
- [x] Buy/Sell DM applied from item modifiers (matching conditions)
- [x] Legality check:
  - [x] Item has LG X (or range like `3-4`)
  - [x] Legal if **Law ≤ max(LG)**

### Navigation / Modals
- [x] About modal
- [x] Help modal (documents algorithm + per-column modifiers)
- [x] Legal modal (loads `docs/NOTICE`)
- [x] Theme toggle (cycles **Dark → Light → Warm**; persisted via localStorage)

### Data / Tables
- [x] Tables stored as JSON files (no inline tables)
- [x] Loads JSON at runtime via `fetch()` from the published site
- [x] Displays “Loaded N merchandise entries” status

### Licensing / Compliance
- [x] Dual-license model:
  - [x] Code: MIT
  - [x] Data (table transcription, image): CC BY-SA 4.0
- [x] SPDX identifiers:
  - [x] `docs/index.html` → MIT
  - [x] `docs/app.js` → MIT
  - [x] `docs/styles.css` → MIT
  - [x] JSON data includes `_spdx` metadata (no JSON comments)
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
│   ├── manifest.txt
│   └── assets
│       └── speculative-trade-original.jpeg
├── LICENSE
├── LICENSE-CC-BY-SA-4.0
├── LICENSE-MIT
├── NOTICE
├── MANIFEST.md
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

- Static GitHub Pages app: no backend, no persistence (beyond theme in localStorage).
- JSON transcription should be verified against the canonical source if used “for real” at table.
- Legal modal depends on `docs/NOTICE` being present (repo root `NOTICE` is not served by Pages).

## Smoke Test

1. Open the GitHub Pages URL.
2. Confirm header buttons: **About / Help / Legal / Theme**.
3. Confirm status reads: “Loaded N merchandise entries.”
4. Enter a world profile and generate with random dice; results appear.
5. Toggle Theme through **Dark / Light / Warm**.
6. Open Help; per-column modifiers are listed.
7. Open Legal; NOTICE text appears.