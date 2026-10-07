// ═══════════════════════════════════════════════════════════════════════════
// Live program editing — change one athlete's pushed program and it updates on
// his phone. Day/week schedule tools for the builder. Logs follow exercises
// through any change (TC.buildRemap / TC.applyRemap in training-core.js).
// ═══════════════════════════════════════════════════════════════════════════
var PE_LIVE = null;   // { rowId, athlete, name, base, baseVer, startDate, loadedAt }
var PE_DN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function peEsc(x) { return typeof escHtml === 'function' ? escHtml(String(x == null ? '' : x)) : String(x == null ? '' : x); }
function peClone(x) { return JSON.parse(JSON.stringify(x)); }
function peParse(pb) { try { return typeof pb === 'string' ? JSON.parse(pb) : pb; } catch (e) { return null; } }
function peRefresh() {
  if (typeof pbRenderWeekTabs === 'function') pbRenderWeekTabs();
  if (typeof pbRenderDayGrid === 'function') pbRenderDayGrid();
  if (PB_ACTIVE_DAY && PB_STATE.weekData[PB_ACTIVE_DAY.weekIdx] && PB_STATE.weekData[PB_ACTIVE_DAY.weekIdx].days[PB_ACTIVE_DAY.dayIdx]) pbOpenDay(PB_ACTIVE_DAY.weekIdx, PB_ACTIVE_DAY.dayIdx);
  else if (typeof pbCloseEditor === 'function') pbCloseEditor();
}

// ── Open an athlete's live program in the builder ──
async function peOpenLive(rowId) {
  var db = typeof getSupaClient === 'function' ? getSupaClient() : null;
  if (!db) { alert('Cloud not connected.'); return; }
  if (PE_LIVE && PE_LIVE.rowId !== String(rowId) && peDirty() && !confirm('You have unsaved changes to ' + PE_LIVE.athlete + '\'s program. Discard them?')) return;
  if (!PE_LIVE && PB_STATE.weekData && PB_STATE.weekData.length && !confirm('Open this athlete\'s live program in the builder?\n\nWhat\'s in the builder now stays in auto-save and My Programs.')) return;
  var r = await db.from('athlete_programs').select('id,athlete,name,pb_state,completion_log,updated_at').eq('id', String(rowId)).maybeSingle();
  if (r.error || !r.data) { alert('Couldn\'t load that program: ' + ((r.error && r.error.message) || 'not found')); return; }
  var pb = peParse(r.data.pb_state);
  if (!pb || !pb.weekData || !pb.weekData.length) { alert('That program has no weeks to edit.'); return; }
  var st = TC.ensureUids(peClone(pb));
  st.athlete = r.data.athlete;
  st.phase = st.phase || (typeof PB_STATE !== 'undefined' && PB_STATE.phase) || 'accumulation';
  st.weekData.forEach(function (wk, i) { wk.week = wk.week || i + 1; wk.progMod = wk.progMod || { sets: 1, reps: 1, load: 1 }; if (wk.isDeload === undefined) wk.isDeload = false; if (wk.label === undefined) wk.label = ''; (wk.days || []).forEach(function (d) { d.blocks = d.blocks || []; if (d.label === undefined) d.label = ''; d.type = d.type || (TC.dayHasWork(d) ? 'lift' : 'off'); }); });
  // Open on the week he's in now
  var wkNow = 0;
  if (st.startDate) { var t = TC.localISO(); st.weekData.forEach(function (wk, wi) { var d = TC.dayDate(st, wi, 0); if (d) { var s = TC.localISO(d); var e = new Date(d); e.setDate(e.getDate() + 6); if (t >= s && t <= TC.localISO(e)) wkNow = wi; } }); }
  st.activeWeek = wkNow;
  PE_LIVE = { rowId: String(r.data.id), athlete: r.data.athlete, name: r.data.name || '', base: peClone(st), baseVer: pb.structVer || 0, startDate: st.startDate || '', loadedAt: r.data.updated_at, log: r.data.completion_log || {} };
  PB_STATE = peClone(st);             // set first so Program Builder doesn't offer an auto-save restore
  var nb = [].find.call(document.querySelectorAll('.nav-btn'), function (b) { return /Program Builder/.test(b.textContent); });
  if (typeof switchTab === 'function') switchTab('program', nb);
  if (typeof pbSetMode === 'function') pbSetMode('athlete');
  var sel = document.getElementById('pb-athlete'); if (sel) sel.value = r.data.athlete;
  PB_STATE = peClone(st);
  PB_LOADED_PROGRAM_ID = null; delete PB_STATE._savedProgId;
  var nm = document.getElementById('pb-program-name'); if (nm) nm.value = PE_LIVE.name;
  var ph = document.getElementById('pb-phase'); if (ph && st.phase) ph.value = st.phase;
  PB_ACTIVE_DAY = null;
  if (typeof pbCollapseSetup === 'function') pbCollapseSetup();
  peRefresh();
  peRenderBar();
  if (typeof showStatus === 'function') showStatus('✏️ Editing ' + r.data.athlete + '\'s live program — save sends it to his phone');
}
function peDirty() { return !!(PE_LIVE && peChanges().length); }
function peChanges() {
  if (!PE_LIVE) return [];
  var cur = TC.ensureUids(peClone(PB_STATE));
  var ch = TC.buildRemap(PE_LIVE.base, cur).changes;
  var sd = (document.getElementById('pe-start') || {}).value;
  if (sd && sd !== (PE_LIVE.startDate || '')) ch.unshift({ wi: null, di: null, text: 'Start date → ' + (typeof fmtDate === 'function' ? fmtDate(sd) : sd) + ' (every day shifts)' });
  return ch;
}

