// ═══════════════════════════════════════════════════════════════════════════
// Calendar ← sent programs. Every training day of every live program (Supabase
// athlete_programs, the same rows the athlete's link reads) shows on the
// Calendar on its real date, from the program's "Week 1 starts" date — no
// manual scheduling needed. Done days get ✓, past undone days are flagged.
// ═══════════════════════════════════════════════════════════════════════════
var PCAL = { sig: '', byDate: {} };

function pcalBuild() {
  var rows = typeof PROGRAM_ROWS !== 'undefined' ? PROGRAM_ROWS : [];
  var sig = rows.map(function (r) { return r.id + ':' + r.updatedAt + ':' + r.logAt; }).join('|');
  if (sig === PCAL.sig) return PCAL.byDate;
  var by = {}, today = TC.localISO();
  rows.forEach(function (r) {
    var pb = r.pb; if (!pb || !pb.startDate || !pb.weekData) return;
    pb.weekData.forEach(function (wk, wi) {
      (wk.days || []).forEach(function (day, di) {
        if (!TC.dayHasWork(day)) return;
        var d = TC.dayDate(pb, wi, di); if (!d) return;
        var dk = TC.localISO(d), done = !!((r.log || {})['day:' + wi + '-' + di] || {}).done;
        (by[dk] = by[dk] || []).push({ rowId: r.id, athlete: r.athlete, name: r.name, wi: wi, di: di, label: day.label || day.day, done: done, missed: !done && dk < today });
      });
    });
  });
  PCAL = { sig: sig, byDate: by };
  return by;
}

(function () {
  if (typeof getEventsForDate !== 'function') return;
  var _g = getEventsForDate;
  getEventsForDate = function (dk) {
    var ev = _g.apply(this, arguments);
    try {
      var f = (document.getElementById('cal-athlete-filter') || {}).value || '';
      (pcalBuild()[dk] || []).forEach(function (p) {
        if (f && p.athlete !== f) return;
        var last = String(p.athlete).split(' ').slice(-1)[0];
        ev.push({ type: 'program', label: (p.done ? '✓ ' : p.missed ? '⏸ ' : '🏋️ ') + last + ' · ' + p.label, color: 'lift', data: p });
      });
    } catch (e) { console.warn('[program-calendar]', e); }
    return ev;
  };
  // Re-draw the calendar when live programs (re)load
  if (typeof loadProgramRows === 'function') {
    var _l = loadProgramRows;
    loadProgramRows = function () {
      var pr = _l.apply(this, arguments);
      Promise.resolve(pr).then(function () { try { if (typeof currentPage !== 'undefined' && currentPage === 'calendar' && typeof renderCalendar === 'function') renderCalendar(); } catch (e) {} });
      return pr;
    };
  }
  if (typeof switchTab === 'function') {
    var _s = switchTab;
    switchTab = function (page) {
      var r = _s.apply(this, arguments);
      if (page === 'calendar' && typeof PROGRAM_ROWS !== 'undefined' && !PROGRAM_ROWS.length && typeof loadProgramRows === 'function') loadProgramRows();
      return r;
    };
  }
})();

// Day-detail card for a program day
function pcalCardHTML(p) {
  var b = 'border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;';
  var st = p.done ? '<span style="color:var(--green);font-weight:700;">✓ Done</span>' : p.missed ? '<span style="color:#f59e0b;font-weight:700;">⏸ Not logged</span>' : '<span style="color:var(--text3);">Scheduled</span>';
  return '<div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.25);border-radius:var(--radius-sm);padding:12px;margin-bottom:8px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">'
    + '<div style="font-size:20px;">🏋️</div><div style="flex:1;min-width:160px;"><div style="font-weight:600;">' + escHtml(p.athlete) + ' · ' + escHtml(p.label) + '</div>'
    + '<div style="font-size:11px;color:var(--text2);">' + escHtml(p.name || 'Program') + ' · Week ' + (p.wi + 1) + ' · ' + st + '</div></div>'
    + '<div style="display:flex;gap:6px;">'
    + (typeof llShare === 'function' ? '<button onclick="llShare(\'' + p.rowId + '\')" style="' + b + 'background:#22c55e;border:none;color:#000;font-weight:700;">📲 Send</button>' : '')
    + (typeof llAthleteView === 'function' ? '<button onclick="llAthleteView(\'' + p.rowId + '\')" style="' + b + 'background:rgba(96,165,250,0.15);border:1px solid rgba(96,165,250,0.4);color:#60a5fa;">📱 Athlete view</button>' : '')
    + (typeof peOpenLive === 'function' ? '<button onclick="peOpenLive(\'' + p.rowId + '\')" style="' + b + 'background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.4);color:#f59e0b;">✏️ Live edit</button>' : '')
    + '</div></div>';
}

