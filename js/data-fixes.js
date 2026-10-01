// ═══════════════════════════════════════════════════════════════════════════
// Data fixes — coach decisions about the data, applied every time it loads so a
// fresh VALD sync or CSV import can't bring bad data back.
//  • noJumps: athletes whose CMJ / ABCMJ data is excluded everywhere
//  • dropTests: single bad tests removed from every view
//  • bwLb: body weight to use for relative strength (overrides VALD)
//  • Statcast speed typed without a decimal (2871 → 28.71) is corrected
// ═══════════════════════════════════════════════════════════════════════════
var DATA_FIX = {
  noJumps: ['Dansby Swanson', 'Ian Happ'],
  dropTests: [
    { name: 'Miguel Amaya', d: '2026-07-21', t: 'CMJ', why: '56.5 cm logged as CMJ — arm-swing level; his CMJ average is ~39.5 cm' }
  ],
  bwLb: { 'Nico Hoerner': 200, 'Dansby Swanson': 188, 'Ian Happ': 208 }
};
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
  dfFixSpeed(); dfFixTrends();
})();
