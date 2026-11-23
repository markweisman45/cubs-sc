// ══════════════════════════════════════════════════════════════════════════
// COACH LOOP — connects sent programs back into the dashboard
//   1. Athlete logs → loads auto-adjust (athlete page, via TC.autoLoad)
//   2. Equipment & location (home / hotel gym / hotel room) → swaps in the
//      builder (Location & travel) and per athlete at send
//   3. Logged training → ACWR / strain / Workload (offseason, automatically)
//   4. Inbox — pain, missed sessions, missed reps, strength changes, notes
//   5. Readiness check-ins (athlete page) → flagged here when red
//   6. Program checks — speed first, pairing, heavy LB before sprints, ACWR
//   7. RTP limits applied to an athlete's copy at send
// Loaded after the main dashboard script; relies on its globals
// (PLAYERS, EXERCISE_DB, getSupaClient, RTP_DATA, ATHLETE_1RM, …).
// ══════════════════════════════════════════════════════════════════════════

// ── Program rows (every sent program + its log) ─────────────────────────────
var PROGRAM_ROWS = [];
var PROGRAM_LOAD = {};        // { athlete: { 'YYYY-MM-DD': { he, td, liftSets, tonnage } } }
var PROGRAM_LOAD_VER = 0;
var _progRowsLoading = null;

async function loadProgramRows() {
  if (_progRowsLoading) return _progRowsLoading;
  _progRowsLoading = (async function () {
    try {
      var db = getSupaClient();
      if (!db) { if ((loadProgramRows._tries = (loadProgramRows._tries || 0) + 1) < 10) setTimeout(loadProgramRows, 3000); return; }
      var res = await db.from('athlete_programs').select('id,athlete,name,pb_state,completion_log,completion_updated_at,updated_at,created_at');
      if (res.error) throw res.error;
      PROGRAM_ROWS = (res.data || []).map(function (r) {
        var pb = null; try { pb = typeof r.pb_state === 'string' ? JSON.parse(r.pb_state) : r.pb_state; } catch (e) {}
        return { id: String(r.id), athlete: r.athlete, name: r.name, pb: pb, log: r.completion_log || {}, logAt: r.completion_updated_at, updatedAt: r.updated_at };
      }).filter(function (r) { return r.pb && r.pb.weekData && r.pb.weekData.length && PLAYERS[r.athlete]; });
      buildProgramLoad();
      if (typeof _loadCache !== 'undefined') { _loadCache = {}; }
      if (typeof _strainThrCache !== 'undefined') { _strainThrCache = {}; }
      if (typeof buildPlayerList === 'function') buildPlayerList();
      if (typeof currentPage !== 'undefined' && currentPage === 'dashboard' && typeof renderDashboard === 'function') renderDashboard();
      if (typeof currentPage !== 'undefined' && currentPage === 'inbox') renderInbox();
      updateInboxBadge();
    } catch (e) { console.warn('[loadProgramRows]', e); }
    finally { _progRowsLoading = null; }
  })();
  return _progRowsLoading;
}

// Calendar date a logged day happened on: finished date, else scheduled date, else when sets were logged
function loggedDayDate(row, wi, di) {
  var d = row.log['day:' + wi + '-' + di];
  if (d && d.date) return d.date;
  var sched = TC.dayDate(row.pb, wi, di);
  if (sched) return TC.localISO(sched);
  var t = 0;
  Object.keys(row.log).forEach(function (k) { if (k.indexOf(wi + '-' + di + '-') === 0 && row.log[k] && row.log[k].done && row.log[k].t > t) t = row.log[k].t; });
  return t ? TC.localISO(new Date(t)) : null;
}
function loggedDays(row) {
  var seen = {};
  Object.keys(row.log || {}).forEach(function (k) {
    var m = k.match(/^(\d+)-(\d+)-\d+-\d+-\d+$/);
    if (m && row.log[k] && row.log[k].done) seen[m[1] + '-' + m[2]] = [+m[1], +m[2]];
  });
  return Object.keys(seen).map(function (k) { return seen[k]; });
}
function buildProgramLoad() {
  PROGRAM_LOAD = {};
  PROGRAM_ROWS.forEach(function (row) {
    loggedDays(row).forEach(function (wd) {
      var date = loggedDayDate(row, wd[0], wd[1]); if (!date) return;
      var l = TC.dayLoad(row.pb, row.log, wd[0], wd[1]);
      var a = PROGRAM_LOAD[row.athlete] = PROGRAM_LOAD[row.athlete] || {};
      var d = a[date] = a[date] || { he: 0, td: 0, liftSets: 0, tonnage: 0 };
      d.he += l.he; d.td += l.td; d.liftSets += l.liftSets; d.tonnage += l.tonnage;
    });
  });
  PROGRAM_LOAD_VER++;
}

// ── 3. Logged training feeds the load series ────────────────────────────────
// Days after an athlete's last game/Statcast day come from their program logs,
// so ACWR, strain and the status light keep working through the offseason
// without any toggle. In-season, game data wins on every day it covers.
var _basePlayerLoadSeries = playerLoadSeries;
var _progSeriesCache = {};
playerLoadSeries = function (name) {
  var base = _basePlayerLoadSeries(name);
  var prog = PROGRAM_LOAD[name];
  if (!prog) return base;
  var sig = base.sig + '#p' + PROGRAM_LOAD_VER;
  var c = _progSeriesCache[name];
  if (c && c.sig === sig) return c;
  var byDay = {}, first = base.first, last = base.last, added = 0, fromDay = null;
  Object.keys(base.byDay).forEach(function (k) { byDay[k] = { he: base.byDay[k].he, td: base.byDay[k].td }; });
  Object.keys(prog).forEach(function (iso) {
    var k = _dayKey(iso);
    if (isNaN(k) || (base.last !== null && k <= base.last)) return;
    var p = prog[iso]; if (!p.he && !p.td) return;
    byDay[k] = byDay[k] || { he: 0, td: 0 };
    byDay[k].he += p.he; byDay[k].td += p.td; added++;
    if (first === null || k < first) first = k;
    if (last === null || k > last) last = k;
    if (fromDay === null || k < fromDay) fromDay = k;
  });
  c = { byDay: byDay, first: first, last: last, sig: sig, programDays: added, programFrom: fromDay };
  _progSeriesCache[name] = c;
  return c;
};
// Workload tab: run stream from the full series (games + logged running), lift stream from logged sets
function wlAutoRunLogs(name) {
  var s = playerLoadSeries(name), out = [];
  Object.keys(s.byDay).forEach(function (k) { var td = s.byDay[k].td; if (td > 0) out.push({ date: isoDate(new Date(+k)), run: td }); });
  return out.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
}
function wlAutoLiftLogs(name) {
  var p = PROGRAM_LOAD[name] || {};
  return Object.keys(p).filter(function (d) { return p[d].liftSets > 0; }).map(function (d) { return { date: d, lift: p[d].liftSets, rpe: 6, auto: true }; });
}

// ── 2. Home equipment ───────────────────────────────────────────────────────
var EQUIP_KEY = 'cubs_sc_equipment_v1';
var EQUIP = {};
try { EQUIP = JSON.parse(localStorage.getItem(EQUIP_KEY) || '{}'); } catch (e) {}
function saveEquip() { try { localStorage.setItem(EQUIP_KEY, JSON.stringify(EQUIP)); } catch (e) {} if (typeof syncToSupabase === 'function') setTimeout(syncToSupabase, 1000); }
var EQUIP_LIST = [
  ['barbell', 'Barbell + rack'], ['trapbar', 'Trap bar'], ['safetybar', 'Safety squat bar'], ['db', 'Dumbbells'], ['kb', 'Kettlebells'],
  ['bench', 'Bench'], ['cable', 'Cable / functional trainer'], ['bands', 'Bands'], ['pullup', 'Pull-up bar'], ['landmine', 'Landmine'],
  ['machines', 'Machines (leg press, curls, pulldown…)'], ['ghd', 'GHD / glute-ham'], ['sled', 'Sled / Prowler'], ['medball', 'Med balls + wall'],
  ['box', 'Plyo box'], ['hurdles', 'Mini hurdles / wickets'], ['isokinetic', '1080 / Quantum / flywheel / K-pulley'], ['field', 'Field or turf (30+ yd)'],
  ['trx', 'Suspension trainer (TRX)'], ['erg', 'Bike / rower / ski erg / treadmill'], ['strongman', 'Strongman (yoke, tire, sandbag)']
];
// Where an athlete is training. "home" = his saved home equipment (or a typical home gym).
// Hotel presets can be edited in the Location & travel window and are saved.
var LOCATION_KEY = 'cubs_sc_locations_v1';
var LOCATION_DEFAULTS = {
  facility:   { label: 'Facility (full gym)', icon: '🏟', list: null },
  home:       { label: 'Home gym', icon: '🏠', list: ['barbell', 'db', 'kb', 'bench', 'bands', 'pullup', 'medball', 'box', 'field'] },
  hotel_gym:  { label: 'Hotel gym', icon: '🏨', list: ['db', 'bench', 'cable', 'machines', 'bands', 'erg'] },
  hotel_room: { label: 'Hotel room / bodyweight', icon: '🧳', list: ['bands'] }
};
var LOCATIONS = {};
try { LOCATIONS = JSON.parse(localStorage.getItem(LOCATION_KEY) || '{}') || {}; } catch (e) { LOCATIONS = {}; }
function saveLocations() { try { localStorage.setItem(LOCATION_KEY, JSON.stringify(LOCATIONS)); } catch (e) {} if (typeof syncToSupabase === 'function') setTimeout(syncToSupabase, 1000); }
function _freshJSON(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; } catch (e) { return fallback; } }
function locationInfo(id) { var d = LOCATION_DEFAULTS[id]; if (!d) return null; LOCATIONS = _freshJSON(LOCATION_KEY, LOCATIONS); var o = LOCATIONS[id]; return { id: id, label: d.label, icon: d.icon, list: (o && o.list) || d.list }; }
// Equipment list for a location + athlete. null = everything (no swaps).
function equipmentFor(location, athlete) {
  if (!location || location === 'auto') return athleteHas(athlete);
  if (location === 'facility') return null;
  if (location === 'home') return athleteHas(athlete) || locationInfo('home').list;
  var li = locationInfo(location);
  return li ? li.list.slice() : athleteHas(athlete);
}

