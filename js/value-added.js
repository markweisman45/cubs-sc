// ═══════════════════════════════════════════════════════════════════════════
// Value Added page — each player's on-field tools and value from Baseball
// Savant over the last 3 seasons, compared with the typical change for his age.
// Also adds a Savant section to the one-page athlete profile.
// ═══════════════════════════════════════════════════════════════════════════
var VA = { sel: null, data: null, err: null };
// Change that counts as meaningful for each metric (one "notch")
var VA_STEP = { sprint: 0.2, hp1b: 0.04, bat: 0.5, fast: 3, ev50: 0.5, maxev: 1, hh: 2, arm: 1, pop: 0.03, blast: 1.5, brl: 1.5, xwoba: 0.015, oaa: 3, frv: 2, brv: 1, batrv: 5, war: 1, off: 5, wrc: 10, fgdef: 3, range: 2, armr: 1, frame: 3, block: 1, throwr: 1, fgbsr: 1, xb: 1, sbx: 1, sb: 5, bolts: 5 };
var VA_VIEWS = [
  { v: 'tools', label: 'Physical tools', title: 'Physical tools vs age curve' },
  { v: 'def', label: 'Defense', title: 'Defense' },
  { v: 'run', label: 'Baserunning', title: 'Baserunning' },
  { v: 'off', label: 'Offense & WAR', title: 'Offense & WAR' }
];
function vaKeys(v) { return SV.M.filter(function (m) { return m.g.indexOf(v) >= 0; }).map(function (m) { return m.k; }); }
function vaEsc(x) { return typeof escHtml === 'function' ? escHtml(String(x == null ? '' : x)) : String(x == null ? '' : x); }
function vaM(k) { return SV.M.find(function (m) { return m.k === k; }); }
function vaFmt(m, v) { if (v == null || isNaN(v)) return '—'; var s = (+v).toFixed(m.dec); if (/^-0(\.0+)?$/.test(s)) s = s.slice(1); if (m.k === 'xwoba') s = s.replace(/^0/, ''); return s; }
function vaSigned(m, v) { if (v == null || isNaN(v)) return ''; var a = Math.abs(v).toFixed(m.dec === 0 ? 0 : Math.max(1, m.dec)); var s = (v >= 0 || /^0(\.0+)?$/.test(a) ? '+' : '−') + a; return m.k === 'xwoba' ? s.replace(/0\./, '.') : s; }
function vaOrd(n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
function vaRoster() {
  var names = Object.keys(typeof PLAYERS !== 'undefined' ? PLAYERS : {}).filter(function (n) { return !['SP', 'RP'].includes((PLAYERS[n] || {}).pos); });
  return names;
}
async function vaLoad(force) {
  VA.err = null;
  try {
    var D = await SV.load(SV.yearsBack(3), force);
    var match = SV.matchRoster(D, vaRoster());
    VA.data = { D: D, rows: Object.keys(match).map(function (n) { var s = SV.summarize(D, match[n]); s.roster = n; return s; }), missing: vaRoster().filter(function (n) { return !match[n]; }) };
  } catch (e) { VA.err = e.message || String(e); }
  return VA.data;
}
// Tone for a "vs age" or change number: better / worse / about the same
function vaTone(k, v) { if (v == null) return 'na'; var st = VA_STEP[k] || 1; return v >= st ? 'up' : v <= -st ? 'down' : 'flat'; }
var VA_COL = { up: '#22c55e', down: '#f87171', flat: 'var(--text2)', na: 'var(--text3)' };
function vaChip(k, v, label) {
  var t = vaTone(k, v), m = vaM(k);
  if (v == null) return '<span style="font-size:10px;color:var(--text3);">' + (label === 'vs age' ? 'no age baseline' : '') + '</span>';
  var arrow = t === 'up' ? '▲' : t === 'down' ? '▼' : '●';
  return '<span title="' + vaEsc((label === 'vs age' ? 'Change beyond what is typical for his age: ' : 'Change: ') + vaSigned(m, v) + ' ' + m.unit) + '" style="font-size:10px;font-weight:700;color:' + VA_COL[t] + ';white-space:nowrap;">' + arrow + ' ' + vaSigned(m, v) + (label ? ' <span style="font-weight:500;opacity:.8;">' + label + '</span>' : '') + '</span>';
}
// ── Visual building blocks ──
var VA_SECTIONS = [
  { v: 'tools', icon: '⚡', title: 'Physical tools', sub: 'vs his age curve and league average' },
  { v: 'def', icon: '🧤', title: 'Defense', sub: 'range, arm and catching' },
  { v: 'run', icon: '💨', title: 'Baserunning', sub: 'speed and run value on the bases' },
  { v: 'off', icon: '🏏', title: 'Offense & WAR', sub: 'overall value' }
];
// Percentile tier colors (always shown with the number, never color alone)
function vaTier(p) { return p == null ? '#475569' : p >= 70 ? '#22c55e' : p <= 30 ? '#f87171' : '#94a3b8'; }
function vaPctBar(p) {
  if (p == null) return '<div style="height:8px;border-radius:4px;background:rgba(255,255,255,.06);"></div>';
  var c = vaTier(p);
  return '<div style="position:relative;height:8px;border-radius:4px;background:rgba(255,255,255,.07);">'
    + '<div style="position:absolute;left:50%;top:-2px;bottom:-2px;width:1px;background:rgba(255,255,255,.18);"></div>'
    + '<div style="position:absolute;left:0;top:0;bottom:0;width:' + Math.max(3, p) + '%;border-radius:4px;background:' + c + ';opacity:.85;"></div>'
    + '<div title="' + vaOrd(p) + ' percentile in MLB" style="position:absolute;left:calc(' + p + '% - 11px);top:-6px;width:22px;height:20px;border-radius:10px;background:' + c + ';border:2px solid var(--bg2,#0f172a);color:#0b1220;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;">' + p + '</div></div>';
}
function vaSpark(vals, years, m, w, h) {
  w = w || 64; h = h || 22;
  var pts = years.filter(function (y) { return vals[y] != null; });
  if (pts.length < 2) return '';
  var vs = pts.map(function (y) { return vals[y]; }), lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs); if (hi === lo) { hi += 1; lo -= 1; }
  var X = function (i) { return 3 + (w - 6) * (years.indexOf(pts[i]) / (years.length - 1)); }, Y = function (v) { var t = (v - lo) / (hi - lo); if (m && m.lower) t = 1 - t; return 3 + (h - 6) * (1 - t); };
  var d = pts.map(function (y, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(vals[y]).toFixed(1); }).join(' ');
  var last = pts.length - 1, up = m && m.lower ? vals[pts[last]] <= vals[pts[0]] : vals[pts[last]] >= vals[pts[0]];
  return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" style="display:block;overflow:visible;" role="img" aria-label="trend"><path d="' + d + '" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
    + pts.map(function (y, i) { return '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(vals[y]).toFixed(1) + '" r="' + (i === last ? 3.5 : 2) + '" fill="' + (i === last ? (up ? '#22c55e' : '#f87171') : '#60a5fa') + '"><title>' + y + ': ' + vaFmt(m || { dec: 1 }, vals[y]) + '</title></circle>'; }).join('') + '</svg>';
}
function vaPill(k, v, label) {
  if (v == null) return '';
  var t = vaTone(k, v), m = vaM(k), c = VA_COL[t];
  var bg = t === 'up' ? 'rgba(34,197,94,.12)' : t === 'down' ? 'rgba(248,113,113,.12)' : 'rgba(255,255,255,.05)';
  return '<span title="' + vaEsc(label === 'age' ? 'Change beyond the typical change for MLB players his age' : 'Latest season vs the MLB average for qualified players') + '" style="display:inline-block;padding:2px 7px;border-radius:10px;background:' + bg + ';color:' + c + ';font-size:10px;font-weight:700;white-space:nowrap;">' + (t === 'up' ? '▲ ' : t === 'down' ? '▼ ' : '') + vaSigned(m, v) + ' <span style="font-weight:500;opacity:.75;">' + (label === 'age' ? 'vs age' : 'vs avg') + '</span></span>';
}
function vaRow(r, k) {
  var m = vaM(k), x = r.metrics[k], ys = r.years, ly = x.lastY;
  if (ly == null) return '';
  var pct = x.pcts[ly];
  return '<div style="display:grid;grid-template-columns:150px minmax(110px,1fr) 64px 70px 118px;gap:12px;align-items:center;padding:9px 0;border-top:1px solid rgba(255,255,255,.05);">'
    + '<div><div style="font-size:12px;color:#e2e8f0;font-weight:600;line-height:1.2;">' + vaEsc(m.label) + '</div><div style="font-size:10px;color:var(--text3);">' + (m.unit && m.unit !== 'runs' ? m.unit : m.unit === 'runs' ? 'runs' : '&nbsp;') + '</div></div>'
    + '<div style="padding:0 6px;">' + vaPctBar(pct) + '</div>'
    + '<div style="text-align:right;"><div style="font-size:15px;font-weight:800;color:#fff;font-family:\'DM Mono\',monospace;line-height:1;">' + vaFmt(m, x.vals[ly]) + '</div><div style="font-size:9.5px;color:var(--text3);margin-top:2px;">' + ly + '</div></div>'
    + '<div title="' + ys.map(function (y) { return y + ': ' + vaFmt(m, x.vals[y]); }).join('  ·  ') + '">' + (vaSpark(x.vals, ys, m) || '<div style="font-size:10px;color:var(--text3);">1 season</div>') + '</div>'
    + '<div style="display:flex;flex-direction:column;gap:3px;align-items:flex-start;">' + (m.tool && x.added != null ? vaPill(k, x.added, 'age') : '') + (x.vsLg[ly] != null ? vaPill(k, x.vsLg[ly], 'lg') : '') + '</div>'
    + '</div>';
}
function vaSectionHTML(r, sec) {
  var keys = SV.M.filter(function (m) { return m.g[0] === sec.v || (sec.v === 'run' && m.k === 'sprint'); }).map(function (m) { return m.k; });
  if (sec.v === 'tools') keys = keys.filter(function (k) { return k !== 'pop' || r.metrics.pop.lastY != null; });
  var rows = keys.map(function (k) { return vaRow(r, k); }).filter(Boolean);
  if (!rows.length) return '';
  return '<div class="card" style="padding:14px 16px;border-radius:12px;">'
    + '<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:4px;"><span style="font-size:15px;">' + sec.icon + '</span><span style="font-size:13px;font-weight:800;color:#fff;letter-spacing:.3px;">' + sec.title + '</span><span style="font-size:10.5px;color:var(--text3);">' + sec.sub + '</span></div>'
    + '<div style="display:grid;grid-template-columns:150px minmax(110px,1fr) 64px 70px 118px;gap:12px;padding:2px 0 4px;font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;"><div></div><div style="padding:0 6px;">MLB percentile</div><div style="text-align:right;">Latest</div><div>' + r.years[0] + '–' + String(r.years[r.years.length - 1]).slice(2) + '</div><div></div></div>'
    + rows.join('') + '</div>';
}
function vaHeroStat(r, k, label) {
  var m = vaM(k), x = r.metrics[k], ly = x.lastY;
  var ch = x.change != null ? x.change * (m.lower ? -1 : 1) : null, t = vaTone(k, ch);
  return '<div style="padding:10px 14px;border-radius:10px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);min-width:120px;">'
    + '<div style="font-size:9.5px;color:var(--text3);text-transform:uppercase;letter-spacing:.6px;">' + label + (ly ? ' · ' + ly : '') + '</div>'
    + '<div style="display:flex;align-items:center;gap:10px;margin-top:3px;"><div style="font-size:24px;font-weight:800;color:#fff;font-family:\'DM Mono\',monospace;">' + (ly ? vaFmt(m, x.vals[ly]) : '—') + '</div>' + vaSpark(x.vals, r.years, m, 56, 24) + '</div>'
    + '<div style="font-size:10.5px;margin-top:2px;color:' + VA_COL[t] + ';">' + (ch != null ? (t === 'up' ? '▲ ' : t === 'down' ? '▼ ' : '') + vaSigned(m, ch) + ' since \'' + String(x.from).slice(2) : (x.pcts[ly] != null ? vaOrd(x.pcts[ly]) + ' percentile' : '&nbsp;')) + '</div></div>';
}
function vaAthleteHTML(r) {
  var rows = VA.data.rows.slice().sort(function (a, b) { return a.roster.localeCompare(b.roster); });
  var i = rows.findIndex(function (x) { return x.roster === r.roster; }), prev = rows[(i - 1 + rows.length) % rows.length], next = rows[(i + 1) % rows.length];
  var q = function (n) { return n.replace(/'/g, "\\'"); };
  var nav = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap;">'
    + '<button onclick="VA.sel=null;renderValueAdded()" style="padding:6px 12px;background:rgba(255,255,255,.05);border:1px solid var(--border2);border-radius:8px;color:var(--text2);font-size:12px;cursor:pointer;">← All athletes</button>'
    + '<select onchange="VA.sel=this.value;renderValueAdded()" style="background:var(--bg3);border:1px solid var(--border2);border-radius:8px;padding:6px 10px;color:var(--text);font-size:12px;">' + rows.map(function (x) { return '<option' + (x.roster === r.roster ? ' selected' : '') + '>' + vaEsc(x.roster) + '</option>'; }).join('') + '</select>'
    + '<button onclick="VA.sel=\'' + q(prev.roster) + '\';renderValueAdded()" title="' + vaEsc(prev.roster) + '" style="padding:6px 10px;background:transparent;border:1px solid var(--border2);border-radius:8px;color:var(--text2);cursor:pointer;">‹</button>'
    + '<button onclick="VA.sel=\'' + q(next.roster) + '\';renderValueAdded()" title="' + vaEsc(next.roster) + '" style="padding:6px 10px;background:transparent;border:1px solid var(--border2);border-radius:8px;color:var(--text2);cursor:pointer;">›</button></div>';
  var initials = r.roster.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2);
  var hero = '<div class="card" style="padding:18px 20px;border-radius:14px;margin-bottom:14px;background:linear-gradient(135deg,rgba(14,51,134,.45),rgba(15,23,42,.6));border:1px solid rgba(96,165,250,.25);">'
    + '<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap;">'
    + '<div style="width:58px;height:58px;border-radius:50%;background:#0E3386;border:2px solid rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#fff;">' + vaEsc(initials) + '</div>'
    + '<div style="flex:1;min-width:180px;"><div style="font-family:\'Bebas Neue\',sans-serif;font-size:32px;letter-spacing:.03em;color:#fff;line-height:1;">' + vaEsc(r.roster) + '</div>'
    + '<div style="font-size:12px;color:#bfdbfe;margin-top:4px;">' + vaEsc([r.pos, r.age ? 'Age ' + r.age : '', r.years[0] + '–' + r.years[r.years.length - 1]].filter(Boolean).join(' · ')) + '</div>'
    + '<div style="display:flex;gap:6px;margin-top:8px;"><button onclick="openAthleteProfile(\'' + q(r.roster) + '\')" style="padding:5px 10px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:7px;color:#fff;font-size:11px;cursor:pointer;">👤 Full profile</button>'
    + '<a href="https://baseballsavant.mlb.com/savant-player/' + r.id + '" target="_blank" rel="noopener" style="padding:5px 10px;background:transparent;border:1px solid rgba(255,255,255,.2);border-radius:7px;color:#bfdbfe;font-size:11px;text-decoration:none;">Savant ↗</a></div></div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;">' + vaHeroStat(r, 'war', 'WAR') + vaHeroStat(r, 'wrc', 'wRC+') + vaHeroStat(r, 'frv', 'Fielding runs') + vaHeroStat(r, 'sprint', 'Sprint speed') + '</div>'
    + '</div></div>';
  var secs = VA_SECTIONS.map(function (s) { return vaSectionHTML(r, s); }).filter(Boolean);
  return nav + hero + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(520px,1fr));gap:14px;">' + secs.join('') + '</div>';
}
// Team overview: one card per athlete
function vaHighlights(r) {
  var best = null, worst = null;
  SV.M.forEach(function (m) { var x = r.metrics[m.k]; if (!m.tool || x.added == null) return; var z = x.added / (VA_STEP[m.k] || 1); if (!best || z > best.z) best = { k: m.k, z: z, v: x.added }; if (!worst || z < worst.z) worst = { k: m.k, z: z, v: x.added }; });
  return { best: best && best.z >= 1 ? best : null, worst: worst && worst.z <= -1 ? worst : null };
}
function vaCardHTML(r) {
  var war = r.metrics.war, ly = war.lastY, hl = vaHighlights(r), q = r.roster.replace(/'/g, "\\'");
  var ch = war.change, t = vaTone('war', ch);
  var mini = ['sprint', 'bat', 'ev50', /catcher|^c$/i.test(r.pos || '') ? 'frame' : 'oaa'].map(function (k) {
    var m = vaM(k), x = r.metrics[k], p = x.lastY != null ? x.pcts[x.lastY] : null;
    return '<div style="display:grid;grid-template-columns:66px 1fr 26px;gap:8px;align-items:center;margin-top:6px;"><div style="font-size:10px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + ({ sprint: 'Sprint', bat: 'Bat speed', ev50: 'Exit velo', oaa: 'OAA', frame: 'Framing' })[k] + '</div>'
      + '<div style="height:6px;border-radius:3px;background:rgba(255,255,255,.07);position:relative;">' + (p != null ? '<div style="position:absolute;left:0;top:0;bottom:0;width:' + Math.max(3, p) + '%;border-radius:3px;background:' + vaTier(p) + ';"></div>' : '') + '</div>'
      + '<div style="font-size:10px;color:' + (p != null ? '#e2e8f0' : 'var(--text3)') + ';text-align:right;font-weight:700;">' + (p != null ? p : '—') + '</div></div>';
  }).join('');
  return '<div onclick="VA.sel=\'' + q + '\';renderValueAdded();window.scrollTo({top:0})" class="card va-card" style="cursor:pointer;padding:14px 16px;border-radius:12px;transition:transform .12s,border-color .12s;">'
    + '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">'
    + '<div><div style="font-size:14px;font-weight:800;color:#fff;">' + vaEsc(r.roster) + '</div><div style="font-size:10.5px;color:var(--text3);margin-top:1px;">' + vaEsc([r.pos, r.age ? 'age ' + r.age : ''].filter(Boolean).join(' · ')) + '</div></div>'
    + '<div style="text-align:right;"><div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;">WAR ' + (ly || '') + '</div><div style="display:flex;align-items:center;gap:6px;justify-content:flex-end;">' + vaSpark(war.vals, r.years, vaM('war'), 40, 18) + '<span style="font-size:20px;font-weight:800;color:#fff;font-family:\'DM Mono\',monospace;">' + (ly ? vaFmt(vaM('war'), war.vals[ly]) : '—') + '</span></div>'
    + (ch != null ? '<div style="font-size:10px;color:' + VA_COL[t] + ';">' + (t === 'up' ? '▲ ' : t === 'down' ? '▼ ' : '') + vaSigned(vaM('war'), ch) + ' since \'' + String(war.from).slice(2) + '</div>' : '') + '</div></div>'
    + '<div style="margin-top:6px;">' + mini + '</div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;min-height:20px;">'
    + (hl.best ? '<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:rgba(34,197,94,.12);color:#4ade80;font-weight:700;">▲ ' + vaM(hl.best.k).label + ' ' + vaSigned(vaM(hl.best.k), hl.best.v) + ' vs age</span>' : '')
    + (hl.worst ? '<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:rgba(248,113,113,.12);color:#fca5a5;font-weight:700;">▼ ' + vaM(hl.worst.k).label + ' ' + vaSigned(vaM(hl.worst.k), hl.worst.v) + ' vs age</span>' : '')
    + (!hl.best && !hl.worst ? '<span style="font-size:10px;color:var(--text3);">Tools tracking his age curve</span>' : '')
    + '</div></div>';
}
function vaTeamHTML() {
  var rows = VA.data.rows.slice(), ys = VA.data.D.years.slice(1), y0 = ys[0], yN = ys[ys.length - 1];
  rows.sort(function (a, b) { var wa = a.metrics.war.lastY ? a.metrics.war.vals[a.metrics.war.lastY] : -99, wb = b.metrics.war.lastY ? b.metrics.war.vals[b.metrics.war.lastY] : -99; return wb - wa; });
  function tot(k, y) { var s = 0, n = 0; rows.forEach(function (r) { var v = r.metrics[k].vals[y]; if (v != null) { s += v; n++; } }); return n ? s : null; }
  function tile(label, k, dec) {
    var a = tot(k, y0), b = tot(k, yN), vals = {}; ys.forEach(function (y) { vals[y] = tot(k, y); });
    return '<div class="card" style="padding:14px 16px;border-radius:12px;"><div style="font-size:9.5px;color:var(--text3);text-transform:uppercase;letter-spacing:.6px;">' + label + '</div>'
      + '<div style="display:flex;align-items:center;gap:12px;margin-top:4px;"><div style="font-size:26px;font-weight:800;color:#fff;font-family:\'DM Mono\',monospace;">' + (b == null ? '—' : (b > 0 && k !== 'war' ? '+' : '') + b.toFixed(dec)) + '</div>' + vaSpark(vals, ys, vaM(k), 70, 28) + '</div>'
      + '<div style="font-size:10.5px;color:var(--text2);margin-top:2px;">' + yN + (a != null ? ' · ' + a.toFixed(dec) + ' in ' + y0 : '') + '</div></div>';
  }
  var beat = function (k) { var w = rows.filter(function (r) { return r.metrics[k].added != null; }); return w.filter(function (r) { return r.metrics[k].added > 0; }).length + '/' + w.length; };
  var tiles = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:16px;">'
    + tile('Team WAR (FanGraphs)', 'war', 1) + tile('Outs above average', 'oaa', 0) + tile('Baserunning run value', 'brv', 1)
    + '<div class="card" style="padding:14px 16px;border-radius:12px;"><div style="font-size:9.5px;color:var(--text3);text-transform:uppercase;letter-spacing:.6px;">Beating their age curve</div>'
    + [['sprint', 'Sprint speed'], ['bat', 'Bat speed'], ['arm', 'Arm']].map(function (x) { return '<div style="display:flex;justify-content:space-between;font-size:12px;margin-top:5px;"><span style="color:var(--text2);">' + x[1] + '</span><b style="color:#fff;font-family:\'DM Mono\',monospace;">' + beat(x[0]) + '</b></div>'; }).join('') + '</div></div>';
  return tiles + '<div style="font-size:11px;color:var(--text3);margin:0 2px 8px;">Sorted by ' + yN + ' WAR · bars are MLB percentiles (green 70+, red 30 or below) · click an athlete</div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;">' + rows.map(vaCardHTML).join('') + '</div>';
}
function renderValueAdded() {
  var el = document.getElementById('va-body'); if (!el) return;
  if (!VA.data && !VA.err) { el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text3);">Pulling the last 4 seasons from Baseball Savant and FanGraphs…</div>'; vaLoad().then(renderValueAdded); return; }
  if (VA.err) { el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text3);">Couldn\'t reach Baseball Savant (' + vaEsc(VA.err) + '). Check the connection and press ↻.</div>'; return; }
  var D = VA.data.D, ys = D.years.slice(1);
  var st = document.getElementById('va-stamp'); if (st) st.textContent = ys[0] + '–' + ys[ys.length - 1] + ' · updated ' + D.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + (D.failed.length ? ' · ' + D.failed.length + ' tables unavailable' : '');
  var r = VA.sel && VA.data.rows.find(function (x) { return x.roster === VA.sel; });
  el.innerHTML = (r ? vaAthleteHTML(r) : vaTeamHTML())
    + (VA.data.missing.length ? '<div style="font-size:11px;color:var(--text3);margin-top:10px;">Not found on Savant: ' + VA.data.missing.map(vaEsc).join(', ') + '</div>' : '')
    + '<details style="margin-top:14px;font-size:11px;color:var(--text3);line-height:1.6;"><summary style="cursor:pointer;">How to read this</summary><div style="padding:6px 2px;">'
    + '<b>Percentile bar</b> = where his latest season ranks among qualified MLB players (50 = average). <b>vs age</b> = his change from ' + ys[0] + ' minus the typical change for MLB players his age over the same seasons — players lose about 0.15 ft/s of sprint speed a year from their mid-20s, so holding steady is a win. <b>vs avg</b> = latest season minus the MLB average. Trend lines show ' + ys.join(', ') + ' (hover for values). '
    + 'Sources: Baseball Savant (live) and FanGraphs (WAR, wRC+, Offense, Defense, BsR — cached daily). Outcomes depend on role, playing time and health; training is one input among many.</div></details>';
}
function vaOpenAthlete(name) { VA.sel = name; renderValueAdded(); }

function vaRefresh() { VA.data = null; VA.err = null; var el = document.getElementById('va-body'); if (el) el.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text3);">Refreshing from Baseball Savant…</div>'; vaLoad(true).then(renderValueAdded); }

// Printable version (light), both views
function vaPrint() {
  if (!VA.data) return;
  if (VA.sel) return openAthleteProfile(VA.sel);   // one athlete → his printable profile (includes the Savant section)
  var D = VA.data.D, ys = D.years.slice(1), rows = VA.data.rows.slice().sort(function (a, b) { return a.roster.localeCompare(b.roster); });
  function table(keys, mode) {
    return '<table><thead><tr><th>Player</th>' + keys.map(function (k) { var m = vaM(k); return '<th>' + m.label + (m.unit && m.unit !== 'runs' ? '<br><span>' + m.unit + '</span>' : '') + '</th>'; }).join('') + '</tr></thead><tbody>'
      + rows.map(function (r) {
        return '<tr><td><b>' + vaEsc(r.roster) + '</b><br><span>' + vaEsc([r.pos, r.age ? 'age ' + r.age : ''].filter(Boolean).join(' · ')) + '</span></td>' + keys.map(function (k) {
          var m = vaM(k), x = r.metrics[k], yy = ys.filter(function (y) { return x.vals[y] != null; });
          if (!yy.length) return '<td>—</td>';
          var v = mode === 'tools' ? x.added : (x.change != null ? x.change * (m.lower ? -1 : 1) : null), t = vaTone(k, v);
          var lgv = x.lastY != null ? x.vsLg[x.lastY] : null, tl = vaTone(k, lgv);
          return '<td>' + yy.map(function (y) { return vaFmt(m, x.vals[y]); }).join(' → ') + (x.pcts[yy[yy.length - 1]] != null ? ' <span>' + vaOrd(x.pcts[yy[yy.length - 1]]) + '</span>' : '') + (v != null ? '<br><b class="' + t + '">' + (t === 'up' ? '▲ ' : t === 'down' ? '▼ ' : '● ') + vaSigned(m, v) + (mode === 'tools' ? ' vs age' : '') + '</b>' : '') + (lgv != null ? '<br><b class="' + tl + '">' + vaSigned(m, lgv) + ' vs lg</b>' : '') + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table>';
  }
  var css = 'body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;margin:24px;font-size:11px}h1{font-size:22px;margin:0}h2{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#0E3386;margin:18px 0 6px}.eb{font-size:10px;letter-spacing:.14em;color:#0E3386;font-weight:800}table{width:100%;border-collapse:collapse}th{text-align:left;font-size:9px;color:#64748b;border-bottom:1px solid #cbd5e1;padding:4px 5px;vertical-align:bottom}td{padding:5px;border-bottom:1px solid #eef2f7;vertical-align:top;font-variant-numeric:tabular-nums}span{color:#64748b;font-size:9px;font-weight:400}.up{color:#15803d}.down{color:#b91c1c}.flat{color:#475569}p{font-size:9.5px;color:#64748b;line-height:1.5}@page{size:letter landscape;margin:.4in}';
  var html = '<!doctype html><html><head><meta charset="utf-8"><title>Value Added ' + ys[0] + '–' + ys[ys.length - 1] + '</title><style>' + css + '</style></head><body>'
    + '<div class="eb">MARK WEISMAN STRENGTH &amp; CONDITIONING · VALUE ADDED</div><h1>On-field tools and value, ' + ys[0] + '–' + ys[ys.length - 1] + '</h1><p>Source: Baseball Savant, pulled ' + D.at.toLocaleDateString() + '. "vs age" = change beyond the typical change for MLB players the same age over the same seasons.</p>'
    + VA_VIEWS.map(function (vw) { return '<h2>' + vw.title.replace('&', '&amp;') + '</h2>' + table(vaKeys(vw.v).filter(function (k) { return vw.v !== 'def' || !vaM(k).catcher; }), vw.v === 'tools' ? 'tools' : 'value'); }).join('')
    + '<p>Percentiles are among qualified MLB players that season. Run values are Savant\'s (above average = positive). Training is one input among many; small single-season samples can swing.</p>'
    + '<script>setTimeout(function(){window.print()},400)<\/script></body></html>';
  var w = window.open('', '_blank'); if (!w) { alert('Allow pop-ups to print.'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

// ── Athlete profile: add an on-field (Savant) section ──
function vaProfileHTML(name) {
  if (!VA.data) return '';
  var r = VA.data.rows.find(function (x) { return x.roster === name; });
  if (!r) return '<section><h2>On-field · Baseball Savant</h2><div class="muted">Not found on Baseball Savant.</div></section>';
  var ys = r.years;
  var rows = SV.M.map(function (m) {
    var x = r.metrics[m.k]; if (!ys.some(function (y) { return x.vals[y] != null; })) return '';
    var v = m.tool ? x.added : null, t = vaTone(m.k, v), ch = x.change != null ? x.change * (m.lower ? -1 : 1) : null, tc = vaTone(m.k, ch);
    return '<tr><td>' + m.label + (m.unit && m.unit !== 'runs' ? ' <span class="muted">' + m.unit + '</span>' : '') + '</td>' + ys.map(function (y) { return '<td>' + vaFmt(m, x.vals[y]) + (x.pcts[y] != null ? ' <span class="muted">' + vaOrd(x.pcts[y]) + '</span>' : '') + '</td>'; }).join('')
      + '<td class="' + (tc === 'na' ? '' : tc) + '">' + (ch == null ? '—' : vaSigned(m, ch)) + '</td><td class="' + (t === 'na' ? '' : t) + '">' + (v == null ? (m.tool ? '—' : '') : (t === 'up' ? '▲ ' : t === 'down' ? '▼ ' : '● ') + vaSigned(m, v)) + '</td>'
      + (function () { var l = x.lastY != null ? x.vsLg[x.lastY] : null, tl = vaTone(m.k, l); return '<td class="' + (tl === 'na' ? '' : tl) + '">' + (l == null ? '—' : vaSigned(m, l)) + '</td>'; })() + '</tr>';
  }).join('');
  return '<section><h2>On-field · Baseball Savant</h2><table><thead><tr><th>Metric</th>' + ys.map(function (y) { return '<th>' + y + '</th>'; }).join('') + '<th>Change</th><th>vs age curve</th><th>vs lg avg</th></tr></thead><tbody>' + rows + '</tbody></table>'
    + '<div class="muted" style="font-size:9.5px;margin-top:4px;">Small number = MLB percentile that season. vs age curve = change beyond what is typical for MLB players his age over the same seasons. vs lg avg = latest season minus the MLB average (qualified players). WAR, Offense, Defense runs, BsR and wRC+ from FanGraphs.</div></section>';
}
(function () {
  if (typeof document === 'undefined') return;
  var css = document.createElement('style'); css.textContent = '.va-card:hover{transform:translateY(-2px);border-color:rgba(96,165,250,.45)!important;}'; document.head.appendChild(css);
  if (typeof AP !== 'undefined' && AP.render) {
    var _r = AP.render;
    AP.render = function (d, opts) {
      var h = _r.apply(this, arguments);
      var sec = VA.data ? vaProfileHTML(d.name) : '<section><h2>On-field · Baseball Savant</h2><div class="muted">Loading from Baseball Savant…</div></section>';
      return h.replace('<div class="two">', sec + '<div class="two">');
    };
  }
  if (typeof openAthleteProfile === 'function') {
    var _o = openAthleteProfile;
    openAthleteProfile = function (name, opts) {
      var w = _o.apply(this, arguments);
      if (!VA.data && w) vaLoad().then(function () { try { if (!w.closed) _o(name, Object.assign({}, opts || {}, { win: w })); } catch (e) {} });
      return w;
    };
  }
  if (typeof switchTab === 'function') {
    var _s = switchTab;
    switchTab = function (page) { var x = _s.apply(this, arguments); if (page === 'value') renderValueAdded(); return x; };
  }
})();