// ── Live bar ──
function peRenderBar() {
  var bar = document.getElementById('pe-bar');
  var onBuilder = typeof currentPage === 'undefined' || currentPage === 'program';
  if (!PE_LIVE || !onBuilder) { if (bar) bar.style.display = 'none'; document.body.style.paddingBottom = ''; return; }
  if (!bar) {
    bar = document.createElement('div'); bar.id = 'pe-bar';
    bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:900;background:rgba(15,23,42,0.97);border-top:2px solid #f59e0b;box-shadow:0 -8px 30px rgba(0,0,0,.45);padding:10px 16px;';
    document.body.appendChild(bar);
  }
  bar.style.display = 'block'; document.body.style.paddingBottom = '96px';
  var n = peChanges().length;
  bar.innerHTML = '<div style="max-width:1400px;margin:0 auto;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">'
    + '<div style="flex:1;min-width:220px;"><div style="font-size:12px;font-weight:800;color:#f59e0b;letter-spacing:.3px;">✏️ LIVE PROGRAM — ' + peEsc(PE_LIVE.athlete) + '</div>'
    + '<div style="font-size:11px;color:var(--text2);">' + peEsc(PE_LIVE.name) + ' · only his copy changes · his logs stay with each exercise</div></div>'
    + '<label style="font-size:10px;color:var(--text3);display:flex;flex-direction:column;gap:2px;">Week 1 starts<input id="pe-start" type="date" value="' + peEsc(PE_LIVE.startDate) + '" onchange="peRenderBar()" style="background:var(--bg3);border:1px solid var(--border);border-radius:5px;padding:4px 6px;color:var(--text);font-size:11px;"></label>'
    + '<label style="font-size:10px;color:var(--text3);display:flex;flex-direction:column;gap:2px;flex:1;min-width:180px;max-width:320px;">Note to him (optional)<input id="pe-note" type="text" value="' + peEsc((document.getElementById('pe-note') || {}).value || '') + '" placeholder="e.g. Moved lift to Thu for the travel day" style="background:var(--bg3);border:1px solid var(--border);border-radius:5px;padding:5px 7px;color:var(--text);font-size:11px;"></label>'
    + '<button onclick="pePreview()" style="padding:8px 12px;background:rgba(255,255,255,.05);border:1px solid var(--border2);border-radius:7px;color:' + (n ? '#fbbf24' : 'var(--text3)') + ';font-size:12px;font-weight:600;cursor:pointer;">' + (n ? n + ' change' + (n === 1 ? '' : 's') : 'No changes yet') + '</button>'
    + '<button id="pe-save" onclick="peLiveSave()" ' + (n ? '' : 'disabled ') + 'style="padding:9px 16px;background:' + (n ? '#f59e0b' : 'rgba(245,158,11,.25)') + ';border:none;border-radius:7px;color:#111;font-size:12px;font-weight:800;cursor:' + (n ? 'pointer' : 'default') + ';">💾 Save to ' + peEsc(PE_LIVE.athlete.split(' ')[0]) + '\'s phone</button>'
    + '<button onclick="peClose()" title="Stop editing this live program" style="padding:8px 10px;background:transparent;border:1px solid var(--border2);border-radius:7px;color:var(--text3);font-size:12px;cursor:pointer;">Close</button>'
    + '</div>';
}
function pePreview() {
  var ch = peChanges();
  var m = document.createElement('div');
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;';
  m.innerHTML = '<div style="background:var(--bg2);border:1px solid var(--border2);border-radius:12px;padding:18px;max-width:560px;width:100%;max-height:80vh;overflow:auto;">'
    + '<div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:4px;">Changes for ' + peEsc(PE_LIVE.athlete) + '</div>'
    + '<div style="font-size:11px;color:var(--text3);margin-bottom:12px;">He\'ll see these in a banner when he opens his program, and changed days are marked.</div>'
    + (ch.length ? ch.map(function (c) { return '<div style="font-size:12px;color:var(--text2);padding:6px 0;border-bottom:1px solid var(--border);line-height:1.45;">' + peEsc(c.text) + '</div>'; }).join('') : '<div style="color:var(--text3);font-size:12px;">No changes yet.</div>')
    + '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;"><button id="pe-pv-close" style="padding:8px 14px;background:transparent;border:1px solid var(--border2);border-radius:7px;color:var(--text2);cursor:pointer;">Close</button></div></div>';
  document.body.appendChild(m);
  m.querySelector('#pe-pv-close').onclick = function () { m.remove(); };
  m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
}
function peClose(force) {
  if (!force && peDirty() && !confirm('Close without saving your changes to ' + PE_LIVE.athlete + '\'s program?')) return;
  PE_LIVE = null; peRenderBar();
}

