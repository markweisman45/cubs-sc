// ═══════════════════════════════════════════════════════════════════════════
// Year in Review · Off-Season — the player landing tab.
// Last three seasons side by side for everything S&C touches, each vs the league
// where public data exists (MLB percentile), otherwise vs the Cubs roster.
//   Summary   games (of 162), PA, SB/CS, IL stints        MLB Stats API (public)
//   Speed     sprint speed, home to 1st, bolts             Baseball Savant
//             linear / curve / steal-attempt run speed     HE Runs (internal → team rank)
//   Bat & arm bat speed, EV, arm max / strength            Savant · throw avg & 90th from In-Season data
//   Jump      CMJ season averages                          VALD vs MLB position norms (VALD 2025)
//   Shape     first half vs second half each season
//   Note      coach note + off-season targets, shown on the page once published
// ═══════════════════════════════════════════════════════════════════════════
var YR = { mlb: {}, loading: {}, edit: false };
var YR_KEY = 'cubs_sc_yir_v1';
var YR_HALF = '-07-01';   // second half starts July 1
function yrYears() { var d = new Date(), y = d.getFullYear(); if (d.getMonth() < 3) y--; return [y - 2, y - 1, y].map(String); }
function yrEsc(x) { return typeof escHtml === 'function' ? escHtml(String(x == null ? '' : x)) : String(x == null ? '' : x); }
function yrD(s) { if (!s) return null; var d = typeof safeParseDate === 'function' ? safeParseDate(s) : new Date(s); return d && !isNaN(d) ? d : null; }
function yrIso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function yrStats(a) {
  if (!a.length) return null;
  var s = a.slice().sort(function (x, y) { return x - y; }), i = (s.length - 1) * 0.9, lo = Math.floor(i), hi = Math.ceil(i);
  return { top: s[s.length - 1], avg: a.reduce(function (t, x) { return t + x; }, 0) / a.length, p90: s[lo] + (s[hi] - s[lo]) * (i - lo), n: a.length };
}
function yrOrd(n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
function yrPctCol(p) { return p == null ? 'var(--text3)' : p >= 75 ? '#22c55e' : p <= 25 ? '#f87171' : '#cbd5e1'; }
function yrStore() { try { return JSON.parse(localStorage.getItem(YR_KEY) || '{}'); } catch (e) { return {}; } }
function yrSaveStore(o) { try { localStorage.setItem(YR_KEY, JSON.stringify(o)); } catch (e) {} if (typeof syncToSupabase === 'function') setTimeout(syncToSupabase, 800); }

// ── Public MLB data: games, PA, SB/CS by season + IL stints ──────────────────
async function yrMLB(id) {
  if (!id) return null;
  if (YR.mlb[id]) return YR.mlb[id];
  var ys = yrYears(), out = { seasons: {}, il: [], err: null };
  try {
    var j = await (await fetch('https://statsapi.mlb.com/api/v1/people/' + id + '/stats?stats=yearByYear&group=hitting&gameType=R')).json();
    ((j.stats && j.stats[0] && j.stats[0].splits) || []).forEach(function (s) {
      if (ys.indexOf(String(s.season)) < 0 || !s.sport || s.sport.id !== 1) return;
      var S = out.seasons[s.season] = out.seasons[s.season] || { g: 0, pa: 0, sb: 0, cs: 0 };
      S.g += s.stat.gamesPlayed || 0; S.pa += s.stat.plateAppearances || 0; S.sb += s.stat.stolenBases || 0; S.cs += s.stat.caughtStealing || 0;
    });
  } catch (e) { out.err = 'stats'; }
  try {
    var t = await (await fetch('https://statsapi.mlb.com/api/v1/transactions?playerId=' + id + '&startDate=' + ys[0] + '-01-01&endDate=' + ys[2] + '-12-31')).json();
    var T = (t.transactions || []).filter(function (x) { return /injured list/i.test(x.description || ''); }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var open = null;
    T.forEach(function (x) {
      var d = x.description, m;
      if ((m = d.match(/placed .*? on the (\d+)-day injured list/i))) {
        var r = d.match(/retroactive to ([A-Z][a-z]+\.? \d{1,2}, \d{4})/), rd = r ? yrD(r[1]) : null;
        var inj = (d.split(/injured list[^.]*\./i)[1] || '').trim().replace(/\.$/, '');
        open = { start: rd ? yrIso(rd) : x.date, list: m[1] + '-day', injury: inj, end: null };
        out.il.push(open);
      } else if ((m = d.match(/transferred .*? to the (\d+)-day injured list/i))) { if (open) open.list = m[1] + '-day'; }
      else if (/activated|reinstated/i.test(d) && open) { open.end = x.date; open = null; }
    });
    out.il.forEach(function (s) {
      var a = yrD(s.start), b = s.end ? yrD(s.end) : new Date(Math.min(Date.now(), new Date(+s.start.slice(0, 4), 9, 1)));
      s.days = a && b ? Math.max(0, Math.round((b - a) / 864e5)) : null; s.year = s.start.slice(0, 4);
    });
  } catch (e) { out.err = (out.err ? out.err + ', ' : '') + 'transactions'; }
  YR.mlb[id] = out;
  return out;
}

// ── Internal data helpers ────────────────────────────────────────────────────
function yrRuns(name, y, kind, half) {
  return (typeof heRunsData !== 'undefined' && heRunsData[name] || []).filter(function (r) {
    if (!(r.speed > 0)) return false;
    var d = yrD(r.date); if (!d || String(d.getFullYear()) !== y) return false;
    if (half) { var h2 = yrIso(d) >= y + YR_HALF; if ((half === 2) !== h2) return false; }
    var ctx = String(r.context || '').toLowerCase().trim(), c = typeof classifyRun === 'function' ? classifyRun(r) : 'other';
    if (kind === 'str') return c === 'str';
    if (kind === 'cur') return c === 'cur';
    if (kind === 'steal') return /^(sb|cs)\b/.test(ctx);
    if (kind === 'run') return c === 'str' || c === 'cur';
    return true;
  }).map(function (r) { return r.speed; });
}
function yrHit(name, y, k, half) {
  return (typeof importedData !== 'undefined' && importedData.hitting && importedData.hitting[name] || []).filter(function (h) {
    var d = yrD(h.date); if (!d || String(d.getFullYear()) !== y || !(h[k] > 0)) return false;
    if (half) { var h2 = yrIso(d) >= y + YR_HALF; if ((half === 2) !== h2) return false; } return true;
  }).map(function (h) { return h[k]; });
}
function yrVald(name, y, type) {
  var T = (typeof JP !== 'undefined' && JP.data && JP.data.players && JP.data.players[name]) || [];
  return T.filter(function (t) { return t.d.slice(0, 4) === y && (!type || t.t === type); }).sort(function (a, b) { return a.d < b.d ? -1 : 1; });
}
// Team rank for an internal stat (1 = best) among roster athletes with data that season
function yrTeamRank(fn, name, y) {
  var rows = Object.keys(PLAYERS).map(function (n) { var v = fn(n, y); return v == null ? null : { n: n, v: v }; }).filter(Boolean);
  var me = rows.find(function (r) { return r.n === name; }); if (!me || rows.length < 3) return null;
  return { rank: rows.filter(function (r) { return r.v > me.v; }).length + 1, of: rows.length };
}

// ── Metric rows: { label, unit, dec, lower, src, cells: {y: {v, tag, col}} } ─
function yrBuild(name) {
  var ys = yrYears(), sv = typeof VA !== 'undefined' && VA.data && VA.data.rows ? VA.data.rows.find(function (x) { return x.roster === name; }) : null;
  var grp = typeof mlbAutoGroup === 'function' ? mlbAutoGroup(name) : 'g2';
  var savRow = function (k, label) {
    var m = SV.M.find(function (q) { return q.k === k; }), x = sv && sv.metrics[k]; if (!m || !x) return null;
    var cells = {}; ys.forEach(function (y) { if (x.vals[y] != null) cells[y] = { v: x.vals[y], tag: x.pcts[y] != null ? 'MLB ' + yrOrd(x.pcts[y]) : '', col: yrPctCol(x.pcts[y]) }; });
    return { label: label || m.label, unit: m.unit, dec: m.dec, lower: !!m.lower, src: 'Savant', cells: cells };
  };
  var runRow = function (kind, stat, label) {
    var f = function (n, y) { var s = yrStats(yrRuns(n, y, kind)); return s && s.n >= 3 ? s[stat] : null; };
    var cells = {}; ys.forEach(function (y) { var v = f(name, y); if (v == null) return; var r = yrTeamRank(f, name, y), s = yrStats(yrRuns(name, y, kind)); cells[y] = { v: v, tag: (r ? 'Team #' + r.rank + '/' + r.of : '') + ' · ' + s.n + ' runs', col: r ? (r.rank <= Math.ceil(r.of / 4) ? '#22c55e' : r.rank > r.of - Math.ceil(r.of / 4) ? '#f87171' : '#cbd5e1') : 'var(--text3)' }; });
    return { label: label, unit: 'ft/s', dec: 1, src: 'HE Runs', cells: cells };
  };
  var hitRow = function (k, stat, label, unit) {
    var cells = {}; ys.forEach(function (y) { var s = yrStats(yrHit(name, y, k)); if (s) cells[y] = { v: s[stat], tag: s.n + ' events', col: 'var(--text3)' }; });
    return { label: label, unit: unit, dec: 1, src: 'In-Season', cells: cells };
  };
  var cmjRow = function (k, teamRank) {
    var jm = jpM(k), cells = {};
    var f = function (n, y) { var v = yrVald(n, y, 'CMJ').map(function (t) { return t.v[k]; }).filter(function (v) { return v != null; }); return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null; };
    ys.forEach(function (y) {
      var v = f(name, y); if (v == null) return;
      if (teamRank) { var r = yrTeamRank(f, name, y); cells[y] = { v: v, tag: r ? 'Team #' + r.rank + '/' + r.of : '', col: 'var(--text2)' }; }
      else { var p = mlbPct(k, v, grp); cells[y] = { v: v, tag: p ? 'MLB ' + p.txt : '', col: p ? yrPctCol(p.p) : 'var(--text3)' }; }
    });
    return { label: jm.label + ' (season avg)', unit: jm.unit, dec: jm.dec, lower: jm.dir === -1, src: teamRank ? 'VALD · team' : 'VALD · MLB norm', cells: cells };
  };
  var exposure = { label: 'Max-velocity exposures / week', unit: 'runs', dec: 1, src: 'HE Runs', cells: {} };
  ys.forEach(function (y) {
    var R = (typeof heRunsData !== 'undefined' && heRunsData[name] || []).filter(function (r) { var d = yrD(r.date); return r.speed > 0 && d && String(d.getFullYear()) === y; });
    if (R.length < 5) return;
    var mx = Math.max.apply(null, R.map(function (r) { return r.speed; })), ds = R.map(function (r) { return yrD(r.date); });
    var weeks = Math.max(1, (Math.max.apply(null, ds) - Math.min.apply(null, ds)) / (7 * 864e5)), n = R.filter(function (r) { return r.speed >= 0.9 * mx; }).length;
    exposure.cells[y] = { v: n / weeks, tag: n + ' runs ≥90% of ' + mx.toFixed(1), col: 'var(--text3)' };
  });
  var bw = { label: 'Body weight (spring training → last test)', unit: 'lb', dec: 0, src: 'VALD', ctx: 1, cells: {} };
  ys.forEach(function (y) { var T = yrVald(name, y).filter(function (t) { return t.v && t.v.bw && t.d >= y + '-02-01'; }); if (T.length >= 2) bw.cells[y] = { v: T[T.length - 1].v.bw, txt: Math.round(T[0].v.bw) + ' → ' + Math.round(T[T.length - 1].v.bw), tag: jpFd ? jpFd(T[0].d).replace(/, \d{4}/, '') + ' – ' + jpFd(T[T.length - 1].d).replace(/, \d{4}/, '') : '', col: 'var(--text3)' }; });
  var isC = /^C$/i.test((PLAYERS[name] || {}).pos || '');
  var sections = [
    { icon: '💨', title: 'Speed', sub: 'Savant vs MLB · HE runs vs the Cubs roster', rows: [
      savRow('sprint'), savRow('hp1b'), savRow('bolts', 'Bolts (30+ ft/s runs)'),
      runRow('str', 'top', 'Linear sprint — top'), runRow('str', 'p90', 'Linear sprint — 90th'),
      runRow('cur', 'top', 'Curve sprint — top'), runRow('cur', 'p90', 'Curve sprint — 90th'),
      runRow('steal', 'top', 'SB / CS attempts — top'), runRow('steal', 'p90', 'SB / CS attempts — 90th'),
      exposure] },
    { icon: '🌀', title: 'Bat & arm', sub: 'Savant vs MLB · throw avg / 90th from In-Season data (not public)', rows: [
      savRow('bat'), savRow('fast'), savRow('ev50'), savRow('maxev'),
      savRow('armmax', 'Arm — top (max throw)'), savRow('arm', 'Arm strength (Savant)'),
      hitRow('throwV', 'avg', 'Throw velo — avg', 'mph'), hitRow('throwV', 'p90', 'Throw velo — 90th', 'mph'),
      savRow('oaa', 'Outs above average'), isC ? savRow('pop', 'Pop time to 2B') : null] },
    { icon: '🦘', title: 'Jump (CMJ)', sub: 'season average of best trial per session · vs MLB at his position (VALD 2025)', rows: [
      cmjRow('jh'), cmjRow('ppbm'), cmjRow('cppbm', true), cmjRow('rsi'), cmjRow('ftct'), cmjRow('cpf'), cmjRow('edrfd', true), bw] }
  ];
  sections.forEach(function (s) { s.rows = s.rows.filter(function (r) { return r && Object.keys(r.cells).length; }); });
  return { ys: ys, sections: sections.filter(function (s) { return s.rows.length; }), sv: sv };
}

// ── Rendering ────────────────────────────────────────────────────────────────
function yrFmt(r, v) { if (v == null || isNaN(v)) return '—'; var s = (+v).toFixed(r.dec); return /^-0(\.0+)?$/.test(s) ? s.slice(1) : s; }
function yrSpark(r, ys) {
  var pts = ys.map(function (y, i) { return r.cells[y] ? { i: i, v: r.cells[y].v } : null; }).filter(Boolean);
  if (pts.length < 2) return '<span style="font-size:10px;color:var(--text3);">—</span>';
  var vs = pts.map(function (p) { return p.v; }), lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs); if (hi === lo) { hi += 1; lo -= 1; }
  var W = 70, H = 24, X = function (i) { return 5 + (W - 10) * i / (ys.length - 1); }, Y = function (v) { var t = (v - lo) / (hi - lo); if (r.lower) t = 1 - t; return 4 + (H - 8) * (1 - t); };
  var a = pts[0].v, b = pts[pts.length - 1].v, up = r.lower ? b < a : b > a, flat = Math.abs(b - a) / Math.abs(a || 1) < 0.01, c = r.ctx || flat ? '#94a3b8' : up ? '#22c55e' : '#f87171';
  return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="three-season trend"><path d="' + pts.map(function (p, k) { return (k ? 'L' : 'M') + X(p.i).toFixed(1) + ' ' + Y(p.v).toFixed(1); }).join(' ') + '" fill="none" stroke="' + c + '" stroke-width="2" stroke-linecap="round"/>'
    + pts.map(function (p) { return '<circle cx="' + X(p.i).toFixed(1) + '" cy="' + Y(p.v).toFixed(1) + '" r="2.6" fill="' + c + '"/>'; }).join('') + '</svg>';
}
function yrChange(r, ys) {
  var p = ys.filter(function (y) { return r.cells[y]; }); if (p.length < 2) return '<span style="color:var(--text3);">—</span>';
  var a = r.cells[p[0]].v, b = r.cells[p[p.length - 1]].v, d = b - a, good = r.lower ? d < 0 : d > 0, flat = Math.abs(d) / Math.abs(a || 1) < 0.01;
  var c = r.ctx || flat ? 'var(--text2)' : good ? '#22c55e' : '#f87171';
  return '<span style="color:' + c + ';font-weight:700;font-family:\'DM Mono\',monospace;font-size:12px;">' + (d >= 0 ? '+' : '−') + Math.abs(d).toFixed(r.dec) + '</span><div style="font-size:9px;color:var(--text3);">' + p[0] + '→' + p[p.length - 1] + '</div>';
}
var YR_G = '200px repeat(3,minmax(96px,1fr)) 80px 70px';
function yrSection(s, ys) {
  return '<div class="card" style="padding:14px 16px;border-radius:12px;margin-bottom:14px;overflow-x:auto;">'
    + '<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:6px;flex-wrap:wrap;"><span style="font-size:15px;">' + s.icon + '</span><span style="font-size:14px;font-weight:800;color:#fff;">' + s.title + '</span><span style="font-size:10.5px;color:var(--text3);">' + s.sub + '</span></div>'
    + '<div style="min-width:700px;"><div style="display:grid;grid-template-columns:' + YR_G + ';gap:12px;padding:2px 0 6px;font-size:9.5px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;"><div></div>' + ys.map(function (y) { return '<div style="text-align:right;">' + y + '</div>'; }).join('') + '<div style="text-align:center;">Trend</div><div style="text-align:right;">Change</div></div>'
    + s.rows.map(function (r) {
      return '<div style="display:grid;grid-template-columns:' + YR_G + ';gap:12px;align-items:center;padding:7px 0;border-top:1px solid rgba(255,255,255,.05);">'
        + '<div><div style="font-size:12px;color:#e2e8f0;font-weight:600;line-height:1.25;">' + yrEsc(r.label) + '</div><div style="font-size:9.5px;color:var(--text3);">' + (r.unit || '') + (r.lower ? ' · lower is better' : '') + ' · ' + r.src + '</div></div>'
        + ys.map(function (y) { var c = r.cells[y]; return '<div style="text-align:right;">' + (c ? '<div style="font-family:\'DM Mono\',monospace;font-size:' + (y === ys[2] ? 14.5 : 13) + 'px;font-weight:800;color:' + (y === ys[2] ? '#fff' : '#cbd5e1') + ';">' + (c.txt || yrFmt(r, c.v)) + '</div><div style="font-size:9.5px;color:' + c.col + ';font-weight:600;white-space:nowrap;">' + yrEsc(c.tag || '') + '</div>' : '<span style="color:var(--text3);">—</span>') + '</div>'; }).join('')
        + '<div style="display:flex;justify-content:center;">' + yrSpark(r, ys) + '</div><div style="text-align:right;">' + yrChange(r, ys) + '</div></div>';
    }).join('') + '</div></div>';
}
function yrSummary(name, mlb, ys, B) {
  var p = PLAYERS[name] || {}, sv = B.sv, age = sv && sv.age;
  var cols = ys.map(function (y) {
    var S = mlb && mlb.seasons[y], il = (mlb && mlb.il || []).filter(function (s) { return s.year === y; }), ild = il.reduce(function (t, s) { return t + (s.days || 0); }, 0);
    var g = S ? S.g : null, pct = g != null ? Math.min(100, g / 162 * 100) : 0;
    return '<div style="padding:12px 14px;border-radius:10px;background:rgba(255,255,255,' + (y === ys[2] ? '.06' : '.03') + ');border:1px solid rgba(255,255,255,' + (y === ys[2] ? '.14' : '.06') + ');">'
      + '<div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.6px;">' + y + (y === ys[2] ? ' · this season' : '') + '</div>'
      + '<div style="display:flex;align-items:baseline;gap:6px;margin-top:4px;"><span style="font-size:26px;font-weight:800;color:#fff;font-family:\'DM Mono\',monospace;">' + (g == null ? '—' : g) + '</span><span style="font-size:11px;color:var(--text3);">of 162 games</span></div>'
      + '<div style="height:6px;border-radius:3px;background:rgba(255,255,255,.08);margin:6px 0 8px;"><div style="height:6px;border-radius:3px;width:' + pct.toFixed(1) + '%;background:' + (pct >= 90 ? '#22c55e' : pct >= 70 ? '#93c5fd' : '#fbbf24') + ';"></div></div>'
      + '<div style="display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--text2);"><span><b style="color:#fff;">' + (S ? S.pa : '—') + '</b> PA</span><span><b style="color:#fff;">' + (S ? S.sb : '—') + '</b> SB</span><span><b style="color:#fff;">' + (S ? S.cs : '—') + '</b> CS</span><span style="color:' + (il.length ? '#fbbf24' : 'var(--text3)') + ';"><b>' + il.length + '</b> IL stint' + (il.length === 1 ? '' : 's') + (ild ? ' · ' + ild + ' days' : '') + '</span></div></div>';
  }).join('');
  var stints = (mlb && mlb.il || []).slice().reverse().map(function (s) {
    return '<div style="display:grid;grid-template-columns:120px 70px 1fr 70px;gap:10px;padding:6px 0;border-top:1px solid rgba(255,255,255,.05);font-size:11.5px;"><span style="color:var(--text2);">' + (typeof jpFd === 'function' ? jpFd(s.start) : s.start) + '</span><span style="color:#fbbf24;">' + s.list + '</span><span style="color:#e2e8f0;">' + yrEsc(s.injury || 'injury not listed') + '</span><span style="text-align:right;color:var(--text2);">' + (s.days != null ? s.days + ' days' : '') + (s.end ? '' : ' *') + '</span></div>';
  }).join('');
  return '<div class="card" style="padding:18px 20px;border-radius:14px;margin-bottom:14px;background:linear-gradient(135deg,rgba(14,51,134,.45),rgba(15,23,42,.6));border:1px solid rgba(96,165,250,.25);">'
    + '<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px;"><div><div style="font-family:\'Bebas Neue\',sans-serif;font-size:32px;letter-spacing:.03em;color:#fff;line-height:1;">' + yrEsc(name) + '</div>'
    + '<div style="font-size:12px;color:#bfdbfe;margin-top:4px;">' + yrEsc(p.pos || '') + (age ? ' · age ' + age + ' in ' + ys[2] : '') + ' · ' + ys[0] + '–' + ys[2] + ' regular season</div></div>'
    + '<button onclick="yrPrint()" style="padding:6px 12px;background:rgba(14,51,134,.3);border:1px solid rgba(96,165,250,.45);border-radius:6px;color:#93c5fd;font-size:11px;cursor:pointer;">🖨 Print / PDF</button></div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">' + cols + '</div>'
    + (stints ? '<div style="margin-top:12px;"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.6px;margin-bottom:2px;">Injured list</div>' + stints + '</div>' : (mlb ? '<div style="margin-top:10px;font-size:11px;color:var(--text3);">No injured-list stints ' + ys[0] + '–' + ys[2] + '.</div>' : ''))
    + (mlb && mlb.err ? '<div style="font-size:10px;color:#fbbf24;margin-top:6px;">Couldn\'t reach MLB ' + mlb.err + ' — try ↻ later.</div>' : '')
    + '<div style="font-size:9.5px;color:var(--text3);margin-top:8px;">Games, PA, SB/CS and IL from MLB (public). * still on the list or no activation found — counted to season end.</div></div>';
}
// First half vs second half each season (July 1 split)
function yrShape(name, ys) {
  var avg = function (a) { return a.length ? a.reduce(function (t, x) { return t + x; }, 0) / a.length : null; };
  var rows = [
    { label: 'Run speed — 90th (HE, linear + curve)', unit: 'ft/s', dec: 1, f: function (y, h) { var s = yrStats(yrRuns(name, y, 'run', h)); return s && s.n >= 5 ? s.p90 : null; } },
    { label: 'CMJ jump height — avg', unit: 'cm', dec: 1, f: function (y, h) { return avg(yrVald(name, y, 'CMJ').filter(function (t) { return (t.d >= y + YR_HALF) === (h === 2) && t.v.jh != null; }).map(function (t) { return t.v.jh; })); } },
    { label: 'Bat speed — avg (In-Season)', unit: 'mph', dec: 1, f: function (y, h) { return avg(yrHit(name, y, 'bat', h)); } }
  ];
  var body = rows.map(function (r) {
    var cells = ys.map(function (y) {
      var a = r.f(y, 1), b = r.f(y, 2);
      if (a == null || b == null) return '<div style="text-align:right;color:var(--text3);">—</div>';
      var d = (b - a) / Math.abs(a) * 100, c = Math.abs(d) < 1 ? 'var(--text2)' : d > 0 ? '#22c55e' : '#f87171';
      return '<div style="text-align:right;"><div style="font-family:\'DM Mono\',monospace;font-size:12px;color:#e2e8f0;">' + a.toFixed(r.dec) + ' → <b style="color:#fff;">' + b.toFixed(r.dec) + '</b></div><div style="font-size:10px;font-weight:700;color:' + c + ';">' + (d >= 0 ? '+' : '−') + Math.abs(d).toFixed(1) + '% 2nd half</div></div>';
    });
    if (cells.every(function (c) { return c.indexOf('—') >= 0 && c.indexOf('→') < 0; })) return '';
    return '<div style="display:grid;grid-template-columns:200px repeat(3,minmax(120px,1fr));gap:12px;align-items:center;padding:7px 0;border-top:1px solid rgba(255,255,255,.05);"><div><div style="font-size:12px;color:#e2e8f0;font-weight:600;">' + r.label + '</div><div style="font-size:9.5px;color:var(--text3);">' + r.unit + '</div></div>' + cells.join('') + '</div>';
  }).join('');
  if (!body) return '';
  return '<div class="card" style="padding:14px 16px;border-radius:12px;margin-bottom:14px;overflow-x:auto;"><div style="display:flex;align-items:baseline;gap:8px;margin-bottom:6px;flex-wrap:wrap;"><span style="font-size:15px;">📉</span><span style="font-size:14px;font-weight:800;color:#fff;">Did he hold it?</span><span style="font-size:10.5px;color:var(--text3);">first half (to June 30) → second half, each season</span></div>'
    + '<div style="min-width:620px;"><div style="display:grid;grid-template-columns:200px repeat(3,minmax(120px,1fr));gap:12px;padding:2px 0 6px;font-size:9.5px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;"><div></div>' + ys.map(function (y) { return '<div style="text-align:right;">' + y + '</div>'; }).join('') + '</div>' + body + '</div></div>';
}
// Coach note + off-season targets: draft privately, publish to show on the page
function yrNote(name, y) {
  var st = yrStore(), rec = (st[name] && st[name][y]) || {}, pub = rec.pub, dr = rec.draft || pub || { text: '', targets: [] };
  var tg = (dr.targets || []).concat([{}, {}, {}]).slice(0, 3);
  var pubHTML = pub && (pub.text || (pub.targets || []).some(function (t) { return t.goal; }))
    ? '<div style="font-size:13px;color:#e2e8f0;line-height:1.65;white-space:pre-wrap;">' + yrEsc(pub.text) + '</div>'
      + ((pub.targets || []).filter(function (t) { return t.goal; }).length ? '<div style="margin-top:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;">' + pub.targets.filter(function (t) { return t.goal; }).map(function (t) { return '<div style="padding:10px 12px;border-radius:9px;background:rgba(250,204,21,.07);border:1px solid rgba(250,204,21,.25);"><div style="font-size:12px;font-weight:700;color:#fff;">🎯 ' + yrEsc(t.goal) + '</div><div style="font-size:11px;color:#fde68a;margin-top:2px;">' + yrEsc(t.target || '') + (t.by ? ' · by ' + yrEsc(t.by) : '') + '</div></div>'; }).join('') + '</div>' : '')
      + '<div style="font-size:9.5px;color:var(--text3);margin-top:10px;">Published ' + new Date(pub.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + '</div>'
    : '<div style="font-size:12px;color:var(--text3);">No note published for ' + y + ' yet.</div>';
  var changed = rec.draft && JSON.stringify(rec.draft) !== JSON.stringify(pub ? { text: pub.text, targets: pub.targets } : null);
  var inp = 'background:var(--bg3);border:1px solid var(--border2);border-radius:7px;padding:6px 9px;color:var(--text);font-size:12px;';
  var editor = '<details id="yr-editor"' + (YR.edit ? ' open' : '') + ' ontoggle="YR.edit=this.open" style="margin-top:12px;border-top:1px solid rgba(255,255,255,.08);padding-top:10px;" class="yr-noprint"><summary style="cursor:pointer;font-size:12px;color:#93c5fd;font-weight:700;">✏️ Write / edit note' + (changed ? ' <span style="color:#fbbf24;font-weight:600;">· unpublished changes</span>' : '') + '</summary>'
    + '<textarea id="yr-text" rows="6" placeholder="Season recap, what we saw, what we\'re building this off-season…" style="' + inp + 'width:100%;box-sizing:border-box;margin-top:10px;line-height:1.5;">' + yrEsc(dr.text || '') + '</textarea>'
    + '<div style="font-size:10px;color:var(--text3);margin:8px 0 4px;text-transform:uppercase;letter-spacing:.5px;">Off-season targets</div>'
    + tg.map(function (t, i) { return '<div style="display:grid;grid-template-columns:2fr 1.2fr 1fr;gap:6px;margin-bottom:6px;"><input id="yr-g' + i + '" value="' + yrEsc(t.goal || '') + '" placeholder="Goal (e.g. CMJ jump height)" style="' + inp + '"><input id="yr-t' + i + '" value="' + yrEsc(t.target || '') + '" placeholder="Target (e.g. 55+ cm)" style="' + inp + '"><input id="yr-b' + i + '" value="' + yrEsc(t.by || '') + '" placeholder="By (e.g. Spring Training)" style="' + inp + '"></div>'; }).join('')
    + '<div style="display:flex;gap:8px;margin-top:8px;align-items:center;"><button onclick="yrSaveNote(false)" style="padding:7px 14px;border-radius:7px;border:1px solid var(--border2);background:transparent;color:var(--text2);font-size:12px;cursor:pointer;">Save draft</button>'
    + '<button onclick="yrSaveNote(true)" style="padding:7px 16px;border-radius:7px;border:none;background:#0E3386;color:#fff;font-size:12px;font-weight:700;cursor:pointer;">📣 Publish to page</button><span id="yr-msg" style="font-size:11px;color:#22c55e;"></span></div></details>';
  return '<div class="card" style="padding:16px 18px;border-radius:12px;margin-bottom:14px;border:1px solid rgba(250,204,21,.3);"><div style="display:flex;align-items:baseline;gap:8px;margin-bottom:10px;"><span style="font-size:15px;">📝</span><span style="font-size:14px;font-weight:800;color:#fff;">Coach\'s note · ' + y + ' off-season</span></div>' + pubHTML + editor + '</div>';
}
function yrSaveNote(publish) {
  var name = currentPlayer, y = yrYears()[2], st = yrStore();
  var d = { text: (document.getElementById('yr-text') || {}).value || '', targets: [0, 1, 2].map(function (i) { return { goal: (document.getElementById('yr-g' + i) || {}).value || '', target: (document.getElementById('yr-t' + i) || {}).value || '', by: (document.getElementById('yr-b' + i) || {}).value || '' }; }).filter(function (t) { return t.goal || t.target || t.by; }) };
  st[name] = st[name] || {}; var rec = st[name][y] = st[name][y] || {};
  rec.draft = d;
  if (publish) rec.pub = { text: d.text, targets: d.targets, at: new Date().toISOString() };
  yrSaveStore(st);
  YR.edit = !publish;
  renderYearInReview();
  var m = document.getElementById('yr-msg'); if (m) { m.textContent = publish ? '' : 'Draft saved'; setTimeout(function () { if (m) m.textContent = ''; }, 2500); }
}
function yrPrint() {
  var el = document.getElementById('dash-review'); if (!el) return;
  var css = Array.prototype.map.call(document.querySelectorAll('style'), function (s) { return s.outerHTML; }).join('');
  var w = window.open('', '_blank'); if (!w) return;
  w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Year in Review — ' + yrEsc(currentPlayer) + '</title>' + css + '<style>body{background:#0b0f19;padding:20px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.yr-noprint,button{display:none!important}@page{size:landscape;margin:10mm}</style></head><body>' + el.innerHTML + '<script>setTimeout(function(){window.print()},500)<\/script></body></html>');
  w.document.close();
}
async function renderYearInReview() {
  var y = document.getElementById('review-year'), n = document.getElementById('review-player'), body = document.getElementById('review-body');
  var ys = yrYears(); if (y) y.textContent = ys[2]; if (n) n.textContent = currentPlayer || '';
  if (!body) return;
  body.className = ''; body.style.cssText = '';
  var name = currentPlayer; if (!name) return;
  // Data: VALD jumps, Savant (also gives the MLB player id), then MLB Stats API
  var need = [];
  if (typeof JP !== 'undefined' && !JP.data && !YR.loading.jp) { YR.loading.jp = 1; need.push(jpLoad().finally(function () { YR.loading.jp = 0; })); }
  if (typeof VA !== 'undefined' && !(VA.data && VA.data.D) && !YR.loading.va && typeof vaLoad === 'function') { YR.loading.va = 1; need.push(vaLoad().catch(function () {}).finally(function () { YR.loading.va = 0; })); }
  if (need.length) { body.innerHTML = '<div class="card" style="padding:30px;text-align:center;color:var(--text3);">Loading VALD and Baseball Savant…</div>'; await Promise.all(need); if (currentPlayer !== name) return; }
  var B = yrBuild(name), id = B.sv && B.sv.id, mlb = id ? YR.mlb[id] : null;
  var draw = function () {
    if (currentPlayer !== name) return;
    body.innerHTML = yrSummary(name, mlb, ys, B) + yrNote(name, ys[2]) + B.sections.map(function (s) { return yrSection(s, ys); }).join('') + yrShape(name, ys)
      + '<div style="font-size:10px;color:var(--text3);margin:4px 2px 20px;line-height:1.6;">MLB percentile = where that season ranks among all MLB players (Baseball Savant) or, for CMJ, against MLB players at his position (VALD 2025 norms). Team # = rank on the current Cubs roster that season (internal data, no public league number). Change = first to latest season shown; green is better.</div>';
  };
  draw();
  if (id && !mlb) { mlb = await yrMLB(id); draw(); }
}
