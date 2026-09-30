// ═══════════════════════════════════════════════════════════════════════════
// One-page athlete profile — everything on one player across seasons:
// speed, jump, bat/arm, workload, strength, injuries & return to play,
// programs and how consistently he did them. Opens as a printable page
// (Print → Save as PDF to share with the front office or medical).
// ═══════════════════════════════════════════════════════════════════════════
var AP = (function () {
  function iso(x) {
    if (!x) return '';
    if (x instanceof Date) return isNaN(x) ? '' : x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
    var s = String(x).trim(), m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))) return (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0');
    if (typeof safeParseDate === 'function') { var d = safeParseDate(s); if (d && !isNaN(d)) return iso(d); }
    return '';
  }
  function med(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }); var h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; }
  function max(a) { return a.length ? Math.max.apply(null, a) : null; }
  function top3(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return y - x; }).slice(0, 3); return s.reduce(function (t, x) { return t + x; }, 0) / s.length; }
  function num(v) { var n = parseFloat(v); return isFinite(n) && n > 0 ? n : null; }
  function byYear(rows) { var o = {}; rows.forEach(function (r) { if (!r.d) return; var y = r.d.slice(0, 4); (o[y] = o[y] || []).push(r); }); return o; }
  function daysBetween(a, b) { var pa = a.split('-'), pb = b.split('-'); return Math.round((new Date(+pb[0], +pb[1] - 1, +pb[2]) - new Date(+pa[0], +pa[1] - 1, +pa[2])) / 86400000); }

  function collect(name) {
    var P = (typeof PLAYERS !== 'undefined' && PLAYERS[name]) || {};
    var ID = typeof importedData !== 'undefined' ? importedData : {};
    var out = { name: name, pos: P.pos || '', number: P.number || '', today: iso(new Date()) };
    // Series (one value per day)
    var he = ((typeof heRunsData !== 'undefined' && heRunsData[name]) || []).map(function (r) { return { d: iso(r.date), s: num(r.speed), pos: r.pos || '', ctx: r.context || '' }; }).filter(function (r) { return r.d && r.s && r.s < 34; });
    var speedDay = {}; he.forEach(function (r) { if (!speedDay[r.d] || r.s > speedDay[r.d]) speedDay[r.d] = r.s; });
    (P.recentGames || []).forEach(function (g) { var d = iso(g.rawDate || g.date), s = num(g.speed); if (d && s && s < 34 && !speedDay[d]) speedDay[d] = s; });
    out.speed = Object.keys(speedDay).sort().map(function (d) { return { d: d, v: speedDay[d] }; });
    var cmj = (P.cmjTrends || []).filter(function (c) { return (c.type || 'CMJ') === 'CMJ'; }).map(function (c) { return { d: iso(c.rawDate || c.date), v: num(c.jump), rsi: num(c.rsiMod), pp: num(c.ppbm) }; }).filter(function (c) { return c.d && c.v; });
    if (!cmj.length) cmj = ((ID.cmj || {})[name] || []).map(function (c) { return { d: iso(c.date), v: num(c.jump), rsi: num(c.rsiMod), pp: num(c.ppbm) }; }).filter(function (c) { return c.d && c.v; });
    out.cmj = cmj.sort(function (a, b) { return a.d < b.d ? -1 : 1; });
    var bw = ((ID.cmj || {})[name] || []).map(function (c) { return { d: iso(c.date), v: num(c.bw) }; }).filter(function (c) { return c.d && c.v; });
    out.bw = bw.sort(function (a, b) { return a.d < b.d ? -1 : 1; });
    var hit = ((ID.hitting || {})[name] || []).map(function (h) { return { d: iso(h.date), bat: num(h.bat), ev: num(h.exit), arm: num(h.throwV) }; }).filter(function (h) { return h.d; });
    if (!hit.length) hit = (P.recentGames || []).map(function (g) { return { d: iso(g.rawDate || g.date), bat: num(g.bat), ev: num(g.exit), arm: num(g.throwV) }; }).filter(function (h) { return h.d; });
    out.bat = hit.filter(function (h) { return h.bat; }).map(function (h) { return { d: h.d, v: h.bat }; }).sort(function (a, b) { return a.d < b.d ? -1 : 1; });
    out.ev = hit.filter(function (h) { return h.ev; }).map(function (h) { return { d: h.d, v: h.ev }; });
    out.arm = hit.filter(function (h) { return h.arm; }).map(function (h) { return { d: h.d, v: h.arm }; }).sort(function (a, b) { return a.d < b.d ? -1 : 1; });
    var games = (P.recentGames || []).map(function (g) { return { d: iso(g.rawDate || g.date), he: +g.he || 0, dist: +g.dist || 0 }; }).filter(function (g) { return g.d; });
    // Seasons
    var years = {};
    [out.speed, out.cmj, out.bat, out.arm, games, he].forEach(function (arr) { arr.forEach(function (r) { if (r.d) years[r.d.slice(0, 4)] = 1; }); });
    var Y = Object.keys(years).sort().reverse();
    var sp = byYear(out.speed), cj = byYear(out.cmj), bt = byYear(out.bat), ev = byYear(out.ev), am = byYear(out.arm), gm = byYear(games), hr = byYear(he), bwy = byYear(out.bw);
    out.seasons = Y.map(function (y) {
      var h1 = (hr[y] || []).filter(function (r) { return /^batter/i.test(r.pos) && /^(gb|bunt)\b/i.test(r.ctx); }).map(function (r) { return r.s; });
      var gg = gm[y] || [];
      return { y: y,
        games: gg.length || null, heRuns: (hr[y] || []).length || null,
        topSpeed: top3((sp[y] || []).map(function (r) { return r.v; })), h1: med(h1),
        cmjBest: max((cj[y] || []).map(function (r) { return r.v; })), cmjMed: med((cj[y] || []).map(function (r) { return r.v; })), cmjN: (cj[y] || []).length,
        rsi: med((cj[y] || []).map(function (r) { return r.rsi; }).filter(Boolean)),
        batMed: med((bt[y] || []).map(function (r) { return r.v; })), batBest: max((bt[y] || []).map(function (r) { return r.v; })),
        evMed: med((ev[y] || []).map(function (r) { return r.v; })), armBest: max((am[y] || []).map(function (r) { return r.v; })),
        heDist: gg.length ? Math.round(gg.reduce(function (t, g) { return t + g.he; }, 0) / gg.length) : null,
        bw: med((bwy[y] || []).map(function (r) { return r.v; })) };
    });
    // Current state
    var si = null, prof = null;
    try { if (typeof siAll === 'function') { var c = siAll(); si = c.all[name] || null; prof = c.prof[name] || null; } } catch (e) {}
    out.now = { status: P.status || '', acwr: P.acwr, heAcwr: P.heAcwr, tdAcwr: P.tdAcwr, lastData: P.lastDataDate || '', si: si, prof: prof };
    // Strength: tested 1RMs + estimates from logged sets
    var orm = (typeof ATHLETE_1RM !== 'undefined' && ATHLETE_1RM[name]) || {};
    var est = {};
    ((typeof PROGRAM_ROWS !== 'undefined' && PROGRAM_ROWS) || []).filter(function (r) { return r.athlete === name; }).forEach(function (row) {
      try { var ss = TC.liftSessions(row.pb, row.log); Object.keys(ss).forEach(function (l) { var last = ss[l][ss[l].length - 1]; var d = typeof loggedDayDate === 'function' ? loggedDayDate(row, last.wi, last.di) : ''; if (!est[l] || (d || '') > (est[l].d || '')) est[l] = { v: Math.round(last.e1rm / 5) * 5, d: d, from: last.name }; }); } catch (e) {}
    });
    var lifts = {}; Object.keys(orm).forEach(function (k) { if (num(orm[k])) lifts[k] = { tested: num(orm[k]) }; }); Object.keys(est).forEach(function (k) { (lifts[k] = lifts[k] || {}).est = est[k]; });
    out.strength = Object.keys(lifts).sort().map(function (k) { return Object.assign({ lift: k }, lifts[k]); });
    // Injuries & return to play
    out.injuries = (((typeof RTP_DATA !== 'undefined' && RTP_DATA[name]) || []).filter(Boolean)).map(function (p) {
      var inj = iso(p.injuryDate || p.created);
      var phases = p.phases || [], done = phases.filter(function (ph) { return ph.status === 'complete' || ph.completedAt; }).length;
      var endIso = null;
      if (p.status === 'cleared') { var ends = phases.map(function (ph) { return iso(ph.completedAt || ph.startedAt); }).filter(Boolean).sort(); endIso = ends[ends.length - 1] || null; }
      var rv = null; try { if (typeof SI !== 'undefined') rv = SI.rtpView(p, (typeof heRunsData !== 'undefined' && heRunsData[name]) || [], out.today); } catch (e) {}
      return { injury: p.injury || 'Injury', severity: p.severity || '', mechanism: p.mechanism || '', date: inj, status: p.status || '', phase: phases[Math.min(p.currentPhase || 0, phases.length - 1)] ? phases[Math.min(p.currentPhase || 0, phases.length - 1)].name : '', phasesDone: done, phasesN: phases.length,
        daysOut: inj ? daysBetween(inj, endIso || out.today) : null, cleared: endIso, returnBest: rv && rv.bestPct ? rv.bestPct : null, returnExp: rv ? rv.exposures : null };
    }).sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    // Programs and consistency
    out.programs = ((typeof PROGRAM_ROWS !== 'undefined' && PROGRAM_ROWS) || []).filter(function (r) { return r.athlete === name; }).map(function (row) {
      var pb = row.pb, log = row.log || {}, sched = 0, done = 0, pain = 0, red = 0, sets = 0;
      pb.weekData.forEach(function (wk, wi) { (wk.days || []).forEach(function (day, di) {
        if (!TC.dayHasWork(day)) return;
        var dd = TC.dayDate(pb, wi, di), past = !dd || TC.localISO(dd) <= out.today;
        var any = (log['day:' + wi + '-' + di] || {}).done || Object.keys(log).some(function (k) { return k.indexOf(wi + '-' + di + '-') === 0 && log[k] && log[k].done; });
        if (past) sched++;
        if (any) done++;
        if ((log['day:' + wi + '-' + di] || {}).pain) pain++;
        if ((log['ready:' + wi + '-' + di] || {}).level === 'red') red++;
      }); });
      Object.keys(log).forEach(function (k) { if (/^\d+-\d+-\d+-\d+-\d+$/.test(k) && log[k] && log[k].done) sets++; });
      var end = null; if (pb.startDate) { var e = TC.dayDate(pb, pb.weekData.length - 1, (pb.weekData[pb.weekData.length - 1].days || []).length - 1); end = e ? TC.localISO(e) : null; }
      return { name: row.name || 'Program', start: pb.startDate || '', end: end, weeks: pb.weekData.length, sched: sched, done: done, pct: sched ? Math.round(done / sched * 100) : null, pain: pain, red: red, sets: sets, edited: !!pb.liveEdited };
    }).sort(function (a, b) { return (b.start || '').localeCompare(a.start || ''); });
    // Coach notes
    try { var cn = JSON.parse(localStorage.getItem('cubs_sc_coach_notes_v1') || '{}')[name] || {}; out.notes = Object.keys(cn).sort().reverse().slice(0, 6).map(function (d) { return { d: d, t: String(cn[d]).replace(/<[^>]*>/g, '') }; }); } catch (e) { out.notes = []; }
    return out;
  }

  // ── Rendering (light, print-first) ──
  var ACC = '#0E3386';
  function esc(x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function f(v, d, u) { return v === null || v === undefined || isNaN(v) ? '—' : (+v).toFixed(d) + (u || ''); }
  function fd(isoS) { if (!isoS) return '—'; var p = isoS.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  // Weekly values keep the trend readable (game-to-game noise is large)
  function weekly(series, agg) {
    var wk = {};
    series.forEach(function (r) { var p = r.d.split('-'), dt = new Date(+p[0], +p[1] - 1, +p[2]); dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7)); var k = iso(dt); (wk[k] = wk[k] || []).push(r.v); });
    return Object.keys(wk).sort().map(function (k) { return { d: k, v: agg === 'max' ? max(wk[k]) : med(wk[k]) }; });
  }
  function spark(series, unit, dec, label, agg) {
    var cut = AP_iso365(); var raw = series.filter(function (r) { return r.d >= cut; }); var s = weekly(raw, agg);
    if (s.length < 2) return '<div class="spark"><div class="sl">' + label + '</div><div class="sv muted">Not enough data in the last 12 months</div></div>';
    var W = 230, H = 52, pad = 4, vs = s.map(function (r) { return r.v; }), lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs); if (hi === lo) { hi += 1; lo -= 1; }
    var t0 = new Date(s[0].d).getTime(), t1 = new Date(s[s.length - 1].d).getTime() || t0 + 1;
    var X = function (d) { return pad + (W - 2 * pad) * ((new Date(d).getTime() - t0) / Math.max(1, t1 - t0)); }, Yf = function (v) { return pad + (H - 2 * pad) * (1 - (v - lo) / (hi - lo)); };
    var last = raw[raw.length - 1], best = raw.reduce(function (a, b) { return b.v > a.v ? b : a; });
    var dots = s.map(function (r) { return '<circle cx="' + X(r.d).toFixed(1) + '" cy="' + Yf(r.v).toFixed(1) + '" r="6" fill="transparent"><title>Week of ' + fd(r.d) + ': ' + (+r.v).toFixed(dec) + ' ' + unit + '</title></circle>'; }).join('');
    // Break the line across gaps of 3+ weeks (off-season, IL) instead of bridging them
    var segs = [[]]; s.forEach(function (r, i) { if (i && (new Date(r.d) - new Date(s[i - 1].d)) > 21 * 86400000) segs.push([]); segs[segs.length - 1].push(X(r.d).toFixed(1) + ',' + Yf(r.v).toFixed(1)); });
    var lw = s[s.length - 1];
    return '<div class="spark"><div class="sl">' + label + ' <span class="muted">· weekly ' + (agg === 'max' ? 'best' : 'median') + ', last 12 months</span></div>'
      + '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" role="img" aria-label="' + esc(label) + ' trend">' + segs.map(function (sg) { return sg.length > 1 ? '<polyline points="' + sg.join(' ') + '" fill="none" stroke="' + ACC + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' : '<circle cx="' + sg[0].split(',')[0] + '" cy="' + sg[0].split(',')[1] + '" r="2" fill="' + ACC + '"/>'; }).join('')
      + '<circle cx="' + X(lw.d).toFixed(1) + '" cy="' + Yf(lw.v).toFixed(1) + '" r="4" fill="' + ACC + '" stroke="#fff" stroke-width="2"/>' + dots + '</svg>'
      + '<div class="sv"><b>' + (+last.v).toFixed(dec) + '</b> ' + unit + ' latest (' + fd(last.d) + ') · best ' + (+best.v).toFixed(dec) + ' (' + fd(best.d) + ')</div></div>';
  }
  function AP_iso365() { var d = new Date(); d.setDate(d.getDate() - 365); return iso(d); }
  function tile(label, big, sub) { return '<div class="tile"><div class="tl">' + label + '</div><div class="tb">' + big + '</div><div class="ts">' + (sub || '') + '</div></div>'; }
  function statusChip(s) { var m = { RED: ['#b91c1c', '● Red status'], YELLOW: ['#a16207', '● Yellow status'], GREEN: ['#15803d', '● Green status'] }[String(s).toUpperCase()]; return m ? '<span style="color:' + m[0] + ';font-weight:700;">' + m[1] + '</span>' : esc(s || '—'); }

  function render(d, opts) {
    opts = opts || {};
    var now = d.now, si = now.si, cur = d.seasons[0] || {}, prev = d.seasons[1] || null;
    function delta(a, b, dec, unit) { if (a == null || b == null) return ''; var x = a - b; return '<span class="' + (x >= 0 ? 'up' : 'down') + '">' + (x >= 0 ? '▲ +' : '▼ ') + Math.abs(x).toFixed(dec) + (unit || '') + ' vs ' + prev.y + '</span>'; }
    var lastBw = d.bw.length ? d.bw[d.bw.length - 1] : null;
    var h = '<div class="page">'
      + '<header><div><div class="eyebrow">CHICAGO CUBS STRENGTH &amp; CONDITIONING · ATHLETE PROFILE</div><h1>' + esc(d.name) + '</h1>'
      + '<div class="meta">' + esc([d.pos, d.number ? '#' + d.number : '', lastBw ? 'BW ' + lastBw.v.toFixed(1) + ' lb' : ''].filter(Boolean).join(' · ')) + ' · Generated ' + fd(d.today) + (now.lastData ? ' · Game data through ' + fd(iso(now.lastData)) : '') + '</div></div>'
      + '<div class="now">' + statusChip(now.status) + '<div class="muted">ACWR ' + f(now.acwr, 2) + (now.heAcwr ? ' · HE ' + f(now.heAcwr, 2) : '') + '</div></div></header>'
      + '<section class="tiles">'
      + tile('Top speed (' + (cur.y || '—') + ')', f(cur.topSpeed, 1, ' ft/s'), prev ? delta(cur.topSpeed, prev.topSpeed, 1, ' ft/s') : 'avg of his 3 fastest days')
      + tile('CMJ best (' + (cur.y || '—') + ')', f(cur.cmjBest, 1, ' cm'), prev ? delta(cur.cmjBest, prev.cmjBest, 1, ' cm') : (cur.cmjN ? cur.cmjN + ' tests' : ''))
      + tile('Bat speed median', f(cur.batMed, 1, ' mph'), prev ? delta(cur.batMed, prev.batMed, 1, ' mph') : 'best ' + f(cur.batBest, 1))
      + tile('Arm velo best', f(cur.armBest, 1, ' mph'), prev ? delta(cur.armBest, prev.armBest, 1, ' mph') : '')
      + tile('Speed readiness', si ? (si.status === 'red' ? '<span class="down">● Flag</span>' : si.status === 'yellow' ? '<span style="color:#a16207">● Watch</span>' : si.active ? '<span class="up">● Clear</span>' : '<span class="muted">Off-season</span>') : '—',
        si ? (si.daysSinceHi === null ? '' : si.daysSinceHi + ' days since a 90%+ sprint') : '')
      + tile('Sprint profile', now.prof ? esc(now.prof.label) : '—', now.prof ? esc(now.prof.why) : '')
      + '</section>'
      + '<section><h2>Season by season</h2><table><thead><tr><th>Season</th><th>Games</th><th>Top speed<br><span>ft/s</span></th><th>Home→1st<br><span>median ft/s</span></th><th>CMJ best / median<br><span>cm</span></th><th>RSI-mod</th><th>Bat speed<br><span>median / best mph</span></th><th>Exit velo<br><span>median</span></th><th>Arm<br><span>best mph</span></th><th>HE dist<br><span>ft / game</span></th><th>BW<br><span>lb</span></th></tr></thead><tbody>'
      + (d.seasons.length ? d.seasons.map(function (s) { return '<tr><td><b>' + s.y + '</b></td><td>' + (s.games || '—') + '</td><td>' + f(s.topSpeed, 2) + '</td><td>' + f(s.h1, 2) + '</td><td>' + f(s.cmjBest, 1) + ' / ' + f(s.cmjMed, 1) + '</td><td>' + f(s.rsi, 2) + '</td><td>' + f(s.batMed, 1) + ' / ' + f(s.batBest, 1) + '</td><td>' + f(s.evMed, 1) + '</td><td>' + f(s.armBest, 1) + '</td><td>' + (s.heDist || '—') + '</td><td>' + f(s.bw, 0) + '</td></tr>'; }).join('') : '<tr><td colspan="11" class="muted">No data yet.</td></tr>')
      + '</tbody></table></section>'
      + '<section class="sparks">' + spark(d.speed, 'ft/s', 1, 'Top speed', 'max') + spark(d.cmj, 'cm', 1, 'CMJ jump height', 'max') + spark(d.bat, 'mph', 1, 'Bat speed', 'med') + spark(d.arm, 'mph', 1, 'Arm velocity', 'max') + '</section>'
      + '<div class="two">'
      + '<section><h2>Injuries &amp; return to play</h2>' + (d.injuries.length ? d.injuries.map(function (i) {
        return '<div class="item"><div class="it"><b>' + esc(i.injury) + '</b>' + (i.severity ? ' · ' + esc(i.severity) : '') + '</div>'
          + '<div class="is">' + fd(i.date) + (i.mechanism ? ' · ' + esc(i.mechanism) : '') + ' · ' + (i.status === 'cleared' ? 'Cleared ' + fd(i.cleared) + ' · ' + i.daysOut + ' days' : esc(i.status || 'active') + ' · day ' + i.daysOut + ' · ' + esc(i.phase)) + ' · phases ' + i.phasesDone + '/' + i.phasesN + '</div>'
          + (i.returnBest ? '<div class="is">Return speed: best ' + Math.round(i.returnBest * 100) + '% of pre-injury max · ' + i.returnExp + ' game day' + (i.returnExp === 1 ? '' : 's') + ' at 90%+</div>' : '') + '</div>';
      }).join('') : '<div class="muted">No injuries on file.</div>') + '</section>'
      + '<section><h2>Strength</h2>' + (d.strength.length ? '<table class="small"><thead><tr><th>Lift</th><th>Tested 1RM</th><th>Est. from logs</th></tr></thead><tbody>' + d.strength.map(function (s) { return '<tr><td>' + esc(s.lift) + '</td><td>' + (s.tested ? s.tested + ' lb' : '—') + '</td><td>' + (s.est ? s.est.v + ' lb <span class="muted">' + (s.est.d ? fd(s.est.d) : '') + '</span>' : '—') + '</td></tr>'; }).join('') + '</tbody></table>' : '<div class="muted">No 1RMs tested or logged yet.</div>') + '</section>'
      + '</div>'
      + '<section><h2>Programs &amp; consistency</h2>' + (d.programs.length ? '<table><thead><tr><th>Program</th><th>Dates</th><th>Weeks</th><th>Sessions done</th><th>Sets logged</th><th>Pain reports</th><th>Low-readiness days</th></tr></thead><tbody>' + d.programs.map(function (p) {
        return '<tr><td><b>' + esc(p.name) + '</b>' + (p.edited ? ' <span class="muted">(individualized)</span>' : '') + '</td><td>' + (p.start ? fd(p.start) + ' – ' + fd(p.end) : '—') + '</td><td>' + p.weeks + '</td><td>' + p.done + ' / ' + p.sched + (p.pct !== null ? ' <b class="' + (p.pct >= 80 ? 'up' : p.pct >= 60 ? '' : 'down') + '">(' + p.pct + '%)</b>' : '') + '</td><td>' + p.sets + '</td><td>' + (p.pain || '—') + '</td><td>' + (p.red || '—') + '</td></tr>';
      }).join('') + '</tbody></table>' : '<div class="muted">No programs sent yet.</div>') + '</section>'
      + (opts.notes && d.notes.length ? '<section><h2>Coach notes</h2>' + d.notes.map(function (n) { return '<div class="item"><span class="muted">' + fd(n.d) + '</span> — ' + esc(n.t) + '</div>'; }).join('') + '</section>' : '')
      + '<footer>Top speed = average of his 3 fastest game days in the season (HE runs). Home→1st = median on ground balls/bunts. CMJ = countermovement jump (ForceDecks). Sessions done counts scheduled program days up to today.</footer>'
      + '</div>';
    return h;
  }
  var CSS = '*{box-sizing:border-box}body{margin:0;background:#eef1f6;font-family:"DM Sans",-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;font-size:12px}'
    + '.bar{position:sticky;top:0;background:#0f172a;color:#fff;padding:10px 16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;z-index:5}.bar button{padding:7px 14px;border-radius:7px;border:none;background:#0E3386;color:#fff;font-weight:700;cursor:pointer}.bar label{font-size:12px;display:flex;gap:6px;align-items:center}'
    + '.page{max-width:1000px;margin:16px auto;background:#fff;padding:26px 30px;border-radius:10px;box-shadow:0 4px 24px rgba(15,23,42,.08)}'
    + 'header{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;border-bottom:3px solid #0E3386;padding-bottom:12px;margin-bottom:14px}.eyebrow{font-size:10px;letter-spacing:.14em;color:#0E3386;font-weight:800}h1{margin:4px 0 2px;font-size:28px;letter-spacing:-.01em}.meta{color:#475569;font-size:11.5px}.now{text-align:right;font-size:13px}'
    + '.tiles{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-bottom:14px}.tile{border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px}.tl{font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;font-weight:700}.tb{font-size:17px;font-weight:800;margin:3px 0 2px}.ts{font-size:10px;color:#475569;line-height:1.35}'
    + 'h2{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#0E3386;margin:14px 0 6px;font-weight:800}table{width:100%;border-collapse:collapse;font-size:11px}th{text-align:left;font-size:9.5px;color:#64748b;font-weight:700;border-bottom:1px solid #cbd5e1;padding:4px 6px;vertical-align:bottom}th span{font-weight:400;text-transform:none}td{padding:5px 6px;border-bottom:1px solid #eef2f7;font-variant-numeric:tabular-nums}table.small td,table.small th{padding:3px 6px}'
    + '.sparks{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px}.spark{border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px}.sl{font-size:10px;font-weight:700;color:#334155;margin-bottom:2px}.sv{font-size:10px;color:#475569;margin-top:2px}'
    + '.two{display:grid;grid-template-columns:1.3fr 1fr;gap:18px}.item{padding:5px 0;border-bottom:1px solid #eef2f7}.it{font-size:12px}.is{font-size:10.5px;color:#475569;margin-top:1px}'
    + '.muted{color:#64748b}.up{color:#15803d}.down{color:#b91c1c}footer{margin-top:14px;font-size:9.5px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:8px}'
    + '@media (max-width:760px){.tiles{grid-template-columns:repeat(2,1fr)}.sparks,.two{grid-template-columns:1fr}.page{padding:16px;margin:0;border-radius:0}table{font-size:10px}}'
    + '@media print{body{background:#fff}.bar{display:none}.page{box-shadow:none;margin:0;max-width:none;padding:0}@page{size:letter;margin:.45in}}';
  function doc(name, opts) {
    var d = collect(name);
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(name) + ' — Athlete Profile</title><style>' + CSS + '</style></head><body>'
      + '<div class="bar"><b style="margin-right:auto;">👤 ' + esc(name) + '</b><label><input type="checkbox" id="apn"' + (opts && opts.notes ? ' checked' : '') + ' onchange="window.opener&&window.opener.openAthleteProfile(' + JSON.stringify(name).replace(/"/g, '&quot;') + ',{notes:this.checked,win:window})"> Include coach notes</label><button onclick="window.print()">🖨 Print / Save PDF</button></div>'
      + (typeof AP !== 'undefined' ? AP.render : render)(d, opts) + '</body></html>';
  }
  return { collect: collect, render: render, doc: doc };
})();

function openAthleteProfile(name, opts) {
  opts = opts || {};
  name = name || (typeof currentPlayer !== 'undefined' ? currentPlayer : '');
  if (!name) return;
  var html = AP.doc(name, opts);
  var w = opts.win || window.open('', '_blank');
  if (!w) { alert('Allow pop-ups for this site to open the profile.'); return; }
  w.document.open(); w.document.write(html); w.document.close();
  return w;
}
