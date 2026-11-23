#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Builds data/method-templates.js — phase templates + annual plan templates
// from the ALTIS Speed Programming Spec (claude.ai/artifact/Ehz6mSnKvKxoUTmt3uasuw).
//   node tools/build-method-templates.js
// Every exercise must be in EXERCISE_DB (index.html) — the build fails if not.
// Format matches data/mw-templates.js so Program Builder loads them as-is.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

// ── Library ──────────────────────────────────────────────────────────────────
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const i0 = html.indexOf('let EXERCISE_DB = [');
let k = html.indexOf('[', i0), depth = 0, j = k;
for (; j < html.length; j++) { const c = html[j]; if (c === '[') depth++; else if (c === ']') { depth--; if (!depth) break; } }
const DB = eval(html.slice(k, j + 1)).filter(e => e && e.name);
const BY = {}; DB.forEach(e => { if (!BY[e.name]) BY[e.name] = e; });
function L(name) { const e = BY[name]; if (!e) throw new Error('Not in library: ' + name); return e; }

// ── Builders ─────────────────────────────────────────────────────────────────
const S = v => String(v);
function lift(name, pair, sets, reps, load, tempo, rest, notes) {
  const e = L(name);
  // % loads only where a 1RM drives them; weighted pull-ups / Nordics / GHR go by effort
  if (/%/.test(load || '') && (!e.liftKey || /Pull Up|Nordic|Glute-Ham/.test(name))) load = /Pull Up/.test(name) ? 'RPE 8' : 'RPE 7';
  const o = { type: 'lift', name, cat: e.cat, pair, sets: S(sets), reps: S(reps), load: load || '', tempo: tempo || '', rest: rest || '' };
  if (notes) o.notes = notes;
  return o;
}
function spd(name, pair, sets, reps, distance, pct, rest, notes) {
  const e = L(name);
  const o = { type: 'speed', name, cat: e.cat, pair, sets: S(sets), reps: S(reps), distance: distance || '', pct: pct || '', rest: rest || '' };
  if (notes) o.notes = notes;
  return o;
}
const blk = (blockType, label, exercises) => ({ blockType, label, exercises: exercises.filter(Boolean) });
const day = (d, type, label, blocks) => ({ day: d, type, label, blocks: (blocks || []).filter(b => b && b.exercises && b.exercises.length) });
const off = (d, label) => ({ day: d, type: 'off', label: label || 'OFF', blocks: [] });
const PM = { sets: 1, reps: 1, load: 1 };
const week = (n, label, days, isDeload) => ({ week: n, isDeload: !!isDeload, label, progMod: Object.assign({ label: 'W' + n }, PM), days });
const DAYS7 = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// Put training days on the right weekdays, OFF elsewhere
function layout(trainDays, map) {   // map: { Mon: dayObj, ... }
  return DAYS7.map(d => map[d] ? Object.assign({}, map[d], { day: d }) : off(d, d === 'Sun' || d === 'Sat' ? 'OFF' : 'OFF / Recovery'));
}
const clone = o => JSON.parse(JSON.stringify(o));
const pct = (n) => n + '%';

// ── Pitcher swaps (Brewster risk list + the pitcher rules on each tab) ───────
const PITCHER_SWAP = {
  'Bb Bench Press': ['Half Kneeling Landmine Press', 'Pitcher swap — no barbell bench (Brewster)'],
  'Swiss Bar Bench Press': ['Half Kneeling Landmine Press', 'Pitcher swap — landmine instead of barbell pressing'],
  'Bb Close Grip Bench Press': ['Half Kneeling Cable Press', 'Pitcher swap — cable press instead of close-grip bench'],
  'Db Bench Press': ['Half Kneeling Landmine Press', 'Pitcher swap — landmine press'],
  'DB Floor Press': ['Half Kneeling Landmine Press', 'Pitcher swap — landmine press'],
  'Incline DB Press': ['Half Kneeling Cable Press', 'Pitcher swap — half-kneeling cable press (Tuura tab)'],
  'Push Press': ['Landmine Push Press (video)', 'Pitcher swap — no barbell overhead'],
  'Arnold Press': ['Half Kneeling Landmine Press', 'Pitcher swap — no overhead press (Brewster)'],
  'Dip (Weighted)': ['Push-Up', 'Pitcher swap — full-range push-up instead of dips (Brewster)'],
  'Power Clean': ['High Pull', 'Pitcher swap — pull, no catch (Brewster / The System)'],
  'Hang Clean': ['High Pull', 'Pitcher swap — pull, no catch'],
  'Med Ball Chest Pass': ['MB Step Back Side Toss', 'Pitcher swap — rotational throw instead of chest pass'],
  'Neutral Grip DB Bench Press': ['Half Kneeling Landmine Press', 'Pitcher swap — landmine press (Tuura tab)'],
  'Swiss Bar Floor Press': ['Half Kneeling Landmine Press', 'Pitcher swap — no barbell pressing max'],
};
function pitcherize(t) {
  const c = clone(t);
  c.weeks.forEach(w => w.days.forEach(d => d.blocks.forEach(b => b.exercises = b.exercises.map(ex => {
    const s = PITCHER_SWAP[ex.name];
    if (!s) return ex;
    const n = L(s[0]);
    const o = Object.assign({}, ex, { name: s[0], cat: n.cat, notes: s[1] + (ex.notes ? ' · ' + ex.notes : '') });
    // % loads were off the original lift's 1RM — switch to effort
    if (/%/.test(o.load || '')) o.load = 'RPE 7';
    return o;
  }))));
  return c;
}

// ── 3-day full-body from a 4-day upper/lower week ────────────────────────────
// Pairs on every lift day: A power/primer · B main · C secondary · D accessory · E core/arm care
function liftEx(d) { const b = d.blocks.find(x => x.blockType === 'lift'); return b ? b.exercises : []; }
function byPair(exs, p) { return exs.filter(e => e.pair === p); }
function repair(exs, p) { return exs.map(e => Object.assign({}, e, { pair: p })); }
function trimSet(exs) { return exs.map(e => Object.assign({}, e, { sets: S(Math.max(2, (parseInt(e.sets) || 3) - 1)) })); }
function merge(Ld, Ud, label, lighter) {
  const le = liftEx(Ld), ue = liftEx(Ud);
  const A = byPair(le, 'A').length ? byPair(le, 'A') : byPair(ue, 'A');
  const lifts = [].concat(
    repair(A, 'A'),
    repair(byPair(le, 'B'), 'B'),
    repair(byPair(ue, 'B'), 'C'),
    repair(trimSet(byPair(le, 'C').concat(byPair(ue, 'C')).slice(0, 2)), 'D'),
    repair(byPair(ue, 'E').length ? byPair(ue, 'E') : byPair(le, 'E'), 'E')
  );
  const sp = Ld.blocks.filter(b => b.blockType === 'speed');
  let blocks = sp.concat([blk('lift', 'Full Body', lighter ? trimSet(lifts) : lifts)]);
  return day('', 'lift', label, clone(blocks));
}
// days4: [LA, UA, LB, UB] (Mon/Tue/Thu/Fri). 3-day: Mon LA+UA, Wed LB+UB, Fri LA+UB (volume day, 1 set less)
const theme = d => (d.label.split('·')[1] || d.label).trim();
function to3(w4) {
  const td = w4.days.filter(d => d.type !== 'off');
  const [LA, UA, LB, UB] = td;
  const map = {
    Mon: merge(LA, UA, 'Full Body A · ' + theme(LA)),
    Wed: merge(LB, UB, 'Full Body B · ' + theme(LB)),
    Fri: merge(LA, UB, 'Full Body C · Volume day', true),
  };
  return Object.assign({}, w4, { days: layout(3, map) });
}
const four = (LA, UA, LB, UB) => layout(4, { Mon: LA, Tue: UA, Thu: LB, Fri: UB });

// ── Shared speed blocks (ALTIS Gamespeed zones; MSS from the fly-10) ─────────
// Warm-up A = acceleration day, Warm-up B = max-velocity day
function accelBlock(lvl, note) {
  // lvl 0 prep · 1 build · 2 full (160–300 m team-sport cap) · 3 peak (low volume)
  const v = [
    [spd('2pt Start (LSV)', 'C', 4, 1, '10yd', '85%', '1:30', 'Build-ups — technique before speed'), spd('2pt Start (LSV)', 'C', 2, 1, '20yd', '85%', '2:00')],
    [spd('2pt Start (LSV)', 'C', 4, 1, '10yd', '95%+', '1:30', 'Zone 5 — full rest'), spd('Ground Start Chaser Variations', 'D', 3, 1, '20yd', '95%+', '2:30', 'Rise smoothly — no early rise')],
    [spd('2pt Start (LSV)', 'C', 4, 1, '10yd', '95%+', '1:30', 'Zone 5 — full rest'), spd('Steal Start (3 steps)', 'D', 3, 1, '20yd', '95%+', '2:30', 'Base-steal start'), spd('Prowler Sprint', 'D', 3, 1, '20yd', '95%+', '3:00', 'Projection — ~15–30% BW')],
    [spd('Steal Start (3 steps)', 'C', 3, 1, '15yd', '95%+', '2:00', 'Low volume — quality only'), spd('2pt Start (LSV)', 'D', 2, 1, '30yd', '95%+', '3:00')],
  ][lvl];
  return blk('speed', 'Warm-up A · Acceleration' + (note ? ' · ' + note : ''), [
    spd('Dribbles (Calf)', 'A', 1, 2, '20yd', '70%', ':30', 'Rhythm — rising cadence'),
    spd('A-Skip', 'A', 1, 2, '20yd', '75%', ':30', 'Tall, pelvis neutral'),
    spd('Power Skips- Distance', 'B', 1, 3, '20yd', '85%', ':45', 'Projection primer before every accel'),
  ].concat(v));
}
function maxVBlock(lvl, note) {
  const v = [
    [spd('Wickets', 'C', 3, 1, '30yd', '85%', '1:30', 'Strike from above'), spd('Fly (variation)', 'D', 2, 1, '10yd fly', '90%', '3:00', '20–30 yd build-in')],
    [spd('Wickets', 'C', 3, 1, '30yd', '90%', '1:30'), spd('Fly (variation)', 'D', 4, 1, '10yd fly', '95%+', '3:30', 'Zone 5 — log the fly-10 (MSS test)')],
    [spd('Wickets', 'C', 3, 1, '30yd', '90%', '1:30'), spd('Fly (variation)', 'D', 4, 1, '20yd fly', '95%+', '4:00', 'Zone 5 — 30–60 s rest per 1 s sprinting'), spd('Bounding', 'D', 2, 1, '30yd', '90%', '2:00', 'Scissor-bound bleeds')],
    [spd('Fly (variation)', 'C', 3, 1, '10yd fly', '95%+', '4:00', 'Low volume — one quality exposure')],
  ][lvl];
  return blk('speed', 'Warm-up B · Max Velocity' + (note ? ' · ' + note : ''), [
    spd('Dribbles (Knee)', 'A', 1, 2, '20yd', '75%', ':30', 'Dribble-bleed into full stride'),
    spd('B-Skip', 'A', 1, 2, '20yd', '75%', ':30'),
    spd('Pogo Jumps', 'B', 2, 10, '', 'Stiff', ':45', 'Rudiment hops — contacts, not distance'),
  ].concat(v));
}
function tempoBlock(reps, note) {
  return blk('speed', 'Tempo (Zone 1–2)' + (note ? ' · ' + note : ''), [
    spd('Tempo Runs', 'A', 2, reps, '100yd', '65–75%', ':45', 'Francis tempo on grass — never chase times; 2:00 between sets'),
  ]);
}
const ARM_CARE = (sets) => [lift('Cable External Rotation', 'E', sets || 2, '12ea', 'Light', '3010', ':30', 'Arm care'), lift('Y-T-W', 'E', sets || 2, 8, 'Light', '2010', ':30')];

// ═══════════════════════════════════════════════════════════════════════════
// PHASE TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════
const T = [];
function add(meta, weeks4) {
  const base = Object.assign({ group: 'athlete', variant: 'all' }, meta, { weeks: weeks4 });
  T.push(Object.assign({}, base, { key: meta.key + '-4', days: 4 }));
  const f3 = meta.to3 || to3;
  if (meta.no3 !== true) T.push(Object.assign({}, base, { key: meta.key + '-3', days: 3, weeks: weeks4.map(f3) }));
  if (meta.pitcher) {
    const p4 = pitcherize(Object.assign({}, base, { weeks: meta.pitcherWeeks || weeks4 }));
    T.push(Object.assign({}, base, p4, { key: meta.key + '-4-p', days: 4, variant: 'pitcher' }));
    if (meta.no3 !== true) T.push(Object.assign({}, base, { key: meta.key + '-3-p', days: 3, variant: 'pitcher', weeks: p4.weeks.map(f3) }));
  }
}

