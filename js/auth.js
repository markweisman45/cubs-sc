// ═══════════════════════════════════════════════════════════════════════════
// Coach sign-in (Supabase Auth, email + password).
// Once row-level security is on, the dashboard only reads/writes data while
// signed in. Sign in once per device; the session is remembered.
// While security is still off, "Skip for now" lets the dashboard work unsigned.
// ═══════════════════════════════════════════════════════════════════════════
var AUTH = { session: null, open: false };

function authDb() { return typeof getSupaClient === 'function' ? getSupaClient() : null; }

function authOverlay(mode, msg, canSkip) {
  var old = document.getElementById('auth-ov'); if (old) old.remove();
  AUTH.open = true;
  var ov = document.createElement('div'); ov.id = 'auth-ov';
  ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:radial-gradient(ellipse at top,#0e2a66 0%,#060b18 70%);display:flex;align-items:center;justify-content:center;padding:20px;';
  var inp = 'width:100%;box-sizing:border-box;background:#0b1224;border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:11px 12px;color:#fff;font-size:14px;margin-top:6px;';
  var btn = 'width:100%;padding:12px;border:none;border-radius:8px;background:#0E3386;color:#fff;font-weight:800;font-size:14px;cursor:pointer;margin-top:16px;';
  var body = mode === 'reset'
    ? '<div style="font-size:13px;color:#cbd5e1;margin-bottom:6px;">Set a new password</div><input id="auth-p1" type="password" placeholder="New password" autocomplete="new-password" style="' + inp + '"><input id="auth-p2" type="password" placeholder="Repeat new password" autocomplete="new-password" style="' + inp + '"><button id="auth-go" style="' + btn + '">Save password</button>'
    : '<input id="auth-e" type="email" placeholder="Email" autocomplete="username" style="' + inp + '"><input id="auth-p" type="password" placeholder="Password" autocomplete="current-password" style="' + inp + '"><button id="auth-go" style="' + btn + '">Sign in</button>'
      + '<div style="display:flex;justify-content:space-between;margin-top:12px;font-size:12px;"><a href="#" id="auth-forgot" style="color:#93c5fd;">Forgot password?</a>'
      + (canSkip ? '<a href="#" id="auth-skip" style="color:#94a3b8;" title="Only works until security is turned on">Skip for now</a>' : '') + '</div>';
  ov.innerHTML = '<div style="width:340px;max-width:100%;background:rgba(15,23,42,.92);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.5);">'
    + '<div style="text-align:center;font-size:30px;">⚾</div><div style="text-align:center;font-family:\'Bebas Neue\',sans-serif;font-size:24px;letter-spacing:.06em;color:#fff;">CUBS STRENGTH &amp; CONDITIONING</div>'
    + '<div style="text-align:center;font-size:11px;color:#94a3b8;margin-bottom:16px;">Coach sign-in</div>' + body
    + '<div id="auth-msg" style="font-size:12px;margin-top:10px;min-height:16px;color:' + (msg && msg.ok ? '#4ade80' : '#f87171') + ';">' + (msg ? (msg.text || msg) : '') + '</div></div>';
  document.body.appendChild(ov);
  var say = function (t, ok) { var m = document.getElementById('auth-msg'); if (m) { m.style.color = ok ? '#4ade80' : '#f87171'; m.textContent = t; } };
  var go = document.getElementById('auth-go');
  if (mode === 'reset') {
    go.onclick = async function () {
      var a = document.getElementById('auth-p1').value, b = document.getElementById('auth-p2').value;
      if (a.length < 8) return say('Use at least 8 characters.');
      if (a !== b) return say('Passwords don\'t match.');
      go.disabled = true; go.textContent = 'Saving…';
      var r = await authDb().auth.updateUser({ password: a });
      if (r.error) { go.disabled = false; go.textContent = 'Save password'; return say(r.error.message); }
      history.replaceState(null, '', location.pathname); location.reload();
    };
    return;
  }
  var submit = async function () {
    var e = document.getElementById('auth-e').value.trim(), p = document.getElementById('auth-p').value;
    if (!e || !p) return say('Enter your email and password.');
    go.disabled = true; go.textContent = 'Signing in…';
    var r = await authDb().auth.signInWithPassword({ email: e, password: p });
    if (r.error) { go.disabled = false; go.textContent = 'Sign in'; return say(r.error.message === 'Invalid login credentials' ? 'Email or password is wrong.' : r.error.message); }
    location.reload();   // start fresh so every cloud load runs signed in
  };
  go.onclick = submit;
  document.getElementById('auth-p').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') submit(); });
  document.getElementById('auth-forgot').onclick = async function (ev) {
    ev.preventDefault();
    var e = document.getElementById('auth-e').value.trim(); if (!e) return say('Type your email first, then tap Forgot password.');
    var r = await authDb().auth.resetPasswordForEmail(e, { redirectTo: location.origin + location.pathname });
    say(r.error ? r.error.message : 'Check your email for a reset link.', !r.error);
  };
  var sk = document.getElementById('auth-skip');
  if (sk) sk.onclick = function (ev) { ev.preventDefault(); try { sessionStorage.setItem('auth_skip', '1'); } catch (x) {} ov.remove(); AUTH.open = false; };
  setTimeout(function () { var f = document.getElementById('auth-e'); if (f) f.focus(); }, 50);
}

// Is security still off? (an unsigned read of a coach table returns rows)
async function authSecurityOff() {
  try { var r = await authDb().from('athlete_programs').select('id').limit(1); return !r.error && r.data && r.data.length > 0; } catch (e) { return false; }
}

function authBadge() {
  var b = document.getElementById('auth-badge'); if (b) b.remove();
  if (!AUTH.session) return;
  b = document.createElement('div'); b.id = 'auth-badge';
  b.style.cssText = 'position:fixed;left:10px;bottom:8px;z-index:9000;font-size:10px;color:#64748b;background:rgba(2,6,23,.6);border:1px solid rgba(255,255,255,.06);border-radius:6px;padding:3px 7px;';
  b.innerHTML = '🔒 ' + (AUTH.session.user && AUTH.session.user.email ? AUTH.session.user.email.replace(/(.{2}).*(@.*)/, '$1…$2') : 'signed in') + ' · <a href="#" style="color:#93c5fd;" onclick="authSignOut();return false;">Sign out</a>';
  document.body.appendChild(b);
}
async function authSignOut() { if (!confirm('Sign out of the dashboard on this device?')) return; await authDb().auth.signOut(); try { sessionStorage.removeItem('auth_skip'); } catch (e) {} location.reload(); }

async function authInit(tries) {
  var db = authDb();
  if (!db || !db.auth) { if ((tries || 0) < 40) setTimeout(function () { authInit((tries || 0) + 1); }, 250); return; }
  // Password-reset link lands here with #...type=recovery
  if (/type=recovery/.test(location.hash)) { db.auth.onAuthStateChange(function (ev) { if (ev === 'PASSWORD_RECOVERY') authOverlay('reset'); }); setTimeout(function () { if (!AUTH.open) authOverlay('reset'); }, 1500); return; }
  var s = await db.auth.getSession();
  AUTH.session = s && s.data && s.data.session;
  db.auth.onAuthStateChange(function (ev, session) { AUTH.session = session; authBadge(); });
  if (AUTH.session) { authBadge(); return; }
  var off = await authSecurityOff();
  var skipped = false; try { skipped = sessionStorage.getItem('auth_skip') === '1'; } catch (e) {}
  if (off && skipped) return;
  authOverlay('login', off ? null : { text: 'Security is on — sign in to load your data.' }, off);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { authInit(0); }); else authInit(0);
