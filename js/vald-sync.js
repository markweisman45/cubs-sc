// ═══════════════════════════════════════════════════════════════════════════
// Cubs VALD sync — runs on hub.valdperformance.com (as a bookmark) while you're
// logged in. Pulls every CMJ and ABCMJ test since 2023 for the dashboard roster,
// keeps the best trial per session, and saves it to the dashboard's cloud
// (cubs_sc_data key "cache:vald-jumps"). Uses your existing VALD Hub session;
// nothing is stored except the jump results.
// The dashboard builds the bookmark with VALD_SYNC_CFG = { supaUrl, supaKey, roster }.
// ═══════════════════════════════════════════════════════════════════════════
async function cubsValdSync(CFG) {
  var box = document.createElement('div');
  box.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:999999;background:#0f172a;color:#fff;padding:14px 16px;border-radius:12px;font:13px/1.5 -apple-system,Segoe UI,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.4);border:2px solid #0E3386;max-width:340px;';
  document.body.appendChild(box);
  var say = function (t) { box.innerHTML = '<b style="color:#93c5fd;">Cubs VALD sync</b><br>' + t; };
  try {
    if (!/valdperformance\.com/.test(location.host)) throw new Error('Open VALD Hub (hub.valdperformance.com) first, then click the bookmark.');
    say('Reading your VALD session…');
    var sk = Object.keys(sessionStorage).find(function (k) { return /vald-api-internal/.test(k); });
    if (!sk) throw new Error('Not logged in to VALD Hub in this tab.');
    var tok = JSON.parse(sessionStorage.getItem(sk)).body.access_token;
    var res = performance.getEntriesByType('resource').map(function (e) { return e.name; });
    var tm = res.map(function (u) { return (u.match(/forcedecks-gateway\.prd\.vald\.com\/api\/v1\/teams\/([0-9a-f-]{36})/) || [])[1]; }).find(Boolean)
      || res.map(function (u) { return (u.match(/api-teams\.valdperformance\.com\/v2021q3\/team\/([0-9a-f-]{36})/) || [])[1]; }).find(Boolean);
    if (!tm) throw new Error('Open the ForceDecks page in VALD Hub once (VALD Systems → ForceDecks), then click the bookmark again.');
    var H = { Accept: 'application/json', 'X-TeamId': tm, Authorization: 'Bearer ' + tok, 'client-name': 'VALD Hub', 'client-version': '0.0' };
    say('Finding roster in VALD…');
    var aurl = res.find(function (u) { return /api-athletes\.valdperformance\.com\/v2021q3\/team\/[0-9a-f-]{36}\/athletes\/detailed/.test(u); }) || ('https://prd-use-api-athletes.valdperformance.com/v2021q3/team/' + tm + '/athletes/detailed');
    var A = await (await fetch(aurl, { headers: H })).json();
    var norm = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\b(jr|sr|ii|iii)\b\.?/g, '').replace(/[^a-z]/g, ''); };
    var byName = {}; (Array.isArray(A) ? A : A.athletes || []).forEach(function (a) { var k = norm(a.fullName || (a.givenName + ' ' + a.familyName)); (byName[k] = byName[k] || []).push(a.id); });
    var KEYS = { bw: 655387, jh: 6553611, ppbm: 6553604, vto: 6553655, rsi: 6553733, ct: 6553643, ftct: 6553660, depth: 6553603, ebrfd: 6553679, edrfd: 6553683, epf: 6553688, bpd: 6553664, cimp: 6553712, cmf: 6553720, cpf: 6553686, p1: 6553676, p2: 6553677, edimp: 6553704, plf: 6553628, pp: 6553633 };
    var ASYM = ['cimp', 'edimp', 'plf', 'p1', 'p2'], byId = {}; Object.keys(KEYS).forEach(function (k) { byId[KEYS[k]] = k; });
    var out = { at: new Date().toISOString(), keys: KEYS, players: {} }, missing = [];
    for (var i = 0; i < CFG.roster.length; i++) {
      var n = CFG.roster[i], ids = byName[norm(n)] || [];
      if (!ids.length) { missing.push(n); continue; }
      say('Pulling jumps ' + (i + 1) + '/' + CFG.roster.length + ' — ' + n);
      var body = { include: 'TrialsWithResults', recordedAfter: '2023-01-01T06:00:00.000Z', recordedBefore: new Date(Date.now() + 864e5).toISOString(), resultIds: Object.values(KEYS).map(String), testTypes: ['CMJ', 'ABCMJ'], aggregateFunctions: ['Max'], testAttributeValueIds: [], athleteIds: ids, topNPerAthlete: 0 };
      var r = await fetch('https://use-api-forcedecks-gateway.prd.vald.com/api/v1/tests/query', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, H), body: JSON.stringify(body) });
      if (!r.ok) throw new Error('VALD returned ' + r.status + ' for ' + n);
      var q = await r.json();
      out.players[n] = q.map(function (test) {
        var best = null, bj = -1;
        (test.trials || []).forEach(function (tr) { var j = (tr.results || []).find(function (x) { return x.resultId === KEYS.jh && !x.limb; }); if (j && j.value > bj) { bj = j.value; best = tr; } });
        if (!best) return null;
        var v = {}, a = {};
        best.results.forEach(function (x) { var k = byId[x.resultId]; if (!k) return; if (!x.limb || x.limb === 'Trial') v[k] = Math.round(x.value * 1000) / 1000; else if (x.limb === 'Asym' && ASYM.indexOf(k) >= 0) a[k] = Math.round(x.value * 10) / 10; });
        return { d: test.recorded.slice(0, 10), t: test.testType, n: test.trials.length, v: v, a: a };
      }).filter(Boolean).sort(function (x, y) { return x.d < y.d ? -1 : 1; });
    }
    say('Saving to the Cubs dashboard…');
    var u = await fetch(CFG.supaUrl + '/rest/v1/cubs_sc_data?on_conflict=key', { method: 'POST', headers: { apikey: CFG.supaKey, Authorization: 'Bearer ' + CFG.supaKey, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ key: 'cache:vald-jumps', value: JSON.stringify(out) }) });
    if (!u.ok) throw new Error('Saving failed (' + u.status + ')');
    var tests = Object.keys(out.players).reduce(function (t, k) { return t + out.players[k].length; }, 0);
    say('✅ Done — ' + tests + ' sessions for ' + Object.keys(out.players).length + ' athletes.' + (missing.length ? '<br><span style="color:#fbbf24;">Not found in VALD: ' + missing.join(', ') + '</span>' : '') + '<br>Reload the dashboard\'s Jump Profile.');
  } catch (e) { say('<span style="color:#fca5a5;">' + (e.message || e) + '</span>'); }
  setTimeout(function () { box.remove(); }, 15000);
}
if (typeof module !== 'undefined') module.exports = cubsValdSync;