// Writes a changed program to one athlete's row, moving his logs to match.
// Used by the live editor and by re-sending from the master program.
async function peWriteProgram(db, rowId, newSt, opts) {
  opts = opts || {};
  var r = await db.from('athlete_programs').select('pb_state,completion_log').eq('id', String(rowId)).maybeSingle();
  if (r.error) throw r.error;
  var cloud = r.data ? peParse(r.data.pb_state) : null;
  var oldSt = opts.base && cloud && (cloud.structVer || 0) === (opts.baseVer || 0) ? opts.base : cloud;
  TC.ensureUids(newSt);
  var rm = oldSt ? TC.buildRemap(oldSt, newSt) : { dayMap: {}, exMap: {}, changes: [] };
  var moved = Object.keys(rm.dayMap).length + Object.keys(rm.exMap).length;
  var ver = ((cloud && cloud.structVer) || 0) + (moved ? 1 : 0);
  newSt.structVer = ver;
  newSt.remaps = ((cloud && cloud.remaps) || []).slice(-19);
  if (moved) newSt.remaps.push({ v: ver, dayMap: rm.dayMap, exMap: rm.exMap });
  if (cloud) {   // keep what lives on the athlete's copy
    newSt.messages = cloud.messages || [];
    if (cloud.speedSummary) newSt.speedSummary = cloud.speedSummary;
    if (cloud.profile) newSt.profile = cloud.profile;
  }
  var changes = (opts.extraChanges || []).concat(rm.changes);
  if (cloud && cloud.startDate && newSt.startDate && cloud.startDate !== newSt.startDate) changes.unshift({ wi: null, di: null, text: 'Schedule moved — Week 1 now starts ' + (typeof fmtDate === 'function' ? fmtDate(newSt.startDate) : newSt.startDate) });
  if (opts.note) newSt.messages = (newSt.messages || []).concat([{ at: new Date().toISOString(), text: opts.note, ref: null }]);
  if (changes.length) newSt.lastChange = { at: new Date().toISOString(), items: changes.slice(0, 30), by: opts.by || 'edit' };
  var upd = Object.assign({}, opts.fields || {}, { pb_state: JSON.stringify(newSt), updated_at: new Date().toISOString() });
  if (opts.name) upd.name = opts.name;
  var log = r.data && r.data.completion_log;
  if (moved && log && Object.keys(log).length) upd.completion_log = TC.applyRemap(log, rm, ver);
  if (!r.data && opts.insert) { var ins = Object.assign({ id: String(rowId) }, opts.insert, upd); var x = await db.from('athlete_programs').upsert(ins, { onConflict: 'id' }); if (x.error) throw x.error; }
  else { var u = await db.from('athlete_programs').update(upd).eq('id', String(rowId)); if (u.error) throw u.error; }
  return { st: newSt, changes: changes, ver: ver, movedLogs: !!upd.completion_log, log: upd.completion_log || log || {} };
}

