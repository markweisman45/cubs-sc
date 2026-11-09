// ═══════════════════════════════════════════════════════════════════════════
// Annual Plan groups — several athletes share one outline.
//   • A group has its own plan (ANNUAL_PLANS key "grp:<id>_<year>"); every
//     member's Annual Plan shows and edits that outline — change a block once
//     and it changes for all of them
//   • Each member still sees his own live program, logged sessions and real
//     sets×reps / intensity, plus his own "Notes for <athlete>"
//   • 👥 Groups: create (blank or copied from an athlete's plan), add/remove
//     members, rename, delete; leaving can keep a copy of the outline
// Loaded after annual-plan.js.
// ═══════════════════════════════════════════════════════════════════════════
var AG_KEY = 'cubs_sc_annual_groups_v1';
var AG = (function () { try { return JSON.parse(localStorage.getItem(AG_KEY) || '{}') || {}; } catch (e) { return {}; } })();
function agSave() { try { localStorage.setItem(AG_KEY, JSON.stringify(AG)); } catch (e) {} }
function agReload() { try { AG = JSON.parse(localStorage.getItem(AG_KEY) || '{}') || {}; } catch (e) {} }
function agOf(athlete) { var id = Object.keys(AG).find(function (k) { return (AG[k].members || []).indexOf(athlete) >= 0; }); return id || null; }
function agSel() { return (document.getElementById('annual-athlete') || {}).value || ''; }
function agIsGroupSel() { return agSel().indexOf('grp:') === 0; }
function agViewGroup() { var v = agSel(); return v.indexOf('grp:') === 0 ? v.slice(4) : agOf(v); }   // group whose outline is on screen
function agRoster() { return typeof PLAYERS !== 'undefined' ? Object.keys(PLAYERS) : []; }

// Members read/write the group's plan
annualPlanKey = function () {
  var a = agSel() || 'Team', y = (document.getElementById('annual-year') || {}).value || '2026';
  var g = a.indexOf('grp:') === 0 ? null : agOf(a);
  return (g && AG[g] ? 'grp:' + g : a) + '_' + y;
};
function agOwnPlan(create) { var k = agSel() + '_' + ((document.getElementById('annual-year') || {}).value || '2026'); if (create && !ANNUAL_PLANS[k]) ANNUAL_PLANS[k] = { blocks: [] }; return ANNUAL_PLANS[k] || { blocks: [] }; }

// No auto-blocks from one athlete's live program into a shared outline
(function () {
  var _s = apSyncLiveBlocks;
  apSyncLiveBlocks = function () { if (annualPlanKey().indexOf('grp:') === 0) return; return _s.apply(this, arguments); };
})();

// Dropdown: groups at the top, members tagged
function agFillSelect() {
  var sel = document.getElementById('annual-athlete'); if (!sel) return;
  var cur = sel.value;
  Array.prototype.slice.call(sel.querySelectorAll('optgroup[data-ag], option[value^="grp:"]')).forEach(function (o) { o.remove(); });
  Array.prototype.slice.call(sel.options).forEach(function (o) { var g = agOf(o.value); o.textContent = o.value + (g && AG[g] ? '  · 👥 ' + AG[g].name : ''); });
  var ids = Object.keys(AG).sort(function (a, b) { return AG[a].name.localeCompare(AG[b].name); });
  if (ids.length) {
    var og = document.createElement('optgroup'); og.label = 'Groups'; og.setAttribute('data-ag', '1');
    ids.forEach(function (id) { var o = document.createElement('option'); o.value = 'grp:' + id; o.textContent = '👥 ' + AG[id].name + ' (' + (AG[id].members || []).length + ')'; og.appendChild(o); });
    sel.insertBefore(og, sel.firstChild);
  }
  if (cur && Array.prototype.some.call(sel.options, function (o) { return o.value === cur; })) sel.value = cur;
}
(function () {
  var _i = initAnnualPlan;
  initAnnualPlan = function () { agReload(); var r = _i.apply(this, arguments); agFillSelect(); return r; };
})();

