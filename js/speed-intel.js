// ═══════════════════════════════════════════════════════════════════════════
// Speed intelligence — built on the HE Runs data (heRunsData)
//  1. Max-velocity exposure: days since a run at ≥90% of his own max
//  2. Effort-matched fatigue: like-for-like runs vs his own baseline
//  3. Acceleration vs top-speed profile → speed-block emphasis
//  4. Return-to-play guardrails: % of pre-injury max per game since injury
//  5. Weekly sprint summary written to the athlete's program page
// "His max" = average of his top 3 runs in the 12 months before the date.
// ═══════════════════════════════════════════════════════════════════════════
var SI = (function () {
  var HI = 0.90;            // max-velocity exposure threshold (% of his max)
  var GAP_Y = 7, GAP_R = 10; // days without exposure → yellow / red
  var FAT_Y = 0.95, FAT_R = 0.93;
  var MPH = 0.681818;

  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function runISO(s) {
    s = String(s || '').trim();
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m) return (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0');
    var d = new Date(s); return isNaN(d) ? '' : iso(d);
  }
  function addDays(isoStr, n) { var p = isoStr.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2]); d.setDate(d.getDate() + n); return iso(d); }
  function daysBetween(a, b) { var pa = a.split('-'), pb = b.split('-'); return Math.round((new Date(+pb[0], +pb[1] - 1, +pb[2]) - new Date(+pa[0], +pa[1] - 1, +pa[2])) / 86400000); }
  function median(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }); var h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; }
  function mean(a) { return a.length ? a.reduce(function (s, x) { return s + x; }, 0) / a.length : null; }
  function sd(a) { var m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce(function (s, x) { return s + (x - m) * (x - m); }, 0) / (a.length - 1)) : 0; }

  // Run types that are compared like-for-like. Ground balls and bunts out of
  // the box are the cleanest all-out effort we have for every hitter.
  var TYPES = [
    { key: 'h1',    label: 'Home to 1st · ground balls', test: function (r) { return /^batter/i.test(r.pos) && /^(gb|bunt)\b/i.test(r.context); } },
    { key: 'xbh',   label: 'Extra-base hits',            test: function (r) { return /^batter/i.test(r.pos) && /\b(2b|3b)\b/i.test(r.context) && !/fielder/i.test(r.context); } },
    { key: 'steal', label: 'Steals',                     test: function (r) { return /^(sb|cs)\b/i.test(r.context); } },
    { key: 'bases', label: 'Baserunning (1st→3rd, scoring)', test: function (r) { return /^runner/i.test(r.pos) && /(first to third|second to home|first to home|running from (first|second))/i.test(r.context); } }
  ];

  function clean(runs) {
    return (runs || []).map(function (r) { return { d: runISO(r.date), s: +r.speed || 0, pos: r.pos || '', context: r.context || '', burst: +r.burst || 0, dist: +r.dist || 0, link: r.link || '' }; })
      .filter(function (r) { return r.d && r.s > 15 && r.s < 34; })
      .sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
  }
  // His max as of a date: mean of his top 3 runs in the prior 365 days (inclusive)
  function refMax(runs, asOf) {
    var from = addDays(asOf, -365);
    var s = runs.filter(function (r) { return r.d >= from && r.d <= asOf; }).map(function (r) { return r.s; }).sort(function (a, b) { return b - a; });
    if (!s.length) return null;
    return mean(s.slice(0, Math.min(3, s.length)));
  }

  function typeTrend(runs, t, today) {
    var all = runs.filter(t.test);
    var recentFrom = addDays(today, -21);
    var recent = all.filter(function (r) { return r.d >= recentFrom && r.d <= today; }).slice(-5);
    if (recent.length < 3) return { key: t.key, label: t.label, n: recent.length, level: 'none' };
    var cut = recent[0].d, baseFrom = addDays(cut, -365);
    var base = all.filter(function (r) { return r.d < cut && r.d >= baseFrom; });
    if (base.length < 8) return { key: t.key, label: t.label, n: recent.length, nBase: base.length, level: 'none' };
    var rm = median(recent.map(function (r) { return r.s; })), bm = median(base.map(function (r) { return r.s; }));
    var pct = rm / bm;
    return { key: t.key, label: t.label, n: recent.length, nBase: base.length, recent: rm, base: bm, pct: pct,
      level: pct < FAT_R ? 'red' : pct < FAT_Y ? 'yellow' : 'ok', last: recent[recent.length - 1].d };
  }

  // opts: { today: 'YYYY-MM-DD', programHi: [{date, label}] }
  function analyze(rawRuns, opts) {
    opts = opts || {};
    var today = opts.today || iso(new Date());
    var runs = clean(rawRuns).filter(function (r) { return r.d <= today; });
    var out = { today: today, n: runs.length };
    if (!runs.length) { out.status = 'nodata'; return out; }
    var max = refMax(runs, today);
    out.refMax = max;
    var last = runs[runs.length - 1];
    out.lastRun = last.d;
    out.active = daysBetween(last.d, today) <= 10;
    var season = runs.filter(function (r) { return r.d.slice(0, 4) === today.slice(0, 4); });
    var bestRun = season.slice().sort(function (a, b) { return b.s - a.s; })[0];
    out.seasonBest = bestRun ? { s: bestRun.s, d: bestRun.d } : null;
    // Max-velocity exposures: a game run ≥90% of his max (as of that date), or a logged program sprint
    var hiDays = {};
    runs.forEach(function (r) {
      if (r.d < addDays(today, -60)) return;
      var m = refMax(runs, r.d) || max;
      if (m && r.s >= HI * m) { if (!hiDays[r.d] || r.s > hiDays[r.d].s) hiDays[r.d] = { d: r.d, s: r.s, pct: r.s / m, src: 'game', ctx: r.context }; }
    });
    (opts.programHi || []).forEach(function (p) { if (p.date && p.date <= today && !hiDays[p.date]) hiDays[p.date] = { d: p.date, src: 'program', ctx: p.label }; });
    var hiList = Object.keys(hiDays).sort().map(function (k) { return hiDays[k]; });
    var lastHi = hiList[hiList.length - 1] || null;
    out.lastHi = lastHi;
    out.daysSinceHi = lastHi ? daysBetween(lastHi.d, today) : null;
    out.exp7 = hiList.filter(function (h) { return h.d > addDays(today, -7); }).length;
    out.exp14 = hiList.filter(function (h) { return h.d > addDays(today, -14); }).length;
    var gd = out.daysSinceHi === null ? 99 : out.daysSinceHi;
    out.gap = !out.active ? 'none' : gd >= GAP_R ? 'red' : gd >= GAP_Y ? 'yellow' : 'ok';
    // Week summary
    var wk = runs.filter(function (r) { return r.d > addDays(today, -7); });
    if (wk.length) { var top = wk.reduce(function (a, b) { return b.s > a.s ? b : a; }); out.weekTop = { s: top.s, d: top.d, pct: max ? top.s / max : null, runs: wk.length }; }
    // Effort-matched fatigue
    out.types = TYPES.map(function (t) { return typeTrend(runs, t, today); });
    var lv = out.types.map(function (t) { return t.level; });
    out.fatigue = lv.indexOf('red') >= 0 ? 'red' : lv.indexOf('yellow') >= 0 ? 'yellow' : lv.indexOf('ok') >= 0 ? 'ok' : 'none';
    // Profile inputs
    // Acceleration proxy: how much of his top speed he reaches running ~90 ft to first on ground balls
    var h1s = runs.filter(function (r) { return TYPES[0].test(r) && r.d >= addDays(today, -365); }).map(function (r) { return r.s; });
    out.h1Med = h1s.length >= 15 ? median(h1s) : null;
    out.accelRatio = out.h1Med && max ? out.h1Med / max : null;
    out.status = out.gap === 'red' || out.fatigue === 'red' ? 'red' : out.gap === 'yellow' || out.fatigue === 'yellow' ? 'yellow' : out.active ? 'ok' : 'idle';
    return out;
  }

  // Team-relative profile. accelRatio = % of his top speed reached on home-to-1st.
  // Low vs teammates → he has top speed he can't get to quickly (acceleration-limited).
  // High → he gets to his top speed fast; the ceiling is the limiter (top-speed-limited).
  function profiles(byName) {
    var names = Object.keys(byName).filter(function (n) { return byName[n].accelRatio; });
    var res = {};
    if (names.length < 5) return res;
    var rs = names.map(function (n) { return byName[n].accelRatio; });
    var m = mean(rs), s = sd(rs) || 0.01;
    names.forEach(function (n) {
      var z = (byName[n].accelRatio - m) / s;
      var type = z <= -0.75 ? 'accel' : z >= 0.75 ? 'maxv' : 'balanced';
      res[n] = { z: z, ratio: byName[n].accelRatio, teamRatio: m, type: type,
        label: type === 'accel' ? 'Acceleration-limited' : type === 'maxv' ? 'Top-speed-limited' : 'Balanced',
        why: 'Reaches ' + (byName[n].accelRatio * 100).toFixed(1) + '% of his top speed going home to 1st (team ' + (m * 100).toFixed(1) + '%)',
        emphasis: type === 'accel' ? 'Lean speed blocks toward starts: 10–20 yd accels, resisted/sled sprints, hill runs, 3-point & lateral starts.'
          : type === 'maxv' ? 'Lean speed blocks toward max velocity: build-up flys (20+10 / 20+20 yd), wicket runs, longer sprints with full rest.'
          : 'Keep a mix — accelerations early in the week, flys/build-ups later.' };
    });
    return res;
  }

  // Return-to-play guardrails from an RTP protocol
  function rtpView(protocol, rawRuns, today) {
    today = today || iso(new Date());
    var inj = runISO(protocol.injuryDate || protocol.created || '');
    if (!inj) return null;
    var runs = clean(rawRuns);
    var pre = refMax(runs.filter(function (r) { return r.d < inj; }), addDays(inj, -1));
    var phases = protocol.phases || [];
    function phaseAt(d) {
      for (var i = phases.length - 1; i >= 0; i--) { var st = phases[i].startedAt ? runISO(phases[i].startedAt) : null; if (st && st <= d) return phases[i]; }
      return phases[0] || null;
    }
    var byDay = {};
    runs.filter(function (r) { return r.d > inj && r.d <= today; }).forEach(function (r) { if (!byDay[r.d] || r.s > byDay[r.d].s) byDay[r.d] = r; });
    var games = Object.keys(byDay).sort().map(function (d) {
      var r = byDay[d], ph = phaseAt(d), cap = ph && ph.workload && ph.workload.run ? ph.workload.run[1] : null;
      var pct = pre ? r.s / pre : null;
      return { d: d, s: r.s, pct: pct, ctx: r.context, phase: ph ? ph.name : '', cap: cap, over: cap !== null && cap < 1 && pct !== null && pct > cap + 0.02 };
    });
    var exp = games.filter(function (g) { return g.pct >= HI; });
    var bestPct = games.reduce(function (m, g) { return Math.max(m, g.pct || 0); }, 0);
    return { injury: protocol.injury || 'Injury', injuryDate: inj, status: protocol.status, preMax: pre, games: games, exposures: exp.length, bestPct: bestPct, over: games.filter(function (g) { return g.over; }).length,
      daysOut: daysBetween(inj, today) };
  }

  // Athlete-facing summary (goes into pb_state.speedSummary)
  function athleteSummary(a) {
    if (!a || !a.n || !a.refMax) return null;
    var note = '';
    if (a.gap === 'red' || a.gap === 'yellow') note = 'No full-speed sprint (90%+ of your best) in ' + a.daysSinceHi + ' days — make your next flys or build-ups count.';
    else if (a.exp7 >= 2) note = a.exp7 + ' full-speed exposures this week — nice work staying fast.';
    var h1 = (a.types || []).find(function (t) { return t.key === 'h1' && t.level !== 'none'; });
    return { asOf: a.today, lastRun: a.lastRun, best: +a.refMax.toFixed(2), weekTop: a.weekTop ? +a.weekTop.s.toFixed(2) : null, weekTopPct: a.weekTop && a.weekTop.pct ? Math.round(a.weekTop.pct * 100) : null,
      weekRuns: a.weekTop ? a.weekTop.runs : 0, exp7: a.exp7, daysSinceHi: a.daysSinceHi, seasonBest: a.seasonBest ? +a.seasonBest.s.toFixed(2) : null,
      h1Pct: h1 ? Math.round(h1.pct * 100) : null, note: note };
  }

  return { HI: HI, MPH: MPH, TYPES: TYPES, runISO: runISO, addDays: addDays, daysBetween: daysBetween, median: median, clean: clean, refMax: refMax,
    analyze: analyze, profiles: profiles, rtpView: rtpView, athleteSummary: athleteSummary, iso: iso };
})();

