// ═══════════════════════════════════════════════════════════════════════════
// Athlete profile on the program page: KPIs + off-season goals.
// Built here from the same numbers as Year in Review (CMJ, sprint, HE runs,
// body weight, 1RMs) and the goals you published there, then written into each
// live program (pb_state.profile) so the athlete sees it at the top of his page.
// ═══════════════════════════════════════════════════════════════════════════
var AP_ORDER = ['sprint', 'str', 'cur', 'jh', 'rsi', 'ppbm', 'cppbm', 'bw'];
// Pitchers: jumps only — no sprint KPIs, sprint goals, speed card or sprint home tests
var AP_PIT_KEYS = ['jh', 'rsi', 'ppbm', 'cppbm', 'bw'];
function apIsPitcher(name) { return typeof PLAYERS !== 'undefined' && typeof isPitcherPos === 'function' && !!(PLAYERS[name] && isPitcherPos(PLAYERS[name].pos)); }
if (typeof yrSuggest === 'function') {
  var _apYrSuggest = yrSuggest;
  yrSuggest = function (name) { var S = _apYrSuggest.apply(this, arguments) || []; return apIsPitcher(name) ? S.filter(function (s) { return s.m.src === 'cmj'; }) : S; };
}

function apProfile(name) {
  if (typeof yrSuggest !== 'function' || typeof yrYears !== 'function') return null;
  var cy = yrYears()[2], kpis = [], seen = {};
  var S = []; try { S = yrSuggest(name) || []; } catch (e) { S = []; }
  S.forEach(function (s) {
    var k = s.m.k; if (/^hold-/.test(k) || seen[k] || s.cur == null) return; seen[k] = 1;
    var ctx = '', pm = typeof ofPctMode === 'function' ? ofPctMode() : 'all';
    if (s.pct != null && (pm === 'all' || (pm === '50' && s.pct >= 50))) ctx = s.m.src === 'he' ? 'Team ' + yrOrd(s.pct) + ' pct' : 'MLB ' + yrOrd(s.pct) + ' pct' + (s.m.src === 'cmj' ? ' (position)' : '');
    kpis.push({ k: k, label: s.m.label, v: +(+s.cur).toFixed(s.m.dec), unit: s.m.unit, dec: s.m.dec, ctx: ctx, pct: ctx ? s.pct : null });
  });
  kpis.sort(function (a, b) { var i = AP_ORDER.indexOf(a.k), j = AP_ORDER.indexOf(b.k); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j); });
  // At-home tests he logged on his page (latest wins; body weight replaces the VALD spring number)
  var pit = apIsPitcher(name);
  if (pit) kpis = kpis.filter(function (q) { return AP_PIT_KEYS.indexOf(q.k) >= 0; });
  if (typeof ofTests === 'function') {
    var T = ofTests(name), t10 = ofLatest(T, 't10'), t30 = ofLatest(T, 't30'), hbw = ofLatest(T, 'bw');
    if (pit) { t10 = null; t30 = null; }
    if (t10) kpis.push({ k: 'home10', label: '10-yd (home)', v: +t10.v.toFixed(2), unit: 's', dec: 2, ctx: 'Logged ' + ofFmt(t10.date), pct: null });
    if (t30) kpis.push({ k: 'home30', label: '30-yd (home)', v: +t30.v.toFixed(2), unit: 's', dec: 2, ctx: 'Logged ' + ofFmt(t30.date), pct: null });
    if (hbw) { var bwk = kpis.find(function (q) { return q.k === 'bw'; }); var nb = { k: 'bw', label: 'Body weight', v: Math.round(hbw.v), unit: 'lb', dec: 0, ctx: 'Logged ' + ofFmt(hbw.date), pct: null }; if (bwk) Object.assign(bwk, nb); else kpis.push(nb); }
  }
  // Strength: tested / estimated 1RMs on file
  var rm = (typeof ATHLETE_1RM !== 'undefined' && ATHLETE_1RM[name]) || {};
  Object.keys(rm).forEach(function (lift) { var v = +rm[lift]; if (v > 0 && kpis.length < 12) kpis.push({ k: 'rm:' + lift, label: lift + ' 1RM', v: v, unit: 'lb', dec: 0, ctx: '' }); });
  // Goals: what you published in Year in Review
  var goals = [];
  try {
    var st = yrStore(), pub = ((st[name] || {})[cy] || {}).pub;
    var sprintGoal = /sprint|speed|\b(10|30)-?yd/i;
    ((pub && pub.targets) || []).filter(function (t) { return t && t.goal && !(pit && sprintGoal.test(t.goal)); }).forEach(function (t) {
      var match = kpis.find(function (q) { return q.label.toLowerCase() === String(t.goal).toLowerCase().trim(); });
      goals.push({ goal: t.goal, target: t.target || '', by: t.by || '', now: match ? (+match.v).toFixed(match.dec || 0) + (match.unit && match.unit !== '%' ? ' ' + match.unit : '') : '' });
    });
  } catch (e) {}
  if (!kpis.length && !goals.length) return null;
  var out = { season: cy, asOf: (typeof TC !== 'undefined' ? TC.localISO() : new Date().toISOString().slice(0, 10)), kpis: kpis, goals: goals };
  if (pit) out.pitcher = true;
  return out;
}
function apSame(a, b) { var s = function (p) { if (!p) return ''; var c = JSON.parse(JSON.stringify(p)); delete c.asOf; return JSON.stringify(c); }; return s(a) === s(b); }

