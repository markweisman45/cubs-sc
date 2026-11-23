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
  if (typeof METHOD_TEMPLATES === 'undefined') mtLoadScript('data/method-templates.js?v=2', done);
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
  ["Shoulder Complex", "Incline Trap-3 Raise", "", "Chest on an incline bench, thumb up, raise in line with the lower traps"]
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
    var only = {}; MT_NEW_EX.slice(MT_NEW_EX.length - 11).forEach(function (e) { only[e[1]] = 1; });
    var n = mtEnsureExercises(only);
    localStorage.setItem(MT_EX_FLAG2, new Date().toISOString());
    if (n && typeof showStatus === 'function') showStatus('📚 Added ' + n + ' KILO exercises to your library (jump and reach, penta / deca jumps, drop landings, overhead press, Biering-Sorensen hold, trap-3 raise…)');
  } catch (e) { console.error(e); }
}, 7000);

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
function mtMethod(id) { for (var i = 0; i < MT_METHODS.length; i++) if (MT_METHODS[i][0] === id) return MT_METHODS[i]; return null; }
var MT_TA_KEY = 'cubs_sc_training_age_v1';
function mtTrainingAge(name) { try { var o = JSON.parse(localStorage.getItem(MT_TA_KEY) || '{}'); return o[name] == null ? null : +o[name]; } catch (e) { return null; } }
function mtSetTrainingAge(name, v) { try { var o = JSON.parse(localStorage.getItem(MT_TA_KEY) || '{}'); if (v === '' || v == null) delete o[name]; else o[name] = +v; localStorage.setItem(MT_TA_KEY, JSON.stringify(o)); } catch (e) {} }
function mtCurEx(bi, ei) {
  if (typeof PB_ACTIVE_DAY === 'undefined' || !PB_ACTIVE_DAY) return null;
  var d = PB_STATE.weekData[PB_ACTIVE_DAY.weekIdx].days[PB_ACTIVE_DAY.dayIdx];
  return d && d.blocks[bi] && d.blocks[bi].exercises[ei];
}
function mtAthleteName() { return (typeof PB_STATE !== 'undefined' && PB_STATE.athlete) || '(Sandbox)'; }
// Warnings for one exercise row
function mtMethodWarnings(ex) {
  var w = [], m = ex && ex.method ? mtMethod(ex.method) : null;
  var supra = (m && m[9] === 'supra') || (/^\d/.test(ex.load || '') && parseFloat(ex.load) > 100 && /-0-0-0/.test(ex.tempo || ''));
  if (supra) {
    var who = mtAthleteName(), ta = mtTrainingAge(who);
    if (ta == null || ta < 2) w.push('Supra-maximal eccentric needs 2+ years of training age — ' + (who === '(Sandbox)' ? 'set the athlete' : who) + (ta == null ? ': training age not set (🧪 to set it)' : ': ' + ta + ' yr'));
  }
  var iso = (m && m[9] === 'iso') || /\biso\b|hold/i.test((ex.tempo || '') + ' ' + (ex.reps || ''));
  if (iso) {
    var secs = String(ex.reps || '').match(/(\d+)\s*(s|sec)\b/gi) || [];
    var mx = 0; secs.forEach(function (s) { mx = Math.max(mx, parseInt(s)); });
    var rng = String(ex.reps || '').match(/(\d+)\s*[–-]\s*(\d+)\s*s\b/i); if (rng) mx = Math.max(mx, +rng[2]);
    if (mx > 40) w.push('Isometric set is ' + mx + ' s — keep time under tension under 40 s for athletes');
  }
  return w;
}
function mtApplyMethod(bi, ei, id) {
  var ex = mtCurEx(bi, ei), m = mtMethod(id); if (!ex || !m) return;
  ex.sets = String(m[3]); ex.reps = String(m[4]); if (m[5]) ex.load = m[5];
  ex.tempo = m[6]; ex.rest = m[7]; ex.notes = m[2] + ' — ' + m[8]; ex.method = id;
  var mm = document.getElementById('mt-method-modal'); if (mm) mm.remove();
  try { pbRenderDayGrid(); pbOpenDay(PB_ACTIVE_DAY.weekIdx, PB_ACTIVE_DAY.dayIdx); } catch (e) { console.error(e); }
  try { if (typeof pbAutoSave === 'function') pbAutoSave(); } catch (e) {}
}
function mtClearMethod(bi, ei) { var ex = mtCurEx(bi, ei); if (!ex) return; delete ex.method; var mm = document.getElementById('mt-method-modal'); if (mm) mm.remove(); try { pbOpenDay(PB_ACTIVE_DAY.weekIdx, PB_ACTIVE_DAY.dayIdx); } catch (e) {} }
function mtMethodMenu(bi, ei) {
  var ex = mtCurEx(bi, ei); if (!ex) return;
  var who = mtAthleteName(), ta = mtTrainingAge(who);
  var old = document.getElementById('mt-method-modal'); if (old) old.remove();
  var groups = [], by = {};
  MT_METHODS.forEach(function (m) { if (!by[m[1]]) { by[m[1]] = []; groups.push(m[1]); } by[m[1]].push(m); });
  var body = '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">'
    + '<input id="mt-meth-q" placeholder="Search methods…" style="flex:1;min-width:160px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:7px 9px;color:var(--text);font-size:12px;">'
    + '<label style="font-size:11px;color:var(--text3);">Training age · ' + mtEsc(who) + ' <select id="mt-meth-ta" style="background:var(--bg3);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:11px;padding:3px;">'
    + ['', 0, 1, 2, 3, 4, 6, 8].map(function (v) { return '<option value="' + v + '"' + (String(ta == null ? '' : ta) === String(v) ? ' selected' : '') + '>' + (v === '' ? 'not set' : v + (v === 8 ? '+' : '') + ' yr') + '</option>'; }).join('') + '</select></label></div>'
    + '<div style="font-size:11px;color:var(--text3);margin-bottom:10px;">Fills sets, reps, load, tempo, rest and notes on <b style="color:var(--text2);">' + mtEsc(ex.name || 'this row') + '</b>. "Keep" means the row\'s current load stays.'
    + (ex.method ? ' Current: <b style="color:#fbbf24;">' + mtEsc((mtMethod(ex.method) || [0, 0, ex.method])[2]) + '</b> · <a href="#" id="mt-meth-clear" style="color:#f87171;">clear</a>' : '') + '</div>'
    + '<div id="mt-meth-list">' + groups.map(function (g) {
      return '<div class="mt-meth-g" style="margin-bottom:10px;"><div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#a5b4fc;margin-bottom:5px;">' + mtEsc(g) + '</div>'
        + by[g].map(function (m) {
          return '<button class="mt-meth" data-id="' + m[0] + '" data-s="' + mtEsc((m[2] + ' ' + m[8]).toLowerCase()) + '" style="display:block;width:100%;text-align:left;margin-bottom:4px;padding:7px 10px;background:' + (ex.method === m[0] ? 'rgba(245,158,11,0.14)' : 'rgba(255,255,255,0.03)') + ';border:1px solid rgba(255,255,255,0.08);border-radius:6px;color:var(--text);cursor:pointer;">'
            + '<div style="font-size:12px;font-weight:600;">' + mtEsc(m[2]) + (m[9] === 'supra' ? ' <span style="color:#f87171;font-size:10px;">2+ yr</span>' : '') + (m[9] === 'iso' ? ' <span style="color:#fbbf24;font-size:10px;">&lt; 40 s</span>' : '') + '</div>'
            + '<div style="font-size:10px;color:var(--text3);font-family:\'DM Mono\',monospace;margin-top:2px;">' + mtEsc(m[3] + ' x ' + m[4] + ' · ' + (m[5] || 'keep load') + ' · ' + (m[6] || '—') + ' · ' + m[7]) + '</div>'
            + '<div style="font-size:10px;color:var(--text3);margin-top:2px;">' + mtEsc(m[8]) + '</div></button>';
        }).join('') + '</div>';
    }).join('') + '</div>';
  var m = mtModal('🧪 KILO method', body, 560); m.id = 'mt-method-modal';
  m.querySelectorAll('.mt-meth').forEach(function (b) { b.onclick = function () { mtApplyMethod(bi, ei, b.getAttribute('data-id')); }; });
  var q = m.querySelector('#mt-meth-q');
  q.oninput = function () { var v = q.value.trim().toLowerCase(); m.querySelectorAll('.mt-meth').forEach(function (b) { b.style.display = !v || b.getAttribute('data-s').indexOf(v) >= 0 ? 'block' : 'none'; }); m.querySelectorAll('.mt-meth-g').forEach(function (g) { var any = [].some.call(g.querySelectorAll('.mt-meth'), function (b) { return b.style.display !== 'none'; }); g.style.display = any ? '' : 'none'; }); };
  m.querySelector('#mt-meth-ta').onchange = function () { mtSetTrainingAge(who, this.value); try { pbOpenDay(PB_ACTIVE_DAY.weekIdx, PB_ACTIVE_DAY.dayIdx); } catch (e) {} };
  var c = m.querySelector('#mt-meth-clear'); if (c) c.onclick = function (e) { e.preventDefault(); mtClearMethod(bi, ei); };
  setTimeout(function () { q.focus(); }, 30);
}
// Decorate the open day: 🧪 button on lift rows, method badge, warnings under the row
function mtDecorateDay() {
  if (typeof PB_ACTIVE_DAY === 'undefined' || !PB_ACTIVE_DAY) return;
  document.querySelectorAll('button[onclick^="pbGenerateExerciseNote("]').forEach(function (btn) {
    if (btn.getAttribute('data-mt')) return;
    var a = (btn.getAttribute('onclick').match(/\((\d+),(\d+)\)/) || []); if (!a.length) return;
    var bi = +a[1], ei = +a[2], ex = mtCurEx(bi, ei); if (!ex || ex.type === 'speed') return;
    btn.setAttribute('data-mt', '1');
    var b = document.createElement('button');
    b.title = ex.method ? 'KILO method: ' + (mtMethod(ex.method) || [0, 0, ex.method])[2] : 'Apply a KILO method (tempo, load, rest, notes)';
    b.textContent = '🧪'; b.style.cssText = 'background:none;border:none;cursor:pointer;font-size:12px;padding:1px 3px;' + (ex.method ? 'filter:drop-shadow(0 0 3px #f59e0b);' : 'opacity:.55;');
    b.onclick = function () { mtMethodMenu(bi, ei); };
    btn.parentNode.insertBefore(b, btn);
    var warn = mtMethodWarnings(ex), row = btn.parentNode.parentNode;
    if (warn.length && row && row.parentNode) {
      var d = document.createElement('div');
      d.style.cssText = 'margin:-2px 0 7px 44px;font-size:10px;color:#fbbf24;';
      d.textContent = '⚠ ' + warn.join(' · ');
      row.insertAdjacentElement('afterend', d);
    }
  });
}
(function () {
  if (typeof pbOpenDay !== 'function') return;
  var _od = pbOpenDay;
  pbOpenDay = function () { var r = _od.apply(this, arguments); try { mtDecorateDay(); } catch (e) { console.error(e); } return r; };
})();
