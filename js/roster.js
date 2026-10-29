// ════════════════════════════════════════════════════════════════════
// Roster manager — add athletes, change group/position/number, mark
// inactive, without editing code. Saved in localStorage key
// cubs_sc_roster_v1 (synced to the cloud like every other cubs_sc key).
// The overrides are applied to PLAYERS inline in index.html before the
// first render (applyRosterOverrides); this file is the editing UI.
// ════════════════════════════════════════════════════════════════════
var RM_POS = {
  pos: ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'IF', 'OF', 'UT', 'DH'],
  pit: ['SP', 'RP']
};
function rmGroupOf(p) { return isClientPos(p.pos) ? 'client' : isPitcherPos(p.pos) ? 'pit' : 'pos'; }
function rmEsc(v) { return typeof escHtml === 'function' ? escHtml(v) : String(v == null ? '' : v); }

function rmSaveEntry(name, entry) {
  var R = rosterRead(); R[name] = Object.assign({}, R[name] || {}, entry); rosterWrite(R);
}
function rmRefresh() {
  applyRosterOverrides();
  if (typeof addMissingAthleteOptions === 'function') addMissingAthleteOptions();
  // Program Builder athlete list is built once from PLAYERS — top it up
  var pb = document.getElementById('pb-athlete');
  if (pb && pb.options.length) Object.keys(PLAYERS).forEach(function (n) {
    if (![].some.call(pb.options, function (o) { return o.value === n; })) { var o = document.createElement('option'); o.value = n; o.textContent = n; pb.appendChild(o); }
  });
  buildPlayerList();
  if (typeof buildTeamList === 'function') { try { buildTeamList(); } catch (e) {} }
  if (typeof currentPlayer !== 'undefined' && PLAYERS[currentPlayer] && typeof applyPitcherTabs === 'function') applyPitcherTabs(currentPlayer);
  if (typeof syncToSupabase === 'function') setTimeout(syncToSupabase, 800);
  rmRender();
}

function rmPosOptions(group, cur) {
  if (group === 'client') return '<option value="CLIENT">Private client</option>';
  var list = cur && RM_POS[group].indexOf(cur) < 0 ? [cur].concat(RM_POS[group]) : RM_POS[group];
  return list.map(function (p) { return '<option' + (p === cur ? ' selected' : '') + '>' + p + '</option>'; }).join('');
}

