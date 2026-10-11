// ═══════════════════════════════════════════════════════════════════════════
// 🩺 Data Check — which data each roster player matched, and what looks wrong.
// Built after Ryan Rolison's page showed Michael Busch's numbers (copied with
// the program) and nothing flagged it. Read-only except the per-player
// "Rebuild page" button, which re-sends that athlete's own profile.
//
// Flags
//   red     Program page shows another athlete's numbers / sprint data on a pitcher's page
//           Pitcher has sprint or hitting data under his name
//           Same test data filed under two names
//   yellow  Data under a name that isn't on the roster (likely a name mismatch)
//           Body weight jumps 15+ lb between tests ≤ 21 days apart (wrong athlete on the plate?)
//           CMJ height or peak power/BM jumps 20%+ between tests ≤ 30 days apart
//           Position player with no Savant match
//   info    No VALD jumps on file
// ═══════════════════════════════════════════════════════════════════════════
var DC = { last: null };

function dcEsc(x) { return typeof escHtml === 'function' ? escHtml(String(x == null ? '' : x)) : String(x == null ? '' : x); }
function dcPit(n) { return typeof isPitcherPos === 'function' && PLAYERS[n] && isPitcherPos(PLAYERS[n].pos); }
function dcNorm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\b(jr|sr|ii|iii)\b\.?/g, '').replace(/[^a-z ]/g, '').trim(); }
function dcLast(s) { var p = dcNorm(s).split(' '); return p[p.length - 1]; }
function dcObj(o) { return o && typeof o === 'object' ? o : {}; }
function dcDate(r) { return String(r && (r.date || r.d || r.Date || '')).slice(0, 10); }
function dcKpiSig(p) { return p && p.kpis ? p.kpis.filter(function (k) { return !/^home|^rm:/.test(k.k); }).map(function (k) { return k.k + '=' + k.v; }).sort().join(' ') : ''; }

// Every source, as { label, pos: true if position-player-only data, get: name → array }
function dcSources() {
  var I = typeof importedData !== 'undefined' ? importedData : {};
  var JPP = typeof JP !== 'undefined' && JP.data && JP.data.players ? JP.data.players : {};
  return [
    { k: 'vald', label: 'VALD jumps', pos: false, map: JPP },
    { k: 'cmj', label: 'CMJ (CSV)', pos: false, map: dcObj(I.cmj) },
    { k: 'abcmj', label: 'ABCMJ (CSV)', pos: false, map: dcObj(I.abcmj) },
    { k: 'statcast', label: 'Statcast', pos: true, map: dcObj(I.statcast) },
    { k: 'hitting', label: 'Hitting', pos: true, map: dcObj(I.hitting) },
    { k: 'he', label: 'HE runs', pos: true, map: typeof heRunsData !== 'undefined' ? dcObj(heRunsData) : {} }
  ];
}