// ── 1. Transition / Compensation (Bompa; KILO structural balance; Francis tempo) ──
function transitionWeek(n, sets) {
  const fb = (lab, a, b) => day('', 'lift', lab, [blk('lift', 'Structural Balance', [
    lift(a[0], 'A', sets, a[1], 'RPE 5', '3010', '1:00'), lift(a[2], 'A', sets, a[3], 'BW', '2010', '1:00'),
    lift(b[0], 'B', sets, b[1], 'RPE 5', '3010', '1:00'), lift(b[2], 'B', sets, b[3], 'RPE 5', '2010', '1:00'),
    lift('Hip 90/90 Series', 'C', 1, '5ea', 'BW', '', ':20', 'Mobility'), lift('T-Spine Wall Walks', 'C', 1, 8, 'BW', '', ':20'),
    lift('Dead Bug', 'E', sets, '6ea', 'BW', '3131', ':30'), lift('Band External Rotation', 'E', sets, '15ea', 'Light', '2010', ':30', 'Arm care — medical / ROM work first'),
  ])]);
  const A = fb('Full Body 1 · Light', ['Goblet Squat', 10, 'SL Bridge', '10ea'], ['DB Single Arm Row', '10ea', 'Push-Up', 10]);
  const B = fb('Full Body 2 · Light', ['Db Step-Up', '8ea', 'Back Extension', 12], ['Chin Up', 6, 'Half Kneeling Landmine Press', '8ea']);
  const C = day('', 'esd', 'Tempo + Mobility', [tempoBlock(4, 'easy'), blk('lift', 'Mobility', [lift('Supine Hamstring P/R', 'A', 1, 2, 'BW', '', ':20'), lift('Half Kneeling Hip Flexor', 'A', 1, '30s', '', '', ':15'), lift('Hip 90/90 Series', 'B', 1, '5ea', 'BW', '', ':20')])]);
  return [A, B, C];
}
{
  const meta = { key: 'transition', category: 'Method Library · Transition', phaseType: 'restore', sq: {}, source: 'Bompa compensation · KILO structural balance · Francis tempo',
    name: '🌿 Transition — Compensation (3 wk)', no3: true,
    notes: 'Post-season: active rest, not full rest (Bompa). General fitness at ~40–50% of in-season load; 2–3 sets across the board (KILO structural balance). Do medical / ROM work and the season review here. Detraining: keep 1–2 light full-body days from week 2.' };
  const wk = (n, sets) => { const [A, B, C] = transitionWeek(n, sets); return week(n, 'Transition W' + n, layout(3, { Mon: A, Wed: C, Fri: B })); };
  const wk2 = (n, sets) => { const [A, B] = transitionWeek(n, sets); return week(n, 'Transition W' + n, layout(2, { Tue: A, Fri: B })); };
  T.push(Object.assign({ group: 'athlete', variant: 'all' }, meta, { key: 'transition-3', days: 3, weeks: [wk(1, 2), wk(2, 2), wk(3, 3)] }));
  T.push(Object.assign({ group: 'athlete', variant: 'all' }, meta, { key: 'transition-2', days: 2, name: meta.name.replace('(3 wk)', '(3 wk · 2-day)'), weeks: [wk2(1, 2), wk2(2, 2), wk2(3, 3)] }));
}

// ── 2. Prep / Anatomical Adaptation (Bompa AA; The System prep; 8 Vector foundation) ──
{
  const P = [{ s: 2, r: 12, rpe: 'RPE 6', pct: 55 }, { s: 3, r: 10, rpe: 'RPE 6–7', pct: 60 }, { s: 3, r: 8, rpe: 'RPE 7', pct: 65 }];
  const wk = (n) => {
    const p = P[n - 1];
    const LA = day('', 'lift', 'Lower A · Acceleration', [accelBlock(0, 'distance progression'), blk('lift', 'Lower Strength', [
      lift('Broad Jump W/ Stick', 'A', 3, 3, 'BW', '', '1:00', 'Land soft and quiet — landing quality first'),
      lift('Trap Bar Deadlift', 'B', p.s, p.r, pct(p.pct), '3010', '1:30', 'AA: 40–65% (Bompa)'), lift('DB Single Arm Row', 'B', p.s, p.r + 'ea', p.rpe, '3010', '1:30'),
      lift('RFE Split Squat (DB)', 'C', p.s, p.r + 'ea', p.rpe, '3010', '1:00', 'Full depth'), lift('45° Back Extension', 'C', p.s, 12, 'BW', '2011', '1:00'),
      lift('Copenhagen Plank', 'D', 2, '20s ea', 'BW', '', ':30', 'Adductor capacity'), lift('SL Elevated Calf Raise', 'D', 2, '12ea', 'BW', '2111', ':30'),
      lift('Dead Bug', 'E', 2, '6ea', 'BW', '3131', ':30'),
    ])]);
    const UA = day('', 'lift', 'Upper A', [blk('lift', 'Upper Strength', [
      lift('MB Side Toss', 'A', 3, '4ea', '8 lb MB', '', '1:00', 'Max intent, full rest'),
      lift('Incline DB Press', 'B', p.s, p.r, pct(p.pct), '3010', '1:30'), lift('Chin Up', 'B', p.s, Math.min(p.r, 8), 'BW', '3010', '1:30'),
      lift('SA Cable Row', 'C', p.s, p.r + 'ea', p.rpe, '2011', '1:00'), lift('Push-Up', 'C', p.s, 12, 'BW', '2010', '1:00'),
      lift('Face Pull', 'D', 2, 15, 'Light', '2011', ':45'),
    ].concat(ARM_CARE(2)))]);
    const LB = day('', 'lift', 'Lower B · Max Velocity', [maxVBlock(0), blk('lift', 'Lower Strength', [
      lift('Box Jump', 'A', 3, 3, 'BW', '', '1:00', 'Step down — don\'t jump down'),
      lift('Front Squat', 'B', p.s, Math.min(p.r, 10), pct(p.pct), '3010', '1:30'), lift('Bb Hip Bridge', 'B', p.s, p.r, p.rpe, '2011', '1:30', 'Pause at the top'),
      lift('Goblet Lateral Lunge', 'C', p.s, '8ea', p.rpe, '2010', '1:00', 'Frontal plane'), lift('Slideboard Leg Curl', 'C', p.s, 10, 'BW', '3010', '1:00'),
      lift('Side Plank', 'D', 2, '30s ea', 'BW', '', ':30'), lift('Pallof Press', 'E', 2, '10ea', 'Light', '2', ':30'),
    ])]);
    const UB = day('', 'lift', 'Upper B', [blk('lift', 'Upper Strength', [
      lift('Med Ball Chest Pass', 'A', 3, 5, '8 lb MB', '', '1:00'),
      lift('DB Floor Press', 'B', p.s, p.r, pct(p.pct), '3010', '1:30'), lift('TB Pendlay Row', 'B', p.s, p.r, p.rpe, '2010', '1:30'),
      lift('Half Kneeling Landmine Press', 'C', p.s, p.r + 'ea', p.rpe, '2010', '1:00'), lift('Lat Pulldown', 'C', p.s, p.r, pct(p.pct), '3010', '1:00'),
      lift('Farmer Carry', 'D', 2, '30yd', 'RPE 6', '', '1:00'),
    ].concat(ARM_CARE(2)))]);
    return week(n, 'AA W' + n + ' · ' + p.s + 'x' + p.r, four(LA, UA, LB, UB));
  };
  add({ key: 'prep', category: 'Method Library · Prep / GPP', phaseType: 'structural', sq: { hyp: 2, relstr: 1 }, source: 'Bompa anatomical adaptation · The System prep phase · ALTIS warm-ups · 8 Vector distance progression',
    name: '🧱 Prep — Anatomical Adaptation (3 wk)',
    notes: 'Bompa AA: 2–3 x 8–12 at 40–65%, tendons and work capacity first. ALTIS warm-ups stay fixed so they double as the daily screen. Sprints follow the 8 Vector distance progression (start at 10 yd, add 5–10 yd a week). Landing quality before jump volume.' },
    [wk(1), wk(2), wk(3)]);
}

// ── 3. Hypertrophy Clusters (Jake Tuura HCP 1.2) ─────────────────────────────
function clusterWeek(n, ph, label, deload, wi) {
  // ph: { s, r, lo, hi, rest, accS, accR, metS, metR, rm }
  const cl = (name, pair, notes) => lift(name, pair, deload ? 1 : ph.s, deload ? 20 : ph.r, deload ? '50%' : (BY[name].liftKey && !/Pull Up/.test(name) ? pct(Math.min(ph.hi, ph.lo + 2.5 * (wi || 0))) : '~' + ph.rm + 'RM'), '20X0', deload ? '1:00' : ph.rest, notes || (deload ? 'Deload — 1 x 20 ~50%' : 'Cluster — alternate with the paired lift, ~45 s between'));
  const acc = (name, pair, reps, notes) => lift(name, pair, deload ? 1 : ph.accS, deload ? 15 : (reps || ph.accR), deload ? 'Light' : 'RPE 7–8', '2010', '1:00', notes || 'Double progression');
  const met = (name, pair, reps, notes) => deload ? null : lift(name, pair, ph.metS, reps || ph.metR, 'Light', '1010', ':30', notes || 'Metabolic — beat last week\'s reps');
  const LA = day('', 'lift', 'Lower A · Acceleration', [deload ? accelBlock(0) : accelBlock(n <= 3 ? 1 : 2), blk('lift', 'Clusters', [
    lift('Power Skips- Distance', 'A', 3, 3, 'BW', '', '1:00', 'CNS primer — max intent, full rest'),
    cl('Trap Bar Deadlift', 'B', 'Off your trap bar bracket estimate'), cl('Chest Supported DB Row', 'B'),
    acc('RFE Split Squat (DB)', 'C', null, 'Full depth'), acc('45° Back Extension', 'C', '12–15'),
    met('Leg Extension', 'D', null, 'Pump — 30 s rest'), met('Seated Leg Curl', 'D', null, 'Pump — 30 s rest'),
    lift('Half Kneeling Cable Chop', 'E', 2, '10ea', 'Light', '2010', ':30'),
  ])]);
  const UA = day('', 'lift', 'Upper A', [blk('lift', 'Clusters', [
    lift('Med Ball Rotational Scoop Toss', 'A', 3, '3ea', '8 lb MB', '', '1:00', 'Max intent'), lift('Med Ball Chest Pass', 'A', 3, 5, '8 lb MB', '', '1:00'),
    cl('Neutral Grip DB Bench Press', 'B', 'Pitchers: landmine press instead'), cl('Pull Up (Weighted)', 'B', 'Band-assist if needed; BW + added weight'),
    acc('Half Kneeling Landmine Press', 'C', null), acc('SA Cable Row', 'C', null),
    met('DB Hammer Curl', 'D', null), met('Rope Pushdown', 'D', null),
    lift('Side-Lying DB External Rotation', 'E', 2, '12–15ea', 'Light', '3010', ':30', 'Arm care'), lift('Y-T-W', 'E', 2, '12–15', 'Light', '2010', ':30', 'Prone Y / T'),
  ])]);
  const LB = day('', 'lift', 'Lower B · Max Velocity', [deload ? maxVBlock(0) : maxVBlock(n <= 3 ? 1 : 2), blk('lift', 'Clusters', [
    lift('Pogo Jumps', 'A', 2, 10, 'BW', '', ':45', 'CNS primer'),
    cl('Safety Bar Squat', 'B', 'Full depth'), cl('Barbell Hip Thrust', 'B', 'Pause at the top'),
    acc('SL DB RDL', 'C', '10ea'), acc('Goblet Lateral Lunge', 'C', '10ea', 'Frontal plane'),
    met('Leg Press', 'D', null, 'Feet low'), met('Standing Calf Raise', 'D', 20, '2 s pause at the bottom'),
    lift('Copenhagen Plank', 'E', 2, '25s ea', 'BW', '', ':30', 'Adductor capacity'),
  ])]);
  const UB = day('', 'lift', 'Upper B', [blk('lift', 'Clusters', [
    lift('Med Ball Overhead Slam', 'A', 3, 5, '10 lb MB', '', '1:00'), lift('Plyo Push Up', 'A', 3, 5, 'BW', '', '1:00'),
    cl('Incline DB Press', 'B', 'Pitchers: half-kneeling cable press'), cl('Chest Supported T-Bar Row', 'B', null),
    acc('DB Single Arm Row', 'C', null, 'Full stretch'), acc('DB Lateral Raise', 'C', '12–15'),
    met('Incline DB Curl', 'D', null, 'Long-length bias'), met('Overhead Cable Triceps Extension', 'D', null, 'Long-length bias'),
    lift('Band ER at 90/90', 'E', 2, 15, 'Band', '2010', ':30', 'Arm care'), lift('Serratus Wall Slide', 'E', 2, 15, 'BW', '2010', ':30'),
  ])]);
  return week(n, label, four(LA, UA, LB, UB), deload);
}
{
  const P1 = { s: 8, r: 5, lo: 65, hi: 70, rest: ':45', accS: 3, accR: '12–15', metS: 2, metR: '20–30', rm: 12 };
  const P2 = { s: 10, r: 4, lo: 70, hi: 75, rest: '1:00', accS: 3, accR: '10–12', metS: 2, metR: '20–25', rm: 10 };
  const P3 = { s: 12, r: 3, lo: 75, hi: 80, rest: '1:15', accS: 3, accR: '8–10', metS: 2, metR: '15–20', rm: 8 };
  const full = [clusterWeek(1, P1, 'P1 W1 · 8x5 · Test week'), clusterWeek(2, P1, 'P1 W2 · 8x5', false, 1), clusterWeek(3, P1, 'P1 W3 · 8x5', false, 2),
    clusterWeek(4, P2, 'P2 W4 · 10x4 · Test week'), clusterWeek(5, P2, 'P2 W5 · 10x4', false, 1), clusterWeek(6, P2, 'P2 W6 · 10x4', false, 2),
    clusterWeek(7, P3, 'P3 W7 · 12x3 · Test week'), clusterWeek(8, P3, 'P3 W8 · 12x3', false, 2), clusterWeek(9, P3, 'Deload · 1x20', true)];
  const short = [clusterWeek(1, P1, 'P1 W1 · 8x5 · Test week'), clusterWeek(2, P1, 'P1 W2 · 8x5', false, 1), clusterWeek(3, P2, 'P2 W3 · 10x4 · Test week'),
    clusterWeek(4, P2, 'P2 W4 · 10x4', false, 2), clusterWeek(5, P3, 'P3 W5 · 12x3 · Test week'), clusterWeek(6, P3, 'P3 W6 · 12x3', false, 2), clusterWeek(7, P3, 'Deload · 1x20', true)];
  const notes = 'Tuura HCP 1.2: halve reps, double sets, same load — clusters at 65–80%, 45–90 s rest, ~36–40 cluster reps per lift. Week 1 of each phase: top set at RPE 8 sets that phase\'s loads; then +2.5% (5 lb / one DB jump) if every cluster stayed ≤ RPE 7. Accessories: double progression. Speed (A pairs + warm-up) is never cut for lifting. Body weight goal +1–2 lb/wk if gaining.';
  add({ key: 'hyp-clusters', category: 'Method Library · Hypertrophy', phaseType: 'accumulation', sq: { hyp: 1, fhyp: 2 }, source: 'Jake Tuura — Hypertrophy Cluster Protocol 1.2', pitcher: true,
    name: '💪 Hypertrophy Clusters (9 wk)', notes }, full);
  add({ key: 'hyp-clusters-short', category: 'Method Library · Hypertrophy', phaseType: 'accumulation', sq: { hyp: 1, fhyp: 2 }, source: 'Jake Tuura — Hypertrophy Cluster Protocol 1.2 (2+2+2 short version)', pitcher: true,
    name: '💪 Hypertrophy Clusters — Short (7 wk)', notes: notes + ' Short version: 2 + 2 + 2 weeks + deload.' }, short);
}

