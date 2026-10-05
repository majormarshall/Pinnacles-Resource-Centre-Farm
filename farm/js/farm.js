
// ?? TOAST HELPER ??????????????????????????????????????????
function showFoToast(msg, isError = false) {
  let t = document.getElementById('fo-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'fo-toast';
    t.className = 'fo-toast';
    t.style.cssText = 'position:fixed;bottom:32px;right:32px;padding:12px 24px;border-radius:50px;font-weight:600;font-size:.9rem;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.3);transition:opacity 0.3s;';
    document.body.appendChild(t);
  }
  t.style.background = isError ? 'var(--red)' : 'var(--green)';
  t.style.color = '#fff';
  t.textContent = (isError ? '❌ ' : '✅ ') + msg.replace('?', '');
  t.style.display = 'block';
  t.style.opacity = '1';
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.style.display = 'none', 300); }, 3000);
}
// Farm Operations Dashboard \u2014 farm/js/farm.js
'use strict';

const FO_API_BASE = '/api/farm';
const AUTH_TOKEN_KEY = 'pinnacles_admin_token';
let foUser = null;
let foState = { fields: [], crops: [], workers: [] }; // cached reference data

// \u2500\u2500 Auth \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function doLogin() {
  const username = (document.getElementById('l-email') || document.getElementById('l-user'))?.value.trim();
  const pass     = document.getElementById('l-pass').value;
  const errEl    = document.getElementById('login-error');
  errEl.style.display = 'none';
  if (!username || !pass) { errEl.textContent = 'Please enter username and password'; errEl.style.display = 'block'; return; }
  try {
    const res  = await fetch('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username, password:pass}) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    localStorage.setItem(AUTH_TOKEN_KEY, data.token);
    foUser = data.user || { name: 'Admin', role: 'super_admin' };
    showApp();
  } catch(e) {
    errEl.textContent = e.message;
    errEl.style.display = 'block';
  }
}

function doLogout() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  document.getElementById('main-app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('main-app').style.display = 'flex';
  const info = document.getElementById('fo-user-info');
  if (info) info.innerHTML = `<strong style="color:#a3d9b8">${foUser?.name || 'Farm Manager'}</strong><br/><span style="color:rgba(255,255,255,.4);font-size:.72rem">${foUser?.role || 'admin'}</span>`;
  loadOverviewData();
  loadReferenceData();
}

// \u2500\u2500 Helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function foToken() { return localStorage.getItem(AUTH_TOKEN_KEY) || ''; }

async function foApi(method, endpoint, body) {
  const opts = { method, headers: { 'Content-Type':'application/json', 'Authorization':'Bearer ' + foToken() } };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(FO_API_BASE + endpoint, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API error');
  return data;
}

function foToast(msg, duration=2800) {
  const el = document.getElementById('fo-toast');
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, duration);
}

function fmtDate(d) {
  if (!d) return '\u2014';
  return new Date(d).toLocaleDateString('en-NG', { day:'2-digit', month:'short', year:'numeric' });
}

function badge(text, color='gray') {
  return `<span class="fo-row-badge badge-${color}">${text}</span>`;
}

function statusBadge(s) {
  const m = { active:'green', operational:'green', growing:'green', harvested:'blue', completed:'blue', dormant:'yellow', maintenance:'yellow', inactive:'gray', cancelled:'red', 'out-of-stock':'red' };
  return badge(s, m[s] || 'gray');
}

// \u2500\u2500 Tabs \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function showFoTab(tab, el) {
  document.querySelectorAll('.fo-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.fo-nav-item').forEach(n => n.classList.remove('active'));
  const tabEl = document.getElementById('fotab-' + tab);
  if (tabEl) tabEl.classList.add('active');
  if (el) el.classList.add('active');
  const titles = { overview:'Farm Dashboard', fields:'Fields & Plots', plantings:'Planting Records', harvests:'Harvest Records', sprays:'Spraying Log', workers:'Farm Workers', attendance:'Attendance', inputs:'Inputs & Supplies', equipment:'Equipment', diary:'Farm Diary', reports:'Reports' };
  document.getElementById('fo-topbar-title').textContent = titles[tab] || tab;
  const loaders = { fields:loadFields, plantings:loadPlantings, harvests:loadHarvests, sprays:loadSprays, workers:loadWorkers, attendance:loadAttendance, inputs:loadInputs, equipment:loadEquipment, diary:loadDiary };
  if (loaders[tab]) loaders[tab]();
}

// \u2500\u2500 Overview \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function loadOverviewData() {
  try {
    const d = await foApi('GET', '/dashboard');
    document.getElementById('st-fields').textContent    = d.fields;
    document.getElementById('st-plantings').textContent = d.plantings;
    document.getElementById('st-harvests').textContent  = d.harvests_30d;
    document.getElementById('st-workers').textContent   = d.workers;
    document.getElementById('st-harvest-kg').textContent= d.harvest_kg_30d.toFixed(1) + ' kg';
    document.getElementById('st-sprays').textContent    = d.sprays_7d;
    const diaryEl = document.getElementById('recent-diary-list');
    if (d.recent_diary?.length) {
      diaryEl.innerHTML = d.recent_diary.map(e => `
        <div class="diary-entry">
          <div class="diary-entry-header">
            <span class="diary-entry-date">${fmtDate(e.entry_date)}</span>
            <span class="diary-entry-cat">${e.category}</span>
          </div>
          ${e.title ? `<div class="diary-entry-title">${e.title}</div>` : ''}
          <div class="diary-entry-body">${e.content.slice(0,120)}${e.content.length>120?'\u2026':''}</div>
        </div>`).join('');
    }
  } catch(e) { console.error('Dashboard load:', e.message); }
}

// \u2500\u2500 Reference data (cached) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function loadReferenceData() {
  try {
    const [f, c, w] = await Promise.all([
      foApi('GET', '/fields'),
      foApi('GET', '/crops'),
      foApi('GET', '/workers'),
    ]);
    foState.fields  = Array.isArray(f) ? f : [];
    foState.crops   = Array.isArray(c) ? c : [];
    foState.workers = Array.isArray(w) ? w : [];
  } catch(e) { console.warn('Ref data:', e.message); }
}

function fieldOptions(selected) {
  return foState.fields.map(f => `<option value="${f.id}" ${selected==f.id?'selected':''}>${f.name}</option>`).join('');
}
function cropOptions(selected) {
  return foState.crops.map(c => `<option value="${c.id}" ${selected==c.id?'selected':''}>${c.name}</option>`).join('');
}
function workerOptions(selected) {
  return foState.workers.map(w => `<option value="${w.id}" ${selected==w.id?'selected':''}>${w.name}</option>`).join('');
}

