// ═══════════════════════════════════════════════════════════════════════════
// Jump Profile → KPI Links: how CMJ relates to sprint speed and bat speed.
// Joins each athlete's CMJ season (avg / best / 90th of his sessions that year,
// seasons with 5+ CMJs) to his Baseball Savant season (sprint speed, bat speed).
//  • Between athletes: each athlete's average over his seasons → scatter + r.
//  • Within athlete: seasons vs his own average → does he run/swing faster in
//    the years he jumps better?
// Needs value-added.js (vaLoad / VA) and savant.js (SV).
// ═══════════════════════════════════════════════════════════════════════════
var JK = { view: 'athletes', kpi: 'sprint', stat: 'avg', metric: null, loading: false, err: null };
var JK_KPI = {
  sprint: { k: 'sprint', label: 'Sprint speed', unit: 'ft/s', dec: 1, gap: 0.4, ahead: 'Runs faster than his jump predicts', behind: 'Jump says more speed is available', aheadTip: 'sprint mechanics / elastic qualities are a strength', behindTip: 'the engine is there; acceleration and max-V technique are the lever' },
  bat: { k: 'bat', label: 'Bat speed', unit: 'mph', dec: 1, gap: 1.0, ahead: 'Swings faster than his jump predicts', behind: 'Jump says more bat speed is available', aheadTip: 'sequencing / rotational skill is a strength', behindTip: 'the lower half produces force; rotational transfer and sequencing are the lever' }
};
var JK_STATS = { avg: 'Season average', best: 'Season best', p90: '90th percentile' };
var JK_MIN_CMJ = 5, JK_MIN_VOL = 50;

async function jkEnsureSavant() {
  if (typeof VA !== 'undefined' && VA.data && VA.data.D) return VA.data.D;
  if (JK.loading) return null;
  JK.loading = true; JK.err = null;
  try { if (typeof vaLoad === 'function') await vaLoad(); if (!VA.data || !VA.data.D) throw new Error(VA.err || 'Savant data unavailable'); }
  catch (e) { JK.err = e.message || String(e); }
  JK.loading = false;
  return VA.data && VA.data.D;
}
function jkPear(a, b) {
  var n = a.length; if (n < 3) return null;
  var ma = jpMean(a), mb = jpMean(b), sab = 0, saa = 0, sbb = 0;
  for (var i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) * (a[i] - ma); sbb += (b[i] - mb) * (b[i] - mb); }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : null;
}
// |r| needed for p < .05 (two-sided) with n points
function jkRcrit(n) { var df = n - 2; if (df < 1) return 1; var t = 1.96 + 2.4 / df + 2.5 / (df * df); return t / Math.sqrt(df + t * t); }
function jkStrength(r) { var a = Math.abs(r); return a < 0.3 ? 'little to no' : a < 0.5 ? 'a weak' : a < 0.7 ? 'a moderate' : 'a strong'; }

