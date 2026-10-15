// ============================================================
// Pinnacles Farm \u2014 Admin Dashboard JavaScript
// ============================================================
const API = '/api';
let authToken = localStorage.getItem('pinnacles_admin_token');
let currentTab = 'overview';
let _pollTimer    = null;   // auto-refresh interval handle
let _lastOrderId  = 0;      // highest order ID seen so far
let _pollRunning  = false;  // prevent overlapping polls


// Ensure image paths resolve from root (handles relative paths like "images/foo.png")
// Also passes data: URLs (base64) through unchanged.
function imgSrc(url) {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('/') || url.startsWith('data:')) return url;
  return '/' + url;
}

// \u2500\u2500 Boot \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
window.addEventListener('DOMContentLoaded', () => {
  if (authToken) showDashboard();
  else showLogin();
});

function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('dashboard').style.display = 'none';
}

function showDashboard() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'grid';
  const user = parseToken(authToken);
  if (user) document.getElementById('admin-name-display').textContent = user.username;
  loadOverview();
  startOrderPolling();
  setTimeout(() => { try { loadPreorders(); } catch(_){} }, 1200);
}

function parseToken(token) {
  try { return JSON.parse(atob(token.split('.')[1])); } catch { return null; }
}

// \u2500\u2500 Login \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  const errEl = document.getElementById('login-error');
  btn.textContent = 'Signing in\u2026';
  btn.disabled = true;
  errEl.style.display = 'none';
  try {
    const res = await api('POST', '/auth/login', {
      username: document.getElementById('login-username').value,
      password: document.getElementById('login-password').value
    }, false);
    if (res.token) {
      authToken = res.token;
      localStorage.setItem('pinnacles_admin_token', authToken);
      showDashboard();
    } else {
      throw new Error(res.error || 'Login failed');
    }
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  } finally {
    btn.textContent = 'Sign In';
    btn.disabled = false;
  }
}

function logout() {
  stopOrderPolling();
  authToken = null;
  localStorage.removeItem('pinnacles_admin_token');
  showLogin();
}

// \u2500\u2500 API Helper \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function api(method, path, body = null, auth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  if (res.status === 401 || res.status === 403) { logout(); return {}; }
  return res.json();
}

// \u2500\u2500 Tabs \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function showTab(tab, el) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const target = document.getElementById('tab-' + tab);
  if (target) target.classList.add('active');
  if (el) el.classList.add('active');
  currentTab = tab;
  const titles = {
    overview: 'Dashboard Overview',
    orders: 'Orders',
    payments: 'Bank Payment Verification',
    products: 'Products',
    gallery: 'Farm Gallery',
    messages: 'Messages',
    settings: 'Settings',
    harvest: "Today's Harvest",
    preorders: 'Pre-orders',
    payroll: 'Staff Payroll Calculator',
    'harvest-calendar': 'Harvest Calendar'
  };
  document.getElementById('topbar-title').textContent = titles[tab] || tab;
  switch (tab) {
    case 'overview': loadOverview(); break;
    case 'orders': loadOrders(); break;
    case 'payments': loadPaymentVerification(); break;
    case 'products': loadProducts(); break;
    case 'gallery': loadGallery(); break;
    case 'messages': loadMessages(); break;
    case 'payroll': loadPayrollCalculator(); break;
    case 'harvest-calendar':
    case 'calendar': loadHarvestCalendar(); break;
    case 'preorders': loadPreorders(); break;
    case 'harvest': loadHarvestAdmin(); break;
    case 'reviews': loadAdminReviews(); break;
    case 'customers': loadCustomerDatabase(); break;
    case 'expenses': loadExpenseTracker(); break;
    case 'inventory': loadInventoryManager(); break;
    case 'flash-sales': loadFlashSaleManager(); break;
    case 'wa-templates': loadWhatsAppTemplates(); break;
    case 'activity': loadActivityLog(); break;
    case 'admin-users-tab': loadAdminUsersTab(); break;
  }
}

// \u2500\u2500 Overview \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function loadOverview() {
  checkLowStock();
  loadWeatherWidget();
  const [ordersData, msgsData] = await Promise.all([
    api('GET', '/orders'),
    api('GET', '/messages')
  ]);
  const s = ordersData.stats || {};
  setText('stat-total-orders', s.total || 0);
  setText('stat-pending', s.pending || 0);
  setText('stat-revenue', `₦${Number(s.revenue || 0).toLocaleString()}`);
  setText('stat-msgs', msgsData.unread || 0);
  document.getElementById('pending-badge').textContent = s.pending || 0;
  document.getElementById('msg-badge').textContent = msgsData.unread || 0;

  // Recent orders
  const recentOrders = (ordersData.orders || []).slice(0, 5);
  document.getElementById('recent-orders-list').innerHTML = recentOrders.length
    ? recentOrders.map(o => `
        <div class="recent-order-row">
          <div>
            <div style="font-weight:600;font-size:.88rem">${o.customer_name || 'Customer'}</div>
            <div style="font-size:.75rem;color:var(--text-muted)">${formatDate(o.created_at)}</div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:700;color:var(--green-light)">₦${Number(o.total).toLocaleString()}</div>
            <span class="status-badge status-${o.status}">${o.status}</span>
          </div>
        </div>`).join('')
    : '<p style="color:var(--text-muted);font-size:.88rem;padding:20px 0;text-align:center">No orders yet</p>';

  // Recent messages
  const recentMsgs = (msgsData.messages || []).slice(0, 4);
  document.getElementById('recent-messages-list').innerHTML = recentMsgs.length
    ? recentMsgs.map(m => `
        <div class="recent-msg-row">
          <div style="font-weight:600;font-size:.88rem">${m.name} ${m.is_read ? '' : '<span style="color:var(--green-light);font-size:.7rem">● NEW</span>'}</div>
          <div style="font-size:.8rem;color:var(--text-muted);margin-top:2px">${m.message.substring(0,80)}${m.message.length>80?'…':''}</div>
        </div>`).join('')
    : '<p style="color:var(--text-muted);font-size:.88rem;padding:20px 0;text-align:center">No messages yet</p>';

  // Render Charts
  renderSalesCharts();
}

// ── Sales Charts (Chart.js) ────────────────────────────────────
async function renderSalesCharts() {
  // Fetch orders data
  let orders = [];
  try {
    const res = await api('GET', '/orders');
    orders = Array.isArray(res) ? res : (res?.orders || []);
  } catch { return; }
  if (!Array.isArray(orders)) return;

  // Revenue last 7 days
  const days = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    days[d.toISOString().slice(0,10)] = 0;
  }
  orders.forEach(o => {
    const d = (o.created_at||'').slice(0,10);
    if (days[d] !== undefined) days[d] += Number(o.total||0);
  });
  const labels = Object.keys(days).map(d => { const dt = new Date(d); return dt.toLocaleDateString('en-NG',{weekday:'short',day:'numeric'}); });
  const values = Object.values(days);

  const rCtx = document.getElementById('revenue-chart');
  if (rCtx && typeof Chart !== 'undefined') {
    if (rCtx._chart) rCtx._chart.destroy();
    rCtx._chart = new Chart(rCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [{ label: 'Revenue (₦)', data: values, borderColor: '#52b788', backgroundColor: 'rgba(82,183,136,.1)', tension: .4, fill: true, pointBackgroundColor: '#52b788' }]
      },
      options: { responsive: true, plugins: { legend: { labels: { color: '#a3d9b8' } } }, scales: { x: { ticks: { color: '#666' } }, y: { ticks: { color: '#666', callback: v => '₦'+v.toLocaleString() } } } }
    });
  }

  // Status breakdown
  const statuses = {};
  orders.forEach(o => { statuses[o.status||'pending'] = (statuses[o.status||'pending']||0)+1; });
  const sCtx = document.getElementById('status-chart');
  if (sCtx && typeof Chart !== 'undefined') {
    if (sCtx._chart) sCtx._chart.destroy();
    sCtx._chart = new Chart(sCtx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(statuses),
        datasets: [{ data: Object.values(statuses), backgroundColor: ['#52b788','#fbbf24','#f87171','#60a5fa','#a78bfa'] }]
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#a3d9b8', font: { size: 11 } } } } }
    });
  }
}

// ── Low Stock Alert ────────────────────────────────────────────
async function checkLowStock() {
  try {
    const raw = await api('GET', '/products');
    const products = Array.isArray(raw) ? raw : (raw?.products || []);
    const low = products.filter(p => Number(p.in_stock) === 0 || (p.stock !== undefined && Number(p.stock) < 5) || (p.stock_qty !== undefined && Number(p.stock_qty) < 5));
    if (!low.length) return;
    const container = document.getElementById('low-stock-alert');
    if (!container) return;
    container.style.display = 'block';
    container.innerHTML = `
      <div class="alert-banner alert-warning">
        ⚠️ <strong>${low.length} product${low.length>1?'s':''} low/out of stock:</strong>
        ${low.map(p => `<span class="stock-chip">${p.emoji||'🌿'} ${p.name}</span>`).join('')}
        <a href="#" onclick="showTab('products', document.querySelector('[onclick*=products]'))" style="margin-left:12px;color:#fbbf24;font-weight:700">Manage Products →</a>
      </div>
    `;
  } catch {}
}

// ── Weather Widget (Offa, Kwara) ──────────────────────────────
async function loadWeatherWidget() {
  const el = document.getElementById('weather-widget');
  if (!el) return;
  try {
    // Using Open-Meteo API (free, no API key needed!) for Offa coordinates
    // Offa, Kwara State: lat 8.15, lon 4.72
    const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=8.15&longitude=4.72&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Africa%2FLagos&forecast_days=3');
    const data = await res.json();
    const c = data.current;
    const d = data.daily;
    const wmoMap = { 0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',61:'🌧️',71:'🌨️',80:'🌦️',95:'⛈️' };
    const icon = wmoMap[c.weather_code] || '🌡️';
    el.innerHTML = `
      <div class="weather-card">
        <div class="weather-header">
          <span class="weather-icon">${icon}</span>
          <div>
            <div class="weather-temp">${Math.round(c.temperature_2m)}°C</div>
            <div class="weather-loc">📍 Offa, Kwara</div>
          </div>
        </div>
        <div class="weather-meta">
          <span>💧 ${c.relative_humidity_2m}%</span>
          <span>💨 ${c.wind_speed_10m} km/h</span>
        </div>
        <div class="weather-forecast">
          ${d.time.slice(0,3).map((day,i) => `
            <div class="forecast-day">
              <span>${i===0?'Today':new Date(day).toLocaleDateString('en-NG',{weekday:'short'})}</span>
              <span>${wmoMap[d.precipitation_sum[i]>2?61:0]||'🌡️'}</span>
              <span>${Math.round(d.temperature_2m_max[i])}°</span>
            </div>
          `).join('')}
        </div>
        <p class="weather-note">🌾 ${c.temperature_2m > 35 ? 'Hot — ensure irrigation' : c.temperature_2m < 22 ? 'Cool — good for leafy crops' : 'Good farming conditions today'}</p>
      </div>
    `;
  } catch { el.innerHTML = '<p style="font-size:.8rem;color:rgba(255,255,255,.35)">Weather unavailable</p>'; }
}

// ── Staff Payroll Calculator ──────────────────────────────────
async function loadPayrollCalculator() {
  const content = document.getElementById('tab-payroll') || document.getElementById('tab-content');
  if (!content) return;
  // First load workers and their attendance
  let workers = [], attendance = [];
  try {
    const [wRes, aRes] = await Promise.all([
      api('GET', '/farm/workers'),
      api('GET', '/farm/attendance')
    ]);
    workers = Array.isArray(wRes) ? wRes : (wRes?.workers || []);
    attendance = Array.isArray(aRes) ? aRes : (aRes?.attendance || []);
  } catch {}
  // Group attendance by worker for current month
  const now = new Date();
  const monthStr = now.toISOString().slice(0,7); // YYYY-MM
  const workerDays = {};
  attendance.forEach(a => {
    if ((a.work_date||'').startsWith(monthStr)) {
      workerDays[a.worker_id] = (workerDays[a.worker_id]||0) + (Number(a.hours_worked)||8);
    }
  });
  content.innerHTML = `
    <div class="admin-section">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:8px">
        <h2>💰 Staff Payroll Calculator</h2>
        <button class="btn-outline btn-sm" onclick="loadPayrollCalculator()">🔄 Refresh</button>
      </div>
      <p style="color:rgba(255,255,255,.5);font-size:.85rem;margin-bottom:24px">
        Showing estimated payroll for ${now.toLocaleDateString('en-NG',{month:'long',year:'numeric'})} based on attendance records.
      </p>
      <div style="overflow-x:auto">
        <table class="admin-table">
          <thead><tr>
            <th>Worker</th><th>Role</th><th>Pay Type</th><th>Rate</th><th>Days/Hours Worked</th><th>Amount Due (₦)</th>
          </tr></thead>
          <tbody>
            ${workers.length === 0 ? '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:30px">No workers recorded yet. Go to Farm Ops → Workers to add staff.</td></tr>' : workers.map(w => {
              const hoursWorked = workerDays[w.id] || 0;
              const daysWorked = w.pay_type === 'daily' ? Math.round(hoursWorked / 8) : hoursWorked;
              const amount = w.pay_type === 'daily' ? daysWorked * (Number(w.pay_rate)||0) : hoursWorked * (Number(w.pay_rate)||0);
              return `<tr>
                <td><strong>${w.name}</strong></td>
                <td>${w.role || '-'}</td>
                <td>${w.pay_type || 'daily'}</td>
                <td>₦${Number(w.pay_rate || 0).toLocaleString()}</td>
                <td>${w.pay_type === 'daily' ? daysWorked + ' days' : hoursWorked + ' hrs'}</td>
                <td style="font-weight:700;color:#a3d9b8">₦${amount.toLocaleString()}</td>
              </tr>`;
            }).join('')}
          </tbody>
          <tfoot><tr>
            <td colspan="5" style="text-align:right;font-weight:700">Total Payroll:</td>
            <td style="font-weight:800;color:#fbbf24">₦${workers.reduce((sum,w) => {
              const h = workerDays[w.id]||0;
              const d = w.pay_type === 'daily' ? Math.round(h/8) : h;
              return sum + (w.pay_type==='daily' ? d*(Number(w.pay_rate)||0) : h*(Number(w.pay_rate)||0));
            }, 0).toLocaleString()}</td>
          </tr></tfoot>
        </table>
      </div>
      <p style="font-size:.78rem;color:rgba(255,255,255,.35);margin-top:16px">* Payroll is calculated from attendance records. Go to Farm Ops → Attendance to manage records.</p>
    </div>
  `;
}

// ── Harvest Calendar ──────────────────────────────────────────
async function loadHarvestCalendar() {
  const content = document.getElementById('tab-harvest-calendar') || document.getElementById('tab-calendar') || document.getElementById('tab-content');
  if (!content) return;
  let harvests = [];
  try {
    const res = await api('GET', '/farm/harvests');
    harvests = Array.isArray(res) ? res : (res?.harvests || []);
  } catch {}
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  // Group harvests by date
  const harvestByDate = {};
  harvests.forEach(h => {
    const d = (h.harvest_date||'').slice(0,10);
    if (!harvestByDate[d]) harvestByDate[d] = [];
    harvestByDate[d].push(h);
  });
  const monthName = now.toLocaleDateString('en-NG', {month:'long',year:'numeric'});
  let calHTML = `<div class="calendar-grid">`;
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => {
    calHTML += `<div class="cal-header">${d}</div>`;
  });
  for (let i = 0; i < firstDay; i++) calHTML += '<div></div>';
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const dayHarvests = harvestByDate[dateStr] || [];
    const isToday = day === now.getDate();
    calHTML += `<div class="cal-day${isToday?' today':''}${dayHarvests.length?' has-harvest':''}">
      <span class="cal-day-num">${day}</span>
      ${dayHarvests.map(h => `<div class="cal-harvest-dot" title="${h.crop_name||'Harvest'}: ${h.quantity}${h.unit}">🌾 ${h.crop_name||''}</div>`).join('')}
    </div>`;
  }
  calHTML += '</div>';
  content.innerHTML = `
    <div class="admin-section">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:8px">
        <h2>📅 Harvest Calendar — ${monthName}</h2>
        <div style="display:flex;gap:10px">
          <button class="btn-outline btn-sm" onclick="loadHarvestCalendar()">🔄 Refresh</button>
          <button class="btn-primary btn-sm" onclick="exportHarvestReportPDF()">📄 Export Today's Report</button>
        </div>
      </div>
      <p style="color:rgba(255,255,255,.4);font-size:.83rem;margin-bottom:24px">Days with 🌾 had recorded harvests. Log new harvests in Farm Ops → Harvests.</p>
      ${calHTML}
    </div>
  `;
}

// ── Daily Harvest Report (PDF / HTML Export) ───────────────────
function exportHarvestReportPDF() {
  // Get today's harvests from farm ops
  api('GET', '/farm/harvests').then(data => {
    const harvests = Array.isArray(data) ? data : (data?.harvests || []);
    const today = new Date().toISOString().slice(0,10);
    const todayHarvests = harvests.filter(h => (h.harvest_date||'').slice(0,10) === today);
    const content = `
      <html><head><title>Harvest Report ${today}</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; color: #1a1a1a; }
        h1 { color: #1b4332; font-size: 1.4rem; margin-bottom: 4px; }
        .meta { color: #666; font-size: .85rem; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #1b4332; color: white; padding: 10px 14px; text-align: left; font-size: .85rem; }
        td { padding: 10px 14px; border-bottom: 1px solid #eee; font-size: .85rem; }
        tr:nth-child(even) td { background: #f9f9f9; }
        .total { font-weight: 700; background: #f0faf4; }
        .footer { margin-top: 32px; font-size: .78rem; color: #999; text-align: center; }
      </style></head><body>
      <h1>🌾 Daily Harvest Report</h1>
      <div class="meta">Pinnacles Resource Centre Farm | Date: ${today}</div>
      ${todayHarvests.length === 0 
        ? '<p style="color:#999">No harvests recorded today.</p>'
        : `<table><thead><tr><th>Crop</th><th>Quantity</th><th>Unit</th><th>Quality</th><th>Field</th><th>Harvested By</th></tr></thead><tbody>
        ${todayHarvests.map(h => `<tr><td>${h.crop_name||'-'}</td><td>${h.quantity}</td><td>${h.unit}</td><td>${h.quality_grade||'A'}</td><td>${h.field_name||'-'}</td><td>${h.harvested_by||'-'}</td></tr>`).join('')}
        </tbody></table>`
      }
      <div class="footer">Generated ${new Date().toLocaleString('en-NG')} | Pinnacles Resource Centre Farm, Offa, Kwara State</div>
      </body></html>`;
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `harvest-report-${today}.html`;
    a.click();
    URL.revokeObjectURL(url);
    showAdminToast('📄 Harvest report downloaded!');
  }).catch(() => showAdminToast('Could not load harvest data', 'error'));
}

// ── Admin Toast Utility ───────────────────────────────────────
function showAdminToast(msg, type='success') {
  let c = document.getElementById('admin-toast-container');
  if (!c) {
    c = document.createElement('div');
    c.id = 'admin-toast-container';
    c.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:10px';
    document.body.appendChild(c);
  }
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = `background:${type==='error'?'#3b0f0f':'#1b4332'};color:${type==='error'?'#fca5a5':'#a3d9b8'};border:1px solid ${type==='error'?'rgba(248,113,113,.3)':'rgba(82,183,136,.3)'};padding:12px 20px;border-radius:12px;font-size:.88rem;font-weight:600;font-family:inherit;box-shadow:0 8px 24px rgba(0,0,0,.4);opacity:0;transform:translateY(-10px);transition:.3s`;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity='1'; t.style.transform='translateY(0)'; }, 10);
  setTimeout(() => { t.style.opacity='0'; setTimeout(() => t.remove(), 400); }, 3500);
}

