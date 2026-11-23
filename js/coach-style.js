// ══════════════════════════════════════════════════════════════════════════
// COACH STYLE — the AI programs like Mark, from Mark's library only
//   • Learns from every program you've saved (My Programs): block order, how
//     you pair A–E, your go-to exercises per phase, your sets/reps/tempo/rest
//     formats. Save more programs → it keeps learning. Nothing to train.
//   • Each AI request gets your most similar real days as worked examples.
//   • Library-only, enforced: anything the AI returns that isn't in your
//     library is matched to your exercise or replaced with the one you use
//     most in that category. The preview lists every fix.
//   • Adapts: real athlete position/group, builder phase, the rest of the
//     week, last week's same day, flags + RTP, and where he's training
//     (hotel / home equipment).
// Loaded after coach-loop.js; overrides callPBDesignAPI, pbAIApplyBlocksToDay,
// pbAIOpenWeekModal, pbAIGenerateWeek, pbAIGenerateFullTemplate, pbAIDesign.
// ══════════════════════════════════════════════════════════════════════════

var CS = (function () {
  // ── Library ────────────────────────────────────────────────────────────────
  var SYN = [[/\bdumbbells?\b/g, 'db'], [/\bbarbell\b/g, 'bb'], [/\bkettlebells?\b/g, 'kb'], [/\bmedicine ball\b|\bmed ball\b/g, 'mb'],
    [/\bsingle[- ]leg\b/g, 'sl'], [/\bsingle[- ]arm\b/g, 'sa'], [/\bhalf[- ]kneeling\b/g, 'hk'], [/\bromanian deadlift\b/g, 'rdl'],
    [/\brear[- ]foot[- ]elevated split squat\b|\bbulgarian split squat\b/g, 'rfess'], [/\bpull[- ]?ups?\b/g, 'pull up'], [/\bchin[- ]?ups?\b/g, 'chin up'],
    [/\bpush[- ]?ups?\b/g, 'push up'], [/\bhex bar\b/g, 'trap bar'], [/\bglute[- ]ham raise\b/g, 'ghr'], [/\bw\/\s*/g, 'with '], [/\bflye\b/g, 'fly']];
  function norm(s) {
    s = String(s || '').toLowerCase().replace(/\(video\)/g, ' ');
    SYN.forEach(function (p) { s = s.replace(p[0], p[1]); });
    return s.replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function toks(s) { return norm(s).split(' ').filter(function (t) { return t && t !== 'with' && t !== 'the' && t !== 'and'; }).map(function (t) { return t.length > 3 ? t.replace(/(es|s)$/, '') : t; }); }
  function lib() { return (typeof EXERCISE_DB !== 'undefined' ? EXERCISE_DB : []).filter(function (e) { return e && e.name; }); }
  var _idx = null, _idxSig = '';
  function libIndex() {
    var L = lib(), sig = L.length + '|' + (L[0] && L[0].name) + '|' + (L[L.length - 1] && L[L.length - 1].name);
    if (_idx && _idxSig === sig) return _idx;
    _idx = { byExact: {}, byNorm: {}, list: L.map(function (e) { return { e: e, t: toks(e.name) }; }) };
    L.forEach(function (e) { _idx.byExact[e.name.toLowerCase()] = e; var n = norm(e.name); if (!_idx.byNorm[n]) _idx.byNorm[n] = e; });
    _idxSig = sig;
    return _idx;
  }
  function inLibrary(name) { return libIndex().byExact[String(name || '').toLowerCase()] || null; }
  // Your exercise for a name the AI wrote: exact → same words → very close.
  function matchLibrary(name, cat) {
    var I = libIndex(), lo = String(name || '').toLowerCase();
    if (I.byExact[lo]) return { e: I.byExact[lo], how: 'exact' };
    var n = norm(name);
    if (I.byNorm[n]) return { e: I.byNorm[n], how: 'same' };
    var t = toks(name); if (!t.length) return null;
    var best = null, bestSc = 0;
    I.list.forEach(function (x) {
      var inter = 0; t.forEach(function (w) { if (x.t.indexOf(w) >= 0) inter++; });
      if (!inter) return;
      var jac = inter / (t.length + x.t.length - inter);
      if (cat && x.e.cat === cat) jac += 0.08;
      if (jac > bestSc) { bestSc = jac; best = x.e; }
    });
    return best && bestSc >= 0.72 ? { e: best, how: 'close' } : null;
  }

  // ── Your programs → style model ────────────────────────────────────────────
  function phaseKeyOf(text) {
    var t = String(text || '').toLowerCase();
    if (/realiz|peak/.test(t)) return 'realization';
    if (/deload|reload|restor|vacation|return to|\brtp\b|layoff/.test(t)) return 'reload';
    if (/in-?season/.test(t)) return 'inseason';
    if (/intensif|transmut|z4|relative strength|max strength/.test(t)) return 'intensification';
    if (/accum|z1|z2|z3|hypertroph|\bgpp\b|endurance/.test(t)) return 'accumulation';
    if (/power|ssc|spring|pre-?season|ramp/.test(t)) return 'power';
    return 'general';
  }
  var PHASE_NAMES = { realization: 'Realization / peaking', reload: 'Deload / reload', inseason: 'In-season', intensification: 'Intensification', accumulation: 'Accumulation', power: 'Power / pre-season', general: 'General' };
  var LABEL_TAGS = [['accel', /accel|first[- ]step|start/], ['maxv', /max ?v|max velocity|top speed|\bfly/], ['ub', /\bub\b|upper/], ['lb', /\blb\b|lower|leg/],
    ['cod', /\bcod\b|agility|change of dir/], ['decel', /decel|landing/], ['esd', /\besd\b|conditioning|aerobic|tempo/], ['strongman', /strongman|carry/],
    ['mobility', /mobility|recovery|restor|flush/], ['power', /power|plyo|jump|olympic/], ['speed', /speed|sprint|run/], ['full', /full[- ]body|total body/], ['game', /game|primer/], ['travel', /travel|hotel/]];
  function labelTags(label, day) {
    var t = String(label || '').toLowerCase(), out = {};
    LABEL_TAGS.forEach(function (p) { if (p[1].test(t)) out[p[0]] = 1; });
    if (day) (day.blocks || []).forEach(function (b) { if (b.blockType === 'speed') out.speed = 1; if (b.blockType === 'esd') out.esd = 1; });
    return out;
  }
  function namedExs(b) { return (b.exercises || []).filter(function (x) { return x && x.name; }); }
  function sourcePrograms() {
    var out = [];
    try { if (typeof SAVED_PROGRAMS !== 'undefined' && Array.isArray(SAVED_PROGRAMS)) out = SAVED_PROGRAMS.slice(); } catch (e) {}
    if (!out.length) { try { out = JSON.parse(localStorage.getItem('cubs_sc_programs_v1') || '[]'); } catch (e) {} }
    return out.filter(function (p) { return p && p.pbState && p.pbState.weekData; });
  }
  var _model = null, _modelSig = '';
  function model() {
    var progs = sourcePrograms();
    var sig = progs.length + '|' + progs.map(function (p) { return p.id; }).join(',').slice(-200) + '|' + lib().length;
    if (_model && _modelSig === sig) return _model;
    var M = { days: [], usage: {}, usageByPhase: {}, pairs: {}, presc: {}, catOf: {}, nDays: 0, nPrograms: progs.length };
    var seen = {};
    progs.forEach(function (p) {
      var st = p.pbState;
      (st.weekData || []).forEach(function (wk, wi) {
        var pk = phaseKeyOf((p.name || '') + ' ' + (p.meso || '') + ' ' + (wk.label || '') + ' ' + (st.phase || ''));
        if (wk.isDeload) pk = 'reload';
        (wk.days || []).forEach(function (day, di) {
          var blocks = (day.blocks || []).filter(function (b) { return b.blockType !== 'session-header' && namedExs(b).length; });
          if (!blocks.length) return;
          var names = []; blocks.forEach(function (b) { namedExs(b).forEach(function (x) { names.push(x.name); }); });
          var sig2 = names.join('|').toLowerCase();
          var dup = seen[sig2]; seen[sig2] = 1;
          names.forEach(function (n) {
            M.usage[n] = (M.usage[n] || 0) + 1;
            M.usageByPhase[pk] = M.usageByPhase[pk] || {};
            M.usageByPhase[pk][n] = (M.usageByPhase[pk][n] || 0) + 1;
          });
          if (dup) return;                     // copies (one per athlete) count toward usage, not as new examples
          blocks.forEach(function (b) {
            var byPair = {};
            namedExs(b).forEach(function (x) {
              var e = inLibrary(x.name), cat = (e && e.cat) || x.cat || '';
              if (cat) M.catOf[x.name] = cat;
              if (x.pair) (byPair[x.pair] = byPair[x.pair] || []).push(x.name);
              if (b.blockType !== 'speed' && b.blockType !== 'esd' && cat) {
                var key = pk + '|' + cat, P = M.presc[key] = M.presc[key] || { sr: {}, tempo: {}, rest: {}, load: {}, n: 0 };
                P.n++;
                if (x.sets || x.reps) P.sr[(x.sets || '?') + '×' + (x.reps || '?')] = (P.sr[(x.sets || '?') + '×' + (x.reps || '?')] || 0) + 1;
                if (x.tempo) P.tempo[x.tempo] = (P.tempo[x.tempo] || 0) + 1;
                if (x.rest) P.rest[x.rest] = (P.rest[x.rest] || 0) + 1;
                if (x.load) P.load[x.load] = (P.load[x.load] || 0) + 1;
              }
            });
            Object.keys(byPair).forEach(function (k) {
              var g = byPair[k]; if (g.length !== 2) return;
              var pr = g.slice().sort().join(' + ');
              M.pairs[pr] = (M.pairs[pr] || 0) + 1;
            });
          });
          M.days.push({ prog: p.name || '', athlete: st.athlete || p.athlete || '', phase: pk, week: wk.week || wi + 1, day: day.day, type: day.type, label: day.label || '', tags: labelTags(day.label, day), blocks: blocks, n: names.length, created: p.created || '' });
        });
      });
    });
    M.nDays = M.days.length;
    _model = M; _modelSig = sig;
    return M;
  }
  function top(obj, n) { return Object.keys(obj || {}).sort(function (a, b) { return obj[b] - obj[a]; }).slice(0, n); }
  function median(a) { if (!a.length) return 0; a = a.slice().sort(function (x, y) { return x - y; }); return a[Math.floor(a.length / 2)]; }

  // Your days most like the one being written
  function similarDays(target, k) {
    var M = model(), tt = target.tags || {};
    var scored = M.days.map(function (d) {
      var sc = 0;
      if (d.phase === target.phase) sc += 5; else if (d.phase === 'general' || target.phase === 'general') sc += 1;
      Object.keys(tt).forEach(function (t) { if (d.tags[t]) sc += 3; });
      Object.keys(d.tags).forEach(function (t) { if (!tt[t]) sc -= 1; });
      if (target.type && d.type === target.type) sc += 1;
      if (target.athlete && d.athlete === target.athlete) sc += 1.5;
      if (target.day && d.day === target.day) sc += 0.5;
      if (target.modTypes) { var bt = {}; d.blocks.forEach(function (b) { bt[b.blockType] = 1; }); target.modTypes.forEach(function (x) { if (bt[x]) sc += 1; }); }
      return { d: d, sc: sc };
    }).sort(function (a, b) { return b.sc - a.sc; });
    var out = [], progCount = {};
    for (var i = 0; i < scored.length && out.length < (k || 3); i++) {
      var d = scored[i].d;
      if ((progCount[d.prog] || 0) >= 2) continue;
      progCount[d.prog] = (progCount[d.prog] || 0) + 1;
      out.push(d);
    }
    return out;
  }
  function fmtEx(x) {
    var bits = [x.sets, x.reps, x.load || x.pct, x.distance, x.tempo, x.rest].filter(function (v) { return v !== undefined && v !== null && String(v).trim() !== ''; });
    return (x.pair || '-') + ' ' + x.name + (bits.length ? '  ' + bits.join(' · ') : '') + (x.notes ? '  "' + String(x.notes).slice(0, 60) + '"' : '');
  }
  function fmtDay(d) {
    var s = '[' + (PHASE_NAMES[d.phase] || d.phase) + ' · ' + d.day + ' "' + d.label + '"]\n';
    d.blocks.forEach(function (b) {
      s += '# ' + b.blockType + ' — ' + (b.label || '') + '\n';
      namedExs(b).forEach(function (x) { s += '  ' + fmtEx(x) + '\n'; });
    });
    return s;
  }
  function styleSummary(pk) {
    var M = model();
    if (!M.nDays) return '';
    var days = M.days.filter(function (d) { return d.phase === pk; }); if (days.length < 4) days = M.days;
    var sFirst = 0, withSpeed = 0, pairedLift = 0, liftEx = 0;
    days.forEach(function (d) {
      var main = d.blocks.filter(function (b) { return b.blockType !== 'prep' && b.blockType !== 'mobility'; });
      if (d.blocks.some(function (b) { return b.blockType === 'speed'; })) { withSpeed++; if (main[0] && main[0].blockType === 'speed') sFirst++; }
      d.blocks.forEach(function (b) { if (b.blockType === 'lift') namedExs(b).forEach(function (x) { liftEx++; if (x.pair) pairedLift++; }); });
    });
    var lines = [];
    lines.push('- Learned from ' + M.nDays + ' of his training days across ' + M.nPrograms + ' saved programs.');
    lines.push('- Typical day: ~' + median(days.map(function (d) { return d.n; })) + ' exercises in ~' + median(days.map(function (d) { return d.blocks.length; })) + ' blocks.');
    if (withSpeed) lines.push('- Speed block comes FIRST on ' + Math.round(100 * sFirst / withSpeed) + '% of days that have one. Speed exercises use "pct" (% effort) + "distance" + rest, and are lettered A, B, C… too (warm-up drills paired, sprints often single letters).');
    if (liftEx) lines.push('- ' + Math.round(100 * pairedLift / liftEx) + '% of lift exercises are paired: two exercises share a letter (A, A, B, B, C, C…), typically a main lift with a complementary power/core/arm-care exercise.');
    lines.push('- Formats he uses: tempo like "31X1" / "00X0" (4 chars), rest like ":30" / "1:30" / "2:00", reps like "8" / "4ea" / "20s", load like "70%" / "BW" / "Light".');
    var pu = M.usageByPhase[pk] && Object.keys(M.usageByPhase[pk]).length > 20 ? M.usageByPhase[pk] : M.usage;
    var byCat = {};
    top(pu, 400).forEach(function (n) { var c = M.catOf[n] || (inLibrary(n) || {}).cat; if (!c || !inLibrary(n)) return; (byCat[c] = byCat[c] || []).length < 6 && byCat[c].push(n); });
    var cats = Object.keys(byCat).sort(function (a, b) { return (pu[byCat[b][0]] || 0) - (pu[byCat[a][0]] || 0); }).slice(0, 18);
    if (cats.length) { lines.push('- His go-to exercises by category (most used first):'); cats.forEach(function (c) { lines.push('    ' + c + ': ' + byCat[c].join(', ')); }); }
    var pk2 = Object.keys(M.presc).filter(function (k) { return k.indexOf(pk + '|') === 0; });
    if (pk2.length < 4) pk2 = Object.keys(M.presc);
    pk2.sort(function (a, b) { return M.presc[b].n - M.presc[a].n; });
    var pl = [];
    pk2.slice(0, 12).forEach(function (k) { var P = M.presc[k]; var c = k.split('|')[1]; if (pl.some(function (x) { return x.indexOf(c + ':') === 0; })) return; pl.push(c + ': ' + [top(P.sr, 2).join(' or '), top(P.tempo, 1)[0], top(P.rest, 1)[0], top(P.load, 1)[0]].filter(Boolean).join(' · ')); });
    if (pl.length) { lines.push('- His usual prescriptions in this phase:'); pl.forEach(function (x) { lines.push('    ' + x); }); }
    var pr = top(M.pairs, 12).filter(function (k) { return M.pairs[k] >= 2; });
    if (pr.length) lines.push('- Pairings he repeats: ' + pr.join('; '));
    return lines.join('\n');
  }
  function prescFor(pk, cat) {
    var M = model(), P = M.presc[pk + '|' + cat];
    if (!P || P.n < 3) { var best = null; Object.keys(M.presc).forEach(function (k) { if (k.split('|')[1] === cat && (!best || M.presc[k].n > best.n)) best = M.presc[k]; }); P = best; }
    if (!P) return null;
    var sr = (top(P.sr, 1)[0] || '').split('×');
    return { sets: sr[0] && sr[0] !== '?' ? sr[0] : '', reps: sr[1] && sr[1] !== '?' ? sr[1] : '', tempo: top(P.tempo, 1)[0] || '', rest: top(P.rest, 1)[0] || '', load: top(P.load, 1)[0] || '' };
  }

  // ── Athlete / situation ────────────────────────────────────────────────────
  function positionKeyFor(athlete) {
    var p = (typeof PLAYERS !== 'undefined' && PLAYERS[athlete]) || null, pos = p && String(p.pos || '').toUpperCase();
    if (!pos) return 'position_player';
    if (typeof isClientPos === 'function' && isClientPos(pos)) return 'client';
    if (typeof isPitcherPos === 'function' && isPitcherPos(pos)) return 'pitcher';
    if (pos === 'C') return 'catcher';
    if (/^(LF|CF|RF|OF)$/.test(pos)) return 'outfielder';
    if (/^(1B|2B|3B|SS|IF|UT|UTIL)$/.test(pos)) return 'infielder';
    return 'position_player';
  }
  function athleteNotes(athlete) {
    var out = [];
    if (!athlete || athlete === '(Sandbox)') return out;
    try { if (typeof computePlayerFlags === 'function') computePlayerFlags(athlete).slice(0, 5).forEach(function (f) { out.push((f.level === 'red' ? 'RED' : 'flag') + ': ' + f.text); }); } catch (e) {}
    try { if (typeof rtpActive === 'function') { var r = rtpActive(athlete); if (r) out.push('In return-to-performance: ' + (r.protocol.name || r.protocol.injury || 'injury') + ' — phase ' + (r.idx + 1) + (r.phase && r.phase.name ? ' (' + r.phase.name + ')' : '') + '. Respect its limits.'); } } catch (e) {}
    try { if (typeof EQUIP !== 'undefined' && EQUIP[athlete] && EQUIP[athlete].note) out.push('Equipment note: ' + EQUIP[athlete].note); } catch (e) {}
    return out;
  }
  function dayBrief(day) {
    var names = [];
    (day.blocks || []).forEach(function (b) { namedExs(b).forEach(function (x) { names.push(x.name + (x.load ? ' ' + x.load : x.pct ? ' ' + x.pct : '')); }); });
    return names.length ? day.day + ' "' + (day.label || '') + '": ' + names.slice(0, 10).join(', ') + (names.length > 10 ? ' …' : '') : '';
  }
  function haveFor(location, athlete) {
    if (typeof equipmentFor !== 'function' || !location || location === 'facility') return null;
    return equipmentFor(location, athlete);
  }
  function libraryText(have, pk) {
    var M = model(), pu = (M.usageByPhase[pk] && Object.keys(M.usageByPhase[pk]).length > 20) ? M.usageByPhase[pk] : M.usage;
    var byCat = {};
    lib().forEach(function (e) {
      if (have && typeof exEquipment === 'function' && !hasAll(exEquipment(e.name), have)) return;
      var c = e.cat || 'Other'; (byCat[c] = byCat[c] || []).push(e);
    });
    var n = 0;
    var txt = Object.keys(byCat).sort().map(function (c) {
      var L = byCat[c].sort(function (a, b) { return (pu[b.name] || M.usage[b.name] || 0) - (pu[a.name] || M.usage[a.name] || 0) || (a.name < b.name ? -1 : 1); });
      n += L.length;
      return '[' + c + '] ' + L.map(function (e) { var u = M.usage[e.name] || 0; return e.name + (u >= 8 ? ' ★★' : u >= 2 ? ' ★' : ''); }).join('; ');
    }).join('\n');
    return { text: txt, count: n };
  }

  // ── Prompt ─────────────────────────────────────────────────────────────────
  var POS_TEXT = {
    position_player: 'baseball position player — rotational power, hip strength, first-step quickness, deceleration',
    pitcher: 'baseball pitcher — arm care CRITICAL: no heavy overhead pressing, posterior cuff, scapular stability, hip ER, thoracic rotation; jumps and lifting, no baseball metrics',
    catcher: 'baseball catcher — deep squat tolerance, hip ER, ankle mobility, posterior shoulder, single-leg stability',
    outfielder: 'baseball outfielder — linear speed, first step, max velocity, deceleration',
    infielder: 'baseball infielder — lateral quickness, first step, hip ER, rotational power',
    client: 'private client (adult, not a pro athlete) — general athletic development and strength, joint-friendly choices, sensible volume, no sport-specific baseball work'
  };
  function buildPrompt(ctx, T) {
    var pk = T.phase, M = model();
    var examples = similarDays(T, 3);
    var have = haveFor(ctx.location, ctx.athleteName);
    var L = libraryText(have, pk);
    var posTxt = POS_TEXT[ctx.positionKey] || (typeof ctx.position === 'string' ? ctx.position.replace(/_/g, ' ') : 'baseball player');
    var target = ctx.totalExercises || ctx.exCount || (examples.length ? median(examples.map(function (d) { return d.n; })) : 14);
    var lines = [];
    lines.push('You are writing ONE training day as Coach Mark Weisman (pro baseball strength & conditioning). Program exactly the way HE programs — his block order, pairing, exercise choices, naming and prescription formats — not a generic template.');
    lines.push('');
    lines.push('HOW HE PROGRAMS (learned from his saved programs):');
    lines.push(styleSummary(pk) || '- (No saved programs yet — speed first, paired A–E lifts.)');
    if (examples.length) {
      lines.push('');
      lines.push('HIS REAL DAYS MOST LIKE THIS ONE — copy this structure and style:');
      examples.forEach(function (d, i) { lines.push('Example ' + (i + 1) + ' ' + fmtDay(d)); });
    }
    lines.push('');
    lines.push('THIS DAY:');
    lines.push('- Athlete: ' + (ctx.athleteName && ctx.athleteName !== '(Sandbox)' ? ctx.athleteName : 'athlete') + ' — ' + posTxt);
    lines.push('- Phase: ' + (PHASE_NAMES[pk] || pk) + (ctx.phaseLabel ? ' (builder phase: ' + ctx.phaseLabel + ')' : '') + ' · Week ' + ctx.weekNum + ' of ' + ctx.totalWeeks + (ctx.isDeload ? ' · DELOAD week' : ''));
    var pm = ctx.progMod || {};
    if (pm.sets || pm.reps || pm.load) lines.push('- This week\'s progression vs base: sets ×' + (+pm.sets || 1).toFixed(2) + ', reps ×' + (+pm.reps || 1).toFixed(2) + ', load ×' + (+pm.load || 1).toFixed(2));
    lines.push('- Day: ' + (ctx.dayName || '') + ' "' + (ctx.dayLabel || '') + '" (' + (ctx.dayType || 'lift') + ')');
    if (ctx.structure) lines.push('- Blocks: ' + ctx.structure);
    else lines.push('- Blocks: build it the way he builds a day labeled "' + (ctx.dayLabel || ctx.dayType) + '" (follow the examples).');
    lines.push('- About ' + target + ' exercises total.');
    if (have) lines.push('- Training at: ' + ctx.locationLabel + '. Equipment available ONLY: ' + have.map(function (id) { var x = (typeof EQUIP_LIST !== 'undefined' ? EQUIP_LIST : []).find(function (y) { return y[0] === id; }); return x ? x[1] : id; }).join(', ') + ' (+ bodyweight). The list below is already filtered to what he can do there.');
    (ctx.athleteNotes || []).forEach(function (n) { lines.push('- ' + n); });
    if (ctx.weekSoFar && ctx.weekSoFar.length) { lines.push('- Already programmed this week (balance against these; don\'t repeat the same primary lift pattern on back-to-back days; no heavy lower body the day before max-velocity sprinting):'); ctx.weekSoFar.forEach(function (s) { lines.push('    ' + s); }); }
    if (ctx.lastWeekSameDay) lines.push('- Same day LAST week: ' + ctx.lastWeekSameDay + '\n  → Keep his primary lifts and speed drills consistent week to week and progress them; rotate accessories only when it fits his pattern.');
    if (ctx.extraContext) lines.push('- COACH NOTES (follow these over everything else): ' + ctx.extraContext);
    lines.push('');
    lines.push('ALLOWED EXERCISES — his library (' + L.count + '). Use names EXACTLY as written; anything else is rejected. ★ = he uses it, ★★ = a staple. Prefer starred exercises.');
    lines.push(L.text);
    lines.push('');
    lines.push('Reply with ONLY compact JSON, no markdown:');
    lines.push('{"blocks":[{"blockType":"speed","label":"Acceleration Block","exercises":[{"pair":"A","name":"…","sets":"2","reps":"2","distance":"10yd","pct":"75%","rest":":30","notes":"short cue"}]},{"blockType":"lift","label":"Strength Block","exercises":[{"pair":"A","name":"…","sets":"4","reps":"4","load":"75%","tempo":"31X1","rest":"1:30","notes":"short cue"}]}],"rationale":"2 sentences: why this day, in his terms"}');
    lines.push('blockType is one of: speed, lift, esd, prep, mobility. Omit empty fields. Notes ≤ 8 words.');
    return lines.join('\n');
  }

  // ── Library enforcement + style fill ───────────────────────────────────────
  function replaceWithStyle(name, cat, blockType, used, have, pk) {
    var M = model(), t = toks(name);
    var fam = typeof subFamilies === 'function' ? subFamilies(String(name).toLowerCase()) : [];
    if (!cat) { var votes = {}; libIndex().list.forEach(function (x) { var inter = 0; t.forEach(function (w) { if (x.t.indexOf(w) >= 0) inter++; }); if (inter && x.e.cat) votes[x.e.cat] = (votes[x.e.cat] || 0) + inter; }); cat = top(votes, 1)[0] || ''; }
    var pu = M.usageByPhase[pk] || {};
    var best = null, bestSc = -1e9;
    libIndex().list.forEach(function (x) {
      var e = x.e; if (used[e.name.toLowerCase()]) return;
      if (have && typeof exEquipment === 'function' && !hasAll(exEquipment(e.name), have)) return;
      var sc = 0;
      if (cat && e.cat === cat) sc += 6;
      t.forEach(function (w) { if (x.t.indexOf(w) >= 0) sc += 2; });
      if (fam.length && typeof subFamilies === 'function' && subFamilies(e.name).some(function (f) { return fam.indexOf(f) >= 0; })) sc += 4;
      sc += Math.min(5, Math.log(1 + (pu[e.name] || 0) * 2 + (M.usage[e.name] || 0)) * 1.6);
      if (blockType === 'speed' && /Performance Prep|Acceleration|Max Velocity|LB Plyos|COD|Agility/i.test(e.cat || '')) sc += 2;
      if (sc > bestSc) { bestSc = sc; best = e; }
    });
    return bestSc >= 6 ? best : null;
  }
  var BT = { speed: 'speed', lift: 'lift', esd: 'esd', prep: 'prep', mobility: 'mobility', conditioning: 'esd', warmup: 'prep', 'warm-up': 'prep', power: 'lift', strength: 'lift' };
  function validate(result, ctx, T) {
    var have = haveFor(ctx.location, ctx.athleteName);
    var fixes = [], used = {};
    var blocks = (result && Array.isArray(result.blocks)) ? result.blocks : [];
    blocks.forEach(function (b) {
      b.blockType = BT[String(b.blockType || '').toLowerCase()] || 'lift';
      var out = [];
      (b.exercises || []).forEach(function (x) {
        if (!x || !x.name) return;
        var hint = x.cat || '';
        var m = matchLibrary(x.name, hint), e = m && m.e;
        if (e && have && typeof exEquipment === 'function' && !hasAll(exEquipment(e.name), have)) {
          var sub = typeof findSubstitute === 'function' ? findSubstitute({ name: e.name, cat: e.cat, load: x.load }, have, { envKey: ctx.location, exclude: used }) : null;
          if (sub) fixes.push(e.name + ' → ' + sub.name + ' (equipment)'); e = sub;
        }
        if (e && used[e.name.toLowerCase()]) e = null;
        if (!e) {
          var r = replaceWithStyle(x.name, hint || (m && m.e && m.e.cat), b.blockType, used, have, T.phase);
          if (r) fixes.push('"' + x.name + '" isn\'t in your library → ' + r.name); else fixes.push('"' + x.name + '" isn\'t in your library → removed');
          e = r;
        } else if (m && m.how === 'close' && e.name !== x.name) fixes.push('"' + x.name + '" → ' + e.name);
        if (!e) return;
        used[e.name.toLowerCase()] = 1;
        x.name = e.name; x.cat = e.cat || x.cat || '';
        if (b.blockType === 'speed' || b.blockType === 'esd') {
          if (!x.pct && /%/.test(String(x.load || ''))) x.pct = x.load;
        } else if (b.blockType === 'lift') {
          var P = prescFor(T.phase, x.cat);
          if (P) ['sets', 'reps', 'tempo', 'rest', 'load'].forEach(function (f) { if (!x[f] && P[f]) x[f] = P[f]; });
        }
        ['sets', 'reps', 'rest', 'tempo', 'distance', 'pct', 'load'].forEach(function (f) { if (x[f] !== undefined && x[f] !== null) x[f] = String(x[f]); });
        out.push(x);
      });
      // Pair letters: lift-type blocks get A,A,B,B… if the AI skipped them
      if (b.blockType === 'lift' && out.length && out.every(function (x) { return !x.pair; })) out.forEach(function (x, i) { x.pair = 'ABCDEFGH'[Math.floor(i / 2)] || ''; });
      b.exercises = out;
    });
    result.blocks = blocks.filter(function (b) { return b.exercises.length; });
    result.fixes = fixes;
    return result;
  }

  // ── API call ───────────────────────────────────────────────────────────────
  function parseJSON(text) {
    var clean = String(text || '').replace(/```json|```/g, '').trim();
    var a = clean.indexOf('{'), z = clean.lastIndexOf('}');
    if (a < 0 || z <= a) throw new Error('cut');
    return JSON.parse(clean.slice(a, z + 1));
  }
  async function callAI(prompt) {
    var res = await fetch(SUPA_URL + '/functions/v1/enrich-exercise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPA_KEY, 'apikey': SUPA_KEY },
      body: JSON.stringify({ mode: 'program_design', prompt: prompt, max_tokens: 4000 })
    });
    if (!res.ok) { var e = await res.text(); throw new Error('AI service error ' + res.status + ': ' + e.slice(0, 200)); }
    var data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.result || data.text || '';
  }
  async function design(ctx) {
    var T = { phase: ctx.phaseKey, tags: labelTags(ctx.dayLabel + ' ' + (ctx.structure || '')), type: ctx.dayType, athlete: ctx.athleteName, day: ctx.dayName, modTypes: ctx.modTypes };
    var prompt = buildPrompt(ctx, T), text, result;
    text = await callAI(prompt);
    try { result = parseJSON(text); }
    catch (e) {
      text = await callAI(prompt + '\n\nIMPORTANT: your last reply was cut off or invalid. Reply again with shorter notes (≤5 words) and no rationale beyond one sentence.');
      try { result = parseJSON(text); } catch (e2) { throw new Error('The AI reply was cut off twice — try fewer exercises.'); }
    }
    return validate(result, ctx, T);
  }

  // ── Context from the builder ───────────────────────────────────────────────
  function locationOfDay(wk, day, fallback) { return (day && day.location) || (wk && wk.location) || fallback || 'facility'; }
  function locLabel(id) { var li = typeof locationInfo === 'function' ? locationInfo(id) : null; return li ? li.icon + ' ' + li.label : id; }
  function builderContext(weekIdx, dayIdx, over) {
    over = over || {};
    var st = PB_STATE, wk = st.weekData[weekIdx], day = wk.days[dayIdx];
    var athlete = st.athlete || '(Sandbox)';
    var phaseText = (st.programName || st.name || '') + ' ' + (wk.label || '') + ' ' + (st.phase || '') + ' ' + (over.phaseHint || '');
    var pk = over.phaseKey || phaseKeyOf(phaseText);
    if (wk.isDeload) pk = 'reload';
    var weekSoFar = wk.days.map(function (d, i) { return i === dayIdx || (over.contextDays && over.contextDays.indexOf(i) < 0) ? '' : dayBrief(d); }).filter(Boolean);
    var lastWeek = weekIdx > 0 ? dayBrief(st.weekData[weekIdx - 1].days[dayIdx] || {}) : '';
    var loc = over.location || locationOfDay(wk, day, 'facility');
    return {
      athleteName: athlete, positionKey: over.positionKey || (athlete !== '(Sandbox)' ? positionKeyFor(athlete) : 'position_player'),
      phaseKey: pk, phaseLabel: st.phase || '', weekNum: wk.week, totalWeeks: st.weeks || st.weekData.length, isDeload: !!wk.isDeload, progMod: wk.progMod,
      dayName: day.day, dayLabel: day.label || '', dayType: day.type, weekSoFar: weekSoFar, lastWeekSameDay: lastWeek,
      location: loc, locationLabel: locLabel(loc), athleteNotes: athleteNotes(athlete),
      extraContext: over.extraContext || '', structure: over.structure || '', totalExercises: over.totalExercises || 0, exCount: over.exCount || 0, modTypes: over.modTypes
    };
  }

  return {
    model: model, usage: function () { return model().usage; }, styleSummary: styleSummary, similarDays: similarDays, fmtDay: fmtDay,
    phaseKeyOf: phaseKeyOf, PHASE_NAMES: PHASE_NAMES, positionKeyFor: positionKeyFor, matchLibrary: matchLibrary, inLibrary: inLibrary,
    design: design, builderContext: builderContext, buildPrompt: buildPrompt, validate: validate, labelTags: labelTags, locLabel: locLabel
  };
})();

