// ═══════════════════════════════════════════════════════════════════════════
// Year in Review → "Draft write-up" button in the coach's note editor.
// Builds a starting draft from the athlete's data: availability, positives,
// room for improvement and a plan of action. It only fills the text box — the
// coach edits it, then Save draft / Publish as usual. Nothing is saved on its own.
// ═══════════════════════════════════════════════════════════════════════════
var YW_M = [
  { k: 'sprint', src: 'sav', label: 'Sprint speed', unit: 'ft/s', dec: 1, step: 0.2, grp: 'speed' },
  { k: 'hp1b', src: 'sav', label: 'Home to 1st', unit: 's', dec: 2, step: 0.05, lower: 1, grp: 'speed' },
  { k: 'str', src: 'he', label: 'Max linear sprint', unit: 'ft/s', dec: 1, step: 0.2, grp: 'speed' },
  { k: 'cur', src: 'he', label: 'Max curve sprint', unit: 'ft/s', dec: 1, step: 0.2, grp: 'curve' },
  { k: 'jh', src: 'cmj', label: 'CMJ jump height', unit: 'cm', dec: 1, step: 1.5, grp: 'power' },
  { k: 'ppbm', src: 'cmj', label: 'Peak power / BM', unit: 'W/kg', dec: 1, step: 2, grp: 'power' },
  { k: 'rsi', src: 'cmj', label: 'RSI-modified', unit: 'm/s', dec: 2, step: 0.04, grp: 'reactive' },
  { k: 'cpf', src: 'cmj', label: 'Concentric peak force / BM', unit: 'N/kg', dec: 1, step: 1, grp: 'force' },
  { k: 'edrfd', src: 'cmj', label: 'Eccentric decel RFD / BM', unit: 'N/s/kg', dec: 0, step: 8, grp: 'ecc', team: 1 },
  { k: 'bat', src: 'sav', label: 'Bat speed', unit: 'mph', dec: 1, step: 0.7, grp: 'rot' },
  { k: 'ev50', src: 'sav', label: 'EV50', unit: 'mph', dec: 1, step: 0.7, grp: 'rot' },
  { k: 'arm', src: 'sav', label: 'Arm strength', unit: 'mph', dec: 1, step: 1, grp: 'arm' },
  { k: 'oaa', src: 'sav', label: 'Outs above average', unit: '', dec: 0, step: 3, grp: 'def' }
];
var YW_PLAN = {
  speed: 'Speed first: open every training week with acceleration and max-velocity work (sprint exposures at 90%+ of his top speed), and retest a timed 10 yd before Spring Training.',
  curve: 'Curve speed: build base-running and curvilinear sprint patterns into the speed block (rounding first, first-to-third), not just straight-line work.',
  power: 'Lower-body power: strength-speed into speed-strength — loaded jumps, Olympic derivatives and heavy/light contrast pairs, building through Intensification into Realization.',
  reactive: 'Reactive strength: progress plyometrics from extensive to intensive (pogos → hurdle hops → depth jumps) with an emphasis on short ground contacts.',
  force: 'Max force: keep a heavy lower-body pairing (trap bar / squat pattern) in every phase so the power work has a strength base under it.',
  ecc: 'Eccentric / braking: overloaded eccentrics and deceleration drills to improve how he loads and stops.',
  rot: 'Rotational power: med-ball rotational throws and scoop tosses, coordinated with the hitting staff so it carries into the swing.',
  arm: 'Arm: rotator cuff and scap strength alongside the throwing program, coordinated with the throwing staff.',
  bw: 'Body weight: report at the target weight and protect mass in-season — nutrition plan plus a consistent in-season lift frequency.',
  hold: 'In-season maintenance: keep two lift days a week with a high-velocity exposure, and use CMJ vs his norm to manage load from July on.'
};
var YW_INJ = [
  [/hamstring/i, 'Hamstring: eccentric hamstring progression (Nordics, RDL variations) plus regular high-speed running exposure before Spring Training.'],
  [/oblique|abdominal|intercostal|rib/i, 'Trunk: progress anti-rotation into rotational power and ramp swing volume gradually in January–February.'],
  [/shoulder|elbow|ucl|forearm|flexor/i, 'Arm care: rotator cuff / scap strength with a gradual throwing progression.'],
  [/knee|acl|meniscus|patell/i, 'Knee: single-leg strength and deceleration progression before full sprint and cutting volume.'],
  [/back|lumbar|spine/i, 'Back: trunk endurance and hip mobility/strength, with loading progressed gradually.'],
  [/groin|adductor|hip/i, 'Hip / groin: adductor strength (Copenhagen progression) and lateral movement ramp-up.'],
  [/calf|achilles|ankle/i, 'Lower leg: calf/Achilles capacity (isometric → plyometric) before sprint volume builds.']
];
function ywVals(name, m, ys) {
  var sv = typeof VA !== 'undefined' && VA.data && VA.data.rows ? VA.data.rows.find(function (x) { return x.roster === name; }) : null;
  var grp = typeof mlbAutoGroup === 'function' ? mlbAutoGroup(name) : 'g2';
  var avg = function (a) { return a.length ? a.reduce(function (t, x) { return t + x; }, 0) / a.length : null; };
  var vals = {}, pct = {};
  ys.forEach(function (y) {
    if (m.src === 'sav') { var x = sv && sv.metrics[m.k]; if (x && x.vals[y] != null) { vals[y] = x.vals[y]; pct[y] = x.pcts[y]; } }
    else if (m.src === 'cmj') { var v = avg(yrVald(name, y, 'CMJ').map(function (t) { return t.v[m.k]; }).filter(function (q) { return q != null; })); if (v != null) { vals[y] = v; if (!m.team && typeof mlbPct === 'function') { var p = mlbPct(m.k, v, grp); pct[y] = p ? p.p : null; } } }
    else if (m.src === 'he') { var s = yrStats(yrRuns(name, y, m.k)); if (s && s.n >= 3) vals[y] = s.top; }
  });
  // Team percentile for internal or team-ranked metrics
  var cy = ys[2];
  if ((m.src === 'he' || m.team) && vals[cy] != null) {
    var team = Object.keys(PLAYERS).map(function (n) { return n === name ? vals[cy] : ywVals1(n, m, cy); }).filter(function (v) { return v != null; });
    if (team.length >= 4) pct[cy] = Math.round(100 * team.filter(function (v) { return v < vals[cy]; }).length / (team.length - 1));
  }
  return { vals: vals, pct: pct };
}
function ywVals1(n, m, y) {
  if (m.src === 'he') { var s = yrStats(yrRuns(n, y, m.k)); return s && s.n >= 3 ? s.top : null; }
  var v = yrVald(n, y, 'CMJ').map(function (t) { return t.v[m.k]; }).filter(function (q) { return q != null; });
  return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null;
}
function yrWriteup(name) {
  var ys = yrYears(), cy = ys[2], p = PLAYERS[name] || {};
  var sv = typeof VA !== 'undefined' && VA.data && VA.data.rows ? VA.data.rows.find(function (x) { return x.roster === name; }) : null;
  var mlb = sv && YR.mlb[sv.id];
  var fmt = function (m, v) { return (+v).toFixed(m.dec); };
  var who = { sav: 'MLB', cmj: 'MLB ' + (typeof MLB_NORM_GROUPS !== 'undefined' ? MLB_NORM_GROUPS[mlbAutoGroup(name)].label : 'position'), he: 'the roster' };
  var pos = [], imp = [], plan = [], seen = {};
  // Availability
  var avail = '';
  if (mlb && mlb.seasons[cy]) {
    var S = mlb.seasons[cy], il = (mlb.il || []).filter(function (s) { return s.year === cy; });
    var gs = ys.map(function (y) { return mlb.seasons[y] ? mlb.seasons[y].g : null; });
    avail = S.g + ' of 162 games (' + S.pa + ' PA), ' + S.sb + ' SB / ' + S.cs + ' CS. ' + (il.length ? il.map(function (s) { return s.list + ' IL from ' + jpFd(s.start) + ' — ' + (s.injury || 'injury not listed') + (s.days != null ? ' (' + s.days + ' days)' : ''); }).join('; ') + '.' : 'No IL time.') + (gs.every(function (g) { return g != null; }) ? ' Games ' + ys.join('/') + ': ' + gs.join(' → ') + '.' : '');
    if (S.g >= 150 && !il.length) pos.push('Durability: ' + S.g + ' games with no IL time.');
    il.forEach(function (s) { var hit = YW_INJ.find(function (r) { return r[0].test(s.injury || ''); }); if (hit && !seen['inj' + hit[1]]) { seen['inj' + hit[1]] = 1; plan.push(hit[1]); } });
  }
  // Metric positives / improvements
  YW_M.forEach(function (m) {
    var d = ywVals(name, m, ys), v = d.vals[cy]; if (v == null) return;
    var yk = ys.filter(function (y) { return d.vals[y] != null; }), first = d.vals[yk[0]], pc = d.pct[cy];
    var better = function (a, b) { return m.lower ? a < b : a > b; };
    var bestY = yk.reduce(function (a, y) { return better(d.vals[y], d.vals[a]) ? y : a; }, yk[0]);
    var ref = m.team || m.src === 'he' ? 'on the roster' : 'vs ' + who[m.src];
    var tag = pc != null ? yrOrd(pc) + ' percentile ' + ref : '';
    var dn = m.lower ? 'slower than' : 'down from', up = m.lower ? 'faster than' : 'up from';
    var trend = yk.length > 1 ? ' (' + yk[0] + '–' + cy + ': ' + yk.map(function (y) { return fmt(m, d.vals[y]); }).join(' → ') + ')' : '';
    var gain = yk.length > 1 && better(v, first) && Math.abs(v - first) >= m.step;
    if ((pc != null && pc >= 75) || (gain && bestY === cy)) {
      pos.push({ s: pc != null ? pc : 60, t: m.label + ' ' + fmt(m, v) + (m.unit ? ' ' + m.unit : '') + (tag ? ', ' + tag : '') + (gain ? ', ' + up + ' ' + fmt(m, first) + ' in ' + yk[0] : '') + '.' });
    } else if (bestY !== cy && Math.abs(d.vals[bestY] - v) >= m.step) {
      imp.push({ s: 0, t: m.label + ' ' + fmt(m, v) + (m.unit ? ' ' + m.unit : '') + ', ' + dn + ' ' + fmt(m, d.vals[bestY]) + ' in ' + bestY + (tag ? ' · ' + tag : '') + '.', g: m.grp });
    } else if (pc != null && pc <= 30) {
      imp.push({ s: 1, t: m.label + ' ' + fmt(m, v) + (m.unit ? ' ' + m.unit : '') + ' — ' + tag + trend + '.', g: m.grp });
    }
  });
  // Body weight and second-half drops (from the goal suggestions)
  var sug = typeof yrSuggest === 'function' ? yrSuggest(name) : [];
  sug.forEach(function (s) {
    if (s.m.k === 'hold-bw') imp.push({ s: 0, t: 'Body weight: ' + s.why.replace(/^Dropped/, 'dropped').replace(/\.$/, '') + ' (' + s.hist.replace(/^\d{4}: /, '') + ').', g: 'bw' });
    if (s.m.k === 'hold-run' || s.m.k === 'hold-jh') imp.push({ s: 0, t: s.m.label.replace(' — 2nd half', '') + ' fell in the second half: ' + s.why.replace(/^Fell /, '') , g: 'hold' });
  });
  pos = pos.map(function (x) { return typeof x === 'string' ? { s: 101, t: x } : x; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 5).map(function (x) { return x.t; });
  // Plan: one line per area that needs work — declines first, then low percentiles, in training-priority
  // order (speed first). Injury lines come before these. Capped at 5 so the plan stays focused.
  var order = ['speed', 'curve', 'power', 'reactive', 'force', 'ecc', 'bw', 'hold', 'rot', 'arm'];
  imp.sort(function (a, b) { return a.s - b.s || order.indexOf(a.g) - order.indexOf(b.g); });
  var groups = []; imp.forEach(function (x) { if (YW_PLAN[x.g] && groups.indexOf(x.g) < 0) groups.push(x.g); });
  groups = groups.filter(function (g, i) { return i < 5; }).sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
  groups.forEach(function (g) { if (plan.length < 5) plan.push(YW_PLAN[g]); });
  imp = imp.slice(0, 6);
  if (!plan.length) plan.push('Maintain: keep the same structure that produced this season — speed block first, paired strength/power work, and hold his CMJ and sprint numbers going into Spring Training.');
  var tg = sug.filter(function (s) { return s.type !== 'Maintain'; }).slice(0, 4).map(function (s) { return s.m.label + ' ' + s.txt + (s.m.unit !== '%' ? ' ' + s.m.unit : '') + ' by ' + s.m.by.replace(/\s*\(in-season check\)/, ''); });
  var L = [];
  L.push(cy + ' SEASON REVIEW — ' + name + (p.pos ? ' (' + p.pos + ')' : ''));
  if (avail) { L.push('', 'AVAILABILITY', avail); }
  L.push('', 'POSITIVES'); (pos.length ? pos : ['—']).forEach(function (t) { L.push('• ' + t); });
  L.push('', 'ROOM FOR IMPROVEMENT'); (imp.length ? imp : [{ t: 'No clear drop-offs in the data — focus is on keeping what he has.' }]).forEach(function (x) { L.push('• ' + x.t); });
  L.push('', 'PLAN OF ACTION'); plan.forEach(function (t, i) { L.push((i + 1) + '. ' + t); });
  if (tg.length) { L.push('', 'TARGETS'); tg.forEach(function (t) { L.push('• ' + t); }); }
  return L.join('\n');
}
function yrDraftWriteup() {
  var ta = document.getElementById('yr-text'); if (!ta) return;
  if (ta.value.trim() && !confirm('Replace what\'s in the note with a fresh data-based draft?')) return;
  ta.value = yrWriteup(currentPlayer);
  ta.rows = Math.min(30, Math.max(8, ta.value.split('\n').length + 1));
  ta.focus();
}
// Button above the note text box
(function () {
  if (typeof yrNote !== 'function') return;
  var _n = yrNote;
  yrNote = function () {
    var h = _n.apply(this, arguments), mark = '<textarea id="yr-text"';
    var i = h.indexOf(mark); if (i < 0) return h;
    var btn = '<div style="display:flex;justify-content:flex-end;margin-top:10px;"><button onclick="yrDraftWriteup()" title="Fill the note with a draft built from his data — edit it, then save or publish" style="padding:5px 12px;border-radius:7px;border:1px solid rgba(250,204,21,.45);background:rgba(250,204,21,.08);color:#fde68a;font-size:11.5px;font-weight:700;cursor:pointer;">✍️ Draft season write-up from data</button></div>';
    return h.slice(0, i) + btn + h.slice(i).replace('margin-top:10px;line-height:1.5;', 'margin-top:6px;line-height:1.5;');
  };
})();