// ── 4. Poliquin — Accumulation / Intensification (12 wk) ─────────────────────
{
  const PH = [
    { lab: 'Acc 1', s: 3, r: '10–12', l: '70–75%', bs: 3, br: '12–15', ra: '1:30', rb: '1:15', t: '4010' },
    { lab: 'Int 1', s: 5, r: '4–6', l: '82–88%', bs: 4, br: '6–8', ra: '4:00', rb: '2:00', t: '40X0' },
    { lab: 'Acc 2', s: 4, r: '8–10', l: '75–78%', bs: 3, br: '10–12', ra: '2:00', rb: '1:30', t: '4010' },
    { lab: 'Int 2', s: 5, r: '3–5', l: '85–90%', bs: 4, br: '5–7', ra: '5:00', rb: '2:00', t: '40X0' },
    { lab: 'Acc 3', s: 4, r: '5–7', l: '80–85%', bs: 3, br: '8–10', ra: '4:00', rb: '1:30', t: '4010' },
    { lab: 'Int 3', s: 6, r: '2–3', l: '90–95%', bs: 3, br: '4–6', ra: '5:00', rb: '2:00', t: '40X0' },
  ];
  const lowerA = ['Db Split Squat', 'Db Split Squat', 'Db Lunge', 'Db Lunge', 'Back Squat', 'Back Squat'];
  const lowerB = ['Poliquin Dumbbell Step-up', 'Poliquin Dumbbell Step-up', 'Bb Split Squat', 'Bb Split Squat', 'Trap Bar Deadlift', 'Trap Bar Deadlift'];
  const pressA = ['DB Floor Press', 'DB Floor Press', 'Incline DB Press', 'Incline DB Press', 'Incline DB Press', 'Incline DB Press'];
  const pressB = ['Db Bench Press', 'Db Bench Press', 'DB Floor Press', 'DB Floor Press', 'Push Press', 'Push Press'];
  const wk = (n, client) => {
    const i = Math.floor((n - 1) / 2), p = PH[i];
    const A = (name, pair, notes) => lift(name, pair, p.s, p.r, BY[name].liftKey ? p.l : 'RPE ' + (p.lab[0] === 'A' ? '7–8' : '8–9'), p.t, p.ra, notes);
    const B = (name, pair, notes) => lift(name, pair, p.bs, p.br, 'RPE 7–8', '4010', p.rb, notes);
    const C = (name, reps) => lift(name, 'E', 3, reps || '10–12', 'Light', '4010', '1:00', 'Poliquin remedial — every upper day');
    const sp = (fn) => client ? null : fn;
    const LA = day('', 'lift', 'Lower 1', [sp(accelBlock(i < 2 ? 1 : 2)), blk('lift', 'Lower', [
      lift('Broad Jump W/ Stick', 'A', 3, 3, 'BW', '', '1:00'),
      A(lowerA[i], 'B', i >= 4 ? 'Hang clean pull pairs in from Acc 3 (Poliquin)' : null), A('SL SB Leg Curl', 'B', 'Unilateral leg curl'),
      B('Db Step-Up', 'C'), B('45° Back Extension', 'C'), lift('Seated Calf Raise', 'D', 3, '12–15', 'RPE 8', '2011', '1:00'),
    ])]);
    const UA = day('', 'lift', 'Upper 1', [blk('lift', 'Upper', [
      lift('Med Ball Chest Pass', 'A', 3, 5, '8 lb MB', '', '1:00'),
      A(pressA[i], 'B'), A(i < 2 ? 'DB Single Arm Row' : 'Chin Up', 'B', 'Kneeling row → chin-up variations'),
      B('Half Kneeling Landmine Press', 'C'), B('Cable High to Low Row (SS)', 'C'),
      C('Side-Lying DB External Rotation'), C('Y-T-W', '10'),
    ])]);
    const LB = day('', 'lift', 'Lower 2', [sp(maxVBlock(i < 2 ? 1 : 2)), blk('lift', 'Lower', [
      lift('Box Jump', 'A', 3, 3, 'BW', '', '1:00'),
      A(lowerB[i], 'B'), A('Glute-Ham Raise', 'B'),
      B('Goblet Lateral Lunge', 'C'), B('Reverse Hyper', 'C'), lift('Copenhagen Plank', 'D', 2, '25s ea', 'BW', '', ':45'),
    ])]);
    const UB = day('', 'lift', 'Upper 2', [blk('lift', 'Upper', [
      lift('Med Ball Overhead Slam', 'A', 3, 5, '10 lb MB', '', '1:00'),
      A(pressB[i], 'B'), A(i < 2 ? 'Lat Pulldown' : 'Pull Up (Weighted)', 'B'),
      B('DB Single Arm Row', 'C'), B('Push-Up', 'C'),
      C('Band External Rotation'), C('Face Pull', '12–15'),
    ])]);
    return week(n, p.lab + ' · W' + n + ' · ' + p.s + 'x' + p.r, four(LA, UA, LB, UB));
  };
  const weeks = n => Array.from({ length: 12 }, (_, x) => wk(x + 1, n));
  const notes = 'Poliquin men\'s absolute-strength template, upper/lower: Accumulation (volume) alternates with Intensification (load) every 2 weeks. Rep target sets the effect, load follows (Z2 9–12 → Z4 1–5). TUT check per set on A series. Every upper day ends with external rotation and trap-3 remedials, 3 x 10–12 at 4010.';
  add({ key: 'poliquin', category: 'Method Library · Strength', phaseType: 'transmutation', sq: { fhyp: 1, maxstr: 2 }, source: 'Poliquin — Foundations of Periodization & Program Design',
    name: '🏛 Poliquin Acc / Int (12 wk)', notes }, weeks(false));
  add({ key: 'c-poliquin', group: 'client', category: 'Private Client · Strength', phaseType: 'transmutation', sq: { fhyp: 1, maxstr: 2 }, source: 'Poliquin — Foundations of Periodization & Program Design',
    name: '🏛 Client · Poliquin Acc / Int (12 wk)', notes: notes + ' Client version: no sprint block — warm up, then lift.' }, weeks(true));
}

// ── 5. KILO — Acc / Int mesocycles (12 wk) ───────────────────────────────────
{
  const M = [
    { lab: 'Acc 1', s: 3, r: '10–12', l: '70%', t: '3010', rest: '2:00', u1: 'Arnold Press', l1: 'Back Squat', u2: 'Dip (Weighted)', l2: 'Front Squat' },
    { lab: 'Int 1', s: 5, r: '5–7', l: '80%', t: '30X0', rest: '3:00', u1: 'Push Press', l1: 'Safety Bar Squat', u2: 'Db Bench Press', l2: 'Trap Bar Deadlift' },
    { lab: 'Acc 2', s: 4, r: '12, 10, 8, 8', l: '75%', t: '3010', rest: '2:30', u1: 'Arnold Press', l1: 'Back Squat', u2: 'Incline DB Press', l2: 'Front Squat' },
    { lab: 'Int 2', s: 6, r: '3–5', l: '85%', t: '30X0', rest: '3:30', u1: 'Push Press', l1: 'Safety Bar Squat', u2: 'Db Bench Press', l2: 'Trap Bar Deadlift' },
  ];
  const wk = (n, client) => {
    const i = Math.floor((n - 1) / 3), m = M[i], w = (n - 1) % 3;
    const A = (name, notes) => lift(name, 'B', m.s, m.r, BY[name].liftKey ? m.l : 'RPE ' + (8 + (i % 2)), m.t, m.rest, notes || 'A-series — same lift all 3 weeks; add load weekly');
    const Bs = (name, reps) => lift(name, 'C', 3, reps || (i % 2 ? '6–8' : '10–12'), 'RPE 7–8', '3010', '1:30');
    const R = (name, reps) => lift(name, 'E', 2, reps || '12–15', 'Light', '2010', ':45', 'C/D remedial');
    const sp = (fn) => client ? null : fn;
    const U1 = day('', 'lift', 'Upper 1', [blk('lift', 'Upper', [lift('MB Side Toss', 'A', 3, '4ea', '8 lb MB', '', '1:00'), A(m.u1), lift('Chin Up', 'B', m.s, i % 2 ? '4–6' : '8–10', 'BW', '3010', m.rest, 'Chin-up paired with every upper day'), Bs('DB Single Arm Row'), Bs('Half Kneeling Landmine Press'), R('Face Pull'), R('Cable External Rotation', '10ea')])]);
    const L1 = day('', 'lift', 'Lower 1', [sp(accelBlock(i ? 2 : 1)), blk('lift', 'Lower', [lift('Box Jump', 'A', 3, 3, 'BW', '', '1:00'), A(m.l1), Bs('RFE Split Squat (DB)', i % 2 ? '6ea' : '10ea'), Bs('Glute-Ham Raise', i % 2 ? '5' : '8'), lift('Seated Calf Raise', 'D', 3, 12, 'RPE 8', '2011', '1:00'), R('Dead Bug', '6ea')])]);
    const U2 = day('', 'lift', 'Upper 2', [blk('lift', 'Upper', [lift('Med Ball Chest Pass', 'A', 3, 5, '8 lb MB', '', '1:00'), A(m.u2), lift('Pull Up (Weighted)', 'B', m.s, i % 2 ? '3–5' : '6–8', i % 2 ? '85%' : '75%', '3010', m.rest), Bs('TB Pendlay Row'), Bs('DB Lateral Raise', '12'), R('Y-T-W', '8'), R('Band External Rotation', '15ea')])]);
    const L2 = day('', 'lift', 'Lower 2', [sp(maxVBlock(i ? 2 : 1)), blk('lift', 'Lower', [lift('Broad Jump W/ Stick', 'A', 3, 3, 'BW', '', '1:00'), A(m.l2, m.l2 === 'Trap Bar Deadlift' ? 'Trap bar in SPP — no conventional deadlifts near the season (KILO)' : null), Bs('Bb RDL', i % 2 ? '6' : '10'), Bs('Goblet Lateral Lunge', '8ea'), lift('Copenhagen Plank', 'D', 2, '25s ea', 'BW', '', ':45'), R('Pallof Press', '10ea')])]);
    return week(n, m.lab + ' · W' + (w + 1), four(L1, U1, L2, U2));
  };
  const notes = 'KILO 3-week mesocycles: Acc 1 70% 3x10–12 → Int 1 80% 5x5–7 → Acc 2 75% descending 12/10/8/8 → Int 2 85% 6x3–5. Same A lifts for all 3 weeks of a mesocycle. Acc→Int +8–15%; Acc→Acc +2–8%. Overhead press first in year 1 (limiting lift). Conventional deadlift only in Intensification, never in SPP.';
  add({ key: 'kilo', category: 'Method Library · Strength', phaseType: 'transmutation', sq: { fhyp: 1, maxstr: 2 }, source: 'KILO Strength Society — Athletic Development, Long/Short-Term Periodization', pitcher: true,
    name: '🏋 KILO Acc / Int Mesocycles (12 wk)', notes }, Array.from({ length: 12 }, (_, x) => wk(x + 1, false)));
  add({ key: 'c-kilo', group: 'client', category: 'Private Client · Strength', phaseType: 'transmutation', sq: { fhyp: 1, maxstr: 2 }, source: 'KILO Strength Society',
    name: '🏋 Client · KILO Acc / Int (12 wk)', notes: notes + ' Client version: no sprint block.' }, Array.from({ length: 12 }, (_, x) => wk(x + 1, true)));
}