// ══════════════════════════════════════════════════════════════════════════
// Builder hooks
// ══════════════════════════════════════════════════════════════════════════
var _CS_POS_FROM_SELECT = { position_player: 'position_player', pitcher: 'pitcher', catcher: 'catcher', outfielder: 'outfielder', infielder: 'infielder' };
var _CS_PHASE_FROM_SELECT = { offseason: '', preseason: 'power', inseason: 'inseason', postseason: 'reload' };

// Same entry point the single-day AI modal already uses — now style-driven and library-locked.
async function callPBDesignAPI(ctx) {
  var wi = ctx.weekIdx != null ? ctx.weekIdx : (PB_ACTIVE_DAY ? PB_ACTIVE_DAY.weekIdx : 0);
  var di = ctx.dayIdx != null ? ctx.dayIdx : (PB_ACTIVE_DAY ? PB_ACTIVE_DAY.dayIdx : 0);
  var structure = '';
  if (ctx.designMode === 'day' && ctx.modalities && ctx.modalities.length) {
    structure = ctx.modalities.map(function (id) { var m = PB_MODALITIES.find(function (x) { return x.id === id; }); return m ? m.label + ' (blockType ' + m.blockType + ')' : id; }).join(' → ');
  } else if (ctx.designMode !== 'day' && ctx.sessionType) {
    var st = { lower_hinge: 'lower body, hinge dominant', lower_knee: 'lower body, knee dominant', upper_push: 'upper body, push dominant', upper_pull: 'upper body, pull dominant', full_body: 'full body', power: 'power / Olympic', speed_acc: 'speed — acceleration', speed_mv: 'speed — max velocity', arm_care: 'arm care', decel_rehab: 'deceleration / injury prevention' };
    structure = 'one ' + (st[ctx.sessionType] || ctx.sessionType) + ' session in 2–4 blocks, his pairing';
  }
  var over = {
    extraContext: ctx.extraContext, structure: structure,
    totalExercises: ctx.designMode === 'day' ? ctx.totalExercises : 0, exCount: ctx.designMode === 'day' ? 0 : ctx.exCount,
    location: ctx.location, modTypes: (ctx.modalities || []).map(function (id) { var m = PB_MODALITIES.find(function (x) { return x.id === id; }); return m && m.blockType; }).filter(Boolean)
  };
  if (ctx.position && _CS_POS_FROM_SELECT[ctx.position] && ctx.positionChosen) over.positionKey = ctx.position;
  if (ctx.position && !_CS_POS_FROM_SELECT[ctx.position]) over.positionKey = ctx.position;   // football / hockey / basketball picks
  if (ctx.phase && _CS_PHASE_FROM_SELECT[ctx.phase] && ctx.phaseChosen) over.phaseKey = _CS_PHASE_FROM_SELECT[ctx.phase];
  var full = CS.builderContext(wi, di, over);
  if (over.positionKey && !/^(position_player|pitcher|catcher|outfielder|infielder|client)$/.test(over.positionKey)) full.position = over.positionKey;
  var result = await CS.design(full);
  if (result.fixes && result.fixes.length) result.rationale = (result.rationale || '') + '\n🔒 Library check: ' + result.fixes.join(' · ');
  return result;
}

