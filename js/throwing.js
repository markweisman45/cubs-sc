// ═══════════════════════════════════════════════════════════════════════════
// Throwing programs — one import, shown everywhere.
//  • Import the pitcher's throwing program PDF (Load › Throwing), saved per
//    athlete in cubs_sc_throwing_v1 and pushed to the cloud right away so the
//    athlete sees it on his program link (athlete_get_throwing function)
//  • Calendar: a throwing chip under the lift (bullpen red, live/sim blue);
//    "All athletes" shows how many are throwing and how many mound days
//  • Day detail: one card per pitcher with type, velo cap, load, throws, chronic
//  • Annual plan: Throwing section — phase, weekly load, chronic vs target,
//    velo cap, mound days
//  • Load › Throwing: chronic vs target chart, tiles, week strip and
//    lift/throw conflicts (lower-body lift the day before a mound day)
// Loaded after ui-refresh.js.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var KEY = 'cubs_sc_throwing_v1';
  var THR = {};
  function load() { try { THR = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { THR = {}; } }
  load();
  window.thrPlans = function () { return THR; };

  var ico = function (n, s) { return typeof mwIcon === 'function' ? mwIcon(n, s) : ''; };
  var esc = function (v) { return typeof escHtml === 'function' ? escHtml(v) : String(v == null ? '' : v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var iso = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var D = function (s) { var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null; };
  var add = function (d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; };
  var monday = function (d) { var x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  var today = function () { return (typeof TC !== 'undefined' && TC.localISO) ? TC.localISO() : iso(new Date()); };
  var fmt = function (s, o) { var d = D(s); return d ? d.toLocaleDateString('en-US', o || { month: 'short', day: 'numeric' }) : ''; };
  var num = function (n) { return Math.round(n).toLocaleString(); };

  // ── Day model ──────────────────────────────────────────────────────────
  // stored day = [date, type, veloCap, load, pitches, throws, chronic, wacr]
  function day(a) { return { d: a[0], type: a[1], velo: a[2], load: a[3], pitches: a[4], throws: a[5], chronic: a[6], wacr: a[7], kind: kind(a[1]) }; }
  function kind(t) {
    var s = String(t || '').toLowerCase();
    if (!s || s === 'off') return 'off';
    if (/^post/.test(s)) return 'rec';
    if (/bullpen|touch and feel/.test(s)) return 'pen';
    if (/outing|live|sim|game/.test(s)) return 'live';
    if (/high/.test(s)) return 'high';
    if (/medium/.test(s)) return 'med';
    return 'low';
  }
  var KC = { pen: '#ef4444', live: '#3b82f6', high: '#f59e0b', med: '#14b8a6', low: '#5eead4', rec: '#94a3b8', off: '#475569' };
  var KL = { pen: 'Bullpen', live: 'Live / sim', high: 'High', med: 'Medium', low: 'Low', rec: 'Recovery', off: 'Off' };
  var mound = function (k) { return k === 'pen' || k === 'live'; };
  function short(t) { return String(t || '').replace('Touch and Feel', 'Touch & feel').replace('Post-Bullpen Low', 'Post-pen low').replace('Post-Game Low', 'Post-game low').replace('Sim Game Outing', 'Sim game').replace('Live Outing', 'Live outing'); }
  function plan(name) { return THR[name] || null; }
  function dayOf(name, dk) { var p = plan(name); if (!p) return null; for (var i = 0; i < p.days.length; i++) if (p.days[i][0] === dk) return day(p.days[i]); return null; }
  function weekAgg(p) {
    var W = {}, order = [];
    p.days.forEach(function (a) {
      var x = day(a), ws = iso(monday(D(x.d))), w = W[ws];
      if (!w) { w = W[ws] = { ws: ws, load: 0, throws: 0, pitches: 0, pen: 0, live: 0, velo: 0, chronic: 0, maxW: 0, n: 0 }; order.push(ws); }
      w.load += x.load; w.throws += x.throws; w.pitches += x.pitches; w.chronic = x.chronic; w.maxW = Math.max(w.maxW, x.wacr);
      if (x.kind !== 'off') { w.n++; w.velo = Math.max(w.velo, x.velo); }
      if (x.kind === 'pen') w.pen++; if (x.kind === 'live') w.live++;
    });
    return order.map(function (k) { return W[k]; });
  }
  function focusOn(p, dk) { var f = null; (p.weeks || []).forEach(function (w) { if (w[0] <= dk) f = w[1]; }); return f; }

  // ── Lift ↔ throw conflicts ─────────────────────────────────────────────
  var LOWER = /\bLB\b|\bTB\b|lower|full body|total body|strongman|squat|deadlift|trap bar/i;
  function liftOn(name, dk, by) {
    by = by || (typeof pcalBuild === 'function' ? pcalBuild() : {});
    return (by[dk] || []).filter(function (p) { return p.athlete === name; });
  }
  function conflicts(name) {
    var p = plan(name); if (!p) return [];
    var by = typeof pcalBuild === 'function' ? pcalBuild() : {}, out = [];
    p.days.forEach(function (a) {
      var x = day(a); if (!mound(x.kind)) return;
      var prev = iso(add(D(x.d), -1));
      liftOn(name, prev, by).forEach(function (l) { if (LOWER.test(l.label)) out.push({ d: x.d, liftDay: prev, lift: l.label, throwType: x.type, rule: 'Lower-body lift the day before' }); });
      if (x.kind === 'live') liftOn(name, x.d, by).forEach(function (l) { if (LOWER.test(l.label)) out.push({ d: x.d, liftDay: x.d, lift: l.label, throwType: x.type, rule: 'Lower-body lift the same day as an outing' }); });
    });
    return out;
  }
  window.thrConflicts = conflicts;
  function conflictOn(name, dk) { return conflicts(name).filter(function (c) { return c.d === dk || c.liftDay === dk; }); }

  // ── Styles ─────────────────────────────────────────────────────────────
  var css = `
.thr-chip{display:flex;align-items:center;gap:4px;font-size:10px;font-weight:600;padding:2px 5px;margin-bottom:2px;border-radius:0 4px 4px 0;white-space:nowrap;overflow:hidden;cursor:pointer;border-left:3px solid var(--k);background:color-mix(in srgb,var(--k) 15%,transparent);color:color-mix(in srgb,var(--k) 65%,#fff);}
.thr-chip span{overflow:hidden;text-overflow:ellipsis;}
.thr-chip .warn{color:#f59e0b;margin-left:auto;display:inline-flex;}
.thr-sum{display:flex;align-items:center;gap:6px;font-size:10px;color:var(--text2);padding:3px 6px;margin-top:2px;border-radius:6px;border:1px solid var(--border);cursor:pointer;}
.thr-sum b{font-family:var(--mw-mono,'DM Mono',monospace);color:#fff;font-weight:500;}
.thr-dot{width:6px;height:6px;border-radius:50%;display:inline-block;flex-shrink:0;}
.thr-card{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:11px 12px;margin-bottom:8px;border-radius:10px;background:var(--bg3);border:1px solid var(--border);border-left:3px solid var(--k);}
.thr-card .t{font-weight:600;color:#fff;font-size:13px;}
.thr-card .s{font-size:11px;color:var(--text2);margin-top:2px;display:flex;gap:10px;flex-wrap:wrap;}
.thr-stat{font-family:var(--mw-mono,'DM Mono',monospace);font-size:12px;color:#e2e8f0;}
.thr-stat small{display:block;font-family:'DM Sans',sans-serif;font-size:9.5px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;}
.thr-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-bottom:14px;}
.thr-tile{background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:12px 14px;}
.thr-tile .l{font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.6px;}
.thr-tile .v{font-family:var(--mw-mono,'DM Mono',monospace);font-size:24px;color:#fff;margin-top:4px;letter-spacing:-.5px;}
.thr-tile .s{font-size:11px;color:var(--text2);margin-top:2px;}
.thr-week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px;}
.thr-wd{border:1px solid var(--border);border-radius:10px;padding:8px;background:var(--bg3);min-height:118px;}
.thr-wd.today{border-color:var(--mw-accent-line,rgba(255,106,19,.45));box-shadow:inset 0 2px 0 var(--mw-accent,#FF6A13);}
.thr-wd .h{font-size:10px;color:var(--text3);margin-bottom:6px;display:flex;justify-content:space-between;}
.thr-wd .ty{font-size:12px;font-weight:600;color:#fff;border-left:3px solid var(--k);padding-left:6px;margin-bottom:4px;}
.thr-wd .m{font-size:10.5px;color:var(--text2);line-height:1.5;font-family:var(--mw-mono,'DM Mono',monospace);}
.thr-wd .lift{font-size:10px;color:var(--text3);margin-top:6px;border-top:1px dashed var(--border);padding-top:5px;}
.thr-btn{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid var(--border);background:transparent;color:var(--text2);}
.thr-btn:hover{color:#fff;border-color:rgba(255,255,255,.2);}
.thr-btn.primary{background:var(--mw-accent,#FF6A13);border-color:var(--mw-accent,#FF6A13);color:#111;}
.thr-conf{display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-top:1px solid rgba(255,255,255,.05);font-size:12px;color:var(--text2);}
.thr-conf:first-child{border-top:none;}
.thr-conf b{color:#fff;font-weight:600;}
.apg tr.thr td.c{padding:1px;}
.apg .thr-bar{display:flex;align-items:flex-end;justify-content:center;height:22px;}
.apg .thr-bar i{display:block;width:70%;border-radius:2px 2px 0 0;}
.apg .thr-ph{font-size:8px;font-weight:700;border-radius:3px;padding:2px 0;}
`;
  var st = document.createElement('style'); st.id = 'thr-css'; st.textContent = css; document.head.appendChild(st);

  // ── Save / sync ────────────────────────────────────────────────────────
  function save() {
    localStorage.setItem(KEY, JSON.stringify(THR));
    // push now so the athlete's link sees it without waiting for the next sync
    try { if (typeof syncToSupabase === 'function') syncToSupabase(false); } catch (e) { console.warn('[throwing] sync', e); }
  }
  function rerenderAll() {
    try { if (typeof currentPage !== 'undefined' && currentPage === 'calendar' && typeof renderCalendar === 'function') renderCalendar(); } catch (e) {}
    try { if (document.getElementById('annual-grid') && typeof renderAnnualPlan === 'function') renderAnnualPlan(); } catch (e) {}
    try { syncTabVisibility(); } catch (e) {}
    try { if (typeof currentDashTab !== 'undefined' && currentDashTab === 'throwing') renderPane(); } catch (e) {}
  }

  // ── Import ─────────────────────────────────────────────────────────────
  var PENDING = null;
  window.thrPickFile = function () {
    var f = document.getElementById('thr-file');
    if (!f) { f = document.createElement('input'); f.type = 'file'; f.accept = 'application/pdf,.pdf'; f.id = 'thr-file'; f.style.display = 'none'; f.onchange = function () { if (f.files[0]) thrImportFile(f.files[0]); f.value = ''; }; document.body.appendChild(f); }
    f.click();
  };
  window.thrImportFile = async function (file) {
    var box = document.getElementById('thr-preview'); if (!box) { renderPane(); box = document.getElementById('thr-preview'); }
    if (box) box.innerHTML = '<div class="card" style="padding:14px 16px;color:var(--text2);font-size:13px;">Reading ' + esc(file.name) + '…</div>';
    try {
      var p = await thrParsePDF(await file.arrayBuffer());
      p.file = file.name;
      var names = Object.keys(PLAYERS), last = String(p.athlete || '').split(' ').slice(-1)[0].toLowerCase();
      var match = names.find(function (n) { return n.toLowerCase() === String(p.athlete || '').toLowerCase(); }) || names.find(function (n) { return last && n.toLowerCase().split(' ').slice(-1)[0] === last && isPitcherPos(PLAYERS[n].pos); }) || currentPlayer;
      PENDING = p;
      var w = weekAgg(p), mounds = p.days.filter(function (a) { return mound(kind(a[1])); }).length;
      var opts = names.filter(function (n) { return isPitcherPos(PLAYERS[n].pos) || n === match; }).sort().map(function (n) { return '<option' + (n === match ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('');
      if (box) box.innerHTML = '<div class="card" style="padding:14px 16px;border-color:var(--mw-accent-line,rgba(255,106,19,.45));">'
        + '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center;">'
        + '<div><div style="font-weight:600;color:#fff;">' + esc(p.title || p.file) + '</div>'
        + '<div style="font-size:12px;color:var(--text2);margin-top:3px;">' + p.days.length + ' days · ' + w.length + ' weeks · ' + fmt(p.start) + ' – ' + fmt(p.end, { month: 'short', day: 'numeric', year: 'numeric' })
        + (p.target ? ' · target chronic ' + num(p.target) + (p.chronicDate ? ' by ' + fmt(p.chronicDate) : '') : '') + ' · ' + mounds + ' mound days</div></div>'
        + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;"><span style="font-size:12px;color:var(--text3);">Save to</span><select id="thr-who" style="background:var(--bg3);color:#fff;border:1px solid var(--border);border-radius:8px;padding:6px 8px;">' + opts + '</select>'
        + '<button class="thr-btn primary" onclick="thrConfirmImport()">' + ico('check', 14) + (THR[match] ? 'Replace program' : 'Save program') + '</button>'
        + '<button class="thr-btn" onclick="thrCancelImport()">Cancel</button></div></div>'
        + (p.athlete && match !== p.athlete ? '<div style="font-size:11px;color:#f59e0b;margin-top:8px;">The PDF is for “' + esc(p.athlete) + '”. Check the athlete before saving.</div>' : '')
        + '</div>';
    } catch (e) {
      console.error('[throwing] import', e);
      if (box) box.innerHTML = '<div class="card" style="padding:14px 16px;color:#f87171;font-size:13px;">' + esc(e.message || 'Couldn\'t read that PDF.') + '</div>';
    }
  };
  window.thrConfirmImport = function () {
    if (!PENDING) return;
    var who = (document.getElementById('thr-who') || {}).value || currentPlayer;
    PENDING.importedAt = new Date().toISOString();
    THR[who] = PENDING; PENDING = null;
    save();
    if (who !== currentPlayer && typeof selectPlayer === 'function') selectPlayer(who);
    rerenderAll(); renderPane();
  };
  window.thrCancelImport = function () { PENDING = null; var b = document.getElementById('thr-preview'); if (b) b.innerHTML = ''; };
  var REMOVE_ARMED = 0;
  window.thrRemove = function (btn) {
    if (Date.now() - REMOVE_ARMED > 4000) { REMOVE_ARMED = Date.now(); btn.textContent = 'Click again to remove'; return; }
    delete THR[currentPlayer]; save(); rerenderAll(); renderPane();
  };

  // ── Load › Throwing pane ───────────────────────────────────────────────
  var WEEK_OFF = 0, CHART = null;
  function ensurePane() {
    var el = document.getElementById('dash-throwing'); if (el) return el;
    var after = document.getElementById('dash-workload'); if (!after) return null;
    el = document.createElement('div'); el.id = 'dash-throwing'; el.className = 'page'; el.style.display = 'none';
    after.parentNode.insertBefore(el, after.nextSibling);
    return el;
  }
  function renderPane() {
    var el = ensurePane(); if (!el) return;
    var name = currentPlayer, p = plan(name);
    var head = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px;">'
      + '<div><div class="section-title" style="margin:0;">Throwing program</div><div style="font-size:12px;color:var(--text3);margin-top:3px;">'
      + (p ? esc(p.title || p.file || '') + ' · imported ' + fmt((p.importedAt || '').slice(0, 10)) : 'Import the pitcher\'s throwing program PDF to put it on the calendar, annual plan and his program link.') + '</div></div>'
      + '<div style="display:flex;gap:8px;">' + '<button class="thr-btn' + (p ? '' : ' primary') + '" onclick="thrPickFile()">' + ico('upload', 14) + (p ? 'Replace PDF' : 'Import throwing PDF') + '</button>'
      + (p ? '<button class="thr-btn" style="color:#f87171;" onclick="thrRemove(this)">Remove</button>' : '') + '</div></div><div id="thr-preview"></div>';
    if (!p) { el.innerHTML = head; return; }
    var t = today(), td = dayOf(name, t), days = p.days.map(day);
    var cur = td || (t < p.start ? day(p.days[0]) : day(p.days[p.days.length - 1]));
    var nextM = days.find(function (x) { return x.d >= t && mound(x.kind); });
    var pct = p.target ? Math.round(cur.chronic / p.target * 100) : null;
    var wk = iso(monday(D(t))), wkDays = days.filter(function (x) { return iso(monday(D(x.d))) === wk && x.kind !== 'off'; });
    var conf = conflicts(name), upcoming = conf.filter(function (c) { return c.d >= t; });
    var wacrCol = cur.wacr > (p.maxWacr || 1.3) ? '#ef4444' : cur.wacr > (p.maxWacr || 1.3) - 0.1 ? '#EAB308' : '#22c55e';
    var phase = focusOn(p, t) || (t < p.start ? 'Starts ' + fmt(p.start) : 'Done');
    el.innerHTML = head
      + '<div class="thr-tiles">'
      + tile('Chronic workload', num(cur.chronic), p.target ? (pct + '% of ' + num(p.target) + (p.chronicDate ? ' · target ' + fmt(p.chronicDate) : '')) : '', pct != null ? '<div style="height:4px;border-radius:2px;background:rgba(255,255,255,.07);margin-top:8px;"><div style="height:100%;width:' + Math.min(100, pct) + '%;background:#BA7517;border-radius:2px;"></div></div>' : '')
      + tile('WACR today', cur.wacr.toFixed(2), 'cap ' + (p.maxWacr || '—'), '', wacrCol)
      + tile('Velo cap this week', wkDays.length ? Math.max.apply(null, wkDays.map(function (x) { return x.velo; })).toFixed(1) : '—', 'mph · ' + esc(phase))
      + tile('Next mound day', nextM ? fmt(nextM.d, { weekday: 'short', month: 'short', day: 'numeric' }) : '—', nextM ? esc(short(nextM.type)) + (nextM.pitches ? ' · ' + nextM.pitches + ' pitches' : '') : 'none scheduled', '', nextM ? KC[nextM.kind] : null)
      + '</div>'
      + '<div class="card" style="padding:14px 16px;margin-bottom:14px;"><div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;margin-bottom:8px;"><span class="card-title" style="margin:0;">Weekly load and chronic</span>'
      + '<span style="display:flex;gap:12px;font-size:11px;color:var(--text2);flex-wrap:wrap;">' + ['med', 'pen', 'live'].map(function (k) { return '<span><span class="thr-dot" style="background:' + KC[k] + ';border-radius:2px;margin-right:4px;"></span>' + (k === 'med' ? 'Flat ground' : KL[k]) + '</span>'; }).join('')
      + '<span><span style="display:inline-block;width:14px;border-top:2px solid #BA7517;margin-right:4px;vertical-align:3px;"></span>Chronic</span><span><span style="display:inline-block;width:14px;border-top:2px dashed #BA7517;margin-right:4px;vertical-align:3px;opacity:.6"></span>Target</span></span></div>'
      + '<div style="position:relative;height:250px;"><canvas id="thr-chart"></canvas></div></div>'
      + '<div class="card" style="padding:14px 16px;margin-bottom:14px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><span class="card-title" style="margin:0;" id="thr-wk-title"></span>'
      + '<span style="display:flex;gap:6px;"><button class="thr-btn" style="padding:4px 9px;" onclick="thrWeek(-1)">' + ico('left', 13) + '</button><button class="thr-btn" style="padding:4px 9px;" onclick="thrWeek(0)">This week</button><button class="thr-btn" style="padding:4px 9px;" onclick="thrWeek(1)">' + ico('right', 13) + '</button></span></div>'
      + '<div class="thr-week" id="thr-week"></div></div>'
      + '<div class="card" style="padding:14px 16px;"><div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;"><span class="card-title" style="margin:0;">Lift and throw conflicts</span><span style="font-size:11px;color:var(--text3);">lower-body lift the day before a bullpen or outing, or the same day as an outing</span></div>'
      + '<div style="margin-top:8px;">' + (upcoming.length ? upcoming.map(function (c) {
        return '<div class="thr-conf"><span style="color:#f59e0b;margin-top:1px;">' + ico('flag', 14) + '</span><div><b>' + fmt(c.d, { weekday: 'short', month: 'short', day: 'numeric' }) + ' · ' + esc(short(c.throwType)) + '</b><br>' + esc(c.rule) + ': ' + esc(c.lift) + ' on ' + fmt(c.liftDay, { weekday: 'short', month: 'short', day: 'numeric' }) + '. Move the lower-body work or swap it with the upper-body day.</div></div>';
      }).join('') : '<div style="font-size:12px;color:var(--text3);padding:6px 0;">No conflicts with the lift program scheduled right now' + (conf.length ? ' (' + conf.length + ' earlier in the program)' : '') + '.</div>') + '</div></div>';
    renderWeek(); drawChart(p);
  }
  function tile(l, v, s, extra, col) { return '<div class="thr-tile"><div class="l">' + l + '</div><div class="v"' + (col ? ' style="color:' + col + ';"' : '') + '>' + v + '</div><div class="s">' + s + '</div>' + (extra || '') + '</div>'; }
  window.thrWeek = function (d) { WEEK_OFF = d === 0 ? 0 : WEEK_OFF + d; renderWeek(); };
  function renderWeek() {
    var el = document.getElementById('thr-week'); if (!el) return;
    var name = currentPlayer, p = plan(name); if (!p) return;
    var ws = add(monday(D(today())), WEEK_OFF * 7), t = today(), by = typeof pcalBuild === 'function' ? pcalBuild() : {};
    var ttl = document.getElementById('thr-wk-title'); if (ttl) ttl.textContent = 'Week of ' + ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + (focusOn(p, iso(ws)) ? ' · ' + focusOn(p, iso(add(ws, 6))) : '');
    var h = '';
    for (var i = 0; i < 7; i++) {
      var dk = iso(add(ws, i)), x = dayOf(name, dk), lifts = liftOn(name, dk, by), cf = conflictOn(name, dk).length;
      h += '<div class="thr-wd' + (dk === t ? ' today' : '') + '"><div class="h"><span>' + add(ws, i).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }) + '</span>' + (cf ? '<span style="color:#f59e0b;" title="Lift / throw conflict">' + ico('flag', 12) + '</span>' : '') + '</div>'
        + (x ? (x.kind === 'off' ? '<div class="ty" style="--k:' + KC.off + ';color:var(--text3);">Off</div>'
          : '<div class="ty" style="--k:' + KC[x.kind] + ';">' + esc(short(x.type)) + '</div><div class="m">' + x.velo.toFixed(1) + ' cap<br>' + x.throws + ' throws' + (x.pitches ? ' · ' + x.pitches + 'p' : '') + '<br>load ' + x.load + '</div>')
          : '<div class="m" style="color:var(--text3);">—</div>')
        + (lifts.length ? '<div class="lift">' + lifts.map(function (l) { return esc(l.label); }).join('<br>') + '</div>' : '') + '</div>';
    }
    el.innerHTML = h;
  }
  function drawChart(p) {
    var cv = document.getElementById('thr-chart'); if (!cv || typeof Chart === 'undefined') return;
    var W = weekAgg(p), tw = iso(monday(D(today())));
    if (CHART) { try { CHART.destroy(); } catch (e) {} }
    CHART = new Chart(cv, {
      data: {
        labels: W.map(function (w) { return fmt(w.ws); }),
        datasets: [
          { type: 'bar', label: 'Weekly load', data: W.map(function (w) { return w.load; }), backgroundColor: W.map(function (w) { var c = w.live ? KC.live : w.pen ? KC.pen : KC.med; return w.ws === tw ? c : c + 'B3'; }), borderColor: W.map(function (w) { return w.ws === tw ? '#fff' : 'transparent'; }), borderWidth: 1.5, borderRadius: 3, order: 2 },
          { type: 'line', label: 'Chronic', data: W.map(function (w) { return w.chronic; }), borderColor: '#BA7517', borderWidth: 2.5, pointRadius: 0, tension: .3, order: 1 },
          { type: 'line', label: 'Target', data: W.map(function () { return p.target || null; }), borderColor: 'rgba(186,117,23,.6)', borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0, order: 1 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: false }, tooltip: { callbacks: { afterBody: function (it) { var w = W[it[0].dataIndex]; return [w.throws + ' throws' + (w.pitches ? ' · ' + w.pitches + ' pitches' : ''), (w.pen ? w.pen + ' bullpen ' : '') + (w.live ? w.live + ' live' : ''), 'velo cap ' + w.velo.toFixed(1)].filter(Boolean); } } } },
        scales: { x: { ticks: { color: '#64748b', maxRotation: 0, autoSkip: true, maxTicksLimit: 11 }, grid: { display: false } }, y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,.05)' }, suggestedMax: (p.target || 0) * 1.2 } }
      }
    });
  }

  // ── Tab wiring ─────────────────────────────────────────────────────────
  function tabBtn() {
    var bar = document.getElementById('dashTabs'); if (!bar) return null;
    var b = bar.querySelector('.tab-btn[onclick*="\'throwing\'"]');
    if (!b) {
      b = document.createElement('button'); b.className = 'tab-btn'; b.textContent = 'Throwing';
      b.setAttribute('onclick', "switchDashTab('throwing', this)");
      var wl = bar.querySelector('.tab-btn[onclick*="\'workload\'"]');
      if (wl && wl.nextSibling) bar.insertBefore(b, wl.nextSibling); else bar.appendChild(b);
    }
    return b;
  }
  function syncTabVisibility() {
    var b = tabBtn(); if (!b || typeof currentPlayer === 'undefined') return;
    var p = PLAYERS[currentPlayer], show = !!plan(currentPlayer) || !!(p && isPitcherPos(p.pos));
    b.style.display = show ? '' : 'none';
    if (!show && typeof currentDashTab !== 'undefined' && currentDashTab === 'throwing') {
      var wl = document.querySelector('#dashTabs .tab-btn[onclick*="\'workload\'"]'); if (wl) switchDashTab('workload', wl);
    }
    if (typeof mwSyncTabs === 'function') mwSyncTabs();
  }
  if (typeof switchDashTab === 'function') {
    var _sdt = switchDashTab;
    switchDashTab = function (tab) {
      var r = _sdt.apply(this, arguments);
      try {
        var el = ensurePane();
        if (el) { if (tab === 'throwing') { el.style.display = 'block'; el.classList.add('active'); el.classList.remove('page'); WEEK_OFF = 0; renderPane(); } else { el.style.display = 'none'; el.classList.remove('active'); el.classList.add('page'); } }
      } catch (e) { console.error('[throwing] tab', e); }
      return r;
    };
  }
  if (typeof applyPitcherTabs === 'function') {
    var _apt = applyPitcherTabs;
    applyPitcherTabs = function () { var r = _apt.apply(this, arguments); try { syncTabVisibility(); } catch (e) {} return r; };
  }
  if (typeof selectPlayer === 'function') {
    var _sp = selectPlayer;
    selectPlayer = function () { var r = _sp.apply(this, arguments); try { syncTabVisibility(); if (typeof currentDashTab !== 'undefined' && currentDashTab === 'throwing') { WEEK_OFF = 0; renderPane(); } } catch (e) {} return r; };
  }

  // ── Calendar ───────────────────────────────────────────────────────────
  function filterVal() { return ((document.getElementById('cal-athlete-filter') || {}).value) || ''; }
  function throwersOn(dk, f) {
    return Object.keys(THR).filter(function (n) { return (!f || n === f) && PLAYERS[n] && !PLAYERS[n].inactive; }).map(function (n) { var x = dayOf(n, dk); return x && x.kind !== 'off' ? { name: n, x: x } : null; }).filter(Boolean);
  }
  function chip(n, x, dk, showName) {
    var cf = conflictOn(n, dk).some(function (c) { return c.d === dk; });
    var who = String(n).split(' ').slice(-1)[0];
    var txt = (showName ? who + ' · ' : '') + (mound(x.kind) ? short(x.type) + (x.pitches ? ' · ' + x.pitches + 'p' : '') : 'Throw ' + short(x.type).toLowerCase() + ' · ' + x.throws);
    return '<div class="thr-chip" style="--k:' + KC[x.kind] + ';" title="' + esc(n + ' · ' + x.type + ' · cap ' + x.velo + ' mph · load ' + x.load + ' · ' + x.throws + ' throws' + (x.pitches ? ' · ' + x.pitches + ' pitches' : '') + (cf ? ' · lift conflict' : '')) + '" onclick="event.stopPropagation();showDayDetail(\'' + dk + '\')">'
      + '<span>' + esc(txt) + '</span>' + (cf ? '<span class="warn">' + ico('flag', 10) + '</span>' : '') + '</div>';
  }
  function sumChip(list, dk) {
    var pens = list.filter(function (t) { return t.x.kind === 'pen'; }).length, live = list.filter(function (t) { return t.x.kind === 'live'; }).length;
    return '<div class="thr-sum" title="' + esc(list.map(function (t) { return t.name + ': ' + t.x.type; }).join('\n')) + '" onclick="event.stopPropagation();showDayDetail(\'' + dk + '\')">'
      + '<span class="thr-dot" style="background:' + (live ? KC.live : pens ? KC.pen : KC.med) + ';"></span><span><b>' + list.length + '</b> throwing</span>'
      + (pens ? '<span style="color:' + KC.pen + ';">' + pens + ' pen' + (pens > 1 ? 's' : '') + '</span>' : '') + (live ? '<span style="color:' + KC.live + ';">' + live + ' live</span>' : '') + '</div>';
  }
  function postMonth() {
    var f = filterVal();
    document.querySelectorAll('#calendarGrid .cal-cell[data-date]').forEach(function (cell) {
      var dk = cell.getAttribute('data-date'), list = throwersOn(dk, f); if (!list.length) return;
      var html = (f || list.length === 1) ? list.map(function (t) { return chip(t.name, t.x, dk, !f); }).join('') : sumChip(list, dk);
      var addb = cell.querySelector('.add-game-btn');
      if (addb) addb.insertAdjacentHTML('beforebegin', html); else cell.insertAdjacentHTML('beforeend', html);
    });
  }
  function postWeek() {
    var f = filterVal();
    document.querySelectorAll('#calendarGrid .cal-week-col').forEach(function (col) {
      var m = (col.getAttribute('onclick') || '').match(/showDayDetail\('([\d-]+)'\)/); if (!m) return;
      col.insertAdjacentHTML('beforeend', throwersOn(m[1], f).map(function (t) { return chip(t.name, t.x, m[1], !f); }).join(''));
    });
  }
  if (typeof renderMonthView === 'function') { var _rmv = renderMonthView; renderMonthView = function () { var r = _rmv.apply(this, arguments); try { postMonth(); } catch (e) { console.error('[throwing] month', e); } return r; }; }
  if (typeof renderWeekView === 'function') { var _rwv = renderWeekView; renderWeekView = function () { var r = _rwv.apply(this, arguments); try { postWeek(); } catch (e) { console.error('[throwing] week', e); } return r; }; }
  if (typeof showDayDetail === 'function') {
    var _sdd = showDayDetail;
    showDayDetail = function (dk) {
      var r = _sdd.apply(this, arguments);
      try {
        var c = document.getElementById('dayDetailContent'), list = throwersOn(dk, filterVal()); if (!c || !list.length) return r;
        c.insertAdjacentHTML('beforeend', '<div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin:14px 0 8px;">Throwing</div>' + list.map(function (t) {
          var x = t.x, p = plan(t.name), cf = conflictOn(t.name, dk).filter(function (q) { return q.d === dk; });
          return '<div class="thr-card" style="--k:' + KC[x.kind] + ';"><div style="flex:1;min-width:180px;"><div class="t">' + esc(t.name) + ' · ' + esc(short(x.type)) + '</div>'
            + '<div class="s"><span>' + esc(focusOn(p, dk) || '') + '</span>' + (cf.length ? '<span style="color:#f59e0b;">' + ico('flag', 11) + ' ' + esc(cf[0].rule.toLowerCase()) + ': ' + esc(cf[0].lift) + '</span>' : '') + '</div></div>'
            + '<div class="thr-stat"><small>Velo cap</small>' + x.velo.toFixed(1) + '</div><div class="thr-stat"><small>Throws</small>' + x.throws + (x.pitches ? ' · ' + x.pitches + 'p' : '') + '</div>'
            + '<div class="thr-stat"><small>Load</small>' + x.load + '</div><div class="thr-stat"><small>Chronic</small>' + num(x.chronic) + '</div><div class="thr-stat"><small>WACR</small>' + x.wacr.toFixed(2) + '</div></div>';
        }).join(''));
      } catch (e) { console.error('[throwing] day', e); }
      return r;
    };
  }
  if (typeof switchTab === 'function') {
    var _swt = switchTab;
    switchTab = function (page) {
      var r = _swt.apply(this, arguments);
      try {
        var lg = document.getElementById('cal-legend');
        if (page === 'calendar' && lg && !lg.querySelector('.thr-lg') && Object.keys(THR).length) {
          lg.insertAdjacentHTML('beforeend', '<span class="mw-sep thr-lg"></span><span class="thr-lg"><i style="--c:' + KC.med + ';background:' + KC.med + ';"></i>Throwing</span><span class="thr-lg"><i style="background:' + KC.pen + ';"></i>Bullpen</span><span class="thr-lg"><i style="background:' + KC.live + ';"></i>Live / sim</span>');
        }
      } catch (e) {}
      return r;
    };
  }

  // ── Annual plan rows ───────────────────────────────────────────────────
  if (typeof apGridHTML === 'function') {
    var _ag = apGridHTML;
    apGridHTML = function (M, opts) {
      var h = _ag.apply(this, arguments);
      try {
        var p = plan(M.athlete); if (!p) return h;
        var W = M.weeks.slice(opts.from || 0, opts.to || M.weeks.length), A = {}, maxL = 1;
        weekAgg(p).forEach(function (w) { A[w.ws] = w; maxL = Math.max(maxL, w.load); });
        var tgt = p.target || Math.max.apply(null, p.days.map(function (a) { return a[6]; }));
        var cdWeek = p.chronicDate ? iso(monday(D(p.chronicDate))) : null;
        var td = function (w, inner, extra, title) { return '<td class="c' + (w.isToday ? ' today' : '') + '"' + (extra ? ' style="' + extra + '"' : '') + (title ? ' title="' + esc(title) + '"' : '') + '>' + (inner || '') + '</td>'; };
        var row = function (label, cells) { return '<tr class="thr"><td class="lbl">' + label + '</td>' + cells + '</tr>'; };
        var get = function (w) { return A[iso(new Date(w.ws.getFullYear(), w.ws.getMonth(), w.ws.getDate(), 12))]; };
        var rows = '<tr class="sec"><td colspan="' + (W.length + 1) + '">Throwing<span class="hint">' + esc(p.title || '') + (p.target ? ' · target chronic ' + num(p.target) + (p.chronicDate ? ' by ' + fmt(p.chronicDate) : '') : '') + '</span></td></tr>';
        rows += row('Throw Phase', W.map(function (w) {
          var a = get(w); if (!a) return td(w, '');
          var f = focusOn(p, iso(add(w.ws, 6))) || '', c = /contin/i.test(f) ? '#3b82f6' : '#14b8a6';
          return td(w, '<div class="thr-ph" style="background:' + c + '33;color:' + c + ';">' + esc(f.slice(0, 4)) + '</div>', '', f);
        }).join(''));
        rows += row('Throw Load', W.map(function (w) {
          var a = get(w); if (!a || !a.load) return td(w, '');
          var c = a.live ? KC.live : a.pen ? KC.pen : KC.med;
          return td(w, '<div class="thr-bar"><i style="height:' + Math.max(8, a.load / maxL * 100) + '%;background:' + c + ';"></i></div>', '', 'Week of ' + fmt(a.ws) + ': load ' + a.load + ' · ' + a.throws + ' throws' + (a.pitches ? ' · ' + a.pitches + ' pitches' : ''));
        }).join(''));
        rows += row('Chronic', W.map(function (w) {
          var a = get(w); if (!a) return td(w, '');
          var pc = Math.min(100, a.chronic / tgt * 100), hit = cdWeek && a.ws === cdWeek;
          return td(w, '<div class="thr-bar" style="position:relative;"><i style="height:' + Math.max(6, pc) + '%;background:' + (a.chronic >= tgt * 0.98 ? '#BA7517' : 'rgba(186,117,23,.55)') + ';"></i>' + (hit ? '<span style="position:absolute;top:-1px;left:50%;transform:translateX(-50%);color:#f59e0b;font-size:9px;">◆</span>' : '') + '</div>', '', 'Chronic ' + num(a.chronic) + ' (' + Math.round(a.chronic / tgt * 100) + '% of target)' + (hit ? ' · target reached' : ''));
        }).join(''));
        rows += row('Velo Cap', W.map(function (w) { var a = get(w); return td(w, a && a.velo ? Math.round(a.velo) : '', 'font-size:9px;color:var(--text2);'); }).join(''));
        rows += row('Mound Days', W.map(function (w) {
          var a = get(w); if (!a || !(a.pen + a.live)) return td(w, '');
          var dots = ''; for (var i = 0; i < a.pen; i++) dots += '<span class="thr-dot" style="background:' + KC.pen + ';margin:0 1px;"></span>'; for (var j = 0; j < a.live; j++) dots += '<span class="thr-dot" style="background:' + KC.live + ';margin:0 1px;"></span>';
          return td(w, dots, '', (a.pen ? a.pen + ' bullpen ' : '') + (a.live ? a.live + ' live/sim' : ''));
        }).join(''));
        var notes = h.indexOf('<tr class="sec"><td colspan="' + (W.length + 1) + '">Notes</td></tr>');
        var at = notes >= 0 ? notes : h.lastIndexOf('</tbody>');
        return h.slice(0, at) + rows + h.slice(at);
      } catch (e) { console.error('[throwing] annual', e); return h; }
    };
  }

  // ── Boot ───────────────────────────────────────────────────────────────
  function boot() { try { ensurePane(); tabBtn(); syncTabVisibility(); } catch (e) { console.error('[throwing] boot', e); } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  // Cloud data loads after first paint — pick up the throwing key when it lands
  var _seen = localStorage.getItem(KEY);
  setInterval(function () { var v = localStorage.getItem(KEY); if (v !== _seen) { _seen = v; load(); rerenderAll(); } }, 3000);
})();
