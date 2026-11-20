// ═══════════════════════════════════════════════════════════════════════════
// UI refresh — Mark Weisman S&C look and layout.
//  • Sidebar: athlete dropdown (search, status, flags, 7-day compliance),
//    grouped nav with line icons, collapsible Backup & sync
//  • Athlete header: 5 grouped tabs with sub-tabs, ⋯ menu (Profile / PDF / Export)
//  • Calendar: chips colored by session type, day summaries instead of
//    "+N more", clean program names, weekly program-compliance table
//  • Year in Review: this season up front with a percentile bar
// Loaded last; wraps existing functions the same way the other modules do.
// Accent color lives in one place: --mw-accent below.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // ── Line icons (Lucide-style, stroke = currentColor) ─────────────────────
  var P = {
    dash: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    bar: '<path d="M6 5v14M18 5v14M3 8v8M21 8v8M6 12h12"/>',
    folder: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
    brief: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h4"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    pulse: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
    chev: '<path d="m6 9 6 6 6-6"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    dashc: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
    zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
    trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    gauge: '<path d="m12 14 4-4"/><path d="M3.3 19a10 10 0 1 1 17.4 0"/>',
    award: '<circle cx="12" cy="8" r="6"/><path d="M15.5 12.9 17 22l-5-3-5 3 1.5-9.1"/>',
    send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
    phone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
    pencil: '<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    jump: '<path d="M12 21V8M7 13l5-5 5 5"/><path d="M5 3h14"/>',
    flag: '<path d="M4 22V4a1 1 0 0 1 1-1h12l-2 4 2 4H5"/>'
  };
  function ico(n, s) { s = s || 16; return '<svg class="mw-i" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || '') + '</svg>'; }
  window.mwIcon = ico;
  var esc = function (v) { return typeof escHtml === 'function' ? escHtml(v) : String(v == null ? '' : v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var iso = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var todayIso = function () { return (typeof TC !== 'undefined' && TC.localISO) ? TC.localISO() : iso(new Date()); };
  var addDays = function (d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; };
  var weekStart = function (d) { var x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  var initials = function (n) { return String(n).split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2); };

  // ── Styles ───────────────────────────────────────────────────────────────
  var css = `
:root{ --mw-accent:#FF6A13; --mw-accent-2:#FF8A3D; --mw-accent-soft:rgba(255,106,19,.13); --mw-accent-line:rgba(255,106,19,.45);
  --mw-t-speed:#FF6A13; --mw-t-lift:#60A5FA; --mw-t-cond:#C084FC; --mw-t-recov:#94A3B8; --mw-t-game:#F87171;
  --mw-good:#22c55e; --mw-mid:#EAB308; --mw-bad:#ef4444; --mw-mono:'DM Mono',ui-monospace,monospace; }
.mw-i{ flex-shrink:0; display:inline-block; vertical-align:-3px; }
/* sidebar */
.sidebar{ padding-bottom:40px; }
.sidebar-logo{ padding:20px 18px 14px; }
.logo-icon{ background:linear-gradient(135deg,#1b1f2a,#0d0f14) !important; border:1px solid var(--mw-accent-line); color:var(--mw-accent) !important; }
.mw-athlete-section{ padding:14px 12px 6px; }
.sidebar-nav{ margin-top:0 !important; border-top:1px solid var(--border); padding:8px 12px 12px; }
.mw-nav-label{ font-size:9.5px; text-transform:uppercase; letter-spacing:1.2px; color:var(--text3); padding:12px 10px 4px; }
.nav-btn{ gap:10px !important; padding:7px 10px !important; }
.nav-btn .mw-i{ opacity:.75; }
.nav-btn.active{ background:var(--mw-accent-soft) !important; color:#fff !important; box-shadow:inset 2px 0 0 var(--mw-accent); }
.nav-btn.active .mw-i{ color:var(--mw-accent); opacity:1; }
.mw-backup{ margin:auto 12px 0; border-top:1px solid var(--border); padding-top:10px; }
.mw-backup summary{ list-style:none; cursor:pointer; padding:6px 10px; border-radius:8px; display:flex; flex-direction:column; gap:2px; }
.mw-backup summary::-webkit-details-marker{ display:none; }
.mw-backup summary:hover{ background:var(--bg3); }
.mw-backup-title{ font-size:11px; font-weight:600; color:var(--text2); }
.mw-backup-title::after{ content:' ▾'; color:var(--text3); }
.mw-backup[open] .mw-backup-title::after{ content:' ▴'; }
.mw-sync{ font-size:10px; line-height:1.35; }
.mw-backup-body{ display:grid; gap:6px; padding:8px 0 4px; }
.mw-bk{ padding:7px 10px; border-radius:7px; border:1px solid var(--border); background:var(--bg3); color:var(--text2); font-size:11.5px; font-weight:600; cursor:pointer; text-align:left; }
.mw-bk:hover{ color:#fff; border-color:rgba(255,255,255,.18); }
.mw-bk-primary{ background:var(--mw-accent-soft); border-color:var(--mw-accent-line); color:var(--mw-accent-2); }
.mw-bk-danger{ color:#f87171; border-color:rgba(239,68,68,.3); background:transparent; }
/* athlete picker */
.mw-pick{ display:flex; gap:4px; align-items:stretch; }
.mw-pick-btn{ flex:1; min-width:0; display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:10px; border:1px solid var(--border); background:var(--bg3); color:var(--text); cursor:pointer; text-align:left; font-family:'DM Sans',sans-serif; }
.mw-pick-btn:hover, .mw-pick-btn.open{ border-color:var(--mw-accent-line); }
.mw-pick-btn .player-avatar{ background:var(--mw-accent-soft); color:var(--mw-accent-2); border:1px solid var(--mw-accent-line); width:32px; height:32px; font-family:'Bebas Neue',sans-serif; font-size:15px; letter-spacing:.5px; }
.mw-pick-name{ font-family:'Bebas Neue',sans-serif; font-size:19px; letter-spacing:.6px; line-height:1; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.mw-pick-sub{ font-size:10px; color:var(--text3); margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.mw-pick-panel{ position:fixed; z-index:8000; width:300px; max-height:70vh; display:none; flex-direction:column; background:#12151c; border:1px solid rgba(255,255,255,.1); border-radius:12px; box-shadow:0 18px 50px rgba(0,0,0,.55); overflow:hidden; }
.mw-pick-panel.open{ display:flex; }
.mw-pick-search{ display:flex; align-items:center; gap:8px; padding:10px 12px; border-bottom:1px solid var(--border); color:var(--text3); }
.mw-pick-search input{ flex:1; background:transparent; border:none; outline:none; color:#fff; font-size:13px; font-family:'DM Sans',sans-serif; }
.mw-pick-list{ overflow-y:auto; padding:6px; }
.mw-pick-list .sidebar-label{ padding:8px 8px 4px; margin:0; }
.mw-pick-list .player-btn{ padding:7px 8px; }
.mw-pick-list .player-btn.mw-kb{ background:var(--bg3); color:#fff; }
.player-btn.active{ background:var(--mw-accent-soft) !important; border-left:2px solid var(--mw-accent) !important; }
.player-btn.active .player-avatar{ background:var(--mw-accent) !important; color:#111 !important; }
.mw-comp{ font-family:var(--mw-mono); font-size:10px; font-weight:500; padding:1px 5px; border-radius:5px; background:rgba(255,255,255,.05); }
.mw-flagdot{ color:#f59e0b; display:inline-flex; }
body.offseason #mw-pick-panel .status-dot, body.offseason #mw-pick-btn .status-dot{ display:none; }
.mw-pick-empty{ padding:14px; font-size:12px; color:var(--text3); text-align:center; }
/* topbar + tabs */
.topbar{ align-items:center; }
.topbar-player{ font-size:30px !important; letter-spacing:1px !important; }
#mwTabs{ display:flex; gap:2px; align-items:center; }
.mw-tab{ display:inline-flex; align-items:center; gap:7px; padding:8px 12px; border:none; background:transparent; color:var(--text2); font-family:'DM Sans',sans-serif; font-size:12.5px; font-weight:600; cursor:pointer; border-radius:8px; position:relative; }
.mw-tab:hover{ color:#fff; background:var(--bg3); }
.mw-tab.active{ color:#fff; }
.mw-tab.active::after{ content:''; position:absolute; left:12px; right:12px; bottom:1px; height:2px; border-radius:2px; background:var(--mw-accent); }
.mw-tab.active .mw-i{ color:var(--mw-accent); }
#dashTabs{ flex-basis:100%; order:10; background:transparent !important; padding:0 !important; gap:4px !important; }
#dashTabs.mw-solo{ display:none !important; }
#dashTabs .tab-btn{ color:var(--text3) !important; border:1px solid transparent; border-radius:20px; padding:4px 12px; font-size:11.5px; background:transparent; }
#dashTabs .tab-btn:hover{ color:#fff !important; }
#dashTabs .tab-btn.active{ color:#fff !important; border-color:var(--mw-accent-line); background:var(--mw-accent-soft) !important; }
#dashTabs .tab-btn.mw-off{ display:none !important; }
.mw-more{ margin-left:auto; position:relative; }
.mw-more-btn{ width:34px; height:34px; display:flex; align-items:center; justify-content:center; border-radius:9px; border:1px solid var(--border); background:var(--bg3); color:var(--text2); cursor:pointer; }
.mw-more-btn:hover{ color:#fff; border-color:rgba(255,255,255,.18); }
.mw-menu{ position:absolute; right:0; top:40px; z-index:7000; min-width:200px; background:#12151c; border:1px solid rgba(255,255,255,.1); border-radius:10px; box-shadow:0 14px 40px rgba(0,0,0,.5); padding:5px; display:none; }
.mw-menu.open{ display:block; }
.mw-menu button{ display:flex; width:100%; align-items:center; gap:10px; padding:8px 10px; border:none; background:transparent; color:var(--text2); font-size:12.5px; border-radius:7px; cursor:pointer; text-align:left; font-family:'DM Sans',sans-serif; }
.mw-menu button:hover{ background:var(--bg3); color:#fff; }
.mw-menu small{ display:block; color:var(--text3); font-size:10.5px; }
/* type */
.card-title, .section-title{ font-family:'Bebas Neue',sans-serif !important; letter-spacing:1px !important; font-size:18px !important; font-weight:400 !important; color:#fff; }
.cal-cell.today{ background:var(--mw-accent-soft) !important; box-shadow:inset 0 2px 0 var(--mw-accent); }
.cal-cell.today .cal-date{ color:var(--mw-accent) !important; }
#page-calendar .tab-btn.active{ background:var(--mw-accent-soft) !important; color:#fff !important; }
#page-calendar button[onclick="calGoToday()"]{ background:var(--mw-accent-soft) !important; border-color:var(--mw-accent-line) !important; color:var(--mw-accent-2) !important; }
/* calendar chips */
.mw-chip{ display:flex; align-items:center; gap:4px; font-size:10px; font-weight:600; padding:2px 5px; margin-bottom:2px; border-radius:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; cursor:pointer; border-left:3px solid var(--c); background:color-mix(in srgb, var(--c) 16%, transparent); color:color-mix(in srgb, var(--c) 70%, #fff); }
.mw-chip span{ overflow:hidden; text-overflow:ellipsis; }
.mw-chip.missed{ background:transparent; border:1px dashed color-mix(in srgb, var(--c) 45%, transparent); border-left:3px solid color-mix(in srgb, var(--c) 45%, transparent); color:var(--text3); }
.mw-chip.done .mw-i{ color:var(--mw-good); }
.t-speed{ --c:var(--mw-t-speed); } .t-lift{ --c:var(--mw-t-lift); } .t-cond{ --c:var(--mw-t-cond); } .t-recov{ --c:var(--mw-t-recov); } .t-game{ --c:var(--mw-t-game); }
.mw-daysum{ margin-top:2px; padding:5px 6px; border-radius:6px; background:rgba(255,255,255,.035); border:1px solid var(--border); cursor:pointer; }
.mw-daysum:hover{ border-color:rgba(255,255,255,.16); }
.mw-daysum-top{ display:flex; justify-content:space-between; gap:6px; font-size:10px; color:var(--text2); }
.mw-daysum-top b{ font-family:var(--mw-mono); color:#fff; font-weight:500; }
.mw-typebar{ display:flex; height:5px; border-radius:3px; overflow:hidden; margin-top:5px; gap:1px; }
.mw-typebar i{ display:block; background:var(--c); }
.mw-types{ display:flex; flex-wrap:wrap; gap:2px 7px; margin-top:4px; font-size:9px; color:var(--text3); }
.mw-types span::before{ content:''; display:inline-block; width:6px; height:6px; border-radius:2px; background:var(--c); margin-right:3px; vertical-align:0; }
.mw-legend{ display:flex; gap:14px; flex-wrap:wrap; align-items:center; font-size:11px; color:var(--text2); }
.mw-legend span{ display:inline-flex; align-items:center; gap:6px; }
.mw-legend i{ width:10px; height:10px; border-radius:3px; background:var(--c); display:inline-block; }
.mw-legend .mw-sep{ width:1px; height:14px; background:var(--border); }
/* compliance */
.mw-compcard{ margin-bottom:14px; padding:14px 16px; }
.mw-compcard summary{ list-style:none; cursor:pointer; display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; }
.mw-compcard summary::-webkit-details-marker{ display:none; }
.mw-comp-grid{ display:grid; gap:0; justify-content:start; margin-top:10px; font-size:12px; overflow-x:auto; }
.mw-comp-row{ display:grid; grid-template-columns:180px repeat(5,minmax(80px,130px)); gap:8px; align-items:center; padding:6px 0; border-top:1px solid rgba(255,255,255,.05); }
.mw-comp-row.hd{ border-top:none; font-size:9.5px; color:var(--text3); text-transform:uppercase; letter-spacing:.5px; padding-bottom:2px; }
.mw-comp-row.hd div:not(:first-child){ text-align:center; }
.mw-comp-name{ color:#e2e8f0; font-weight:600; cursor:pointer; }
.mw-comp-name:hover{ color:var(--mw-accent-2); }
.mw-comp-cell{ text-align:center; border-radius:6px; padding:4px 0; font-family:var(--mw-mono); }
.mw-comp-cell b{ display:block; font-size:12.5px; font-weight:500; }
.mw-comp-cell small{ font-size:9.5px; color:var(--text3); }
/* day detail cards */
.mw-pcard{ display:flex; align-items:center; gap:12px; flex-wrap:wrap; padding:11px 12px; margin-bottom:8px; border-radius:10px; background:var(--bg3); border:1px solid var(--border); border-left:3px solid var(--c); }
.mw-pcard-ico{ width:30px; height:30px; border-radius:8px; display:flex; align-items:center; justify-content:center; color:var(--c); background:color-mix(in srgb, var(--c) 15%, transparent); }
.mw-pcard-t{ font-weight:600; color:#fff; font-size:13px; }
.mw-pcard-s{ font-size:11px; color:var(--text2); margin-top:2px; display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
.mw-pill{ font-size:10px; font-weight:700; padding:1px 7px; border-radius:10px; }
.mw-pill.done{ color:var(--mw-good); background:rgba(34,197,94,.12); }
.mw-pill.missed{ color:var(--mw-mid); background:rgba(234,179,8,.12); }
.mw-pill.up{ color:var(--text3); background:rgba(255,255,255,.05); }
.mw-btn{ display:inline-flex; align-items:center; gap:6px; padding:5px 10px; border-radius:7px; font-size:11px; font-weight:600; cursor:pointer; border:1px solid var(--border); background:transparent; color:var(--text2); }
.mw-btn:hover{ color:#fff; border-color:rgba(255,255,255,.2); }
.mw-btn.primary{ background:var(--mw-accent); border-color:var(--mw-accent); color:#111; }
.mw-btn.primary:hover{ background:var(--mw-accent-2); color:#111; }
/* year in review */
.mw-yr-row{ display:grid; grid-template-columns:minmax(170px,1.2fr) minmax(170px,1.4fr) minmax(150px,1fr) 76px 66px; gap:14px; align-items:center; padding:9px 0; border-top:1px solid rgba(255,255,255,.05); }
.mw-yr-row.hd{ border-top:none; padding:0 0 4px; font-size:9.5px; color:var(--text3); text-transform:uppercase; letter-spacing:.5px; }
.mw-yr-big{ display:flex; align-items:baseline; gap:8px; }
.mw-yr-big b{ font-family:var(--mw-mono); font-size:20px; font-weight:500; color:#fff; letter-spacing:-.5px; }
.mw-yr-big span{ font-size:10.5px; font-weight:700; }
.mw-pbar{ position:relative; height:5px; border-radius:3px; background:rgba(255,255,255,.07); margin-top:5px; }
.mw-pbar i{ position:absolute; left:0; top:0; bottom:0; border-radius:3px; }
.mw-pbar em{ position:absolute; left:50%; top:-2px; bottom:-2px; width:1px; background:rgba(255,255,255,.25); }
.mw-yr-prior{ display:flex; flex-direction:column; gap:3px; font-size:11px; color:var(--text3); }
.mw-yr-prior div{ display:flex; gap:8px; align-items:baseline; }
.mw-yr-prior b{ font-family:var(--mw-mono); color:#cbd5e1; font-weight:500; min-width:44px; text-align:right; }
.mw-yr-prior em{ font-style:normal; font-size:9.5px; }
.mw-sec-h{ display:flex; align-items:center; gap:10px; margin-bottom:8px; flex-wrap:wrap; }
.mw-sec-h .mw-sec-ico{ width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center; background:var(--mw-accent-soft); color:var(--mw-accent); }
.mw-sec-h .mw-sec-t{ font-family:'Bebas Neue',sans-serif; font-size:21px; letter-spacing:.8px; color:#fff; line-height:1; }
.mw-sec-h .mw-sec-s{ font-size:10.5px; color:var(--text3); }
`;
  var st = document.createElement('style'); st.id = 'mw-ui-css'; st.textContent = css; document.head.appendChild(st);

  // ── Program helpers ──────────────────────────────────────────────────────
  // "💪 Intensification — (11.8 UPDATE) — (Sandbox)" → "Intensification"
  function mwCleanProg(name) {
    var s = String(name || '').replace(/[\u{1F000}-\u{1FAFF}☀-➿️‍]/gu, '');
    s = s.replace(/\([^)]*\)/g, '').replace(/\s*[—–-]\s*(?=[—–-]|$)/g, '').replace(/^\s*[—–-]\s*/, '').replace(/\s{2,}/g, ' ').trim();
    return s || String(name || 'Program');
  }
  window.mwCleanProg = mwCleanProg;
  var TYPES = { speed: 'Speed + lift', lift: 'Lift', cond: 'ESD / conditioning', recov: 'Mobility / recovery' };
  function mwType(label) {
    var s = String(label || '').toLowerCase();
    if (/\besd\b|condition|tempo run|aerobic|bike|flush run/.test(s)) return 'cond';
    if (/accel|max ?v|\bcod\b|decel|sprint|speed|\brun\b|plyo|jump/.test(s)) return 'speed';
    if (/lift|strength|full body|strongman|\bub\b|\blb\b|power/.test(s)) return 'lift';
    if (/mobility|recover|core|rest|deload|flush|yoga|stretch/.test(s)) return 'recov';
    return 'lift';
  }
  window.mwType = mwType;
  function progDays() { try { return typeof pcalBuild === 'function' ? pcalBuild() : {}; } catch (e) { return {}; } }
  function filterVal() { return ((document.getElementById('cal-athlete-filter') || {}).value) || ''; }
  // done / due between two ISO dates (due = done, or past and not logged; today's open session isn't due yet)
  function athComp(name, from, to, by) {
    by = by || progDays(); var t = todayIso(), r = { done: 0, due: 0, left: 0 };
    Object.keys(by).forEach(function (dk) {
      if (dk < from || dk > to) return;
      by[dk].forEach(function (p) {
        if (p.athlete !== name) return;
        if (p.done) { r.done++; r.due++; } else if (dk < t) r.due++; else r.left++;
      });
    });
    r.pct = r.due ? Math.round(r.done / r.due * 100) : null;
    return r;
  }
  window.mwAthComp = athComp;
  var pctCol = function (p) { return p == null ? 'var(--text3)' : p >= 90 ? 'var(--mw-good)' : p >= 70 ? 'var(--mw-mid)' : 'var(--mw-bad)'; };
  var pctBg = function (p) { return p == null ? 'transparent' : p >= 90 ? 'rgba(34,197,94,.10)' : p >= 70 ? 'rgba(234,179,8,.10)' : 'rgba(239,68,68,.10)'; };
  function flagCount(name) { try { return typeof computePlayerFlags === 'function' ? (computePlayerFlags(name) || []).length : 0; } catch (e) { return 0; } }

  // ═══ SIDEBAR: athlete dropdown ══════════════════════════════════════════
  var PK = { open: false, q: '', kb: -1, order: [] };
  function groupedRoster() {
    var all = Object.keys(PLAYERS), act = all.filter(function (n) { return !PLAYERS[n].inactive; });
    var g = [
      { label: 'Position players', list: act.filter(function (n) { return !isPitcherPos(PLAYERS[n].pos) && !isClientPos(PLAYERS[n].pos); }) },
      { label: 'Pitchers', list: act.filter(function (n) { return isPitcherPos(PLAYERS[n].pos); }) },
      { label: 'Private clients', list: act.filter(function (n) { return isClientPos(PLAYERS[n].pos); }) },
      { label: 'Inactive', list: all.filter(function (n) { return PLAYERS[n].inactive; }) }
    ];
    return g.filter(function (x) { return x.list.length; });
  }
  function itemHTML(name, by, wk) {
    var p = PLAYERS[name], as = { status: 'NODATA', reasons: [] };
    try { as = getAthleteStatus(name); } catch (e) {}
    var sc = typeof athleteStatusClass === 'function' ? athleteStatusClass(as.status) : 'nodata';
    var c = athComp(name, wk.from, wk.to, by), fl = p.inactive ? 0 : flagCount(name);
    return '<button class="player-btn' + (name === currentPlayer ? ' active' : '') + '"' + (p.inactive ? ' style="opacity:.5;"' : '') + ' id="pbtn-' + nameToId(name) + '" data-name="' + esc(name) + '" onclick="mwPickChoose(this.dataset.name)">'
      + '<div class="player-avatar">' + esc(initials(name)) + '</div>'
      + '<div class="player-info"><div class="player-name">' + esc(name) + '</div><div class="player-pos">' + esc(posLabel(p)) + '</div></div>'
      + (fl ? '<span class="mw-flagdot" title="' + fl + ' active flag' + (fl === 1 ? '' : 's') + '">' + ico('flag', 12) + '</span>' : '')
      + (c.pct != null ? '<span class="mw-comp" style="color:' + pctCol(c.pct) + ';" title="Last 7 days: ' + c.done + ' of ' + c.due + ' program sessions logged">' + c.pct + '%</span>' : '')
      + '<div class="status-dot ' + sc + '" title="' + esc(as.reasons && as.reasons.length ? as.reasons.join(', ') : 'Within normal range') + '"></div></button>';
  }
  function renderPickList() {
    var list = document.getElementById('mw-pick-list'); if (!list) return;
    var q = PK.q.trim().toLowerCase(), by = progDays(), t = new Date(), wk = { from: iso(addDays(t, -6)), to: todayIso() };
    PK.order = [];
    var h = groupedRoster().map(function (g) {
      var L = g.list.filter(function (n) { return !q || n.toLowerCase().indexOf(q) >= 0 || String(PLAYERS[n].pos || '').toLowerCase() === q; });
      if (!L.length) return '';
      PK.order = PK.order.concat(L);
      return '<div class="sidebar-label">' + g.label + '</div>' + L.map(function (n) { return itemHTML(n, by, wk); }).join('');
    }).join('');
    list.innerHTML = h || '<div class="mw-pick-empty">No athlete matches “' + esc(PK.q) + '”</div>';
    if (PK.kb >= PK.order.length) PK.kb = PK.order.length - 1;
    markKb();
  }
  function markKb() {
    document.querySelectorAll('#mw-pick-list .player-btn').forEach(function (b, i) { b.classList.toggle('mw-kb', i === PK.kb); if (i === PK.kb) b.scrollIntoView({ block: 'nearest' }); });
  }
  function renderPickButton() {
    var el = document.getElementById('playerList'); if (!el) return;
    if (!document.getElementById('mw-pick-btn')) {
      el.innerHTML = '<div class="mw-pick"><button class="mw-pick-btn" id="mw-pick-btn" onclick="mwPickToggle()" aria-haspopup="listbox" title="Switch athlete (press / from anywhere)"></button></div>';
    }
    var n = typeof currentPlayer !== 'undefined' ? currentPlayer : '', p = PLAYERS[n] || {}, as = { status: 'NODATA' };
    try { as = getAthleteStatus(n); } catch (e) {}
    var c = n ? athComp(n, iso(addDays(new Date(), -6)), todayIso()) : { pct: null }, fl = n && !p.inactive ? flagCount(n) : 0;
    var sub = [n ? posLabel(p) : 'Pick an athlete'];
    if (c.pct != null) sub.push('<span style="color:' + pctCol(c.pct) + ';" title="Program sessions logged, last 7 days">' + c.pct + '% 7d</span>');
    if (fl) sub.push('<span style="color:#f59e0b;" title="Active player flags">' + fl + ' flag' + (fl === 1 ? '' : 's') + '</span>');
    document.getElementById('mw-pick-btn').innerHTML = '<div class="player-avatar">' + esc(initials(n || '?')) + '</div>'
      + '<div style="flex:1;min-width:0;"><div class="mw-pick-name">' + esc(n || 'Select athlete') + '</div><div class="mw-pick-sub">' + sub.join(' · ') + '</div></div>'
      + '<div class="status-dot ' + (typeof athleteStatusClass === 'function' ? athleteStatusClass(as.status) : '') + '"></div>' + ico('chev', 14);
  }
  function ensurePanel() {
    var pn = document.getElementById('mw-pick-panel'); if (pn) return pn;
    pn = document.createElement('div'); pn.id = 'mw-pick-panel'; pn.className = 'mw-pick-panel'; pn.setAttribute('role', 'listbox');
    pn.innerHTML = '<div class="mw-pick-search">' + ico('search', 15) + '<input id="mw-pick-q" placeholder="Search athletes or position…" autocomplete="off"></div><div class="mw-pick-list" id="mw-pick-list"></div>';
    document.body.appendChild(pn);
    var q = pn.querySelector('input');
    q.addEventListener('input', function () { PK.q = q.value; PK.kb = PK.q ? 0 : -1; renderPickList(); });
    q.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { PK.kb = Math.min(PK.order.length - 1, PK.kb + 1); markKb(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { PK.kb = Math.max(0, PK.kb - 1); markKb(); e.preventDefault(); }
      else if (e.key === 'Enter') { var n = PK.order[PK.kb < 0 ? 0 : PK.kb]; if (n) mwPickChoose(n); }
      else if (e.key === 'Escape') mwPickToggle(false);
    });
    return pn;
  }
  window.mwPickToggle = function (force) {
    var pn = ensurePanel(), b = document.getElementById('mw-pick-btn');
    PK.open = typeof force === 'boolean' ? force : !PK.open;
    if (PK.open && b) {
      var r = b.getBoundingClientRect();
      pn.style.left = Math.max(8, r.left) + 'px';
      pn.style.top = (r.bottom + 6) + 'px';
      pn.style.maxHeight = Math.max(240, window.innerHeight - r.bottom - 20) + 'px';
      PK.q = ''; PK.kb = -1; pn.querySelector('input').value = '';
      renderPickList();
    }
    pn.classList.toggle('open', PK.open);
    if (b) b.classList.toggle('open', PK.open);
    if (PK.open) setTimeout(function () { pn.querySelector('input').focus(); }, 0);
  };
  window.mwPickChoose = function (name) {
    mwPickToggle(false);
    if (name && typeof selectPlayer === 'function') selectPlayer(name);
  };
  window.mwPickStep = function (d) {
    var L = []; groupedRoster().forEach(function (g) { if (g.label !== 'Inactive') L = L.concat(g.list); });
    var i = L.indexOf(currentPlayer); if (!L.length) return;
    selectPlayer(L[(i + d + L.length) % L.length]);
  };
  document.addEventListener('mousedown', function (e) {
    if (!PK.open) return;
    if (e.target.closest && (e.target.closest('#mw-pick-panel') || e.target.closest('#mw-pick-btn'))) return;
    mwPickToggle(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && PK.open) mwPickToggle(false);
    // "/" opens the athlete picker from anywhere that isn't a text field
    if (e.key === '/' && !PK.open && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '') && !(document.activeElement || {}).isContentEditable) { e.preventDefault(); mwPickToggle(true); }
  });
  window.addEventListener('resize', function () { if (PK.open) mwPickToggle(false); });

  buildPlayerList = function () {
    try { renderPickButton(); if (PK.open) renderPickList(); } catch (e) { console.error('[ui-refresh] picker', e); }
  };
  if (typeof selectPlayer === 'function') {
    var _sp = selectPlayer;
    selectPlayer = function () { var r = _sp.apply(this, arguments); try { renderPickButton(); } catch (e) {} return r; };
  }
  if (typeof loadProgramRows === 'function') {
    var _lpr = loadProgramRows;
    loadProgramRows = function () {
      var pr = _lpr.apply(this, arguments);
      Promise.resolve(pr).then(function () { try { renderPickButton(); if (typeof currentPage !== 'undefined' && currentPage === 'calendar') renderCompliance(); } catch (e) {} });
      return pr;
    };
  }

  // ═══ SIDEBAR: nav icons ═════════════════════════════════════════════════
  function decorateNav() {
    document.querySelectorAll('.sidebar-nav .nav-btn').forEach(function (b) {
      if (b.querySelector('.mw-i')) return;
      var k = b.getAttribute('data-ico') || (b.id === 'dc-nav' ? 'pulse' : null);
      if (b.id === 'dc-nav') { b.innerHTML = b.innerHTML.replace(/^\s*🩺\s*/, ''); }
      if (k) b.insertAdjacentHTML('afterbegin', ico(k, 16));
    });
  }

  // ═══ ATHLETE HEADER: grouped tabs + ⋯ menu ══════════════════════════════
  var GROUPS = [
    { id: 'review', label: 'Year in Review', ico: 'award', tabs: ['review'] },
    { id: 'perf', label: 'Performance', ico: 'trend', tabs: ['overview', 'value'] },
    { id: 'test', label: 'Testing', ico: 'zap', tabs: ['jumps', 'heruns', 'maxstrength'] },
    { id: 'load', label: 'Load', ico: 'gauge', tabs: ['workload'] },
    { id: 'plan', label: 'Programs', ico: 'cal', tabs: ['programs', 'pcal'] }
  ];
  var SUBLABEL = { review: 'Year in Review', overview: 'In-Season', value: 'Value Added', jumps: 'Jumps', heruns: 'HE Runs', maxstrength: '1RM', workload: 'Workload', programs: 'Programs', pcal: 'Calendar' };
  var lastSub = {};
  function tabOf(b) { var m = (b.getAttribute('onclick') || '').match(/switchDashTab\('(\w+)'/); return m ? m[1] : null; }
  function groupOf(tab) { return GROUPS.find(function (g) { return g.tabs.indexOf(tab) >= 0; }); }
  function tabBtn(tab) { return document.querySelector('#dashTabs .tab-btn[onclick*="\'' + tab + '\'"]'); }
  function hiddenByRole(b) { return b && b.style.display === 'none'; }
  function buildTabs() {
    var bar = document.getElementById('dashTabs'); if (!bar || document.getElementById('mwTabs')) return;
    bar.querySelectorAll('.tab-btn').forEach(function (b) {
      var t = tabOf(b); if (!t) return;
      b.removeAttribute('style'); b.style.display = ''; // drop the per-tab colors
      b.textContent = SUBLABEL[t] || b.textContent.replace(/^[^\w]+/, '').trim();
    });
    var mw = document.createElement('div'); mw.id = 'mwTabs';
    mw.innerHTML = GROUPS.map(function (g) { return '<button class="mw-tab" data-g="' + g.id + '" onclick="mwGroup(\'' + g.id + '\')">' + ico(g.ico, 15) + g.label + '</button>'; }).join('');
    bar.parentNode.insertBefore(mw, bar);
    var more = document.createElement('div'); more.className = 'mw-more'; more.id = 'mwMore';
    more.innerHTML = '<button class="mw-more-btn" title="Profile, PDF report, export" onclick="mwMenu()" aria-haspopup="menu">' + ico('more', 18) + '</button>'
      + '<div class="mw-menu" id="mwMenu" role="menu">'
      + '<button onclick="mwMenu(false);openAthleteProfile(currentPlayer)">' + ico('user', 15) + '<div>Athlete profile<small>One page across seasons · print or PDF</small></div></button>'
      + '<button onclick="mwMenu(false);exportPlayerPDF()">' + ico('file', 15) + '<div>PDF report<small>This athlete\'s readiness report</small></div></button>'
      + '<button onclick="mwMenu(false);exportAllData()">' + ico('download', 15) + '<div>Export data<small>Full backup to move to another browser</small></div></button></div>';
    bar.parentNode.insertBefore(more, bar);
    syncTabs();
  }
  window.mwMenu = function (force) {
    var m = document.getElementById('mwMenu'); if (!m) return;
    m.classList.toggle('open', typeof force === 'boolean' ? force : !m.classList.contains('open'));
  };
  document.addEventListener('mousedown', function (e) { var m = document.getElementById('mwMenu'); if (m && m.classList.contains('open') && !(e.target.closest && e.target.closest('#mwMore'))) m.classList.remove('open'); });
  window.mwGroup = function (gid) {
    var g = GROUPS.find(function (x) { return x.id === gid; }); if (!g) return;
    var pick = [lastSub[gid]].concat(g.tabs).filter(Boolean).find(function (t) { var b = tabBtn(t); return b && !hiddenByRole(b); });
    var b = pick && tabBtn(pick); if (b) switchDashTab(pick, b);
  };
  function syncTabs() {
    var bar = document.getElementById('dashTabs'), mw = document.getElementById('mwTabs'); if (!bar || !mw) return;
    var cur = typeof currentDashTab !== 'undefined' ? currentDashTab : 'review', g = groupOf(cur) || GROUPS[0];
    lastSub[g.id] = cur;
    var visible = 0;
    bar.querySelectorAll('.tab-btn').forEach(function (b) {
      var t = tabOf(b), on = g.tabs.indexOf(t) >= 0;
      b.classList.toggle('mw-off', !on);
      if (on && !hiddenByRole(b)) visible++;
    });
    bar.classList.toggle('mw-solo', visible <= 1);
    mw.querySelectorAll('.mw-tab').forEach(function (x) {
      var G = GROUPS.find(function (q) { return q.id === x.dataset.g; });
      x.classList.toggle('active', G === g);
      x.style.display = G.tabs.some(function (t) { var b = tabBtn(t); return b && !hiddenByRole(b); }) ? '' : 'none';
    });
  }
  if (typeof switchDashTab === 'function') {
    var _sdt = switchDashTab;
    switchDashTab = function () { var r = _sdt.apply(this, arguments); try { syncTabs(); } catch (e) {} return r; };
  }
  if (typeof applyPitcherTabs === 'function') {
    var _apt = applyPitcherTabs;
    applyPitcherTabs = function () { var r = _apt.apply(this, arguments); try { syncTabs(); } catch (e) {} return r; };
  }
  if (typeof switchTab === 'function') {
    var _swt = switchTab;
    switchTab = function (page) {
      var r = _swt.apply(this, arguments);
      try {
        var on = page === 'dashboard';
        var a = document.getElementById('mwTabs'), m = document.getElementById('mwMore');
        if (a) a.style.display = on ? '' : 'none';
        if (m) m.style.display = on ? '' : 'none';
        if (on) syncTabs();
        if (page === 'calendar') { renderLegend(); fixCalFilter(); renderCompliance(); }
      } catch (e) { console.error('[ui-refresh] switchTab', e); }
      return r;
    };
  }

  // ═══ CALENDAR ═══════════════════════════════════════════════════════════
  function chipHTML(p, dk, showName) {
    var t = mwType(p.label), st = p.done ? 'done' : p.missed ? 'missed' : 'up';
    var who = String(p.athlete).split(' ').slice(-1)[0];
    var title = p.athlete + ' · ' + p.label + ' · ' + mwCleanProg(p.name) + ' · ' + (p.done ? 'Done' : p.missed ? 'Not logged' : 'Scheduled');
    return '<div class="mw-chip t-' + t + ' ' + st + '" title="' + esc(title) + '" onclick="event.stopPropagation();showDayDetail(\'' + dk + '\')">'
      + (p.done ? ico('check', 11) : p.missed ? ico('dashc', 11) : '') + '<span>' + (showName ? esc(who) + ' · ' : '') + esc(p.label) + '</span></div>';
  }
  function daySumHTML(progs, dk) {
    var t = todayIso(), past = dk <= t, done = progs.filter(function (p) { return p.done; }).length;
    var cnt = {}; progs.forEach(function (p) { var k = mwType(p.label); cnt[k] = (cnt[k] || 0) + 1; });
    var keys = ['speed', 'lift', 'cond', 'recov'].filter(function (k) { return cnt[k]; });
    var ath = {}; progs.forEach(function (p) { ath[p.athlete] = 1; }); var na = Object.keys(ath).length;
    var right = past ? '<span style="color:' + pctCol(dk < t ? Math.round(done / progs.length * 100) : (done ? 100 : null)) + ';"><b style="color:inherit;">' + done + '</b>/' + progs.length + ' logged</span>' : '<span>scheduled</span>';
    return '<div class="mw-daysum" onclick="event.stopPropagation();showDayDetail(\'' + dk + '\')" title="Open the day">'
      + '<div class="mw-daysum-top"><span><b>' + na + '</b> athlete' + (na === 1 ? '' : 's') + '</span>' + right + '</div>'
      + '<div class="mw-typebar">' + keys.map(function (k) { return '<i class="t-' + k + '" style="flex:' + cnt[k] + ';"></i>'; }).join('') + '</div>'
      + '<div class="mw-types">' + keys.map(function (k) { return '<span class="t-' + k + '">' + cnt[k] + ' ' + (k === 'speed' ? 'speed' : k === 'lift' ? 'lift' : k === 'cond' ? 'ESD' : 'mob') + '</span>'; }).join('') + '</div></div>';
  }
  function postMonth() {
    var by = progDays(), f = filterVal();
    document.querySelectorAll('#calendarGrid .cal-cell[data-date]').forEach(function (cell) {
      var dk = cell.getAttribute('data-date');
      var progs = (by[dk] || []).filter(function (p) { return !f || p.athlete === f; });
      // drop the program chips + "+N more" the original drew, keep games / workouts
      cell.querySelectorAll('.cal-event.lift:not([draggable])').forEach(function (x) { x.remove(); });
      Array.prototype.slice.call(cell.children).forEach(function (x) { if (x.tagName === 'DIV' && /^\+\d+ more$/.test((x.textContent || '').trim())) x.remove(); });
      var other = 0;
      try { other = getEventsForDate(dk).filter(function (e) { return e.type !== 'program'; }).length; } catch (e) {}
      var shownOther = cell.querySelectorAll(':scope > .cal-event').length;
      var html = '';
      if (other > shownOther) html += '<div style="font-size:9px;color:var(--text3);">+' + (other - shownOther) + ' more</div>';
      if (progs.length) html += (progs.length <= 3 || f) ? progs.map(function (p) { return chipHTML(p, dk, !f); }).join('') : daySumHTML(progs, dk);
      var add = cell.querySelector('.add-game-btn');
      if (add) add.insertAdjacentHTML('beforebegin', html); else cell.insertAdjacentHTML('beforeend', html);
    });
  }
  function postWeek() {
    // Week view lists every event; restyle the program ones by session type
    var by = progDays(), f = filterVal();
    document.querySelectorAll('#calendarGrid .cal-week-col').forEach(function (col, i) {
      var m = (col.getAttribute('onclick') || '').match(/showDayDetail\('([\d-]+)'\)/); if (!m) return;
      var dk = m[1], progs = (by[dk] || []).filter(function (p) { return !f || p.athlete === f; });
      col.querySelectorAll('.cal-event.lift').forEach(function (x) { if (/^[✓⏸🏋]/u.test((x.textContent || '').trim())) x.remove(); });
      col.insertAdjacentHTML('beforeend', progs.map(function (p) { return chipHTML(p, dk, !f); }).join(''));
    });
  }
  if (typeof renderMonthView === 'function') {
    var _rmv = renderMonthView;
    renderMonthView = function () { var r = _rmv.apply(this, arguments); try { postMonth(); } catch (e) { console.error('[ui-refresh] month', e); } return r; };
  }
  if (typeof renderWeekView === 'function') {
    var _rwv = renderWeekView;
    renderWeekView = function () { var r = _rwv.apply(this, arguments); try { postWeek(); } catch (e) { console.error('[ui-refresh] week', e); } return r; };
  }
  if (typeof renderCalendar === 'function') {
    var _rc = renderCalendar;
    renderCalendar = function () { var r = _rc.apply(this, arguments); try { if (typeof currentPage !== 'undefined' && currentPage === 'calendar') renderCompliance(); } catch (e) {} return r; };
  }

  // Day-detail program card: type color, clean program name, status pill
  window.pcalCardHTML = function (p) {
    var t = mwType(p.label), pill = p.done ? '<span class="mw-pill done">Done</span>' : p.missed ? '<span class="mw-pill missed">Not logged</span>' : '<span class="mw-pill up">Scheduled</span>';
    var icoName = t === 'speed' ? 'zap' : t === 'cond' ? 'pulse' : t === 'recov' ? 'gauge' : 'bar';
    var id = String(p.rowId).replace(/'/g, "\\'");
    return '<div class="mw-pcard t-' + t + '"><div class="mw-pcard-ico">' + ico(icoName, 16) + '</div>'
      + '<div style="flex:1;min-width:170px;"><div class="mw-pcard-t">' + esc(p.athlete) + ' · ' + esc(p.label) + '</div>'
      + '<div class="mw-pcard-s"><span>' + esc(mwCleanProg(p.name)) + ' · Week ' + (p.wi + 1) + '</span>' + pill + '</div></div>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;">'
      + (typeof llShare === 'function' ? '<button class="mw-btn primary" onclick="llShare(\'' + id + '\')">' + ico('send', 13) + 'Send</button>' : '')
      + (typeof llAthleteView === 'function' ? '<button class="mw-btn" onclick="llAthleteView(\'' + id + '\')">' + ico('phone', 13) + 'Athlete view</button>' : '')
      + (typeof peOpenLive === 'function' ? '<button class="mw-btn" onclick="peOpenLive(\'' + id + '\')">' + ico('pencil', 13) + 'Live edit</button>' : '')
      + '</div></div>';
  };

  function renderLegend() {
    var el = document.getElementById('cal-legend'); if (!el || el.dataset.mw) return;
    el.dataset.mw = 1; el.className = 'mw-legend'; el.removeAttribute('style'); el.style.marginBottom = '12px';
    el.innerHTML = '<span class="t-game"><i></i>Game</span>'
      + Object.keys(TYPES).map(function (k) { return '<span class="t-' + k + '"><i></i>' + TYPES[k] + '</span>'; }).join('')
      + '<span class="mw-sep"></span><span>' + ico('check', 12).replace('mw-i', 'mw-i" style="color:var(--mw-good)') + 'Logged</span><span style="color:var(--text3);">' + ico('dashc', 12) + 'Not logged</span>';
  }
  function fixCalFilter() {
    var sel = document.getElementById('cal-athlete-filter'); if (!sel || sel.dataset.mw) return;
    var cur = sel.value; sel.dataset.mw = 1;
    sel.innerHTML = '<option value="">All athletes</option>' + groupedRoster().filter(function (g) { return g.label !== 'Inactive'; }).map(function (g) {
      return '<optgroup label="' + g.label + '">' + g.list.map(function (n) { return '<option value="' + esc(n) + '">' + esc(n) + '</option>'; }).join('') + '</optgroup>';
    }).join('');
    sel.value = cur;
  }

  // Weekly program compliance — logged vs. assigned, worst first
  var COMP_OPEN = true;
  function renderCompliance() {
    var el = document.getElementById('mw-compliance'); if (!el) return;
    var by = progDays(), t = new Date(), ws = weekStart(t), weeks = [3, 2, 1, 0].map(function (k) { var a = addDays(ws, -7 * k); return { from: iso(a), to: iso(addDays(a, 6)), label: k === 0 ? 'This week' : a.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }; });
    var names = {}; Object.keys(by).forEach(function (dk) { if (dk >= weeks[0].from && dk <= weeks[3].to) by[dk].forEach(function (p) { if (PLAYERS[p.athlete] && !PLAYERS[p.athlete].inactive) names[p.athlete] = 1; }); });
    var rows = Object.keys(names).map(function (n) {
      var w = weeks.map(function (x) { return athComp(n, x.from, x.to, by); });
      var tot = w.reduce(function (a, c) { return { done: a.done + c.done, due: a.due + c.due }; }, { done: 0, due: 0 });
      return { n: n, w: w, pct: tot.due ? Math.round(tot.done / tot.due * 100) : null, tot: tot };
    }).sort(function (a, b) { return (a.pct == null ? 999 : a.pct) - (b.pct == null ? 999 : b.pct) || a.n.localeCompare(b.n); });
    if (!rows.length) { el.innerHTML = ''; return; }
    var team = rows.reduce(function (a, r) { return { done: a.done + r.tot.done, due: a.due + r.tot.due }; }, { done: 0, due: 0 }), tp = team.due ? Math.round(team.done / team.due * 100) : null;
    var f = filterVal();
    var cell = function (c) {
      if (!c.due && !c.left) return '<div class="mw-comp-cell" style="color:var(--text3);">—</div>';
      if (!c.due) return '<div class="mw-comp-cell"><b style="color:var(--text3);">—</b><small>' + c.left + ' ahead</small></div>';
      return '<div class="mw-comp-cell" style="background:' + pctBg(c.pct) + ';"><b style="color:' + pctCol(c.pct) + ';">' + c.pct + '%</b><small>' + c.done + '/' + c.due + (c.left ? ' · ' + c.left + ' left' : '') + '</small></div>';
    };
    el.innerHTML = '<details class="card mw-compcard"' + (COMP_OPEN ? ' open' : '') + ' ontoggle="mwCompToggle(this.open)"><summary>'
      + '<span class="card-title" style="margin:0;">Program compliance</span>'
      + '<span style="font-size:11px;color:var(--text3);">sessions logged ÷ sessions assigned, last 4 weeks · worst first</span>'
      + (tp != null ? '<span style="margin-left:auto;font-family:var(--mw-mono);font-size:13px;color:' + pctCol(tp) + ';">Team ' + tp + '% <span style="color:var(--text3);font-size:11px;">(' + team.done + '/' + team.due + ')</span></span>' : '')
      + '</summary><div class="mw-comp-grid"><div class="mw-comp-row hd"><div>Athlete</div>' + weeks.map(function (w) { return '<div>' + w.label + '</div>'; }).join('') + '<div>4-wk</div></div>'
      + rows.map(function (r) {
        return '<div class="mw-comp-row"' + (f && f !== r.n ? ' style="opacity:.45;"' : '') + '><div class="mw-comp-name" data-name="' + esc(r.n) + '" onclick="mwCompOpen(this.dataset.name)" title="Filter the calendar to ' + esc(r.n) + '">' + esc(r.n) + '</div>'
          + r.w.map(cell).join('') + '<div class="mw-comp-cell"><b style="color:' + pctCol(r.pct) + ';">' + (r.pct == null ? '—' : r.pct + '%') + '</b><small>' + r.tot.done + '/' + r.tot.due + '</small></div></div>';
      }).join('') + '</div></details>';
  }
  window.mwCompToggle = function (o) { COMP_OPEN = o; };
  window.mwCompOpen = function (name) {
    var sel = document.getElementById('cal-athlete-filter'); if (!sel) return;
    sel.value = sel.value === name ? '' : name; renderCalendar();
  };

  // ═══ YEAR IN REVIEW: this season first ══════════════════════════════════
  var SEC_ICO = { 'Speed': 'zap', 'Bat & arm': 'pulse', 'Jump (CMJ)': 'jump' };
  function tagPct(tag) {
    var m = String(tag || '').match(/MLB (\d+)/); if (m) return +m[1];
    m = String(tag || '').match(/Team #(\d+)\/(\d+)/); if (m && +m[2] > 1) return Math.round((+m[2] - +m[1]) / (+m[2] - 1) * 100);
    return null;
  }
  if (typeof yrSection === 'function') {
    window.yrSection = function (s, ys) {
      var cur = ys[ys.length - 1], prior = ys.slice(0, -1).reverse();
      return '<div class="card" style="padding:16px 18px;border-radius:12px;margin-bottom:14px;overflow-x:auto;">'
        + '<div class="mw-sec-h"><span class="mw-sec-ico">' + ico(SEC_ICO[s.title] || 'trend', 15) + '</span><span class="mw-sec-t">' + yrEsc(s.title) + '</span><span class="mw-sec-s">' + yrEsc(s.sub) + '</span></div>'
        + '<div style="min-width:720px;"><div class="mw-yr-row hd"><div></div><div>' + cur + '</div><div>' + prior.join(' · ') + '</div><div style="text-align:center;">Trend</div><div style="text-align:right;">Change</div></div>'
        + s.rows.map(function (r) {
          var c = r.cells[cur], p = c ? tagPct(c.tag) : null;
          var big = c
            ? '<div class="mw-yr-big"><b>' + (c.txt || yrFmt(r, c.v)) + '</b><span style="color:' + c.col + ';">' + yrEsc(c.tag || '') + '</span></div>'
              + (p != null ? '<div class="mw-pbar" title="' + p + ' percentile"><em></em><i style="width:' + Math.max(3, p) + '%;background:' + c.col + ';"></i></div>' : '')
            : '<span style="color:var(--text3);font-size:12px;">No ' + cur + ' data</span>';
          var pr = '<div class="mw-yr-prior">' + prior.map(function (y) { var x = r.cells[y]; return '<div><span>' + y + '</span><b>' + (x ? (x.txt || yrFmt(r, x.v)) : '—') + '</b>' + (x && x.tag ? '<em style="color:' + x.col + ';">' + yrEsc(x.tag) + '</em>' : '') + '</div>'; }).join('') + '</div>';
          return '<div class="mw-yr-row"><div><div style="font-size:12.5px;color:#e2e8f0;font-weight:600;line-height:1.25;">' + yrEsc(r.label) + '</div><div style="font-size:9.5px;color:var(--text3);">' + (r.unit || '') + (r.lower ? ' · lower is better' : '') + ' · ' + r.src + '</div></div>'
            + '<div>' + big + '</div>' + pr + '<div style="display:flex;justify-content:center;">' + yrSpark(r, ys) + '</div><div style="text-align:right;">' + yrChange(r, ys) + '</div></div>';
        }).join('') + '</div></div>';
    };
  }

  // ═══ LANDING: same icons, one accent ════════════════════════════════════
  var LANDING_ICO = { dashboard: 'dash', program: 'bar', programs: 'folder', calendar: 'cal', jumps: 'jump', value: 'trend', inbox: 'inbox', brief: 'brief', team: 'users', import: 'upload' };
  if (typeof LANDING_CARDS !== 'undefined' && typeof renderLandingGrid === 'function') {
    LANDING_CARDS.forEach(function (c) { if (LANDING_ICO[c.page]) c.icon = '<span style="color:var(--mw-accent);display:flex;">' + ico(LANDING_ICO[c.page], 22) + '</span>'; c.color = '#FF6A13'; });
    try { renderLandingGrid(); } catch (e) {}
  }

  // ── Boot ─────────────────────────────────────────────────────────────────
  function boot() {
    try { decorateNav(); } catch (e) { console.error('[ui-refresh] nav', e); }
    try { buildTabs(); } catch (e) { console.error('[ui-refresh] tabs', e); }
    try { buildPlayerList(); } catch (e) {}
    // Data Check adds its nav button on load — decorate it when it shows up
    var nav = document.querySelector('.sidebar-nav');
    if (nav && window.MutationObserver) new MutationObserver(function () { decorateNav(); }).observe(nav, { childList: true });
    var page = typeof currentPage !== 'undefined' ? currentPage : 'dashboard';
    var a = document.getElementById('mwTabs'), m = document.getElementById('mwMore');
    if (page !== 'dashboard') { if (a) a.style.display = 'none'; if (m) m.style.display = 'none'; }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
