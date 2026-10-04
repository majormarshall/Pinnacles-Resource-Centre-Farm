// worker/js/worker.js
// Farm Worker Mobile Portal \u2014 JavaScript
// Auth uses the same JWT as the admin system
'use strict';

const W_TOKEN = 'pinnacles_admin_token';
let wUser     = null;

// \u2500\u2500 Helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function wToken()      { return localStorage.getItem(W_TOKEN) || ''; }
function wVal(id)      { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
function today()       { return new Date().toISOString().slice(0, 10); }
function nowTime()     {
  const d = new Date();
  return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}
function fmtDate(d) {
  if (!d) return '\u2014';
  try { return new Date(d).toLocaleDateString('en-NG', { day: '2-digit', month: 'short' }); }
  catch { return d; }
}

async function wApi(method, endpoint, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + wToken() },
  };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(endpoint, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

let toastTimer = null;
function wToast(msg, isError, ms = 2800) {
  const el = document.getElementById('w-toast');
  if (!el) return;
  el.textContent = msg;
  el.className   = 'w-toast' + (isError ? ' error' : '');
  el.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = 'none'; }, ms);
}

// \u2500\u2500 LOGIN \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function wLogin() {
  const email = wVal('we');
  const pass  = wVal('wp');
  const errEl = document.getElementById('w-err');
  errEl.style.display = 'none';

  try {
    const res  = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass }),
    });
    const data = await res.json();
    if (!data.token) throw new Error(data.error || 'Login failed');

    localStorage.setItem(W_TOKEN, data.token);
    wUser = data.user || { name: email.split('@')[0], role: 'farm_worker' };
    showWApp();
  } catch (e) {
    errEl.textContent  = e.message;
    errEl.style.display = 'block';
  }
}

function wLogout() {
  localStorage.removeItem(W_TOKEN);
  document.getElementById('w-app').style.display   = 'none';
  document.getElementById('w-login').style.display  = 'flex';
}

// \u2500\u2500 SHOW APP \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function showWApp() {
  document.getElementById('w-login').style.display = 'none';
  document.getElementById('w-app').style.display   = 'flex';

  const now   = new Date();
  const hour  = now.getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name  = (wUser?.name || '').split(' ')[0] || 'Worker';
  document.getElementById('w-greeting').textContent =
    `${greet}, ${name}! \u{1F331}`;
  document.getElementById('w-date').textContent =
    now.toLocaleDateString('en-NG', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  // Pre-fill all date fields with today
  ['wa-date','wt-date','wh-date','wd-date'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = today();
  });
  // Pre-fill time in
  const timeIn = document.getElementById('wa-in');
  if (timeIn) timeIn.value = nowTime();

  loadMyAttendance();
}

// \u2500\u2500 TAB SWITCHING \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function wTab(tab, btn) {
  document.querySelectorAll('.w-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.w-nav-btn').forEach(b => b.classList.remove('active'));
  const tabEl = document.getElementById('wtab-' + tab);
  if (tabEl) tabEl.classList.add('active');
  if (btn)   btn.classList.add('active');
}

// \u2500\u2500 LOAD MY ATTENDANCE \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function loadMyAttendance() {
  const attEl = document.getElementById('w-my-att');
  if (!attEl) return;
  try {
    // Fetch all attendance \u2014 filter to today/recent on frontend
    const rows = await wApi('GET', '/api/farm/attendance');
    const mine = Array.isArray(rows) ? rows.slice(0, 10) : [];

    if (!mine.length) {
      attEl.innerHTML = '<p class="w-empty">No attendance records yet today.</p>';
      return;
    }
    attEl.innerHTML = mine.map(r => `
      <div class="w-att-row">
        <div class="w-att-date">${fmtDate(r.work_date)}</div>
        <div class="w-att-meta">${r.time_in || '\u2014'} \u2192 ${r.time_out || '\u2014'} · ${r.hours_worked || 8} hrs${r.task ? ' · ' + r.task : ''}</div>
      </div>`).join('');
  } catch {
    attEl.innerHTML = '<p class="w-empty">Could not load attendance.</p>';
  }
}

