
// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2 — Farm Operations Dashboard JS
// ═══════════════════════════════════════════════════════════════════════════

// ── Update showFoTab to handle new tabs ────────────────────────────────────
// (monkey-patch the tab loader map after original definition)
const _origShowFoTab = showFoTab;
function showFoTab(tab, el) {
  document.querySelectorAll('.fo-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.fo-nav-item').forEach(n => n.classList.remove('active'));
  const tabEl = document.getElementById('fotab-' + tab);
  if (tabEl) tabEl.classList.add('active');
  if (el) el.classList.add('active');
  const titles = {
    overview:'Farm Dashboard', fields:'Fields & Plots', plantings:'Planting Records',
    harvests:'Harvest Records', sprays:'Spraying Log', workers:'Farm Workers',
    attendance:'Attendance', inputs:'Inputs & Supplies', equipment:'Equipment',
    diary:'Farm Diary', reports:'Reports',
    crops:'Crop Varieties', payroll:'Payroll', team:'Team & Users',
  };
  document.getElementById('fo-topbar-title').textContent = titles[tab] || tab;
  const loaders = {
    fields:loadFields, plantings:loadPlantings, harvests:loadHarvests,
    sprays:loadSprays, workers:loadWorkers, attendance:loadAttendance,
    inputs:loadInputs, equipment:loadEquipment, diary:loadDiary,
    crops:loadCrops, payroll:initPayroll, team:loadTeam, reports:loadReports,
  };
  if (loaders[tab]) loaders[tab]();
}

// ── CROP VARIETIES ────────────────────────────────────────────────────────
async function loadCrops() {
  const rows = await foApi('GET', '/crops').catch(() => []);
  foState.crops = Array.isArray(rows) ? rows : [];
  const el = document.getElementById('crops-list');
  if (!rows.length) { el.innerHTML = '<p class="fo-empty">No crop varieties added yet. Add varieties to use them in planting records.</p>'; return; }
  el.innerHTML = rows.map(c => `
    <div class="fo-row">
      <div class="fo-row-main">
        <div class="fo-row-title">🌾 ${c.name} ${c.variety ? '— <em>' + c.variety + '</em>' : ''}</div>
        <div class="fo-row-meta">Category: ${c.category || '–'} · Days to harvest: ${c.days_to_harvest ? c.days_to_harvest + ' days' : '–'}</div>
        ${c.notes ? `<div class="fo-row-meta" style="font-style:italic">${c.notes}</div>` : ''}
      </div>
      <button onclick="deleteCrop(${c.id},'${c.name.replace(/'/g,"\\'")}' )" style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.25);color:#f87171;padding:5px 12px;border-radius:8px;font-size:.75rem;cursor:pointer;font-family:Outfit,sans-serif">Remove</button>
    </div>`).join('');
}

function openCropForm() {
  openModal('Add Crop Variety', `
    <div class="fo-form-row">
      <div class="fo-form-group"><label class="fo-label">Crop Name *</label><input class="fo-input" id="fc2-name" placeholder="e.g. Tomatoes" /></div>
      <div class="fo-form-group"><label class="fo-label">Variety</label><input class="fo-input" id="fc2-var" placeholder="e.g. Roma, Cherry" /></div>
    </div>
    <div class="fo-form-row">
      <div class="fo-form-group">
        <label class="fo-label">Category</label>
        <select class="fo-select" id="fc2-cat">
          <option value="vegetable">Vegetable</option>
          <option value="fruit">Fruit</option>
          <option value="grain">Grain / Cereal</option>
          <option value="legume">Legume</option>
          <option value="herb">Herb / Spice</option>
          <option value="tuber">Tuber / Root</option>
          <option value="poultry">Poultry</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div class="fo-form-group"><label class="fo-label">Days to Harvest</label><input type="number" class="fo-input" id="fc2-days" placeholder="e.g. 90" /></div>
    </div>
    <div class="fo-form-group"><label class="fo-label">Notes</label><textarea class="fo-textarea" id="fc2-notes" rows="2" placeholder="Planting tips, spacing, care notes..."></textarea></div>
    <div class="fo-modal-footer">
      <button class="fo-btn-secondary" onclick="closeFoModal()">Cancel</button>
      <button class="fo-btn-primary" onclick="saveCrop()">💾 Save Variety</button>
    </div>`);
}

