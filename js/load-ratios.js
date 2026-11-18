// ═══════════════════════════════════════════════════════════════════════════
// LOAD RATIOS — % loads for lifts that don't have their own tested 1RM.
//
// Each exercise points at a parent lift (one of RM_LIFTS) and a ratio:
//   exercise 1RM ≈ ratio × parent 1RM
// so "75%" on DB Bench Press for an athlete with a 300 lb BB Bench is
//   0.75 × (0.38 × 300) = 85 lbs  → shown as "85 lbs/DB".
// For DB/KB lifts the ratio is PER DUMBBELL (one hand); goblet and single-arm
// lifts are the one bell's weight.
//
// Lookup order for an exercise:
//   1. the exercise's own liftKey with a tested 1RM
//   2. a coach override saved on the Library entry (rmParent / rmRatio)
//   3. this default table
// Parents can chain (Front Squat → Back Squat) when the athlete hasn't tested
// the parent itself. Only index.html uses this; program.html gets the
// numbers baked in at send time.
// ═══════════════════════════════════════════════════════════════════════════
var DEFAULT_LOAD_RATIOS = {
  // ── Squat family → Back Squat ──
  'back squat':                         ['Back Squat', 1.00],
  'front squat':                        ['Back Squat', 0.85],
  'safety bar squat':                   ['Back Squat', 0.90],
  'box squat':                          ['Back Squat', 0.95],
  'pause squat':                        ['Back Squat', 0.85],
  'squat 1 1/4':                        ['Back Squat', 0.80],
  'squat 3 eccentic pauses':            ['Back Squat', 0.80],
  'back squat heels elevated':          ['Back Squat', 0.90],
  'toes elevated squat':                ['Back Squat', 0.85],
  'floating heel squat':                ['Back Squat', 0.85],
  'overhead squat':                     ['Back Squat', 0.60],
  'bb hack squat':                      ['Back Squat', 0.80],
  'bb frankenstein squat':              ['Back Squat', 0.70],
  'bb split squat':                     ['Back Squat', 0.55],
  'barbell on back foot flat split squat': ['Back Squat', 0.55],
  'rfe split squat (bb)':               ['Back Squat', 0.45],
  'rfe split squat (bb front)':         ['Back Squat', 0.40],
  'zercher ffe split squat':            ['Back Squat', 0.45],
  'bb lunge':                           ['Back Squat', 0.50],
  'barbell on back walking lunge':      ['Back Squat', 0.50],
  'bb step-up':                         ['Back Squat', 0.40],
  'bb lateral lunge':                   ['Back Squat', 0.40],
  // per DB
  'db split squat':                     ['Back Squat', 0.25],
  'rfe split squat (db)':               ['Back Squat', 0.22],
  'db lunge':                           ['Back Squat', 0.25],
  'db step-up':                         ['Back Squat', 0.20],
  'poliquin dumbbell step-up':          ['Back Squat', 0.15],
  // one bell
  'goblet squat':                       ['Back Squat', 0.35],
  'rfe split squat (goblet)':           ['Back Squat', 0.30],
  'goblet lateral squat':               ['Back Squat', 0.30],
  'goblet lateral lunge':               ['Back Squat', 0.30],

  // ── Hinge family → Trap Bar DL ──
  'trap bar deadlift':                  ['Trap Bar DL', 1.00],
  'trap bar deadlift (no touch)':       ['Trap Bar DL', 0.85],
  'trap bar counter movement jump':     ['Trap Bar DL', 1.00],
  'conventional dl':                    ['Trap Bar DL', 0.90],
  'clean grip deadlift':                ['Trap Bar DL', 0.85],
  'snatch grip deadlift':               ['Trap Bar DL', 0.75],
  'sumo deadlift':                      ['Trap Bar DL', 0.90],
  'staggered deadlift':                 ['Trap Bar DL', 0.65],
  'ss bb deadlift':                     ['Trap Bar DL', 0.65],
  'bb rdl':                             ['Trap Bar DL', 0.65],
  'rdl':                                ['Trap Bar DL', 0.65],
  'sl bb rdl':                          ['Trap Bar DL', 0.35],
  'bb good morning':                    ['Trap Bar DL', 0.40],
  'bb hip bridge':                      ['Trap Bar DL', 0.85],
  'sl bb hip bridge':                   ['Trap Bar DL', 0.40],
  'trap bar carry':                     ['Trap Bar DL', 0.75],
  // per DB / per hand
  'b-stance db rdl':                    ['Trap Bar DL', 0.25],
  'split stance db rdl':                ['Trap Bar DL', 0.25],
  'sl db rdl':                          ['Trap Bar DL', 0.20],
  'farmer carry':                       ['Trap Bar DL', 0.35],
  'suitcase carry':                     ['Trap Bar DL', 0.30],

  // ── Press family → BB Bench Press ──
  'bb bench press':                     ['BB Bench Press', 1.00],
  'flat barbell press':                 ['BB Bench Press', 1.00],
  'bb pause bench press':               ['BB Bench Press', 0.92],
  'bb eccentric bench press':           ['BB Bench Press', 1.00],
  'bb close grip bench press':          ['BB Bench Press', 0.90],
  'swiss bar bench press':              ['BB Bench Press', 0.90],
  'incline barbell press':              ['BB Bench Press', 0.80],
  'decline barbell press':              ['BB Bench Press', 1.00],
  'bb floor press':                     ['BB Bench Press', 0.90],
  'bb oh press':                        ['BB Bench Press', 0.65],
  'push press':                         ['BB OH Press',    1.20],
  'landmine press':                     ['BB Bench Press', 0.45],
  'half kneeling landmine press':       ['BB Bench Press', 0.40],
  'landmine push press (video)':        ['BB Bench Press', 0.45],
  // per DB
  'db bench press':                     ['BB Bench Press', 0.38],
  'db floor press':                     ['BB Bench Press', 0.36],
  'incline db press':                   ['BB Bench Press', 0.33],
  'db incline bench press':             ['BB Bench Press', 0.33],
  'db sa bench press':                  ['BB Bench Press', 0.40],
  'arnold press':                       ['BB Bench Press', 0.20],
  'hk sa arnold press':                 ['BB Bench Press', 0.20],

  // ── Pull family → BB Row (BB Row falls back to BB Bench) ──
  'bb row':                             ['BB Bench Press', 0.80],
  'barbell row':                        ['BB Row', 1.00],
  'bb pendlay row':                     ['BB Row', 0.90],
  'tb pendlay row':                     ['BB Row', 0.95],
  'db sa row':                          ['BB Row', 0.50],
  'db single arm row':                  ['DB SA Row', 1.00],
  'lat pulldown':                       ['BB Bench Press', 0.75],

  // ── Olympic → Power Clean ──
  'power clean':                        ['Back Squat', 0.65],
  'hang clean':                         ['Power Clean', 0.95],
  'high pull':                          ['Power Clean', 1.00]
};