// ── 6. Conjugate (Westside internship + Simmons Special Strength) ────────────
{
  const MEL = ['Trap Bar Deadlift', 'Box Squat', 'Bb Good Morning', 'Front Squat', 'Deficit Trap Bar Deadlift', 'Front Squat', 'Rack Pull', 'RFE Split Squat (BB)'];
  const MEU = ['Swiss Bar Floor Press', 'Swiss Bar Bench Press', 'Incline DB Press', 'Pull Up (Weighted)', 'Swiss Bar Floor Press', 'Swiss Bar Bench Press', 'Incline DB Press', 'Pull Up (Weighted)'];
  const DE = [50, 55, 60, 50, 55, 60, 50, 55];
  const MEU_P = [['Pull Up (Weighted)', '3RM'], ['Chest Supported DB Row', '5RM'], ['Half Kneeling Landmine Press', '5RM'], ['Pull Up (Weighted)', '3RM'], ['Pull Up (Weighted)', '3RM'], ['Chest Supported DB Row', '5RM'], ['Half Kneeling Landmine Press', '5RM'], ['Pull Up (Weighted)', '3RM']];
  const wk = (n, pitcher) => {
    const x = n - 1, de = DE[x], reset = x === 3 || x === 6;
    const LA = day('', 'lift', 'ME Lower · Acceleration', [accelBlock(2, 'Zone 5, 160–300 m'), blk('lift', 'Max Effort Lower', [
      lift('Box Jump', 'A', 3, 3, 'BW', '', '1:00', 'Resisted box jump (ME method) — chase a record'),
      lift(MEL[x], 'B', 1, '3RM', 'Work up', '', '3:00', 'ME: work up to a 3RM on this week\'s lift — new lift every week; ≤3 lifts at 90%+'),
      lift('RFE Split Squat (DB)', 'C', 3, '8–10ea', 'RPE 8', '2010', '1:30', 'RE — ~60% posterior / 40% anterior'), lift('Glute-Ham Raise', 'C', 3, 8, 'BW', '3010', '1:30'),
      lift('45° Back Extension', 'D', 3, '12–15', 'BW', '2011', '1:00'),
      lift('Sled March', 'E', 6, '30yd', 'Heavy', '', '1:00', 'GPP — heaviest sled of the week (Simmons)'),
    ])]);
    const UA = day('', 'lift', 'ME Upper', [blk('lift', 'Max Effort Upper', [
      lift('MB Side Toss', 'A', 3, '4ea', '8 lb MB', '', '1:00'),
      pitcher ? lift(MEU_P[x][0], 'B', 1, MEU_P[x][1], 'Work up', '', '3:00', 'Pitcher ME upper (Conjugate tab): pulls and landmine — no barbell pressing max')
        : lift(MEU[x], 'B', 1, '3RM', 'Work up', '', '3:00', 'ME: work up to a 3RM — rotate weekly'),
      lift('Chest Supported DB Row', 'C', 4, '10–12', 'RPE 8', '2010', '1:15', 'RE'), lift('DB Triceps Extension', 'C', 3, '12–15', 'RPE 8', '2010', '1:00', 'RE'),
      lift('Face Pull', 'D', 3, 15, 'Light', '2011', ':45'),
    ].concat(ARM_CARE(2)))]);
    const LB = day('', 'lift', 'DE Lower · Max Velocity', [maxVBlock(2), blk('lift', 'Dynamic Effort Lower', [
      lift('Box Squat', 'B', reset ? 10 : 12, 2, pct(de), '00X0', ':45', (reset ? 'Wave reset — new bar or band tension. ' : '') + 'DE ' + de + '% + light band (~25% at lockout); 0.7–0.9 m/s'),
      lift('Trap Bar Jumps', 'A', 5, 3, '20%', '', '1:00', 'Contrast after DE squat'),
      lift('SL DB RDL', 'C', 3, '10ea', 'RPE 7', '2010', '1:00'), lift('Reverse Hyper', 'C', 3, 15, 'Light', '1010', '1:00'),
      lift('Copenhagen Plank', 'D', 2, '30s ea', 'BW', '', ':45'),
      lift('Reverse Sled March', 'E', 1, '10 min', 'Light', '', '', 'GPP — 30% lighter, more trips'),
    ])]);
    const UB = day('', 'lift', 'DE Upper', [blk('lift', 'Dynamic Effort Upper', [
      lift('Plyo Push Up', 'A', 3, 5, 'BW', '', '1:00'),
      pitcher ? lift('MB Step Back Side Toss', 'B', 9, 3, '6 lb MB', '', ':45', 'Pitcher DE upper: med-ball throws 9 x 3 (Conjugate tab)')
        : lift('Swiss Bar Bench Press', 'B', 9, 3, 'Light — speed', '00X0', ':45', 'DE ~' + de + '% + light band, 3 grips'),
      lift('Pull Up', 'C', 4, '8–10', 'BW', '2010', '1:15'), lift('DB Single Arm Row', 'C', 3, '10–12ea', 'RPE 7', '2010', '1:00'),
      lift('DB Hammer Curl', 'D', 3, '12–15', 'Light', '2010', ':45'),
    ].concat(ARM_CARE(2)))]);
    return week(n, 'W' + n + ' · ME ' + MEL[x].replace(/ \(.*\)/, '') + ' · DE ' + de + '%' + (reset ? ' (reset)' : ''), four(LA, UA, LB, UB));
  };
  // 3-day: Mon ME lower + DE upper · Wed repeated effort + GPP · Fri DE lower + ME upper (72 h rule holds)
  const conj3 = (w4) => {
    const [LA, UA, LB, UB] = w4.days.filter(d => d.type !== 'off');
    const re = [].concat(repair(byPair(liftEx(LA), 'C'), 'A'), repair(byPair(liftEx(UA), 'C'), 'B'), repair(byPair(liftEx(LB), 'C'), 'C'), repair(byPair(liftEx(UB), 'D'), 'D'), byPair(liftEx(UA), 'E'));
    const wed = day('', 'esd', 'Repeated Effort + GPP', [tempoBlock(6, 'Zone 1–2'), blk('lift', 'Repeated Effort (8–15 reps)', re)]);
    return Object.assign({}, w4, { days: layout(3, { Mon: merge(LA, UB, 'ME Lower + DE Upper'), Wed: wed, Fri: merge(LB, UA, 'DE Lower + ME Upper') }) });
  };
  add({ key: 'conjugate', to3: conj3, pitcherWeeks: Array.from({ length: 8 }, (_, x) => wk(x + 1, true)), category: 'Method Library · Strength-Speed', phaseType: 'transmutation', sq: { maxstr: 1, strspd: 2, spdstr: 2 }, source: 'Westside Barbell Online Internship (Conjugate University) · Simmons, Special Strength Development', pitcher: true,
    name: '⚙ Conjugate — ME / DE (8 wk)',
    notes: 'Max effort lifts change every week (new list every 4 weeks); heavy triple instead of a true single for MLB athletes. DE runs 3-week waves (50/55/60% + ~25% band at lockout), then resets with a new bar or band. 72-hour rule between same-region ME and DE. RE accessories ~80% of volume; swap any held 3+ weeks that stall. No ME PR → rotate; DE speed drops → lower % or cut accessories.' },
    Array.from({ length: 8 }, (_, x) => wk(x + 1)));
}

// ── 7. Triphasic (Dietz — eccentric / isometric / reactive) ──────────────────
{
  const PH = [
    { lab: 'Eccentric', t: '60X0', a: [75, 78], b: [60, 65], note: '6 s lowering — never slow eccentrics above 85%; always finish explosively' },
    { lab: 'Isometric', t: '13X0', a: [80, 82.5], b: [62.5, 67.5], note: '3 s pause at the bottom — drop fast, "hit it like a brick", explode' },
    { lab: 'Reactive', t: '10X0', a: [85, 87.5], b: [65, 70], note: 'Reactive — fast down, minimal coupling, max intent' },
  ];
  const wk = (n) => {
    const i = Math.floor((n - 1) / 2), p = PH[i], w = (n - 1) % 2;
    const la = p.a[w], lb = p.b[w];
    const LA = day('', 'lift', 'Lower A · ' + p.lab, [accelBlock(2), blk('lift', 'French Contrast + Main', [
      lift('Back Squat', 'B', 3, i === 2 ? 3 : 3, pct(la), p.t, '3:00', p.note),
      lift('Hurdle Hop', 'B', 3, 4, 'BW', '', '', 'French contrast — plyometric'), lift('DB Squat Jump', 'B', 3, 4, '10–15 lb DBs', '', '', 'Weighted plyometric'), lift('Squat Jump', 'B', 3, 4, 'BW', '', '2:00', 'Accelerated / band-assisted if available; 2 min after the box'),
      lift('SL DB RDL', 'C', 3, '6ea', 'RPE 7', p.t, '1:30', p.lab + ' tempo on assistance too'), lift('Glute-Ham Raise', 'C', 3, 6, 'BW', p.t, '1:30'),
      lift('Copenhagen Plank', 'D', 2, '25s ea', 'BW', '', ':45'), lift('Dead Bug', 'E', 2, '6ea', 'BW', '3131', ':30'),
    ])]);
    const UA = day('', 'lift', 'Upper A · ' + p.lab, [blk('lift', 'French Contrast + Main', [
      lift('DB Floor Press', 'B', 3, 3, pct(la), p.t, '3:00', p.note), lift('Med Ball Chest Pass', 'B', 3, 4, '6 lb MB', '', '2:00', 'Med-ball drop pass in contrast'),
      lift('Chin Up', 'C', 3, 5, 'BW', p.t, '1:30'), lift('Chest Supported T-Bar Row', 'C', 3, 6, 'RPE 7', p.t, '1:30'),
      lift('MB Side Toss', 'A', 3, '4ea', '8 lb MB', '', '1:00'), lift('DB Lateral Raise', 'D', 2, 12, 'Light', '2010', ':45'),
    ].concat(ARM_CARE(2)))]);
    const LB = day('', 'lift', 'Lower B · Speed-Power', [maxVBlock(2), blk('lift', 'Speed-Strength', [
      lift('Trap Bar Deadlift', 'B', 4, 3, pct(lb), '10X0', '2:00', 'Day B ' + lb + '% — fast (0.8–1.0 m/s); Zone 9'),
      lift('Broad Jump W/ Stick', 'A', 3, 3, 'BW', '', '1:00'),
      lift('RFE Split Squat (DB)', 'C', 3, '6ea', 'RPE 7', p.t, '1:30'), lift('Lateral Bound', 'C', 3, '3ea', 'BW', '', '1:00', 'Frontal-plane power'),
      lift('Pallof Press', 'E', 2, '10ea', 'Light', '2', ':30'),
    ])]);
    const UB = day('', 'lift', 'Upper B · Speed-Power', [blk('lift', 'Speed-Strength', [
      lift('Push Press', 'B', 4, 3, pct(lb), '10X0', '2:00', 'Day B — fast'), lift('Pull Up (Weighted)', 'B', 4, 4, pct(lb + 10), p.t, '2:00'),
      lift('Plyo Push Up', 'A', 3, 5, 'BW', '', '1:00'), lift('DB Single Arm Row', 'C', 3, '8ea', 'RPE 7', p.t, '1:00'),
      lift('Face Pull', 'D', 2, 15, 'Light', '2011', ':45'),
    ].concat(ARM_CARE(2)))]);
    return week(n, p.lab + ' W' + (w + 1) + ' · ' + la + '% / ' + lb + '%', four(LA, UA, LB, UB));
  };
  add({ key: 'triphasic', category: 'Method Library · Strength-Speed', phaseType: 'transmutation', sq: { ecc: 1, maxstr: 2, power: 2 }, source: 'Triphasic Training (Dietz) — peaking manual, 13 loading zones, HS manual rules', pitcher: true,
    name: '🔺 Triphasic — Ecc / Iso / Reactive (6 wk)',
    notes: 'Eccentric (2 wk) → Isometric (2 wk) → Reactive (2 wk) on the main lifts, French-contrast boxes after the heavy set (main lift, plyo, weighted plyo, accelerated plyo). 4-day split: Day A heavy (Zones 10–11, ~75–87.5%), Day B fast (Zone 9, 60–70%). Eccentric rules: compound lifts only, never above 85%, always spot, always finish explosive. Follows the Hypertrophy Clusters block. Pitchers: upper boxes swap to landmine / cable pressing.' },
    Array.from({ length: 6 }, (_, x) => wk(x + 1)));
}