async function peLiveSave() {
  if (!PE_LIVE) return;
  var db = getSupaClient(); if (!db) { alert('Cloud not connected.'); return; }
  var btn = document.getElementById('pe-save'); if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  try {
    var cur = await db.from('athlete_programs').select('pb_state').eq('id', PE_LIVE.rowId).maybeSingle();
    var cloud = cur.data ? peParse(cur.data.pb_state) : null;
    if (cloud && (cloud.structVer || 0) !== PE_LIVE.baseVer && !confirm(PE_LIVE.athlete + '\'s program was changed somewhere else since you opened it (probably re-sent from the master program).\n\nOK = save your version over it (his logs still move to match)\nCancel = keep his current version')) { peRenderBar(); return; }
    var prep = typeof prepareForAthlete === 'function' ? prepareForAthlete(PB_STATE, PE_LIVE.athlete) : { st: pbComputeLoadsForAthlete(PB_STATE, PE_LIVE.athlete), notes: [] };
    var st = prep.st;
    ['activeWeek', '_savedProgId'].forEach(function (k) { delete st[k]; });
    st.athlete = PE_LIVE.athlete;
    var sd = (document.getElementById('pe-start') || {}).value || PE_LIVE.startDate || '';
    var extra = [];
    st.startDate = sd || st.startDate || null;
    st.liveEdited = { at: new Date().toISOString() };
    if (cloud) { ['pushNote', 'sourceProgramId'].forEach(function (k) { if (cloud[k] && !st[k]) st[k] = cloud[k]; }); }
    var note = ((document.getElementById('pe-note') || {}).value || '').trim();
    var res = await peWriteProgram(db, PE_LIVE.rowId, st, { base: PE_LIVE.base, baseVer: PE_LIVE.baseVer, note: note, extraChanges: extra, by: 'edit' });
    // Keep My Programs' assigned copy in step
    var copy = (SAVED_PROGRAMS || []).find(function (p) { return String(p.id) === PE_LIVE.rowId && p.isAssigned; });
    if (copy) { copy.pbState = peClone(res.st); if (sd) copy.assignedDate = sd; if (typeof persistPrograms === 'function') persistPrograms(); }
    var n = res.changes.length;
    PE_LIVE.base = TC.ensureUids(peClone(res.st)); PE_LIVE.baseVer = res.ver; PE_LIVE.log = res.log; PE_LIVE.startDate = res.st.startDate || '';
    PB_STATE = peClone(res.st); PB_STATE.activeWeek = Math.min(PB_STATE.activeWeek || 0, PB_STATE.weekData.length - 1);
    var ne = document.getElementById('pe-note'); if (ne) ne.value = '';
    if (typeof loadProgramRows === 'function') loadProgramRows();
    peRefresh(); peRenderBar();
    if (typeof showStatus === 'function') showStatus('✅ ' + PE_LIVE.athlete + '\'s program updated — ' + n + ' change' + (n === 1 ? '' : 's') + (res.movedLogs ? ' · his logs moved to match' : '') + (prep.notes && prep.notes.length ? ' · ' + prep.notes.join(' · ') : ''));
  } catch (e) { alert('Save failed: ' + (e.message || e)); peRenderBar(); }
}