function _lrDbEx(name) {
  var n = String(name || '').toLowerCase();
  return (typeof EXERCISE_DB !== 'undefined' ? EXERCISE_DB : []).find(function (e) { return e && e.name && e.name.toLowerCase() === n; }) || null;
}

// The [parent, ratio] rule for an exercise, or null. Coach overrides win.
function loadRatioFor(name) {
  var dbEx = _lrDbEx(name);
  if (dbEx && dbEx.rmParent && parseFloat(dbEx.rmRatio) > 0) return [dbEx.rmParent, parseFloat(dbEx.rmRatio) / 100, 'custom'];
  var d = DEFAULT_LOAD_RATIOS[String(name || '').toLowerCase()];
  return d ? [d[0], d[1], 'default'] : null;
}

// Estimated 1RM for an exercise for one athlete.
// → { oneRM, source: 'tested'|'ratio', liftKey?, parent?, ratio?, parentRM?, label } or null
function resolve1RM(athlete, name, _depth) {
  _depth = _depth || 0;
  if (!athlete || !name || _depth > 4) return null;
  var dbEx = _lrDbEx(name);
  var own = (dbEx && dbEx.liftKey) || name;
  // "Bb Bench Press" in a program is the "BB Bench Press" 1RM — match RM_LIFTS ignoring case
  if (typeof RM_LIFTS !== 'undefined') {
    var canon = RM_LIFTS.find(function (l) { return l.toLowerCase() === String(own).toLowerCase(); });
    if (canon) own = canon;
  }
  var tested = get1RM(athlete, own);
  if (tested) return { oneRM: tested, source: 'tested', liftKey: own, label: own + ' 1RM ' + tested };
  var rule = loadRatioFor(name);
  if (!rule || rule[0].toLowerCase() === String(name).toLowerCase()) return null;
  var p = resolve1RM(athlete, rule[0], _depth + 1);
  if (!p) return null;
  var est = p.oneRM * rule[1];
  return {
    oneRM: est, source: 'ratio', parent: rule[0], ratio: rule[1], parentRM: p.oneRM, how: rule[2],
    label: Math.round(rule[1] * 100) + '% of ' + rule[0] + ' (' + (p.source === 'tested' ? '1RM ' : 'est. ') + Math.round(p.oneRM) + ')'
  };
}