// Keep pair letters, tempo and load on speed exercises (his speed blocks are lettered)
function pbAIApplyBlocksToDay(day, blocks, replace) {
  if (replace) day.blocks = [];
  var toInsert = blocks || [];
  if (toInsert.length === 1 && (toInsert[0].exercises || []).length >= 5 && typeof pbAIAutoSplit === 'function') toInsert = pbAIAutoSplit(toInsert[0]);
  toInsert.forEach(function (block) {
    var bt = block.blockType || 'lift';
    var exs = (block.exercises || []).map(function (ex) {
      var dbEx = CS.inLibrary(ex.name);
      var base = { name: ex.name || '', cat: (dbEx && dbEx.cat) || ex.cat || '', pair: ex.pair || '', sets: ex.sets || '', reps: ex.reps || '', rest: ex.rest || '', notes: ex.notes || '' };
      if (dbEx && dbEx.video) base.video = dbEx.video;
      if (bt === 'speed' || bt === 'esd') return Object.assign(base, { type: 'speed', distance: ex.distance || '', pct: ex.pct || '' });
      return Object.assign(base, { type: 'lift', load: ex.load || '', tempo: ex.tempo || '' });
    });
    day.blocks.push({ blockType: bt, label: block.label || '', exercises: exs });
  });
  return toInsert.reduce(function (n, b) { return n + (b.exercises || []).length; }, 0);
}