async function saveCrop() {
  const body = { name: v('fc2-name'), variety: v('fc2-var'), category: v('fc2-cat'), days_to_harvest: v('fc2-days') || null, notes: v('fc2-notes') };
  if (!body.name) { foToast('❌ Crop name required'); return; }
  await foApi('POST', '/crops', body);
  foToast('✅ Crop variety added!');
  closeFoModal();
  loadCrops();
  foApi('GET', '/crops').then(c => { foState.crops = c; }).catch(() => {});
}

async function deleteCrop(id, name) {
  if (!confirm(`Remove "${name}" from crop varieties?`)) return;
  await foApi('DELETE', '/crops/' + id);
  foToast('Crop removed');
  loadCrops();
}

// ── GROWTH LOGS (modal inside plantings) ──────────────────────────────────
async function openGrowthLogs(plantingId, cropName) {
  const logs = await foApi('GET', '/growth-logs/' + plantingId).catch(() => []);
  const logsHtml = logs.length
    ? logs.map(l => `
        <div class="growth-log-entry">
          <div class="growth-log-header">
            <span style="font-size:.82rem;color:rgba(255,255,255,.6)">${fmtDate(l.log_date)} · By ${l.logged_by}</span>
            <span class="growth-stage">${l.stage}</span>
          </div>
          <div class="health-stars">${'★'.repeat(l.health_rating || 3)}${'☆'.repeat(5 - (l.health_rating || 3))}</div>
          ${l.height_cm ? `<div style="font-size:.8rem;color:rgba(255,255,255,.5);margin-top:4px">Height: ${l.height_cm} cm</div>` : ''}
          ${l.observations ? `<div style="font-size:.82rem;color:rgba(255,255,255,.7);margin-top:6px;line-height:1.5">${l.observations}</div>` : ''}
          ${l.photo_b64 ? `<img class="growth-photo" src="${l.photo_b64}" alt="Growth photo" />` : ''}
        </div>`).join('')
    : '<p style="color:rgba(255,255,255,.4);font-size:.85rem;padding:12px 0">No growth logs yet for this planting.</p>';

  openModal(`🌱 Growth Log — ${cropName}`, `
    <div style="margin-bottom:16px">${logsHtml}</div>
    <hr style="border-color:rgba(255,255,255,.08);margin-bottom:16px" />
    <h4 style="font-size:.85rem;color:#a3d9b8;margin-bottom:12px">+ Add Growth Log Entry</h4>
    <div class="fo-form-row">
      <div class="fo-form-group"><label class="fo-label">Date</label><input type="date" class="fo-input" id="gl-date" value="${today()}" /></div>
      <div class="fo-form-group">
        <label class="fo-label">Growth Stage</label>
        <select class="fo-select" id="gl-stage">
          <option value="germination">Germination</option>
          <option value="seedling">Seedling</option>
          <option value="vegetative" selected>Vegetative</option>
          <option value="flowering">Flowering</option>
          <option value="fruiting">Fruiting</option>
          <option value="harvest_ready">Harvest Ready</option>
          <option value="harvested">Harvested</option>
        </select>
      </div>
    </div>
    <div class="fo-form-row">
      <div class="fo-form-group">
        <label class="fo-label">Health Rating</label>
        <select class="fo-select" id="gl-health">
          <option value="5">⭐⭐⭐⭐⭐ Excellent</option>
          <option value="4">⭐⭐⭐⭐ Good</option>
          <option value="3" selected>⭐⭐⭐ Fair</option>
          <option value="2">⭐⭐ Poor</option>
          <option value="1">⭐ Critical</option>
        </select>
      </div>
      <div class="fo-form-group"><label class="fo-label">Height (cm)</label><input type="number" class="fo-input" id="gl-height" placeholder="Plant height" step="0.5" /></div>
    </div>
    <div class="fo-form-group"><label class="fo-label">Observations *</label><textarea class="fo-textarea" id="gl-obs" rows="3" placeholder="What did you observe? Growth progress, issues, treatment applied..."></textarea></div>
    <div class="fo-form-group">
      <label class="fo-label">Photo (optional)</label>
      <input type="file" id="gl-photo" accept="image/*" class="fo-input" style="padding:6px" onchange="previewGrowthPhoto(this)" />
      <img id="gl-photo-preview" style="display:none;width:100%;max-height:150px;object-fit:cover;border-radius:8px;margin-top:8px" />
    </div>
    <div class="fo-modal-footer">
      <button class="fo-btn-secondary" onclick="closeFoModal()">Close</button>
      <button class="fo-btn-primary" onclick="saveGrowthLog(${plantingId})">💾 Add Log Entry</button>
    </div>`);
}

