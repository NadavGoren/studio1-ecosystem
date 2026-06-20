# Alerts Israel — Timeline Generator

Interactive, vectorial visualization of Israel's **Tzeva Adom** (Red Alert) history.
Filter by time range, threat type, and city; render a temporal timeline; export
plotter-ready SVG or a filtered CSV.

## Run

Double-click **`Launch.command`** (opens `index.html` in Chrome).
No server needed — the data is embedded in `data/data.js`.

## Features

- **Time range** — presets (30d / 90d / 6m / 1y / All) or custom from/to dates.
- **Bucket** — day, week, or month aggregation.
- **Display** — stacked bars or per-type line series; optional log Y scale.
- **Threat types** — toggle Rocket/Missile, UAV/Drone, Aircraft, Earthquake, CBRN.
- **Cities** — search and pin specific localities (1,500+ in the data); empty = all.
- **Export** — `Export SVG` (clean vector for plotting) and `Export filtered CSV`.

## Data

| file | what |
|------|------|
| `data/raw.json` | Raw event array from tzevaadom.co.il (one record per alert). |
| `data/alerts.csv` | Flat CSV, one row per city per alert (176k rows). |
| `data/data.js` | Compact embedded payload the app loads (city dictionary + events). |
| `data/daily.json` | Per-day aggregate by threat type. |

### Refresh the data

```bash
curl -s https://www.tzevaadom.co.il/static/historical/all.json -o data/raw.json
python3 preprocess.py
```

`preprocess.py` rebuilds `data.js` and `daily.json` from `raw.json`.

## Source

Data: <https://www.tzevaadom.co.il/static/historical/all.json> — the full
historical alert dataset, refreshed continuously.

## Roadmap ideas

- Geographic map view (needs city → lat/lon join).
- Time-of-day polar / radial calendar.
- Per-city small-multiples.