// ── 8. Triphasic undulated 3-day model (XLathlete HS manual) ────────────────
function undulated(key, name, lab, rows, phaseType, sq, client) {
  // rows[w] = [[d1 pct, reps, sets], [d2...], [d3...]] for the A1 lift
  const wk = (n) => {
    const r = rows[n - 1];
    const A1 = (name, d, notes) => lift(name, 'B', r[d][2], r[d][1], pct(r[d][0]), '20X0', d === 1 ? '3:00' : '2:00', notes);
    const sp = (fn) => client ? null : fn;
    const D1 = day('', 'lift', 'Day 1 · Submax', [sp(accelBlock(2)), blk('lift', 'Main + Assistance', [
      A1('Back Squat', 0, 'Day 1 submax — paired with hurdle hops'), lift('Hurdle Hop', 'B', r[0][2], 3, 'BW', '', '', 'Paired plyo'),
      A1('DB Floor Press', 0), lift('Med Ball Chest Pass', 'A', 3, 4, '6 lb MB', '', '1:00'),
      lift('DB Single Arm Row', 'C', 3, '8ea', 'RPE 7', '2010', '1:00'), lift('Db Step-Up', 'C', 3, '6ea', 'RPE 7', '2010', '1:00'),
      lift('Arnold Press', 'D', 3, 8, 'RPE 7', '2010', '1:00'), lift('Glute-Ham Raise', 'D', 3, 6, 'BW', '3010', '1:00'),
      lift('SL Elevated Calf Raise', 'E', 2, '12ea', 'BW', '1011', ':30', 'Tib / foot-ankle work'),
    ])]);
    const D2 = day('', 'lift', 'Day 2 · Max', [sp(maxVBlock(2)), blk('lift', 'Main + Assistance', [
      A1('Back Squat', 1, 'Day 2 max — heaviest day of the week'), A1('DB Floor Press', 1, 'Clusters allowed: 2 reps, 20 s between reps'),
      lift('Pull Up', 'C', 3, '6–8', 'BW', '2010', '1:30'), lift('Db Lunge', 'C', 3, '6ea', 'RPE 7', '2010', '1:30'),
      lift('Incline DB Press', 'D', 3, 8, 'RPE 7', '2010', '1:00'), lift('Bb RDL', 'D', 3, 8, 'RPE 7', '3010', '1:00'),
      lift('Pallof Press', 'E', 2, '10ea', 'Light', '2', ':30'),
    ])]);
    const D3 = day('', 'lift', 'Day 3 · Volume', [sp(tempoBlock(6)), blk('lift', 'Main + Assistance', [
      A1('Front Squat', 2, 'Day 3 volume — lighter, paired with SL hurdle hops and skaters'), lift('Skaters W/ Catch', 'B', r[2][2], '3ea', 'BW', '', '', 'Paired plyo'),
      A1('Db Bench Press', 2), lift('MB Step Back Side Toss', 'A', 3, '4ea', '8 lb MB', '', '1:00'),
      lift('Cable High to Low Row (SS)', 'C', 3, '10ea', 'RPE 7', '2010', '1:00'), lift('Goblet Lateral Lunge', 'C', 3, '8ea', 'RPE 7', '2010', '1:00'),
      lift('SL BB Hip Bridge', 'D', 3, '8ea', 'RPE 7', '2011', '1:00'),
    ].concat(ARM_CARE(2)))]);
    return week(n, lab + ' W' + n + ' · ' + r.map(x => x[0]).join(' / ') + '%', layout(3, { Mon: D1, Wed: D2, Fri: D3 }));
  };
  const weeks = rows.map((_, x) => wk(x + 1));
  // 4-day: add an upper speed/accessory day on Thu (keeps the 3-day undulation intact)
  const w4 = weeks.map(w => {
    const D4 = day('', 'lift', 'Day 4 · Upper Speed + Arm Care', [client ? null : accelBlock(3), blk('lift', 'Upper Accessory', [
      lift('Plyo Push Up', 'A', 3, 5, 'BW', '', '1:00'), lift('MB Side Toss', 'A', 3, '4ea', '8 lb MB', '', '1:00'),
      lift('Chin Up', 'B', 3, '6–8', 'BW', '2010', '1:30'), lift('Half Kneeling Landmine Press', 'B', 3, '8ea', 'RPE 7', '2010', '1:30'),
      lift('Face Pull', 'C', 3, 15, 'Light', '2011', ':45'), lift('DB Incline Zottman Curl', 'C', 3, 12, 'Light', '2010', ':45'),
    ].concat(ARM_CARE(2)))]);
    const map = {}; w.days.forEach(d => { if (d.type !== 'off') map[d.day] = d; }); map.Thu = D4; map.Fri = map.Fri; // Mon / Wed / Thu / Fri
    return Object.assign({}, w, { days: layout(4, { Mon: map.Mon, Tue: map.Wed, Thu: map.Thu, Fri: map.Fri }) });
  });
  return { weeks3: weeks, weeks4: w4 };
}
{
  const STR = [[[77.5, '1–3', 5], [85, '1–2', 5], [72.5, '4–5', 5]], [[80, '1–2', 5], [87.5, 1, 4], [75, '4–5', 5]], [[82.5, '1–2', 5], [90, 1, 4], [77.5, '3–5', 5]], [[85, '1–2', 5], [92.5, 1, 4], [80, '3–4', 5]]];
  const SS = [[[65, '3–4', 5], [75, '1–2', 5], [55, '3–6', 5]], [[67.5, '3–4', 5], [77.5, '1–2', 5], [60, '3–6', 5]], [[72.5, '3–4', 5], [80, '1–2', 4], [65, '3–6', 5]]];
  const notesS = 'XLathlete undulated model: Day 1 submax, Day 2 max (heaviest), Day 3 volume. 4-week strength progression steps up 2.5% per day each week. Rep quality caps from the rep-scheme table (e.g. 85% = 1–2 quality reps). Update 1RMs with a test set (5@55%, 3@70%, 1–3@80%) on Day 1 every 3–4 weeks — no max-test days.';
  const notesSS = 'XLathlete undulated speed-strength block: 65–72.5% / 75–80% / 55–65%, 3–4 weeks, between the strength block and high-velocity work. Move the bar fast — full rest on max-speed work or it becomes conditioning.';
  for (const [key, name, lab, rows, pt, sq, notes, grp] of [
    ['undulated-strength', '📈 Triphasic Undulated — Strength (4 wk)', 'Strength', STR, 'transmutation', { maxstr: 1, relstr: 2 }, notesS, 'athlete'],
    ['undulated-ss', '⚡ Triphasic Undulated — Speed-Strength (3 wk)', 'Speed-Strength', SS, 'realization', { spdstr: 1, power: 2 }, notesSS, 'athlete'],
    ['c-undulated-strength', '📈 Client · Undulated Strength (4 wk)', 'Strength', STR, 'transmutation', { maxstr: 1, relstr: 2 }, notesS + ' Client version: no sprint block.', 'client'],
    ['c-undulated-ss', '⚡ Client · Undulated Speed-Strength (3 wk)', 'Speed-Strength', SS, 'realization', { spdstr: 1, power: 2 }, notesSS + ' Client version: no sprint block.', 'client'],
  ]) {
    const u = undulated(key, name, lab, rows, pt, sq, grp === 'client');
    const meta = { category: (grp === 'client' ? 'Private Client' : 'Method Library') + ' · ' + (pt === 'realization' ? 'Power' : 'Strength'), phaseType: pt, sq, name, notes, group: grp, variant: 'all',
      source: 'Triphasic Training — XLathlete High School Manual 2.0 (undulated 3-day model)' };
    T.push(Object.assign({}, meta, { key: key + '-3', days: 3, weeks: u.weeks3 }));
    T.push(Object.assign({}, meta, { key: key + '-4', days: 4, weeks: u.weeks4 }));
    if (grp === 'athlete') {
      T.push(Object.assign({}, meta, pitcherize({ weeks: u.weeks3 }), { key: key + '-3-p', days: 3, variant: 'pitcher' }));
      T.push(Object.assign({}, meta, pitcherize({ weeks: u.weeks4 }), { key: key + '-4-p', days: 4, variant: 'pitcher' }));
    }
  }
}

// ── 9. Vertical Jump Protocol (Jake Tuura, 5 wk) ─────────────────────────────
{
  const B = [{ fc: '70–75%', co: '55–60%', cl: '3,3', fs: 2, cs: 4, ps: 2, rpe: 'RPE 7–8', tank: 'leave 4–5 reps in the tank' },
    { fc: '80–85%', co: '60–65%', cl: '2,2', fs: 3, cs: 6, ps: 2, rpe: 'RPE 8–9', tank: 'quick but heavier — 3–4 in the tank' },
    { fc: '50–60%', co: '50–60%', cl: '5,5', fs: 1, cs: 2, ps: 1, rpe: 'RPE 6–7', tank: 'extremely quick — 5–6 in the tank' }];
  const wk = (n) => {
    const i = n <= 2 ? 0 : n <= 4 ? 1 : 2, b = B[i];
    const ecc = i === 2 ? '10X0' : '50X0';
    const LA = day('', 'lift', 'Lower · French Contrast', [blk('speed', 'CNS Primers', [
      spd('Power Skips- Height', 'A', b.ps, 1, '20yd', '90%', ':45'), spd('2pt Start (LSV)', 'A', b.ps, 1, '20yd', '95%+', '1:30', 'Counts toward Monday\'s Zone 5 volume'), spd('Power Skips- Distance', 'A', b.ps, 1, '20yd', '90%', ':45'),
    ]), blk('lift', 'French Contrast', [
      lift('Split Squat Iso (heel wedge)', 'A', b.ps === 1 ? 2 : (i ? 3 : 2), '5s ea', 'Max effort', '', ':45', 'Iso pin pull — bottom wk 1–2, top from wk 3'),
      lift('CMJ', 'A', 1, '3–5', 'BW', '', ':45', 'Test — ForceDecks CMJ (jump height, RSI-mod)'),
      lift('Back Squat', 'B', b.fs, b.cl, b.fc, ecc, ':25', 'Band-resisted, clusters ' + b.cl + (i === 2 ? ' (medium bands, explosive)' : ' · 5 s eccentric')),
      lift('Drop Jump', 'B', b.fs, 4, 'BW', '', ':25', i === 2 ? 'Standing box jump in wk 5' : '12–18 in'), lift('DB Squat Jump', 'B', b.fs, 4, '10–15 lb', '1', ':25', '1 s pause'),
      lift('Squat Jump', 'B', b.fs, 4, 'BW', '1', ':25', 'Band-assisted with pause if available'), lift('Single Leg Squat', 'B', b.fs, '10ea', 'BW', '', ':25', 'Toes-up SL squat'), lift('Dribbles (Ankle)', 'B', b.fs, '20ea', '', '', '2:00', 'Ankle shuffle · 2 min after the circuit'),
      lift('Barbell Hip Thrust', 'C', b.fs, 3, b.rpe, '50X0', '1:15'), lift('RFE Split Squat (DB)', 'C', b.fs, '3ea', b.rpe, '50X0', '1:15'),
      lift('Goblet Lateral Lunge', 'D', b.fs, '5ea', b.rpe, '', '1:00'),
    ])]);
    const UA = day('', 'lift', 'Upper · French Contrast', [blk('lift', 'French Contrast', [
      lift('MB Side Toss', 'A', b.ps, '3ea', '8 lb MB', '', ':45', 'Rotation scoop + slam — keep for every athlete (rotation)'),
      lift('Bb Close Grip Bench Press', 'B', b.fs, b.cl, b.fc, ecc, ':25', 'Band-resisted, clusters ' + b.cl),
      lift('MB Step Back Side Toss', 'B', b.fs, '5ea', '5–15 lb', '', ':25'), lift('Inverted Row', 'B', b.fs, 10, 'BW', '1', ':25', '1 s pause'),
      lift('Push-Up', 'B', b.fs, 5, 'BW', '1', ':25', 'Band-assisted push-up w/ pause'), lift('Pogo Jumps', 'B', b.fs, 20, 'BW', '', ':25', 'Assisted pogo hops'), lift('Cuban Press', 'B', b.fs, 10, '5–10 lb', '', '2:00', 'Bent-over · 2 min after the circuit'),
      lift('DB Single Arm Row', 'C', b.fs, 3, b.rpe, '50X0', '1:15'), lift('Incline DB Press', 'C', b.fs, 3, b.rpe, '50X0', '1:15'),
      lift('Chin Up', 'D', b.fs, 3, b.rpe, '50X0', '1:15'), lift('Push Press', 'D', b.fs, 3, b.rpe, '', '1:15'),
      lift('MB Shotput Side Toss', 'E', 1, '10–15 min', '', '', '', 'Sport action: swings, rotational MB or first-step work (replaces dunking)'),
    ])]);
    const LB = day('', 'lift', 'Lower · Concentric-Only', [blk('lift', 'Concentric-Only', [
      lift('Box Jump', 'A', b.ps === 1 ? 1 : 3, 3, 'BW', '', ':45', i ? 'Approach box jump from wk 3' : 'Standing box jump'),
      lift('SL Elevated Calf Raise', 'A', b.ps === 1 ? 1 : 3, '5s ea', 'Max effort', '', ':45', 'Iso calf raise — bottom wk 1–2, top from wk 3'),
      lift('CMJ', 'A', 1, '3–5', 'BW', '', ':45', 'Test — ForceDecks CMJ'),
      lift('Trap Bar Deadlift', 'B', b.cs, 5, b.co, 'Conc-only', ':40', 'Concentric-only, drop it — ' + b.tank),
      lift('Cossack Squat', 'B', 2, '5ea', 'BW', '', ':30', '+ 15 s hip-flexor stretch'),
      lift('RFE Split Squat (DB)', 'C', b.cs, '3ea', b.rpe, i ? 'Conc-only' : '20X0', ':40', i ? 'Concentric-only from wk 3' : '2 s eccentric'),
      lift('Stability Ball Groin Squeeze', 'C', 2, 5, 'BW', '2', ':30', '2 s squeeze + X-band walk 3ea'),
      lift('Barbell Hip Thrust', 'D', i === 2 ? 1 : 2, 5, 'Heavy', 'Conc-only', '1:00', 'Red tier — as heavy as possible'),
      lift('Back Extension', 'D', i === 2 ? 1 : 2, 20, 'BW', '', '1:00'),
    ])]);
    const UB = day('', 'lift', 'Upper · Concentric-Only', [blk('lift', 'Concentric-Only', [
      lift('Med Ball Overhead Slam', 'A', b.ps, 5, '10 lb MB', '', ':45'), lift('MB Side Toss', 'A', b.ps, '5ea', '8 lb MB', '', ':45'),
      lift('Bb Close Grip Bench Press', 'B', b.cs, 5, b.co, 'Conc-only', ':40', 'Concentric-only — ' + b.tank), lift('DB Single Arm Row', 'B', b.cs, '5ea', b.rpe, 'Conc-only', ':40'),
      lift('Push Press', 'C', b.cs, 5, b.co, 'Conc-only', ':40'), lift('Chin Up', 'C', b.cs, 5, 'BW', '', ':40'),
      lift('Suitcase Carry', 'D', 2, '20yd ea', 'Heavy', '', '1:00', '1-arm farmer walk'), lift('X-Band Walk', 'D', 2, '5ea', 'Band', '', ':30'),
    ].concat(ARM_CARE(2)))]);
    return week(n, (i === 0 ? 'Introduce' : i === 1 ? 'Overload' : 'Recover — best jumps') + ' · W' + n, four(LA, UA, LB, UB), i === 2);
  };
  // 3-day: Mon lower French contrast (+ upper concentric press/row), Wed upper French contrast, Fri lower concentric-only (+ carry, arm care)
  const vjp3 = (w4) => {
    const [LA, UA, LB, UB] = w4.days.filter(d => d.type !== 'off');
    const ub = liftEx(UB);
    const mon = clone(LA); mon.label = 'Lower French Contrast + Upper Press/Pull'; mon.blocks[mon.blocks.length - 1].exercises = liftEx(LA).concat(repair(byPair(ub, 'B'), 'E'));
    const fri = clone(LB); fri.label = 'Lower Concentric-Only + Carry'; fri.blocks[0].exercises = liftEx(LB).concat(byPair(ub, 'D'), byPair(ub, 'E'));
    return Object.assign({}, w4, { days: layout(3, { Mon: mon, Wed: clone(UA), Fri: fri }) });
  };
  add({ key: 'vjp', to3: vjp3, category: 'Method Library · Power', phaseType: 'realization', sq: { spdstr: 1, power: 1 }, source: 'Jake Tuura — Vertical Jump Protocol (4-day split)', pitcher: true,
    name: '🦘 Vertical Jump Protocol (5 wk)',
    notes: 'Weeks 1–2 introduce, 3–4 overload (small jump dip is expected), 5 recover — best jumps show up here. Mon/Tue French contrast with 5 s eccentrics (25 s between exercises, 2 min after the circuit); Thu/Fri concentric-only (drop the weight). Find 1RMs in week-1 warm-ups (squat Mon, bench Tue, trap bar Thu). Test CMJ on ForceDecks Mon and Thu. Best late off-season, after a strength block. Pitchers: landmine / half-kneeling cable press on upper days, upper French contrast held at 70–75%.' },
    Array.from({ length: 5 }, (_, x) => wk(x + 1)));
}

