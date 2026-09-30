// ═══════════════════════════════════════════════════════════════════════════
// Value Added page — each player's on-field tools and value from Baseball
// Savant over the last 3 seasons, compared with the typical change for his age.
// Also adds a Savant section to the one-page athlete profile.
// ═══════════════════════════════════════════════════════════════════════════
var VA = { view: 'tools', sort: null, open: {}, data: null, err: null };
// Change that counts as meaningful for each metric (one "notch")
var VA_STEP = { sprint: 0.2, hp1b: 0.04, bat: 0.5, fast: 3, ev50: 0.5, maxev: 1, hh: 2, arm: 1, blast: 1.5, brl: 1.5, xwoba: 0.015, oaa: 3, frv: 2, brv: 1, batrv: 5 };
var VA_TOOLS = ['sprint', 'hp1b', 'bat', 'fast', 'ev50', 'maxev', 'hh', 'arm'];
var VA_VALUE = ['xwoba', 'brl', 'blast', 'batrv', 'brv', 'oaa', 'frv'];
function vaEsc(x) { return typeof escHtml === 'function' ? escHtml(String(x == null ? '' : x)) : String(x == null ? '' : x); }
function vaM(k) { return SV.M.find(function (m) { return m.k === k; }); }
function vaFmt(m, v) { if (v == null || isNaN(v)) return '—'; var s = (+v).toFixed(m.dec); if (m.k === 'xwoba') s = s.replace(/^0/, ''); return s; }
function vaSigned(m, v) { if (v == null || isNaN(v)) return ''; var s = (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(m.dec === 0 ? 0 : Math.max(1, m.dec)); return m.k === 'xwoba' ? s.replace(/0\./, '.') : s; }
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
function vaCell(r, k) {
  var m = vaM(k), x = r.metrics[k], ys = r.years.filter(function (y) { return x.vals[y] != null; });
  if (!ys.length) return '<td style="padding:7px 8px;color:var(--text3);text-align:center;">—</td>';
  var trend = ys.map(function (y) { return vaFmt(m, x.vals[y]); }).join(' → ');
  var lastP = x.pcts[ys[ys.length - 1]];
  var sub = VA.view === 'tools' ? (x.added != null ? vaChip(k, x.added, 'vs age') : x.change != null ? vaChip(k, x.change * (m.lower ? -1 : 1), '') : '<span style="font-size:10px;color:var(--text3);">1 season</span>')
    : (x.change != null ? vaChip(k, x.change * (m.lower ? -1 : 1), 'since ' + String(x.from).slice(2)) : '<span style="font-size:10px;color:var(--text3);">1 season</span>');
  return '<td style="padding:7px 8px;vertical-align:top;"><div style="font-size:11.5px;color:#fff;font-family:\'DM Mono\',monospace;white-space:nowrap;">' + trend + (lastP != null ? ' <span title="' + ys[ys.length - 1] + ' MLB percentile" style="font-size:9px;color:var(--text3);">' + vaOrd(lastP) + '</span>' : '') + '</div><div style="margin-top:2px;">' + sub + '</div></td>';
}
function vaSortVal(r, k) { var x = r.metrics[k]; if (!x) return -1e9; return VA.view === 'tools' ? (x.added != null ? x.added : -1e9) : (x.change != null ? x.change * (vaM(k).lower ? -1 : 1) : -1e9); }
function renderValueAdded() {
  var el = document.getElementById('va-body'); if (!el) return;
  if (!VA.data && !VA.err) { el.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text3);">Pulling the last 4 seasons from Baseball Savant…</div>'; vaLoad().then(renderValueAdded); return; }
  if (VA.err) { el.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text3);">Couldn\'t reach Baseball Savant (' + vaEsc(VA.err) + '). Check the connection and press ↻.</div>'; return; }
  var D = VA.data.D, rows = VA.data.rows.slice(), keys = VA.view === 'tools' ? VA_TOOLS : VA_VALUE;
  var ys = D.years.slice(1);
  if (VA.sort) rows.sort(function (a, b) { return vaSortVal(b, VA.sort) - vaSortVal(a, VA.sort); });
  else rows.sort(function (a, b) { return a.roster.localeCompare(b.roster); });
  document.querySelectorAll('.va-view').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-v') === VA.view); });
  var st = document.getElementById('va-stamp'); if (st) st.textContent = ys[0] + '–' + ys[ys.length - 1] + ' · pulled ' + D.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + (D.failed.length ? ' · ' + D.failed.length + ' Savant tables unavailable' : '');
  // Team summary
  var tiles = ['sprint', 'bat', 'ev50', 'arm'].map(function (k) {
    var withV = rows.filter(function (r) { return r.metrics[k].added != null; }), beat = withV.filter(function (r) { return r.metrics[k].added > 0; });
    var avg = withV.length ? withV.reduce(function (t, r) { return t + r.metrics[k].added; }, 0) / withV.length : null, m = vaM(k);
    return '<div class="card" style="padding:12px 14px;"><div style="font-size:9px;letter-spacing:.6px;text-transform:uppercase;color:var(--text3);">' + m.label + ' vs age curve</div>'
      + '<div style="font-size:22px;font-weight:800;color:#fff;margin-top:2px;">' + beat.length + '<span style="font-size:13px;color:var(--text3);font-weight:600;"> / ' + withV.length + ' beat it</span></div>'
      + '<div style="font-size:11px;color:var(--text2);margin-top:2px;">Avg ' + (avg == null ? '—' : vaChip(k, avg, m.unit + ' vs typical')) + '</div></div>';
  });
  var runsNow = 0, runsThen = 0, rn = 0;
  rows.forEach(function (r) { ['brv', 'frv'].forEach(function (k) { var v = r.metrics[k].vals; if (v[ys[ys.length - 1]] != null && v[ys[0]] != null) { runsNow += v[ys[ys.length - 1]]; runsThen += v[ys[0]]; rn++; } }); });
  tiles.push('<div class="card" style="padding:12px 14px;"><div style="font-size:9px;letter-spacing:.6px;text-transform:uppercase;color:var(--text3);">Baserunning + fielding runs</div><div style="font-size:22px;font-weight:800;color:#fff;margin-top:2px;">' + (rn ? (runsNow >= 0 ? '+' : '') + runsNow.toFixed(0) : '—') + '<span style="font-size:13px;color:var(--text3);font-weight:600;"> in ' + ys[ys.length - 1] + '</span></div><div style="font-size:11px;color:var(--text2);margin-top:2px;">' + (rn ? (runsThen >= 0 ? '+' : '') + runsThen.toFixed(0) + ' in ' + ys[0] + ' (same players)' : '') + '</div></div>');
  var head = '<tr style="text-align:left;"><th style="padding:6px 8px;font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;">Player</th>' + keys.map(function (k) {
    var m = vaM(k);
    return '<th onclick="VA.sort=VA.sort===\'' + k + '\'?null:\'' + k + '\';renderValueAdded()" title="Sort by ' + (VA.view === 'tools' ? 'change vs age curve' : 'change') + '" style="cursor:pointer;padding:6px 8px;font-size:9px;color:' + (VA.sort === k ? '#f59e0b' : 'var(--text3)') + ';text-transform:uppercase;letter-spacing:.5px;white-space:nowrap;">' + m.label + (m.unit && m.unit !== 'runs' ? ' <span style="text-transform:none;">(' + m.unit + ')</span>' : '') + (VA.sort === k ? ' ▼' : '') + '</th>';
  }).join('') + '</tr>';
  var body = rows.map(function (r) {
    var isOpen = VA.open[r.roster];
    return '<tr onclick="VA.open[\'' + r.roster.replace(/'/g, "\\'") + '\']=!VA.open[\'' + r.roster.replace(/'/g, "\\'") + '\'];renderValueAdded()" style="cursor:pointer;border-top:1px solid var(--border);' + (isOpen ? 'background:rgba(245,158,11,.05);' : '') + '">'
      + '<td style="padding:7px 8px;vertical-align:top;white-space:nowrap;"><div style="font-weight:700;color:#fff;font-size:12px;">' + (isOpen ? '▾ ' : '▸ ') + vaEsc(r.roster) + '</div><div style="font-size:10px;color:var(--text3);">' + vaEsc([r.pos, r.age ? 'age ' + r.age : ''].filter(Boolean).join(' · ')) + '</div></td>'
      + keys.map(function (k) { return vaCell(r, k); }).join('') + '</tr>'
      + (isOpen ? '<tr><td colspan="' + (keys.length + 1) + '" style="padding:4px 10px 14px;">' + vaDetailHTML(r, D) + '</td></tr>' : '');
  }).join('');
  el.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-bottom:12px;">' + tiles.join('') + '</div>'
    + '<div class="card" style="padding:0;overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">' + head + body + '</table></div>'
    + (VA.data.missing.length ? '<div style="font-size:11px;color:var(--text3);margin-top:8px;">Not found on Savant: ' + VA.data.missing.map(vaEsc).join(', ') + '</div>' : '')
    + '<div style="font-size:10.5px;color:var(--text3);margin-top:10px;line-height:1.6;">'
    + (VA.view === 'tools' ? '<b>How to read:</b> first season → latest, with his latest MLB percentile. <b>vs age</b> = his change minus the average change for MLB players his age over the same seasons (built from every player in Savant). ▲ green = beat his age curve by a meaningful amount, ▼ red = fell behind it, ● = about typical. Players typically lose ~0.15 ft/s of sprint speed a year from their mid-20s, so holding steady is a win.'
      : '<b>How to read:</b> first season → latest with his latest MLB percentile, and the change over that span. Runs columns are Savant\'s run values (above average = positive). These are outcomes — training is one input among many.')
    + ' Source: Baseball Savant, pulled live. Click a player for every season, percentiles and his training data.</div>';
}
function vaDetailHTML(r, D) {
  var ys = r.years, M = SV.M;
  var ap = null; try { ap = typeof AP !== 'undefined' ? AP.collect(r.roster) : null; } catch (e) {}
  var row = function (m) {
    var x = r.metrics[m.k];
    if (!ys.some(function (y) { return x.vals[y] != null; })) return '';
    return '<tr><td style="padding:3px 8px;color:var(--text2);white-space:nowrap;">' + m.label + '</td>' + ys.map(function (y) { return '<td style="padding:3px 8px;font-family:\'DM Mono\',monospace;color:#fff;">' + vaFmt(m, x.vals[y]) + (x.pcts[y] != null ? ' <span style="font-size:9px;color:var(--text3);">' + vaOrd(x.pcts[y]) + '</span>' : '') + '</td>'; }).join('')
      + '<td style="padding:3px 8px;">' + (x.change != null ? vaChip(m.k, x.change * (m.lower ? -1 : 1), '') : '') + '</td>'
      + '<td style="padding:3px 8px;font-size:10px;color:var(--text3);">' + (x.expected != null ? 'typical ' + vaSigned(m, x.expected * (m.lower ? -1 : 1)) : '') + '</td>'
      + '<td style="padding:3px 8px;">' + (x.added != null ? vaChip(m.k, x.added, '') : '') + '</td></tr>';
  };
  var train = '';
  if (ap) {
    var s = ap.seasons.filter(function (x) { return ys.indexOf(+x.y) >= 0; });
    train = '<div style="margin-top:10px;font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;">His training data (this dashboard)</div><table style="border-collapse:collapse;font-size:11px;margin-top:4px;"><tr style="color:var(--text3);font-size:9.5px;"><td style="padding:3px 8px;"></td>' + s.map(function (x) { return '<td style="padding:3px 8px;">' + x.y + '</td>'; }).join('') + '</tr>'
      + [['Top speed (HE runs)', 'topSpeed', 2, ' ft/s'], ['CMJ best', 'cmjBest', 1, ' cm'], ['Bat speed median (your uploads)', 'batMed', 1, ' mph'], ['Arm velo best', 'armBest', 1, ' mph'], ['Bodyweight', 'bw', 0, ' lb']].map(function (t) {
        if (!s.some(function (x) { return x[t[1]] != null; })) return '';
        return '<tr><td style="padding:3px 8px;color:var(--text2);">' + t[0] + '</td>' + s.map(function (x) { return '<td style="padding:3px 8px;font-family:\'DM Mono\',monospace;color:#fff;">' + (x[t[1]] == null ? '—' : (+x[t[1]]).toFixed(t[2])) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</table>'
      + (ap.programs.length ? '<div style="font-size:11px;color:var(--text2);margin-top:6px;">Programs: ' + ap.programs.map(function (p) { return vaEsc(p.name) + ' ' + p.done + '/' + p.sched + (p.pct != null ? ' (' + p.pct + '%)' : ''); }).join(' · ') + '</div>' : '')
      + (ap.injuries.length ? '<div style="font-size:11px;color:var(--text2);margin-top:4px;">Injuries: ' + ap.injuries.map(function (i) { return vaEsc(i.injury) + ' (' + i.date + (i.daysOut != null ? ', ' + i.daysOut + ' days' : '') + ')'; }).join(' · ') + '</div>' : '');
  }
  return '<div style="display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start;"><div style="overflow-x:auto;"><table style="border-collapse:collapse;font-size:11px;"><tr style="color:var(--text3);font-size:9.5px;"><td style="padding:3px 8px;">Savant</td>' + ys.map(function (y) { return '<td style="padding:3px 8px;">' + y + '</td>'; }).join('') + '<td style="padding:3px 8px;">Change</td><td style="padding:3px 8px;">Typical for age</td><td style="padding:3px 8px;">vs age</td></tr>'
    + M.map(row).join('') + '</table></div><div>' + train
    + '<div style="margin-top:10px;display:flex;gap:6px;"><button onclick="event.stopPropagation();openAthleteProfile(\'' + r.roster.replace(/'/g, "\\'") + '\')" style="padding:6px 10px;background:rgba(14,51,134,.3);border:1px solid rgba(96,165,250,.45);border-radius:6px;color:#93c5fd;font-size:11px;cursor:pointer;">👤 Full profile</button>'
    + '<a onclick="event.stopPropagation()" href="https://baseballsavant.mlb.com/savant-player/' + r.id + '" target="_blank" rel="noopener" style="padding:6px 10px;background:rgba(255,255,255,.05);border:1px solid var(--border2);border-radius:6px;color:var(--text2);font-size:11px;text-decoration:none;">Savant page ↗</a></div></div></div>';
}
function vaSetView(v) { VA.view = v; VA.sort = null; renderValueAdded(); }
function vaRefresh() { VA.data = null; VA.err = null; var el = document.getElementById('va-body'); if (el) el.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text3);">Refreshing from Baseball Savant…</div>'; vaLoad(true).then(renderValueAdded); }

// Printable version (light), both views
function vaPrint() {
  if (!VA.data) return;
  var D = VA.data.D, ys = D.years.slice(1), rows = VA.data.rows.slice().sort(function (a, b) { return a.roster.localeCompare(b.roster); });
  function table(keys, mode) {
    return '<table><thead><tr><th>Player</th>' + keys.map(function (k) { var m = vaM(k); return '<th>' + m.label + (m.unit && m.unit !== 'runs' ? '<br><span>' + m.unit + '</span>' : '') + '</th>'; }).join('') + '</tr></thead><tbody>'
      + rows.map(function (r) {
        return '<tr><td><b>' + vaEsc(r.roster) + '</b><br><span>' + vaEsc([r.pos, r.age ? 'age ' + r.age : ''].filter(Boolean).join(' · ')) + '</span></td>' + keys.map(function (k) {
          var m = vaM(k), x = r.metrics[k], yy = ys.filter(function (y) { return x.vals[y] != null; });
          if (!yy.length) return '<td>—</td>';
          var v = mode === 'tools' ? x.added : (x.change != null ? x.change * (m.lower ? -1 : 1) : null), t = vaTone(k, v);
          return '<td>' + yy.map(function (y) { return vaFmt(m, x.vals[y]); }).join(' → ') + (x.pcts[yy[yy.length - 1]] != null ? ' <span>' + vaOrd(x.pcts[yy[yy.length - 1]]) + '</span>' : '') + (v != null ? '<br><b class="' + t + '">' + (t === 'up' ? '▲ ' : t === 'down' ? '▼ ' : '● ') + vaSigned(m, v) + (mode === 'tools' ? ' vs age' : '') + '</b>' : '') + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table>';
  }
  var css = 'body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;margin:24px;font-size:11px}h1{font-size:22px;margin:0}h2{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#0E3386;margin:18px 0 6px}.eb{font-size:10px;letter-spacing:.14em;color:#0E3386;font-weight:800}table{width:100%;border-collapse:collapse}th{text-align:left;font-size:9px;color:#64748b;border-bottom:1px solid #cbd5e1;padding:4px 5px;vertical-align:bottom}td{padding:5px;border-bottom:1px solid #eef2f7;vertical-align:top;font-variant-numeric:tabular-nums}span{color:#64748b;font-size:9px;font-weight:400}.up{color:#15803d}.down{color:#b91c1c}.flat{color:#475569}p{font-size:9.5px;color:#64748b;line-height:1.5}@page{size:letter landscape;margin:.4in}';
  var html = '<!doctype html><html><head><meta charset="utf-8"><title>Value Added ' + ys[0] + '–' + ys[ys.length - 1] + '</title><style>' + css + '</style></head><body>'
    + '<div class="eb">CHICAGO CUBS STRENGTH &amp; CONDITIONING · VALUE ADDED</div><h1>On-field tools and value, ' + ys[0] + '–' + ys[ys.length - 1] + '</h1><p>Source: Baseball Savant, pulled ' + D.at.toLocaleDateString() + '. "vs age" = change beyond the typical change for MLB players the same age over the same seasons.</p>'
    + '<h2>Physical tools vs age curve</h2>' + table(VA_TOOLS, 'tools') + '<h2>Results &amp; run value</h2>' + table(VA_VALUE, 'value')
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
      + '<td class="' + (tc === 'na' ? '' : tc) + '">' + (ch == null ? '—' : vaSigned(m, ch)) + '</td><td class="' + (t === 'na' ? '' : t) + '">' + (v == null ? (m.tool ? '—' : '') : (t === 'up' ? '▲ ' : t === 'down' ? '▼ ' : '● ') + vaSigned(m, v)) + '</td></tr>';
  }).join('');
  return '<section><h2>On-field · Baseball Savant</h2><table><thead><tr><th>Metric</th>' + ys.map(function (y) { return '<th>' + y + '</th>'; }).join('') + '<th>Change</th><th>vs age curve</th></tr></thead><tbody>' + rows + '</tbody></table>'
    + '<div class="muted" style="font-size:9.5px;margin-top:4px;">Small number = MLB percentile that season. vs age curve = change beyond what is typical for MLB players his age over the same seasons.</div></section>';
}
(function () {
  if (typeof document === 'undefined') return;
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
