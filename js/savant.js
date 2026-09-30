// ═══════════════════════════════════════════════════════════════════════════
// Baseball Savant — on-field value for the roster, pulled live from public
// Savant leaderboards (all MLB players, so percentiles and age curves come
// from the whole league). Nothing is stored; each open fetches fresh data.
//
// "Value added" = his actual change in a physical tool minus the change that
// is typical for players his age (league average one-year change at that age,
// from the same Savant data). Positive = better than his age curve.
// ═══════════════════════════════════════════════════════════════════════════
var SV = (function () {
  var BASE = 'https://baseballsavant.mlb.com/leaderboard/';
  var SRC = {
    sprint: function (y) { return BASE + 'sprint_speed?year=' + y + '&position=&team=&min=0&csv=true'; },
    bat: function (y) { return BASE + 'bat-tracking?type=batter&minSwings=1&seasonStart=' + y + '&seasonEnd=' + y + '&csv=true'; },
    ev: function (y) { return BASE + 'statcast?type=batter&year=' + y + '&position=&team=&min=1&csv=true'; },
    xs: function (y) { return BASE + 'expected_statistics?type=batter&year=' + y + '&position=&team=&filterType=bip&min=1&csv=true'; },
    arm: function (y) { return BASE + 'arm-strength?type=player&year=' + y + '&minThrows=1&pos=&team=&csv=true'; },
    oaa: function (y) { return BASE + 'outs_above_average?type=Fielder&startYear=' + y + '&endYear=' + y + '&split=no&team=&range=year&min=0&pos=&roles=&viz=hide&csv=true'; },
    frv: function (y) { return BASE + 'fielding-run-value?gameType=Regular&seasonStart=' + y + '&seasonEnd=' + y + '&type=fielder&position=&minInnings=0&minResults=1&csv=true'; },
    brv: function (y) { return BASE + 'baserunning-run-value?game_type=Regular&n=0&season_end=' + y + '&season_start=' + y + '&split=no&team=&type=Batter&with_team_only=1&csv=true'; }
  };
  // Metrics. tool = physical tool S&C can move (age-adjusted); value = outcome in runs / results.
  // q = [source volume column, minimum] for a season to count (league curves, percentiles)
  var M = [
    { k: 'sprint', src: 'sprint', col: 'sprint_speed', label: 'Sprint speed', unit: 'ft/s', dec: 1, tool: 1, q: ['competitive_runs', 10] },
    { k: 'hp1b', src: 'sprint', col: 'hp_to_1b', label: 'Home to 1st', unit: 's', dec: 2, tool: 1, lower: 1, q: ['competitive_runs', 10] },
    { k: 'bat', src: 'bat', col: 'avg_bat_speed', label: 'Bat speed', unit: 'mph', dec: 1, tool: 1, q: ['swings_competitive', 300] },
    { k: 'fast', src: 'bat', col: 'hard_swing_rate', label: 'Fast-swing rate', unit: '%', dec: 1, tool: 1, pct100: 1, q: ['swings_competitive', 300] },
    { k: 'ev50', src: 'ev', col: 'ev50', label: 'EV50 (top-half exit velo)', unit: 'mph', dec: 1, tool: 1, q: ['attempts', 100] },
    { k: 'maxev', src: 'ev', col: 'max_hit_speed', label: 'Max exit velo', unit: 'mph', dec: 1, tool: 1, q: ['attempts', 100] },
    { k: 'hh', src: 'ev', col: 'ev95percent', label: 'Hard-hit %', unit: '%', dec: 1, tool: 1, q: ['attempts', 100] },
    { k: 'arm', src: 'arm', col: 'arm_overall', label: 'Arm strength', unit: 'mph', dec: 1, tool: 1, q: ['total_throws', 50] },
    { k: 'blast', src: 'bat', col: 'blast_per_swing', label: 'Blasts / swing', unit: '%', dec: 1, pct100: 1, q: ['swings_competitive', 300] },
    { k: 'brl', src: 'ev', col: 'brl_percent', label: 'Barrel %', unit: '%', dec: 1, q: ['attempts', 100] },
    { k: 'xwoba', src: 'xs', col: 'est_woba', label: 'xwOBA', unit: '', dec: 3, q: ['pa', 200] },
    { k: 'oaa', src: 'oaa', col: 'outs_above_average', label: 'Outs above avg', unit: '', dec: 0, runs: 0 },
    { k: 'frv', src: 'frv', col: 'total_runs', label: 'Fielding runs', unit: 'runs', dec: 0, runs: 1 },
    { k: 'brv', src: 'brv', col: 'runner_runs_tot', label: 'Baserunning runs', unit: 'runs', dec: 1, runs: 1 },
    { k: 'batrv', src: 'bat', col: 'batter_run_value', label: 'Swing run value', unit: 'runs', dec: 0, runs: 1 }
  ];
  var ID_COL = { sprint: 'player_id', bat: 'id', ev: 'player_id', xs: 'player_id', arm: 'player_id', oaa: 'player_id', frv: 'id', brv: 'player_id' };
  var NAME_COL = { sprint: 'last_name, first_name', bat: 'name', ev: 'last_name, first_name', xs: 'last_name, first_name', arm: 'fielder_name', oaa: 'last_name, first_name', frv: 'name', brv: 'entity_name' };

  function parseCSV(t) {
    var rows = [], row = [], f = '', q = false;
    t = String(t).replace(/^﻿/, '');
    for (var i = 0; i < t.length; i++) {
      var c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(f); f = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = []; }
      else f += c;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    if (!rows.length) return [];
    var h = rows[0];
    return rows.slice(1).map(function (r) { var o = {}; h.forEach(function (k, j) { o[k] = r[j]; }); return o; });
  }
  function norm(n) {
    n = String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (n.indexOf(',') > 0) { var p = n.split(','); n = p.slice(1).join(' ') + ' ' + p[0]; }
    return n.toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, '').replace(/[^a-z]/g, '');
  }
  function num(v) { if (v === undefined || v === null || v === '' || v === 'null') return null; var x = parseFloat(v); return isFinite(x) ? x : null; }

  // Build { players: {id: {name, norm, seasons:{y:{metric:value, _vol:{src:vol}, age}}}}, years }
  var _cache = null, _loading = null;
  async function load(years, force) {
    years = years || yearsBack(3);
    var key = years.join(',');
    if (_cache && _cache.key === key && !force) return _cache;
    if (_loading && !force) return _loading;
    _loading = (async function () {
      var jobs = [];
      years.forEach(function (y) { Object.keys(SRC).forEach(function (s) { jobs.push({ y: y, s: s }); }); });
      var players = {}, failed = [];
      var i = 0;
      async function worker() {
        while (i < jobs.length) {
          var j = jobs[i++];
          try {
            var r = await fetch(SRC[j.s](j.y));
            if (!r.ok) throw new Error('HTTP ' + r.status);
            var rows = parseCSV(await r.text());
            rows.forEach(function (row) {
              var id = String(row[ID_COL[j.s]] || '').trim(); if (!id) return;
              var p = players[id] = players[id] || { id: id, name: '', norm: '', seasons: {} };
              var nm = row[NAME_COL[j.s]]; if (nm && !p.name) { p.name = nm.indexOf(',') > 0 ? nm.split(',').slice(1).join(' ').trim() + ' ' + nm.split(',')[0].trim() : nm; p.norm = norm(nm); }
              var S = p.seasons[j.y] = p.seasons[j.y] || { _vol: {} };
              if (j.s === 'sprint') { S.age = num(row.age); S.pos = row.position; S.team = row.team; }
              if (j.s === 'arm' && row.primary_position_name) S.posName = row.primary_position_name;
              M.forEach(function (m) {
                if (m.src !== j.s) return;
                var v = num(row[m.col]); if (v === null) return;
                if (m.pct100 && v <= 1) v = v * 100;
                S[m.k] = v;
                if (m.q) S._vol[m.k] = num(row[m.q[0]]);
              });
            });
          } catch (e) { failed.push(j.s + ' ' + j.y); }
        }
      }
      await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
      // Fill missing ages from neighbouring seasons
      Object.keys(players).forEach(function (id) {
        var S = players[id].seasons;
        years.forEach(function (y) { if (S[y] && S[y].age == null) { if (S[y - 1] && S[y - 1].age != null) S[y].age = S[y - 1].age + 1; else if (S[y + 1] && S[y + 1].age != null) S[y].age = S[y + 1].age - 1; } });
      });
      _cache = { key: key, years: years, players: players, failed: failed, at: new Date() };
      _cache.curves = curves(_cache);
      _loading = null;
      return _cache;
    })();
    return _loading;
  }
  function yearsBack(n) {
    var d = new Date(), y = d.getFullYear();
    if (d.getMonth() < 3) y--;                // before April, the latest full season is last year
    var out = []; for (var k = n; k >= 0; k--) out.push(y - k);   // n+1 seasons: one extra for the age curve
    return out;
  }
  function qualified(m, S) { if (!S || S[m.k] == null) return false; if (!m.q) return true; var v = S._vol[m.k]; return v != null && v >= m.q[1]; }
  // League one-year change by age (smoothed over neighbouring ages)
  function curves(D) {
    var out = {};
    M.filter(function (m) { return m.tool; }).forEach(function (m) {
      var byAge = {};
      Object.keys(D.players).forEach(function (id) {
        var S = D.players[id].seasons;
        D.years.forEach(function (y) {
          if (!S[y] || !S[y + 1]) return;
          if (m.src === 'bat' && y < 2024) return;                  // bat tracking began mid-2023
          if (!qualified(m, S[y]) || !qualified(m, S[y + 1]) || S[y].age == null) return;
          (byAge[S[y].age] = byAge[S[y].age] || []).push(S[y + 1][m.k] - S[y][m.k]);
        });
      });
      var c = {};
      for (var a = 19; a <= 42; a++) {
        var pool = [].concat(byAge[a - 1] || [], byAge[a] || [], byAge[a] || [], byAge[a + 1] || []);
        if (pool.length >= 12) c[a] = { d: pool.reduce(function (t, x) { return t + x; }, 0) / pool.length, n: pool.length };
      }
      out[m.k] = c;
    });
    return out;
  }
  function expected(D, mk, age, fromY, toY) {
    var c = D.curves[mk] || {}, t = 0;
    for (var y = fromY; y < toY; y++) { var a = age + (y - fromY); if (!c[a]) return null; t += c[a].d; }
    return t;
  }
  function percentile(D, m, y, v) {
    var vals = [];
    Object.keys(D.players).forEach(function (id) { var S = D.players[id].seasons[y]; if (qualified(m, S)) vals.push(S[m.k]); });
    if (vals.length < 20 || v == null) return null;
    var below = vals.filter(function (x) { return m.lower ? x > v : x < v; }).length, eq = vals.filter(function (x) { return x === v; }).length;
    return Math.round(100 * (below + eq / 2) / vals.length);
  }
  function matchRoster(D, names) {
    var byNorm = {};
    Object.keys(D.players).forEach(function (id) { var p = D.players[id]; if (p.norm) (byNorm[p.norm] = byNorm[p.norm] || []).push(p); });
    var out = {};
    names.forEach(function (n) {
      var c = byNorm[norm(n)] || [];
      if (c.length > 1) c.sort(function (a, b) { return Object.keys(b.seasons).length - Object.keys(a.seasons).length; });
      if (c[0]) out[n] = c[0];
    });
    return out;
  }
  // Per-player summary over the shown seasons (the extra oldest season only feeds the curves)
  function summarize(D, p) {
    var ys = D.years.slice(1), first = null, last = null;
    ys.forEach(function (y) { if (p.seasons[y]) { if (first === null) first = y; last = y; } });
    var res = { id: p.id, name: p.name, years: ys, first: first, last: last, age: last && p.seasons[last].age, pos: last && (p.seasons[last].posName || p.seasons[last].pos), metrics: {} };
    M.forEach(function (m) {
      var vals = {}, pcts = {};
      ys.forEach(function (y) { var S = p.seasons[y]; if (S && S[m.k] != null && (!m.q || qualified(m, S) || (S._vol[m.k] || 0) >= m.q[1] / 3)) { vals[y] = S[m.k]; pcts[y] = percentile(D, m, y, S[m.k]); } });
      var yk = Object.keys(vals).map(Number).sort();
      var r = { vals: vals, pcts: pcts };
      if (yk.length >= 2) {
        var a = yk[0], b = yk[yk.length - 1];
        r.from = a; r.to = b; r.change = vals[b] - vals[a];
        if (m.tool) {
          var age = p.seasons[a] && p.seasons[a].age;
          var e = age != null ? expected(D, m.k, age, a, b) : null;
          if (e !== null) { r.expected = e; r.added = (r.change - e) * (m.lower ? -1 : 1); }
        }
      }
      res.metrics[m.k] = r;
    });
    return res;
  }
  return { M: M, load: load, summarize: summarize, matchRoster: matchRoster, percentile: percentile, yearsBack: yearsBack, parseCSV: parseCSV, norm: norm, expected: expected };
})();
if (typeof module !== 'undefined') module.exports = SV;
