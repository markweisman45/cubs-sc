// ════════════════════════════════════════════════════════════════════
// Session RPE load (athlete-reported) — Workload tab card.
// Athletes rate each finished session 1–10 and enter minutes on their
// program page (program.html finish sheet → completion_log day entries
// {date, rpe, min}). Session load = RPE × minutes (AU, Foster).
//   Weekly load  = sum of the last 7 days
//   Monotony     = 7-day mean daily load / SD (rest days count as 0)
//   Strain       = weekly load × monotony
//   ACWR         = 7-day load / (28-day load ÷ 4), once 21+ days of history
// Separate from the HE / distance load model — different units.
// ════════════════════════════════════════════════════════════════════
var SRPE_CACHE = {};

async function srpeSessions(name, force) {
  var c = SRPE_CACHE[name];
  if (c && !force && Date.now() - c.at < 60000) return c.rows;
  var db = typeof getSupaClient === 'function' ? getSupaClient() : null;
  if (!db) return [];
  var res = await db.from('athlete_programs').select('name,completion_log').eq('athlete', name).not('completion_log', 'is', null);
  if (res.error) throw res.error;
  var rows = [];
  (res.data || []).forEach(function (row) {
    var log = row.completion_log || {};
    Object.keys(log).forEach(function (k) {
      var d = log[k];
      if (k.indexOf('day:') !== 0 || !d || !d.done || !d.date) return;
      var rpe = parseFloat(d.rpe), min = parseFloat(d.min);
      if (!(rpe > 0) || !(min > 0)) return;
      rows.push({ date: d.date, rpe: rpe, min: min, load: Math.round(rpe * min), label: d.dayLabel || ('Day ' + (d.day || '')), program: row.name || '' });
    });
  });
  rows.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  SRPE_CACHE[name] = { at: Date.now(), rows: rows };
  return rows;
}

function srpeIso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

function srpeStats(rows) {
  var byDay = {};
  rows.forEach(function (r) { byDay[r.date] = (byDay[r.date] || 0) + r.load; });
  var today = new Date(); today.setHours(12, 0, 0, 0);
  var days = [];
  for (var i = 27; i >= 0; i--) { var d = new Date(today); d.setDate(d.getDate() - i); var k = srpeIso(d); days.push({ date: k, load: byDay[k] || 0 }); }
  var last7 = days.slice(-7).map(function (d) { return d.load; });
  var wk = last7.reduce(function (a, b) { return a + b; }, 0);
  var mean = wk / 7;
  var sd = Math.sqrt(last7.reduce(function (a, v) { return a + (v - mean) * (v - mean); }, 0) / 7);
  var monotony = sd > 0 ? mean / sd : null;
  var c28 = days.reduce(function (a, d) { return a + d.load; }, 0);
  var first = rows.length ? rows[0].date : null;
  var histDays = first ? Math.round((today - new Date(first + 'T12:00:00')) / 86400000) + 1 : 0;
  var acwr = histDays >= 21 && c28 > 0 ? wk / (c28 / 4) : null;
  var n7 = rows.filter(function (r) { return r.date >= days[21].date; }).length;
  return { days: days, wk: wk, monotony: monotony, strain: monotony !== null ? Math.round(wk * monotony) : null, acwr: acwr, chronic: Math.round(c28 / 4), histDays: histDays, n7: n7 };
}

function srpeAcwrColor(a) {
  if (a === null) return 'var(--text3)';
  if (a >= 0.85 && a <= 1.15) return 'var(--green)';
  if (a >= 0.75 && a <= 1.25) return 'var(--yellow)';
  return 'var(--red)';
}

function srpeBars(days) {
  var max = Math.max.apply(null, days.map(function (d) { return d.load; }).concat([1]));
  var W = 560, H = 90, bw = W / days.length;
  var bars = days.map(function (d, i) {
    var h = d.load ? Math.max(2, Math.round(d.load / max * (H - 14))) : 0;
    var x = (i * bw + 1).toFixed(1), y = H - h;
    return (h ? '<rect x="' + x + '" y="' + y + '" width="' + (bw - 2).toFixed(1) + '" height="' + h + '" rx="2" fill="' + (i >= days.length - 7 ? '#5B8CF5' : 'rgba(91,140,245,.38)') + '"><title>' + d.date + ': ' + d.load + ' AU</title></rect>' : '')
      + '<rect x="' + x + '" y="' + (H - 1) + '" width="' + (bw - 2).toFixed(1) + '" height="1" fill="rgba(255,255,255,.08)"/>';
  }).join('');
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:' + H + 'px;display:block;" preserveAspectRatio="none">' + bars + '</svg>'
    + '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text3);margin-top:3px;"><span>' + fmtDate(days[0].date) + '</span><span>last 7 days</span><span>' + fmtDate(days[days.length - 1].date) + '</span></div>';
}