// Banner + per-athlete notes under the grid
(function () {
  var _b = apRenderBelow;
  apRenderBelow = function (M) {
    _b.apply(this, arguments);
    var host = document.getElementById('annual-below'); if (!host) return;
    var gid = agViewGroup(), g = gid && AG[gid];
    var old = document.getElementById('ag-banner'); if (old) old.remove();
    var ban = document.createElement('div'); ban.id = 'ag-banner';
    ban.style.cssText = 'grid-column:1/-1;display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:9px 12px;border-radius:8px;font-size:12px;';
    var btn = 'padding:5px 10px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;';
    if (g && agIsGroupSel()) {
      ban.style.cssText += 'background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.4);color:#c7d2fe;';
      ban.innerHTML = '👥 <b>' + apEsc(g.name) + '</b> outline — shared by ' + ((g.members || []).length ? (g.members || []).map(apEsc).join(', ') : 'no one yet')
        + '. Blocks, plan notes and week notes here apply to every member.'
        + '<button onclick="agOpenModal(\'' + gid + '\')" style="' + btn + 'margin-left:auto;background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.5);color:#c7d2fe;">Edit group</button>';
    } else if (g) {
      ban.style.cssText += 'background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.4);color:#c7d2fe;';
      ban.innerHTML = '👥 Following <b>' + apEsc(g.name) + '</b> — the outline is shared with ' + ((g.members || []).filter(function (m) { return m !== M.athlete; }).map(apEsc).join(', ') || 'no one else') + '. Changes to blocks apply to the whole group; his live program and notes below are his own.'
        + '<span style="margin-left:auto;display:flex;gap:6px;"><button onclick="agShowGroup(\'' + gid + '\')" style="' + btn + 'background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.5);color:#c7d2fe;">Open group</button>'
        + '<button onclick="agLeave(\'' + apEsc(M.athlete).replace(/'/g, "\\'") + '\')" style="' + btn + 'background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:#94a3b8;">Leave group</button></span>';
      // His own notes (outside the shared outline)
      var own = agOwnPlan(false);
      var box = document.createElement('div');
      box.innerHTML = '<div class="card-title" style="margin:12px 0 6px;">🧍 Notes for ' + apEsc(M.athlete) + '</div>'
        + '<textarea placeholder="Just for him — goals, injury history, what he\'s working on…" onchange="agSaveOwnNotes(this.value)" style="width:100%;min-height:90px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--text);font-size:12px;line-height:1.5;box-sizing:border-box;resize:vertical;">' + apEsc(own.notes || '') + '</textarea>'
        + '<div style="font-size:10px;color:var(--text3);margin-top:4px;">Only on ' + apEsc(M.athlete) + '\'s plan and printouts.</div>';
      host.firstChild.appendChild(box);
      var t = host.querySelector('#ap-plan-notes'); if (t) { var lbl = t.parentElement.querySelector('.card-title'); if (lbl) lbl.textContent = '📝 Group Plan Notes (' + g.name + ')'; }
    } else return;
    host.insertBefore(ban, host.firstChild);
  };
})();
function agSaveOwnNotes(v) { var p = agOwnPlan(true); p.notes = v; saveAnnualData(); if (typeof showStatus === 'function') showStatus('✅ Notes saved'); }
function agShowGroup(gid) { var s = document.getElementById('annual-athlete'); if (s) { s.value = 'grp:' + gid; renderAnnualPlan(); } }

// Print: group name / membership + his own notes
function apPrintTitle(athlete) { var v = agSel(); return v.indexOf('grp:') === 0 && AG[v.slice(4)] ? AG[v.slice(4)].name : athlete; }
function apPrintMeta() {
  var v = agSel(), gid = agViewGroup(), g = gid && AG[gid]; if (!g) return '';
  return v.indexOf('grp:') === 0 ? '<br>Group: ' + apEsc((g.members || []).join(', ')) : '<br>Group: ' + apEsc(g.name);
}
function apPrintExtra() {
  if (agIsGroupSel() || !agOf(agSel())) return '';
  var n = agOwnPlan(false).notes; return n ? '<h2>Notes for ' + apEsc(agSel()) + '</h2><div class="notes pre">' + apEsc(n) + '</div>' : '';
}

// ── Copy plans between keys (all seasons) ──
function agCopyPlans(fromPrefix, toPrefix, replace) {
  var n = 0;
  Object.keys(ANNUAL_PLANS).forEach(function (k) {
    if (k.indexOf(fromPrefix + '_') !== 0) return;
    var yr = k.slice(fromPrefix.length + 1); if (!/^\d{4}$/.test(yr)) return;
    var src = ANNUAL_PLANS[k], dk = toPrefix + '_' + yr;
    if (!replace && ANNUAL_PLANS[dk] && (ANNUAL_PLANS[dk].blocks || []).length) return;
    var copy = JSON.parse(JSON.stringify(src));
    copy.blocks = (copy.blocks || []).map(function (b, i) {
      b.id = 'blk_' + Date.now() + '_' + i + '_' + Math.floor(Math.random() * 1e4);
      delete b.auto; delete b.liveRowId;
      // A sent copy belongs to one athlete — point the shared block at its master instead
      var p = b.linkedProgramId && typeof alProg === 'function' ? alProg(b.linkedProgramId) : null;
      if (p && p.isAssigned && p.sourceProgramId) b.linkedProgramId = String(p.sourceProgramId);
      else if (b.linkedProgramId && !p) { delete b.linkedProgramId; }
      if (!b.linkedProgramId) delete b.linkedProgramName;
      return b;
    });
    ANNUAL_PLANS[dk] = copy; n++;
  });
  return n;
}

// ── Leave ──
function agLeave(athlete) {
  var gid = agOf(athlete), g = gid && AG[gid]; if (!g) return;
  var keep = confirm('Take ' + athlete + ' out of "' + g.name + '"?\n\nOK = keep a copy of the group outline as his own plan\nCancel = choose next');
  if (!keep && !confirm('Take him out and go back to his own previous plan (if he had one)?')) return;
  g.members = (g.members || []).filter(function (m) { return m !== athlete; });
  if (keep) {
    var own = {}; Object.keys(ANNUAL_PLANS).forEach(function (k) { if (k.indexOf(athlete + '_') === 0) own[k] = ANNUAL_PLANS[k].notes; });
    agCopyPlans('grp:' + gid, athlete, true);
    Object.keys(own).forEach(function (k) { if (ANNUAL_PLANS[k] && own[k]) ANNUAL_PLANS[k].notes = own[k] + (ANNUAL_PLANS[k].notes && ANNUAL_PLANS[k].notes !== own[k] ? '\n\n' + ANNUAL_PLANS[k].notes : ''); });
  }
  agSave(); saveAnnualData(); agFillSelect(); renderAnnualPlan();
  if (typeof showStatus === 'function') showStatus('👥 ' + athlete + ' left "' + g.name + '"');
}

// ── Groups modal ──
function agOpenModal(editId) {
  agReload();
  var m = document.createElement('div'); m.id = 'ag-modal';
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  document.body.appendChild(m);
  m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
  agRenderModal(editId || null);
}
function agRenderModal(editId) {
  var m = document.getElementById('ag-modal'); if (!m) return;
  var btn = 'padding:7px 14px;border-radius:6px;font-size:12px;cursor:pointer;';
  var inp = 'width:100%;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:7px 9px;color:#fff;font-size:12px;box-sizing:border-box;';
  var ids = Object.keys(AG).sort(function (a, b) { return AG[a].name.localeCompare(AG[b].name); });
  var body;
  if (editId !== null) {
    var isNew = editId === 'new', g = isNew ? { name: '', members: [] } : AG[editId];
    var cur = agSel(); if (isNew && cur && cur.indexOf('grp:') !== 0) g = { name: '', members: [cur] };
    var roster = agRoster();
    var withPlans = roster.filter(function (a) { return Object.keys(ANNUAL_PLANS).some(function (k) { return k.indexOf(a + '_') === 0 && (ANNUAL_PLANS[k].blocks || []).length; }); });
    body = '<div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:12px;">' + (isNew ? '＋ New group' : '✏️ ' + apEsc(g.name)) + '</div>'
      + '<label style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;">Name</label><input id="ag-name" value="' + apEsc(g.name) + '" placeholder="e.g. Infielders, Off-Season Group A" style="' + inp + 'margin:3px 0 12px;">'
      + (isNew ? '<label style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;">Start the outline from</label><select id="ag-from" style="' + inp + 'margin:3px 0 12px;"><option value="">Blank — build it in the group</option>'
        + withPlans.map(function (a) { return '<option value="' + apEsc(a) + '"' + (a === cur ? ' selected' : '') + '>' + apEsc(a) + '\'s plan (all seasons)</option>'; }).join('') + '</select>' : '')
      + '<label style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;">Members</label>'
      + '<div style="max-height:260px;overflow-y:auto;border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:4px 8px;margin:3px 0 6px;">'
      + roster.map(function (a) {
          var other = agOf(a), inThis = (g.members || []).indexOf(a) >= 0;
          return '<label style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:12px;color:#fff;cursor:pointer;"><input type="checkbox" class="ag-mem" value="' + apEsc(a) + '"' + (inThis ? ' checked' : '') + '> ' + apEsc(a)
            + (other && other !== editId && AG[other] ? '<span style="font-size:10px;color:#f59e0b;margin-left:auto;">in ' + apEsc(AG[other].name) + ' — moves here</span>' : '') + '</label>';
        }).join('') + '</div>'
      + '<div style="font-size:10px;color:var(--text3);margin-bottom:14px;line-height:1.5;">Members show the group outline instead of their own plan. Their own plan isn\'t deleted — it comes back if they leave.</div>'
      + '<div style="display:flex;gap:8px;justify-content:flex-end;">'
      + (isNew ? '' : '<button onclick="agDelete(\'' + editId + '\')" style="' + btn + 'background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);color:#ef4444;margin-right:auto;">Delete group</button>')
      + '<button onclick="agRenderModal(null)" style="' + btn + 'background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;">Back</button>'
      + '<button onclick="agSaveGroup(\'' + editId + '\')" style="' + btn + 'background:#6366f1;border:none;color:#fff;font-weight:700;">' + (isNew ? 'Create group' : 'Save') + '</button></div>';
  } else {
    body = '<div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:4px;">👥 Annual Plan Groups</div>'
      + '<div style="font-size:11px;color:var(--text3);margin-bottom:14px;">Athletes in a group share one outline — edit a block once and it changes for all of them. Each still sees his own live program and logged sessions.</div>'
      + (ids.length ? ids.map(function (id) {
          var g = AG[id];
          return '<div style="display:flex;align-items:center;gap:10px;padding:10px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;margin-bottom:8px;">'
            + '<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:700;color:#c7d2fe;">👥 ' + apEsc(g.name) + '</div><div style="font-size:11px;color:var(--text3);margin-top:2px;">' + ((g.members || []).map(apEsc).join(', ') || 'No members') + '</div></div>'
            + '<button onclick="document.getElementById(\'ag-modal\').remove();agShowGroup(\'' + id + '\')" style="' + btn + 'background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.5);color:#c7d2fe;">Open</button>'
            + '<button onclick="agRenderModal(\'' + id + '\')" style="' + btn + 'background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:#cbd5e1;">Edit</button></div>';
        }).join('') : '<div style="font-size:12px;color:var(--text3);margin-bottom:12px;">No groups yet.</div>')
      + '<div style="display:flex;gap:8px;justify-content:space-between;margin-top:6px;">'
      + '<button onclick="agRenderModal(\'new\')" style="' + btn + 'background:#6366f1;border:none;color:#fff;font-weight:700;">＋ New group</button>'
      + '<button onclick="document.getElementById(\'ag-modal\').remove()" style="' + btn + 'background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;">Close</button></div>';
  }
  m.innerHTML = '<div style="background:#1a1f2e;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:20px;width:480px;max-width:95vw;max-height:90vh;overflow-y:auto;">' + body + '</div>';
}
function agSaveGroup(editId) {
  var m = document.getElementById('ag-modal'); if (!m) return;
  var name = (m.querySelector('#ag-name').value || '').trim(); if (!name) { alert('Give the group a name.'); return; }
  var members = Array.prototype.slice.call(m.querySelectorAll('.ag-mem:checked')).map(function (c) { return c.value; });
  var isNew = editId === 'new', id = isNew ? 'g' + Date.now().toString(36) : editId;
  members.forEach(function (a) { var o = agOf(a); if (o && o !== id && AG[o]) AG[o].members = AG[o].members.filter(function (x) { return x !== a; }); });
  AG[id] = Object.assign(AG[id] || {}, { name: name, members: members });
  if (isNew) { var from = (m.querySelector('#ag-from') || {}).value; if (from) agCopyPlans(from, 'grp:' + id, true); }
  agSave(); saveAnnualData(); m.remove();
  agFillSelect();
  var s = document.getElementById('annual-athlete'); if (s && isNew) s.value = 'grp:' + id;
  renderAnnualPlan();
  if (typeof showStatus === 'function') showStatus('👥 ' + (isNew ? 'Created' : 'Saved') + ' "' + name + '" · ' + members.length + ' athlete' + (members.length === 1 ? '' : 's'));
}
function agDelete(id) {
  var g = AG[id]; if (!g) return;
  var keep = (g.members || []).length && confirm('Delete "' + g.name + '"?\n\nOK = give each member a copy of the outline as his own plan\nCancel = choose next');
  if (!keep && !confirm('Delete "' + g.name + '" and send members back to their own previous plans?')) return;
  if (keep) (g.members || []).forEach(function (a) { agCopyPlans('grp:' + id, a, true); });
  Object.keys(ANNUAL_PLANS).forEach(function (k) { if (k.indexOf('grp:' + id + '_') === 0) delete ANNUAL_PLANS[k]; });
  delete AG[id]; agSave(); saveAnnualData();
  var md = document.getElementById('ag-modal'); if (md) md.remove();
  var s = document.getElementById('annual-athlete'); if (s && s.value === 'grp:' + id) s.value = (g.members || [])[0] || (s.options[0] || {}).value;
  agFillSelect(); renderAnnualPlan();
  if (typeof showStatus === 'function') showStatus('🗑 Deleted group "' + g.name + '"');
}
