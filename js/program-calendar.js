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
    + (typeof llAthleteView === 'function' ? '<button onclick="llAthleteView(\'' + p.rowId + '\')" style="' + b + 'background:rgba(96,165,250,0.15);border:1px solid rgba(96,165,250,0.4);color:#60a5fa;">📱 Athlete view</button>' : '')
    + (typeof peOpenLive === 'function' ? '<button onclick="peOpenLive(\'' + p.rowId + '\')" style="' + b + 'background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.4);color:#f59e0b;">✏️ Live edit</button>' : '')
    + '</div></div>';
}