// \u2500\u2500 SUBMIT ATTENDANCE \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function wSubmitAttendance() {
  const workDate = wVal('wa-date');
  const timeIn   = wVal('wa-in');
  const timeOut  = wVal('wa-out');
  const task     = wVal('wa-task');
  const notes    = wVal('wa-notes');

  if (!workDate) { wToast('Please set a date', true); return; }

  let hoursWorked = 8; // Default if no time out
  if (timeIn && timeOut) {
    const [ih, im] = timeIn.split(':').map(Number);
    const [oh, om] = timeOut.split(':').map(Number);
    hoursWorked = Math.max(0, ((oh * 60 + om) - (ih * 60 + im)) / 60);
  }

  const body = {
    work_date:    workDate,
    time_in:      timeIn   || null,
    time_out:     timeOut  || null,
    hours_worked: hoursWorked,
    task:         task     || null,
    notes:        notes    || null,
  };

  try {
    await wApi('POST', '/api/farm/attendance', body);
    wToast('\u2705 Attendance submitted!');
    // Clear optional fields
    const outEl = document.getElementById('wa-out');
    const taskEl = document.getElementById('wa-task');
    const notesEl = document.getElementById('wa-notes');
    if (outEl)   outEl.value   = '';
    if (taskEl)  taskEl.value  = '';
    if (notesEl) notesEl.value = '';
    loadMyAttendance();
  } catch (e) {
    wToast('\u274C ' + e.message, true, 4000);
  }
}

// \u2500\u2500 SUBMIT TASK (logs to farm diary) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function wSubmitTask() {
  const category = wVal('wt-cat');
  const desc     = wVal('wt-desc');
  const area     = wVal('wt-area');
  const date     = wVal('wt-date');

  if (!desc) { wToast('Please describe the task', true); return; }

  const title   = category + (area ? ' \u2014 ' + area : '');
  const content = desc + (area ? `\n\nArea: ${area}` : '');

  try {
    await wApi('POST', '/api/farm/diary', {
      entry_date: date || today(),
      category:   category.toLowerCase(),
      title,
      content,
      written_by: wUser?.name || 'Worker',
    });
    wToast('\u2705 Task logged!');
    document.getElementById('wt-desc').value = '';
    document.getElementById('wt-area').value = '';
  } catch (e) {
    wToast('\u274C ' + e.message, true, 4000);
  }
}

// \u2500\u2500 SUBMIT HARVEST \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function wSubmitHarvest() {
  const crop  = wVal('wh-crop');
  const qty   = wVal('wh-qty');
  const unit  = wVal('wh-unit');
  const grade = wVal('wh-grade');
  const date  = wVal('wh-date');
  const notes = wVal('wh-notes');

  if (!crop)         { wToast('Enter crop name', true); return; }
  if (!qty || qty <= 0) { wToast('Enter a valid quantity', true); return; }

  try {
    await wApi('POST', '/api/farm/harvests', {
      crop_name:    crop,
      harvest_date: date || today(),
      quantity:     parseFloat(qty),
      unit,
      quality_grade: grade || 'A',
      harvested_by:  wUser?.name || 'Worker',
      notes:         notes || null,
    });
    wToast('\u2705 Harvest logged!');
    ['wh-crop','wh-qty','wh-notes'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  } catch (e) {
    wToast('\u274C ' + e.message, true, 4000);
  }
}

// \u2500\u2500 SUBMIT DIARY ENTRY \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function wSubmitDiary() {
  const content = wVal('wd-note');
  const weather = wVal('wd-weather');
  const date    = wVal('wd-date');

  if (!content) { wToast('Please write your diary entry', true); return; }

  try {
    await wApi('POST', '/api/farm/diary', {
      entry_date: date || today(),
      category:   'general',
      content,
      weather:    weather || null,
      written_by: wUser?.name || 'Worker',
    });
    wToast('\u2705 Diary entry saved!');
    document.getElementById('wd-note').value    = '';
    document.getElementById('wd-weather').value = '';
  } catch (e) {
    wToast('\u274C ' + e.message, true, 4000);
  }
}