// Coach-picked swaps are remembered per location and used first next time.
var SWAP_PREF_KEY = 'cubs_sc_swap_prefs_v1';
var SWAP_PREFS = {};
try { SWAP_PREFS = JSON.parse(localStorage.getItem(SWAP_PREF_KEY) || '{}') || {}; } catch (e) { SWAP_PREFS = {}; }
function saveSwapPref(from, to, envKey) {
  if (!from || !to || from === to) return;
  SWAP_PREFS = _freshJSON(SWAP_PREF_KEY, SWAP_PREFS);
  var k = String(from).toLowerCase();
  SWAP_PREFS[k] = SWAP_PREFS[k] || {};
  SWAP_PREFS[k][envKey || 'any'] = to;
  SWAP_PREFS[k].any = to;
  try { localStorage.setItem(SWAP_PREF_KEY, JSON.stringify(SWAP_PREFS)); } catch (e) {}
  if (typeof syncToSupabase === 'function') setTimeout(syncToSupabase, 1000);
}

function _libEntry(name) {
  var n = String(name || '').toLowerCase();
  return (typeof EXERCISE_DB !== 'undefined' ? EXERCISE_DB : []).find(function (e) { return e && e.name && e.name.toLowerCase() === n; });
}
// What an exercise needs. A library entry's own `equip` list (if set) wins over
// what's read from the name.
function exEquipment(name) {
  var lib = _libEntry(name);
  if (lib && Array.isArray(lib.equip)) return lib.equip.slice();
  var n = String(name || '').toLowerCase().replace(/\(video\)/g, ''), need = {};
  function add(id) { need[id] = 1; }
  if (/1080|quantum|isokinetic|exxentric|kbox|k-?pulley|flywheel|vertimax/.test(n)) add('isokinetic');
  if (/trap bar|hex bar/.test(n)) add('trapbar');
  if (/safety bar|\bssb\b|\bss bb\b|safety squat/.test(n)) add('safetybar');
  if (/\bdb\b|dumbbell/.test(n)) add('db');
  if (/\bkb\b|kettlebell/.test(n)) add('kb');
  if (/goblet|farmer|suitcase carry|waiter|renegade/.test(n) && !need.db && !need.kb && !need.trapbar) add('db|kb');   // either works
  if (/cable|pulldown|pull-down|functional trainer|lat pull/.test(n)) add('cable');
  else if (/pallof|face pull/.test(n) && !/band/.test(n)) add('cable|bands');          // either works
  if (/\bband|mini-?band|banded/.test(n)) add('bands');
  if (/sled|prowler/.test(n)) add('sled');
  if (/resisted|harness/.test(n) && !need.sled && !need.isokinetic && !need.bands) add('bands|sled');
  if (/\bmb\b|med ball|medicine ball|\bslam\b|wall ball|chest pass|scoop toss|side toss|shot put/.test(n)) add('medball');
  if (/\bbox\b/.test(n) && !/box squat/.test(n)) add('box');
  if (/step[- ]?up|bulgarian|rfess|rear foot elevated|elevated split|seated .*press|incline|chest supported|pullover|hip thrust|copenhagen(?!.*floor)/.test(n) && !need.box && !need.machines) add('bench|box');
  if (/hurdle|wicket/.test(n)) add('hurdles');
  if (/landmine/.test(n)) add('landmine');
  if (/leg press|hack squat|belt squat|leg extension|leg curl|hamstring curl|machine|4-way hip|reverse hyper|pendulum|smith|pec deck|\bfixed\b/.test(n)) add('machines');
  if (/\bghr\b|glute[- ]ham|\bghd\b/.test(n)) add('ghd');
  if (/pull[- ]?up|chin[- ]?up|hanging|dead hang/.test(n)) add('pullup');
  if (/\btrx\b|suspension|ring row|ring dip/.test(n)) add('trx');
  if (/assault|air bike|airdyne|bike\b|erg\b|ergometer|rower|\brow erg|ski erg|treadmill|echo bike/.test(n)) add('erg');
  if (/yoke|tire flip|sandbag|\blog\b|atlas stone|keg/.test(n)) add('strongman');
  if (/bench press|\bbench\b/.test(n) && !need.machines) add('bench');
  var bbLift = /\bbb\b|barbell|back squat|front squat|box squat|zercher|good morning|hip thrust|push press|military press|\bjerk\b|\bclean\b|snatch|bench press|\bbo row\b|pendlay|high pull|plate pinch|squat 1 1\/4|overhead squat/.test(n)
    || (/deadlift|\brdl\b/.test(n) && !need.db && !need.kb && !need.trapbar && !need['db|kb'] && !/single leg|\bsl\b|b-stance|kickstand/.test(n));
  if (bbLift && !need.trapbar && !need.safetybar && !need.db && !need.kb && !need['db|kb'] && !need.landmine && !need.machines && !/band/.test(n)) add('barbell');
  if (/cuban press|arnold|hammer curl|renegade/.test(n) && !Object.keys(need).length) add('db|kb');
  if (/hammer row|chest supported row/.test(n) && !need.db && !need.machines) add('machines|db');
  if (/pizza|plate\b|plates\b/.test(n) && !need.db && !need.kb) add('barbell');
  if (/plyo ?ball/.test(n)) add('medball');
  if (/depth jump|depth drop|drop jump|box drop/.test(n) && !need.box) add('box|bench');
  if (/back extension|hyperextension|45° back|45 degree back|reverse hyper/.test(n) && !/floor|prone/.test(n) && !need.machines) add('ghd|machines');
  if (/throw|toss|chest pass/.test(n) && !Object.keys(need).length) add('medball');
  if (/\bpress\b/.test(n) && !Object.keys(need).length && !/push[- ]?up|pallof|\biso\b|overcoming|wall|band|plank|pike|leg press/.test(n)) add('db|kb|barbell');
  // Running needs space: a sprint, start or bound with no other gear needs a field
  var others = Object.keys(need).filter(function (k) { return !/^(hurdles|bands|bands\|sled|medball)$/.test(k); });   // bands don't replace running space
  if (!others.length && /sprint|accel|flying|\bfly\b(?! ?e)|max v|curve|curvilinear|tempo run|\brun\b|running|shuttle|5-10-5|pro agility|wicket|build[- ]?up|\b\d+\s?yd\b|start\b|starts\b|bound|triple jump|approach jump|broad jumps? \(cont/.test(n)
      && !/cable|seated|incline|chest|rear|reverse fly|db|dumbbell|band fly|\bwall\b|hip flexion|\biso\b|in place/.test(n)) add('field');
  // Bench press is a barbell + bench lift; DB bench still needs the bench
  if (need.db && /bench|incline|press.*flat|flat.*press/.test(n)) add('bench');
  return Object.keys(need);
}
function hasAll(need, have) { return need.every(function (id) { return id.split('|').some(function (x) { return have.indexOf(x) >= 0; }); }); }
function athleteHas(athlete) { EQUIP = _freshJSON(EQUIP_KEY, EQUIP); var p = EQUIP[athlete]; return p && p.list && p.list.length ? p.list : null; }
var CAT_RELATED = {
  'Deadlift Variations': ['Hamstring', 'Deadlift Variation'], 'Hamstring': ['Deadlift Variations'],
  'UB Vertical Push': ['UB Vertical Press'], 'UB Vertical Press': ['UB Vertical Push'],
  'Olympic Variations': ['LB Plyos'], 'Strongman Variations': ['Core Anti-Lateral Flexion', 'Grip'],
  'Acceleration': ['LB Plyos', 'Performance Prep'], 'Max Velocity': ['LB Plyos', 'Performance Prep', 'Acceleration']
};
var SUB_FAMILIES = [/squat/, /deadlift|\brdl\b|hinge|swing|good morning|pull[- ]?through|hip hinge|back extension|hyper/, /bench press|floor press|db press|push[- ]?up|chest press|\bdip|flat.*press|incline.*press|\bsa press|horizontal press/, /overhead|military|push press|jerk|arnold|landmine press|\bohp\b|vertical press|z press/,
  /\brow\b|rows\b/, /pull[- ]?up|chin|pulldown|lat pull/, /lunge|split|step[- ]?up|skater|rfess|bulgarian/, /carry|farmer|suitcase|yoke|waiter/, /jump|hop|bound|pogo|leap/, /throw|slam|toss|chest pass|shot put/,
  /curl(?!.*(leg|hamstring|nordic))/, /raise|fly\b|flye/, /thrust|glute bridge|hip bridge/, /plank|pallof|chop|anti-rotation|dead bug|rollout|hollow/, /sprint|accel|sled|prowler|march|resisted|start\b|starts\b/,
  /nordic|leg curl|hamstring curl|\bghr\b|glute[- ]ham|slider curl/, /external rotation|internal rotation|\ber\b|\bir\b|y-t-w|ytw|face pull|scap|serratus/, /lateral squat|cossack|adductor|copenhagen|groin/, /rotation|rotational|torso/,
  /bike|erg|rower|treadmill|run\b|tempo/];
// When the athlete can't do any version of the movement, these families stand in (best → worst)
var FAMILY_FALLBACK = { 14: [8, 19], 15: [1], 4: [], 5: [4], 7: [13], 9: [8, 18], 19: [14, 8], 0: [6], 6: [0], 12: [1, 15], 1: [15, 12], 17: [6, 0] };
function subFamilies(n) { n = String(n).toLowerCase(); var out = []; SUB_FAMILIES.forEach(function (re, i) { if (re.test(n)) out.push(i); }); return out; }
var _PLYO_WORDS = /jump|hop|bound|throw|slam|toss|pogo|skip|sprint|swing/i;
var _EQUIP_WORDS = /^(db|bb|kb|dumbbell|barbell|kettlebell|cable|band|bands|banded|isokinetic|1080|quantum|landmine|sled|prowler|machine|trap|hex|bar|safety|ssb|mb|med|ball|hurdle|hurdles|box|trx|smith|video|w|with|the|and|of|to|on|ea|x|sa|sl)$/;
function _tokens(n) { return String(n || '').toLowerCase().replace(/\(video\)/g, '').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(function (t) { return t && t.length > 1 && !_EQUIP_WORDS.test(t); }).map(function (t) { return t.length > 3 ? t.replace(/(es|s)$/, '') : t; }); }
var _UNI = /\bsl\b|\bsa\b|single[- ]leg|single[- ]arm|split|lunge|step|skater|pistol|lateral|crossover|cossack|45 degree|\bea\b|kickstand|b-stance|offset/;
// Best library exercise the athlete can do instead of ex. Order: the swap you
// picked before → same movement in the same/related category → a stand-in family.
function findSubstitute(ex, have, opts) {
  opts = opts || {};
  var db = _libEntry(ex.name);
  var nm = String(ex.name).toLowerCase();
  var exclude = opts.exclude || {};
  // 1. Remembered coach pick
  SWAP_PREFS = _freshJSON(SWAP_PREF_KEY, SWAP_PREFS);
  var pref = SWAP_PREFS[nm];
  if (pref && !opts.collect) {
    var pk = pref[opts.envKey || 'any'] || pref.any, pe = pk && _libEntry(pk);
    if (pe && hasAll(exEquipment(pe.name), have)) return pe;
  }
  var fam = subFamilies(nm);
  var cat = (db && db.cat) || ex.cat;
  if (!cat && fam.length) {   // not in the library: borrow the category of the closest-named library exercise
    var votes = {};
    EXERCISE_DB.forEach(function (e) { if (e && e.cat && subFamilies(e.name).some(function (f) { return fam.indexOf(f) >= 0; })) votes[e.cat] = (votes[e.cat] || 0) + 1; });
    cat = Object.keys(votes).sort(function (a, b) { return votes[b] - votes[a]; })[0];
  }
  var toks = _tokens(nm);
  var loaded = TC.pctOf(ex) !== null || !!(db && db.liftKey);
  var origPlyo = _PLYO_WORDS.test(nm), origUni = _UNI.test(nm);
  var usage = (typeof CS !== 'undefined' && CS.usage) ? CS.usage() : {};
  function score(c, families, catList, strictFam) {
    if (!c || !c.name || c.name === ex.name || exclude[c.name.toLowerCase()]) return null;
    if (catList && catList.indexOf(c.cat) < 0) return null;
    var need = exEquipment(c.name);
    if (!hasAll(need, have)) return null;
    var cf = subFamilies(c.name);
    var famHit = families.length ? cf.some(function (f) { return families.indexOf(f) >= 0; }) : false;
    if (strictFam && families.length && !famHit) return null;
    var sc = 0;
    if (c.cat === cat) sc += 3; else if (cat && (CAT_RELATED[cat] || []).indexOf(c.cat) >= 0) sc += 1.5;
    sc -= 0.5 * need.length;                               // the simplest version that works
    if (famHit) sc += 4;
    if (db && db.liftKey && c.liftKey === db.liftKey) sc += 5;
    if (db && db.bucket && c.bucket === db.bucket) sc += 3;
    if (db && db.muscle_group && c.muscle_group === db.muscle_group) sc += 2;
    if (loaded && c.liftKey) sc += 3;                      // keep it loadable so % → lbs still works
    if (loaded && need.some(function (id) { return /^(db|kb|db\|kb|trapbar|safetybar|landmine|barbell|machines|cable)$/.test(id); })) sc += 2;
    if (!origPlyo && _PLYO_WORDS.test(c.name)) sc -= 8;    // never turn a strength lift into a jump
    if (origPlyo && !_PLYO_WORDS.test(c.name)) sc -= 4;
    var ct = _tokens(c.name);
    toks.forEach(function (w) { if (ct.indexOf(w) >= 0) sc += 2.5; });
    if (ct.length > toks.length + 3) sc -= 1;              // prefer simple names over long variants
    if (origUni === _UNI.test(c.name.toLowerCase())) sc += 3;
    if (usage[c.name]) sc += Math.min(4, Math.log(1 + usage[c.name]) * 1.5);   // exercises you actually program
    if (c.video) sc += 0.5;
    return sc;
  }
  function pick(families, catList, strictFam, floor) {
    var best = null, bestScore = -1e9;
    EXERCISE_DB.forEach(function (c) {
      var sc = score(c, families, catList, strictFam);
      if (sc === null) return;
      if (opts.collect) opts.collect.push({ ex: c, sc: sc });
      if (sc > bestScore || (sc === bestScore && best && c.name < best.name)) { best = c; bestScore = sc; }
    });
    return best && bestScore > floor ? best : null;
  }
  var cats = cat ? [cat].concat(CAT_RELATED[cat] || []) : null;
  // 2. Same movement (category match scores higher, so it wins unless the words say otherwise)
  var r = fam.length ? pick(fam, null, true, -3) : null;
  // 3. No movement family (e.g. "Isokinetic SA Press"): same category, must share a real word
  if (!r && cats && !fam.length) r = pick([], cats, false, toks.length ? 2 : -3);
  // 5. Stand-in family (no field → plyos / erg, no sled → sprint, no GHD → hinge…)
  if (opts.collect) {                                      // list mode: keep going to gather alternatives
    if (!opts.collect.length && cats) pick([], cats, false, -99);
    var fb0 = []; fam.forEach(function (f) { (FAMILY_FALLBACK[f] || []).forEach(function (x) { if (fb0.indexOf(x) < 0) fb0.push(x); }); });
    if (opts.collect.length < 6 && fb0.length) pick(fb0, null, true, -99);
  }
  if (!r) {
    var fb = [];
    fam.forEach(function (f) { (FAMILY_FALLBACK[f] || []).forEach(function (x) { if (fb.indexOf(x) < 0) fb.push(x); }); });
    if (fb.length) { origPlyo = true; r = pick(fb, null, true, -6); }
  }
  return r;
}
// Ranked alternatives for the swap picker (best first, no repeats)
function substituteOptions(ex, have, n, opts) {
  var col = [], seen = {};
  var best = findSubstitute(ex, have, opts || {});           // remembered pick (if any) comes first
  findSubstitute(ex, have, Object.assign({}, opts || {}, { collect: col }));
  col.sort(function (a, b) { return b.sc - a.sc; });
  var out = [];
  if (best) { out.push(best); seen[best.name] = 1; }
  col.forEach(function (c) { if (out.length < (n || 8) && !seen[c.ex.name]) { seen[c.ex.name] = 1; out.push(c.ex); } });
  return out;
}
// "% of 1RM" means nothing on a lift with no 1RM — show effort instead
function pctToRPE(load) {
  var m = String(load || '').match(/(\d+(?:\.\d+)?)\s*%/); if (!m) return load;
  var p = parseFloat(m[1]);
  return p >= 88 ? 'RPE 9' : p >= 80 ? 'RPE 8' : p >= 70 ? 'RPE 7' : 'RPE 6';
}
// Swap every exercise in st (a pbState copy or the builder's state) that the
// equipment can't support. location: per-week wk.location / day.location win
// over the default. Returns { swaps:[{wi,di,from,to,reason}], missing:{name:needs} }.
function applyEquipmentSwaps(st, player, defaultLocation, onlyWeeks) {
  var swaps = [], missing = {};
  (st.weekData || []).forEach(function (wk, wi) {
    if (onlyWeeks && onlyWeeks.indexOf(wi) < 0) return;
    (wk.days || []).forEach(function (day, di) {
      var loc = day.location || wk.location || defaultLocation || 'auto';
      var have = equipmentFor(loc, player);
      if (!have) return;
      var inDay = {};
      (day.blocks || []).forEach(function (b) { (b.exercises || []).forEach(function (x) { if (x && x.name) inDay[x.name.toLowerCase()] = 1; }); });
      (day.blocks || []).forEach(function (block) {
        (block.exercises || []).forEach(function (ex) {
          if (!ex || !ex.name) return;
          var need = exEquipment(ex.name);
          var lacking = need.filter(function (id) { return !hasAll([id], have); });
          if (!lacking.length) return;
          var sub = findSubstitute(ex, have, { envKey: loc === 'auto' ? 'home' : loc, exclude: inDay });
          if (sub) {
            swaps.push({ wi: wi, di: di, from: ex.name, to: sub.name, loc: loc });
            inDay[sub.name.toLowerCase()] = 1;
            if (!ex.swappedFrom) ex.swappedFrom = ex.name;
            ex.swapLoc = loc;
            ex.name = sub.name; ex.cat = sub.cat || ex.cat;
            ex.video = sub.video || ''; ex.liftKey = sub.liftKey || '';
            delete ex.calcWeight; delete ex.calcWeightSource;
          } else missing[ex.name] = lacking.map(function (id) { return id.split('|').map(function (one) { return (EQUIP_LIST.find(function (x) { return x[0] === one; }) || [one, one])[1]; }).join(' or '); }).join(', ');
        });
      });
    });
  });
  return { swaps: swaps, missing: missing };
}
function openEquipmentModal(athlete) {
  athlete = athlete || (typeof currentPlayer !== 'undefined' ? currentPlayer : Object.keys(PLAYERS)[0]);
  var m = document.createElement('div');
  m.id = 'equip-modal';
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;';
  function body() {
    var have = (EQUIP[athlete] && EQUIP[athlete].list) || [];
    var set = EQUIP[athlete] && EQUIP[athlete].list;
    return '<div style="background:#1a1f2e;border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:20px;width:560px;max-width:100%;max-height:90vh;overflow-y:auto;">'
      + '<div style="font-size:17px;font-weight:700;color:#fff;">🏠 Home equipment</div>'
      + '<div style="font-size:12px;color:var(--text3);margin:4px 0 14px;line-height:1.5;">When you send a program, anything this athlete can\'t do with what he has is swapped for the closest exercise in the same category. Leave everyone unset to send programs exactly as written.</div>'
      + '<select id="eq-ath" style="width:100%;background:#0d1117;border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:8px 10px;color:#fff;font-size:13px;margin-bottom:12px;">'
      + Object.keys(PLAYERS).map(function (n) { var has = athleteHas(n); return '<option value="' + escHtml(n) + '"' + (n === athlete ? ' selected' : '') + '>' + escHtml(n) + (has ? ' · ' + has.length + ' items' : ' · not set (full facility)') + '</option>'; }).join('')
      + '</select>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">' + EQUIP_LIST.map(function (it) {
          return '<label style="display:flex;gap:8px;align-items:center;font-size:12px;color:#e2e8f0;padding:6px 8px;border-radius:6px;background:rgba(255,255,255,.03);cursor:pointer;"><input type="checkbox" class="eq-it" value="' + it[0] + '"' + (have.indexOf(it[0]) >= 0 ? ' checked' : '') + ' style="accent-color:#6366f1;">' + escHtml(it[1]) + '</label>';
        }).join('') + '</div>'
      + '<input id="eq-note" value="' + escHtml((EQUIP[athlete] && EQUIP[athlete].note) || '') + '" placeholder="Notes (e.g. DBs to 75 lb, no rack on weekends)" style="width:100%;margin-top:10px;background:#0d1117;border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:8px 10px;color:#fff;font-size:12px;box-sizing:border-box;">'
      + '<div style="display:flex;gap:8px;justify-content:space-between;margin-top:16px;flex-wrap:wrap;">'
      + '<div style="display:flex;gap:6px;"><button id="eq-all" style="padding:7px 10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:6px;color:#cbd5e1;font-size:11px;cursor:pointer;">Full facility (clear)</button>'
      + '<button id="eq-home" style="padding:7px 10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:6px;color:#cbd5e1;font-size:11px;cursor:pointer;">Typical home gym</button></div>'
      + '<div style="display:flex;gap:6px;"><button id="eq-close" style="padding:8px 14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:6px;color:#94a3b8;font-size:12px;cursor:pointer;">Close</button>'
      + '<button id="eq-save" style="padding:8px 16px;background:#6366f1;border:none;border-radius:6px;color:#fff;font-size:12px;font-weight:700;cursor:pointer;">Save</button></div></div></div>';
  }
  function wire() {
    m.querySelector('#eq-ath').onchange = function () { athlete = this.value; m.innerHTML = body(); wire(); };
    m.querySelector('#eq-close').onclick = function () { m.remove(); };
    m.querySelector('#eq-all').onclick = function () { m.querySelectorAll('.eq-it').forEach(function (c) { c.checked = false; }); };
    m.querySelector('#eq-home').onclick = function () { var h = ['barbell', 'db', 'kb', 'bench', 'bands', 'pullup', 'medball', 'box', 'field']; m.querySelectorAll('.eq-it').forEach(function (c) { c.checked = h.indexOf(c.value) >= 0; }); };
    m.querySelector('#eq-save').onclick = function () {
      var list = Array.prototype.map.call(m.querySelectorAll('.eq-it:checked'), function (c) { return c.value; });
      var note = m.querySelector('#eq-note').value.trim();
      if (list.length) EQUIP[athlete] = { list: list, note: note, updated: new Date().toISOString() }; else delete EQUIP[athlete];
      saveEquip();
      m.querySelector('#eq-save').textContent = 'Saved ✓';
      setTimeout(function () { m.innerHTML = body(); wire(); }, 600);
    };
  }
  m.innerHTML = body(); document.body.appendChild(m); wire();
  m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
}

// ── 2b. Location & travel (Program Builder) ─────────────────────────────────
// Re-fits the builder's program to where the athlete will train — hotel gym,
// hotel room, home — for any weeks/days. Shows every swap with alternatives
// before applying; your picks are remembered for next time. Days keep their
// location, so sending (and live edits) won't swap them again.
var _LOC_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
function _clone(o) { return JSON.parse(JSON.stringify(o)); }
function _locBtnCss(on) { return 'padding:7px 10px;border-radius:6px;cursor:pointer;font-size:12px;border:1px solid ' + (on ? 'rgba(99,102,241,.6)' : 'rgba(255,255,255,.1)') + ';background:' + (on ? 'rgba(99,102,241,.2)' : 'rgba(255,255,255,.04)') + ';color:' + (on ? '#c7d2fe' : '#cbd5e1') + ';'; }
function openLocationModal() {
  if (typeof PB_STATE === 'undefined' || !PB_STATE.weekData || !PB_STATE.weekData.length) { alert('Build a program first'); return; }
  var athlete = PB_STATE.athlete && PB_STATE.athlete !== '(Sandbox)' ? PB_STATE.athlete : '';
  var activeWk = (typeof PB_ACTIVE_DAY !== 'undefined' && PB_ACTIVE_DAY) ? PB_ACTIVE_DAY.weekIdx : (PB_STATE.activeWeek || 0);
  var S = { loc: 'hotel_gym', list: null, weeks: [activeWk], days: _LOC_DAYS.slice(), preview: null, picks: {}, saveDefault: false };
  function curList() { if (S.list) return S.list; var l = equipmentFor(S.loc, athlete); return l ? l.slice() : EQUIP_LIST.map(function (x) { return x[0]; }); }
  var m = document.createElement('div');
  m.id = 'loc-modal';
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;';
  function body() {
    var list = curList();
    var locs = ['facility', 'home', 'hotel_gym', 'hotel_room'];
    var h = '<div style="background:#1a1f2e;border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:20px;width:640px;max-width:100%;max-height:92vh;overflow-y:auto;">'
      + '<div style="font-size:17px;font-weight:700;color:#fff;">🧳 Location &amp; travel</div>'
      + '<div style="font-size:12px;color:var(--text3);margin:4px 0 14px;line-height:1.5;">Fit the program to where ' + (athlete ? escHtml(athlete) : 'the athlete') + ' will train. Every exercise the equipment can\'t support is swapped for the closest one in your library — pick a different one if you want, and it\'ll be used next time too.</div>'
      + '<div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Where</div>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">' + locs.map(function (id) { var li = locationInfo(id); return '<button class="loc-pick" data-loc="' + id + '" style="' + _locBtnCss(S.loc === id) + '">' + li.icon + ' ' + li.label + '</button>'; }).join('') + '</div>';
    if (S.loc !== 'facility') {
      h += '<div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Equipment there' + (S.loc === 'home' && athleteHas(athlete) ? ' (his saved home equipment)' : '') + '</div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-bottom:6px;">' + EQUIP_LIST.map(function (it) {
            return '<label style="display:flex;gap:6px;align-items:center;font-size:11px;color:#e2e8f0;padding:4px 6px;border-radius:5px;background:rgba(255,255,255,.03);cursor:pointer;"><input type="checkbox" class="loc-eq" value="' + it[0] + '"' + (list.indexOf(it[0]) >= 0 ? ' checked' : '') + '> ' + escHtml(it[1]) + '</label>';
          }).join('') + '</div>'
        + '<label style="display:flex;gap:6px;align-items:center;font-size:11px;color:var(--text3);margin-bottom:12px;cursor:pointer;"><input type="checkbox" id="loc-save-def"' + (S.saveDefault ? ' checked' : '') + '> Save this as my default for "' + escHtml(locationInfo(S.loc).label) + '"' + (S.loc === 'home' && athlete ? ' (his home equipment)' : '') + '</label>';
    }
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">'
      + '<div><div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Weeks</div><div style="display:flex;gap:4px;flex-wrap:wrap;">'
      + PB_STATE.weekData.map(function (wk, wi) { var on = S.weeks.indexOf(wi) >= 0; return '<button class="loc-wk" data-wi="' + wi + '" style="' + _locBtnCss(on) + 'padding:5px 9px;">W' + wk.week + (wk.location && wk.location !== 'facility' ? ' ' + (locationInfo(wk.location) || {}).icon : '') + '</button>'; }).join('')
      + '<button class="loc-wk-all" style="' + _locBtnCss(false) + 'padding:5px 9px;">All</button></div></div>'
      + '<div><div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Days</div><div style="display:flex;gap:4px;flex-wrap:wrap;">'
      + _LOC_DAYS.map(function (d) { var on = S.days.indexOf(d) >= 0; return '<button class="loc-day" data-d="' + d + '" style="' + _locBtnCss(on) + 'padding:5px 8px;">' + d + '</button>'; }).join('')
      + '</div></div></div>';
    if (S.preview) {
      var P = S.preview;
      h += '<div style="border-top:1px solid rgba(255,255,255,.08);padding-top:12px;margin-top:4px;">'
        + '<div style="font-size:12px;color:#fff;font-weight:700;margin-bottom:8px;">' + (P.rows.length ? P.rows.length + ' swap' + (P.rows.length === 1 ? '' : 's') : 'No swaps needed — everything works with this equipment') + '</div>';
      P.rows.forEach(function (r, i) {
        h += '<div style="display:flex;gap:8px;align-items:center;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px;">'
          + '<span style="width:70px;color:var(--text3);font-size:10px;">' + escHtml(r.where) + '</span>'
          + '<span style="flex:1;color:#e2e8f0;">' + escHtml(r.from) + '</span><span style="color:var(--text3);">→</span>'
          + '<select class="loc-sub" data-i="' + i + '" style="flex:1.2;background:#0d1117;border:1px solid rgba(255,255,255,.1);border-radius:5px;padding:4px 6px;color:#fff;font-size:11px;">'
          + r.options.map(function (o) { return '<option value="' + escHtml(o) + '"' + (o === r.to ? ' selected' : '') + '>' + escHtml(o) + '</option>'; }).join('')
          + '<option value="">— keep as written —</option></select></div>';
      });
      Object.keys(P.missing).forEach(function (n) { h += '<div style="font-size:11px;color:#fbbf24;padding:3px 0;">⚠ ' + escHtml(n) + ' needs ' + escHtml(P.missing[n]) + ' — nothing in your library fits, left as written</div>'; });
      h += '</div>';
    }
    var swappedCount = 0;
    S.weeks.forEach(function (wi) { (PB_STATE.weekData[wi].days || []).forEach(function (d) { if (S.days.indexOf(d.day) < 0) return; (d.blocks || []).forEach(function (b) { (b.exercises || []).forEach(function (x) { if (x && x.swappedFrom && x.swapLoc) swappedCount++; }); }); }); });
    h += '<div style="display:flex;gap:8px;justify-content:space-between;margin-top:16px;flex-wrap:wrap;">'
      + '<button id="loc-restore" style="padding:8px 12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:6px;color:' + (swappedCount ? '#fbbf24' : '#475569') + ';font-size:12px;cursor:pointer;"' + (swappedCount ? '' : ' disabled') + '>↺ Restore originals' + (swappedCount ? ' (' + swappedCount + ')' : '') + '</button>'
      + '<div style="display:flex;gap:6px;"><button id="loc-close" style="padding:8px 14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:6px;color:#94a3b8;font-size:12px;cursor:pointer;">Close</button>'
      + (S.preview ? '<button id="loc-apply" style="padding:8px 16px;background:#6366f1;border:none;border-radius:6px;color:#fff;font-size:12px;font-weight:700;cursor:pointer;">Apply to program</button>'
                   : '<button id="loc-preview" style="padding:8px 16px;background:#6366f1;border:none;border-radius:6px;color:#fff;font-size:12px;font-weight:700;cursor:pointer;">Preview swaps</button>')
      + '</div></div></div>';
    return h;
  }
  function readEq() { var boxes = m.querySelectorAll('.loc-eq'); if (boxes.length) S.list = Array.prototype.filter.call(boxes, function (c) { return c.checked; }).map(function (c) { return c.value; }); var sd = m.querySelector('#loc-save-def'); if (sd) S.saveDefault = sd.checked; }
  function redraw() { m.innerHTML = body(); wire(); }
  function buildPreview() {
    readEq();
    var have = S.loc === 'facility' ? null : curList();
    var rows = [], missing = {};
    if (have) {
      S.weeks.forEach(function (wi) {
        var wk = PB_STATE.weekData[wi];
        (wk.days || []).forEach(function (day, di) {
          if (S.days.indexOf(day.day) < 0) return;
          var inDay = {};
          (day.blocks || []).forEach(function (b) { (b.exercises || []).forEach(function (x) { if (x && x.name) inDay[x.name.toLowerCase()] = 1; }); });
          (day.blocks || []).forEach(function (b, bi) {
            (b.exercises || []).forEach(function (ex, ei) {
              if (!ex || !ex.name) return;
              var need = exEquipment(ex.name);
              if (hasAll(need, have)) return;
              var opts = substituteOptions(ex, have, 8, { envKey: S.loc, exclude: inDay });
              if (!opts.length) { missing[ex.name] = need.filter(function (id) { return !hasAll([id], have); }).map(function (id) { return id.split('|').map(function (one) { return (EQUIP_LIST.find(function (x) { return x[0] === one; }) || [one, one])[1]; }).join(' or '); }).join(', '); return; }
              var to = opts[0].name;
              inDay[to.toLowerCase()] = 1;
              rows.push({ wi: wi, di: di, bi: bi, ei: ei, where: 'W' + wk.week + ' ' + day.day, from: ex.name, to: to, auto: to, options: opts.map(function (o) { return o.name; }) });
            });
          });
        });
      });
    }
    S.preview = { rows: rows, missing: missing, have: have };
  }
  function wire() {
    m.querySelectorAll('.loc-pick').forEach(function (b) { b.onclick = function () { S.loc = b.dataset.loc; S.list = null; S.preview = null; S.saveDefault = false; redraw(); }; });
    m.querySelectorAll('.loc-wk').forEach(function (b) { b.onclick = function () { readEq(); var wi = +b.dataset.wi, k = S.weeks.indexOf(wi); if (k >= 0) S.weeks.splice(k, 1); else S.weeks.push(wi); S.preview = null; redraw(); }; });
    var all = m.querySelector('.loc-wk-all'); if (all) all.onclick = function () { readEq(); S.weeks = PB_STATE.weekData.map(function (w, i) { return i; }); S.preview = null; redraw(); };
    m.querySelectorAll('.loc-day').forEach(function (b) { b.onclick = function () { readEq(); var d = b.dataset.d, k = S.days.indexOf(d); if (k >= 0) S.days.splice(k, 1); else S.days.push(d); S.preview = null; redraw(); }; });
    m.querySelectorAll('.loc-eq').forEach(function (c) { c.onchange = function () { readEq(); S.preview = null; redraw(); }; });
    m.querySelectorAll('.loc-sub').forEach(function (sel) { sel.onchange = function () { S.preview.rows[+sel.dataset.i].to = sel.value; }; });
    m.querySelector('#loc-close').onclick = function () { m.remove(); };
    var pv = m.querySelector('#loc-preview'); if (pv) pv.onclick = function () { if (!S.weeks.length || !S.days.length) { alert('Pick at least one week and day'); return; } buildPreview(); redraw(); };
    var ap = m.querySelector('#loc-apply'); if (ap) ap.onclick = applyIt;
    var rs = m.querySelector('#loc-restore'); if (rs) rs.onclick = restoreIt;
  }
  function applyIt() {
    readEq();
    var P = S.preview; if (!P) return;
    if (S.saveDefault && S.loc !== 'facility') {
      if (S.loc === 'home' && athlete) { EQUIP[athlete] = Object.assign({}, EQUIP[athlete] || {}, { list: curList(), updated: new Date().toISOString() }); saveEquip(); }
      else { LOCATIONS = _freshJSON(LOCATION_KEY, LOCATIONS); LOCATIONS[S.loc] = { list: curList() }; saveLocations(); }
    }
    var n = 0;
    P.rows.forEach(function (r) {
      if (!r.to) return;
      var ex = PB_STATE.weekData[r.wi].days[r.di].blocks[r.bi].exercises[r.ei];
      if (!ex || ex.name !== r.from) return;
      var sub = _libEntry(r.to); if (!sub) return;
      if (r.to !== r.auto) saveSwapPref(r.from, r.to, S.loc);   // learn your pick
      if (!ex.swappedFrom) { ex.swappedFrom = ex.name; ex.swapOrig = _clone(ex); }
      ex.swapLoc = S.loc; ex.name = sub.name; ex.cat = sub.cat || ex.cat; ex.video = sub.video || ''; ex.liftKey = sub.liftKey || '';
      if (!sub.liftKey && /%/.test(String(ex.load || '')) && !(typeof resolve1RM === 'function' && athlete && resolve1RM(athlete, sub.name))) { ex.loadPct = ex.load; ex.load = pctToRPE(ex.load); }
      delete ex.calcWeight; delete ex.calcWeightSource;
      n++;
    });
    // Remember where each day is trained so sending doesn't swap again
    S.weeks.forEach(function (wi) {
      var wk = PB_STATE.weekData[wi];
      var allDays = _LOC_DAYS.every(function (d) { return S.days.indexOf(d) >= 0; });
      (wk.days || []).forEach(function (day) { if (S.days.indexOf(day.day) >= 0) { if (allDays) delete day.location; else day.location = S.loc; } });
      if (allDays) wk.location = S.loc;
    });
    if (typeof pbRenderDayGrid === 'function') pbRenderDayGrid();
    if (typeof PB_ACTIVE_DAY !== 'undefined' && PB_ACTIVE_DAY && typeof pbOpenDay === 'function') pbOpenDay(PB_ACTIVE_DAY.weekIdx, PB_ACTIVE_DAY.dayIdx);
    if (typeof showStatus === 'function') showStatus('🧳 ' + locationInfo(S.loc).label + ': ' + n + ' exercise' + (n === 1 ? '' : 's') + ' swapped');
    m.remove();
  }
  function restoreIt() {
    var n = 0;
    S.weeks.forEach(function (wi) {
      var wk = PB_STATE.weekData[wi];
      (wk.days || []).forEach(function (day) {
        if (S.days.indexOf(day.day) < 0) return;
        (day.blocks || []).forEach(function (b) {
          (b.exercises || []).forEach(function (ex, ei) {
            if (!ex || !ex.swappedFrom || !ex.swapLoc) return;
            var orig = ex.swapOrig;
            if (orig) { var keep = { sets: ex.sets, reps: ex.reps, rest: ex.rest, tempo: ex.tempo, notes: ex.notes, uid: ex.uid }; b.exercises[ei] = Object.assign(orig, keep); delete b.exercises[ei].swapOrig; delete b.exercises[ei].swappedFrom; delete b.exercises[ei].swapLoc; }
            else { var o = _libEntry(ex.swappedFrom) || {}; ex.name = ex.swappedFrom; ex.cat = o.cat || ex.cat; ex.video = o.video || ''; ex.liftKey = o.liftKey || ''; if (ex.loadPct) { ex.load = ex.loadPct; delete ex.loadPct; } delete ex.swappedFrom; delete ex.swapLoc; }
            n++;
          });
        });
        delete day.location;
      });
      delete wk.location;
    });
    if (typeof pbRenderDayGrid === 'function') pbRenderDayGrid();
    if (typeof PB_ACTIVE_DAY !== 'undefined' && PB_ACTIVE_DAY && typeof pbOpenDay === 'function') pbOpenDay(PB_ACTIVE_DAY.weekIdx, PB_ACTIVE_DAY.dayIdx);
    if (typeof showStatus === 'function') showStatus('↺ Restored ' + n + ' original exercise' + (n === 1 ? '' : 's'));
    m.remove();
  }
  redraw(); document.body.appendChild(m);
  m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
}

// ── 7. RTP limits ───────────────────────────────────────────────────────────
function rtpActive(athlete) {
  var list = (typeof RTP_DATA !== 'undefined' && RTP_DATA[athlete]) || [];
  var p = list.find(function (x) { return x && x.status === 'active'; });
  if (!p || !p.phases || !p.phases.length) return null;
  var idx = Math.min(p.currentPhase || 0, p.phases.length - 1);
  return { protocol: p, phase: p.phases[idx], idx: idx, last: idx >= p.phases.length - 1 };
}
var RTP_REGION_RULES = [
  [/hamstring/i, /\brdl\b|deadlift|good morning|nordic|\bghr\b|glute[- ]ham|hamstring|swing|bound|sprint|\bfly\b|max v|wicket/i],
  [/ucl|elbow|flexor/i, /throw|\bmb\b|med ball|slam|pullover|chin[- ]?up|pull[- ]?up|farmer|grip/i],
  [/shoulder|labrum|rotator|slap/i, /overhead|\bohp\b|military|jerk|snatch|push press|throw|\bmb\b|slam|dip|pull[- ]?up|bench press/i],
  [/oblique|intercostal|core/i, /rotat|throw|\bmb\b|slam|landmine|chop|swing|anti-rotation/i],
  [/groin|adductor|hip/i, /lateral|copenhagen|cossack|skater|cut|\bcod\b|5-10-5|shuffle|sumo|curve/i],
  [/ankle|achilles|calf/i, /bound|pogo|hop|jump|sprint|skip|cut|plyo|calf raise|dribble/i],
  [/knee|acl|mcl|patell|meniscus/i, /jump|bound|depth|pistol|lunge|split squat|sprint|decel|cut|hop/i],
  [/back|lumbar|spine/i, /deadlift|\brdl\b|good morning|squat|clean|snatch|jerk|swing|row/i]
];
// Mutates an athlete's copy; returns a list of plain-language changes
function applyRTPLimits(st, athlete) {
  var r = rtpActive(athlete); if (!r) return [];
  var runMax = r.phase.workload && r.phase.workload.run ? r.phase.workload.run[1] : 1;
  var liftMax = r.phase.workload && r.phase.workload.lift ? r.phase.workload.lift[1] : 1;
  var allowed = {};
  r.protocol.phases.slice(0, r.idx + 1).forEach(function (ph) { (ph.exercises || []).forEach(function (n) { allowed[String(n).toLowerCase()] = 1; }); });
  var region = r.last ? null : (RTP_REGION_RULES.find(function (x) { return x[0].test(r.protocol.injury || ''); }) || [null, null])[1];
  var label = (r.protocol.injury || 'RTP') + ' · ' + (r.phase.name || ('Phase ' + (r.idx + 1)));
  var skipped = 0, capped = 0, scaled = 0, bad = 0;
  (st.weekData || []).forEach(function (wk) {
    (wk.days || []).forEach(function (day) {
      (day.blocks || []).forEach(function (b) {
        if (b.blockType === 'session-header') return;
        (b.exercises || []).forEach(function (ex) {
          if (!ex || !ex.name || ex.rtpSkip || ex.rtpNote) return;   // already limited (e.g. a live edit re-saves his copy)
          var nm = String(ex.name).toLowerCase();
          if (allowed[nm]) return;
          var run = TC.isRunEx(b, ex) || b.blockType === 'speed';
          if (run && runMax <= 0) { ex.rtpSkip = true; ex.rtpNote = 'no running yet in your rehab plan'; skipped++; return; }
          if (run && runMax < 0.8 && (/max velocity|curvilinear|cod|agility|deceleration/i.test(ex.cat || '') || /\bfly\b|flying|max v|curve|cut|decel|5-10-5|shuttle|wicket/i.test(nm))) { ex.rtpSkip = true; ex.rtpNote = 'top-speed and cutting work is on hold'; skipped++; return; }
          if (region && region.test(nm)) { ex.rtpSkip = true; ex.rtpNote = 'on hold while your ' + (r.protocol.injury || 'injury').toLowerCase() + ' heals'; bad++; return; }
          if (run && runMax < 1) { var cap = Math.round(runMax * 100); var p = parseFloat(String(ex.pct || '100')); if (!(p <= cap)) { ex.pct = cap + '%'; ex.rtpNote = 'Keep it at ' + cap + '% effort (rehab plan)'; capped++; } }
          if (!run && liftMax < 1) {
            var pct = TC.pctOf(ex);
            if (pct) { var np = Math.max(40, Math.round(pct * liftMax)); if (np < pct) { ex.load = String(ex.load).replace(/(\d+(?:\.\d+)?)\s*%/, np + '%'); ex.rtpNote = 'Load reduced for your rehab plan'; scaled++; } }
          }
        });
      });
    });
  });
  var out = [label + ':'];
  if (skipped) out.push(skipped + ' running drill' + (skipped === 1 ? '' : 's') + ' on hold (run cap ' + Math.round(runMax * 100) + '%)');
  if (capped) out.push(capped + ' sprint' + (capped === 1 ? '' : 's') + ' capped at ' + Math.round(runMax * 100) + '% effort');
  if (bad) out.push(bad + ' exercise' + (bad === 1 ? '' : 's') + ' that load the injured area on hold');
  if (scaled) out.push(scaled + ' lift load' + (scaled === 1 ? '' : 's') + ' scaled to ' + Math.round(liftMax * 100) + '%');
  return out.length > 1 ? [out.join(' ')] : [label + ': no changes needed'];
}

// ── Per-athlete preparation at send ─────────────────────────────────────────
// Adds liftKey + tested 1RM (so the athlete page can auto-adjust loads),
// swaps for home equipment, applies RTP limits. Returns { st, notes }.
function prepareForAthlete(pbState, player, opts) {
  opts = opts || {};
  var st = pbComputeLoadsForAthlete(pbState, player);
  var defLoc = opts.location || st.defaultLocation || 'auto';
  var res = applyEquipmentSwaps(st, player, defLoc);
  var swaps = [], missing = res.missing;
  res.swaps.forEach(function (s) { if (!swaps.some(function (x) { return x[0] === s.from && x[1] === s.to; })) swaps.push([s.from, s.to]); });
  var usedLocs = {};
  (st.weekData || []).forEach(function (wk) {
    (wk.days || []).forEach(function (day) {
      var loc = day.location || wk.location || defLoc;
      if (equipmentFor(loc, player) && (day.blocks || []).some(function (b) { return (b.exercises || []).some(function (x) { return x && x.name; }); })) usedLocs[loc] = 1;
      (day.blocks || []).forEach(function (block) {
        (block.exercises || []).forEach(function (ex) {
          if (!ex || !ex.name) return;
          var dbEx = EXERCISE_DB.find(function (e) { return e && e.name && e.name.toLowerCase() === String(ex.name).toLowerCase(); });
          if (dbEx && dbEx.liftKey) ex.liftKey = dbEx.liftKey;
          if (typeof applyRatioLoad === 'function') applyRatioLoad(ex, player);
          else if (dbEx && dbEx.liftKey) {
            var rm = get1RM(player, dbEx.liftKey);
            if (rm) { ex.base1RM = rm; var p = TC.pctOf(ex); if (p) ex.calcWeight = calcMROUND(p, rm); }
          }
          // Swapped to something with no 1RM: a % load can't be turned into lbs, so show effort
          if (ex.swappedFrom && ex.swapLoc && !ex.calcWeight && /%/.test(String(ex.load || ''))) { ex.loadPct = ex.load; ex.load = pctToRPE(ex.load); }
        });
      });
    });
  });
  var notes = [];
  var locNames = Object.keys(usedLocs).map(function (l) { var li = locationInfo(l === 'auto' ? 'home' : l); return li ? li.icon + ' ' + li.label : l; });
  if (locNames.length) notes.push(swaps.length ? locNames.join(' + ') + ' — ' + swaps.length + ' swap' + (swaps.length === 1 ? '' : 's') + ': ' + swaps.map(function (s) { return s[0] + ' → ' + s[1]; }).join('; ') : locNames.join(' + ') + ' — no swaps needed');
  Object.keys(missing).forEach(function (n) { notes.push('⚠ ' + n + ' needs ' + missing[n] + ' — no substitute found, left as written'); });
  applyRTPLimits(st, player).forEach(function (n) { notes.push('🩺 ' + n); });
  return { st: st, notes: notes, swaps: swaps };
}

// ── 6a. Projected ACWR if the athlete follows the plan ──────────────────────
function projectACWR(athlete, st) {
  if (!st.startDate) return null;
  var base = playerLoadSeries(athlete);
  var byDay = {};
  Object.keys(base.byDay || {}).forEach(function (k) { byDay[k] = { he: base.byDay[k].he, td: base.byDay[k].td }; });
  var todayK = _dayKey(new Date()), planned = [];
  st.weekData.forEach(function (wk, wi) {
    (wk.days || []).forEach(function (day, di) {
      var d = TC.dayDate(st, wi, di); if (!d) return;
      var k = _dayKey(d); if (k < todayK) return;
      var l = TC.plannedDayLoad(st, wi, di);
      if (!l.he && !l.td) return;
      byDay[k] = byDay[k] || { he: 0, td: 0 }; byDay[k].he += l.he; byDay[k].td += l.td;
      planned.push({ k: k, wi: wi });
    });
  });
  if (!planned.length) return null;
  var keys = Object.keys(byDay).map(Number).sort(function (a, b) { return a - b; });
  var first = keys[0], lastK = planned[planned.length - 1].k, startK = _dayKey(TC.parseISO(st.startDate));
  var seedHe = 0, seedTd = 0, k2 = first;
  for (var i = 0; i < 7; i++) { var l0 = byDay[k2]; if (l0) { seedHe += l0.he; seedTd += l0.td; } k2 = _addDays(k2, 1); }
  var s = { ha: seedHe / 7, hc: seedHe / 7, ta: seedTd / 7, tc: seedTd / 7 }, peak = null, low = null;
  for (var d = first; d <= lastK; d = _addDays(d, 1)) {
    var l = byDay[d] || { he: 0, td: 0 };
    s.ha = ACWR_LA * l.he + (1 - ACWR_LA) * s.ha; s.hc = ACWR_LC * l.he + (1 - ACWR_LC) * s.hc;
    s.ta = ACWR_LA * l.td + (1 - ACWR_LA) * s.ta; s.tc = ACWR_LC * l.td + (1 - ACWR_LC) * s.tc;
    if (d < startK) continue;
    var he = s.hc > 0 ? s.ha / s.hc : 1, td = s.tc > 0 ? s.ta / s.tc : 1, w = Math.max(he, td), lo = Math.min(he, td);
    if (!peak || w > peak.v) peak = { v: w, k: d };
    if (low === null || lo < low) low = lo;
  }
  if (!peak) return { v: null };
  var pw = planned.filter(function (p) { return p.k <= peak.k; }).pop();
  return { v: Math.round(peak.v * 100) / 100, low: Math.round(low * 100) / 100, date: new Date(peak.k), week: pw ? pw.wi + 1 : null };
}

// ── 6b. Program checks ──────────────────────────────────────────────────────
var HEAVY_LB_CATS = /squat|deadlift|hamstring|olympic/i;
function pbCheckRules(state) {
  var out = [];
  (state.weekData || []).forEach(function (wk, wi) {
    (wk.days || []).forEach(function (day, di) {
      var blocks = (day.blocks || []).filter(function (b) { return b.blockType !== 'session-header' && TC.namedExs(b).length; });
      if (!blocks.length) return;
      var where = 'W' + wk.week + ' ' + day.day;
      var hasSpeed = blocks.some(function (b) { return b.blockType === 'speed'; });
      var mainBlocks = blocks.filter(function (b) { return b.blockType !== 'prep' && b.blockType !== 'mobility'; });
      if (hasSpeed && mainBlocks.length && mainBlocks[0].blockType !== 'speed') out.push({ wi: wi, di: di, level: 'warn', msg: where + ': speed block isn\'t first' });
      var unpaired = [], letters = {};
      blocks.forEach(function (b) {
        if (b.blockType === 'prep' || b.blockType === 'mobility' || b.blockType === 'esd') return;
        TC.namedExs(b).forEach(function (ex) { if (!ex.pair) unpaired.push(ex.name); else if (b.blockType !== 'speed') letters[ex.pair] = (letters[ex.pair] || 0) + 1; });   // single sprint letters (C, D, E) are normal in a speed block
      });
      if (unpaired.length) out.push({ wi: wi, di: di, level: 'info', msg: where + ': not paired — ' + unpaired.slice(0, 3).join(', ') + (unpaired.length > 3 ? ' +' + (unpaired.length - 3) : '') });
      Object.keys(letters).forEach(function (l) { if (letters[l] === 1) out.push({ wi: wi, di: di, level: 'info', msg: where + ': pair ' + l + ' has one exercise' }); });
      blocks.forEach(function (b) { TC.namedExs(b).forEach(function (ex) {
        if (b.blockType !== 'speed' && b.blockType !== 'mobility' && b.blockType !== 'prep' && !ex.sets && !ex.reps) out.push({ wi: wi, di: di, level: 'info', msg: where + ': ' + ex.name + ' has no sets/reps' });
      }); });
      // Heavy lower body the day before high-intent sprinting
      var heavy = blocks.some(function (b) { return b.blockType !== 'speed' && TC.namedExs(b).some(function (ex) {
        var p = TC.pctOf(ex); var db = EXERCISE_DB.find(function (e) { return e && e.name === ex.name; });
        return HEAVY_LB_CATS.test((db && db.cat) || ex.cat || '') && p !== null && p >= 80;
      }); });
      var next = wk.days[di + 1];
      if (heavy && next && (next.blocks || []).some(function (b) { return b.blockType === 'speed' && TC.namedExs(b).some(function (ex) { return TC.isHighEffort(b, ex); }); }))
        out.push({ wi: wi, di: di, level: 'warn', msg: where + ': heavy lower-body lifting (≥80%) the day before sprinting on ' + next.day });
    });
  });
  return out;
}
function pbRenderChecks() {
  var el = document.getElementById('pb-checks'); if (!el) return;
  if (!PB_STATE.weekData || !PB_STATE.weekData.length) { el.innerHTML = ''; return; }
  var list = pbCheckRules(PB_STATE);
  var warn = list.filter(function (x) { return x.level === 'warn'; }).length;
  if (!list.length) { el.innerHTML = '<div style="font-size:10px;color:var(--green);">✓ Program checks passed</div>'; return; }
  el.innerHTML = '<details><summary style="cursor:pointer;font-size:10px;color:' + (warn ? '#f59e0b' : 'var(--text2)') + ';">' + (warn ? '⚠ ' : 'ⓘ ') + list.length + ' program check' + (list.length === 1 ? '' : 's') + '</summary>'
    + '<div style="margin-top:6px;max-height:160px;overflow-y:auto;">' + list.map(function (x) {
      return '<div onclick="pbSelectWeek(' + x.wi + ');pbOpenDay(' + x.wi + ',' + x.di + ')" style="cursor:pointer;font-size:10px;line-height:1.4;padding:3px 0;color:' + (x.level === 'warn' ? '#fbbf24' : 'var(--text3)') + ';">' + escHtml(x.msg) + '</div>';
    }).join('') + '</div></details>';
}
function pbDayChecksHTML(wi, di) {
  var list = pbCheckRules(PB_STATE).filter(function (x) { return x.wi === wi && x.di === di; });
  if (!list.length) return '';
  return '<div style="margin-bottom:10px;padding:8px 10px;border-radius:6px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.25);">'
    + list.map(function (x) { return '<div style="font-size:10px;line-height:1.5;color:' + (x.level === 'warn' ? '#fbbf24' : 'var(--text2)') + ';">' + (x.level === 'warn' ? '⚠ ' : 'ⓘ ') + escHtml(x.msg.replace(/^W\d+ \w+: /, '')) + '</div>'; }).join('') + '</div>';
}

// ── 4. Inbox ────────────────────────────────────────────────────────────────
var INBOX_DONE_KEY = 'cubs_sc_inbox_done_v1';
var INBOX_DONE = {};
try { INBOX_DONE = JSON.parse(localStorage.getItem(INBOX_DONE_KEY) || '{}'); } catch (e) {}
var INBOX_FILTER = 'open';
function saveInboxDone() { try { localStorage.setItem(INBOX_DONE_KEY, JSON.stringify(INBOX_DONE)); } catch (e) {} }
function exNameAt(pb, wi, di, bi, ei) { var b = ((pb.weekData[wi] || {}).days || [])[di]; b = b && b.blocks && b.blocks[bi]; var e = b ? TC.namedExs(b)[ei] : null; return e ? e.name : 'exercise'; }
function inboxItems() {
  var items = [], today = TC.localISO(), since = new Date(); since.setDate(since.getDate() - 21);
  var sinceISO = TC.localISO(since);
  PROGRAM_ROWS.forEach(function (row) {
    var pb = row.pb, log = row.log || {}, a = row.athlete;
    function push(type, key, pri, date, title, detail, extra) {
      if (date && date < sinceISO) return;
      var id = row.id + '|' + type + '|' + key;
      items.push(Object.assign({ id: id, type: type, pri: pri, date: date || '', athlete: a, program: row.name, rowId: row.id, ref: key, title: title, detail: detail, replied: (pb.messages || []).some(function (m) { return m.ref === key; }) }, extra || {}));
    }
    Object.keys(log).forEach(function (k) {
      var v = log[k]; if (!v) return;
      if (k.indexOf('day:') === 0 && v.done) {
        var lbl = (v.dayLabel || v.day || 'Session') + ' · Wk ' + (v.week || '');
        if (v.pain) push('pain', k, 1, v.date, '🚩 Pain ' + (v.pain.level ? v.pain.level + '/10 ' : '') + '— ' + (v.pain.areas || []).join(', '), lbl + (v.pain.note ? ' · "' + v.pain.note + '"' : ''));
        if (v.note) push('note', k + ':note', 4, v.date, '💬 Session note', lbl + ' · "' + v.note + '"');
      }
      if (k.indexOf('ready:') === 0 && v.level === 'red') push('ready', k, 2, v.date, '🔴 Low readiness check-in', (v.why || []).join(' · ') + ' — session was auto-trimmed');
      if (k.indexOf('n:') === 0 && v.text) {
        var p = k.slice(2).split('-').map(Number);
        var dd = log['day:' + p[0] + '-' + p[1]];
        push('note', k, 4, (dd && dd.date) || loggedDayDate(row, p[0], p[1]), '💬 ' + exNameAt(pb, p[0], p[1], p[2], p[3]), '"' + v.text + '"');
      }
    });
    // Missed reps on days that were logged
    loggedDays(row).forEach(function (wd) {
      TC.sessionMisses(pb, log, wd[0], wd[1]).forEach(function (m) {
        push('reps', 'miss:' + wd[0] + '-' + wd[1] + ':' + m.name, 3, loggedDayDate(row, wd[0], wd[1]), '↓ Missed reps — ' + m.name, m.missed + ' of ' + m.logged + ' sets under target · W' + (wd[0] + 1) + ' ' + ((pb.weekData[wd[0]].days[wd[1]] || {}).day || ''));
      });
    });
    // Missed sessions (scheduled, in the past, nothing logged)
    if (pb.startDate) {
      pb.weekData.forEach(function (wk, wi) { (wk.days || []).forEach(function (day, di) {
        if (!TC.dayHasWork(day)) return;
        var d = TC.dayDate(pb, wi, di); if (!d) return;
        var iso = TC.localISO(d); if (iso >= today || iso < sinceISO) return;
        var any = Object.keys(log).some(function (k) { return k.indexOf(wi + '-' + di + '-') === 0 && log[k] && log[k].done; });
        if (!any && !(log['day:' + wi + '-' + di] || {}).done) push('missed', 'missed:' + wi + '-' + di, 3, iso, '⏸ Missed session', (day.label || day.day) + ' · W' + (wi + 1) + ' ' + day.day);
      }); });
    }
    // Strength changes from logs
    var sessions = TC.liftSessions(pb, log);
    Object.keys(sessions).forEach(function (lift) {
      var ss = sessions[lift], last = ss[ss.length - 1];
      var base = last.base || (typeof get1RM === 'function' ? get1RM(a, lift) : null);
      var est = Math.round(last.e1rm / 5) * 5;
      var date = loggedDayDate(row, last.wi, last.di);
      if (base) {
        var ch = (est - base) / base * 100;
        if (Math.abs(ch) >= 5) push('strength', 'e1rm:' + lift + ':' + est, 4, date, (ch > 0 ? '↑ ' : '↓ ') + lift + ' est. 1RM ' + est + ' lbs (' + (ch > 0 ? '+' : '') + Math.round(ch) + '%)', 'Tested 1RM ' + base + ' · from ' + last.name + ' logs — his loads are already adjusting', { lift: lift, est: est });
      } else if (ss.length >= 1) {
        push('strength', 'e1rm:' + lift + ':' + est, 5, date, '＋ ' + lift + ' est. 1RM ' + est + ' lbs', 'No tested 1RM on file — from ' + last.name + ' logs. Save it so % loads show in lbs from day one next block.', { lift: lift, est: est });
      }
    });
  });
  if (typeof speedInboxItems === 'function') { try { items = items.concat(speedInboxItems()); } catch (e) { console.warn('[speedInboxItems]', e); } }
  return items.sort(function (x, y) { return x.pri - y.pri || (y.date > x.date ? 1 : y.date < x.date ? -1 : 0); });
}
function updateInboxBadge() {
  var el = document.getElementById('inbox-badge'); if (!el) return;
  var n = inboxItems().filter(function (i) { return !INBOX_DONE[i.id]; });
  var urgent = n.filter(function (i) { return i.pri <= 2; }).length;
  el.textContent = n.length ? n.length : '';
  el.style.cssText = n.length ? 'margin-left:6px;font-size:10px;font-weight:700;padding:1px 6px;border-radius:10px;background:' + (urgent ? 'var(--red)' : 'rgba(255,255,255,0.12)') + ';color:#fff;' : 'display:none;';
}
function renderInbox() {
  var el = document.getElementById('inbox-body'); if (!el) return;
  var all = inboxItems();
  var list = all.filter(function (i) { return INBOX_FILTER === 'all' ? true : INBOX_FILTER === 'done' ? INBOX_DONE[i.id] : !INBOX_DONE[i.id]; });
  var colors = { pain: '#f87171', ready: '#f87171', missed: '#fbbf24', reps: '#fbbf24', strength: '#60a5fa', note: '#cbd5e1', speed: '#f59e0b', block: '#f59e0b', test: '#4ade80' };
  document.getElementById('inbox-counts').textContent = all.filter(function (i) { return !INBOX_DONE[i.id]; }).length + ' open · ' + PROGRAM_ROWS.length + ' programs';
  el.innerHTML = list.length ? list.map(function (i) {
    return '<div class="card" style="padding:12px 14px;margin-bottom:8px;border-left:3px solid ' + colors[i.type] + ';' + (INBOX_DONE[i.id] ? 'opacity:.55;' : '') + '">'
      + '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;">'
      + '<div style="flex:1;min-width:220px;"><div style="font-size:13px;font-weight:700;color:#fff;">' + escHtml(i.athlete) + ' <span style="font-weight:600;color:' + colors[i.type] + ';">' + escHtml(i.title) + '</span></div>'
      + '<div style="font-size:12px;color:var(--text2);margin-top:3px;line-height:1.5;">' + escHtml(i.detail) + '</div>'
      + '<div style="font-size:10px;color:var(--text3);margin-top:4px;">' + escHtml(i.program || '') + (i.date ? ' · ' + escHtml(fmtDate(i.date)) : '') + (i.replied ? ' · <span style="color:var(--green);">replied</span>' : '') + '</div></div>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;">'
      + (i.type === 'strength' ? '<button onclick="inboxAccept1RM(\'' + jsq(i.id) + '\')" style="padding:6px 10px;background:rgba(96,165,250,.15);border:1px solid rgba(96,165,250,.4);border-radius:6px;color:#60a5fa;font-size:11px;cursor:pointer;">Save as 1RM</button>' : '')
      + (i.type === 'block' && typeof ofNextBlock === 'function' ? '<button onclick="ofNextBlock(\'' + jsq(i.athlete) + '\')" style="padding:6px 10px;background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.45);border-radius:6px;color:#f59e0b;font-size:11px;font-weight:700;cursor:pointer;">⏭ Build next block</button>' : '')
      + (i.type === 'speed' ? '<button onclick="siOpenHE(\'' + jsq(i.athlete) + '\')" style="padding:6px 10px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.4);border-radius:6px;color:#f59e0b;font-size:11px;cursor:pointer;">HE Runs</button>' : '')
      + (i.rowId ? '<button onclick="peOpenLive(\'' + jsq(i.rowId) + '\')" title="Change his program — updates on his phone" style="padding:6px 10px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.4);border-radius:6px;color:#f59e0b;font-size:11px;cursor:pointer;">✏️ Edit</button>' : '')
      + (i.rowId ? '<button onclick="inboxReply(\'' + jsq(i.id) + '\')" style="padding:6px 10px;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.4);border-radius:6px;color:#a5b4fc;font-size:11px;cursor:pointer;">' + (i.type === 'speed' ? 'Message' : 'Reply') + '</button>'
      + '<a href="' + PUSH_BASE_URL + encodeURIComponent(i.rowId) + '" target="_blank" style="padding:6px 10px;background:rgba(255,255,255,.05);border:1px solid var(--border2);border-radius:6px;color:var(--text2);font-size:11px;text-decoration:none;">Open</a>' : '')
      + '<button onclick="inboxToggleDone(\'' + jsq(i.id) + '\')" style="padding:6px 10px;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.35);border-radius:6px;color:var(--green);font-size:11px;cursor:pointer;">' + (INBOX_DONE[i.id] ? 'Reopen' : '✓ Done') + '</button>'
      + '</div></div></div>';
  }).join('') : '<div style="color:var(--text3);font-size:13px;padding:30px;text-align:center;">' + (INBOX_FILTER === 'open' ? 'All caught up ✓' : 'Nothing here.') + '</div>';
  document.querySelectorAll('.inbox-filter').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-f') === INBOX_FILTER); });
  updateInboxBadge();
}
function inboxSetFilter(f) { INBOX_FILTER = f; renderInbox(); }
function inboxToggleDone(id) { if (INBOX_DONE[id]) delete INBOX_DONE[id]; else INBOX_DONE[id] = Date.now(); saveInboxDone(); renderInbox(); }
function inboxAll() { inboxItems().forEach(function (i) { if (i.pri > 2 && !INBOX_DONE[i.id]) INBOX_DONE[i.id] = Date.now(); }); saveInboxDone(); renderInbox(); }
function inboxAccept1RM(id) {
  var i = inboxItems().find(function (x) { return x.id === id; }); if (!i) return;
  if (!confirm('Save ' + i.lift + ' 1RM = ' + i.est + ' lbs for ' + i.athlete + '?')) return;
  ATHLETE_1RM[i.athlete] = ATHLETE_1RM[i.athlete] || {};
  ATHLETE_1RM[i.athlete][i.lift] = i.est;
  if (typeof persist1RM === 'function') persist1RM();
  INBOX_DONE[id] = Date.now(); saveInboxDone(); renderInbox();
  showStatus('✅ ' + i.athlete + ' · ' + i.lift + ' 1RM saved as ' + i.est + ' lbs');
}
// Replies are stored on the athlete's program (pb_state.messages) and show on his page
async function inboxReply(id) {
  var i = inboxItems().find(function (x) { return x.id === id; }); if (!i) return;
  var text = prompt('Reply to ' + i.athlete + ' (shows on his program page):');
  if (!text || !text.trim()) return;
  var ok = await sendCoachMessage(i.rowId, i.ref, text.trim());
  if (ok) { INBOX_DONE[id] = Date.now(); saveInboxDone(); await loadProgramRows(); renderInbox(); showStatus('✅ Reply sent to ' + i.athlete); }
}
async function sendCoachMessage(rowId, ref, text) {
  try {
    var db = getSupaClient(); if (!db) throw new Error('Cloud not connected');
    var r = await db.from('athlete_programs').select('pb_state').eq('id', rowId).maybeSingle();
    if (r.error) throw r.error;
    var pb = typeof r.data.pb_state === 'string' ? JSON.parse(r.data.pb_state) : r.data.pb_state;
    pb.messages = pb.messages || [];
    pb.messages.push({ at: new Date().toISOString(), text: text, ref: ref && ref.indexOf('e1rm:') !== 0 && ref.indexOf('miss') !== 0 && ref.indexOf('spd:') !== 0 ? String(ref).replace(/:note$/, '') : null });
    var u = await db.from('athlete_programs').update({ pb_state: JSON.stringify(pb), updated_at: new Date().toISOString() }).eq('id', rowId);
    if (u.error) throw u.error;
    return true;
  } catch (e) { alert('Reply failed: ' + (e.message || e)); return false; }
}

// Sprint times on the athlete's dashboard card
function sprintTimesHTML(athlete) {
  var best = {};
  PROGRAM_ROWS.filter(function (r) { return r.athlete === athlete; }).forEach(function (row) {
    row.pb.weekData.forEach(function (wk, wi) { (wk.days || []).forEach(function (day, di) { (day.blocks || []).forEach(function (b, bi) { TC.namedExs(b).forEach(function (ex, ei) {
      if (!TC.isRunEx(b, ex)) return;
      for (var s = 0; s < TC.setCount(ex); s++) {
        var e = row.log[TC.lk(wi, di, bi, ei, s)], t = e && parseFloat(e.time);
        if (e && e.done && t > 0) { var key = ex.name + (ex.distance ? ' · ' + ex.distance : ''); if (!best[key] || t < best[key].t) best[key] = { t: t, date: loggedDayDate(row, wi, di) }; }
      }
    }); }); }); });
  });
  var keys = Object.keys(best); if (!keys.length) return '';
  return '<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px;"><div style="font-size:10px;color:var(--text3);letter-spacing:.5px;margin-bottom:6px;">SPRINT TIMES (ATHLETE-LOGGED)</div>'
    + keys.map(function (k) { return '<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;"><span style="color:var(--text2);">' + escHtml(k) + '</span><span style="color:#fff;font-family:\'DM Mono\',monospace;">' + best[k].t.toFixed(2) + 's <span style="color:var(--text3);">' + escHtml(best[k].date ? fmtDate(best[k].date) : '') + '</span></span></div>'; }).join('') + '</div>';
}

// Keep program data fresh
setTimeout(function () { loadProgramRows(); }, 2500);
setInterval(function () { if (document.visibilityState === 'visible') loadProgramRows(); }, 5 * 60 * 1000);

// ── Template library (data/mw-templates.js) ─────────────────────────────────
function mwInstallTemplates() {
  function go() {
    var existing = SAVED_PROGRAMS.filter(function (p) { return p && p.tplKey; });
    var replace = true;
    if (existing.length && !confirm('Update the ' + existing.length + ' library templates you already have to the latest version?\n\nOK = update them (your edits to those templates are replaced)\nCancel = only add ones you don\'t have')) replace = false;
    var added = 0, updated = 0, base = Date.now();
    SAVED_PROGRAMS.forEach(function (p) { var n = Number(p.id); if (n >= base) base = n + 1; });
    MW_TEMPLATES.forEach(function (t) {
      var ex = SAVED_PROGRAMS.find(function (p) { return p && p.tplKey === t.key; });
      if (ex && !replace) return;
      var prog = { name: t.name, notes: t.notes, athlete: 'Template Library', category: t.category, meso: t.pbState.phase, macro: t.pbState.phase,
        scope: 'meso', scopeLabel: 'Mesocycle', mesoLabel: t.name, html: '', content: '', isTemplate: true, tplKey: t.key, tplVersion: MW_TEMPLATES_VERSION,
        pbState: JSON.parse(JSON.stringify(t.pbState)) };
      if (ex) { Object.assign(ex, prog); updated++; }
      else { prog.id = base++; prog.created = new Date().toISOString(); SAVED_PROGRAMS.push(prog); added++; }
    });
    persistPrograms();
    if (typeof renderPBDrafts === 'function') renderPBDrafts();
    var list = document.getElementById('pb-drafts-list'); if (list && list.style.display === 'none' && typeof pbToggleDraftsList === 'function') pbToggleDraftsList();
    showStatus('📚 Template library: ' + added + ' added' + (updated ? ', ' + updated + ' updated' : '') + ' — open My Drafts / Templates to load one');
  }
  if (typeof MW_TEMPLATES !== 'undefined') return go();
  var sc = document.createElement('script');
  sc.src = 'data/mw-templates.js?v=1';
  sc.onload = go;
  sc.onerror = function () { alert('Couldn\'t load the template library file (data/mw-templates.js).'); };
  document.head.appendChild(sc);
}
