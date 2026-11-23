// ═══════════════════════════════════════════════════════════════════════════
// Method Library — pre-made phases + annual plans from the programming spec
//   • Phase templates (data/method-templates.js, built by tools/build-method-templates.js):
//     Hypertrophy Clusters, Poliquin, KILO, Conjugate, Triphasic, Undulated, VJP,
//     Francis High/Low, 95 MPH Body, Taper, In-Season RE/DE, Prep, Transition, Deload —
//     4- and 3-day, pitcher versions where the source calls for one, private-client versions
//   • Program Builder → 🧭 Method Library: browse, load into the builder, or save to My Programs
//   • Annual Plan → 🧭 Plan Templates: lay a whole year of blocks onto the athlete / group
//     (Athlete or Private Client, 4 or 3 days, position player or pitcher). Each block remembers
//     its phase template; "Start Program for This Block" loads it for the athlete, sized to
//     the block's weeks, so you edit it before sending.
// Loaded after annual-plan.js / annual-groups.js. Library file loads only when first opened.
// ═══════════════════════════════════════════════════════════════════════════
var MT = { loading: null };

function mtEsc(s) { return typeof escHtml === 'function' ? escHtml(String(s == null ? '' : s)) : String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function mtLoadScript(src, ok) {
  var s = document.createElement('script'); s.src = src;
  s.onload = ok; s.onerror = function () { alert('Couldn\'t load ' + src); MT.loading = null; };
  document.head.appendChild(s);
}
// Both libraries: the method library and Mark's own (Spring ramp lives there)
function mtEnsure(cb) {
  if (typeof METHOD_TEMPLATES !== 'undefined' && typeof MW_TEMPLATES !== 'undefined') return cb();
  if (MT.loading) { MT.loading.push(cb); return; }
  MT.loading = [cb];
  var done = function () {
    if (typeof METHOD_TEMPLATES === 'undefined' || typeof MW_TEMPLATES === 'undefined') return;
    var q = MT.loading; MT.loading = null; q.forEach(function (f) { try { f(); } catch (e) { console.error(e); } });
  };
  if (typeof METHOD_TEMPLATES === 'undefined') mtLoadScript('data/method-templates.js?v=3', done);
  if (typeof MW_TEMPLATES === 'undefined') mtLoadScript('data/mw-templates.js?v=1', done);
  done();
}
function mtGet(key) {
  if (!key) return null;
  if (key.indexOf('mw:') === 0) {
    var m = (typeof MW_TEMPLATES !== 'undefined' ? MW_TEMPLATES : []).find(function (t) { return t.key === key.slice(3); });
    return m ? { key: key, name: m.name, notes: m.notes, source: 'Mark Weisman template library', sq: {}, pbState: m.pbState, category: m.category } : null;
  }
  return (typeof METHOD_TEMPLATES !== 'undefined' ? METHOD_TEMPLATES : []).find(function (t) { return t.key === key; }) || null;
}
// base 'hyp-clusters' + days + pitcher → 'hyp-clusters-4-p' / 'hyp-clusters-4' (mw: keys too)
function mtResolve(base, days, pitcher) {
  if (base.indexOf('mw:') === 0) return mtGet(base + '-' + days) ? base + '-' + days : null;
  var k = base + '-' + days;
  if (pitcher && mtGet(k + '-p')) return k + '-p';
  if (mtGet(k)) return k;
  return mtGet(k + '-p') ? k + '-p' : null;   // pitcher-only sources (95 MPH Body)
}
function mtWeeks(t) { return (t.pbState && t.pbState.weekData || []).length; }
function mtDays(t) { return t.days || ((t.pbState.weekData[0] || { days: [] }).days.filter(function (d) { return d.type !== 'off'; }).length); }

// ── Load a template into Program Builder ─────────────────────────────────────
// athlete: name, '(Sandbox)' or null (= whoever the builder has selected)
// opts.weeks: fit to a block length — repeats the template's weeks to fill, or cuts it short
function mtLoadIntoBuilder(t, athlete, opts) {
  opts = opts || {};
  if (!t || !t.pbState || !(t.pbState.weekData || []).length) { if (typeof showStatus === 'function') showStatus('⚠️ Template has no weeks'); return; }
  if (!athlete) athlete = (typeof pbMode !== 'undefined' && pbMode === 'sandbox') ? '(Sandbox)' : ((document.getElementById('pb-athlete') || {}).value || (typeof currentPlayer !== 'undefined' ? currentPlayer : '(Sandbox)'));
  if (String(athlete).indexOf('grp:') === 0) athlete = '(Sandbox)';
  var st = JSON.parse(JSON.stringify(t.pbState));
  var src = st.weekData, n = opts.weeks || src.length;
  if (n !== src.length) {
    st.weekData = [];
    for (var i = 0; i < n; i++) {
      var w = JSON.parse(JSON.stringify(src[i % src.length]));
      w.week = i + 1;
      if (i >= src.length) w.label = (w.label || '') + ' (repeat)';
      if (w.progMod) w.progMod.label = 'W' + (i + 1);
      st.weekData.push(w);
    }
  }
  st.weeks = st.weekData.length; st.activeWeek = 0; st.athlete = athlete;
  if (opts.startDate) st.startDate = opts.startDate;
  delete st._savedProgId;
  PB_STATE = st;
  PB_LOADED_PROGRAM_ID = null;   // fresh copy — never writes back into a template
  var addedEx = mtEnsureExercises(mtNamesIn(st));
  if (t.key) mtPushRecent({ key: t.key, name: t.name, weeks: st.weekData.length, days: mtTrainDays(st) });

  if (typeof switchProgTab === 'function') switchProgTab('builder', document.getElementById('ptab-builder'));
  if (typeof pbSetMode === 'function') pbSetMode(athlete === '(Sandbox)' ? 'sandbox' : 'athlete');
  var athEl = document.getElementById('pb-athlete'); if (athEl && athlete !== '(Sandbox)') athEl.value = athlete;
  var phaseEl = document.getElementById('pb-phase'); if (phaseEl) phaseEl.value = st.phase || 'accumulation';
  var weeksEl = document.getElementById('pb-weeks'); if (weeksEl) weeksEl.value = st.weeks;
  var progEl = document.getElementById('pb-progression'); if (progEl) progEl.value = st.progression || 'linear';
  var nameEl = document.getElementById('pb-program-name');
  if (nameEl) nameEl.value = opts.name || (t.name.replace(/^\S+\s/, '') + (athlete !== '(Sandbox)' ? ' — ' + athlete : ''));
  try { if (typeof pbRenderWeekTabs === 'function') pbRenderWeekTabs(); if (typeof pbRenderDayGrid === 'function') pbRenderDayGrid(); if (typeof pbRenderWeekTargets === 'function') pbRenderWeekTargets(); if (typeof pbCloseEditor === 'function') pbCloseEditor(); if (typeof pbCollapseSetup === 'function') pbCollapseSetup(); } catch (e) { console.error(e); }
  mtRenderRecent();
  if (typeof showStatus === 'function') showStatus('📚 Loaded "' + t.name + '" for ' + (athlete === '(Sandbox)' ? 'Sandbox' : athlete) + ' · ' + st.weeks + ' weeks' + (addedEx ? ' · added ' + addedEx + ' exercises to your library' : '') + ' — edit it, then Save / Send');
}

// ── Save one template into My Programs → Templates ───────────────────────────
function mtSaveToPrograms(key) {
  var t = mtGet(key); if (!t) return;
  if (typeof SAVED_PROGRAMS === 'undefined') return;
  var ex = SAVED_PROGRAMS.find(function (p) { return p && p.tplKey === 'mt:' + key; });
  if (ex && !confirm('"' + t.name + '" is already in your templates.\n\nOK = replace it with the library version (your edits to it are lost)')) return;
  var base = Date.now(); SAVED_PROGRAMS.forEach(function (p) { var n = Number(p.id); if (n >= base) base = n + 1; });
  var prog = { name: t.name, notes: t.notes, athlete: 'Template Library', category: t.category, meso: t.pbState.phase, macro: t.pbState.phase,
    scope: 'meso', scopeLabel: 'Mesocycle', mesoLabel: t.name, html: '', content: '', isTemplate: true, tplKey: 'mt:' + key, tplVersion: METHOD_TEMPLATES_VERSION,
    pbState: JSON.parse(JSON.stringify(t.pbState)) };
  if (ex) Object.assign(ex, prog); else { prog.id = base; prog.created = new Date().toISOString(); SAVED_PROGRAMS.push(prog); }
  if (typeof persistPrograms === 'function') persistPrograms();
  if (typeof renderPBDrafts === 'function') renderPBDrafts();
  if (typeof showStatus === 'function') showStatus('💾 "' + t.name + '" saved to My Programs → Templates');
}

// ── Modal shell ──────────────────────────────────────────────────────────────
function mtModal(title, body, width) {
  var m = document.createElement('div');
  m.className = 'mt-modal';
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  m.innerHTML = '<div style="background:#1a1f2e;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:20px;width:' + (width || 760) + 'px;max-width:96vw;max-height:90vh;display:flex;flex-direction:column;">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><div style="font-size:16px;font-weight:700;color:#fff;">' + title + '</div>'
    + '<button class="mt-x" style="background:none;border:none;color:#94a3b8;font-size:20px;cursor:pointer;">✕</button></div>'
    + '<div class="mt-body" style="overflow-y:auto;flex:1;min-height:0;">' + body + '</div></div>';
  document.body.appendChild(m);
  m.querySelector('.mt-x').onclick = function () { m.remove(); };
  m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
  return m;
}
var MT_CHIP = 'padding:5px 11px;border-radius:14px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.04);color:#cbd5e1;';
var MT_CHIP_ON = 'padding:5px 11px;border-radius:14px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid #f59e0b;background:rgba(245,158,11,0.16);color:#fbbf24;';

// ── Exercises the templates need (added to the library once; re-added if a template needs one that's gone) ──
// [category, name, 1RM lift key, coaching note]
var MT_NEW_EX = [
  ["Squat Variations", "Leg Extension", "", "Quad isolation — full lockout, control the lowering"],
  ["Squat Variations", "Leg Press", "", "Feet low for quad bias; full depth without the pelvis tucking"],
  ["Squat Variations", "Cossack Squat", "", "Sit deep into one hip, opposite leg straight, toes up"],
  ["Deadlift Variations", "Deficit Trap Bar Deadlift", "", "Stand on a 1–2 in plate — longer pull from the floor"],
  ["Deadlift Variations", "Rack Pull", "", "Pins just below the knee — lockout strength"],
  ["Hamstring", "Barbell Hip Thrust", "", "Upper back on bench, chin tucked, 1 s squeeze at the top"],
  ["Calf Ankle", "Standing Calf Raise", "", "2 s pause in the stretch at the bottom"],
  ["Hip ABD_ADD", "X-Band Walk", "", "Band crossed at the ankles — stay tall, small steps"],
  ["Hip ABD_ADD", "Stability Ball Groin Squeeze", "", "Ball between the knees — 2 s squeeze"],
  ["UB Horizontal Push", "Neutral Grip DB Bench Press", "DB Bench Press", "Palms facing — elbows tucked, shoulder-friendly"],
  ["UB Horizontal Push", "Swiss Bar Floor Press", "", "Neutral grip, triceps touch the floor, press from a dead stop"],
  ["UB Horizontal Pull", "Chest Supported DB Row", "", "Chest on an incline bench — no body English"],
  ["UB Horizontal Pull", "Chest Supported T-Bar Row", "", "Chest on the pad, drive elbows back, full stretch"],
  ["UB Horizontal Pull", "SA Cable Row", "", "Single-arm cable row — reach long, pull to the hip"],
  ["UB Horizontal Pull", "Inverted Row", "", "Bar or rings — body in one line, chest to the bar"],
  ["Biceps Triceps", "DB Hammer Curl", "", "Neutral grip, elbows pinned"],
  ["Biceps Triceps", "Incline DB Curl", "", "Long-length bias — arms hang behind the body"],
  ["Biceps Triceps", "Rope Pushdown", "", "Split the rope at lockout"],
  ["Biceps Triceps", "Overhead Cable Triceps Extension", "", "Long-length bias — elbows by the ears"],
  ["Biceps Triceps", "DB Triceps Extension", "", "Lying or seated — elbows stay still"],
  ["Shoulder Complex", "Side-Lying DB External Rotation", "", "Towel under the elbow, slow lowering"],
  ["Shoulder Complex", "Band ER at 90/90", "", "Elbow at shoulder height, rotate back without shrugging"],
  ["Shoulder Complex", "Serratus Wall Slide", "", "Forearms on the wall, reach up and protract"],
  ["Shoulder Complex", "Cuban Press", "", "Upright row → external rotation → press; light"],
  ["Core Rotation", "Half Kneeling Cable Chop", "", "High to low across the body, hips square"],
  ["UB Plyos", "Med Ball Rotational Scoop Toss", "", "Load the back hip, scoop and release — max intent"],
  ["Strongman Variations", "Lateral Sled Drag", "", "Side-on, push off the trail leg — frontal-plane power"],
  // KILO advanced methods
  ["LB Plyos", "Standing Jump and Reach", "", "Two-foot countermovement jump, reach high with one hand — stick the landing"],
  ["LB Plyos", "Alternating Push-Off", "", "Foot on a low box, drive up and switch feet in the air"],
  ["LB Plyos", "Penta Jump", "", "Five alternating bounds from a standing start — measure total distance"],
  ["LB Plyos", "Deca Jump", "", "Ten alternating bounds — distance that grows jump to jump = good reactive ability"],
  ["LB Plyos", "Cone One-Leg Alternating Jumps", "", "Hop over low cones on one leg, alternate legs each set"],
  ["LB Plyos", "Drop Landing (Stick)", "", "Step off the box, land in an athletic stance and hold 3–5 s — absorb, do not bounce"],
  ["UB Vertical Push", "Bb Overhead Press", "", "Strict standing press — glutes tight, head through at lockout"],
  ["Grip", "Wrist Radial/Ulnar Deviation", "", "Hammer or club — tilt the wrist up and down, forearm still"],
  ["Core Anti-Flexion", "Biering-Sorensen Hold", "", "Hips on the pad, torso horizontal, arms crossed — hold for time"],
  ["Shoulder Complex", "Elbow-on-Knee DB External Rotation", "", "Seated, elbow on the knee at shoulder height — rotate back slowly"],
  ["Shoulder Complex", "Incline Trap-3 Raise", "", "Chest on an incline bench, thumb up, raise in line with the lower traps"],
  // ALTIS speed + other spec tabs (migration v3)
  ["Acceleration", "Sled Pull Sprint", "", "Pull, don't push (ALTIS). ~15 / 30 / 45% BW — hold the same shapes at every load"],
  ["Acceleration", "Hill Sprint", "", "Short hill (5–10%) — projection and push-back without overstriding"],
  ["Acceleration", "Wall Drill (March / Switch)", "", "Hands on the wall, body at the accel angle — neutral pelvis, flexed ankle, push back"],
  ["Acceleration", "Stick Accel (Tape Ladder)", "", "Sticks or tape at growing step lengths — rhythm and projection, cadence rises like a crescendo"],
  ["Acceleration", "Rolling Start Sprint", "", "Jog-in start (e.g. 10 m at ~7 m/s) then sprint — top speed comes ~16 m in vs ~27 m from standing"],
  ["Acceleration", "Wearable Resistance Sprint", "", "Leg load < 5% BM (often 1%), arm < 2% — cut distance or alternate loaded / unloaded reps"],
  ["Max Velocity Running", "Curved Sprint (1st to 3rd)", "", "Run the turn through the bag — lean from the ankles, inside arm short"],
  ["Max Velocity Running", "Speed Bound (Accel to Bound)", "", "10–20 m accel straight into bounding — scissoring and specific strength"],
  ["Max Velocity Running", "Scissor Bound (Bent / Straight Leg)", "", "Bounce off a stiff ankle, scissor the thighs — RTP return-to-sport staple"],
  ["Max Velocity Running", "Dribble-Bleed", "", "Dribble at ankle / calf / knee height, then bleed into full stride"],
  ["Max Velocity Running", "Vest Sprint", "", "Vest 5–20% BM — vertical force at top speed. If it looks worse, the load is wrong"],
  ["Max Velocity Running", "Segment Run (Ins & Outs)", "", "Alternate fast / float segments (e.g. 20 m on, 20 m off) — relaxation at speed"],
  ["Performance Prep", "Walking A Drill", "", "Walk with a tall pelvis, step over the knee, strike under the hip"],
  ["Calf Ankle", "Rudiment Hop Series (RHS)", "", "Flat foot, stiff ankle, ~2.2–3.6 hops/s — prescribe contacts, not distance"],
  ["ESD", "MAS Intervals (Zone 1)", "", "< 65% MSS · 15–30 s on, 1:1 · > 1800 m a session"],
  ["ESD", "Extensive Tempo (LiS, Zone 2)", "", "65–78% MSS · 25–40 s reps, 1:2–5 · 1200–1800 m"],
  ["ESD", "MiS Runs (Zone 3)", "", "78–88% MSS · 14–25 s reps, 1:5–15 · 800–1200 m"],
  ["ESD", "HiS Runs (Zone 4)", "", "88–95% MSS · 8–14 s reps, 1:15–30 · 400–800 m, 6 reps max"],
  ["ESD", "Repeated Sprint Ability (RSA)", "", "Sprints ≤ 10 s, ≤ 60 s recovery — log the decrement: 100 × (total ÷ (best × n)) − 1"],
  ["LB Plyos", "Kneeling Jump to Feet", "", "From tall kneeling, swing and jump to the feet — progress to a light bar, kneeling power clean or snatch (Simmons)"],
  ["LB Plyos", "Resisted Box Jump", "", "Vest, ankle weights, DBs or KBs to a set box — chase a record; step down, do not jump down"],
  ["LB Plyos", "Pause Squat Jump", "", "Pause 2–3 s in the bottom, then jump — no countermovement"],
  ["LB Plyos", "Band-Assisted Squat Jump", "", "Bands overhead pull you up — accelerated (overspeed) plyo for French contrast"],
  ["Squat Variations", "Belt Squat", "", "Belt on the hips — load the legs without spinal load; belt-squat walks forward (glutes) or backward (quads)"],
  ["Olympic Variations", "Hang Snatch", "", "From above the knee — finish tall and fast"],
  ["Olympic Variations", "Clean Pull", "", "From the floor or blocks, full extension and shrug, no catch"],
  ["Olympic Variations", "Javorek Complex One", "", "Upright row 6, high-pull snatch 6, back squat + push press 6+6, bent-over row 6, RDL 6 — bar never down"]
];
var MT_EX_FLAG = 'cubs_sc_mt_ex_added_v1';
function mtEnsureExercises(only) {
  if (typeof EXERCISE_DB === 'undefined') return 0;
  var have = {}; EXERCISE_DB.forEach(function (e) { if (e && e.name) have[e.name.trim().toLowerCase()] = 1; });
  var add = MT_NEW_EX.filter(function (e) { return !have[e[1].toLowerCase()] && (!only || only[e[1]]); });
  if (!add.length) return 0;
  add.forEach(function (e) { EXERCISE_DB.push({ cat: e[0], name: e[1], liftKey: e[2], video: '', notes: e[3] }); });
  try { if (typeof persistExerciseDB === 'function') persistExerciseDB(); } catch (x) { console.error(x); }
  try { if (typeof renderLibrary === 'function') renderLibrary(); } catch (x) {}
  return add.length;
}
function mtNamesIn(st) { var o = {}; (st && st.weekData || []).forEach(function (w) { (w.days || []).forEach(function (d) { (d.blocks || []).forEach(function (b) { (b.exercises || []).forEach(function (e) { if (e && e.name) o[e.name] = 1; }); }); }); }); return o; }
setTimeout(function () {
  try {
    if (localStorage.getItem(MT_EX_FLAG)) return;
    var n = mtEnsureExercises();
    localStorage.setItem(MT_EX_FLAG, new Date().toISOString());
    if (n && typeof showStatus === 'function') showStatus('📚 Added ' + n + ' exercises to your library (leg extension, leg press, chest-supported rows, curls, triceps, cuff work…) for the phase templates');
  } catch (e) { console.error(e); }
}, 6000);
// v2: the KILO advanced-method exercises (only these — anything you deleted from the first batch stays deleted)
var MT_EX_FLAG2 = 'cubs_sc_mt_ex_added_v2';
setTimeout(function () {
  try {
    if (localStorage.getItem(MT_EX_FLAG2)) return;
    var only = {}; ['Standing Jump and Reach','Alternating Push-Off','Penta Jump','Deca Jump','Cone One-Leg Alternating Jumps','Drop Landing (Stick)','Bb Overhead Press','Wrist Radial/Ulnar Deviation','Biering-Sorensen Hold','Elbow-on-Knee DB External Rotation','Incline Trap-3 Raise'].forEach(function (n) { only[n] = 1; });
    var n = mtEnsureExercises(only);
    localStorage.setItem(MT_EX_FLAG2, new Date().toISOString());
    if (n && typeof showStatus === 'function') showStatus('📚 Added ' + n + ' KILO exercises to your library (jump and reach, penta / deca jumps, drop landings, overhead press, Biering-Sorensen hold, trap-3 raise…)');
  } catch (e) { console.error(e); }
}, 7000);
// v3: ALTIS speed + other spec-tab exercises (only these)
var MT_EX_FLAG3 = 'cubs_sc_mt_ex_added_v3', MT_EX_V3_COUNT = 27;
setTimeout(function () {
  try {
    if (localStorage.getItem(MT_EX_FLAG3)) return;
    var only = {}; MT_NEW_EX.slice(MT_NEW_EX.length - MT_EX_V3_COUNT).forEach(function (e) { only[e[1]] = 1; });
    var n = mtEnsureExercises(only);
    localStorage.setItem(MT_EX_FLAG3, new Date().toISOString());
    if (n && typeof showStatus === 'function') showStatus('📚 Added ' + n + ' exercises to your library (ALTIS sled pulls, hills, wickets work, RHS, zone runs, belt squat, kneeling jumps, hang snatch…)');
  } catch (e) { console.error(e); }
}, 8000);

// ── Your built-in phase templates (Intensification / Realization / In-Season / Deload) ──
// loadPhaseTemplates() writes them into drafts; capture them once without touching your drafts
function mtBuiltinPhases() {
  if (MT.builtin) return MT.builtin;
  MT.builtin = [];
  if (typeof loadPhaseTemplates !== 'function' || typeof pbDrafts === 'undefined') return MT.builtin;
  var keep = pbDrafts, ls = null, rs = window.renderPBDrafts, ss = window.showStatus, cf = window.confirm;
  try { ls = localStorage.getItem(PB_DRAFTS_KEY); } catch (e) {}
  try {
    pbDrafts = []; window.renderPBDrafts = function () {}; window.showStatus = function () {}; window.confirm = function () { return true; };
    loadPhaseTemplates();
    MT.builtin = pbDrafts.map(function (d, i) { return { key: 'bi:' + i, name: d.name, pbState: d.pbState }; });
  } catch (e) { console.error(e); }
  finally {
    pbDrafts = keep; window.renderPBDrafts = rs; window.showStatus = ss; window.confirm = cf;
    try { if (ls === null) localStorage.removeItem(PB_DRAFTS_KEY); else localStorage.setItem(PB_DRAFTS_KEY, ls); } catch (e) {}
  }
  return MT.builtin;
}

// ── Every template in one list ──
function mtTrainDays(st) { var w = (st && st.weekData || [])[0]; return w ? (w.days || []).filter(function (d) { return d.type !== 'off' && (d.blocks || []).length; }).length : 0; }
function mtItems() {
  var out = [];
  (typeof SAVED_PROGRAMS !== 'undefined' ? SAVED_PROGRAMS : []).filter(function (p) { return p && p.isTemplate && p.pbState && (p.pbState.weekData || []).length; }).forEach(function (p) {
    out.push({ key: 'mine:' + p.id, kind: 'mine', name: p.name, category: '⭐ My Templates', notes: p.notes || '', source: p.category || 'Saved template', pbState: p.pbState,
      group: /client/i.test(p.name + ' ' + (p.category || '')) ? 'client' : 'athlete', variant: /pitcher/i.test(p.name) ? 'pitcher' : 'all' });
  });
  (typeof MW_TEMPLATES !== 'undefined' ? MW_TEMPLATES : []).forEach(function (t) {
    out.push({ key: 'mw:' + t.key, kind: 'lib', name: t.name, category: '🧢 Your Library · ' + t.category, notes: t.notes, source: 'Your template library', pbState: t.pbState, group: 'athlete', variant: 'all' });
  });
  mtBuiltinPhases().forEach(function (t) {
    out.push({ key: t.key, kind: 'lib', name: t.name, category: '🧢 Your Library · Built-In Phases', notes: 'Your phase templates — speed block first, specific compound lifts.', source: 'Built-in phase template', pbState: t.pbState, group: 'athlete', variant: 'all' });
  });
  (typeof METHOD_TEMPLATES !== 'undefined' ? METHOD_TEMPLATES : []).forEach(function (t) {
    out.push({ key: t.key, kind: 'method', name: t.name, category: '🧭 ' + t.category.replace(/^(Method Library|Private Client) · /, ''), notes: t.notes, source: t.source, pbState: t.pbState, group: t.group, variant: t.variant, days: t.days, sq: t.sq });
  });
  out.forEach(function (x) { x.days = x.days || mtTrainDays(x.pbState); x.weeks = (x.pbState.weekData || []).length; });
  return out;
}
function mtItem(key) {
  if (/^(mine:|bi:)/.test(key) || key.indexOf('mw:') === 0) return mtItems().find(function (x) { return x.key === key; }) || null;
  return mtGet(key);
}

// ── Start tabs (Template / Scratch / Saved) ──
function pbStartTab(tab) {
  ['tpl', 'scratch', 'saved'].forEach(function (t) {
    var pane = document.getElementById('pb-pane-' + t); if (pane) pane.style.display = t === tab ? 'flex' : 'none';
  });
  document.querySelectorAll('#pb-start-tabs button').forEach(function (b) {
    var on = b.getAttribute('data-tab') === tab;
    b.style.background = on ? 'rgba(99,102,241,0.85)' : 'transparent';
    b.style.color = on ? '#fff' : 'var(--text3)';
  });
  try { localStorage.setItem('mt_start_tab', tab); } catch (e) {}
  if (tab === 'saved' && typeof renderPBDrafts === 'function') renderPBDrafts();
  if (tab === 'tpl') mtRenderRecent();
}
function mtRecent() { try { return JSON.parse(localStorage.getItem('mt_recent_v1') || '[]') || []; } catch (e) { return []; } }
function mtPushRecent(it) {
  var r = mtRecent().filter(function (x) { return x.key !== it.key; });
  r.unshift({ key: it.key, name: it.name, weeks: it.weeks, days: it.days });
  try { localStorage.setItem('mt_recent_v1', JSON.stringify(r.slice(0, 5))); } catch (e) {}
}
function mtRenderRecent() {
  var host = document.getElementById('pb-tpl-recent'); if (!host) return;
  var r = mtRecent();
  host.innerHTML = r.length ? '<div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin:2px 0 5px;">Recent</div>'
    + r.map(function (x) {
      return '<button onclick="mtLoadKey(\'' + mtEsc(x.key) + '\')" title="Load for the athlete above" style="display:block;width:100%;text-align:left;padding:6px 8px;margin-bottom:4px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:6px;color:var(--text2);font-size:11px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'
        + mtEsc(x.name) + ' <span style="color:var(--text3);font-size:10px;">· ' + (x.weeks || '?') + ' wk · ' + (x.days || '?') + 'd</span></button>';
    }).join('') : '';
}
function mtLoadKey(key, athlete) {
  mtEnsure(function () {
    var it = mtItem(key);
    if (!it) { if (typeof showStatus === 'function') showStatus('⚠️ That template is gone'); return; }
    mtLoadIntoBuilder(it, athlete || null);
  });
}

// ── 📚 Phase Templates browser ──
var MT_LIB = { group: 'athlete', days: 'all', src: 'all', q: '', open: null, who: null };
function mtWhoOptions() {
  var sel = document.getElementById('pb-athlete');
  var names = sel ? Array.prototype.map.call(sel.options, function (o) { return o.value; }).filter(Boolean) : [];
  return ['(Sandbox)'].concat(names);
}
function mtOpenLibrary() {
  mtEnsure(function () {
    MT_LIB.who = (typeof pbMode !== 'undefined' && pbMode === 'sandbox') ? '(Sandbox)' : ((document.getElementById('pb-athlete') || {}).value || '(Sandbox)');
    try {
      var pl = typeof PLAYERS !== 'undefined' ? PLAYERS[MT_LIB.who] : null;
      if (pl && typeof isClientPos === 'function' && isClientPos(pl.pos)) MT_LIB.group = 'client';
      else if (pl && typeof isPitcherPos === 'function' && isPitcherPos(pl.pos)) MT_LIB.group = 'pitcher';
      else if (MT_LIB.who !== '(Sandbox)') MT_LIB.group = 'athlete';
    } catch (e) {}
    var m = mtModal('📚 Phase Templates', '<div id="mt-lib"></div>', 860);
    MT.libItems = mtItems();
    mtRenderLibrary(m);
  });
}
function mtRenderLibrary(m) {
  var host = m.querySelector('#mt-lib'); if (!host) return;
  var f = MT_LIB, q = f.q.trim().toLowerCase();
  var list = (MT.libItems || []).filter(function (t) {
    if (f.group === 'client' ? t.group !== 'client' : t.group === 'client') return false;
    if (f.group === 'pitcher' && t.kind === 'method' && t.variant !== 'pitcher') return false;   // pitcher view: pitcher versions + your own
    if (f.group === 'athlete' && t.variant === 'pitcher' && t.kind === 'method') return false;
    if (f.days !== 'all' && String(t.days) !== String(f.days)) return false;
    if (f.src !== 'all' && t.kind !== f.src) return false;
    return !q || (t.name + ' ' + t.category + ' ' + (t.source || '')).toLowerCase().indexOf(q) >= 0;
  });
  var cats = []; list.forEach(function (t) { if (cats.indexOf(t.category) < 0) cats.push(t.category); });
  var chip = function (k, v, label) { return '<span class="mt-f" data-k="' + k + '" data-v="' + v + '" style="' + (String(f[k]) === String(v) ? MT_CHIP_ON : MT_CHIP) + '">' + label + '</span>'; };
  var dayset = []; (MT.libItems || []).forEach(function (t) { if (t.days && dayset.indexOf(t.days) < 0) dayset.push(t.days); }); dayset.sort();
  var sel = 'background:#0f1320;border:1px solid rgba(255,255,255,0.14);border-radius:6px;padding:6px 9px;color:#e2e8f0;font-size:12px;';
  var bar = '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px;padding:10px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.25);border-radius:8px;">'
    + '<span style="font-size:11px;color:#c7d2fe;font-weight:700;">Load for</span><select id="mt-who" style="' + sel + 'min-width:170px;">'
    + mtWhoOptions().map(function (n) { return '<option value="' + mtEsc(n) + '"' + (n === f.who ? ' selected' : '') + '>' + (n === '(Sandbox)' ? '🧪 Sandbox' : mtEsc(n)) + '</option>'; }).join('') + '</select>'
    + '<input id="mt-q" placeholder="Search — clusters, VJP, conjugate…" value="' + mtEsc(f.q) + '" style="' + sel + 'flex:1;min-width:160px;"></div>'
    + '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:12px;">'
    + chip('group', 'athlete', '⚾ Athlete') + chip('group', 'pitcher', '🎯 Pitcher') + chip('group', 'client', '👤 Private Client')
    + '<span style="width:10px;"></span>' + chip('days', 'all', 'Any days') + dayset.map(function (d) { return chip('days', d, d + '-day'); }).join('') + '</div>'
    + '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:-4px 0 12px;">'
    + chip('src', 'all', 'All sources') + chip('src', 'mine', '⭐ My templates') + chip('src', 'lib', '🧢 Your library') + chip('src', 'method', '🧭 Method library (courses)')
    + '<span style="margin-left:auto;font-size:10px;color:var(--text3);">' + list.length + ' templates · tap a name to preview</span></div>';
  var rows = list.length ? cats.map(function (c) {
    return '<div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.6px;margin:14px 0 6px;">' + mtEsc(c) + '</div>'
      + list.filter(function (t) { return t.category === c; }).map(function (t) {
        var open = f.open === t.key, w1 = open ? (t.pbState.weekData[0] || { days: [] }) : null;
        return '<div style="border:1px solid ' + (open ? 'rgba(99,102,241,0.45)' : 'rgba(255,255,255,0.08)') + ';border-radius:8px;padding:9px 11px;margin-bottom:6px;background:rgba(255,255,255,0.02);">'
          + '<div style="display:flex;align-items:center;gap:10px;">'
          + '<div class="mt-open" data-key="' + mtEsc(t.key) + '" style="flex:1;min-width:0;cursor:pointer;"><div style="font-size:13px;color:#fff;font-weight:600;">' + mtEsc(t.name) + ' <span style="color:var(--text3);font-weight:400;font-size:11px;">' + (open ? '▴' : '▾') + '</span></div>'
          + '<div style="font-size:10px;color:var(--text3);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + t.weeks + ' wk · ' + t.days + ' days/wk' + (t.variant === 'pitcher' ? ' · pitcher' : '') + (t.source ? ' · ' + mtEsc(t.source) : '') + '</div></div>'
          + (t.kind === 'method' ? '<button class="mt-save" data-key="' + mtEsc(t.key) + '" title="Save a copy to My Templates to edit and reuse" style="padding:5px 8px;background:none;border:1px solid rgba(255,255,255,0.12);border-radius:5px;color:var(--text3);font-size:11px;cursor:pointer;">⭐</button>' : '')
          + '<button class="mt-load" data-key="' + mtEsc(t.key) + '" style="padding:6px 14px;background:#6366f1;border:none;border-radius:6px;color:#fff;font-size:12px;font-weight:700;cursor:pointer;">Load</button></div>'
          + (open ? '<div style="font-size:11px;color:var(--text2);margin-top:8px;line-height:1.5;">' + mtEsc(t.notes || '') + '</div>'
            + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;margin-top:8px;">' + w1.days.filter(function (d) { return d.type !== 'off'; }).map(function (d) {
              return '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:6px;padding:6px 8px;"><div style="font-size:10px;color:#a5b4fc;font-weight:700;">' + mtEsc(d.day) + ' · ' + mtEsc(d.label || '') + '</div>'
                + '<div style="font-size:10px;color:var(--text3);margin-top:3px;line-height:1.4;">' + (d.blocks || []).map(function (b) { return (b.exercises || []).filter(function (e) { return e.pair === 'B'; }).map(function (e) { return mtEsc(e.name); }).join(', '); }).filter(Boolean).join(' · ') + '</div></div>';
            }).join('') + '</div>'
            + '<div style="font-size:10px;color:var(--text3);margin-top:8px;">' + t.pbState.weekData.map(function (w) { return 'W' + w.week + ' ' + mtEsc(w.label || ''); }).join(' · ') + '</div>' : '')
          + '</div>';
      }).join('');
  }).join('') : '<div style="color:var(--text3);font-size:12px;padding:20px 0;">Nothing matches.</div>';
  host.innerHTML = bar + '<div id="mt-rows">' + rows + '</div>';
  host.querySelector('#mt-who').onchange = function () { MT_LIB.who = this.value; };
  var qi = host.querySelector('#mt-q');
  qi.oninput = function () { MT_LIB.q = this.value; var pos = this.selectionStart; mtRenderLibrary(m); var n = m.querySelector('#mt-q'); n.focus(); n.setSelectionRange(pos, pos); };
  host.querySelectorAll('.mt-f').forEach(function (el) { el.onclick = function () { MT_LIB[el.getAttribute('data-k')] = el.getAttribute('data-v'); mtRenderLibrary(m); }; });
  host.querySelectorAll('.mt-open').forEach(function (el) { el.onclick = function () { var k = el.getAttribute('data-key'); MT_LIB.open = MT_LIB.open === k ? null : k; mtRenderLibrary(m); }; });
  host.querySelectorAll('.mt-load').forEach(function (el) { el.onclick = function () { var it = mtItem(el.getAttribute('data-key')); m.remove(); mtLoadIntoBuilder(it, MT_LIB.who); }; });
  host.querySelectorAll('.mt-save').forEach(function (el) { el.onclick = function () { mtSaveToPrograms(el.getAttribute('data-key')); MT.libItems = mtItems(); mtRenderLibrary(m); }; });
}

