// ═══════════════════════════════════════════════════════════════════════════
// Annual Plan revamp
//   • Live: reads every athlete's live program (athlete_programs via
//     PROGRAM_ROWS) — week-by-week position, logged completion, real
//     sets×reps / intensity — and auto-adds a block for a live program that
//     lands on open calendar weeks (resized as the program grows)
//   • Strength qualities: pick per block (tap = primary, tap again =
//     secondary, again = off); add your own qualities
//   • Notes: plan notes, block notes (shared) + coach-only notes, week notes
//   • 🖨 Print / PDF: athlete copy or coach copy, landscape, two half-seasons
// Loaded after annual-link.js; replaces renderAnnualPlan + the block modal.
// ═══════════════════════════════════════════════════════════════════════════

// ── Strength qualities (editable list, cloud-synced via cubs_sc_ key) ──
var AP_SQ_KEY = 'cubs_sc_annual_sq_v1';
var AP_SQ_DEFAULT = [
  { key: 'hyp',    label: 'Hypertrophy',            color: '#60a5fa' },
  { key: 'fhyp',   label: 'Functional Hypertrophy', color: '#818cf8' },
  { key: 'maxstr', label: 'Max Strength',           color: '#ef4444' },
  { key: 'relstr', label: 'Relative Strength',      color: '#a78bfa' },
  { key: 'ecc',    label: 'Eccentric Strength',     color: '#ec4899' },
  { key: 'strspd', label: 'Strength-Speed',         color: '#f97316' },
  { key: 'spdstr', label: 'Speed-Strength',         color: '#f59e0b' },
  { key: 'power',  label: 'Power / Reactive (SSC)', color: '#eab308' }
];
var AP_SQ_EXTRA_COLORS = ['#14b8a6', '#22c55e', '#06b6d4', '#f43f5e', '#84cc16', '#d946ef'];
var AP_BAND_MAP = { hypertrophy: 'hyp', fhyp: 'fhyp', relstr: 'relstr', power: 'power' };
var AP_SQ = (function () {
  var list = AP_SQ_DEFAULT.slice();
  try { (JSON.parse(localStorage.getItem(AP_SQ_KEY) || '[]') || []).forEach(function (q) { if (q && q.key && !list.some(function (x) { return x.key === q.key; })) list.push(q); }); } catch (e) {}
  return list;
})();
function apSaveSQ() { try { localStorage.setItem(AP_SQ_KEY, JSON.stringify(AP_SQ.filter(function (q) { return !AP_SQ_DEFAULT.some(function (d) { return d.key === q.key; }); }))); } catch (e) {} }
function apSQ(key) { return AP_SQ.find(function (q) { return q.key === key; }) || null; }
// A block's qualities: what was picked, else its phase type's quality band
function apBlockSQ(b) {
  if (!b) return {};
  if (b.sq && Object.keys(b.sq).length) return b.sq;
  var band = (BLOCK_TYPES[b.type] || {}).qualityBand, k = AP_BAND_MAP[band];
  var o = {}; if (k) o[k] = 1; return o;
}