// ═══════════════════════════════════════════════════════════════════════════
// Player dashboard → 📅 Calendar tab: one athlete's month — his program days
// (✓ done / ⏸ not logged), workouts scheduled for him, and games.
// ═══════════════════════════════════════════════════════════════════════════
var PCAL_VIEW = { y: null, m: null, sel: null };

function pcalPlayerEvents(dk, name) {
  var ev = [];
  try {
    var games = (typeof GAME_SCHEDULE !== 'undefined' && GAME_SCHEDULE.length) ? GAME_SCHEDULE : (typeof CUBS_2026_SCHEDULE !== 'undefined' ? CUBS_2026_SCHEDULE : []);
    games.forEach(function (g) { if (g.date === dk) ev.push({ type: 'game', data: g }); });
    (typeof WORKOUT_SCHEDULE !== 'undefined' ? WORKOUT_SCHEDULE : []).forEach(function (w) { if (w.date === dk && (!w.athlete || w.athlete === name)) ev.push({ type: 'workout', data: w }); });
    (pcalBuild()[dk] || []).forEach(function (p) { if (p.athlete === name) ev.push({ type: 'program', data: p }); });
  } catch (e) { console.warn('[pcal]', e); }
  return ev;
}
function pcalShift(n) {
  if (n === 0) { var t = new Date(); PCAL_VIEW.y = t.getFullYear(); PCAL_VIEW.m = t.getMonth(); }
  else { var d = new Date(PCAL_VIEW.y, PCAL_VIEW.m + n, 1); PCAL_VIEW.y = d.getFullYear(); PCAL_VIEW.m = d.getMonth(); }
  renderPlayerCalendar();
}
function pcalPick(dk) { PCAL_VIEW.sel = dk; renderPlayerCalendar(); }