// ── 🧭 Plan Templates (Annual Plan) ──────────────────────────────────────────
var MT_AN = { plan: null, days: 4, pitcher: false, start: '', mode: 'replace' };
function mtNextMonday() { var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return d; }
function mtPlanStart(p) {
  if (p.start === 'oct1' && typeof apYStart === 'function') return apISO(apYStart(apYear()));
  return apISO(mtNextMonday());
}
function mtPlanBlocks(p, startISO, days, pitcher) {
  var cur = apD(startISO), out = [];
  (p.blocks || []).forEach(function (b, i) {
    var dd = b['d' + days] || days, key = mtResolve(b.tpl, dd, pitcher || !!p.pitcherOnly), t = mtGet(key);
    var s = new Date(cur), e = apAdd(s, b.weeks * 7 - 1);
    out.push({ src: b, key: key, t: t, start: apISO(s), end: apISO(e), weeks: b.weeks, days: dd });
    cur = apAdd(s, b.weeks * 7);
  });
  return out;
}
function mtOpenAnnual() {
  if (typeof apPlan !== 'function') { alert('Annual Plan isn\'t ready yet.'); return; }
  mtEnsure(function () {
    var sel = (document.getElementById('annual-athlete') || {}).value || '';
    var isClient = false, isPitcher = false;
    try {
      var pl = typeof PLAYERS !== 'undefined' ? PLAYERS[sel] : null;
      if (pl) { isClient = typeof isClientPos === 'function' && isClientPos(pl.pos); isPitcher = typeof isPitcherPos === 'function' && isPitcherPos(pl.pos); }
    } catch (e) {}
    // Default to the athlete's group each time the modal opens
    MT_AN.plan = isClient ? 'client-year' : (MT_AN.plan && MT_AN.plan !== 'client-year' ? MT_AN.plan : ANNUAL_TEMPLATES[0].key);
    MT_AN.pitcher = isPitcher;
    var p = ANNUAL_TEMPLATES.find(function (x) { return x.key === MT_AN.plan; });
    MT_AN.start = mtPlanStart(p);
    var m = mtModal('🧭 Annual Plan Templates', '<div id="mt-an"></div>', 760);
    mtRenderAnnual(m);
  });
}
function mtRenderAnnual(m) {
  var host = m.querySelector('#mt-an'); if (!host) return;
  var p = ANNUAL_TEMPLATES.find(function (x) { return x.key === MT_AN.plan; }) || ANNUAL_TEMPLATES[0];
  var pitcher = p.group === 'athlete' && (MT_AN.pitcher || !!p.pitcherOnly);
  var rows = mtPlanBlocks(p, MT_AN.start, MT_AN.days, pitcher);
  var who = (document.getElementById('annual-athlete') || {}).value || '';
  var whoLabel = who.indexOf('grp:') === 0 ? (typeof AG !== 'undefined' && AG[who.slice(4)] ? '👥 ' + AG[who.slice(4)].name : 'this group') : who;
  var existing = (apPlan(false).blocks || []).length;
  var lab = function (t) { return '<div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;">' + t + '</div>'; };
  var inp = 'width:100%;background:#0f1320;border:1px solid rgba(255,255,255,0.12);border-radius:6px;padding:7px 9px;color:#e2e8f0;font-size:12px;box-sizing:border-box;';
  var chip = function (k, v, label, on) { return '<span class="mt-a" data-k="' + k + '" data-v="' + v + '" style="' + (on ? MT_CHIP_ON : MT_CHIP) + '">' + label + '</span>'; };
  var groups = [['athlete', '⚾ Athlete'], ['client', '👤 Private Client']];
  host.innerHTML =
    '<div style="display:grid;grid-template-columns:1.4fr 1fr;gap:14px;margin-bottom:12px;">'
    + '<div>' + lab('Plan') + groups.map(function (g) {
      var ps = ANNUAL_TEMPLATES.filter(function (x) { return x.group === g[0]; });
      return '<div style="font-size:10px;color:var(--text3);margin:4px 0;">' + g[1] + '</div>' + ps.map(function (x) {
        return '<div class="mt-pl" data-key="' + x.key + '" style="padding:7px 10px;margin-bottom:4px;border-radius:6px;cursor:pointer;font-size:12px;'
          + (x.key === p.key ? 'background:rgba(245,158,11,0.14);border:1px solid rgba(245,158,11,0.5);color:#fbbf24;font-weight:700;' : 'background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);color:#cbd5e1;') + '">' + mtEsc(x.name) + '</div>';
      }).join('');
    }).join('') + '</div>'
    + '<div>' + lab('Days per week') + '<div style="display:flex;gap:6px;margin-bottom:12px;">' + chip('days', 4, '4-day', MT_AN.days === 4) + chip('days', 3, '3-day', MT_AN.days === 3) + '</div>'
    + (p.group === 'athlete' ? lab('Athlete type') + '<div style="display:flex;gap:6px;margin-bottom:12px;">' + (p.pitcherOnly ? chip('pitcher', 1, '🎯 Pitcher', true) : chip('pitcher', 0, 'Position player', !MT_AN.pitcher) + chip('pitcher', 1, '🎯 Pitcher', MT_AN.pitcher)) + '</div>' : '')
    + lab('Start (Monday)') + '<input type="date" id="mt-start" value="' + MT_AN.start + '" style="' + inp + 'margin-bottom:12px;">'
    + lab('Existing blocks' + (existing ? ' (' + existing + ')' : '')) + '<div style="display:flex;gap:6px;flex-wrap:wrap;">' + chip('mode', 'replace', 'Replace in these weeks', MT_AN.mode === 'replace') + chip('mode', 'fill', 'Only fill open weeks', MT_AN.mode === 'fill') + '</div>'
    + '</div></div>'
    + '<div style="font-size:11px;color:var(--text2);line-height:1.5;margin-bottom:10px;">' + mtEsc(p.notes || '') + '</div>'
    + '<table style="width:100%;border-collapse:collapse;font-size:11px;">' + rows.map(function (r) {
      var bt = (typeof BLOCK_TYPES !== 'undefined' && BLOCK_TYPES[r.src.type]) || { label: r.src.type, color: '#94a3b8' };
      return '<tr style="border-top:1px solid rgba(255,255,255,0.06);"><td style="padding:6px 6px 6px 0;white-space:nowrap;color:var(--text3);font-family:\'DM Mono\',monospace;">' + apFmt(apD(r.start)) + ' – ' + apFmt(apD(r.end)) + '</td>'
        + '<td style="padding:6px;"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:' + bt.color + ';margin-right:6px;"></span><b style="color:#e2e8f0;">' + mtEsc(r.src.label) + '</b> <span style="color:var(--text3);">' + r.weeks + ' wk</span></td>'
        + '<td style="padding:6px;color:' + (r.t ? 'var(--text2)' : '#ef4444') + ';">' + (r.t ? mtEsc(r.t.name) + (r.days !== MT_AN.days ? ' <span style="color:var(--text3);">(' + r.days + '-day)</span>' : '') : 'missing template') + '</td></tr>';
    }).join('') + '</table>'
    + '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:14px;">'
    + '<div style="font-size:11px;color:var(--text3);">Applies to <b style="color:#cbd5e1;">' + mtEsc(whoLabel) + '</b>. Edit any block afterwards; 🚀 Start Program on a block loads its template.</div>'
    + '<button id="mt-apply" style="padding:8px 18px;background:#6366f1;border:none;border-radius:6px;color:#fff;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">Apply Plan</button></div>';

  host.querySelectorAll('.mt-pl').forEach(function (el) { el.onclick = function () { MT_AN.plan = el.getAttribute('data-key'); var q = ANNUAL_TEMPLATES.find(function (x) { return x.key === MT_AN.plan; }); MT_AN.start = mtPlanStart(q); mtRenderAnnual(m); }; });
  host.querySelectorAll('.mt-a').forEach(function (el) { el.onclick = function () { var k = el.getAttribute('data-k'), v = el.getAttribute('data-v'); MT_AN[k] = k === 'days' ? parseInt(v) : k === 'pitcher' ? v === '1' : v; mtRenderAnnual(m); }; });
  host.querySelector('#mt-start').onchange = function () {
    var d = apD(this.value); if (!d) return;
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));   // snap to Monday
    MT_AN.start = apISO(d); mtRenderAnnual(m);
  };
  host.querySelector('#mt-apply').onclick = function () { if (mtApplyPlan(p, rows, pitcher)) m.remove(); };
}
function mtApplyPlan(p, rows, pitcher) {
  if (rows.some(function (r) { return !r.t; })) { alert('A block\'s template is missing — rebuild data/method-templates.js.'); return false; }
  var plan = apPlan(true);
  var first = apD(rows[0].start), last = apD(rows[rows.length - 1].end);
  var overlaps = function (b, s, e) { var bs = apD(b.startDate), be = apD(b.endDate); return bs && be && bs <= e && be >= s; };
  var mine = (plan.blocks || []).filter(function (b) { return !b.liveRowId && overlaps(b, first, last); });
  if (MT_AN.mode === 'replace' && mine.length && !confirm('Replace the ' + mine.length + ' existing block' + (mine.length > 1 ? 's' : '') + ' between ' + apFmt(first) + ' and ' + apFmt(last) + '?\n\nBlocks that come from a live program stay.')) return false;
  if (MT_AN.mode === 'replace') plan.blocks = plan.blocks.filter(function (b) { return mine.indexOf(b) < 0; });
  var added = 0, skipped = 0, now = Date.now();
  rows.forEach(function (r, i) {
    var s = apD(r.start), e = apD(r.end);
    if (MT_AN.mode === 'fill' && plan.blocks.some(function (b) { return overlaps(b, s, e); })) { skipped++; return; }
    plan.blocks.push({
      id: 'blk_' + now + '_' + i, type: r.src.type, progression: 'linear', startDate: r.start, endDate: r.end, weeks: r.weeks,
      notes: r.src.label + (r.src.notes ? ' — ' + r.src.notes : ''),
      coachNotes: '📚 ' + r.t.name + (r.t.source ? ' · ' + r.t.source : ''),
      sq: JSON.parse(JSON.stringify(r.t.sq || {})), speed: [40, 30, 15, 10, 5], esd: [50, 30, 20],
      tplKey: r.key, tplPlan: p.key, tplPitcher: !!pitcher,
    });
    added++;
  });
  if (!plan.notes) plan.notes = p.name + (pitcher && p.group === 'athlete' && !p.pitcherOnly ? ' (pitcher)' : '') + ' · ' + MT_AN.days + '-day\n' + (p.notes || '');
  saveAnnualData();
  if (typeof renderAnnualPlan === 'function') renderAnnualPlan();
  if (typeof showStatus === 'function') showStatus('🧭 ' + p.name + ': ' + added + ' blocks added' + (skipped ? ', ' + skipped + ' skipped (weeks already planned)' : '') + ' — open a block → 🚀 Start Program to load its template');
  return true;
}