// \u2500\u2500 FIELDS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function loadFields() {
  const rows = await foApi('GET', '/fields').catch(() => []);
  const el   = document.getElementById('fields-list');
  if (!rows.length) { el.innerHTML = '<p class="fo-empty">No fields added yet. Click + Add Field to get started.</p>'; return; }
  el.innerHTML = rows.map(f => `
    <div class="fo-row">
      <div class="fo-row-main">
        <div class="fo-row-title">\u{1F5FA}\uFE0F ${f.name}</div>
        <div class="fo-row-meta">${f.type} \u00B7 ${f.size_sqm ? f.size_sqm + ' m\u00B2' : 'Size not set'} \u00B7 ${f.location || 'No location'} \u00B7 Soil: ${f.soil_type || '\u2013'}</div>
        ${f.notes ? `<div class="fo-row-meta" style="margin-top:4px;font-style:italic">${f.notes}</div>` : ''}
      </div>
      ${statusBadge(f.status)}
    </div>`).join('');
}

function openFieldForm() {
  openModal('Add Field / Plot', `
    <div class="fo-form-group"><label class="fo-label">Field Name *</label><input class="fo-input" id="ff-name" placeholder="e.g. Block A, Greenhouse 1, Nursery" /></div>
    <div class="fo-form-row">
      <div class="fo-form-group">
        <label class="fo-label">Type</label>
        <select class="fo-select" id="ff-type">
          <option value="open_field">Open Field</option>
          <option value="greenhouse">Greenhouse</option>
          <option value="nursery">Nursery</option>
          <option value="raised_bed">Raised Bed</option>
          <option value="orchard">Orchard</option>
          <option value="pond">Fish Pond</option>
          <option value="poultry">Poultry House</option>
        </select>
      </div>
      <div class="fo-form-group"><label class="fo-label">Size (m\u00B2)</label><input type="number" class="fo-input" id="ff-size" placeholder="e.g. 500" /></div>
    </div>
    <div class="fo-form-row">
      <div class="fo-form-group"><label class="fo-label">Location</label><input class="fo-input" id="ff-loc" placeholder="e.g. North side" /></div>
      <div class="fo-form-group"><label class="fo-label">Soil Type</label><input class="fo-input" id="ff-soil" placeholder="e.g. Loamy" /></div>
    </div>
    <div class="fo-form-group"><label class="fo-label">Notes</label><textarea class="fo-textarea" id="ff-notes" placeholder="Any notes about this field..."></textarea></div>
    <div class="fo-modal-footer">
      <button class="fo-btn-secondary" onclick="closeFoModal()">Cancel</button>
      <button class="fo-btn-primary" onclick="saveField()">\u{1F4BE} Save Field</button>
    </div>`);
}

async function saveField() {
  const body = { name:v('ff-name'), type:v('ff-type'), size_sqm:v('ff-size')||null, location:v('ff-loc'), soil_type:v('ff-soil'), notes:v('ff-notes') };
  if (!body.name) { foToast('\u274C Field name is required'); return; }
  await foApi('POST', '/fields', body);
  foToast('\u2705 Field added!');
  closeFoModal();
  loadFields();
  foApi('GET','/fields').then(f => foState.fields = f).catch(()=>{});
}

// \u2500\u2500 PLANTINGS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function loadPlantings() {
  const rows = await foApi('GET', '/plantings').catch(() => []);
  const el   = document.getElementById('plantings-list');
  if (!rows.length) { el.innerHTML = '<p class="fo-empty">No planting records yet.</p>'; return; }
  el.innerHTML = rows.map(p => `
    <div class="fo-row">
      <div class="fo-row-main">
        <div class="fo-row-title">\u{1F331} ${p.crop_name || 'Unknown crop'} \u2014 ${p.field_name || 'No field'}</div>
        <div class="fo-row-meta">Planted: ${fmtDate(p.date_planted)} \u00B7 Qty: ${p.quantity || '\u2013'} ${p.unit} \u00B7 By: ${p.planted_by || '\u2013'}</div>
        ${p.expected_harvest_date ? `<div class="fo-row-meta">Expected harvest: ${fmtDate(p.expected_harvest_date)}</div>` : ''}
        ${p.notes ? `<div class="fo-row-meta" style="font-style:italic">${p.notes}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
        ${statusBadge(p.status)}
        ${p.status === 'growing' ? `<button onclick="markHarvested(${p.id})" style="font-size:.72rem;background:rgba(82,183,136,.1);border:1px solid rgba(82,183,136,.3);color:#a3d9b8;padding:4px 10px;border-radius:8px;cursor:pointer;font-family:Outfit,sans-serif">Mark Harvested \u2192</button>` : ''}
      </div>
    </div>`).join('');
}

function openPlantingForm() {
  openModal('Record New Planting', `
    <div class="fo-form-row">
      <div class="fo-form-group"><label class="fo-label">Field / Plot</label><select class="fo-select" id="fp-field"><option value="">Select field</option>${fieldOptions()}</select></div>
      <div class="fo-form-group"><label class="fo-label">Crop</label><select class="fo-select" id="fp-crop"><option value="">Select crop</option>${cropOptions()}</select></div>
    </div>
    <div class="fo-form-row">
      <div class="fo-form-group"><label class="fo-label">Date Planted *</label><input type="date" class="fo-input" id="fp-date" value="${today()}" /></div>
      <div class="fo-form-group"><label class="fo-label">Expected Harvest</label><input type="date" class="fo-input" id="fp-exp" /></div>
    </div>
    <div class="fo-form-row">
      <div class="fo-form-group"><label class="fo-label">Quantity</label><input type="number" class="fo-input" id="fp-qty" placeholder="e.g. 200" /></div>
      <div class="fo-form-group"><label class="fo-label">Unit</label><select class="fo-select" id="fp-unit"><option>seedlings</option><option>seeds</option><option>kg</option><option>cuttings</option><option>rows</option></select></div>
    </div>
    <div class="fo-form-group"><label class="fo-label">Planted By</label><input class="fo-input" id="fp-by" placeholder="Worker name or team" value="${foUser?.name||''}" /></div>
    <div class="fo-form-group"><label class="fo-label">Notes</label><textarea class="fo-textarea" id="fp-notes" placeholder="Variety, spacing, method..."></textarea></div>
    <div class="fo-modal-footer">
      <button class="fo-btn-secondary" onclick="closeFoModal()">Cancel</button>
      <button class="fo-btn-primary" onclick="savePlanting()">\u{1F4BE} Save Planting</button>
    </div>`);
}

async function savePlanting() {
  const body = { field_id:v('fp-field')||null, crop_id:v('fp-crop')||null, planted_by:v('fp-by'), date_planted:v('fp-date'), quantity:v('fp-qty'), unit:v('fp-unit'), expected_harvest_date:v('fp-exp')||null, notes:v('fp-notes') };
  if (!body.date_planted) { foToast('\u274C Date planted is required'); return; }
  await foApi('POST', '/plantings', body);
  foToast('\u2705 Planting recorded!');
  closeFoModal();
  loadPlantings();
}

async function markHarvested(plantingId) {
  await foApi('PATCH', '/plantings/' + plantingId + '/status', { status: 'harvested' });
  foToast('\u2705 Marked as harvested');
  loadPlantings();
}

// \u2500\u2500 HARVESTS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function loadHarvests() {
  const rows = await foApi('GET', '/harvests').catch(() => []);
  const el   = document.getElementById('harvests-list');
  if (!rows.length) { el.innerHTML = '<p class="fo-empty">No harvest records yet.</p>'; return; }
  el.innerHTML = rows.map(h => `
    <div class="fo-row">
      <div class="fo-row-main">
        <div class="fo-row-title">\u{1F9FA} ${h.crop_name || 'Unknown'} \u2014 ${h.quantity} ${h.unit}</div>
        <div class="fo-row-meta">Harvested: ${fmtDate(h.harvest_date)} \u00B7 Field: ${h.field_name || '\u2013'} \u00B7 By: ${h.harvested_by || '\u2013'}</div>
        <div class="fo-row-meta">Grade: ${h.quality_grade} \u00B7 ${h.sent_to_store ? '\u{1F3EA} Sent to store' : '\u{1F4E6} On-farm'}</div>
        ${h.notes ? `<div class="fo-row-meta" style="font-style:italic">${h.notes}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        ${badge('Grade ' + h.quality_grade, h.quality_grade === 'A' ? 'green' : h.quality_grade === 'B' ? 'yellow' : 'gray')}
        ${!h.sent_to_store
          ? `<button onclick="sendHarvestToStore(${h.id})" style="font-size:.72rem;background:rgba(82,183,136,.1);border:1px solid rgba(82,183,136,.3);color:#a3d9b8;padding:4px 10px;border-radius:8px;cursor:pointer;font-family:Outfit,sans-serif;margin-top:2px">\u{1F3EA} Send to Store</button>`
          : `<span style="font-size:.7rem;color:#52b788;margin-top:2px">\u{1F3EA} In Store</span>`}
      </div>
    </div>`).join('');
}

