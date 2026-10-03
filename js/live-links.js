// ═══════════════════════════════════════════════════════════════════════════
// Live links — every program on an athlete's phone lives in Supabase
// (athlete_programs). My Programs only lists what's saved in this browser, so a
// link could stay live with no way to see or cancel it. This file:
//   • lists live links that aren't in My Programs (My Programs page + the
//     player's Programs tab) with ✏️ Live edit and ⛔ Take down
//   • deleting a program in My Programs also offers to take down its live
//     link(s), so nothing is left running in the background
// ═══════════════════════════════════════════════════════════════════════════
var LL_ROWS = null, _llLoading = null;

function llEsc(s) { return typeof escHtml === 'function' ? escHtml(String(s == null ? '' : s)) : String(s == null ? '' : s); }
function llLocalIds() { return (typeof SAVED_PROGRAMS !== 'undefined' ? SAVED_PROGRAMS : []).map(function (p) { return String(p.id); }); }
function llFmt(iso) { if (!iso) return ''; var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }

async function llLoad() {
  if (_llLoading) return _llLoading;
  _llLoading = (async function () {
    try {
      var db = typeof getSupaClient === 'function' ? getSupaClient() : null; if (!db) return LL_ROWS;
      var r = await db.from('athlete_programs').select('id,athlete,name,created_at,updated_at,completion_updated_at');
      if (r.error) throw r.error;
      LL_ROWS = (r.data || []).map(function (x) { return { id: String(x.id), athlete: x.athlete || '', name: x.name || '', created: x.created_at, updated: x.updated_at, logged: x.completion_updated_at }; });
    } catch (e) { console.warn('[live-links]', e); }
    finally { _llLoading = null; }
    return LL_ROWS;
  })();
  return _llLoading;
}
// Live rows with no copy in My Programs (optionally for one athlete)
function llOrphans(athlete) {
  var local = llLocalIds();
  return (LL_ROWS || []).filter(function (r) { return local.indexOf(r.id) < 0 && (!athlete || r.athlete === athlete); })
    .sort(function (a, b) { return String(b.created || '').localeCompare(String(a.created || '')); });
}

// Take down: deletes the live row (+ its history), the local sent copy, and the send record
async function llTakeDown(ids, skipConfirm) {
  ids = (Array.isArray(ids) ? ids : [ids]).map(String);
  if (!ids.length) return false;
  var rows = (LL_ROWS || []).filter(function (r) { return ids.indexOf(r.id) >= 0; });
  if (!skipConfirm) {
    var list = (rows.length ? rows : ids.map(function (id) { return { athlete: '', name: id }; })).map(function (r) { return '• ' + (r.athlete ? r.athlete + ' — ' : '') + r.name; }).join('\n');
    if (!confirm('Take down ' + ids.length + ' live program' + (ids.length === 1 ? '' : 's') + '?\n\n' + list + '\n\nThe athlete\'s link stops working and it drops out of the Inbox. This can\'t be undone.')) return false;
  }
  var db = getSupaClient(); if (!db) { alert('Cloud not connected.'); return false; }
  var d = await db.from('athlete_programs').delete().in('id', ids);
  if (d.error) { alert('Take down failed: ' + d.error.message); return false; }
  try { await db.from('cubs_sc_data').delete().in('key', ids.map(function (i) { return 'hist:' + i; })); } catch (e) {}
  if (typeof SAVED_PROGRAMS !== 'undefined') {
    SAVED_PROGRAMS = SAVED_PROGRAMS.filter(function (p) { return !(p.isAssigned && ids.indexOf(String(p.id)) >= 0); });
    SAVED_PROGRAMS.forEach(function (p) { if (p.pushes) p.pushes = p.pushes.filter(function (x) { return ids.indexOf(String(x.id)) < 0; }); });
    if (typeof persistPrograms === 'function') persistPrograms();
  }
  if (typeof PE_LIVE !== 'undefined' && PE_LIVE && ids.indexOf(String(PE_LIVE.rowId)) >= 0) PE_LIVE = null;
  await llLoad();
  if (typeof loadProgramRows === 'function') { try { await loadProgramRows(); } catch (e) {} }
  llRefreshViews();
  if (typeof showStatus === 'function') showStatus('⛔ Took down ' + ids.length + ' live program' + (ids.length === 1 ? '' : 's'));
  return true;
}
function llTakeDownAll(athlete) { return llTakeDown(llOrphans(athlete).map(function (r) { return r.id; })); }

function llRefreshViews() {
  try { if (typeof renderProgramLibrary === 'function' && document.getElementById('prog-library-grid')) renderProgramLibrary(); } catch (e) {}
  try { if (typeof renderAthletePrograms === 'function') renderAthletePrograms(); } catch (e) {}
  try { if (typeof renderInbox === 'function' && typeof currentPage !== 'undefined' && currentPage === 'inbox') renderInbox(); } catch (e) {}
  try { if (typeof updateInboxBadge === 'function') updateInboxBadge(); } catch (e) {}
}

