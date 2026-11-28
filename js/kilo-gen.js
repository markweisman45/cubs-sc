// ═══════════════════════════════════════════════════════════════════════════
// KILO programming — one method spec table + the KILO template generator
//   • KILO_METHODS: every KILO method as one unit (sets × reps × tempo × rest × load). Picking a
//     method on a Program Builder row fills all five together, so tempo can't drift from the reps.
//   • kiloBuildTemplates(EXERCISE_DB): builds every KILO phase template (base Acc/Int, ESD/XSD
//     method blocks, short blocks, MLB infielder, pre-comp, in-season, plyo plan) in the browser.
//     method-library.js swaps these in over the old generated copies in data/method-templates.js.
// Day layout (Mark, Nov 2026) — every lift day, jump-first pairs:
//   A1 jump / plyo + A2 core · B1 main lift (the method) + B2 antagonist · C1/C2 assistance ·
//   D1/D2 remedial · E1/E2 grip / forearm. On KILO plyo-plan days: A1/A2 plan jumps, B1 third
//   plan jump + B2 core, then C main, D assistance, E remedial.
// The method REPLACES the main lift's straight sets — never both on the same lift.
// Plyo plan: weekly contacts kept, split over both lower days, 3–6 sets per exercise.
// ═══════════════════════════════════════════════════════════════════════════
(function (root) {
  'use strict';

  // ── Method spec table ─────────────────────────────────────────────────────
  // tut: allowed seconds under tension per set (null = speed / iso method, not checked)
  var KILO_METHODS = {
    'imca-acc':          { fam: 'Concentric', label: 'IMCA — accumulation', sets: 4, reps: '8–10', tempo: '4-0-X-0', rest: '2:30', load: '70%', tut: [30, 70], note: 'Intent to accelerate every rep · same lift all 3 weeks' },
    'imca-int':          { fam: 'Concentric', label: 'IMCA — intensification', sets: 5, reps: '3–5', tempo: '3-0-X-0', rest: '3:00', load: '85%', tut: [10, 40], note: 'Intent to accelerate every rep · same lift all 3 weeks' },
    'ecc-extended':      { fam: 'Eccentric', label: 'Extended eccentric', sets: 5, reps: 5, tempo: '6-0-X-0', rest: '3:00', load: '70%', tut: [25, 45], note: 'About 30 s under tension a set · W2 4×4 @ 8 s, W3 3×3 @ 10 s' },
    'ecc-supra':         { fam: 'Eccentric', label: 'Supra-maximal eccentric', sets: 4, reps: 2, tempo: '6-0-0-0', rest: '3:30', load: '105%', tut: null, lower: true, note: '100–120% (never over 120%), spotters or hooks · 2+ years training age only' },
    'conc-ecc':          { fam: 'Eccentric', label: 'Concentric-eccentric combo', sets: 4, reps: '6 + 2 ecc', tempo: '3-0-X-0 + 5-0-0-0', rest: '3:00', load: '80%', tut: null, note: 'RM set, then 2 eccentric-only reps (spotter lifts it)' },
    'ecc-conc':          { fam: 'Eccentric', label: 'Eccentric-concentric combo', sets: 4, reps: '4 ecc + 6', tempo: '5-0-0-0 + 2-0-X-0', rest: '3:00', load: '80% / 50%', tut: null, note: '4 eccentric-only reps (~80%), 10 s, then 6 fast reps (~50%)' },
    'ecc-expl-accent':   { fam: 'Eccentric', label: 'Explosive accentuated eccentric', sets: 5, reps: 3, tempo: '4-0-X-0', rest: '2:30', load: '60%', ext: 'Weight releasers', tut: null, note: 'Weight releasers — 4 s lowering, hooks drop, explode up · re-hang every rep' },
    'ecc-dyn-iso':       { fam: 'Eccentric', label: 'Dynamic eccentric-isometric', sets: 5, reps: 3, tempo: 'X-2-X-0', rest: '2:00', load: '50%', tut: null, note: 'Pull yourself down fast, stick 2 s, explode' },
    'yield-mechdis':     { fam: 'Isometric', label: 'Mechanical-disadvantage pause', sets: 4, reps: '6–8', tempo: '3-2-X-0', rest: '2:30', load: '72.5%', tut: [30, 70], note: '2 s pause in the hole · last set: mid-range hold 20–40 s, rack, then max fast reps at 50%' },
    'yield-3pause-ecc':  { fam: 'Isometric', label: '3-pause eccentric', sets: 4, reps: 6, tempo: '6-0-X-0', rest: '2:30', load: '72.5%', tut: [30, 70], note: '2 s pauses at ¾, ½ and ¼ depth on the way down' },
    'yield-stick':       { fam: 'Isometric', label: 'Sticking-point pause', sets: 4, reps: '6–8', tempo: '3-0-X-2', rest: '2:30', load: '72.5%', tut: [30, 70], note: '2 s pause at the sticking point on the way up' },
    'yield-iso-contrast':{ fam: 'Isometric', label: 'Iso-to-exhaustion contrast', sets: 3, reps: 'hold + 2 (×2)', tempo: 'iso + 2-0-X-0', rest: '2:30', load: '70% hold / 50% reps', tut: null, note: 'Mid-range hold to exhaustion, 2 fast reps, repeat — 2 rounds = 1 set' },
    'over-isometronic':  { fam: 'Isometric', label: 'Isometronic', sets: 5, reps: '5–7', tempo: '3-0-X-0', rest: '3:00', load: '80%', tut: [15, 45], note: 'One 6–8 s push into pins just above the sticking point, then finish the set · extra rep after the push → add load' },
    'over-functional':   { fam: 'Isometric', label: 'Functional isometric', sets: 4, reps: '3 × 6–8 s', tempo: 'iso', rest: '2:00', load: 'Max push into pins', tut: null, note: 'Pushes at the bottom, middle and top · never over 8 s' },
    'over-fi-contrast':  { fam: 'Isometric', label: 'Functional-iso contrast', sets: 3, reps: '2 + 2 (×2)', tempo: '1-0-1-6 / 2-0-X-0', rest: '2:30', load: '50%', tut: null, note: '2 reps with a 6 s pin push, 2 fast full-range reps, repeat' },
    'yield-stato':       { fam: 'Iso-dynamic', label: 'Stato-dynamic', sets: 5, reps: 3, tempo: '4-0-X-2', rest: '2:30', load: '60–70%', tut: null, note: '2 s pause at the sticking point on the way up, then explode' },
    'yield-stato-band':  { fam: 'Iso-dynamic', label: 'Stato-dynamic + bands', sets: 4, reps: 5, tempo: '2-0-X-2', rest: '2:30', load: '50%', ext: 'Average bands', tut: null, note: '~75% at the top with the band' },
    'ss-variable':       { fam: 'Speed-strength', label: 'Variable resistance (bands / chains)', sets: 6, reps: 3, tempo: '1-0-X-0', rest: '1:30', load: '55%', ext: 'Average bands', vel: '0.75–1.0 m/s', tut: null, note: 'Chain rule 80/20 · stop at a 10% velocity drop' },
    'ss-olympic':        { fam: 'Speed-strength', label: 'Olympic variation', sets: 5, reps: 3, tempo: 'X-0-X-0', rest: '2:00', load: '70%', tut: null, lower: true, note: '0.5–0.75 m/s · stop at a 7–10% velocity drop' },
    'ss-deadstop':       { fam: 'Speed-strength', label: 'Deadstop + bands (starting strength)', sets: 6, reps: 2, tempo: '2-4-X-0', rest: '2:00', load: '55%', ext: 'Light bands', vel: '0.75–1.0 m/s', tut: null, note: 'Deadstop on pins, ~20% band tension at the top · relax fully, then contract everything at once' },
    'react-myotatic':    { fam: 'Reactive', label: 'Myotatic 1¼ reps + bands', sets: 5, reps: 3, tempo: '2-0-X-0', rest: '2:00', load: '50%', ext: 'Light bands', vel: '1.0–1.3 m/s', tut: null, note: '1¼ reps — bridge from explosive to reactive' },
    'react-third':       { fam: 'Reactive', label: 'Myotatic ⅓ reps + bands', sets: 5, reps: 5, tempo: '2-0-X-0', rest: '2:00', load: '40%', ext: 'Light bands', vel: '1.0–1.3 m/s', tut: null, note: 'Bottom third only — fast stretch-shortening' },
  };

  // Single-digit tempos in the builder's compact style (4-0-X-0 → 40X0) so they match the Tempo presets
  function compactTempo(t) { t = String(t == null ? '' : t); return /^[0-9X]-[0-9X]-[0-9X]-[0-9X]$/i.test(t.trim()) ? t.trim().replace(/-/g, '').toUpperCase() : t; }
  Object.keys(KILO_METHODS).forEach(function (k) { KILO_METHODS[k].tempo = compactTempo(KILO_METHODS[k].tempo); });

  // Mark's own exercise names for the generator's exercises — used whenever they're in the live library
  var KILO_NAME_MAP = {
    'Dip (Weighted)': 'Dips (weighted)', 'Chin Up': 'Chin-Up', 'Pull Up (Weighted)': 'Pull-Up', 'Plyo Push Up': 'Plyo Push-Up',
    'DB Single Arm Row': 'DB Row 3pt', 'TB Pendlay Row': 'BB Pendlay Row', 'Half Kneeling Landmine Press': 'Landmine Press',
    'Half Kneeling Cable Press': 'Seated SA Cable Press', 'Conventional DL': 'Conventional Deadlift', 'Incline Barbell Press': 'Bb Incline Press',
    'Seated Leg Curl': 'Hamstring Curl (prone machine)',
  };

  // Category and 1RM link for every exercise the generator uses (from the exercise library in index.html)
  var KILO_EX_META = {"2pt Start (LSV)":["Mobility"],"A-Skip":["Performance Prep"],"Alternating Push-Off":["LB Plyos"],"Arnold Press":["UB Vertical Push"],"B-Skip":["Performance Prep"],"Back Squat":["Squat Variations","Back Squat"],"Barbell Hip Thrust":["Hamstring"],"Bb Bench Press":["UB Horizontal Push"],"Bb Overhead Press":["UB Vertical Push"],"Bb RDL":["Hamstring"],"Bench Elevated Plyo Push-Up":["UB Horizontal Push"],"Biering-Sorensen Hold":["Core Anti-Flexion"],"Bird Dog":["Core Anti-Extension"],"Bounding":["Max Velocity Running"],"Box Jump":["LB Plyos"],"Box Squat":["Squat Variations","Box Squat"],"Broad Jump W/ Stick":["LB Plyos"],"Chin Up":["UB Vertical Pull"],"Clean Grip Deadlift":["Hamstring"],"Cone One-Leg Alternating Jumps":["LB Plyos"],"Conventional DL":["Deadlift Variations","Conventional DL"],"Copenhagen Plank":["Hip ABD_ADD"],"DB Incline Zottman Curl":["Biceps Triceps"],"DB Lateral Raise":["Shoulder Complex"],"DB Single Arm Row":["UB Horizontal Pull"],"Dead Bug":["Core Anti-Extension"],"Deca Jump":["LB Plyos"],"Depth Jump":["LB Plyos"],"Dip (Weighted)":["UB Vertical Push"],"Dribbles (Calf)":["Calf Ankle"],"Dribbles (Knee)":["LB Plyos"],"Drop Landing (Stick)":["LB Plyos"],"Elbow-on-Knee DB External Rotation":["Shoulder Complex"],"Farmer Carry":["Strongman Variations"],"Fly (variation)":["Max Velocity Running"],"Front Squat":["Squat Variations","Front Squat"],"Glute-Ham Raise":["Hamstring","Glute-Ham Raise"],"Goblet Lateral Lunge":["Squat Variations"],"Ground Start Chaser Variations":["Acceleration"],"Half Kneeling Cable Press":["UB Horizontal Pull"],"Half Kneeling Landmine Press":["UB Vertical Push","Landmine Press"],"Hang Clean":["Olympic Variations","Hang Clean"],"High Pull":["Olympic Variations"],"Hurdle Jump-Continuous":["LB Plyos"],"Incline Barbell Press":["UB Horizontal Push"],"Incline DB Curl":["Biceps Triceps"],"Incline Trap-3 Raise":["Shoulder Complex"],"MB Side Toss":["LB Plyos"],"MB Step Back Side Toss":["LB Plyos"],"Med Ball Chest Pass":["UB Plyos"],"Pallof Press":["Core Anti-Rotation"],"Penta Jump":["LB Plyos"],"Plate Pinch":["Grip"],"Plyo Push Up":["UB Plyos"],"Pogo Jumps":["LB Plyos"],"Power Skips- Distance":["LB Plyos"],"Prowler Sprint":["Acceleration"],"Pull Up (Weighted)":["UB Vertical Pull","Pull Up (weighted)"],"Push-Up":["UB Horizontal Push"],"RFE Split Squat (DB)":["Squat Variations"],"Russian Alt Split Jumps":["LB Plyos"],"SL DB RDL":["Hamstring"],"Safety Bar Squat":["Squat Variations","Safety Bar Squat"],"Seated Calf Raise":["Calf Ankle"],"Seated Leg Curl":["Hamstring"],"Side Plank":["Core Anti-Lateral Flexion"],"Squat 1 1/4":["Squat Variations"],"Squat Jump":["LB Plyos"],"Standing Jump and Reach":["LB Plyos"],"Steal Start (3 steps)":["Mobility"],"Supination/Pronation Club":["Mobility"],"TB Pendlay Row":["UB Horizontal Pull"],"Trap Bar Counter Movement Jump":["Olympic Variations"],"Trap Bar Deadlift":["Deadlift Variations","Trap Bar DL"],"Tuck Jump":["LB Plyos"],"Wickets":["Max Velocity Running"],"Wrist Radial/Ulnar Deviation":["Grip"]};

  // Seconds under tension for one set of a straight tempo (X = 1 s)
  function kiloTut(tempo, reps) {
    var tt = String(tempo || '').trim().toUpperCase();
    // compact presets ("40X0", "3010") → one digit per phase
    if (/^[0-9X]{4}$/.test(tt)) tt = tt.split('').join('-');
    var m = tt.match(/^(\d+|X)-(\d+|X)-(\d+|X)-(\d+|X)$/);
    if (!m) return null;
    var r = String(reps == null ? '' : reps).trim();
    // straight sets only: "5", "6–8", "8ea", "12, 10, 8, 8" — combos, holds and timed sets aren't checked
    if (!/^\d+(\s*[–-]\s*\d+)?(\s*ea)?$/.test(r) && !/^\d+(\s*,\s*\d+)+$/.test(r)) return null;
    var n = Math.max.apply(null, r.match(/\d+/g).map(Number));
    var sec = m.slice(1).reduce(function (a, x) { return a + (x === 'X' ? 1 : +x); }, 0);
    return sec * n;
  }


  // ── Generator ──────────────────────────────────────────────────────────────
  function kiloBuildTemplates(DB) {
    var BY = {};
    (DB || []).forEach(function (e) { if (e && e.name && !BY[e.name]) BY[e.name] = e; });
    // Your live library can spell an exercise differently — fall back to the built-in category / 1RM link.
    // Method Library adds any exercise you don't have when you load the template (same as before).
    function L(name) {
      var mine = KILO_NAME_MAP[name];
      if (mine && BY[mine]) return BY[mine];          // Mark's exercise first
      var e = BY[name]; if (e) return e;
      var m = KILO_EX_META[name]; if (!m) throw new Error('Not in library: ' + name);
      return { name: name, cat: m[0], liftKey: m[1] || null };
    }
    var S = function (v) { return String(v); };
    var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
    var r1 = function (n) { return Math.round(n * 2) / 2; };
    var RPE_OF = function (p) { return p >= 92.5 ? 'RPE 9–10' : p >= 87.5 ? 'RPE 9' : p >= 82.5 ? 'RPE 8–9' : p >= 77.5 ? 'RPE 8' : p >= 70 ? 'RPE 7' : 'RPE 6'; };

    function lift(name, pair, sets, reps, load, tempo, rest, notes, method) {
      var e = L(name);
      load = load == null ? '' : String(load);
      // % only where a 1RM drives the load; otherwise effort, with the % kept in the notes
      if (/^\d+(\.\d+)?%$/.test(load.trim()) && !e.liftKey) {
        notes = [notes, '≈' + load + ' 1RM'].filter(Boolean).join(' · ');
        load = RPE_OF(parseFloat(load));
      }
      var o = { type: 'lift', name: e.name || name, cat: e.cat, pair: pair, sets: S(sets), reps: S(reps), load: load, tempo: compactTempo(tempo || ''), rest: rest || '' };
      if (notes) o.notes = notes;
      if (method) o.method = method;
      return o;
    }
    function spd(name, pair, sets, reps, distance, pct, rest, notes) {
      var e = L(name);
      var o = { type: 'speed', name: e.name || name, cat: e.cat, pair: pair, sets: S(sets), reps: S(reps), distance: distance || '', pct: pct || '', rest: rest || '' };
      if (notes) o.notes = notes;
      return o;
    }
    // A method row: the spec's prescription, with optional overrides (load from the phase wave, etc.)
    function mrow(name, pair, key, ov) {
      var m = KILO_METHODS[key]; ov = ov || {};
      var load = ov.load != null ? ov.load : m.load;
      var row = lift(name, pair, ov.sets || m.sets, ov.reps || m.reps, load, ov.tempo || m.tempo, ov.rest || m.rest,
        [m.label + ' — ' + (ov.note || m.note)].concat(ov.extra ? [ov.extra] : []).join(' · '), key);
      if (m.ext) row.ext = m.ext;
      if (m.vel) row.vel = m.vel;
      return row;
    }
    var blk = function (blockType, label, exercises) { return { blockType: blockType, label: label, exercises: exercises.filter(Boolean) }; };
    var day = function (d, type, label, blocks) { return { day: d, type: type, label: label, blocks: (blocks || []).filter(function (b) { return b && b.exercises && b.exercises.length; }) }; };
    var off = function (d) { return { day: d, type: 'off', label: d === 'Sun' || d === 'Sat' ? 'OFF' : 'OFF / Recovery', blocks: [] }; };
    var week = function (n, label, days) { return { week: n, isDeload: false, label: label, progMod: { label: 'W' + n, sets: 1, reps: 1, load: 1 }, days: days }; };
    var DAYS7 = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    function layout(map) { return DAYS7.map(function (d) { return map[d] ? Object.assign({}, map[d], { day: d }) : off(d); }); }
    var four = function (LA, UA, LB, UB) { return layout({ Mon: LA, Tue: UA, Thu: LB, Fri: UB }); };

    // ALTIS speed blocks (same as the rest of the library)
    function accelBlock(lvl, note) {
      var v = [
        [spd('2pt Start (LSV)', 'C', 4, 1, '10yd', '85%', '1:30', 'Build-ups — technique before speed'), spd('2pt Start (LSV)', 'C', 2, 1, '20yd', '85%', '2:00')],
        [spd('2pt Start (LSV)', 'C', 4, 1, '10yd', '95%+', '1:30', 'Zone 5 — full rest'), spd('Ground Start Chaser Variations', 'C', 3, 1, '20yd', '95%+', '2:30', 'Rise smoothly — no early rise')],
        [spd('2pt Start (LSV)', 'C', 4, 1, '10yd', '95%+', '1:30', 'Zone 5 — full rest'), spd('Steal Start (3 steps)', 'C', 2, 1, '20yd', '95%+', '2:30', 'Base-steal start'), spd('Prowler Sprint', 'D', 2, 1, '20yd', '95%+', '3:00', 'Projection — ~15% velocity loss')],
        [spd('Steal Start (3 steps)', 'C', 3, 1, '15yd', '95%+', '2:00', 'Low volume — quality only'), spd('2pt Start (LSV)', 'C', 2, 1, '30yd', '95%+', '3:00')],
      ][lvl];
      return blk('speed', 'Warm-up A · Acceleration' + (note ? ' · ' + note : ''), [
        spd('Dribbles (Calf)', 'A', 1, 2, '20yd', '70%', ':30', 'Rhythm — rising cadence'),
        spd('A-Skip', 'A', 1, 2, '20yd', '75%', ':30', 'Tall, pelvis neutral'),
        spd('Power Skips- Distance', 'B', 1, 3, '20yd', '85%', ':45', 'Projection primer before every accel'),
      ].concat(v));
    }
    function maxVBlock(lvl, note) {
      var v = [
        [spd('Wickets', 'C', 3, 1, '30yd', '85%', '1:30', 'Strike from above'), spd('Fly (variation)', 'C', 2, 1, '10yd fly', '90%', '3:00', '20–30 yd build-in')],
        [spd('Wickets', 'C', 3, 1, '30yd', '90%', '1:30'), spd('Fly (variation)', 'C', 4, 1, '10yd fly', '95%+', '3:30', 'Zone 5 — log the fly-10 (MSS test)')],
        [spd('Wickets', 'C', 3, 1, '30yd', '90%', '1:30'), spd('Fly (variation)', 'C', 3, 1, '20yd fly', '95%+', '4:00', 'Zone 5 — 30–60 s rest per 1 s sprinting'), spd('Bounding', 'D', 2, 1, '30yd', '90%', '2:00', 'Scissor-bound bleeds')],
        [spd('Fly (variation)', 'C', 3, 1, '10yd fly', '95%+', '4:00', 'Low volume — one quality exposure')],
      ][lvl];
      return blk('speed', 'Warm-up B · Max Velocity' + (note ? ' · ' + note : ''), [
        spd('Dribbles (Knee)', 'A', 1, 2, '20yd', '75%', ':30', 'Dribble-bleed into full stride'),
        spd('B-Skip', 'A', 1, 2, '20yd', '75%', ':30'),
        spd('Pogo Jumps', 'B', 2, 10, '', 'Stiff', ':45', 'Rudiment hops — contacts, not distance'),
      ].concat(v));
    }

    // Pitcher swaps (Brewster risk list) — pressing to landmine / cable, no catch, no dips
    var PITCHER_SWAP = {
      'Bb Bench Press': ['Half Kneeling Landmine Press', 'Pitcher swap — no barbell bench (Brewster)'],
      'Incline Barbell Press': ['Half Kneeling Cable Press', 'Pitcher swap — cable press instead of barbell incline'],
      'Bb Overhead Press': ['Half Kneeling Landmine Press', 'Pitcher swap — no barbell overhead press (Brewster)'],
      'Arnold Press': ['Half Kneeling Landmine Press', 'Pitcher swap — no overhead press (Brewster)'],
      'Dip (Weighted)': ['Push-Up', 'Pitcher swap — full-range push-up instead of dips (Brewster)'],
      'Hang Clean': ['High Pull', 'Pitcher swap — pull, no catch (Brewster / The System)'],
      'Med Ball Chest Pass': ['MB Step Back Side Toss', 'Pitcher swap — rotational throw instead of chest pass'],
      'Plyo Push Up': ['MB Step Back Side Toss', 'Pitcher swap — rotational throw instead of plyo push-ups'],
      'Bench Elevated Plyo Push-Up': ['MB Step Back Side Toss', 'Pitcher swap — rotational throw'],
    };
    var SWAP = {};
    Object.keys(PITCHER_SWAP).forEach(function (k) { SWAP[k] = PITCHER_SWAP[k]; try { SWAP[L(k).name] = PITCHER_SWAP[k]; } catch (e) {} });
    function pitcherize(weeks) {
      var w = clone(weeks);
      w.forEach(function (wk) { wk.days.forEach(function (d) { d.blocks.forEach(function (b) {
        b.exercises = b.exercises.map(function (ex) {
          var s = SWAP[ex.name]; if (!s) return ex;
          var n = L(s[0]);
          var o = Object.assign({}, ex, { name: n.name || s[0], cat: n.cat, notes: s[1] + (ex.notes ? ' · ' + ex.notes : '') });
          // Pressing methods (bands, hooks, iso contrast) don't carry to a landmine — straight effort sets
          if (o.method && b.blockType === 'lift' && /Press|Push-Up/.test(o.name)) {
            o.reps = /\d/.test(String(o.reps)) && !/\+/.test(o.reps) ? o.reps : '5'; o.load = 'RPE 7'; o.tempo = '30X0'; delete o.method; delete o.ext; delete o.vel;
            o.notes = s[1] + ' · straight sets, intent to accelerate';
          } else if (/%/.test(o.load || '')) o.load = 'RPE 7';
          return o;
        });
      }); }); });
      return w;
    }

    // 3-day full body from the 4-day week. Mon L1+U1 · Wed L2+U2 · Fri L1+U2 volume day (one set less)
    function liftEx(d) { var b = d.blocks.filter(function (x) { return x.blockType === 'lift'; })[0]; return b ? b.exercises : []; }
    function byPair(exs, p) { return exs.filter(function (e) { return e.pair === p; }); }
    function repair(exs, p) { return exs.map(function (e) { return Object.assign({}, e, { pair: p }); }); }
    function trim(exs) {
      return exs.map(function (e) {
        var n = parseInt(e.sets, 10); if (!(n > 0)) return e;
        var ns = Math.max(2, n - 1), o = Object.assign({}, e, { sets: S(ns) });
        if (/^\s*\d+(\s*,\s*\d+)+\s*$/.test(o.reps)) o.reps = o.reps.split(',').slice(0, ns).map(function (x) { return x.trim(); }).join(', ');
        return o;
      });
    }
    function merge(Ld, Ud, label, lighter) {
      var le = liftEx(Ld), ue = liftEx(Ud);
      var hasPlan = le.some(function (e) { return e.pair === 'A' && /plyo plan/i.test(e.notes || ''); });
      var main = hasPlan ? 'C' : 'B', asst = hasPlan ? 'D' : 'C', rem = hasPlan ? 'E' : 'D';
      // Plyo plan in 3 days: Mon / Wed run plan jumps 1–2, the Friday volume day runs plan jump 3 (+ core) — weekly contacts stay on plan
      var head = hasPlan && lighter ? byPair(le, 'B') : byPair(le, 'A');
      var lifts = [].concat(
        repair(head, 'A'),
        repair(byPair(le, main), 'B'),
        repair(byPair(ue, 'B'), 'C'),
        repair([byPair(le, asst)[0], byPair(ue, 'C')[0]].filter(Boolean), 'D'),
        repair([byPair(le, rem)[0], byPair(ue, 'D')[0]].filter(Boolean), 'E')
      );
      var sp = Ld.blocks.filter(function (b) { return b.blockType === 'speed'; });
      return day('', 'lift', label, clone(sp.concat([blk('lift', 'Full Body', lighter ? trim(lifts) : lifts)])));
    }
    var theme = function (d) { return (d.label.split('·')[1] || d.label).trim(); };
    function to3(w4) {
      var td = w4.days.filter(function (d) { return d.type !== 'off'; });
      return Object.assign({}, w4, { days: layout({
        Mon: merge(td[0], td[1], 'Full Body A · ' + theme(td[0])),
        Wed: merge(td[2], td[3], 'Full Body B · ' + theme(td[2])),
        Fri: merge(td[0], td[3], 'Full Body C · Volume day', true),
      }) });
    }

    var T = [];
    function add(meta, weeks4) {
      var base = Object.assign({ group: 'athlete', variant: 'all' }, meta);
      delete base.pitcherWeeks; delete base.pitcher;
      T.push(Object.assign({}, base, { key: meta.key + '-4', days: 4, weeks: weeks4 }));
      T.push(Object.assign({}, base, { key: meta.key + '-3', days: 3, weeks: weeks4.map(to3) }));
      if (meta.pitcher) {
        var p4 = pitcherize(meta.pitcherWeeks || weeks4);
        T.push(Object.assign({}, base, { key: meta.key + '-4-p', days: 4, variant: 'pitcher', weeks: p4 }));
        T.push(Object.assign({}, base, { key: meta.key + '-3-p', days: 3, variant: 'pitcher', weeks: p4.map(to3) }));
      }
    }

    // ── KILO plyo plan: weekly contacts kept, split over both lower days, 3–6 sets an exercise ──
    var PLYO = (function () {
      var W = [];
      var ph = function (wks, list) { wks.forEach(function (wn, x) { W[wn - 1] = list.map(function (p) { return { n: p[0], note: p[1], s: Array.isArray(p[2]) ? p[2][x] : p[2], r: Array.isArray(p[3]) ? p[3][x] : p[3] }; }); }); };
      ph([1, 2, 3], [['Pogo Jumps', 'Two-foot ankle hop', [4, 5, 6], 15], ['Standing Jump and Reach', '', [3, 4, 5], 8], ['Russian Alt Split Jumps', 'Split squat jump', [3, 4, 5], 6]]);
      ph([4, 5, 6], [['Pogo Jumps', 'Two-foot ankle hop', [5, 6, 7], 15], ['Hurdle Jump-Continuous', 'Hurdle jump', [4, 6, 7], 5], ['Alternating Push-Off', '', [4, 5, 7], 8]]);
      ph([7, 8, 9], [['Tuck Jump', '', [12, 12, 12], [6, 8, 10]], ['Hurdle Jump-Continuous', 'Hurdle jump and reach', [11, 11, 12], [4, 5, 6]], ['Penta Jump', 'Measure distance', [10, 10, 11], 1]]);
      ph([10, 11, 12], [['Cone One-Leg Alternating Jumps', '', [8, 10, 12], 6], ['Depth Jump', 'Depth jump and reach — box height by strength', [8, 10, 12], 6], ['Deca Jump', 'Distance that grows jump to jump = reactive; long first bound that shrinks = explosive', [6, 7, 8], 1]]);
      return W;
    })();
    var CONTACTS = [100, 125, 160, 125, 160, 200, 160, 200, 250, 200, 250, 300];
    // One session's dose: half the weekly table, 3–6 sets
    function plyoRow(p, wn, pair) {
      var half = Math.max(1, Math.round(p.s * p.r / 2));
      var sets = Math.min(6, Math.max(3, Math.round(half / p.r)));
      var reps = Math.max(1, Math.round(half / sets));          // reps fit the session's dose, so weekly contacts track the KILO table
      if (p.r === 1) { sets = Math.min(6, Math.max(3, half)); reps = 1; }
      return lift(p.n, pair, sets, reps, 'BW', 'X-0-X-0', wn <= 6 ? '2:00' : '1:30',
        ['KILO plyo plan W' + wn + ' (~' + CONTACTS[wn - 1] + ' contacts a week, half each lower day)', p.note, 'never to failure'].filter(Boolean).join(' · '));
    }

    // ── Day pieces ─────────────────────────────────────────────────────────────
    var CORE = { L1: ['Dead Bug', 2, '6ea', 'BW', '3-1-3-1', ':30'], L2: ['Pallof Press', 2, '10ea', 'Light', '2-0-1-2', ':30'],
      U1: ['Bird Dog', 2, '6ea', 'BW', '3-1-3-1', ':30'], U2: ['Side Plank', 2, '30s ea', 'BW', '', ':30'] };
    var core = function (d, pair) { var c = CORE[d]; return lift(c[0], pair || 'A', c[1], c[2], c[3], c[4], c[5], 'Core — between jump sets'); };
    function antagonist(d, ph, sets) {
      var a = ph.acc;
      if (d === 'L1') return a ? lift('Seated Leg Curl', 'B', sets, '8–10', 'RPE 8', '3-0-1-0', '1:30', 'Antagonist — knee flexion')
        : lift('Seated Leg Curl', 'B', sets, 5, 'RPE 8', '6-0-1-0', '1:30', 'Antagonist — 2-1 method: up with two legs, lower with one');
      if (d === 'L2') return lift('Glute-Ham Raise', 'B', sets, a ? '6–8' : '4–5', 'BW', a ? '3-0-1-0' : '4-0-1-0', '1:30', 'Antagonist — hamstring');
      return lift(d === 'U1' ? 'Chin Up' : 'Pull Up (Weighted)', 'B', sets, a ? '6–8' : '3–5', a ? 'BW' : 'RPE 8', a ? '3-0-1-0' : '3-0-X-0', a ? '2:00' : '2:30',
        'Antagonist — chin / pull-up with every upper day (KILO long-term)');
    }
    function assist(d, ph, mainName) {
      var a = ph.acc, C = function (n, s, r, load, t, rest, note) { return lift(n, 'C', s, r, load, t, rest, note); };
      var hinge = /Deadlift|DL$/.test(mainName || '');
      return {
        L1: a ? [C('RFE Split Squat (DB)', 3, '10ea + rest-pause', 'RPE 8', '3-0-1-0', '1:30', 'Extended set — 10 reps, 10–15 s, max reps at the same load'), C('Seated Calf Raise', 3, '12–15', 'RPE 8', '3-0-1-1', '1:00', 'Calf / ankle stiffness for sprinting')]
          : [C('RFE Split Squat (DB)', 3, '6ea', 'RPE 8', '4-0-1-0', '1:30', 'Accentuated eccentric — 4 s lowering'), C('Seated Calf Raise', 4, 8, 'Heavy', '4-0-1-1', '1:00')],
        L2: [hinge ? C('Goblet Lateral Lunge', 3, a ? '8ea' : '6ea', 'RPE 7', '3-0-1-0', '1:15', a ? '1¼ reps — quarter rep at the bottom' : null)
                   : C(ph.gpp ? 'Clean Grip Deadlift' : 'Bb RDL', 3, a ? 8 : 5, 'RPE 7–8', a ? '3-0-1-0' : '4-0-1-0', '2:00', ph.gpp ? 'Deadlift variation as C1 on front-squat day (KILO)' : null),
             hinge ? C('Barbell Hip Thrust', 3, a ? 10 : 6, 'RPE 8', '2-0-1-2', '1:30') : C('Goblet Lateral Lunge', 3, a ? '8ea' : '6ea', 'RPE 7', '3-0-1-0', '1:15', a ? '1¼ reps — quarter rep at the bottom' : null)],
        U1: a ? [C('DB Single Arm Row', 3, '12 / 10 / 8', 'RPE 8', '2-0-1-0', '1:30', 'Drop set — ~10% drop per step, no rest'), C('Half Kneeling Cable Press', 3, '10ea', 'RPE 7', '3-0-1-0', '1:15', '1¼ reps at the bottom')]
          : [C('DB Single Arm Row', 3, '6ea', 'RPE 8', '3-0-1-0', '1:30'), C('DB Lateral Raise', 3, 10, 'Light', '4-0-1-0', '1:00', 'Telle method — accentuated eccentric')],
        U2: a ? [C('TB Pendlay Row', 3, 10, 'RPE 7–8', '2-0-1-0', '1:30'), C('DB Incline Zottman Curl', 3, '8 / 6 / 6', 'RPE 8', '3-0-1-0', '1:00', 'Mechanical-advantage set — pronated → supinated → neutral, same load')]
          : [C('TB Pendlay Row', 3, 6, 'RPE 8', '2-0-1-0', '1:30'), C('Incline DB Curl', 3, 6, 'RPE 7', '3-0-1-2', '1:00', 'Pause at the top (yielding iso)')],
      }[d];
    }
    function remedial(d, pair, u2IsDip) {
      var R = function (n, s, r, load, t, rest, note) { return lift(n, pair || 'D', s, r, load, t, rest, note); };
      return {
        L1: [R('Biering-Sorensen Hold', 2, '30–40s', 'BW', '', ':45', 'Low-back endurance — twice a week if Biering-Sorensen < 176 s (then no conventional deadlift)'), R('Copenhagen Plank', 2, '20s ea', 'BW', '', ':45', 'Adductor strength')],
        L2: [R('Biering-Sorensen Hold', 2, '30–40s', 'BW', '', ':45', 'Second low-back exposure'), R('Copenhagen Plank', 2, '20s ea', 'BW', '', ':45')],
        U1: [R('Elbow-on-Knee DB External Rotation', 2, '8ea', 'Light', '3-0-1-0', ':45', 'Shoulder balance — twice a week if the ER / trap-3 score is under 4'), R('Incline Trap-3 Raise', 2, 10, 'Light', '2-0-1-2', ':45')],
        U2: [R('Elbow-on-Knee DB External Rotation', 2, '8ea', 'Light', '3-0-1-0', ':45', u2IsDip ? 'External rotation after dip days (KILO)' : 'Shoulder balance'), R('Incline Trap-3 Raise', 2, 10, 'Light', '2-0-1-2', ':45')],
      }[d];
    }
    function grip(d, o) {
      var G = function (n, s, r, load, t, rest, note) { return lift(n, 'E', s, r, load, t, rest, note); };
      if (d[0] === 'L') return [G('Plate Pinch', 2, '30s', 'Heavy', '', ':45', 'Grip under 125 psi (men) / 90 psi (women) → twice a week'), G('Farmer Carry', 2, '30yd', 'Heavy', '', '1:00')];
      return [G('Supination/Pronation Club', 2, '10ea', 'Light', '2-0-2-0', ':30', o.forearm ? 'Forearm work for throwing-elbow health' : 'Forearm'), G('Wrist Radial/Ulnar Deviation', 2, '12ea', 'Light', '2-0-2-0', ':30', 'Wrist deviation — throwing-elbow health')];
    }

    // ── A-series lifts by phase (athletic-development rotation) ────────────────
    var LIFTS = {
      gppAcc1: { U1: 'Arnold Press', L1: 'Back Squat', U2: 'Dip (Weighted)', L2: 'Front Squat' },
      gppAcc2: { U1: 'Arnold Press', L1: 'Back Squat', U2: 'Incline Barbell Press', L2: 'Front Squat' },
      gppInt: { U1: 'Bb Overhead Press', L1: 'Safety Bar Squat', U2: 'Bb Bench Press', L2: 'Conventional DL' },
      sppAcc: { U1: 'Bb Overhead Press', L1: 'Back Squat', U2: 'Bb Bench Press', L2: 'Front Squat' },
      sppInt: { U1: 'Incline Barbell Press', L1: 'Back Squat', U2: 'Dip (Weighted)', L2: 'Box Squat' },
      base1: { U1: 'Arnold Press', L1: 'Back Squat', U2: 'Dip (Weighted)', L2: 'Front Squat' },
      base2: { U1: 'Bb Overhead Press', L1: 'Safety Bar Squat', U2: 'Bb Bench Press', L2: 'Trap Bar Deadlift' },
      base3: { U1: 'Arnold Press', L1: 'Back Squat', U2: 'Incline Barbell Press', L2: 'Front Squat' },
    };

    // Each block method → the B1 row for each day, plus the A1 jump. ph: { p, s, r, acc, gpp, lifts, method }
    // P(name) = straight IMCA sets at the phase's sets/reps (tempo chosen so TUT fits the phase)
    var METHODS = {
      imca: { tag: 'Concentric (IMCA)', fn: function (ph, w, pw, P) { return { L1: P(ph.lifts.L1), L2: P(ph.lifts.L2), U1: P(ph.lifts.U1), U2: P(ph.lifts.U2) }; } },
      ecc: { tag: 'Eccentric', fn: function (ph, w, pw, P, o) {
        var x = [{ s: 5, r: 5, t: '6-0-X-0', p: 70 }, { s: 4, r: 4, t: '8-0-X-0', p: 72.5 }, { s: 3, r: 3, t: '10-0-X-0', p: 75 }][w - 1];
        var ext = function (n) { return mrow(n, 'B', 'ecc-extended', { sets: x.s, reps: x.r, tempo: x.t, load: x.p + '%', note: 'about 30 s under tension a set; W' + w + ' of 3' }); };
        var supra = o.supra && w === 3 && !o.pitcher;
        var up = function (n) { return w === 2 ? mrow(n, 'B', 'ecc-conc') : mrow(n, 'B', 'conc-ecc'); };
        return { labelP: supra ? 105 : x.p, L1: supra ? mrow(ph.lifts.L1, 'B', 'ecc-supra') : ext(ph.lifts.L1), L2: ext(ph.lifts.L2),
          U1: o.pitcher ? P(ph.lifts.U1) : up(ph.lifts.U1), U2: o.pitcher ? P(ph.lifts.U2) : up(ph.lifts.U2),
          jump: lift('Drop Landing (Stick)', 'A', 3, [5, 6, 6][w - 1], 'BW', '', '1:30', ['Low box', 'Low → medium box', 'Medium box'][w - 1] + ' · stick and hold 3–5 s (eccentric block)') };
      } },
      iso: { tag: 'Isometric — yielding', fn: function (ph, w, pw, P, o) { var ld = r1(pw) + '%'; return {
        L1: mrow(ph.lifts.L1, 'B', 'yield-mechdis', { load: ld }), L2: mrow(ph.lifts.L2, 'B', 'yield-3pause-ecc', { load: ld }),
        U1: mrow(ph.lifts.U1, 'B', 'yield-stick', { load: ld }), U2: o.pitcher ? P(ph.lifts.U2) : mrow(ph.lifts.U2, 'B', 'yield-iso-contrast') }; } },
      isoInt: { tag: 'Isometric — overcoming', fn: function (ph, w, pw, P, o) { var ld = r1(pw) + '%'; return {
        L1: mrow(ph.lifts.L1, 'B', 'over-isometronic', { load: ld, sets: ph.s }), L2: mrow(ph.lifts.L2, 'B', 'over-functional'),
        U1: mrow(ph.lifts.U1, 'B', 'over-isometronic', { load: ld, sets: ph.s }), U2: o.pitcher ? P(ph.lifts.U2) : mrow(ph.lifts.U2, 'B', 'over-fi-contrast') }; } },
      explosive: { tag: 'Speed-strength — explosive', fn: function (ph, w, pw, P, o) { return {
        L1: mrow(ph.lifts.L1, 'B', 'ss-variable'), L2: mrow('Hang Clean', 'B', 'ss-olympic', { note: 'Olympic variation on the second lower day — 0.5–0.75 m/s, stop at a 7–10% velocity drop' }),
        U1: mrow(ph.lifts.U1, 'B', 'ss-variable', { load: '50%' }), U2: mrow(ph.lifts.U2, 'B', 'ss-variable', { load: '50%', note: 'speed press, ~20% band tension at the top' }),
        jump: lift('Trap Bar Counter Movement Jump', 'A', 4, 3, 'Light (20–30% BW)', 'X-0-X-0', '1:30', 'Ballistic — release, no deceleration'),
        ujump: lift('Plyo Push Up', 'A', 3, 5, 'BW', 'X-0-X-0', '1:30', 'Ballistic') }; } },
      starting: { tag: 'Speed-strength — starting strength', fn: function (ph, w, pw, P, o) { return {
        L1: mrow(ph.lifts.L1, 'B', 'ss-deadstop'), L2: mrow(ph.lifts.L2, 'B', 'ss-deadstop', { load: '60%', note: 'deadstop off the box — relax, then contract everything at once' }),
        U1: mrow(ph.lifts.U1, 'B', 'ss-deadstop'), U2: mrow(ph.lifts.U2, 'B', 'ss-deadstop'),
        jump: lift('Squat Jump', 'A', 4, 3, 'BW', '2-3-X-0', '1:30', 'Paused squat jump (3-count) — starting strength, no countermovement'),
        ujump: lift('Med Ball Chest Pass', 'A', 4, 3, '8 lb MB', 'X-0-X-0', '1:30', 'From a dead stop — no wind-up') }; } },
      fastEcc: { tag: 'Fast eccentrics', fn: function (ph, w, pw, P) { return {
        L1: mrow(ph.lifts.L1, 'B', 'ecc-expl-accent'), L2: mrow(ph.lifts.L2, 'B', 'ecc-dyn-iso'),
        U1: mrow(ph.lifts.U1, 'B', 'ecc-dyn-iso'), U2: mrow(ph.lifts.U2, 'B', 'ecc-expl-accent', { sets: 4 }) }; } },
      isoDyn: { tag: 'Iso-dynamic', fn: function (ph, w, pw, P, o) { return {
        L1: mrow(ph.lifts.L1, 'B', 'yield-stato'), L2: mrow(ph.lifts.L2, 'B', 'yield-stato-band'),
        U1: mrow(ph.lifts.U1, 'B', 'yield-stato'), U2: o.pitcher ? P(ph.lifts.U2) : mrow(ph.lifts.U2, 'B', 'over-fi-contrast') }; } },
      reactiveA: { tag: 'Reactive — myotatic', fn: function (ph, w, pw, P) { return {
        L1: mrow('Squat 1 1/4', 'B', 'react-myotatic'), L2: mrow(ph.lifts.L2, 'B', 'react-myotatic', { note: '1¼ reps on the front squat' }),
        U1: mrow(ph.lifts.U1, 'B', 'react-myotatic'), U2: mrow(ph.lifts.U2, 'B', 'react-myotatic'),
        jump: lift('Depth Jump', 'A', 4, 5, 'BW', 'X-0-X-0', '2:00', 'Reactive — short contacts, RSI ≈ 2.0 before complex work'),
        ujump: lift('Bench Elevated Plyo Push-Up', 'A', 4, 5, 'BW', 'X-0-X-0', '1:30', 'Reactive — short contacts') }; } },
      reactiveI: { tag: 'Reactive — ⅓ reps', fn: function (ph, w, pw, P) { return {
        L1: mrow(ph.lifts.L1, 'B', 'react-third'), L2: mrow(ph.lifts.L2, 'B', 'react-third'),
        U1: mrow(ph.lifts.U1, 'B', 'react-third'), U2: mrow(ph.lifts.U2, 'B', 'react-third'),
        jump: lift('Hurdle Jump-Continuous', 'A', 4, 5, 'BW', 'X-0-X-0', '2:00', 'Reactive — fast off the ground'),
        ujump: lift('Plyo Push Up', 'A', 4, 5, 'BW', 'X-0-X-0', '1:30', 'Reactive push-up') }; } },
    };

    // Straight-set tempo that keeps TUT inside the phase range (Acc ≤ 70 s, Int ≤ 40 s)
    function fitTempo(reps, acc, base) {
      var r = Math.max.apply(null, (String(reps).match(/\d+/g) || ['5']).map(Number));
      var cap = acc ? 70 : 40, t = base;
      var tries = acc ? ['4-0-X-0', '3-0-X-0', '3-0-1-0', '2-0-1-0'] : ['4-0-X-0', '3-0-X-0', '2-0-X-0'];
      if (kiloTut(t, r) <= cap) return t;
      for (var i = 0; i < tries.length; i++) if (kiloTut(tries[i], r) <= cap) return tries[i];
      return '2-0-1-0';
    }

    // One KILO week. o: { client, pitcher, beg, supra, forearm, plyo (1–12 or 0), speed (ALTIS level) }
    function kWeek(n, ph, w, o) {
      var pw = ph.p - 2.5 + 2.5 * (w - 1);
      var t = fitTempo(ph.r, ph.acc, (ph.gpp || o.beg) ? '4-0-X-0' : '3-0-X-0');
      var R = ph.acc ? '2:30' : '3:00';
      var P = function (name) { return lift(name, 'B', ph.s, ph.r, r1(pw) + '%', t, R, 'A-series — same lift all 3 weeks · intent to accelerate every rep', ph.acc ? 'imca-acc' : 'imca-int'); };
      var A = METHODS[ph.method].fn(ph, w, pw, P, o);
      var plan = o.plyo ? PLYO[o.plyo - 1] : null;
      var mainName = function (d) { return A[d].name; };
      var mk = function (d, label, speed) {
        var lower = d[0] === 'L', main = A[d], sets = parseInt(main.sets, 10) || ph.s;
        var head, mainPair = 'B', asstPair = 'C', remPair = 'D';
        if (lower && plan) {
          // plyo-plan day: A1/A2 plan jumps, B1 third jump + B2 core, then C main, D assistance, E remedial
          head = [plyoRow(plan[0], o.plyo, 'A'), plyoRow(plan[1], o.plyo, 'A'), plyoRow(plan[2], o.plyo, 'B'), core(d, 'B')];
          mainPair = 'C'; asstPair = 'D'; remPair = 'E';
        } else {
          var j = lower ? (A.jump ? clone(A.jump) : d === 'L1' ? lift('Box Jump', 'A', 3, 3, 'BW', '', '1:00') : lift('Broad Jump W/ Stick', 'A', 3, 3, 'BW', '', '1:00'))
            : (A.ujump ? clone(A.ujump) : d === 'U1' ? lift('MB Side Toss', 'A', 3, '4ea', '8 lb MB', '', '1:00') : lift('Med Ball Chest Pass', 'A', 3, 5, '8 lb MB', '', '1:00'));
          j.pair = 'A';
          head = [j, core(d, 'A')];
        }
        var ant = antagonist(d, ph, Math.min(4, Math.max(3, sets)));
        var rows = head.concat(
          [Object.assign({}, main, { pair: mainPair }), Object.assign({}, ant, { pair: mainPair })],
          assist(d, ph, main.name).map(function (e) { return Object.assign({}, e, { pair: asstPair }); }),
          remedial(d, remPair, ph.lifts.U2 === 'Dip (Weighted)'),
          remPair === 'D' ? grip(d, o) : []
        );
        var sp = speed && !o.client ? (d === 'L1' ? accelBlock(o.speed) : maxVBlock(o.speed)) : null;
        return day('', 'lift', label + (sp ? ' · ' + (d === 'L1' ? 'Acceleration' : 'Max Velocity') : ''), [sp, blk('lift', lower ? 'Lower' : 'Upper', rows)]);
      };
      var L1 = mk('L1', 'Lower 1', true), U1 = mk('U1', 'Upper 1'), L2 = mk('L2', 'Lower 2', true), U2 = mk('U2', 'Upper 2');
      // Label = what the first lower day's main lift actually does
      var m1 = A.L1, ld = /%/.test(m1.load) ? m1.load : (A.labelP || r1(pw)) + '%';
      return week(n, ph.lab + ' · ' + METHODS[ph.method].tag + ' · W' + w + ' · ' + m1.sets + '×' + m1.reps + ' @ ' + ld + (plan ? ' · plyo W' + o.plyo : ''), four(L1, U1, L2, U2));
    }
    function kBlock(blocks, o, plyoFrom) {
      var out = [];
      blocks.forEach(function (ph, bi) { for (var w = 1; w <= 3; w++) {
        var n = bi * 3 + w;
        var plyo = plyoFrom && n >= plyoFrom.at ? plyoFrom.start + (n - plyoFrom.at) : 0;
        out.push(kWeek(n, ph, w, Object.assign({}, o, { plyo: plyo, speed: ph.gpp ? (bi ? 2 : 1) : 2 })));
      } });
      return out;
    }
    var PH = function (lab, p, s, r, acc, gpp, lifts, method) { return { lab: lab, p: p, s: s, r: r, acc: acc, gpp: gpp, lifts: LIFTS[lifts], method: method }; };
    var GPP = function (esdHigh) { return [
      PH('GPP Acc 1', 70, 3, '10–12', true, true, 'gppAcc1', 'imca'),
      PH('GPP Int 1', 80, 5, '5–7', false, true, 'gppInt', esdHigh ? 'isoInt' : 'ecc'),
      PH('GPP Acc 2', 75, 4, '12, 10, 8, 8', true, true, 'gppAcc2', esdHigh ? 'explosive' : 'iso'),
      PH('GPP Int 2', 85, 6, '3–5', false, true, 'gppInt', 'imca'),
    ]; };
    var SPP = function (xsdHigh) { return [
      PH('SPP Acc 3', 74, 4, 8, true, false, 'sppAcc', 'imca'),
      PH('SPP Int 3', 88, 6, '3–4', false, false, 'sppInt', xsdHigh ? 'isoDyn' : 'fastEcc'),
      PH('SPP Acc 4', 77, 5, '6–8', true, false, 'sppAcc', xsdHigh ? 'reactiveA' : 'explosive'),
      PH('SPP Int 4', 90, 6, '2–3', false, false, 'sppInt', xsdHigh ? 'reactiveI' : 'starting'),
    ]; };
    var SHORT = function (high) { return [
      PH('GPP Acc 1', 70, 3, '10–12', true, true, 'gppAcc1', 'imca'),
      PH('GPP Int 1', 78, 5, '5–7', false, true, 'gppInt', high ? 'isoInt' : 'ecc'),
      PH('SPP Acc 4', 83, 5, '4–5', true, false, 'sppAcc', high ? 'reactiveA' : 'explosive'),
      PH('SPP Int 4', 90, 6, '2–3', false, false, 'sppInt', high ? 'reactiveI' : 'starting'),
    ]; };
    var LAYOUT = 'Day layout: A1 jump + A2 core · B1 main lift (the method) + B2 antagonist · C assistance · D remedial · E grip / forearm (plyo-plan days: A/B plan jumps + core, C main, D assistance, E remedial). The method replaces the main lift\'s straight sets. ';
    var RULES = 'Same A lifts all 3 weeks of a mesocycle; load waves −2.5 / 0 / +2.5% around the block average. Acc→Int +8–15%, Acc→Acc +2–8%. Straight-set tempo keeps time under tension ≤ 70 s in Accumulation and ≤ 40 s in Intensification. Conventional deadlift only in GPP Intensification and only if Biering-Sorensen > 176 s — trap bar or speed pulls otherwise; never in SPP. Isometric holds stay under 40 s. Plyo plan: weekly contacts split over both lower days, 3–6 sets an exercise, never to failure.';
    var base = { category: 'Method Library · KILO Advanced', source: 'KILO Strength Society — Specialty Technique Seminar (concentric, eccentric and isometric methods) + Athletic Development periodization' };
    var meta = function (o) { return Object.assign({}, base, o, { notes: LAYOUT + o.notes }); };

    // ── Base KILO Acc / Int (IMCA every block) ──
    var BASE = [PH('Acc 1', 70, 3, '10–12', true, true, 'base1', 'imca'), PH('Int 1', 80, 5, '5–7', false, true, 'base2', 'imca'),
      PH('Acc 2', 75, 4, '12, 10, 8, 8', true, true, 'base3', 'imca'), PH('Int 2', 85, 6, '3–5', false, true, 'base2', 'imca')];
    var bnotes = 'KILO 3-week mesocycles: Acc 1 70% 3×10–12 → Int 1 80% 5×5–7 → Acc 2 75% descending 12/10/8/8 → Int 2 85% 6×3–5. Same A lifts for all 3 weeks of a mesocycle. Acc→Int +8–15%; Acc→Acc +2–8%. Trap bar in SPP — no conventional deadlifts near the season. ';
    add({ key: 'kilo', category: 'Method Library · Strength', phaseType: 'transmutation', sq: { fhyp: 1, maxstr: 2 }, source: 'KILO Strength Society — Athletic Development, Long/Short-Term Periodization', pitcher: true,
      name: '🏋 KILO Acc / Int Mesocycles (12 wk)', notes: LAYOUT + bnotes + RULES }, kBlock(BASE, {}));
    add({ key: 'c-kilo', group: 'client', category: 'Private Client · Strength', phaseType: 'transmutation', sq: { fhyp: 1, maxstr: 2 }, source: 'KILO Strength Society',
      name: '🏋 Client · KILO Acc / Int (12 wk)', notes: LAYOUT + bnotes + 'Client version: no sprint block. ' + RULES }, kBlock(BASE, { client: true }));

    // ── Advanced, test-driven blocks ──
    var fullO = { supra: true };
    add(meta({ key: 'kilo-gpp-ecc', phaseType: 'accumulation', sq: { fhyp: 1, maxstr: 2 }, pitcher: true, pitcherWeeks: kBlock(GPP(false), { pitcher: true }),
      name: '🧪 KILO GPP · ESD under 125% — Eccentric / Isometric (12 wk)',
      notes: 'For an Eccentric Strength Deficit under 125% (needs eccentric strength and size): Acc 1 IMCA 70% → Int 1 eccentric (extended eccentric on lower, concentric-eccentric / eccentric-concentric combos on upper, supra-maximal eccentric in week 3 only with 2+ years of training age; drop landings as the jump) → Acc 2 yielding isometrics 75% → Int 2 IMCA 85%. Extended sets in the C series on Acc weeks, accentuated eccentrics (2-1, Telle) on Int weeks. Pitcher version: no supra-max, straight pressing. ' + RULES }),
      kBlock(GPP(false), fullO));
    add(meta({ key: 'kilo-gpp-iso', phaseType: 'accumulation', sq: { fhyp: 1, maxstr: 2 }, pitcher: true, pitcherWeeks: kBlock(GPP(true), { pitcher: true }),
      name: '🧪 KILO GPP · ESD over 125% — Isometric / Explosive (12 wk)',
      notes: 'For an Eccentric Strength Deficit over 125% (relative-strength athlete): Acc 1 IMCA 70% → Int 1 overcoming isometrics 80% (isometronics, functional isos, functional-iso contrast) → Acc 2 explosive (bands/chains, Olympic pulls at 0.5–0.75 m/s, ballistic jumps) → Int 2 IMCA 85%. ' + RULES }),
      kBlock(GPP(true), fullO));
    add(meta({ key: 'kilo-spp-exp', phaseType: 'transmutation', sq: { maxstr: 1, power: 2 }, pitcher: true, pitcherWeeks: kBlock(SPP(false), { pitcher: true }, { at: 1, start: 1 }),
      name: '🧪 KILO SPP · XSD under 80% — Explosive / Starting (12 wk)',
      notes: 'For an Explosive Strength Deficit under 80% (squat jump ÷ CMJ): Acc 3 IMCA 74% → Int 3 fast eccentrics (accentuated eccentric with hooks, dynamic eccentric-isometric) → Acc 4 explosive (bands, Olympic pulls, ballistic) → Int 4 starting strength (deadstops + bands, paused squat jumps). KILO plyo plan weeks 1–12 on both lower days. Squat 2× BW and bench 1.5× BW before speed-strength becomes the focus. ' + RULES }),
      kBlock(SPP(false), {}, { at: 1, start: 1 }));
    add(meta({ key: 'kilo-spp-rea', phaseType: 'realization', sq: { power: 2, relstr: 1 }, pitcher: true, pitcherWeeks: kBlock(SPP(true), { pitcher: true }, { at: 1, start: 1 }),
      name: '🧪 KILO SPP · XSD over 80% — Reactive (12 wk)',
      notes: 'For an Explosive Strength Deficit over 80%: Acc 3 IMCA 74% → Int 3 iso-dynamic (stato-dynamic, stato-dynamic + bands, functional-iso contrast) → Acc 4 reactive (myotatic 1¼ reps + bands, depth jumps) → Int 4 reactive (⅓ reps at 40% + bands, hurdle jumps). RSI ≈ 2.0 before complex work. KILO plyo plan weeks 1–12 on both lower days. ' + RULES }),
      kBlock(SPP(true), {}, { at: 1, start: 1 }));
    add(meta({ key: 'kilo-short-s', phaseType: 'transmutation', sq: { maxstr: 2, power: 1 }, pitcher: true, pitcherWeeks: kBlock(SHORT(false), { pitcher: true }, { at: 7, start: 1 }),
      name: '🧪 KILO Short Block · Strength-biased (12 wk)',
      notes: '8–12-week athlete block, straight line: GPP Acc 1 70% IMCA → GPP Int 1 eccentric → SPP Acc 4 83% explosive → SPP Int 4 90% starting strength. For ESD under 125% and XSD under 80% — the usual pro-baseball profile. Plyo plan weeks 1–6 run in weeks 7–12. ' + RULES }),
      kBlock(SHORT(false), {}, { at: 7, start: 1 }));
    add(meta({ key: 'kilo-short-r', phaseType: 'realization', sq: { power: 2, relstr: 1 }, pitcher: true, pitcherWeeks: kBlock(SHORT(true), { pitcher: true }, { at: 7, start: 7 }),
      name: '🧪 KILO Short Block · Speed-biased (12 wk)',
      notes: '8–12-week athlete block for ESD over 125% and XSD over 80%: GPP Acc 1 70% IMCA → GPP Int 1 overcoming isometrics → SPP Acc 4 reactive (myotatic) → SPP Int 4 reactive (⅓ reps). Plyo plan weeks 7–12 run in weeks 7–12 (needs the earlier plyo phases done). ' + RULES }),
      kBlock(SHORT(true), {}, { at: 7, start: 7 }));
    var mlb = meta({ key: 'kilo-mlb-if', phaseType: 'transmutation', sq: { maxstr: 2, power: 1 },
      name: '⚾ KILO Case Study — MLB Infielder Off-Season (12 wk)',
      notes: 'KILO Case Study 8 worked through with the course rules. Training age 1 yr (beginner), 4 days a week. ESD 117% (< 125% → eccentric strength + size); XSD 77% (< 80% → explosive and starting strength). Weeks 1–3 GPP Acc 1 70% 3×10–12; 4–6 GPP Int 1 sub-maximal eccentrics only; 7–9 SPP Acc 4 explosive; 10–12 SPP Int 4 starting strength. A-series 4-0-X-0 where the reps allow. Plyos weeks 7–12 only, plyo-plan phase 1. Forearm supination / pronation and wrist deviation for throwing-elbow health. In-season: KILO 2-day rotation. ' + RULES });
    add(mlb, kBlock(SHORT(false), { beg: true, supra: false, forearm: true }, { at: 7, start: 1 }));
    add(meta({ key: 'c-kilo-gpp-ecc', group: 'client', category: 'Private Client · KILO Advanced', phaseType: 'accumulation', sq: { fhyp: 1, maxstr: 2 },
      name: '🧪 Client · KILO GPP · ESD under 125% (12 wk)', notes: 'Client version of the eccentric / isometric GPP block: no sprint block, sub-maximal eccentrics only. ' + RULES }), kBlock(GPP(false), { client: true }));
    add(meta({ key: 'c-kilo-gpp-iso', group: 'client', category: 'Private Client · KILO Advanced', phaseType: 'accumulation', sq: { fhyp: 1, maxstr: 2 },
      name: '🧪 Client · KILO GPP · ESD over 125% (12 wk)', notes: 'Client version of the isometric / explosive GPP block: no sprint block. ' + RULES }), kBlock(GPP(true), { client: true }));

    // ── Pre-competition and in-season — 2 full-body days, same pair layout ──
    function fb2(n, label, pitcher, cfg) {
      var s = cfg.sets, t = '3-0-X-0';
      var low = pitcher ? 'Trap Bar Deadlift' : 'Back Squat', low2 = pitcher ? 'Trap Bar Deadlift' : 'Front Squat';
      var mainL = pitcher
        ? (cfg.method === 'starting' ? mrow(low, 'B', 'over-functional', { sets: s, note: 'pitchers in season — low soreness' })
          : mrow(low, 'B', cfg.method === 'imca' ? 'yield-stato' : 'yield-stato-band', { sets: s, note: 'pitchers in season — low soreness (KILO baseball fit)' }))
        : cfg.method === 'explosive' ? mrow(low, 'B', 'ss-variable', { sets: s })
        : cfg.method === 'starting' ? mrow(low, 'B', 'ss-deadstop', { sets: s })
        : cfg.method === 'reactive' ? mrow('Squat 1 1/4', 'B', 'react-myotatic', { sets: s })
        : lift(low, 'B', s, 3, cfg.p + '%', t, '3:00', 'Primary lift — keep one exposure ≥ 85% a week', 'imca-int');
      var jump1 = pitcher ? lift('MB Step Back Side Toss', 'A', 3, '3ea', '6 lb MB', 'X-0-X-0', '1:00', 'Ballistic')
        : cfg.method === 'reactive' || cfg.method === 'plyo' ? lift('Depth Jump', 'A', s, 5, 'BW', 'X-0-X-0', '2:00', 'Reactive — short contacts')
        : cfg.method === 'starting' ? lift('Squat Jump', 'A', 3, 3, 'BW', '2-3-X-0', '1:30', 'Paused squat jump')
        : lift('Box Jump', 'A', 3, 3, 'BW', '', '1:00');
      var up = pitcher ? lift('Half Kneeling Landmine Press', 'C', s, '6ea', 'RPE 7', '3-0-X-0', '2:00', 'Upper primary')
        : lift('Bb Bench Press', 'C', s, 3, (cfg.p - 5) + '%', t, '2:30', 'Upper primary', 'imca-int');
      var D1 = day('', 'lift', 'Full Body 1 · Primary-lift biased', [
        !pitcher && cfg.speed !== undefined ? accelBlock(cfg.speed, 'low volume') : null,
        blk('lift', 'Primary', [jump1, core('L1', 'A'), mainL, lift('Seated Leg Curl', 'B', s, 6, 'RPE 7', '3-0-1-0', '1:15', 'Antagonist'),
          up, lift('Chin Up', 'C', s, 5, 'BW', '3-0-1-0', '1:30', 'Antagonist'),
          lift('Elbow-on-Knee DB External Rotation', 'D', 2, '8ea', 'Light', '3-0-1-0', ':45'), lift('Incline Trap-3 Raise', 'D', 2, 10, 'Light', '2-0-1-2', ':45'),
          lift('Supination/Pronation Club', 'E', 2, '10ea', 'Light', '2-0-2-0', ':30', 'Forearm — throwing-elbow health'), lift('Wrist Radial/Ulnar Deviation', 'E', 2, '12ea', 'Light', '2-0-2-0', ':30')])]);
      var D2 = day('', 'lift', 'Full Body 2 · Assistance biased', [
        blk('lift', 'Assistance', [lift('Broad Jump W/ Stick', 'A', 3, 3, 'BW', '', '1:00'), core('L2', 'A'),
          pitcher ? lift('RFE Split Squat (DB)', 'B', s, '6ea', 'RPE 7', '3-0-1-0', '1:30') : lift(low2, 'B', s, 3, (cfg.p - 5) + '%', t, '2:30', 'Second lower lift — lighter', 'imca-int'),
          lift('Glute-Ham Raise', 'B', s, 5, 'BW', '3-0-1-0', '1:30', 'Antagonist'),
          lift('SL DB RDL', 'C', s, '6ea', 'RPE 7', '3-0-1-0', '1:15'), lift('DB Single Arm Row', 'C', s, '8ea', 'RPE 7', '2-0-1-0', '1:15'),
          lift('Biering-Sorensen Hold', 'D', 2, '30s', 'BW', '', ':45'), lift('Copenhagen Plank', 'D', 2, '20s ea', 'BW', '', ':45'),
          lift('Plate Pinch', 'E', 2, '30s', 'Heavy', '', ':45'), lift('Farmer Carry', 'E', 2, '30yd', 'Heavy', '', '1:00')])]);
      return week(n, label, layout({ Mon: D1, Thu: D2 }));
    }
    var meta2 = function (key, name, phaseType, notes, variant) { return Object.assign({}, base, { key: key, name: name, phaseType: phaseType, notes: LAYOUT + notes, group: 'athlete', variant: variant || 'all', days: 2, sq: { relstr: 1, power: 2 } }); };
    var push2 = function (m, weeks) { T.push(Object.assign(m, { weeks: weeks })); };
    push2(meta2('kilo-precomp-2', '🧪 KILO Pre-Competition — Plyometric (3 wk · 2-day)', 'realization', 'KILO pre-competition: 3–6 weeks, low volume (2–4 sets), 2 full-body days, plyometrics (stretch-shortening cycle) as the method. Peaking takes about 3 weeks of delayed transformation — this block runs into report day.'),
      [fb2(1, 'Pre-comp W1 · 4 sets', false, { sets: 4, p: 85, method: 'plyo', speed: 3 }), fb2(2, 'Pre-comp W2 · 3 sets', false, { sets: 3, p: 87.5, method: 'plyo', speed: 3 }), fb2(3, 'Pre-comp W3 · 2 sets', false, { sets: 2, p: 90, method: 'plyo', speed: 3 })]);
    push2(meta2('kilo-precomp-2-p', '🧪 KILO Pre-Competition — Pitcher (3 wk · 2-day)', 'realization', 'Pitcher pre-competition: low volume, stato-dynamic / functional-iso lower body (KILO baseball fit), med-ball ballistics instead of barbell pressing. Lift after throwing.', 'pitcher'),
      [fb2(1, 'Pre-comp W1 · 4 sets', true, { sets: 4, p: 80, method: 'imca' }), fb2(2, 'Pre-comp W2 · 3 sets', true, { sets: 3, p: 80, method: 'explosive' }), fb2(3, 'Pre-comp W3 · 2 sets', true, { sets: 2, p: 80, method: 'starting' })]);
    var ins = function (pitcher, rot) { return rot.map(function (m, x) { return fb2(x + 1, 'In-season W' + (x + 1) + ' · ' + { imca: 'IMCA', explosive: 'Explosive', starting: 'Starting strength', reactive: 'Reactive' }[m], pitcher, { sets: 3, p: 85, method: m }); }); };
    push2(meta2('kilo-inseason-s-2', '🧪 KILO In-Season · XSD under 80% (3-wk rotation · 2-day)', 'inseason', 'KILO in-season maintenance: 2 full-body days — one primary-lift biased, one assistance biased. 3-week method rotation IMCA → explosive → starting strength, then repeat. Forearm supination / pronation and wrist deviation for throwing-elbow health.'), ins(false, ['imca', 'explosive', 'starting']));
    push2(meta2('kilo-inseason-r-2', '🧪 KILO In-Season · XSD over 80% (3-wk rotation · 2-day)', 'inseason', 'KILO in-season maintenance for reactive athletes: IMCA → explosive → reactive (myotatic + depth jumps), repeated.'), ins(false, ['imca', 'explosive', 'reactive']));
    push2(meta2('kilo-inseason-s-2-p', '🧪 KILO In-Season · Pitcher (3-wk rotation · 2-day)', 'inseason', 'Pitcher in-season (KILO baseball fit): stato-dynamic and functional-iso lower body at 50–70% (low soreness), landmine pressing, med-ball ballistics. Lower day 1 after the start, upper / assistance day 3. No supra-maximal eccentrics in season.', 'pitcher'), ins(true, ['imca', 'explosive', 'starting']));
    push2(meta2('kilo-inseason-r-2-p', '🧪 KILO In-Season · Pitcher (3-wk rotation · 2-day)', 'inseason', 'Pitcher in-season (KILO baseball fit): stato-dynamic and functional-iso lower body, landmine pressing, med-ball ballistics.', 'pitcher'), ins(true, ['imca', 'explosive', 'reactive']));

    // ── 12-week plyo plan, 2 sessions a week ──
    var plyoDay = function (wn, lab) { var p = PLYO[wn - 1]; return day('', 'lift', lab, [blk('lift', 'Plyometrics', [
      plyoRow(p[0], wn, 'A'), lift('Dead Bug', 'A', 2, '6ea', 'BW', '3-1-3-1', ':30', 'Core between jump sets'),
      plyoRow(p[1], wn, 'B'), lift('Pallof Press', 'B', 2, '10ea', 'Light', '2-0-1-2', ':30', 'Core between jump sets'),
      plyoRow(p[2], wn, 'C'), lift('Bird Dog', 'C', 2, '6ea', 'BW', '3-1-3-1', ':30', 'Core between jump sets')])]); };
    T.push(Object.assign({}, base, { key: 'kilo-plyo-2', group: 'athlete', variant: 'all', days: 2, phaseType: 'transmutation', sq: { power: 2 },
      name: '🦘 KILO Plyo Plan (12 wk · 2 sessions a week)',
      notes: 'KILO team-sport plyo plan: 12 weeks, 2 sessions a week, 3 exercises a session, never to failure. Vermeil plyo warm-up first (ankle hops, pendulum swings, heel kicks). Each jump is paired with core work between sets. Weekly contacts rise 100 → 300 and are split over the two sessions, 3–6 sets an exercise. Rest 2:00 in weeks 1–6, 1:30 after.',
      weeks: Array.from({ length: 12 }, function (_, x) { return week(x + 1, 'Plyo W' + (x + 1) + ' · ~' + CONTACTS[x] + ' contacts', layout({ Tue: plyoDay(x + 1, 'Plyo 1'), Fri: plyoDay(x + 1, 'Plyo 2') })); }) }));

    return T.map(function (t) {
      t.weeks.forEach(function (w, i) { w.week = i + 1; });
      return { key: t.key, category: t.category, name: t.name, notes: t.notes, source: t.source, group: t.group, variant: t.variant, days: t.days,
        phaseType: t.phaseType, sq: t.sq || {}, kiloGen: 2,
        pbState: { athlete: '(Sandbox)', phase: t.phaseType, weeks: t.weeks.length, progression: 'linear', activeWeek: 0, weekData: t.weeks } };
    });
  }

  // Browser: swap the generated KILO templates in over the old copies (same keys, so annual plans still resolve)
  function kiloApplyTemplates() {
    if (typeof METHOD_TEMPLATES === 'undefined' || typeof EXERCISE_DB === 'undefined' || root.KILO_APPLIED) return;
    try {
      var gen = kiloBuildTemplates(EXERCISE_DB), byKey = {};
      gen.forEach(function (t) { byKey[t.key] = t; });
      for (var i = 0; i < METHOD_TEMPLATES.length; i++) {
        var k = METHOD_TEMPLATES[i].key;
        if (byKey[k]) { METHOD_TEMPLATES[i] = byKey[k]; delete byKey[k]; }
      }
      Object.keys(byKey).forEach(function (k) { METHOD_TEMPLATES.push(byKey[k]); });
      root.KILO_APPLIED = true;
    } catch (e) { console.error('[kilo-gen]', e); }
  }

  root.KILO_METHODS = KILO_METHODS;
  root.kiloTut = kiloTut;
  root.kiloCompactTempo = compactTempo;
  root.kiloBuildTemplates = kiloBuildTemplates;
  root.kiloApplyTemplates = kiloApplyTemplates;
  if (typeof module !== 'undefined' && module.exports) module.exports = { KILO_METHODS: KILO_METHODS, kiloTut: kiloTut, kiloBuildTemplates: kiloBuildTemplates };
})(typeof window !== 'undefined' ? window : this);