// Single-day modal: add a location picker, lock the library, default position/phase from the athlete
(function () {
  var _origDesign = typeof pbAIDesign === 'function' ? pbAIDesign : null;
  var _origGenerate = typeof pbAIGenerate === 'function' ? pbAIGenerate : null;
  window.pbAIDesign = function () {
    if (_origDesign) _origDesign.apply(this, arguments);
    if (!PB_ACTIVE_DAY) return;
    var wk = PB_STATE.weekData[PB_ACTIVE_DAY.weekIdx], day = wk.days[PB_ACTIVE_DAY.dayIdx];
    var cb = document.getElementById('pbai-use-library');
    if (cb) { cb.checked = true; cb.disabled = true; var lab = cb.parentNode.querySelector('label'); if (lab) lab.innerHTML = '🔒 Your library only (' + (typeof EXERCISE_DB !== 'undefined' ? EXERCISE_DB.filter(function (e) { return e && e.name; }).length : 0) + ' exercises) · learns from ' + CS.model().nDays + ' of your days <a href="#" onclick="csShowStyle();return false;" style="color:#6BA3F8;margin-left:6px;">what it learned</a>'; }
    var posSel = document.getElementById('pbai-position');
    if (posSel && PB_STATE.athlete && PB_STATE.athlete !== '(Sandbox)') {
      var pk = CS.positionKeyFor(PB_STATE.athlete);
      if (pk === 'client') { if (!posSel.querySelector('option[value="client"]')) { var o = document.createElement('option'); o.value = 'client'; o.textContent = 'Private client'; posSel.insertBefore(o, posSel.firstChild); } }
      posSel.value = pk; posSel.dataset.auto = pk;
    }
    var phSel = document.getElementById('pbai-phase-sel'); if (phSel) phSel.dataset.auto = phSel.value;
    var host = document.getElementById('pbai-mode-sel');
    if (host && !document.getElementById('pbai-location')) {
      var wrap = host.parentNode.parentNode;
      var d = document.createElement('div');
      d.style.cssText = 'margin:-4px 0 12px;';
      d.innerHTML = '<label style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px;">Training location</label>'
        + '<select id="pbai-location" style="width:100%;background:var(--bg3);border:1px solid var(--border2);border-radius:6px;padding:7px 10px;color:var(--text);font-size:12px;">'
        + '<option value="facility">🏟 Facility (full gym)</option><option value="home">🏠 Home gym</option><option value="hotel_gym">🏨 Hotel gym</option><option value="hotel_room">🧳 Hotel room / bodyweight</option></select>';
      wrap.parentNode.insertBefore(d, wrap.nextSibling);
    }
    var ls = document.getElementById('pbai-location'); if (ls) ls.value = day.location || wk.location || 'facility';
  };
  // Pass location + "did the coach change position/phase" into the AI call
  var _origCall = callPBDesignAPI;
  window.callPBDesignAPI = function (ctx) {
    var ls = document.getElementById('pbai-location');
    var modalOpen = !!(document.getElementById('pbAIModal') && getComputedStyle(document.getElementById('pbAIModal')).display !== 'none');
    if (modalOpen && ctx.location == null && ls) ctx.location = ls.value;
    var posSel = document.getElementById('pbai-position'), phSel = document.getElementById('pbai-phase-sel');
    if (modalOpen && posSel && ctx.position === posSel.value) ctx.positionChosen = posSel.dataset.auto !== posSel.value;
    if (modalOpen && phSel && ctx.phase === phSel.value) ctx.phaseChosen = phSel.dataset.auto !== phSel.value;
    return _origCall(ctx);
  };
  void _origGenerate;
})();

