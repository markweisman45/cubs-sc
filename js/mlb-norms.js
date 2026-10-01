// ── MLB normative data — VALD 2025 MLB Report, ForceDecks CMJ by grouped position ──
// Percentiles [5th, 25th, median, 75th, 95th]. CMJ without arm swing only (no ABCMJ norms).
// jp: matching Jump Profile metric key (null = not tracked in our VALD sync yet).
var MLB_NORM_GROUPS = {
  g1: { label: '1B / C', pos: ['1B', 'C'] },
  g2: { label: '2B / 3B / SS', pos: ['2B', '3B', 'SS', 'IF', 'MI', 'UT'] },
  g3: { label: 'OF', pos: ['LF', 'CF', 'RF', 'OF'] },
  g4: { label: 'Pitchers', pos: ['P', 'SP', 'RP', 'RHP', 'LHP'] }
};
var MLB_NORMS = {
  jh:    { label: 'Jump height (Imp-Mom)', unit: 'cm', g1: [33.3, 38.7, 42.8, 47.3, 53.4], g2: [35.1, 40.3, 44.1, 48.0, 53.2], g3: [35.3, 40.7, 44.5, 48.7, 55.4], g4: [33.7, 39.4, 43.3, 47.5, 54.3] },
  ppbm:  { label: 'Peak power / BM', unit: 'W/kg', g1: [49, 55, 59, 64, 72], g2: [50, 57, 61, 66, 73], g3: [52, 58, 63, 67, 74], g4: [49, 55, 59, 63, 71] },
  rsi:   { label: 'RSI-modified', unit: 'm/s', g1: [0.45, 0.56, 0.65, 0.74, 0.87], g2: [0.46, 0.57, 0.66, 0.75, 0.87], g3: [0.45, 0.58, 0.68, 0.78, 0.91], g4: [0.43, 0.56, 0.64, 0.72, 0.85] },
  ftct:  { label: 'Flight time : contraction time', unit: '', g1: [0.64, 0.77, 0.85, 0.94, 1.08], g2: [0.64, 0.76, 0.85, 0.94, 1.09], g3: [0.63, 0.77, 0.87, 0.97, 1.11], g4: [0.63, 0.75, 0.83, 0.91, 1.02] },
  edrfd: { label: 'Eccentric decel RFD / BM', unit: 'N/s/kg', g1: [54, 84, 108, 136, 185], g2: [51, 80, 106, 136, 186], g3: [46, 76, 104, 133, 187], g4: [50, 81, 103, 128, 168] },
  cpf:   { label: 'Concentric peak force / BM', unit: 'N/kg', g1: [22.8, 25.0, 26.8, 28.8, 32.1], g2: [22.8, 25.0, 26.9, 29.1, 32.2], g3: [22.7, 24.9, 26.9, 29.0, 32.6], g4: [22.5, 24.7, 26.4, 28.2, 30.8] }
};
// Also in the report but not in our VALD sync yet (kept for reference):
// Ecc peak velocity (m/s) g1 -1.17/-1.40/-1.56/-1.71/-1.92 · g2 -1.11/-1.36/-1.52/-1.68/-1.92 · g3 -1.10/-1.34/-1.51/-1.66/-1.86 · g4 -1.17/-1.46/-1.62/-1.75/-1.95
// Ecc peak power/BM (W/kg) g1 14.8/20.6/24.8/29.1/35.1 · g2 13.3/19.4/23.9/28.8/35.5 · g3 12.9/18.6/23.2/27.9/35.4 · g4 13.8/20.9/25.4/29.6/35.9
// Conc impulse 100ms (N·s) g1 99/124/143/162/197 · g2 95/118/136/158/193 · g3 95/121/140/163/196 · g4 97/122/139/154/177
// Conc RPD 100ms/BM (W/s/kg) g1 201/268/327/399/542 · g2 212/283/338/410/650 · g3 195/279/351/431/568 · g4 196/259/307/365/466
var MLB_NORM_SRC = 'VALD 2025 MLB Report';
var MLB_PCTS = [5, 25, 50, 75, 95];
function mlbAutoGroup(name) {
  var pos = (typeof PLAYERS !== 'undefined' && PLAYERS[name] && PLAYERS[name].pos) ? String(PLAYERS[name].pos).toUpperCase() : '';
  for (var g in MLB_NORM_GROUPS) if (MLB_NORM_GROUPS[g].pos.indexOf(pos) >= 0) return g;
  return pos ? 'g2' : 'g2';
}
function mlbGroup(name) { return (JP.normGrp && MLB_NORM_GROUPS[JP.normGrp]) ? JP.normGrp : mlbAutoGroup(name); }
function mlbNorm(k, grp) { var n = MLB_NORMS[k]; return n && n[grp] ? n[grp] : null; }
// Percentile of v within the MLB group (linear between published percentiles). Returns { p, txt } or null.
function mlbPct(k, v, grp) {
  var q = mlbNorm(k, grp); if (!q || v == null || isNaN(v)) return null;
  if (v <= q[0]) return { p: 4, txt: '<5th' };
  if (v >= q[4]) return { p: 96, txt: '>95th' };
  for (var i = 0; i < 4; i++) if (v <= q[i + 1]) { var p = Math.round(MLB_PCTS[i] + (MLB_PCTS[i + 1] - MLB_PCTS[i]) * (v - q[i]) / ((q[i + 1] - q[i]) || 1)); return { p: p, txt: mlbOrd(p) }; }
  return null;
}
function mlbOrd(n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
function mlbCol(p) { return p >= 75 ? '#22c55e' : p <= 25 ? '#f87171' : '#cbd5e1'; }
function mlbPill(k, v, grp, small) {
  var r = mlbPct(k, v, grp); if (!r) return '';
  return '<span title="vs MLB ' + MLB_NORM_GROUPS[grp].label + ' (' + MLB_NORM_SRC + ')" style="display:inline-block;padding:1px 7px;border-radius:10px;background:rgba(249,115,22,.12);border:1px solid rgba(249,115,22,.3);color:' + mlbCol(r.p) + ';font-size:' + (small ? 9.5 : 10) + 'px;font-weight:700;white-space:nowrap;">MLB ' + r.txt + '</span>';
}
function mlbGroupSelect(name, onchange) {
  var auto = mlbAutoGroup(name), cur = mlbGroup(name);
  return '<select onchange="' + onchange + '" title="Which MLB position group to compare against" style="background:var(--bg3);border:1px solid rgba(249,115,22,.4);border-radius:7px;padding:3px 8px;color:#fdba74;font-size:11px;">'
    + Object.keys(MLB_NORM_GROUPS).map(function (g) { return '<option value="' + g + '"' + (g === cur ? ' selected' : '') + '>MLB ' + MLB_NORM_GROUPS[g].label + (g === auto ? ' (his position)' : '') + '</option>'; }).join('') + '</select>';
}
function mlbSetGroup(g) { JP.normGrp = g; renderJumpProfile(); if (typeof renderAllCharts === 'function' && typeof PLAYERS !== 'undefined' && PLAYERS[currentPlayer]) renderAllCharts(PLAYERS[currentPlayer]); }
// Chart.js annotation set for a trend chart: MLB 25th–75th band + median line
function mlbChartAnnotations(k, name) {
  var grp = mlbGroup(name), q = mlbNorm(k, grp); if (!q) return {};
  var lab = 'MLB ' + MLB_NORM_GROUPS[grp].label;
  return {
    mlbBand: { type: 'box', yMin: q[1], yMax: q[3], backgroundColor: 'rgba(249,115,22,0.09)', borderColor: 'rgba(249,115,22,0.25)', borderWidth: 1, drawTime: 'beforeDatasetsDraw',
      label: { display: true, content: lab + ' 25th–75th', position: { x: 'end', y: 'end' }, color: 'rgba(253,186,116,0.75)', font: { family: 'DM Mono', size: 9 }, padding: 3 } },
    mlbMed: { type: 'line', yMin: q[2], yMax: q[2], borderColor: 'rgba(249,115,22,0.65)', borderDash: [6, 4], borderWidth: 1.5, drawTime: 'beforeDatasetsDraw',
      label: { display: true, content: 'MLB median ' + q[2], position: 'center', color: 'rgba(253,186,116,0.9)', backgroundColor: 'rgba(15,23,42,0.6)', font: { family: 'DM Mono', size: 9 }, padding: 2 } }
  };
}
// "vs MLB" card: where his latest and season best sit on each benchmarked metric
function mlbCardHTML(r) {
  if (r.type !== 'CMJ') return '<div class="card" style="padding:12px 16px;border-radius:12px;margin-bottom:14px;font-size:11px;color:var(--text3);">🏟 MLB benchmarks are for CMJ without arm swing — switch to CMJ to compare.</div>';
  var grp = mlbGroup(r.name);
  var rows = Object.keys(MLB_NORMS).filter(function (k) { return r.metrics[k]; }).map(function (k) {
    var n = MLB_NORMS[k], q = n[grp], x = r.metrics[k], m = jpM(k), lv = x.latest.v, sb = x.season[x.y1];
    var lo = Math.min(q[0], lv, sb), hi = Math.max(q[4], lv, sb), pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
    var X = function (v) { return ((v - lo) / (hi - lo) * 100).toFixed(2) + '%'; };
    var pl = mlbPct(k, lv, grp);
    return '<div style="display:grid;grid-template-columns:170px minmax(160px,1fr) 70px 70px;gap:14px;align-items:center;padding:8px 0;border-top:1px solid rgba(255,255,255,.05);">'
      + '<div><div style="font-size:12px;color:#e2e8f0;font-weight:600;line-height:1.2;">' + jpEsc(m.label) + '</div><div style="font-size:9.5px;color:var(--text3);">' + (m.unit || '&nbsp;') + ' · MLB median ' + q[2] + '</div></div>'
      + '<div style="position:relative;height:22px;" title="Bar = MLB 5th–95th · shaded = 25th–75th · line = median · ● latest · ○ ' + x.y1 + ' best">'
      + '<div style="position:absolute;left:' + X(q[0]) + ';right:calc(100% - ' + X(q[4]) + ');top:9px;height:4px;border-radius:2px;background:rgba(255,255,255,.1);"></div>'
      + '<div style="position:absolute;left:' + X(q[1]) + ';right:calc(100% - ' + X(q[3]) + ');top:6px;height:10px;border-radius:3px;background:rgba(249,115,22,.28);border:1px solid rgba(249,115,22,.45);"></div>'
      + '<div style="position:absolute;left:' + X(q[2]) + ';top:3px;height:16px;width:2px;margin-left:-1px;background:#fb923c;"></div>'
      + '<div style="position:absolute;left:' + X(sb) + ';top:5px;width:12px;height:12px;margin-left:-6px;border-radius:50%;border:2px solid #93c5fd;background:transparent;"></div>'
      + '<div style="position:absolute;left:' + X(lv) + ';top:6px;width:10px;height:10px;margin-left:-5px;border-radius:50%;background:#60a5fa;box-shadow:0 0 0 2px var(--bg2,#0f172a);"></div></div>'
      + '<div style="text-align:right;"><div style="font-size:14px;font-weight:800;color:#fff;font-family:\'DM Mono\',monospace;line-height:1;">' + jpFmt(m, lv) + '</div><div style="font-size:9px;color:var(--text3);margin-top:2px;">latest</div></div>'
      + '<div style="text-align:right;font-size:13px;font-weight:800;color:' + (pl ? mlbCol(pl.p) : 'var(--text3)') + ';">' + (pl ? pl.txt : '—') + '</div></div>';
  });
  if (!rows.length) return '';
  return '<div class="card" style="padding:14px 16px;border-radius:12px;margin-bottom:14px;border:1px solid rgba(249,115,22,.25);">'
    + '<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:4px;"><span style="font-size:15px;">🏟</span><span style="font-size:13px;font-weight:800;color:#fff;">vs MLB</span><span style="font-size:10.5px;color:var(--text3);">' + MLB_NORM_SRC + ' · ● latest · ○ ' + (r.metrics.jh ? r.metrics.jh.y1 : '') + ' best · shaded = MLB 25th–75th · line = median</span><span style="margin-left:auto;">' + mlbGroupSelect(r.name, 'mlbSetGroup(this.value)') + '</span></div>'
    + '<div style="display:grid;grid-template-columns:170px minmax(160px,1fr) 70px 70px;gap:14px;padding:2px 0 4px;font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;"><div></div><div>MLB 5th → 95th</div><div style="text-align:right;">Latest</div><div style="text-align:right;">MLB %ile</div></div>'
    + rows.join('')
    + '<div style="font-size:9.5px;color:var(--text3);margin-top:8px;line-height:1.5;">Our numbers are the best trial each session. If VALD built these norms from typical trials, his percentiles will read a little high — use them for where he sits, not as exact ranks.</div></div>';
}