function openHarvestForm() {
  openModal('Log Harvest', `
    <div class="fo-form-row">
      <div class="fo-form-group"><label class="fo-label">Crop Name *</label><input class="fo-input" id="fh-crop" placeholder="e.g. Tomatoes" list="crop-list" /><datalist id="crop-list">${foState.crops.map(c=>`<option value="${c.name}">`).join('')}</datalist></div>
      <div class="fo-form-group"><label class="fo-label">Harvest Date *</label><input type="date" class="fo-input" id="fh-date" value="${today()}" /></div>
    </div>
    <div class="fo-form-row">
      <div class="fo-form-group"><label class="fo-label">Quantity *</label><input type="number" class="fo-input" id="fh-qty" placeholder="e.g. 50" step="0.1" /></div>
      <div class="fo-form-group"><label class="fo-label">Unit</label><select class="fo-select" id="fh-unit"><option>kg</option><option>basket</option><option>crate</option><option>bag</option><option>bunch</option><option>pieces</option></select></div>
    </div>
    <div class="fo-form-row">
      <div class="fo-form-group"><label class="fo-label">Quality Grade</label><select class="fo-select" id="fh-grade"><option value="A">A \u2014 Premium</option><option value="B">B \u2014 Standard</option><option value="C">C \u2014 Processing</option></select></div>
      <div class="fo-form-group"><label class="fo-label">Harvested By</label><input class="fo-input" id="fh-by" value="${foUser?.name||''}" /></div>
    </div>
    <div class="fo-form-group"><label class="fo-label"><input type="checkbox" id="fh-store" style="margin-right:8px" />Sent directly to store / e-commerce</label></div>
    <div class="fo-form-group"><label class="fo-label">Notes</label><textarea class="fo-textarea" id="fh-notes" placeholder="Observations about this harvest..."></textarea></div>
    <div class="fo-modal-footer">
      <button class="fo-btn-secondary" onclick="closeFoModal()">Cancel</button>
      <button class="fo-btn-primary" onclick="saveHarvest()">\u{1F4BE} Save Harvest</button>
    </div>`);
}

async function saveHarvest() {
  const body = { crop_name:v('fh-crop'), harvest_date:v('fh-date'), quantity:v('fh-qty'), unit:v('fh-unit'), quality_grade:v('fh-grade'), harvested_by:v('fh-by'), sent_to_store: document.getElementById('fh-store')?.checked?1:0, notes:v('fh-notes') };
  if (!body.crop_name || !body.harvest_date || !body.quantity) { foToast('\u274C Crop, date and quantity are required'); return; }
  await foApi('POST', '/harvests', body);
  foToast('\u2705 Harvest logged!');
  closeFoModal();
  loadHarvests();
}

// \u2500\u2500 SPRAYS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function loadSprays() {
  const rows = await foApi('GET', '/sprays').catch(() => []);
  const el   = document.getElementById('sprays-list');
  if (!rows.length) { el.innerHTML = '<p class="fo-empty">No spray records yet.</p>'; return; }
  el.innerHTML = rows.map(s => `
    <div class="fo-row">
      <div class="fo-row-main">
        <div class="fo-row-title">\u{1F4A7} ${s.chemical_name} \u2014 ${s.field_name || 'All fields'}</div>
        <div class="fo-row-meta">Date: ${fmtDate(s.spray_date)} \u00B7 Dosage: ${s.dosage || '\u2013'} \u00B7 Area: ${s.area_sprayed || '\u2013'}</div>
        <div class="fo-row-meta">By: ${s.sprayed_by || '\u2013'} \u00B7 Weather: ${s.weather_conditions || '\u2013'} \u00B7 PHI: ${s.pre_harvest_interval ? s.pre_harvest_interval + ' days' : '\u2013'}</div>
        ${s.notes ? `<div class="fo-row-meta" style="font-style:italic">${s.notes}</div>` : ''}
      </div>
      ${badge('Spray Record', 'blue')}
    </div>`).join('');
}

function openSprayForm() {
  openModal('Log Spraying / Fumigation', `
    <div class="fo-form-row">
      <div class="fo-form-group"><label class="fo-label">Chemical / Product Name *</label><input class="fo-input" id="fs-chem" placeholder="e.g. Karate insecticide" /></div>
      <div class="fo-form-group"><label class="fo-label">Field / Area</label><select class="fo-select" id="fs-field"><option value="">All fields</option>${fieldOptions()}</select></div>
    </div>
    <div class="fo-form-row">
      <div class="fo-form-group"><label class="fo-label">Date Sprayed *</label><input type="date" class="fo-input" id="fs-date" value="${today()}" /></div>
      <div class="fo-form-group"><label class="fo-label">Dosage</label><input class="fo-input" id="fs-dose" placeholder="e.g. 5ml/L" /></div>
    </div>
    <div class="fo-form-row">
      <div class="fo-form-group"><label class="fo-label">Area Sprayed</label><input class="fo-input" id="fs-area" placeholder="e.g. Entire Block A" /></div>
      <div class="fo-form-group"><label class="fo-label">Weather</label><input class="fo-input" id="fs-weather" placeholder="e.g. Sunny, calm" /></div>
    </div>
    <div class="fo-form-row">
      <div class="fo-form-group"><label class="fo-label">Pre-Harvest Interval (days)</label><input type="number" class="fo-input" id="fs-phi" placeholder="e.g. 7" /></div>
      <div class="fo-form-group"><label class="fo-label">Sprayed By</label><input class="fo-input" id="fs-by" value="${foUser?.name||''}" /></div>
    </div>
    <div class="fo-form-group"><label class="fo-label">Notes</label><textarea class="fo-textarea" id="fs-notes" placeholder="Pest/disease being treated, observations..."></textarea></div>
    <div class="fo-modal-footer">
      <button class="fo-btn-secondary" onclick="closeFoModal()">Cancel</button>
      <button class="fo-btn-primary" onclick="saveSpray()">\u{1F4BE} Save Record</button>
    </div>`);
}