// "What it learned" — your style summary, readable
function csShowStyle() {
  var pk = CS.phaseKeyOf((PB_STATE.programName || PB_STATE.name || '') + ' ' + (PB_STATE.phase || ''));
  var M = CS.model();
  var m = document.createElement('div');
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:10001;display:flex;align-items:center;justify-content:center;padding:16px;';
  m.innerHTML = '<div style="background:#1a1f2e;border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:20px;width:680px;max-width:100%;max-height:90vh;overflow-y:auto;">'
    + '<div style="font-size:17px;font-weight:700;color:#fff;">🧠 How the AI sees your programming</div>'
    + '<div style="font-size:12px;color:var(--text3);margin:4px 0 12px;line-height:1.5;">Built from every program in My Programs (' + M.nPrograms + ' programs, ' + M.nDays + ' unique days). It updates on its own — save or edit programs and the AI follows. Shown for: <b style="color:#cbd5e1;">' + escHtml(CS.PHASE_NAMES[pk] || pk) + '</b>.</div>'
    + '<pre style="white-space:pre-wrap;font-size:11px;line-height:1.55;color:#e2e8f0;background:#0d1117;border-radius:8px;padding:12px;font-family:\'DM Mono\',monospace;">' + escHtml(CS.styleSummary(pk) || 'No saved programs yet.') + '</pre>'
    + '<div style="text-align:right;margin-top:12px;"><button style="padding:8px 14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:6px;color:#94a3b8;font-size:12px;cursor:pointer;">Close</button></div></div>';
  m.querySelector('button').onclick = function () { m.remove(); };
  m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
  document.body.appendChild(m);
}