function renderPlayerCalendar() {
  var el = document.getElementById('pcal-body'); if (!el || typeof currentPlayer === 'undefined') return;
  if (PCAL_VIEW.y === null) { var t0 = new Date(); PCAL_VIEW.y = t0.getFullYear(); PCAL_VIEW.m = t0.getMonth(); }
  if (typeof PROGRAM_ROWS !== 'undefined' && !PROGRAM_ROWS.length && typeof loadProgramRows === 'function' && !renderPlayerCalendar._asked) { renderPlayerCalendar._asked = true; loadProgramRows(); }
  var name = currentPlayer, y = PCAL_VIEW.y, m = PCAL_VIEW.m, today = TC.localISO();
  var first = new Date(y, m, 1), lead = (first.getDay() + 6) % 7, nDays = new Date(y, m + 1, 0).getDate();
  var btn = 'padding:5px 11px;background:rgba(255,255,255,.05);border:1px solid var(--border2);border-radius:6px;color:var(--text2);font-size:12px;cursor:pointer;';
  var h = '<div class="card section-mb"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">'
    + '<span>📅 ' + escHtml(name.split(' ')[0].toUpperCase()) + '\'S CALENDAR · ' + first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase() + '</span>'
    + '<div style="display:flex;gap:6px;"><button style="' + btn + '" onclick="pcalShift(-1)">‹</button><button style="' + btn + '" onclick="pcalShift(0)">Today</button><button style="' + btn + '" onclick="pcalShift(1)">›</button></div></div>'
    + '<div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;margin-top:10px;">'
    + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(function (d) { return '<div style="font-size:10px;color:var(--text3);text-align:center;padding:2px 0;">' + d + '</div>'; }).join('');
  var counts = { done: 0, missed: 0, upcoming: 0 };
  for (var i = 0; i < lead; i++) h += '<div></div>';
  for (var d = 1; d <= nDays; d++) {
    var dk = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    var ev = pcalPlayerEvents(dk, name), chips = '';
    ev.forEach(function (e) {
      if (e.type === 'game') {
        var team = (typeof MLB_TEAMS !== 'undefined' && MLB_TEAMS[e.data.opponent]) || { abbr: String(e.data.opponent || '').split(' ').pop() };
        chips += '<div style="font-size:9px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (e.data.homeaway === 'Home' ? '🏠 vs ' : '✈️ @ ') + escHtml(team.abbr || '') + '</div>';
      } else if (e.type === 'program') {
        var p = e.data; counts[p.done ? 'done' : p.missed ? 'missed' : 'upcoming']++;
        var c = p.done ? 'rgba(34,197,94,0.18);color:#4ade80' : p.missed ? 'rgba(245,158,11,0.18);color:#f59e0b' : 'rgba(59,122,196,0.25);color:var(--cubs-light-blue)';
        chips += '<div style="font-size:10px;font-weight:600;padding:2px 4px;border-radius:3px;margin-top:2px;background:' + c + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (p.done ? '✓ ' : p.missed ? '⏸ ' : '🏋️ ') + escHtml(p.label) + '</div>';
      } else {
        var dt = (typeof DAY_TYPES !== 'undefined' && DAY_TYPES[e.data.sessionType]) || {};
        chips += '<div style="font-size:10px;padding:2px 4px;border-radius:3px;margin-top:2px;background:rgba(167,139,250,0.18);color:#c4b5fd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (dt.icon || '💪') + ' ' + escHtml(e.data.label || dt.label || e.data.sessionType || 'Workout') + '</div>';
      }
    });
    var isT = dk === today, isS = dk === PCAL_VIEW.sel;
    h += '<div onclick="pcalPick(\'' + dk + '\')" style="min-height:74px;padding:4px 5px;border-radius:6px;cursor:pointer;background:' + (isS ? 'rgba(59,122,196,0.12)' : 'var(--bg3)') + ';border:1px solid ' + (isT ? 'var(--cubs-light-blue)' : isS ? 'rgba(59,122,196,0.5)' : 'var(--border)') + ';">'
      + '<div style="font-size:11px;font-weight:' + (isT ? '800' : '600') + ';color:' + (isT ? 'var(--cubs-light-blue)' : 'var(--text2)') + ';">' + d + '</div>' + chips + '</div>';
  }
  h += '</div><div style="display:flex;gap:14px;flex-wrap:wrap;font-size:11px;color:var(--text3);margin-top:10px;">'
    + '<span><b style="color:#4ade80;">' + counts.done + '</b> done</span><span><b style="color:#f59e0b;">' + counts.missed + '</b> not logged</span><span><b style="color:var(--cubs-light-blue);">' + counts.upcoming + '</b> upcoming</span>'
    + '<span style="margin-left:auto;">Program days come from his sent programs\' Week 1 start date</span></div></div>';
  // Selected day detail
  if (PCAL_VIEW.sel) {
    var sd = PCAL_VIEW.sel, sev = pcalPlayerEvents(sd, name), dd = new Date(sd + 'T12:00:00');
    h += '<div class="card section-mb"><div class="card-title" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;"><span>' + dd.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase() + '</span>'
      + '<button onclick="pcalAddWorkout(\'' + sd + '\')" style="' + btn + 'color:var(--cubs-light-blue);">💪 Add Workout</button></div>';
    if (!sev.length) h += '<div style="color:var(--text3);font-size:12px;padding:8px 0;">Nothing scheduled.</div>';
    sev.forEach(function (e) {
      if (e.type === 'program') h += pcalCardHTML(e.data);
      else if (e.type === 'game') h += '<div style="padding:8px 0;font-size:12px;color:var(--text2);">⚾ ' + (e.data.homeaway === 'Home' ? 'vs ' : '@ ') + escHtml(e.data.opponent || '') + (e.data.time ? ' · ' + escHtml(e.data.time) : '') + '</div>';
      else {
        var dt2 = (typeof DAY_TYPES !== 'undefined' && DAY_TYPES[e.data.sessionType]) || {};
        h += '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;font-size:12px;">' + (dt2.icon || '💪') + ' <b>' + escHtml(e.data.label || dt2.label || 'Workout') + '</b><span style="color:var(--text3);">' + (e.data.athlete ? '' : 'All athletes') + '</span>'
          + '<button onclick="removeWorkout(' + JSON.stringify(e.data.id).replace(/"/g, '&quot;') + ');renderPlayerCalendar()" style="margin-left:auto;background:none;border:none;color:var(--red);cursor:pointer;">✕</button></div>';
      }
    });
    h += '</div>';
  }
  el.innerHTML = h;
}
function pcalAddWorkout(dk) {
  if (typeof openScheduleWorkoutModalForDate !== 'function') return;
  openScheduleWorkoutModalForDate(dk);
  setTimeout(function () { var a = document.getElementById('sw-athlete'); if (a) a.value = currentPlayer; }, 50);
}

(function () {
  function active() { var e = document.getElementById('dash-pcal'); return e && e.classList.contains('active'); }
  if (typeof switchDashTab === 'function') {
    var _sd = switchDashTab;
    switchDashTab = function (tab) {
      if (tab !== 'pcal') { var e = document.getElementById('dash-pcal'); if (e) { e.classList.remove('active'); e.classList.add('page'); e.style.display = 'none'; } }
      var r = _sd.apply(this, arguments);
      if (tab === 'pcal') { PCAL_VIEW.sel = null; renderPlayerCalendar(); }
      return r;
    };
  }
  if (typeof selectPlayer === 'function') {
    var _sp = selectPlayer;
    selectPlayer = function () { var r = _sp.apply(this, arguments); if (active()) { PCAL_VIEW.sel = null; renderPlayerCalendar(); } return r; };
  }
  if (typeof renderCalendar === 'function') {
    var _rc = renderCalendar;
    renderCalendar = function () { var r = _rc.apply(this, arguments); if (active()) renderPlayerCalendar(); return r; };
  }
  if (typeof loadProgramRows === 'function') {
    var _l2 = loadProgramRows;
    loadProgramRows = function () { var pr = _l2.apply(this, arguments); Promise.resolve(pr).then(function () { if (active()) renderPlayerCalendar(); }); return pr; };
  }
})();
