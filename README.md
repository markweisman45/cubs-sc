# Mark Weisman Strength & Conditioning — Athlete Dashboard

Athlete readiness, performance and programming dashboard for professional athletes and private clients.

## Access

**[Open Dashboard →](https://markweisman45.github.io/cubs-sc/)** · Coach sign-in required · Athlete program pages: `program.html?id=…`

## Features

- Roster manager (sidebar **✎ Manage**): add athletes, set group (position player, pitcher, private client), position and number, mark athletes inactive (`js/roster.js`; saved in key `cubs_sc_roster_v1`)
- Load monitoring: strain & monotony (Foster), EWMA ACWR for HE and total distance, safe-distance range
- CMJ / ABCMJ trends (VALD ForceDecks), HE runs & speed zones, 1RM tracker
- Program Builder (single session, weekly, mesocycle), phase templates, exercise library with video links
- Annual plan, calendar, Return to Performance protocols, workload planner
- Team Summary, Daily Brief, PDF reports, coach notes per athlete
- Speed readiness from HE runs: max-velocity exposure, effort-matched fatigue, sprint profile, RTP speed (`js/speed-intel.js`)
- Live program edits: change one athlete's sent program (move/swap days, push the week back, add blocks or weeks) and it updates on his phone with a "coach updated" banner (`js/program-edit.js`)
- Program history: every send, re-send, live edit and restore is saved as a version you can view or restore (`js/program-history.js`; stored in the cloud only, key `hist:<program id>`)
- One-page athlete profile across seasons — speed, jump, bat/arm, injuries & RTP, programs & consistency — printable to PDF (`js/athlete-profile.js`)
- Value Added: physical tools, defense, baserunning and WAR over the last 3 seasons — each vs the typical change for the player's age and vs league average. Baseball Savant is pulled live; FanGraphs is cached compactly in the cloud (key `cache:fangraphs`) (`js/savant.js`, `js/value-added.js`)

## Athlete groups

| Group | Sees | Team views |
|---|---|---|
| Position players | All tabs | Included |
| Pitchers | Jumps, Workload, 1RM, Programs, Calendar | Rankings by metric only |
| Private clients | Jumps, Workload, 1RM, Programs, Calendar | Never included |
| Inactive (any group) | All their data, kept | Not listed, not included |

## Files

| File | What it is |
|---|---|
| `index.html` | Coach dashboard (all app code) |
| `data/oc-programs.js` | Program template library (loaded by `index.html`) |
| `data/mw-templates.js` | Template library in Mark's style (Reload, Spring ramp, In-season by role) |
| `js/roster.js` | Roster manager (add athletes, groups, inactive) |
| `js/training-core.js` | Shared program/log logic for both pages, including log remapping for live edits |
| `js/coach-loop.js`, `js/speed-intel.js`, `js/program-edit.js` | Inbox, program checks, equipment/RTP prep, speed flags, live editing |
| `program.html`, `sw.js`, `manifest.json`, icons | Athlete-facing program page (installable PWA) |

## Data

- Each browser keeps a working copy in `localStorage`; **Supabase (`cubs_sc_data`) is the shared copy**, protected by row-level security (coach sign-in).
- Changes sync automatically after imports and edits. The sidebar shows the last sync time and any unsynced changes; **☁️ Sync to Cloud** pushes everything.
- Sync is newest-wins per data key: a device only overwrites the cloud with changes newer than the cloud copy, and pulls newer cloud copies on load.
- Game-log dates are stored as `YYYY-MM-DD`.
- **Download Backup** saves a full JSON copy of this browser's data.
- Every day and exercise in a sent program has a stable `uid`. When a program changes (live edit or re-send), logged sets are moved to follow their exercise; `pb_state.structVer` and `pb_state.remaps` let a phone that was offline upgrade its saved log. Logs for removed exercises are kept under `arch:` keys.

## Load-monitoring rules

- Numbers are calculated as of the later of the last logged day or yesterday.
- ACWR zones: green 0.85–1.15, yellow 0.75–0.85 / 1.15–1.25, red outside. Status checks HE and total-distance ACWR separately; the headline ACWR is whichever is further from 1.0.
- Strain thresholds are per athlete (their mean + 1 SD = yellow, + 2 SD = red), falling back to 2,000 / 3,500 until they have 28+ days of data.
- No load data for 14+ days → **No data** (grey) instead of a green light.

---
*Mark Weisman Strength & Conditioning — Private*