// ── Day tools (in the day editor) ──
function peDayContentKeys(d) { return Object.keys(d).filter(function (k) { return k !== 'day'; }); }
function peSwapDays(a, b) {
  var keys = {}; peDayContentKeys(a).concat(peDayContentKeys(b)).forEach(function (k) { keys[k] = 1; });
  Object.keys(keys).forEach(function (k) { var t = a[k]; if (b[k] === undefined) delete a[k]; else a[k] = b[k]; if (t === undefined) delete b[k]; else b[k] = t; });
}
function peBlankDay(name) { return { day: name, type: 'off', label: 'Rest', blocks: [], uid: TC.newUid() }; }
function peLogged(wi, di) {
  if (!PE_LIVE) return false;
  var d = PB_STATE.weekData[wi].days[di], base = PE_LIVE.base, pos = null;
  base.weekData.forEach(function (wk, w) { wk.days.forEach(function (x, i) { if (x.uid === d.uid) pos = w + '-' + i; }); });
  if (!pos) return false;
  return Object.keys(PE_LIVE.log || {}).some(function (k) { var v = PE_LIVE.log[k]; return v && v.done && (k === 'day:' + pos || k.indexOf(pos + '-') === 0); });
}
function peMoveDay(target) {
  if (!PB_ACTIVE_DAY || !target) return;
  var p = target.split('-'), tw = +p[0], td = +p[1];
  var wi = PB_ACTIVE_DAY.weekIdx, di = PB_ACTIVE_DAY.dayIdx;
  var a = PB_STATE.weekData[wi].days[di], b = PB_STATE.weekData[tw].days[td];
  var bWork = TC.dayHasWork(b);
  if (bWork && !confirm('Wk ' + (tw + 1) + ' ' + b.day + ' already has "' + (b.label || 'a session') + '". Swap the two days?')) return;
  peSwapDays(a, b);
  PB_STATE.activeWeek = tw; PB_ACTIVE_DAY = { weekIdx: tw, dayIdx: td };
  peRefresh(); peRenderBar();
  if (typeof showStatus === 'function') showStatus('↔ ' + (bWork ? 'Swapped' : 'Moved') + ' to Wk ' + (tw + 1) + ' ' + b.day);
}
function peRestDay() {
  if (!PB_ACTIVE_DAY) return;
  var wi = PB_ACTIVE_DAY.weekIdx, di = PB_ACTIVE_DAY.dayIdx, d = PB_STATE.weekData[wi].days[di];
  if (!TC.dayHasWork(d)) return;
  if (!confirm('Make Wk ' + (wi + 1) + ' ' + d.day + ' a rest day? Its exercises are removed' + (peLogged(wi, di) ? ' — he already logged some of this day; those logs are kept in his history' : '') + '.\n\nTip: use "Push rest of week back" to keep the session and shift it instead.')) return;
  d.type = 'off'; d.label = 'Rest'; d.blocks = []; delete d.sessions;
  peRefresh(); peRenderBar();
}
// Shift this day and the following ones back one day, up to the next rest day
function pePushBack() {
  if (!PB_ACTIVE_DAY) return;
  var wi = PB_ACTIVE_DAY.weekIdx, di = PB_ACTIVE_DAY.dayIdx, wk = PB_STATE.weekData[wi];
  var flat = [];   // this week then next week, so a Sunday session can roll into Monday
  [wi, wi + 1].forEach(function (w) { if (PB_STATE.weekData[w]) PB_STATE.weekData[w].days.forEach(function (d, i) { flat.push({ w: w, i: i, d: d }); }); });
  var start = flat.findIndex(function (x) { return x.w === wi && x.i === di; });
  var gap = -1;
  for (var k = start + 1; k < flat.length; k++) { if (!TC.dayHasWork(flat[k].d)) { gap = k; break; } }
  if (gap < 0) { alert('There\'s no rest day after ' + wk.days[di].day + ' to absorb the shift. Make a later day a rest day, or use "Move / swap".'); return; }
  var moved = gap - start;
  if (!confirm('Push ' + wk.days[di].day + (moved > 1 ? ' and the next ' + (moved - 1) + ' day' + (moved > 2 ? 's' : '') : '') + ' back one day? ' + flat[gap].d.day + (flat[gap].w !== wi ? ' (next week)' : '') + ' is the rest day that absorbs it, and ' + wk.days[di].day + ' becomes a rest day.')) return;
  for (var j = gap; j > start; j--) peSwapDays(flat[j].d, flat[j - 1].d);
  var blank = peBlankDay(flat[start].d.day); peDayContentKeys(flat[start].d).forEach(function (k2) { delete flat[start].d[k2]; }); Object.assign(flat[start].d, blank);
  PB_ACTIVE_DAY = { weekIdx: flat[start + 1].w, dayIdx: flat[start + 1].i }; PB_STATE.activeWeek = flat[start + 1].w;
  peRefresh(); peRenderBar();
  if (typeof showStatus === 'function') showStatus('⏭ Pushed back one day');
}
function peDayToolsHTML(wi, di) {
  var d = PB_STATE.weekData[wi].days[di];
  var opts = '<option value="">↔ Move / swap to…</option>';
  PB_STATE.weekData.forEach(function (wk, w) {
    opts += '<optgroup label="Week ' + (w + 1) + '">' + wk.days.map(function (x, i) {
      if (w === wi && i === di) return '';
      return '<option value="' + w + '-' + i + '">Wk ' + (w + 1) + ' ' + x.day + (TC.dayHasWork(x) ? ' — ' + peEsc(x.label || 'session') + ' (swap)' : ' — rest') + '</option>';
    }).join('') + '</optgroup>';
  });
  var date = PB_STATE.startDate || (PE_LIVE && PE_LIVE.startDate);
  var dd = date ? TC.dayDate({ startDate: date, weekData: PB_STATE.weekData }, wi, di) : null;
  var btn = 'padding:5px 10px;background:rgba(255,255,255,0.04);border:1px solid var(--border2);border-radius:6px;color:var(--text2);font-size:11px;cursor:pointer;';
  return '<div id="pe-day-tools" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:8px 10px;margin-bottom:10px;border-radius:8px;background:rgba(245,158,11,0.05);border:1px solid rgba(245,158,11,0.2);">'
    + '<span style="font-size:10px;font-weight:700;color:#f59e0b;letter-spacing:.5px;margin-right:4px;">📅 SCHEDULE' + (dd ? ' · ' + dd.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '') + (peLogged(wi, di) ? ' · <span style="color:var(--green);">logged</span>' : '') + '</span>'
    + '<select onchange="peMoveDay(this.value)" style="background:var(--bg3);border:1px solid var(--border2);border-radius:6px;padding:5px 7px;color:var(--text);font-size:11px;max-width:230px;">' + opts + '</select>'
    + (TC.dayHasWork(d) ? '<button onclick="pePushBack()" style="' + btn + '" title="Shift this session and the following ones back a day, up to the next rest day">⏭ Push rest of week back</button>'
      + '<button onclick="peRestDay()" style="' + btn + 'color:#fca5a5;">😴 Make rest day</button>' : '')
    + '</div>';
}

