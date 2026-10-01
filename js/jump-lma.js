// ═══════════════════════════════════════════════════════════════════════════
// Jumps → Latest · Max · Avg. Plain numbers for every jump metric:
//  • Team view sub-tab: one row per athlete for the chosen metric (sortable).
//  • Athlete page: every metric for him, side by side.
// Window for Max / Avg: this season (calendar year, default), last 90 days, or all time.
// "Max" = best value, i.e. the lowest for contraction time / braking duration.
// Uses JP.rows from jump-profile.js (best of all trials per session).
// ═══════════════════════════════════════════════════════════════════════════
var JL = { win: 'season', metric: 'jh', type: 'CMJ', sort: 'max', desc: true };
var JL_WIN = { season: 'This season', d90: 'Last 90 days', all: 'All time' };
function jlStart() {
  var t = new Date().toISOString().slice(0, 10);
  return JL.win === 'season' ? t.slice(0, 4) + '-01-01' : JL.win === 'd90' ? jpAddDays(t, -90) : '0000';
}
// Latest (overall) + Max / Avg / n inside the window for one metric of one athlete row
function jlStats(r, k) {
  var m = jpM(k), x = r && r.metrics[k]; if (!x) return null;
  var s = jlStart(), pts = x.pts.filter(function (p) { return p.d >= s; });
  var o = { m: m, latest: x.latest, n: pts.length, max: null, avg: null };
  if (pts.length) {
    o.max = pts.reduce(function (a, b) { return m.dir === -1 ? (b.v < a.v ? b : a) : (b.v > a.v ? b : a); });
    o.avg = jpMean(pts.map(function (p) { return p.v; }));
    o.vsAvg = o.avg ? (x.latest.v - o.avg) / Math.abs(o.avg) * 100 * (m.dir || 1) : null;
    // how close the latest is to his best: 100% = at his max (for lower-is-better, best / latest)
    o.ofMax = o.max.v ? (m.dir === -1 ? o.max.v / x.latest.v : x.latest.v / o.max.v) * 100 : null;
  }
  return o;
}
function jlCtl() {
  var b = function (on, js, label) { return '<button onclick="' + js + '" style="padding:5px 12px;border-radius:7px;border:none;font-size:11.5px;font-weight:700;cursor:pointer;background:' + (on ? '#0E3386' : 'transparent') + ';color:' + (on ? '#fff' : 'var(--text2)') + ';">' + label + '</button>'; };
  return '<div style="display:flex;gap:3px;background:rgba(255,255,255,.04);padding:3px;border-radius:9px;">' + Object.keys(JL_WIN).map(function (w) { return b(JL.win === w, "JL.win='" + w + "';renderJumpProfile()", JL_WIN[w]); }).join('') + '</div>';
}
function jlOfMax(v) {
  if (v == null) return '<span style="color:var(--text3);">—</span>';
  var c = v >= 97 ? '#22c55e' : v >= 92 ? '#cbd5e1' : '#f87171';
  return '<div style="display:flex;align-items:center;gap:6px;justify-content:flex-end;"><div style="width:46px;height:6px;border-radius:3px;background:rgba(255,255,255,.08);position:relative;"><div style="position:absolute;left:0;top:0;bottom:0;width:' + Math.min(100, Math.max(3, (v - 75) * 4)) + '%;border-radius:3px;background:' + c + ';"></div></div><span style="font-family:\'DM Mono\',monospace;font-size:11.5px;color:' + c + ';font-weight:700;">' + v.toFixed(0) + '%</span></div>';
}
function jlDate(d) { return d ? d.slice(5).replace('-', '/') + '/' + d.slice(2, 4) : ''; }
var JL_COLS = '1.5fr 1fr 1fr 1fr 1fr 1fr';
function jlCell(big, sub, hi) { return '<div style="text-align:right;"><div style="font-family:\'DM Mono\',monospace;font-size:' + (hi ? 15 : 13.5) + 'px;font-weight:800;color:' + (hi ? '#fff' : '#e2e8f0') + ';line-height:1.1;">' + big + '</div><div style="font-size:9.5px;color:var(--text3);margin-top:2px;">' + (sub || '&nbsp;') + '</div></div>'; }
function jlHead(cols, extra) {
  return '<div style="display:grid;grid-template-columns:' + cols + ';gap:12px;padding:4px 0 6px;font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;">' + extra + '</div>';
}
// ── Athlete page card: every metric, Latest / Max / Avg ──
function jlAthleteCard(r) {
  if (!r) return '';
  var keys = (r.type === 'ABCMJ' ? JP_AB : JP_M.map(function (m) { return m.k; })).filter(function (k) { return jpM(k).dir; });
  var hasMlb = r.type === 'CMJ' && typeof mlbPct === 'function', grp = hasMlb ? mlbGroup(r.name) : null;
  var cols = '170px repeat(5,minmax(78px,1fr))' + (hasMlb ? ' 78px' : '');
  var rows = keys.map(function (k) {
    var s = jlStats(r, k); if (!s) return '';
    var m = s.m, pl = hasMlb && MLB_NORMS[k] ? mlbPct(k, s.latest.v, grp) : null;
    return '<div style="display:grid;grid-template-columns:' + cols + ';gap:12px;align-items:center;padding:7px 0;border-top:1px solid rgba(255,255,255,.05);">'
      + '<div><div style="font-size:12px;color:#e2e8f0;font-weight:600;line-height:1.2;">' + jpEsc(m.label) + '</div><div style="font-size:9.5px;color:var(--text3);">' + (m.unit || '&nbsp;') + (m.dir === -1 ? ' · lower is better' : '') + '</div></div>'
      + jlCell(jpFmt(m, s.latest.v), jlDate(s.latest.d), true)
      + jlCell(s.max ? jpFmt(m, s.max.v) : '—', s.max ? jlDate(s.max.d) : 'no tests')
      + jlCell(s.avg != null ? jpFmt(m, s.avg) : '—', s.n ? s.n + ' tests' : '')
      + '<div style="text-align:right;">' + (s.vsAvg != null ? jpPill(m, s.vsAvg, '', true) : '<span style="color:var(--text3);">—</span>') + '</div>'
      + jlOfMax(s.ofMax)
      + (hasMlb ? '<div style="text-align:right;font-size:12px;font-weight:800;color:' + (pl ? mlbCol(pl.p) : 'var(--text3)') + ';">' + (pl ? pl.txt : '—') + '</div>' : '') + '</div>';
  }).join('');
  return '<div class="card" style="padding:14px 16px;border-radius:12px;margin-bottom:14px;overflow-x:auto;">'
    + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;"><span style="font-size:15px;">📊</span><span style="font-size:13px;font-weight:800;color:#fff;">Latest · Max · Avg</span><span style="font-size:10.5px;color:var(--text3);">' + r.type + ' · Max &amp; Avg over ' + JL_WIN[JL.win].toLowerCase() + '</span><span style="margin-left:auto;">' + jlCtl() + '</span></div>'
    + '<div style="min-width:640px;">' + jlHead(cols, '<div></div><div style="text-align:right;">Latest</div><div style="text-align:right;" title="Best value in the window (lowest for contraction time / braking duration)">Max</div><div style="text-align:right;">Avg</div><div style="text-align:right;">Latest vs avg</div><div style="text-align:right;" title="Latest as a % of his max in the window">% of max</div>' + (hasMlb ? '<div style="text-align:right;">MLB %ile</div>' : ''))
    + rows + '</div></div>';
}
// ── Team sub-tab: one metric, every athlete ──
function jlSortBy(c) { if (JL.sort === c) JL.desc = !JL.desc; else { JL.sort = c; JL.desc = c !== 'name'; } renderJumpProfile(); }
function jlTeamHTML() {
  var m = jpM(JL.metric) || jpM('jh');
  var keys = (JL.type === 'ABCMJ' ? JP_AB : JP_M.map(function (x) { return x.k; })).filter(function (k) { return jpM(k).dir; });
  if (keys.indexOf(m.k) < 0) { JL.metric = 'jh'; m = jpM('jh'); }
  var hasMlb = JL.type === 'CMJ' && typeof mlbPct === 'function' && MLB_NORMS[m.k];
  var R = (JP.rows || []).filter(function (r) { return r.type === JL.type && r.metrics[m.k]; }).map(function (r) {
    var s = jlStats(r, m.k), pl = hasMlb ? mlbPct(m.k, s.latest.v, mlbGroup(r.name)) : null;
    return { name: r.name, pos: (typeof PLAYERS !== 'undefined' && PLAYERS[r.name] ? PLAYERS[r.name].pos : ''), s: s, pl: pl };
  });
  // Sort: "better" first for value columns (lower-is-better metrics flip)
  var sgn = m.dir === -1 ? -1 : 1, val = function (o) {
    switch (JL.sort) {
      case 'name': return o.name; case 'latest': return o.s.latest.v * sgn; case 'max': return o.s.max ? o.s.max.v * sgn : -Infinity;
      case 'avg': return o.s.avg != null ? o.s.avg * sgn : -Infinity; case 'vs': return o.s.vsAvg != null ? o.s.vsAvg : -Infinity;
      case 'of': return o.s.ofMax != null ? o.s.ofMax : -Infinity; case 'mlb': return o.pl ? o.pl.p : -Infinity; case 'date': return o.s.latest.d;
    } return 0;
  };
  R.sort(function (a, b) { var A = val(a), B = val(b); var c = A < B ? -1 : A > B ? 1 : 0; return JL.desc ? -c : c; });
  var team = function (f) { var v = R.map(f).filter(function (x) { return x != null; }); return v.length ? jpMean(v) : null; };
  var cols = 'minmax(150px,1.4fr) repeat(5,minmax(80px,1fr))' + (hasMlb ? ' 80px' : '');
  var th = function (c, label, tip) { var on = JL.sort === c; return '<div onclick="jlSortBy(\'' + c + '\')" title="' + (tip || 'Sort') + '" style="cursor:pointer;' + (c === 'name' ? '' : 'text-align:right;') + 'color:' + (on ? '#93c5fd' : 'var(--text3)') + ';">' + label + (on ? (JL.desc ? ' ▼' : ' ▲') : '') + '</div>'; };
  var sel = '<select onchange="JL.metric=this.value;renderJumpProfile()" style="background:var(--bg3);border:1px solid var(--border2);border-radius:7px;padding:5px 10px;color:var(--text);font-size:12px;">' + keys.map(function (k) { var x = jpM(k); return '<option value="' + k + '"' + (k === m.k ? ' selected' : '') + '>' + jpEsc(x.label) + (x.unit ? ' (' + x.unit + ')' : '') + '</option>'; }).join('') + '</select>';
  var typ = '<div style="display:flex;gap:3px;background:rgba(255,255,255,.04);padding:3px;border-radius:9px;">' + ['CMJ', 'ABCMJ'].map(function (t) { var on = JL.type === t; return '<button onclick="JL.type=\'' + t + '\';renderJumpProfile()" style="padding:5px 12px;border-radius:7px;border:none;font-size:11.5px;font-weight:700;cursor:pointer;background:' + (on ? '#0E3386' : 'transparent') + ';color:' + (on ? '#fff' : 'var(--text2)') + ';">' + t + '</button>'; }).join('') + '</div>';
  var rows = R.map(function (o) {
    var s = o.s, q = o.name.replace(/'/g, "\\'");
    return '<div onclick="JP.sel=\'' + q + '\';JP.type=\'' + JL.type + '\';renderJumpProfile();window.scrollTo({top:0})" class="va-card" style="cursor:pointer;display:grid;grid-template-columns:' + cols + ';gap:12px;align-items:center;padding:8px 6px;border-top:1px solid rgba(255,255,255,.05);border-radius:6px;">'
      + '<div><div style="font-size:12.5px;color:#fff;font-weight:700;">' + jpEsc(o.name) + '</div><div style="font-size:9.5px;color:var(--text3);">' + jpEsc(o.pos || '') + '</div></div>'
      + jlCell(jpFmt(m, s.latest.v), jlDate(s.latest.d), true)
      + jlCell(s.max ? jpFmt(m, s.max.v) : '—', s.max ? jlDate(s.max.d) : 'no tests')
      + jlCell(s.avg != null ? jpFmt(m, s.avg) : '—', s.n ? s.n + ' tests' : '')
      + '<div style="text-align:right;">' + (s.vsAvg != null ? jpPill(m, s.vsAvg, '', true) : '<span style="color:var(--text3);">—</span>') + '</div>'
      + jlOfMax(s.ofMax)
      + (hasMlb ? '<div style="text-align:right;font-size:12px;font-weight:800;color:' + (o.pl ? mlbCol(o.pl.p) : 'var(--text3)') + ';">' + (o.pl ? o.pl.txt : '—') + '</div>' : '') + '</div>';
  }).join('');
  var avgRow = R.length ? '<div style="display:grid;grid-template-columns:' + cols + ';gap:12px;align-items:center;padding:9px 6px;border-top:2px solid rgba(96,165,250,.3);">'
    + '<div style="font-size:12px;color:#93c5fd;font-weight:800;">Team average</div>'
    + jlCell(jpFmt(m, team(function (o) { return o.s.latest.v; })), '')
    + jlCell(jpFmt(m, team(function (o) { return o.s.max ? o.s.max.v : null; })), '')
    + jlCell(jpFmt(m, team(function (o) { return o.s.avg; })), '')
    + '<div></div><div></div>' + (hasMlb ? '<div></div>' : '') + '</div>' : '';
  return '<div class="card" style="padding:14px 16px;border-radius:12px;overflow-x:auto;">'
    + '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px;"><span style="font-size:15px;">📊</span><span style="font-size:13px;font-weight:800;color:#fff;">Latest · Max · Avg</span>' + sel + typ + '<span style="margin-left:auto;">' + jlCtl() + '</span></div>'
    + '<div style="font-size:10.5px;color:var(--text3);margin-bottom:6px;">Latest = his most recent test · Max = his best over ' + JL_WIN[JL.win].toLowerCase() + (m.dir === -1 ? ' (lowest — lower is better)' : '') + ' · Avg = average of his tests in that window · % of max = latest as a share of his max · click a column to sort, a row to open the athlete</div>'
    + '<div style="min-width:700px;">' + jlHead(cols, th('name', 'Athlete') + th('latest', 'Latest') + th('max', 'Max') + th('avg', 'Avg') + th('vs', 'Latest vs avg') + th('of', '% of max') + (hasMlb ? th('mlb', 'MLB %ile', 'Latest vs MLB at his position') : ''))
    + (rows || '<div style="padding:20px;text-align:center;color:var(--text3);">No ' + JL.type + ' tests for this metric.</div>') + avgRow + '</div></div>';
}