async function renderSRPECard(force) {
  var page = document.getElementById('dash-workload'); if (!page) return;
  var el = document.getElementById('srpe-card');
  if (!el) { el = document.createElement('div'); el.id = 'srpe-card'; el.className = 'card'; el.style.cssText = 'margin-bottom:16px;padding:14px;'; page.insertBefore(el, page.firstChild); }
  var name = typeof currentPlayer !== 'undefined' ? currentPlayer : '';
  var head = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;"><div class="card-title" style="margin:0;">Session RPE load</div>'
    + '<span style="font-size:10.5px;color:var(--text3);">athlete-reported · RPE × minutes</span>'
    + '<button onclick="renderSRPECard(true)" style="margin-left:auto;background:none;border:1px solid var(--border);border-radius:6px;color:var(--text3);font-size:11px;padding:3px 8px;cursor:pointer;">↻</button></div>';
  el.innerHTML = head + '<div style="font-size:12px;color:var(--text3);">Loading…</div>';
  try {
    var rows = await srpeSessions(name, force);
    if (name !== currentPlayer) return; // switched athletes while loading
    if (!rows.length) {
      el.innerHTML = head + '<div style="font-size:12px;color:var(--text3);line-height:1.6;">No rated sessions yet. When ' + escHtml(name) + ' taps <b>Finish session</b> on their program page, they rate the session 1–10 and enter the minutes — it shows up here.</div>';
      return;
    }
    var s = srpeStats(rows);
    var tile = function (label, val, sub, col) {
      return '<div style="flex:1 1 110px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:9px 10px;">'
        + '<div style="font-size:10px;color:var(--text3);letter-spacing:.04em;text-transform:uppercase;">' + label + '</div>'
        + '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:26px;line-height:1.1;color:' + (col || 'var(--text)') + ';">' + val + '</div>'
        + '<div style="font-size:10.5px;color:var(--text3);">' + sub + '</div></div>';
    };
    var monoCol = s.monotony === null ? null : s.monotony > 2 ? 'var(--red)' : s.monotony > 1.5 ? 'var(--yellow)' : 'var(--green)';
    var tiles = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">'
      + tile('7-day load', s.wk.toLocaleString(), s.n7 + ' session' + (s.n7 === 1 ? '' : 's') + ' · AU')
      + tile('28-day weekly avg', s.chronic.toLocaleString(), 'chronic · AU')
      + tile('ACWR', s.acwr === null ? '—' : s.acwr.toFixed(2), s.acwr === null ? 'building baseline (' + Math.min(s.histDays, 21) + '/21 days)' : '7-day ÷ 28-day avg', srpeAcwrColor(s.acwr))
      + tile('Monotony', s.monotony === null ? '—' : s.monotony.toFixed(2), s.monotony === null ? 'needs variation in 7 days' : '> 2.0 = too similar day to day', monoCol)
      + tile('Strain', s.strain === null ? '—' : s.strain.toLocaleString(), 'weekly load × monotony')
      + '</div>';
    var list = rows.slice(-8).reverse().map(function (r) {
      return '<tr style="border-top:1px solid var(--border);"><td style="padding:5px 4px;color:var(--text2);">' + fmtDate(r.date) + '</td>'
        + '<td style="padding:5px 4px;">' + escHtml(r.label) + '</td>'
        + '<td style="padding:5px 4px;text-align:center;color:#93c5fd;">' + r.rpe + '</td>'
        + '<td style="padding:5px 4px;text-align:center;">' + r.min + '</td>'
        + '<td style="padding:5px 4px;text-align:right;font-family:\'DM Mono\',monospace;">' + r.load + '</td></tr>';
    }).join('');
    el.innerHTML = head + tiles + srpeBars(s.days)
      + '<table style="width:100%;border-collapse:collapse;font-size:11.5px;margin-top:12px;"><tr style="color:var(--text3);font-size:10px;text-transform:uppercase;letter-spacing:.04em;"><td style="padding:3px 4px;">Date</td><td style="padding:3px 4px;">Session</td><td style="padding:3px 4px;text-align:center;">RPE</td><td style="padding:3px 4px;text-align:center;">Min</td><td style="padding:3px 4px;text-align:right;">Load</td></tr>' + list + '</table>';
  } catch (e) {
    console.warn('[renderSRPECard]', e);
    el.innerHTML = head + '<div style="font-size:12px;color:var(--text3);">Couldn\'t load session ratings.</div>';
  }
}

(function () {
  if (typeof document === 'undefined') return;
  var onWorkload = function () { var p = document.getElementById('dash-workload'); return p && p.classList.contains('active'); };
  if (typeof switchDashTab === 'function') { var _sw = switchDashTab; switchDashTab = function (tab) { var x = _sw.apply(this, arguments); if (tab === 'workload') renderSRPECard(); return x; }; }
  if (typeof selectPlayer === 'function') { var _sp = selectPlayer; selectPlayer = function () { var x = _sp.apply(this, arguments); if (onWorkload()) renderSRPECard(); return x; }; }
  if (onWorkload()) renderSRPECard();
})();