// Bake lbs for one program exercise (mutates ex). Returns the resolve result.
function applyRatioLoad(ex, athlete) {
  if (!ex || !ex.name) return null;
  var r = resolve1RM(athlete, ex.name);
  if (!r) return null;
  ex.base1RM = Math.round(r.oneRM);
  var m = String(ex.load || '').match(/(\d+(?:\.\d+)?)\s*%/);
  if (m) {
    var lbs = calcMROUND(parseFloat(m[1]), r.oneRM);
    if (lbs) { ex.calcWeight = lbs; ex.calcWeightSource = r.label; }
  }
  return r;
}

// ═══════════════════════════════════════════════════════════════════════════
// NEW 1RM → UPDATE LIVE PROGRAMS
// Loads are baked into an athlete's program when it's sent. After a new 1RM
// is saved, this recalculates the loads on his live programs (started or
// upcoming, not finished) from the cloud copy — so his live edits, logs and
// messages stay — and tells him on his page what changed.
// ═══════════════════════════════════════════════════════════════════════════
function _rmProgEnded(st) {
  if (!st || !st.startDate || !st.weekData) return false;
  var end = new Date(st.startDate + 'T00:00:00');
  end.setDate(end.getDate() + st.weekData.length * 7);
  return end < new Date(new Date().toDateString());
}

// Recalculate one pb_state in place. Returns [{ name, from, to }] — one per exercise whose lbs changed.
function rmRecalcState(st, athlete) {
  var changed = {}, out = [];
  (st.weekData || []).forEach(function (wk) {
    (wk.days || []).forEach(function (day) {
      (day.blocks || []).forEach(function (block) {
        (block.exercises || []).forEach(function (ex) {
          if (!ex || !ex.name) return;
          var before = ex.calcWeight || null;
          var r = applyRatioLoad(ex, athlete);
          if (!r) return;
          if (ex.calcWeight && before !== ex.calcWeight && !changed[ex.name]) {
            changed[ex.name] = 1;
            out.push({ name: ex.name, from: before, to: ex.calcWeight, suf: (typeof TC !== 'undefined' && TC.loadSuffix) ? TC.loadSuffix(ex) : '' });
          }
        });
      });
    });
  });
  return out;
}