// ── 10. Francis High / Low speed block (4 wk, 3:1) ───────────────────────────
{
  const V = [{ acc: 6, fly: 3, se: 0, tr: 6, s: 4, r: '3–5', l: '82%' }, { acc: 7, fly: 4, se: 1, tr: 8, s: 4, r: '3', l: '85%' }, { acc: 8, fly: 4, se: 2, tr: 8, s: 5, r: '2–3', l: '87.5%' }, { acc: 4, fly: 2, se: 0, tr: 5, s: 3, r: '3', l: '75%' }];
  const wk = (n) => {
    const v = V[n - 1], dl = n === 4;
    const H1 = day('', 'lift', 'HIGH · Acceleration + Lower Power', [blk('speed', 'Acceleration (Zone 5)', [
      spd('Dribbles (Calf)', 'A', 1, 2, '20yd', '70%', ':30'), spd('A-Skip', 'A', 1, 2, '20yd', '75%', ':30'), spd('Power Skips- Distance', 'B', 1, 3, '20yd', '85%', ':45'),
      spd('2pt Start (LSV)', 'C', v.acc, 1, '10–30yd', '95%+', '2:00', 'Stop on a PB or a >2% drop-off — don\'t ask for "one more"'),
      spd('Prowler Sprint', 'D', dl ? 1 : 2, 1, '10yd', '95%+', '2:00', 'One resisted start before free starts (~20% slower)'),
    ]), blk('lift', 'Lower Power (high quality, low volume)', [
      lift('MB Shotput Side Toss', 'A', 3, '3ea', '8 lb MB', '', '1:00', 'Low count, max intent'),
      lift('Box Squat', 'B', v.s, v.r, v.l, '20X0', '3:00', 'Heavy, moved fast — CNS day'), lift('Hang Clean', 'B', v.s, 2, dl ? '60%' : '70%', '', '2:00'),
      lift('Bb RDL', 'C', 3, 5, 'RPE 7', '3010', '1:30', 'Hip-extension emphasis — hamstrings extend the hip in sprinting'), lift('Reverse Hyper', 'C', 3, 10, 'Light', '1010', '1:00'),
      lift('Dead Bug', 'E', 2, '6ea', 'BW', '3131', ':30'),
    ])]);
    const L1 = day('', 'esd', 'LOW · Tempo + Upper Circuit', [tempoBlock(v.tr), blk('lift', 'Upper Accessory Circuit', [
      lift('Push-Up', 'A', 3, 12, 'BW', '2010', ':30', 'Between tempo sets'), lift('DB Single Arm Row', 'A', 3, '10ea', 'RPE 6', '2010', ':30'),
      lift('Side Plank', 'B', 2, '30s ea', 'BW', '', ':30'), lift('Face Pull', 'B', 2, 15, 'Light', '2011', ':30'),
    ].concat(ARM_CARE(2)))]);
    const H2 = day('', 'lift', 'HIGH · Max Velocity + Upper Strength', [blk('speed', 'Max Velocity (Zone 5)', [
      spd('Dribbles (Knee)', 'A', 1, 2, '20yd', '75%', ':30'), spd('Wickets', 'B', 2, 1, '30yd', '90%', '1:30'),
      spd('Fly (variation)', 'C', v.fly, 1, '10–20yd fly', '95%+', '4:00', 'Log fly-10 — 30–60 s rest per 1 s sprinting'),
      v.se ? spd('Fly (variation)', 'D', v.se, 1, '40yd', '95%', '6:00', 'Speed endurance — 1 session a week, 2–4 days to recover') : null,
    ]), blk('lift', 'Upper Strength 3–5 reps', [
      lift('Box Jump', 'A', 3, 3, 'BW', '', '1:00', 'Boxes ≤24 in (Francis)'),
      lift('Incline DB Press', 'B', v.s, v.r, v.l, '20X0', '2:30'), lift('Pull Up (Weighted)', 'B', v.s, v.r, v.l, '20X0', '2:30'),
      lift('Barbell Row', 'C', 3, 5, '75%', '2010', '1:30', 'Rows mirror the sprint arm action'),
    ].concat(ARM_CARE(2)))]);
    const L2 = day('', 'esd', 'LOW · Tempo + Mobility', [tempoBlock(Math.max(4, v.tr - 2)), blk('lift', 'Mobility / Soft Tissue', [
      lift('Hip 90/90 Series', 'A', 2, '5ea', 'BW', '', ':20'), lift('Supine Hamstring P/R', 'A', 2, 2, 'BW', '', ':20'), lift('T-Spine Wall Walks', 'B', 2, 8, 'BW', '', ':20'), lift('Half Kneeling Hip Flexor', 'B', 2, '30s', '', '', ':15'),
    ])]);
    return week(n, (dl ? 'Recovery week' : 'Load W' + n) + ' · High/Low', layout(4, { Mon: H1, Tue: L1, Thu: H2, Fri: L2 }), dl);
  };
  const w4 = Array.from({ length: 4 }, (_, x) => wk(x + 1));
  // 3-day: High Mon, Low Wed, High Fri (never two High days back to back)
  const w3 = w4.map(w => { const td = w.days.filter(d => d.type !== 'off'); return Object.assign({}, w, { days: layout(3, { Mon: td[0], Wed: td[1], Fri: td[2] }) }); });
  const meta = { category: 'Method Library · Speed', phaseType: 'realization', sq: { power: 1, spdstr: 2 }, group: 'athlete', variant: 'all', source: 'Charlie Francis Training System · ALTIS zones · 8 Vector high-low',
    name: '🏃 Francis High / Low Speed Block (4 wk)',
    notes: 'One daily CNS pool: sprints, heavy low-rep lifts, jumps and max-intent med ball stack on HIGH days; tempo (65–75%) and circuits on LOW days. ≥48 h between High days, never back to back. Stop a sprint element on a PB or >2% drop-off. 3:1 step loading. After a spectacular session, cap the next 3–5 days at ~95%. Sprint days in the afternoon.' };
  T.push(Object.assign({}, meta, { key: 'francis-4', days: 4, weeks: w4 }));
  T.push(Object.assign({}, meta, { key: 'francis-3', days: 3, weeks: w3 }));
}

// ── 11. Brewster — 95 MPH Body (pitchers, 4 wk 3:1) ──────────────────────────
{
  const V = [{ s: 4, r: '6', l: 'RPE 7', sp: '60%' }, { s: 4, r: '5', l: 'RPE 8', sp: '62.5%' }, { s: 5, r: '4', l: 'RPE 8–9', sp: '65%' }, { s: 3, r: '5', l: 'RPE 6', sp: '55%' }];
  const wk = (n) => {
    const v = V[n - 1], dl = n === 4;
    const D1 = day('', 'lift', 'Lower Strength', [blk('lift', 'Lower Strength', [
      lift('Lateral Bound', 'A', 3, '3ea', 'BW', '', '1:00', 'Frontal-plane power primer'), lift('MB Step Back Side Toss', 'A', 3, '4ea', '8 lb MB', '', '1:00', 'Scoop toss — transverse'),
      lift('Trap Bar Deadlift', 'B', v.s, v.r, v.l, '30X0', '2:30', 'Or SSB squat 4–6 reps'), lift('Bb RDL', 'C', 3, 8, 'RPE 7', '3010', '1:30'),
      lift('RFE Split Squat (DB)', 'C', 3, '8ea', 'RPE 7', '2010', '1:30'), lift('Copenhagen Plank', 'D', 2, '25s ea', 'BW', '', ':45'),
    ])]);
    const D2 = day('', 'lift', 'Upper', [blk('lift', 'Upper', [
      lift('Med Ball Overhead Slam', 'A', 3, 5, '10 lb MB', '', '1:00', 'Sagittal power'),
      lift('Db Bench Press', 'B', v.s, '6–8', v.l, '2010', '2:00', 'DB bench — no barbell bench (Brewster)'), lift('Chin Up', 'B', v.s, '6–8', 'BW', '2010', '2:00'),
      lift('Half Kneeling Landmine Press', 'C', 3, '8ea', 'RPE 7', '2010', '1:15', 'Low/medium incline press option'), lift('Renegade Push Up Row', 'C', 3, '6ea', 'BW', '', '1:15'),
    ].concat(ARM_CARE(3)))]);
    const D3 = day('', 'esd', 'Throwing Day · Mobility only', [blk('lift', 'Mobility', [
      lift('Hip 90/90 Series', 'A', 2, '5ea', 'BW', '', ':20'), lift('T-Spine Wall Walks', 'A', 2, 8, 'BW', '', ':20'), lift('Half Kneeling Hip Flexor', 'B', 2, '30s', '', '', ':15'),
    ])]);
    const D4 = day('', 'lift', 'Lower Power-Strength', [blk('lift', 'Lower Power-Strength', [
      lift('Skaters W/ Catch', 'A', 3, '3ea', 'BW', '', '1:00', 'Frontal'), lift('MB Shotput Side Toss', 'A', 3, '4ea', '8 lb MB', '', '1:00', 'Rotational shot put — transverse'),
      lift('Trap Bar Deadlift', 'B', 6, 2, v.sp, '10X0', '1:00', 'Speed deadlift with bands at 60–65% (strength-speed)'), lift('Lateral Sled Drag', 'C', 4, '20yd ea', 'Heavy', '', '1:00', 'Frontal-plane power'),
      lift('SL DB RDL', 'C', 3, '8ea', 'RPE 7', '2010', '1:00'), lift('Pallof Press', 'E', 2, '10ea', 'Light', '2', ':30'),
    ])]);
    const D5 = day('', 'lift', 'Upper Hypertrophy', [blk('lift', 'Upper Hypertrophy 8–12', [
      lift('Sb Push Up', 'B', 3, '10–12', 'BW', '2010', '1:00', 'Closed-chain push'), lift('Cable High to Low Row (SS)', 'B', 3, '10–12ea', 'RPE 8', '2010', '1:00'),
      lift('Push-Up', 'C', 3, '12', 'BW', '3010', '1:00'), lift('DB Single Arm Row', 'C', 3, '10ea', 'RPE 8', '2010', '1:00'),
      lift('DB Incline Zottman Curl', 'D', 3, 12, 'Light', '2010', ':45', 'Forearm / grip'), lift('Plate Pinch', 'D', 3, '20s', 'Heavy', '', ':45'),
    ].concat(ARM_CARE(2)))]);
    return week(n, (dl ? 'Deload' : 'W' + n) + ' · lift after throwing', layout(4, { Mon: D1, Tue: D2, Wed: D3, Thu: D4, Fri: D5 }), dl);
  };
  const w = Array.from({ length: 4 }, (_, x) => wk(x + 1));
  // 3-day total body: Mon Lower Strength + Upper, Wed Power, Fri Hypertrophy
  const w3 = w.map(x => { const d = x.days; const by = l => d.find(q => q.label === l);
    return Object.assign({}, x, { days: layout(3, { Mon: merge(by('Lower Strength'), by('Upper'), 'Total Body A · Strength'), Wed: merge(by('Lower Power-Strength'), by('Upper Hypertrophy'), 'Total Body B · Power'), Fri: merge(by('Lower Strength'), by('Upper Hypertrophy'), 'Total Body C · Hypertrophy', true) }) }); });
  const meta = { category: 'Method Library · Pitchers', phaseType: 'transmutation', sq: { maxstr: 1, hyp: 2, power: 2 }, group: 'athlete', variant: 'pitcher', source: 'Ben Brewster — Building the 95 MPH Body',
    name: '⚾ 95 MPH Body — Pitcher Off-Season (4 wk)',
    notes: 'Strength (engine) → lean mass (frame) → velocity work (fine-tuning). Power in all three planes: lateral bounds / skaters (frontal), scoop toss / shot put (transverse), slams (sagittal). 40–70 reps per body part per session at 6–12RM. Lift after throwing; Wednesday is a throwing day with mobility only. No barbell bench, overhead press, snatch, dips or kipping. 3:1 mesocycle. Set emphasis by FFMI status: <22.5 → strength + size; 22.5–24 → strength-power; >24 → speed-strength + reactive.' };
  T.push(Object.assign({}, meta, { key: 'brewster-4-p', days: 4, weeks: w }));
  T.push(Object.assign({}, meta, { key: 'brewster-3-p', days: 3, weeks: w3 }));
}