// ── Week tools ──
function peWeekToolsHTML() {
  var btn = 'text-align:left;padding:8px 10px;background:transparent;border:none;border-radius:6px;color:var(--text2);font-size:12px;cursor:pointer;';
  return '<details id="pe-week-tools" style="position:relative;display:inline-block;"><summary style="list-style:none;cursor:pointer;padding:5px 10px;border:1px dashed rgba(167,139,250,0.5);border-radius:6px;color:#a78bfa;font-size:11px;font-weight:600;">＋ Week ▾</summary>'
    + '<div style="position:absolute;left:0;top:calc(100% + 4px);z-index:60;background:var(--bg2);border:1px solid var(--border2);border-radius:8px;padding:6px;display:flex;flex-direction:column;gap:2px;min-width:240px;box-shadow:0 10px 30px rgba(0,0,0,.4);">'
    + '<button onclick="peDupWeek()" style="' + btn + '">⧉ Duplicate Week ' + ((PB_STATE.activeWeek || 0) + 1) + ' right after it</button>'
    + '<button onclick="peAddWeek(false)" style="' + btn + '">＋ Add a blank week at the end</button>'
    + '<button onclick="peAddWeek(true)" style="' + btn + '">↳ Insert a blank week before Week ' + ((PB_STATE.activeWeek || 0) + 1) + '</button>'
    + (PB_STATE.weekData.length > 1 ? '<button onclick="peRemoveWeek()" style="' + btn + 'color:var(--red);">🗑 Remove Week ' + ((PB_STATE.activeWeek || 0) + 1) + '</button>' : '')
    + '</div></details>';
}
function peRenumber() { PB_STATE.weekData.forEach(function (wk, i) { wk.week = i + 1; }); PB_STATE.weeks = PB_STATE.weekData.length; }
function peStripUids(x) { (x.days || []).forEach(function (d) { delete d.uid; (d.blocks || []).forEach(function (b) { (b.exercises || []).forEach(function (e) { if (e) delete e.uid; }); }); }); return x; }
function peBlankWeek() {
  var names = (PB_STATE.weekData[0] || { days: [] }).days.map(function (d) { return d.day; });
  if (!names.length) names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return { week: 0, isDeload: false, label: '', progMod: { sets: 1, reps: 1, load: 1 }, days: names.map(function (n) { return peBlankDay(n); }) };
}
function peDupWeek() {
  var i = PB_STATE.activeWeek || 0;
  PB_STATE.weekData.splice(i + 1, 0, peStripUids(peClone(PB_STATE.weekData[i])));
  peRenumber(); PB_STATE.activeWeek = i + 1; PB_ACTIVE_DAY = null; TC.ensureUids(PB_STATE);
  peRefresh(); peRenderBar();
  if (typeof showStatus === 'function') showStatus('⧉ Week ' + (i + 1) + ' duplicated — later weeks move back one week');
}
function peAddWeek(before) {
  var i = PB_STATE.activeWeek || 0, at = before ? i : PB_STATE.weekData.length;
  PB_STATE.weekData.splice(at, 0, peBlankWeek());
  peRenumber(); PB_STATE.activeWeek = at; PB_ACTIVE_DAY = null;
  peRefresh(); peRenderBar();
}
function peRemoveWeek() {
  var i = PB_STATE.activeWeek || 0;
  if (PB_STATE.weekData.length < 2) return;
  if (!confirm('Remove Week ' + (i + 1) + '? Later weeks move up one week' + (PE_LIVE ? ' (his logs for this week stay in his history)' : '') + '.')) return;
  PB_STATE.weekData.splice(i, 1);
  peRenumber(); PB_STATE.activeWeek = Math.min(i, PB_STATE.weekData.length - 1); PB_ACTIVE_DAY = null;
  peRefresh(); peRenderBar();
}

