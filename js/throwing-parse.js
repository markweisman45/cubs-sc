// ═══════════════════════════════════════════════════════════════════════════
// Throwing program PDF → structured plan.
// Reads the daily table (Day · Date · Type · Velo Cap · Load · Pitches ·
// Total Throws · Chronic · WACR) by matching every value to its column header
// by position, so blank columns (no pitches on flat-ground days) don't shift
// the numbers. Also picks up the summary row (start, chronic-reached date,
// end, target chronic, max WACR) and each week's focus (Build / Continuation).
// Works on any pitcher's program exported from the same system.
// ═══════════════════════════════════════════════════════════════════════════
var THR_PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';

function thrLoadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return new Promise(function (res, rej) {
    var s = document.createElement('script'); s.src = THR_PDFJS + 'pdf.min.js';
    s.onload = function () { window.pdfjsLib.GlobalWorkerOptions.workerSrc = THR_PDFJS + 'pdf.worker.min.js'; res(window.pdfjsLib); };
    s.onerror = function () { rej(new Error('Could not load the PDF reader. Check your connection and try again.')); };
    document.head.appendChild(s);
  });
}

function thrISO(mdy) {
  var m = String(mdy || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); if (!m) return null;
  var y = +m[3]; if (y < 100) y += 2000;
  return y + '-' + String(+m[1]).padStart(2, '0') + '-' + String(+m[2]).padStart(2, '0');
}
function thrNum(s) { var v = parseFloat(String(s == null ? '' : s).replace(/[^0-9.\-]/g, '')); return isFinite(v) ? v : 0; }

// Group a page's text items into rows (by baseline) with centers for column matching
function thrRows(tc) {
  var rows = [];
  tc.items.forEach(function (it) {
    var s = (it.str || '').trim(); if (!s) return;
    var x = it.transform[4], y = it.transform[5], w = it.width || 0;
    var r = rows.find(function (q) { return Math.abs(q.y - y) <= 2; });
    if (!r) { r = { y: y, items: [] }; rows.push(r); }
    r.items.push({ s: s, x: x, cx: x + w / 2 });
  });
  rows.forEach(function (r) { r.items.sort(function (a, b) { return a.x - b.x; }); });
  return rows.sort(function (a, b) { return b.y - a.y; });
}
function thrHas(row, s) { return row.items.some(function (i) { return i.s === s; }); }
function thrNearest(cols, cx) {
  var best = null, bd = 1e9;
  cols.forEach(function (c) { var d = Math.abs(c.cx - cx); if (d < bd) { bd = d; best = c; } });
  return best;
}

async function thrParseDoc(doc) {
  var out = { athlete: '', title: '', start: null, chronicDate: null, end: null, target: null, deadline: null, final: null, maxWacr: null, weeks: [], days: [] };
  var seen = {};
  for (var pn = 1; pn <= doc.numPages; pn++) {
    var page = await doc.getPage(pn), rows = thrRows(await page.getTextContent());
    if (pn === 1 && rows.length) {
      var top = rows[0].items; if (top.length > 1) out.athlete = top[top.length - 1].s;
      var t = rows.find(function (r) { return r.items.length === 1 && /program/i.test(r.items[0].s) && !/^[A-Z\s]+$/.test(r.items[0].s); });
      if (t) out.title = t.items[0].s;
    }
    var dayCols = null, weekCols = null;
    for (var ri = 0; ri < rows.length; ri++) {
      var row = rows[ri];
      // Summary header → values on the next row, matched by column
      if (out.start == null && thrHas(row, 'START') && thrHas(row, 'MAX WACR') && rows[ri + 1]) {
        var vals = rows[ri + 1].items, get = function (name) { var h = row.items.find(function (i) { return i.s === name; }); if (!h) return null; var v = thrNearest(vals.map(function (q) { return { s: q.s, cx: q.cx }; }), h.cx); return v ? v.s : null; };
        out.start = thrISO(get('START')); out.chronicDate = thrISO(get('CHRONIC REACHED DATE')); out.end = thrISO(get('PROGRAM END'));
        out.target = thrNum(get('TARGET CHRONIC')) || null; out.deadline = thrNum(get('DEADLINE CHRONIC')) || null; out.final = thrNum(get('FINAL CHRONIC')) || null; out.maxWacr = thrNum(get('MAX WACR')) || null;
        continue;
      }
      if (thrHas(row, 'Day') && thrHas(row, 'Date') && thrHas(row, 'Type') && thrHas(row, 'Chronic')) { dayCols = row.items.map(function (i) { return { name: i.s, cx: i.cx }; }); continue; }
      if (thrHas(row, 'Week') && thrHas(row, 'Dates') && thrHas(row, 'Week Focus')) { weekCols = row.items.map(function (i) { return { name: i.s, cx: i.cx }; }); continue; }
      if (dayCols) {
        var rec = {};
        row.items.forEach(function (i) { var c = thrNearest(dayCols, i.cx); if (c) rec[c.name] = rec[c.name] ? rec[c.name] + ' ' + i.s : i.s; });
        var d = thrISO(rec['Date']);
        if (d && rec['Type'] && /^\d+$/.test(rec['Day'] || '') && !seen[d]) {
          seen[d] = 1;
          out.days.push([d, rec['Type'], thrNum(rec['Velo Cap']), thrNum(rec['Load']), thrNum(rec['Pitches']), thrNum(rec['Total Throws']), thrNum(rec['Chronic']), thrNum(rec['WACR'])]);
        }
      } else if (weekCols) {
        var dc = weekCols.find(function (c) { return c.name === 'Dates'; }), fc = weekCols.find(function (c) { return c.name === 'Week Focus'; });
        var di = row.items.find(function (i) { return Math.abs(i.cx - dc.cx) < 30 && thrISO(i.s); });
        var fi = row.items.find(function (i) { return Math.abs(i.cx - fc.cx) < 40 && /^[A-Za-z][A-Za-z \-\/]+$/.test(i.s); });
        if (di && fi && !out.weeks.some(function (w) { return w[0] === thrISO(di.s); })) out.weeks.push([thrISO(di.s), fi.s]);
      }
    }
  }
  out.days.sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
  out.weeks.sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
  if (!out.days.length) throw new Error('Couldn\'t find the day-by-day table in this PDF. Use the full throwing program export (the one with Day, Date, Type, Velo Cap, Load and Chronic columns).');
  if (!out.start) out.start = out.days[0][0];
  if (!out.end) out.end = out.days[out.days.length - 1][0];
  return out;
}

async function thrParsePDF(buf) {
  var lib = await thrLoadPdfJs();
  var doc = await lib.getDocument({ data: buf }).promise;
  return thrParseDoc(doc);
}
if (typeof module !== 'undefined') module.exports = { thrParseDoc: thrParseDoc };
