// ═══════════════════════════════════════════════════════════════════════════
// Data fixes — coach decisions about the data, applied every time it loads so a
// fresh VALD sync or CSV import can't bring bad data back.
//  • noJumps: athletes whose CMJ / ABCMJ data is excluded everywhere
//  • dropTests: single bad tests removed from every view
//  • dropRuns: single bad HE runs removed from every speed view
//  • bwLb: body weight to use for relative strength (overrides VALD)
//  • Statcast speed typed without a decimal (2871 → 28.71) is corrected
//  • alias: data filed under another spelling is moved to the roster name (Data Check "Merge" adds these)
// ═══════════════════════════════════════════════════════════════════════════
var DATA_FIX = {
  noJumps: ['Dansby Swanson', 'Ian Happ'],
  dropTests: [
    { name: 'Miguel Amaya', d: '2026-07-21', t: 'CMJ', why: '56.5 cm logged as CMJ — arm-swing level; his CMJ average is ~39.5 cm' }
  ],
  dropRuns: [
    { name: 'Ian Happ', d: '2025-04-01', s: 31.19, why: 'FB HR chase in LF — 31.19 is 1.2 ft/s over his next-best run (29.98)' }
  ],
  bwLb: { 'Nico Hoerner': 200, 'Dansby Swanson': 188, 'Ian Happ': 208 }
};
// Name aliases: built-in + ones added from Data Check (cloud-synced key)
var DF_ALIAS_KEY = 'cubs_sc_name_alias_v1';
function dfAliases() {
  var a = { 'Matt Boyd': 'Matthew Boyd' };
  try { var u = JSON.parse(localStorage.getItem(DF_ALIAS_KEY) || '{}'); Object.keys(u).forEach(function (k) { a[k] = u[k]; }); } catch (e) {}
  return a;
}
function dfAddAlias(from, to) {
  var u = {}; try { u = JSON.parse(localStorage.getItem(DF_ALIAS_KEY) || '{}'); } catch (e) {}
  u[from] = to; localStorage.setItem(DF_ALIAS_KEY, JSON.stringify(u));
}
// Move every row filed under an alias onto the roster name (exact duplicates dropped). Returns stores changed.
function dfApplyAliases() {
  var A = dfAliases(), changed = {};
  var stores = { statcast: null, hitting: null, cmj: null, abcmj: null, he: null };
  if (typeof importedData !== 'undefined') ['statcast', 'hitting', 'cmj', 'abcmj'].forEach(function (k) { stores[k] = importedData[k]; });
  if (typeof heRunsData !== 'undefined') stores.he = heRunsData;
  Object.keys(stores).forEach(function (k) {
    var S = stores[k]; if (!S || typeof S !== 'object') return;
    Object.keys(A).forEach(function (from) {
      var to = A[from]; if (!Array.isArray(S[from]) || from === to) return;
      var dest = Array.isArray(S[to]) ? S[to] : [], seen = {};
      dest.forEach(function (r) { seen[JSON.stringify(r)] = 1; });
      S[from].forEach(function (r) { var j = JSON.stringify(r); if (!seen[j]) { dest.push(r); seen[j] = 1; } });
      S[to] = dest; delete S[from]; changed[k] = 1;
    });
  });
  return changed;
}
function dfSaveAliased(changed) {
  try {
    if (changed.statcast && typeof saveStatcast === 'function') saveStatcast();
    if (changed.hitting && typeof saveHitting === 'function') saveHitting();
    if ((changed.cmj || changed.abcmj) && typeof saveCMJ === 'function') saveCMJ();
    if (changed.he && typeof saveHERuns === 'function') saveHERuns();
  } catch (e) { console.warn('[data-fixes] alias save', e); }
}
function dfDropped(name, iso, type) {
  return DATA_FIX.dropTests.some(function (x) { return x.name === name && x.d === iso && (!x.t || x.t === type); });
}
function dfIso(s) {
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  var d = new Date(s); if (isNaN(d)) return '';
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
// VALD cache (Jumps tab, KPI links, score)
function dfFixVald(D) {
  if (!D || !D.players) return D;
  Object.keys(D.players).forEach(function (n) {
    var T = D.players[n]; if (!Array.isArray(T)) return;
    if (DATA_FIX.noJumps.indexOf(n) >= 0) { D.players[n] = T.filter(function (t) { return t.t !== 'CMJ' && t.t !== 'ABCMJ'; }); return; }
    D.players[n] = T.filter(function (t) { return !dfDropped(n, t.d, t.t); });
  });
  return D;
}
// CSV imports (CMJ trend charts, flags, PDF report)
function dfFixTrends() {
  if (typeof PLAYERS === 'undefined') return;
  Object.keys(PLAYERS).forEach(function (n) {
    var p = PLAYERS[n]; if (!p) return;
    if (DATA_FIX.noJumps.indexOf(n) >= 0) { p.cmjTrends = []; return; }
    if (p.cmjTrends && p.cmjTrends.length) p.cmjTrends = p.cmjTrends.filter(function (c) { return !dfDropped(n, dfIso(c.rawDate || c.date), c.type || 'CMJ'); });
  });
}
// HE runs (HE Runs tab tiles, leaderboard, zones, PDF, athlete profile)
function dfFixRuns() {
  if (typeof heRunsData === 'undefined' || !heRunsData) return;
  DATA_FIX.dropRuns.forEach(function (x) {
    var R = heRunsData[x.name]; if (!Array.isArray(R)) return;
    heRunsData[x.name] = R.filter(function (r) { return !(dfIso(r.date) === x.d && Math.abs((parseFloat(r.speed) || 0) - x.s) < 0.005); });
  });
}
// Speed entered without the decimal point
function dfFixSpeed() {
  if (typeof PLAYERS === 'undefined') return;
  var fix = function (v) { return v > 100 && v / 100 < 45 ? Math.round(v) / 100 : v; };
  Object.keys(PLAYERS).forEach(function (n) {
    var p = PLAYERS[n]; if (!p) return;
    if (p.bests && p.bests.speed) p.bests.speed = fix(p.bests.speed);
    if (p.latestSpeed) p.latestSpeed = fix(p.latestSpeed);
  });
}
// Body weight (lb) for relative strength: coach-entered first, then latest VALD body weight
function athleteBW(name) {
  if (DATA_FIX.bwLb[name]) return { lb: DATA_FIX.bwLb[name], src: 'entered' };
  var r = typeof JP !== 'undefined' && JP.rows ? JP.rows.find(function (x) { return x.name === name && x.metrics.bw; }) : null;
  return r ? { lb: r.metrics.bw.latest.v, src: 'VALD ' + r.metrics.bw.latest.d } : null;
}
(function () {
  if (typeof document === 'undefined') return;
  if (typeof jpScale === 'function') { var _js = jpScale; jpScale = function (D) { return dfFixVald(_js.apply(this, arguments)); }; }
  if (typeof rebuildCMJTrends === 'function') { var _rb = rebuildCMJTrends; rebuildCMJTrends = function () { var x = _rb.apply(this, arguments); dfFixTrends(); return x; }; }
  if (typeof renderDashboard === 'function') { var _rd = renderDashboard; renderDashboard = function () { dfFixSpeed(); dfFixTrends(); return _rd.apply(this, arguments); }; }
  if (typeof loadHERuns === 'function') { var _lh = loadHERuns; loadHERuns = function () { var x = _lh.apply(this, arguments); dfApplyAliases(); dfFixRuns(); return x; }; }
  if (typeof loadAllData === 'function') { var _la = loadAllData; loadAllData = function () { var x = _la.apply(this, arguments); dfApplyAliases(); return x; }; }
  if (typeof renderHERuns === 'function') { var _rh = renderHERuns; renderHERuns = function () { dfFixRuns(); return _rh.apply(this, arguments); }; }
  dfApplyAliases(); dfFixSpeed(); dfFixTrends(); dfFixRuns();
})();