async function saveSpray() {
  const body = { field_id:v('fs-field')||null, chemical_name:v('fs-chem'), spray_date:v('fs-date'), dosage:v('fs-dose'), area_sprayed:v('fs-area'), weather_conditions:v('fs-weather'), pre_harvest_interval:v('fs-phi')||null, sprayed_by:v('fs-by'), notes:v('fs-notes') };
  if (!body.chemical_name || !body.spray_date) { foToast('\u274C Chemical name and date required'); return; }
  await foApi('POST', '/sprays', body);
  foToast('\u2705 Spray record saved!');
  closeFoModal();
  loadSprays();
}

// \u2500\u2500 WORKERS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function loadWorkers() {
  const rows = await foApi('GET', '/workers').catch(() => []);
  foState.workers = Array.isArray(rows) ? rows : [];
  const el = document.getElementById('workers-list');
  if (!rows.length) { el.innerHTML = '<p class="fo-empty">No workers added yet.</p>'; return; }
  el.innerHTML = rows.map(w => `
    <div class="fo-row">
      <div class="fo-row-main">
        <div class="fo-row-title">\u{1F477} ${w.name}</div>
        <div class="fo-row-meta">${w.role?.replace('_',' ')} \u00B7 Phone: ${w.phone || '\u2013'} \u00B7 Hire date: ${fmtDate(w.hire_date)}</div>
        <div class="fo-row-meta">Pay: NGN ${Number(w.pay_rate||0).toLocaleString()} / ${w.pay_type}</div>
      </div>
      ${statusBadge(w.status)}
    </div>`).join('');
}

function openWorkerForm() {
  openModal('Add Farm Worker', `
    <div class="fo-form-row">
      <div class="fo-form-group"><label class="fo-label">Full Name *</label><input class="fo-input" id="fw-name" placeholder="Worker's full name" /></div>
      <div class="fo-form-group">
        <label class="fo-label">Role</label>
        <select class="fo-select" id="fw-role">
          <option value="general_worker">General Worker</option>
          <option value="supervisor">Supervisor</option>
          <option value="planting_crew">Planting Crew</option>
          <option value="harvest_crew">Harvest Crew</option>
          <option value="irrigation">Irrigation</option>
          <option value="spray_team">Spray Team</option>
          <option value="driver">Driver</option>
          <option value="security">Security</option>
          <option value="greenhouse_manager">Greenhouse Manager</option>
        </select>
      </div>
    </div>
    <div class="fo-form-row">
      <div class="fo-form-group"><label class="fo-label">Phone</label><input class="fo-input" id="fw-phone" placeholder="Phone number" /></div>
      <div class="fo-form-group"><label class="fo-label">Hire Date</label><input type="date" class="fo-input" id="fw-hire" value="${today()}" /></div>
    </div>
    <div class="fo-form-row">
      <div class="fo-form-group"><label class="fo-label">Pay Rate (NGN)</label><input type="number" class="fo-input" id="fw-pay" placeholder="e.g. 3000" /></div>
      <div class="fo-form-group"><label class="fo-label">Pay Type</label><select class="fo-select" id="fw-ptype"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="task">Per Task</option></select></div>
    </div>
    <div class="fo-form-group"><label class="fo-label">Address</label><input class="fo-input" id="fw-addr" placeholder="Home address" /></div>
    <div class="fo-modal-footer">
      <button class="fo-btn-secondary" onclick="closeFoModal()">Cancel</button>
      <button class="fo-btn-primary" onclick="saveWorker()">\u{1F4BE} Save Worker</button>
    </div>`);
}

async function saveWorker() {
  const body = { name:v('fw-name'), role:v('fw-role'), phone:v('fw-phone'), hire_date:v('fw-hire'), pay_rate:v('fw-pay')||0, pay_type:v('fw-ptype'), address:v('fw-addr') };
  if (!body.name) { foToast('\u274C Name is required'); return; }
  await foApi('POST', '/workers', body);
  foToast('\u2705 Worker added!');
  closeFoModal();
  loadWorkers();
}

// \u2500\u2500 ATTENDANCE \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function loadAttendance() {
  const dateFilter = document.getElementById('att-date-filter')?.value || '';
  const endpoint   = '/attendance' + (dateFilter ? '?date=' + dateFilter : '');
  const rows = await foApi('GET', endpoint).catch(() => []);
  const el   = document.getElementById('attendance-list');
  if (!rows.length) { el.innerHTML = '<p class="fo-empty">No attendance records for this date.</p>'; return; }
  const total = rows.reduce((s, r) => s + (r.hours_worked || 8), 0);
  el.innerHTML = `<div style="background:rgba(82,183,136,.1);border:1px solid rgba(82,183,136,.2);border-radius:10px;padding:12px 16px;margin-bottom:12px;display:flex;gap:24px">
    <span style="color:#a3d9b8;font-weight:700">${rows.length} workers</span>
    <span style="color:rgba(255,255,255,.6);font-size:.85rem">${total} total hours</span>
  </div>` + rows.map(a => `
    <div class="fo-row">
      <div class="fo-row-main">
        <div class="fo-row-title">\u{1F477} ${a.worker_name}</div>
        <div class="fo-row-meta">${fmtDate(a.work_date)} \u00B7 ${a.time_in || '\u2013'} \u2192 ${a.time_out || '\u2013'} \u00B7 ${a.hours_worked || 8} hrs</div>
        ${a.task ? `<div class="fo-row-meta">Task: ${a.task}</div>` : ''}
      </div>
      ${badge(a.hours_worked + 'h', 'green')}
    </div>`).join('');
}

function openAttendanceForm() {
  if (!foState.workers.length) { foToast('\u26A0\uFE0F Add workers first'); return; }
  openModal('Mark Attendance', `
    <div class="fo-form-row">
      <div class="fo-form-group"><label class="fo-label">Worker *</label><select class="fo-select" id="fa-worker"><option value="">Select worker</option>${workerOptions()}</select></div>
      <div class="fo-form-group"><label class="fo-label">Date *</label><input type="date" class="fo-input" id="fa-date" value="${today()}" /></div>
    </div>
    <div class="fo-form-row">
      <div class="fo-form-group"><label class="fo-label">Time In</label><input type="time" class="fo-input" id="fa-in" value="07:00" /></div>
      <div class="fo-form-group"><label class="fo-label">Time Out</label><input type="time" class="fo-input" id="fa-out" value="15:00" /></div>
    </div>
    <div class="fo-form-row">
      <div class="fo-form-group"><label class="fo-label">Hours Worked</label><input type="number" class="fo-input" id="fa-hrs" value="8" step="0.5" /></div>
      <div class="fo-form-group"><label class="fo-label">Task</label><input class="fo-input" id="fa-task" placeholder="e.g. Weeding Block A" /></div>
    </div>
    <div class="fo-form-group"><label class="fo-label">Notes</label><textarea class="fo-textarea" id="fa-notes" rows="2" placeholder="Optional notes"></textarea></div>
    <div class="fo-modal-footer">
      <button class="fo-btn-secondary" onclick="closeFoModal()">Cancel</button>
      <button class="fo-btn-primary" onclick="saveAttendance()">\u{1F4BE} Save</button>
    </div>`);
}