function previewGrowthPhoto(input) {
  if (!input.files?.[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = document.getElementById('gl-photo-preview');
    img.src = e.target.result;
    img.style.display = 'block';
  };
  reader.readAsDataURL(input.files[0]);
}

async function saveGrowthLog(plantingId) {
  const photo = document.getElementById('gl-photo-preview');
  const photo_b64 = photo?.style.display !== 'none' ? photo.src : null;
  const body = {
    planting_id: plantingId, log_date: v('gl-date'), stage: v('gl-stage'),
    health_rating: parseInt(v('gl-health')) || 3, height_cm: v('gl-height') || null,
    observations: v('gl-obs'), photo_b64,
  };
  if (!body.observations) { foToast('❌ Please add your observations'); return; }
  await foApi('POST', '/growth-logs', body);
  foToast('✅ Growth log saved!');
  closeFoModal();
}

// Override loadPlantings to add growth log button
async function loadPlantings() {
  const rows = await foApi('GET', '/plantings').catch(() => []);
  const el   = document.getElementById('plantings-list');
  if (!rows.length) { el.innerHTML = '<p class="fo-empty">No planting records yet.</p>'; return; }
  el.innerHTML = rows.map(p => `
    <div class="fo-row">
      <div class="fo-row-main">
        <div class="fo-row-title">🌱 ${p.crop_name || 'Unknown crop'} — ${p.field_name || 'No field'}</div>
        <div class="fo-row-meta">Planted: ${fmtDate(p.date_planted)} · Qty: ${p.quantity || '–'} ${p.unit} · By: ${p.planted_by || '–'}</div>
        ${p.expected_harvest_date ? `<div class="fo-row-meta">Expected harvest: ${fmtDate(p.expected_harvest_date)}</div>` : ''}
        ${p.notes ? `<div class="fo-row-meta" style="font-style:italic">${p.notes}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        ${statusBadge(p.status)}
        <button onclick="openGrowthLogs(${p.id},'${(p.crop_name||'Crop').replace(/'/g,"\\'")}')" style="font-size:.72rem;background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.3);color:#60a5fa;padding:4px 10px;border-radius:8px;cursor:pointer;font-family:Outfit,sans-serif">📈 Growth Log</button>
        ${p.status === 'growing' ? `<button onclick="markHarvested(${p.id})" style="font-size:.72rem;background:rgba(82,183,136,.1);border:1px solid rgba(82,183,136,.3);color:#a3d9b8;padding:4px 10px;border-radius:8px;cursor:pointer;font-family:Outfit,sans-serif">Mark Harvested →</button>` : ''}
      </div>
    </div>`).join('');
}

// ── INPUT USAGE LOGGING (adds "Log Usage" button to inputs) ───────────────
async function loadInputs() {
  const rows = await foApi('GET', '/inputs').catch(() => []);
  const el   = document.getElementById('inputs-list');
  if (!rows.length) { el.innerHTML = '<p class="fo-empty">No inputs/supplies tracked yet.</p>'; return; }
  el.innerHTML = rows.map(i => {
    const low = Number(i.current_stock) <= Number(i.reorder_level);
    return `<div class="fo-row">
      <div class="fo-row-main">
        <div class="fo-row-title">📦 ${i.name}</div>
        <div class="fo-row-meta">${i.type} · Stock: <strong style="color:${low ? '#f87171' : '#52b788'}">${i.current_stock} ${i.unit}</strong> · Reorder at: ${i.reorder_level} ${i.unit}</div>
        <div class="fo-row-meta">Supplier: ${i.supplier || '–'} · Cost: NGN ${Number(i.cost_per_unit || 0).toLocaleString()}/${i.unit}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        ${low ? badge('Low Stock ⚠️', 'red') : badge('In Stock', 'green')}
        <div style="display:flex;gap:6px">
          <button onclick="openLogUsage(${i.id},'${i.name.replace(/'/g,"\\'")}','${i.unit}')" style="font-size:.72rem;background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.3);color:#fbbf24;padding:4px 10px;border-radius:8px;cursor:pointer;font-family:Outfit,sans-serif">Log Use</button>
          <button onclick="adjustStock(${i.id},'${i.name.replace(/'/g,"\\'")}',${i.current_stock},'${i.unit}')" style="font-size:.72rem;background:rgba(82,183,136,.1);border:1px solid rgba(82,183,136,.3);color:#a3d9b8;padding:4px 10px;border-radius:8px;cursor:pointer;font-family:Outfit,sans-serif">+ Restock</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function openLogUsage(inputId, inputName, unit) {
  openModal(`Log Usage — ${inputName}`, `
    <div class="fo-form-row">
      <div class="fo-form-group"><label class="fo-label">Quantity Used (${unit}) *</label><input type="number" class="fo-input" id="lu-qty" placeholder="0" step="0.1" /></div>
      <div class="fo-form-group"><label class="fo-label">Date</label><input type="date" class="fo-input" id="lu-date" value="${today()}" /></div>
    </div>
    <div class="fo-form-group"><label class="fo-label">Field / Area Used</label><select class="fo-select" id="lu-field"><option value="">General / Not field-specific</option>${fieldOptions()}</select></div>
    <div class="fo-form-group"><label class="fo-label">Purpose</label><input class="fo-input" id="lu-purpose" placeholder="e.g. Sprayed Block A against aphids" /></div>
    <div class="fo-form-group"><label class="fo-label">Notes</label><textarea class="fo-textarea" id="lu-notes" rows="2" placeholder="Additional notes..."></textarea></div>
    <div class="fo-modal-footer">
      <button class="fo-btn-secondary" onclick="closeFoModal()">Cancel</button>
      <button class="fo-btn-primary" onclick="saveInputUsage(${inputId})">💾 Log Usage (deducts stock)</button>
    </div>`);
}

