// ═══════════════════════════════════════════════════════════════════════════
// Program history + undo. Every send, re-send, live edit and restore of an
// athlete's program is saved as a version (cloud key "hist:<program id>" in
// cubs_sc_data — kept out of localStorage). Any version can be viewed,
// compared with what he has now, and restored; restoring goes through the
// same log-safe write, so his logged sets stay with their exercises.
// ═══════════════════════════════════════════════════════════════════════════
var PH_MAX = 20;
var PH_BY = { push: '📤 Sent', resend: '🔁 Re-sent from master', edit: '✏️ Live edit', restore: '↩️ Restored', baseline: '📌 Before history started' };
function phKey(rowId) { return 'hist:' + rowId; }
function phStrip(st) { var s = JSON.parse(JSON.stringify(st)); ['messages', 'speedSummary', 'remaps', 'lastChange', 'activeWeek'].forEach(function (k) { delete s[k]; }); return s; }
async function phLoad(db, rowId) {
  var r = await db.from('cubs_sc_data').select('value').eq('key', phKey(rowId)).maybeSingle();
  if (r.error) throw r.error;
  try { return r.data && r.data.value ? JSON.parse(r.data.value) : { rowId: String(rowId), versions: [] }; } catch (e) { return { rowId: String(rowId), versions: [] }; }
}
async function phSave(db, h) {
  h.versions = h.versions.slice(-PH_MAX);
  var r = await db.from('cubs_sc_data').upsert({ key: phKey(h.rowId), value: JSON.stringify(h) }, { onConflict: 'key' });
  if (r.error) throw r.error;
}
async function phRecord(db, rowId, st, by, changes, note, athlete, prevState) {
  var h = await phLoad(db, rowId);
  if (!h.versions.length && prevState && by !== 'push') h.versions.push({ n: 1, at: prevState.liveEdited && prevState.liveEdited.at || new Date(Date.now() - 1000).toISOString(), by: 'baseline', changes: [], state: phStrip(prevState) });
  var last = h.versions[h.versions.length - 1];
  h.athlete = athlete || st.athlete || h.athlete;
  h.versions.push({ n: (last ? last.n : 0) + 1, at: new Date().toISOString(), by: by || 'edit', note: note || '', changes: (changes || []).map(function (c) { return typeof c === 'string' ? c : c.text; }).slice(0, 30), state: phStrip(st) });
  await phSave(db, h);
  return h;
}

// Record every write that goes through the log-safe writer (live edit, re-send, restore)
(function () {
  if (typeof peWriteProgram !== 'function') return;
  var _w = peWriteProgram;
  peWriteProgram = async function (db, rowId, newSt, opts) {
    opts = opts || {};
    var prev = null;
    try { var h = await phLoad(db, rowId); if (!h.versions.length) { var r = await db.from('athlete_programs').select('pb_state').eq('id', String(rowId)).maybeSingle(); prev = r.data && r.data.pb_state ? (typeof r.data.pb_state === 'string' ? JSON.parse(r.data.pb_state) : r.data.pb_state) : null; } } catch (e) {}
    var res = await _w.apply(this, arguments);
    try { await phRecord(db, rowId, res.st, opts.by, res.changes, opts.note, newSt.athlete, prev); } catch (e) { console.warn('[history]', e); }
    return res;
  };
})();

