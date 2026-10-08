// ═══════════════════════════════════════════════════════════════════════════
// Off-season toolkit
//   1. One permanent link per athlete  (program.html?a=<token>) — always opens
//      his current program; new blocks show up on the same link
//   2. Block → next block handoff      (Inbox item + roster board button)
//   3. At-home tests                   (athlete logs 10-yd / 30-yd / body weight
//      on his page → board, profile KPIs, Inbox)
//   4. Roster board                    (top of the Inbox page)
//   5. Percentile setting for athlete pages
// ═══════════════════════════════════════════════════════════════════════════
var OF_LINKS_KEY = 'cubs_sc_athlete_links_v1';
var OF_PCT_KEY = 'cubs_sc_ap_pct_v1';
var OF_NEXT = null;   // { athlete, start } — pre-fills Week 1 when sending his next block

function ofEsc(s) { return typeof escHtml === 'function' ? escHtml(String(s == null ? '' : s)) : String(s == null ? '' : s); }
function ofJsq(s) { return typeof jsq === 'function' ? jsq(s) : String(s).replace(/'/g, "\\'"); }
function ofISO(d) { return TC.localISO(d); }
function ofParse(s) { return TC.parseISO ? TC.parseISO(s) : new Date(s + 'T12:00:00'); }
function ofFmt(s) { var d = s instanceof Date ? s : ofParse(s); return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''; }
function ofAddDays(iso, n) { var d = ofParse(iso); d.setDate(d.getDate() + n); return ofISO(d); }
function ofNextMonday(iso) { var d = ofParse(iso); d.setDate(d.getDate() + 1); while (d.getDay() !== 1) d.setDate(d.getDate() + 1); return ofISO(d); }

// ── 1. Permanent athlete links ───────────────────────────────────────────────
function ofLinks() { try { return JSON.parse(localStorage.getItem(OF_LINKS_KEY) || '{}'); } catch (e) { return {}; } }
function ofToken(athlete) {
  var m = ofLinks();
  if (m[athlete]) return m[athlete];
  var a = new Uint8Array(9); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.random() * 256; });
  var tok = Array.prototype.map.call(a, function (b) { return 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]; }).join('');
  m[athlete] = tok;
  try { localStorage.setItem(OF_LINKS_KEY, JSON.stringify(m)); } catch (e) {}
  ofRegister(athlete, tok);
  return tok;
}
async function ofRegister(athlete, tok) {
  try {
    var db = getSupaClient(); if (!db) return false;
    var r = await db.from('cubs_sc_data').upsert({ key: 'alink:' + tok, value: JSON.stringify({ athlete: athlete }) }, { onConflict: 'key' });
    return !r.error;
  } catch (e) { return false; }
}
function ofAthleteURL(athlete) {
  var base = (typeof PUSH_BASE_URL !== 'undefined' ? PUSH_BASE_URL : 'https://markweisman45.github.io/cubs-sc/program.html?id=').replace(/\?id=$/, '');
  return base + '?a=' + ofToken(athlete);
}
// Make sure every athlete with a live program has his link registered in the cloud
async function ofRegisterAll() {
  var m = ofLinks(), names = {};
  (typeof PROGRAM_ROWS !== 'undefined' ? PROGRAM_ROWS : []).forEach(function (r) { names[r.athlete] = 1; });
  for (var n in names) { if (!m[n]) ofToken(n); else await ofRegister(n, m[n]); }
}