// ── 12. Taper / Realization into report day (Bompa, Zatsiorsky) ──────────────
{
  const wk = (n) => {
    const p = n === 1 ? { s: 3, l: '85%', fs: 3 } : { s: 2, l: '87.5%', fs: 2 };
    const LA = day('', 'lift', 'Lower A · Acceleration', [accelBlock(3), blk('lift', 'Realization', [
      lift('Box Jump', 'A', p.fs, 3, 'BW', '', '1:00'), lift('Trap Bar Deadlift', 'B', p.s, 2, p.l, '10X0', '3:00', 'Same main lifts, volume down 40–60%, intensity held'),
      lift('SL DB RDL', 'C', 2, '6ea', 'RPE 6', '2010', '1:00'), lift('Copenhagen Plank', 'D', 2, '20s ea', 'BW', '', ':45'),
    ])]);
    const UA = day('', 'lift', 'Upper A', [blk('lift', 'Realization', [
      lift('MB Side Toss', 'A', p.fs, '3ea', '8 lb MB', '', '1:00'), lift('DB Floor Press', 'B', p.s, 3, p.l, '10X0', '2:30'), lift('Chin Up', 'B', p.s, 4, 'BW', '2010', '2:00'),
    ].concat(ARM_CARE(2)))]);
    const LB = day('', 'lift', 'Lower B · Max Velocity', [maxVBlock(3), blk('lift', 'Realization', [
      lift('Trap Bar Jumps', 'A', p.fs, 3, '20%', '', '1:30'), n === 1 ? lift('Front Squat', 'B', p.s, 2, p.l, '10X0', '3:00') : lift('Squat Jump', 'B', 2, 3, 'BW', '', '1:30', 'Heavy squats dropped 7–10 days before report (Zatsiorsky)'),
      lift('Pallof Press', 'E', 2, '8ea', 'Light', '2', ':30'),
    ])]);
    const UB = day('', 'lift', 'Upper B', [blk('lift', 'Realization', [
      lift('Plyo Push Up', 'A', p.fs, 4, 'BW', '', '1:00'), lift('Push Press', 'B', p.s, 3, n === 1 ? '75%' : '70%', '10X0', '2:00'), lift('DB Single Arm Row', 'C', 2, '8ea', 'RPE 6', '2010', '1:00'),
    ].concat(ARM_CARE(2)))]);
    return week(n, 'Taper W' + n + ' · volume −' + (n === 1 ? 40 : 60) + '%', four(LA, UA, LB, UB));
  };
  add({ key: 'taper', category: 'Method Library · Peak', phaseType: 'realization', sq: { power: 1, relstr: 2 }, source: 'Bompa & Haff taper evidence · Zatsiorsky delayed transformation', pitcher: true,
    name: '🎯 Taper — Realization into Report Day (2 wk)',
    notes: 'Volume −41–60%, intensity kept moderate-high, frequency ≥80% (Bompa). Same main lifts — gains show up after unloading (delayed transformation). Drop heavy squats 7–10 days before report day. Speed: short, high-quality Zone 5 exposures only.' },
    [wk(1), wk(2)]);
}

// ── 13. In-season — Conjugate RE / DE alternating (Westside, Simmons, Zatsiorsky residuals) ──
{
  const wk = (n, pitcher) => {
    const odd = n % 2 === 1;
    const S1 = day('', 'lift', (odd ? 'RE' : 'DE') + ' Lower · ' + (pitcher ? 'Day 1 after start' : 'Early in series'), [accelBlock(3, 'maintenance — ≤10 days without a sprint'), blk('lift', odd ? 'Repeated Effort Lower' : 'Dynamic Effort Lower', odd ? [
      lift('Box Jump', 'A', 3, 3, 'BW', '', '1:00', 'Keep the jumps in-season'),
      lift('Trap Bar Deadlift', 'B', 3, '6–8', '75%', '2010', '2:00', 'RE — moderate load; scale to session RPE / readiness'),
      lift('RFE Split Squat (DB)', 'C', 3, '8ea', 'RPE 7', '2010', '1:30'), lift('Nordic Curl', 'C', 3, 4, 'BW', '5000', '1:30', 'Hamstring protection — non-negotiable'),
      lift('Copenhagen Plank', 'D', 2, '20s ea', 'BW', '', ':45'),
    ] : [
      lift('Box Squat', 'B', 8, 2, '55%', '00X0', ':45', 'DE 8–10 x 2 — fast; or trap bar jump'), lift('Trap Bar Jumps', 'A', 4, 3, '20%', '', '1:00'),
      lift('Front Squat', 'C', 2, 2, '87.5%', '20X0', '3:00', 'Max-strength residual: one lift ≥85% each week (Zatsiorsky)'),
      lift('Glute-Ham Raise', 'C', 3, 6, 'BW', '3010', '1:30'), lift('Copenhagen Plank', 'D', 2, '20s ea', 'BW', '', ':45'),
    ])]);
    const upEx = (odd ? [
      lift('MB Side Toss', 'A', 3, '3ea', '8 lb MB', '', '1:00'),
      pitcher ? lift('MB Step Back Side Toss', 'B', 6, 3, '6 lb MB', '', ':45', 'Pitchers: med ball 6–9 x 3 instead of speed press') : lift('Landmine Push Press (video)', 'B', 6, 3, '50%', '00X0', ':45', 'Speed press 6–9 x 3'),
      lift('Chin Up', 'C', 3, 6, 'BW', '2010', '1:30'), lift('DB Single Arm Row', 'C', 3, '8ea', 'RPE 7', '2010', '1:00'),
    ] : [
      lift('Plyo Push Up', 'A', 3, 4, 'BW', '', '1:00'),
      lift(pitcher ? 'Half Kneeling Landmine Press' : 'Db Bench Press', 'B', 3, '8–10', 'RPE 7', '2010', '1:30', 'RE upper'), lift('DB Single Arm Row', 'B', 3, '8–10ea', 'RPE 7', '2010', '1:30'),
      lift('Face Pull', 'C', 3, 15, 'Light', '2011', ':45'),
    ]).concat(ARM_CARE(3));
    const S2 = day('', 'lift', (odd ? 'DE' : 'RE') + ' Upper · ' + (pitcher ? 'Day 3 after start' : 'Before the series'), [blk('lift', odd ? 'Dynamic Effort Upper' : 'Repeated Effort Upper', upEx)]);
    const S3 = day('', 'lift', 'Arm Care + Mobility', [blk('lift', 'Arm Care / Mobility', [
      lift('Band External Rotation', 'A', 2, '15ea', 'Light', '2010', ':30'), lift('Y-T-W', 'A', 2, 8, 'Light', '2010', ':30'), lift('Powell Raise', 'B', 2, '10ea', 'Light', '2010', ':30'),
      lift('Hip 90/90 Series', 'C', 1, '5ea', 'BW', '', ':20'), lift('T-Spine Wall Walks', 'C', 1, 8, 'BW', '', ':20'), lift('Dead Bug', 'E', 2, '6ea', 'BW', '3131', ':30'),
    ])]);
    const g = d => Object.assign({}, d);
    return {
      w2: week(n, (odd ? 'Odd — RE lower / DE upper' : 'Even — DE lower / RE upper'), layout(2, pitcher ? { Mon: g(S1), Wed: g(S2) } : { Mon: g(S1), Thu: g(S2) })),
      w3: week(n, (odd ? 'Odd — RE lower / DE upper' : 'Even — DE lower / RE upper'), layout(3, pitcher ? { Mon: g(S1), Tue: g(S3), Wed: g(S2) } : { Mon: g(S1), Wed: g(S3), Thu: g(S2) })),
    };
  };
  const meta = { category: 'Method Library · In-Season', phaseType: 'inseason', sq: { relstr: 1, power: 2 }, group: 'athlete',
    source: 'Westside in-season model · Simmons season shift · Zatsiorsky training residuals · Bompa maintenance',
    notes: 'Two sessions a week: lower early, upper later; Repeated Effort and Dynamic Effort alternate week to week. No ME work in season. Keep RE accessory volume high (main protection against detraining) and one lift ≥85% each week. Scale intensity to session RPE / readiness. Position players: lift on lighter series days, never getaway day. Starters: lower day 1 after the start, upper day 3.' };
  const P = Array.from({ length: 4 }, (_, x) => wk(x + 1, false)), Q = Array.from({ length: 4 }, (_, x) => wk(x + 1, true));
  T.push(Object.assign({}, meta, { key: 'inseason-2', days: 2, variant: 'all', name: '🎮 In-Season — RE / DE Alternating (4 wk · 2-day)', weeks: P.map(x => x.w2) }));
  T.push(Object.assign({}, meta, { key: 'inseason-3', days: 3, variant: 'all', name: '🎮 In-Season — RE / DE Alternating (4 wk · 3-day)', weeks: P.map(x => x.w3) }));
  T.push(Object.assign({}, meta, { key: 'inseason-2-p', days: 2, variant: 'pitcher', name: '🎮 In-Season — Starter RE / DE (4 wk · 2-day)', weeks: Q.map(x => x.w2) }));
  T.push(Object.assign({}, meta, { key: 'inseason-3-p', days: 3, variant: 'pitcher', name: '🎮 In-Season — Starter RE / DE (4 wk · 3-day)', weeks: Q.map(x => x.w3) }));
}

// ── 14. Deload week (Bompa unload / Zatsiorsky 60% rule) ─────────────────────
{
  const mk = (client) => {
    const A = day('', 'lift', 'Light Full Body 1', [client ? null : blk('speed', 'Light Speed', [spd('A-Skip', 'A', 2, 1, '20yd', '70%', ':45'), spd('2pt Start (LSV)', 'B', 3, 1, '10yd', '85%', '1:30', 'Crisp, not maximal')]), blk('lift', 'Deload — ~60% volume', [
      lift('Goblet Squat', 'A', 2, 8, 'RPE 5', '3010', '1:00'), lift('Box Jump', 'A', 2, 3, 'BW', '', '1:00'),
      lift('DB Floor Press', 'B', 2, 8, '60%', '2010', '1:00'), lift('DB Single Arm Row', 'B', 2, '8ea', 'RPE 5', '2010', '1:00'),
      lift('SL DB RDL', 'C', 2, '6ea', 'RPE 5', '2010', ':45'), lift('Dead Bug', 'E', 2, '6ea', 'BW', '3131', ':30'), lift('Band External Rotation', 'E', 2, '15ea', 'Light', '2010', ':30'),
    ])]);
    const B = day('', 'lift', 'Light Full Body 2', [client ? null : blk('speed', 'Light Speed', [spd('B-Skip', 'A', 2, 1, '20yd', '70%', ':45'), spd('Tempo Runs', 'B', 1, 6, '100yd', '65%', ':45')]), blk('lift', 'Deload — ~60% volume', [
      lift('Trap Bar Deadlift', 'A', 2, 5, '60%', '20X0', '1:30'), lift('Med Ball Chest Pass', 'A', 2, 4, '6 lb MB', '', '1:00'),
      lift('Half Kneeling Landmine Press', 'B', 2, '8ea', 'RPE 5', '2010', '1:00'), lift('Chin Up', 'B', 2, 5, 'BW', '2010', '1:00'),
      lift('Copenhagen Plank', 'C', 2, '15s ea', 'BW', '', ':45'), lift('Hip 90/90 Series', 'E', 1, '5ea', 'BW', '', ':20'),
    ])]);
    const C = day('', 'esd', 'Mobility / Light ESD', [blk('lift', 'Mobility', [lift('Hip 90/90 Series', 'A', 2, '5ea', 'BW', '', ':20'), lift('T-Spine Wall Walks', 'A', 2, 8, 'BW', '', ':20'), lift('Supine Hamstring P/R', 'B', 2, 2, 'BW', '', ':20')]), blk('speed', 'Light ESD', [spd('Assault Bike', 'A', 1, '10 min', '', 'Zone 1', '', 'Easy — move blood')])]);
    return { A, B, C };
  };
  for (const client of [false, true]) {
    const d = mk(client), key = client ? 'c-deload' : 'deload';
    const meta = { group: client ? 'client' : 'athlete', variant: 'all', category: (client ? 'Private Client' : 'Method Library') + ' · Deload', phaseType: 'restore', sq: {},
      source: 'Bompa unload week · Zatsiorsky 60% rule · The System unload caps', name: (client ? '🔃 Client · ' : '🔃 ') + 'Deload Week (1 wk)',
      notes: 'Light week ≈60% of the heaviest week\'s volume (Zatsiorsky). Relative intensity ≤70–75% (The System unload cap). Keep movement quality and arm care.' };
    T.push(Object.assign({}, meta, { key: key + '-3', days: 3, weeks: [week(1, 'Deload', layout(3, { Mon: d.A, Wed: d.C, Fri: d.B }), true)] }));
    T.push(Object.assign({}, meta, { key: key + '-4', days: 4, weeks: [week(1, 'Deload', layout(4, { Mon: d.A, Tue: d.C, Thu: d.B, Fri: clone(d.C) }), true)] }));
  }
}

