// ═══════════════════════════════════════════════════════════════════════════
// Annual Plan ⇄ Programs — keeps the two in step both ways.
//   • Block → program: resolves the link live (current name, deleted programs
//     flagged, master → the athlete's sent copy so loads + dates are his)
//   • Week matching: block calendar week → program week by the program's own
//     "Week 1 starts" date when it has one (sent copies), else block week n
//   • Program → block: sending a program auto-links the athlete's unlinked
//     block that contains Week 1; "Start Program for This Block" links on save
//     and pre-fills Week 1 with the block start; deleting a program unlinks it
//     (or moves the link to the athlete's sent copy if one exists)
// ═══════════════════════════════════════════════════════════════════════════
var AL_PENDING = null;   // { key, blockId, athlete } from "Start Program for This Block"
var AL_SAVING = null;    // block being linked while pbSave runs
function alLinkBlock(b, p) { if (!b || !p) return; if (String(b.linkedProgramId) !== String(p.id) || b.linkedProgramName !== p.name) { b.linkedProgramId = String(p.id); b.linkedProgramName = p.name || ''; saveAnnualData(); } }

function alProgs() { return typeof SAVED_PROGRAMS !== 'undefined' && SAVED_PROGRAMS ? SAVED_PROGRAMS : []; }
function alProg(id) { return id == null ? null : alProgs().find(function (p) { return p && String(p.id) === String(id); }) || null; }
function alKeyAthlete(key) { var i = String(key).lastIndexOf('_'); return i > 0 ? key.slice(0, i) : key; }
function alLocal(iso) { if (!iso) return null; var m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
function alFmt(iso) { var d = alLocal(iso); return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''; }
function alEsc(s) { return typeof escHtml === 'function' ? escHtml(String(s == null ? '' : s)) : String(s == null ? '' : s); }
function alAllBlocks() {
  var out = [];
  Object.keys(typeof ANNUAL_PLANS !== 'undefined' ? ANNUAL_PLANS : {}).forEach(function (key) {
    ((ANNUAL_PLANS[key] || {}).blocks || []).forEach(function (b) { out.push({ key: key, athlete: alKeyAthlete(key), b: b }); });
  });
  return out;
}
function alStart(p) { return p && (p.assignedDate || (p.pbState && p.pbState.startDate)) || null; }

// The program a block should read from: the athlete's sent copy when there is one
function alResolve(b, athlete) {
  if (!b || !b.linkedProgramId) return null;
  var p = alProg(b.linkedProgramId);
  if (!p) {
    return alProgs().find(function (x) { return x.isAssigned && String(x.sourceProgramId) === String(b.linkedProgramId) && x.athlete === athlete; }) || null;
  }
  if (!p.isAssigned && athlete) {
    var push = (p.pushes || []).find(function (x) { return x.athlete === athlete; });
    var c = push && alProg(push.id);
    if (c) return c;
  }
  return p;
}
function alIsStale(b, athlete) { return !!(b && b.linkedProgramId) && !alResolve(b, athlete); }

// Blocks a program is linked to (master or any of its copies)
function alBlocksForProgram(p) {
  if (!p) return [];
  var ids = [String(p.id)]; if (p.sourceProgramId) ids.push(String(p.sourceProgramId));
  return alAllBlocks().filter(function (x) {
    if (!x.b.linkedProgramId || ids.indexOf(String(x.b.linkedProgramId)) < 0) return false;
    return !p.isAssigned || !p.athlete || x.athlete === p.athlete;
  });
}
function alBlockLabel(x) { var t = (typeof BLOCK_TYPES !== 'undefined' && BLOCK_TYPES[x.b.type]) || {}; return (t.label || x.b.type) + ' · ' + alFmt(x.b.startDate) + '–' + alFmt(x.b.endDate); }

// Keep names current and auto-link sent programs into the block holding Week 1.
// Never unlinks here (programs may still be loading) — only explicit deletes do.
function alSync(silent) {
  if (typeof ANNUAL_PLANS === 'undefined') return 0;
  var changed = 0, linked = [];
  alAllBlocks().forEach(function (x) {
    var b = x.b;
    if (b.linkedProgramId) {
      var p = alResolve(b, x.athlete);
      if (p && p.name && b.linkedProgramName !== p.name) { b.linkedProgramName = p.name; changed++; }
      return;
    }
    // Unlinked: a sent copy for this athlete whose Week 1 falls inside the block
    var c = alProgs().find(function (p) { var s = alStart(p); return p.isAssigned && p.athlete === x.athlete && s && s >= b.startDate && s <= b.endDate; });
    if (c) { b.linkedProgramId = String(c.id); b.linkedProgramName = c.name || ''; changed++; linked.push(c.name + ' → ' + alBlockLabel(x)); }
  });
  if (changed && typeof saveAnnualData === 'function') saveAnnualData();
  if (linked.length && !silent && typeof showStatus === 'function') showStatus('📅 Linked to Annual Plan: ' + linked.join(' · '));
  return changed;
}

// ── Real per-week metrics, matched by date when the program has a start date ──
annualGetLinkedWeekMetrics = function (block, wkInBlock, weekDate) {
  var athlete = (document.getElementById('annual-athlete') || {}).value || '';
  var prog = alResolve(block, athlete);
  if (!prog || !prog.pbState || !prog.pbState.weekData) return null;
  var idx = wkInBlock - 1, s = alLocal(alStart(prog));
  if (s && weekDate) idx = Math.round((weekDate - s) / (7 * 864e5));
  var wk = idx >= 0 ? prog.pbState.weekData[idx] : null;
  if (!wk || !wk.days) return null;
  var setsSum = 0, repsSum = 0, exCount = 0, loadSum = 0, loadCount = 0, tutSum = 0, tutCount = 0;
  wk.days.forEach(function (day) {
    if (day.type !== 'lift') return;
    (day.blocks || []).forEach(function (blk) {
      (blk.exercises || []).forEach(function (ex) {
        var sets = parseInt(ex.sets) || 0, reps = parseInt(ex.reps) || 0;
        if (sets && reps) { setsSum += sets; repsSum += reps; exCount++; tutSum += reps * (parseInt(String(ex.tempo || '3').split('-')[0]) || 3); tutCount++; }
        var lm = String(ex.load || '').match(/(\d+)\s*%/); if (lm) { loadSum += parseInt(lm[1]); loadCount++; }
      });
    });
  });
  if (!exCount) return null;
  return { sets: Math.round(setsSum / exCount), reps: Math.round(repsSum / exCount), load: loadCount ? Math.round(loadSum / loadCount) : null,
           tut: tutCount ? Math.round(tutSum / tutCount) : null, programName: prog.name + (prog.isAssigned ? ' (sent · wk ' + (idx + 1) + ')' : ' · wk ' + (idx + 1)) };
};

// ── Render: refresh names / auto-links first ──
(function () {
  if (typeof renderAnnualPlan !== 'function') return;
  var _r = renderAnnualPlan;
  renderAnnualPlan = function () { try { alSync(true); } catch (e) { console.warn('[annual-link]', e); } return _r.apply(this, arguments); };
})();

// ── Link picker: sent copies, drafts, sandbox drafts — no duplicates ──
annualLinkProgramModal = function (blockId) {
  var key = annualPlanKey(), plan = ANNUAL_PLANS[key];
  var b = plan && plan.blocks.find(function (x) { return x.id === blockId; });
  if (!b) return;
  var athlete = (document.getElementById('annual-athlete') || {}).value || '';
  var all = alProgs().filter(function (p) { return p && p.id && !p.isTemplate; });
  var sent = all.filter(function (p) { return p.isAssigned && p.athlete === athlete; });
  var sentSrc = sent.map(function (p) { return String(p.sourceProgramId); });
  var drafts = all.filter(function (p) { return !p.isAssigned && p.athlete === athlete && sentSrc.indexOf(String(p.id)) < 0; });
  var sandbox = all.filter(function (p) { return !p.isAssigned && (!p.athlete || p.athlete === '(Sandbox)'); });
  var cur = alResolve(b, athlete), curId = cur ? String(cur.id) : String(b.linkedProgramId || '');
  // Suggest the sent program whose Week 1 falls inside this block
  var suggest = !b.linkedProgramId ? sent.find(function (p) { var s = alStart(p); return s && s >= b.startDate && s <= b.endDate; }) : null;
  var opt = function (p, label) { var sel = String(p.id) === curId || (suggest && p === suggest); return '<option value="' + p.id + '"' + (sel ? ' selected' : '') + '>' + alEsc(label) + '</option>'; };
  var groups = '';
  if (sent.length) groups += '<optgroup label="Sent to ' + alEsc(athlete) + '">' + sent.map(function (p) { return opt(p, p.name + (alStart(p) ? ' · Week 1 ' + alFmt(alStart(p)) : '')); }).join('') + '</optgroup>';
  if (drafts.length) groups += '<optgroup label="Drafts for ' + alEsc(athlete) + '">' + drafts.map(function (p) { return opt(p, p.name + ' · draft'); }).join('') + '</optgroup>';
  if (sandbox.length) groups += '<optgroup label="Sandbox drafts">' + sandbox.map(function (p) { return opt(p, p.name + ' · sandbox'); }).join('') + '</optgroup>';
  var stale = alIsStale(b, athlete);
  var tl = (BLOCK_TYPES[b.type] || {}).label || b.type;
  var btn = 'padding:8px 14px;border-radius:6px;font-size:12px;cursor:pointer;';
  var modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML = '<div style="background:#1a1f2e;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:22px;width:440px;max-width:95vw;">'
    + '<div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:4px;">🔗 Link Program to Block</div>'
    + '<div style="font-size:11px;color:var(--text3);margin-bottom:14px;">' + alEsc(tl) + ' · ' + alFmt(b.startDate) + ' → ' + alFmt(b.endDate) + ' · ' + alEsc(athlete) + '</div>'
    + (stale ? '<div style="font-size:11px;color:#f59e0b;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:6px;padding:8px 10px;margin-bottom:12px;">⚠️ "' + alEsc(b.linkedProgramName || 'Linked program') + '" was deleted. Pick another or unlink.</div>' : '')
    + (groups ? '<select id="ap-link-sel" style="width:100%;background:var(--bg3);border:1px solid var(--border2);border-radius:6px;padding:8px 10px;color:var(--text);font-size:13px;margin-bottom:12px;"><option value="">— Unlink —</option>' + groups + '</select>'
      : '<div style="font-size:12px;color:var(--text3);margin-bottom:12px;">No programs for ' + alEsc(athlete) + ' yet.</div>')
    + (suggest ? '<div style="font-size:11px;color:#4ade80;margin-bottom:10px;">Suggested: "' + alEsc(suggest.name) + '" — Week 1 (' + alFmt(alStart(suggest)) + ') falls in this block.</div>' : '')
    + '<div style="font-size:11px;color:var(--text2);background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:6px;padding:10px;margin-bottom:14px;line-height:1.5;">Sets×Reps and Intensity pull from the program\'s real weeks. Sent programs are matched by their Week 1 date, so the right week lines up with the right calendar week.</div>'
    + '<div style="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap;">'
    + '<button onclick="this.closest(\'div[style*=fixed]\').remove();annualStartProgramForBlock(\'' + blockId + '\')" style="' + btn + 'background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.35);color:#f59e0b;font-weight:700;">🚀 Build new</button>'
    + '<div style="display:flex;gap:8px;"><button onclick="this.closest(\'div[style*=fixed]\').remove()" style="' + btn + 'background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;">Cancel</button>'
    + (groups ? '<button onclick="annualConfirmLinkProgram(\'' + blockId + '\', this)" style="' + btn + 'background:#22c55e;border:none;color:#000;font-weight:700;">Save</button>' : '')
    + '</div></div></div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', function (e) { if (e.target === modal) modal.remove(); });
};