// dryRun: just report. Otherwise writes. → [{ id, name, changes: [...] , err? }]
async function rmRefreshLivePrograms(athlete, dryRun) {
  var db = typeof getSupaClient === 'function' ? getSupaClient() : null;
  if (!db || !athlete) return [];
  var q = await db.from('athlete_programs').select('id,name,pb_state').eq('athlete', athlete);
  if (q.error) throw q.error;
  var results = [];
  for (var i = 0; i < (q.data || []).length; i++) {
    var row = q.data[i];
    var st = typeof peParse === 'function' ? peParse(row.pb_state) : (typeof row.pb_state === 'string' ? JSON.parse(row.pb_state) : row.pb_state);
    if (!st || !st.weekData || _rmProgEnded(st)) continue;
    var changes = rmRecalcState(st, athlete);
    if (!changes.length) continue;
    var res = { id: String(row.id), name: row.name || 'Program', changes: changes };
    if (!dryRun) {
      try {
        var shown = changes.slice(0, 6).map(function (c) { return c.name + ' ' + (c.from ? c.from + ' → ' : '') + c.to + ' lbs' + (c.suf || ''); });
        var text = 'New 1RM — loads updated' + (shown.length ? ': ' + shown.join(', ') : '') + (changes.length > shown.length ? ' + more' : '');
        var w = await peWriteProgram(db, res.id, st, { by: '1rm', extraChanges: [{ wi: null, di: null, text: text }] });
        var copy = (typeof SAVED_PROGRAMS !== 'undefined' ? SAVED_PROGRAMS : []).find(function (p) { return String(p.id) === res.id && p.isAssigned; });
        if (copy) copy.pbState = JSON.parse(JSON.stringify(w.st));
      } catch (e) { res.err = e.message || String(e); }
    }
    results.push(res);
  }
  if (!dryRun && typeof persistPrograms === 'function') persistPrograms();
  if (!dryRun && typeof loadProgramRows === 'function') loadProgramRows();
  return results;
}

// After saving 1RMs: offer a one-click update if any live program would change.
async function rmOfferRefresh(athlete) {
  var msg = document.getElementById('rm-save-msg');
  if (!msg) return;
  var box = document.getElementById('rm-refresh-box');
  if (!box) { box = document.createElement('div'); box.id = 'rm-refresh-box'; box.style.cssText = 'font-size:11px;margin-top:6px;line-height:1.5;'; msg.parentNode.insertBefore(box, msg.nextSibling); }
  box.innerHTML = '<span style="color:var(--text3);">Checking ' + athlete + '\'s live programs…</span>';
  var found;
  try { found = await rmRefreshLivePrograms(athlete, true); }
  catch (e) { box.innerHTML = '<span style="color:var(--yellow);">⚠ Couldn\'t check live programs: ' + (e.message || e) + '</span>'; return; }
  if (!found.length) { box.innerHTML = '<span style="color:var(--text3);">No live programs for ' + athlete + ' need new loads.</span>'; return; }
  var n = found.reduce(function (s, r) { return s + r.changes.length; }, 0);
  var ex = found[0].changes.slice(0, 3).map(function (c) { return c.name + ' ' + (c.from ? c.from + '→' : '') + c.to; }).join(', ');
  box.innerHTML = '<div style="color:var(--yellow);">' + n + ' load' + (n === 1 ? '' : 's') + ' change in ' + found.length + ' live program' + (found.length === 1 ? '' : 's') + (ex ? ' (' + ex + (n > 3 ? ', …' : '') + ')' : '') + '</div>'
    + '<button id="rm-refresh-go" class="generate-btn" style="padding:6px 12px;margin-top:4px;font-size:11px;">↻ Update ' + athlete.split(' ')[0] + '\'s program' + (found.length === 1 ? '' : 's') + '</button>';
  document.getElementById('rm-refresh-go').onclick = async function () {
    this.disabled = true; this.textContent = 'Updating…';
    try {
      var done = await rmRefreshLivePrograms(athlete, false);
      var bad = done.filter(function (r) { return r.err; });
      box.innerHTML = bad.length
        ? '<span style="color:#f87171;">⚠ ' + bad.length + ' update' + (bad.length === 1 ? '' : 's') + ' failed: ' + bad.map(function (r) { return r.name + ' — ' + r.err; }).join('; ') + '</span>'
        : '<span style="color:var(--green);">✅ Updated ' + done.length + ' program' + (done.length === 1 ? '' : 's') + ' — ' + athlete.split(' ')[0] + ' sees the new loads (and a note saying why) next time he opens his link.</span>';
    } catch (e) { box.innerHTML = '<span style="color:#f87171;">⚠ Update failed: ' + (e.message || e) + '</span>'; }
  };
}
