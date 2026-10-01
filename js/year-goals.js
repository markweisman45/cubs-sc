// ═══════════════════════════════════════════════════════════════════════════
// Year in Review → suggested off-season goals.
// Per metric the page picks a goal type from his last three seasons, age and
// percentile, then a target number. The coach keeps, edits or drops each one.
//   Restore   latest season is a meaningful step below his best of the 3 → get back to it
//   Build     under 30 and below the 75th percentile → next percentile band for his position
//   Maintain  30+ or already 75th+ → hold (sprint: beat the league's age curve)
//   Hold      second half dropped ≥2% → keep the late-season drop under 1%
// A goal smaller than normal test-to-test variation (step) is never suggested.
// ═══════════════════════════════════════════════════════════════════════════
var YG_M = [
  { k: 'jh', src: 'cmj', label: 'CMJ jump height', unit: 'cm', dec: 1, step: 1.5, test: 'CMJ (VALD)', by: 'Spring Training testing' },
  { k: 'rsi', src: 'cmj', label: 'RSI-modified', unit: 'm/s', dec: 2, step: 0.04, test: 'CMJ (VALD)', by: 'Spring Training testing' },
  { k: 'ppbm', src: 'cmj', label: 'Peak power / BM', unit: 'W/kg', dec: 1, step: 2, test: 'CMJ (VALD)', by: 'Spring Training testing' },
  { k: 'cppbm', src: 'cmj', label: 'Concentric peak power / BM', unit: 'W/kg', dec: 1, step: 2, test: 'CMJ (VALD)', by: 'Spring Training testing' },
  { k: 'sprint', src: 'sav', label: 'Sprint speed', unit: 'ft/s', dec: 1, step: 0.2, test: 'Statcast sprint speed', by: 'next season (in-season check)' },
  { k: 'str', src: 'he', label: 'Max linear sprint', unit: 'ft/s', dec: 1, step: 0.2, test: 'HE runs — top straight-line speed', by: 'next season (in-season check)' },
  { k: 'cur', src: 'he', label: 'Max curve sprint', unit: 'ft/s', dec: 1, step: 0.2, test: 'HE runs — top curved-run speed', by: 'next season (in-season check)' }
];
var YG_RANK = { Restore: 0, Build: 1, Hold: 2, Maintain: 3 };
var YG_COL = { Restore: '#fbbf24', Build: '#22c55e', Maintain: '#93c5fd', Hold: '#f472b6' };
function ygNormAt(k, grp, p) { var q = typeof MLB_NORMS !== 'undefined' && MLB_NORMS[k] && MLB_NORMS[k][grp]; if (!q) return null; var i = [5, 25, 50, 75, 95].indexOf(p); return i >= 0 ? q[i] : null; }
function yrSuggest(name) {
  var ys = yrYears(), cy = ys[2], grp = typeof mlbAutoGroup === 'function' ? mlbAutoGroup(name) : 'g2';
  var sv = typeof VA !== 'undefined' && VA.data && VA.data.rows ? VA.data.rows.find(function (x) { return x.roster === name; }) : null;
  var age = sv && sv.age;
  var avg = function (a) { return a.length ? a.reduce(function (t, x) { return t + x; }, 0) / a.length : null; };
  var fmt = function (m, v) { return (+v).toFixed(m.dec); };
  var out = [];
  YG_M.forEach(function (m) {
    var vals = {}, pct = null;
    ys.forEach(function (y) {
      if (m.src === 'cmj') { var v = avg(yrVald(name, y, 'CMJ').map(function (t) { return t.v[m.k]; }).filter(function (x) { return x != null; })); if (v != null) vals[y] = v; }
      else if (m.src === 'he') { var st = yrStats(yrRuns(name, y, m.k)); if (st && st.n >= 3) vals[y] = st.top; }
      else if (sv && sv.metrics[m.k] && sv.metrics[m.k].vals[y] != null) vals[y] = sv.metrics[m.k].vals[y];
    });
    var yk = ys.filter(function (y) { return vals[y] != null; }); if (!yk.length) return;
    var ly = yk[yk.length - 1], cur = vals[ly];
    if (m.src === 'cmj') { var pc = typeof mlbPct === 'function' ? mlbPct(m.k, cur, grp) : null; pct = pc ? pc.p : null; }
    else if (m.src === 'he') {   // no public league number → percentile within the Cubs roster that season
      var team = Object.keys(PLAYERS).map(function (n) { var st = yrStats(yrRuns(n, ly, m.k)); return st && st.n >= 3 ? st.top : null; }).filter(function (v) { return v != null; });
      pct = team.length >= 4 ? Math.round(100 * team.filter(function (v) { return v < cur; }).length / (team.length - 1)) : null;
    }
    else pct = sv.metrics[m.k].pcts[ly];
    var bestY = yk.reduce(function (a, y) { return vals[y] > vals[a] ? y : a; }, yk[0]), best = vals[bestY];
    var hist = yk.map(function (y) { return y + ' ' + fmt(m, vals[y]); }).join(' → ');
    var g = null;
    if (ly !== cy) g = null;   // no data this season — nothing current to set a goal from
    else if (bestY !== ly && best - cur >= m.step) {
      g = { type: 'Restore', target: best, txt: '≥ ' + fmt(m, best), why: ly + ' is ' + fmt(m, best - cur) + ' ' + m.unit + ' below his ' + bestY + ' season — he has done it before.' };
    } else if ((pct == null || pct < 75) && !(age >= 30)) {
      var band = pct == null ? null : pct < 25 ? 25 : pct < 50 ? 50 : 75, nv = band ? ygNormAt(m.k, grp, band) : null;
      var t = Math.max(nv || 0, cur + m.step);
      g = { type: 'Build', target: t, txt: '≥ ' + fmt(m, t), why: (pct != null ? yrOrd(pct) + ' percentile' + (m.src === 'cmj' ? ' for his position' : m.src === 'he' ? ' on the roster' : '') : 'room to grow') + (age ? ', age ' + age : '') + (nv ? ' — ' + band + 'th percentile is ' + fmt(m, nv) + ' ' + m.unit : ' — one meaningful step up') + '.' };
    } else {
      var e = null;
      if (m.src === 'sav' && age && typeof SV !== 'undefined' && VA.data && VA.data.D) e = SV.expected(VA.data.D, m.k, age, +cy, +cy + 1);
      if (e != null && e < 0) g = { type: 'Maintain', target: cur + e / 2, txt: '≥ ' + fmt(m, cur + e / 2), why: 'MLB players his age (' + age + ') typically lose ' + Math.abs(e).toFixed(2) + ' ' + m.unit + ' a year — goal is to lose half that or less.' };
      else g = { type: 'Maintain', target: cur - m.step / 2, txt: '≥ ' + fmt(m, cur - m.step / 2), why: (pct != null ? yrOrd(pct) + ' percentile' + (m.src === 'he' ? ' on the roster' : '') : 'Strong') + (age ? ', age ' + age : '') + ' — hold where he is (within normal test variation).' };
    }
    if (g) out.push(Object.assign({ m: m, cur: cur, hist: hist, pct: pct }, g));
  });
  // Body weight: report at the spring weight of his best power season (CMJ peak power / BM)
  (function () {
    var bwm = { k: 'bw', label: 'Body weight', unit: 'lb', dec: 0, test: 'VALD body weight (spring)', by: 'Spring Training report' };
    var spring = {}, end = {}, pw = {};
    ys.forEach(function (y) {
      var T = yrVald(name, y).filter(function (t) { return t.v && t.v.bw && t.d >= y + '-02-01'; });
      if (T.length) { spring[y] = T[0].v.bw; end[y] = T[T.length - 1].v.bw; }
      var p = avg(yrVald(name, y, 'CMJ').map(function (t) { return t.v.ppbm; }).filter(function (x) { return x != null; })); if (p != null) pw[y] = p;
    });
    if (spring[cy] == null) return;
    var hist = ys.filter(function (y) { return spring[y] != null; }).map(function (y) { return y + ' ' + Math.round(spring[y]) + (end[y] != null ? '→' + Math.round(end[y]) : ''); }).join(' · ') + ' lb (spring→last test)';
    var py = Object.keys(pw).filter(function (y) { return spring[y] != null; }), bestY = py.length ? py.reduce(function (a, y) { return pw[y] > pw[a] ? y : a; }) : null;
    if (bestY && bestY !== cy && Math.abs(spring[bestY] - spring[cy]) >= 3) {
      out.push({ m: bwm, type: 'Restore', cur: spring[cy], hist: hist, txt: '≈ ' + Math.round(spring[bestY]) + ' (±2)', why: 'Reported at ' + Math.round(spring[bestY]) + ' lb in ' + bestY + ', his best power-to-weight season (' + pw[bestY].toFixed(1) + ' W/kg) — ' + Math.round(spring[cy]) + ' lb this spring.' });
    } else {
      out.push({ m: bwm, type: 'Maintain', cur: spring[cy], hist: hist, txt: '≈ ' + Math.round(spring[cy]) + ' (±2)', why: (bestY === cy ? cy + ' was his best power-to-weight season' : 'Spring weight is where it has been') + ' — report at the same weight.' });
    }
    if (end[cy] != null && (end[cy] - spring[cy]) / spring[cy] <= -0.02) {
      var d = (end[cy] - spring[cy]) / spring[cy] * 100;
      out.push({ m: { k: 'hold-bw', label: 'Body weight — through the season', unit: '%', dec: 1, test: 'VALD body weight', by: 'next season' }, type: 'Hold', cur: d, hist: cy + ': ' + Math.round(spring[cy]) + ' → ' + Math.round(end[cy]) + ' lb', txt: 'lose < 2%', why: 'Dropped ' + Math.abs(d).toFixed(1) + '% (' + Math.round(spring[cy] - end[cy]) + ' lb) from spring to his last test in ' + cy + '.' });
    }
  })();
  // Second-half hold goals (run speed and CMJ)
  [['run', 'Run speed (90th, HE)', 'ft/s', 1], ['jh', 'CMJ jump height', 'cm', 1]].forEach(function (h) {
    var f = function (half) {
      if (h[0] === 'run') { var s = yrStats(yrRuns(name, cy, 'run', half)); return s && s.n >= 5 ? s.p90 : null; }
      return avg(yrVald(name, cy, 'CMJ').filter(function (t) { return (t.d >= cy + YR_HALF) === (half === 2) && t.v.jh != null; }).map(function (t) { return t.v.jh; }));
    };
    var a = f(1), b = f(2); if (a == null || b == null) return;
    var d = (b - a) / a * 100;
    if (d <= -2) out.push({ m: { k: 'hold-' + h[0], label: h[1] + ' — 2nd half', unit: '%', dec: 1, test: h[0] === 'run' ? 'HE runs' : 'CMJ (VALD)', by: 'next season' }, type: 'Hold', cur: d, hist: cy + ': ' + a.toFixed(h[3]) + ' → ' + b.toFixed(h[3]) + ' ' + h[2], txt: 'drop < 1%', why: 'Fell ' + Math.abs(d).toFixed(1) + '% from first half to second half in ' + cy + '.' });
  });
  return out.sort(function (a, b) { return YG_RANK[a.type] - YG_RANK[b.type]; });
}
function yrSugHTML(name) {
  var S = yrSuggest(name); YR._sug = S;
  if (!S.length) return '<div style="font-size:11px;color:var(--text3);margin-top:8px;">No goal suggestions — not enough ' + yrYears()[2] + ' data.</div>';
  return '<div style="margin-top:10px;"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Suggested goals · tap ＋ to use one (pick 2–3)</div>'
    + S.map(function (s, i) {
      return '<div style="display:grid;grid-template-columns:78px 1fr auto;gap:10px;align-items:center;padding:8px 10px;margin-bottom:6px;border-radius:9px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);">'
        + '<span style="font-size:10px;font-weight:800;color:' + YG_COL[s.type] + ';text-transform:uppercase;letter-spacing:.5px;">' + s.type + '</span>'
        + '<div><div style="font-size:12.5px;color:#fff;font-weight:700;">' + yrEsc(s.m.label) + ' <span style="font-family:\'DM Mono\',monospace;color:' + YG_COL[s.type] + ';">' + yrEsc(s.txt) + (s.m.unit !== '%' ? ' ' + s.m.unit : '') + '</span></div>'
        + '<div style="font-size:10.5px;color:var(--text2);margin-top:2px;">' + yrEsc(s.why) + '</div>'
        + '<div style="font-size:9.5px;color:var(--text3);margin-top:2px;">' + yrEsc(s.hist) + ' · test: ' + yrEsc(s.m.test) + '</div></div>'
        + '<button onclick="yrUseSug(' + i + ')" title="Add to off-season targets" style="padding:5px 10px;border-radius:7px;border:1px solid rgba(96,165,250,.45);background:rgba(14,51,134,.35);color:#bfdbfe;font-size:12px;font-weight:700;cursor:pointer;">＋</button></div>';
    }).join('') + '</div>';
}
function yrUseSug(i) {
  var s = YR._sug && YR._sug[i]; if (!s) return;
  for (var r = 0; r < 3; r++) {
    var g = document.getElementById('yr-g' + r); if (!g || g.value.trim()) continue;
    g.value = s.m.label; document.getElementById('yr-t' + r).value = s.txt + (s.m.unit !== '%' ? ' ' + s.m.unit : ''); document.getElementById('yr-b' + r).value = s.m.by;
    g.focus(); return;
  }
  alert('All three target rows are full — clear one first.');
}
// Show suggestions inside the note editor, under the target rows
(function () {
  if (typeof yrNote !== 'function') return;
  var _n = yrNote;
  yrNote = function (name, y) {
    var h = _n.apply(this, arguments), mark = '<div style="display:flex;gap:8px;margin-top:8px;align-items:center;"><button onclick="yrSaveNote(false)"';
    var i = h.indexOf(mark);
    return i >= 0 ? h.slice(0, i) + yrSugHTML(name) + h.slice(i) : h;
  };
})();