// ═══════════════════════════ Dashboard layer ═══════════════════════════════
var SI_COL = { red: '#f87171', yellow: '#fbbf24', ok: '#22c55e', none: 'var(--text3)', idle: 'var(--text3)', nodata: 'var(--text3)' };
var _siCache = { key: null, all: null, prof: null };
function siEsc(x) { return typeof escHtml === 'function' ? escHtml(String(x == null ? '' : x)) : String(x == null ? '' : x); }
function siFmt(isoStr) { if (!isoStr) return '—'; var p = isoStr.split('-'); return (+p[1]) + '/' + (+p[2]); }
function siToday() { return SI.iso(new Date()); }
function siHE() { return typeof heRunsData !== 'undefined' ? heRunsData : {}; }

// Max-velocity work the athlete logged in his program (counts as an exposure)
var SI_MAXV_RE = /\bfly|flying|max ?v|wicket|build[- ]?up|top speed|sprint/i;
function siProgramHi(athlete) {
  var out = [];
  if (typeof PROGRAM_ROWS === 'undefined' || typeof TC === 'undefined') return out;
  PROGRAM_ROWS.filter(function (r) { return r.athlete === athlete; }).forEach(function (row) {
    var days = {};
    Object.keys(row.log || {}).forEach(function (k) { var m = k.match(/^(\d+)-(\d+)-\d+-\d+-\d+$/); if (m && row.log[k] && row.log[k].done) days[m[1] + '-' + m[2]] = [+m[1], +m[2]]; });
    Object.keys(row.log || {}).forEach(function (k) { var m = k.match(/^day:(\d+)-(\d+)$/); if (m && row.log[k] && row.log[k].done) days[m[1] + '-' + m[2]] = [+m[1], +m[2]]; });
    Object.keys(days).forEach(function (key) {
      var wi = days[key][0], di = days[key][1];
      var day = ((row.pb.weekData[wi] || {}).days || [])[di]; if (!day) return;
      var dayDone = (row.log['day:' + wi + '-' + di] || {}).done;
      var hit = null;
      (day.blocks || []).forEach(function (b, bi) {
        if (hit || b.blockType === 'session-header') return;
        TC.namedExs(b).forEach(function (ex, ei) {
          if (hit || ex.rtpSkip) return;
          var runLike = b.blockType === 'speed' || TC.isRunEx(b, ex);
          if (!runLike || !TC.isHighEffort(b, ex)) return;
          if (!(TC.repDistanceFt(ex) >= 60 || SI_MAXV_RE.test(ex.name))) return;
          if (/accel|start|sled|resist|hill|shuffle|5-10-5|shuttle|lateral/i.test(ex.name) && TC.repDistanceFt(ex) < 90) return;
          var done = dayDone;
          for (var si = 0; si < TC.setCount(ex) && !done; si++) { var e = row.log[TC.lk(wi, di, bi, ei, si)]; if (e && e.done) done = true; }
          if (done) hit = ex.name;
        });
      });
      if (hit) { var d = typeof loggedDayDate === 'function' ? loggedDayDate(row, wi, di) : null; if (d) out.push({ date: d, label: hit + ' (program)' }); }
    });
  });
  return out;
}
function siAll() {
  var he = siHE(), today = siToday();
  var key = today + '|' + Object.keys(he).map(function (n) { return n + (he[n] || []).length; }).join(',') + '|' + (typeof PROGRAM_LOAD_VER !== 'undefined' ? PROGRAM_LOAD_VER : 0);
  if (_siCache.key === key) return _siCache;
  var all = {};
  Object.keys(he).forEach(function (n) { if ((he[n] || []).length) all[n] = SI.analyze(he[n], { today: today, programHi: siProgramHi(n) }); });
  _siCache = { key: key, all: all, prof: SI.profiles(all) };
  return _siCache;
}
function siRTPFor(athlete) {
  var list = (typeof RTP_DATA !== 'undefined' && RTP_DATA[athlete]) || [];
  var today = siToday(), out = [];
  list.forEach(function (p) {
    if (!p) return;
    var inj = SI.runISO(p.injuryDate || p.created || '');
    if (!inj) return;
    if (p.status !== 'active' && SI.daysBetween(inj, today) > 150) return;
    var v = SI.rtpView(p, siHE()[athlete] || [], today);
    if (v) { v.active = p.status === 'active'; v.lastPhase = p.phases && (p.currentPhase || 0) >= p.phases.length - 1; out.push(v); }
  });
  return out;
}
function siLatestRow(athlete) {
  if (typeof PROGRAM_ROWS === 'undefined') return null;
  var rows = PROGRAM_ROWS.filter(function (r) { return r.athlete === athlete; });
  rows.sort(function (a, b) { return String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')); });
  return rows[0] || null;
}
var SI_SHORT = { h1: 'H→1st', xbh: 'XBH', steal: 'Steals', bases: 'Baserunning' };
function siFlags(n, a, prof) {
  var f = [];
  if (!a || !a.active) return f;
  if (siRTPFor(n).some(function (v) { return v.active; })) return f;   // in rehab: the RTP card/items cover it
  if (a.gap === 'red' || a.gap === 'yellow') f.push({ kind: 'gap', level: a.gap, text: a.daysSinceHi === null ? 'No run ≥90% of max in 60+ days' : a.daysSinceHi + ' days since a run ≥90% of max', key: a.lastHi ? a.lastHi.d : 'none' });
  var low = (a.types || []).filter(function (t) { return t.level === 'red' || t.level === 'yellow'; }).sort(function (x, y) { return x.pct - y.pct; });
  if (low.length) f.push({ kind: 'fat', level: low.some(function (t) { return t.level === 'red'; }) ? 'red' : 'yellow', types: low,
    short: low.map(function (t) { return SI_SHORT[t.key] + ' ' + Math.round(t.pct * 100) + '%'; }).join(', '),
    text: 'Like-for-like runs below his norm — ' + low.map(function (t) { return t.label + ' ' + Math.round(t.pct * 100) + '% (' + t.recent.toFixed(1) + ' vs ' + t.base.toFixed(1) + ' ft/s)'; }).join('; '),
    key: low.map(function (t) { return t.key + t.last; }).join('|') });
  return f;
}

// ── HE Runs tab card ──
function siTile(title, big, color, lines) {
  return '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px 12px;min-width:0;">'
    + '<div style="font-size:9px;letter-spacing:.6px;color:var(--text3);text-transform:uppercase;margin-bottom:4px;">' + title + '</div>'
    + '<div style="font-size:18px;font-weight:800;color:' + color + ';line-height:1.2;">' + big + '</div>'
    + lines.filter(Boolean).map(function (l) { return '<div style="font-size:10.5px;color:var(--text2);margin-top:3px;line-height:1.45;">' + l + '</div>'; }).join('') + '</div>';
}
function siRTPHTML(v) {
  var rows = v.games.slice(-12).map(function (g) {
    var c = g.over ? SI_COL.red : g.pct >= SI.HI ? SI_COL.ok : 'var(--text2)';
    return '<tr><td style="padding:3px 6px;">' + siFmt(g.d) + '</td><td style="padding:3px 6px;text-align:right;">' + g.s.toFixed(1) + '</td><td style="padding:3px 6px;text-align:right;font-weight:700;color:' + c + ';">' + (g.pct ? Math.round(g.pct * 100) + '%' : '—') + '</td>'
      + '<td style="padding:3px 6px;color:var(--text3);">' + siEsc((g.phase || '').replace(/ — .*/, '')) + (g.cap !== null ? ' · cap ' + Math.round(g.cap * 100) + '%' : '') + (g.over ? ' <b style="color:' + SI_COL.red + ';">over</b>' : '') + '</td><td style="padding:3px 6px;color:var(--text3);">' + siEsc(g.ctx) + '</td></tr>';
  }).join('');
  var ready = v.exposures >= 2 ? SI_COL.ok : v.exposures === 1 ? SI_COL.yellow : SI_COL.red;
  return '<div style="margin-top:12px;padding:10px 12px;border-radius:8px;border:1px solid rgba(248,113,113,.3);background:rgba(248,113,113,.05);">'
    + '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;"><div style="font-size:11px;font-weight:700;color:#fca5a5;">🩹 RETURN-TO-PLAY SPEED · ' + siEsc(v.injury) + '</div>'
    + '<div style="font-size:10px;color:var(--text3);">Injured ' + siFmt(v.injuryDate) + ' · ' + (v.active ? 'in rehab' : 'cleared') + '</div></div>'
    + '<div style="display:flex;gap:18px;flex-wrap:wrap;margin:8px 0 6px;font-size:11px;color:var(--text2);">'
    + '<span>Pre-injury max <b style="color:#fff;">' + (v.preMax ? v.preMax.toFixed(1) + ' ft/s' : '—') + '</b></span>'
    + '<span>Best since <b style="color:' + (v.bestPct >= 0.97 ? SI_COL.ok : v.bestPct >= SI.HI ? SI_COL.yellow : SI_COL.red) + ';">' + (v.bestPct ? Math.round(v.bestPct * 100) + '%' : '—') + '</b></span>'
    + '<span>Game days ≥90% <b style="color:' + ready + ';">' + v.exposures + '</b> <span style="color:var(--text3);">(aim for 2+ before activation)</span></span>'
    + (v.over ? '<span style="color:' + SI_COL.red + ';font-weight:700;">' + v.over + ' game' + (v.over === 1 ? '' : 's') + ' over the phase cap</span>' : '') + '</div>'
    + (rows ? '<table style="width:100%;border-collapse:collapse;font-size:10.5px;font-family:\'DM Mono\',monospace;"><thead><tr style="color:var(--text3);font-size:9px;text-align:left;"><th style="padding:3px 6px;">Date</th><th style="padding:3px 6px;text-align:right;">Top ft/s</th><th style="padding:3px 6px;text-align:right;">% pre</th><th style="padding:3px 6px;">Phase</th><th style="padding:3px 6px;">Play</th></tr></thead><tbody>' + rows + '</tbody></table>'
      : '<div style="font-size:11px;color:var(--text3);">No game runs since the injury yet.</div>')
    + '</div>';
}
function renderSpeedIntel() {
  var el = document.getElementById('si-card'); if (!el) return;
  var c = siAll(), n = typeof currentPlayer !== 'undefined' ? currentPlayer : null, a = c.all[n], pr = c.prof[n];
  var head = '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;">'
    + '<div class="card-title" style="margin:0;">⚡ SPEED READINESS' + (n ? ' — ' + siEsc(n) : '') + '</div>'
    + '<div style="display:flex;gap:6px;align-items:center;"><span id="si-push-status" style="font-size:10px;color:var(--text3);"></span>'
    + '<button onclick="siPushSummaries(true)" title="Write each athlete\'s weekly sprint summary to his program page" style="padding:5px 10px;font-size:11px;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.4);border-radius:6px;color:#a5b4fc;cursor:pointer;">📱 Update athlete pages</button></div></div>';
  var mine = '';
  if (!a) mine = '<div style="font-size:12px;color:var(--text3);padding:6px 0 12px;">No HE runs for this player yet.</div>';
  else {
    var gapC = SI_COL[a.gap] || 'var(--text2)';
    var hi = a.lastHi;
    var t1 = siTile('Max-velocity exposure', a.daysSinceHi === null ? '60+ days' : a.daysSinceHi + ' day' + (a.daysSinceHi === 1 ? '' : 's'), a.active ? gapC : 'var(--text2)', [
      'since a run ≥90% of his max',
      hi ? 'Last: ' + siFmt(hi.d) + (hi.s ? ' · ' + hi.s.toFixed(1) + ' ft/s (' + Math.round(hi.pct * 100) + '%)' : '') + ' · ' + siEsc(hi.ctx || '') : '',
      'Exposure days: <b style="color:#fff;">' + a.exp7 + '</b> last 7 · <b style="color:#fff;">' + a.exp14 + '</b> last 14',
      !a.active ? '<span style="color:var(--text3);">No game runs in 10+ days — flag paused</span>' : a.gap !== 'ok' ? '<span style="color:' + gapC + ';">Get him a full-speed rep: build-up flys or a max-V day</span>' : ''
    ]);
    var ts = (a.types || []).filter(function (t) { return t.level !== 'none'; });
    var worst = ts.slice().sort(function (x, y) { return x.pct - y.pct; })[0];
    var t2 = siTile('Effort-matched speed', worst ? Math.round(worst.pct * 100) + '%' : '—', worst ? SI_COL[worst.level] : 'var(--text2)',
      ts.length ? ts.map(function (t) { return '<span style="color:' + SI_COL[t.level] + ';">●</span> ' + siEsc(t.label) + ': ' + t.recent.toFixed(1) + ' vs ' + t.base.toFixed(1) + ' ft/s (<b>' + Math.round(t.pct * 100) + '%</b>, last ' + t.n + ')'; })
        : ['Needs 3+ like runs in the last 21 days', 'Compares his last 5 same-type runs to his 12-month norm']);
    var t3 = siTile('Sprint profile', pr ? pr.label : '—', pr ? (pr.type === 'balanced' ? 'var(--text)' : '#60a5fa') : 'var(--text2)',
      pr ? [pr.why, pr.emphasis] : ['Needs 15+ ground-ball runs this year']);
    var w = a.weekTop;
    var t4 = siTile('Last 7 days', w ? w.s.toFixed(1) + ' ft/s' : '—', w && w.pct >= SI.HI ? SI_COL.ok : 'var(--text)', [
      w ? Math.round(w.pct * 100) + '% of his max · ' + (w.s * SI.MPH).toFixed(1) + ' mph · ' + w.runs + ' HE run' + (w.runs === 1 ? '' : 's') : 'No game runs this week',
      'His max (top-3 avg, 12 mo): <b style="color:#fff;">' + (a.refMax ? a.refMax.toFixed(2) : '—') + '</b>',
      a.seasonBest ? 'Season best ' + a.seasonBest.s.toFixed(2) + ' (' + siFmt(a.seasonBest.d) + ')' : ''
    ]);
    mine = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px;">' + t1 + t2 + t3 + t4 + '</div>'
      + siRTPFor(n).map(siRTPHTML).join('');
  }
  var names = Object.keys(c.all).sort(function (x, y) {
    var r = { red: 0, yellow: 1, ok: 3, idle: 4, nodata: 5 };
    var rx = siRTPFor(x).some(function (v) { return v.active; }) ? 2 : r[c.all[x].status], ry = siRTPFor(y).some(function (v) { return v.active; }) ? 2 : r[c.all[y].status];
    return (rx - ry) || x.localeCompare(y);
  });
  var team = '<details style="margin-top:12px;"' + (names.some(function (k) { return siFlags(k, c.all[k]).length; }) ? ' open' : '') + '><summary style="cursor:pointer;font-size:11px;color:var(--text2);font-weight:600;">Team speed readiness (' + names.length + ')</summary>'
    + '<div style="overflow-x:auto;margin-top:8px;"><table style="width:100%;border-collapse:collapse;font-size:11px;"><thead><tr style="color:var(--text3);font-size:9px;text-transform:uppercase;letter-spacing:.4px;text-align:left;">'
    + '<th style="padding:5px 6px;">Player</th><th style="padding:5px 6px;">Status</th><th style="padding:5px 6px;text-align:right;">Days since ≥90%</th><th style="padding:5px 6px;text-align:right;">Exposures 7d</th><th style="padding:5px 6px;text-align:right;">H→1st vs norm</th><th style="padding:5px 6px;">Profile</th><th style="padding:5px 6px;text-align:right;">Max ft/s</th></tr></thead><tbody>'
    + names.map(function (k) {
      var x = c.all[k], p = c.prof[k], h1 = (x.types || []).find(function (t) { return t.key === 'h1'; });
      var rehab = siRTPFor(k).some(function (v) { return v.active; });
      var st = rehab ? '🩹 <span style="color:var(--text3);font-size:10px;">rehab</span>' : x.status === 'red' ? '🔴' : x.status === 'yellow' ? '🟡' : x.status === 'ok' ? '🟢' : '⚪';
      return '<tr onclick="selectPlayer(\'' + String(k).replace(/'/g, "\\'") + '\')" style="cursor:pointer;border-top:1px solid var(--border);' + (k === n ? 'background:rgba(245,158,11,.07);' : '') + '">'
        + '<td style="padding:5px 6px;color:#fff;font-weight:600;white-space:nowrap;">' + siEsc(k) + '</td><td style="padding:5px 6px;">' + st + (x.active ? '' : ' <span style="color:var(--text3);font-size:10px;">no games 10d</span>') + '</td>'
        + '<td style="padding:5px 6px;text-align:right;color:' + (x.active && !rehab ? SI_COL[x.gap] : 'var(--text3)') + ';">' + (x.daysSinceHi === null ? '60+' : x.daysSinceHi) + '</td>'
        + '<td style="padding:5px 6px;text-align:right;color:var(--text2);">' + (x.exp7 || 0) + '</td>'
        + '<td style="padding:5px 6px;text-align:right;color:' + (h1 && h1.level !== 'none' && !rehab ? SI_COL[h1.level] : 'var(--text3)') + ';">' + (h1 && h1.pct ? Math.round(h1.pct * 100) + '%' : '—') + '</td>'
        + '<td style="padding:5px 6px;color:' + (p && p.type !== 'balanced' ? '#60a5fa' : 'var(--text3)') + ';">' + (p ? p.label : '—') + '</td>'
        + '<td style="padding:5px 6px;text-align:right;font-family:\'DM Mono\',monospace;color:var(--text2);">' + (x.refMax ? x.refMax.toFixed(2) : '—') + '</td></tr>';
    }).join('') + '</tbody></table></div>'
    + '<div style="font-size:10px;color:var(--text3);margin-top:6px;line-height:1.5;">Max = average of his top 3 runs in the last 12 months. Exposure = a game run ≥90% of max or a logged max-velocity sprint in his program. Flags: 7+ days without exposure (🟡), 10+ (🔴); like-for-like runs under 95% (🟡) or 93% (🔴) of his norm. Flags pause when he has no game runs in 10 days.</div></details>';
  el.innerHTML = head + mine + team;
}

function siOpenHE(name) {
  if (typeof selectPlayer === 'function') selectPlayer(name);
  var nb = document.querySelector('.nav-btn'); if (typeof switchTab === 'function' && nb) switchTab('dashboard', nb);
  setTimeout(function () { var b = [].find.call(document.querySelectorAll('.tab-btn'), function (x) { return /HE Runs/.test(x.textContent); }); if (b) b.click(); }, 50);
}

// ── Inbox items ──
function speedInboxItems() {
  // In-season metrics (HE game runs) only notify in-season — the ⚾/🌙 roster toggle controls it
  if (typeof isOffseason === 'function' && isOffseason()) return [];
  var c = siAll(), items = [], today = siToday();
  Object.keys(c.all).forEach(function (n) {
    var a = c.all[n], row = siLatestRow(n);
    function push(kind, key, pri, title, detail) {
      items.push({ id: 'spd|' + n + '|' + kind + '|' + key, type: 'speed', pri: pri, date: today, athlete: n, program: row ? row.name : 'HE Runs', rowId: row ? row.id : null, ref: 'spd:' + kind, title: title, detail: detail,
        replied: !!(row && (row.pb.messages || []).some(function (m) { return m.at && m.at.slice(0, 10) === today && m.ref === null && /speed|sprint|fly/i.test(m.text); })) });
    }
    siFlags(n, a, c.prof[n]).forEach(function (f) {
      if (f.kind === 'gap') push('gap', f.key, f.level === 'red' ? 2 : 3, '⚡ No max-velocity exposure — ' + (a.daysSinceHi === null ? '60+' : a.daysSinceHi) + ' days',
        (a.lastHi ? 'Last run ≥90% of max: ' + siFmt(a.lastHi.d) + ' · ' + (a.lastHi.ctx || '') + '. ' : '') + 'Still playing (last game run ' + siFmt(a.lastRun) + '). Add build-up flys or a max-V day before he has to go 100% in a game.');
      else push('fat', f.key, f.level === 'red' ? 2 : 3, '🐢 Running below his norm — ' + f.short, f.text + '. Compares his last 5 runs of each type to his 12-month median. Check sleep, soreness and load before adding intensity.');
    });
    siRTPFor(n).forEach(function (v) {
      if (v.over) push('rtpover', v.injuryDate + '|' + v.over, 2, '🩹 Ran above his rehab phase cap', v.over + ' game' + (v.over === 1 ? '' : 's') + ' since ' + siFmt(v.injuryDate) + ' over the phase run cap (' + v.injury + ').');
      if (v.active && v.lastPhase && v.exposures < 2) push('rtpexp', v.injuryDate + '|' + v.exposures, 3, '🩹 Needs full-speed exposure before activation', v.exposures + ' game day' + (v.exposures === 1 ? '' : 's') + ' at ≥90% of his pre-injury max (best ' + Math.round((v.bestPct || 0) * 100) + '%). Aim for 2+.');
    });
  });
  return items;
}

// ── Daily Brief ──
function renderBriefSpeed() {
  var el = document.getElementById('brief-speed'); if (!el) return;
  var c = siAll(), rows = [];
  Object.keys(c.all).forEach(function (n) { siFlags(n, c.all[n], c.prof[n]).forEach(function (f) { rows.push({ n: n, f: f }); }); });
  rows.sort(function (x, y) { return (x.f.level === 'red' ? 0 : 1) - (y.f.level === 'red' ? 0 : 1) || x.n.localeCompare(y.n); });
  var active = Object.keys(c.all).filter(function (n) { return c.all[n].active; }).length;
  if (!Object.keys(c.all).length) { el.innerHTML = '<div style="color:var(--text3);">No HE runs uploaded yet.</div>'; return; }
  if (!active) { el.innerHTML = '<div style="color:var(--text3);">No game runs in the last 10 days — speed flags resume when new HE runs are uploaded.</div>'; return; }
  el.innerHTML = rows.length ? rows.map(function (r) {
    return '<div onclick="siOpenHE(\'' + r.n.replace(/'/g, "\\'") + '\')" style="cursor:pointer;padding:5px 0;border-bottom:1px solid var(--border);display:flex;gap:8px;"><span>' + (r.f.level === 'red' ? '🔴' : '🟡') + '</span><span><b style="color:#fff;">' + siEsc(r.n) + '</b> <span style="color:var(--text2);">' + siEsc(r.f.text) + '</span></span></div>';
  }).join('') : '<div style="color:var(--green);">✓ All ' + active + ' active players have had a max-velocity exposure in the last 7 days and effort-matched speed is on their norm.</div>';
}

// ── Program Builder advice ──
function siPbAdvice(state) {
  var n = state && state.athlete; if (!n || !siHE()[n]) return [];
  var c = siAll(), a = c.all[n], pr = c.prof[n], out = [];
  var wk = (state.weekData || [])[0]; if (!wk) return out;
  var firstSpeed = null, firstWork = null, maxv = false;
  (wk.days || []).forEach(function (day, di) {
    (day.blocks || []).forEach(function (b) {
      TC.namedExs(b).forEach(function (ex) {
        if (firstWork === null) firstWork = di;
        if (b.blockType === 'speed' && firstSpeed === null) firstSpeed = di;
        if ((b.blockType === 'speed' || TC.isRunEx(b, ex)) && TC.isHighEffort(b, ex) && (SI_MAXV_RE.test(ex.name) || TC.repDistanceFt(ex) >= 60) && !/accel|start|sled|resist|hill/i.test(ex.name)) maxv = true;
      });
    });
  });
  var di = firstSpeed !== null ? firstSpeed : firstWork; if (di === null) return out;
  var where = 'W' + wk.week + ' ' + wk.days[di].day + ': ';
  if (pr && pr.type !== 'balanced' && firstSpeed !== null) out.push({ wi: 0, di: di, level: 'info', msg: where + 'Sprint profile — ' + pr.label + '. ' + pr.emphasis });
  if (a && a.active && (a.gap === 'red' || a.gap === 'yellow') && !maxv) out.push({ wi: 0, di: di, level: 'warn', msg: where + (a.daysSinceHi === null ? '60+' : a.daysSinceHi) + ' days since a run ≥90% of his max and no max-velocity work in Week 1' });
  return out;
}

// ── Weekly sprint summary → athlete's program page ──
var _siPushing = false;
async function siPushSummaries(manual) {
  if (_siPushing) return; _siPushing = true;
  var st = document.getElementById('si-push-status');
  try {
    var db = typeof getSupaClient === 'function' ? getSupaClient() : null;
    if (!db) { if (manual) alert('Cloud not connected.'); return; }
    if (typeof loadProgramRows === 'function' && (!PROGRAM_ROWS || !PROGRAM_ROWS.length)) await loadProgramRows();
    var c = siAll(), sent = 0, cutoff = SI.addDays(siToday(), -120);
    if (st) st.textContent = 'Updating…';
    for (var i = 0; i < PROGRAM_ROWS.length; i++) {
      var row = PROGRAM_ROWS[i], a = c.all[row.athlete];
      if (!a || (typeof apIsPitcher === 'function' && apIsPitcher(row.athlete))) continue;
      if (row.updatedAt && String(row.updatedAt).slice(0, 10) < cutoff && !(row.pb.startDate && row.pb.startDate >= cutoff)) continue;
      var sum = SI.athleteSummary(a); if (!sum) continue;
      if (JSON.stringify(row.pb.speedSummary || null) === JSON.stringify(sum)) continue;
      var r = await db.from('athlete_programs').select('pb_state').eq('id', row.id).maybeSingle();
      if (r.error || !r.data) continue;
      var pb = typeof r.data.pb_state === 'string' ? JSON.parse(r.data.pb_state) : r.data.pb_state;
      pb.speedSummary = sum;
      var u = await db.from('athlete_programs').update({ pb_state: JSON.stringify(pb) }).eq('id', row.id);
      if (!u.error) { row.pb.speedSummary = sum; sent++; }
    }
    if (st) st.textContent = sent ? '✓ ' + sent + ' page' + (sent === 1 ? '' : 's') + ' updated' : '✓ Up to date';
    if (manual && typeof showStatus === 'function') showStatus('📱 Sprint summaries: ' + (sent ? sent + ' athlete page' + (sent === 1 ? '' : 's') + ' updated' : 'already up to date'));
  } catch (e) { console.warn('[siPushSummaries]', e); if (manual) alert('Couldn\'t update athlete pages: ' + (e.message || e)); if (st) st.textContent = ''; }
  finally { _siPushing = false; }
}

// ── Hooks ──
(function () {
  if (typeof document === 'undefined') return;
  if (typeof renderHERuns === 'function') {
    var _r = renderHERuns;
    renderHERuns = function () { var x = _r.apply(this, arguments); try { renderSpeedIntel(); } catch (e) { console.warn('[speed-intel]', e); } return x; };
  }
  if (typeof saveHERuns === 'function') {
    var _s = saveHERuns, _t = null;
    saveHERuns = function () { var x = _s.apply(this, arguments); _siCache.key = null; clearTimeout(_t); _t = setTimeout(function () { siPushSummaries(false); if (typeof updateInboxBadge === 'function') updateInboxBadge(); }, 4000); return x; };
  }
  if (typeof renderBriefCheckins === 'function') {
    var _b = renderBriefCheckins;
    renderBriefCheckins = function () { try { renderBriefSpeed(); } catch (e) { console.warn('[speed-intel brief]', e); } return _b.apply(this, arguments); };
  }
  if (typeof pbCheckRules === 'function') {
    var _p = pbCheckRules;
    pbCheckRules = function (state) { var out = _p.apply(this, arguments); try { out = out.concat(siPbAdvice(state)); } catch (e) {} return out; };
  }
  // Keep athlete pages current: once per dashboard load, after program rows arrive
  setTimeout(function () { siPushSummaries(false); }, 15000);
  var he = document.getElementById('dash-heruns');
  if (he && he.classList.contains('active')) try { renderSpeedIntel(); } catch (e) {}
})();
if (typeof module !== 'undefined') module.exports = SI;

// Flipping the season toggle updates the Inbox right away
(function () {
  if (typeof toggleSeasonMode !== 'function') return;
  var _t = toggleSeasonMode;
  toggleSeasonMode = function () {
    var r = _t.apply(this, arguments);
    try { if (typeof updateInboxBadge === 'function') updateInboxBadge(); if (typeof currentPage !== 'undefined' && currentPage === 'inbox' && typeof renderInbox === 'function') renderInbox(); } catch (e) {}
    return r;
  };
})();