// ── Hooks ────────────────────────────────────────────────────────────────────
(function () {
  // "Start Program for This Block" → load the block's phase template, sized to the block
  if (typeof annualStartProgramForBlock === 'function') {
    var _s = annualStartProgramForBlock;
    annualStartProgramForBlock = function (blockId) {
      var plan = typeof ANNUAL_PLANS !== 'undefined' ? ANNUAL_PLANS[annualPlanKey()] : null;
      var b = plan && plan.blocks.find(function (x) { return x.id === blockId; });
      var ath = (document.getElementById('annual-athlete') || {}).value || '';
      var r = _s.apply(this, arguments);
      // Close the Edit Block modal (the original's selector misses it once the browser normalizes the style)
      var ab = document.getElementById('ab-save'); if (ab) { var ov = ab.closest('div[style*="fixed"]'); if (ov) ov.remove(); }
      if (b && b.tplKey) {
        mtEnsure(function () {
          setTimeout(function () {
            var t = mtGet(b.tplKey);
            if (!t) { if (typeof showStatus === 'function') showStatus('⚠️ Template "' + b.tplKey + '" not found in the library'); return; }
            mtLoadIntoBuilder(t, ath, { weeks: b.weeks, startDate: b.startDate, name: (b.notes || t.name).split(' — ')[0] + (ath && ath.indexOf('grp:') !== 0 ? ' — ' + ath : '') });
            if (ath.indexOf('grp:') === 0 && typeof showStatus === 'function') showStatus('🧭 Loaded "' + t.name + '" in Sandbox — pick an athlete in the builder, then send (groups have no single athlete)');
          }, 250);
        });
      }
      return r;
    };
  }
  // Block modal: show which template the button will load
  if (typeof annualEditBlock === 'function') {
    var _e = annualEditBlock;
    annualEditBlock = function (id) {
      var r = _e.apply(this, arguments);
      try {
        var plan = ANNUAL_PLANS[annualPlanKey()], b = plan && plan.blocks.find(function (x) { return x.id === id; });
        if (b && b.tplKey) mtEnsure(function () {
          var t = mtGet(b.tplKey);
          document.querySelectorAll('button').forEach(function (btn) {
            if (t && /Start Program for This Block/.test(btn.textContent)) btn.innerHTML = '🚀 Start Program — load "' + mtEsc(t.name) + '"' + (mtWeeks(t) !== b.weeks ? ' sized to ' + b.weeks + ' wk' : '');
          });
        });
      } catch (e) {}
      return r;
    };
  }
  // Buttons
  function addButtons() {
    var last = 'tpl'; try { last = localStorage.getItem('mt_start_tab') || 'tpl'; } catch (e) {}
    if (document.getElementById('pb-start-tabs')) pbStartTab(last);
    var ai = document.querySelector('button[onclick="annualOpenAIModal()"]');
    if (ai && !document.getElementById('mt-an-btn')) {
      var a = document.createElement('button');
      a.id = 'mt-an-btn'; a.onclick = mtOpenAnnual;
      a.title = 'Lay a pre-made annual plan (Athlete or Private Client) onto this athlete or group';
      a.style.cssText = 'padding:6px 12px;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.45);border-radius:6px;color:#a5b4fc;font-size:12px;font-weight:700;cursor:pointer;';
      a.textContent = '🧭 Plan Templates';
      ai.parentNode.insertBefore(a, ai);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addButtons); else addButtons();
  // Empty builder: say how to start instead of "Pick a day above"
  function mtEmptyHint() {
    var h = document.getElementById('pb-empty-hint'); if (!h) return;
    var empty = typeof PB_STATE === 'undefined' || !(PB_STATE.weekData || []).length;
    h.innerHTML = empty
      ? '<div style="margin:30px auto;max-width:420px;text-align:center;padding:26px;border:1px dashed rgba(255,255,255,0.12);border-radius:12px;">'
        + '<div style="font-size:15px;color:#e2e8f0;font-weight:700;margin-bottom:6px;">No program open</div>'
        + '<div style="font-size:12px;color:var(--text3);line-height:1.6;margin-bottom:14px;">Pick who it\'s for on the left, then start from a phase template, build from scratch, or open something saved.</div>'
        + '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">'
        + '<button onclick="mtOpenLibrary()" style="padding:8px 14px;background:#6366f1;border:none;border-radius:7px;color:#fff;font-size:12px;font-weight:700;cursor:pointer;">📚 Browse Phase Templates</button>'
        + '<button onclick="pbExpandSetup();pbStartTab(\'scratch\')" style="padding:8px 14px;background:rgba(255,255,255,0.05);border:1px solid var(--border2);border-radius:7px;color:var(--text2);font-size:12px;cursor:pointer;">🔨 From scratch</button>'
        + '<button onclick="pbExpandSetup();pbStartTab(\'saved\')" style="padding:8px 14px;background:rgba(255,255,255,0.05);border:1px solid var(--border2);border-radius:7px;color:var(--text2);font-size:12px;cursor:pointer;">📂 Saved</button></div></div>'
      : 'Pick a day above to program it.';
  }
  if (typeof pbRenderDayGrid === 'function') {
    var _dg = pbRenderDayGrid;
    pbRenderDayGrid = function () { var r = _dg.apply(this, arguments); try { mtEmptyHint(); } catch (e) {} return r; };
  }
  setTimeout(mtEmptyHint, 0);

  // ✏️ Edit a live program sits below Save & Send — it's a separate job from starting a program
  if (typeof peRenderPicker === 'function') {
    var _pp = peRenderPicker;
    peRenderPicker = function () {
      var r = _pp.apply(this, arguments);
      try {
        var host = document.getElementById('pe-picker'), save = document.getElementById('pb-program-name'), card = save && save.closest('.card');
        if (host && card && card.nextElementSibling !== host) card.parentNode.insertBefore(host, card.nextSibling);
      } catch (e) {}
      return r;
    };
    try { peRenderPicker(); } catch (e) {}
  }
})();

// ═══════════════════════════════════════════════════════════════════════════
// KILO method picker — Program Builder lift rows get a 🧪 button that fills in
// sets, reps, load, tempo, rest and notes for a KILO method, plus two warnings:
//   · supra-maximal eccentric for an athlete under 2 years of training age
//   · isometric set longer than 40 s
// ═══════════════════════════════════════════════════════════════════════════
// [id, group, label, sets, reps, load, tempo, rest, note, flags]  (load '' = keep the row's load)
var MT_METHODS = [
  ['imca', 'Concentric', 'IMCA — intent to accelerate (A series)', 5, 5, '', '4-0-X-0', '3:00', 'IMCA — intent to accelerate every rep; the X must be truly as fast as possible. 4-0-X-0 GPP; 3-0-X-0 SPP (intermediate), 2-0-X-0 (advanced)'],
  ['mvc', 'Concentric', 'MVC — to concentric failure (B series)', 3, 10, 'RPE 10', '3-0-1-0', '1:30', 'MVC — controlled tempo to concentric failure. Never to failure in power phases'],
  ['rir', 'Concentric', 'RIR — short of failure (C series)', 3, 12, 'RPE 7–8', '2-0-1-0', '1:00', 'RIR — stop 2–3 reps short of failure, controlled tempo'],
  ['ext-14', 'Extended sets', '1¼ reps', 3, 8, '', '3-0-1-0', '1:30', '1¼ reps — quarter rep at the weak angle (bottom or top)'],
  ['ext-d14', 'Extended sets', 'Double 1¼ reps', 3, 6, '', '3-0-1-0', '1:30', 'Double 1¼ — quarter reps at the bottom and the top'],
  ['ext-max', 'Extended sets', 'Maximum reps (60–70%)', 3, 'Max', '65%', '2-0-1-0', '2:00', 'Max reps at 60–70% 1RM'],
  ['ext-time', 'Extended sets', 'Reps for time (40–70 s)', 3, 'Max in 40–70s', 'RPE 8', '1-0-1-0', '2:00', 'Max reps in 40–70 s — faster reps for the same time under tension'],
  ['ext-rp', 'Extended sets', 'Rest-pause', 3, '10 + max', 'RPE 8', '3-0-1-0', '1:30', 'Rest-pause — 10 reps, 10–15 s pause, max reps at the same load and tempo'],
  ['ext-pfp', 'Extended sets', 'Post-fatigue partials', 3, '10 + partials', 'RPE 8', '3-0-1-0', '1:30', 'Post-fatigue partials — 10 reps, then as many partial reps as possible'],
  ['ext-assist', 'Extended sets', 'Assisted (forced) reps', 3, '10 + assisted', 'RPE 9', '3-0-1-0', '1:30', 'Assisted reps — 10 reps, then as many spotter-assisted reps as possible'],
  ['ext-vma', 'Extended sets', 'Variable muscle action (10 + 1 + 10)', 3, '10 + 1 + 10', '50%', '3-0-3-0 / 1-0-1-8', '2:00', 'Variable muscle action — 10 @ 3-0-3-0, one rep with an 8 s concentric pause, 10 @ 1-0-1-0'],
  ['ext-drop', 'Extended sets', 'Drop sets', 3, '12 / 10 / 8', 'RPE 8', '2-0-1-0', '1:30', 'Drop set — ~10% drop per step, no rest (12/10/8, 10/8/6, 8/6/6, 6/4/4, 4/2/2)'],
  ['ext-mech', 'Extended sets', 'Mechanical-advantage set', 3, '8 / 6 / 6', 'RPE 8', '3-0-1-0', '1:30', 'Mechanical-advantage set — same load, weakest to strongest grip/leverage (e.g. pronated → supinated → neutral)'],
  ['ext-slow', 'Extended sets', 'Isokinetic super slow', 3, 6, 'RPE 8', '5-0-5-0', '1:30', 'Super slow — 3 x 6 @ 5-0-5-0 or 3 x 10 @ 3-0-3-0'],
  ['ecc-extended', 'Eccentric', 'Extended eccentric (sub-max)', 4, 4, '70%', '8-0-X-0', '3:00', 'Extended eccentric — 5 @ 6-0-X-0, 4 @ 8-0-X-0, 3 @ 10-0-X-0, 2 @ 15-0-X-0; ~30 s TUT; start near 70%'],
  ['conc-ecc', 'Eccentric', 'Concentric-eccentric combo', 4, '6 + 2 ecc', '80%', '4-0-X-0 + 4-0-0-0', '3:00', 'RM set, then 2 eccentric-only reps (spotter lifts it); 10 s between; start near 80%'],
  ['ecc-conc', 'Eccentric', 'Eccentric-concentric', 4, '4 ecc + 6', '80% / 50%', '4-0-0-0 + 2-0-X-0', '3:00', '4 eccentric-only reps (~80%), 10 s, then 6 fast reps (~50%) — GPP, neural adaptation to power'],
  ['ecc-21', 'Eccentric', '2-1 method (accentuated, sub-max)', 3, 5, 'RPE 8', '6-0-1-0', '1:30', '2-1 method — lift with two limbs, lower with one (leg curl, leg press, calf raise)'],
  ['ecc-telle', 'Eccentric', 'Telle method', 3, 12, 'Light', '3-0-1-0', '1:00', 'Telle method — accentuated eccentric on a favourable lever (lateral raise)'],
  ['ecc-supra', 'Eccentric', 'Supra-maximal eccentric (100–120%)', 4, 2, '105%', '6-0-0-0', '3:30', 'Supra-maximal eccentric — 4 @ 4-0-0-0 down to 1 @ 10-0-0-0 at 100–120% (never over 120%). Needs 2+ years of training age', 'supra'],
  ['ecc-max-accent', 'Eccentric', 'Maximal accentuated eccentric (hooks +40%)', 4, 3, '60% bar + 40% hooks', '4-0-X-0', '3:00', 'Weight releasers: 60/100 up to 80/120 (Simmons rule). Most useful in GPP', 'supra'],
  ['ecc-expl-accent', 'Eccentric', 'Explosive accentuated eccentric (hooks +20%)', 5, 3, '60% bar + 20% hooks', '4-0-X-0', '2:30', 'Re-hang the hooks every rep with a 4 s+ lowering, then explode. Bar 50–70%, +20% on the hooks'],
  ['ecc-dyn-iso', 'Eccentric', 'Dynamic eccentric-isometric', 5, 3, '50%', 'X-2-X-0', '2:00', 'Pull yourself down fast, stick 2 s, explode (fast eccentrics — SPP)'],
  ['ecc-landing', 'Eccentric', 'Drop landings', 3, 8, 'BW', '', '1:30', 'Low → medium → high box; stick and hold 3–5 s; 24–40 a week. Barbell drop catch ≤ 60%'],
  ['yield-pause', 'Isometric — yielding', 'Intra-rep pause', 3, 8, 'RPE 8', '3-0-1-2', '1:30', 'Top, mid or bottom pause 2–4 s (B / C series — spider, Scott or seated DB curl)'],
  ['yield-mechdis', 'Isometric — yielding', 'Mechanical-disadvantage pause', 4, 5, '', '4-2-X-0', '3:00', '2 s (4-2-X-0) or 4 s (4-4-X-0) pause in the hole'],
  ['yield-3pause-ecc', 'Isometric — yielding', '3-pause eccentric', 4, 5, '', '6-0-X-0', '3:00', '2 s pauses at ¾, ½ and ¼ of the range (12-0-X-0 for 4 s pauses); fewer pauses on small joints'],
  ['yield-stick', 'Isometric — yielding', 'Sticking-point concentric pause', 4, 5, '', '4-0-X-2', '3:00', 'Pause 2–4 s at the sticking point on the way up'],
  ['yield-3pause-con', 'Isometric — yielding', '3-pause concentric', 4, 4, '', '4-0-6-0', '3:00', 'Three 2 s pauses on the way up (4-0-12-0 for 4 s pauses)'],
  ['yield-stato', 'Isometric — yielding', 'Stato-dynamic', 5, 3, '60–70%', '4-0-X-2', '2:30', 'Concentric pause, then explode through the rest of the rep — good pre-season and in-season'],
  ['yield-stato-band', 'Isometric — yielding', 'Stato-dynamic + bands', 4, 6, '50% bar + 25% band', '2-0-X-2', '2:30', '~75% total at the top'],
  ['yield-iso-ex', 'Isometric — yielding', 'Iso to exhaustion (20–40 s)', 2, '30s', '70–80%', 'iso', '3:00', 'Top, mid or bottom hold 20–40 s, weakest to strongest position; 1–3 sets', 'iso'],
  ['yield-iso-contrast', 'Isometric — yielding', 'Iso to exhaustion contrast (1 + 2 + 1 + 2)', 2, '1 + 2 + 1 + 2', '70% hold / 50% reps', 'iso → 2-0-X-0', '2:30', 'Mid-range hold to exhaustion, 2 fast reps; 2 rounds = 1 set', 'iso'],
  ['yield-iso-complex', 'Isometric — yielding', 'Iso to exhaustion complex (1 + 5 plyos)', 3, '1 + 5', '70%', 'iso → X-0-X-0', '3:00', 'Hold, then 5 plyos (reactive bias)', 'iso'],
  ['yield-iso-max', 'Isometric — yielding', 'Iso to exhaustion + max reps', 1, 'Hold + max', '70% hold / 50% reps', 'iso → 1-0-X-0', '3:00', 'Hold 20–40 s, then max reps — a good last A-series set (e.g. after 5 x 5)', 'iso'],
  ['over-functional', 'Isometric — overcoming', 'Functional isometric (pins)', 3, '3 × 6–8 s', '50%', 'iso', '2:00', 'Push into pins at the bottom, mid and top; never over 8 s; keep the bottom crossbar in', 'iso'],
  ['over-isometronic', 'Isometric — overcoming', 'Isometronic', 4, 5, '', '4-0-X-0', '3:00', 'Dynamic reps, one 6–8 s push into pins (~4–6 in of travel), finish the set. Extra rep after the push → add load'],
  ['over-iso-ex', 'Isometric — overcoming', 'Overcoming iso to exhaustion', 3, '30–40s', '50%', 'iso', '2:30', 'Push into pins until exhaustion; 3–5 sets by series', 'iso'],
  ['over-fi-contrast', 'Isometric — overcoming', 'Functional iso contrast (2 + 2 + 2 + 2)', 3, '2 + 2 + 2 + 2', '50%', '1-0-1-6 / 2-0-X-0', '2:30', '2 reps with a 6 s pin push, 2 fast full-range reps, repeat'],
  ['over-fi-complex', 'Isometric — overcoming', 'Functional iso complex (3 + 3 plyos)', 3, '3 + 3', '50%', '1-0-1-6 → X-0-X-0', '2:30', '3 reps with a 6 s pin push, then 3 plyos (reactive)'],
  ['over-fi-max', 'Isometric — overcoming', 'Functional iso + max reps (4 + max)', 3, '4 + max', '50%', '1-0-1-6 → 1-0-X-0', '2:30', '4 reps with a 6 s pin push, then max reps (usually 6–8) — power rack'],
  ['ss-deadstop', 'Speed-strength', 'Starting strength — deadstop + bands', 6, 2, '55% + bands', '2-4-X-0', '2:00', 'Deadstop from pins; ~20% band tension at the top (fish scale). Relax fully, then contract everything at once. Raise band tension before bar weight'],
  ['ss-inertia', 'Speed-strength', 'Starting strength — inertia start', 6, 2, '50%', '2-2-X-0', '2:00', 'Pause in the bottom position (removes ~50% of the elastic energy), then explode'],
  ['ss-variable', 'Speed-strength', 'Explosive — bands / chains', 6, 3, '55% + bands', '1-0-X-0', '1:30', 'Bar 50–70% + bands or chains (chain rule 80/20, speed device 70/30), 4–8 reps; stop at a 10% velocity drop'],
  ['ss-olympic', 'Speed-strength', 'Explosive — Olympic variation', 5, 3, '70%', 'X-0-X-0', '2:00', 'Pulls, power clean / snatch, push jerk at 60–80%, 0.5–0.75 m/s; stop at a 7–10% velocity drop'],
  ['ss-ballistic', 'Speed-strength', 'Ballistic — throws / loaded jumps', 4, 3, '0–20%', 'X-0-X-0', '1:30', 'Release the load, no deceleration — always A series or contrast'],
  ['react-myotatic', 'Speed-strength', 'Reactive — myotatic 1¼ + bands', 5, 3, '50% + bands', '2-0-X-0', '2:00', '1¼ reps at ~50% + bands — bridge from explosive to reactive'],
  ['react-third', 'Speed-strength', 'Reactive — ⅓ reps + bands', 5, 5, '40% + bands', '2-0-X-0', '2:00', 'Bottom-third reps at ~40% + bands'],
  ['contrast', 'Contrast / complex', 'Contrast (slow → fast)', 5, 4, '', '4-0-X-0', '3:30', 'A1 primary 4–6 x 3–5 @ 4-0-X-0, 10–15 s, then A2 plyo 4–6 x 3–10; 180–240 s between rounds'],
  ['complex', 'Contrast / complex', 'Complex (fast → slow)', 5, 3, '', 'X-0-X-0', '3:00', 'Plyo, then speed-strength lift, then primary lift — 4–6 sets each, 90–240 s rest. Contrast before complex; RSI ≈ 2.0 first'],
];
// [id, group, label, sets, reps, load, tempo, rest, note, flags, src]
var MT_METHODS_MORE = [
  // ── Westside (Conjugate internship) ──
  ['ws-me', 'Westside — Max effort', 'Max effort (ME) — work up to a 3RM', 1, '3RM', 'Work up', '', '3:00', 'New ME lift every week, new list every 4 weeks. ~60% of a DE day\'s volume. No PR → change the lift next time', '', 'Westside'],
  ['ws-de-lower', 'Westside — Dynamic effort', 'DE lower — 12 x 2 (box squat + bands)', 12, 2, '50% + light bands', 'X', ':45', '3-week wave 50 / 55 / 60%, then reset to 50% with a new bar or band. Bar speed drops → lower the % or cut accessories', '', 'Westside'],
  ['ws-de-upper', 'Westside — Dynamic effort', 'DE upper — 9 x 3 speed bench', 9, 3, '50% + light bands', 'X', ':45', '3-week wave 50 / 55 / 60%; new grip or board at reset. Pitchers: med-ball throws 9 x 3 or speed landmine press', '', 'Westside'],
  ['ws-de-test', 'Westside — Dynamic effort', 'DE capacity window (assessment)', 10, 2, '50–60% of top single', 'X', ':30–:60', 'Watch bar speed, how well they hold the rest intervals, and intent', '', 'Westside'],
  ['ws-re', 'Westside — Repeated effort', 'Repeated effort (RE) accessory', 3, '8–15', 'RPE 8', '', '1:30', '~80% of total volume. Keep ~3 weeks, swap stalled ones; lower days ~60% posterior / 40% anterior', '', 'Westside'],
  ['ws-gpp', 'Westside — GPP', 'GPP / restoration — sled drag', 6, '30m', 'Moderate', '', ':45', 'Sled drags, belt-squat walks, light circuits — 12–24 h after a hard session', '', 'Westside'],
  // ── Simmons, Special Strength ──
  ['sim-explosive', 'Simmons — Special strength', 'Explosive strength (30–40% + band 150% of bar)', 6, 3, '35% + band (150% of bar)', 'X', ':45', 'Fast · jumps, bounds, light barbell jumps', '', 'Simmons'],
  ['sim-speedstr', 'Simmons — Special strength', 'Speed strength — box squat wave', 10, 2, '50% + 25% band', 'X', ':45', 'Pendulum 50 / 55 / 60% (12x2, 12x2, 10x2 in the book; 8–10x2 for baseball). 0.7–0.9 m/s; cut sets below 0.7. Top = 75 / 80 / 85%, bottom ≈ 60 / 65 / 70%', '', 'Simmons'],
  ['sim-strspeed', 'Simmons — Special strength', 'Strength-speed (50% bar + 50% band)', 6, 2, '50% + 50% band', 'X', '1:00', 'Slow strength, 0.4–0.5 m/s (flag below 0.6 on the velocity log)', '', 'Simmons'],
  ['sim-circa', 'Simmons — Special strength', 'Circa-max (47–52% + 40–45% band)', 6, 2, '50% + 42% band', 'X', '1:30', '3 weeks, then 2 weeks of delayed transformation before competition', '', 'Simmons'],
  ['sim-me', 'Simmons — Special strength', 'Max effort singles (≤ 3 lifts at 90%+)', 1, '1–3RM', 'Work up in singles', '', '3:00', 'Rotate ~8 special bars / boxes / pulls weekly; ME volume 35–50% of the dynamic day. 2–3-rep records build strength endurance', '', 'Simmons'],
  ['sim-speedbench', 'Simmons — Loading waves', 'Speed bench — 50% x 9 x 3 constant', 9, 3, '50% + bands / chains', 'X', ':45', 'Rotate bands, chains, combo or releasers each wave; 3 grips inside the power lines', '', 'Simmons'],
  ['sim-speedpull', 'Simmons — Loading waves', 'Speed pull — 50% + 30% band (10 / 8 / 6 x 3)', 10, 3, '50% + 30% band', 'X', ':45', 'Volume drops 10x3 → 8x3 → 6x3 over the wave. Sumo, no band: 40 / 45 / 50% x 6x2', '', 'Simmons'],
  ['sim-oly', 'Simmons — Loading waves', 'Power hang clean / snatch — 40 / 45 / 50% x 6 x 3', 6, 3, '45%', 'X', '1:00', 'Pendulum wave; small band if possible; alternate with jumping', '', 'Simmons'],
  ['sim-lightened', 'Simmons — Loading waves', 'Lightened method (reverse bands) — 80% x 9 x 3', 9, 3, '80% (≈20% deloaded at the bottom)', 'X', '1:00', 'Bands from the top of the rack take ~20% off at the bottom', '', 'Simmons'],
  ['sim-rep', 'Simmons — Loading waves', 'Repetition method — up to 20 reps at 25–30%', 3, 20, '25–30%', '', '1:30', 'Posterior-chain hypertrophy — belt squat, sumo, Reverse Hyper over heavy barbell reps', '', 'Simmons'],
  ['sim-jump-me', 'Simmons — Jumps & GPP', 'Box jump — max effort (resisted)', 5, 1, 'Vest / ankle weights / DBs', '', '2:00', 'Heaviest resistance to a set box, chase a record; change box and resistance every session. Step down, do not jump down', '', 'Simmons'],
  ['sim-jump-dyn', 'Simmons — Jumps & GPP', 'Box jump — dynamic (% of box record)', 8, 3, 'Box ≈ 80% of record', '', '1:30', 'Light or no load; cap total jumps Prilepin-style. Depth jumps only for athletes squatting 2x BW', '', 'Simmons'],
  ['sim-jump-sub', 'Simmons — Jumps & GPP', 'Box jump — sub-maximal (10–15 per set)', 3, '10–15', 'BW', '', '2:00', 'Hypertrophy and strength endurance; avoid total failure', '', 'Simmons'],
  ['sim-kneel', 'Simmons — Jumps & GPP', 'Kneeling jump to feet', 5, 10, 'BW → light bar', '', '1:00', 'Then add a light bar, kneeling power clean or snatch; ≤ 5 reps as load rises', '', 'Simmons'],
  ['sim-contrast', 'Simmons — Jumps & GPP', 'Contrast — heavy at 0.6–0.8 m/s, then unloaded jumps', 4, '2 + 3 jumps', '70–80%', '', '2:30', 'Heavy set first, then unloaded jumps', '', 'Simmons'],
  ['sim-sled', 'Simmons — Jumps & GPP', 'Power walk / sled (heavy · −30% · light)', 6, '30m', 'Heavy Mon / −30% Wed / light Fri', '', '1:00', 'Belt on the waist, long strides; heel-first for the posterior chain, balls of the feet ~a third of trips', '', 'Simmons'],
  ['sim-belt', 'Simmons — Jumps & GPP', 'Belt squat for time — 1 rep/s for 60 s', 3, '60s', 'Moderate', '1 rep/s', '2:00', 'Strength endurance; or belt-squat walk 1–5 min (forward glutes, backward quads)', '', 'Simmons'],
];
MT_METHODS_MORE = MT_METHODS_MORE.concat([
  // ── VBT (Mann) — mean concentric velocity ──
  ['vbt-adjust', 'VBT — Methods', 'Adjust load by set (8 x 3)', 8, 3, '60% start', 'X', '1:00', 'Set 1 at the planned load; each next set adjusted from the last set\'s speed (too fast +5–10%, too slow −5–10%). Target band 0.75–1.0 m/s', '', 'VBT'],
  ['vbt-reps', 'VBT — Methods', 'Same weight, reps to velocity', 6, 'To 0.8 m/s', '40% start', 'X', '1:00', 'Reps until speed falls below target. Too light if any rep > 1.10 m/s or the set runs past 10 s', '', 'VBT'],
  ['vbt-8x', 'VBT — Methods', '8 x _ same weight (90% of best)', 8, 'To 90% of best', '55%', 'X', '1:00', 'Reps until speed drops below 90% of the session best — do not reset the device between sets', '', 'VBT'],
  ['vbt-dropoff', 'VBT — Methods', 'Sets to drop-off (10%)', '≤ 10', 3, '55%', 'X', '1:00', 'Sets until a rep < 90% of the best rep; 10 sets done → add load next week. Sets completed = readiness score', '', 'VBT'],
  ['vbt-total', 'VBT — Methods', 'Total reps, variable sets', 'Var', '24 total', '60%', 'X', '1:00', 'Reps per set until speed drops, until the total is reached', '', 'VBT'],
  ['vbt-overload', 'VBT — Methods', 'Velocity-based progressive overload', 4, 5, 'Climb to target speed', '', '2:30', 'Pick a target (e.g. bench 0.5 m/s), climb within the session until every rep hits it. Rep cycle 4x5 → 5x4 → 6x3 → 8x2 → 10x1', '', 'VBT'],
  ['vbt-strength', 'VBT — Target speeds', 'Strength zone — 0.45–0.6 m/s', 4, 4, 'To speed', '', '3:00', 'Trap bar / front squat; stop at 0.35. Absolute strength 0.30–0.45; never below 0.30', '', 'VBT'],
  ['vbt-circa', 'VBT — Target speeds', 'Circa-max — 0.45–0.58 m/s', 5, 2, 'To speed', '', '2:30', '', '', 'VBT'],
  ['vbt-dynamic', 'VBT — Target speeds', 'Dynamic squat / bench — 0.8–1.0 m/s', 8, 3, 'To speed', 'X', ':45', 'Dynamic-method floor 0.75. Keep sets under ~10 s (ATP-PC). Rotate resistance every 4 wk: straight → chains → bands → bands + chains → hanging KBs', '', 'VBT'],
  ['vbt-ss', 'VBT — Target speeds', 'Speed-strength — 1.0–1.5 m/s', 5, 3, 'To speed', 'X', '1:00', 'Jump squat ~1.2–1.5 (peak), trap bar jump', '', 'VBT'],
  ['vbt-oly', 'VBT — Target speeds', 'Olympic — hang clean 1.3–1.4 m/s', 5, 3, 'To speed', 'X', '1:30', 'Peak: clean 1.55–1.85, snatch 2.0–2.5, jerk 1.35–1.8 when the catch drags the mean down. Pitchers: hang pull 1.2–1.4, no catch if wrist / elbow / shoulder say no', '', 'VBT'],
  ['vbt-inseason', 'VBT — Target speeds', 'In-season — 1 set to speed + power sets', 1, 'To speed', 'To speed', '', '2:00', 'One working set to target speed on the A lift, then 3–4 power sets stopping at 10% velocity loss. Warm-up 10%+ slower than the 4-week average at that load → restoration day', '', 'VBT'],
]);
MT_METHODS_MORE = MT_METHODS_MORE.concat([
  // ── Triphasic HS manual (XLathlete 2.0) ──
  ['thd-str1', 'Triphasic HS — Undulated day presets', 'Strength · Day 1 submax (2–3 @ 82.5–87.5%)', 5, '2–3', '85%', '', '2:30', 'Weeks step +2.5%: 77.5 → 80 → 82.5 → 85% x 1–2', '', 'Triphasic HS'],
  ['thd-str2', 'Triphasic HS — Undulated day presets', 'Strength · Day 2 max (1 @ 90–97.5%)', 4, 1, '90%', '', '3:00', '85 → 87.5 → 90 → 92.5% over 4 weeks; 3–4 sets', '', 'Triphasic HS'],
  ['thd-str3', 'Triphasic HS — Undulated day presets', 'Strength · Day 3 volume (3–5 @ 75–80%)', 5, '3–5', '77.5%', '', '2:00', '72.5 → 75 → 77.5 → 80%', '', 'Triphasic HS'],
  ['thd-ssp1', 'Triphasic HS — Undulated day presets', 'Strength-speed · Day 1 (3–5 @ 72.5–77.5%)', 5, '3–5', '75%', '', '2:00', '', '', 'Triphasic HS'],
  ['thd-ssp2', 'Triphasic HS — Undulated day presets', 'Strength-speed · Day 2 (1–3 @ 85–90%)', 4, '1–3', '87.5%', '', '2:30', '', '', 'Triphasic HS'],
  ['thd-ssp3', 'Triphasic HS — Undulated day presets', 'Strength-speed · Day 3 (4–5 @ 65–70%)', 5, '4–5', '67.5%', '', '1:30', '', '', 'Triphasic HS'],
  ['thd-ss1', 'Triphasic HS — Undulated day presets', 'Speed-strength · Day 1 (3–4 @ 65–72.5%)', 5, '3–4', '70%', '', '1:30', '', '', 'Triphasic HS'],
  ['thd-ss2', 'Triphasic HS — Undulated day presets', 'Speed-strength · Day 2 (1–2 @ 75–80%)', 4, '1–2', '77.5%', '', '2:00', '', '', 'Triphasic HS'],
  ['thd-ss3', 'Triphasic HS — Undulated day presets', 'Speed-strength · Day 3 (3–6 @ 55–65%)', 5, '3–6', '60%', '', '1:30', '', '', 'Triphasic HS'],
  ['thd-hv1', 'Triphasic HS — Undulated day presets', 'High-velocity peaking · Day 1 (5–8 @ 40%)', 4, '5–8', '40%', 'X', '1:30', 'Full rest — it is speed, not conditioning', '', 'Triphasic HS'],
  ['thd-hv2', 'Triphasic HS — Undulated day presets', 'High-velocity peaking · Day 2 (4–6 @ 50%)', 4, '4–6', '50%', 'X', '1:30', '', '', 'Triphasic HS'],
  ['thd-hv3', 'Triphasic HS — Undulated day presets', 'High-velocity peaking · Day 3 (6–8 @ 25%)', 4, '6–8', '25%', 'X', '1:30', '', '', 'Triphasic HS'],
  ['thd-bb', 'Triphasic HS — Undulated day presets', 'Bodybuilding (shifted) · 8–10 @ 70–77%', 4, '8–10', '72.5%', '', '1:30', 'Day 2: 6–8 @ 75–80%; Day 3: 10–12 @ 60–70%', '', 'Triphasic HS'],
  ['thd-cluster', 'Triphasic HS — Special sets', 'Cluster sets — 6 x (2+2) at 90%', 6, '2+2', '90%', '0:0:0:20', '2:30', '10–30 s between reps (bar racked) doubles the quality reps at that load — 24 reps instead of 12', '', 'Triphasic HS'],
  ['thd-test', 'Triphasic HS — Special sets', 'In-workout max test (80% test set)', 1, '1–3 @ 80%', '80%', '', '3:00', 'Warm-up 5@55%, 3@70%, then the test set. Coach estimates reps possible → rep-max formula updates the 1RM. Every 3–4 weeks on Day 1', '', 'Triphasic HS'],
  ['thd-oly-ecc', 'Triphasic HS — Olympic block', 'Hang clean · eccentric (wk 1–2)', 5, 2, '75%', '4-0-X-0', '2:00', 'Slow lower to mid-shin, explosive pull and catch. From the hang, never the floor; straps allowed. French contrast: hurdle hop, weighted pause squat jump, band pause squat jump', '', 'Triphasic HS'],
  ['thd-oly-iso', 'Triphasic HS — Olympic block', 'Hang clean · isometric (wk 3–4)', 5, 2, '75%', '0-3-X-0', '2:00', 'Hold at mid-shin ≥ 3 s (removes the stretch-shortening cycle)', '', 'Triphasic HS'],
  ['thd-oly-rea', 'Triphasic HS — Olympic block', 'Hang clean · reactive (wk 5–6)', 5, 2, '80%', 'X', '2:00', 'Full hang clean; pair hurdle hop, weighted squat jump, accelerated squat jump. Pitchers: hang / high pull, no catch', '', 'Triphasic HS'],
  ['thd-plyo-sl', 'Triphasic HS — Plyo blocks', 'Plyo block · single-leg (strength plyo)', 3, 5, 'BW', 'Pause → regular → reactive', '1:00', 'Order: SL → DL → SL accelerated (band) → DL accelerated; 2–3 weeks per block', '', 'Triphasic HS'],
  ['thd-plyo-acc', 'Triphasic HS — Plyo blocks', 'Plyo block · band-accelerated double-leg', 3, 5, 'Band assist', 'Pause → regular → reactive', '1:00', 'Last block before spring training; split / lunge jumps first, then squat jumps', '', 'Triphasic HS'],
]);
MT_METHODS_MORE = MT_METHODS_MORE.concat([
  // ── 8 Vector System (Nieuwsma & DiMarco) ──
  ['8v-ext', '8 Vector — Jumps & COD plyos', '8-vector COD plyo · extensive', 2, '4–12 per angle ea', 'BW', 'Continuous', '1:00', 'Submax hops / bounds through Z (135°), box (90°), triangle (45–60°), out-and-back (0°). Phase 1–4 wk, 1–3x a week', '', '8 Vector'],
  ['8v-int', '8 Vector — Jumps & COD plyos', '8-vector COD plyo · intensive', 3, '1 per angle ea', 'BW', 'Max', '1:30', 'Max broad jump into the cut, max broad jump out, minimal ground contact. Weak angle = long contact / less distance / stuck in mud', '', '8 Vector'],
  ['8v-shock', '8 Vector — Jumps & COD plyos', '8-vector COD plyo · shock', 3, '1 per angle ea', 'BW', 'Max', '2:00', '2-fold broad jump into the cut, broad jump out', '', '8 Vector'],
  ['8v-loadjump', '8 Vector — Jumps & COD plyos', 'Loaded jump (trap bar / BB CMJ)', 4, 3, '10–30% BW', 'X', '1:30', 'Loaded jumps over Olympic lifts — accentuated-eccentric version with hand-release DBs, chains, bands or releasers. Prescribe intent as a %; record, rank & publish', '', '8 Vector'],
  ['8v-mb-ext', '8 Vector — Med ball', 'Med ball · extensive', 3, '10–20', '4–6 lb', 'Continuous', '1:00', 'Continuous submax throws in general prep', '', '8 Vector'],
  ['8v-mb-int', '8 Vector — Med ball', 'Med ball · intensive (contrast)', 4, 3, '6–8 lb', 'Max', '1:30', 'Single max throws paired with heavy lifts; measure distance or velocity. Pitchers: lateral bound into scoop toss', '', '8 Vector'],
  ['8v-mb-cut', '8 Vector — Med ball', '8-vector cut med ball toss', 3, '3ea', '6 lb', 'Max', '1:00', 'Cut at the angle and throw out of it — plant foot parallel to the wall; 0 steps → more steps', '', '8 Vector'],
  ['8v-ecc-sub', '8 Vector — Strength by level', 'Sub-max eccentric (L2) — 4 x 1–3 @ 65–75%', 4, '1–3', '70%', '6-0-X-0', '2:00', '6 s lowering', '', '8 Vector'],
  ['8v-iso-max', '8 Vector — Strength by level', 'Max isometric (L2) — 4 x 1–3, 3 s pause > 80%', 4, '1–3', '82.5%', '3-3-X-0', '2:30', '', '', '8 Vector'],
  ['8v-dyn', '8 Vector — Strength by level', 'Dynamic power — 4 x 2 @ 65–80%', 4, 2, '70%', 'X', '1:30', 'Max intent', '', '8 Vector'],
  ['8v-se', '8 Vector — Strength by level', 'Strength endurance (L1) — 1 x 20', 1, 20, 'RPE 7', '2-0-1-0', '1:30', 'Level 1 foundation (BW → ~40% 1RM)', '', '8 Vector'],
  ['8v-apre', '8 Vector — Strength by level', 'APRE (hypertrophy 2 x 10)', 2, '10 + max', 'RPE 8', '2-0-1-0', '2:00', 'Autoregulated progressive resistance — last set to max reps sets next week\'s load', '', '8 Vector'],
  ['8v-531', '8 Vector — Strength by level', 'Max strength 5-3-1', 3, '5 / 3 / 1', '85%', '', '3:00', 'Loads build toward ~90% 1RM by year-end (Level 1)', '', '8 Vector'],
  ['8v-vbt-cap', '8 Vector — VBT', 'Drop-off zone · capped sets', 4, 'To cut-off', 'To speed', 'X', '1:30', 'Reps until speed falls below the cut-off; add load if the best rep beats the start velocity', '', '8 Vector'],
  ['8v-vbt-str', '8 Vector — VBT', 'VBT strength · single-rep clusters', 4, '3–4 x 1', 'To speed', '', '1:15', '60–90 s rest; adjust load from velocity', '', '8 Vector'],
  ['8v-vbt-pow', '8 Vector — VBT', 'Max power (fixed load)', 5, 3, 'Fixed', 'X', '1:30', 'Chase the highest velocity — group competition', '', '8 Vector'],
  ['8v-vbt-load', '8 Vector — VBT', 'Max load in zone', 5, 2, 'Climb', 'X', '2:00', 'Fixed velocity zone, chase the heaviest load', '', '8 Vector'],
  ['8v-rtp-iso', '8 Vector — Return to sport', 'Landing isometric (RTP)', 3, '30–45s', 'BW → loaded', 'iso', '1:00', 'Long BW landing isos (up to 3–5 min) → loaded isos 30–45 s → jumps → pogos → extensive → COD jumps. Target 105–110% of pre-injury', '', '8 Vector'],
]);
MT_METHODS_MORE = MT_METHODS_MORE.concat([
  // ── The System (Parker, Miller & Panariello) ──
  ['sys-javorek', 'The System — Prep', 'Javorek Complex One (36 reps)', 3, '6 each lift', 'Light', 'Continuous', '1:3 work:rest', 'Upright row 6, high-pull snatch 6, back squat + push press 6+6, bent-over row 6, RDL 6 without putting the bar down. A lift that limits the load comes out and trains alone', '', 'The System'],
  ['sys-hyp', 'The System — Reps per set', 'Strength lift · hypertrophy (10+)', 3, 10, '65%', '', '1:30', 'Strength lifts cap at 35 ± 3 reps per session', '', 'The System'],
  ['sys-strhyp', 'The System — Reps per set', 'Strength lift · strength + hypertrophy (4–7)', 5, 5, '75%', '', '2:00', 'Zone Three–Four (70–89%) = "98% of the training effect"', '', 'The System'],
  ['sys-max', 'The System — Reps per set', 'Strength lift · max strength (1–3)', 5, 2, '87.5%', '', '3:00', 'Sets under 4 reps: focus on accelerating the bar', '', 'The System'],
  ['sys-pow-tech', 'The System — Reps per set', 'Power lift · explosive / technique (4–5)', 4, 4, '65%', 'X', '1:30', 'Power lifts cap at 25 ± 3 reps per session; fastest lift first', '', 'The System'],
  ['sys-pow-exp', 'The System — Reps per set', 'Power lift · explosive (2–3)', 5, 3, '75%', 'X', '2:00', '', '', 'The System'],
  ['sys-pow-max', 'The System — Reps per set', 'Power lift · max load or explosive (1–2)', 5, 2, '85%', 'X', '2:30', 'In-season: pulls replace catches to save hands and wrists', '', 'The System'],
  ['sys-ins-heavy', 'The System — In-season', 'In-season · heavy week (17–20 reps / exercise)', 4, '4–5', '85%', '', '2:30', 'Weekly reps per exercise: medium-heavy 14–17, medium 12–15, heavy 17–20, light 10–12. More singles as the season goes on; PRs late in the season', '', 'The System'],
  ['sys-ins-light', 'The System — In-season', 'In-season · light week (10–12 reps / exercise)', 3, '3–4', '80%', '', '2:00', 'Best-conditioned athletes dragging → back off', '', 'The System'],
]);
MT_METHODS_MORE = MT_METHODS_MORE.concat([
  // ── Zatsiorsky & Kraemer, Science and Practice ──
  ['zk-me', 'Zatsiorsky — Four methods', 'Maximal effort (near training max)', 6, '1–3', 'Training max', '', '4:00', '2–3 singles up to the day\'s training max, then up to 6 sets at it — no pyramids. 4–5 min between heavy sets; series 10–12 min apart. 1–3 reps skill lifts, 2–6 squats, 4–8 assistance', '', 'Zatsiorsky'],
  ['zk-re', 'Zatsiorsky — Four methods', 'Repeated effort (to true failure)', 3, '6–12RM', 'To failure', '', '2:00', 'Only the final reps train the highest-threshold units — stopping at 10 of 12 misses them. Sweet spot 5–6RM to 10–12RM', '', 'Zatsiorsky'],
  ['zk-sub', 'Zatsiorsky — Four methods', 'Submaximal effort (not to failure)', 4, 8, '70%', '', '1:30', 'Hypertrophy like repeated effort, but not the highest-threshold units', '', 'Zatsiorsky'],
  ['zk-de', 'Zatsiorsky — Four methods', 'Dynamic effort (throw / move fast)', 6, 3, '30–45%', 'X', '1:30', 'Rate of force development and explosive strength only — not max strength', '', 'Zatsiorsky'],
  ['zk-rfd', 'Zatsiorsky — Special routines', 'RFD bursts — 3 x 3 at ~90%, fresh', 3, 3, '90%', 'X', '5:00', 'Maximally fast bursts right after the warm-up. 4x/wk to improve, 2x to maintain; change exercises after 6–8 weeks. For ESD > ~50% (throwing, swinging)', '', 'Zatsiorsky'],
  ['zk-iso', 'Zatsiorsky — Special routines', 'Max isometric — 5–6 s, 3–5 per position', 3, '5–6s', 'Max effort', 'iso', '1:00–3:00', 'Weakest point or sport-critical angle; 4–6x/wk to build, 2x to maintain; plateau in 6–8 wk, 1–2 mesocycles max', 'iso', 'Zatsiorsky'],
  ['zk-drop', 'Zatsiorsky — Special routines', 'Drop jump — bounce style', 3, 5, 'BW', 'Bounce', '2:00', '3–4 years of training first. Minimal contact ("hot frying pan"), heels don\'t touch; vest for 2–3 wk after the first sessions, then raise the drop. In-season every 7–10 days; none within 10 days of a key date', 'supra', 'Zatsiorsky'],
  ['zk-uconn-15', 'Zatsiorsky — UConn non-linear', 'Non-linear day · 12–15RM', 4, '12–15RM', 'RM', '', '1:30', 'Rotation 12–15RM → 8–10RM → 4–6RM → 1–3RM; a missed day just shifts the rotation; count the block in workouts (e.g. 48)', '', 'Zatsiorsky'],
  ['zk-uconn-10', 'Zatsiorsky — UConn non-linear', 'Non-linear day · 8–10RM', 4, '8–10RM', 'RM', '', '2:00', '', '', 'Zatsiorsky'],
  ['zk-uconn-6', 'Zatsiorsky — UConn non-linear', 'Non-linear day · 4–6RM', 3, '4–6RM', 'RM', '', '3:00', '', '', 'Zatsiorsky'],
  ['zk-uconn-3', 'Zatsiorsky — UConn non-linear', 'Non-linear day · 1–3RM', 4, '1–3RM', 'RM', '', '4:00', '', '', 'Zatsiorsky'],
  ['zk-uconn-p', 'Zatsiorsky — UConn non-linear', 'Non-linear power day (30–45%)', 5, 3, '30–45%', 'X', '1:30', 'Throws or jumps', '', 'Zatsiorsky'],
  ['zk-ins', 'Zatsiorsky — In-season', 'In-season max-strength residual', 3, '1–3', '85–90%', '', '3:00', 'One near-max lift every in-season week (≥ 85% every ≤ 10 days, upper and lower) — otherwise off-season strength is gone by mid-season', '', 'Zatsiorsky'],
]);
MT_METHODS_MORE = MT_METHODS_MORE.concat([
  // ── Poliquin (Theory / Program Design) ──
  ['pq-gvt', 'Poliquin — Loading schemes', 'German Volume Training 10 x 10', 10, 10, '60%', '4-0-2-0', '1:30', 'Strength endurance / hypertrophy; same load all 10 sets', '', 'Poliquin'],
  ['pq-wave-rs', 'Poliquin — Loading schemes', 'Wave · relative strength (7-6-5 x2)', 6, '7,6,5,7,6,5', '80–85%', '4-0-X-0', '3:00', '2nd wave ~2.5 lb heavier per set. Also 5-4-3 x2, 3-2-1 x2', '', 'Poliquin'],
  ['pq-wave-fh', 'Poliquin — Loading schemes', 'Wave · functional hypertrophy (10-8-6 x2)', 6, '10,8,6,10,8,6', '72–80%', '3-0-1-0', '2:00', 'Then 8-6-4 x2, 6-4-2 x2', '', 'Poliquin'],
  ['pq-wave-int', 'Poliquin — Loading schemes', 'Wave · intensification (3-2-1 x2–4)', 6, '3,2,1,3,2,1', '88–95%', '4-0-X-0', '3:00', 'Or 5-3-2; 2–4 waves', '', 'Poliquin'],
  ['pq-plateau-asc', 'Poliquin — Loading schemes', 'Plateau · ascending (6,6,8,8,10,10)', 6, '6,6,8,8,10,10', 'RPE 8', '3-0-1-0', '2:00', 'Then 5,5,7,7,9,9 and 3,3,5,5,7,7', '', 'Poliquin'],
  ['pq-plateau-prog', 'Poliquin — Loading schemes', 'Plateau · progressive (10,10,8,8,12,12)', 6, '10,10,8,8,12,12', 'RPE 8', '3-0-1-0', '2:00', 'Then 8,8,6,6,10,10 and 6,6,4,4,8,8', '', 'Poliquin'],
  ['pq-stage', 'Poliquin — Loading schemes', 'Stage system (2x2 then 3x3)', 5, '2,2,3,3,3', '85–90%', '4-0-X-0', '2:30', 'A: 2,2,4,4,6,6 · B: 2,2,3,3,3 · C: 1x5 then 5x3', '', 'Poliquin'],
  ['pq-kulesza', 'Poliquin — Loading schemes', 'Kulesza (3,3,2,1 + back-off)', 5, '3,3,2,1 + 2–3', '85–95%', '4-0-X-0', '3:00', 'Intensification', '', 'Poliquin'],
  ['pq-verk', 'Poliquin — Loading schemes', 'Verkhoshansky (2–3x10, 2–3x5, 2–3x3)', 8, '10,10,5,5,3,3', 'Rising', '3-0-1-0', '2:30', 'Accumulation', '', 'Poliquin'],
  ['pq-paler', 'Poliquin — Loading schemes', 'Paler (2x10 + 3x6)', 5, '10,10,6,6,6', 'Rising', '3-0-1-0', '2:00', 'Or reversed; intensification 3x5 + 3x3 or 3x3 + 2x2', '', 'Poliquin'],
  ['pq-heavylight', 'Poliquin — Loading schemes', 'Heavy-light (4–5 x 5–7 + 4–5 x 10–12)', 8, '6 / 10', 'Heavy / light', '3-0-1-0', '2:00', '', '', 'Poliquin'],
  ['pq-harre', 'Poliquin — Loading schemes', 'Harre (3x3, 2x2, 1x1)', 6, '3,3,3,2,2,1', '85–95%', '4-0-X-0', '3:00', 'Accumulation version 3–5 x 8–10', '', 'Poliquin'],
  ['pq-tut-hyp', 'Poliquin — TUT windows', 'Hypertrophy · 40–70 s TUT', 4, '8–10', '75%', '4-0-1-0', '2:00', 'TUT = reps × tempo sum must land in the quality\'s window (1–20 s, 20–40, 40–70, > 70). B never harder, more sets or longer rest than A', '', 'Poliquin'],
]);
MT_METHODS_MORE = MT_METHODS_MORE.concat([
  // ── Triphasic (Dietz & Peterson) ──
  ['tp-ecc', 'Triphasic — Phases', 'Eccentric phase (slow lowering)', 4, 3, '82.5%', '6-0-X-0', '3:00', 'Never slow eccentrics above 85%. Spot; always finish with an explosive concentric; compound lifts only, early in the session', '', 'Triphasic'],
  ['tp-iso', 'Triphasic — Phases', 'Isometric phase (drop and catch)', 4, 3, '82.5%', 'X-3-X-0', '3:00', 'Drop fast, "hit it like a brick", hold 3 s at the bottom, explode', '', 'Triphasic'],
  ['tp-rea', 'Triphasic — Phases', 'Reactive / concentric phase', 5, 3, '80%', 'X', '2:30', 'Train fast — concentric speed is a learned skill on the eccentric and isometric base', '', 'Triphasic'],
  ['tp-fc', 'Triphasic — French contrast', 'French contrast (4-exercise box)', 3, '3 + 4 + 4 + 4', 'Heavy → BW → loaded → band-assisted', '', '3:00', 'Heavy or banded main lift → plyo (hurdle hop) → weighted plyo (weighted drop / squat jump) → accelerated band jump → active recovery', '', 'Triphasic'],
  ['tp-afsm', 'Triphasic — Peaking', 'Peaking 1 · AFSM cocontraction', 3, ':10', 'Bands', 'Max speed', '1:00', 'Fastest contraction velocity at moderate intensity — early in the week', '', 'Triphasic'],
  ['tp-rebound', 'Triphasic — Peaking', 'Peaking 2 · rebound shock', 3, ':10', 'Bands', 'Rebound', '1:30', 'Most structurally demanding — mid-week', '', 'Triphasic'],
  ['tp-oci', 'Triphasic — Peaking', 'Peaking 3 · oscillatory isometric', 3, ':10', 'Light', 'Oscillate', '1:00', 'Most metabolically costly — end of the week; OC-D pairs with rebound shock on the most intense day', '', 'Triphasic'],
  ['tp-z-maxstr', 'Triphasic — Loading zones', 'Zone · max strength 85–93% (0.375–0.45 m/s)', 4, 2, '90%', '', '3:00', 'Zones 12–13 (heaviest) not for in-season use', '', 'Triphasic'],
  ['tp-z-strspd', 'Triphasic — Loading zones', 'Zone · strength-speed 72.5–77.5% (0.525–0.625 m/s)', 5, 3, '75%', 'X', '2:00', '', '', 'Triphasic'],
  ['tp-z-spdstr', 'Triphasic — Loading zones', 'Zone · speed-strength 55–65% (0.75–0.83 m/s)', 5, 3, '60%', 'X', '1:30', '', '', 'Triphasic'],
  ['tp-z-speed', 'Triphasic — Loading zones', 'Zone · speed 25–37.5% (1.15–1.3 m/s)', 5, 4, '30%', 'X', '1:30', 'Zone 1 is the fastest', '', 'Triphasic'],
]);
MT_METHODS_MORE = MT_METHODS_MORE.concat([
  // ── Jovanović (Agile Periodization) ──
  ['jv-repzone', 'Jovanović — Team-sport prescriptions', 'Rep zone (fix load, reps float)', 3, '4–6', '70%', '', '2:00', 'Prescribe off the every-day max (80–90% of a training max). Widen the zone downward after games', '', 'Jovanović'],
  ['jv-loadzone', 'Jovanović — Team-sport prescriptions', 'Load zone (fix reps, load floats)', 3, 5, '70–77.5%', '', '2:00', '', '', 'Jovanović'],
  ['jv-open', 'Jovanović — Team-sport prescriptions', 'Open set (athlete picks the load)', 3, 5, 'Athlete choice', '', '2:00', 'Or 3 x N at 70% (athlete picks the reps)', '', 'Jovanović'],
  ['jv-rir2', 'Jovanović — Team-sport prescriptions', 'RIR-prescribed set (5 @ 2 RIR ≈ 81%)', 3, 5, '81% (2 RIR)', '', '2:30', 'Epley + RIR: 3 @ 2 RIR ≈ 86%, 8 @ 2 RIR ≈ 75%. More sets or sessions → go further right (more RIR). Lower body at high reps: ~1.5% less per rep', '', 'Jovanović'],
  ['jv-plus', 'Jovanović — Embedded testing', 'Plus set (AMRAP, cap ~10)', 1, '5+', '80%', '', '3:00', 'Last set as many reps as possible → Epley estimate; use it as evidence for the bump, not as the next phase\'s max', '', 'Jovanović'],
  ['jv-ballistic', 'Jovanović — Embedded testing', 'Ballistic set (≤ 6 reps, steeper curve)', 4, 4, '~50% of grinding 1RM', 'X', '1:30', 'Ballistic curve uses 0.0666 (5 @ 0 RIR ≈ 75% of the ballistic max); stop on a velocity drop', '', 'Jovanović'],
  ['jv-step', 'Jovanović — Set / rep schemes', 'Step (ramp to a top set, then back-off)', 4, '3 top + 2 x 5 back-off', 'Top ~85%, back-off −10%', '', '2:30', 'Also: plateau, reverse step, ascending / descending wave or ladder, pyramid, reverse pyramid, light-heavy, cluster, rest-pause, cluster wave', '', 'Jovanović'],
  ['jv-baker', 'Jovanović — Set / rep schemes', 'Baker wave (55x15 → 77.5x8+)', 4, '15 / 12 / 10 / 8+', '55 → 62.5 → 70 → 77.5%', '', '2:00', 'Weekly steps; the next wave starts heavier (60x12 → 82.5x6+; 65x10 → 85x5+)', '', 'Jovanović'],
  ['jv-dup', 'Jovanović — Set / rep schemes', 'DUP week (5x5 @75 / 3x5 @65 / 1x5 @85)', 5, 5, '75% (medium day)', '', '2:30', 'Medium / easy / hard days on the same lift; a new progression step each time the lift meets the scheme again', '', 'Jovanović'],
]);
MT_METHODS_MORE = MT_METHODS_MORE.concat([
  // ── Bompa & Haff ──
  ['bp-aa', 'Bompa — Strength phases', 'Anatomical adaptation (2–3 x 8–12 @ 40–65%)', 3, '8–12', '55%', '2-0-1-0', '1:00', '4–6 weeks, circuit-style; prepares tendons and joints', '', 'Bompa'],
  ['bp-mxs', 'Bompa — Strength phases', 'Max strength (3–5 x 4–6 @ 75–85%)', 4, 5, '80%', '', '3:00', 'Strength and power sets 2–5 min rest (3 min default); under 1 min costs 12–44% of force', '', 'Bompa'],
  ['bp-conv', 'Bompa — Strength phases', 'Conversion to power', 4, 4, '30–80%', 'X', '3:00', 'Power methods, plyos, speed; keep max strength', '', 'Bompa'],
  ['bp-maint', 'Bompa — Strength phases', 'Maintenance (1–3 x 1–3, 30–100%)', 2, '1–3', 'Wide range', '', '3:00', '2–4 big lifts, 1–3 days a week in season', '', 'Bompa'],
  ['bp-cluster', 'Bompa — Special sets', 'Cluster (rest after every 1, 2 or 5 reps)', 3, '10 (clusters)', 'Flat / undulating / ascending', '', ':30 intra', 'E.g. 3 x 10 clean pulls, 30 s after every 1–2 reps; load flat, undulating (120-130-140-130-120) or ascending', '', 'Bompa'],
  ['bp-pap', 'Bompa — Special sets', 'Post-activation — heavy single before jumps / sprints', 3, 1, '90%', '', '4–5 min → sprint / jump', 'A heavy single or triple ~4–5 min before jumps or sprints. Don\'t use 70% primers — in the study they made sprints slower', '', 'Bompa'],
]);
MT_METHODS_MORE = MT_METHODS_MORE.concat([
  // ── Supertraining (Verkhoshansky & Siff) ──
  ['st-bmt', 'Supertraining — Special strength', 'Brief maximal tension (85–95%, 3–5RM)', 4, '1–3', '90%', '', '3:00', 'A few singles once or twice a week — strength with little mass; best for relative-strength sports', '', 'Supertraining'],
  ['st-apre6', 'Supertraining — Special strength', 'APRE 6RM (4 sets, autoregulated)', 4, '10 @ 50% / 6 @ 75% / max / adj. max', '6RM', '', '2:00–4:00', 'Set 3 reps set the set-4 load; set 4 sets next session. Run 6RM 6–8 wk; 10RM and 3RM versions too', '', 'Supertraining'],
  ['st-light', 'Supertraining — Speed-strength', 'Light loads at max speed (~20%, up to 40%)', 5, 5, '20–40%', 'X', '1:30', 'Emphasise acceleration at the start; light : heavy volume ≈ 5 : 1. Mix 30–50% and 70–90% loads for the most power', '', 'Supertraining'],
  ['st-depth', 'Supertraining — Shock method', 'Shock method — depth jumps', 4, 10, 'BW', 'Reactive', '10–12 min between sets', 'Max power at ~0.75 m, max force ~1.15 m (advanced only). ≤ 4 x 10 conditioned, 2–3 x 5–8 otherwise; 1–2x a week, second half of prep; in season every 10–14 days, not within 10 days of competition', 'supra', 'Supertraining'],
  ['st-heavylight', 'Supertraining — Contrast & after-effect', 'Heavy-light set (drop 20%, 10–20 s, 3–5 fast reps)', 4, '2 + 4 fast', 'Heavy → −20%', 'X', '3:00', '', '', 'Supertraining'],
  ['st-statdyn', 'Supertraining — Contrast & after-effect', 'Static-dynamic (near-max iso → dynamic set)', 4, '3–5 s iso + 3', 'Near-max iso / 60%', 'iso → X', '3:00', 'Dynamic work after isometric tension improves up to 20% (first rep still inhibited). Jumps 3–4 min after squats +6.8%; 8–10 min after depth jumps +8%', '', 'Supertraining'],
  ['st-afterthrow', 'Supertraining — Contrast & after-effect', 'After-effect — 3 x 3 press @ 80% → throws', 3, 3, '80%', '', '10 min → throws', 'Throwing height rose 38–40% after 3 x 3 presses at 80% with 10 min before the throws', '', 'Supertraining'],
  ['st-circa', 'Supertraining — Methods compendium', 'Circa-maximal (90–97.5%, short rests)', 4, 2, '92.5%', '', '1:30', 'Several reps without long rests', '', 'Supertraining'],
  ['st-maxecc', 'Supertraining — Methods compendium', 'Maximal eccentric (30–40% above concentric max)', 3, 1, '130%', '6-0-0-0', '4:00', 'High soreness — use sparingly', 'supra', 'Supertraining'],
  ['st-int-ext', 'Supertraining — Methods compendium', 'Interval resistance · extensive (30–40%, 5–6 x 20–30)', 5, '20–30', '35%', '', '1:30', 'Intensive version: 50–60%, 3–6 sets to failure, 10–90 s rest', '', 'Supertraining'],
  ['st-unfamiliar', 'Supertraining — Methods compendium', 'Plateau breaker — unfamiliar jumps (80/92.5/97.5/102.5)', 4, 1, '80 → 102.5%', '', '3:00', 'One of the book\'s 28 plateau tactics; also bigger warm-up jumps, more 1–3RM work, minimal plates', '', 'Supertraining'],
]);
// Every entry: [id, group, label, sets, reps, load, tempo, rest, note, flags, source]. KILO entries above have no source.
MT_METHODS.forEach(function (m) { if (!m[10]) m[10] = 'KILO'; });
MT_METHODS = MT_METHODS.concat(MT_METHODS_MORE).concat([
  ['hc-cluster', 'Hypertrophy Clusters — Tiers', 'Hypertrophy cluster (8–12 x 3–5 @ 65–80%)', 8, '3–5', '70%', '', ':45–1:30', 'Halve the reps, double the sets, keep the load (4x10 @ 65% → 8x5 @ 65%); rest drops to 45–90 s. Max or RPE target in week 1 of each phase', '', 'Hypertrophy Clusters'],
  ['hc-cns', 'Hypertrophy Clusters — Tiers', 'CNS warm-up (gray tier)', 3, 3, 'Max intent', 'X', 'Full', 'Jumps, sprints, med-ball throws at max intent with full rest — not conditioning', '', 'Hypertrophy Clusters'],
  ['hc-meta', 'Hypertrophy Clusters — Tiers', 'Metabolic (red tier)', 2, '15–20', 'Light', '2-0-1-1', ':45', 'High reps, light load, pump', '', 'Hypertrophy Clusters'],
]);
var MT_SOURCES = ['KILO', 'Westside', 'Simmons', 'VBT', 'Triphasic', 'Triphasic HS', 'Poliquin', 'Jovanović', 'Hypertrophy Clusters', 'Bompa', 'Zatsiorsky', 'Supertraining', '8 Vector', 'The System'];

// ── ALTIS speed presets (speed rows): [id, group, label, sets, reps, distance, pct, rest, note, zone, source] ──
var MT_SPEED = [
  ['z-acc', 'ALTIS — Gamespeed zones', 'Zone 5 · Acceleration (10–30 m)', 4, 1, '20m', '95%+', '2:30', 'Accel below Zone 5 is not effective. 5x10m, 4x20m, 3x30m w/ 90 s & 3\'. Session 160–300 m (team-sport cap 300 m)', 'acc', 'ALTIS'],
  ['z-mss', 'ALTIS — Gamespeed zones', 'Zone 5 · Max sprint speed (fly)', 4, 1, '20m + 10m fly', '95%+', '4:00', '5–8 s reps (35–70 m), 1:>30. 30–60 s rest per 1 s of sprinting. Session 120–400 m', 'mss', 'ALTIS'],
  ['z-his', 'ALTIS — Gamespeed zones', 'Zone 4 · High-intensity speed', 1, 5, '10s', '88–95%', '4:00', '8–14 s reps, 1:15–30, 400–800 m — 6 reps max', 'his', 'ALTIS'],
  ['z-mis', 'ALTIS — Gamespeed zones', 'Zone 3 · Moderate-intensity speed', 2, 4, '15s', '78–88%', '1:30', '14–25 s reps, 1:5–15, 800–1200 m · 3\' between sets', 'mis', 'ALTIS'],
  ['z-lis', 'ALTIS — Gamespeed zones', 'Zone 2 · Low-intensity speed (tempo)', 2, 6, '30s', '65–78%', '1:00', '25–40 s reps, 1:2–5, 1200–1800 m · 2\' between sets', 'lis', 'ALTIS'],
  ['z-mas', 'ALTIS — Gamespeed zones', 'Zone 1 · MAS (aerobic)', 3, 6, '20s', '< 65%', ':20', '15–30 s on, 1:1, > 1800 m · 2\' between sets', 'mas', 'ALTIS'],
  ['sm-sled-h', 'ALTIS — Special methods', 'Sled / 1080 pull · heavy (45% BW)', 4, 1, '10m', '45% BW', '2:00', 'Force-deficient athletes. Pull, do not push; hold the same shapes at every load', 'acc', 'ALTIS'],
  ['sm-sled-m', 'ALTIS — Special methods', 'Sled / 1080 pull · moderate (30% BW)', 4, 1, '20m', '30% BW', '2:30', '10 kg on the 1080', 'acc', 'ALTIS'],
  ['sm-sled-l', 'ALTIS — Special methods', 'Sled / 1080 pull · light (15% BW)', 4, 1, '20m', '15% BW', '2:30', 'Velocity-deficient athletes — keep ratio of force at speed', 'acc', 'ALTIS'],
  ['sm-wear-leg', 'ALTIS — Special methods', 'Wearable resistance · legs (< 5% BM)', 3, 1, '30m', '95%', '3:00', 'Often 1% BM. Adds volume — cut distance or alternate loaded / unloaded reps', 'acc', 'ALTIS'],
  ['sm-wear-arm', 'ALTIS — Special methods', 'Wearable resistance · arms (< 2% BM)', 3, 1, '30m', '95%', '3:00', 'Arm–leg coordination', 'acc', 'ALTIS'],
  ['sm-vest', 'ALTIS — Special methods', 'Vest sprint (5–20% BM)', 2, 1, '40m', '95%', '5:00', 'Vertical force at top speed. If it looks worse, the load is wrong', 'mss', 'ALTIS'],
  ['sm-complex', 'ALTIS — Special methods', 'Complex: skip for distance → accel', 3, '1 + 1', '20m + 20m', '95%+', '2:30', 'Technical potentiation; or alternate rudiment hops with upright sprints for athletes who collapse at mid-stance', 'acc', 'ALTIS'],
  ['sm-speedbound', 'ALTIS — Special methods', 'Speed bound (accel → bound)', 3, 1, '15m + 20m', '95%', '2:30', '10–20 m accel straight into bounding', '', 'ALTIS'],
  ['sm-wickets', 'ALTIS — Special methods', 'Wickets', 4, 1, '30m', '90%', '2:00', 'Vertical force — strike from above; spacing by athlete', '', 'ALTIS'],
  ['sm-rhs', 'ALTIS — Special methods', 'Rudiment Hop Series (contacts)', 2, 10, '', 'Stiff', ':45', '~2.2–3.6 hops/s, flat foot, stiff ankle. Team sport starts ~10 double / 5 per leg. Volume → height or load → variability', '', 'ALTIS'],
  ['sm-dribble', 'ALTIS — Special methods', 'Dribbles → dribble-bleed', 2, 1, '20m', '70%', ':30', 'Ankle → calf → knee; raise cadence within each height. Start team sport over the calf, 1–2 x 20 m. Extensive 60–90 m bleeds replace tempo', '', 'ALTIS'],
  ['sm-rolling', 'ALTIS — Baseball', 'Rolling start (secondary lead / 1st to 3rd)', 3, 1, '30m', '95%+', '3:00', 'Top speed ~16 m in from a 7 m/s approach vs ~27 m from standing', 'acc', 'ALTIS'],
  ['sm-steal', 'ALTIS — Baseball', 'Steal start (lead-off)', 5, 1, '15m', '95%+', '2:00', 'Rise must match the task — a steal is not a 100 m rise', 'acc', 'ALTIS'],
  ['sm-rsa', 'ALTIS — Baseball', 'Repeated sprint ability (decrement)', 1, 6, '20m', '95%', ':30', 'Sprints ≤ 10 s, ≤ 60 s recovery. Decrement = 100 × (total ÷ (best × n)) − 1', 'rsa', 'ALTIS'],
  ['th-3', 'Triphasic HS — Speed dose', '3 s drills (≈ 15–20 m start)', 1, '6–8 / 8–10 / 10–12', '15m', '95%+', ':30–:45', 'Level 1 / 2 / 3 reps; full recovery — beyond these it becomes conditioning', 'acc', 'Triphasic HS'],
  ['th-5', 'Triphasic HS — Speed dose', '5 s drills (≈ home to first)', 1, '5–7 / 7–9 / 9–12', '27m', '95%+', ':45–1:15', 'Level 1 / 2 / 3 reps', 'acc', 'Triphasic HS'],
  ['th-7', 'Triphasic HS — Speed dose', '7 s drills (≈ first to third)', 1, '4–6 / 5–7 / 6–8', '55m', '95%+', '1:10–1:50', 'Level 1 / 2 / 3 reps', 'mss', 'Triphasic HS'],
  ['8v-sprint', '8 Vector — Speed', 'Sprint · distance progression', 4, 1, '10yd', '95%+', '1:00', '≥ 95% with 10/10 intent; ~1 min rest per 10 yd. Start at 10 yd, +5–10 yd a week; fly builds +5 yd a week. Stop at a rep ≥ 5% slower than the day\'s best', 'acc', '8 Vector'],
  ['8v-resist', '8 Vector — Speed', 'Resisted sprint · 20% BW, −5% a week', 4, 1, '10yd', '20% BW', '1:30', 'Drop 5% a week until unresisted', 'acc', '8 Vector'],
  ['8v-tow', '8 Vector — Speed', 'Assisted tow · +1–3% of best speed', 3, 1, '20yd', '101–103%', '3:00', '', 'mss', '8 Vector'],
  ['8v-cod', '8 Vector — Speed', 'COD (closed) · 135 / 90 / 45 / 0° cut', 3, '2ea', '5yd', 'Stick → 50–75% → max', '1:00', 'Start position (2-point → athletic → lunge → half-kneeling → prone), movement, distance 1 step → 10 yd, stimulus preplanned → react to all 8', '', '8 Vector'],
  ['fr-tempo', 'Francis — High / low', 'Tempo (low day)', 2, 6, '100yd', '65–75%', ':45', 'Grass; never chase times; 2:00 between sets. Low days under 75% top speed; 48–72 h between high days', 'lis', 'Francis'],
  ['bp-speed', 'Bompa — Speed', 'Max speed (20–80 m @ 90–100%)', 2, 3, '40m', '90–100%', '4:00', '3–5 min between reps, 6–8 min between sets; phosphagen 1:12–1:20', 'mss', 'Bompa'],
  ['sys-speed', 'The System — Running', 'Speed (Vermeil volumes)', 1, 8, '30yd', '95%+', '2:00', 'Per session: novice 100–250 yd, advanced 250–500 yd. Baseball sits at ~100–300 yd. Heavy run week = heavy lift week', 'acc', 'The System'],
];
var MT_SPEED_SOURCES = ['ALTIS', 'Triphasic HS', '8 Vector', 'Francis', 'Bompa', 'The System'];
function mtSpeedPreset(id) { for (var i = 0; i < MT_SPEED.length; i++) if (MT_SPEED[i][0] === id) return MT_SPEED[i]; return null; }
function mtMethod(id) { for (var i = 0; i < MT_METHODS.length; i++) if (MT_METHODS[i][0] === id) return MT_METHODS[i]; return null; }

// ── Per-athlete stores ──
var MT_TA_KEY = 'cubs_sc_training_age_v1', MT_SP_KEY = 'cubs_sc_speed_profile_v1';
function mtStoreGet(k, name) { try { var o = JSON.parse(localStorage.getItem(k) || '{}'); return o[name]; } catch (e) { return null; } }
function mtStoreSet(k, name, v) { try { var o = JSON.parse(localStorage.getItem(k) || '{}'); if (v === '' || v == null) delete o[name]; else o[name] = v; localStorage.setItem(k, JSON.stringify(o)); } catch (e) {} }
function mtTrainingAge(name) { var v = mtStoreGet(MT_TA_KEY, name); return v == null ? null : +v; }
function mtSetTrainingAge(name, v) { mtStoreSet(MT_TA_KEY, name, v === '' ? '' : +v); }
function mtSpeedProfile(name) { return mtStoreGet(MT_SP_KEY, name) || {}; }
function mtSetSpeedProfile(name, key, v) { var p = mtSpeedProfile(name); if (v === '' || v == null) delete p[key]; else p[key] = v; mtStoreSet(MT_SP_KEY, name, p); }
// MSS (m/s): fly-10 entered for the athlete, else HE Runs top speed (average of the top 3 runs, ft/s → m/s)
function mtMSS(name) {
  var p = mtSpeedProfile(name);
  if (p.fly10 > 0) { var d = p.unit === 'yd' ? 9.144 : 10; return { v: d / p.fly10, src: 'fly-10 ' + p.fly10 + ' s (' + (p.unit || 'm') + ')' }; }
  try {
    var runs = (typeof heRunsData !== 'undefined' && heRunsData[name]) || [];
    var s = runs.map(function (r) { return +r.speed || 0; }).filter(function (x) { return x > 0; }).sort(function (a, b) { return b - a; }).slice(0, 3);
    if (s.length) { var ft = s.reduce(function (a, b) { return a + b; }, 0) / s.length; return { v: ft * 0.3048, src: 'HE Runs top speed ' + ft.toFixed(1) + ' ft/s' }; }
  } catch (e) {}
  return null;
}
var MT_ZONE_PCT = { mas: [0, 0.65], lis: [0.65, 0.78], mis: [0.78, 0.88], his: [0.88, 0.95], mss: [0.95, 1], acc: [0.95, 1], rsa: [0.95, 1] };
function mtZoneTarget(zone, mss) {
  var r = MT_ZONE_PCT[zone]; if (!r || !mss) return '';
  var f = function (x) { return (x * mss).toFixed(2); }, mph = function (x) { return (x * mss * 2.237).toFixed(1); };
  return r[0] ? f(r[0]) + '–' + f(r[1]) + ' m/s (' + mph(r[0]) + '–' + mph(r[1]) + ' mph)' : '< ' + f(r[1]) + ' m/s (< ' + mph(r[1]) + ' mph)';
}
function mtCurEx(bi, ei) {
  if (typeof PB_ACTIVE_DAY === 'undefined' || !PB_ACTIVE_DAY) return null;
  var d = PB_STATE.weekData[PB_ACTIVE_DAY.weekIdx].days[PB_ACTIVE_DAY.dayIdx];
  return d && d.blocks[bi] && d.blocks[bi].exercises[ei];
}
function mtAthleteName() { return (typeof PB_STATE !== 'undefined' && PB_STATE.athlete) || '(Sandbox)'; }
function mtPct(load) { var m = String(load || '').match(/^(\d+(?:\.\d+)?)\s*%/); return m ? +m[1] : null; }
function mtSecs(s) { s = String(s || '').trim(); var m = s.match(/^(\d+):(\d{2})/); if (m) return +m[1] * 60 + +m[2]; m = s.match(/^:(\d{2})/); if (m) return +m[1]; m = s.match(/^(\d+)\s*s/); return m ? +m[1] : null; }
// Metres in a distance string ("20m + 10m fly" → 30, "30yd" → 27.4)
function mtMetres(dist) {
  var t = 0, re = /(\d+(?:\.\d+)?)\s*(m|yd|y)\b/gi, m;
  while ((m = re.exec(String(dist || '')))) t += +m[1] * (/^y/i.test(m[2]) ? 0.9144 : 1);
  return t;
}
function mtSpeedZone(ex) {
  if (ex.zone) return ex.zone;
  var m = ex.method && mtSpeedPreset(ex.method); if (m && m[9]) return m[9];
  var n = ex.name || '';
  if (/HiS Runs/.test(n)) return 'his';
  if (/^Fly|Vest Sprint|Curved Sprint/.test(n)) return 'mss';
  if (/Acceleration/.test(ex.cat || '') || /Steal Start|Rolling Start|Hill Sprint|Sled Pull/.test(n)) return /%/.test(ex.pct || '') && parseFloat(ex.pct) < 90 ? '' : 'acc';
  return '';
}

// Warnings for one row
function mtMethodWarnings(ex) {
  var w = [], m = ex && ex.method ? mtMethod(ex.method) : null;
  if (ex.type === 'speed') {
    var zone = mtSpeedZone(ex), mss = mtMSS(mtAthleteName());
    if (zone === 'mss' && mss) {
      var d = mtMetres(ex.distance), sec = d ? d / (mss.v * 0.97) : 0, rest = mtSecs(ex.rest);
      if (sec && rest != null && rest < 30 * sec) w.push('MSS rest: ' + sec.toFixed(1) + ' s of sprinting needs ' + Math.round(30 * sec / 60 * 10) / 10 + '–' + Math.round(60 * sec / 60 * 10) / 10 + ' min (30–60 s per second)');
    }
    if (zone === 'his' && (+ex.sets || 1) * (+ex.reps || 1) > 6) w.push('HiS: 6 reps max');
    return w;
  }
  var supra = (m && m[9] === 'supra') || (/^\d/.test(ex.load || '') && parseFloat(ex.load) > 100 && /-0-0-0/.test(ex.tempo || ''));
  if (supra) {
    var who = mtAthleteName(), ta = mtTrainingAge(who), need = /drop|depth|shock/i.test((m && m[2]) || '') ? 3 : 2;
    if (ta == null || ta < need) w.push((need === 3 ? 'Drop / depth jumps need 3+' : 'Supra-maximal eccentric needs 2+') + ' years of training age — ' + (who === '(Sandbox)' ? 'set the athlete' : who) + (ta == null ? ': training age not set (🧪 to set it)' : ': ' + ta + ' yr'));
  }
  var iso = (m && m[9] === 'iso') || /\biso\b|hold/i.test((ex.tempo || '') + ' ' + (ex.reps || ''));
  if (iso) {
    var mx = 0; (String(ex.reps || '').match(/(\d+)\s*(s|sec)\b/gi) || []).forEach(function (s) { mx = Math.max(mx, parseInt(s)); });
    var rng = String(ex.reps || '').match(/(\d+)\s*[–-]\s*(\d+)\s*s\b/i); if (rng) mx = Math.max(mx, +rng[2]);
    if (mx > 40) w.push('Isometric set is ' + mx + ' s — keep time under tension under 40 s for athletes (KILO)');
  }
  var pct = mtPct(ex.load), ecc = parseInt(String(ex.tempo || '').split(/[-\/]/)[0]);
  if (pct != null && pct > 85 && ecc >= 5 && !supra) w.push('Slow eccentric above 85% — Triphasic caps slow eccentrics at 85%');
  // Triphasic HS quality reps per set at ≥ 80%
  var reps = parseInt(ex.reps);
  if (pct != null && reps && !/\+|,|\//.test(String(ex.reps))) {
    var q = pct >= 87.5 ? 1 : pct >= 80 ? 2 : pct >= 77.5 ? 3 : null;
    if (q && reps > q + 2 && !/cluster/i.test(ex.notes || '')) w.push(reps + ' reps at ' + pct + '% — quality reps per set are ' + (q === 1 ? '1' : q === 2 ? '1–2' : '1–3') + ' (Triphasic HS rep-scheme table)');
  }
  return w;
}

// ── Pickers ──
var MT_PICK_SRC_KEY = 'cubs_sc_method_src_v1';
function mtApplyMethod(bi, ei, id) {
  var ex = mtCurEx(bi, ei); if (!ex) return;
  if (ex.type === 'speed') {
    var s = mtSpeedPreset(id); if (!s) return;
    var who = mtAthleteName(), p = mtSpeedProfile(who), mss = mtMSS(who), note = s[2] + ' — ' + s[8];
    ex.sets = String(s[3]); ex.reps = String(s[4]); if (s[5]) ex.distance = s[5]; ex.pct = s[6]; ex.rest = s[7]; ex.method = id; ex.zone = s[9] || '';
    if (/^sm-sled/.test(id) && p.fv) ex.pct = p.fv === 'force' ? '45% BW' : p.fv === 'velocity' ? '15% BW' : ex.pct;
    var upright = s[9] === 'mss' || /wicket|vest|speedbound/.test(id);
    if (s[9] && mss) note += ' · Target ' + mtZoneTarget(s[9], mss.v);
    if (s[9] === 'mss' && mss) { var sec = mtMetres(ex.distance) / (mss.v * 0.97); if (sec) { ex.rest = Math.floor(45 * sec / 60) + ':' + String(Math.round(45 * sec % 60)).padStart(2, '0'); note += ' · Rest ' + Math.round(30 * sec) + '–' + Math.round(60 * sec) + ' s'; } }
    if (s[9] === 'acc' || s[9] === 'mss' || upright) {
      if (p.pp) note += ' · Cue (' + (p.pp === 'push' ? 'pusher' : 'puller') + '): ' + (upright ? (p.pp === 'push' ? 'step your feet down into the ground' : 'drive your thighs up / forward') : (p.pp === 'push' ? 'drive the ground back' : 'drive your thigh forward'));
      note += ' · Rules: ' + (upright ? 'neutral pelvis · flexed ankles · stacked torso · strike from above · scissor' : 'neutral pelvis · flexed ankles · forward torso · push back · scissor');
      if (p.rise === 'early') note += ' · Early riser — hamstring watch';
    }
    ex.notes = note;
  } else {
    var m = mtMethod(id); if (!m) return;
    ex.sets = String(m[3]); ex.reps = String(m[4]); if (m[5]) ex.load = m[5];
    ex.tempo = m[6]; ex.rest = m[7]; ex.notes = m[2] + (m[8] ? ' — ' + m[8] : '') + ' (' + m[10] + ')'; ex.method = id;
  }
  var mm = document.getElementById('mt-method-modal'); if (mm) mm.remove();
  try { pbRenderDayGrid(); pbOpenDay(PB_ACTIVE_DAY.weekIdx, PB_ACTIVE_DAY.dayIdx); } catch (e) { console.error(e); }
}
function mtClearMethod(bi, ei) { var ex = mtCurEx(bi, ei); if (!ex) return; delete ex.method; delete ex.zone; var mm = document.getElementById('mt-method-modal'); if (mm) mm.remove(); try { pbRenderDayGrid(); pbOpenDay(PB_ACTIVE_DAY.weekIdx, PB_ACTIVE_DAY.dayIdx); } catch (e) {} }
function mtSel(id, label, opts, cur) {
  return '<label style="font-size:11px;color:var(--text3);display:inline-flex;gap:4px;align-items:center;">' + label + ' <select id="' + id + '" style="background:var(--bg3);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:11px;padding:3px;">'
    + opts.map(function (o) { return '<option value="' + o[0] + '"' + (String(cur == null ? '' : cur) === String(o[0]) ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>';
}
function mtMethodMenu(bi, ei) {
  var ex = mtCurEx(bi, ei); if (!ex) return;
  var speed = ex.type === 'speed', who = mtAthleteName();
  var list = speed ? MT_SPEED : MT_METHODS, sources = speed ? MT_SPEED_SOURCES : MT_SOURCES;
  var srcKey = MT_PICK_SRC_KEY + (speed ? '_speed' : '');
  var cur = localStorage.getItem(srcKey) || 'All';
  var old = document.getElementById('mt-method-modal'); if (old) old.remove();
  var head;
  if (speed) {
    var p = mtSpeedProfile(who), mss = mtMSS(who);
    head = '<div style="background:rgba(56,189,248,0.07);border:1px solid rgba(56,189,248,0.25);border-radius:8px;padding:9px 10px;margin-bottom:10px;">'
      + '<div style="font-size:11px;font-weight:700;color:#7dd3fc;margin-bottom:6px;">ALTIS profile · ' + mtEsc(who) + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">'
      + '<label style="font-size:11px;color:var(--text3);">Fly-10 <input id="mt-sp-fly" type="number" step="0.01" min="0.7" max="2.5" value="' + (p.fly10 || '') + '" placeholder="1.20" style="width:58px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:11px;padding:3px;"> s</label>'
      + mtSel('mt-sp-unit', '', [['m', 'm'], ['yd', 'yd']], p.unit || 'm')
      + mtSel('mt-sp-pp', 'Push / pull', [['', '—'], ['push', 'Pusher'], ['pull', 'Puller']], p.pp)
      + mtSel('mt-sp-fv', 'F-V', [['', '—'], ['force', 'Force-deficient'], ['velocity', 'Velocity-deficient']], p.fv)
      + mtSel('mt-sp-rise', 'Rise', [['', '—'], ['ok', 'OK riser'], ['early', 'Early riser'], ['never', 'Never riser']], p.rise)
      + mtSel('mt-sp-sl', 'Leg', [['', '—'], ['single', 'Single-leg'], ['double', 'Double-leg']], p.sl)
      + mtSel('mt-sp-horse', 'Horse', [['', '—'], ['tb', 'Thoroughbred'], ['cd', 'Clydesdale']], p.horse)
      + mtSel('mt-sp-stride', 'Stride', [['', '—'], ['length', 'Length'], ['freq', 'Frequency']], p.stride)
      + '</div><div style="font-size:11px;color:var(--text2);margin-top:6px;">' + (mss ? 'MSS ' + mss.v.toFixed(2) + ' m/s (' + (mss.v * 2.237).toFixed(1) + ' mph) from ' + mtEsc(mss.src)
        + ' · LiS ' + mtZoneTarget('lis', mss.v) + ' · HiS ' + mtZoneTarget('his', mss.v) : 'No MSS yet — enter a fly-10 (10 m or 10 yd after ≥ 20 m build-up) or load HE Runs. A track fly-10 can read up to ~0.5 m/s faster than grass in cleats.') + '</div></div>';
  } else {
    head = '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px;">'
      + mtSel('mt-meth-ta', 'Training age · ' + mtEsc(who), [['', 'not set'], [0, '0 yr'], [1, '1 yr'], [2, '2 yr'], [3, '3 yr'], [4, '4 yr'], [6, '6 yr'], [8, '8+ yr']], mtTrainingAge(who)) + '</div>';
  }
  var chips = ['All'].concat(sources).map(function (s) {
    return '<button class="mt-src" data-src="' + mtEsc(s) + '" style="font-size:11px;padding:3px 9px;border-radius:12px;cursor:pointer;border:1px solid ' + (s === cur ? '#f59e0b' : 'rgba(255,255,255,0.12)') + ';background:' + (s === cur ? 'rgba(245,158,11,0.15)' : 'transparent') + ';color:var(--text2);">' + mtEsc(s) + '</button>';
  }).join(' ');
  var groups = [], by = {};
  list.forEach(function (m) { if (cur !== 'All' && m[10] !== cur) return; if (!by[m[1]]) { by[m[1]] = []; groups.push(m[1]); } by[m[1]].push(m); });
  var curM = ex.method ? (speed ? mtSpeedPreset(ex.method) : mtMethod(ex.method)) : null;
  var body = head + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">' + chips + '</div>'
    + '<input id="mt-meth-q" placeholder="Search methods…" style="width:100%;box-sizing:border-box;margin-bottom:8px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:7px 9px;color:var(--text);font-size:12px;">'
    + '<div style="font-size:11px;color:var(--text3);margin-bottom:10px;">Fills ' + (speed ? 'sets, reps, distance, intensity, rest and notes (zone targets, rest and cues from the profile above)' : 'sets, reps, load, tempo, rest and notes') + ' on <b style="color:var(--text2);">' + mtEsc(ex.name || 'this row') + '</b>.'
    + (curM ? ' Current: <b style="color:#fbbf24;">' + mtEsc(curM[2]) + '</b> · <a href="#" id="mt-meth-clear" style="color:#f87171;">clear</a>' : '') + '</div>'
    + '<div id="mt-meth-list">' + groups.map(function (g) {
      return '<div class="mt-meth-g" style="margin-bottom:10px;"><div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#a5b4fc;margin-bottom:5px;">' + mtEsc(g) + '</div>'
        + by[g].map(function (m) {
          var detail = speed ? m[3] + ' x ' + m[4] + (m[5] ? ' · ' + m[5] : '') + ' · ' + m[6] + ' · ' + m[7] : m[3] + ' x ' + m[4] + ' · ' + (m[5] || 'keep load') + ' · ' + (m[6] || '—') + ' · ' + m[7];
          return '<button class="mt-meth" data-id="' + m[0] + '" data-s="' + mtEsc((m[2] + ' ' + m[8] + ' ' + m[10] + ' ' + m[1]).toLowerCase()) + '" style="display:block;width:100%;text-align:left;margin-bottom:4px;padding:7px 10px;background:' + (ex.method === m[0] ? 'rgba(245,158,11,0.14)' : 'rgba(255,255,255,0.03)') + ';border:1px solid rgba(255,255,255,0.08);border-radius:6px;color:var(--text);cursor:pointer;">'
            + '<div style="font-size:12px;font-weight:600;">' + mtEsc(m[2]) + (m[9] === 'supra' ? ' <span style="color:#f87171;font-size:10px;">training age</span>' : '') + (m[9] === 'iso' ? ' <span style="color:#fbbf24;font-size:10px;">&lt; 40 s</span>' : '') + (speed && m[9] ? ' <span style="color:#7dd3fc;font-size:10px;">' + m[9].toUpperCase() + '</span>' : '') + (cur === 'All' ? ' <span style="color:var(--text3);font-size:10px;">· ' + mtEsc(m[10]) + '</span>' : '') + '</div>'
            + '<div style="font-size:10px;color:var(--text3);font-family:\'DM Mono\',monospace;margin-top:2px;">' + mtEsc(detail) + '</div>'
            + (m[8] ? '<div style="font-size:10px;color:var(--text3);margin-top:2px;">' + mtEsc(m[8]) + '</div>' : '') + '</button>';
        }).join('') + '</div>';
    }).join('') + '</div>';
  var mo = mtModal(speed ? '⚡ Speed methods' : '🧪 Training methods', body, 600); mo.id = 'mt-method-modal';
  mo.querySelectorAll('.mt-meth').forEach(function (b) { b.onclick = function () { mtApplyMethod(bi, ei, b.getAttribute('data-id')); }; });
  mo.querySelectorAll('.mt-src').forEach(function (b) { b.onclick = function () { localStorage.setItem(srcKey, b.getAttribute('data-src')); mtMethodMenu(bi, ei); }; });
  var q = mo.querySelector('#mt-meth-q');
  q.oninput = function () { var v = q.value.trim().toLowerCase(); mo.querySelectorAll('.mt-meth').forEach(function (b) { b.style.display = !v || b.getAttribute('data-s').indexOf(v) >= 0 ? 'block' : 'none'; }); mo.querySelectorAll('.mt-meth-g').forEach(function (g) { var any = [].some.call(g.querySelectorAll('.mt-meth'), function (b) { return b.style.display !== 'none'; }); g.style.display = any ? '' : 'none'; }); };
  var redraw = function () { try { pbOpenDay(PB_ACTIVE_DAY.weekIdx, PB_ACTIVE_DAY.dayIdx); } catch (e) {} mtMethodMenu(bi, ei); };
  if (speed) {
    var bind = function (id, key, num) { var el = mo.querySelector('#' + id); if (el) el.onchange = function () { mtSetSpeedProfile(who, key, num ? (parseFloat(el.value) || '') : el.value); redraw(); }; };
    bind('mt-sp-fly', 'fly10', true); bind('mt-sp-unit', 'unit'); bind('mt-sp-pp', 'pp'); bind('mt-sp-fv', 'fv'); bind('mt-sp-rise', 'rise'); bind('mt-sp-sl', 'sl'); bind('mt-sp-horse', 'horse'); bind('mt-sp-stride', 'stride');
  } else {
    mo.querySelector('#mt-meth-ta').onchange = function () { mtSetTrainingAge(who, this.value); redraw(); };
  }
  var c = mo.querySelector('#mt-meth-clear'); if (c) c.onclick = function (e) { e.preventDefault(); mtClearMethod(bi, ei); };
}

// ── Day-level checks: ALTIS volume budget + The System per-session caps ──
function mtDayChecks(d) {
  var acc = 0, mss = 0, his = 0, out = [], cap = {};
  (d.blocks || []).forEach(function (b) { (b.exercises || []).forEach(function (ex) {
    var n = (parseFloat(ex.sets) || 1) * (parseFloat(ex.reps) || 1);
    if (ex.type === 'speed') {
      var z = mtSpeedZone(ex), m = mtMetres(ex.distance) * n;
      if (z === 'acc') acc += m; else if (z === 'mss') mss += m; else if (z === 'his') his += n;
    } else if (mtPct(ex.load) != null) {
      var power = /Olympic/i.test(ex.cat || '') || /clean|snatch|jerk|high pull/i.test(ex.name || '');
      var reps = (parseFloat(ex.sets) || 0) * (parseFloat(ex.reps) || 0);
      if (reps > (power ? 28 : 38)) out.push(ex.name + ': ' + reps + ' reps — The System caps ' + (power ? 'power lifts at 25 ± 3' : 'strength lifts at 35 ± 3') + ' a session');
    }
  }); });
  var sum = [];
  if (acc || mss || his) {
    sum.push('Accel ' + Math.round(acc) + ' m' + (acc > 300 ? ' ⚠ over the 300 m team-sport cap' : ''));
    sum.push('MSS ' + Math.round(mss) + ' m' + (mss && (mss < 120 || mss > 400) ? ' ⚠ outside 120–400 m' : ''));
    if (his) sum.push('HiS ' + his + ' reps' + (his > 6 ? ' ⚠ 6 max' : ''));
  }
  return { speed: sum, caps: out };
}
function mtDecorateDay() {
  if (typeof PB_ACTIVE_DAY === 'undefined' || !PB_ACTIVE_DAY) return;
  var day = PB_STATE.weekData[PB_ACTIVE_DAY.weekIdx] && PB_STATE.weekData[PB_ACTIVE_DAY.weekIdx].days[PB_ACTIVE_DAY.dayIdx];
  document.querySelectorAll('button[onclick^="pbGenerateExerciseNote("]').forEach(function (btn) {
    if (btn.getAttribute('data-mt')) return;
    var a = (btn.getAttribute('onclick').match(/\((\d+),(\d+)\)/) || []); if (!a.length) return;
    var bi = +a[1], ei = +a[2], ex = mtCurEx(bi, ei); if (!ex) return;
    btn.setAttribute('data-mt', '1');
    var speed = ex.type === 'speed', cm = ex.method ? (speed ? mtSpeedPreset(ex.method) : mtMethod(ex.method)) : null;
    var b = document.createElement('button');
    b.title = cm ? (speed ? 'Speed method: ' : 'Method: ') + cm[2] : (speed ? 'Apply a speed method (ALTIS zones, targets, rest, cues)' : 'Apply a training method (tempo, load, rest, notes)');
    b.textContent = speed ? '⚡' : '🧪'; b.style.cssText = 'background:none;border:none;cursor:pointer;font-size:12px;padding:1px 3px;' + (cm ? 'filter:drop-shadow(0 0 3px #f59e0b);' : 'opacity:.55;');
    b.onclick = function () { mtMethodMenu(bi, ei); };
    btn.parentNode.insertBefore(b, btn);
    var warn = mtMethodWarnings(ex), row = btn.parentNode.parentNode, extra = '';
    if (speed) { var z = mtSpeedZone(ex), mss = mtMSS(mtAthleteName()); if (z && mss) extra = '🎯 ' + mtZoneTarget(z, mss.v); }
    if ((warn.length || extra) && row && row.parentNode) {
      var dv = document.createElement('div');
      dv.style.cssText = 'margin:-2px 0 7px 44px;font-size:10px;color:' + (warn.length ? '#fbbf24' : '#7dd3fc') + ';';
      dv.textContent = [extra].concat(warn.map(function (x) { return '⚠ ' + x; })).filter(Boolean).join(' · ');
      row.insertAdjacentElement('afterend', dv);
    }
  });
  var ed = document.getElementById('pb-session-editor');
  if (day && ed && !ed.querySelector('.mt-daycheck')) {
    var c = mtDayChecks(day);
    if (c.speed.length || c.caps.length) {
      var box = document.createElement('div'); box.className = 'mt-daycheck';
      var bad = /⚠/.test(c.speed.join('')) || c.caps.length;
      box.style.cssText = 'margin:6px 0 10px;padding:7px 10px;border-radius:7px;font-size:11px;border:1px solid ' + (bad ? 'rgba(251,191,36,0.4)' : 'rgba(56,189,248,0.3)') + ';background:' + (bad ? 'rgba(251,191,36,0.06)' : 'rgba(56,189,248,0.05)') + ';color:var(--text2);';
      box.innerHTML = (c.speed.length ? '<b style="color:#7dd3fc;">⚡ ALTIS volume</b> · ' + mtEsc(c.speed.join(' · ')) : '') + (c.caps.length ? '<div style="color:#fbbf24;margin-top:3px;">⚠ ' + c.caps.map(mtEsc).join('<br>⚠ ') + '</div>' : '');
      ed.insertBefore(box, ed.firstChild);
    }
  }
}
(function () {
  if (typeof pbOpenDay !== 'function') return;
  var _od = pbOpenDay;
  pbOpenDay = function () { var r = _od.apply(this, arguments); try { mtDecorateDay(); } catch (e) { console.error(e); } return r; };
})();