// ── Program timing helpers ───────────────────────────────────────────────────
function ofSpan(row) {
  var pb = row.pb || {}; if (!pb.startDate || !pb.weekData) return null;
  var last = null;
  pb.weekData.forEach(function (wk, wi) { (wk.days || []).forEach(function (d, di) { if (!TC.dayHasWork(d)) return; var dt = TC.dayDate(pb, wi, di); if (dt && (!last || dt > last)) last = dt; }); });
  return { start: pb.startDate, end: last ? ofISO(last) : ofAddDays(pb.startDate, pb.weekData.length * 7 - 1), weeks: pb.weekData.length };
}
function ofRowsFor(athlete) { return (typeof PROGRAM_ROWS !== 'undefined' ? PROGRAM_ROWS : []).filter(function (r) { return r.athlete === athlete; }); }
// The program his link shows: running now → latest start; else next upcoming; else most recent
function ofCurrent(athlete) {
  var t = ofISO(new Date()), rows = ofRowsFor(athlete).map(function (r) { return { r: r, s: ofSpan(r) }; }).filter(function (x) { return x.s; });
  var act = rows.filter(function (x) { return x.s.start <= t && x.s.end >= t; }).sort(function (a, b) { return a.s.start < b.s.start ? 1 : -1; });
  if (act.length) return act[0];
  var up = rows.filter(function (x) { return x.s.start > t; }).sort(function (a, b) { return a.s.start < b.s.start ? -1 : 1; });
  if (up.length) return up[0];
  rows.sort(function (a, b) { return a.s.end < b.s.end ? 1 : -1; });
  return rows[0] || null;
}
function ofQueuedAfter(athlete, x) { return ofRowsFor(athlete).some(function (r) { var s = ofSpan(r); return s && r.id !== x.r.id && s.start > x.s.start; }); }

// ── 3. Home tests (logged on his page as LOG['test:YYYY-MM-DD']) ─────────────
function ofTests(athlete) {
  var out = [];
  ofRowsFor(athlete).forEach(function (r) { Object.keys(r.log || {}).forEach(function (k) { if (k.indexOf('test:') === 0 && r.log[k]) out.push(Object.assign({ date: k.slice(5), rowId: r.id }, r.log[k])); }); });
  return out.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
}
function ofLatest(tests, f) { for (var i = 0; i < tests.length; i++) { var v = parseFloat(tests[i][f]); if (v > 0) return { v: v, date: tests[i].date }; } return null; }

// ── Roster-level stats for one athlete ───────────────────────────────────────
function ofStats(athlete) {
  var cur = ofCurrent(athlete); if (!cur) return null;
  var r = cur.r, pb = r.pb, log = r.log || {}, t = ofISO(new Date());
  var mon = new Date(); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7)); var monISO = ofISO(mon), sunISO = ofAddDays(monISO, 6), since = ofAddDays(t, -14);
  var wkSched = 0, wkDone = 0, missed = 0, curWeek = null;
  pb.weekData.forEach(function (wk, wi) {
    (wk.days || []).forEach(function (d, di) {
      if (!TC.dayHasWork(d)) return;
      var dt = TC.dayDate(pb, wi, di); if (!dt) return; var iso = ofISO(dt), done = !!(log['day:' + wi + '-' + di] || {}).done;
      if (iso >= monISO && iso <= sunISO) { wkSched++; if (done) wkDone++; curWeek = wi + 1; }
      if (iso < t && iso >= since && !done) missed++;
    });
  });
  if (curWeek == null) curWeek = t < cur.s.start ? 0 : pb.weekData.length;
  var lastT = 0, pain = 0, ready = null;
  Object.keys(log).forEach(function (k) {
    var v = log[k]; if (!v) return;
    if (v.t && v.t > lastT) lastT = v.t;
    if (k.indexOf('day:') === 0 && v.pain && (v.date || '') >= since) pain++;
    if (k.indexOf('ready:') === 0 && !v.skipped && (!ready || (v.t || 0) > (ready.t || 0))) ready = v;
  });
  var live = ofRowsFor(athlete).filter(function (x) { var s = ofSpan(x); return s && s.end >= t; });
  var tests = ofTests(athlete);
  return { athlete: athlete, row: r, span: cur.s, curWeek: curWeek, wkSched: wkSched, wkDone: wkDone, missed: missed, pain: pain, ready: ready, lastT: lastT,
    dupes: live.length > 1 ? live : null, queued: ofQueuedAfter(athlete, cur), daysLeft: Math.round((ofParse(cur.s.end) - ofParse(t)) / 864e5),
    t10: ofLatest(tests, 't10'), t30: ofLatest(tests, 't30'), bw: ofLatest(tests, 'bw'), nTests: tests.length };
}