// \u2500\u2500 Orders \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function loadOrders() {
  const status = document.getElementById('order-status-filter')?.value || '';
  const [orderData, paymentData] = await Promise.all([
    api('GET', `/orders${status ? '?status=' + status : ''}`),
    api('GET', '/payment/bank-receipts').catch(() => [])
  ]);
  const orders = orderData.orders || [];
  const payments = Array.isArray(paymentData) ? paymentData : [];
  // Map order_id -> transaction_id
  const paymentMap = {};
  payments.forEach(p => { if(p.order_id) paymentMap[p.order_id] = p.transaction_id; });

  document.getElementById('orders-list').innerHTML = orders.length
    ? orders.map(o => {
        const txnId = paymentMap[o.id];
        return `
        <div class="order-item">
          <div class="order-info">
            <div class="order-id">#${o.id} \u00B7 ${formatDate(o.created_at)}
              ${txnId ? `<span style="background:rgba(82,183,136,.15);border:1px solid rgba(82,183,136,.35);color:#52b788;font-size:.68rem;padding:2px 8px;border-radius:10px;margin-left:8px;font-family:monospace">&#x2705; TXN: ${txnId.slice(-8)}</span>` : ''}
            </div>
            <div class="order-name">${o.customer_name || 'Customer'}</div>
            <div class="order-meta">\u{1F4F1} ${o.customer_phone || 'No phone'}</div>
            <div class="order-meta" style="margin-top:4px">
              ${o.items.map(i => `${i.emoji||''} ${i.name} \u00D7${i.qty}`).join(' \u00B7 ')}
            </div>
            <div class="order-actions">
              <span class="status-badge status-${o.status}">${o.status}</span>
              <select class="select-input btn-sm" onchange="updateOrderStatus(${o.id}, this.value)" style="width:auto;padding:4px 10px;font-size:.78rem;">
                ${['pending','confirmed','processing','delivered','cancelled'].map(s =>
                  `<option value="${s}" ${o.status===s?'selected':''}>${s}</option>`).join('')}
              </select>
              <button class="btn-outline btn-sm" onclick="openOrderModal(${o.id})">View</button>
              <button class="btn-outline btn-sm" onclick="waOrderReply(${o.id})">\u{1F4AC} WhatsApp</button>
              <button class="btn-outline btn-sm" onclick="openReceiptModal(${o.id})">\u{1F4C4} Receipt</button>
              <button class="btn-outline btn-sm" onclick="openAttachReceiptModal(${o.id}, '${(o.customer_name||'').replace(/'/g,'')}', ${Number(o.total||0)})" style="border-color:rgba(82,183,136,.4);color:#52b788">&#x1F4F7; ${txnId ? 'Update Receipt' : 'Attach Receipt'}</button>
              <button class="btn-outline btn-sm btn-danger" onclick="deleteOrder(${o.id})">Delete</button>
            </div>
          </div>
          <div class="order-total">\u20A6${Number(o.total).toLocaleString()}</div>
        </div>`;
      }).join('')
    : '<div style="text-align:center;padding:60px;color:var(--text-muted)">No orders found</div>';
}

async function updateOrderStatus(id, status) {
  await api('PATCH', `/orders/${id}/status`, { status });
  showToast(`Order #${id} marked as ${status}`);
  loadOrders();
  loadOverview();
}

async function deleteOrder(id) {
  if (!confirm(`Delete order #${id}?`)) return;
  await api('DELETE', `/orders/${id}`);
  showToast('Order deleted');
  loadOrders();
  loadOverview();
}

let allOrders = [];
async function openOrderModal(id) {
  const data = await api('GET', '/orders');
  const order = (data.orders || []).find(o => o.id === id);
  if (!order) return;
  document.getElementById('order-modal-content').innerHTML = `
    <div style="margin-bottom:16px">
      <div style="font-size:.8rem;color:var(--text-muted);margin-bottom:4px">#${order.id} \u00B7 ${formatDate(order.created_at)}</div>
      <div style="font-weight:700;font-size:1.1rem">${order.customer_name || 'Customer'}</div>
      <div style="color:var(--text-muted);font-size:.88rem">\u{1F4F1} ${order.customer_phone || 'No phone provided'}</div>
    </div>
    <div style="margin-bottom:16px">
      ${order.items.map(i => `
        <div class="order-detail-item">
          <span>${i.emoji||'\u{1F33F}'} ${i.name} \u00D7${i.qty}</span>
          <span>\u20A6${Number(i.price * i.qty).toLocaleString()}</span>
        </div>`).join('')}
      <div class="order-detail-total"><span>Total</span><span>\u20A6${Number(order.total).toLocaleString()}</span></div>
    </div>
    ${order.notes ? `<div class="msg-text" style="margin-bottom:16px">\u{1F4DD} ${order.notes}</div>` : ''}
    <span class="status-badge status-${order.status}" style="margin-bottom:16px;display:inline-block">${order.status}</span>

    ${order.whatsapp_msg ? `
    <div style="margin-bottom:16px">
      <button id="wa-toggle-${order.id}"
        onclick="toggleWaMsg('${order.id}')"
        style="background:rgba(37,211,102,.12);border:1px solid rgba(37,211,102,.35);color:#25D366;padding:9px 16px;border-radius:50px;font-size:.82rem;font-weight:700;cursor:pointer;width:100%;text-align:left;">
        \u{1F4F2} Show WhatsApp Message Sent
      </button>
      <div id="wa-box-${order.id}" style="display:none;margin-top:10px;background:rgba(37,211,102,.07);border:1px solid rgba(37,211,102,.2);border-radius:12px;padding:14px 16px;">
        <div style="font-size:.72rem;font-weight:700;color:#25D366;letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px;">Message sent to WhatsApp</div>
        <pre id="wa-pre-${order.id}" style="font-family:'Outfit',sans-serif;font-size:.83rem;color:var(--text-light);white-space:pre-wrap;word-break:break-word;margin:0;line-height:1.6"></pre>
        <button onclick="navigator.clipboard.writeText(document.getElementById('wa-pre-${order.id}').textContent).then(()=>showToast('Copied to clipboard!'))"
          style="margin-top:10px;background:none;border:1px solid rgba(37,211,102,.4);color:#25D366;padding:6px 14px;border-radius:50px;font-size:.78rem;font-weight:600;cursor:pointer;">\u{1F4CB} Copy Message</button>
      </div>
    </div>` : ''}

    ${order.customer_phone ? `<a href="https://wa.me/${order.customer_phone.replace(/\D/g,'')}?text=${encodeURIComponent('Hello '+order.customer_name+'! Your Pinnacles Farm order #'+order.id+' has been received. We will confirm shortly. \u{1F33F}')}" target="_blank" class="btn-primary wa-order-btn">\u{1F4AC} Message Customer on WhatsApp</a>` : ''}
  `;
  // Safely inject whatsapp_msg as text (avoids XSS)
  if (order.whatsapp_msg) {
    const pre = document.getElementById(`wa-pre-${order.id}`);
    if (pre) pre.textContent = order.whatsapp_msg;
  }
  document.getElementById('order-modal-overlay').classList.add('open');
  document.getElementById('order-modal').classList.add('open');
}

function closeOrderModal() {
  document.getElementById('order-modal-overlay').classList.remove('open');
  document.getElementById('order-modal').classList.remove('open');
}

function waOrderReply(id) { openOrderModal(id); }

// \u2500\u2500 Products \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
let editingProductId = null;

async function loadProducts() {
  const products = await api('GET', '/products/all');
  document.getElementById('products-admin-grid').innerHTML = (Array.isArray(products) ? products : []).map(p => {
    const inStock = p.in_stock !== 0;
    const stockColor  = inStock ? 'rgba(82,183,136,.18)' : 'rgba(231,111,81,.15)';
    const stockText   = inStock ? 'rgba(82,183,136,1)'   : '#e76f51';
    const stockBorder = inStock ? 'rgba(82,183,136,.35)'  : 'rgba(231,111,81,.35)';
    const stockLabel  = inStock ? '\u2705 In Stock'           : '\u274C Out of Stock';
    const toggleLabel = inStock ? '\u274C Mark Out of Stock'  : '\u2705 Mark In Stock';
    const imgHtml = p.img
      ? '<img src="' + imgSrc(p.img) + '" alt="' + p.name + '" style="width:100%;height:100%;object-fit:cover;border-radius:12px" />'
      : '<div style="font-size:2.5rem;line-height:1">' + (p.emoji || '\u{1F33F}') + '</div>';
    return '<div class="admin-product-card ' + (p.active ? '' : 'inactive') + '">' +
      '<div class="apc-img">' + imgHtml + '</div>' +
      '<div class="apc-body">' +
        '<div class="apc-name">' + p.name + '</div>' +
        '<div class="apc-price">\u20A6' + Number(p.price).toLocaleString() + ' <small style="color:var(--text-muted);font-weight:400">' + p.unit + '</small></div>' +
        '<div class="apc-meta" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;">' +
          '<span style="background:' + stockColor + ';color:' + stockText + ';border:1px solid ' + stockBorder + ';border-radius:50px;padding:2px 10px;font-size:.72rem;font-weight:700;">' + stockLabel + '</span>' +
          '<span style="color:var(--text-muted);font-size:.75rem;">' + p.category + ' \u00B7 ' + p.tag + ' \u00B7 Qty: ' + p.stock + '</span>' +
        '</div>' +
        '<div class="apc-actions">' +
          '<button class="btn-outline btn-sm" onclick="toggleProductStock(' + p.id + ',' + (inStock ? 0 : 1) + ')">' + toggleLabel + '</button>' +
          '<button class="btn-outline btn-sm" onclick="editProduct(' + p.id + ')">\u270F\uFE0F Edit</button>' +
          '<button class="btn-outline btn-sm btn-danger" onclick="deleteProduct(' + p.id + ')">Delete</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

async function toggleProductStock(id, newVal) {
  await api('PATCH', '/products/' + id + '/stock', { in_stock: newVal });
  showToast(newVal ? '\u2705 Marked In Stock' : '\u274C Marked Out of Stock');
  loadProducts();
}

function previewImage(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('img-preview').src = e.target.result;
    document.getElementById('img-preview-wrap').style.display = 'block';
    document.getElementById('img-placeholder').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function clearImage() {
  document.getElementById('prod-img-file').value = '';
  document.getElementById('img-preview').src = '';
  document.getElementById('img-preview-wrap').style.display = 'none';
  document.getElementById('img-placeholder').style.display = 'block';
  document.getElementById('prod-existing-img').value = '';
}

function openProductModal(product = null) {
  editingProductId = product ? product.id : null;
  document.getElementById('prod-modal-title').textContent = product ? 'Edit Product' : 'Add Product';
  document.getElementById('prod-id').value = product?.id || '';
  document.getElementById('prod-name').value = product?.name || '';
  document.getElementById('prod-emoji').value = product?.emoji || '\u{1F33F}';
  document.getElementById('prod-price').value = product?.price || '';
  document.getElementById('prod-unit').value = product?.unit || 'per unit';
  document.getElementById('prod-category').value = product?.category || 'vegetables';
  document.getElementById('prod-tag').value = product?.tag || 'Fresh';
  document.getElementById('prod-desc').value = product?.description || '';
  document.getElementById('prod-stock').value = product?.stock || 999;
  document.getElementById('prod-in-stock').checked = product ? (product.in_stock !== 0) : true;
  document.getElementById('prod-active').checked = product ? Boolean(product.active) : true;

  // Handle image preview for edit
  const existingImg = product?.img || '';
  document.getElementById('prod-existing-img').value = existingImg;
  // Reset file input
  document.getElementById('prod-img-file').value = '';
  if (existingImg) {
    document.getElementById('img-preview').src = imgSrc(existingImg);
    document.getElementById('img-preview-wrap').style.display = 'block';
    document.getElementById('img-placeholder').style.display = 'none';
  } else {
    document.getElementById('img-preview-wrap').style.display = 'none';
    document.getElementById('img-placeholder').style.display = 'block';
  }

  document.getElementById('prod-modal-overlay').classList.add('open');
  document.getElementById('prod-modal').classList.add('open');
}

async function editProduct(id) {
  const products = await api('GET', '/products/all');
  const p = (Array.isArray(products) ? products : []).find(x => x.id === id);
  if (p) openProductModal(p);
}

function closeProductModal() {
  document.getElementById('prod-modal-overlay').classList.remove('open');
  document.getElementById('prod-modal').classList.remove('open');
}

async function saveProduct(e) {
  e.preventDefault();
  const btn = document.getElementById('prod-save-btn');
  btn.disabled = true;
  btn.textContent = 'Saving\u2026';

  try {
    // Build FormData so multer can receive the image file
    const fd = new FormData();
    fd.append('name',        document.getElementById('prod-name').value);
    fd.append('emoji',       document.getElementById('prod-emoji').value);
    fd.append('price',       document.getElementById('prod-price').value);
    fd.append('unit',        document.getElementById('prod-unit').value);
    fd.append('category',    document.getElementById('prod-category').value);
    fd.append('tag',         document.getElementById('prod-tag').value);
    fd.append('description', document.getElementById('prod-desc').value);
    fd.append('stock',       document.getElementById('prod-stock').value);
    fd.append('active',      document.getElementById('prod-active').checked ? '1' : '0');
    fd.append('in_stock',    document.getElementById('prod-in-stock').checked ? '1' : '0');

    const fileInput = document.getElementById('prod-img-file');
    if (fileInput.files[0]) {
      fd.append('image', fileInput.files[0]);
    } else {
      // Pass existing image URL so backend keeps it
      const existingImg = document.getElementById('prod-existing-img').value;
      if (existingImg) fd.append('img', existingImg);
    }

    const headers = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    let res;
    if (editingProductId) {
      res = await fetch(`${API}/products/${editingProductId}`, { method: 'PUT', headers, body: fd });
    } else {
      res = await fetch(`${API}/products`, { method: 'POST', headers, body: fd });
    }

    if (res.status === 401 || res.status === 403) { logout(); return; }
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    showToast(editingProductId ? 'Product updated!' : 'Product added!');
    closeProductModal();
    loadProducts();
  } catch (err) {
    showToast('\u274C Error: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Product';
  }
}

async function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  await api('DELETE', `/products/${id}`);
  showToast('Product deleted');
  loadProducts();
}

// \u2500\u2500 Messages \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function loadMessages() {
  const data = await api('GET', '/messages');
  const messages = data.messages || [];
  document.getElementById('messages-list').innerHTML = messages.length
    ? messages.map(m => `
        <div class="message-item ${m.is_read ? '' : 'msg-unread'}">
          <div style="flex:1">
            <div class="msg-name">${m.name} ${m.is_read ? '' : '<span style="background:var(--green-light);color:#fff;font-size:.65rem;padding:2px 8px;border-radius:50px;margin-left:6px">NEW</span>'}</div>
            <div class="msg-meta">\u{1F4F1} ${m.phone || 'No phone'} \u00B7 ${formatDate(m.created_at)}</div>
            <div class="msg-text">${m.message}</div>
            <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
              ${!m.is_read ? `<button class="btn-outline btn-sm" onclick="markMsgRead(${m.id})">\u2705 Mark Read</button>` : ''}
              ${m.phone ? `<a href="https://wa.me/${m.phone.replace(/\D/g,'')}?text=${encodeURIComponent('Hello '+m.name+'! Thank you for contacting Pinnacles Resource Centre Farm. \u{1F33F}')}" target="_blank" class="btn-outline btn-sm">\u{1F4AC} Reply via WhatsApp</a>` : ''}
              <button class="btn-outline btn-sm btn-danger" onclick="deleteMsg(${m.id})">Delete</button>
            </div>
          </div>
        </div>`).join('')
    : '<div style="text-align:center;padding:60px;color:var(--text-muted)">No messages yet</div>';
  document.getElementById('msg-badge').textContent = data.unread || 0;
}

async function markMsgRead(id) {
  await api('PATCH', `/messages/${id}/read`);
  loadMessages();
  loadOverview();
}

async function deleteMsg(id) {
  if (!confirm('Delete this message?')) return;
  await api('DELETE', `/messages/${id}`);
  showToast('Message deleted');
  loadMessages();
}

// \u2500\u2500 Settings \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function changePassword(e) {
  e.preventDefault();
  const msgEl = document.getElementById('cp-msg');
  const res = await api('POST', '/auth/change-password', {
    currentPassword: document.getElementById('cp-current').value,
    newPassword: document.getElementById('cp-new').value
  });
  msgEl.textContent = res.message || res.error;
  msgEl.style.display = 'block';
  msgEl.style.background = res.error ? 'rgba(231,111,81,.15)' : 'rgba(82,183,136,.15)';
  msgEl.style.color = res.error ? 'var(--red)' : 'var(--green-light)';
  if (!res.error) { document.getElementById('cp-current').value = ''; document.getElementById('cp-new').value = ''; }
}

function generateAdvert() {
  const text = `\u{1F33F} *PINNACLES RESOURCE CENTRE FARM* \u{1F33F}

\u2705 Fresh Farm Produce Available NOW!

\u{1F345} Tomatoes
\u{1FAD1} Peppers
\u{1F353} Strawberries
\u{1F33D} Maize
\u{1F955} Carrots
\u{1F95A} Farm Fresh Eggs
\u{1FADB} Green Peas
\u{1F96C} And Much More!

\u{1F4AF} 100% Organically Grown
\u{1F69A} Fast Delivery Available
\u{1F4B0} Fair & Affordable Prices

\u{1F4F2} Order via WhatsApp: +234 903 750 5632
\u{1F4E7} agribusiness@pinnaclescentre.com

#PinnaclesFarm #FreshProduce #FarmToTable`;
  const box = document.getElementById('advert-output');
  box.textContent = text;
  box.style.display = 'block';
  // Copy to clipboard
  navigator.clipboard.writeText(text).then(() => showToast('Advert copied to clipboard!'));
}

// \u2500\u2500 Helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function formatDate(dt) {
  if (!dt) return '';
  return new Date(dt).toLocaleString('en-GB', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function showToast(msg) {
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:32px;right:32px;background:var(--green);color:#fff;padding:12px 24px;border-radius:50px;font-weight:600;font-size:.9rem;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.3)';
  t.textContent = '\u2705 ' + msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

function toggleWaMsg(orderId) {
  const box = document.getElementById('wa-box-' + orderId);
  const btn = document.getElementById('wa-toggle-' + orderId);
  if (!box) return;
  const isOpen = box.style.display === 'block';
  box.style.display = isOpen ? 'none' : 'block';
  btn.textContent = isOpen ? '\u{1F4F2} Show WhatsApp Message Sent' : '\u{1F4F2} Hide WhatsApp Message';
}

// \u2500\u2500 Gallery \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
let editingGalleryId = null;

async function loadGallery() {
  const items = await api('GET', '/gallery');
  const grid = document.getElementById('gallery-admin-grid');
  if (!Array.isArray(items) || items.length === 0) {
    grid.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-muted)">No gallery photos yet. Click "+ Add Photo" to add your first image.</div>';
    return;
  }
  grid.innerHTML = items.map((item, idx) => `
    <div class="gallery-admin-card" data-id="${item.id}">
      <div class="gac-img">
        <img src="${imgSrc(item.img)}" alt="${item.alt || 'Farm photo'}"
             style="width:100%;height:100%;object-fit:cover;border-radius:12px;"
             onerror="this.outerHTML='<div style=\'font-size:3rem;display:flex;align-items:center;justify-content:center;height:100%\'>\u{1F5BC}\uFE0F</div>'" />
        ${item.wide ? '<span class="gac-wide-badge">WIDE</span>' : ''}
      </div>
      <div class="gac-body">
        <div class="gac-alt">${item.alt || '<em style="color:var(--text-muted)">No alt text</em>'}</div>
        ${item.caption ? `<div class="gac-caption">"${item.caption}"</div>` : ''}
        <div class="gac-order">Order: #${item.sort_order ?? idx}</div>
        <div class="gac-actions">
          <button class="btn-outline btn-sm" onclick="editGalleryItem(${item.id})">\u270F\uFE0F Edit</button>
          <button class="btn-outline btn-sm" onclick="moveGalleryItem(${item.id}, ${(item.sort_order ?? idx) - 1})" ${idx === 0 ? 'disabled' : ''}>\u2191</button>
          <button class="btn-outline btn-sm" onclick="moveGalleryItem(${item.id}, ${(item.sort_order ?? idx) + 1})" ${idx === items.length - 1 ? 'disabled' : ''}>\u2193</button>
          <button class="btn-outline btn-sm btn-danger" onclick="deleteGalleryItem(${item.id})">\u{1F5D1}\uFE0F Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

function openGalleryModal(item = null) {
  editingGalleryId = item ? item.id : null;
  document.getElementById('gallery-modal-title').textContent = item ? 'Edit Gallery Photo' : 'Add Gallery Photo';
  document.getElementById('gallery-item-id').value = item?.id || '';
  document.getElementById('gal-alt').value     = item?.alt || '';
  document.getElementById('gal-caption').value = item?.caption || '';
  document.getElementById('gal-wide').checked  = item ? Boolean(Number(item.wide)) : false;

  // Reset file input & preview
  document.getElementById('gal-img-file').value = '';
  if (item?.img) {
    document.getElementById('gal-preview').src = imgSrc(item.img);
    document.getElementById('gal-preview-wrap').style.display = 'block';
    document.getElementById('gal-placeholder').style.display  = 'none';
  } else {
    document.getElementById('gal-preview-wrap').style.display = 'none';
    document.getElementById('gal-placeholder').style.display  = 'block';
  }

  document.getElementById('gallery-modal-overlay').classList.add('open');
  document.getElementById('gallery-modal').classList.add('open');
}

function closeGalleryModal() {
  document.getElementById('gallery-modal-overlay').classList.remove('open');
  document.getElementById('gallery-modal').classList.remove('open');
}

function previewGalleryImage(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('gal-preview').src = e.target.result;
    document.getElementById('gal-preview-wrap').style.display = 'block';
    document.getElementById('gal-placeholder').style.display  = 'none';
  };
  reader.readAsDataURL(file);
}

function clearGalleryImage() {
  document.getElementById('gal-img-file').value  = '';
  document.getElementById('gal-preview').src      = '';
  document.getElementById('gal-preview-wrap').style.display = 'none';
  document.getElementById('gal-placeholder').style.display  = 'block';
}

async function saveGalleryItem(e) {
  e.preventDefault();
  const btn = document.getElementById('gal-save-btn');
  btn.disabled = true;
  btn.textContent = 'Saving\u2026';

  try {
    const fileInput = document.getElementById('gal-img-file');
    const isNew = !editingGalleryId;

    if (isNew && !fileInput.files[0]) {
      showToast('\u274C Please select a photo to upload.');
      return;
    }

    const fd = new FormData();
    fd.append('alt',     document.getElementById('gal-alt').value);
    fd.append('caption', document.getElementById('gal-caption').value);
    fd.append('wide',    document.getElementById('gal-wide').checked ? '1' : '0');
    if (fileInput.files[0]) fd.append('image', fileInput.files[0]);

    const headers = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    let res;
    if (editingGalleryId) {
      res = await fetch(`${API}/gallery/${editingGalleryId}`, { method: 'PUT', headers, body: fd });
    } else {
      res = await fetch(`${API}/gallery`, { method: 'POST', headers, body: fd });
    }

    if (res.status === 401 || res.status === 403) { logout(); return; }
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    showToast(editingGalleryId ? 'Photo updated! \u{1F5BC}\uFE0F' : 'Photo added to gallery! \u{1F331}');
    closeGalleryModal();
    loadGallery();
  } catch (err) {
    showToast('\u274C Error: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Photo';
  }
}

async function editGalleryItem(id) {
  const items = await api('GET', '/gallery');
  const item = (Array.isArray(items) ? items : []).find(x => x.id === id);
  if (item) openGalleryModal(item);
}

async function moveGalleryItem(id, newOrder) {
  await api('PATCH', `/gallery/${id}/order`, { sort_order: newOrder });
  loadGallery();
}

async function deleteGalleryItem(id) {
  if (!confirm('Delete this gallery photo? This cannot be undone.')) return;
  await api('DELETE', `/gallery/${id}`);
  showToast('Photo removed from gallery');
  loadGallery();
}

// \u2500\u2500 Receipt Modal \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
let currentReceiptOrderId = null;
let currentReceiptUrl     = null;
let currentReceiptOrder   = null;

async function openReceiptModal(orderId) {
  currentReceiptOrderId = orderId;
  currentReceiptUrl     = null;
  currentReceiptOrder   = null;

  document.getElementById('receipt-download-btn').href = '#';
  document.getElementById('receipt-email-input').value = '';
  document.getElementById('receipt-email-msg').style.display = 'none';
  document.getElementById('receipt-order-summary').innerHTML = '<div style="color:var(--text-muted);font-size:.85rem;">Loading\u2026</div>';

  document.getElementById('receipt-modal-overlay').classList.add('open');
  document.getElementById('receipt-modal').classList.add('open');

  try {
    const data = await api('GET', '/orders');
    const order = (data.orders || []).find(o => o.id === orderId);
    if (order) {
      currentReceiptOrder = order;
      const itemsHtml = order.items.map(i =>
        '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);">' +
        '<span>' + (i.emoji || '\u{1F33F}') + ' ' + i.name + ' \u00D7' + i.qty + '</span>' +
        '<span style="font-weight:700;">\u20A6' + Number(i.price * i.qty).toLocaleString() + '</span></div>'
      ).join('');
      document.getElementById('receipt-order-summary').innerHTML =
        '<div style="font-weight:700;margin-bottom:10px;color:var(--text-light);">Order #' + order.id + ' \u2014 ' + (order.customer_name || 'Customer') + '</div>' +
        '<div style="color:var(--text-muted);font-size:.8rem;margin-bottom:10px;">\u{1F4F1} ' + (order.customer_phone || 'No phone') + '</div>' +
        itemsHtml +
        '<div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:800;color:var(--green-light);">' +
        '<span>Total</span><span>\u20A6' + Number(order.total).toLocaleString() + '</span></div>';
      if (order.customer_email) {
        document.getElementById('receipt-email-input').value = order.customer_email;
      }
    }
    const tokenData = await api('GET', '/orders/' + orderId + '/receipt-token');
    if (tokenData.receiptUrl) {
      currentReceiptUrl = tokenData.receiptUrl;
      document.getElementById('receipt-download-btn').href = tokenData.receiptUrl + '/pdf';
    }
  } catch (err) {
    document.getElementById('receipt-order-summary').innerHTML = '<div style="color:var(--red);">Error: ' + err.message + '</div>';
  }
}

function closeReceiptModal() {
  document.getElementById('receipt-modal-overlay').classList.remove('open');
  document.getElementById('receipt-modal').classList.remove('open');
}

async function sendReceiptWhatsApp() {
  if (!currentReceiptOrder) return;
  const o = currentReceiptOrder;
  const pdfLink = currentReceiptUrl ? currentReceiptUrl + '/pdf' : null;
  

  // Attempt Web Share API to send the PDF file natively
  
  if (pdfLink && navigator.canShare) {
    try {
      const btn = document.getElementById('receipt-wa-btn');
      const origText = btn.innerHTML;
      btn.innerHTML = '⏳ Preparing PDF...';
      
      const res = await fetch(pdfLink);
      const blob = await res.blob();
      const file = new File([blob], "Receipt_" + String(o.id).padStart(4, '0') + ".pdf", { type: 'application/pdf' });
      
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "Pinnacles Farm Receipt #" + o.id,
          text: "Hello " + (o.customer_name || 'Customer') + ", here is your order receipt from Pinnacles Farm.",
          files: [file]
        });
        btn.innerHTML = origText;
        return; // Native share succeeded!
      }
      btn.innerHTML = origText;
    } catch (err) {
      console.warn("Share API failed or user cancelled:", err);
      document.getElementById('receipt-wa-btn').innerHTML = '📱 Send PDF Receipt via WhatsApp';
      // If it fails or is cancelled, we fall back to the URL-based text share below
    }
  }

  // Format date like "18 September 2026"
  const dateStr = new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const receiptNo = String(o.id).padStart(4, '0');

  // Build items rows \u2014 padded to look tabular
  const itemLines = o.items.map(i => {
    const name = (i.emoji || '\u{1F33F}') + ' ' + i.name;
    const qty  = '\u00D7' + i.qty;
    const amt  = '\u20A6' + Number(i.price * i.qty).toLocaleString('en-NG');
    return name + '   ' + qty + '   *' + amt + '*';
  }).join('\n');

  const statusMap = { pending: '\u23F3 Pending', confirmed: '\u2705 Confirmed', processing: '\u{1F504} Processing', delivered: '\u{1F69A} Delivered', cancelled: '\u274C Cancelled' };
  const statusStr = statusMap[o.status] || o.status;
  const payMethod = (o.whatsapp_msg || '').startsWith('payisland_ref:') ? '\u{1F4B3} Online Payment' : '\u{1F4AC} WhatsApp Order';

  
  const linkLine = pdfLink ? '\n\u{1F4C4} *Download PDF Receipt:*\n' + pdfLink : '';

  const SEP  = '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501';
  const LINE = '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500';

  const msg =
    '\u{1F33F} *PINNACLES RESOURCE CENTRE FARM*\n' +
    '_FRESH \u00B7 ORGANIC \u00B7 FARM TO TABLE_\n\n' +
    SEP + '\n' +
    '       *OFFICIAL RECEIPT*\n' +
    'Receipt #' + receiptNo + '  |  ' + dateStr + '\n' +
    SEP + '\n\n' +
    '*BILLED TO*\n' +
    (o.customer_name || 'Customer') + '\n' +
    '\u{1F4F1} ' + (o.customer_phone || '\u2014') + '\n\n' +
    '*ORDER DETAILS*\n' +
    'Order #' + o.id + '\n' +
    'Date: ' + dateStr + '\n\n' +
    LINE + '\n' +
    '*ITEMS PURCHASED*\n' +
    LINE + '\n' +
    itemLines + '\n' +
    LINE + '\n' +
    '*TOTAL          \u20A6' + Number(o.total).toLocaleString('en-NG') + '*\n' +
    LINE + '\n\n' +
    'Status:  ' + statusStr + '\n' +
    'Payment: ' + payMethod + '\n\n' +
    SEP + '\n' +
    'Thank you for shopping with us! \u{1F331}\n' +
    '\u{1F4E7} agribusiness@pinnaclescentre.com\n' +
    '\u{1F4F2} +234 903 750 5632' +
    linkLine;

  const phone = (o.customer_phone || '').replace(/\D/g, '');
  const url = phone
    ? 'https://wa.me/' + phone + '?text=' + encodeURIComponent(msg)
    : 'https://wa.me/?text=' + encodeURIComponent(msg);
  window.open(url, '_blank');
}
function copyReceiptLink() {
  if (!currentReceiptUrl) { showToast('Receipt link not ready yet.'); return; }
  navigator.clipboard.writeText(currentReceiptUrl).then(() => showToast('\u{1F517} Receipt link copied!'));
}



// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// WALK-IN / FARM ORDER
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function openWalkinModal() {
  document.getElementById('wi-name').value    = '';
  document.getElementById('wi-phone').value   = '';
  document.getElementById('wi-code').value    = '+234';
  document.getElementById('wi-payment').value = 'cash';
  document.getElementById('wi-notes').value   = '';
  document.getElementById('wi-items-list').innerHTML = '';
  document.getElementById('wi-total-display').textContent = '0';
  addWalkinItem();
  document.getElementById('walkin-modal').style.display = 'flex';
}
function closeWalkinModal() {
  document.getElementById('walkin-modal').style.display = 'none';
}
function addWalkinItem() {
  const list = document.getElementById('wi-items-list');
  const div  = document.createElement('div');
  div.style.cssText = 'display:flex;gap:6px;margin-bottom:8px;align-items:center';
  div.innerHTML =
    '<input type="text"   placeholder="Item name"  class="form-input wi-item-name"  style="flex:2;min-width:0"  oninput="recalcWalkinTotal()">' +
    '<input type="number" placeholder="Qty"        class="form-input wi-item-qty"   style="width:58px;flex-shrink:0" oninput="recalcWalkinTotal()" min="1" value="1">' +
    '<input type="number" placeholder="Price/unit" class="form-input wi-item-price" style="width:90px;flex-shrink:0" oninput="recalcWalkinTotal()" min="0">' +
    '<span class="wi-subtotal" style="width:80px;flex-shrink:0;text-align:right;font-weight:700;font-size:.8rem;color:#52b788;white-space:nowrap">NGN 0</span>' +
    '<button type="button" style="background:#ef4444;color:#fff;border:none;border-radius:6px;padding:6px 10px;cursor:pointer;flex-shrink:0" ' +
    'onclick="this.parentElement.remove();recalcWalkinTotal()">\u00D7</button>';
  list.appendChild(div);
}
function recalcWalkinTotal() {
  let total = 0;
  document.querySelectorAll('#wi-items-list > div').forEach(row => {
    const qty      = parseFloat(row.querySelector('.wi-item-qty').value)   || 0;
    const price    = parseFloat(row.querySelector('.wi-item-price').value) || 0;
    const subtotal = qty * price;
    total += subtotal;
    // Update the per-row subtotal label
    const subtotalEl = row.querySelector('.wi-subtotal');
    if (subtotalEl) {
      subtotalEl.textContent = subtotal > 0
        ? 'NGN ' + subtotal.toLocaleString('en-NG')
        : 'NGN 0';
    }
  });
  document.getElementById('wi-total-display').textContent = total.toLocaleString('en-NG');
}
async function saveWalkinOrder() {
  const name     = document.getElementById('wi-name').value.trim()  || 'Walk-in Customer';
  const code     = document.getElementById('wi-code').value;
  const rawPhone = document.getElementById('wi-phone').value.trim().replace(/^0+/, '');
  const phone    = rawPhone ? code + rawPhone : '';
  const payment  = document.getElementById('wi-payment').value;
  const notes    = document.getElementById('wi-notes').value.trim();
  const items = [];
  let total = 0;
  document.querySelectorAll('#wi-items-list > div').forEach(row => {
    const nm  = row.querySelector('.wi-item-name').value.trim();
    const qty = parseFloat(row.querySelector('.wi-item-qty').value)   || 0;
    const pr  = parseFloat(row.querySelector('.wi-item-price').value) || 0;
    if (nm && qty > 0 && pr >= 0) { items.push({ name: nm, qty, price: pr }); total += qty * pr; }
  });
  if (items.length === 0) { showToast('Add at least one item'); return; }
  if (total <= 0)          { showToast('Total must be greater than zero'); return; }
  try {
    const token = localStorage.getItem('pinnacles_admin_token');
    const resp  = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ customer_name: name, customer_phone: phone, items, total, notes, whatsapp_msg: 'walkin:' + payment }),
    });
    if (!resp.ok) throw new Error((await resp.json()).error || 'Failed');
    showToast('Walk-in order saved! Click the Receipt button to generate PDF.');
    closeWalkinModal();
    loadOrders();
  } catch (e) { showToast('Error: ' + e.message); }
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// MONTHLY SALES REPORT
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function openReportModal() {
  const now = new Date();
  document.getElementById('report-month').value = now.getMonth() + 1;
  document.getElementById('report-year').value  = now.getFullYear();
  document.getElementById('report-modal').style.display = 'flex';
}
function closeReportModal() {
  document.getElementById('report-modal').style.display = 'none';
}
async function downloadReport() {
  const month = document.getElementById('report-month').value;
  const year  = document.getElementById('report-year').value;
  const token = localStorage.getItem('pinnacles_admin_token');
  showToast('Generating report...');
  try {
    const resp = await fetch('/api/orders/report?month=' + month + '&year=' + year, {
      headers: { 'Authorization': 'Bearer ' + token },
    });
    if (!resp.ok) throw new Error('Server returned ' + resp.status);
    const blob = await resp.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = 'Pinnacles-Sales-' + year + '-' + String(month).padStart(2,'0') + '.xlsx';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Report downloaded!');
    closeReportModal();
  } catch (e) { showToast('Error: ' + e.message); }
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// AUTO-REFRESH: poll for new orders every 30 seconds
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function startOrderPolling() {
  stopOrderPolling();
  _initLastOrderId();
  _pollTimer = setInterval(_pollNewOrders, 30000);
  console.log('[Admin] Polling started');
}
function stopOrderPolling() {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
}
async function _initLastOrderId() {
  try {
    const data = await api('GET', '/orders?status=pending');
    const list  = Array.isArray(data) ? data : (data.orders || []);
    if (list.length > 0)
      _lastOrderId = Math.max.apply(null, list.map(function(o){ return Number(o.id)||0; }));
  } catch(_){}
}
async function _pollNewOrders() {
  if (_pollRunning || !authToken) return;
  _pollRunning = true;
  try {
    const data = await api('GET', '/orders?status=pending');
    const list  = Array.isArray(data) ? data : (data.orders || []);
    if (!list.length) { _pollRunning = false; return; }
    const maxId = Math.max.apply(null, list.map(function(o){ return Number(o.id)||0; }));
    if (_lastOrderId > 0 && maxId > _lastOrderId) {
      const newCount = list.filter(function(o){ return Number(o.id) > _lastOrderId; }).length;
      _lastOrderId = maxId;
      loadOrders();
      _updatePendingBadge(list.length);
      _showNewOrderBanner(newCount);
      _playNotifSound();
    } else if (_lastOrderId === 0) {
      _lastOrderId = maxId;
    }
  } catch(e) { console.warn('[Poll]', e.message); }
  _pollRunning = false;
}
function _showNewOrderBanner(count) {
  var old = document.getElementById('new-order-banner');
  if (old) old.remove();
  if (!document.getElementById('poll-anim')) {
    var s = document.createElement('style');
    s.id = 'poll-anim';
    s.textContent = '@keyframes sldDn{from{opacity:0;transform:translateX(-50%) translateY(-20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';
    document.head.appendChild(s);
  }
  var b = document.createElement('div');
  b.id = 'new-order-banner';
  b.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);' +
    'background:#1b4332;color:#fff;padding:14px 28px;border-radius:50px;' +
    'font-weight:700;font-size:.95rem;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.3);' +
    'display:flex;align-items:center;gap:10px;animation:sldDn .3s ease;white-space:nowrap;';
  b.innerHTML = '<span style="font-size:1.2rem">\u{1F6D2}</span>' +
    count + ' new order' + (count > 1 ? 's' : '') + ' received!' +
    '<button onclick="showTab(\'orders\',null);this.parentElement.remove()" ' +
    'style="background:#52b788;border:none;color:#fff;padding:5px 14px;' +
    'border-radius:20px;cursor:pointer;font-weight:700;margin-left:6px">View Orders</button>' +
    '<button onclick="this.parentElement.remove()" ' +
    'style="background:transparent;border:none;color:rgba(255,255,255,.7);' +
    'cursor:pointer;font-size:1.2rem;line-height:1;padding:0 2px">&times;</button>';
  document.body.appendChild(b);
  setTimeout(function(){ if (b.parentNode) b.remove(); }, 8000);
}
function _playNotifSound() {
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    var g = ctx.createGain(); g.connect(ctx.destination);
    [880, 1100].forEach(function(freq, i) {
      var o = ctx.createOscillator(); o.connect(g);
      o.frequency.value = freq; o.type = 'sine';
      g.gain.setValueAtTime(0, ctx.currentTime + i*0.15);
      g.gain.linearRampToValueAtTime(0.25, ctx.currentTime + i*0.15 + 0.04);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + i*0.15 + 0.25);
      o.start(ctx.currentTime + i*0.15);
      o.stop(ctx.currentTime + i*0.15 + 0.3);
    });
  } catch(_){}
}
function _updatePendingBadge(count) {
  var badge = document.getElementById('pending-badge');
  if (badge) badge.textContent = count;
}

// -------------------------------------------------------------
// TODAY'S HARVEST ADMIN
// -------------------------------------------------------------
async function loadHarvestAdmin() {
  try {
    const data = await api('GET', '/products');
    const products = data.products || data || [];
    const container = document.getElementById('harvest-admin-list');
    if (!container) return;
    const today = await fetch('/api/harvest/today').then(r => r.json()).catch(() => ({ items: [] }));
    const todayIds = new Set((today.items || []).map(i => i.id));
    container.innerHTML = products.map(p => {
      const isHarvested = todayIds.has(p.id) || p.today_harvest;
      return `
        <div class="harvest-admin-row" id="har-${p.id}">
          <span>${p.emoji || '??'} ${p.name}</span>
          <label class="harvest-toggle">
            <input type="checkbox" ${isHarvested ? 'checked' : ''} onchange="toggleHarvestItem(${p.id}, this)">
            <span class="harvest-toggle-slider"></span>
          </label>
          <span class="harvest-status-label" id="har-lbl-${p.id}" style="font-size:.75rem;color:${isHarvested ? '#22c55e' : 'var(--text-muted)'}">
            ${isHarvested ? 'In Today\'s Harvest' : 'Not harvested today'}
          </span>
        </div>`;
    }).join('');
  } catch (e) { console.error('loadHarvestAdmin:', e.message); }
}

async function toggleHarvestItem(id, checkbox) {
  try {
    const res = await api('PATCH', '/harvest/toggle/' + id);
    const lbl = document.getElementById('har-lbl-' + id);
    if (lbl) {
      const isOn = res.today_harvest === 1;
      lbl.textContent = isOn ? 'In Today\'s Harvest' : 'Not harvested today';
      lbl.style.color  = isOn ? '#22c55e' : 'var(--text-muted)';
    }
    showToast((res.today_harvest ? '? Added to' : '? Removed from') + " Today's Harvest");
  } catch (e) {
    checkbox.checked = !checkbox.checked; // revert
    showToast('Error: ' + e.message);
  }
}

async function clearTodaysHarvest() {
  if (!confirm("Clear all Today's Harvest flags?")) return;
  await api('POST', '/harvest/clear');
  showToast("Today's Harvest cleared");
  loadHarvestAdmin();
}

// -- PRE-ORDERS ADMIN -----------------------------------------------------
async function loadPreorders() {
  const filter = document.getElementById('preorder-filter')?.value || 'all';
  const list = document.getElementById('preorders-list');
  const prodList = document.getElementById('preorder-product-list');
  if (!list) return;

  // Load all products for the toggle section
  if (prodList) {
    try {
      const prods = await api('GET', '/products/all');
      prodList.innerHTML = (Array.isArray(prods) ? prods : []).map(p => {
        const on = p.preorder_available === 1 || p.preorder_available === true;
        return `<div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:12px;padding:14px 16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div style="font-weight:700;font-size:.88rem;color:var(--text-primary)">${p.emoji||'??'} ${p.name}</div>
            <label style="position:relative;display:inline-block;width:42px;height:24px;cursor:pointer">
              <input type="checkbox" ${on?'checked':''} onchange="toggleProductPreorder(${p.id},this.checked)" style="opacity:0;width:0;height:0;position:absolute">
              <span style="position:absolute;inset:0;background:${on?'#52b788':'rgba(255,255,255,.15)'};border-radius:24px;transition:.3s"></span>
              <span style="position:absolute;left:${on?'20px':'2px'};top:2px;width:20px;height:20px;background:#fff;border-radius:50%;transition:.3s"></span>
            </label>
          </div>
          ${on ? `<div style="display:flex;gap:8px;flex-wrap:wrap">
            <input type="date" id="po-date-${p.id}" value="${p.preorder_expected_date||''}" style="flex:1;min-width:120px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:6px 10px;color:var(--text-primary);font-size:.78rem;font-family:inherit;outline:none" placeholder="Expected date">
            <input type="text" id="po-note-${p.id}" value="${p.preorder_note||''}" style="flex:2;min-width:140px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:6px 10px;color:var(--text-primary);font-size:.78rem;font-family:inherit;outline:none" placeholder="Note (e.g. 'Available Friday')">
            <button onclick="saveProductPreorder(${p.id})" style="background:#52b788;color:#0d2818;border:none;border-radius:8px;padding:6px 12px;font-size:.78rem;font-weight:700;cursor:pointer;font-family:inherit">Save</button>
          </div>` : `<div style="font-size:.78rem;color:var(--text-muted)">Pre-order disabled \u2014 toggle to enable</div>`}
        </div>`;
      }).join('') || '<div style="color:var(--text-muted);font-size:.85rem">No products found</div>';
    } catch(e) { prodList.innerHTML = `<div style="color:#f87171;font-size:.85rem">Error: ${e.message}</div>`; }
  }

  // Load preorder requests
  list.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem;text-align:center;padding:24px 0">Loading\u2026</div>';
  try {
    const all = await api('GET', '/customers/preorders/all');
    const rows = Array.isArray(all) ? (filter === 'all' ? all : all.filter(r => r.status === filter)) : [];

    // Update badge
    const pending = Array.isArray(all) ? all.filter(r => r.status === 'pending').length : 0;
    const badge = document.getElementById('preorder-badge');
    if (badge) { badge.textContent = pending; badge.style.display = pending > 0 ? '' : 'none'; }

    if (rows.length === 0) {
      list.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem;text-align:center;padding:40px 0">No pre-orders found</div>';
      return;
    }

    const statusColor = { pending:'#fbbf24', confirmed:'#52b788', ready:'#60a5fa', cancelled:'#f87171' };
    list.innerHTML = `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.85rem">
      <thead><tr style="border-bottom:1px solid var(--border)">
        <th style="text-align:left;padding:10px 12px;color:var(--text-muted);font-weight:600">Product</th>
        <th style="text-align:left;padding:10px 12px;color:var(--text-muted);font-weight:600">Customer</th>
        <th style="text-align:left;padding:10px 12px;color:var(--text-muted);font-weight:600">Qty</th>
        <th style="text-align:left;padding:10px 12px;color:var(--text-muted);font-weight:600">Notes</th>
        <th style="text-align:left;padding:10px 12px;color:var(--text-muted);font-weight:600">Date</th>
        <th style="text-align:left;padding:10px 12px;color:var(--text-muted);font-weight:600">Status</th>
        <th style="text-align:left;padding:10px 12px;color:var(--text-muted);font-weight:600">Actions</th>
      </tr></thead>
      <tbody>${rows.map(r => `<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:10px 12px;font-weight:600;color:var(--text-primary)">${r.product_name||'-'}</td>
        <td style="padding:10px 12px">
          <div style="font-weight:600;color:var(--text-primary)">${r.name||r.customer_name||'Guest'}</div>
          <div style="font-size:.75rem;color:var(--text-muted)">${r.phone||r.customer_phone||''}</div>
        </td>
        <td style="padding:10px 12px">${r.quantity||1} ${r.unit||''}</td>
        <td style="padding:10px 12px;color:var(--text-muted);max-width:160px;overflow:hidden;text-overflow:ellipsis">${r.notes||'-'}</td>
        <td style="padding:10px 12px;font-size:.78rem;color:var(--text-muted)">${r.created_at ? new Date(r.created_at).toLocaleDateString('en-NG') : '-'}</td>
        <td style="padding:10px 12px"><span style="background:${statusColor[r.status]||'#6b7280'}22;color:${statusColor[r.status]||'#6b7280'};border-radius:20px;padding:3px 10px;font-size:.75rem;font-weight:700;text-transform:capitalize">${r.status||'pending'}</span></td>
        <td style="padding:10px 12px">
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${r.status!=='confirmed' ? `<button onclick="updatePreorderStatus(${r.id},'confirmed')" style="background:rgba(82,183,136,.2);color:#52b788;border:none;border-radius:6px;padding:4px 10px;font-size:.75rem;font-weight:600;cursor:pointer;font-family:inherit">? Confirm</button>` : ''}
            ${r.status!=='ready' ? `<button onclick="updatePreorderStatus(${r.id},'ready')" style="background:rgba(96,165,250,.2);color:#60a5fa;border:none;border-radius:6px;padding:4px 10px;font-size:.75rem;font-weight:600;cursor:pointer;font-family:inherit">?? Ready</button>` : ''}
            ${r.phone ? `<a href="https://wa.me/${r.phone.replace(/\D/g,'')}?text=${encodeURIComponent('Hello '+( r.name||'')+'! Your pre-order for '+r.product_name+' from Pinnacles Farm is '+( r.status==='ready'?'ready for pickup/delivery!':'being processed.')+ ' We\'ll be in touch shortly. ??')}" target="_blank" style="background:rgba(37,211,102,.2);color:#25D366;border:none;border-radius:6px;padding:4px 10px;font-size:.75rem;font-weight:600;cursor:pointer;text-decoration:none">??</a>` : ''}
            ${r.status!=='cancelled' ? `<button onclick="updatePreorderStatus(${r.id},'cancelled')" style="background:rgba(248,113,113,.15);color:#f87171;border:none;border-radius:6px;padding:4px 10px;font-size:.75rem;font-weight:600;cursor:pointer;font-family:inherit">?</button>` : ''}
          </div>
        </td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  } catch(e) { list.innerHTML = `<div style="color:#f87171;font-size:.85rem;padding:20px">Error: ${e.message}</div>`; }
}

async function toggleProductPreorder(productId, enabled) {
  try {
    await api('PATCH', `/customers/product-preorder/${productId}`, { preorder_available: enabled ? 1 : 0 });
    loadPreorders();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

async function saveProductPreorder(productId) {
  const date = document.getElementById(`po-date-${productId}`)?.value || null;
  const note = document.getElementById(`po-note-${productId}`)?.value || null;
  try {
    await api('PATCH', `/customers/product-preorder/${productId}`, { preorder_available: 1, preorder_expected_date: date, preorder_note: note });
    showToast('Pre-order settings saved ?');
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

async function updatePreorderStatus(id, status) {
  try {
    await api('PATCH', `/customers/preorder/${id}/status`, { status });
    showToast(`Pre-order marked as ${status} ?`);
    loadPreorders();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}



function toggleSidebar() { document.getElementById('dashboard').classList.toggle('sidebar-collapsed'); }



// ── Hero Media Settings (Admin) ──────────────────────────────
function toggleHeroSettingsFields(type) {
  const vidField = document.getElementById('hero-video-field');
  const slideField = document.getElementById('hero-slideshow-field');
  if (vidField) vidField.style.display = (type === 'video') ? 'block' : 'none';
  if (slideField) slideField.style.display = (type === 'slideshow' || type === 'image') ? 'block' : 'none';
}

async function loadHeroSettings() {
  try {
    const res = await fetch('/api/settings/hero');
    if (!res.ok) return;
    const data = await res.json();
    if (!data) return;
    const typeSelect = document.getElementById('hero-media-type');
    const vidInput = document.getElementById('hero-video-url');
    const slideText = document.getElementById('hero-slideshow-images');
    if (typeSelect && data.type) typeSelect.value = data.type;
    if (vidInput && data.video_url) vidInput.value = data.video_url;
    if (slideText && Array.isArray(data.images)) slideText.value = data.images.join(String.fromCharCode(10));
    toggleHeroSettingsFields(data.type || 'video');
  } catch(e) {}
}

async function saveHeroSettings(e) {
  e.preventDefault();
  const type = document.getElementById('hero-media-type')?.value || 'video';
  const video_url = document.getElementById('hero-video-url')?.value?.trim() || 'videos/hero-bg.mp4';
  const rawImages = document.getElementById('hero-slideshow-images')?.value || '';
  const images = rawImages.split(String.fromCharCode(10)).map(s => s.trim()).filter(Boolean);
  const msg = document.getElementById('hero-save-msg');

  try {
    await api('POST', '/settings/hero', { type, video_url, images });
    if (msg) {
      msg.textContent = '✅ Hero background settings saved successfully!';
      msg.style.display = 'block';
      setTimeout(() => { msg.style.display = 'none'; }, 4000);
    }
    showToast('Hero settings updated successfully');
  } catch(err) {
    if (msg) {
      msg.textContent = '❌ Error saving: ' + err.message;
      msg.style.display = 'block';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadHeroSettings();
});

// ── Bank Payment Verification ──────────────────────────────────
function showAdminToast(msg) {
  if (typeof showToast === 'function') {
    showToast(msg);
  } else {
    alert(msg);
  }
}

async function loadPaymentVerification() {
  const content = document.getElementById('tab-payments') || document.getElementById('tab-content');
  if (!content) return;
  const today = new Date().toISOString().slice(0,10);
  content.innerHTML = `
    <div class="admin-section">
      <h2>&#x1F4B3; Bank Payment Verification</h2>
      <p style="color:rgba(255,255,255,.5);font-size:.85rem;margin-bottom:20px">
        Upload a screenshot of the customer&#39;s bank receipt &mdash; all transaction details will be read automatically.
      </p>

      <!-- UPLOAD ZONE -->
      <div class="receipt-upload-zone" id="receipt-upload-zone"
           onclick="document.getElementById('receipt-img-input').click()"
           ondragover="event.preventDefault();this.classList.add('drag-over')"
           ondragleave="this.classList.remove('drag-over')"
           ondrop="handleReceiptDrop(event)">
        <div class="upload-icon">&#x1F4F7;</div>
        <div class="upload-label">Click or drag &amp; drop bank receipt screenshot here</div>
        <div class="upload-sub">PNG &bull; JPG &bull; JPEG &mdash; Works with GTBank, First Bank, UBA, Access, Zenith, OPay, Kuda, Moniepoint&hellip;</div>
        <input type="file" id="receipt-img-input" accept="image/*" style="display:none"
               onchange="scanReceiptImage(this.files[0])" />
      </div>

      <!-- SCAN RESULT PANEL -->
      <div id="ocr-preview-wrap" style="display:none;margin-bottom:24px">
        <div class="ocr-result-grid">
          <div>
            <p class="ocr-label">&#x1F4F7; Uploaded Receipt</p>
            <img id="receipt-preview-img" src="" alt="Receipt"
                 style="width:100%;border-radius:12px;border:1px solid rgba(255,255,255,.12);max-height:380px;object-fit:contain;background:#0a150a;cursor:pointer"
                 onclick="this.style.maxHeight=this.style.maxHeight==='none'?'380px':'none'" title="Click to toggle full size" />
            <p style="font-size:.7rem;color:rgba(255,255,255,.25);margin-top:4px;text-align:center">Click image to expand/collapse</p>
          </div>
          <div>
            <p class="ocr-label">&#x1F50D; Extracted Text (raw)</p>
            <div id="ocr-raw-text" class="ocr-raw-box">Waiting for scan&hellip;</div>
            <div id="ocr-status" class="ocr-status-bar"></div>
          </div>
        </div>

        <!-- Detected fields summary -->
        <div id="ocr-summary" style="display:none;margin-top:16px;background:rgba(82,183,136,.08);border:1px solid rgba(82,183,136,.25);border-radius:14px;padding:16px">
          <p style="font-size:.8rem;font-weight:700;color:#52b788;margin-bottom:10px">&#x2728; Detected from receipt image</p>
          <div id="ocr-summary-chips" style="display:flex;flex-wrap:wrap;gap:8px"></div>
        </div>
      </div>

      <!-- FULL DETAILS FORM -->
      <div class="receipt-verify-form">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;flex-wrap:wrap;gap:10px">
          <p style="font-size:.9rem;font-weight:800;color:#a3d9b8;margin:0">&#x1F4DD; Full Transaction Details</p>
          <button onclick="document.getElementById('receipt-img-input').click()"
                  style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);color:rgba(255,255,255,.55);border-radius:8px;padding:7px 16px;font-size:.78rem;cursor:pointer;font-family:inherit">
            &#x1F504; Upload New Screenshot
          </button>
        </div>

        <!-- ROW 1: Bank + Transaction ID -->
        <div class="rv-section-label">&#x1F3E6; Transfer Details</div>
        <div class="form-grid-2">
          <div class="form-group">
            <label>Bank Name *</label>
            <input id="rv-bank" type="text" placeholder="e.g. GTBank, First Bank, UBA" />
          </div>
          <div class="form-group">
            <label>
              Transaction ID / Reference *
              <span id="txn-ocr-badge" style="display:none;background:rgba(82,183,136,.2);color:#52b788;font-size:.67rem;padding:2px 9px;border-radius:10px;margin-left:6px;vertical-align:middle">&#x2728; Auto-read</span>
            </label>
            <input id="rv-txn" type="text" placeholder="e.g. FBN2024101400012345"
                   style="font-family:monospace;font-size:.93rem;letter-spacing:.04em;text-transform:uppercase" />
          </div>
        </div>

        <!-- ROW 2: Amount + Date + Time -->
        <div class="form-grid-3">
          <div class="form-group">
            <label>Amount (&#x20A6;) *</label>
            <input id="rv-amount" type="number" placeholder="5000" min="0" step="0.01" />
          </div>
          <div class="form-group">
            <label>Payment Date *</label>
            <input id="rv-date" type="date" value="${today}" />
          </div>
          <div class="form-group">
            <label>Payment Time</label>
            <input id="rv-time" type="time" />
          </div>
        </div>

        <!-- ROW 3: Sender -->
        <div class="rv-section-label">&#x1F4E4; Sender (Customer)</div>
        <div class="form-grid-2">
          <div class="form-group">
            <label>Sender Account Name</label>
            <input id="rv-acctname" type="text" placeholder="Name on sender&#39;s bank account" />
          </div>
          <div class="form-group">
            <label>Sender Account Number</label>
            <input id="rv-acctnum" type="text" placeholder="10-digit account number" maxlength="11" style="font-family:monospace;letter-spacing:.08em" />
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label>Customer Phone</label>
            <input id="rv-phone" type="tel" placeholder="08XXXXXXXXX" />
          </div>
          <div class="form-group">
            <label>Sender Bank</label>
            <input id="rv-sender-bank" type="text" placeholder="Auto-filled or enter manually" />
          </div>
        </div>

        <!-- ROW 4: Recipient -->
        <div class="rv-section-label">&#x1F4E5; Recipient (Farm Account)</div>
        <div class="form-grid-2">
          <div class="form-group">
            <label>Recipient Account Name</label>
            <input id="rv-recip-name" type="text" placeholder="Pinnacles Resource Centre Farm" />
          </div>
          <div class="form-group">
            <label>Recipient Account Number</label>
            <input id="rv-recip-acct" type="text" placeholder="Farm account number" style="font-family:monospace;letter-spacing:.08em" />
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label>Recipient Bank</label>
            <input id="rv-recip-bank" type="text" placeholder="Bank receiving the payment" />
          </div>
          <div class="form-group">
            <label>Transaction Status</label>
            <select id="rv-status" style="width:100%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:10px 14px;color:#fff;font-family:inherit;font-size:.88rem;outline:none">
              <option value="verified">&#x2705; Verified / Successful</option>
              <option value="pending">&#x23F3; Pending</option>
              <option value="failed">&#x274C; Failed</option>
            </select>
          </div>
        </div>

        <!-- ROW 5: Narration + Order link -->
        <div class="rv-section-label">&#x1F4CB; Order Link &amp; Notes</div>
        <div class="form-grid-2">
          <div class="form-group">
            <label>Customer Name <span style="font-size:.72rem;color:rgba(255,255,255,.35)">(if different from account name)</span></label>
            <input id="rv-customer" type="text" placeholder="Full name of person who ordered" />
          </div>
          <div class="form-group">
            <label>Order ID <span style="font-size:.72rem;color:rgba(255,255,255,.35)">(links payment to order)</span></label>
            <input id="rv-orderid" type="number" placeholder="Order ID from orders list" />
          </div>
        </div>
        <div class="form-group">
          <label>Narration / Description <span style="font-size:.72rem;color:rgba(255,255,255,.35)">(from receipt)</span></label>
          <input id="rv-narration" type="text" placeholder="e.g. Transfer to Pinnacles Farm" />
        </div>
        <div class="form-group">
          <label>Additional Notes</label>
          <textarea id="rv-notes" placeholder="Any extra info for your records" rows="2"></textarea>
        </div>

        <div id="rv-error" style="display:none;color:#f87171;font-size:.83rem;margin-bottom:10px;padding:10px 14px;background:rgba(248,113,113,.08);border-radius:10px;border:1px solid rgba(248,113,113,.2)"></div>
        <button onclick="submitBankReceipt()" class="btn-primary" style="width:100%;padding:14px;font-size:.95rem">
          &#x2705; Verify &amp; Save Payment Record
        </button>
        <p style="font-size:.75rem;color:rgba(255,255,255,.3);text-align:center;margin-top:10px">
          The Transaction ID will automatically appear on the Pinnacles receipt for the accountant.
        </p>
      </div>

      <!-- RECENT PAYMENTS TABLE -->
      <h3 style="margin-top:40px;margin-bottom:14px;font-size:1rem;color:#a3d9b8">&#x1F4CB; Recent Verified Payments</h3>
      <div id="bank-receipts-list">Loading&hellip;</div>
    </div>
  `;
  loadBankReceipts();
}

// ── Drop Handler ──────────────────────────────────────────────────────────
function handleReceiptDrop(e) {
  e.preventDefault();
  var zone = document.getElementById('receipt-upload-zone');
  if (zone) zone.classList.remove('drag-over');
  var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) scanReceiptImage(file);
}

// ── OCR Scanner ───────────────────────────────────────────────────────────
async function scanReceiptImage(file) {
  if (!file) return;
  var previewWrap = document.getElementById('ocr-preview-wrap');
  var previewImg  = document.getElementById('receipt-preview-img');
  var rawText     = document.getElementById('ocr-raw-text');
  var statusEl    = document.getElementById('ocr-status');

  var reader = new FileReader();
  reader.onload = async function(ev) {
    previewImg.src = ev.target.result;
    previewWrap.style.display = 'block';
    rawText.textContent = 'Scanning… please wait';
    if (statusEl) statusEl.textContent = '⏳ Loading OCR engine…';

    // Load Tesseract.js on demand
    if (!window.Tesseract) {
      await new Promise(function(resolve, reject) {
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    try {
      if (statusEl) statusEl.textContent = '⏳ Reading text from image… 0%';
      var result = await Tesseract.recognize(ev.target.result, 'eng', {
        logger: function(m) {
          if (m.status === 'recognizing text' && statusEl) {
            statusEl.textContent = '⏳ Scanning… ' + Math.round((m.progress||0)*100) + '%';
          }
        }
      });
      var text = (result.data && result.data.text) || '';
      rawText.textContent = text || '(no readable text found)';
      if (statusEl) statusEl.textContent = '✅ Scan complete — all detected details have been filled below. Review & correct as needed.';
      parseAndFillReceiptFields(text);
    } catch(err) {
      if (statusEl) statusEl.textContent = '❌ Scan failed — please fill in the details manually.';
      rawText.textContent = 'Error: ' + (err.message || err);
    }
  };
  reader.readAsDataURL(file);
}

// ── Comprehensive Field Parser ────────────────────────────────────────────
function parseAndFillReceiptFields(text) {
  var lines = text.split('\n').map(function(l){ return l.trim(); }).filter(Boolean);
  var full  = text.toUpperCase();

  // Helper: find value after a label on same or next line
  function afterLabel(patterns, src) {
    for (var i=0;i<patterns.length;i++) {
      var m = src.match(patterns[i]);
      if (m && m[1]) return m[1].replace(/\|/g,'').trim();
    }
    return '';
  }

  // ── 1. Transaction ID ─────────────────────────────────────────────────
  var txnId = '';
  txnId = afterLabel([
    /(?:transaction\s*(?:id|ref(?:erence)?|no\.?)|ref(?:erence)?\s*(?:no\.?|number)?|session\s*id|tran\s*id|trn\s*ref|payment\s*ref|trans\.?\s*ref)[:\s]+([A-Z0-9\/\-]{6,40})/i,
    /(?:ftref|ft\s*ref|narration\s*ref)[:\s]+([A-Z0-9\/\-]{6,40})/i,
    /(?:ref)[:\s]+([A-Z0-9\/\-]{8,35})/i,
  ], text);
  if (!txnId) {
    for (var li=0;li<lines.length;li++) {
      var lu=lines[li].toUpperCase();
      if (/\bREF\b|SESSION|TRAN\s*ID|FT[A-Z0-9]/.test(lu)) {
        var lm=lu.match(/([A-Z0-9\/\-]{8,40})/);
        if (lm) { txnId=lm[1]; break; }
      }
    }
  }
  if (!txnId) { var sm=text.match(/\b([A-Z]{1,5}[0-9]{8,}[A-Z0-9]*)\b/); if(sm) txnId=sm[1]; }
  if (!txnId) { var nm=text.match(/\b([0-9]{10,20})\b/); if(nm) txnId=nm[1]; }

  // ── 2. Bank Name (sender bank) ────────────────────────────────────────
  var bankMap = {
    'GUARANTY TRUST':'GTBank','GTBANK':'GTBank','GTB':'GTBank','GT BANK':'GTBank',
    'FIRST BANK':'First Bank','FBN':'First Bank','FIRSTBANK':'First Bank','FIRST CITY MONUMENT':'FCMB',
    'ZENITH BANK':'Zenith Bank','ZENITH':'Zenith Bank',
    'ACCESS BANK':'Access Bank',
    'UNITED BANK FOR AFRICA':'UBA','UNITED BANK':'UBA','UBA':'UBA',
    'FIDELITY BANK':'Fidelity Bank','FIDELITY':'Fidelity Bank',
    'STANBIC IBTC':'Stanbic IBTC','STANBIC':'Stanbic IBTC',
    'STERLING BANK':'Sterling Bank','STERLING':'Sterling Bank',
    'UNION BANK':'Union Bank',
    'ECOBANK':'Ecobank','ECO BANK':'Ecobank',
    'POLARIS BANK':'Polaris Bank','POLARIS':'Polaris Bank',
    'WEMA BANK':'Wema Bank','WEMA':'Wema Bank',
    'FCMB':'FCMB',
    'KEYSTONE BANK':'Keystone Bank','KEYSTONE':'Keystone Bank',
    'HERITAGE BANK':'Heritage Bank',
    'PROVIDUS BANK':'Providus Bank','PROVIDUS':'Providus Bank',
    'JAIZ BANK':'Jaiz Bank','JAIZ':'Jaiz Bank',
    'OPAY':'OPay','O-PAY':'OPay',
    'KUDA BANK':'Kuda Bank','KUDA':'Kuda Bank',
    'PALMPAY':'PalmPay','PALM PAY':'PalmPay',
    'MONIEPOINT':'Moniepoint','MONIE POINT':'Moniepoint',
    'CARBON':'Carbon','ONE FINANCE':'One Finance',
    'VFD':'VFD Microfinance','VFD MICROFINANCE':'VFD Microfinance',
    'SPARKLE':'Sparkle','RUBIES':'Rubies Bank',
  };
  var bankName='', bankKeys=Object.keys(bankMap);
  for (var bi=0;bi<bankKeys.length;bi++) {
    if (full.indexOf(bankKeys[bi])!==-1) { bankName=bankMap[bankKeys[bi]]; break; }
  }
  // Try to find explicit "Bank:" label
  var bankLabelM = afterLabel([/(?:bank|from\s*bank|sending\s*bank)[:\s]+([A-Za-z ]{4,30})/i], text);
  if (bankLabelM && !bankName) bankName = bankLabelM.trim();

  // ── 3. Amount ─────────────────────────────────────────────────────────
  var amount='';
  amount = afterLabel([
    /(?:amount|amt|total\s*amount|credit|debit|sum|value|transferred?)[:\s\u20a6NGN]+([0-9,]+(?:\.[0-9]{1,2})?)/i,
    /(?:NGN|\u20a6)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
    /([0-9,]{4,}(?:\.[0-9]{2})?)\s*(?:NGN|naira)/i,
  ], text);
  if (amount) amount = amount.replace(/,/g,'');
  // Last resort: biggest number in doc (likely the transfer amount)
  if (!amount) {
    var allNums = text.match(/[0-9,]{4,}(?:\.[0-9]{2})?/g) || [];
    var biggest = 0;
    allNums.forEach(function(n){ var v=parseFloat(n.replace(/,/g,'')); if(v>biggest && v<999999999) biggest=v; });
    if (biggest > 0) amount = String(biggest);
  }

  // ── 4. Date ───────────────────────────────────────────────────────────
  var dateVal = new Date().toISOString().slice(0,10);
  var datePats = [
    /(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/,
    /(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/,
    /(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})/i,
    /(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})/i,
  ];
  for (var dpi=0;dpi<datePats.length;dpi++) {
    var dm2=text.match(datePats[dpi]);
    if (dm2) {
      try {
        var d2;
        if (datePats[dpi].source.startsWith('(\\d{4})')) {
          d2=new Date(dm2[1]+'-'+dm2[2].padStart(2,'0')+'-'+dm2[3].padStart(2,'0'));
        } else if (isNaN(Number(dm2[2]))) {
          d2=new Date(dm2[2]+' '+dm2[1]+' '+dm2[3]);
        } else if (isNaN(Number(dm2[1]))) {
          d2=new Date(dm2[1]+' '+dm2[2]+' '+dm2[3]);
        } else {
          d2=new Date(dm2[3]+'-'+dm2[2].padStart(2,'0')+'-'+dm2[1].padStart(2,'0'));
        }
        if (!isNaN(d2.getTime())) { dateVal=d2.toISOString().slice(0,10); break; }
      } catch(e2) {}
    }
  }

  // ── 5. Time ───────────────────────────────────────────────────────────
  var timeVal='';
  var timem=text.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*([APap][Mm])?/);
  if (timem) {
    var h=parseInt(timem[1]),mn=timem[2],ap=(timem[3]||'').toUpperCase();
    if(ap==='PM'&&h<12)h+=12; if(ap==='AM'&&h===12)h=0;
    timeVal=String(h).padStart(2,'0')+':'+mn;
  }

  // ── 6. Sender Account Name ────────────────────────────────────────────
  var senderName='';
  senderName=afterLabel([
    /(?:sender|from|initiator|account\s*name|debit\s*account\s*name|source\s*account\s*name)[:\s]+([A-Za-z ]{3,50})/i,
    /(?:from\s*account)[:\s]+([A-Za-z ]{3,50})/i,
  ], text);

  // ── 7. Sender Account Number ──────────────────────────────────────────
  var senderAcctNum='';
  senderAcctNum=afterLabel([
    /(?:sender|from|debit|source)\s*(?:account|acct)\s*(?:no\.?|number)?[:\s]+([0-9]{10})/i,
    /(?:account\s*(?:no\.?|number))[:\s]+([0-9]{10})/i,
  ], text);
  // Fallback: grab standalone 10-digit account numbers
  if (!senderAcctNum) {
    var accNums=text.match(/\b([0-9]{10})\b/g)||[];
    if (accNums.length>0) senderAcctNum=accNums[0];
  }

  // ── 8. Sender Bank ────────────────────────────────────────────────────
  var senderBank=bankName; // default to detected bank

  // ── 9. Recipient Name ─────────────────────────────────────────────────
  var recipName='';
  recipName=afterLabel([
    /(?:recipient|beneficiary|credit\s*account\s*name|to\s*account\s*name|receiver|payee)[:\s]+([A-Za-z ]{3,60})/i,
    /(?:to|credited\s*to)[:\s]+([A-Za-z ]{3,60})/i,
  ], text);

  // ── 10. Recipient Account Number ──────────────────────────────────────
  var recipAcct='';
  recipAcct=afterLabel([
    /(?:recipient|beneficiary|credit|to)\s*(?:account|acct)\s*(?:no\.?|number)?[:\s]+([0-9]{10})/i,
    /(?:destination|dest\.?)\s*(?:account|acct)[:\s]+([0-9]{10})/i,
  ], text);
  // Use second 10-digit number if we already used first for sender
  if (!recipAcct && senderAcctNum) {
    var accNums2=text.match(/\b([0-9]{10})\b/g)||[];
    if (accNums2.length>1) recipAcct=accNums2[1];
  }

  // ── 11. Recipient Bank ────────────────────────────────────────────────
  var recipBank='';
  recipBank=afterLabel([
    /(?:recipient|beneficiary|to|credit)\s*bank[:\s]+([A-Za-z ]{3,30})/i,
    /(?:destination\s*bank)[:\s]+([A-Za-z ]{3,30})/i,
  ], text);
  // detect bank name appearing after "to" in the text
  if (!recipBank) {
    var toIdx=full.indexOf(' TO ');
    if (toIdx>-1) {
      var afterTo=full.slice(toIdx+4,toIdx+80);
      for (var rbi=0;rbi<bankKeys.length;rbi++) {
        if (afterTo.indexOf(bankKeys[rbi])!==-1) { recipBank=bankMap[bankKeys[rbi]]; break; }
      }
    }
  }

  // ── 12. Narration / Description ───────────────────────────────────────
  var narration='';
  narration=afterLabel([
    /(?:narration|description|remark|memo|reason|purpose|payment\s*for|note)[:\s]+(.{4,80})/i,
    /(?:transaction\s*description)[:\s]+(.{4,80})/i,
  ], text);

  // ── 13. Status ────────────────────────────────────────────────────────
  var statusVal='verified';
  if (/SUCCESSFUL|SUCCESS|APPROVED|COMPLETED/i.test(text)) statusVal='verified';
  else if (/PENDING|PROCESSING/i.test(text)) statusVal='pending';
  else if (/FAILED|DECLINED|REJECTED|ERROR/i.test(text)) statusVal='failed';

  // ── Fill all form fields ──────────────────────────────────────────────
  function fill(id,val) { var el=document.getElementById(id); if(el&&val) el.value=val.toString().trim(); }
  fill('rv-txn',         txnId.toUpperCase());
  fill('rv-bank',        bankName);
  fill('rv-amount',      amount);
  fill('rv-date',        dateVal);
  fill('rv-time',        timeVal);
  fill('rv-acctname',    senderName);
  fill('rv-acctnum',     senderAcctNum);
  fill('rv-phone',       '');  // phones rarely on receipts, leave for manual
  fill('rv-sender-bank', senderBank);
  fill('rv-recip-name',  recipName);
  fill('rv-recip-acct',  recipAcct);
  fill('rv-recip-bank',  recipBank);
  fill('rv-narration',   narration);

  // Status select
  var selEl=document.getElementById('rv-status');
  if (selEl) selEl.value=statusVal;

  // ── Show "auto-detected" badge on Transaction ID ─────────────────────
  var badge=document.getElementById('txn-ocr-badge');
  if (badge) badge.style.display=txnId?'inline':'none';

  // ── Highlight required fields: green if filled, red if empty ─────────
  ['rv-bank','rv-txn','rv-amount'].forEach(function(id){
    var el=document.getElementById(id);
    if(el) el.style.borderColor=el.value?'rgba(82,183,136,.55)':'rgba(248,113,113,.55)';
  });

  // ── Show summary chips ────────────────────────────────────────────────
  var fields=[
    {label:'Transaction ID',val:txnId},
    {label:'Bank',val:bankName},
    {label:'Amount',val:amount?'\u20a6'+Number(amount).toLocaleString():''},
    {label:'Date',val:dateVal},
    {label:'Time',val:timeVal},
    {label:'Sender',val:senderName},
    {label:'Sender Acct',val:senderAcctNum},
    {label:'Recipient',val:recipName},
    {label:'Recipient Acct',val:recipAcct},
    {label:'Recipient Bank',val:recipBank},
    {label:'Narration',val:narration},
    {label:'Status',val:statusVal},
  ];
  var detected=fields.filter(function(f){return f.val;});
  var summary=document.getElementById('ocr-summary');
  var chips=document.getElementById('ocr-summary-chips');
  if (summary&&chips) {
    chips.innerHTML=detected.map(function(f){
      return '<span style="background:rgba(82,183,136,.12);border:1px solid rgba(82,183,136,.25);border-radius:20px;padding:4px 12px;font-size:.75rem;color:#a3d9b8">'
        +'<strong style="color:#52b788">'+f.label+':</strong> '+f.val+'</span>';
    }).join('');
    summary.style.display=detected.length?'block':'none';
  }

  // ── Cross-reference matching orders ──────────────────────────
  crossReferenceOrders(dateVal, amount ? parseFloat(amount) : 0);
}

// ── Submit ────────────────────────────────────────────────────────────────
async function submitBankReceipt() {
  var bank   = (document.getElementById('rv-bank')?.value||'').trim();
  var txn    = (document.getElementById('rv-txn')?.value||'').trim().toUpperCase();
  var amount = parseFloat(document.getElementById('rv-amount')?.value||0);
  var date   = document.getElementById('rv-date')?.value||'';
  var errEl  = document.getElementById('rv-error');
  if (!bank||!txn||!amount||!date) {
    if(errEl){errEl.textContent='Bank name, Transaction ID, amount and date are required.';errEl.style.display='block';}
    return;
  }
  if(errEl) errEl.style.display='none';

  // Build notes from extra extracted fields
  var extras=[];
  var acctnum=(document.getElementById('rv-acctnum')?.value||'').trim();
  var recipName=(document.getElementById('rv-recip-name')?.value||'').trim();
  var recipAcct=(document.getElementById('rv-recip-acct')?.value||'').trim();
  var recipBank=(document.getElementById('rv-recip-bank')?.value||'').trim();
  var narration=(document.getElementById('rv-narration')?.value||'').trim();
  var senderBank=(document.getElementById('rv-sender-bank')?.value||'').trim();
  if(acctnum)  extras.push('Sender Acct: '+acctnum);
  if(senderBank) extras.push('Sender Bank: '+senderBank);
  if(recipName) extras.push('Recipient: '+recipName);
  if(recipAcct) extras.push('Recipient Acct: '+recipAcct);
  if(recipBank) extras.push('Recipient Bank: '+recipBank);
  if(narration) extras.push('Narration: '+narration);
  var manualNotes=(document.getElementById('rv-notes')?.value||'').trim();
  var fullNotes=[manualNotes].concat(extras).filter(Boolean).join(' | ');

  try {
    var res=await api('POST','/payment/verify-bank',{
      bank_name:    bank,
      transaction_id: txn,
      amount:       amount,
      payment_date: date,
      payment_time: document.getElementById('rv-time')?.value||null,
      account_name: document.getElementById('rv-acctname')?.value?.trim()||null,
      customer_name:document.getElementById('rv-customer')?.value?.trim()||null,
      customer_phone:document.getElementById('rv-phone')?.value?.trim()||null,
      order_id:     parseInt(document.getElementById('rv-orderid')?.value)||null,
      notes:        fullNotes||null,
    });
    if(res.error) throw new Error(res.error);
    showAdminToast('\u2705 Payment verified! Txn ID: '+txn);
    // Reset form
    ['rv-bank','rv-txn','rv-amount','rv-acctname','rv-acctnum','rv-phone','rv-sender-bank',
     'rv-recip-name','rv-recip-acct','rv-recip-bank','rv-narration','rv-notes','rv-customer','rv-orderid','rv-time'].forEach(function(id){
      var el=document.getElementById(id); if(el) el.value='';
    });
    var dateEl=document.getElementById('rv-date');
    if(dateEl) dateEl.value=new Date().toISOString().slice(0,10);
    var wrap=document.getElementById('ocr-preview-wrap');
    if(wrap) wrap.style.display='none';
    var summary=document.getElementById('ocr-summary');
    if(summary) summary.style.display='none';
    loadBankReceipts();
  } catch(e) {
    if(errEl){errEl.textContent=e.message;errEl.style.display='block';}
  }
}

// ── Recent Payments Table ─────────────────────────────────────────────────
async function loadBankReceipts() {
  var container=document.getElementById('bank-receipts-list');
  if(!container) return;
  try {
    var data=await api('GET','/payment/bank-receipts');
    if(!Array.isArray(data)||!data.length){
      container.innerHTML='<p style="color:rgba(255,255,255,.4);font-size:.85rem">No verified payments yet.</p>';
      return;
    }
    container.innerHTML='<div class="receipts-table-wrap"><table class="admin-table"><thead><tr>'+
      '<th>Date</th><th>Bank</th><th>Transaction ID</th><th>Amount</th><th>Customer / Sender</th><th>Order</th><th>Status</th>'+
      '</tr></thead><tbody>'+
      data.map(function(r){
        return '<tr>'+
          '<td>'+(r.payment_date||'-')+'</td>'+
          '<td>'+(r.bank_name||'-')+'</td>'+
          '<td style="font-family:monospace;font-size:.82rem;color:#fbbf24">'+(r.transaction_id||'-')+'</td>'+
          '<td>&#x20A6;'+Number(r.amount||0).toLocaleString()+'</td>'+
          '<td>'+(r.customer_name||r.account_name||'-')+'</td>'+
          '<td>'+(r.order_id||'-')+'</td>'+
          '<td><span class="status-badge status-'+(r.status||'verified')+'">'+(r.status||'verified')+'</span></td>'+
          '</tr>';
      }).join('')+
      '</tbody></table></div>';
  } catch(e) {
    container.innerHTML='<p style="color:#f87171">'+e.message+'</p>';
  }
}

// ── Order Cross-referencing after OCR Scan ───────────────────────────────
async function crossReferenceOrders(dateVal, amountVal) {
  // Remove any previous match panel
  var prev = document.getElementById('order-match-panel');
  if (prev) prev.remove();

  var form = document.querySelector('.receipt-verify-form');
  if (!form) return;

  // Create panel placeholder
  var panel = document.createElement('div');
  panel.id = 'order-match-panel';
  panel.style.cssText = 'margin-bottom:24px;border:1px solid rgba(82,183,136,.3);border-radius:16px;overflow:hidden';
  panel.innerHTML = '<div style="background:rgba(82,183,136,.08);padding:14px 18px;font-size:.85rem;font-weight:700;color:#a3d9b8">&#x1F50E; Searching orders that match this receipt&hellip;</div>';
  form.parentNode.insertBefore(panel, form);

  try {
    var data = await api('GET', '/orders');
    var orders = (data.orders || data || []);
    if (!Array.isArray(orders)) orders = [];

    var refDate = dateVal ? new Date(dateVal) : new Date();
    var matched = orders.filter(function(o) {
      var orderDate = new Date((o.created_at || '').slice(0, 10));
      var dayDiff = Math.abs((refDate - orderDate) / (1000 * 60 * 60 * 24));
      var dateOk = dayDiff <= 3;
      if (!dateOk) return false;
      if (amountVal > 0) {
        var orderTotal = Number(o.total || 0);
        var diff = Math.abs(orderTotal - amountVal) / Math.max(orderTotal, amountVal);
        return diff <= 0.30; // within 30%
      }
      return true;
    });

    // Also fetch existing bank receipts to show which orders already have payments
    var existingPayments = [];
    try {
      var pr = await api('GET', '/payment/bank-receipts');
      existingPayments = Array.isArray(pr) ? pr.map(function(p){ return p.order_id; }) : [];
    } catch(e) {}

    if (!matched.length) {
      panel.innerHTML = '<div style="background:rgba(82,183,136,.05);padding:14px 18px;font-size:.83rem;color:rgba(255,255,255,.4);">&#x1F50E; No orders found matching this receipt date/amount. Enter the Order ID manually below if needed.</div>';
      return;
    }

    var html = '<div style="background:rgba(82,183,136,.08);padding:14px 18px;font-size:.85rem;font-weight:700;color:#a3d9b8">'
      + '&#x1F4CB; ' + matched.length + ' Matching Order' + (matched.length>1?'s':'') + ' Found &mdash; click one to link this payment:</div>'
      + '<div style="padding:12px;display:flex;flex-direction:column;gap:8px">';

    matched.forEach(function(o) {
      var alreadyLinked = existingPayments.indexOf(o.id) !== -1;
      var dateStr = o.created_at ? o.created_at.slice(0,10) : '-';
      var timeStr = o.created_at && o.created_at.length > 10 ? o.created_at.slice(11,16) : '';
      var itemNames = Array.isArray(o.items) ? o.items.map(function(i){ return (i.emoji||'') + ' ' + i.name; }).join(', ') : '';
      html += '<div class="order-match-card" id="omatch-' + o.id + '" onclick="selectMatchedOrder(' + o.id + ', this)" style="cursor:pointer">'
        + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">'
        + '<div>'
        + '<div style="font-weight:800;color:#e0f0e0;font-size:.88rem">Order #' + o.id + ' &bull; ' + (o.customer_name||'Customer') + '</div>'
        + '<div style="font-size:.78rem;color:rgba(255,255,255,.5);margin-top:2px">&#x1F4C5; ' + dateStr + (timeStr?' &bull; &#x23F0; '+timeStr:'') + ' &bull; &#x1F4DE; ' + (o.customer_phone||'No phone') + '</div>'
        + (itemNames ? '<div style="font-size:.75rem;color:rgba(255,255,255,.4);margin-top:3px">' + itemNames + '</div>' : '')
        + '</div>'
        + '<div style="text-align:right;flex-shrink:0">'
        + '<div style="font-weight:800;color:#fbbf24;font-size:.95rem">&#x20A6;' + Number(o.total||0).toLocaleString() + '</div>'
        + '<div style="font-size:.72rem;margin-top:3px"><span class="status-badge status-' + o.status + '">' + o.status + '</span></div>'
        + (alreadyLinked ? '<div style="font-size:.7rem;color:#52b788;margin-top:4px">&#x2705; Payment already linked</div>' : '')
        + '</div>'
        + '</div>'
        + '</div>';
    });

    html += '</div>';
    panel.innerHTML = html;

  } catch(e) {
    panel.innerHTML = '<div style="padding:14px 18px;font-size:.82rem;color:#f87171">Could not load orders: ' + e.message + '</div>';
  }
}

function selectMatchedOrder(orderId, el) {
  // Deselect all
  document.querySelectorAll('.order-match-card').forEach(function(c){
    c.style.background = 'rgba(255,255,255,.03)';
    c.style.borderColor = 'rgba(255,255,255,.08)';
  });
  // Highlight selected
  el.style.background = 'rgba(82,183,136,.12)';
  el.style.borderColor = 'rgba(82,183,136,.4)';
  // Fill order ID field
  var orderIdEl = document.getElementById('rv-orderid');
  if (orderIdEl) {
    orderIdEl.value = orderId;
    orderIdEl.style.borderColor = 'rgba(82,183,136,.55)';
    orderIdEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  showAdminToast('&#x1F4CB; Order #' + orderId + ' selected — click Verify & Save to link this payment.');
}

// ── Attach Bank Receipt directly to an Order ─────────────────────────────
function openAttachReceiptModal(orderId, customerName, orderTotal) {
  // Create or reuse modal
  var modal = document.getElementById('attach-receipt-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'attach-receipt-modal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.78);backdrop-filter:blur(6px);align-items:center;justify-content:center';
    modal.innerHTML = '<div id="attach-receipt-inner" style="background:#111f11;border:1px solid rgba(255,255,255,.15);border-radius:24px;padding:28px;width:min(600px,94vw);max-height:90vh;overflow-y:auto;position:relative"></div>';
    modal.onclick = function(e) { if(e.target===modal) closeAttachReceiptModal(); };
    document.body.appendChild(modal);
  }

  var safeCustomerName = String(customerName || '').replace(/'/g, "\\'");

  document.getElementById('attach-receipt-inner').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
      <div>
        <h3 style="font-size:1rem;font-weight:800;color:#a3d9b8;margin:0">&#x1F4F7; Attach Bank Receipt to Order #${orderId}</h3>
        <p style="font-size:.8rem;color:rgba(255,255,255,.4);margin:4px 0 0">${customerName} &bull; &#x20A6;${Number(orderTotal).toLocaleString()}</p>
      </div>
      <button onclick="closeAttachReceiptModal()" style="background:none;border:none;color:rgba(255,255,255,.4);font-size:1.4rem;cursor:pointer;padding:4px">&#x2715;</button>
    </div>

    <!-- Upload zone -->
    <div class="receipt-upload-zone" id="attach-upload-zone"
         onclick="document.getElementById('attach-img-input').click()"
         ondragover="event.preventDefault();this.classList.add('drag-over')"
         ondragleave="this.classList.remove('drag-over')"
         ondrop="handleAttachDrop(event,${orderId})">
      <div class="upload-icon">&#x1F4F7;</div>
      <div class="upload-label">Drop or click to upload the bank receipt screenshot</div>
      <div class="upload-sub">The system will scan and extract all transaction details</div>
      <input type="file" id="attach-img-input" accept="image/*" style="display:none"
             onchange="scanAndAttachReceipt(this.files[0], ${orderId}, ${orderTotal})" />
    </div>

    <!-- Preview -->
    <div id="attach-preview-wrap" style="display:none;margin-bottom:16px">
      <img id="attach-preview-img" src="" style="width:100%;max-height:220px;object-fit:contain;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:#0a150a" />
      <div id="attach-ocr-status" style="margin-top:8px;font-size:.83rem;color:#fbbf24"></div>
    </div>

    <!-- Detected info + save -->      
    <div id="attach-detected" style="display:none">
      <div style="background:rgba(82,183,136,.08);border:1px solid rgba(82,183,136,.2);border-radius:14px;padding:16px;margin-bottom:16px">
        <p style="font-size:.8rem;font-weight:700;color:#52b788;margin-bottom:10px">&#x2728; Detected from receipt:</p>
        <div id="attach-chips" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px"></div>
        <div class="form-grid-2">
          <div class="form-group">
            <label>Transaction ID *</label>
            <input id="attach-txn" type="text" style="text-transform:uppercase;font-family:monospace;font-size:.9rem" />
          </div>
          <div class="form-group">
            <label>Bank Name *</label>
            <input id="attach-bank" type="text" />
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label>Amount (&#x20A6;)</label>
            <input id="attach-amount" type="number" />
          </div>
          <div class="form-group">
            <label>Payment Date</label>
            <input id="attach-date" type="date" />
          </div>
        </div>
        <div class="form-group">
          <label>Sender Account Name</label>
          <input id="attach-sender" type="text" />
        </div>
      </div>
      <div id="attach-error" style="display:none;color:#f87171;font-size:.83rem;margin-bottom:10px"></div>
      <button onclick="saveAttachedReceipt(${orderId}, '${safeCustomerName}')" class="btn-primary" style="width:100%">
        &#x1F4BE; Save Payment &amp; Link to Order #${orderId}
      </button>
      <p style="font-size:.73rem;color:rgba(255,255,255,.3);text-align:center;margin-top:8px">Transaction ID will appear on the Pinnacles receipt for this order.</p>
    </div>
  `;

  modal.style.display = 'flex';
}

function closeAttachReceiptModal() {
  var modal = document.getElementById('attach-receipt-modal');
  if (modal) modal.style.display = 'none';
}

function handleAttachDrop(e, orderId) {
  e.preventDefault();
  var zone = document.getElementById('attach-upload-zone');
  if (zone) zone.classList.remove('drag-over');
  var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    scanAndAttachReceipt(file, orderId, 0);
  }
}

async function scanAndAttachReceipt(file, orderId, orderTotal) {
  if (!file) return;
  var previewWrap = document.getElementById('attach-preview-wrap');
  var previewImg  = document.getElementById('attach-preview-img');
  var statusEl    = document.getElementById('attach-ocr-status');
  var detectedDiv = document.getElementById('attach-detected');

  var reader = new FileReader();
  reader.onload = async function(ev) {
    previewImg.src = ev.target.result;
    previewWrap.style.display = 'block';
    detectedDiv.style.display = 'none';
    if (statusEl) statusEl.textContent = '\u23f3 Scanning receipt...';

    if (!window.Tesseract) {
      await new Promise(function(resolve, reject) {
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    try {
      var result = await Tesseract.recognize(ev.target.result, 'eng', {
        logger: function(m) {
          if (m.status === 'recognizing text' && statusEl)
            statusEl.textContent = '\u23f3 Scanning... ' + Math.round((m.progress||0)*100) + '%';
        }
      });

      var text = (result.data && result.data.text) || '';
      if (statusEl) statusEl.textContent = '\u2705 Scan complete!';

      // Parse using the same logic
      var parsed = parseReceiptText(text);

      // Fill attach form
      function fillA(id, val) { var el = document.getElementById(id); if(el&&val) el.value=val; }
      fillA('attach-txn',    parsed.txnId);
      fillA('attach-bank',   parsed.bankName);
      fillA('attach-amount', parsed.amount);
      fillA('attach-date',   parsed.dateVal);
      fillA('attach-sender', parsed.senderName);

      // Show chips
      var chipsEl = document.getElementById('attach-chips');
      if (chipsEl) {
        var chip = function(label, val) {
          return val ? '<span style="background:rgba(82,183,136,.12);border:1px solid rgba(82,183,136,.25);border-radius:20px;padding:4px 12px;font-size:.73rem;color:#a3d9b8"><strong style="color:#52b788">'+label+':</strong> '+val+'</span>' : '';
        };
        chipsEl.innerHTML = [
          chip('Txn ID', parsed.txnId),
          chip('Bank', parsed.bankName),
          chip('Amount', parsed.amount ? '\u20a6'+Number(parsed.amount).toLocaleString() : ''),
          chip('Date', parsed.dateVal),
          chip('Time', parsed.timeVal),
          chip('Sender', parsed.senderName),
          chip('Sender Acct', parsed.senderAcctNum),
          chip('Recipient', parsed.recipName),
          chip('Status', parsed.statusVal),
        ].filter(Boolean).join('');
      }

      detectedDiv.style.display = 'block';
    } catch(err) {
      if (statusEl) statusEl.textContent = '\u274c Scan failed. Fill in manually.';
      detectedDiv.style.display = 'block';
    }
  };
  reader.readAsDataURL(file);
}

async function saveAttachedReceipt(orderId, customerName) {
  var txn    = (document.getElementById('attach-txn')?.value||'').trim().toUpperCase();
  var bank   = (document.getElementById('attach-bank')?.value||'').trim();
  var amount = parseFloat(document.getElementById('attach-amount')?.value||0);
  var date   = document.getElementById('attach-date')?.value||new Date().toISOString().slice(0,10);
  var sender = (document.getElementById('attach-sender')?.value||'').trim();
  var errEl  = document.getElementById('attach-error');

  if (!txn || !bank) {
    if(errEl){errEl.textContent='Transaction ID and Bank Name are required.';errEl.style.display='block';}
    return;
  }
  if(errEl) errEl.style.display='none';

  try {
    var res = await api('POST', '/payment/verify-bank', {
      transaction_id: txn,
      bank_name:      bank,
      amount:         amount || null,
      payment_date:   date,
      account_name:   sender || null,
      customer_name:  customerName || null,
      order_id:       orderId,
      notes:          'Attached via order receipt upload',
    });
    if (res.error) throw new Error(res.error);
    showAdminToast('\u2705 Payment saved! Txn ID: ' + txn + ' linked to Order #' + orderId);
    closeAttachReceiptModal();
    loadOrders();
  } catch(e) {
    if(errEl){errEl.textContent=e.message;errEl.style.display='block';}
  }
}

// ── Shared receipt text parser (used by both payment tab and order attach) ─
function parseReceiptText(text) {
  var full = text.toUpperCase();
  var lines = text.split('\n').map(function(l){return l.trim();}).filter(Boolean);

  function afterLabel(patterns, src) {
    for (var i=0;i<patterns.length;i++) {
      var m=src.match(patterns[i]);
      if(m&&m[1]) return m[1].replace(/\|/g,'').trim();
    }
    return '';
  }

  // Transaction ID
  var txnId='';
  txnId=afterLabel([
    /(?:transaction\s*(?:id|ref(?:erence)?|no\.?)|ref(?:erence)?\s*(?:no\.?|number)?|session\s*id|tran\s*id|trn\s*ref|payment\s*ref)[:\s]+([A-Z0-9\/\-]{6,40})/i,
    /(?:ftref|ft\s*ref|narration\s*ref)[:\s]+([A-Z0-9\/\-]{6,40})/i,
    /(?:\bref\b)[:\s]+([A-Z0-9\/\-]{8,35})/i,
  ], text);
  if(!txnId){
    for(var li=0;li<lines.length;li++){
      var lu=lines[li].toUpperCase();
      if(/\bREF\b|SESSION|TRAN\s*ID|FT[A-Z0-9]/.test(lu)){
        var lm=lu.match(/([A-Z0-9\/\-]{8,40})/); if(lm){txnId=lm[1];break;}
      }
    }
  }
  if(!txnId){var sm=text.match(/\b([A-Z]{1,5}[0-9]{8,}[A-Z0-9]*)\b/);if(sm)txnId=sm[1];}
  if(!txnId){var nm=text.match(/\b([0-9]{10,20})\b/);if(nm)txnId=nm[1];}

  // Bank
  var bankMap={'GUARANTY TRUST':'GTBank','GTBANK':'GTBank','GTB':'GTBank','GT BANK':'GTBank','FIRST BANK':'First Bank','FBN':'First Bank','FIRSTBANK':'First Bank','ZENITH BANK':'Zenith Bank','ZENITH':'Zenith Bank','ACCESS BANK':'Access Bank','UNITED BANK FOR AFRICA':'UBA','UNITED BANK':'UBA','UBA':'UBA','FIDELITY BANK':'Fidelity Bank','FIDELITY':'Fidelity Bank','STANBIC IBTC':'Stanbic IBTC','STANBIC':'Stanbic IBTC','STERLING BANK':'Sterling Bank','STERLING':'Sterling Bank','UNION BANK':'Union Bank','ECOBANK':'Ecobank','ECO BANK':'Ecobank','POLARIS BANK':'Polaris Bank','WEMA BANK':'Wema Bank','WEMA':'Wema Bank','FCMB':'FCMB','KEYSTONE BANK':'Keystone Bank','HERITAGE BANK':'Heritage Bank','OPAY':'OPay','KUDA BANK':'Kuda Bank','KUDA':'Kuda Bank','PALMPAY':'PalmPay','MONIEPOINT':'Moniepoint'};
  var bankName='';
  var bankKeys=Object.keys(bankMap);
  for(var bi=0;bi<bankKeys.length;bi++){if(full.indexOf(bankKeys[bi])!==-1){bankName=bankMap[bankKeys[bi]];break;}}

  // Amount
  var amount='';
  var amtPats=[/(?:amount|amt|total|credit|debit|transferred?)[:\s\u20a6NGN]+([0-9,]+(?:\.[0-9]{1,2})?)/i,/(?:NGN|\u20a6)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,/([0-9,]{4,}(?:\.[0-9]{2})?)\s*(?:NGN|naira)/i];
  for(var ap=0;ap<amtPats.length;ap++){var am=text.match(amtPats[ap]);if(am){amount=am[1].replace(/,/g,'');break;}}
  if(!amount){var allN=text.match(/[0-9,]{4,}(?:\.[0-9]{2})?/g)||[];var biggest=0;allN.forEach(function(n){var v=parseFloat(n.replace(/,/g,''));if(v>biggest&&v<999999999)biggest=v;});if(biggest>0)amount=String(biggest);}

  // Date
  var dateVal=new Date().toISOString().slice(0,10);
  var dm2=text.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if(dm2){try{var d2=new Date(dm2[3]+'-'+dm2[2].padStart(2,'0')+'-'+dm2[1].padStart(2,'0'));if(!isNaN(d2.getTime()))dateVal=d2.toISOString().slice(0,10);}catch(e2){}}
  if(dateVal===new Date().toISOString().slice(0,10)){var d4=text.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
    if(d4){try{var d5=new Date(d4[1]+'-'+d4[2].padStart(2,'0')+'-'+d4[3].padStart(2,'0'));if(!isNaN(d5.getTime()))dateVal=d5.toISOString().slice(0,10);}catch(e3){}}
  }

  // Time
  var timeVal='';
  var timem=text.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*([APap][Mm])?/);
  if(timem){var h=parseInt(timem[1]),mn=timem[2],ap2=(timem[3]||'').toUpperCase();if(ap2==='PM'&&h<12)h+=12;if(ap2==='AM'&&h===12)h=0;timeVal=String(h).padStart(2,'0')+':'+mn;}

  // Sender
  var senderName=afterLabel([/(?:sender|from|initiator|account\s*name|debit\s*account\s*name)[:\s]+([A-Za-z ]{3,50})/i],text);
  var senderAcctNum='';
  var accNums=text.match(/\b([0-9]{10})\b/g)||[];
  if(accNums.length>0)senderAcctNum=accNums[0];

  // Recipient
  var recipName=afterLabel([/(?:recipient|beneficiary|credit\s*account\s*name|to\s*account\s*name)[:\s]+([A-Za-z ]{3,60})/i],text);
  var recipAcct=accNums.length>1?accNums[1]:'';
  var recipBank=afterLabel([/(?:recipient|beneficiary|to|credit)\s*bank[:\s]+([A-Za-z ]{3,30})/i],text);

  // Narration
  var narration=afterLabel([/(?:narration|description|remark|memo|reason|purpose)[:\s]+(.{4,80})/i],text);

  // Status
  var statusVal='verified';
  if(/SUCCESSFUL|SUCCESS|APPROVED|COMPLETED/i.test(text))statusVal='verified';
  else if(/PENDING|PROCESSING/i.test(text))statusVal='pending';
  else if(/FAILED|DECLINED|REJECTED|ERROR/i.test(text))statusVal='failed';

  return {txnId:txnId?txnId.toUpperCase():'',bankName,amount,dateVal,timeVal,senderName,senderAcctNum,recipName,recipAcct,recipBank,narration,statusVal};
}


// ═══════════════════════════════════════════════════════════════
// REVIEWS — Admin Tab
// ═══════════════════════════════════════════════════════════════
async function loadAdminReviews() {
  const el = document.getElementById('reviews-content');
  if (!el) return;
  el.innerHTML = '<div class="admin-section"><h2>&#x2B50; Product Reviews</h2><div id="reviews-list-wrap">Loading...</div></div>';
  try {
    const data = await api('GET', '/reviews');
    const reviews = Array.isArray(data) ? data : [];
    const wrap = document.getElementById('reviews-list-wrap');
    if (!reviews.length) { wrap.innerHTML = '<p style="color:rgba(255,255,255,.4)">No reviews yet.</p>'; return; }
    wrap.innerHTML = '<div style="display:flex;flex-direction:column;gap:14px">' + reviews.map(r => `
      <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:16px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
          <div>
            <div style="font-weight:700;color:#e0f0e0">${r.customer_name} <span style="color:rgba(255,255,255,.35);font-weight:400;font-size:.8rem">on Product #${r.product_id}</span></div>
            <div style="color:#fbbf24;font-size:1.1rem;margin:4px 0">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div>
            ${r.review_text ? `<div style="font-size:.87rem;color:rgba(255,255,255,.6);line-height:1.6;margin-top:4px">${r.review_text}</div>` : ''}
            <div style="font-size:.73rem;color:rgba(255,255,255,.3);margin-top:6px">${new Date(r.created_at).toLocaleDateString('en-NG', {day:'numeric',month:'short',year:'numeric'})}</div>
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0">
            <span class="status-badge ${r.approved ? 'status-confirmed' : 'status-pending'}">${r.approved ? '✅ Approved' : '⏳ Pending'}</span>
            ${!r.approved ? `<button onclick="approveReview(${r.id},true)" style="background:rgba(82,183,136,.2);border:1px solid rgba(82,183,136,.4);color:#52b788;border-radius:8px;padding:5px 12px;cursor:pointer;font-family:inherit;font-size:.8rem">&#x2714; Approve</button>` : ''}
            <button onclick="approveReview(${r.id},false);this.closest('[style]').remove()" style="background:rgba(248,113,113,.15);border:1px solid rgba(248,113,113,.3);color:#f87171;border-radius:8px;padding:5px 12px;cursor:pointer;font-family:inherit;font-size:.8rem">&#x1F5D1; Delete</button>
          </div>
        </div>
      </div>`).join('') + '</div>';
  } catch(e) { const w=document.getElementById('reviews-list-wrap'); if(w) w.innerHTML='<p style="color:#f87171">'+e.message+'</p>'; }
}
async function approveReview(id, approved) {
  try {
    if (!approved) { await api('DELETE', '/reviews/'+id); showAdminToast('Review deleted'); }
    else { await api('PATCH', '/reviews/'+id+'/approve', { approved: true }); showAdminToast('Review approved!'); }
    loadAdminReviews();
  } catch(e) { showAdminToast(e.message, 'error'); }
}

// ═══════════════════════════════════════════════════════════════
// CUSTOMER DATABASE — Admin Tab
// ═══════════════════════════════════════════════════════════════
async function loadCustomerDatabase() {
  const el = document.getElementById('customers-content');
  if (!el) return;
  el.innerHTML = '<div class="admin-section"><h2>&#x1F465; Customer Database</h2><div style="margin-bottom:16px;display:flex;gap:12px;flex-wrap:wrap"><input id="cust-search" type="text" placeholder="Search by name or phone..." oninput="filterCustomers()" style="flex:1;min-width:200px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:10px 14px;color:#fff;font-family:inherit;font-size:.87rem" /><button onclick="exportCustomersCSV()" style="background:rgba(82,183,136,.15);border:1px solid rgba(82,183,136,.35);color:#52b788;border-radius:10px;padding:10px 18px;cursor:pointer;font-family:inherit;font-size:.85rem;font-weight:700">&#x1F4E5; Export CSV</button></div><div id="customers-table-wrap">Loading...</div></div>';
  try {
    const data = await api('GET', '/analytics/customers');
    window._allCustomers = Array.isArray(data) ? data : (data.customers || []);
    renderCustomersTable(window._allCustomers);
  } catch(e) { const w=document.getElementById('customers-table-wrap'); if(w) w.innerHTML='<p style="color:#f87171">'+e.message+'</p>'; }
}
function filterCustomers() {
  const q=(document.getElementById('cust-search')?.value||'').toLowerCase();
  const filtered=(window._allCustomers||[]).filter(c=>(c.customer_name||'').toLowerCase().includes(q)||(c.customer_phone||'').includes(q));
  renderCustomersTable(filtered);
}
function renderCustomersTable(customers) {
  const wrap=document.getElementById('customers-table-wrap');
  if(!wrap) return;
  if(!customers.length){wrap.innerHTML='<p style="color:rgba(255,255,255,.4)">No customers found.</p>';return;}
  wrap.innerHTML='<div style="overflow-x:auto"><table class="admin-table"><thead><tr><th>Name</th><th>Phone</th><th>Orders</th><th>Total Spent</th><th>Last Order</th><th>Actions</th></tr></thead><tbody>'
    +customers.map(c=>'<tr><td style="font-weight:600">'+( c.customer_name||'-')+'</td><td style="font-family:monospace">'+(c.customer_phone||'-')+'</td><td style="text-align:center">'+(c.order_count||0)+'</td><td style="color:#fbbf24;font-weight:700">&#x20A6;'+Number(c.total_spend||0).toLocaleString()+'</td><td>'+(c.last_order_date?c.last_order_date.slice(0,10):'-')+'</td><td><a href="https://wa.me/'+(c.customer_phone||'').replace(/\D/g,'')+'" target="_blank" style="background:#25D366;color:#fff;border-radius:8px;padding:4px 10px;font-size:.75rem;font-weight:700;text-decoration:none;white-space:nowrap">&#x1F4F1; WhatsApp</a></td></tr>').join('')
    +'</tbody></table></div><p style="font-size:.78rem;color:rgba(255,255,255,.3);margin-top:10px">'+customers.length+' customers total</p>';
}
function exportCustomersCSV() {
  const customers=window._allCustomers||[];
  if(!customers.length){showAdminToast('No customers to export','error');return;}
  const header='Name,Phone,Orders,Total Spent,Last Order';
  const rows=customers.map(c=>[c.customer_name||'',c.customer_phone||'',c.order_count||0,c.total_spend||0,c.last_order_date||''].join(','));
  const csv=header+'\n'+rows.join('\n');
  const blob=new Blob([csv],{type:'text/csv'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='pinnacles-customers-'+new Date().toISOString().slice(0,10)+'.csv';a.click();
  URL.revokeObjectURL(url);
  showAdminToast('\u2705 Customers exported!');
}

// ═══════════════════════════════════════════════════════════════
// EXPENSE TRACKER — Admin Tab
// ═══════════════════════════════════════════════════════════════
async function loadExpenseTracker() {
  const el = document.getElementById('expenses-content');
  if (!el) return;
  const today = new Date().toISOString().slice(0,10);
  el.innerHTML = `<div class="admin-section">
    <h2>&#x1F4B8; Expense Tracker</h2>
    <div id="expense-summary-cards" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:24px">Loading summary...</div>
    <div class="receipt-verify-form" style="margin-bottom:28px">
      <div style="font-size:.85rem;font-weight:700;color:#a3d9b8;margin-bottom:14px">&#x2795; Add New Expense</div>
      <div class="form-grid-2">
        <div class="form-group"><label>Category</label>
          <select id="exp-cat" style="width:100%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:10px;color:#fff;font-family:inherit">
            <option value="seeds">Seeds</option><option value="fertilizer">Fertilizer</option><option value="labour">Labour</option>
            <option value="equipment">Equipment</option><option value="utilities">Utilities</option><option value="transport">Transport</option><option value="general">General</option>
          </select>
        </div>
        <div class="form-group"><label>Amount (&#x20A6;) *</label><input id="exp-amount" type="number" placeholder="5000" min="0" /></div>
      </div>
      <div class="form-group"><label>Description *</label><input id="exp-desc" type="text" placeholder="e.g. Bought 20kg NPK fertilizer" /></div>
      <div class="form-grid-2">
        <div class="form-group"><label>Date *</label><input id="exp-date" type="date" value="${today}" /></div>
        <div class="form-group"><label>Paid To</label><input id="exp-paid-to" type="text" placeholder="Supplier or person paid" /></div>
      </div>
      <button onclick="addExpense()" class="btn-primary" style="width:100%">&#x1F4BE; Save Expense</button>
    </div>
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap">
      <h3 style="font-size:1rem;color:#a3d9b8;margin:0">Recent Expenses</h3>
      <button onclick="exportExpensesCSV()" style="background:rgba(82,183,136,.15);border:1px solid rgba(82,183,136,.35);color:#52b788;border-radius:8px;padding:6px 14px;cursor:pointer;font-family:inherit;font-size:.8rem">&#x1F4E5; Export CSV</button>
    </div>
    <div id="expenses-list">Loading...</div>
  </div>`;
  loadExpenseSummary();
  loadExpensesList();
}
async function loadExpenseSummary() {
  try {
    const data=await api('GET','/expenses/summary');
    const wrap=document.getElementById('expense-summary-cards');
    if(!wrap) return;
    const cats={'seeds':'&#x1F331;','fertilizer':'&#x1F9EA;','labour':'&#x1F477;','equipment':'&#x1F528;','utilities':'&#x1F4A1;','transport':'&#x1F69A;','general':'&#x1F4CB;'};
    wrap.innerHTML=[
      {label:'This Month',val:'&#x20A6;'+Number(data.total_month||0).toLocaleString(),icon:'&#x1F4C5;'},
      {label:'This Year',val:'&#x20A6;'+Number(data.total_year||0).toLocaleString(),icon:'&#x1F4CA;'},
      {label:'All Time',val:'&#x20A6;'+Number(data.total_all||0).toLocaleString(),icon:'&#x1F4B0;'},
      {label:'Transactions',val:data.count||0,icon:'&#x1F4CB;'},
    ].map(s=>'<div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:16px;text-align:center"><div style="font-size:1.6rem;margin-bottom:6px">'+s.icon+'</div><div style="font-size:1.1rem;font-weight:800;color:#fbbf24">'+s.val+'</div><div style="font-size:.75rem;color:rgba(255,255,255,.45);margin-top:3px">'+s.label+'</div></div>').join('');
  } catch(e) {}
}
async function loadExpensesList() {
  const wrap=document.getElementById('expenses-list'); if(!wrap) return;
  try {
    const data=await api('GET','/expenses');
    const expenses=Array.isArray(data)?data:[];
    if(!expenses.length){wrap.innerHTML='<p style="color:rgba(255,255,255,.4)">No expenses recorded yet.</p>';return;}
    wrap.innerHTML='<div style="overflow-x:auto"><table class="admin-table"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>Paid To</th><th></th></tr></thead><tbody>'
      +expenses.map(e=>'<tr><td>'+e.expense_date+'</td><td><span class="status-badge status-pending">'+e.category+'</span></td><td>'+e.description+'</td><td style="color:#f87171;font-weight:700">&#x20A6;'+Number(e.amount).toLocaleString()+'</td><td>'+(e.paid_to||'-')+'</td><td><button onclick="deleteExpense('+e.id+')" style="background:rgba(248,113,113,.15);border:1px solid rgba(248,113,113,.3);color:#f87171;border-radius:6px;padding:3px 10px;cursor:pointer;font-size:.75rem">&#x1F5D1;</button></td></tr>').join('')
      +'</tbody></table></div>';
  } catch(e) { wrap.innerHTML='<p style="color:#f87171">'+e.message+'</p>'; }
}
async function addExpense() {
  const desc=(document.getElementById('exp-desc')?.value||'').trim();
  const amount=parseFloat(document.getElementById('exp-amount')?.value||0);
  const date=document.getElementById('exp-date')?.value;
  if(!desc||!amount||!date){showAdminToast('Description, amount and date are required','error');return;}
  try {
    await api('POST','/expenses',{category:document.getElementById('exp-cat')?.value||'general',description:desc,amount,expense_date:date,paid_to:(document.getElementById('exp-paid-to')?.value||'').trim()||null});
    showAdminToast('\u2705 Expense saved!');
    ['exp-desc','exp-amount','exp-paid-to'].forEach(id=>{var el=document.getElementById(id);if(el)el.value='';});
    loadExpenseSummary(); loadExpensesList();
  } catch(e) { showAdminToast(e.message,'error'); }
}
async function deleteExpense(id) {
  if(!confirm('Delete this expense?')) return;
  try { await api('DELETE','/expenses/'+id); showAdminToast('Deleted'); loadExpensesList(); loadExpenseSummary(); }
  catch(e) { showAdminToast(e.message,'error'); }
}
function exportExpensesCSV() {
  const rows=document.querySelectorAll('#expenses-list tbody tr');
  if(!rows.length){showAdminToast('No expenses to export','error');return;}
  let csv='Date,Category,Description,Amount,Paid To\n';
  rows.forEach(r=>{const cells=[...r.querySelectorAll('td')].map(c=>'"'+(c.textContent||'').replace(/[\n\r]+/g,' ').replace(/"/g,"'").trim()+'"');csv+=cells.join(',')+'\n';});
  const blob=new Blob([csv],{type:'text/csv'});const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='expenses-'+new Date().toISOString().slice(0,10)+'.csv';a.click();
  showAdminToast('\u2705 Expenses exported!');
}

// ═══════════════════════════════════════════════════════════════
// INVENTORY MANAGER — Admin Tab
// ═══════════════════════════════════════════════════════════════
async function loadInventoryManager() {
  const el = document.getElementById('inventory-content');
  if (!el) return;
  el.innerHTML = '<div class="admin-section"><h2>&#x1F4E6; Inventory Management</h2><div style="margin-bottom:14px;display:flex;gap:10px;flex-wrap:wrap"><label style="display:flex;align-items:center;gap:6px;color:rgba(255,255,255,.6);font-size:.85rem;cursor:pointer"><input type="checkbox" id="low-stock-only" onchange="filterInventory()"> Show low stock only (&le;5)</label></div><div id="inventory-table">Loading...</div></div>';
  try {
    const data=await api('GET','/products');
    window._inventoryProducts=Array.isArray(data)?data:(data.products||[]);
    renderInventoryTable(window._inventoryProducts);
  } catch(e) { const w=document.getElementById('inventory-table'); if(w) w.innerHTML='<p style="color:#f87171">'+e.message+'</p>'; }
}
function filterInventory() {
  const lowOnly=document.getElementById('low-stock-only')?.checked;
  const products=(window._inventoryProducts||[]);
  renderInventoryTable(lowOnly?products.filter(p=>Number(p.in_stock||0)<=5):products);
}
function renderInventoryTable(products) {
  const wrap=document.getElementById('inventory-table'); if(!wrap) return;
  if(!products.length){wrap.innerHTML='<p style="color:rgba(255,255,255,.4)">No products.</p>';return;}
  const rows = products.map(function(p) {
    const stock = Number(p.in_stock||0);
    const color = stock===0?'#f87171':stock<=5?'#fbbf24':'#52b788';
    const dec = 'var el=document.getElementById(\"inv-'+p.id+'\");el.value=Math.max(0,(parseInt(el.value)||0)-1)';
    const inc = 'var el=document.getElementById(\"inv-'+p.id+'\");el.value=(parseInt(el.value)||0)+1';
    return '<tr>'
      + '<td style="font-weight:600">'+(p.emoji||'')+'&nbsp;'+(p.name||'-')+'</td>'
      + '<td>'+(p.category||'-')+'</td>'
      + '<td style="font-weight:800;color:'+color+'">'+stock+'</td>'
      + '<td><div style="display:flex;align-items:center;gap:8px">'
      + '<button onclick="'+dec+'" style="width:28px;height:28px;border-radius:50%;border:1px solid rgba(255,255,255,.2);background:transparent;color:#fff;cursor:pointer;font-size:1rem">−</button>'
      + '<input id="inv-'+p.id+'" type="number" value="'+stock+'" min="0" style="width:60px;text-align:center;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:6px;color:#fff;font-family:inherit" />'
      + '<button onclick="'+inc+'" style="width:28px;height:28px;border-radius:50%;border:1px solid rgba(255,255,255,.2);background:transparent;color:#fff;cursor:pointer;font-size:1rem">+</button>'
      + '</div></td>'
      + '<td><button onclick="saveInventoryStock('+p.id+')" style="background:rgba(82,183,136,.2);border:1px solid rgba(82,183,136,.4);color:#52b788;border-radius:8px;padding:5px 12px;cursor:pointer;font-size:.8rem;font-family:inherit">&#x1F4BE; Save</button></td>'
      + '</tr>';
  });
  wrap.innerHTML='<div style="overflow-x:auto"><table class="admin-table"><thead><tr><th>Product</th><th>Category</th><th>Current Stock</th><th>Update Stock</th><th>Save</th></tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
}

async function saveInventoryStock(productId) {
  const el=document.getElementById('inv-'+productId); if(!el) return;
  try {
    await api('PATCH','/products/'+productId,{in_stock:parseInt(el.value)||0});
    showAdminToast('\u2705 Stock updated!');
    loadInventoryManager();
  } catch(e) { showAdminToast(e.message,'error'); }
}

// ═══════════════════════════════════════════════════════════════
// FLASH SALE MANAGER — Admin Tab
// ═══════════════════════════════════════════════════════════════
async function loadFlashSaleManager() {
  const el = document.getElementById('flash-sales-content');
  if (!el) return;
  const now = new Date();
  const inOneHour = new Date(now.getTime()+60*60*1000).toISOString().slice(0,16);
  const inSixHours = new Date(now.getTime()+6*60*60*1000).toISOString().slice(0,16);
  el.innerHTML = `<div class="admin-section">
    <h2>&#x26A1; Flash Sale Manager</h2>
    <p style="color:rgba(255,255,255,.4);font-size:.85rem;margin-bottom:20px">Create a timed discount that appears as a banner on the website for all shoppers.</p>
    <div class="receipt-verify-form" style="margin-bottom:28px">
      <div style="font-size:.85rem;font-weight:700;color:#a3d9b8;margin-bottom:14px">&#x26A1; Create New Flash Sale</div>
      <div class="form-group"><label>Sale Title *</label><input id="fs-title" type="text" placeholder="e.g. Friday Flash Sale! 🔥" /></div>
      <div class="form-grid-2">
        <div class="form-group"><label>Discount % *</label><input id="fs-discount" type="number" placeholder="20" min="1" max="90" /></div>
        <div class="form-group"><label>Applies To</label>
          <select id="fs-applies" style="width:100%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:10px;color:#fff;font-family:inherit">
            <option value="all">All Products</option>
            <option value="vegetables">Vegetables</option>
            <option value="fruits">Fruits</option>
            <option value="poultry">Poultry / Eggs</option>
          </select>
        </div>
      </div>
      <div class="form-grid-2">
        <div class="form-group"><label>Start Time</label><input id="fs-start" type="datetime-local" value="${inOneHour}" /></div>
        <div class="form-group"><label>End Time *</label><input id="fs-end" type="datetime-local" value="${inSixHours}" /></div>
      </div>
      <button onclick="createFlashSale()" class="btn-primary" style="width:100%">&#x26A1; Launch Flash Sale</button>
    </div>
    <h3 style="font-size:1rem;color:#a3d9b8;margin-bottom:14px">Recent Flash Sales</h3>
    <div id="flash-sales-list">Loading...</div>
    <hr style="border:none;border-top:1px solid rgba(255,255,255,.08);margin:28px 0">
    <h3 style="font-size:1rem;color:#a3d9b8;margin-bottom:14px">&#x1F3AB; Discount Codes</h3>
    <div class="receipt-verify-form" style="margin-bottom:20px">
      <div class="form-grid-2">
        <div class="form-group"><label>Code *</label><input id="dc-code" type="text" placeholder="e.g. FARM20" style="text-transform:uppercase" /></div>
        <div class="form-group"><label>Type</label>
          <select id="dc-type" style="width:100%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:10px;color:#fff;font-family:inherit">
            <option value="percent">Percent off (%)</option>
            <option value="flat">Flat amount (&#x20A6;)</option>
          </select>
        </div>
      </div>
      <div class="form-grid-2">
        <div class="form-group"><label>Value</label><input id="dc-value" type="number" placeholder="10" /></div>
        <div class="form-group"><label>Max Uses</label><input id="dc-uses" type="number" placeholder="100" /></div>
      </div>
      <div class="form-group"><label>Expiry Date (optional)</label><input id="dc-expires" type="date" /></div>
      <button onclick="createDiscountCode()" style="background:rgba(82,183,136,.15);border:1px solid rgba(82,183,136,.35);color:#52b788;border-radius:10px;padding:10px 20px;cursor:pointer;font-family:inherit;font-weight:700">&#x2795; Create Code</button>
    </div>
    <div id="discount-codes-list">Loading...</div>
  </div>`;
  loadFlashSalesList();
  loadDiscountCodesList();
}
async function createFlashSale() {
  const title=(document.getElementById('fs-title')?.value||'').trim();
  const discount=parseInt(document.getElementById('fs-discount')?.value||0);
  const end=document.getElementById('fs-end')?.value;
  if(!title||!discount||!end){showAdminToast('Title, discount and end time required','error');return;}
  try {
    await api('POST','/promotions/flash-sale',{title,discount_percent:discount,applies_to:document.getElementById('fs-applies')?.value||'all',starts_at:document.getElementById('fs-start')?.value||null,ends_at:end});
    showAdminToast('\u26A1 Flash sale launched!'); loadFlashSalesList();
  } catch(e) { showAdminToast(e.message,'error'); }
}
async function loadFlashSalesList() {
  const wrap=document.getElementById('flash-sales-list'); if(!wrap) return;
  try {
    const data=await api('GET','/promotions/flash-sales');
    const sales=Array.isArray(data)?data:[];
    if(!sales.length){wrap.innerHTML='<p style="color:rgba(255,255,255,.4)">No flash sales yet.</p>';return;}
    const now=new Date();
    wrap.innerHTML='<div style="display:flex;flex-direction:column;gap:10px">'+sales.map(s=>{
      const active=s.active&&new Date(s.ends_at)>now;
      return '<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:14px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div><div style="font-weight:700;color:#e0f0e0">'+s.title+'</div><div style="font-size:.78rem;color:rgba(255,255,255,.4);margin-top:3px">'+s.discount_percent+'% off &bull; '+s.applies_to+' &bull; Ends: '+new Date(s.ends_at).toLocaleString('en-NG')+'</div></div><div style="display:flex;gap:8px;align-items:center"><span class="status-badge '+(active?'status-confirmed':'status-cancelled')+'">'+(active?'&#x26A1; Live':'Ended')+'</span>'+(active?'<button onclick="endFlashSale('+s.id+')" style="background:rgba(248,113,113,.15);border:1px solid rgba(248,113,113,.3);color:#f87171;border-radius:8px;padding:4px 10px;cursor:pointer;font-size:.78rem;font-family:inherit">End Sale</button>':'')+'</div></div>';
    }).join('')+'</div>';
  } catch(e) { const w=document.getElementById('flash-sales-list'); if(w) w.innerHTML='<p style="color:#f87171">'+e.message+'</p>'; }
}
async function endFlashSale(id) {
  try { await api('PATCH','/promotions/flash-sale/'+id+'/end'); showAdminToast('Sale ended'); loadFlashSalesList(); }
  catch(e) { showAdminToast(e.message,'error'); }
}
async function createDiscountCode() {
  const code=(document.getElementById('dc-code')?.value||'').trim().toUpperCase();
  if(!code){showAdminToast('Code required','error');return;}
  try {
    await api('POST','/promotions/codes',{code,type:document.getElementById('dc-type')?.value||'percent',value:parseFloat(document.getElementById('dc-value')?.value||10),max_uses:parseInt(document.getElementById('dc-uses')?.value||100),expires_at:document.getElementById('dc-expires')?.value||null});
    showAdminToast('\u2705 Code created: '+code); loadDiscountCodesList();
  } catch(e) { showAdminToast(e.message,'error'); }
}
async function loadDiscountCodesList() {
  const wrap=document.getElementById('discount-codes-list'); if(!wrap) return;
  try {
    const data=await api('GET','/promotions/codes');
    const codes=Array.isArray(data)?data:[];
    if(!codes.length){wrap.innerHTML='<p style="color:rgba(255,255,255,.4)">No discount codes yet.</p>';return;}
    wrap.innerHTML='<div style="overflow-x:auto"><table class="admin-table"><thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Used</th><th>Max</th><th>Expires</th><th>Status</th><th></th></tr></thead><tbody>'
      +codes.map(c=>'<tr><td style="font-family:monospace;font-weight:700;color:#fbbf24">'+c.code+'</td><td>'+c.type+'</td><td>'+(c.type==='percent'?c.value+'%':'\u20a6'+c.value)+'</td><td>'+c.uses_count+'</td><td>'+c.max_uses+'</td><td>'+(c.expires_at||'Never')+'</td><td><span class="status-badge '+(c.active?'status-confirmed':'status-cancelled')+'">'+(c.active?'Active':'Inactive')+'</span></td><td><button onclick="toggleCode('+c.id+','+(!c.active)+')" style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);color:#fff;border-radius:6px;padding:3px 10px;cursor:pointer;font-size:.75rem">'+(c.active?'Disable':'Enable')+'</button></td></tr>').join('')
      +'</tbody></table></div>';
  } catch(e) { const w=document.getElementById('discount-codes-list'); if(w) w.innerHTML='<p style="color:#f87171">'+e.message+'</p>'; }
}
async function toggleCode(id, active) {
  try { await api('PATCH','/promotions/codes/'+id,{active}); loadDiscountCodesList(); }
  catch(e) { showAdminToast(e.message,'error'); }
}

// ═══════════════════════════════════════════════════════════════
// WHATSAPP TEMPLATES — Admin Tab
// ═══════════════════════════════════════════════════════════════
function loadWhatsAppTemplates() {
  const el = document.getElementById('wa-templates-content');
  if (!el) return;
  const templates = [
    { id:'confirm', label:'Order Confirmation', msg:'Hello {name}! \u2705 Your Pinnacles Farm order #{id} has been received.\n\nWe will confirm shortly. Thank you! \u{1F33F}' },
    { id:'ready', label:'Ready for Delivery', msg:'Great news {name}! \u{1F69A} Your Pinnacles Farm order #{id} is ready and on its way! \u{1F331}' },
    { id:'payment', label:'Payment Reminder', msg:'Hello {name}, just a reminder that payment for order #{id} (\u20a6{total}) is pending. Kindly make payment to proceed. Thank you!' },
    { id:'thankyou', label:'Thank You', msg:'Thank you {name} for shopping with Pinnacles Resource Centre Farm! \u{1F331} Hope you enjoy your fresh produce. See you again!' },
    { id:'newstock', label:'New Stock Alert', msg:'\u{1F6A8} Fresh {product} just harvested at Pinnacles Farm! \u{1F33F} Available now — farm.pinnaclescentre.ng | +2349037505632' },
    { id:'flashsale', label:'Flash Sale Alert', msg:'\u26A1 FLASH SALE at Pinnacles Farm! {discount}% OFF for the next {hours} hours only! Shop now: farm.pinnaclescentre.ng \u{1F525}' },
  ];
  const saved = JSON.parse(localStorage.getItem('pinnacles_wa_templates') || '{}');
  let html = '<div class="admin-section"><h2>&#x1F4AC; WhatsApp Message Templates</h2><p style="color:rgba(255,255,255,.4);font-size:.85rem;margin-bottom:20px">Edit and send directly. Use {name}, {id}, {total}, {product} as placeholders.</p><div style="display:flex;flex-direction:column;gap:18px">';
  templates.forEach(function(t) {
    const msg = (saved[t.id] || t.msg).replace(/</g,'&lt;').replace(/>/g,'&gt;');
    html += '<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:18px">'
      + '<div style="font-weight:700;color:#a3d9b8;margin-bottom:10px">'+t.label+'</div>'
      + '<textarea id="tmpl-'+t.id+'" rows="4" style="width:100%;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:10px;color:rgba(255,255,255,.7);font-family:inherit;font-size:.83rem;resize:vertical;margin-bottom:10px">'+msg+'</textarea>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap">'
      + '<input id="phone-'+t.id+'" type="tel" placeholder="Customer phone (08XXXXXXXXX)" style="flex:1;min-width:180px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:8px 12px;color:#fff;font-family:inherit;font-size:.83rem"/>'
      + '<button data-tmpl-save="'+t.id+'" style="background:rgba(82,183,136,.15);border:1px solid rgba(82,183,136,.35);color:#52b788;border-radius:8px;padding:8px 14px;cursor:pointer;font-family:inherit;font-size:.8rem">&#x1F4BE; Save</button>'
      + '<button data-tmpl-send="'+t.id+'" style="background:#25D366;color:#fff;border-radius:8px;padding:8px 14px;cursor:pointer;font-family:inherit;font-size:.8rem;font-weight:700;border:none">&#x1F4F1; Send</button>'
      + '</div></div>';
  });
  html += '</div></div>';
  el.innerHTML = html;
  // Attach event listeners after rendering
  el.querySelectorAll('[data-tmpl-save]').forEach(function(btn) {
    btn.addEventListener('click', function() { saveTemplate(this.getAttribute('data-tmpl-save')); });
  });
  el.querySelectorAll('[data-tmpl-send]').forEach(function(btn) {
    btn.addEventListener('click', function() { sendWATemplate(this.getAttribute('data-tmpl-send')); });
  });
}
function saveTemplate(id) {
  const saved=JSON.parse(localStorage.getItem('pinnacles_wa_templates')||'{}');
  saved[id]=(document.getElementById('tmpl-'+id)?.value||'');
  localStorage.setItem('pinnacles_wa_templates',JSON.stringify(saved));
  showAdminToast('\u2705 Template saved!');
}
function sendWATemplate(id) {
  const msg=(document.getElementById('tmpl-'+id)?.value||'').trim();
  const phone=(document.getElementById('phone-'+id)?.value||'').replace(/\D/g,'');
  if(!msg){showAdminToast('Message is empty','error');return;}
  const number=phone||'2349037505632';
  window.open('https://wa.me/'+number+'?text='+encodeURIComponent(msg),'_blank');
}

// ═══════════════════════════════════════════════════════════════
// ACTIVITY LOG — Admin Tab
// ═══════════════════════════════════════════════════════════════
async function loadActivityLog() {
  const el = document.getElementById('activity-content');
  if (!el) return;
  el.innerHTML = '<div class="admin-section"><h2>&#x1F4CB; Admin Activity Log</h2><div id="activity-log-list">Loading...</div></div>';
  try {
    const data = await api('GET', '/activity/logs');
    const logs = Array.isArray(data) ? data : (data.logs || []);
    const wrap = document.getElementById('activity-log-list');
    if (!logs.length) { wrap.innerHTML='<p style="color:rgba(255,255,255,.4)">No activity recorded yet.</p>'; return; }
    const actionColor={'login':'#52b788','logout':'rgba(255,255,255,.4)','DELETE':'#f87171','PATCH':'#fbbf24','POST':'#60a5fa','GET':'rgba(255,255,255,.3)'};
    wrap.innerHTML = '<div style="overflow-x:auto"><table class="admin-table"><thead><tr><th>Time</th><th>Admin</th><th>Action</th><th>Details</th></tr></thead><tbody>'
      + logs.map(l => {
        const color=actionColor[l.action]||actionColor[(l.method||'GET')]||'rgba(255,255,255,.5)';
        return '<tr><td style="font-size:.78rem;white-space:nowrap">'+new Date(l.created_at).toLocaleString('en-NG')+'</td><td style="font-weight:600">'+(l.admin_name||l.admin_email||'System')+'</td><td><span style="background:rgba(255,255,255,.05);color:'+color+';border:1px solid '+color+';border-radius:6px;padding:2px 8px;font-size:.75rem;font-family:monospace">'+(l.action||'')+'</span></td><td style="font-size:.78rem;color:rgba(255,255,255,.5)">'+(l.details||'').slice(0,80)+'</td></tr>';
      }).join('') + '</tbody></table></div>';
  } catch(e) { const w=document.getElementById('activity-log-list'); if(w) w.innerHTML='<p style="color:#f87171">'+e.message+'</p>'; }
}

// ═══════════════════════════════════════════════════════════════
// ADMIN USERS — Admin Tab
// ═══════════════════════════════════════════════════════════════
async function loadAdminUsersTab() {
  const el = document.getElementById('admin-users-tab-content');
  if (!el) return;
  el.innerHTML = '<div class="admin-section"><h2>&#x1F465; Admin Users</h2><div id="admin-users-list-wrap">Loading...</div><hr style="border:none;border-top:1px solid rgba(255,255,255,.08);margin:24px 0"><h3 style="font-size:1rem;color:#a3d9b8;margin-bottom:14px">&#x2795; Invite New Admin</h3><div class="receipt-verify-form"><div class="form-grid-2"><div class="form-group"><label>Full Name *</label><input id="new-admin-name" type="text" placeholder="Admin name" /></div><div class="form-group"><label>Username *</label><input id="new-admin-user" type="text" placeholder="username" /></div></div><div class="form-grid-2"><div class="form-group"><label>Password *</label><input id="new-admin-pass" type="password" placeholder="Minimum 8 chars" /></div><div class="form-group"><label>Role *</label><select id="new-admin-role" style="width:100%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:10px;color:#fff;font-family:inherit"><option value="ecomm_admin">&#x1F6D2; E-commerce Admin</option><option value="manager">&#x1F527; Manager</option><option value="accountant">&#x1F4B0; Accountant</option><option value="farm_admin">&#x1F33E; Farm Admin</option><option value="owner">&#x1F451; Owner</option></select></div></div><button onclick="createAdminUser()" class="btn-primary" style="width:100%">&#x2795; Create Admin Account</button></div></div>';
  try {
    const data = await api('GET', '/admin-users');
    const admins = Array.isArray(data) ? data : (data.admins || []);
    const wrap = document.getElementById('admin-users-list-wrap');
    const roleColors={'owner':'#fbbf24','manager':'#60a5fa','accountant':'#52b788','ecomm_admin':'#a78bfa','farm_admin':'#86efac'};
    const roleLabels={'owner':'&#x1F451; Owner','manager':'&#x1F527; Manager','accountant':'&#x1F4B0; Accountant','ecomm_admin':'&#x1F6D2; E-commerce','farm_admin':'&#x1F33E; Farm Admin'};
    wrap.innerHTML = admins.length ? '<div style="display:flex;flex-direction:column;gap:10px">'+admins.map(a=>'<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:14px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div><div style="font-weight:700;color:#e0f0e0">'+(a.name||a.username||a.email||'Admin')+'</div><div style="font-size:.78rem;color:rgba(255,255,255,.4)">'+(a.email||a.username||'')+'</div></div><div style="display:flex;gap:8px;align-items:center"><span style="background:rgba(255,255,255,.07);color:'+(roleColors[a.role||'ecomm_admin']||'#fff')+';border:1px solid '+(roleColors[a.role||'ecomm_admin']||'rgba(255,255,255,.2)')+';border-radius:20px;padding:3px 10px;font-size:.75rem;font-weight:700">'+(roleLabels[a.role||'ecomm_admin']||a.role||'admin')+'</span></div></div>').join('')+'</div>' : '<p style="color:rgba(255,255,255,.4)">No admin users found.</p>';
  } catch(e) { const w=document.getElementById('admin-users-list-wrap'); if(w) w.innerHTML='<p style="color:#f87171">'+e.message+'</p>'; }
}
async function createAdminUser() {
  const name=(document.getElementById('new-admin-name')?.value||'').trim();
  const username=(document.getElementById('new-admin-user')?.value||'').trim();
  const password=document.getElementById('new-admin-pass')?.value||'';
  const role=document.getElementById('new-admin-role')?.value||'ecomm_admin';
  if(!name||!username||password.length<8){showAdminToast('Name, username, and password (min 8 chars) required','error');return;}
  try {
    await api('POST','/admin-users',{name,username,password,role});
    showAdminToast('\u2705 Admin created: '+username);
    ['new-admin-name','new-admin-user','new-admin-pass'].forEach(id=>{var el=document.getElementById(id);if(el)el.value='';});
    loadAdminUsersTab();
  } catch(e) { showAdminToast(e.message,'error'); }
}
