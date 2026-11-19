// ═══════════════════════════════════════════════════════════════════════════
// RATIO TABLE — edit every load ratio in one spreadsheet-style view.
// Opened from the Exercise Library ("📐 Ratios"). Edits are staged until Save.
//   • Library exercises: saved on the entry (rmParent / rmRatio), same as the
//     ✏ Edit modal, so both stay in sync.
//   • Template-only names with no Library entry: saved in LOAD_RATIO_OVERRIDES_KEY.
// Both live in cubs_sc_* localStorage keys, so the normal cloud sync backs
// them up. After saving, offers to update loads on live programs.
// Needs js/load-ratios.js (loadRatioFor, DEFAULT_LOAD_RATIOS, rmRefreshLivePrograms).
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  var S = { pending: {}, sel: {}, q: '', parent: '', showAll: false, onlyChanged: false };

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function lc(s) { return String(s || '').trim().toLowerCase(); }
  function titleCase(s) { return String(s).replace(/(^|[\s(\-/])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); }).replace(/\b(Bb|Db|Kb|Sl|Sa|Rfe|Ffe|Oh|Rdl|Dl|Ss)\b/g, function (m) { return m.toUpperCase(); }); }
  function lifts() { return ['Body Weight'].concat(typeof RM_LIFTS !== 'undefined' ? RM_LIFTS : []); }
  function dbEx(name) { return (typeof _lrDbEx === 'function') ? _lrDbEx(name) : null; }
  function suffix(name) { return (typeof TC !== 'undefined' && TC.loadSuffix) ? TC.loadSuffix({ name: name }) : ''; }

  // Every row the table can show: { key, name, inLib, cur:[parent,pct,how]|null, def:[parent,pct]|null }
  function allRows() {
    var seen = {}, rows = [];
    function add(name, inLib) {
      var k = lc(name);
      if (!k || seen[k]) return;
      seen[k] = 1;
      var r = loadRatioFor(name);
      var d = DEFAULT_LOAD_RATIOS[k] || null;
      if (r && lc(r[0]) === k) return;           // a main lift pointing at itself
      var ex = inLib ? dbEx(name) : null;
      if (ex && ex.liftKey) return;              // has its own tested-1RM lift
      rows.push({ key: k, name: name, inLib: inLib, cur: r ? [r[0], Math.round(r[1] * 1000) / 10, r[2]] : null, def: d ? [d[0], Math.round(d[1] * 1000) / 10] : null });
    }
    (typeof EXERCISE_DB !== 'undefined' ? EXERCISE_DB : []).forEach(function (e) { if (e && e.name) add(e.name, true); });
    Object.keys(DEFAULT_LOAD_RATIOS).forEach(function (k) { add(titleCase(k), false); });
    return rows;
  }

  // What a row shows right now (staged edit, else saved)
  function view(row) {
    var p = S.pending[row.key];
    if (p && p.reset) return row.def ? { parent: row.def[0], pct: row.def[1], how: 'default', changed: true } : { parent: '', pct: '', how: 'none', changed: true };
    if (p) return { parent: p.parent, pct: p.pct, how: 'custom', changed: true, incomplete: !!p.incomplete };
    return row.cur ? { parent: row.cur[0], pct: row.cur[1], how: row.cur[2], changed: false } : { parent: '', pct: '', how: 'none', changed: false };
  }

  function visible() {
    var q = lc(S.q);
    return allRows().filter(function (r) {
      var v = view(r);
      if (!S.showAll && !v.parent && !S.pending[r.key]) return false;
      if (S.parent && v.parent !== S.parent) return false;
      if (q && r.key.indexOf(q) === -1) return false;
      if (S.onlyChanged && !v.changed && v.how !== 'custom') return false;
      return true;
    }).sort(function (a, b) {
      var pa = view(a).parent || 'zzz', pb = view(b).parent || 'zzz';
      return pa === pb ? a.name.localeCompare(b.name) : pa.localeCompare(pb);
    });
  }

  function stage(row, parent, pct) {
    pct = parseFloat(pct);
    if (!parent && !(pct > 0)) { S.pending[row.key] = { reset: true }; return; }
    // Half-filled (lift but no %, or % but no lift): keep it on screen until the other box is filled
    if (!parent || !(pct > 0)) { S.pending[row.key] = { parent: parent || '', pct: pct > 0 ? Math.round(pct * 10) / 10 : '', incomplete: true }; return; }
    pct = Math.round(pct * 10) / 10;
    if (row.def && row.def[0] === parent && row.def[1] === pct) { S.pending[row.key] = { reset: true }; return; }
    S.pending[row.key] = { parent: parent, pct: pct };
  }

  function parentOptions(sel, blank) {
    var ls = lifts();
    if (sel && ls.indexOf(sel) === -1) ls.unshift(sel);
    return (blank !== undefined ? '<option value="">' + blank + '</option>' : '') + ls.map(function (l) { return '<option' + (l === sel ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('');
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function render() {
    var body = document.getElementById('rt-body');
    if (!body) return;
    var rows = visible();
    var nSel = rows.filter(function (r) { return S.sel[r.key]; }).length;
    var nPend = Object.keys(S.pending).filter(function (k) { return !S.pending[k].incomplete; }).length;
    var used = {}; allRows().forEach(function (r) { var p = view(r).parent; if (p) used[p] = (used[p] || 0) + 1; });

    var pf = document.getElementById('rt-parent-filter');
    if (pf) pf.innerHTML = '<option value="">All main lifts</option>' + Object.keys(used).sort().map(function (p) { return '<option' + (p === S.parent ? ' selected' : '') + ' value="' + esc(p) + '">' + esc(p) + ' (' + used[p] + ')</option>'; }).join('');

    document.getElementById('rt-count').textContent = rows.length + ' exercise' + (rows.length === 1 ? '' : 's') + (nSel ? ' · ' + nSel + ' selected' : '');
    document.getElementById('rt-bulk').style.opacity = nSel ? '1' : '0.45';
    document.getElementById('rt-bulk').style.pointerEvents = nSel ? '' : 'none';
    var save = document.getElementById('rt-save');
    save.disabled = !nPend;
    save.textContent = nPend ? '💾 Save ' + nPend + ' change' + (nPend === 1 ? '' : 's') : 'No changes';
    var all = document.getElementById('rt-all');
    all.checked = rows.length > 0 && nSel === rows.length;

    if (!rows.length) { body.innerHTML = '<tr><td colspan="6" style="padding:24px;text-align:center;color:var(--text3);">No exercises match.</td></tr>'; return; }

    body.innerHTML = rows.map(function (r) {
      var v = view(r), suf = suffix(r.name);
      var tag = v.incomplete ? '<span style="color:#f59e0b;">● needs ' + (v.parent ? 'a %' : 'a lift') + '</span>'
        : v.changed ? '<span style="color:#f59e0b;">● unsaved</span>'
        : v.how === 'custom' ? '<span style="color:#5DCAA5;">your number</span>'
        : v.how === 'default' ? '<span style="color:var(--text3);">default</span>' : '<span style="color:var(--text3);">—</span>';
      var def = r.def ? r.def[1] + '% of ' + esc(r.def[0]) : '—';
      return '<tr data-k="' + esc(r.key) + '" style="border-top:1px solid var(--border);' + (S.sel[r.key] ? 'background:rgba(93,202,165,0.07);' : '') + '">'
        + '<td style="padding:5px 6px;"><input type="checkbox" class="rt-sel"' + (S.sel[r.key] ? ' checked' : '') + '></td>'
        + '<td style="padding:5px 6px;">' + esc(r.name) + (suf ? ' <span style="font-size:10px;color:var(--text3);">' + suf.replace('/', 'per ') + '</span>' : '') + (r.inLib ? '' : ' <span title="Used in templates; not a Library card" style="font-size:10px;color:var(--text3);">(template)</span>') + '</td>'
        + '<td style="padding:5px 6px;"><select class="rt-parent" style="background:var(--bg3);border:1px solid var(--border2);border-radius:5px;color:var(--text);font-size:12px;padding:3px 4px;max-width:170px;">' + parentOptions(v.parent, '— none —') + '</select></td>'
        + '<td style="padding:5px 6px;white-space:nowrap;"><input class="rt-pct" type="number" step="1" min="1" max="200" value="' + esc(v.pct) + '" style="width:62px;background:var(--bg3);border:1px solid ' + (v.changed ? '#f59e0b' : 'var(--border2)') + ';border-radius:5px;color:var(--text);font-size:12px;padding:3px 5px;"> %</td>'
        + '<td style="padding:5px 6px;font-size:11px;color:var(--text3);">' + def + '</td>'
        + '<td style="padding:5px 6px;font-size:11px;">' + tag + '</td></tr>';
    }).join('');
  }

  function rowByKey(k) { return allRows().find(function (r) { return r.key === k; }); }

  // ── Bulk actions on selected rows ─────────────────────────────────────────
  function bulk(kind) {
    var rows = visible().filter(function (r) { return S.sel[r.key]; });
    if (!rows.length) return;
    var val = parseFloat(document.getElementById('rt-bulk-val').value);
    var par = document.getElementById('rt-bulk-parent').value;
    if ((kind === 'set' || kind === 'add' || kind === 'scale') && !(val || val === 0)) { alert('Type a number first.'); return; }
    rows.forEach(function (r) {
      var v = view(r);
      if (kind === 'reset') { S.pending[r.key] = { reset: true }; if (r.cur && r.cur[2] !== 'custom') delete S.pending[r.key]; return; }
      if (kind === 'parent') { if (!par) return; stage(r, par, v.pct || (r.def && r.def[1]) || ''); return; }
      if (!v.parent) return;
      var pct = parseFloat(v.pct) || 0;
      if (kind === 'set') pct = val;
      if (kind === 'add') pct = pct + val;
      if (kind === 'scale') pct = pct * (1 + val / 100);
      stage(r, v.parent, Math.max(1, Math.round(pct)));
    });
    render();
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  function save() {
    var held = Object.keys(S.pending).filter(function (k) { return S.pending[k].incomplete; });
    var keys = Object.keys(S.pending).filter(function (k) { return !S.pending[k].incomplete; });
    if (!keys.length) return;
    var ov = loadRatioOverrides();
    keys.forEach(function (k) {
      var p = S.pending[k], row = rowByKey(k);
      var ex = row && row.inLib ? dbEx(row.name) : null;
      var parent = p.reset ? '' : p.parent, pct = p.reset ? '' : p.pct;
      if (ex) { ex.rmParent = parent; ex.rmRatio = pct; delete ov[k]; }
      else if (p.reset) delete ov[k];
      else ov[k] = [parent, pct];
    });
    saveLoadRatioOverrides(ov);
    if (typeof persistExerciseDB === 'function') persistExerciseDB();   // localStorage + cloud sync
    else if (typeof syncToSupabase === 'function') setTimeout(syncToSupabase, 1000);
    var keep = {}; held.forEach(function (k) { keep[k] = S.pending[k]; });
    S.pending = keep;
    if (typeof renderLibrary === 'function') renderLibrary();
    render();
    var msg = document.getElementById('rt-msg');
    msg.innerHTML = '<span style="color:var(--green);">✅ Saved ' + keys.length + ' ratio' + (keys.length === 1 ? '' : 's') + ' — backed up to the cloud.</span>'
      + (held.length ? ' <span style="color:#f59e0b;">' + held.length + ' still need' + (held.length === 1 ? 's' : '') + ' a lift and a % — not saved yet.</span>' : '');
    offerLiveUpdate(msg);
  }

  // New ratios change baked loads on programs already sent → offer to update them
  async function offerLiveUpdate(msg) {
    var db = typeof getSupaClient === 'function' ? getSupaClient() : null;
    if (!db || typeof rmRefreshLivePrograms !== 'function') return;
    var box = document.createElement('div'); box.style.marginTop = '4px'; msg.appendChild(box);
    box.innerHTML = '<span style="color:var(--text3);">Checking live programs…</span>';
    try {
      var q = await db.from('athlete_programs').select('athlete');
      if (q.error) throw q.error;
      var ath = Array.from(new Set((q.data || []).map(function (r) { return r.athlete; }).filter(Boolean)));
      var hits = [];
      for (var i = 0; i < ath.length; i++) {
        var f = await rmRefreshLivePrograms(ath[i], true);
        var n = f.reduce(function (s, r) { return s + r.changes.length; }, 0);
        if (n) hits.push({ a: ath[i], n: n, p: f.length });
      }
      if (!hits.length) { box.innerHTML = '<span style="color:var(--text3);">No live programs need new loads.</span>'; return; }
      box.innerHTML = '<span style="color:var(--yellow);">Live programs with loads that change: ' + hits.map(function (h) { return esc(h.a) + ' (' + h.n + ')'; }).join(', ') + '</span> '
        + '<button id="rt-live-go" class="generate-btn" style="padding:5px 10px;font-size:11px;margin-left:4px;">↻ Update ' + (hits.length === 1 ? 'it' : 'all ' + hits.length) + '</button>';
      document.getElementById('rt-live-go').onclick = async function () {
        this.disabled = true; this.textContent = 'Updating…';
        var bad = [];
        for (var j = 0; j < hits.length; j++) {
          try { (await rmRefreshLivePrograms(hits[j].a, false)).forEach(function (r) { if (r.err) bad.push(hits[j].a + ': ' + r.err); }); }
          catch (e) { bad.push(hits[j].a + ': ' + (e.message || e)); }
        }
        box.innerHTML = bad.length ? '<span style="color:#f87171;">⚠ Some updates failed — ' + esc(bad.join('; ')) + '</span>'
          : '<span style="color:var(--green);">✅ Updated. Athletes see the new loads (with a note) next time they open their link.</span>';
      };
    } catch (e) { box.innerHTML = '<span style="color:var(--yellow);">⚠ Couldn\'t check live programs: ' + esc(e.message || e) + '</span>'; }
  }

  // ── Modal shell ───────────────────────────────────────────────────────────
  function build() {
    var m = document.createElement('div');
    m.id = 'ratioTableModal';
    m.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,0.65);display:none;align-items:flex-start;justify-content:center;padding:4vh 12px;';
    var inp = 'background:var(--bg3);border:1px solid var(--border2);border-radius:6px;color:var(--text);font-size:12px;padding:6px 8px;';
    var btn = 'background:rgba(255,255,255,0.05);border:1px solid var(--border2);border-radius:6px;color:var(--text2);font-size:11px;font-weight:600;padding:6px 10px;cursor:pointer;';
    m.innerHTML = '<div style="background:var(--bg2,#111);border:1px solid var(--border);border-radius:10px;width:min(980px,100%);max-height:92vh;display:flex;flex-direction:column;">'
      + '<div style="display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--border);">'
      +   '<div class="card-title" style="margin:0;">📐 Load Ratios</div>'
      +   '<div style="font-size:11px;color:var(--text3);">Exercise 1RM ≈ % × main-lift 1RM. Dumbbell lifts are per DB. A tested 1RM always wins.</div>'
      +   '<button id="rt-close" style="margin-left:auto;background:none;border:none;color:var(--text3);font-size:20px;cursor:pointer;">✕</button></div>'
      + '<div style="padding:10px 16px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;border-bottom:1px solid var(--border);">'
      +   '<input id="rt-q" placeholder="Search…" style="' + inp + 'flex:1;min-width:150px;">'
      +   '<select id="rt-parent-filter" style="' + inp + '"></select>'
      +   '<label style="font-size:11px;color:var(--text2);display:flex;gap:4px;align-items:center;"><input type="checkbox" id="rt-showall"> Include exercises with no ratio</label>'
      +   '<label style="font-size:11px;color:var(--text2);display:flex;gap:4px;align-items:center;"><input type="checkbox" id="rt-onlychanged"> Only my numbers</label></div>'
      + '<div id="rt-bulk" style="padding:8px 16px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;background:rgba(93,202,165,0.05);border-bottom:1px solid var(--border);">'
      +   '<span style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;">Selected:</span>'
      +   '<input id="rt-bulk-val" type="number" placeholder="#" style="' + inp + 'width:64px;">'
      +   '<button data-b="set" style="' + btn + '">Set to #%</button>'
      +   '<button data-b="add" style="' + btn + '">Add # pts</button>'
      +   '<button data-b="scale" style="' + btn + '">Change by #%</button>'
      +   '<span style="width:1px;height:20px;background:var(--border);"></span>'
      +   '<select id="rt-bulk-parent" style="' + inp + '"></select>'
      +   '<button data-b="parent" style="' + btn + '">Set main lift</button>'
      +   '<span style="width:1px;height:20px;background:var(--border);"></span>'
      +   '<button data-b="reset" style="' + btn + '">↺ Reset to default</button></div>'
      + '<div style="overflow:auto;flex:1;padding:0 16px;"><table style="width:100%;border-collapse:collapse;font-size:12px;">'
      +   '<thead style="position:sticky;top:0;background:var(--bg2,#111);z-index:1;"><tr style="text-align:left;font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;">'
      +   '<th style="padding:8px 6px;"><input type="checkbox" id="rt-all"></th><th style="padding:8px 6px;">Exercise</th><th style="padding:8px 6px;">Main lift</th><th style="padding:8px 6px;">% of 1RM</th><th style="padding:8px 6px;">Default</th><th style="padding:8px 6px;"></th></tr></thead>'
      +   '<tbody id="rt-body"></tbody></table></div>'
      + '<div style="padding:12px 16px;border-top:1px solid var(--border);display:flex;gap:10px;align-items:center;flex-wrap:wrap;">'
      +   '<div id="rt-count" style="font-size:11px;color:var(--text3);"></div>'
      +   '<div id="rt-msg" style="font-size:11px;flex:1;min-width:200px;"></div>'
      +   '<button id="rt-discard" style="' + btn + '">Discard</button>'
      +   '<button id="rt-save" class="generate-btn" style="padding:7px 14px;">Save</button></div></div>';
    document.body.appendChild(m);

    document.getElementById('rt-bulk-parent').innerHTML = parentOptions('', 'Main lift…');
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
    document.getElementById('rt-close').onclick = close;
    document.getElementById('rt-q').oninput = function () { S.q = this.value; render(); };
    document.getElementById('rt-parent-filter').onchange = function () { S.parent = this.value; render(); };
    document.getElementById('rt-showall').onchange = function () { S.showAll = this.checked; render(); };
    document.getElementById('rt-onlychanged').onchange = function () { S.onlyChanged = this.checked; render(); };
    document.getElementById('rt-all').onchange = function () { var on = this.checked; visible().forEach(function (r) { if (on) S.sel[r.key] = 1; else delete S.sel[r.key]; }); render(); };
    document.getElementById('rt-save').onclick = save;
    document.getElementById('rt-discard').onclick = function () { S.pending = {}; document.getElementById('rt-msg').innerHTML = ''; render(); };
    Array.prototype.forEach.call(m.querySelectorAll('[data-b]'), function (b) { b.onclick = function () { bulk(b.getAttribute('data-b')); }; });

    var body = document.getElementById('rt-body');
    body.addEventListener('change', function (e) {
      var tr = e.target.closest('tr[data-k]'); if (!tr) return;
      var k = tr.getAttribute('data-k'), row = rowByKey(k); if (!row) return;
      if (e.target.classList.contains('rt-sel')) { if (e.target.checked) S.sel[k] = 1; else delete S.sel[k]; render(); return; }
      var par = tr.querySelector('.rt-parent').value, pct = tr.querySelector('.rt-pct').value;
      if (e.target.classList.contains('rt-parent') && par && !pct && row.def) pct = row.def[1];
      stage(row, par, pct);
      if (row.cur && row.cur[2] === 'default' && S.pending[k] && S.pending[k].reset) delete S.pending[k];
      render();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && m.style.display === 'flex') close(); });
  }

  function close() {
    var n = Object.keys(S.pending).length;
    if (n && !confirm('Discard ' + n + ' unsaved ratio change' + (n === 1 ? '' : 's') + '?')) return;
    S.pending = {};
    document.getElementById('ratioTableModal').style.display = 'none';
  }

  window.openRatioTable = function () {
    if (typeof loadRatioFor !== 'function') { alert('Load ratios aren\'t loaded yet — refresh and try again.'); return; }
    if (!document.getElementById('ratioTableModal')) build();
    S.pending = {}; S.sel = {};
    document.getElementById('rt-msg').innerHTML = '';
    document.getElementById('ratioTableModal').style.display = 'flex';
    render();
  };
})();