function rmRender() {
  var box = document.getElementById('rosterModalBody'); if (!box) return;
  var R = rosterRead();
  var groups = [['pos', 'Position players'], ['pit', 'Pitchers'], ['client', 'Private clients']];
  var inp = 'background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:6px 8px;color:var(--text);font-size:12px;';
  var row = function (n) {
    var p = PLAYERS[n], g = rmGroupOf(p), added = R[n] && R[n].added, off = !!p.inactive;
    return '<tr style="border-top:1px solid var(--border);' + (off ? 'opacity:.55;' : '') + '">'
      + '<td style="padding:6px 4px;font-size:12.5px;">' + rmEsc(n) + (added ? ' <span style="font-size:9.5px;color:var(--text3);">added</span>' : '') + '</td>'
      + '<td style="padding:6px 4px;"><select data-rm="group" data-n="' + rmEsc(n) + '" style="' + inp + '">'
      + groups.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === g ? ' selected' : '') + '>' + x[1].replace(/s$/, '') + '</option>'; }).join('') + '</select></td>'
      + '<td style="padding:6px 4px;"><select data-rm="pos" data-n="' + rmEsc(n) + '" style="' + inp + (g === 'client' ? 'visibility:hidden;' : '') + '">' + rmPosOptions(g, p.pos) + '</select></td>'
      + '<td style="padding:6px 4px;"><input data-rm="number" data-n="' + rmEsc(n) + '" value="' + rmEsc(p.number || '') + '" placeholder="#" style="' + inp + 'width:48px;' + (g === 'client' ? 'visibility:hidden;' : '') + '"></td>'
      + '<td style="padding:6px 4px;text-align:right;white-space:nowrap;">'
      + '<button data-rm="active" data-n="' + rmEsc(n) + '" style="' + inp + 'cursor:pointer;">' + (off ? 'Reactivate' : 'Make inactive') + '</button>'
      + (added ? ' <button data-rm="remove" data-n="' + rmEsc(n) + '" title="Remove this athlete" style="' + inp + 'cursor:pointer;color:#f87171;">✕</button>' : '')
      + '</td></tr>';
  };
  var names = Object.keys(PLAYERS);
  var html = '';
  groups.forEach(function (x) {
    var list = names.filter(function (n) { return rmGroupOf(PLAYERS[n]) === x[0] && !PLAYERS[n].inactive; });
    if (!list.length) return;
    html += '<tr><td colspan="5" style="padding:14px 4px 4px;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);">' + x[1] + ' · ' + list.length + '</td></tr>' + list.map(row).join('');
  });
  var inactive = names.filter(function (n) { return PLAYERS[n].inactive; });
  if (inactive.length) html += '<tr><td colspan="5" style="padding:14px 4px 4px;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);">Inactive · ' + inactive.length + '</td></tr>' + inactive.map(row).join('');
  box.innerHTML =
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;padding:12px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;">'
    + '<div style="flex:1 1 180px;"><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Full name</div><input id="rm-new-name" placeholder="First Last" style="' + inp + 'width:100%;box-sizing:border-box;"></div>'
    + '<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Group</div><select id="rm-new-group" style="' + inp + '"><option value="pos">Position player</option><option value="pit">Pitcher</option><option value="client" selected>Private client</option></select></div>'
    + '<div id="rm-new-poswrap"><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Position</div><select id="rm-new-pos" style="' + inp + '"></select></div>'
    + '<div id="rm-new-numwrap"><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">#</div><input id="rm-new-num" style="' + inp + 'width:48px;"></div>'
    + '<button id="rm-add" class="generate-btn" style="padding:7px 16px;">+ Add athlete</button>'
    + '</div><div id="rm-msg" style="font-size:12px;min-height:16px;margin:6px 2px;"></div>'
    + '<table style="width:100%;border-collapse:collapse;">' + html + '</table>'
    + '<div style="font-size:11px;color:var(--text3);margin-top:12px;line-height:1.5;">Inactive athletes keep all their data and programs but drop out of the sidebar list, Team Summary, Daily Brief and team rankings. '
    + 'Names can\'t be changed here because every data import and program is stored under the name.</div>';

  var gSel = document.getElementById('rm-new-group');
  var syncNew = function () {
    var g = gSel.value;
    document.getElementById('rm-new-pos').innerHTML = rmPosOptions(g);
    document.getElementById('rm-new-poswrap').style.display = g === 'client' ? 'none' : '';
    document.getElementById('rm-new-numwrap').style.display = g === 'client' ? 'none' : '';
  };
  gSel.onchange = syncNew; syncNew();
  document.getElementById('rm-add').onclick = function () {
    var msg = document.getElementById('rm-msg');
    var name = document.getElementById('rm-new-name').value.trim().replace(/\s+/g, ' ');
    if (!/^[^<>"'`\\]{2,60}$/.test(name) || name.indexOf(' ') < 0) { msg.style.color = '#f87171'; msg.textContent = 'Enter a first and last name.'; return; }
    var dup = Object.keys(PLAYERS).find(function (n) { return n.toLowerCase() === name.toLowerCase(); });
    if (dup) { msg.style.color = '#f87171'; msg.textContent = dup + ' is already on the roster' + (PLAYERS[dup].inactive ? ' (inactive — reactivate below).' : '.'); return; }
    var g = gSel.value;
    rmSaveEntry(name, { added: true, pos: g === 'client' ? 'CLIENT' : document.getElementById('rm-new-pos').value, number: g === 'client' ? '' : document.getElementById('rm-new-num').value.trim(), active: true });
    rmRefresh();
    var m2 = document.getElementById('rm-msg'); if (m2) { m2.style.color = '#4ade80'; m2.textContent = '✓ Added ' + name + '.'; }
  };
  box.querySelectorAll('[data-rm]').forEach(function (el) {
    var n = el.getAttribute('data-n'), k = el.getAttribute('data-rm');
    if (k === 'group') el.onchange = function () {
      var g = el.value; rmSaveEntry(n, { pos: g === 'client' ? 'CLIENT' : RM_POS[g][0] }); rmRefresh();
    };
    if (k === 'pos') el.onchange = function () { rmSaveEntry(n, { pos: el.value }); rmRefresh(); };
    if (k === 'number') el.onchange = function () { rmSaveEntry(n, { number: el.value.trim() }); rmRefresh(); };
    if (k === 'active') el.onclick = function () { rmSaveEntry(n, { active: !!PLAYERS[n].inactive }); rmRefresh(); };
    if (k === 'remove') el.onclick = function () {
      if (!confirm('Remove ' + n + ' from the roster?\n\nAny data or programs already saved under this name stay stored, and come back if you add the same name again.')) return;
      var R = rosterRead(); delete R[n]; rosterWrite(R); delete PLAYERS[n];
      if (typeof currentPlayer !== 'undefined' && currentPlayer === n) selectPlayer(Object.keys(PLAYERS)[0]);
      rmRefresh();
    };
  });
}

function openRosterManager() {
  var m = document.getElementById('rosterModal');
  if (!m) {
    m = document.createElement('div'); m.id = 'rosterModal'; m.className = 'modal-overlay';
    m.innerHTML = '<div class="modal-box" style="width:680px;max-height:88vh;overflow-y:auto;">'
      + '<div style="display:flex;align-items:center;margin-bottom:14px;"><div style="font-family:\'Bebas Neue\',sans-serif;font-size:24px;letter-spacing:1px;">Manage Roster</div>'
      + '<button onclick="closeModal(\'rosterModal\')" style="margin-left:auto;background:none;border:none;color:var(--text3);font-size:20px;cursor:pointer;">✕</button></div>'
      + '<div id="rosterModalBody"></div></div>';
    m.addEventListener('click', function (e) { if (e.target === m) closeModal('rosterModal'); });
    document.body.appendChild(m);
  }
  rmRender();
  openModal('rosterModal');
}