async function saveAttendance() {
  const body = { worker_id:v('fa-worker'), work_date:v('fa-date'), time_in:v('fa-in'), time_out:v('fa-out'), hours_worked:v('fa-hrs')||8, task:v('fa-task'), notes:v('fa-notes') };
  if (!body.worker_id || !body.work_date) { foToast('\u274C Select a worker and date'); return; }
  await foApi('POST', '/attendance', body);
  foToast('\u2705 Attendance recorded!');
  closeFoModal();
  loadAttendance();
}

// \u2500\u2500 INPUTS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function loadInputs() {
  const rows = await foApi('GET', '/inputs').catch(() => []);
  const el   = document.getElementById('inputs-list');
  if (!rows.length) { el.innerHTML = '<p class="fo-empty">No inputs/supplies tracked yet.</p>'; return; }
  el.innerHTML = rows.map(i => {
    const low  = Number(i.current_stock) <= Number(i.reorder_level);
    return `<div class="fo-row">
      <div class="fo-row-main">
        <div class="fo-row-title">\u{1F4E6} ${i.name}</div>
        <div class="fo-row-meta">${i.type} \u00B7 Stock: ${i.current_stock} ${i.unit} \u00B7 Reorder at: ${i.reorder_level} ${i.unit}</div>
        <div class="fo-row-meta">Supplier: ${i.supplier||'\u2013'} \u00B7 Cost: NGN ${Number(i.cost_per_unit||0).toLocaleString()}/${i.unit}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        ${low ? badge('Low Stock \u26A0\uFE0F','red') : badge('In Stock','green')}
        <button onclick="adjustStock(${i.id},'${i.name}',${i.current_stock},'${i.unit}')" style="font-size:.72rem;background:rgba(82,183,136,.1);border:1px solid rgba(82,183,136,.3);color:#a3d9b8;padding:4px 10px;border-radius:8px;cursor:pointer;font-family:Outfit,sans-serif">Adjust Stock</button>
      </div>
    </div>`;
  }).join('');
}

function openInputForm() {
  openModal('Add Input / Supply', `
    <div class="fo-form-row">
      <div class="fo-form-group"><label class="fo-label">Item Name *</label><input class="fo-input" id="fi-name" placeholder="e.g. NPK Fertilizer 20:10:10" /></div>
      <div class="fo-form-group">
        <label class="fo-label">Type</label>
        <select class="fo-select" id="fi-type">
          <option value="fertilizer">Fertilizer</option>
          <option value="pesticide">Pesticide</option>
          <option value="herbicide">Herbicide</option>
          <option value="seed">Seeds</option>
          <option value="equipment">Equipment/Tools</option>
          <option value="packaging">Packaging</option>
          <option value="general">General Supplies</option>
        </select>
      </div>
    </div>
    <div class="fo-form-row">
      <div class="fo-form-group"><label class="fo-label">Unit</label><input class="fo-input" id="fi-unit" placeholder="kg, litres, bags..." value="kg" /></div>
      <div class="fo-form-group"><label class="fo-label">Current Stock</label><input type="number" class="fo-input" id="fi-stock" placeholder="0" value="0" step="0.1" /></div>
    </div>
    <div class="fo-form-row">
      <div class="fo-form-group"><label class="fo-label">Reorder Level</label><input type="number" class="fo-input" id="fi-reorder" placeholder="5" value="5" /></div>
      <div class="fo-form-group"><label class="fo-label">Cost per Unit (NGN)</label><input type="number" class="fo-input" id="fi-cost" placeholder="0" /></div>
    </div>
    <div class="fo-form-group"><label class="fo-label">Supplier</label><input class="fo-input" id="fi-supp" placeholder="Supplier name" /></div>
    <div class="fo-modal-footer">
      <button class="fo-btn-secondary" onclick="closeFoModal()">Cancel</button>
      <button class="fo-btn-primary" onclick="saveInput()">\u{1F4BE} Save</button>
    </div>`);
}

async function saveInput() {
  const body = { name:v('fi-name'), type:v('fi-type'), unit:v('fi-unit'), current_stock:v('fi-stock')||0, reorder_level:v('fi-reorder')||5, cost_per_unit:v('fi-cost')||0, supplier:v('fi-supp') };
  if (!body.name) { foToast('\u274C Item name required'); return; }
  await foApi('POST', '/inputs', body);
  foToast('\u2705 Input added!');
  closeFoModal();
  loadInputs();
}

function adjustStock(id, name, current, unit) {
  openModal('Adjust Stock \u2014 ' + name, `
    <p style="color:rgba(255,255,255,.6);font-size:.85rem;margin-bottom:16px">Current stock: <strong style="color:#a3d9b8">${current} ${unit}</strong></p>
    <div class="fo-form-group">
      <label class="fo-label">Adjustment Amount</label>
      <input type="number" class="fo-input" id="adj-val" placeholder="Use positive (restock) or negative (usage)" step="0.1" />
    </div>
    <div class="fo-form-group"><label class="fo-label">Reason</label><input class="fo-input" id="adj-reason" placeholder="e.g. Restocked from supplier" /></div>
    <div class="fo-modal-footer">
      <button class="fo-btn-secondary" onclick="closeFoModal()">Cancel</button>
      <button class="fo-btn-primary" onclick="doAdjustStock(${id})">Save Adjustment</button>
    </div>`);
}

async function doAdjustStock(id) {
  const adj = parseFloat(v('adj-val'));
  if (isNaN(adj)) { foToast('\u274C Enter a valid number'); return; }
  await foApi('PATCH', '/inputs/' + id + '/stock', { adjustment: adj, reason: v('adj-reason') });
  foToast('\u2705 Stock updated!');
  closeFoModal();
  loadInputs();
}

