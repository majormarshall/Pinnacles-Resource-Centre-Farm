// worker/js/worker.js
// Farm Worker Mobile Portal — JavaScript
// Auth uses the same JWT as the admin system
'use strict';

const W_TOKEN = 'pinnacles_admin_token';
let wUser     = null;

// ── Helpers ────────────────────────────────────────────────────────────────
function wToken()      { return localStorage.getItem(W_TOKEN) || ''; }
function wVal(id)      { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
function today()       { return new Date().toISOString().slice(0, 10); }
function nowTime()     {
  const d = new Date();
  return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}
function fmtDate(d) {
  if (!d) return '—';
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

// ── LOGIN ──────────────────────────────────────────────────────────────────
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

// ── SHOW APP ───────────────────────────────────────────────────────────────
function showWApp() {
  document.getElementById('w-login').style.display = 'none';
  document.getElementById('w-app').style.display   = 'flex';

  const now   = new Date();
  const hour  = now.getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name  = (wUser?.name || '').split(' ')[0] || 'Worker';
  document.getElementById('w-greeting').textContent =
    `${greet}, ${name}! 🌱`;
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

// ── TAB SWITCHING ──────────────────────────────────────────────────────────
function wTab(tab, btn) {
  document.querySelectorAll('.w-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.w-nav-btn').forEach(b => b.classList.remove('active'));
  const tabEl = document.getElementById('wtab-' + tab);
  if (tabEl) tabEl.classList.add('active');
  if (btn)   btn.classList.add('active');
}

// ── LOAD MY ATTENDANCE ─────────────────────────────────────────────────────
async function loadMyAttendance() {
  const attEl = document.getElementById('w-my-att');
  if (!attEl) return;
  try {
    // Fetch all attendance — filter to today/recent on frontend
    const rows = await wApi('GET', '/api/farm/attendance');
    const mine = Array.isArray(rows) ? rows.slice(0, 10) : [];

    if (!mine.length) {
      attEl.innerHTML = '<p class="w-empty">No attendance records yet today.</p>';
      return;
    }
    attEl.innerHTML = mine.map(r => `
      <div class="w-att-row">
        <div class="w-att-date">${fmtDate(r.work_date)}</div>
        <div class="w-att-meta">${r.time_in || '—'} → ${r.time_out || '—'} · ${r.hours_worked || 8} hrs${r.task ? ' · ' + r.task : ''}</div>
      </div>`).join('');
  } catch {
    attEl.innerHTML = '<p class="w-empty">Could not load attendance.</p>';
  }
}

// ── SUBMIT ATTENDANCE ──────────────────────────────────────────────────────
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
    wToast('✅ Attendance submitted!');
    // Clear optional fields
    const outEl = document.getElementById('wa-out');
    const taskEl = document.getElementById('wa-task');
    const notesEl = document.getElementById('wa-notes');
    if (outEl)   outEl.value   = '';
    if (taskEl)  taskEl.value  = '';
    if (notesEl) notesEl.value = '';
    loadMyAttendance();
  } catch (e) {
    wToast('❌ ' + e.message, true, 4000);
  }
}

// ── SUBMIT TASK (logs to farm diary) ──────────────────────────────────────
async function wSubmitTask() {
  const category = wVal('wt-cat');
  const desc     = wVal('wt-desc');
  const area     = wVal('wt-area');
  const date     = wVal('wt-date');

  if (!desc) { wToast('Please describe the task', true); return; }

  const title   = category + (area ? ' — ' + area : '');
  const content = desc + (area ? `\n\nArea: ${area}` : '');

  try {
    await wApi('POST', '/api/farm/diary', {
      entry_date: date || today(),
      category:   category.toLowerCase(),
      title,
      content,
      written_by: wUser?.name || 'Worker',
    });
    wToast('✅ Task logged!');
    document.getElementById('wt-desc').value = '';
    document.getElementById('wt-area').value = '';
  } catch (e) {
    wToast('❌ ' + e.message, true, 4000);
  }
}

// ── SUBMIT HARVEST ────────────────────────────────────────────────────────
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
    wToast('✅ Harvest logged!');
    ['wh-crop','wh-qty','wh-notes'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  } catch (e) {
    wToast('❌ ' + e.message, true, 4000);
  }
}

// ── SUBMIT DIARY ENTRY ────────────────────────────────────────────────────
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
    wToast('✅ Diary entry saved!');
    document.getElementById('wd-note').value    = '';
    document.getElementById('wd-weather').value = '';
  } catch (e) {
    wToast('❌ ' + e.message, true, 4000);
  }
}

// ── AUTO-LOGIN on page load ───────────────────────────────────────────────
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
    .catch(() => { /* Token invalid — stay on login screen */ });
});