// ── "Start Program for This Block" → link on save, Week 1 = block start ──
(function () {
  if (typeof annualStartProgramForBlock === 'function') {
    var _s = annualStartProgramForBlock;
    annualStartProgramForBlock = function (blockId) {
      AL_PENDING = { key: annualPlanKey(), blockId: blockId, athlete: (document.getElementById('annual-athlete') || {}).value || '' };
      return _s.apply(this, arguments);
    };
  }
  if (typeof pbSave === 'function') {
    var _p = pbSave;
    pbSave = function () {
      var pend = AL_PENDING, b = null;
      if (pend && typeof PB_STATE !== 'undefined' && PB_STATE.athlete === pend.athlete) {
        var plan = ANNUAL_PLANS[pend.key]; b = plan && plan.blocks.find(function (x) { return x.id === pend.blockId; });
      }
      AL_SAVING = b;   // lets the send modal (opened inside pbSave) link + pre-fill first
      var r;
      try { r = _p.apply(this, arguments); } finally { AL_SAVING = null; }
      if (b && r) {
        AL_PENDING = null;
        alLinkBlock(b, r);
        if (typeof showStatus === 'function') showStatus('✅ Saved "' + r.name + '" and linked it to the Annual Plan block');
      }
      return r;
    };
  }
  // Send modal: Week 1 defaults to the linked block's start (first send only)
  if (typeof showPushProgramModal === 'function') {
    var _m = showPushProgramModal;
    showPushProgramModal = function (progId) {
      var r = _m.apply(this, arguments);
      try {
        var p = alProg(progId), inp = document.getElementById('push-start-date');
        if (AL_SAVING && p) alLinkBlock(AL_SAVING, p);
        if (p && inp && !(p.pushes || []).length) {
          var x = alBlocksForProgram(p).sort(function (a, c) { return a.b.startDate < c.b.startDate ? -1 : 1; })[0];
          if (x && x.b.startDate) { inp.value = x.b.startDate; inp.dispatchEvent(new Event('change')); }
        }
      } catch (e) {}
      return r;
    };
  }
  // Any program save / send / rename → refresh names + auto-link sent programs
  if (typeof persistPrograms === 'function') {
    var _pp = persistPrograms;
    persistPrograms = function () { var r = _pp.apply(this, arguments); try { alSync(false); } catch (e) {} return r; };
  }
  // Delete → unlink (or hand the link to the athlete's sent copy)
  if (typeof deleteProgram === 'function') {
    var _d = deleteProgram;
    deleteProgram = function (id) {
      var r = _d.apply(this, arguments);
      if (alProg(id)) return r;   // cancelled
      var n = 0;
      alAllBlocks().forEach(function (x) {
        if (String(x.b.linkedProgramId) !== String(id)) return;
        var c = alProgs().find(function (p) { return p.isAssigned && String(p.sourceProgramId) === String(id) && p.athlete === x.athlete; });
        if (c) { x.b.linkedProgramId = String(c.id); x.b.linkedProgramName = c.name || ''; }
        else { delete x.b.linkedProgramId; delete x.b.linkedProgramName; }
        n++;
      });
      if (n) { saveAnnualData(); if (typeof showStatus === 'function') showStatus('📅 Updated ' + n + ' Annual Plan block' + (n === 1 ? '' : 's')); }
      if (typeof renderAthletePrograms === 'function') try { renderAthletePrograms(); } catch (e) {}
      return r;
    };
  }
})();

// ── Open the Annual Plan at a program's block (used by the player Programs tab) ──
function alOpenBlock(key, blockId) {
  var athlete = alKeyAthlete(key), year = key.slice(key.lastIndexOf('_') + 1);
  var navBtn = Array.prototype.slice.call(document.querySelectorAll('.nav-btn')).filter(function (x) { return x.textContent.indexOf('Program Builder') >= 0; })[0];
  if (typeof switchTab === 'function') switchTab('program', navBtn);
  if (typeof switchProgTab === 'function') switchProgTab('annual', document.getElementById('ptab-annual'));
  setTimeout(function () {
    var a = document.getElementById('annual-athlete'), y = document.getElementById('annual-year');
    if (a) a.value = athlete; if (y) y.value = year;
    renderAnnualPlan();
    if (blockId && typeof annualEditBlock === 'function') annualEditBlock(blockId);
  }, 150);
}