// \u2500\u2500 EQUIPMENT \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function loadEquipment() {
  const rows = await foApi('GET', '/equipment').catch(() => []);
  const el   = document.getElementById('equipment-list');
  if (!rows.length) { el.innerHTML = '<p class="fo-empty">No equipment tracked yet.</p>'; return; }
  el.innerHTML = rows.map(e => `
    <div class="fo-row">
      <div class="fo-row-main">
        <div class="fo-row-title">\u{1F69C} ${e.name}</div>
        <div class="fo-row-meta">${e.type||'\u2013'} \u00B7 S/N: ${e.serial_number||'\u2013'} \u00B7 Purchased: ${fmtDate(e.purchase_date)}</div>
        <div class="fo-row-meta">Last maintenance: ${fmtDate(e.last_maintenance_date)}</div>
        ${e.notes ? `<div class="fo-row-meta" style="font-style:italic">${e.notes}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        ${statusBadge(e.status)}
        <button onclick="updateEquipStatus(${e.id})" style="font-size:.72rem;background:rgba(82,183,136,.1);border:1px solid rgba(82,183,136,.3);color:#a3d9b8;padding:4px 10px;border-radius:8px;cursor:pointer;font-family:Outfit,sans-serif">Update Status</button>
      </div>
    </div>`).join('');
}

function openEquipmentForm() {
  openModal('Add Equipment', `
    <div class="fo-form-row">
      <div class="fo-form-group"><label class="fo-label">Equipment Name *</label><input class="fo-input" id="fe2-name" placeholder="e.g. Knapsack Sprayer" /></div>
      <div class="fo-form-group"><label class="fo-label">Type</label><input class="fo-input" id="fe2-type" placeholder="e.g. Sprayer, Tractor, Hand tool" /></div>
    </div>
    <div class="fo-form-row">
      <div class="fo-form-group"><label class="fo-label">Serial Number</label><input class="fo-input" id="fe2-sn" placeholder="Serial number" /></div>
      <div class="fo-form-group"><label class="fo-label">Purchase Date</label><input type="date" class="fo-input" id="fe2-pdate" /></div>
    </div>
    <div class="fo-form-group"><label class="fo-label">Notes</label><textarea class="fo-textarea" id="fe2-notes" rows="2" placeholder="Condition, location, warranty info..."></textarea></div>
    <div class="fo-modal-footer">
      <button class="fo-btn-secondary" onclick="closeFoModal()">Cancel</button>
      <button class="fo-btn-primary" onclick="saveEquipment()">\u{1F4BE} Save</button>
    </div>`);
}

async function saveEquipment() {
  const body = { name:v('fe2-name'), type:v('fe2-type'), serial_number:v('fe2-sn'), purchase_date:v('fe2-pdate')||null, notes:v('fe2-notes') };
  if (!body.name) { foToast('\u274C Name required'); return; }
  await foApi('POST', '/equipment', body);
  foToast('\u2705 Equipment added!');
  closeFoModal();
  loadEquipment();
}

async function updateEquipStatus(id) {
  openModal('Update Equipment Status', `
    <div class="fo-form-group">
      <label class="fo-label">Status</label>
      <select class="fo-select" id="eq-status">
        <option value="operational">Operational</option>
        <option value="maintenance">Needs Maintenance</option>
        <option value="repair">Under Repair</option>
        <option value="inactive">Inactive / Retired</option>
      </select>
    </div>
    <div class="fo-form-group"><label class="fo-label">Last Maintenance Date</label><input type="date" class="fo-input" id="eq-maint" /></div>
    <div class="fo-modal-footer">
      <button class="fo-btn-secondary" onclick="closeFoModal()">Cancel</button>
      <button class="fo-btn-primary" onclick="doUpdateEquip(${id})">Update</button>
    </div>`);
}

async function doUpdateEquip(id) {
  await foApi('PATCH', '/equipment/' + id + '/status', { status:v('eq-status'), last_maintenance_date:v('eq-maint')||null });
  foToast('\u2705 Equipment updated!');
  closeFoModal();
  loadEquipment();
}

// \u2500\u2500 DIARY \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function loadDiary() {
  const rows = await foApi('GET', '/diary').catch(() => []);
  const el   = document.getElementById('diary-list');
  if (!rows.length) { el.innerHTML = '<p class="fo-empty">No diary entries yet. Keep a daily record of farm activities.</p>'; return; }
  el.innerHTML = rows.map(e => `
    <div class="diary-entry">
      <div class="diary-entry-header">
        <span class="diary-entry-date">${fmtDate(e.entry_date)} \u00B7 ${e.written_by || '\u2013'} ${e.weather ? '\u00B7 \u{1F324} ' + e.weather : ''}</span>
        <span class="diary-entry-cat">${e.category}</span>
      </div>
      ${e.title ? `<div class="diary-entry-title">${e.title}</div>` : ''}
      <div class="diary-entry-body">${e.content}</div>
    </div>`).join('');
}

function openDiaryForm() {
  openModal('New Farm Diary Entry', `
    <div class="fo-form-row">
      <div class="fo-form-group"><label class="fo-label">Date *</label><input type="date" class="fo-input" id="fd-date" value="${today()}" /></div>
      <div class="fo-form-group">
        <label class="fo-label">Category</label>
        <select class="fo-select" id="fd-cat">
          <option value="general">General</option>
          <option value="planting">Planting</option>
          <option value="harvest">Harvest</option>
          <option value="pest_disease">Pest / Disease</option>
          <option value="weather">Weather</option>
          <option value="worker">Workers</option>
          <option value="visitor">Visitor</option>
          <option value="maintenance">Maintenance</option>
          <option value="observation">Observation</option>
        </select>
      </div>
    </div>
    <div class="fo-form-row">
      <div class="fo-form-group"><label class="fo-label">Title (optional)</label><input class="fo-input" id="fd-title" placeholder="Brief title" /></div>
      <div class="fo-form-group"><label class="fo-label">Weather</label><input class="fo-input" id="fd-weather" placeholder="e.g. Sunny 32\u00B0C" /></div>
    </div>
    <div class="fo-form-group"><label class="fo-label">Entry *</label><textarea class="fo-textarea" id="fd-content" rows="5" placeholder="Describe what happened on the farm today..."></textarea></div>
    <div class="fo-modal-footer">
      <button class="fo-btn-secondary" onclick="closeFoModal()">Cancel</button>
      <button class="fo-btn-primary" onclick="saveDiary()">\u{1F4BE} Save Entry</button>
    </div>`);
}

async function saveDiary() {
  const body = { entry_date:v('fd-date'), category:v('fd-cat'), title:v('fd-title'), content:v('fd-content'), weather:v('fd-weather') };
  if (!body.content) { foToast('\u274C Entry content required'); return; }
  await foApi('POST', '/diary', body);
  foToast('\u2705 Diary entry saved!');
  closeFoModal();
  loadDiary();
}

// \u2500\u2500 MODAL \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function openModal(title, body) {
  document.getElementById('fo-modal-title').textContent = title;
  document.getElementById('fo-modal-body').innerHTML    = body;
  document.getElementById('fo-modal-overlay').style.display = 'block';
  document.getElementById('fo-modal').style.display          = 'block';
}
function closeFoModal() {
  document.getElementById('fo-modal-overlay').style.display = 'none';
  document.getElementById('fo-modal').style.display          = 'none';
}

// \u2500\u2500 Utilities \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function v(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
function today() { return new Date().toISOString().slice(0,10); }

function generateReport(type) {
  foToast('\u{1F4CA} Report generation coming soon \u2014 check back!', 3000);
}

// \u2500\u2500 Init \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (token) {
    // Try to auto-login with stored token
    fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.ok ? r.json() : null)
      .then(user => {
        if (user) {
          foUser = user;
          showApp();
        }
      })
      .catch(() => {});
  }
  // Set today's date in attendance filter
  const attDate = document.getElementById('att-date-filter');
  if (attDate) attDate.value = today();

  // Enter key on login
  document.getElementById('l-pass')?.addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });
});


// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
// PHASE 3 \u2014 Equipment Maintenance + Harvest\u2192Store + Export Downloads
// Added to farm/js/farm.js
// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

// \u2500\u2500 SEND HARVEST TO STORE \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function sendHarvestToStore(harvestId) {
  try {
    const result = await foApi('POST', '/harvests/' + harvestId + '/send-to-store', {});
    foToast('\u2705 ' + (result.message || 'Sent to store!'));
    loadHarvests();
  } catch(e) { foToast('\u274C ' + e.message); }
}

// \u2500\u2500 EQUIPMENT MAINTENANCE SCHEDULING \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function scheduleMaintenance(equipId, equipName) {
  openModal('\u{1F527} Schedule Maintenance \u2014 ' + equipName,
    '<div class="fo-form-group"><label class="fo-label">Maintenance Type</label>' +
    '<select class="fo-select" id="mt-type">' +
    '<option value="routine">Routine Service</option>' +
    '<option value="repair">Repair</option>' +
    '<option value="inspection">Inspection</option>' +
    '<option value="cleaning">Cleaning</option>' +
    '<option value="parts_replacement">Parts Replacement</option>' +
    '<option value="oil_change">Oil Change</option>' +
    '</select></div>' +
    '<div class="fo-form-group"><label class="fo-label">Description</label>' +
    '<input class="fo-input" id="mt-desc" placeholder="What needs to be done?" /></div>' +
    '<div class="fo-form-row">' +
    '<div class="fo-form-group"><label class="fo-label">Scheduled Date *</label>' +
    '<input type="date" class="fo-input" id="mt-date" value="' + today() + '" /></div>' +
    '<div class="fo-form-group"><label class="fo-label">Next Service Date</label>' +
    '<input type="date" class="fo-input" id="mt-next" /></div>' +
    '</div>' +
    '<div class="fo-form-group"><label class="fo-label">Cost Estimate (NGN)</label>' +
    '<input type="number" class="fo-input" id="mt-cost" placeholder="0" /></div>' +
    '<div class="fo-form-group"><label class="fo-label">Notes</label>' +
    '<textarea class="fo-textarea" id="mt-notes" rows="2" placeholder="Additional details..."></textarea></div>' +
    '<div class="fo-modal-footer">' +
    '<button class="fo-btn-secondary" onclick="closeFoModal()">Cancel</button>' +
    '<button class="fo-btn-primary" onclick="saveMaintenance(' + equipId + ',\'' + (equipName||'').replace(/'/g,"\\'") + '\')">\u{1F4BE} Schedule</button>' +
    '</div>'
  );
}

async function saveMaintenance(equipId, equipName) {
  const body = {
    equipment_id:      equipId,
    equipment_name:    equipName,
    maintenance_type:  v('mt-type'),
    description:       v('mt-desc'),
    scheduled_date:    v('mt-date'),
    next_service_date: v('mt-next') || null,
    cost:              v('mt-cost') || 0,
    notes:             v('mt-notes'),
  };
  if (!body.scheduled_date) { foToast('\u274C Please set a scheduled date'); return; }
  await fetch('/api/maintenance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + foToken() },
    body: JSON.stringify(body),
  });
  foToast('\u2705 Maintenance scheduled!');
  closeFoModal();
  loadEquipment();
}

async function completeMaintenance(id) {
  const cost = prompt('Enter actual cost (NGN), or leave blank:') || 0;
  await fetch('/api/maintenance/' + id + '/complete', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + foToken() },
    body: JSON.stringify({ performed_by: foUser?.name || 'Admin', completed_date: today(), cost }),
  });
  foToast('\u2705 Maintenance marked complete!');
  loadReports();
}

// \u2500\u2500 EXPORT DOWNLOAD \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function downloadExport(endpoint) {
  const sep = endpoint.includes('?') ? '&' : '?';
  const url = endpoint + sep + '_t=' + encodeURIComponent(foToken());
  const a   = document.createElement('a');
  a.href    = url;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  foToast('\u2B07\uFE0F Downloading...');
}

function downloadPayslip(workerId) {
  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();
  downloadExport('/api/exports/payslip/' + workerId + '?month=' + month + '&year=' + year);
}

// \u2500\u2500 UPDATED loadReports \u2014 with download buttons + maintenance widget \u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function loadReports() {
  const el = document.getElementById('fotab-reports');
  if (!el) return;
  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();
  const mn    = now.toLocaleString('en-NG', { month: 'long', year: 'numeric' });

  el.innerHTML =
    '<div style="padding:24px">' +
    '<p style="color:rgba(255,255,255,.5);font-size:.88rem;margin-bottom:24px">Data for <strong style="color:#a3d9b8">' + mn + '</strong></p>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">' +
    '<div class="fo-card"><div class="fo-card-header"><h3>\u{1F4E5} Download Reports</h3></div>' +
    '<div style="display:flex;flex-direction:column;gap:8px">' +
    '<button class="fo-btn-primary" style="text-align:left;font-size:.82rem;padding:9px 14px" onclick="downloadExport(\'/api/exports/monthly/excel?month=' + month + '&year=' + year + '\')">\u{1F4CA} Monthly Summary (Excel)</button>' +
    '<button class="fo-btn-primary" style="text-align:left;font-size:.82rem;padding:9px 14px" onclick="downloadExport(\'/api/exports/harvest/excel?month=' + month + '&year=' + year + '\')">\u{1F9FA} Harvest Report (Excel)</button>' +
    '<button class="fo-btn-primary" style="text-align:left;font-size:.82rem;padding:9px 14px" onclick="downloadExport(\'/api/exports/payroll/excel?month=' + month + '&year=' + year + '\')">\u{1F4B0} Payroll Report (Excel)</button>' +
    '</div><p style="font-size:.72rem;color:rgba(255,255,255,.3);margin-top:10px">Individual payslips: Payroll tab \u2192 Download PDF per worker</p></div>' +
    '<div class="fo-card"><div class="fo-card-header"><h3>\u{1F527} Upcoming Maintenance</h3></div>' +
    '<div id="rpt-maint"><p class="fo-empty">Loading...</p></div></div>' +
    '</div>' +
    '<div id="report-content"><div class="fo-empty">Loading...</div></div>' +
    '</div>';

  // Load upcoming maintenance
  fetch('/api/maintenance/upcoming', { headers: { Authorization: 'Bearer ' + foToken() } })
    .then(r => r.json()).then(rows => {
      const mel = document.getElementById('rpt-maint');
      if (!mel) return;
      if (!rows.length) {
        mel.innerHTML = '<p class="fo-empty" style="font-size:.78rem">No upcoming maintenance in next 30 days. \u2705</p>';
        return;
      }
      mel.innerHTML = rows.map(function(m) {
        return '<div style="background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.2);border-radius:10px;padding:10px 14px;margin-bottom:6px">' +
          '<div style="font-weight:700;font-size:.82rem;color:#fbbf24">' + (m.equipment_name || 'Equipment') + '</div>' +
          '<div style="font-size:.73rem;color:rgba(255,255,255,.5)">' + m.maintenance_type + ' \u00B7 ' + fmtDate(m.scheduled_date) + '</div>' +
          '<button onclick="completeMaintenance(' + m.id + ')" style="font-size:.68rem;margin-top:5px;background:rgba(82,183,136,.1);border:1px solid rgba(82,183,136,.3);color:#a3d9b8;padding:3px 8px;border-radius:6px;cursor:pointer;font-family:Outfit,sans-serif">\u2705 Mark Complete</button>' +
          '</div>';
      }).join('');
    }).catch(function() {});

  // Financial + harvest
  try {
    const [costs, harvests] = await Promise.all([
      foApi('GET', '/reports/costs?month=' + month + '&year=' + year),
      foApi('GET', '/reports/harvest-summary?month=' + month + '&year=' + year),
    ]);
    const profCol = costs.profit >= 0 ? '#52b788' : '#f87171';
    const harvestTable = (harvests.rows && harvests.rows.length)
      ? '<table class="report-table"><thead><tr><th>Crop</th><th>Grade</th><th>Total</th><th>Count</th></tr></thead><tbody>' +
        harvests.rows.map(function(r) {
          return '<tr><td>' + (r.crop_name||'\u2014') + '</td><td>' + r.quality_grade + '</td><td>' + Number(r.total_qty).toFixed(1) + ' ' + r.unit + '</td><td>' + r.harvest_count + '</td></tr>';
        }).join('') + '</tbody></table>'
      : '<p class="fo-empty">No harvests this month.</p>';

    document.getElementById('report-content').innerHTML =
      '<div class="report-section"><h4>\u{1F4B0} Financial Overview</h4>' +
      '<div class="report-kpi-row">' +
      '<div class="report-kpi"><div class="report-kpi-val">NGN ' + Number(costs.revenue||0).toLocaleString('en-NG') + '</div><div class="report-kpi-lbl">Revenue</div></div>' +
      '<div class="report-kpi"><div class="report-kpi-val">NGN ' + Number(costs.labour_cost||0).toLocaleString('en-NG') + '</div><div class="report-kpi-lbl">Labour</div></div>' +
      '<div class="report-kpi"><div class="report-kpi-val">NGN ' + Number(costs.inputs_cost||0).toLocaleString('en-NG') + '</div><div class="report-kpi-lbl">Inputs</div></div>' +
      '<div class="report-kpi"><div class="report-kpi-val" style="color:' + profCol + '">NGN ' + Number(costs.profit||0).toLocaleString('en-NG') + '</div><div class="report-kpi-lbl">' + (costs.profit >= 0 ? '\u2705 Profit' : '\u26A0\uFE0F Loss') + '</div></div>' +
      '</div></div>' +
      '<div class="report-section"><h4>\u{1F9FA} Harvest Summary</h4>' + harvestTable + '</div>';
  } catch(e) {
    var rc = document.getElementById('report-content');
    if (rc) rc.innerHTML = '<p class="fo-empty">Could not load: ' + e.message + '</p>';
  }
}

// -- PENDING WORKER REGISTRATIONS ------------------------------------------
async function loadPendingWorkers() {
  try {
    const res = await fetch('/api/worker-register/pending', {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('pinnacles_admin_token') }
    });
    const list = await res.json();
    const box  = document.getElementById('pending-workers-box');
    const cont = document.getElementById('pending-workers-list');
    const cnt  = document.getElementById('pending-count');
    if (!box || !cont) return;

    if (!Array.isArray(list) || list.length === 0) {
      box.style.display = 'none';
      return;
    }
    box.style.display = '';
    if (cnt) cnt.textContent = list.length;

    cont.innerHTML = list.map(w => {
      const joined = w.created_at ? new Date(w.created_at).toLocaleDateString('en-NG') : '';
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.08);gap:12px;flex-wrap:wrap">' +
        '<div>' +
          '<div style="font-weight:700;color:#fff;font-size:.88rem">' + (w.full_name || w.username || 'Unknown') + '</div>' +
          '<div style="font-size:.78rem;color:rgba(255,255,255,.5)">' + (w.email||'') + (w.phone ? ' &bull; ' + w.phone : '') + (w.job_title ? ' &bull; ' + w.job_title : '') + (joined ? ' &bull; Applied: ' + joined : '') + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px">' +
          '<button onclick="approveWorker(' + w.id + ', this)" style="background:rgba(82,183,136,.2);color:#52b788;border:none;border-radius:8px;padding:6px 14px;font-size:.8rem;font-weight:700;cursor:pointer;font-family:inherit">\u2705 Approve</button>' +
          '<button onclick="rejectWorker(' + w.id + ', this)" style="background:rgba(248,113,113,.15);color:#f87171;border:none;border-radius:8px;padding:6px 14px;font-size:.8rem;font-weight:700;cursor:pointer;font-family:inherit">\u2716 Reject</button>' +
        '</div>' +
      '</div>';
    }).join('');
  } catch(e) { console.error('loadPendingWorkers:', e); }
}

async function approveWorker(id, btn) {
  btn.textContent = 'Approving...'; btn.disabled = true;
  try {
    const res = await fetch('/api/worker-register/' + id + '/approve', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + localStorage.getItem('pinnacles_admin_token') }
    });
    if (!res.ok) { const d = await res.json().catch(()=>({})); throw new Error(d.error || 'Failed'); }
    const data = await res.json();
      showFoToast('Worker approved! Username: ' + data.username);
      alert('WORKER APPROVED!\n\nPlease tell the worker their new login username:\n\n' + data.username + '\n\n(You can also see this later in the Team / Users tab)');
    loadPendingWorkers();
  } catch(e) { showFoToast('Error: ' + e.message, true); btn.textContent = '\u2705 Approve'; btn.disabled = false; }
}

async function rejectWorker(id, btn) {
  if (!confirm('Reject and delete this registration request?')) return;
  btn.textContent = 'Rejecting...'; btn.disabled = true;
  try {
    const res = await fetch('/api/worker-register/' + id + '/reject', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + localStorage.getItem('pinnacles_admin_token') }
    });
    if (!res.ok) { const d = await res.json().catch(()=>({})); throw new Error(d.error || 'Failed'); }
    showFoToast('Registration rejected.');
    loadPendingWorkers();
  } catch(e) { showFoToast('Error: ' + e.message, true); btn.textContent = '\u2716 Reject'; btn.disabled = false; }
}

// Auto-load pending count on dashboard load
setTimeout(() => { try { loadPendingWorkers(); } catch(_){} }, 2000);


function toggleSidebar() { document.getElementById('fo-dashboard').classList.toggle('sidebar-collapsed'); }
