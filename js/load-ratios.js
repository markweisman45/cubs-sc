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