// ── AI Generate Week — adaptive ─────────────────────────────────────────────
function pbAIOpenWeekModal(weekIdx, opts) {
  opts = opts || {};
  if (!PB_STATE.weekData.length) { alert('Build a program first'); return; }
  weekIdx = weekIdx != null ? weekIdx : (PB_ACTIVE_DAY ? PB_ACTIVE_DAY.weekIdx : 0);
  var wk = PB_STATE.weekData[weekIdx];
  var trainingDays = wk.days.filter(function (d) { return d.type !== 'off'; });
  if (!trainingDays.length) { alert('This week has no training days to fill'); return; }
  var athlete = PB_STATE.athlete || '(Sandbox)';
  var autoPos = athlete !== '(Sandbox)' ? CS.positionKeyFor(athlete) : 'position_player';
  var autoPhase = CS.phaseKeyOf((PB_STATE.programName || PB_STATE.name || '') + ' ' + (wk.label || '') + ' ' + (PB_STATE.phase || ''));
  var M = CS.model();
  var sel = 'width:100%;background:var(--bg3);border:1px solid var(--border2);border-radius:6px;padding:7px 10px;color:var(--text);font-size:12px;';
  var lab = 'font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;display:block;margin:12px 0 5px;';
  var modOptions = PB_MODALITIES.map(function (m) {
    return '<label style="display:flex;align-items:center;gap:7px;padding:3px 0;font-size:12px;color:#fff;cursor:pointer;"><input type="checkbox" class="pbai-week-mod" value="' + m.id + '"> ' + m.icon + ' ' + m.label + '</label>';
  }).join('');
  var modal = document.createElement('div');
  modal.id = 'pb-ai-week-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML = '<div style="background:#1a1f2e;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:22px;width:480px;max-width:95vw;max-height:88vh;overflow-y:auto;">'
    + '<div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:4px;">✨ ' + (opts.full ? 'AI Generate Full Program' : 'AI Generate Week ' + wk.week) + '</div>'
    + '<div style="font-size:11px;color:var(--text3);margin-bottom:6px;line-height:1.5;">Fills all ' + trainingDays.length + ' training days' + (opts.full ? ' of Week ' + wk.week + ', then scales it to every other week' : '') + '. Existing content in those days is replaced. Days are written one at a time so each one knows the rest of the week.</div>'
    + '<div style="font-size:11px;color:#a5b4fc;margin-bottom:4px;">🔒 Your library only · 🧠 learns from ' + M.nDays + ' of your days <a href="#" onclick="csShowStyle();return false;" style="color:#6BA3F8;">what it learned</a></div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">'
    + '<div><label style="' + lab + '">Athlete focus</label><select id="pbai-week-pos" style="' + sel + '">'
    + [['position_player', 'Position player'], ['pitcher', 'Pitcher'], ['catcher', 'Catcher'], ['outfielder', 'Outfielder'], ['infielder', 'Infielder'], ['client', 'Private client']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === autoPos ? ' selected' : '') + '>' + o[1] + (o[0] === autoPos && athlete !== '(Sandbox)' ? ' (his)' : '') + '</option>'; }).join('')
    + '</select></div>'
    + '<div><label style="' + lab + '">Phase</label><select id="pbai-week-phase" style="' + sel + '">'
    + Object.keys(CS.PHASE_NAMES).map(function (k) { return '<option value="' + k + '"' + (k === autoPhase ? ' selected' : '') + '>' + CS.PHASE_NAMES[k] + '</option>'; }).join('')
    + '</select></div></div>'
    + '<label style="' + lab + '">Training location</label><select id="pbai-week-loc" style="' + sel + '">'
    + [['', '📍 As set per day (Location & travel) — else facility'], ['facility', '🏟 Facility (full gym)'], ['home', '🏠 Home gym'], ['hotel_gym', '🏨 Hotel gym'], ['hotel_room', '🧳 Hotel room / bodyweight']].map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('')
    + '</select>'
    + '<label style="' + lab + '">Day structure</label>'
    + '<label style="display:flex;align-items:center;gap:7px;padding:3px 0;font-size:12px;color:#fff;cursor:pointer;"><input type="radio" name="pbai-week-struct" value="auto" checked> Match how I build each day (uses the day labels, e.g. "Acceleration / UB Lift")</label>'
    + '<label style="display:flex;align-items:center;gap:7px;padding:3px 0;font-size:12px;color:#fff;cursor:pointer;"><input type="radio" name="pbai-week-struct" value="pick"> Pick the blocks for every day</label>'
    + '<div id="pbai-week-mods" style="display:none;padding:4px 0 0 22px;">' + modOptions + '</div>'
    + '<label style="' + lab + '">Exercises per day</label>'
    + '<select id="pbai-week-total" style="' + sel + '"><option value="0" selected>Auto — my usual for this kind of day</option>' + [8, 10, 12, 14, 16, 18, 20].map(function (n) { return '<option value="' + n + '">' + n + '</option>'; }).join('') + '</select>'
    + '<label style="' + lab + '">Coach notes (optional)</label>'
    + '<textarea id="pbai-week-notes" rows="2" placeholder="e.g. 3 days post-op hamstring cleared to 85% runs · keep trap bar as the main hinge · short on time Fri" style="' + sel + 'font-family:inherit;resize:vertical;"></textarea>'
    + '<div id="pbai-week-progress-wrap" style="display:none;margin:12px 0 4px;">'
    + '<div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;"><div id="pbai-week-progress" style="height:100%;width:0%;background:#60a5fa;transition:width .3s;"></div></div>'
    + '<div id="pbai-week-status" style="font-size:10px;color:var(--text3);margin-top:5px;"></div></div>'
    + '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;">'
    + '<button onclick="document.getElementById(\'pb-ai-week-modal\').remove()" style="padding:7px 14px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#94a3b8;font-size:12px;cursor:pointer;">Cancel</button>'
    + '<button id="pbai-week-gen-btn" style="padding:7px 16px;background:#60a5fa;border:none;border-radius:6px;color:#000;font-size:12px;font-weight:700;cursor:pointer;">✨ ' + (opts.full ? 'Generate Full Program' : 'Generate Week') + '</button>'
    + '</div></div>';
  document.body.appendChild(modal);
  modal.querySelectorAll('input[name="pbai-week-struct"]').forEach(function (r) { r.onchange = function () { modal.querySelector('#pbai-week-mods').style.display = r.value === 'pick' && r.checked ? '' : 'none'; }; });
  modal.querySelector('#pbai-week-gen-btn').onclick = function () {
    pbAIGenerateWeek(weekIdx).then(function (ok) {
      if (ok && opts.full && typeof pbApplyToAllWeeks === 'function') { pbApplyToAllWeeks(); showStatus('✅ Full program generated — Week ' + wk.week + ' written in your style, scaled to all other weeks'); }
    });
  };
  modal.addEventListener('click', function (e) { if (e.target === modal) modal.remove(); });
}

