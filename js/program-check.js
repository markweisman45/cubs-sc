// ═══════════════════════════════════════════════════════════════════════════
// Program Builder — 🧪 Method picker + ✓ Program Check
//   • Method picker: a strip under every lift row. Pick a KILO method and its sets, reps, tempo,
//     rest and load fill in together (js/kilo-gen.js KILO_METHODS), so tempo can't drift from the
//     rep scheme. Shows time under tension (TUT) per set against the phase range.
//   • Program Check: scans the whole program for broken pairs, the same lift stacked twice,
//     tempo × reps outside the phase TUT range, rep lists that don't match the sets, and 10+ set
//     rows — with one-click fixes. Runs automatically before "Save & Send".
// Loaded after index.html's Program Builder and js/kilo-gen.js.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var esc = function (s) { return typeof escHtml === 'function' ? escHtml(String(s == null ? '' : s)) : String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var M = function () { return typeof KILO_METHODS !== 'undefined' ? KILO_METHODS : {}; };
  var TUT = function (t, r) { return typeof kiloTut === 'function' ? kiloTut(t, r) : null; };

  // Phase of a week from its label → TUT range for straight sets
  function phaseOf(w) {
    var l = (w && w.label) || '';
    if (/\bAcc\b|Accumulation/i.test(l)) return 'acc';
    if (/\bInt\b|Intensification/i.test(l)) return 'int';
    return null;
  }
  var RANGE = { acc: [30, 70], int: [10, 40], any: [10, 75] };
  function isMainLift(ex) {
    if (!ex || ex.type === 'speed') return false;
    if (ex.method && /^imca/.test(ex.method)) return true;
    if (/^\s*\d+(\.\d+)?%\s*$/.test(ex.load || '')) return true;
    var db = typeof EXERCISE_DB !== 'undefined' ? EXERCISE_DB.find(function (e) { return e && e.name === ex.name; }) : null;
    return !!(db && db.liftKey);
  }
  function tutRange(ex, w) {
    var m = ex.method && M()[ex.method];
    if (m) return m.tut || null;                 // speed / iso / combo methods aren't timed
    if (!isMainLift(ex)) return null;
    return RANGE[phaseOf(w) || 'any'];
  }

  // ── Method picker ──────────────────────────────────────────────────────────
  function activeDay() {
    if (typeof PB_ACTIVE_DAY === 'undefined' || !PB_ACTIVE_DAY || typeof PB_STATE === 'undefined') return null;
    var w = PB_STATE.weekData[PB_ACTIVE_DAY.weekIdx]; return w ? { w: w, d: w.days[PB_ACTIVE_DAY.dayIdx] } : null;
  }
  function locate(ex) {
    var a = activeDay(); if (!a || !a.d) return null;
    for (var bi = 0; bi < a.d.blocks.length; bi++) {
      var i = (a.d.blocks[bi].exercises || []).indexOf(ex);
      if (i >= 0) return { bi: bi, ei: i, w: a.w };
    }
    return null;
  }
  function methodOptions(cur) {
    var fams = {}, out = '<option value="">— straight sets —</option>';
    Object.keys(M()).forEach(function (k) { var m = M()[k]; (fams[m.fam] = fams[m.fam] || []).push(k); });
    Object.keys(fams).forEach(function (f) {
      out += '<optgroup label="' + esc(f) + '">' + fams[f].map(function (k) {
        return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + esc(M()[k].label) + '</option>';
      }).join('') + '</optgroup>';
    });
    return out;
  }
  function tutChip(ex, w) {
    if (/^\s*X/i.test(ex.tempo || '')) return '';   // ballistic (jumps, throws) — no time under tension
    var s = TUT(ex.tempo, ex.reps); if (s == null) return '';
    var r = tutRange(ex, w), ok = !r || (s >= r[0] && s <= r[1]);
    return '<span title="Time under tension per set = tempo × reps' + (r ? ' · target ' + r[0] + '–' + r[1] + ' s' : '') + '" style="padding:1px 6px;border-radius:4px;font-family:\'DM Mono\',monospace;'
      + (ok ? 'color:var(--text3);background:rgba(255,255,255,0.04);' : 'color:#fbbf24;background:rgba(251,191,36,0.12);') + '">TUT ' + s + ' s' + (ok ? '' : ' ⚠') + '</span>';
  }
  // External load on top of the bar — bands, chains, vest, weight releasers (shows to athletes with the load)
  function extSelect(ex, at) {
    var list = (typeof TC !== 'undefined' && TC.EXT_LOADS) || ['Light bands', 'Average bands', 'Heavy bands', 'Chains', 'Weight releasers', 'Weighted vest'];
    var cur = ex.ext || '', opts = '<option value="">+ none</option>';
    if (cur && list.indexOf(cur) < 0) opts += '<option value="' + esc(cur) + '" selected>' + esc(cur) + '</option>';
    list.forEach(function (x) { opts += '<option value="' + esc(x) + '"' + (x === cur ? ' selected' : '') + '>' + esc(x) + '</option>'; });
    return '<span style="margin-left:4px;">🔗 External</span>'
      + '<select onchange="pcSetExt(' + at.bi + ',' + at.ei + ',this.value)" title="External load on top of the bar — shows to the athlete with the load (e.g. 185 lbs + Average bands)" style="background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:1px 4px;color:' + (cur ? '#fcd34d' : 'var(--text3)') + ';font-size:9.5px;max-width:140px;">' + opts + '</select>';
  }
  // Target bar speed (Mann's VBT zones). Blank = athlete sees nothing.
  var VEL_ZONES = [['> 1.3 m/s', 'starting strength'], ['1.0–1.3 m/s', 'speed-strength'], ['0.75–1.0 m/s', 'strength-speed'], ['0.5–0.75 m/s', 'accelerative strength'], ['< 0.5 m/s', 'absolute strength']];
  window.PC_VEL_ZONES = VEL_ZONES;
  function velSelect(ex, at) {
    var cur = ex.vel || '', opts = '<option value="">—</option>', known = VEL_ZONES.some(function (z) { return z[0] === cur; });
    if (cur && !known) opts += '<option value="' + esc(cur) + '" selected>' + esc(cur) + '</option>';
    VEL_ZONES.forEach(function (z) { opts += '<option value="' + esc(z[0]) + '"' + (z[0] === cur ? ' selected' : '') + '>' + esc(z[0] + ' · ' + z[1]) + '</option>'; });
    return '<span style="margin-left:4px;">⚡ Velocity</span>'
      + '<select onchange="pcSetVel(' + at.bi + ',' + at.ei + ',this.value)" title="Target bar speed — athletes see it only when set" style="background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:1px 4px;color:' + (cur ? '#67e8f9' : 'var(--text3)') + ';font-size:9.5px;max-width:150px;">' + opts + '</select>';
  }
  window.pcSetVel = function (bi, ei, val) {
    var a = activeDay(); if (!a) return;
    var ex = a.d.blocks[bi].exercises[ei]; if (!ex) return;
    if (val) ex.vel = val; else delete ex.vel;
    if (typeof pbRenderDayGrid === 'function') pbRenderDayGrid();
    if (typeof pbOpenDay === 'function') pbOpenDay(PB_ACTIVE_DAY.weekIdx, PB_ACTIVE_DAY.dayIdx);
  };
  window.pcSetExt = function (bi, ei, val) {
    var a = activeDay(); if (!a) return;
    var ex = a.d.blocks[bi].exercises[ei]; if (!ex) return;
    if (val) ex.ext = val; else delete ex.ext;
    if (typeof pbRenderDayGrid === 'function') pbRenderDayGrid();
    if (typeof pbOpenDay === 'function') pbOpenDay(PB_ACTIVE_DAY.weekIdx, PB_ACTIVE_DAY.dayIdx);
  };
  function methodStrip(ex) {
    var at = locate(ex); if (!at) return '';
    var m = ex.method && M()[ex.method];
    return '<div style="display:flex;align-items:center;gap:6px;margin:-3px 0 7px 44px;font-size:9.5px;color:var(--text3);">'
      + '<span>🧪 Method</span>'
      + '<select onchange="pcPickMethod(' + at.bi + ',' + at.ei + ',this.value)" title="Pick a method — sets, reps, tempo, rest and load fill in together" style="background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:1px 4px;color:' + (m ? '#c4b5fd' : 'var(--text3)') + ';font-size:9.5px;max-width:230px;">' + methodOptions(ex.method || '') + '</select>'
      + extSelect(ex, at)
      + velSelect(ex, at)
      + tutChip(ex, at.w)
      + (m ? '<span style="opacity:.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:420px;" title="' + esc(m.note) + '">' + esc(m.note) + '</span>' : '')
      + '</div>';
  }
  window.pcPickMethod = function (bi, ei, key) {
    var a = activeDay(); if (!a) return;
    var ex = a.d.blocks[bi].exercises[ei]; if (!ex) return;
    var prevNote = ex.method && M()[ex.method] ? M()[ex.method].label : null;
    if (!key) { delete ex.method; }
    else {
      var m = M()[key];
      ex.method = key; ex.sets = String(m.sets); ex.reps = String(m.reps); ex.tempo = m.tempo; ex.rest = m.rest; ex.load = m.load;
      if (m.ext) ex.ext = m.ext; else delete ex.ext;   // the method's bands / chains / releasers come with it
      if (m.vel) ex.vel = m.vel; else delete ex.vel;   // speed methods carry a bar-speed target
      // replace a method note we wrote; keep the coach's own notes
      if (!ex.notes || (prevNote && ex.notes.indexOf(prevNote) === 0) || /^IMCA|^A-series/.test(ex.notes)) ex.notes = m.label + ' — ' + m.note;
    }
    if (typeof pbRenderDayGrid === 'function') pbRenderDayGrid();
    if (typeof pbOpenDay === 'function') pbOpenDay(PB_ACTIVE_DAY.weekIdx, PB_ACTIVE_DAY.dayIdx);
  };
  if (typeof pbLoadHint === 'function') {
    var _lh = pbLoadHint;
    pbLoadHint = function (ex) { var h = _lh.apply(this, arguments) || ''; try { return methodStrip(ex) + h; } catch (e) { return h; } };
  }

  // ── Program Check ─────────────────────────────────────────────────────────
  // Straight-set tempo that brings TUT inside [lo, hi] — keeps an explosive concentric
  function fitTempo(reps, lo, hi, cur) {
    var cands = ['4-0-X-0', '3-0-X-0', '3-1-X-0', '3-0-1-0', '2-0-X-0', '2-0-1-0', '5-0-X-0', '4-1-X-0', '6-0-X-0'];
    if (/X/.test(cur || '')) cands = cands.filter(function (t) { return /X/.test(t); }).concat(cands);
    for (var i = 0; i < cands.length; i++) { var s = TUT(cands[i], reps); if (s != null && s >= lo && s <= hi) return cands[i]; }
    return null;
  }
  function liftBlocks(d) { return (d.blocks || []).map(function (b, bi) { return { b: b, bi: bi }; }).filter(function (x) { return x.b.blockType !== 'speed' && (x.b.exercises || []).length; }); }

  function pcScan(st) {
    var out = [];
    (st.weekData || []).forEach(function (w, wi) {
      (w.days || []).forEach(function (d, di) {
        if (d.type === 'off') return;
        var where = { wi: wi, di: di }, tag = 'W' + (wi + 1) + ' · ' + (d.day || '') + ' ' + (d.label || '');
        var seen = {};
        liftBlocks(d).forEach(function (x) {
          var exs = x.b.exercises, g = {}, order = [];
          exs.forEach(function (e) { var p = e.pair || '—'; if (!g[p]) { g[p] = []; order.push(p); } g[p].push(e); });
          var big = order.filter(function (p) { return p !== '—' && g[p].length > 2; });
          var single = order.filter(function (p, i) { return p !== '—' && g[p].length === 1 && i < order.length - 1; });
          var letters = order.filter(function (p) { return p !== '—'; }).sort().join('');
          var skip = letters && letters !== 'ABCDEFGH'.slice(0, letters.length);
          if (big.length || single.length || skip || g['—']) {
            out.push({ lvl: big.length ? 'red' : 'yellow', where: where, tag: tag,
              msg: (big.length ? 'Pair ' + big.join(', ') + ' has ' + g[big[0]].length + ' exercises' : single.length ? 'Pair ' + single.join(', ') + ' has one exercise' : g['—'] ? 'Exercises with no pair letter' : 'Pair letters skip (' + letters.split('').join('-') + ')') + ' — "' + (x.b.label || 'Lift') + '"',
              fix: { type: 'repair', wi: wi, di: di, bi: x.bi }, fixLabel: 'Re-pair in order' });
          }
          exs.forEach(function (e, ei) {
            if (e.type === 'speed' || !e.name) return;
            var k = e.name;
            if (seen[k]) {
              var other = seen[k], isStraight = function (z) { return !z.method || /^imca/.test(z.method); };
              // keep the method row, drop the straight sets (IMCA counts as straight sets)
              var straight = isStraight(e) && !isStraight(other.e) ? { bi: x.bi, ei: ei } : isStraight(other.e) && !isStraight(e) ? { bi: other.bi, ei: other.ei } : null;
              out.push({ lvl: 'red', where: where, tag: tag, msg: e.name + ' appears twice' + (straight ? ' — straight sets and method sets on the same lift' : ''),
                fix: straight ? { type: 'drop', wi: wi, di: di, bi: straight.bi, ei: straight.ei } : null, fixLabel: 'Remove the straight sets' });
            } else seen[k] = { e: e, bi: x.bi, ei: ei };
            var r = tutRange(e, w), s = TUT(e.tempo, e.reps);
            if (r && s != null && (s < r[0] || s > r[1])) {
              var t = fitTempo(e.reps, r[0], r[1], e.tempo);
              out.push({ lvl: s > r[1] ? 'red' : 'yellow', where: where, tag: tag,
                msg: e.name + ' ' + e.sets + '×' + e.reps + ' @ ' + e.tempo + ' = ' + s + ' s a set — ' + (phaseOf(w) === 'acc' ? 'Accumulation' : phaseOf(w) === 'int' ? 'Intensification' : 'target') + ' range is ' + r[0] + '–' + r[1] + ' s',
                fix: t ? { type: 'tempo', wi: wi, di: di, bi: x.bi, ei: ei, v: t } : null, fixLabel: t ? 'Tempo → ' + (typeof kiloCompactTempo === 'function' ? kiloCompactTempo(t) : t) : '' });
            }
            var list = String(e.reps || '').trim();
            if (/^\d+(\s*,\s*\d+)+$/.test(list) && list.split(',').length !== parseInt(e.sets, 10)) {
              var n = list.split(',').length;
              out.push({ lvl: 'yellow', where: where, tag: tag, msg: e.name + ': ' + e.sets + ' sets but ' + n + ' rep targets (' + list + ')', fix: { type: 'sets', wi: wi, di: di, bi: x.bi, ei: ei, v: String(n) }, fixLabel: 'Sets → ' + n });
            }
            if (parseInt(e.sets, 10) >= 10) out.push({ lvl: 'yellow', where: where, tag: tag, msg: e.name + ' has ' + e.sets + ' sets — split it or cap at 6' });
            if (!String(e.sets || '').trim() || !String(e.reps || '').trim()) out.push({ lvl: 'yellow', where: where, tag: tag, msg: e.name + ' is missing sets or reps' });
          });
        });
      });
    });
    return out;
  }
  // ── Weekly volume: jump contacts, ≥95% sprints, lift sets by pattern ──
  function num(v) { var m = String(v == null ? '' : v).match(/\d+(\.\d+)?/g); return m ? Math.max.apply(null, m.map(Number)) : 0; }
  function repsCount(r) {
    var s = String(r == null ? '' : r).trim();
    if (!s || /\d\s*s\b|sec|min|yd|m\b/i.test(s)) return 0;            // timed or distance work isn't counted as contacts
    var n = num(s); return /ea\b/i.test(s) ? n * 2 : n;
  }
  function catOf(e) {
    var db = typeof EXERCISE_DB !== 'undefined' ? EXERCISE_DB.find(function (x) { return x && x.name === e.name; }) : null;
    return (db && db.cat) || e.cat || '';
  }
  var PATTERN = [['Squat', /Squat Variations/i], ['Hinge', /Deadlift Variations|Hamstring|Olympic/i], ['Push', /Horizontal Push|Vertical Push/i], ['Pull', /Horizontal Pull|Vertical Pull/i]];
  // Foot contacts only — med-ball throws and plyo push-ups aren't jump contacts
  function isJump(e, cat) {
    var n = e.name || '';
    if (/\bMB\b|med ?ball|toss|throw|slam|push.?up|chest pass/i.test(n)) return false;
    return /LB Plyos/i.test(cat) || /jump|bound|hop|pogo|skip|depth|tuck|penta|deca|push.?off/i.test(n);
  }
  function pcWeekly(st) {
    return (st.weekData || []).map(function (w, wi) {
      var o = { wi: wi, label: w.label || '', deload: !!w.isDeload, contacts: 0, sprintReps: 0, sprintYd: 0, sets: { Squat: 0, Hinge: 0, Push: 0, Pull: 0 } };
      (w.days || []).forEach(function (d) {
        if (d.type === 'off') return;
        (d.blocks || []).forEach(function (b) {
          (b.exercises || []).forEach(function (e) {
            var sets = num(e.sets) || 1, cat = catOf(e);
            if (e.type === 'speed' || b.blockType === 'speed') {
              if (/95|100|max/i.test(String(e.pct || ''))) {
                var reps = num(e.reps) || 1, dist = String(e.distance || ''), dn = num(dist);
                o.sprintReps += sets * reps;
                o.sprintYd += sets * reps * (/m\b/i.test(dist) && !/yd/i.test(dist) ? Math.round(dn * 1.094) : dn);
              } else if (isJump(e, cat)) o.contacts += sets * repsCount(e.reps);
              return;
            }
            if (isJump(e, cat)) { o.contacts += sets * repsCount(e.reps); return; }
            // name first (some library categories are off, e.g. a cable press filed under pull), then category
            var nm = e.name || '', pat = /press|push|dip|\bbench\b/i.test(nm) ? 'Push' : /\brow\b|pull|chin|pulldown/i.test(nm) ? 'Pull' : null;
            if (pat) { o.sets[pat] += sets; return; }
            PATTERN.forEach(function (p) { if (p[1].test(cat)) o.sets[p[0]] += sets; });
          });
        });
      });
      return o;
    });
  }
  // Flags: KILO's 300-contact ceiling, week-to-week jumps over 30% (contacts / ≥95% sprint yards), 24+ sets of a pattern
  function weeklyIssues(st) {
    var W = pcWeekly(st), out = [];
    W.forEach(function (o, i) {
      var tag = 'W' + (o.wi + 1) + ' · weekly volume', where = { wi: o.wi, di: 0 };
      if (o.contacts > 300) out.push({ lvl: 'yellow', where: where, tag: tag, msg: o.contacts + ' jump contacts — above KILO\'s 300-a-week ceiling' });
      var p = W[i - 1];
      if (p && !o.deload && !p.deload) {
        if (p.contacts >= 80 && o.contacts > p.contacts * 1.3) out.push({ lvl: 'yellow', where: where, tag: tag, msg: 'Jump contacts up ' + Math.round((o.contacts / p.contacts - 1) * 100) + '% from last week (' + p.contacts + ' → ' + o.contacts + ')' });
        if (p.sprintYd >= 50 && o.sprintYd > p.sprintYd * 1.3) out.push({ lvl: 'yellow', where: where, tag: tag, msg: 'Sprint volume at 95%+ up ' + Math.round((o.sprintYd / p.sprintYd - 1) * 100) + '% from last week (' + p.sprintYd + ' → ' + o.sprintYd + ' yd)' });
      }
      Object.keys(o.sets).forEach(function (k) { if (o.sets[k] > 24) out.push({ lvl: 'yellow', where: where, tag: tag, msg: o.sets[k] + ' ' + k.toLowerCase() + ' sets in the week — over 24' }); });
    });
    return out;
  }
  function weeklyTable(st) {
    var W = pcWeekly(st); if (!W.length) return '';
    var th = 'padding:4px 8px;text-align:right;font-weight:600;color:var(--text3);font-size:10px;', td = 'padding:4px 8px;text-align:right;font-family:\'DM Mono\',monospace;font-size:11px;';
    return '<div style="margin:10px 0 6px;font-size:10.5px;font-weight:700;letter-spacing:.06em;color:var(--text3);text-transform:uppercase;">Weekly volume</div>'
      + '<div style="overflow-x:auto;"><table style="border-collapse:collapse;width:100%;"><tr><th style="' + th + 'text-align:left;">Week</th><th style="' + th + '">Jump contacts</th><th style="' + th + '">Sprints 95%+</th><th style="' + th + '">Squat</th><th style="' + th + '">Hinge</th><th style="' + th + '">Push</th><th style="' + th + '">Pull</th></tr>'
      + W.map(function (o, i) {
        var p = W[i - 1], hot = function (a, b, min) { return p && !o.deload && !p.deload && b >= min && a > b * 1.3 ? 'color:#fbbf24;' : ''; };
        return '<tr style="border-top:1px solid rgba(255,255,255,0.05);"><td style="' + td + 'text-align:left;font-family:inherit;">W' + (o.wi + 1) + (o.deload ? ' 🔄' : '') + '</td>'
          + '<td style="' + td + (o.contacts > 300 ? 'color:#fbbf24;' : hot(o.contacts, p && p.contacts, 80)) + '">' + (o.contacts || '—') + '</td>'
          + '<td style="' + td + hot(o.sprintYd, p && p.sprintYd, 50) + '">' + (o.sprintReps ? o.sprintReps + ' · ' + o.sprintYd + ' yd' : '—') + '</td>'
          + ['Squat', 'Hinge', 'Push', 'Pull'].map(function (k) { return '<td style="' + td + (o.sets[k] > 24 ? 'color:#fbbf24;' : '') + '">' + (o.sets[k] || '—') + '</td>'; }).join('') + '</tr>';
      }).join('') + '</table></div>';
  }
  window.pcWeekly = pcWeekly;
  window.pcWeeklyIssues = weeklyIssues;

  // ── Insert deload week: copy of the selected week, ~40% less volume, −10% load ──
  var HEAVY = /^(ecc-supra|conc-ecc|ecc-conc|ecc-expl-accent|yield-iso-contrast|over-fi-contrast|over-functional)$/;
  function deloadEx(e) {
    var x = JSON.parse(JSON.stringify(e)), n = parseInt(x.sets, 10);
    if (n > 0) {
      var ns = Math.max(1, Math.round(n * 0.6)); x.sets = String(ns);
      if (/^\s*\d+(\s*,\s*\d+)+\s*$/.test(x.reps || '')) x.reps = x.reps.split(',').slice(0, ns).map(function (r) { return r.trim(); }).join(', ');
    }
    if (x.type === 'speed') return x;
    if (x.method && HEAVY.test(x.method)) {       // no supra-max / combo / hook work in a deload — straight sets
      delete x.method; delete x.ext; x.reps = '5'; x.load = '60%'; x.tempo = '30X0';
      x.notes = 'Deload — straight sets, smooth and fast';
      return x;
    }
    var pm = String(x.load || '').match(/^\s*(\d+(\.\d+)?)\s*%\s*$/);
    if (pm) x.load = Math.max(40, parseFloat(pm[1]) - 10) + '%';
    else if (/RPE\s*\d/i.test(x.load || '')) x.load = 'RPE 6';
    return x;
  }
  window.pcInsertDeload = function () {
    if (typeof PB_STATE === 'undefined' || !PB_STATE || !PB_STATE.weekData || !PB_STATE.weekData.length) { if (typeof showStatus === 'function') showStatus('⚠️ Open a program in the builder first'); return; }
    var i = Math.max(0, Math.min(PB_STATE.activeWeek || 0, PB_STATE.weekData.length - 1)), src = PB_STATE.weekData[i];
    var w = JSON.parse(JSON.stringify(src));
    w.isDeload = true;
    w.label = 'Deload · ~40% less volume, −10% load' + (src.label ? ' (after ' + String(src.label).split(' · ')[0] + ')' : '');
    w.progMod = { label: 'Deload', sets: 0.6, reps: 1, load: 0.9 };
    w.days.forEach(function (d) { (d.blocks || []).forEach(function (b) { b.exercises = (b.exercises || []).map(deloadEx); }); });
    PB_STATE.weekData.splice(i + 1, 0, w);
    PB_STATE.weekData.forEach(function (x, k) { x.week = k + 1; });
    PB_STATE.weeks = PB_STATE.weekData.length;
    var we = document.getElementById('pb-weeks'); if (we) we.value = PB_STATE.weeks;
    if (typeof pbSelectWeek === 'function') pbSelectWeek(i + 1); else { PB_STATE.activeWeek = i + 1; if (typeof pbRenderWeekTabs === 'function') pbRenderWeekTabs(); if (typeof pbRenderDayGrid === 'function') pbRenderDayGrid(); }
    if (typeof showStatus === 'function') showStatus('🔄 Deload week added after Week ' + (i + 1) + ' — program is now ' + PB_STATE.weeks + ' weeks');
  };

  function applyFix(st, f) {
    var d = st.weekData[f.wi] && st.weekData[f.wi].days[f.di]; if (!d) return false;
    var b = d.blocks[f.bi]; if (!b) return false;
    if (f.type === 'repair') {
      var L = 'ABCDEFGH';
      // keep the current order; two exercises a letter (a last odd one stays on its own)
      b.exercises.forEach(function (e, i) { e.pair = L[Math.min(7, Math.floor(i / 2))]; });
      return true;
    }
    var e = b.exercises[f.ei]; if (!e) return false;
    if (f.type === 'drop') { b.exercises.splice(f.ei, 1); return true; }
    if (f.type === 'tempo') { e.tempo = typeof kiloCompactTempo === 'function' ? kiloCompactTempo(f.v) : f.v; return true; }
    if (f.type === 'sets') { e.sets = f.v; return true; }
    return false;
  }
  function refresh() {
    if (typeof pbRenderDayGrid === 'function') pbRenderDayGrid();
    if (typeof PB_ACTIVE_DAY !== 'undefined' && PB_ACTIVE_DAY && typeof pbOpenDay === 'function') pbOpenDay(PB_ACTIVE_DAY.weekIdx, PB_ACTIVE_DAY.dayIdx);
  }
  // Fixes run bottom-up so removing a row doesn't shift the next fix's index; one re-pair per block
  function fixAll(list) {
    var st = PB_STATE, done = {}, n = 0;
    list.filter(function (i) { return i.fix; }).sort(function (a, b) {
      var A = a.fix, B = b.fix; return (B.wi - A.wi) || (B.di - A.di) || (B.bi - A.bi) || ((B.ei || 0) - (A.ei || 0)) || (A.type === 'repair' ? 1 : -1);
    }).forEach(function (i) {
      var k = JSON.stringify(i.fix); if (done[k]) return; done[k] = 1;
      if (i.fix.type !== 'repair' && applyFix(st, i.fix)) n++;
    });
    // re-pair last, after rows were removed
    list.filter(function (i) { return i.fix && i.fix.type === 'repair'; }).forEach(function (i) { if (applyFix(st, i.fix)) n++; });
    // a removed row can break pairs — re-pair any block that's still off
    pcScan(st).filter(function (i) { return i.fix && i.fix.type === 'repair'; }).forEach(function (i) { if (applyFix(st, i.fix)) n++; });
    return n;
  }

  var PC = { list: [], onSend: null };
  function pcModal(sending) {
    var m = document.getElementById('pc-modal');
    if (!m) { m = document.createElement('div'); m.id = 'pc-modal'; document.body.appendChild(m); }
    var L = PC.list, red = L.filter(function (i) { return i.lvl === 'red'; }).length, fixable = L.filter(function (i) { return i.fix; }).length;
    var rows = L.slice(0, 200).map(function (i, x) {
      return '<div style="display:flex;gap:8px;align-items:flex-start;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:12px;">'
        + '<span>' + (i.lvl === 'red' ? '🔴' : '🟡') + '</span><div style="flex:1;"><div style="font-size:10px;color:var(--text3);">' + esc(i.tag) + '</div>' + esc(i.msg) + '</div>'
        + (i.fix ? '<button onclick="pcFixOne(' + x + ')" style="flex-shrink:0;padding:3px 9px;border-radius:6px;border:1px solid rgba(34,197,94,.45);background:rgba(34,197,94,.12);color:#86efac;font-size:10.5px;font-weight:700;cursor:pointer;">' + esc(i.fixLabel || 'Fix') + '</button>' : '')
        + '</div>';
    }).join('') + (L.length > 200 ? '<div style="padding:8px 0;font-size:11px;color:var(--text3);">+' + (L.length - 200) + ' more</div>' : '');
    m.innerHTML = '<div style="position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;" onclick="if(event.target===this)pcClose()">'
      + '<div style="background:var(--bg2,#13161d);border:1px solid var(--border);border-radius:12px;width:min(760px,94vw);max-height:84vh;display:flex;flex-direction:column;">'
      + '<div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:10px;">'
      + '<div><div style="font-weight:800;font-size:15px;">✓ Program Check</div><div style="font-size:11px;color:var(--text3);margin-top:2px;">'
      + (L.length ? L.length + ' item' + (L.length > 1 ? 's' : '') + (red ? ' · ' + red + ' to fix' : '') + ' · pairs, stacked lifts, tempo × reps (TUT), rep lists, weekly volume' : 'Nothing to fix — pairs, tempo × reps, set schemes and weekly volume all line up.') + '</div></div>'
      + '<button onclick="pcClose()" style="background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer;">✕</button></div>'
      + '<div style="padding:4px 18px;overflow:auto;flex:1;">' + (rows || '<div style="padding:24px 0;text-align:center;color:var(--green);font-size:13px;">✅ All clear</div>') + (typeof PB_STATE !== 'undefined' && PB_STATE ? weeklyTable(PB_STATE) : '') + '</div>'
      + '<div style="padding:12px 18px;border-top:1px solid var(--border);display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">'
      + (fixable ? '<button onclick="pcFixAll(' + (sending ? 1 : 0) + ')" style="padding:8px 14px;border-radius:7px;border:none;background:#16a34a;color:#fff;font-weight:700;font-size:12px;cursor:pointer;">Fix all ' + fixable + (sending ? ' & send' : '') + '</button>' : '')
      + (sending ? '<button onclick="pcSendAnyway()" style="padding:8px 14px;border-radius:7px;border:1px solid var(--border);background:var(--bg3);color:var(--text);font-weight:700;font-size:12px;cursor:pointer;">' + (L.length ? 'Send as is' : 'Send') + '</button>' : '')
      + '<button onclick="pcClose()" style="padding:8px 14px;border-radius:7px;border:1px solid var(--border);background:none;color:var(--text3);font-size:12px;cursor:pointer;">' + (sending ? 'Cancel' : 'Close') + '</button>'
      + '</div></div></div>';
  }
  window.pcClose = function () { var m = document.getElementById('pc-modal'); if (m) m.innerHTML = ''; };
  window.pcOpen = function (sending) {
    if (typeof PB_STATE === 'undefined' || !PB_STATE || !PB_STATE.weekData) { if (typeof showStatus === 'function') showStatus('⚠️ Open a program in the builder first'); return; }
    PC.list = pcScan(PB_STATE).concat(weeklyIssues(PB_STATE)); pcModal(!!sending);
  };
  window.pcFixOne = function (x) {
    var i = PC.list[x]; if (!i || !i.fix) return;
    if (i.fix.type === 'repair') applyFix(PB_STATE, i.fix); else fixAll([i]);
    refresh(); PC.list = pcScan(PB_STATE).concat(weeklyIssues(PB_STATE)); pcModal(!!PC.sending);
  };
  window.pcFixAll = function (send) {
    var n = fixAll(PC.list); refresh();
    if (typeof showStatus === 'function') showStatus('✅ Program Check fixed ' + n + ' item' + (n === 1 ? '' : 's'));
    PC.list = pcScan(PB_STATE).concat(weeklyIssues(PB_STATE));
    if (send) { pcClose(); PC.sending = false; if (PC.onSend) PC.onSend(); } else pcModal(false);
  };
  window.pcSendAnyway = function () { pcClose(); PC.sending = false; if (PC.onSend) PC.onSend(); };
  window.pcScan = pcScan;

  // Runs before "Save & Send" — only stops you when something needs fixing
  if (typeof pbAssignAndPush === 'function') {
    var _send = pbAssignAndPush;
    pbAssignAndPush = function () {
      var self = this, args = arguments;
      PC.onSend = function () { return _send.apply(self, args); };
      try {
        var L = typeof PB_STATE !== 'undefined' && PB_STATE && PB_STATE.weekData ? pcScan(PB_STATE) : [];
        if (L.some(function (i) { return i.lvl === 'red'; })) { PC.list = L; PC.sending = true; pcModal(true); return; }
      } catch (e) { console.warn('[program-check]', e); }
      return PC.onSend();
    };
  }
  // Button next to Save & Send
  function addButton() {
    if (document.getElementById('pc-btn')) return;
    var send = Array.prototype.find.call(document.querySelectorAll('button[onclick]'), function (b) { return b.getAttribute('onclick') === 'pbAssignAndPush()'; });
    if (!send) return;
    var b = document.createElement('button');
    b.id = 'pc-btn'; b.textContent = '✓ Program Check';
    b.title = 'Pairs, stacked lifts, tempo × reps (TUT) and set schemes — with one-click fixes';
    b.setAttribute('onclick', 'pcOpen(false)');
    b.style.cssText = 'width:100%;padding:8px;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.35);border-radius:7px;color:#86efac;font-size:11.5px;font-weight:700;cursor:pointer;';
    send.parentNode.insertBefore(b, send);
  }
  // "🔄 Insert deload week" next to the week actions (Apply to all weeks / More)
  function addDeloadButton() {
    if (document.getElementById('pc-deload-btn')) return;
    var anchor = Array.prototype.find.call(document.querySelectorAll('button[onclick]'), function (b) { return b.getAttribute('onclick') === 'pbApplyToAllWeeks()'; });
    if (!anchor) return;
    var b = document.createElement('button');
    b.id = 'pc-deload-btn'; b.textContent = '🔄 Insert deload week';
    b.title = 'Adds a deload copy of the selected week right after it — ~40% fewer sets, −10% load, no supra-max or combo eccentrics';
    b.setAttribute('onclick', 'pcInsertDeload()');
    b.style.cssText = 'padding:6px 12px;background:rgba(148,163,184,0.12);border:1px solid rgba(148,163,184,0.4);border-radius:6px;color:#cbd5e1;font-size:11px;font-weight:600;cursor:pointer;';
    anchor.parentNode.insertBefore(b, anchor);
  }
  // The builder can render after sign-in — keep checking until the Send button exists
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { addButton(); addDeloadButton(); }); else { addButton(); addDeloadButton(); }
  setInterval(function () { addButton(); addDeloadButton(); }, 2000);
})();
