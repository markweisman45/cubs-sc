// ═══════════════════════════════════════════════════════════════════════════
// Jump Profile — ForceDecks CMJ and ABCMJ from VALD Hub, one view per athlete.
// Each test session uses VALD's "Max" logic: every metric is its best value across
// all trials that day (lowest for contraction time / braking duration). CMJ and ABCMJ are kept separate.
// Data: cloud key "cache:vald-jumps" in cubs_sc_data (written by the VALD sync,
// never pulled into localStorage).
// ═══════════════════════════════════════════════════════════════════════════
var JP = { sel: null, type: 'CMJ', data: null, err: null, cmp: null, normGrp: null };
// dir: 1 higher is better, -1 lower is better, 0 context only. step = meaningful change.
var JP_M = [
  { k: 'jh', label: 'Jump height', unit: 'cm', dec: 1, dir: 1, step: 1.5, sec: 'out', hero: 1 },
  { k: 'ppbm', label: 'Peak power / BM', unit: 'W/kg', dec: 1, dir: 1, step: 2, sec: 'out', hero: 1 },
  { k: 'vto', label: 'Takeoff velocity', unit: 'm/s', dec: 2, dir: 1, step: 0.05, sec: 'out' },
  { k: 'pp', label: 'Peak power', unit: 'W', dec: 0, dir: 1, step: 150, sec: 'out' },
  { k: 'rsi', label: 'RSI-modified', unit: 'm/s', dec: 2, dir: 1, step: 0.04, sec: 'strat', hero: 1 },
  { k: 'ftct', label: 'Flight time : contraction time', unit: '', dec: 2, dir: 1, step: 0.05, sec: 'strat' },
  { k: 'ct', label: 'Contraction time', unit: 'ms', dec: 0, dir: -1, step: 30, sec: 'strat' },
  { k: 'bpd', label: 'Braking phase duration', unit: 'ms', dec: 0, dir: -1, step: 25, sec: 'strat' },
  { k: 'depth', label: 'Countermovement depth', unit: 'cm', dec: 1, dir: 0, step: 3, sec: 'strat' },
  { k: 'edrfd', label: 'Eccentric decel RFD / BM', unit: 'N/s/kg', dec: 0, dir: 1, step: 8, sec: 'ecc', hero: 1 },
  { k: 'ebrfd', label: 'Eccentric braking RFD / BM', unit: 'N/s/kg', dec: 0, dir: 1, step: 8, sec: 'ecc' },
  { k: 'epf', label: 'Eccentric peak force / BM', unit: 'N/kg', dec: 1, dir: 1, step: 1, sec: 'ecc' },
  { k: 'cimp', label: 'Concentric impulse', unit: 'N·s', dec: 0, dir: 1, step: 8, sec: 'con' },
  { k: 'cmf', label: 'Concentric mean force / BM', unit: 'N/kg', dec: 1, dir: 1, step: 0.8, sec: 'con' },
  { k: 'cpf', label: 'Concentric peak force / BM', unit: 'N/kg', dec: 1, dir: 1, step: 1, sec: 'con' },
  { k: 'p1', label: 'P1 concentric impulse', unit: 'N·s', dec: 0, dir: 1, step: 6, sec: 'con' },
  { k: 'p2', label: 'P2 concentric impulse', unit: 'N·s', dec: 0, dir: 1, step: 6, sec: 'con' },
  { k: 'bw', label: 'Body weight', unit: 'lb', dec: 1, dir: 0, step: 4, sec: 'bw' }
];
// Asymmetry thresholds (watch / flag). Landing force is naturally noisy, so it gets wider bands.
var JP_ASYM = [
  { k: 'cimp', label: 'Concentric impulse', watch: 10, flag: 15 },
  { k: 'edimp', label: 'Eccentric decel impulse', watch: 10, flag: 15 },
  { k: 'plf', label: 'Peak landing force', watch: 25, flag: 35, noisy: 1 }
];
// VALD stores some results in base units; multiply to display units (syncs from now on arrive scaled)
var JP_SCALE = { bw: 2.20462, rsi: 0.01, ct: 1000, bpd: 1000 };
function jpScale(D) {
  if (!D || D.scaled) return D;
  Object.keys(D.players || {}).forEach(function (n) { (D.players[n] || []).forEach(function (t) { Object.keys(JP_SCALE).forEach(function (k) { if (t.v && t.v[k] != null) t.v[k] = t.v[k] * JP_SCALE[k]; }); }); });
  D.scaled = true; return D;
}
var JP_SECTIONS = [
  { s: 'out', icon: '🚀', title: 'Output', sub: 'how high and how powerful' },
  { s: 'strat', icon: '⏱', title: 'Explosiveness & strategy', sub: 'how fast he gets there' },
  { s: 'ecc', icon: '🛑', title: 'Eccentric / braking', sub: 'loading and decelerating' },
  { s: 'con', icon: '⬆️', title: 'Concentric / propulsion', sub: 'force he produces going up' }
];
var JP_AB = ['jh', 'ppbm', 'vto', 'rsi', 'pp', 'bw'];   // ABCMJ shows output metrics only
function jpM(k) { return JP_M.find(function (m) { return m.k === k; }); }
function jpEsc(x) { return typeof escHtml === 'function' ? escHtml(String(x == null ? '' : x)) : String(x == null ? '' : x); }
function jpFmt(m, v) { if (v == null || isNaN(v)) return '—'; var s = (+v).toFixed(m.dec); return /^-0(\.0+)?$/.test(s) ? s.slice(1) : s; }
function jpSigned(m, v, pct) { if (v == null || isNaN(v)) return ''; var a = Math.abs(v).toFixed(pct ? 1 : m.dec === 0 ? 0 : Math.max(1, m.dec)); return ((v >= 0 || /^0(\.0+)?$/.test(a)) ? '+' : '−') + a + (pct ? '%' : ''); }
// Percentile with linear interpolation (p in 0..1)
function jpPctl(a, p) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }), i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); }
var JP_P90_MIN = 5;   // tests needed in a season before a 90th percentile is shown
function jpMed(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }); var h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; }
function jpMean(a) { return a.length ? a.reduce(function (t, x) { return t + x; }, 0) / a.length : null; }
function jpSd(a) { var m = jpMean(a); return a.length > 2 ? Math.sqrt(a.reduce(function (t, x) { return t + (x - m) * (x - m); }, 0) / (a.length - 1)) : null; }
function jpAddDays(iso, n) { var p = iso.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function jpFd(iso) { if (!iso) return '—'; var p = iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }

async function jpLoad() {
  JP.err = null;
  try {
    var db = typeof getSupaClient === 'function' ? getSupaClient() : null;
    if (!db) throw new Error('Cloud not connected');
    var r = await db.from('cubs_sc_data').select('value').eq('key', 'cache:vald-jumps').maybeSingle();
    if (r.error) throw r.error;
    JP.data = jpScale(r.data && r.data.value ? JSON.parse(r.data.value) : { players: {}, scaled: true });
    JP.rows = jpBuild(JP.data);
  } catch (e) { JP.err = e.message || String(e); }
  return JP.data;
}
// Per athlete & test type: season values, latest, best, baseline, team rank
function jpBuild(D) {
  var rows = [];
  Object.keys(D.players || {}).forEach(function (name) {
    var tests = D.players[name]; if (!Array.isArray(tests)) return;
    ['CMJ', 'ABCMJ'].forEach(function (type) {
      var T = tests.filter(function (t) { return t.t === type && t.v && t.v.jh != null; });
      if (!T.length) return;
      var years = {}; T.forEach(function (t) { years[t.d.slice(0, 4)] = 1; });
      var ys = Object.keys(years).sort();
      var last = T[T.length - 1], res = { name: name, type: type, n: T.length, first: T[0].d, last: last.d, years: ys, metrics: {}, asym: {} };
      JP_M.forEach(function (m) {
        var pts = T.filter(function (t) { return t.v[m.k] != null; }).map(function (t) { return { d: t.d, v: m.k === 'depth' ? Math.abs(t.v[m.k]) : t.v[m.k] }; });   // VALD reports depth as negative; show how deep
        if (!pts.length) return;
        var season = {}, stats = {}; ys.forEach(function (y) {
          var vs = pts.filter(function (p) { return p.d.slice(0, 4) === y; }).map(function (p) { return p.v; });
          if (vs.length) {
            season[y] = m.dir === -1 ? Math.min.apply(null, vs) : m.dir === 1 ? Math.max.apply(null, vs) : jpMed(vs);
            // 90th percentile of HIS performance: the 10th percentile value when lower is better
            stats[y] = { best: season[y], avg: jpMean(vs), p90: vs.length >= JP_P90_MIN && m.dir ? jpPctl(vs, m.dir === -1 ? 0.1 : 0.9) : null, n: vs.length };
          }
        });
        var lp = pts[pts.length - 1];
        // His norm: tests in the 90 days before the latest one
        var base = pts.filter(function (p) { return p.d < lp.d && p.d >= jpAddDays(lp.d, -90); }).map(function (p) { return p.v; });
        var bm = base.length >= 3 ? jpMean(base) : null, bsd = base.length >= 5 ? jpSd(base) : null;
        var bestP = pts.reduce(function (a, b) { return m.dir === -1 ? (b.v < a.v ? b : a) : (b.v > a.v ? b : a); });
        var sy = Object.keys(season).sort(), y1 = sy[sy.length - 1], y0 = sy.length > 1 ? sy[sy.length - 2] : null;
        res.metrics[m.k] = { pts: pts, season: season, stats: stats, latest: lp, best: bestP, base: bm, z: bm != null && bsd ? (lp.v - bm) / bsd : null,
          vsNorm: bm ? (lp.v - bm) / Math.abs(bm) * 100 * (m.dir || 1) : null,
          yoy: y0 ? (season[y1] - season[y0]) * (m.dir || 1) : null, yoyPct: y0 && season[y0] ? (season[y1] - season[y0]) / Math.abs(season[y0]) * 100 * (m.dir || 1) : null, y0: y0, y1: y1 };
      });
      JP_ASYM.forEach(function (a) {
        var recent = T.filter(function (t) { return t.a && t.a[a.k] != null; }).slice(-5).map(function (t) { return Math.abs(t.a[a.k]); });
        if (recent.length) res.asym[a.k] = { med: jpMed(recent), n: recent.length, last: Math.abs((T.filter(function (t) { return t.a && t.a[a.k] != null; }).pop() || { a: {} }).a[a.k]) };
      });
      rows.push(res);
    });
  });
  // Team rank on each metric (latest season best among athletes with that season)
  ['CMJ', 'ABCMJ'].forEach(function (type) {
    var R = rows.filter(function (r) { return r.type === type; });
    JP_M.forEach(function (m) {
      if (!m.dir) return;
      var vals = R.map(function (r) { var x = r.metrics[m.k]; return x ? x.season[x.y1] : null; }).filter(function (v) { return v != null; });
      R.forEach(function (r) {
        var x = r.metrics[m.k]; if (!x || vals.length < 3) return;
        var v = x.season[x.y1], below = vals.filter(function (o) { return m.dir === 1 ? o < v : o > v; }).length, eq = vals.filter(function (o) { return o === v; }).length;
        x.teamPct = Math.round(100 * (below + (eq - 1) / 2) / Math.max(1, vals.length - 1));
      });
    });
  });
  return rows;
}
function jpTone(m, v, pct) { if (v == null) return 'na'; var st = pct ? 3 : m.step; return v >= st ? 'up' : v <= -st ? 'down' : 'flat'; }
var JP_COL = { up: '#22c55e', down: '#f87171', flat: 'var(--text2)', na: 'var(--text3)' };
function jpPill(m, v, label, pct) {
  if (v == null || !m.dir) return '';
  var t = jpTone(m, v, pct), bg = t === 'up' ? 'rgba(34,197,94,.12)' : t === 'down' ? 'rgba(248,113,113,.12)' : 'rgba(255,255,255,.05)';
  return '<span style="display:inline-block;padding:2px 7px;border-radius:10px;background:' + bg + ';color:' + JP_COL[t] + ';font-size:10px;font-weight:700;white-space:nowrap;">' + (t === 'up' ? '▲ ' : t === 'down' ? '▼ ' : '') + jpSigned(m, v, pct) + ' <span style="font-weight:500;opacity:.75;">' + label + '</span></span>';
}
function jpBar(p) {
  if (p == null) return '<div style="height:8px;border-radius:4px;background:rgba(255,255,255,.06);"></div>';
  var c = p >= 70 ? '#22c55e' : p <= 30 ? '#f87171' : '#94a3b8';
  return '<div style="position:relative;height:8px;border-radius:4px;background:rgba(255,255,255,.07);"><div style="position:absolute;left:50%;top:-2px;bottom:-2px;width:1px;background:rgba(255,255,255,.18);"></div>'
    + '<div style="position:absolute;left:0;top:0;bottom:0;width:' + Math.max(3, p) + '%;border-radius:4px;background:' + c + ';opacity:.85;"></div>'
    + '<div title="Rank among Cubs athletes tested this season (100 = best)" style="position:absolute;left:calc(' + p + '% - 11px);top:-6px;width:22px;height:20px;border-radius:10px;background:' + c + ';border:2px solid var(--bg2,#0f172a);color:#0b1220;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;">' + p + '</div></div>';
}
function jpSpark(pts, m, w, h) {
  w = w || 90; h = h || 24;
  // Monthly best so the line reads clearly
  var mon = {}; pts.forEach(function (p) { var k = p.d.slice(0, 7); if (mon[k] == null || (m.dir === -1 ? p.v < mon[k] : p.v > mon[k])) mon[k] = p.v; });
  var ks = Object.keys(mon).sort().slice(-24); if (ks.length < 2) return '';
  var vs = ks.map(function (k) { return mon[k]; }), lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs); if (hi === lo) { hi += 1; lo -= 1; }
  var X = function (i) { return 3 + (w - 6) * i / (ks.length - 1); }, Y = function (v) { var t = (v - lo) / (hi - lo); if (m.dir === -1) t = 1 - t; return 3 + (h - 6) * (1 - t); };
  var d = ks.map(function (k, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(mon[k]).toFixed(1); }).join(' ');
  return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" style="display:block;overflow:visible;" role="img" aria-label="monthly trend"><path d="' + d + '" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
    + ks.map(function (k, i) { return '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(mon[k]).toFixed(1) + '" r="' + (i === ks.length - 1 ? 3.2 : 1.6) + '" fill="#60a5fa"><title>' + k + ': ' + jpFmt(m, mon[k]) + ' ' + m.unit + '</title></circle>'; }).join('') + '</svg>';
}
var JP_GRID = '150px minmax(100px,1fr) 64px 96px 132px';
function jpRow(r, k) {
  var m = jpM(k), x = r.metrics[k]; if (!x) return '';
  return '<div style="display:grid;grid-template-columns:' + JP_GRID + ';gap:12px;align-items:center;padding:9px 0;border-top:1px solid rgba(255,255,255,.05);">'
    + '<div><div style="font-size:12px;color:#e2e8f0;font-weight:600;line-height:1.2;">' + jpEsc(m.label) + '</div><div style="font-size:10px;color:var(--text3);">' + (m.unit || '&nbsp;') + (m.dir === -1 ? ' · lower is better' : '') + '</div></div>'
    + '<div style="padding:0 6px;">' + (m.dir ? jpBar(x.teamPct) : '<div style="font-size:10px;color:var(--text3);">context</div>') + (r.type === 'CMJ' && typeof mlbPill === 'function' && MLB_NORMS[k] ? '<div style="margin-top:7px;">' + mlbPill(k, x.latest.v, mlbGroup(r.name), 1) + '</div>' : '') + '</div>'
    + '<div style="text-align:right;"><div style="font-size:15px;font-weight:800;color:#fff;font-family:\'DM Mono\',monospace;line-height:1;">' + jpFmt(m, x.latest.v) + '</div><div style="font-size:9.5px;color:var(--text3);margin-top:2px;">' + x.latest.d.slice(5).replace('-', '/') + '</div></div>'
    + '<div title="Monthly best · best ever ' + jpFmt(m, x.best.v) + ' on ' + jpFd(x.best.d) + '">' + (jpSpark(x.pts, m) || '<div style="font-size:10px;color:var(--text3);">1 month</div>') + '<div style="font-size:9.5px;color:var(--text3);margin-top:2px;">best ' + jpFmt(m, x.best.v) + '</div></div>'
    + '<div style="display:flex;flex-direction:column;gap:3px;align-items:flex-start;">' + jpPill(m, x.vsNorm, 'vs his norm', true) + (x.yoyPct != null ? jpPill(m, x.yoyPct, x.y1 + ' vs ' + x.y0, true) : '') + '</div></div>';
}
function jpSection(r, sec, keys) {
  var rows = keys.filter(function (k) { return jpM(k).sec === sec.s; }).map(function (k) { return jpRow(r, k); }).filter(Boolean);
  if (!rows.length) return '';
  return '<div class="card" style="padding:14px 16px;border-radius:12px;">'
    + '<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:4px;"><span style="font-size:15px;">' + sec.icon + '</span><span style="font-size:13px;font-weight:800;color:#fff;">' + sec.title + '</span><span style="font-size:10.5px;color:var(--text3);">' + sec.sub + '</span></div>'
    + '<div style="display:grid;grid-template-columns:' + JP_GRID + ';gap:12px;padding:2px 0 4px;font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;"><div></div><div style="padding:0 6px;">Team rank this season' + (r.type === 'CMJ' ? ' · MLB %ile (latest)' : '') + '</div><div style="text-align:right;">Latest</div><div>Monthly best</div><div></div></div>'
    + rows.join('') + '</div>';
}
function jpAsymCard(r) {
  var ks = JP_ASYM.filter(function (a) { return r.asym[a.k]; });
  if (!ks.length) return '';
  return '<div class="card" style="padding:14px 16px;border-radius:12px;"><div style="display:flex;align-items:baseline;gap:8px;margin-bottom:8px;"><span style="font-size:15px;">⚖️</span><span style="font-size:13px;font-weight:800;color:#fff;">Left / right asymmetry</span><span style="font-size:10.5px;color:var(--text3);">median of his last 5 tests</span></div>'
    + ks.map(function (a) {
      var x = r.asym[a.k], c = x.med >= a.flag ? '#f87171' : x.med >= a.watch ? '#fbbf24' : '#22c55e', scale = a.flag / 0.6, w = Math.min(100, x.med / scale * 100);
      return '<div style="display:grid;grid-template-columns:150px 1fr 60px;gap:12px;align-items:center;padding:7px 0;border-top:1px solid rgba(255,255,255,.05);"><div><div style="font-size:12px;color:#e2e8f0;font-weight:600;">' + a.label + '</div><div style="font-size:9.5px;color:var(--text3);">watch ' + a.watch + '% · flag ' + a.flag + '%' + (a.noisy ? ' · noisy metric' : '') + '</div></div>'
        + '<div style="position:relative;height:8px;border-radius:4px;background:rgba(255,255,255,.07);"><div style="position:absolute;left:' + (a.watch / scale * 100) + '%;top:-2px;bottom:-2px;width:1px;background:rgba(251,191,36,.5);"></div><div style="position:absolute;left:60%;top:-2px;bottom:-2px;width:1px;background:rgba(248,113,113,.5);"></div><div style="position:absolute;left:0;top:0;bottom:0;width:' + Math.max(3, w) + '%;border-radius:4px;background:' + c + ';"></div></div>'
        + '<div style="text-align:right;font-size:14px;font-weight:800;color:' + c + ';font-family:\'DM Mono\',monospace;">' + x.med.toFixed(1) + '%</div></div>';
    }).join('') + '</div>';
}
function jpHero(r, k, label) {
  var m = jpM(k), x = r.metrics[k]; if (!x) return '';
  var t = jpTone(m, x.yoyPct, true);
  return '<div style="padding:10px 14px;border-radius:10px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);min-width:132px;">'
    + '<div style="font-size:9.5px;color:var(--text3);text-transform:uppercase;letter-spacing:.6px;">' + label + ' · ' + (x.y1 || '') + ' best</div>'
    + '<div style="display:flex;align-items:center;gap:10px;margin-top:3px;"><div style="font-size:24px;font-weight:800;color:#fff;font-family:\'DM Mono\',monospace;">' + jpFmt(m, x.season[x.y1]) + '</div>' + jpSpark(x.pts, m, 56, 24) + '</div>'
    + '<div style="font-size:10.5px;margin-top:2px;color:' + JP_COL[t] + ';">' + (x.yoyPct != null ? (t === 'up' ? '▲ ' : t === 'down' ? '▼ ' : '') + jpSigned(m, x.yoyPct, true) + ' vs ' + x.y0 : m.unit) + '</div>'
    + (r.type === 'CMJ' && typeof mlbPill === 'function' && MLB_NORMS[k] ? '<div style="margin-top:5px;">' + mlbPill(k, x.season[x.y1], mlbGroup(r.name), 1) + '</div>' : '') + '</div>';
}
// Year over year: Best, Average and 90th percentile for each season, side by side
var JP_YOY_STATS = [
  { k: 'best', label: 'Best', tip: 'his single best session that year' },
  { k: 'avg', label: 'Average', tip: 'average of all his sessions that year' },
  { k: 'p90', label: '90th percentile', tip: 'what he hits on a good day: better than 90% of his sessions that year (needs ' + JP_P90_MIN + '+ tests)' }
];
function jpChg(m, a, b) { return a != null && b != null && a !== 0 ? (b - a) / Math.abs(a) * 100 * (m.dir || 1) : null; }
function jpYoyCard(r, keys) {
  var ys = (r.metrics.jh ? Object.keys(r.metrics.jh.stats) : r.years).sort();
  if (ys.length < 2) return '<div class="card" style="padding:14px 16px;border-radius:12px;grid-column:1/-1;"><div style="display:flex;align-items:baseline;gap:8px;"><span style="font-size:15px;">📅</span><span style="font-size:13px;font-weight:800;color:#fff;">Year over year</span><span style="font-size:10.5px;color:var(--text3);">needs ' + r.type + ' tests in two different years</span></div></div>';
  var y1 = ys[ys.length - 1], y0 = (JP.cmp && JP.cmp !== y1 && ys.indexOf(JP.cmp) >= 0) ? JP.cmp : ys[ys.length - 2];
  var n0 = r.metrics.jh && r.metrics.jh.stats[y0] ? r.metrics.jh.stats[y0].n : 0, n1 = r.metrics.jh && r.metrics.jh.stats[y1] ? r.metrics.jh.stats[y1].n : 0;
  var G = '150px repeat(3,minmax(150px,1fr))';
  var sel = '<select onchange="JP.cmp=this.value;renderJumpProfile()" style="background:var(--bg3);border:1px solid var(--border2);border-radius:7px;padding:3px 8px;color:var(--text);font-size:11px;">' + ys.filter(function (y) { return y !== y1; }).reverse().map(function (y) { return '<option value="' + y + '"' + (y === y0 ? ' selected' : '') + '>' + y1 + ' vs ' + y + '</option>'; }).join('') + '</select>';
  var head = '<div style="display:grid;grid-template-columns:' + G + ';gap:12px;padding:4px 0 6px;font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;"><div></div>'
    + JP_YOY_STATS.map(function (st) { return '<div title="' + jpEsc(st.tip) + '" style="cursor:help;">' + st.label + ' <span style="text-transform:none;letter-spacing:0;opacity:.8;">' + y0 + ' → ' + y1 + '</span></div>'; }).join('') + '</div>';
  var rows = keys.filter(function (k) { var m = jpM(k); return m.dir && r.metrics[k] && r.metrics[k].stats[y1] && r.metrics[k].stats[y0]; }).map(function (k) {
    var m = jpM(k), S = r.metrics[k].stats;
    return '<div style="display:grid;grid-template-columns:' + G + ';gap:12px;align-items:center;padding:8px 0;border-top:1px solid rgba(255,255,255,.05);">'
      + '<div><div style="font-size:12px;color:#e2e8f0;font-weight:600;line-height:1.2;">' + jpEsc(m.label) + '</div><div style="font-size:10px;color:var(--text3);">' + (m.unit || '&nbsp;') + (m.dir === -1 ? ' · lower is better' : '') + '</div></div>'
      + JP_YOY_STATS.map(function (st) {
        var a = S[y0][st.k], b = S[y1][st.k];
        if (a == null || b == null) return '<div style="font-size:10px;color:var(--text3);">' + (st.k === 'p90' ? 'needs ' + JP_P90_MIN + '+ tests each year' : '—') + '</div>';
        return '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><span style="font-family:\'DM Mono\',monospace;font-size:12px;color:var(--text3);">' + jpFmt(m, a) + '</span><span style="color:var(--text3);font-size:10px;">→</span><span style="font-family:\'DM Mono\',monospace;font-size:14px;font-weight:800;color:#fff;">' + jpFmt(m, b) + '</span>' + jpPill(m, jpChg(m, a, b), '', true) + '</div>';
      }).join('') + '</div>';
  });
  return '<div class="card" style="padding:14px 16px;border-radius:12px;grid-column:1/-1;overflow-x:auto;">'
    + '<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:2px;"><span style="font-size:15px;">📅</span><span style="font-size:13px;font-weight:800;color:#fff;">Year over year</span><span style="font-size:10.5px;color:var(--text3);">' + y0 + ': ' + n0 + ' sessions · ' + y1 + ': ' + n1 + ' sessions · Best = top session · Average = typical session · 90th = a good day</span><span style="margin-left:auto;">' + sel + '</span></div>'
    + head + rows.join('') + '</div>';
}
function jpAthleteHTML(name) {
  var R = JP.rows.filter(function (r) { return r.name === name; }), r = R.find(function (x) { return x.type === JP.type; }) || R[0];
  var names = jpNames(), i = names.indexOf(name), q = function (n) { return n.replace(/'/g, "\\'"); };
  var prev = names[(i - 1 + names.length) % names.length], next = names[(i + 1) % names.length];
  var nav = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap;">'
    + '<button onclick="JP.sel=null;renderJumpProfile()" style="padding:6px 12px;background:rgba(255,255,255,.05);border:1px solid var(--border2);border-radius:8px;color:var(--text2);font-size:12px;cursor:pointer;">← All athletes</button>'
    + '<select onchange="JP.sel=this.value;renderJumpProfile()" style="background:var(--bg3);border:1px solid var(--border2);border-radius:8px;padding:6px 10px;color:var(--text);font-size:12px;">' + names.map(function (n) { return '<option' + (n === name ? ' selected' : '') + '>' + jpEsc(n) + '</option>'; }).join('') + '</select>'
    + '<button onclick="JP.sel=\'' + q(prev) + '\';renderJumpProfile()" style="padding:6px 10px;background:transparent;border:1px solid var(--border2);border-radius:8px;color:var(--text2);cursor:pointer;">‹</button>'
    + '<button onclick="JP.sel=\'' + q(next) + '\';renderJumpProfile()" style="padding:6px 10px;background:transparent;border:1px solid var(--border2);border-radius:8px;color:var(--text2);cursor:pointer;">›</button>'
    + '<div style="margin-left:auto;display:flex;gap:4px;background:rgba(255,255,255,.04);padding:3px;border-radius:9px;">' + ['CMJ', 'ABCMJ'].map(function (t) { var has = R.some(function (x) { return x.type === t; }); return '<button ' + (has ? '' : 'disabled ') + 'onclick="JP.type=\'' + t + '\';renderJumpProfile()" style="padding:5px 14px;border-radius:7px;border:none;font-size:12px;font-weight:700;cursor:' + (has ? 'pointer' : 'default') + ';background:' + (r && r.type === t ? '#0E3386' : 'transparent') + ';color:' + (has ? '#fff' : 'var(--text3)') + ';">' + t + (t === 'ABCMJ' ? ' <span style="font-weight:400;opacity:.7;">arm swing</span>' : '') + '</button>'; }).join('') + '</div></div>';
  if (!r) return nav + '<div class="card" style="padding:30px;text-align:center;color:var(--text3);">No ' + JP.type + ' tests in VALD for ' + jpEsc(name) + '.</div>';
  var initials = name.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2);
  var bw = r.metrics.bw;
  var hero = '<div class="card" style="padding:18px 20px;border-radius:14px;margin-bottom:14px;background:linear-gradient(135deg,rgba(14,51,134,.45),rgba(15,23,42,.6));border:1px solid rgba(96,165,250,.25);">'
    + '<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap;">'
    + '<div style="width:58px;height:58px;border-radius:50%;background:#0E3386;border:2px solid rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#fff;">' + jpEsc(initials) + '</div>'
    + '<div style="flex:1;min-width:180px;"><div style="font-family:\'Bebas Neue\',sans-serif;font-size:32px;letter-spacing:.03em;color:#fff;line-height:1;">' + jpEsc(name) + '</div>'
    + '<div style="font-size:12px;color:#bfdbfe;margin-top:4px;">' + r.type + ' · ' + r.n + ' sessions · ' + jpFd(r.first) + ' – ' + jpFd(r.last) + (bw ? ' · ' + jpFmt(jpM('bw'), bw.latest.v) + ' lb' : '') + '</div>'
    + '<div style="font-size:11px;color:#93c5fd;margin-top:6px;">Best of all trials per session · latest test ' + jpFd(r.last) + '</div></div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;">' + jpHero(r, 'jh', 'Jump height') + jpHero(r, 'rsi', 'RSI-mod') + jpHero(r, 'ppbm', 'Peak power/BM') + (r.type === 'CMJ' ? jpHero(r, 'edrfd', 'Ecc decel RFD/BM') : '') + '</div>'
    + '</div></div>';
  var keys = (r.type === 'ABCMJ' ? JP_AB : JP_M.map(function (m) { return m.k; })).filter(function (k) { return k !== 'bw'; });
  var secs = JP_SECTIONS.map(function (s) { return jpSection(r, s, keys); }).filter(Boolean);
  secs.unshift(jpYoyCard(r, keys));
  if (r.type === 'CMJ') secs.push(jpAsymCard(r));
  // Arm-swing contribution: ABCMJ minus CMJ jump height on the same days
  var cm = JP.rows.find(function (x) { return x.name === name && x.type === 'CMJ'; }), ab = JP.rows.find(function (x) { return x.name === name && x.type === 'ABCMJ'; });
  if (r.type === 'ABCMJ' && cm && ab && cm.metrics.jh && ab.metrics.jh) {
    var byD = {}; cm.metrics.jh.pts.forEach(function (p) { byD[p.d] = p.v; });
    var diffs = ab.metrics.jh.pts.filter(function (p) { return byD[p.d] != null; }).map(function (p) { return { d: p.d, v: p.v - byD[p.d] }; });
    if (diffs.length) secs.push('<div class="card" style="padding:14px 16px;border-radius:12px;"><div style="display:flex;align-items:baseline;gap:8px;margin-bottom:6px;"><span style="font-size:15px;">💪</span><span style="font-size:13px;font-weight:800;color:#fff;">Arm-swing contribution</span><span style="font-size:10.5px;color:var(--text3);">ABCMJ minus CMJ jump height, same day</span></div><div style="display:flex;align-items:center;gap:16px;"><div style="font-size:26px;font-weight:800;color:#fff;font-family:\'DM Mono\',monospace;">+' + jpMed(diffs.map(function (x) { return x.v; })).toFixed(1) + ' cm</div><div style="font-size:11px;color:var(--text2);line-height:1.5;">median over ' + diffs.length + ' days tested both ways<br>latest ' + jpSigned(jpM('jh'), diffs[diffs.length - 1].v) + ' cm (' + jpFd(diffs[diffs.length - 1].d) + ')</div></div></div>');
  }
  // Head (nav, hero, vs MLB) sits above the session trend charts; the metric breakdown sits below them
  return nav + hero + (typeof mlbCardHTML === 'function' ? mlbCardHTML(r) : '') + JP_SPLIT
    + '<div style="display:flex;align-items:baseline;gap:8px;margin:22px 0 10px;padding-bottom:8px;border-bottom:2px solid rgba(96,165,250,.35);"><span style="font-size:14px;font-weight:800;color:#fff;">📋 Metric breakdown</span><span style="font-size:11px;color:var(--text3);">team rank, his norm, year over year, asymmetry</span></div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(560px,1fr));gap:14px;">' + secs.join('') + '</div>';
}
var JP_SPLIT = '<!--jp-split-->';
function jpNames() { var o = {}; (JP.rows || []).forEach(function (r) { o[r.name] = 1; }); return Object.keys(o).sort(); }
function jpCardHTML(name) {
  var r = JP.rows.find(function (x) { return x.name === name && x.type === 'CMJ'; }) || JP.rows.find(function (x) { return x.name === name; });
  var ab = JP.rows.find(function (x) { return x.name === name && x.type === 'ABCMJ'; });
  var q = name.replace(/'/g, "\\'"), jh = r.metrics.jh, m = jpM('jh');
  var tags = [];
  if (jh && jh.vsNorm != null && jh.vsNorm <= -5) tags.push(['down', 'Latest jump ' + jpSigned(m, jh.vsNorm, true) + ' vs his norm']);
  var asy = JP_ASYM.filter(function (a) { return r.asym[a.k] && r.asym[a.k].med >= a.watch; }).sort(function (a, b) { return r.asym[b.k].med / b.flag - r.asym[a.k].med / a.flag; })[0];
  if (asy) tags.push([r.asym[asy.k].med >= asy.flag ? 'down' : 'warn', asy.label + ' asym ' + r.asym[asy.k].med.toFixed(0) + '%']);
  var bestYoy = ['jh', 'rsi', 'ppbm', 'edrfd'].map(function (k) { var x = r.metrics[k]; return x && x.yoyPct != null ? [k, x.yoyPct] : null; }).filter(Boolean).sort(function (a, b) { return b[1] - a[1]; });
  if (bestYoy.length && bestYoy[0][1] >= 3) tags.push(['up', jpM(bestYoy[0][0]).label + ' ' + jpSigned(jpM(bestYoy[0][0]), bestYoy[0][1], true) + ' vs ' + r.metrics[bestYoy[0][0]].y0]);
  var mini = ['rsi', 'ppbm', 'edrfd', 'cimp'].map(function (k) {
    var x = r.metrics[k], p = x ? x.teamPct : null;
    return '<div style="display:grid;grid-template-columns:78px 1fr 26px;gap:8px;align-items:center;margin-top:6px;"><div style="font-size:10px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + ({ rsi: 'RSI-mod', ppbm: 'Power/BM', edrfd: 'Ecc decel RFD', cimp: 'Conc impulse' })[k] + '</div>'
      + '<div style="height:6px;border-radius:3px;background:rgba(255,255,255,.07);position:relative;">' + (p != null ? '<div style="position:absolute;left:0;top:0;bottom:0;width:' + Math.max(3, p) + '%;border-radius:3px;background:' + (p >= 70 ? '#22c55e' : p <= 30 ? '#f87171' : '#94a3b8') + ';"></div>' : '') + '</div>'
      + '<div style="font-size:10px;color:' + (p != null ? '#e2e8f0' : 'var(--text3)') + ';text-align:right;font-weight:700;">' + (p != null ? p : '—') + '</div></div>';
  }).join('');
  return '<div onclick="JP.sel=\'' + q + '\';JP.type=\'CMJ\';renderJumpProfile();window.scrollTo({top:0})" class="card va-card" style="cursor:pointer;padding:14px 16px;border-radius:12px;">'
    + '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;"><div><div style="font-size:14px;font-weight:800;color:#fff;">' + jpEsc(name) + '</div><div style="font-size:10.5px;color:var(--text3);margin-top:1px;">' + r.n + ' CMJ' + (ab ? ' · ' + ab.n + ' ABCMJ' : '') + ' · last ' + jpFd(r.last) + '</div></div>'
    + '<div style="text-align:right;"><div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;">CMJ height ' + (jh ? jh.y1 : '') + '</div><div style="display:flex;align-items:center;gap:6px;justify-content:flex-end;">' + (jh ? jpSpark(jh.pts, m, 44, 18) : '') + '<span style="font-size:20px;font-weight:800;color:#fff;font-family:\'DM Mono\',monospace;">' + (jh ? jpFmt(m, jh.season[jh.y1]) : '—') + '</span><span style="font-size:10px;color:var(--text3);">cm</span></div>'
    + (ab && ab.metrics.jh ? '<div style="font-size:10px;color:var(--text3);">ABCMJ ' + jpFmt(m, ab.metrics.jh.season[ab.metrics.jh.y1]) + ' cm</div>' : '') + '</div></div>'
    + '<div style="margin-top:6px;">' + mini + '</div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;min-height:20px;">' + (tags.length ? tags.map(function (t) { var c = t[0] === 'up' ? ['rgba(34,197,94,.12)', '#4ade80', '▲ '] : t[0] === 'warn' ? ['rgba(251,191,36,.12)', '#fbbf24', '⚠ '] : ['rgba(248,113,113,.12)', '#fca5a5', '▼ ']; return '<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:' + c[0] + ';color:' + c[1] + ';font-weight:700;">' + c[2] + jpEsc(t[1]) + '</span>'; }).join('') : '<span style="font-size:10px;color:var(--text3);">Tracking his norm</span>') + '</div></div>';
}
function jpTeamHTML() {
  var names = jpNames().filter(function (n) { return JP.rows.some(function (r) { return r.name === n && r.type === 'CMJ'; }); });
  names.sort(function (a, b) { var A = JP.rows.find(function (r) { return r.name === a && r.type === 'CMJ'; }).metrics.jh, B = JP.rows.find(function (r) { return r.name === b && r.type === 'CMJ'; }).metrics.jh; return (B ? B.season[B.y1] : 0) - (A ? A.season[A.y1] : 0); });
  var R = names.map(function (n) { return JP.rows.find(function (r) { return r.name === n && r.type === 'CMJ'; }); });
  var recent = R.filter(function (r) { return r.last >= jpAddDays(new Date().toISOString().slice(0, 10), -14); }).length;
  var down = R.filter(function (r) { return r.metrics.jh && r.metrics.jh.vsNorm != null && r.metrics.jh.vsNorm <= -5; });
  var asym = R.filter(function (r) { return JP_ASYM.some(function (a) { return r.asym[a.k] && r.asym[a.k].med >= a.flag; }); });
  var tile = function (label, big, sub) { return '<div class="card" style="padding:14px 16px;border-radius:12px;"><div style="font-size:9.5px;color:var(--text3);text-transform:uppercase;letter-spacing:.6px;">' + label + '</div><div style="font-size:26px;font-weight:800;color:#fff;font-family:\'DM Mono\',monospace;margin-top:4px;">' + big + '</div><div style="font-size:10.5px;color:var(--text2);margin-top:2px;line-height:1.4;">' + sub + '</div></div>'; };
  var tiles = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:16px;">'
    + tile('Athletes with CMJ data', names.length, recent + ' tested in the last 14 days')
    + tile('Below their jump norm', down.length, down.length ? down.map(function (r) { return r.name.split(' ').slice(-1)[0]; }).join(', ') : 'latest CMJ within 5% of norm for everyone')
    + tile('Asymmetry flags', asym.length, asym.length ? asym.map(function (r) { return r.name.split(' ').slice(-1)[0]; }).join(', ') : 'none flagged')
    + tile('Last VALD sync', JP.data && JP.data.at ? new Date(JP.data.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—', 'best of all trials per session · since 2023')
    + '</div>';
  return tiles + '<div style="font-size:11px;color:var(--text3);margin:0 2px 8px;">Sorted by this season\'s best CMJ height · bars = rank among Cubs athletes tested this season (100 = best) · click an athlete</div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;">' + names.map(jpCardHTML).join('') + '</div>';
}
function renderJumpProfile() {
  var el = document.getElementById('jp-body'); if (!el) return;
  if (!JP.data && !JP.err) { el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text3);">Loading VALD jump data…</div>'; jpLoad().then(renderJumpProfile); return; }
  if (JP.err) { el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text3);">Couldn\'t load jump data (' + jpEsc(JP.err) + ').</div>'; return; }
  if (!JP.rows.length) { el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text3);">No VALD jump data yet — run the VALD sync from VALD Hub (see "How to update").</div>' + jpHowTo(); return; }
  if (!JP.sel) { el.innerHTML = jpTeamHTML() + jpHowTo(); jpShowTrends(false); return; }
  var h = jpAthleteHTML(JP.sel), i = h.indexOf(JP_SPLIT);
  el.innerHTML = i >= 0 ? h.slice(0, i) : h;
  var det = document.getElementById('jp-detail'); if (det) det.innerHTML = (i >= 0 ? h.slice(i + JP_SPLIT.length) : '') + jpHowTo();
  jpShowTrends(true);
}
// Session trend charts (index.html, from ForceDecks CSV imports) live between the head and the breakdown.
// They follow the athlete and the CMJ / ABCMJ toggle picked here.
function jpShowTrends(on) {
  var tr = document.getElementById('jp-trends'), det = document.getElementById('jp-detail');
  if (!on && det) det.innerHTML = '';
  if (!tr) return;
  var inRoster = on && typeof PLAYERS !== 'undefined' && PLAYERS[JP.sel];
  var wasHidden = tr.style.display === 'none';
  tr.style.display = inRoster ? '' : 'none';
  if (!inRoster) return;
  var c = document.getElementById('jp-trends-cmj'), a = document.getElementById('jp-trends-ab');
  if (c) c.style.display = JP.type === 'ABCMJ' ? 'none' : '';
  if (a) a.style.display = JP.type === 'ABCMJ' ? '' : 'none';
  var typeChanged = typeof CMJ_OVERLAY_TYPE !== 'undefined' && CMJ_OVERLAY_TYPE !== JP.type;
  if (typeChanged) CMJ_OVERLAY_TYPE = JP.type;
  if (JP.sel !== currentPlayer && typeof selectPlayer === 'function') { JP._chartsFor = JP.sel + JP.type; selectPlayer(JP.sel); return; }   // re-renders charts for him
  if ((wasHidden || typeChanged || JP._chartsFor !== JP.sel + JP.type) && typeof renderAllCharts === 'function') {
    JP._chartsFor = JP.sel + JP.type;
    setTimeout(function () { renderAllCharts(PLAYERS[currentPlayer]); }, 30);
  }
}
function jpHowTo() {
  return '<details style="margin-top:14px;font-size:11px;color:var(--text3);line-height:1.6;"><summary style="cursor:pointer;">How to read this · how to update</summary><div style="padding:6px 2px;">'
    + '<b>One number per session (Max):</b> each metric is his best value across all jumps that day, so jump height, RSI-mod, power, etc. can come from different jumps (lowest for contraction time and braking duration; smallest imbalance for asymmetry; depth and body weight from his highest jump). CMJ and ABCMJ (arm swing) are never mixed. '
    + '<b>vs his 90-day norm</b> = latest test vs the average of his tests in the 90 days before it. <b>Season vs season</b> on each metric row compares season bests (season lows for contraction time and braking duration, where lower is better). <b>Year over year</b> compares three things per season: <b>Best</b> (top session), <b>Average</b> (all sessions) and <b>90th percentile</b> (better than 90% of his sessions that year; needs ' + JP_P90_MIN + '+ tests). Seasons are calendar years. <b>Team rank</b> = where his season best sits among Cubs athletes tested this season. Asymmetry is the median of his last 5 tests (concentric and eccentric-decel impulse: 10% watch, 15% flag; landing force is noisier: 25% / 35%).<br>'
    + '<b>To update:</b> drag this button to your bookmarks bar once: ' + jpBookmarkHTML() + ' Then, whenever you want fresh data, open VALD Hub (logged in), go to VALD Systems → ForceDecks, and click the bookmark. It pulls every CMJ/ABCMJ since 2023 for the roster using your VALD session and saves it here — reload this page afterwards.</div></details>';
}
function jpBookmarkHTML() {
  if (typeof cubsValdSync !== 'function' || typeof SUPA_URL === 'undefined') return '';
  var cfg = { supaUrl: SUPA_URL, supaKey: SUPA_KEY, roster: Object.keys(typeof PLAYERS !== 'undefined' ? PLAYERS : {}) };
  var code = '(function(){' + cubsValdSync.toString() + '\ncubsValdSync(' + JSON.stringify(cfg) + ');})()';
  return '<a href="javascript:' + encodeURIComponent(code).replace(/'/g, '%27') + '" onclick="alert(\'Drag this button to your bookmarks bar, then click it while you are on VALD Hub.\');return false;" style="display:inline-block;margin:0 4px;padding:3px 10px;border-radius:7px;background:#0E3386;color:#fff;font-weight:700;text-decoration:none;font-size:11px;">🔖 Cubs VALD sync</a>';
}
(function () {
  if (typeof document === 'undefined') return;
  if (typeof switchTab === 'function') { var _s = switchTab; switchTab = function (page) { var x = _s.apply(this, arguments); if (page === 'jumps') renderJumpProfile(); return x; }; }
})();
