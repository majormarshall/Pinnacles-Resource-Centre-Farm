// Customer Account & Pre-order system — js/customer.js
// Handles: login, register, profile, order history, loyalty points, pre-orders
'use strict';

const CUST_TOKEN_KEY = 'pinnacles_customer_token';
let currentCustomer  = null;

// ── Auth helpers ───────────────────────────────────────────────────────────
function custToken() { return localStorage.getItem(CUST_TOKEN_KEY) || ''; }

async function custApi(method, endpoint, body) {
  const opts = { method, headers: { 'Content-Type':'application/json', 'Authorization':'Bearer ' + custToken() } };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch('/api/customers' + endpoint, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error');
  return data;
}

function setCustomer(customer, token) {
  if (token) localStorage.setItem(CUST_TOKEN_KEY, token);
  currentCustomer = customer;
  updateAccountBtn();
  // Share with chatbot
  if (window._farmChatCustomerId !== undefined) window._farmChatCustomerId = customer?.id || null;
}

function updateAccountBtn() {
  const btn = document.getElementById('customer-account-btn');
  if (!btn) return;
  if (currentCustomer) {
    btn.innerHTML = `👤 ${currentCustomer.name.split(' ')[0]}`;
    btn.style.background = 'rgba(82,183,136,.2)';
    btn.style.borderColor = 'rgba(82,183,136,.4)';
  } else {
    btn.innerHTML = '👤 Account';
    btn.style.background = '';
    btn.style.borderColor = '';
  }
}

// ── Modal ──────────────────────────────────────────────────────────────────
function openAccountModal() {
  document.getElementById('account-modal').style.display = 'block';
  if (currentCustomer) showAccountDashboard();
  else                  showLoginForm();
}
function closeAccountModal() { document.getElementById('account-modal').style.display = 'none'; }

function setAccBody(html, title) {
  document.getElementById('acc-modal-title').textContent = title || '👤 My Account';
  document.getElementById('acc-modal-body').innerHTML    = html;
}

// ── LOGIN FORM ────────────────────────────────────────────────────────────
function showLoginForm(msg) {
  setAccBody(`
    ${msg ? `<div style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#f87171;border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:.85rem">${msg}</div>` : ''}
    <div style="margin-bottom:14px"><input id="acc-email" type="email" placeholder="Email address" style="display:block;width:100%;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:12px 16px;color:#fff;font-family:Outfit,sans-serif;font-size:.9rem;margin-bottom:10px" />
    <input id="acc-pass" type="password" placeholder="Password" style="display:block;width:100%;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:12px 16px;color:#fff;font-family:Outfit,sans-serif;font-size:.9rem" onkeydown="if(event.key==='Enter')doLogin()" /></div>
    <button onclick="doLogin()" style="display:block;width:100%;background:linear-gradient(135deg,#1b4332,#2d6a4f);color:#fff;border:none;border-radius:12px;padding:13px;font-size:.95rem;font-weight:700;cursor:pointer;font-family:Outfit,sans-serif;margin-bottom:12px">🔑 Sign In</button>
    <p style="text-align:center;color:rgba(255,255,255,.5);font-size:.82rem">Don't have an account? <a href="#" onclick="showRegisterForm()" style="color:#52b788;font-weight:700">Create one</a></p>
    <p style="text-align:center;color:rgba(255,255,255,.35);font-size:.75rem;margin-top:8px">Creating an account earns you 💎 loyalty points on every order!</p>
  `, '🔑 Sign In');
}

async function doLogin() {
  const email = document.getElementById('acc-email')?.value?.trim();
  const pass  = document.getElementById('acc-pass')?.value;
  if (!email || !pass) { showLoginForm('Please enter email and password'); return; }
  try {
    const data = await custApi('POST', '/login', { email, password: pass });
    setCustomer(data.customer, data.token);
    showAccountDashboard();
  } catch(e) { showLoginForm(e.message); }
}

// ── REGISTER FORM ─────────────────────────────────────────────────────────
function showRegisterForm(msg) {
  setAccBody(`
    ${msg ? `<div style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#f87171;border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:.85rem">${msg}</div>` : ''}
    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px">
      <input id="reg-name"  placeholder="Full name *"      style="background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:12px 16px;color:#fff;font-family:Outfit,sans-serif;font-size:.9rem" />
      <input id="reg-email" type="email" placeholder="Email address *" style="background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:12px 16px;color:#fff;font-family:Outfit,sans-serif;font-size:.9rem" />
      <input id="reg-phone" placeholder="Phone number *"   style="background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:12px 16px;color:#fff;font-family:Outfit,sans-serif;font-size:.9rem" />
      <input id="reg-pass"  type="password" placeholder="Password (min 6 chars) *" style="background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:12px 16px;color:#fff;font-family:Outfit,sans-serif;font-size:.9rem" />
      <input id="reg-addr"  placeholder="Delivery address (optional)" style="background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:12px 16px;color:#fff;font-family:Outfit,sans-serif;font-size:.9rem" />
    </div>
    <button onclick="doRegister()" style="display:block;width:100%;background:linear-gradient(135deg,#1b4332,#2d6a4f);color:#fff;border:none;border-radius:12px;padding:13px;font-size:.95rem;font-weight:700;cursor:pointer;font-family:Outfit,sans-serif;margin-bottom:12px">🌱 Create Account</button>
    <p style="text-align:center;color:rgba(255,255,255,.5);font-size:.82rem">Already have an account? <a href="#" onclick="showLoginForm()" style="color:#52b788;font-weight:700">Sign in</a></p>
  `, '🌱 Create Account');
}

function gv(id) { return document.getElementById(id)?.value?.trim() || ''; }

async function doRegister() {
  const name = gv('reg-name'), email = gv('reg-email'), phone = gv('reg-phone'), pass = gv('reg-pass'), address = gv('reg-addr');
  if (!name || !email || !pass || !phone) { showRegisterForm('Please fill in all required fields'); return; }
  if (pass.length < 6) { showRegisterForm('Password must be at least 6 characters'); return; }
  try {
    const data = await custApi('POST', '/register', { name, email, password: pass, phone, address });
    setCustomer(data.customer, data.token);
    showAccountDashboard();
  } catch(e) { showRegisterForm(e.message); }
}

// ── ACCOUNT DASHBOARD ─────────────────────────────────────────────────────
async function showAccountDashboard() {
  if (!currentCustomer) { showLoginForm(); return; }
  try {
    const [profile, loyalty] = await Promise.all([
      custApi('GET', '/me'),
      custApi('GET', '/loyalty').catch(() => ({ points: 0, transactions: [] })),
    ]);
    const pointsValue = Math.floor(loyalty.points * 0.5);
    setAccBody(`
      <div style="background:linear-gradient(135deg,rgba(82,183,136,.15),rgba(27,67,50,.4));border:1px solid rgba(82,183,136,.25);border-radius:16px;padding:20px;margin-bottom:20px">
        <div style="font-size:1.1rem;font-weight:800;color:#a3d9b8;margin-bottom:4px">👋 Welcome back, ${profile.name.split(' ')[0]}!</div>
        <div style="font-size:.8rem;color:rgba(255,255,255,.5)">${profile.email}</div>
        <div style="display:flex;gap:20px;margin-top:14px;flex-wrap:wrap">
          <div><div style="font-size:1.5rem;font-weight:800;color:#52b788">💎 ${loyalty.points}</div><div style="font-size:.72rem;color:rgba(255,255,255,.5)">Loyalty Points<br>≈ ₦${pointsValue.toLocaleString('en-NG')} value</div></div>
          <div><div style="font-size:1.5rem;font-weight:800;color:#52b788">${profile.total_orders || 0}</div><div style="font-size:.72rem;color:rgba(255,255,255,.5)">Total Orders</div></div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <button onclick="showMyOrders()" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#fff;border-radius:12px;padding:12px 16px;text-align:left;cursor:pointer;font-family:Outfit,sans-serif;font-size:.88rem;font-weight:600">📦 My Orders</button>
        <button onclick="showLoyaltyHistory(${loyalty.points})" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#fff;border-radius:12px;padding:12px 16px;text-align:left;cursor:pointer;font-family:Outfit,sans-serif;font-size:.88rem;font-weight:600">💎 Loyalty Points — ${loyalty.points} pts</button>
        <button onclick="showMyPreorders()" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#fff;border-radius:12px;padding:12px 16px;text-align:left;cursor:pointer;font-family:Outfit,sans-serif;font-size:.88rem;font-weight:600">⏳ My Pre-orders</button>
        <button onclick="doLogout()" style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);color:#f87171;border-radius:12px;padding:12px 16px;text-align:left;cursor:pointer;font-family:Outfit,sans-serif;font-size:.88rem;font-weight:600;margin-top:4px">🚪 Sign Out</button>
      </div>
    `, '👤 My Account');
  } catch(e) {
    // Token expired
    localStorage.removeItem(CUST_TOKEN_KEY);
    currentCustomer = null;
    showLoginForm('Session expired. Please sign in again.');
  }
}

async function showMyOrders() {
  const orders = await custApi('GET', '/orders').catch(() => []);
  const html = orders.length
    ? orders.map(o => {
        const items = (() => { try { return JSON.parse(o.items || '[]'); } catch { return []; } })();
        return `<div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:14px;margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span style="font-weight:700;color:#a3d9b8">Order #${o.id}</span>
            <span style="font-size:.75rem;background:rgba(82,183,136,.15);color:#52b788;padding:3px 10px;border-radius:20px">${o.status}</span>
          </div>
          <div style="font-size:.78rem;color:rgba(255,255,255,.5)">${new Date(o.created_at).toLocaleDateString('en-NG',{day:'2-digit',month:'short',year:'numeric'})}</div>
          <div style="font-size:.82rem;color:rgba(255,255,255,.7);margin-top:6px">${items.slice(0,3).map(i=>`${i.emoji||''}${i.name}`).join(', ')}${items.length>3?` +${items.length-3} more`:''}</div>
          <div style="font-weight:800;color:#52b788;margin-top:6px">₦${Number(o.total||0).toLocaleString('en-NG')}</div>
        </div>`;
      }).join('')
    : '<p style="color:rgba(255,255,255,.4);text-align:center;padding:20px 0">No orders yet. Start shopping! 🛒</p>';
  setAccBody(`<button onclick="showAccountDashboard()" style="background:none;border:none;color:#52b788;cursor:pointer;font-family:Outfit,sans-serif;font-size:.85rem;margin-bottom:16px">← Back</button>${html}`, '📦 My Orders');
}

function showLoyaltyHistory(points) {
  const value = Math.floor(points * 0.5);
  setAccBody(`
    <button onclick="showAccountDashboard()" style="background:none;border:none;color:#52b788;cursor:pointer;font-family:Outfit,sans-serif;font-size:.85rem;margin-bottom:16px">← Back</button>
    <div style="background:linear-gradient(135deg,rgba(82,183,136,.15),rgba(27,67,50,.4));border:1px solid rgba(82,183,136,.3);border-radius:16px;padding:20px;margin-bottom:20px;text-align:center">
      <div style="font-size:2rem;font-weight:800;color:#52b788">💎 ${points} Points</div>
      <div style="color:rgba(255,255,255,.5);font-size:.82rem;margin-top:4px">≈ ₦${value.toLocaleString('en-NG')} value</div>
    </div>
    <div style="background:rgba(255,255,255,.05);border-radius:12px;padding:16px;font-size:.82rem;color:rgba(255,255,255,.6);line-height:1.8">
      <div>💎 Earn <strong style="color:#a3d9b8">1 point</strong> for every <strong style="color:#a3d9b8">₦100</strong> spent</div>
      <div>🎁 Each point worth <strong style="color:#a3d9b8">₦0.50</strong> at redemption</div>
      <div>✅ Minimum <strong style="color:#a3d9b8">100 points</strong> to redeem</div>
      <div>🛒 Points applied automatically at checkout</div>
    </div>
  `, '💎 Loyalty Points');
}

async function showMyPreorders() {
  const orders = await custApi('GET', '/preorders').catch(() => []);
  const html = orders.length
    ? orders.map(o => `
        <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:14px;margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-weight:700;color:#a3d9b8">${o.product_name}</span>
            <span style="font-size:.72rem;background:rgba(251,191,36,.12);color:#fbbf24;padding:3px 10px;border-radius:20px">${o.status}</span>
          </div>
          <div style="font-size:.78rem;color:rgba(255,255,255,.5);margin-top:4px">Qty: ${o.quantity} ${o.unit||''} · Expected: ${o.expected_date ? new Date(o.expected_date).toLocaleDateString('en-NG',{day:'2-digit',month:'short'}) : 'TBA'}</div>
        </div>`).join('')
    : '<p style="color:rgba(255,255,255,.4);text-align:center;padding:20px 0">No pre-orders yet.</p>';
  setAccBody(`<button onclick="showAccountDashboard()" style="background:none;border:none;color:#52b788;cursor:pointer;font-family:Outfit,sans-serif;font-size:.85rem;margin-bottom:16px">← Back</button>${html}`, '⏳ My Pre-orders');
}

function doLogout() {
  localStorage.removeItem(CUST_TOKEN_KEY);
  currentCustomer = null;
  updateAccountBtn();
  closeAccountModal();
}

// ── PRE-ORDER MODAL ────────────────────────────────────────────────────────
function openPreorderModal(productId, productName, expectedDate, note) {
  const prefilled = currentCustomer ? `value="${currentCustomer.name}"` : '';
  const prefilledPhone = currentCustomer ? `value="${currentCustomer.phone || ''}"` : '';
  document.getElementById('preorder-modal-body').innerHTML = `
    <div style="background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.2);border-radius:12px;padding:14px;margin-bottom:18px;font-size:.85rem;color:rgba(255,255,255,.75)">
      ⏳ <strong style="color:#fbbf24">${productName}</strong> is coming soon!<br/>
      ${expectedDate ? `Expected: <strong>${new Date(expectedDate).toLocaleDateString('en-NG',{day:'2-digit',month:'long'})}</strong><br/>` : ''}
      ${note || 'Reserve your quantity now and we\'ll contact you when ready.'}
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px">
      <input id="po-name"  placeholder="Your name *"     ${prefilled}   style="background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:12px 16px;color:#fff;font-family:Outfit,sans-serif;font-size:.88rem" />
      <input id="po-phone" placeholder="WhatsApp number *" ${prefilledPhone} style="background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:12px 16px;color:#fff;font-family:Outfit,sans-serif;font-size:.88rem" />
      <div style="display:flex;gap:10px">
        <input id="po-qty"  type="number" placeholder="Qty *" min="1" value="1" style="flex:1;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:12px 16px;color:#fff;font-family:Outfit,sans-serif;font-size:.88rem" />
        <input id="po-unit" placeholder="Unit (kg, basket...)" value="kg" style="flex:2;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:12px 16px;color:#fff;font-family:Outfit,sans-serif;font-size:.88rem" />
      </div>
      <textarea id="po-notes" placeholder="Any special requests?" rows="2" style="background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:12px 16px;color:#fff;font-family:Outfit,sans-serif;font-size:.88rem;resize:vertical"></textarea>
    </div>
    <button onclick="submitPreorder(${productId || 'null'},'${productName.replace(/'/g,"\\'")}','${expectedDate || ''}')" style="display:block;width:100%;background:linear-gradient(135deg,#92400e,#b45309);color:#fff;border:none;border-radius:12px;padding:13px;font-size:.95rem;font-weight:700;cursor:pointer;font-family:Outfit,sans-serif">⏳ Place Pre-order</button>
  `;
  document.getElementById('preorder-modal').style.display = 'block';
}
function closePreorderModal() { document.getElementById('preorder-modal').style.display = 'none'; }

async function submitPreorder(productId, productName, expectedDate) {
  const name  = document.getElementById('po-name')?.value?.trim();
  const phone = document.getElementById('po-phone')?.value?.trim();
  const qty   = document.getElementById('po-qty')?.value;
  const unit  = document.getElementById('po-unit')?.value?.trim() || 'kg';
  const notes = document.getElementById('po-notes')?.value?.trim();
  if (!name || !phone || !qty) { alert('Please fill in your name, phone and quantity'); return; }
  try {
    await custApi('POST', '/preorder', {
      customer_id: currentCustomer?.id || null,
      customer_name: name, customer_phone: phone, customer_email: currentCustomer?.email || null,
      product_id: productId, product_name: productName,
      quantity: parseFloat(qty), unit, notes, expected_date: expectedDate || null,
    });
    closePreorderModal();
    alert(`✅ Pre-order placed! We'll contact you on WhatsApp at ${phone} when ${productName} is ready.`);
  } catch(e) { alert('Error: ' + e.message); }
}

// ── Add pre-order badge to product cards ───────────────────────────────────
// Called from renderProducts when p.preorder_available is true
function preorderBadge(p) {
  return `<span class="avail-badge preorder-badge" onclick="event.stopPropagation();openPreorderModal(${p.id},'${p.name.replace(/'/g,"\\'")}','${p.preorder_expected_date||''}','${(p.preorder_note||'').replace(/'/g,"\\'")}')">⏳ Pre-order</span>`;
}

// ── INIT: auto-login from stored customer token ────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem(CUST_TOKEN_KEY);
  if (token) {
    try {
      const data = await custApi('GET', '/me');
      setCustomer(data, null);
    } catch { localStorage.removeItem(CUST_TOKEN_KEY); }
  }
});