// ── 2. Block handoff ─────────────────────────────────────────────────────────
function ofNextBlock(athlete) {
  var st = ofStats(athlete); var next = st ? ofNextMonday(st.span.end) : null;
  OF_NEXT = next ? { athlete: athlete, start: next } : null;
  // Annual Plan block that covers the next start → open it (its modal has 🚀 Start Program for This Block)
  try {
    var ref = next || ofISO(new Date()), yr = +ref.slice(0, 4), season = String(+ref.slice(5, 7) >= 11 ? yr : yr - 1);
    var key = athlete + '_' + season, plan = (typeof ANNUAL_PLANS !== 'undefined' && ANNUAL_PLANS[key]) || null;
    var b = plan && next ? (plan.blocks || []).filter(function (x) { return x.endDate >= next; }).sort(function (a, c) { return a.startDate < c.startDate ? -1 : 1; })[0] : null;
    if (b && typeof alOpenBlock === 'function') { alOpenBlock(key, b.id); if (typeof showStatus === 'function') showStatus('⏭ ' + athlete.split(' ')[0] + '\'s next block: ' + ((BLOCK_TYPES[b.type] || {}).label || b.type) + ' — tap 🚀 Start Program for This Block'); return; }
  } catch (e) { console.warn('[offseason]', e); }
  // No Annual Plan block → Program Builder, athlete picked
  var nb = [].find.call(document.querySelectorAll('.nav-btn'), function (x) { return /Program Builder/.test(x.textContent); });
  if (typeof switchTab === 'function') switchTab('program', nb);
  setTimeout(function () {
    if (typeof pbSetMode === 'function') pbSetMode('athlete');
    var sel = document.getElementById('pb-athlete'); if (sel) { sel.value = athlete; sel.dispatchEvent(new Event('change')); }
    if (typeof showStatus === 'function') showStatus('⏭ Building ' + athlete.split(' ')[0] + '\'s next block' + (next ? ' — Week 1 will default to ' + ofFmt(next) : ''));
  }, 200);
}

// ── 5. Percentiles on athlete pages ──────────────────────────────────────────
function ofPctMode() { try { return localStorage.getItem(OF_PCT_KEY) || '50'; } catch (e) { return '50'; } }
function ofSetPct(v) {
  try { localStorage.setItem(OF_PCT_KEY, v); } catch (e) {}
  if (typeof syncToSupabase === 'function') setTimeout(syncToSupabase, 800);
  if (typeof apPushProfiles === 'function') apPushProfiles(null, true).then(function (n) { if (typeof showStatus === 'function') showStatus('📊 Athlete pages updated (' + n + ')'); });
}

