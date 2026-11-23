# Mark Weisman Strength & Conditioning — Athlete Dashboard

Athlete readiness, performance and programming dashboard for professional athletes and private clients.

## Access

**[Open Dashboard →](https://markweisman45.github.io/cubs-sc/)** · Coach sign-in required · Athlete program pages: `program.html?id=…`

## Features

- Roster manager (sidebar **✎ Manage**): add athletes, set group (position player, pitcher, private client), position and number, mark athletes inactive (`js/roster.js`; saved in key `cubs_sc_roster_v1`)
- Load monitoring: strain & monotony (Foster), EWMA ACWR for HE and total distance, safe-distance range
- CMJ / ABCMJ trends (VALD ForceDecks), HE runs & speed zones, 1RM tracker
- Program Builder (single session, weekly, mesocycle), exercise library with video links. **1️⃣ Start a program**: pick Sandbox or an athlete, then 📚 Template (one browser for your saved templates, your library — Reload, Spring, In-Season by role, built-in phases — and the Method Library), 🔨 Scratch, or 📂 Saved
- Annual plan, calendar, Return to Performance protocols, workload planner
- Method Library: pre-made phases built from the programming spec (Hypertrophy Clusters, Poliquin, KILO, Conjugate, Triphasic, Undulated, VJP, Francis High/Low, 95 MPH Body, Taper, In-Season RE/DE, Prep, Transition, Deload) in 4- and 3-day versions, pitcher versions where the source calls for one, and private-client versions. Annual Plan → 🧭 Plan Templates lays a full year onto an athlete or group; 🚀 Start Program on a block loads its phase sized to the block (`js/method-library.js`, `data/method-templates.js`)
- KILO advanced (Specialty Technique Seminar): test-driven GPP blocks (ESD under / over 125% → eccentric + isometric, or isometric + explosive) and SPP blocks (XSD under / over 80% → fast eccentric, explosive, starting strength, or iso-dynamic + reactive), 12-week short blocks, the MLB infielder case study, pre-competition, a 2-day in-season method rotation, the 12-week plyo plan, and the Athlete — KILO Test-Driven annual plan. In the day editor, 🧪 on any lift row applies a KILO method (concentric, extended sets, eccentric, yielding / overcoming isometric, speed-strength, contrast / complex) with sets, reps, load, tempo, rest and notes, and warns on supra-maximal eccentrics under 2 years of training age (set per athlete in the 🧪 menu) or isometric sets over 40 s
- Every spec tab in the Method Library: ALTIS speed (general prep, acceleration, max velocity, baseball gamespeed, in-season, criteria-gated return to performance, Athlete — ALTIS Speed Year), Simmons Special Strength, Triphasic HS 3-day undulated off-season (+ Minor-League annual plan), The System monthly rep budgets (novice 800 / advanced 1,000), Zatsiorsky UConn non-linear + RFD, 8 Vector COD plyo progression, Supertraining concentrated block → LDTE, VBT in-season, Westside assessment workout and a Jovanović agile DUP phase — pitcher versions where the tab calls for one
- Methods picker: 🧪 on lift rows covers 198 methods from 14 sources (KILO, Westside, Simmons, VBT, Triphasic, Triphasic HS, Poliquin, Jovanović, Hypertrophy Clusters, Bompa, Zatsiorsky, Supertraining, 8 Vector, The System); ⚡ on speed rows covers the ALTIS Gamespeed zones and special methods plus 8 Vector, Triphasic HS, Francis, Bompa and System speed doses. The ⚡ menu stores each athlete's fly-10 (or uses HE Runs top speed) and ALTIS mailboxes (push / pull, F-V, rise, single / double leg, horse type, stride) to show zone targets in m/s and mph, MSS rest, pusher / puller cues and F-V sled loads. The day editor shows the ALTIS volume budget (accel ≤ 300 m, MSS 120–400 m, HiS ≤ 6 reps) and flags MSS rest, slow eccentrics above 85%, quality reps per set, The System per-session caps, and drop-jump / supra-max training age
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
| `data/method-templates.js` | Method Library phase + annual plan templates — generated, don't edit by hand |
| `tools/build-method-templates.js` | Generator for `data/method-templates.js` (`node tools/build-method-templates.js`); fails if an exercise isn't in the library |
| `js/roster.js` | Roster manager (add athletes, groups, inactive) |
| `js/method-library.js` | Method Library browser, Annual Plan templates, block → template loading |
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