// ── Private-client versions of Prep, Hypertrophy and Transition (no sprint blocks) ──
function clientize(t, key, name) {
  const c = clone(t);
  c.weeks.forEach(w => w.days.forEach(d => {
    d.blocks = d.blocks.filter(b => b.blockType !== 'speed');
    d.label = d.label.replace(/ · (Acceleration|Max Velocity)/, '');
    d.blocks.forEach(b => { b.exercises = b.exercises.filter(e => e.type !== 'speed'); });
  }));
  // Athletic prep for clients: a short warm-up block of skips / low-level jumps
  c.weeks.forEach(w => w.days.forEach(d => { if (d.type === 'lift' && d.blocks.length) d.blocks.unshift(blk('speed', 'Athletic Prep', [spd('A-Skip', 'A', 1, 2, '20yd', '70%', ':30'), spd('Lateral Shuffle', 'A', 1, 2, '10yd ea', '70%', ':30'), spd('Pogo Jumps', 'B', 2, 10, '', 'Easy', ':45', 'Low-level elastic work')])); }));
  return Object.assign(c, { key, name, group: 'client', category: t.category.replace('Method Library', 'Private Client'), notes: t.notes + ' Client version: sprint blocks replaced with a short athletic prep.' });
}
for (const src of T.filter(t => ['prep-4', 'prep-3', 'hyp-clusters-4', 'hyp-clusters-3', 'transition-3', 'transition-2'].includes(t.key))) {
  const base = src.key.replace(/-(\d)$/, ''), d = src.key.match(/-(\d)$/)[1];
  T.push(clientize(src, 'c-' + base + '-' + d, src.name.replace(/^(\S+) /, '$1 Client · ')));
}

// ═══════════════════════════════════════════════════════════════════════════
// ANNUAL PLAN TEMPLATES
//   Blocks run back to back from the chosen start date. Each block names its phase
//   template by base key; the app picks the 4- / 3-day and pitcher version.
//   d4 / d3: the days-per-week version to use when the plan is applied at 4 / 3 days
// ═══════════════════════════════════════════════════════════════════════════
const A = (tpl, weeks, type, label, notes, extra) => Object.assign({ tpl, weeks, type, label, notes: notes || '' }, extra || {});
const INSEASON_YEAR = [   // report → end of September (32 weeks)
  A('mw:spring', 3, 'spring', 'Spring Training Ramp', 'Exhibition games are training'),
  A('inseason', 3, 'inseason', 'Spring → Opening Day', 'In-season model starts before Opening Day; short taper in the last 8–10 days', { d4: 3, d3: 2 }),
  A('inseason', 8, 'inseason', 'In-Season Block 1', 'RE / DE alternating; one lift ≥85% every week', { d4: 3, d3: 2 }),
  A('deload', 1, 'restore', 'Mid-Season Unload', 'All-Star break'),
  A('inseason', 8, 'inseason', 'In-Season Block 2', '', { d4: 3, d3: 2 }),
  A('inseason', 9, 'inseason', 'In-Season Block 3 / Stretch Run', 'Heavy singles late in the season (The System / Francis)', { d4: 3, d3: 2 }),
];
const ANNUAL = [
  {
    key: 'athlete-size-speed', group: 'athlete', name: 'Athlete — Size & Strength → Speed',
    start: 'oct1', notes: 'Bompa monocycle on the pro calendar: transition, AA, hypertrophy clusters, triphasic strength-power, taper into report day, spring, in-season maintenance. 20 off-season weeks from the end of September to mid-February report; slide the start date to line the taper up with report day.',
    blocks: [
      A('transition', 2, 'restore', 'Transition', 'Active rest, ROM and medical; season review', { d4: 3, d3: 2 }),
      A('prep', 3, 'structural', 'Prep / Anatomical Adaptation', 'Tendons, work capacity; sprints by distance progression'),
      A('hyp-clusters-short', 7, 'accumulation', 'Hypertrophy Clusters', 'Size without losing bar speed; speed stays first'),
      A('triphasic', 6, 'transmutation', 'Triphasic Strength-Power', 'Eccentric → isometric → reactive'),
      A('taper', 2, 'realization', 'Taper into Report Day', 'Volume down, intensity held; drop heavy squats 7–10 days out'),
    ].concat(INSEASON_YEAR),
  },
  {
    key: 'athlete-strength-power', group: 'athlete', name: 'Athlete — Strength-Power (Conjugate → VJP)',
    start: 'oct1', notes: 'Westside / Simmons conjugate trains max strength and speed-strength every week, then Tuura\'s VJP is the late off-season power block, with his optional jump-only week 6 before report. For athletes who already carry the mass.',
    blocks: [
      A('transition', 3, 'restore', 'Transition', 'Active rest, ROM and medical', { d4: 3, d3: 2 }),
      A('prep', 3, 'structural', 'Prep / Anatomical Adaptation', ''),
      A('conjugate', 8, 'transmutation', 'Conjugate ME / DE', 'ME rotates weekly; DE waves 50/55/60%'),
      A('vjp', 5, 'realization', 'Vertical Jump Protocol', 'Best jumps show in week 5 — test CMJ'),
      A('deload', 1, 'restore', 'VJP Week 6 — Jumps Only', 'Optional easy week (Tuura): little or no lifting so the rebound lands on report day'),
    ].concat(INSEASON_YEAR),
  },
  {
    key: 'athlete-speed', group: 'athlete', name: 'Athlete — Speed Emphasis (Francis / ALTIS)',
    start: 'oct1', notes: 'Strength base with Poliquin Acc / Int, then Francis high / low and the undulated speed-strength block. For athletes whose limiter is speed (fly-10 / MSS).',
    blocks: [
      A('transition', 2, 'restore', 'Transition', '', { d4: 3, d3: 2 }),
      A('prep', 3, 'structural', 'Prep / Anatomical Adaptation', ''),
      A('poliquin', 8, 'accumulation', 'Poliquin Acc / Int (wk 1–8)', 'Runs weeks 1–8 of the 12-week template'),
      A('francis', 4, 'realization', 'Francis High / Low Speed', 'Stop sprints on a PB or >2% drop-off'),
      A('undulated-ss', 3, 'realization', 'Undulated Speed-Strength', 'Into report day'),
    ].concat(INSEASON_YEAR),
  },
  {
    key: 'athlete-pitcher-brewster', group: 'athlete', pitcherOnly: true, name: 'Pitcher — 95 MPH Body Off-Season',
    start: 'oct1', notes: 'Brewster\'s pitcher order: strength, then lean mass, then velocity work; lift after throwing; pitcher exercise swaps throughout. In-season uses the starter version (lower day 1 after the start, upper day 3).',
    blocks: [
      A('transition', 2, 'restore', 'Transition', 'Arm rest, ROM and medical', { d4: 3, d3: 2 }),
      A('prep', 3, 'structural', 'Prep / Anatomical Adaptation', ''),
      A('hyp-clusters-short', 7, 'accumulation', 'Hypertrophy Clusters', 'Lean-mass push if FFMI < 22.5'),
      A('brewster', 4, 'transmutation', '95 MPH Body — Strength-Power', 'Throwing ramps up — lift after throwing'),
      A('brewster', 4, 'transmutation', '95 MPH Body — Second Mesocycle', 'Start above last block\'s week 1'),
    ].concat(INSEASON_YEAR),
  },
  {
    key: 'client-year', group: 'client', name: 'Private Client — Year-Round',
    start: 'any', notes: 'No season: repeating strength cycles with planned unloads (Bompa 3:1; Zatsiorsky, at most 3–4 stress microcycles a year). Starts any Monday; individualize blocks after applying.',
    blocks: [
      A('c-prep', 3, 'structural', 'Prep / Foundation', 'Movement, work capacity'),
      A('c-poliquin', 12, 'accumulation', 'Poliquin Acc / Int', ''),
      A('c-deload', 1, 'restore', 'Unload', ''),
      A('c-hyp-clusters', 9, 'accumulation', 'Hypertrophy Clusters', ''),
      A('c-undulated-strength', 4, 'transmutation', 'Undulated Strength', ''),
      A('c-undulated-ss', 3, 'realization', 'Undulated Speed-Strength', ''),
      A('c-deload', 1, 'restore', 'Unload', ''),
      A('c-kilo', 12, 'transmutation', 'KILO Acc / Int', ''),
      A('c-deload', 1, 'restore', 'Unload', ''),
      A('c-transition', 3, 'restore', 'Active Rest / Vacation Weeks', 'Two light sessions a week', { d4: 3, d3: 2 }),
      A('c-prep', 3, 'structural', 'Prep / Foundation', 'Restart the cycle'),
    ],
  },
];
for (const a of ANNUAL) { const n = a.blocks.reduce((s, b) => s + b.weeks, 0); if (n !== 52) throw new Error(a.key + ' is ' + n + ' weeks'); }

// ── Validate + write ─────────────────────────────────────────────────────────
const keys = new Set(T.map(t => t.key));
const MW = ['spring-6', 'spring-4', 'spring-3'];
for (const a of ANNUAL) for (const b of a.blocks) {
  for (const d of [4, 3]) {
    const dd = b['d' + d] || d;
    if (b.tpl.startsWith('mw:')) { if (!MW.includes(b.tpl.slice(3) + '-' + dd)) throw new Error('Missing MW ' + b.tpl + '-' + dd); continue; }
    const kk = b.tpl + '-' + dd;
    if (!keys.has(kk) && !keys.has(kk + '-p')) throw new Error('Annual ' + a.key + ' → missing template ' + kk);
  }
}
let nEx = 0;
T.forEach(t => {
  if (!t.name || !t.weeks || !t.weeks.length) throw new Error('Bad template ' + t.key);
  t.weeks.forEach((w, i) => { w.week = i + 1; if (w.days.length !== 7) throw new Error(t.key + ' week ' + (i + 1) + ' has ' + w.days.length + ' days'); w.days.forEach(d => d.blocks.forEach(b => b.exercises.forEach(e => { L(e.name); nEx++; }))); });
});

const out = T.map(t => ({
  key: t.key, category: t.category, name: t.name, notes: t.notes, source: t.source, group: t.group, variant: t.variant, days: t.days,
  phaseType: t.phaseType, sq: t.sq || {},
  pbState: { athlete: '(Sandbox)', phase: ({ structural: 'accumulation', spring: 'transmutation' })[t.phaseType] || t.phaseType, weeks: t.weeks.length, progression: 'linear', activeWeek: 0, weekData: t.weeks },
}));
// One exercise per line keeps every line short (GitHub rejects very long lines)
const fmt = (v) => JSON.stringify(v).replace(/\{"type":"(lift|speed)"/g, '\n{"type":"$1"');
let src = '// Method template library — GENERATED by tools/build-method-templates.js. Edit the generator, not this file.\n'
  + '// Phase templates (4- and 3-day, pitcher variants where the source calls for them) and annual plan templates\n'
  + '// from the ALTIS Speed Programming Spec. Every exercise is from the exercise library.\n'
  + 'var METHOD_TEMPLATES_VERSION = 1;\n'
  + 'var METHOD_TEMPLATES = [\n' + out.map(fmt).join(',\n') + '\n];\n'
  + 'var ANNUAL_TEMPLATES = ' + JSON.stringify(ANNUAL, null, 1) + ';\n';
fs.writeFileSync(path.join(ROOT, 'data', 'method-templates.js'), src);
const maxLine = Math.max(...src.split('\n').map(l => l.length));
console.log('templates:', out.length, '· exercises:', nEx, '· annual:', ANNUAL.length, '· bytes:', src.length, '· longest line:', maxLine);
console.log(out.map(t => t.key).join(' '));