async function dcRun() {
  var roster = Object.keys(PLAYERS), S = dcSources(), flags = [], per = {};
  var add = function (lvl, who, msg, fix) { var f = { lvl: lvl, who: who, msg: msg, fix: fix || null }; flags.push(f); if (who && per[who]) per[who].flags.push(f); };
  roster.forEach(function (n) { per[n] = { name: n, pos: (PLAYERS[n] || {}).pos || '', pit: dcPit(n), src: {}, flags: [], rows: [] }; });

  // 1. Source coverage per player + names that aren't on the roster
  var stray = {};
  S.forEach(function (s) {
    Object.keys(s.map).forEach(function (name) {
      var arr = Array.isArray(s.map[name]) ? s.map[name] : [];
      if (per[name]) { var ds = arr.map(dcDate).filter(Boolean).sort(); per[name].src[s.k] = { n: arr.length, last: ds[ds.length - 1] || '' }; return; }
      if (!arr.length) return;
      (stray[name] = stray[name] || []).push(arr.length + ' ' + s.label);
    });
  });
  Object.keys(stray).forEach(function (name) {
    var guess = roster.filter(function (r) { return dcLast(r) === dcLast(name); }), g = guess.length === 1 ? guess[0] : null;
    add('yellow', null, '<b>' + dcEsc(name) + '</b> isn\'t on the roster but has data (' + dcEsc(stray[name].join(', ')) + ')' + (g ? ' — probably <b>' + dcEsc(g) + '</b> under a different name' + (dcPit(g) ? '' : ', so it isn\'t being used') : ' — fine if he\'s off the roster') + '.');
  });

  // 2. Savant match (position players)
  if (typeof VA !== 'undefined' && VA.data) {
    (VA.data.rows || []).forEach(function (r) { if (per[r.roster]) per[r.roster].savant = r.name || r.roster; });
    (VA.data.missing || []).forEach(function (n) { if (per[n]) add('yellow', n, 'No Baseball Savant match — sprint speed and on-field value won\'t show.'); });
  }

  // 3. Pitchers with position-player data
  roster.forEach(function (n) {
    if (!per[n].pit) return;
    S.forEach(function (s) { var c = per[n].src[s.k]; if (s.pos && c && c.n) add('red', n, 'Pitcher with ' + c.n + ' ' + s.label + ' record' + (c.n === 1 ? '' : 's') + ' under his name — likely another player\'s data.'); });
  });

  // 4. Same data filed under two names
  S.forEach(function (s) {
    var seen = {};
    Object.keys(s.map).forEach(function (name) {
      var arr = Array.isArray(s.map[name]) ? s.map[name] : []; if (arr.length < 2) return;
      var sig = JSON.stringify(arr.slice(-3).map(function (r) { var c = Object.assign({}, r); delete c.name; delete c.athlete; delete c.player; return c; }));
      if (seen[sig] && seen[sig] !== name) add('red', per[name] ? name : (per[seen[sig]] ? seen[sig] : null), dcEsc(s.label) + ': <b>' + dcEsc(seen[sig]) + '</b> and <b>' + dcEsc(name) + '</b> have identical recent records — one of them is the other\'s data.');
      else seen[sig] = name;
    });
  });

  // 5. Suspicious VALD jumps between consecutive tests
  var JPP = S[0].map;
  roster.forEach(function (n) {
    var T = (JPP[n] || []).filter(function (t) { return t.t === 'CMJ' && t.v; }).slice().sort(function (a, b) { return a.d < b.d ? -1 : 1; });
    var hits = [];
    for (var i = 1; i < T.length; i++) {
      var a = T[i - 1], b = T[i], days = (new Date(b.d) - new Date(a.d)) / 864e5;
      if (a.v.bw && b.v.bw && days <= 21 && Math.abs(b.v.bw - a.v.bw) >= 15) hits.push(b.d + ': body weight ' + Math.round(a.v.bw) + ' → ' + Math.round(b.v.bw) + ' lb in ' + Math.round(days) + ' days');
      ['jh', 'ppbm'].forEach(function (k) {
        if (a.v[k] && b.v[k] && days <= 30 && Math.abs(b.v[k] - a.v[k]) / a.v[k] >= 0.2) hits.push(b.d + ': ' + (k === 'jh' ? 'jump height ' + a.v.jh.toFixed(1) + ' → ' + b.v.jh.toFixed(1) + ' cm' : 'peak power/BM ' + a.v.ppbm.toFixed(1) + ' → ' + b.v.ppbm.toFixed(1)) + ' in ' + Math.round(days) + ' days');
      });
    }
    if (hits.length) add('yellow', n, 'VALD test' + (hits.length === 1 ? '' : 's') + ' worth a look (wrong athlete on the plate or a bad trial?): ' + hits.slice(-4).map(dcEsc).join('; ') + (hits.length > 4 ? ' (+' + (hits.length - 4) + ' more)' : ''));
    if (!T.length && !(per[n].src.cmj && per[n].src.cmj.n)) add('info', n, 'No VALD jumps on file.');
  });

  // 6. Live program pages: is each one showing his own numbers?
  var rows = [];
  try {
    var db = typeof getSupaClient === 'function' ? getSupaClient() : null;
    if (db) {
      var r = await db.from('athlete_programs').select('id,athlete,name,pb_state');
      rows = (r.data || []).map(function (x) { var pb = null; try { pb = typeof x.pb_state === 'string' ? JSON.parse(x.pb_state) : x.pb_state; } catch (e) {} return { id: String(x.id), athlete: x.athlete, name: x.name, pb: pb || {} }; }).filter(function (x) { return per[x.athlete]; });
    }
  } catch (e) { add('yellow', null, 'Couldn\'t read live programs: ' + dcEsc(e.message || e)); }
  var own = {}; roster.forEach(function (n) { try { own[n] = typeof apProfile === 'function' ? apProfile(n) : null; } catch (e) { own[n] = null; } });
  var ownSig = {}; roster.forEach(function (n) { var s = dcKpiSig(own[n]); if (s) ownSig[s] = n; });
  rows.forEach(function (x) {
    var n = x.athlete, pf = x.pb.profile, sp = x.pb.speedSummary, label = '“' + (x.name || 'program') + '”';
    per[n].rows.push(x);
    var fix = { name: n };
    if (pf && pf.athlete && pf.athlete !== n) return add('red', n, label + ' shows <b>' + dcEsc(pf.athlete) + '</b>\'s profile.', fix);
    var sig = dcKpiSig(pf), mine = dcKpiSig(own[n]);
    if (sig && ownSig[sig] && ownSig[sig] !== n) return add('red', n, label + ' shows <b>' + dcEsc(ownSig[sig]) + '</b>\'s numbers on his profile.', fix);
    var twin = rows.find(function (y) { return y.athlete !== n && dcKpiSig(y.pb.profile) === sig && sig; });
    if (twin) return add('red', n, label + ' has the same profile numbers as <b>' + dcEsc(twin.athlete) + '</b>\'s page — one of them is wrong.', fix);
    if (per[n].pit && sp) add('red', n, label + ' still has a game-speed card (pitcher).', fix);
    else if (sp && sp.best && rows.some(function (y) { return y.athlete !== n && y.pb.speedSummary && y.pb.speedSummary.best === sp.best && y.pb.speedSummary.lastRun === sp.lastRun; })) add('red', n, label + ' has the same game-speed card as another athlete.', fix);
    if (sig && mine && sig !== mine) add('yellow', n, label + ' profile is out of date with his current numbers.', fix);
  });

  DC.last = { at: new Date(), flags: flags, per: per, roster: roster, sources: S };
  dcBadge();
  return DC.last;
}