// \u2500\u2500 AUTO-LOGIN on page load \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem(W_TOKEN);
  if (!token) return;
  fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + token } })
    .then(r => r.ok ? r.json() : null)
    .then(user => {
      if (user) {
        wUser = user;
        showWApp();
      }
    })
    .catch(() => { /* Token invalid \u2014 stay on login screen */ });
});

// -- REGISTRATION ---------------------------------------------------------
function wSwitchTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('w-tab-login').style.display = isLogin ? '' : 'none';
  document.getElementById('w-tab-reg').style.display   = isLogin ? 'none' : '';
  document.getElementById('tab-login-btn').style.cssText =
    isLogin ? 'flex:1;background:none;border:none;color:#52b788;font-weight:700;font-size:.9rem;padding:8px 0;border-bottom:2px solid #52b788;cursor:pointer;font-family:inherit'
            : 'flex:1;background:none;border:none;color:rgba(255,255,255,.4);font-weight:600;font-size:.9rem;padding:8px 0;border-bottom:2px solid transparent;cursor:pointer;font-family:inherit';
  document.getElementById('tab-reg-btn').style.cssText =
    !isLogin ? 'flex:1;background:none;border:none;color:#52b788;font-weight:700;font-size:.9rem;padding:8px 0;border-bottom:2px solid #52b788;cursor:pointer;font-family:inherit'
             : 'flex:1;background:none;border:none;color:rgba(255,255,255,.4);font-weight:600;font-size:.9rem;padding:8px 0;border-bottom:2px solid transparent;cursor:pointer;font-family:inherit';
  const errEl = document.getElementById(isLogin ? 'w-reg-err' : 'w-err');
  if (errEl) errEl.style.display = 'none';
}

async function wRegister() {
  const name  = (document.getElementById('wr-name')?.value  || '').trim();
  const email = (document.getElementById('wr-email')?.value || '').trim();
  const phone = (document.getElementById('wr-phone')?.value || '').trim();
  const role  = (document.getElementById('wr-role')?.value  || '').trim();
  const pass  = (document.getElementById('wr-pass')?.value  || '');
  const pass2 = (document.getElementById('wr-pass2')?.value || '');
  const errEl = document.getElementById('w-reg-err');

  if (!name)              { errEl.textContent='Please enter your full name.';           errEl.style.display=''; return; }
  if (!email)             { errEl.textContent='Please enter your email address.';       errEl.style.display=''; return; }
  if (!pass)              { errEl.textContent='Please choose a password.';              errEl.style.display=''; return; }
  if (pass.length < 6)    { errEl.textContent='Password must be at least 6 characters.'; errEl.style.display=''; return; }
  if (pass !== pass2)     { errEl.textContent='Passwords do not match.';                errEl.style.display=''; return; }
  errEl.style.display = 'none';

  const btn = document.querySelector('#w-tab-reg button');
  const origText = btn.innerHTML;
  btn.textContent = 'Submitting...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/worker-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, role, password: pass }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');

    // Show success state
    document.getElementById('w-tab-reg').innerHTML =
      '<div style="text-align:center;padding:20px 0">' +
      '<div style="font-size:3rem;margin-bottom:14px">&#x2705;</div>' +
      '<h3 style="color:#a3d9b8;margin-bottom:10px">Registration Submitted!</h3>' +
      '<p style="font-size:.85rem;color:rgba(255,255,255,.55);line-height:1.7">Your account is <strong style="color:#fbbf24">pending approval</strong>.<br>The farm manager will review and activate your account.<br><br>Once approved, come back here and sign in with your email and password.</p>' +
      '<button onclick="wSwitchTab(\'login\')" style="margin-top:20px;background:linear-gradient(135deg,#1b4332,#2d6a4f);color:#fff;border:none;border-radius:12px;padding:12px 24px;font-size:.9rem;font-weight:700;cursor:pointer;font-family:inherit">Go to Sign In</button>' +
      '</div>';
  } catch(e) {
    errEl.textContent = e.message;
    errEl.style.display = '';
    btn.innerHTML = origText;
    btn.disabled = false;
  }
}