// ── 4. Roster board (top of Inbox) ───────────────────────────────────────────
var OF_BOARD_OPEN = true;
function renderRosterBoard() {
  var el = document.getElementById('of-board'); if (!el || typeof PROGRAM_ROWS === 'undefined') return;
  var names = {}; PROGRAM_ROWS.forEach(function (r) { names[r.athlete] = 1; });
  var rows = Object.keys(names).map(ofStats).filter(Boolean);
  rows.forEach(function (s) { s.score = s.pain * 100 + s.missed * 10 + (s.dupes ? 5 : 0) + (!s.queued && s.daysLeft <= 7 ? 3 : 0); });
  rows.sort(function (a, b) { return b.score - a.score || a.athlete.localeCompare(b.athlete); });
  var none = Object.keys(typeof PLAYERS !== 'undefined' ? PLAYERS : {}).filter(function (n) { return !names[n] && !['SP', 'RP'].includes((PLAYERS[n] || {}).pos); });
  var th = 'padding:6px 8px;font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;text-align:left;white-space:nowrap;border-bottom:1px solid var(--border);';
  var td = 'padding:7px 8px;font-size:12px;border-bottom:1px solid rgba(255,255,255,.05);vertical-align:middle;white-space:nowrap;';
  var btn = 'padding:4px 8px;border-radius:5px;font-size:11px;cursor:pointer;margin-left:4px;';
  var ago = function (t) { if (!t) return '<span style="color:var(--text3);">never</span>'; var d = Math.floor((Date.now() - t) / 864e5); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d + 'd ago'; };
  var body = rows.map(function (s) {
    var rl = s.ready ? { green: '🟢', yellow: '🟡', red: '🔴' }[s.ready.level] || '' : '<span style="color:var(--text3);">—</span>';
    var test = [s.t10 ? s.t10.v.toFixed(2) + 's 10y' : '', s.bw ? Math.round(s.bw.v) + ' lb' : ''].filter(Boolean).join(' · ') || '<span style="color:var(--text3);">—</span>';
    var blk = s.curWeek === 0 ? 'Starts ' + ofFmt(s.span.start) : 'Wk ' + Math.min(s.curWeek, s.span.weeks) + '/' + s.span.weeks + ' · ends ' + ofFmt(s.span.end);
    var ending = !s.queued && s.daysLeft <= 7;
    return '<tr>'
      + '<td style="' + td + 'font-weight:700;color:#fff;cursor:pointer;" onclick="selectPlayer(\'' + ofJsq(s.athlete) + '\')">' + ofEsc(s.athlete) + (s.dupes ? ' <span title="' + s.dupes.length + ' live programs — take down the extra" style="color:#f59e0b;">⚠ ' + s.dupes.length + ' live</span>' : '') + '</td>'
      + '<td style="' + td + '">' + ofEsc(s.row.name || '') + '<div style="font-size:10px;color:' + (ending ? '#f59e0b' : 'var(--text3)') + ';">' + blk + (s.queued ? ' · next queued ✓' : '') + '</div></td>'
      + '<td style="' + td + 'text-align:center;font-weight:700;color:' + (s.wkSched && s.wkDone >= s.wkSched ? '#4ade80' : '#fff') + ';">' + (s.wkSched ? s.wkDone + '/' + s.wkSched : '—') + '</td>'
      + '<td style="' + td + '">' + ago(s.lastT) + '</td>'
      + '<td style="' + td + 'text-align:center;color:' + (s.missed ? '#f59e0b' : 'var(--text3)') + ';font-weight:700;">' + s.missed + '</td>'
      + '<td style="' + td + 'text-align:center;color:' + (s.pain ? '#f87171' : 'var(--text3)') + ';font-weight:700;">' + s.pain + '</td>'
      + '<td style="' + td + 'text-align:center;">' + rl + '</td>'
      + '<td style="' + td + '">' + test + '</td>'
      + '<td style="' + td + 'text-align:right;">'
      + (ending ? '<button onclick="ofNextBlock(\'' + ofJsq(s.athlete) + '\')" style="' + btn + 'background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.45);color:#f59e0b;font-weight:700;">⏭ Next block</button>' : '')
      + (s.dupes ? '<button onclick="ofFixDupes(\'' + ofJsq(s.athlete) + '\')" style="' + btn + 'background:rgba(204,52,51,.15);border:1px solid rgba(204,52,51,.4);color:var(--red);">Fix</button>' : '')
      + '<button onclick="llShare(\'' + s.row.id + '\')" style="' + btn + 'background:#22c55e;border:none;color:#000;font-weight:700;">📲</button>'
      + '<button onclick="llAthleteView(\'' + s.row.id + '\')" title="See his page" style="' + btn + 'background:rgba(96,165,250,.15);border:1px solid rgba(96,165,250,.4);color:#60a5fa;">📱</button>'
      + '</td></tr>';
  }).join('');
  var mode = ofPctMode();
  el.innerHTML = '<div class="card" style="padding:12px 14px;margin-bottom:14px;">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">'
    + '<div onclick="OF_BOARD_OPEN=!OF_BOARD_OPEN;renderRosterBoard()" style="cursor:pointer;font-size:14px;font-weight:800;color:#fff;">📋 Roster this week <span style="font-size:11px;font-weight:500;color:var(--text3);">' + rows.length + ' on programs' + (none.length ? ' · ' + none.length + ' without one' : '') + ' · ' + (OF_BOARD_OPEN ? 'hide ▲' : 'show ▼') + '</span></div>'
    + '<label style="font-size:11px;color:var(--text3);">Athlete pages show percentiles: <select onchange="ofSetPct(this.value)" style="background:var(--bg3);border:1px solid var(--border2);border-radius:5px;color:var(--text);font-size:11px;padding:3px 6px;">'
    + [['all', 'All'], ['50', '50th+ only'], ['off', 'Off']].map(function (o) { return '<option value="' + o[0] + '"' + (mode === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label></div>'
    + (OF_BOARD_OPEN ? (rows.length ? '<div style="overflow-x:auto;margin-top:8px;"><table style="width:100%;border-collapse:collapse;"><tr>'
      + ['Athlete', 'Program', 'This week', 'Last logged', 'Missed 14d', 'Pain 14d', 'Readiness', 'Home test', ''].map(function (h) { return '<th style="' + th + '">' + h + '</th>'; }).join('') + '</tr>' + body + '</table></div>'
      : '<div style="color:var(--text3);font-size:12px;padding:10px 0;">No live programs yet.</div>')
      + (none.length ? '<div style="font-size:11px;color:var(--text3);margin-top:8px;">No program: ' + none.map(ofEsc).join(', ') + '</div>' : '') : '')
    + '</div>';
}
async function ofFixDupes(athlete) {
  var st = ofStats(athlete); if (!st || !st.dupes) return;
  var keep = st.row, drop = st.dupes.filter(function (r) { return r.id !== keep.id; });
  var list = drop.map(function (r) { var s = ofSpan(r); return '• ' + r.name + ' (Week 1 ' + ofFmt(s.start) + ')'; }).join('\n');
  if (!confirm('Keep "' + keep.name + '" (Week 1 ' + ofFmt(st.span.start) + ') and take down:\n\n' + list + '\n\nHis link keeps working and shows the one you keep.')) return;
  if (typeof llLoad === 'function') await llLoad();
  if (typeof llTakeDown === 'function') await llTakeDown(drop.map(function (r) { return r.id; }), true);
  renderRosterBoard();
}

// ── Inbox items: block ending, new home test ─────────────────────────────────
(function () {
  if (typeof inboxItems === 'function') {
    var _i = inboxItems;
    inboxItems = function () {
      var items = _i.apply(this, arguments);
      try {
        var names = {}; (typeof PROGRAM_ROWS !== 'undefined' ? PROGRAM_ROWS : []).forEach(function (r) { names[r.athlete] = 1; });
        Object.keys(names).forEach(function (n) {
          var s = ofStats(n); if (!s) return;
          if (!s.queued && s.daysLeft <= 7) items.push({ id: 'blk|' + s.row.id, type: 'block', pri: 3, date: s.span.end, athlete: n, program: s.row.name, rowId: s.row.id, ref: null,
            title: s.daysLeft < 0 ? '⏭ Block ended ' + ofFmt(s.span.end) : '⏭ Block ends ' + ofFmt(s.span.end), detail: 'Nothing queued after it. Build his next block — it shows up on the same link.' });
          ofTests(n).slice(0, 3).forEach(function (t) {
            var parts = [t.t10 ? '10 yd ' + t.t10 + ' s' : '', t.t30 ? '30 yd ' + t.t30 + ' s' : '', t.bw ? t.bw + ' lb' : ''].filter(Boolean).join(' · ');
            if (parts) items.push({ id: 'test|' + n + '|' + t.date, type: 'test', pri: 5, date: t.date, athlete: n, program: 'Home test', rowId: t.rowId, ref: null, title: '📏 Home test', detail: parts + (t.how ? ' (' + t.how + ')' : '') + (t.note ? ' · "' + t.note + '"' : '') });
          });
        });
      } catch (e) { console.warn('[offseason inbox]', e); }
      return items;
    };
  }
  if (typeof renderInbox === 'function') {
    var _r = renderInbox;
    renderInbox = function () { var x = _r.apply(this, arguments); try { renderRosterBoard(); } catch (e) { console.warn('[roster board]', e); } return x; };
  }
  // Next-block send: Week 1 defaults to the Monday after his current block
  if (typeof showPushProgramModal === 'function') {
    var _m = showPushProgramModal;
    showPushProgramModal = function (progId) {
      var r = _m.apply(this, arguments);
      try {
        var p = (SAVED_PROGRAMS || []).find(function (x) { return String(x.id) === String(progId); });
        var inp = document.getElementById('push-start-date');
        if (p && inp && !(p.pushes || []).length && p.athlete && p.athlete !== '(Sandbox)') {
          var want = OF_NEXT && OF_NEXT.athlete === p.athlete ? OF_NEXT.start : null;
          if (!want) { var st = ofStats(p.athlete); if (st && !st.queued && st.span.end >= ofISO(new Date())) want = ofNextMonday(st.span.end); }
          if (want && want > inp.value) { inp.value = want; inp.dispatchEvent(new Event('change')); }
        }
      } catch (e) {}
      return r;
    };
  }
  if (typeof loadProgramRows === 'function') {
    var _l = loadProgramRows;
    loadProgramRows = function () { var pr = _l.apply(this, arguments); Promise.resolve(pr).then(function () { ofRegisterAll(); }); return pr; };
  }
})();
