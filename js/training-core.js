// ══════════════════════════════════════════════════════════════════════════
// TRAINING CORE — shared by the coach dashboard (index.html) and the athlete
// page (program.html). Pure functions over a program (pb_state) + its log
// (completion_log). No DOM, no storage.
//
// Log keys (written by program.html):
//   "wi-di-bi-ei-si" → { weight, actual_reps, time, done, t }   one set
//   "n:wi-di-bi-ei"  → { text, t }                             exercise note
//   "day:wi-di"      → { done, at, date, week, day, dayLabel, note, pain }
//   "ready:wi-di"    → { sleep, sore, energy, jump, level, points, date, t }
// ei counts only exercises that have a name.
// ══════════════════════════════════════════════════════════════════════════
var TC = (function () {
  var DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : null; }
  function lk(wi, di, bi, ei, si) { return wi + '-' + di + '-' + bi + '-' + ei + '-' + si; }
  function namedExs(block) { return ((block && block.exercises) || []).filter(function (e) { return e && e.name; }); }
  function localISO(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function parseISO(s) { var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function mround(x, to) { to = to || 5; return Math.round(x / to) * to; }

  // ── Prescription parsing ──
  function pctOf(ex) { var m = String(ex.load || '').match(/(\d+(?:\.\d+)?)\s*%/); return m ? parseFloat(m[1]) : null; }
  function targetReps(ex, s) {
    var r = String(ex.reps || '').trim();
    if (!r) return null;
    var list = r.replace(/[()]/g, '').split(/[,/]/).map(function (x) { return x.trim(); }).filter(Boolean);
    if (list.length > 1 && list.every(function (x) { return /^\d+/.test(x); })) return parseInt(list[Math.min(s, list.length - 1)]);
    var m = r.match(/^(\d+)\s*(ea|each|e)?$/i);
    return m ? parseInt(m[1]) : null;
  }
  function setCount(ex) { return Math.max(1, parseInt(ex.sets) || 1); }
  // Distance of one rep in feet: "10yd", "20 yd", "30 m", "50yd" in reps, "15yds"
  function repDistanceFt(ex) {
    var src = [ex.distance, ex.reps].map(function (x) { return String(x || ''); }).join(' ');
    var m = src.match(/(\d+(?:\.\d+)?)\s*(yd|yds|yard|yards|m|meter|meters|ft|feet)\b/i);
    if (!m) return 0;
    var v = parseFloat(m[1]), u = m[2].toLowerCase();
    if (u[0] === 'y') return v * 3;
    if (u[0] === 'm') return v * 3.281;
    return v;
  }
  function repsPerSet(ex) {
    var r = String(ex.reps || '').trim();
    if (/^\d+$/.test(r)) return parseInt(r);
    var m = r.match(/^(\d+)\s*x/i); if (m) return parseInt(m[1]);
    return 1;
  }
  function isSpeedBlock(block) { return block && (block.blockType === 'speed'); }
  function isRunEx(block, ex) {
    if (repDistanceFt(ex) <= 0) return false;
    if (isSpeedBlock(block) || block.blockType === 'esd') return true;
    return /sprint|accel|fly|run|tempo|shuttle|5-10-5|bound|skip|dribble|wicket|curve/i.test(ex.name || '');
  }
  // High-effort unless it's written as sub-max (pct < 85) or is tempo / ESD work
  function isHighEffort(block, ex) {
    if (block.blockType === 'esd') return false;
    if (/tempo|extensive|recovery|walk|jog/i.test(ex.name || '')) return false;
    var p = num(String(ex.pct || '').replace('%', ''));
    return !(p !== null && p < 85);
  }

  // ── Dates ──
  function dayDate(pb, wi, di) {
    var start = parseISO(pb && pb.startDate); if (!start) return null;
    var wk = pb.weekData[wi]; if (!wk) return null;
    var target = DAYS.indexOf((wk.days[di] || {}).day); if (target < 0) return null;
    var ws = new Date(start); ws.setDate(start.getDate() + wi * 7);
    var d = new Date(ws); d.setDate(ws.getDate() + ((target - ws.getDay() + 7) % 7));
    return d;
  }
  function dayHasWork(day) { return day && day.type !== 'off' && (day.blocks || []).some(function (b) { return b.blockType !== 'session-header' && namedExs(b).some(function (e) { return !e.rtpSkip; }); }); }

  // ── Strength: estimated 1RM from logged sets ──
  function epley(w, r) { w = num(w); r = num(r); if (!(w > 0) || !(r > 0) || r > 12) return null; return r === 1 ? w : w * (1 + r / 30); }
  function liftId(ex) { return ex.liftKey || ex.name; }
  // Best e1RM per lift per session, oldest → newest
  function liftSessions(pb, log) {
    var out = {};
    (pb.weekData || []).forEach(function (wk, wi) {
      (wk.days || []).forEach(function (day, di) {
        (day.blocks || []).forEach(function (b, bi) {
          if (b.blockType === 'session-header') return;
          namedExs(b).forEach(function (ex, ei) {
            if (pctOf(ex) === null && !ex.liftKey) return;
            var best = null, sets = [];
            for (var s = 0; s < setCount(ex); s++) {
              var e = log[lk(wi, di, bi, ei, s)];
              if (!e || !e.done) continue;
              var v = epley(e.weight, e.actual_reps);
              sets.push({ w: num(e.weight), r: num(e.actual_reps), target: targetReps(ex, s) });
              if (v && (!best || v > best)) best = v;
            }
            if (!best) return;
            var id = liftId(ex);
            (out[id] = out[id] || []).push({ wi: wi, di: di, e1rm: best, name: ex.name, base: num(ex.base1RM), sets: sets });
          });
        });
      });
    });
    return out;
  }
  function beforeDay(a, wi, di) { return a.wi < wi || (a.wi === wi && a.di < di); }
  // Working 1RM for a lift as of a given day: latest logged session before it
  // (avg with the one before, to smooth a single great/bad day). With a tested
  // 1RM, stays within 92–110% of it; without one, logs alone set it.
  function working1RM(pb, log, ex, wi, di, sessionsCache) {
    var sess = (sessionsCache || liftSessions(pb, log))[liftId(ex)] || [];
    var prior = sess.filter(function (s) { return beforeDay(s, wi, di); });
    var base = num(ex.base1RM);
    if (!prior.length) return base ? { oneRM: base, base: base, source: 'test' } : null;
    var last = prior.slice(-2).map(function (s) { return s.e1rm; });
    var est = last.reduce(function (a, v) { return a + v; }, 0) / last.length;
    if (base) est = Math.min(Math.max(est, base * 0.92), base * 1.10);
    return { oneRM: est, base: base, source: 'log', sessions: prior.length };
  }
  // Target lbs for an exercise on a day (before readiness adjustment)
  function autoLoad(pb, log, ex, wi, di, sessionsCache) {
    var pct = pctOf(ex);
    if (pct === null) {
      var fixed = String(ex.load || '').match(/^(\d+(?:\.\d+)?)\s*(lb|lbs)?$/i);
      return fixed ? { lbs: parseFloat(fixed[1]), how: 'fixed' } : (ex.calcWeight ? { lbs: ex.calcWeight, how: 'test' } : null);
    }
    var w = working1RM(pb, log, ex, wi, di, sessionsCache);
    if (!w) return ex.calcWeight ? { lbs: ex.calcWeight, how: 'test' } : null;
    var lbs = mround(pct / 100 * w.oneRM, 5);
    var was = ex.calcWeight || null;
    return { lbs: lbs, how: w.source, was: was, oneRM: Math.round(w.oneRM), pct: pct };
  }
  // Sets where logged reps came in under target, per exercise, for one day
  function sessionMisses(pb, log, wi, di) {
    var out = [], day = pb.weekData[wi].days[di];
    (day.blocks || []).forEach(function (b, bi) {
      if (b.blockType === 'session-header') return;
      namedExs(b).forEach(function (ex, ei) {
        var missed = 0, logged = 0;
        for (var s = 0; s < setCount(ex); s++) {
          var e = log[lk(wi, di, bi, ei, s)], tr = targetReps(ex, s);
          if (!e || !e.done || tr === null || !num(e.actual_reps)) continue;
          logged++;
          if (num(e.actual_reps) < tr) missed++;
        }
        if (logged && missed / logged >= 0.5) out.push({ name: ex.name, missed: missed, logged: logged });
      });
    });
    return out;
  }

  // ── Readiness check-in ──
  // sleep: '<6' | '6-7' | '7-8' | '8+' · sore/energy: 1–5 · jump: inches (optional)
  function readiness(r, bestJump) {
    var pts = 0, why = [];
    if (r.sleep === '<6') { pts += 2; why.push('under 6 hrs sleep'); } else if (r.sleep === '6-7') { pts += 1; why.push('6–7 hrs sleep'); }
    if (r.sore >= 4) { pts += 2; why.push('very sore'); } else if (r.sore === 3) { pts += 1; why.push('sore'); }
    if (r.energy && r.energy <= 2) { pts += 2; why.push('low energy'); } else if (r.energy === 3) { pts += 1; }
    var j = num(r.jump);
    if (j && bestJump) {
      var drop = (bestJump - j) / bestJump * 100;
      if (drop > 5) { pts += 2; why.push('jump ' + Math.round(drop) + '% under best'); } else if (drop > 3) { pts += 1; why.push('jump ' + Math.round(drop) + '% under best'); }
    }
    var level = pts >= 4 ? 'red' : pts >= 2 ? 'yellow' : 'green';
    return { level: level, points: pts, why: why };
  }
  function readinessAdjust(level) {
    if (level === 'red') return { loadMult: 0.90, dropSet: true, label: 'One less set on lifts and sprints · loads −10%' };
    if (level === 'yellow') return { loadMult: 0.95, dropSet: false, label: 'Loads −5%' };
    return { loadMult: 1, dropSet: false, label: 'Train as written' };
  }
  function bestJump(log) {
    var b = 0; Object.keys(log || {}).forEach(function (k) { if (k.indexOf('ready:') === 0) { var j = num(log[k].jump); if (j && j > b) b = j; } }); return b || null;
  }

  // ── Load completed on a day (for ACWR / workload) ──
  // Running: completed sets × reps × distance → feet. High-effort running
  // counts toward HE distance and total distance; tempo/ESD toward total only.

  // ── Live edits: stable ids + log remapping ──
  // Every day and exercise carries a uid. When a live program changes, old
  // positions are matched to new ones (by uid, then by name on the same day)
  // and completion_log keys are moved so logs stay with the right exercise.
  var _uidN = 0;
  function newUid() { return 'u' + Date.now().toString(36) + (++_uidN).toString(36) + Math.random().toString(36).slice(2, 6); }
  function ensureUids(st) {
    var seen = {};
    (st.weekData || []).forEach(function (wk) {
      (wk.days || []).forEach(function (day) {
        if (!day.uid || seen[day.uid]) day.uid = newUid();
        seen[day.uid] = 1;
        (day.blocks || []).forEach(function (b) {
          (b.exercises || []).forEach(function (ex) {
            if (!ex) return;
            if (!ex.uid || seen[ex.uid]) ex.uid = newUid();
            seen[ex.uid] = 1;
          });
        });
      });
    });
    return st;
  }
  function indexState(st) {
    var days = [], exs = [];
    (st.weekData || []).forEach(function (wk, wi) {
      (wk.days || []).forEach(function (day, di) {
        days.push({ pos: wi + '-' + di, wi: wi, di: di, uid: day.uid, day: day });
        (day.blocks || []).forEach(function (b, bi) {
          namedExs(b).forEach(function (ex, ei) {
            exs.push({ pos: wi + '-' + di + '-' + bi + '-' + ei, wi: wi, di: di, bi: bi, ei: ei, uid: ex.uid, dayUid: day.uid, name: String(ex.name).toLowerCase().trim(), ex: ex, block: b });
          });
        });
      });
    });
    return { days: days, exs: exs };
  }
  function rxText(ex) {
    var sr = ex.sets && ex.reps ? ex.sets + '×' + ex.reps : (ex.sets ? ex.sets + ' sets' : ex.reps || '');
    return [sr, ex.load || '', ex.distance && String(ex.reps || '').indexOf(ex.distance) < 0 ? ex.distance : ''].filter(Boolean).join(' ');
  }
  function dayName(st, wi, di) { var d = ((st.weekData[wi] || {}).days || [])[di]; return 'Wk ' + (wi + 1) + ' ' + (d ? d.day : ''); }
  // Returns { dayMap, exMap, changes }. Maps hold only positions that moved or
  // were removed (value null); anything not listed stays where it is.
  function buildRemap(oldSt, newSt) {
    var O = indexState(oldSt), N = indexState(newSt);
    var dayMap = {}, exMap = {}, changes = [];
    var newDayByUid = {}; N.days.forEach(function (d) { if (d.uid) newDayByUid[d.uid] = d; });
    var newDayPos = {}; N.days.forEach(function (d) { newDayPos[d.pos] = d; });
    var dayTo = {};   // old pos -> new day entry
    var claimedDay = {};
    O.days.forEach(function (d) { var n = d.uid && newDayByUid[d.uid]; if (n) { dayTo[d.pos] = n; claimedDay[n.pos] = 1; } });
    O.days.forEach(function (d) { if (!dayTo[d.pos] && newDayPos[d.pos] && !claimedDay[d.pos]) { dayTo[d.pos] = newDayPos[d.pos]; claimedDay[d.pos] = 1; } });
    O.days.forEach(function (d) { var n = dayTo[d.pos]; if (!n) dayMap[d.pos] = null; else if (n.pos !== d.pos) dayMap[d.pos] = n.pos; });
    // Exercises
    var newExByUid = {}; N.exs.forEach(function (e) { if (e.uid) newExByUid[e.uid] = e; });
    var claimed = {}, exTo = {};
    O.exs.forEach(function (e) { var n = e.uid && newExByUid[e.uid]; if (n && !claimed[n.pos]) { exTo[e.pos] = n; claimed[n.pos] = 1; } });
    var oldUids = {}; O.exs.forEach(function (e) { if (e.uid) oldUids[e.uid] = 1; });
    O.exs.forEach(function (e) {
      if (exTo[e.pos]) return;
      var nd = dayTo[e.wi + '-' + e.di]; if (!nd) return;
      var cand = N.exs.find(function (n) { return !claimed[n.pos] && n.wi === nd.wi && n.di === nd.di && n.name === e.name && !(n.uid && oldUids[n.uid]); });
      if (cand) { exTo[e.pos] = cand; claimed[cand.pos] = 1; }
    });
    O.exs.forEach(function (e) { var n = exTo[e.pos]; if (!n) exMap[e.pos] = null; else if (n.pos !== e.pos) exMap[e.pos] = n.pos; });
    // Plain-language change list (positions are the NEW program's)
    var per = {};
    function add(wi, di, t) { var k = wi + '-' + di; (per[k] = per[k] || { wi: wi, di: di, list: [] }).list.push(t); }
    // Whole weeks that shifted (a week inserted/removed before them) are reported once, not day by day
    var weekTo = {};
    (oldSt.weekData || []).forEach(function (wk, w) {
      var tgt = null, same = true;
      (wk.days || []).forEach(function (d, i) { var n = dayTo[w + '-' + i]; if (!n || n.di !== i) { same = false; return; } if (tgt === null) tgt = n.wi; else if (tgt !== n.wi) same = false; });
      if (same && tgt !== null && tgt !== w) weekTo[w] = tgt;
    });
    var newWeekHasOld = {}; O.days.forEach(function (d) { var n = dayTo[d.pos]; if (n) newWeekHasOld[n.wi] = 1; });
    var shifted = Object.keys(weekTo);
    if (shifted.length) {
      var ws = shifted.map(Number).sort(function (x, y) { return x - y; });
      changes.push({ wi: null, di: null, text: ws.length === 1 ? 'Week ' + (ws[0] + 1) + ' is now Week ' + (weekTo[ws[0]] + 1) : 'Weeks ' + (ws[0] + 1) + '–' + (ws[ws.length - 1] + 1) + ' moved ' + (weekTo[ws[0]] > ws[0] ? 'back ' : 'up ') + Math.abs(weekTo[ws[0]] - ws[0]) + ' week' + (Math.abs(weekTo[ws[0]] - ws[0]) === 1 ? '' : 's') });
    }
    (newSt.weekData || []).forEach(function (wk, w) {
      if (newWeekHasOld[w]) return;
      var ss = (wk.days || []).filter(dayHasWork).map(function (d) { return d.day + (d.label ? ' ' + d.label : ''); });
      changes.push({ wi: null, di: null, text: 'New Week ' + (w + 1) + (ss.length ? ': ' + ss.join(', ') : ' (rest week)') });
    });
    var isNewWeek = function (wi) { return !newWeekHasOld[wi]; };
    O.days.forEach(function (d) {
      var n = dayTo[d.pos];
      var had = dayHasWork(d.day);
      if (n && n.pos !== d.pos && had && weekTo[d.wi] === undefined) add(n.wi, n.di, 'moved from ' + (n.wi !== d.wi ? 'Wk ' + (d.wi + 1) + ' ' : '') + d.day.day);
      if (n && had && !dayHasWork(n.day)) add(n.wi, n.di, 'now a rest day');
    });
    N.days.forEach(function (n) {
      if (isNewWeek(n.wi)) return;
      var wasFrom = O.days.find(function (d) { return dayTo[d.pos] === n; });
      if (dayHasWork(n.day) && (!wasFrom || !dayHasWork(wasFrom.day))) add(n.wi, n.di, 'new session' + (n.day.label ? ' — ' + n.day.label : ''));
    });
    var addedBy = {}, removedBy = {};
    N.exs.forEach(function (n) {
      if (isNewWeek(n.wi)) return;
      var src = O.exs.find(function (e) { return exTo[e.pos] === n; });
      var nd = n.wi + '-' + n.di;
      if (!src) { if ((per[nd] || { list: [] }).list.some(function (t) { return /^new session/.test(t); })) return; (addedBy[nd] = addedBy[nd] || []).push(n.ex.name); return; }
      var a = rxText(src.ex), b = rxText(n.ex);
      if (a !== b && b) add(n.wi, n.di, n.ex.name + ' ' + (a || '—') + ' → ' + b);
    });
    O.exs.forEach(function (e) {
      if (exTo[e.pos]) return;
      var nd = dayTo[e.wi + '-' + e.di]; if (!nd || !dayHasWork(nd.day)) return;
      var k = nd.wi + '-' + nd.di; (removedBy[k] = removedBy[k] || []).push(e.ex.name);
    });
    Object.keys(addedBy).forEach(function (k) { var p = k.split('-'); add(+p[0], +p[1], 'added ' + addedBy[k].join(', ')); });
    Object.keys(removedBy).forEach(function (k) { var p = k.split('-'); add(+p[0], +p[1], 'removed ' + removedBy[k].join(', ')); });
    var ow = (oldSt.weekData || []).length, nw = (newSt.weekData || []).length;
    var dayLines = [];
    Object.keys(per).sort(function (a, b) { var x = a.split('-'), y = b.split('-'); return (+x[0] - +y[0]) || (+x[1] - +y[1]); }).forEach(function (k) {
      var g = per[k]; dayLines.push({ wi: g.wi, di: g.di, text: dayName(newSt, g.wi, g.di) + ': ' + g.list.slice(0, 4).join('; ') + (g.list.length > 4 ? ' +' + (g.list.length - 4) + ' more' : '') });
    });
    changes = dayLines.concat(changes);
    if (nw < ow) changes.push({ wi: null, di: null, text: 'Program is now ' + nw + ' week' + (nw === 1 ? '' : 's') });
    return { dayMap: dayMap, exMap: exMap, changes: changes };
  }
  // Move log keys per a remap. Removed items go to "arch:<ver>:<old key>".
  function applyRemap(log, rm, ver) {
    if (!log) return log;
    var out = {};
    Object.keys(log).forEach(function (k) {
      var m, nk = k;
      if ((m = k.match(/^(\d+-\d+-\d+-\d+)-(\d+)$/))) { if (m[1] in rm.exMap) nk = rm.exMap[m[1]] === null ? null : rm.exMap[m[1]] + '-' + m[2]; }
      else if ((m = k.match(/^n:(\d+-\d+-\d+-\d+)$/))) { if (m[1] in rm.exMap) nk = rm.exMap[m[1]] === null ? null : 'n:' + rm.exMap[m[1]]; }
      else if ((m = k.match(/^(day|ready):(\d+-\d+)$/))) { if (m[2] in rm.dayMap) nk = rm.dayMap[m[2]] === null ? null : m[1] + ':' + rm.dayMap[m[2]]; }
      if (nk === null) nk = 'arch:' + ver + ':' + k;
      out[nk] = log[k];
    });
    return out;
  }
  // Bring a log saved under structure version `fromVer` up to the program's current version
  function upgradeLog(log, pb, fromVer) {
    var v = +fromVer || 0;
    (pb.remaps || []).filter(function (r) { return r.v > v; }).sort(function (a, b) { return a.v - b.v; }).forEach(function (r) { log = applyRemap(log, r, r.v); });
    return log;
  }

  function dayLoad(pb, log, wi, di) {
    var day = pb.weekData[wi].days[di], he = 0, td = 0, liftSets = 0, tonnage = 0;
    (day.blocks || []).forEach(function (b, bi) {
      if (b.blockType === 'session-header') return;
      namedExs(b).forEach(function (ex, ei) {
        for (var s = 0; s < setCount(ex); s++) {
          var e = log[lk(wi, di, bi, ei, s)];
          if (!e || !e.done) continue;
          if (isRunEx(b, ex)) {
            var ft = repDistanceFt(ex) * repsPerSet(ex);
            td += ft; if (isHighEffort(b, ex)) he += ft;
          } else if (!isSpeedBlock(b)) {
            liftSets++;
            var w = num(e.weight), r = num(e.actual_reps);
            if (w && r) tonnage += w * r;
          }
        }
      });
    });
    return { he: Math.round(he), td: Math.round(td), liftSets: liftSets, tonnage: Math.round(tonnage) };
  }
  // Planned (not logged) running load for a day, for projections
  function plannedDayLoad(pb, wi, di) {
    var day = pb.weekData[wi].days[di], he = 0, td = 0, liftSets = 0;
    (day.blocks || []).forEach(function (b) {
      if (b.blockType === 'session-header') return;
      namedExs(b).forEach(function (ex) {
        if (ex.rtpSkip) return;
        var n = setCount(ex);
        if (isRunEx(b, ex)) { var ft = repDistanceFt(ex) * repsPerSet(ex) * n; td += ft; if (isHighEffort(b, ex)) he += ft; }
        else if (!isSpeedBlock(b)) liftSets += n;
      });
    });
    return { he: Math.round(he), td: Math.round(td), liftSets: liftSets };
  }

  return {
    DAYS: DAYS, num: num, lk: lk, namedExs: namedExs, localISO: localISO, parseISO: parseISO, mround: mround,
    pctOf: pctOf, targetReps: targetReps, setCount: setCount, repDistanceFt: repDistanceFt, repsPerSet: repsPerSet,
    isRunEx: isRunEx, isHighEffort: isHighEffort, dayDate: dayDate, dayHasWork: dayHasWork,
    epley: epley, liftId: liftId, liftSessions: liftSessions, working1RM: working1RM, autoLoad: autoLoad, sessionMisses: sessionMisses,
    readiness: readiness, readinessAdjust: readinessAdjust, bestJump: bestJump,
    dayLoad: dayLoad, plannedDayLoad: plannedDayLoad,
    newUid: newUid, ensureUids: ensureUids, buildRemap: buildRemap, applyRemap: applyRemap, upgradeLog: upgradeLog, rxText: rxText
  };
})();