async function pbAIGenerateWeek(weekIdx) {
  var modal = document.getElementById('pb-ai-week-modal');
  var wk = PB_STATE.weekData[weekIdx];
  var trainingDays = wk.days.map(function (d, i) { return { day: d, idx: i }; }).filter(function (o) { return o.day.type !== 'off'; });
  var q = function (id) { return modal ? modal.querySelector(id) : null; };
  var structPick = q('input[name="pbai-week-struct"]:checked');
  var mods = structPick && structPick.value === 'pick' ? Array.prototype.slice.call(modal.querySelectorAll('.pbai-week-mod:checked')).map(function (c) { return c.value; }) : [];
  if (structPick && structPick.value === 'pick' && !mods.length) { alert('Pick at least one block type, or choose "Match how I build each day"'); return false; }
  var posKey = q('#pbai-week-pos') ? q('#pbai-week-pos').value : null;
  var phaseKey = q('#pbai-week-phase') ? q('#pbai-week-phase').value : null;
  var loc = q('#pbai-week-loc') ? q('#pbai-week-loc').value : '';
  var total = q('#pbai-week-total') ? parseInt(q('#pbai-week-total').value, 10) || 0 : 0;
  var notes = q('#pbai-week-notes') ? q('#pbai-week-notes').value.trim() : '';
  var btn = q('#pbai-week-gen-btn'), progWrap = q('#pbai-week-progress-wrap'), prog = q('#pbai-week-progress'), status = q('#pbai-week-status');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Generating…'; }
  if (progWrap) progWrap.style.display = 'block';
  var structure = mods.length ? mods.map(function (id) { var m = PB_MODALITIES.find(function (x) { return x.id === id; }); return m ? m.label + ' (blockType ' + m.blockType + ')' : id; }).join(' → ') : '';
  var modTypes = mods.map(function (id) { var m = PB_MODALITIES.find(function (x) { return x.id === id; }); return m && m.blockType; }).filter(Boolean);
  var totalInserted = 0, failed = [], fixes = 0;
  var done = wk.days.map(function (d, i) { return d.type === 'off' ? -1 : null; }).map(function (v, i) { return v === -1 ? i : null; }).filter(function (v) { return v !== null; });
  for (var i = 0; i < trainingDays.length; i++) {
    var day = trainingDays[i].day;
    if (status) status.textContent = 'Day ' + (i + 1) + '/' + trainingDays.length + ' — ' + day.day + (day.label ? ' (' + day.label + ')' : '') + '…';
    if (prog) prog.style.width = Math.round((i / trainingDays.length) * 100) + '%';
    try {
      // Days already written this run are part of the week context for the next one
      var ctx = CS.builderContext(weekIdx, trainingDays[i].idx, { positionKey: posKey, phaseKey: phaseKey, location: loc || null, extraContext: notes, structure: structure, totalExercises: total, modTypes: modTypes.length ? modTypes : null, contextDays: done.slice() });
      var result = await CS.design(ctx);
      fixes += (result.fixes || []).length;
      totalInserted += pbAIApplyBlocksToDay(day, result.blocks || [], true);
      if (loc && loc !== 'facility') day.location = loc;
      done.push(trainingDays[i].idx);
    } catch (err) {
      console.error('[pbAIGenerateWeek]', day.day, err);
      failed.push(day.day + (err && err.message ? ' (' + err.message.slice(0, 80) + ')' : ''));
    }
  }
  if (prog) prog.style.width = '100%';
  if (modal) modal.remove();
  pbRenderDayGrid();
  if (PB_ACTIVE_DAY && PB_ACTIVE_DAY.weekIdx === weekIdx) pbOpenDay(PB_ACTIVE_DAY.weekIdx, PB_ACTIVE_DAY.dayIdx);
  showStatus((failed.length ? '⚠️ ' : '✅ ') + 'Week ' + wk.week + ' generated — ' + totalInserted + ' exercises across ' + (trainingDays.length - failed.length) + ' days'
    + (fixes ? ' · 🔒 ' + fixes + ' library fix' + (fixes === 1 ? '' : 'es') : '') + (failed.length ? ' (failed: ' + failed.join(', ') + ')' : ''));
  return failed.length < trainingDays.length;
}

function pbAIGenerateFullTemplate() {
  if (!PB_STATE.weekData.length) { alert('Build a program first (pick phase/weeks, then Build Program) — AI fills it in from there.'); return; }
  pbAIOpenWeekModal(PB_ACTIVE_DAY ? PB_ACTIVE_DAY.weekIdx : 0, { full: true });
}