function dcBadge() {
  var b = document.getElementById('dc-badge'); if (!b || !DC.last) return;
  var n = DC.last.flags.filter(function (f) { return f.lvl === 'red'; }).length;
  b.textContent = n; b.style.display = n ? 'inline-block' : 'none';
}

var DC_COL = { red: '#f87171', yellow: '#fbbf24', info: 'var(--text3)' };
var DC_ICON = { red: '⛔', yellow: '⚠️', info: 'ℹ️' };
function dcFlagHTML(f, showWho) {
  return '<div style="display:flex;gap:8px;align-items:flex-start;padding:6px 0;font-size:12.5px;line-height:1.45;color:var(--text);">'
    + '<span>' + DC_ICON[f.lvl] + '</span><div style="flex:1;">' + (showWho && f.who ? '<b style="color:' + DC_COL[f.lvl] + ';">' + dcEsc(f.who) + '</b> — ' : '') + f.msg + '</div>'
    + (f.fix ? '<button onclick="dcFix(\'' + String(f.fix.name).replace(/'/g, "\\'") + '\', this)" style="flex-shrink:0;padding:4px 10px;border-radius:7px;border:1px solid rgba(59,130,246,.5);background:rgba(59,130,246,.15);color:#93c5fd;font-size:11px;font-weight:700;cursor:pointer;">↻ Rebuild page</button>' : '')
    + '</div>';
}

function dcRender() {
  var box = document.getElementById('dc-body'); if (!box) return;
  var D = DC.last; if (!D) { box.innerHTML = '<div style="color:var(--text2);">Checking…</div>'; return; }
  var cnt = function (l) { return D.flags.filter(function (f) { return f.lvl === l; }).length; };
  var top = D.flags.filter(function (f) { return f.lvl !== 'info'; }).sort(function (a, b) { return (a.lvl === 'red' ? 0 : 1) - (b.lvl === 'red' ? 0 : 1); });
  var head = '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;">'
    + [['red', 'Wrong data'], ['yellow', 'Worth a look'], ['info', 'Notes']].map(function (x) { return '<div style="padding:8px 14px;border-radius:10px;background:var(--bg3);border:1px solid var(--border2);"><div style="font-size:20px;font-weight:800;color:' + DC_COL[x[0]] + ';">' + cnt(x[0]) + '</div><div style="font-size:10.5px;color:var(--text2);">' + x[1] + '</div></div>'; }).join('')
    + '<div style="flex:1;"></div><div style="align-self:flex-end;font-size:11px;color:var(--text3);">Checked ' + D.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + ' · <a href="#" onclick="dcOpen(true);return false;" style="color:#93c5fd;">re-check</a></div></div>';
  var issues = top.length ? '<div style="margin-bottom:18px;">' + top.map(function (f) { return dcFlagHTML(f, true); }).join('') + '</div>' : '<div style="padding:12px;border-radius:10px;background:rgba(34,197,94,.1);color:#86efac;font-size:13px;margin-bottom:18px;">✓ Nothing looks wrong — every page and data source matches its player.</div>';
  var cols = D.sources.map(function (s) { return '<th style="padding:6px 8px;font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;text-align:center;">' + dcEsc(s.label) + '</th>'; }).join('');
  var order = D.roster.slice().sort(function (a, b) { return (D.per[a].pit - D.per[b].pit) || a.localeCompare(b); });
  var body = order.map(function (n) {
    var p = D.per[n], worst = p.flags.some(function (f) { return f.lvl === 'red'; }) ? 'red' : p.flags.some(function (f) { return f.lvl === 'yellow'; }) ? 'yellow' : null;
    var cells = D.sources.map(function (s) {
      var c = p.src[s.k];
      if (!c || !c.n) return '<td style="text-align:center;color:var(--text3);">—</td>';
      var bad = p.pit && s.pos;
      return '<td style="text-align:center;font-size:11.5px;color:' + (bad ? '#f87171' : 'var(--text)') + ';" title="' + c.n + ' records' + (c.last ? ', last ' + c.last : '') + '">' + (bad ? '⛔ ' : '✓ ') + c.n + (c.last ? '<div style="font-size:9.5px;color:var(--text3);">' + c.last.slice(5) + '</div>' : '') + '</td>';
    }).join('');
    var sav = p.pit ? '<span style="color:var(--text3);">n/a</span>' : p.savant ? '✓' + (dcNorm(p.savant) !== dcNorm(n) ? ' <span style="color:#fbbf24;">' + dcEsc(p.savant) + '</span>' : '') : '<span style="color:#fbbf24;">no match</span>';
    var pages = p.rows.length ? p.rows.length + ' live' : '<span style="color:var(--text3);">—</span>';
    return '<tr style="border-top:1px solid var(--border);">'
      + '<td style="padding:7px 8px;white-space:nowrap;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;background:' + (worst ? DC_COL[worst] : '#22c55e') + ';"></span><b style="font-size:12.5px;">' + dcEsc(n) + '</b> <span style="font-size:10.5px;color:var(--text3);">' + dcEsc(p.pos) + '</span></td>'
      + cells + '<td style="text-align:center;font-size:11.5px;">' + sav + '</td><td style="text-align:center;font-size:11.5px;">' + pages + '</td></tr>';
  }).join('');
  box.innerHTML = head + issues
    + '<div style="font-size:10px;font-weight:700;letter-spacing:.12em;color:var(--text3);margin-bottom:6px;">WHAT EACH PLAYER MATCHED</div>'
    + '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;"><thead><tr><th style="text-align:left;padding:6px 8px;font-size:10px;color:var(--text3);text-transform:uppercase;">Player</th>' + cols + '<th style="padding:6px 8px;font-size:10px;color:var(--text3);text-transform:uppercase;">Savant</th><th style="padding:6px 8px;font-size:10px;color:var(--text3);text-transform:uppercase;">Program pages</th></tr></thead><tbody>' + body + '</tbody></table></div>'
    + '<div style="font-size:11px;color:var(--text3);margin-top:10px;">⛔ in the table = pitcher with position-player data. Hover a cell for record count and last date.</div>';
}

async function dcOpen(recheck) {
  var m = document.getElementById('dc-modal');
  if (!m) {
    m = document.createElement('div'); m.id = 'dc-modal';
    m.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.65);display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow-y:auto;';
    m.innerHTML = '<div style="background:var(--bg2,#0f172a);border:1px solid var(--border2);border-radius:14px;width:100%;max-width:1100px;padding:20px 22px;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;"><div><div style="font-family:\'Bebas Neue\',sans-serif;font-size:28px;letter-spacing:.03em;color:#fff;line-height:1;">🩺 Data Check</div><div style="font-size:12px;color:var(--text2);margin-top:3px;">Which data each player matched, and anything that looks like it belongs to someone else.</div></div>'
      + '<button onclick="document.getElementById(\'dc-modal\').remove()" style="background:none;border:none;color:var(--text2);font-size:22px;cursor:pointer;">✕</button></div><div id="dc-body"></div></div>';
    m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
    document.body.appendChild(m);
  }
  if (recheck || !DC.last) { DC.last = null; dcRender(); await dcRun(); }
  dcRender();
}

async function dcFix(name, btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Rebuilding…'; }
  try {
    var n = typeof apPushProfiles === 'function' ? await apPushProfiles(name, true) : 0;
    if (typeof showStatus === 'function') showStatus(n ? '📲 Rebuilt ' + name.split(' ')[0] + '\'s page with his own numbers' : 'Nothing to change on ' + name.split(' ')[0] + '\'s page');
  } catch (e) { alert('Couldn\'t rebuild: ' + (e.message || e)); }
  await dcRun(); dcRender();
}

// Sidebar button + a quiet background check once data has loaded
(function () {
  function addBtn() {
    var nav = document.querySelector('.sidebar-nav'); if (!nav || document.getElementById('dc-nav')) return;
    var b = document.createElement('button'); b.className = 'nav-btn'; b.id = 'dc-nav';
    b.innerHTML = '🩺 Data Check<span id="dc-badge" style="display:none;margin-left:6px;padding:0 6px;border-radius:9px;background:#ef4444;color:#fff;font-size:10px;font-weight:800;line-height:16px;"></span>';
    b.onclick = function () { dcOpen(); };
    nav.appendChild(b);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addBtn); else addBtn();
  setTimeout(function () { dcRun().catch(function (e) { console.warn('[data-check]', e); }); }, 20000);
})();
