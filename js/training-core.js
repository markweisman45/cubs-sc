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
    dayLoad: dayLoad, plannedDayLoad: plannedDayLoad
  };
})();