// ── Small helpers ──
var AP_DAY = 864e5;
function apEsc(s) { return typeof escHtml === 'function' ? escHtml(String(s == null ? '' : s)) : String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function apD(iso) { var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
function apISO(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function apAdd(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
function apFmt(d) { return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''; }
function apAthlete() { return (document.getElementById('annual-athlete') || {}).value || ''; }
function apYear() { return parseInt((document.getElementById('annual-year') || {}).value || '2026'); }
function apPlan(create) { var k = annualPlanKey(); if (create && !ANNUAL_PLANS[k]) ANNUAL_PLANS[k] = { blocks: [] }; return ANNUAL_PLANS[k] || { blocks: [] }; }
function apSeasonLabel(y) { return y + '-' + String((y + 1) % 100).padStart(2, '0'); }

// ── Live programs (what's on the athlete's phone right now) ──
function apLiveRows(athlete) {
  return (typeof PROGRAM_ROWS !== 'undefined' ? PROGRAM_ROWS : []).filter(function (r) {
    return r && r.athlete === athlete && r.pb && r.pb.startDate && (r.pb.weekData || []).length;
  });
}
function apLiveSpan(r) { var s = apD(r.pb.startDate); return { start: s, end: apAdd(s, r.pb.weekData.length * 7 - 1), weeks: r.pb.weekData.length }; }
// Live program week covering a calendar week (newest program wins on overlap)
function apLiveFor(rows, ws) {
  var mid = apAdd(ws, 3), best = null;
  rows.forEach(function (r) {
    var s = apD(r.pb.startDate), idx = Math.floor((mid - s) / (7 * AP_DAY));
    if (idx < 0 || idx >= r.pb.weekData.length) return;
    if (!best || String(r.updatedAt || '') > String(best.row.updatedAt || '')) best = { row: r, idx: idx, wk: r.pb.weekData[idx] };
  });
  return best;
}
// Sessions logged / planned in one live week
function apLiveDone(row, wi) {
  var wk = row.pb.weekData[wi], planned = 0, done = 0, logged = {};
  if (typeof loggedDays === 'function') loggedDays(row).forEach(function (x) { logged[x[0] + '-' + x[1]] = 1; });
  (wk.days || []).forEach(function (d, di) {
    if (!(typeof TC !== 'undefined' ? TC.dayHasWork(d) : (d.blocks || []).length)) return;
    planned++; if (logged[wi + '-' + di]) done++;
  });
  return { planned: planned, done: done };
}
// Average sets×reps / %1RM across a week's lift days
function apWeekMetrics(wk) {
  if (!wk || !wk.days) return null;
  var s = 0, r = 0, n = 0, l = 0, ln = 0;
  wk.days.forEach(function (day) {
    if (day.type !== 'lift') return;
    (day.blocks || []).forEach(function (blk) {
      (blk.exercises || []).forEach(function (ex) {
        var sets = parseInt(ex.sets) || 0, reps = parseInt(ex.reps) || 0;
        if (sets && reps) { s += sets; r += reps; n++; }
        var m = String(ex.load || ex.pct || '').match(/(\d+)\s*%/); if (m) { l += parseInt(m[1]); ln++; }
      });
    });
  });
  return n ? { sets: Math.round(s / n), reps: Math.round(r / n), load: ln ? Math.round(l / ln) : null } : null;
}

// ── Auto-blocks: a live program on open weeks gets its own block ──
function apSyncLiveBlocks() {
  var athlete = apAthlete(), year = apYear(), rows = apLiveRows(athlete);
  if (!rows.length) return;
  var yStart = new Date(year, 10, 1), yEnd = new Date(year + 1, 9, 31);
  var plan = apPlan(true), changed = 0, added = [];
  rows.forEach(function (r) {
    var sp = apLiveSpan(r);
    if (sp.start < yStart || sp.start > yEnd) return;
    var mine = plan.blocks.find(function (b) { return String(b.liveRowId) === String(r.id); });
    var others = plan.blocks.filter(function (b) { return b !== mine; });
    var hits = function (a, z) { return others.some(function (b) { var bs = apD(b.startDate), be = apD(b.endDate); return bs && be && bs <= z && be >= a; }); };
    if (mine) {
      // Auto block follows the program as weeks are added / removed
      if (mine.auto && (mine.weeks !== sp.weeks || mine.startDate !== apISO(sp.start)) && !hits(sp.start, sp.end)) {
        mine.startDate = apISO(sp.start); mine.endDate = apISO(sp.end); mine.weeks = sp.weeks; changed++;
      }
      if (r.name && mine.linkedProgramName !== r.name) { mine.linkedProgramName = r.name; changed++; }
      return;
    }
    // A block already holds Week 1 → tag it as this program's block
    var holder = others.find(function (b) { var bs = apD(b.startDate), be = apD(b.endDate); return bs && be && sp.start >= bs && sp.start <= be && (!b.liveRowId); });
    if (holder) { holder.liveRowId = String(r.id); if (!holder.linkedProgramName) holder.linkedProgramName = r.name || ''; changed++; return; }
    if (hits(sp.start, sp.end)) return;   // partly overlaps a block — still shows in the Live row
    var ph = r.pb.phase, type = ph && BLOCK_TYPES[ph] ? ph : (new Date(sp.start).getMonth() >= 10 || new Date(sp.start).getMonth() <= 1 ? 'offseason' : 'inseason');
    var b = { id: 'blk_live_' + r.id, type: type, progression: r.pb.progression || 'linear', startDate: apISO(sp.start), endDate: apISO(sp.end),
              weeks: sp.weeks, notes: '', speed: [40, 30, 15, 10, 5], esd: [50, 30, 20], auto: true, liveRowId: String(r.id), linkedProgramName: r.name || '' };
    if (typeof alProg === 'function' && alProg(r.id)) b.linkedProgramId = String(r.id);
    plan.blocks.push(b); changed++; added.push(r.name || 'program');
  });
  if (changed) saveAnnualData();
  if (added.length && typeof showStatus === 'function') showStatus('📡 Added to Annual Plan from live programs: ' + added.join(', '));
}

// ── Model: one entry per calendar week ──
var _apLinkedMetrics = typeof annualGetLinkedWeekMetrics === 'function' ? annualGetLinkedWeekMetrics : null;
function apModel(athlete, year, plan) {
  var phases = getSeasonPhases(year), rows = apLiveRows(athlete), yStart = new Date(year, 10, 1), today = new Date(); today.setHours(0, 0, 0, 0);
  var blocks = (plan.blocks || []).map(function (b) { return { b: b, s: apD(b.startDate), e: apD(b.endDate) }; });
  var notes = plan.weekNotes || {}, weeks = [];
  for (var i = 0; i < 52; i++) {
    var ws = apAdd(yStart, i * 7), we = apAdd(ws, 6), iso = apISO(ws);
    var mid = apAdd(ws, 3);   // a block owns the calendar week its midpoint falls in (blocks start Mondays, the grid Nov 1)
    var bx = blocks.find(function (x) { return x.s && x.e && mid >= x.s && mid <= apAdd(x.e, 0); }), b = bx ? bx.b : null;
    var wkInBlock = b ? Math.floor((mid - bx.s) / (7 * AP_DAY)) + 1 : 0;
    var live = apLiveFor(rows, ws);
    var w = { i: i, ws: ws, we: we, iso: iso, b: b, cfg: b ? (BLOCK_TYPES[b.type] || {}) : null, wkInBlock: wkInBlock,
              phase: phases.find(function (p) { return ws >= p.start && ws <= p.end; }) || null,
              isToday: today >= ws && today <= we, past: we < today, note: notes[iso] || null, live: null, m: null, mSrc: '' };
    if (live) {
      var dn = apLiveDone(live.row, live.idx);
      w.live = { row: live.row, idx: live.idx, wk: live.wk, done: dn.done, planned: dn.planned, deload: !!live.wk.isDeload };
      var lm = apWeekMetrics(live.wk); if (lm) { w.m = lm; w.mSrc = 'live'; }
    }
    if (!w.m && b) {
      var real = null; try { real = _apLinkedMetrics ? _apLinkedMetrics(b, wkInBlock, ws) : null; } catch (e) {}
      if (real) { w.m = { sets: real.sets, reps: real.reps, load: real.load }; w.mSrc = 'linked'; }
    }
    if (b && !w.m) {
      var def = PHASE_DEFAULTS[b.type] || PHASE_DEFAULTS.inseason;
      var pm = typeof pbGetProgression === 'function' ? pbGetProgression(b.progression || 'linear', wkInBlock, b.weeks || 4, false) : { sets: 1, reps: 1, load: 1 };
      var proj = { sets: Math.round((def.sets ? def.sets[0] : 3) * pm.sets), reps: Math.round((def.repsLo || 8) * pm.reps), load: Math.round((def.loadStart || 70) * pm.load) };
      w.m = proj; w.mSrc = 'proj';
    }
    w.isDeload = w.live ? w.live.deload : !!(b && (b.type === 'restore' || (b.weeks === 4 && wkInBlock === 3) || (b.weeks === 6 && wkInBlock === 4)));
    weeks.push(w);
  }
  return { athlete: athlete, year: year, plan: plan, weeks: weeks, rows: rows };
}

// ── Grid HTML (screen + print share it) ──
// opts: { from, to, print, coach }
function apGridHTML(M, opts) {
  var W = M.weeks.slice(opts.from || 0, opts.to || 52), P = !!opts.print, coach = opts.coach !== false;
  var vr = (typeof ANNUAL_SETTINGS !== 'undefined' && ANNUAL_SETTINGS.visibleRows) || {};
  var show = function (k) { return P ? true : vr[k] !== false; };
  var td = function (w, inner, extra, click) {
    return '<td class="c' + (w.isToday ? ' today' : '') + '"' + (extra ? ' style="' + extra + '"' : '') + (click && !P ? ' onclick="' + click + '"' : '') + '>' + (inner || '') + '</td>';
  };
  var row = function (label, cells, cls) { return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td class="lbl">' + label + '</td>' + cells + '</tr>'; };
  var sec = function (label) { return '<tr class="sec"><td colspan="' + (W.length + 1) + '">' + label + '</td></tr>'; };
  var map = function (fn) { return W.map(fn).join(''); };

  // Month header
  var mh = '', cur = -1, span = 0, lab = '';
  W.forEach(function (w, i) {
    if (w.ws.getMonth() !== cur) { if (span) mh += '<th colspan="' + span + '">' + lab + '</th>'; cur = w.ws.getMonth(); span = 1; lab = w.ws.toLocaleDateString('en-US', { month: 'short' }); }
    else span++;
  });
  mh += '<th colspan="' + span + '">' + lab + '</th>';

  var h = '<table class="apg"><thead><tr><td class="lbl"></td>' + mh + '</tr></thead><tbody>';
  h += row('Week', map(function (w) { return td(w, (w.isToday ? '▼' : '') + (w.i + 1), '', '', ''); }), 'wk');
  h += row('Starts', map(function (w) { return td(w, (w.ws.getMonth() + 1) + '/' + w.ws.getDate()); }), 'dt');
  if (show('seasonPhase')) h += row('Season Phase', map(function (w) { return td(w, '', 'background:' + (w.phase ? w.phase.color : 'transparent') + ';padding:0;height:6px;'); }), 'thin');
  h += row('Block Phase', map(function (w) {
    var c = w.cfg, click = w.b ? "annualEditBlock('" + w.b.id + "')" : "annualAddBlockAt('" + w.iso + "')";
    if (!c) return td(w, P ? '' : '<span class="dim">+</span>', '', click);
    return td(w, w.isDeload ? 'DL' : (c.short || ''), 'background:' + c.color + (w.isDeload ? '44' : '26') + ';color:' + (P ? '#111' : c.color) + ';font-weight:700;box-shadow:inset 0 -2px 0 ' + c.color + ';', click);
  }));
  if (show('liveProgram')) h += row('📡 Live Program', map(function (w) {
    if (!w.live) return td(w, '');
    var L = w.live, pct = L.planned ? Math.round(L.done / L.planned * 100) : 0, col = w.cfg ? w.cfg.color : '#22c55e';
    var started = !(w.ws > new Date());
    var tip = apEsc(L.row.name) + ' · Week ' + (L.idx + 1) + (L.deload ? ' (deload)' : '') + (L.planned ? ' · ' + L.done + '/' + L.planned + ' sessions logged' : '');
    var bar = started && L.planned ? '<div class="bar"><i style="width:' + pct + '%;background:' + (pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444') + ';"></i></div>' : '';
    return '<td class="c live' + (w.isToday ? ' today' : '') + '" title="' + tip + '" style="color:' + (P ? '#111' : col) + ';">W' + (L.idx + 1) + bar + '</td>';
  }));
  if (show('linkedProgram') && !P) h += row('Linked Program', map(function (w) {
    if (!w.b) return td(w, '');
    var liveOn = !!(w.b.liveRowId && M.rows.some(function (r) { return String(r.id) === String(w.b.liveRowId); }));
    var stale = !liveOn && w.b.linkedProgramId && typeof alIsStale === 'function' && alIsStale(w.b, M.athlete);
    var ico = liveOn ? '📡' : stale ? '⚠️' : w.b.linkedProgramId ? '🔗' : '<span class="dim">＋</span>';
    return '<td class="c' + (w.isToday ? ' today' : '') + '" title="' + apEsc(liveOn ? 'Live: ' + (w.b.linkedProgramName || '') : stale ? 'Linked program was deleted — click to relink' : w.b.linkedProgramId ? 'Linked: ' + (w.b.linkedProgramName || '') : 'No program linked — click to link') + '" onclick="annualLinkProgramModal(\'' + w.b.id + '\')" style="cursor:pointer;">' + ico + '</td>';
  }));
  if (coach && show('method')) h += row('Method', map(function (w) {
    return td(w, w.b ? ({ linear: 'Lin', wave: 'Wave', dup: 'DUP', block: 'Blk' }[w.b.progression || 'linear'] || w.b.progression) : '', 'color:var(--ap-dim);');
  }));
  if (coach && show('repsIntensity')) {
    h += row('Sets × Reps', map(function (w) {
      if (!w.m) return td(w, '');
      var real = w.mSrc !== 'proj';
      return '<td class="c' + (w.isToday ? ' today' : '') + (real ? ' real' : ' proj') + '" title="' + (w.mSrc === 'live' ? 'From the live program' : w.mSrc === 'linked' ? 'From the linked program' : 'Projected — no program yet') + '">' + w.m.sets + '×' + w.m.reps + '</td>';
    }));
    h += row('Intensity %', map(function (w) {
      if (!w.m || w.m.load == null) return td(w, '');
      var l = w.m.load, col = l >= 90 ? '#ef4444' : l >= 80 ? '#f59e0b' : l >= 70 ? '#22c55e' : '#60a5fa', real = w.mSrc !== 'proj' && !w.mLoadProj;
      return '<td class="c' + (w.isToday ? ' today' : '') + (real ? ' real' : ' proj') + '" style="color:' + col + ';">' + l + '%</td>';
    }));
  }
  if (show('strengthQuality')) {
    var used = {};
    M.weeks.forEach(function (w) { if (w.b) Object.keys(apBlockSQ(w.b)).forEach(function (k) { used[k] = 1; }); });
    var list = AP_SQ.filter(function (q) { return used[q.key]; });
    if (!list.length && !P) list = AP_SQ.filter(function (q) { return ['hyp', 'maxstr', 'relstr', 'power'].indexOf(q.key) >= 0; });
    if (list.length) {
      h += sec('Strength Qualities <span class="hint">■ primary · ▬ secondary</span>');
      list.forEach(function (q) {
        h += row('<span style="color:' + q.color + ';">●</span> ' + apEsc(q.label), map(function (w) {
          var lv = w.b ? apBlockSQ(w.b)[q.key] : 0;
          return td(w, lv ? '<div class="sq" style="background:' + q.color + ';' + (lv === 2 ? 'height:4px;opacity:.55;' : '') + '"></div>' : '', 'padding:1px;');
        }));
      });
    }
  }
  var pctRows = function (title, quals, colors, field) {
    var out = sec(title);
    quals.forEach(function (q, qi) {
      out += row(q, map(function (w) {
        var p = w.b && w.b[field] ? (w.b[field][qi] || 0) : 0;
        return td(w, p > 0 ? '<div class="sq" style="background:' + colors[qi] + ';opacity:' + (0.3 + p / 100 * 0.7).toFixed(2) + ';width:' + p + '%;margin:auto;" title="' + p + '%"></div>' : '', 'padding:1px;');
      }));
    });
    return out;
  };
  if (show('speedEmphasis')) h += pctRows('Speed Emphasis', SPEED_QUALS, SPEED_COLORS, 'speed');
  if (show('esdEmphasis')) h += pctRows('ESD Emphasis', ESD_QUALS, ESD_COLORS, 'esd');
  if (show('notes')) {
    h += sec('Notes');
    h += row('📝 Week Notes', map(function (w) {
      var n = w.note && (coach || !w.note.coachOnly) ? w.note : null;
      return '<td class="c' + (w.isToday ? ' today' : '') + (n ? ' hasnote' : '') + '"' + (n ? ' title="' + apEsc(n.text) + '"' : ' title="Add a note for the week of ' + apFmt(w.ws) + '"') + (P ? '' : ' onclick="apEditWeekNote(\'' + w.iso + '\')"') + ' style="cursor:pointer;">'
        + (n ? (P ? '<b>' + (Object.keys(M.plan.weekNotes || {}).filter(function (k) { var x = M.plan.weekNotes[k]; return x && (coach || !x.coachOnly); }).sort().indexOf(w.iso) + 1) + '</b>' : (n.coachOnly ? '🔒' : '📝')) : (P ? '' : '<span class="dim">＋</span>')) + '</td>';
    }));
  }
  return h + '</tbody></table>';
}

// ── Screen styles (dark) ──
(function () {
  var css = '.apg{border-collapse:collapse;font-family:"DM Mono",monospace;--ap-dim:var(--text3);}'
    + '.apg th{border:1px solid rgba(255,255,255,.08);padding:3px;font-size:9px;font-weight:700;color:var(--text3);background:var(--bg2);}'
    + '.apg td{border:1px solid rgba(255,255,255,.06);text-align:center;white-space:nowrap;}'
    + '.apg td.lbl{position:sticky;left:0;z-index:2;background:var(--bg3);padding:4px 8px;font-size:10px;font-weight:600;color:var(--text3);text-align:right;min-width:130px;}'
    + '.apg td.c{min-width:var(--apw,30px);max-width:var(--apw,30px);padding:3px 1px;font-size:9px;color:var(--text2);cursor:default;}'
    + '.apg td.c[onclick]{cursor:pointer;} .apg td.c:hover{outline:1px solid rgba(255,255,255,.18);}'
    + '.apg td.today{background-color:rgba(245,158,11,.10);box-shadow:inset 1px 0 0 #f59e0b,inset -1px 0 0 #f59e0b;}'
    + '.apg tr.wk td.c{font-size:8px;color:var(--text3);} .apg tr.wk td.today{color:#f59e0b;font-weight:800;}'
    + '.apg tr.dt td.c{font-size:7px;color:var(--text3);opacity:.7;}'
    + '.apg tr.sec td{padding:3px 8px;background:rgba(255,255,255,.04);font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text3);text-align:left;position:sticky;left:0;}'
    + '.apg .hint{text-transform:none;letter-spacing:0;font-weight:400;margin-left:6px;opacity:.7;}'
    + '.apg .dim{color:#3a3f4b;} .apg td.real{color:#fff;font-weight:700;background-color:rgba(34,197,94,.14);} .apg td.proj{font-size:8px;opacity:.75;}'
    + '.apg td.live{font-weight:800;font-size:9px;} .apg .bar{height:3px;background:rgba(255,255,255,.08);border-radius:2px;margin:2px 2px 0;overflow:hidden;} .apg .bar i{display:block;height:100%;}'
    + '.apg .sq{height:8px;border-radius:2px;opacity:.9;} .apg td.hasnote{background-color:rgba(245,158,11,.12);}'
    + '.ap-chip{display:inline-flex;align-items:center;gap:5px;padding:5px 9px;border-radius:14px;font-size:11px;cursor:pointer;border:1px solid rgba(255,255,255,.12);color:#94a3b8;background:transparent;user-select:none;}'
    + '.ap-blk{background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;cursor:pointer;} .ap-blk:hover{border-color:var(--border2);}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
})();

// ── Render ──
renderAnnualPlan = function () {
  var grid = document.getElementById('annual-grid');
  if (!grid) return;
  try { if (typeof alSync === 'function') alSync(true); } catch (e) {}
  try { apSyncLiveBlocks(); } catch (e) { console.warn('[annual-plan] live sync', e); }
  var legendEl = document.getElementById('annual-legend');
  if (legendEl) legendEl.innerHTML = Object.keys(BLOCK_TYPES).map(function (k) { var t = BLOCK_TYPES[k]; return '<span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:' + t.color + ';margin-right:3px;vertical-align:middle;"></span>' + apEsc(t.label) + '</span>'; }).join('');

  var M = apModel(apAthlete(), apYear(), apPlan(false));
  grid.style.setProperty('--apw', ANNUAL_SETTINGS.density === 'comfortable' ? '40px' : '30px');
  grid.innerHTML = apGridHTML(M, { from: 0, to: 52, print: false, coach: true });

  // Scroll so this week is in view
  var t = grid.querySelector('td.today');
  if (t && !grid._apScrolled) { grid._apScrolled = true; var sc = grid.parentElement; if (sc) sc.scrollLeft = Math.max(0, t.offsetLeft - 260); }

  apRenderBelow(M);
};

// Live status line + plan notes + block cards under the grid
function apRenderBelow(M) {
  var host = document.getElementById('annual-below');
  if (!host) {
    host = document.createElement('div'); host.id = 'annual-below'; host.style.cssText = 'margin-top:14px;display:grid;grid-template-columns:minmax(260px,1fr) minmax(300px,2fr);gap:14px;';
    var g = document.getElementById('annual-grid'); g.parentElement.parentElement.appendChild(host);
  }
  var now = M.weeks.find(function (w) { return w.isToday; });
  var liveLine = '';
  if (now && now.live) {
    var L = now.live;
    liveLine = '<div style="font-size:11px;color:#4ade80;margin-bottom:10px;">📡 This week: <b>' + apEsc(L.row.name) + '</b> · Week ' + (L.idx + 1) + ' of ' + L.row.pb.weekData.length + (L.planned ? ' · ' + L.done + '/' + L.planned + ' sessions logged' : '') + '</div>';
  } else if (!M.rows.length) {
    liveLine = '<div style="font-size:11px;color:var(--text3);margin-bottom:10px;">📡 No live program for ' + apEsc(M.athlete) + ' — send one and it shows up here automatically.</div>';
  }
  var blocks = (M.plan.blocks || []).slice().sort(function (a, b) { return a.startDate < b.startDate ? -1 : 1; })
    .filter(function (b) { var s = apD(b.startDate); return s && s >= new Date(M.year, 9, 1) && s <= new Date(M.year + 1, 10, 30); });
  var cards = blocks.map(function (b) {
    var t = BLOCK_TYPES[b.type] || { label: b.type, color: '#94a3b8' }, sq = apBlockSQ(b);
    var chips = Object.keys(sq).sort(function (x, y) { return sq[x] - sq[y]; }).map(function (k) { var q = apSQ(k); return q ? '<span style="font-size:10px;padding:2px 7px;border-radius:10px;border:1px solid ' + q.color + (sq[k] === 1 ? '' : '66') + ';color:' + q.color + ';' + (sq[k] === 1 ? 'background:' + q.color + '22;font-weight:700;' : 'opacity:.8;') + '">' + apEsc(q.label) + '</span>' : ''; }).join(' ');
    return '<div class="ap-blk" onclick="annualEditBlock(\'' + b.id + '\')" style="border-left:3px solid ' + t.color + ';">'
      + '<div style="display:flex;justify-content:space-between;gap:8px;"><b style="color:' + t.color + ';font-size:12px;">' + apEsc(t.label) + (b.liveRowId ? ' <span title="From a live program">📡</span>' : '') + '</b>'
      + '<span style="font-size:10px;color:var(--text3);font-family:\'DM Mono\',monospace;">' + apFmt(apD(b.startDate)) + ' – ' + apFmt(apD(b.endDate)) + ' · ' + b.weeks + ' wk</span></div>'
      + (b.linkedProgramName ? '<div style="font-size:10px;color:var(--text2);margin-top:3px;">' + apEsc(b.linkedProgramName) + '</div>' : '')
      + (chips ? '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;">' + chips + '</div>' : '')
      + (b.notes ? '<div style="font-size:11px;color:var(--text2);margin-top:6px;white-space:pre-wrap;">' + apEsc(b.notes) + '</div>' : '')
      + (b.coachNotes ? '<div style="font-size:11px;color:#f59e0b;margin-top:4px;white-space:pre-wrap;">🔒 ' + apEsc(b.coachNotes) + '</div>' : '')
      + '</div>';
  }).join('');
  host.innerHTML = '<div><div class="card-title" style="margin-bottom:6px;">📝 Plan Notes</div>' + liveLine
    + '<textarea id="ap-plan-notes" placeholder="Season goals, priorities, testing dates, anything the athlete or staff should know…" onchange="apSavePlanNotes(this.value)" style="width:100%;min-height:150px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--text);font-size:12px;line-height:1.5;box-sizing:border-box;resize:vertical;">' + apEsc(M.plan.notes || '') + '</textarea>'
    + '<div style="font-size:10px;color:var(--text3);margin-top:4px;">Prints on both the athlete and coach copies. Saves when you click away.</div></div>'
    + '<div><div class="card-title" style="margin-bottom:6px;">📦 Blocks</div>'
    + (cards ? '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px;">' + cards + '</div>' : '<div style="font-size:12px;color:var(--text3);">No blocks yet — click a week in Block Phase or ＋ Add Block.</div>')
    + '</div>';
}
function apSavePlanNotes(v) { var p = apPlan(true); p.notes = v; saveAnnualData(); if (typeof showStatus === 'function') showStatus('✅ Plan notes saved'); }

// ── Week notes ──
function apEditWeekNote(iso) {
  var p = apPlan(true), n = (p.weekNotes || {})[iso] || {};
  var m = document.createElement('div');
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  m.innerHTML = '<div style="background:#1a1f2e;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:20px;width:420px;max-width:95vw;">'
    + '<div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:10px;">📝 Week of ' + apFmt(apD(iso)) + '</div>'
    + '<textarea id="ap-wn-text" placeholder="Travel, testing, games, deload, return from injury…" style="width:100%;min-height:110px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:8px;color:#fff;font-size:12px;box-sizing:border-box;">' + apEsc(n.text || '') + '</textarea>'
    + '<label style="display:flex;align-items:center;gap:8px;font-size:12px;color:#cbd5e1;margin:10px 0 14px;cursor:pointer;"><input type="checkbox" id="ap-wn-coach"' + (n.coachOnly ? ' checked' : '') + '> 🔒 Coach only (left off the athlete copy)</label>'
    + '<div style="display:flex;gap:8px;justify-content:flex-end;">'
    + (n.text ? '<button id="ap-wn-del" style="padding:7px 14px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);border-radius:6px;color:#ef4444;font-size:12px;cursor:pointer;margin-right:auto;">Delete</button>' : '')
    + '<button id="ap-wn-cancel" style="padding:7px 14px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#94a3b8;font-size:12px;cursor:pointer;">Cancel</button>'
    + '<button id="ap-wn-save" style="padding:7px 18px;background:#f59e0b;border:none;border-radius:6px;color:#000;font-size:12px;font-weight:700;cursor:pointer;">Save</button></div></div>';
  document.body.appendChild(m);
  var close = function () { m.remove(); };
  m.querySelector('#ap-wn-cancel').onclick = close;
  m.addEventListener('click', function (e) { if (e.target === m) close(); });
  m.querySelector('#ap-wn-save').onclick = function () {
    var txt = m.querySelector('#ap-wn-text').value.trim();
    p.weekNotes = p.weekNotes || {};
    if (txt) p.weekNotes[iso] = { text: txt, coachOnly: m.querySelector('#ap-wn-coach').checked }; else delete p.weekNotes[iso];
    saveAnnualData(); close(); renderAnnualPlan();
  };
  var del = m.querySelector('#ap-wn-del');
  if (del) del.onclick = function () { delete p.weekNotes[iso]; saveAnnualData(); close(); renderAnnualPlan(); };
  setTimeout(function () { m.querySelector('#ap-wn-text').focus(); }, 30);
}

// ── Block modal: + strength qualities, coach notes, live status ──
function apChipHTML(q, lv) {
  var on = lv === 1, sec = lv === 2;
  return '<span class="ap-chip" data-k="' + q.key + '" data-lv="' + (lv || 0) + '" onclick="apCycleChip(this)" style="' + (on ? 'background:' + q.color + '2e;border-color:' + q.color + ';color:#fff;font-weight:700;' : sec ? 'border-color:' + q.color + '88;border-style:dashed;color:' + q.color + ';' : '') + '">'
    + '<span style="width:8px;height:8px;border-radius:50%;background:' + q.color + ';opacity:' + (lv ? 1 : .35) + ';"></span>' + apEsc(q.label) + (on ? ' · 1°' : sec ? ' · 2°' : '') + '</span>';
}
function apCycleChip(el) {
  var q = apSQ(el.getAttribute('data-k')); if (!q) return;
  var lv = (parseInt(el.getAttribute('data-lv')) + 1) % 3;
  var tmp = document.createElement('div'); tmp.innerHTML = apChipHTML(q, lv); el.replaceWith(tmp.firstChild);
}
function apAddQuality(btn) {
  var name = (prompt('New strength quality (e.g. Isometric Strength):') || '').trim();
  if (!name) return;
  var key = 'c_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 24);
  if (!apSQ(key)) { AP_SQ.push({ key: key, label: name, color: AP_SQ_EXTRA_COLORS[(AP_SQ.length - AP_SQ_DEFAULT.length) % AP_SQ_EXTRA_COLORS.length] }); apSaveSQ(); }
  var tmp = document.createElement('div'); tmp.innerHTML = apChipHTML(apSQ(key), 1); btn.parentElement.insertBefore(tmp.firstChild, btn);
}

annualShowBlockModal = function (existing, startDateStr) {
  existing = existing || {};
  var isEdit = !!existing.id, athlete = apAthlete();
  var spd = existing.speed || [40, 30, 15, 10, 5], esd = existing.esd || [50, 30, 20];
  var sq = isEdit ? apBlockSQ(existing) : {};
  var inp = 'width:100%;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:6px 8px;color:#fff;font-size:12px;box-sizing:border-box;';
  var lab = function (t) { return '<label style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:3px;">' + t + '</label>'; };
  var typeOpts = Object.keys(BLOCK_TYPES).map(function (k) { return '<option value="' + k + '"' + (existing.type === k ? ' selected' : '') + '>' + apEsc(BLOCK_TYPES[k].label) + '</option>'; }).join('');
  var progOpts = ['linear', 'wave', 'dup', 'block'].map(function (p) { return '<option value="' + p + '"' + (existing.progression === p ? ' selected' : '') + '>' + p.charAt(0).toUpperCase() + p.slice(1) + '</option>'; }).join('');
  var sliders = function (pre, quals, colors, vals, n) {
    return quals.map(function (q, i) {
      return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><div style="width:100px;font-size:10px;color:' + colors[i] + ';font-weight:600;">' + q + '</div>'
        + '<input type="range" min="0" max="100" value="' + vals[i] + '" id="' + pre + '-' + i + '" oninput="annualNormalizeSliders(\'' + pre + '\',' + n + ',this,' + i + ')" style="flex:1;">'
        + '<div id="' + pre + '-' + i + '-val" style="width:32px;text-align:right;font-size:10px;color:var(--text2);font-family:\'DM Mono\',monospace;">' + vals[i] + '%</div></div>';
    }).join('');
  };
  var liveRow = existing.liveRowId ? apLiveRows(athlete).find(function (r) { return String(r.id) === String(existing.liveRowId); }) : null;
  var linkBox = '';
  if (isEdit) {
    var stale = !liveRow && existing.linkedProgramId && typeof alIsStale === 'function' && alIsStale(existing, athlete);
    var ok = liveRow || (existing.linkedProgramId && !stale);
    linkBox = '<div style="margin-bottom:12px;padding:10px;border-radius:6px;background:' + (ok ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)') + ';border:1px solid ' + (ok ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.08)') + ';display:flex;align-items:center;justify-content:space-between;gap:10px;">'
      + '<div style="font-size:11px;color:' + (ok ? '#4ade80' : 'var(--text3)') + ';">'
      + (liveRow ? '📡 Live: ' + apEsc(liveRow.name) + (existing.auto ? '<div style="color:var(--text3);font-size:10px;margin-top:2px;">Added from the live program — dates follow it until you edit them here.</div>' : '')
        : stale ? '⚠️ "' + apEsc(existing.linkedProgramName) + '" was deleted — relink'
        : existing.linkedProgramId ? '🔗 Linked: ' + apEsc(existing.linkedProgramName) : 'No program linked — weeks show a projection')
      + '</div><button onclick="annualLinkProgramModal(\'' + existing.id + '\')" style="padding:5px 10px;background:rgba(96,165,250,0.15);border:1px solid rgba(96,165,250,0.4);border-radius:5px;color:#60a5fa;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;">' + (existing.linkedProgramId ? 'Change' : 'Link Program') + '</button></div>'
      + (existing.linkedProgramId || liveRow ? '' : '<button onclick="annualStartProgramForBlock(\'' + existing.id + '\')" style="width:100%;margin-bottom:12px;padding:9px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.35);border-radius:6px;color:#f59e0b;font-size:12px;font-weight:700;cursor:pointer;">🚀 Start Program for This Block</button>');
  }
  var m = document.createElement('div');
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  m.innerHTML = '<div style="background:#1a1f2e;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:22px;width:540px;max-width:95vw;max-height:90vh;overflow-y:auto;">'
    + '<div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:14px;">' + (isEdit ? 'Edit Block' : 'Add Block') + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">'
    + '<div>' + lab('Block Type') + '<select id="ab-type" style="' + inp + '">' + typeOpts + '</select></div>'
    + '<div>' + lab('Progression') + '<select id="ab-prog" style="' + inp + '">' + progOpts + '</select></div>'
    + '<div>' + lab('Start Date') + '<input type="date" id="ab-start" value="' + (existing.startDate || startDateStr || apISO(new Date())) + '" style="' + inp + '"></div>'
    + '<div>' + lab('Weeks') + '<input type="number" id="ab-weeks" min="1" max="52" value="' + (existing.weeks || 4) + '" style="' + inp + '"></div>'
    + '</div>' + linkBox
    + '<div style="margin-bottom:14px;">' + lab('Strength Qualities <span style="text-transform:none;letter-spacing:0;color:#64748b;">— tap: primary → secondary → off</span>')
    + '<div id="ab-sq" style="display:flex;flex-wrap:wrap;gap:6px;">' + AP_SQ.map(function (q) { return apChipHTML(q, sq[q.key] || 0); }).join('')
    + '<span class="ap-chip" onclick="apAddQuality(this)" style="border-style:dashed;">＋ Add quality</span></div></div>'
    + '<div style="margin-bottom:12px;"><div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Speed Emphasis <span id="spd-total" style="color:#f59e0b;">' + spd.reduce(function (a, b) { return a + b; }, 0) + '%</span></div>' + sliders('spd', SPEED_QUALS, SPEED_COLORS, spd, 5) + '</div>'
    + '<div style="margin-bottom:14px;"><div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">ESD Emphasis <span id="esd-total" style="color:#22c55e;">' + esd.reduce(function (a, b) { return a + b; }, 0) + '%</span></div>' + sliders('esd', ESD_QUALS, ESD_COLORS, esd, 3) + '</div>'
    + '<div style="margin-bottom:10px;">' + lab('Block Notes — shared with athlete') + '<textarea id="ab-notes" placeholder="Focus for this block, what he should feel, priorities…" style="' + inp + 'min-height:70px;resize:vertical;">' + apEsc(existing.notes || '') + '</textarea></div>'
    + '<div style="margin-bottom:14px;">' + lab('🔒 Coach Notes — coach copy only') + '<textarea id="ab-cnotes" placeholder="Rationale, injury history, load targets, staff notes…" style="' + inp + 'min-height:60px;resize:vertical;">' + apEsc(existing.coachNotes || '') + '</textarea></div>'
    + '<div style="display:flex;gap:8px;justify-content:flex-end;">'
    + (isEdit ? '<button id="ab-del" style="padding:7px 14px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);border-radius:6px;color:#ef4444;font-size:12px;cursor:pointer;margin-right:auto;">Delete</button>' : '')
    + '<button id="ab-cancel" style="padding:7px 14px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#94a3b8;font-size:12px;cursor:pointer;">Cancel</button>'
    + '<button id="ab-save" style="padding:7px 18px;background:#6366f1;border:none;border-radius:6px;color:#fff;font-size:12px;font-weight:700;cursor:pointer;">Save Block</button></div></div>';
  document.body.appendChild(m);

  m.querySelector('#ab-save').onclick = function () {
    var start = m.querySelector('#ab-start').value, weeks = Math.max(1, Math.min(52, parseInt(m.querySelector('#ab-weeks').value) || 4));
    var sd = apD(start); if (!sd) { alert('Pick a start date.'); return; }
    var sqOut = {};
    m.querySelectorAll('#ab-sq .ap-chip[data-k]').forEach(function (c) { var lv = parseInt(c.getAttribute('data-lv')) || 0; if (lv) sqOut[c.getAttribute('data-k')] = lv; });
    var plan = apPlan(true);
    var b = Object.assign({}, existing, {
      id: existing.id || 'blk_' + Date.now(), type: m.querySelector('#ab-type').value, progression: m.querySelector('#ab-prog').value,
      startDate: start, endDate: apISO(apAdd(sd, weeks * 7 - 1)), weeks: weeks,
      notes: m.querySelector('#ab-notes').value.trim(), coachNotes: m.querySelector('#ab-cnotes').value.trim(), sq: sqOut,
      speed: SPEED_QUALS.map(function (_, i) { return parseInt(m.querySelector('#spd-' + i).value) || 0; }),
      esd: ESD_QUALS.map(function (_, i) { return parseInt(m.querySelector('#esd-' + i).value) || 0; })
    });
    if (existing.auto && (b.startDate !== existing.startDate || b.weeks !== existing.weeks)) b.auto = false;   // coach took over the dates
    var idx = plan.blocks.findIndex(function (x) { return x.id === b.id; });
    if (idx >= 0) plan.blocks[idx] = b; else plan.blocks.push(b);
    saveAnnualData(); m.remove(); renderAnnualPlan();
  };
  var del = m.querySelector('#ab-del');
  if (del) del.onclick = function () {
    if (!confirm('Delete this block?' + (existing.liveRowId ? '\n\nIt came from a live program, so it will be re-added while that program is live. Edit it instead to change it.' : ''))) return;
    var plan = apPlan(true); plan.blocks = plan.blocks.filter(function (x) { return x.id !== existing.id; });
    saveAnnualData(); m.remove(); renderAnnualPlan();
  };
  m.querySelector('#ab-cancel').onclick = function () { m.remove(); };
  m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
};

// ── Settings: new rows ──
annualRenderRowsPanel = function () {
  var panel = document.getElementById('as-panel-rows'); if (!panel) return;
  var options = [
    { key: 'seasonPhase', label: 'Season Phase bar' }, { key: 'liveProgram', label: '📡 Live Program row' }, { key: 'linkedProgram', label: 'Linked Program row' },
    { key: 'method', label: 'Training Method row' }, { key: 'repsIntensity', label: 'Sets × Reps / Intensity % rows' }, { key: 'strengthQuality', label: 'Strength Qualities section' },
    { key: 'speedEmphasis', label: 'Speed Emphasis section' }, { key: 'esdEmphasis', label: 'ESD Emphasis section' }, { key: 'notes', label: '📝 Week Notes row' }
  ];
  panel.innerHTML = '<div style="font-size:11px;color:#94a3b8;margin-bottom:10px;">Week and Block Phase rows are always shown. Toggle everything else on or off.</div>'
    + options.map(function (o) {
      return '<label style="display:flex;align-items:center;gap:8px;padding:7px 4px;border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer;font-size:12px;color:#fff;"><input type="checkbox" ' + (ANNUAL_SETTINGS.visibleRows[o.key] !== false ? 'checked' : '') + ' onchange="annualToggleRowSetting(\'' + o.key + '\', this.checked)">' + o.label + '</label>';
    }).join('');
};

// ── Always pull fresh live programs when the tab opens ──
(function () {
  if (typeof initAnnualPlan !== 'function') return;
  var _i = initAnnualPlan;
  initAnnualPlan = function () {
    var r = _i.apply(this, arguments);
    var g = document.getElementById('annual-grid'); if (g) g._apScrolled = false;
    if (typeof loadProgramRows === 'function') { try { Promise.resolve(loadProgramRows()).then(function () { renderAnnualPlan(); }); } catch (e) {} }
    return r;
  };
})();

// ═══ PRINT / PDF ═══════════════════════════════════════════════════════════
function apOpenPrint() {
  var m = document.createElement('div');
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  var card = function (aud, icon, title, desc, col) {
    return '<button onclick="this.closest(\'div[style*=fixed]\').remove();apPrint(\'' + aud + '\')" style="flex:1;text-align:left;padding:14px;border-radius:10px;border:1px solid ' + col + '66;background:' + col + '14;cursor:pointer;color:#fff;">'
      + '<div style="font-size:20px;">' + icon + '</div><div style="font-size:13px;font-weight:700;margin:4px 0;color:' + col + ';">' + title + '</div><div style="font-size:11px;color:#94a3b8;line-height:1.45;">' + desc + '</div></button>';
  };
  m.innerHTML = '<div style="background:#1a1f2e;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:20px;width:520px;max-width:95vw;">'
    + '<div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:4px;">🖨 Print / Save as PDF</div>'
    + '<div style="font-size:11px;color:var(--text3);margin-bottom:14px;">' + apEsc(apAthlete()) + ' · ' + apSeasonLabel(apYear()) + ' · landscape. In the print window pick “Save as PDF” to share it.</div>'
    + '<div style="display:flex;gap:10px;">'
    + card('athlete', '🏃', 'Athlete copy', 'Phases, live program weeks, strength qualities, speed & ESD emphasis, plan + block notes. No loads or coach-only notes.', '#22c55e')
    + card('coach', '📋', 'Coach copy', 'Everything — adds method, sets × reps, intensity %, logged completion and 🔒 coach-only notes.', '#60a5fa')
    + '</div><div style="text-align:right;margin-top:12px;"><button onclick="this.closest(\'div[style*=fixed]\').remove()" style="padding:7px 14px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#94a3b8;font-size:12px;cursor:pointer;">Cancel</button></div></div>';
  document.body.appendChild(m);
  m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
}

function apPrint(aud) {
  var coach = aud === 'coach', athlete = apAthlete(), year = apYear();
  try { apSyncLiveBlocks(); } catch (e) {}
  var M = apModel(athlete, year, apPlan(false));
  var season = apSeasonLabel(year);
  var plan = M.plan, blocks = (plan.blocks || []).slice().sort(function (a, b) { return a.startDate < b.startDate ? -1 : 1; })
    .filter(function (b) { var s = apD(b.startDate); return s && s >= new Date(year, 9, 1) && s <= new Date(year + 1, 10, 30); });

  var now = M.weeks.find(function (w) { return w.isToday && w.live; });
  var blockRows = blocks.map(function (b) {
    var t = BLOCK_TYPES[b.type] || { label: b.type, color: '#999' }, sq = apBlockSQ(b);
    var q1 = Object.keys(sq).filter(function (k) { return sq[k] === 1; }).map(function (k) { return (apSQ(k) || {}).label; }).filter(Boolean);
    var q2 = Object.keys(sq).filter(function (k) { return sq[k] === 2; }).map(function (k) { return (apSQ(k) || {}).label; }).filter(Boolean);
    var spd = (b.speed || []).map(function (v, i) { return v ? SPEED_QUALS[i] + ' ' + v + '%' : ''; }).filter(Boolean).join(', ');
    return '<tr><td><span class="sw" style="background:' + t.color + ';"></span><b>' + apEsc(t.label) + '</b>' + (b.linkedProgramName ? '<div class="sub">' + apEsc(b.linkedProgramName) + '</div>' : '') + '</td>'
      + '<td class="nw">' + apFmt(apD(b.startDate)) + ' – ' + apFmt(apD(b.endDate)) + '<div class="sub">' + b.weeks + ' weeks</div></td>'
      + '<td>' + (q1.length ? '<b>' + apEsc(q1.join(', ')) + '</b>' : '—') + (q2.length ? '<div class="sub">2°: ' + apEsc(q2.join(', ')) + '</div>' : '') + '</td>'
      + '<td class="sub">' + apEsc(spd || '—') + '</td>'
      + '<td>' + (b.notes ? '<div class="pre">' + apEsc(b.notes) + '</div>' : '') + (coach && b.coachNotes ? '<div class="pre coachn">🔒 ' + apEsc(b.coachNotes) + '</div>' : '') + (!b.notes && !(coach && b.coachNotes) ? '<span class="sub">—</span>' : '') + '</td></tr>';
  }).join('');
  var wn = Object.keys(plan.weekNotes || {}).sort().filter(function (k) { var x = plan.weekNotes[k]; return x && x.text && (coach || !x.coachOnly); });
  var wnHTML = wn.map(function (k, i) { var x = plan.weekNotes[k]; return '<li><b>' + (i + 1) + '.</b> <span class="nw">Week of ' + apFmt(apD(k)) + '</span> — <span class="pre">' + apEsc(x.text) + '</span>' + (x.coachOnly ? ' <span class="coachn">🔒</span>' : '') + '</li>'; }).join('');

  var css = '@page{size:letter landscape;margin:.35in;}*{box-sizing:border-box;}body{font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#111;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}'
    + '.hdr{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #0E3386;padding-bottom:6px;margin-bottom:8px;}'
    + '.brand{font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#0E3386;font-weight:700;}h1{font-size:20px;margin:2px 0 0;}.meta{font-size:10px;color:#555;text-align:right;line-height:1.5;}'
    + '.half{margin-bottom:10px;page-break-inside:avoid;}.half h3{font-size:10px;margin:0 0 3px;color:#555;text-transform:uppercase;letter-spacing:1px;}'
    + '.apg{border-collapse:collapse;width:100%;table-layout:fixed;font-family:"DM Mono",Menlo,Consolas,monospace;--ap-dim:#666;}'
    + '.apg th{border:1px solid #ccc;font-size:8px;padding:2px;background:#f1f3f7;}'
    + '.apg td{border:1px solid #e1e4ea;text-align:center;font-size:7px;padding:2px 0;white-space:nowrap;overflow:hidden;}'
    + '.apg td.lbl{width:105px;text-align:right;padding:2px 5px;font-size:7.5px;font-weight:700;color:#333;background:#f7f8fa;}'
    + '.apg tr.sec td{background:#eef1f6;text-align:left;font-weight:700;font-size:7px;letter-spacing:1px;text-transform:uppercase;color:#444;padding:2px 5px;}.apg .hint{font-weight:400;text-transform:none;letter-spacing:0;color:#777;}'
    + '.apg tr.dt td{font-size:6px;color:#777;}.apg td.today{background-color:#fff4dc !important;box-shadow:inset 1px 0 0 #f59e0b,inset -1px 0 0 #f59e0b;}'
    + '.apg .sq{height:6px;border-radius:1px;margin:0 1px;}.apg .bar{height:2px;background:#e5e7eb;margin:1px 2px 0;}.apg .bar i{display:block;height:100%;}'
    + '.apg td.real{font-weight:700;background-color:#ecfdf3;}.apg td.proj{color:#888;}.apg td.hasnote{background-color:#fff7e6;}.apg td.live{font-weight:700;}'
    + 'h2{font-size:12px;margin:12px 0 5px;color:#0E3386;text-transform:uppercase;letter-spacing:1px;}'
    + 'table.blk{border-collapse:collapse;width:100%;font-size:10px;}table.blk th{text-align:left;font-size:8.5px;text-transform:uppercase;letter-spacing:.5px;color:#555;border-bottom:1.5px solid #333;padding:4px 6px;}'
    + 'table.blk td{border-bottom:1px solid #e3e3e3;padding:5px 6px;vertical-align:top;}table.blk tr{page-break-inside:avoid;}.sw{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;vertical-align:-1px;}'
    + '.sub{color:#666;font-size:9px;}.nw{white-space:nowrap;}.pre{white-space:pre-wrap;}.coachn{color:#b45309;}.notes{font-size:10.5px;line-height:1.5;border:1px solid #ddd;border-radius:6px;padding:8px 10px;}'
    + 'ul.wn{margin:0;padding-left:0;list-style:none;font-size:10px;columns:2;column-gap:24px;}ul.wn li{margin-bottom:4px;break-inside:avoid;}'
    + '.foot{margin-top:12px;font-size:8.5px;color:#888;display:flex;justify-content:space-between;border-top:1px solid #ddd;padding-top:5px;}'
    + '.legend{font-size:8.5px;color:#555;margin:-2px 0 8px;}.legend span{margin-right:10px;white-space:nowrap;}'
    + '@media screen{body{padding:24px;background:#e9ecf1;}.page{background:#fff;max-width:11in;margin:auto;padding:.35in;box-shadow:0 2px 14px rgba(0,0,0,.15);}.bar-top{max-width:11in;margin:0 auto 10px;text-align:right;}.bar-top button{padding:8px 16px;font-size:13px;border-radius:6px;border:none;background:#0E3386;color:#fff;cursor:pointer;}}'
    + '@media print{.bar-top{display:none;}}';

  var legend = Object.keys(BLOCK_TYPES).filter(function (k) { return blocks.some(function (b) { return b.type === k; }); })
    .map(function (k) { var t = BLOCK_TYPES[k]; return '<span><span class="sw" style="background:' + t.color + ';"></span>' + apEsc(t.label) + ' (' + apEsc(t.short || '') + ')</span>'; }).join('')
    + '<span>DL = deload</span><span>W# = live program week' + (coach ? ' (bar = sessions logged)' : '') + '</span><span style="background:#fff4dc;padding:0 4px;">this week</span>';

  var body = '<div class="bar-top"><button onclick="window.print()">🖨 Print / Save as PDF</button></div><div class="page">'
    + '<div class="hdr"><div><div class="brand">Mark Weisman Strength &amp; Conditioning</div><h1>' + apEsc(athlete) + ' — ' + season + ' Annual Plan</h1></div>'
    + '<div class="meta">' + (coach ? 'Coach copy' : 'Athlete copy') + '<br>Nov 1, ' + year + ' – Oct 30, ' + (year + 1) + (now ? '<br>Now: ' + apEsc(now.live.row.name) + ' · Week ' + (now.live.idx + 1) : '') + '</div></div>'
    + '<div class="legend">' + legend + '</div>'
    + '<div class="half"><h3>Nov – Apr</h3>' + apGridHTML(M, { from: 0, to: 26, print: true, coach: coach }) + '</div>'
    + '<div class="half"><h3>May – Oct</h3>' + apGridHTML(M, { from: 26, to: 52, print: true, coach: coach }) + '</div>'
    + (plan.notes ? '<h2>Plan Notes</h2><div class="notes pre">' + apEsc(plan.notes) + '</div>' : '')
    + (blockRows ? '<h2>Blocks</h2><table class="blk"><thead><tr><th style="width:20%;">Block</th><th style="width:13%;">Dates</th><th style="width:20%;">Strength Qualities</th><th style="width:17%;">Speed Emphasis</th><th>Notes</th></tr></thead><tbody>' + blockRows + '</tbody></table>' : '')
    + (wnHTML ? '<h2>Week Notes</h2><ul class="wn">' + wnHTML + '</ul>' : '')
    + '<div class="foot"><span>Mark Weisman Strength &amp; Conditioning</span><span>Printed ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + '</span></div></div>';

  var win = window.open('', '_blank');
  if (!win) { alert('Pop-up blocked — allow pop-ups for this site to print.'); return; }
  win.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + apEsc(athlete) + ' — ' + season + ' Annual Plan (' + (coach ? 'Coach' : 'Athlete') + ')</title><style>' + css + '</style></head><body>' + body + '</body></html>');
  win.document.close();
  setTimeout(function () { try { win.focus(); win.print(); } catch (e) {} }, 400);
}