// Player-seasons with both CMJ (5+ tests) and the KPI (enough volume)
function jkSeasons(D, kpi) {
  var names = jpNames(), match = SV.matchRoster(D, names), out = [];
  JP.rows.filter(function (r) { return r.type === 'CMJ'; }).forEach(function (r) {
    var sv = match[r.name]; if (!sv || !r.metrics.jh) return;
    Object.keys(r.metrics.jh.stats).forEach(function (y) {
      var s = sv.seasons && sv.seasons[y], st = r.metrics.jh.stats[y];
      if (!s || st.n < JK_MIN_CMJ || s[kpi] == null) return;
      if (s._vol && s._vol[kpi] != null && s._vol[kpi] < JK_MIN_VOL) return;
      out.push({ name: r.name, y: y, n: st.n, kpi: s[kpi], r: r });
    });
  });
  return out;
}
function jkVal(ps, k, stat) { var x = ps.r.metrics[k]; return x && x.stats[ps.y] ? x.stats[ps.y][stat] : null; }
// Between (player means) and within (season minus player mean) for one metric
function jkAnalyze(S, k, stat) {
  var by = {}; S.forEach(function (ps) { var v = jkVal(ps, k, stat); if (v == null) return; (by[ps.name] = by[ps.name] || []).push({ x: v, y: ps.kpi, yr: ps.y, n: ps.n }); });
  var pts = Object.keys(by).map(function (n) { var a = by[n]; return { name: n, x: jpMean(a.map(function (p) { return p.x; })), y: jpMean(a.map(function (p) { return p.y; })), seasons: a }; });
  var wx = [], wy = [];
  Object.keys(by).forEach(function (n) { var a = by[n]; if (a.length < 2) return; var mx = jpMean(a.map(function (p) { return p.x; })), my = jpMean(a.map(function (p) { return p.y; })); a.forEach(function (p) { wx.push(p.x - mx); wy.push(p.y - my); }); });
  var r = pts.length >= 5 ? jkPear(pts.map(function (p) { return p.x; }), pts.map(function (p) { return p.y; })) : null;
  var nW = Object.keys(by).filter(function (n) { return by[n].length >= 2; }).length;
  var rw = wx.length >= 6 ? jkPear(wx, wy) : null;
  // least-squares line
  var line = null;
  if (r != null) { var mx = jpMean(pts.map(function (p) { return p.x; })), my = jpMean(pts.map(function (p) { return p.y; })), sxy = 0, sxx = 0; pts.forEach(function (p) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) * (p.x - mx); }); var b = sxx ? sxy / sxx : 0; line = { a: my - b * mx, b: b }; }
  return { k: k, pts: pts, r: r, n: pts.length, rw: rw, nW: nW, nWs: wx.length, line: line, sig: r != null && Math.abs(r) >= jkRcrit(pts.length) };
}
function jkNice(lo, hi, n) {
  var span = hi - lo || 1, step = Math.pow(10, Math.floor(Math.log10(span / n))), err = span / n / step;
  step *= err >= 7.5 ? 10 : err >= 3 ? 5 : err >= 1.5 ? 2 : 1;
  var t = [], s = Math.ceil(lo / step) * step; for (var v = s; v <= hi + 1e-9; v += step) t.push(+v.toFixed(10)); return t;
}
function jkScatter(A, m, K) {
  var W = 620, H = 340, L = 54, R = 16, T = 14, B = 44;
  var xs = A.pts.map(function (p) { return p.x; }), ys = A.pts.map(function (p) { return p.y; });
  var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
  var px = (x1 - x0) * 0.1 || 1, py = (y1 - y0) * 0.12 || 0.5; x0 -= px; x1 += px; y0 -= py; y1 += py;
  var X = function (v) { return L + (W - L - R) * (v - x0) / (x1 - x0); }, Y = function (v) { return T + (H - T - B) * (1 - (v - y0) / (y1 - y0)); };
  var g = '';
  jkNice(y0, y1, 5).forEach(function (t) { g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(t).toFixed(1) + '" y2="' + Y(t).toFixed(1) + '" stroke="rgba(255,255,255,.07)"/><text x="' + (L - 8) + '" y="' + (Y(t) + 3.5).toFixed(1) + '" text-anchor="end" font-size="10" fill="#94a3b8">' + t + '</text>'; });
  jkNice(x0, x1, 6).forEach(function (t) { g += '<line y1="' + T + '" y2="' + (H - B) + '" x1="' + X(t).toFixed(1) + '" x2="' + X(t).toFixed(1) + '" stroke="rgba(255,255,255,.04)"/><text y="' + (H - B + 15) + '" x="' + X(t).toFixed(1) + '" text-anchor="middle" font-size="10" fill="#94a3b8">' + t + '</text>'; });
  g += '<text x="' + ((L + W - R) / 2) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="11" fill="#cbd5e1">' + jpEsc(m.label) + (m.unit ? ' (' + m.unit + ')' : '') + ' · ' + JK_STATS[JK.stat].toLowerCase() + '</text>';
  g += '<text transform="translate(13,' + ((T + H - B) / 2) + ') rotate(-90)" text-anchor="middle" font-size="11" fill="#cbd5e1">' + K.label + ' (' + K.unit + ')</text>';
  if (A.line) { var la = A.line; g += '<line x1="' + X(x0) + '" x2="' + X(x1) + '" y1="' + Y(la.a + la.b * x0).toFixed(1) + '" y2="' + Y(la.a + la.b * x1).toFixed(1) + '" stroke="#93c5fd" stroke-opacity=".45" stroke-width="2" stroke-dasharray="6 5" clip-path="url(#jkclip)"/>'; }
  A.pts.slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (p) {
    var cx = X(p.x).toFixed(1), cy = Y(p.y).toFixed(1), last = p.name.split(' ').slice(-1)[0], right = X(p.x) < W - 110;
    var tip = p.name + '\n' + m.label + ': ' + jpFmt(m, p.x) + ' ' + (m.unit || '') + '\n' + K.label + ': ' + p.y.toFixed(K.dec) + ' ' + K.unit + '\n' + p.seasons.length + ' season' + (p.seasons.length > 1 ? 's' : '') + ' (' + p.seasons.map(function (s) { return s.yr; }).join(', ') + ')';
    g += '<g class="jk-pt" style="cursor:pointer;" onclick="JP.sel=\'' + p.name.replace(/'/g, "\\'") + '\';JP.type=\'CMJ\';renderJumpProfile();window.scrollTo({top:0})"><title>' + jpEsc(tip) + '</title><circle cx="' + cx + '" cy="' + cy + '" r="14" fill="transparent"/><circle cx="' + cx + '" cy="' + cy + '" r="6" fill="#60a5fa" stroke="#0f172a" stroke-width="2"/>'
      + '<text x="' + (+cx + (right ? 10 : -10)) + '" y="' + (+cy + 4) + '" text-anchor="' + (right ? 'start' : 'end') + '" font-size="11" fill="#e2e8f0">' + jpEsc(last) + '</text></g>';
  });
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;display:block;" role="img" aria-label="' + jpEsc(m.label + ' vs ' + K.label) + '"><defs><clipPath id="jkclip"><rect x="' + L + '" y="' + T + '" width="' + (W - L - R) + '" height="' + (H - T - B) + '"/></clipPath></defs>' + g + '</svg>';
}
function jkRbar(r, sig) {
  if (r == null) return '<span style="font-size:10px;color:var(--text3);">—</span>';
  var w = Math.min(50, Math.abs(r) * 50), c = Math.abs(r) < 0.3 ? '#64748b' : sig ? '#60a5fa' : '#93c5fd';
  return '<div style="position:relative;height:8px;background:rgba(255,255,255,.06);border-radius:4px;"><div style="position:absolute;left:50%;top:-2px;bottom:-2px;width:1px;background:rgba(255,255,255,.25);"></div><div style="position:absolute;top:0;bottom:0;' + (r >= 0 ? 'left:50%' : 'right:50%') + ';width:' + w + '%;background:' + c + ';opacity:' + (sig ? 1 : .55) + ';border-radius:' + (r >= 0 ? '0 4px 4px 0' : '4px 0 0 4px') + ';"></div></div>';
}
function jkHTML() {
  var K = JK_KPI[JK.kpi];
  if (!(typeof VA !== 'undefined' && VA.data && VA.data.D)) {
    if (!JK.loading && !JK.err) jkEnsureSavant().then(renderJumpProfile);
    return '<div class="card" style="padding:40px;text-align:center;color:var(--text3);">' + (JK.err ? 'Couldn\'t load Baseball Savant data (' + jpEsc(JK.err) + ').' : 'Loading Baseball Savant seasons…') + '</div>';
  }
  var S = jkSeasons(VA.data.D, K.k);
  var keys = JP_M.map(function (m) { return m.k; });
  var res = keys.map(function (k) { return jkAnalyze(S, k, jpM(k).dir === 0 ? 'avg' : JK.stat); }).filter(function (a) { return a.r != null; });
  res.sort(function (a, b) { return Math.abs(b.r) - Math.abs(a.r); });
  if (!res.length) return '<div class="card" style="padding:30px;text-align:center;color:var(--text3);">Not enough athletes with both CMJ (' + JK_MIN_CMJ + '+ tests in a season) and ' + K.label.toLowerCase() + ' yet.</div>';
  if (!JK.metric || !res.some(function (a) { return a.k === JK.metric; })) JK.metric = res[0].k;
  var A = res.find(function (a) { return a.k === JK.metric; }), m = jpM(A.k);
  var seasons = S.length, players = {}; S.forEach(function (s) { players[s.name] = 1; });
  var btn = function (on, js, label) { return '<button onclick="' + js + '" style="padding:6px 14px;border-radius:7px;border:none;font-size:12px;font-weight:700;cursor:pointer;background:' + (on ? '#0E3386' : 'transparent') + ';color:' + (on ? '#fff' : 'var(--text2)') + ';">' + label + '</button>'; };
  var controls = '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px;">'
    + '<div style="display:flex;gap:4px;background:rgba(255,255,255,.04);padding:3px;border-radius:9px;">' + Object.keys(JK_KPI).map(function (k) { return btn(JK.kpi === k, 'JK.kpi=\'' + k + '\';JK.metric=null;renderJumpProfile()', (k === 'sprint' ? '🏃 ' : '⚾ ') + JK_KPI[k].label); }).join('') + '</div>'
    + '<div style="display:flex;gap:4px;background:rgba(255,255,255,.04);padding:3px;border-radius:9px;">' + Object.keys(JK_STATS).map(function (s) { return btn(JK.stat === s, 'JK.stat=\'' + s + '\';renderJumpProfile()', JK_STATS[s]); }).join('') + '</div>'
    + '<div style="margin-left:auto;font-size:11px;color:var(--text3);">' + Object.keys(players).length + ' athletes · ' + seasons + ' seasons with ' + JK_MIN_CMJ + '+ CMJs and ' + K.label.toLowerCase() + '</div></div>';
  // Left: metric ranking
  var list = '<div class="card" style="padding:14px 16px;border-radius:12px;">'
    + '<div style="font-size:13px;font-weight:800;color:#fff;margin-bottom:2px;">Which CMJ metrics track ' + K.label.toLowerCase() + '</div>'
    + '<div style="font-size:10.5px;color:var(--text3);margin-bottom:8px;">r from −1 to +1 · solid bar = unlikely to be chance (p &lt; .05) · click a metric</div>'
    + '<div style="display:grid;grid-template-columns:1fr 90px 40px 54px;gap:8px;font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;padding-bottom:4px;"><div></div><div style="text-align:center;">Between athletes</div><div style="text-align:right;">r</div><div style="text-align:right;" title="Within athlete: in seasons he jumps better than his own average, is his ' + K.label.toLowerCase() + ' higher too?">His own yrs</div></div>'
    + res.map(function (a) {
      var mm = jpM(a.k), on = a.k === JK.metric;
      return '<div onclick="JK.metric=\'' + a.k + '\';renderJumpProfile()" style="display:grid;grid-template-columns:1fr 90px 40px 54px;gap:8px;align-items:center;padding:6px 6px;margin:0 -6px;border-radius:7px;cursor:pointer;background:' + (on ? 'rgba(96,165,250,.12)' : 'transparent') + ';">'
        + '<div style="font-size:11.5px;color:' + (on ? '#fff' : '#cbd5e1') + ';font-weight:' + (on ? 700 : 500) + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + jpEsc(mm.label) + (mm.dir === -1 ? ' <span style="color:var(--text3);font-weight:400;">↓</span>' : '') + '</div>'
        + jkRbar(a.r, a.sig) + '<div style="text-align:right;font-family:\'DM Mono\',monospace;font-size:11.5px;font-weight:700;color:' + (a.sig ? '#fff' : 'var(--text2)') + ';">' + a.r.toFixed(2) + '</div>'
        + '<div style="text-align:right;font-family:\'DM Mono\',monospace;font-size:11px;color:var(--text3);">' + (a.rw != null ? a.rw.toFixed(2) : '—') + '</div></div>';
    }).join('') + '<div style="font-size:10px;color:var(--text3);margin-top:8px;line-height:1.5;">↓ = lower is better, so a negative r is the "good" direction there. With ' + A.n + ' athletes, |r| ≥ ' + jkRcrit(A.n).toFixed(2) + ' is needed for p &lt; .05.</div></div>';
  // Right: scatter + read
  var read = (A.r >= 0 ? 'Higher ' : 'Higher ') + m.label.toLowerCase() + ' goes with ' + (A.r >= 0 ? 'higher' : 'lower') + ' ' + K.label.toLowerCase() + ' — ' + jkStrength(A.r) + ' relationship (r = ' + A.r.toFixed(2) + ', ' + A.n + ' athletes' + (A.sig ? ', unlikely to be chance' : ', could be chance at this sample size') + ').'
    + (A.line && Math.abs(A.r) >= 0.3 ? ' Each +' + (m.step) + ' ' + (m.unit || '') + ' ≈ ' + (A.line.b * m.step >= 0 ? '+' : '−') + Math.abs(A.line.b * m.step).toFixed(2) + ' ' + K.unit + '.' : '')
    + (A.rw != null ? ' Within his own seasons: r = ' + A.rw.toFixed(2) + ' (' + A.nW + ' athletes with 2+ seasons).' : '');
  var chart = '<div class="card" style="padding:14px 16px;border-radius:12px;">'
    + '<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;"><span style="font-size:13px;font-weight:800;color:#fff;">' + jpEsc(m.label) + ' vs ' + K.label + '</span><span style="font-size:10.5px;color:var(--text3);">each dot = one athlete, averaged over his seasons · dashed = trend · click a dot to open him</span></div>'
    + '<div style="margin:8px 0 4px;">' + jkScatter(A, m, K) + '</div>'
    + '<div style="font-size:12px;color:#cbd5e1;line-height:1.55;">' + jpEsc(read) + '</div></div>';
  // Ahead / behind the line
  var gaps = '';
  if (A.line && Math.abs(A.r) >= 0.4) {
    var rs = A.pts.map(function (p) { var pred = A.line.a + A.line.b * p.x; return { name: p.name, x: p.x, y: p.y, pred: pred, d: p.y - pred }; }).sort(function (a, b) { return b.d - a.d; });
    gaps = '<div class="card" style="padding:14px 16px;border-radius:12px;grid-column:1/-1;">'
      + '<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:6px;"><span style="font-size:13px;font-weight:800;color:#fff;">Who\'s ahead of / behind his jump</span><span style="font-size:10.5px;color:var(--text3);">actual ' + K.label.toLowerCase() + ' vs what his ' + jpEsc(m.label.toLowerCase()) + ' predicts · ±' + K.gap + ' ' + K.unit + ' = meaningful</span></div>'
      + '<div style="display:grid;grid-template-columns:150px 90px 90px 90px 1fr;gap:10px;font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;padding:2px 0 4px;"><div></div><div style="text-align:right;">' + jpEsc(m.label.split(' ')[0]) + '</div><div style="text-align:right;">Predicted</div><div style="text-align:right;">Actual</div><div></div></div>'
      + rs.map(function (r) {
        var t = r.d >= K.gap ? 'up' : r.d <= -K.gap ? 'down' : 'flat';
        var txt = t === 'up' ? '▲ ' + K.ahead + ' — ' + K.aheadTip : t === 'down' ? '▼ ' + K.behind + ' — ' + K.behindTip : 'In line with his jump';
        return '<div style="display:grid;grid-template-columns:150px 90px 90px 90px 1fr;gap:10px;align-items:center;padding:7px 0;border-top:1px solid rgba(255,255,255,.05);">'
          + '<div style="font-size:12px;color:#e2e8f0;font-weight:600;">' + jpEsc(r.name) + '</div>'
          + '<div style="text-align:right;font-family:\'DM Mono\',monospace;font-size:12px;color:var(--text2);">' + jpFmt(m, r.x) + '</div>'
          + '<div style="text-align:right;font-family:\'DM Mono\',monospace;font-size:12px;color:var(--text2);">' + r.pred.toFixed(K.dec) + '</div>'
          + '<div style="text-align:right;font-family:\'DM Mono\',monospace;font-size:13px;font-weight:800;color:#fff;">' + r.y.toFixed(K.dec) + ' <span style="font-size:10.5px;font-weight:700;color:' + JP_COL[t] + ';">' + (r.d >= 0 ? '+' : '−') + Math.abs(r.d).toFixed(K.dec) + '</span></div>'
          + '<div style="font-size:11px;color:' + (t === 'flat' ? 'var(--text3)' : JP_COL[t]) + ';">' + txt + '</div></div>';
      }).join('') + '</div>';
  } else {
    gaps = '<div class="card" style="padding:12px 16px;border-radius:12px;grid-column:1/-1;font-size:11.5px;color:var(--text3);">The link between ' + jpEsc(m.label.toLowerCase()) + ' and ' + K.label.toLowerCase() + ' is too weak (|r| &lt; 0.4) to predict anyone\'s ' + K.label.toLowerCase() + ' from his jump, so there\'s no ahead/behind list for this metric. ' + (JK.kpi === 'bat' ? 'For bat speed, absolute peak power (W) and bodyweight carry more than jump height or power per kg — bigger engines swing harder — and rotational / upper-body tests will likely say more.' : '') + '</div>';
  }
  return controls + '<div style="display:grid;grid-template-columns:minmax(300px,380px) minmax(0,1fr);gap:14px;" class="jk-grid">' + list + chart + gaps + '</div>'
    + '<div style="font-size:10.5px;color:var(--text3);margin-top:10px;line-height:1.6;">Small sample: these are pointers, not proof. A season counts when he had ' + JK_MIN_CMJ + '+ CMJs that calendar year and ' + JK_MIN_VOL + '+ ' + (JK.kpi === 'sprint' ? 'sprint opportunities' : 'competitive swings') + '. Between athletes compares people; "his own yrs" asks whether the same athlete is faster in the years he jumps better — the more useful question for training.</div>';
}
// Athlete view: his seasons, CMJ next to sprint and bat speed
function jkAthleteCard(name) {
  if (!(typeof VA !== 'undefined' && VA.data && VA.data.D)) { if (!JK.loading && !JK.err) jkEnsureSavant().then(function () { if (JP.sel === name) renderJumpProfile(); }); return ''; }
  var r = JP.rows.find(function (x) { return x.name === name && x.type === 'CMJ'; }); if (!r || !r.metrics.jh) return '';
  var sv = SV.matchRoster(VA.data.D, [name])[name]; if (!sv) return '';
  var cols = [['jh', 'Jump ht'], ['ppbm', 'Power/BM'], ['pp', 'Peak power'], ['rsi', 'RSI-mod']];
  var ys = Object.keys(r.metrics.jh.stats).filter(function (y) { return sv.seasons && sv.seasons[y]; }).sort().reverse();
  if (!ys.length) return '';
  var G = '60px repeat(' + cols.length + ',1fr) 1px 1fr 1fr';
  return '<div class="card" style="padding:14px 16px;border-radius:12px;grid-column:1/-1;overflow-x:auto;">'
    + '<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:6px;"><span style="font-size:15px;">🔗</span><span style="font-size:13px;font-weight:800;color:#fff;">Jumps vs sprint &amp; bat speed</span><span style="font-size:10.5px;color:var(--text3);">CMJ season average next to his Savant season</span><button onclick="JP.sel=null;JK.view=\'kpi\';renderJumpProfile();window.scrollTo({top:0})" style="margin-left:auto;padding:4px 10px;background:transparent;border:1px solid var(--border2);border-radius:7px;color:var(--text2);font-size:11px;cursor:pointer;">Team KPI links →</button></div>'
    + '<div style="display:grid;grid-template-columns:' + G + ';gap:10px;font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;padding:2px 0 4px;min-width:640px;"><div>Season</div>' + cols.map(function (c) { return '<div style="text-align:right;">' + c[1] + '</div>'; }).join('') + '<div></div><div style="text-align:right;">Sprint ft/s</div><div style="text-align:right;">Bat speed mph</div></div>'
    + ys.map(function (y) {
      var s = sv.seasons[y], n = r.metrics.jh.stats[y].n;
      var kv = function (k, dec) { var ok = s[k] != null && !(s._vol && s._vol[k] != null && s._vol[k] < JK_MIN_VOL); return ok ? (+s[k]).toFixed(dec) : '—'; };
      return '<div style="display:grid;grid-template-columns:' + G + ';gap:10px;align-items:center;padding:7px 0;border-top:1px solid rgba(255,255,255,.05);min-width:640px;">'
        + '<div style="font-size:12px;color:#e2e8f0;font-weight:700;">' + y + ' <span style="font-size:9.5px;color:var(--text3);font-weight:400;">' + n + '</span></div>'
        + cols.map(function (c) { var x = r.metrics[c[0]] && r.metrics[c[0]].stats[y]; return '<div style="text-align:right;font-family:\'DM Mono\',monospace;font-size:12px;color:' + (n < JK_MIN_CMJ ? 'var(--text3)' : '#e2e8f0') + ';">' + (x ? jpFmt(jpM(c[0]), x.avg) : '—') + '</div>'; }).join('')
        + '<div style="background:rgba(255,255,255,.08);align-self:stretch;"></div>'
        + '<div style="text-align:right;font-family:\'DM Mono\',monospace;font-size:13px;font-weight:800;color:#fff;">' + kv('sprint', 1) + '</div>'
        + '<div style="text-align:right;font-family:\'DM Mono\',monospace;font-size:13px;font-weight:800;color:#fff;">' + kv('bat', 1) + '</div></div>';
    }).join('') + '<div style="font-size:10px;color:var(--text3);margin-top:6px;">Small number after the year = CMJ sessions that year (grey when under ' + JK_MIN_CMJ + ').</div></div>';
}
// ── Hooks into Jump Profile ────────────────────────────────────────────────
(function () {
  if (typeof renderJumpProfile !== 'function') return;
  var _render = renderJumpProfile;
  renderJumpProfile = function () {
    var el = document.getElementById('jp-body');
    if (!el || JP.sel || !JP.data || JP.err || !JP.rows || !JP.rows.length) return _render.apply(this, arguments);
    var tabs = '<div style="display:flex;gap:4px;background:rgba(255,255,255,.04);padding:3px;border-radius:9px;width:max-content;margin-bottom:14px;">'
      + [['athletes', '👥 Athletes'], ['kpi', '🔗 KPI links']].map(function (t) { var on = JK.view === t[0]; return '<button onclick="JK.view=\'' + t[0] + '\';renderJumpProfile()" style="padding:6px 16px;border-radius:7px;border:none;font-size:12px;font-weight:700;cursor:pointer;background:' + (on ? '#0E3386' : 'transparent') + ';color:' + (on ? '#fff' : 'var(--text2)') + ';">' + t[1] + '</button>'; }).join('') + '</div>';
    if (JK.view === 'kpi') { el.innerHTML = tabs + jkHTML() + jpHowTo(); return; }
    _render.apply(this, arguments);
    el.insertAdjacentHTML('afterbegin', tabs);
  };
  var _ath = jpAthleteHTML;
  jpAthleteHTML = function (name) {
    var h = _ath.apply(this, arguments);
    if (JP.type !== 'CMJ') return h;
    var card = jkAthleteCard(name); if (!card) return h;
    // append inside the section grid (last closing div)
    var i = h.lastIndexOf('</div>'); return i > 0 ? h.slice(0, i) + card + h.slice(i) : h + card;
  };
  if (typeof document !== 'undefined' && !document.getElementById('jk-style')) {
    var st = document.createElement('style'); st.id = 'jk-style';
    st.textContent = '.jk-pt:hover circle:nth-of-type(2){r:8;fill:#93c5fd}@media (max-width:900px){.jk-grid{grid-template-columns:1fr !important}}';
    document.head.appendChild(st);
  }
})();
if (typeof module !== 'undefined') module.exports = { jkAnalyze: jkAnalyze, jkPear: jkPear, jkRcrit: jkRcrit };
