# ⚾ Chicago Cubs S&C Dashboard

Athlete Readiness & Performance Dashboard for Chicago Cubs Strength & Conditioning.

## Access

**[Open Dashboard →](https://markweisman45.github.io/cubs-sc/)** · Athlete program pages: `program.html?id=…`

## Features

- Load monitoring: strain & monotony (Foster), EWMA ACWR for HE and total distance, safe-distance range
- CMJ / ABCMJ trends (VALD ForceDecks), HE runs & speed zones, 1RM tracker
- Program Builder (single session, weekly, mesocycle), phase templates, exercise library with video links
- Annual plan, calendar, Return to Performance protocols, workload planner
- Team Summary, Daily Brief, PDF reports, coach notes per athlete

## Files

| File | What it is |
|---|---|
| `index.html` | Coach dashboard (all app code) |
| `data/oc-programs.js` | Program template library (loaded by `index.html`) |
| `program.html`, `sw.js`, `manifest.json`, icons | Athlete-facing program page (installable PWA) |

## Data

- Each browser keeps a working copy in `localStorage`; **Supabase (`cubs_sc_data`) is the shared copy**.
- Changes sync automatically after imports and edits. The sidebar shows the last sync time and any unsynced changes; **☁️ Sync to Cloud** pushes everything.
- Sync is newest-wins per data key: a device only overwrites the cloud with changes newer than the cloud copy, and pulls newer cloud copies on load.
- Game-log dates are stored as `YYYY-MM-DD`.
- **Download Backup** saves a full JSON copy of this browser's data.

## Load-monitoring rules

- Numbers are calculated as of the later of the last logged day or yesterday.
- ACWR zones: green 0.85–1.15, yellow 0.75–0.85 / 1.15–1.25, red outside. Status checks HE and total-distance ACWR separately; the headline ACWR is whichever is further from 1.0.
- Strain thresholds are per athlete (their mean + 1 SD = yellow, + 2 SD = red), falling back to 2,000 / 3,500 until they have 28+ days of data.
- No load data for 14+ days → **No data** (grey) instead of a green light.

---
*Chicago Cubs S&C Department — Internal Use Only*