// ── History window ──
function phWhen(iso) { var d = new Date(iso); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
function phModal(inner, wide) {
  var m = document.createElement('div'); m.className = 'ph-modal';
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1001;display:flex;align-items:center;justify-content:center;padding:16px;';
  m.innerHTML = '<div style="background:var(--bg2);border:1px solid var(--border2);border-radius:12px;padding:18px;max-width:' + (wide ? 900 : 640) + 'px;width:100%;max-height:86vh;overflow:auto;">' + inner + '</div>';
  document.body.appendChild(m);
  m.addEventListener('click', function (e) { if (e.target === m || e.target.getAttribute('data-close') !== null) m.remove(); });
  return m;
}
async function phOpen(rowId) {
  var db = getSupaClient(); if (!db) { alert('Cloud not connected.'); return; }
  rowId = String(rowId);
  var h, cur;
  try {
    h = await phLoad(db, rowId);
    var r = await db.from('athlete_programs').select('athlete,name,pb_state').eq('id', rowId).maybeSingle();
    cur = r.data;
  } catch (e) { alert('Couldn\'t load history: ' + (e.message || e)); return; }
  var athlete = (cur && cur.athlete) || h.athlete || '';
  var vs = h.versions.slice().reverse();
  var btn = 'padding:5px 10px;border-radius:6px;font-size:11px;cursor:pointer;';
  var body = '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:12px;"><div><div style="font-size:15px;font-weight:700;color:#fff;">🕘 Program history — ' + peEsc(athlete) + '</div>'
    + '<div style="font-size:11px;color:var(--text3);margin-top:2px;">' + peEsc((cur && cur.name) || '') + ' · last ' + PH_MAX + ' versions · restoring keeps his logs with each exercise and tells him what changed</div></div>'
    + '<button data-close style="' + btn + 'background:transparent;border:1px solid var(--border2);color:var(--text2);">Close</button></div>'
    + (vs.length ? vs.map(function (v, i) {
      var isCur = i === 0;
      return '<div style="padding:10px 12px;margin-bottom:8px;border-radius:8px;background:' + (isCur ? 'rgba(34,197,94,.06)' : 'rgba(255,255,255,.02)') + ';border:1px solid ' + (isCur ? 'rgba(34,197,94,.3)' : 'var(--border)') + ';">'
        + '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center;">'
        + '<div style="font-size:12px;color:#fff;font-weight:600;">v' + v.n + ' · ' + (PH_BY[v.by] || v.by) + ' <span style="color:var(--text3);font-weight:400;">' + phWhen(v.at) + '</span>' + (isCur ? ' <span style="font-size:10px;color:var(--green);font-weight:700;">CURRENT</span>' : '') + '</div>'
        + '<div style="display:flex;gap:6px;">'
        + '<button onclick="phView(\'' + rowId + '\',' + v.n + ')" style="' + btn + 'background:rgba(255,255,255,.05);border:1px solid var(--border2);color:var(--text2);">View</button>'
        + (isCur ? '' : '<button onclick="phRestore(\'' + rowId + '\',' + v.n + ')" style="' + btn + 'background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.45);color:#f59e0b;font-weight:700;">↩️ Restore</button>')
        + '</div></div>'
        + (v.note ? '<div style="font-size:11px;color:#a5b4fc;margin-top:4px;">💬 ' + peEsc(v.note) + '</div>' : '')
        + (v.changes && v.changes.length ? '<div style="margin-top:5px;">' + v.changes.slice(0, 5).map(function (c) { return '<div style="font-size:11px;color:var(--text2);line-height:1.5;">• ' + peEsc(c) + '</div>'; }).join('') + (v.changes.length > 5 ? '<div style="font-size:10px;color:var(--text3);">+' + (v.changes.length - 5) + ' more</div>' : '') + '</div>' : '')
        + '</div>';
    }).join('') : '<div style="font-size:12px;color:var(--text3);padding:20px;text-align:center;">No saved versions yet. History starts with the next send, re-send or live edit of this program.</div>');
  document.querySelectorAll('.ph-modal').forEach(function (x) { x.remove(); });
  phModal(body);
}
async function phVersion(rowId, n) { var h = await phLoad(getSupaClient(), rowId); return { h: h, v: h.versions.find(function (x) { return x.n === n; }) }; }
async function phView(rowId, n) {
  var x = await phVersion(rowId, n); if (!x.v) return;
  var st = x.v.state;
  phModal('<div style="display:flex;justify-content:space-between;margin-bottom:10px;"><div style="font-size:14px;font-weight:700;color:#fff;">v' + n + ' · ' + (PH_BY[x.v.by] || x.v.by) + ' · ' + phWhen(x.v.at) + '</div><button data-close style="padding:5px 10px;background:transparent;border:1px solid var(--border2);border-radius:6px;color:var(--text2);cursor:pointer;">Close</button></div>'
    + '<div style="font-size:11px;color:var(--text3);margin-bottom:10px;">' + st.weekData.length + ' weeks' + (st.startDate ? ' · Week 1 starts ' + (typeof fmtDate === 'function' ? fmtDate(st.startDate) : st.startDate) : '') + '</div>'
    + (typeof renderPBStateAsHTML === 'function' ? renderPBStateAsHTML(st, '') : ''), true);
}
async function phRestore(rowId, n) {
  var db = getSupaClient(); if (!db) return;
  var x = await phVersion(rowId, n); if (!x.v) return;
  var r = await db.from('athlete_programs').select('athlete,pb_state').eq('id', rowId).maybeSingle();
  var cur = r.data && (typeof r.data.pb_state === 'string' ? JSON.parse(r.data.pb_state) : r.data.pb_state);
  var target = JSON.parse(JSON.stringify(x.v.state));
  var diff = cur ? TC.buildRemap(TC.ensureUids(JSON.parse(JSON.stringify(cur))), TC.ensureUids(JSON.parse(JSON.stringify(target)))).changes.map(function (c) { return c.text; }) : [];
  if (cur && cur.startDate !== target.startDate && target.startDate) diff.unshift('Week 1 start date back to ' + (typeof fmtDate === 'function' ? fmtDate(target.startDate) : target.startDate));
  if (!confirm('Restore v' + n + ' (' + phWhen(x.v.at) + ') to ' + ((r.data && r.data.athlete) || 'this athlete') + '\'s phone?\n\nWhat changes from what he has now:\n' + (diff.length ? diff.slice(0, 10).map(function (t) { return '• ' + t; }).join('\n') + (diff.length > 10 ? '\n+' + (diff.length - 10) + ' more' : '') : '• Nothing — it matches his current program') + '\n\nHis logged sets stay with their exercises.')) return;
  if (PE_LIVE && PE_LIVE.rowId === rowId && peDirty() && !confirm('You have unsaved live edits to this program open. Discard them and restore?')) return;
  try {
    target.athlete = (r.data && r.data.athlete) || target.athlete;
    await peWriteProgram(db, rowId, target, { by: 'restore', extraChanges: [{ wi: null, di: null, text: 'Restored the version from ' + phWhen(x.v.at) }] });
    var copy = (SAVED_PROGRAMS || []).find(function (p) { return String(p.id) === rowId && p.isAssigned; });
    if (copy) { copy.pbState = JSON.parse(JSON.stringify(target)); if (typeof persistPrograms === 'function') persistPrograms(); }
    if (typeof loadProgramRows === 'function') await loadProgramRows();
    if (PE_LIVE && PE_LIVE.rowId === rowId) { PE_LIVE = null; await peOpenLive(rowId); }
    if (typeof showStatus === 'function') showStatus('↩️ Restored v' + n + ' — it\'s on his phone now');
    phOpen(rowId);
  } catch (e) { alert('Restore failed: ' + (e.message || e)); }
}

// ── Entry points: live bar and the "Edit a live program" card ──
(function () {
  if (typeof document === 'undefined') return;
  if (typeof peRenderBar === 'function') {
    var _b = peRenderBar;
    peRenderBar = function () {
      var x = _b.apply(this, arguments);
      var bar = document.getElementById('pe-bar');
      if (PE_LIVE && bar && !document.getElementById('ph-bar-btn')) {
        var save = document.getElementById('pe-save');
        if (save) save.insertAdjacentHTML('beforebegin', '<button id="ph-bar-btn" onclick="phOpen(PE_LIVE.rowId)" title="Every version of his program — view or restore" style="padding:8px 12px;background:rgba(255,255,255,.05);border:1px solid var(--border2);border-radius:7px;color:var(--text2);font-size:12px;cursor:pointer;">🕘 History</button>');
      }
      return x;
    };
  }
  if (typeof peRenderPicker === 'function') {
    var _p = peRenderPicker;
    peRenderPicker = function () {
      var x = _p.apply(this, arguments);
      var open = document.querySelector('#pe-picker button[onclick^="peOpenLive"]');
      if (open && !document.getElementById('ph-pick-btn')) open.insertAdjacentHTML('afterend', '<button id="ph-pick-btn" onclick="phOpen(document.getElementById(\'pe-pick\').value)" title="Versions of this program — view or restore" style="padding:6px 10px;background:rgba(255,255,255,.05);border:1px solid var(--border2);border-radius:6px;color:var(--text2);font-size:11px;cursor:pointer;">🕘</button>');
      return x;
    };
  }
})();