async function saveInputUsage(inputId) {
  const qty = parseFloat(v('lu-qty'));
  if (!qty || qty <= 0) { foToast('❌ Enter a valid quantity'); return; }
  const body = { input_id: inputId, field_id: v('lu-field') || null, use_date: v('lu-date'), quantity_used: qty, purpose: v('lu-purpose'), notes: v('lu-notes') };
  await foApi('POST', '/input-usage', body);
  foToast('✅ Usage logged — stock updated');
  closeFoModal();
  loadInputs();
}

// ── PAYROLL ────────────────────────────────────────────────────────────────
function initPayroll() {
  const now = new Date();
  const sel = document.getElementById('pr-month');
  if (sel) sel.value = now.getMonth() + 1;
  const yr = document.getElementById('pr-year');
  if (yr) yr.value = now.getFullYear();
}

function openPayrollModal() { initPayroll(); }

async function loadPayroll() {
  const month = document.getElementById('pr-month')?.value || new Date().getMonth() + 1;
  const year  = document.getElementById('pr-year')?.value  || new Date().getFullYear();
  foToast('Calculating payroll…', 1500);
  const data = await foApi('GET', `/payroll/calculate?month=${month}&year=${year}`).catch(e => { foToast('❌ ' + e.message); return null; });
  if (!data) return;

  // Summary bar
  const summary = document.getElementById('payroll-summary');
  summary.style.display = 'block';
  document.getElementById('pr-period').textContent  = fmtDate(data.period_start) + ' → ' + fmtDate(data.period_end);
  document.getElementById('pr-count').textContent   = data.workers.length + ' workers';
  document.getElementById('pr-total').textContent   = 'NGN ' + Number(data.total_gross).toLocaleString('en-NG');

  const el = document.getElementById('payroll-list');
  if (!data.workers.length) { el.innerHTML = '<p class="fo-empty">No active workers found.</p>'; return; }
  el.innerHTML = data.workers.map(w => `
    <div class="payroll-row">
      <div class="payroll-worker">
        <div class="payroll-worker-name">👷 ${w.name}</div>
        <div class="payroll-worker-meta">${(w.role||'').replace('_',' ')} · ${w.pay_type} rate: NGN ${Number(w.pay_rate).toLocaleString()}</div>
      </div>
      <div class="payroll-amount">
        <div class="payroll-gross">NGN ${Number(w.gross).toLocaleString('en-NG')}</div>
        <div class="payroll-days">${w.days} day${w.days !== 1 ? 's' : ''} · ${w.hours} hrs</div>
        <button class="pay-btn ${w.already_paid ? 'paid' : ''}"
          onclick="${w.already_paid ? '' : `markPaid(${w.worker_id},'${w.name.replace(/'/g,"\\'")}',${w.gross},'${data.period_start}','${data.period_end}',${w.days},${w.hours})`}"
          ${w.already_paid ? 'disabled' : ''}>
          ${w.already_paid ? '✅ Paid' : '💳 Mark as Paid'}
        </button>
      </div>
    </div>`).join('');
}

async function markPaid(workerId, name, gross, periodStart, periodEnd, days, hours) {
  if (!confirm(`Mark NGN ${Number(gross).toLocaleString()} as paid to ${name}?`)) return;
  await foApi('POST', '/payroll/pay', {
    worker_id: workerId, period_start: periodStart, period_end: periodEnd,
    days_worked: days, hours_worked: hours, gross_pay: gross, net_pay: gross,
  });
  foToast(`✅ Payment recorded for ${name}`);
  loadPayroll();
}

// ── REPORTS (real data) ────────────────────────────────────────────────────
async function loadReports() {
  const reportsEl = document.getElementById('fotab-reports');
  if (!reportsEl) return;
  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();

  reportsEl.innerHTML = `<div style="padding:24px"><p style="color:rgba(255,255,255,.5);font-size:.88rem;margin-bottom:20px">Showing data for <strong style="color:#a3d9b8">${now.toLocaleString('en-NG',{month:'long',year:'numeric'})}</strong></p>
  <div id="report-content"><div class="fo-empty">Loading reports…</div></div></div>`;

  try {
    const [costs, harvests] = await Promise.all([
      foApi('GET', `/reports/costs?month=${month}&year=${year}`),
      foApi('GET', `/reports/harvest-summary?month=${month}&year=${year}`),
    ]);

    const profitColor = costs.profit >= 0 ? '' : ' red';
    document.getElementById('report-content').innerHTML = `

      <div class="report-section">
        <h4>💰 Financial Overview</h4>
        <div class="report-kpi-row">
          <div class="report-kpi"><div class="report-kpi-val">NGN ${Number(costs.revenue).toLocaleString('en-NG')}</div><div class="report-kpi-lbl">E-commerce Revenue</div></div>
          <div class="report-kpi"><div class="report-kpi-val">NGN ${Number(costs.labour_cost).toLocaleString('en-NG')}</div><div class="report-kpi-lbl">Labour Cost</div></div>
          <div class="report-kpi"><div class="report-kpi-val">NGN ${Number(costs.inputs_cost).toLocaleString('en-NG')}</div><div class="report-kpi-lbl">Inputs Cost</div></div>
          <div class="report-kpi"><div class="report-kpi-val${profitColor}">NGN ${Number(costs.profit).toLocaleString('en-NG')}</div><div class="report-kpi-lbl">${costs.profit >= 0 ? '✅ Estimated Profit' : '⚠️ Estimated Loss'}</div></div>
        </div>
      </div>

      <div class="report-section">
        <h4>🧺 Harvest Summary</h4>
        ${harvests.rows.length ? `
        <table class="report-table">
          <thead><tr><th>Crop</th><th>Grade</th><th>Total Harvested</th><th>Harvests</th></tr></thead>
          <tbody>
            ${harvests.rows.map(r => `<tr>
              <td>${r.crop_name || '–'}</td>
              <td><span class="fo-row-badge badge-${r.quality_grade === 'A' ? 'green' : r.quality_grade === 'B' ? 'yellow' : 'gray'}">Grade ${r.quality_grade}</span></td>
              <td><strong>${Number(r.total_qty).toFixed(1)} ${r.unit}</strong></td>
              <td>${r.harvest_count}</td>
            </tr>`).join('')}
          </tbody>
        </table>` : '<p class="fo-empty">No harvests recorded this month.</p>'}
      </div>

      <div class="report-section">
        <h4>📊 Orders Summary</h4>
        <div class="report-kpi-row" style="max-width:400px">
          <div class="report-kpi"><div class="report-kpi-val">${costs.order_count}</div><div class="report-kpi-lbl">Orders This Month</div></div>
          <div class="report-kpi"><div class="report-kpi-val">NGN ${Number(costs.revenue).toLocaleString('en-NG')}</div><div class="report-kpi-lbl">Total Revenue</div></div>
        </div>
      </div>
    `;
  } catch(e) {
    document.getElementById('report-content').innerHTML = `<p class="fo-empty">⚠️ Could not load report: ${e.message}</p>`;
  }
}

// ── TEAM / USER MANAGEMENT ─────────────────────────────────────────────────
async function loadTeam() {
  const rows = await foApi('GET', '/team').catch(() => []);
  const el   = document.getElementById('team-list');
  if (!rows.length) { el.innerHTML = '<p class="fo-empty">No team members found.</p>'; return; }

  const roleClass = { super_admin:'role-super', ecomm_admin:'role-ecomm', farm_manager:'role-farm', farm_worker:'role-worker', finance:'role-finance' };
  const roleIcon  = { super_admin:'👑', ecomm_admin:'📦', farm_manager:'🌾', farm_worker:'👷', finance:'💰' };

  el.innerHTML = rows.map(u => `
    <div class="team-member-row">
      <div class="team-avatar">${roleIcon[u.role] || '👤'}</div>
      <div class="team-info">
        <div class="team-name">${u.name}</div>
        <div class="team-email">${u.email}</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <span class="role-pill ${roleClass[u.role] || 'role-worker'}">${u.role?.replace('_', ' ')}</span>
        <select onchange="updateUserRole(${u.id}, this.value)" class="fo-select" style="width:150px;font-size:.78rem;padding:5px 8px">
          <option value="super_admin"   ${u.role==='super_admin'  ?'selected':''}>👑 super_admin</option>
          <option value="ecomm_admin"   ${u.role==='ecomm_admin'  ?'selected':''}>📦 ecomm_admin</option>
          <option value="farm_manager"  ${u.role==='farm_manager' ?'selected':''}>🌾 farm_manager</option>
          <option value="farm_worker"   ${u.role==='farm_worker'  ?'selected':''}>👷 farm_worker</option>
          <option value="finance"       ${u.role==='finance'      ?'selected':''}>💰 finance</option>
        </select>
      </div>
    </div>`).join('');
}

async function updateUserRole(id, role) {
  await foApi('PATCH', '/team/' + id + '/role', { role }).catch(e => {
    // team endpoint isn't a farm route — use admin-users
  });
  // Try admin-users endpoint
  const token = foToken();
  await fetch('/api/admin-users/' + id + '/role', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ role }),
  }).catch(() => {});
  foToast('✅ Role updated');
  loadTeam();
}

function openNewUserModal() {
  openModal('Add Team Member', `
    <div class="fo-form-group"><label class="fo-label">Full Name *</label><input class="fo-input" id="nu-name" placeholder="Full name" /></div>
    <div class="fo-form-group"><label class="fo-label">Email Address *</label><input type="email" class="fo-input" id="nu-email" placeholder="Email address" /></div>
    <div class="fo-form-group"><label class="fo-label">Temporary Password *</label><input type="password" class="fo-input" id="nu-pass" placeholder="Set a temporary password" /></div>
    <div class="fo-form-group">
      <label class="fo-label">Role</label>
      <select class="fo-select" id="nu-role">
        <option value="farm_worker">👷 Farm Worker</option>
        <option value="farm_manager">🌾 Farm Manager</option>
        <option value="ecomm_admin">📦 E-commerce Admin</option>
        <option value="finance">💰 Finance</option>
        <option value="super_admin">👑 Super Admin</option>
      </select>
    </div>
    <div class="fo-modal-footer">
      <button class="fo-btn-secondary" onclick="closeFoModal()">Cancel</button>
      <button class="fo-btn-primary" onclick="createNewUser()">➕ Create Account</button>
    </div>`);
}

async function createNewUser() {
  const body = { name: v('nu-name'), email: v('nu-email'), password: v('nu-pass'), role: v('nu-role') };
  if (!body.name || !body.email || !body.password) { foToast('❌ All fields required'); return; }
  const token = foToken();
  const res = await fetch('/api/admin-users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) { foToast('❌ ' + (data.error || 'Failed')); return; }
  foToast('✅ Team member created!');
  closeFoModal();
  loadTeam();
}