var _apBusy = false;
async function apPushProfiles(onlyName, force) {
  if (_apBusy) return 0; _apBusy = true;
  var sent = 0;
  try {
    var db = typeof getSupaClient === 'function' ? getSupaClient() : null; if (!db) return 0;
    if (typeof PROGRAM_ROWS === 'undefined') return 0;
    var cache = {};
    for (var i = 0; i < PROGRAM_ROWS.length; i++) {
      var row = PROGRAM_ROWS[i]; if (onlyName && row.athlete !== onlyName) continue;
      var prof = cache[row.athlete] !== undefined ? cache[row.athlete] : (cache[row.athlete] = apProfile(row.athlete));
      if (!prof || apSame(prof, row.pb.profile)) continue;
      // Don't overwrite a fuller profile with a partial one while data is still loading
      var old = row.pb.profile;
      if (!force && !prof.pitcher && old && (old.kpis || []).length > prof.kpis.length) continue;
      var r = await db.from('athlete_programs').select('pb_state').eq('id', row.id).maybeSingle();
      if (r.error || !r.data) continue;
      var pb = typeof r.data.pb_state === 'string' ? JSON.parse(r.data.pb_state) : r.data.pb_state;
      pb.profile = prof;
      if (prof.pitcher) delete pb.speedSummary;
      var u = await db.from('athlete_programs').update({ pb_state: JSON.stringify(pb) }).eq('id', row.id);
      if (!u.error) { row.pb.profile = prof; sent++; }
    }
  } catch (e) { console.warn('[athlete-kpi]', e); }
  finally { _apBusy = false; }
  return sent;
}

(function () {
  var t = null;
  function soon(ms) { clearTimeout(t); t = setTimeout(function () { apPushProfiles(); }, ms || 8000); }
  // After live programs load (gives VALD / Savant / HE data time to load first)
  if (typeof loadProgramRows === 'function') {
    var _l = loadProgramRows;
    loadProgramRows = function () { var pr = _l.apply(this, arguments); Promise.resolve(pr).then(function () { soon(8000); }); return pr; };
  }
  // Publishing goals in Year in Review pushes that athlete's profile right away
  if (typeof yrSaveNote === 'function') {
    var _y = yrSaveNote;
    yrSaveNote = function (publish) {
      var who = typeof currentPlayer !== 'undefined' ? currentPlayer : null;
      var r = _y.apply(this, arguments);
      if (publish && who) apPushProfiles(who, true).then(function (n) { if (n && typeof showStatus === 'function') showStatus('📲 Goals updated on ' + who.split(' ')[0] + '\'s program'); });
      return r;
    };
  }
  // A new send → profile follows a few seconds later
  if (typeof persistPrograms === 'function') {
    var _p = persistPrograms;
    persistPrograms = function () { var r = _p.apply(this, arguments); if (typeof loadProgramRows === 'function') { clearTimeout(persistPrograms._t); persistPrograms._t = setTimeout(loadProgramRows, 4000); } return r; };
  }
})();