function llRowsHTML(rows, showAthlete) {
  var b = 'border-radius:5px;padding:4px 10px;font-size:11px;cursor:pointer;';
  return rows.map(function (r) {
    return '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 10px;border-top:1px solid rgba(255,255,255,0.06);">'
      + '<div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (showAthlete ? llEsc(r.athlete) + ' — ' : '') + llEsc(r.name || 'Untitled') + '</div>'
      + '<div style="font-size:10px;color:var(--text3);">Sent ' + llFmt(r.created) + (r.logged ? ' · last logged ' + llFmt(r.logged) : ' · nothing logged') + '</div></div>'
      + (typeof peOpenLive === 'function' ? '<button onclick="peOpenLive(\'' + r.id + '\')" style="' + b + 'background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.4);color:#f59e0b;">✏️ Live edit</button>' : '')
      + '<button onclick="llTakeDown(\'' + r.id + '\')" style="' + b + 'background:rgba(204,52,51,0.15);border:1px solid rgba(204,52,51,0.4);color:var(--red);font-weight:700;">⛔ Take down</button>'
      + '</div>';
  }).join('');
}
function llPanel(rows, athlete) {
  if (!rows.length) return '';
  return '<div class="ll-panel" style="margin-bottom:14px;background:rgba(204,52,51,0.06);border:1px solid rgba(204,52,51,0.3);border-radius:10px;overflow:hidden;">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:10px 12px;">'
    + '<div><div style="font-size:13px;font-weight:700;color:#fca5a5;">📡 Live on ' + (athlete ? llEsc(athlete.split(' ')[0]) + '\'s phone' : 'athletes\' phones') + ' — not in My Programs (' + rows.length + ')</div>'
    + '<div style="font-size:11px;color:var(--text3);margin-top:2px;">Sent from another browser or deleted here without taking the link down. These still feed the Inbox.</div></div>'
    + (rows.length > 1 ? '<button onclick="llTakeDownAll(' + (athlete ? '\'' + (typeof jsq === 'function' ? jsq(athlete) : athlete) + '\'' : '') + ')" style="border-radius:6px;padding:6px 12px;font-size:11px;cursor:pointer;background:rgba(204,52,51,0.2);border:1px solid rgba(204,52,51,0.5);color:var(--red);font-weight:700;">⛔ Take down all ' + rows.length + '</button>' : '')
    + '</div>' + llRowsHTML(rows, !athlete) + '</div>';
}

(function () {
  // My Programs page: panel above the grid
  if (typeof renderProgramLibrary === 'function') {
    var _lib = renderProgramLibrary;
    renderProgramLibrary = function () {
      var r = _lib.apply(this, arguments);
      try {
        var grid = document.getElementById('prog-library-grid'); if (!grid) return r;
        var host = document.getElementById('ll-lib-panel');
        if (!host) { host = document.createElement('div'); host.id = 'll-lib-panel'; grid.parentNode.insertBefore(host, grid); }
        var ath = (document.getElementById('prog-lib-athlete') || {}).value || '';
        host.innerHTML = llPanel(llOrphans(ath), '');
        if (LL_ROWS === null) llLoad().then(function () { if (LL_ROWS) renderProgramLibrary(); });
      } catch (e) { console.warn('[live-links]', e); }
      return r;
    };
  }
  // Player Programs tab: panel at the top
  if (typeof renderAthletePrograms === 'function') {
    var _ath = renderAthletePrograms;
    renderAthletePrograms = function () {
      var r = _ath.apply(this, arguments);
      try {
        var el = document.getElementById('athlete-programs-list'); if (!el || typeof currentPlayer === 'undefined') return r;
        var rows = llOrphans(currentPlayer);
        if (rows.length) {
          if (/No programs yet/.test(el.textContent)) el.innerHTML = '';
          el.insertAdjacentHTML('afterbegin', llPanel(rows, currentPlayer));
        }
        if (LL_ROWS === null) llLoad().then(function () { if (LL_ROWS) renderAthletePrograms(); });
      } catch (e) { console.warn('[live-links]', e); }
      return r;
    };
  }
  // Delete in My Programs → offer to take down its live link(s)
  if (typeof deleteProgram === 'function') {
    var _del = deleteProgram;
    deleteProgram = function (id) {
      var p = (SAVED_PROGRAMS || []).find(function (x) { return String(x.id) === String(id); });
      var cand = [];
      if (p) {
        cand.push(String(p.id));   // drafts and sent copies both sync to the cloud under their own id
        (p.pushes || []).forEach(function (x) { if (cand.indexOf(String(x.id)) < 0) cand.push(String(x.id)); });
      }
      var r = _del.apply(this, arguments);
      if (!p || (SAVED_PROGRAMS || []).some(function (x) { return String(x.id) === String(id); })) return r;   // cancelled
      llLoad().then(function () {
        var live = (LL_ROWS || []).filter(function (row) { return cand.indexOf(row.id) >= 0 && llLocalIds().indexOf(row.id) < 0; });
        if (!live.length) return;
        var named = live.filter(function (row) { return row.athlete && row.athlete !== '(Sandbox)'; });
        if (!named.length) { llTakeDown(live.map(function (x) { return x.id; }), true); return; }   // only a synced draft — clean it up quietly
        var who = named.map(function (row) { return row.athlete; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ');
        if (confirm('"' + (p.name || 'This program') + '" is still live for ' + who + '.\n\nTake the link' + (named.length === 1 ? '' : 's') + ' down too? (Recommended — otherwise it keeps showing in the Inbox.)')) llTakeDown(live.map(function (x) { return x.id; }), true);
        else llRefreshViews();
      });
      return r;
    };
  }
  // Keep the list fresh alongside the Inbox poll
  if (typeof loadProgramRows === 'function') {
    var _lp = loadProgramRows;
    loadProgramRows = function () { var pr = _lp.apply(this, arguments); llLoad().then(function () { try { if (document.getElementById('ll-lib-panel')) renderProgramLibrary(); } catch (e) {} }); return pr; };
  }
  setTimeout(llLoad, 3000);
})();