// ── Live programs picker (builder left panel) ──
function peRenderPicker() {
  var host = document.getElementById('pe-picker');
  if (!host) {
    var anchor = document.getElementById('pb-program-name'); var card = anchor && anchor.closest('.card');
    if (!card || !card.parentNode) return;
    host = document.createElement('div'); host.id = 'pe-picker'; host.className = 'card';
    host.style.cssText = 'padding:14px;border-color:rgba(245,158,11,0.35);';
    card.parentNode.insertBefore(host, card);
  }
  var rows = (typeof PROGRAM_ROWS !== 'undefined' ? PROGRAM_ROWS : []).slice().sort(function (a, b) { return a.athlete.localeCompare(b.athlete) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')); });
  host.innerHTML = '<div class="card-title" style="margin-bottom:6px;">✏️ EDIT A LIVE PROGRAM</div>'
    + '<div style="font-size:10px;color:var(--text3);margin-bottom:8px;line-height:1.5;">Change one athlete\'s program — move days, add blocks or weeks. It updates on his phone and his logs stay put.</div>'
    + (rows.length ? '<div style="display:flex;gap:6px;"><select id="pe-pick" style="flex:1;min-width:0;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:6px 7px;color:var(--text);font-size:11px;">'
      + rows.map(function (r) { return '<option value="' + peEsc(r.id) + '"' + (PE_LIVE && PE_LIVE.rowId === r.id ? ' selected' : '') + '>' + peEsc(r.athlete) + ' — ' + peEsc(r.name || 'Program') + '</option>'; }).join('')
      + '</select><button onclick="peOpenLive(document.getElementById(\'pe-pick\').value)" style="padding:6px 12px;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.45);border-radius:6px;color:#f59e0b;font-size:11px;font-weight:700;cursor:pointer;">Open</button></div>'
      : '<div style="font-size:11px;color:var(--text3);">No programs sent yet.</div>');
}

// ── Hooks ──
(function () {
  if (typeof document === 'undefined') return;
  // Every exercise and day gets a stable id as the builder renders
  if (typeof pbRenderDayGrid === 'function') {
    var _g = pbRenderDayGrid;
    pbRenderDayGrid = function () { if (PB_STATE && PB_STATE.weekData && PB_STATE.weekData.length) TC.ensureUids(PB_STATE); var x = _g.apply(this, arguments); if (PE_LIVE) peRenderBar(); return x; };
  }
  if (typeof pbOpenDay === 'function') {
    var _o = pbOpenDay;
    pbOpenDay = function (wi, di) {
      var x = _o.apply(this, arguments);
      try { var ed = document.getElementById('pb-session-editor'); var old = document.getElementById('pe-day-tools'); if (old) old.remove(); if (ed && PB_STATE.weekData[wi]) ed.insertAdjacentHTML('afterbegin', peDayToolsHTML(wi, di)); } catch (e) { console.warn('[pe day tools]', e); }
      if (PE_LIVE) peRenderBar();
      return x;
    };
  }
  if (typeof pbRenderWeekTabs === 'function') {
    var _w = pbRenderWeekTabs;
    pbRenderWeekTabs = function () { var x = _w.apply(this, arguments); var t = document.getElementById('pb-week-tabs'); if (t && PB_STATE.weekData && PB_STATE.weekData.length) t.insertAdjacentHTML('beforeend', peWeekToolsHTML()); return x; };
  }
  if (typeof switchTab === 'function') {
    var _s = switchTab;
    switchTab = function (page) { var x = _s.apply(this, arguments); try { peRenderBar(); if (page === 'program') peRenderPicker(); } catch (e) {} return x; };
  }
  if (typeof loadProgramRows === 'function') {
    var _l = loadProgramRows;
    loadProgramRows = function () { var p = _l.apply(this, arguments); Promise.resolve(p).then(function () { try { peRenderPicker(); } catch (e) {} }); return p; };
  }
  // "Save & Send" while editing a live program → offer to save to that athlete
  if (typeof pbAssignAndPush === 'function') {
    var _a = pbAssignAndPush;
    pbAssignAndPush = function () {
      if (PE_LIVE && confirm('You\'re editing ' + PE_LIVE.athlete + '\'s live program.\n\nOK = save these changes to his phone\nCancel = send this as a new program instead')) return peLiveSave();
      if (PE_LIVE) peClose(true);
      return _a.apply(this, arguments);
    };
  }
  // Opening an assigned copy from My Programs → edit it live
  if (typeof loadProgToBuilder === 'function') {
    var _p = loadProgToBuilder;
    loadProgToBuilder = function (id) {
      var prog = (SAVED_PROGRAMS || []).find(function (p) { return String(p.id) === String(id); });
      if (prog && prog.isAssigned && confirm('This is ' + (prog.assignedTo || prog.athlete) + '\'s copy. Edit his live program? Saving updates his phone.\n\nOK = edit live · Cancel = open as a new program')) return peOpenLive(prog.id);
      return _p.apply(this, arguments);
    };
  }
  window.addEventListener('beforeunload', function (e) { if (peDirty()) { e.preventDefault(); e.returnValue = ''; } });
})();
