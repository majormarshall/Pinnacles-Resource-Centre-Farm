// Customer Account & Pre-order system \u2014 js/customer.js
// Handles: login, register, profile, order history, loyalty points, pre-orders
'use strict';

const CUST_TOKEN_KEY = 'pinnacles_customer_token';
let currentCustomer  = null;

// \u2500\u2500 Auth helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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
    btn.innerHTML = `\u{1F464} ${currentCustomer.name.split(' ')[0]}`;
    btn.style.background = 'rgba(82,183,136,.2)';
    btn.style.borderColor = 'rgba(82,183,136,.4)';
  } else {
    btn.innerHTML = '\u{1F464} Account';
    btn.style.background = '';
    btn.style.borderColor = '';
  }
}

// \u2500\u2500 Modal \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function openAccountModal() {
  document.getElementById('account-modal').style.display = 'block';
  if (currentCustomer) showAccountDashboard();
  else                  showLoginForm();
}
function closeAccountModal() { document.getElementById('account-modal').style.display = 'none'; }

function setAccBody(html, title) {
  document.getElementById('acc-modal-title').textContent = title || '\u{1F464} My Account';
  document.getElementById('acc-modal-body').innerHTML    = html;
}

// \u2500\u2500 LOGIN FORM \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function showLoginForm(msg) {
  setAccBody(`
    ${msg ? `<div style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#f87171;border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:.85rem">${msg}</div>` : ''}
    <div style="margin-bottom:14px"><input id="acc-email" type="email" placeholder="Email address" style="display:block;width:100%;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:12px 16px;color:#fff;font-family:Outfit,sans-serif;font-size:.9rem;margin-bottom:10px" />
    <input id="acc-pass" type="password" placeholder="Password" style="display:block;width:100%;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:12px 16px;color:#fff;font-family:Outfit,sans-serif;font-size:.9rem" onkeydown="if(event.key==='Enter')doLogin()" /></div>
    <button onclick="doLogin()" style="display:block;width:100%;background:linear-gradient(135deg,#1b4332,#2d6a4f);color:#fff;border:none;border-radius:12px;padding:13px;font-size:.95rem;font-weight:700;cursor:pointer;font-family:Outfit,sans-serif;margin-bottom:12px">\u{1F511} Sign In</button>
    <p style="text-align:center;color:rgba(255,255,255,.5);font-size:.82rem">Don't have an account? <a href="#" onclick="showRegisterForm()" style="color:#52b788;font-weight:700">Create one</a></p>
    <p style="text-align:center;color:rgba(255,255,255,.35);font-size:.75rem;margin-top:8px">Creating an account earns you \u{1F48E} loyalty points on every order!</p>
  `, '\u{1F511} Sign In');
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

// \u2500\u2500 REGISTER FORM \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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
    <button onclick="doRegister()" style="display:block;width:100%;background:linear-gradient(135deg,#1b4332,#2d6a4f);color:#fff;border:none;border-radius:12px;padding:13px;font-size:.95rem;font-weight:700;cursor:pointer;font-family:Outfit,sans-serif;margin-bottom:12px">\u{1F331} Create Account</button>
    <p style="text-align:center;color:rgba(255,255,255,.5);font-size:.82rem">Already have an account? <a href="#" onclick="showLoginForm()" style="color:#52b788;font-weight:700">Sign in</a></p>
  `, '\u{1F331} Create Account');
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

// \u2500\u2500 ACCOUNT DASHBOARD \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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
        <div style="font-size:1.1rem;font-weight:800;color:#a3d9b8;margin-bottom:4px">\u{1F44B} Welcome back, ${profile.name.split(' ')[0]}!</div>
        <div style="font-size:.8rem;color:rgba(255,255,255,.5)">${profile.email}</div>
        <div style="display:flex;gap:20px;margin-top:14px;flex-wrap:wrap">
          <div><div style="font-size:1.5rem;font-weight:800;color:#52b788">\u{1F48E} ${loyalty.points}</div><div style="font-size:.72rem;color:rgba(255,255,255,.5)">Loyalty Points<br>\u2248 \u20A6${pointsValue.toLocaleString('en-NG')} value</div></div>
          <div><div style="font-size:1.5rem;font-weight:800;color:#52b788">${profile.total_orders || 0}</div><div style="font-size:.72rem;color:rgba(255,255,255,.5)">Total Orders</div></div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <button onclick="showMyOrders()" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#fff;border-radius:12px;padding:12px 16px;text-align:left;cursor:pointer;font-family:Outfit,sans-serif;font-size:.88rem;font-weight:600">\u{1F4E6} My Orders</button>
        <button onclick="showLoyaltyHistory(${loyalty.points})" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#fff;border-radius:12px;padding:12px 16px;text-align:left;cursor:pointer;font-family:Outfit,sans-serif;font-size:.88rem;font-weight:600">\u{1F48E} Loyalty Points \u2014 ${loyalty.points} pts</button>
        <button onclick="showMyPreorders()" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#fff;border-radius:12px;padding:12px 16px;text-align:left;cursor:pointer;font-family:Outfit,sans-serif;font-size:.88rem;font-weight:600">\u23F3 My Pre-orders</button>
        <button onclick="doLogout()" style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);color:#f87171;border-radius:12px;padding:12px 16px;text-align:left;cursor:pointer;font-family:Outfit,sans-serif;font-size:.88rem;font-weight:600;margin-top:4px">\u{1F6AA} Sign Out</button>
      </div>
    `, '\u{1F464} My Account');
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
          <div style="font-weight:800;color:#52b788;margin-top:6px">\u20A6${Number(o.total||0).toLocaleString('en-NG')}</div>
        </div>`;
      }).join('')
    : '<p style="color:rgba(255,255,255,.4);text-align:center;padding:20px 0">No orders yet. Start shopping! \u{1F6D2}</p>';
  setAccBody(`<button onclick="showAccountDashboard()" style="background:none;border:none;color:#52b788;cursor:pointer;font-family:Outfit,sans-serif;font-size:.85rem;margin-bottom:16px">\u2190 Back</button>${html}`, '\u{1F4E6} My Orders');
}

function showLoyaltyHistory(points) {
  const value = Math.floor(points * 0.5);
  setAccBody(`
    <button onclick="showAccountDashboard()" style="background:none;border:none;color:#52b788;cursor:pointer;font-family:Outfit,sans-serif;font-size:.85rem;margin-bottom:16px">\u2190 Back</button>
    <div style="background:linear-gradient(135deg,rgba(82,183,136,.15),rgba(27,67,50,.4));border:1px solid rgba(82,183,136,.3);border-radius:16px;padding:20px;margin-bottom:20px;text-align:center">
      <div style="font-size:2rem;font-weight:800;color:#52b788">\u{1F48E} ${points} Points</div>
      <div style="color:rgba(255,255,255,.5);font-size:.82rem;margin-top:4px">\u2248 \u20A6${value.toLocaleString('en-NG')} value</div>
    </div>
    <div style="background:rgba(255,255,255,.05);border-radius:12px;padding:16px;font-size:.82rem;color:rgba(255,255,255,.6);line-height:1.8">
      <div>\u{1F48E} Earn <strong style="color:#a3d9b8">1 point</strong> for every <strong style="color:#a3d9b8">\u20A6100</strong> spent</div>
      <div>\u{1F381} Each point worth <strong style="color:#a3d9b8">\u20A60.50</strong> at redemption</div>
      <div>\u2705 Minimum <strong style="color:#a3d9b8">100 points</strong> to redeem</div>
      <div>\u{1F6D2} Points applied automatically at checkout</div>
    </div>
  `, '\u{1F48E} Loyalty Points');
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
          <div style="font-size:.78rem;color:rgba(255,255,255,.5);margin-top:4px">Qty: ${o.quantity} ${o.unit||''} \u00B7 Expected: ${o.expected_date ? new Date(o.expected_date).toLocaleDateString('en-NG',{day:'2-digit',month:'short'}) : 'TBA'}</div>
        </div>`).join('')
    : '<p style="color:rgba(255,255,255,.4);text-align:center;padding:20px 0">No pre-orders yet.</p>';
  setAccBody(`<button onclick="showAccountDashboard()" style="background:none;border:none;color:#52b788;cursor:pointer;font-family:Outfit,sans-serif;font-size:.85rem;margin-bottom:16px">\u2190 Back</button>${html}`, '\u23F3 My Pre-orders');
}

function doLogout() {
  localStorage.removeItem(CUST_TOKEN_KEY);
  currentCustomer = null;
  updateAccountBtn();
  closeAccountModal();
}

// \u2500\u2500 PRE-ORDER MODAL \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function openPreorderModal(productId, productName, expectedDate, note) {
  const p = (window.products || []).find(x => x.id === productId) || {};
  const name = productName || p.name || 'Produce';
  const expDate = expectedDate || p.preorder_expected_date || '';
  const poNote = note || p.preorder_note || '';
  const unit = p.unit || 'kg';
  const priceStr = p.price ? '₦' + Number(p.price).toLocaleString() + (p.unit ? ' ' + p.unit : '') : '';
  const defaultQty = parseInt(document.getElementById('card-qty-' + productId)?.textContent) || 1;

  const prefilledName = typeof currentCustomer !== 'undefined' && currentCustomer ? `value="${currentCustomer.name || ''}"` : '';
  const prefilledPhone = typeof currentCustomer !== 'undefined' && currentCustomer ? `value="${currentCustomer.phone || ''}"` : '';

  const waText = encodeURIComponent(
    'Hello Pinnacles Farm! 🌾 I would like to pre-order:\n\n' + (p.emoji || '') + ' *' + name + '* (' + (priceStr || 'Fresh Produce') + ')\n\nPlease notify me when available!'
  );

  document.getElementById('preorder-modal-body').innerHTML = `
    <div style="background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.2);border-radius:14px;padding:14px 16px;margin-bottom:18px;font-size:.85rem;color:rgba(255,255,255,.8)">
      <div style="font-size:1.1rem;font-weight:700;color:#fbbf24;margin-bottom:4px">${p.emoji || '🌾'} ${name}</div>
      ${priceStr ? `<div style="font-size:.85rem;color:#52b788;font-weight:600;margin-bottom:6px">${priceStr}</div>` : ''}
      ${expDate ? `<div style="font-size:.8rem;color:#fde047;margin-bottom:4px">📅 Expected Harvest: <strong>${new Date(expDate).toLocaleDateString('en-NG',{day:'numeric',month:'long'})}</strong></div>` : ''}
      <div style="font-size:.78rem;color:rgba(255,255,255,.6)">${poNote || 'Reserve your fresh farm share now. No payment required until harvest is confirmed!'}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px">
      <div>
        <label style="display:block;font-size:.75rem;font-weight:600;color:rgba(255,255,255,.6);margin-bottom:4px">Your Name *</label>
        <input id="po-name" placeholder="Full name" ${prefilledName} style="width:100%;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.15);border-radius:12px;padding:11px 14px;color:#fff;font-family:Outfit,sans-serif;font-size:.9rem;outline:none" />
      </div>
      <div>
        <label style="display:block;font-size:.75rem;font-weight:600;color:rgba(255,255,255,.6);margin-bottom:4px">WhatsApp Phone Number *</label>
        <input id="po-phone" type="tel" placeholder="e.g. 08012345678" ${prefilledPhone} style="width:100%;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.15);border-radius:12px;padding:11px 14px;color:#fff;font-family:Outfit,sans-serif;font-size:.9rem;outline:none" />
      </div>
      <div style="display:flex;gap:10px">
        <div style="flex:1">
          <label style="display:block;font-size:.75rem;font-weight:600;color:rgba(255,255,255,.6);margin-bottom:4px">Quantity *</label>
          <input id="po-qty" type="number" min="1" value="${defaultQty}" style="width:100%;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.15);border-radius:12px;padding:11px 14px;color:#fff;font-family:Outfit,sans-serif;font-size:.9rem;outline:none" />
        </div>
        <div style="flex:1">
          <label style="display:block;font-size:.75rem;font-weight:600;color:rgba(255,255,255,.6);margin-bottom:4px">Unit</label>
          <input id="po-unit" value="${unit}" style="width:100%;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.15);border-radius:12px;padding:11px 14px;color:#fff;font-family:Outfit,sans-serif;font-size:.9rem;outline:none" />
        </div>
      </div>
      <div>
        <label style="display:block;font-size:.75rem;font-weight:600;color:rgba(255,255,255,.6);margin-bottom:4px">Special Requests / Notes (optional)</label>
        <textarea id="po-notes" placeholder="Delivery preferences, questions, or specific requirements..." rows="2" style="width:100%;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.15);border-radius:12px;padding:10px 14px;color:#fff;font-family:Outfit,sans-serif;font-size:.85rem;resize:vertical;outline:none"></textarea>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <button onclick="submitPreorder(${productId || 'null'}, '${name.replace(/'/g, "\\'")}', '${expDate}')" style="display:block;width:100%;background:linear-gradient(135deg,#92400e,#b45309);color:#fff;border:none;border-radius:12px;padding:13px;font-size:.95rem;font-weight:700;cursor:pointer;font-family:Outfit,sans-serif;transition:opacity .2s">⏳ Place Pre-order</button>
      <a href="https://wa.me/2349037505632?text=${waText}" target="_blank" style="display:flex;align-items:center;justify-content:center;gap:8px;background:#25D366;color:#fff;border-radius:12px;padding:12px;font-size:.92rem;font-weight:700;text-decoration:none;font-family:Outfit,sans-serif">💬 Pre-order via WhatsApp</a>
    </div>
  `;
  document.getElementById('preorder-modal').style.display = 'block';
}

function closePreorderModal() {
  document.getElementById('preorder-modal').style.display = 'none';
}

async function submitPreorder(productId, productName, expectedDate) {
  const name  = document.getElementById('po-name')?.value?.trim();
  const phone = document.getElementById('po-phone')?.value?.trim();
  const qty   = document.getElementById('po-qty')?.value;
  const unit  = document.getElementById('po-unit')?.value?.trim() || 'kg';
  const notes = document.getElementById('po-notes')?.value?.trim();
  if (!name || !phone || !qty) { alert('Please enter your name, WhatsApp phone number, and quantity'); return; }
  
  try {
    const res = await fetch('/api/customers/preorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: typeof currentCustomer !== 'undefined' && currentCustomer ? currentCustomer.id : null,
        customer_name: name,
        customer_phone: phone,
        customer_email: typeof currentCustomer !== 'undefined' && currentCustomer ? currentCustomer.email : null,
        product_id: productId || null,
        product_name: productName,
        quantity: parseFloat(qty) || 1,
        unit: unit,
        notes: notes || null,
        expected_date: expectedDate || null
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to submit pre-order');
    closePreorderModal();
    alert('✅ Pre-order placed successfully!\n\nWe have received your pre-order for ' + qty + ' ' + unit + ' of ' + productName + '.\n\nWe will contact you on WhatsApp at ' + phone + ' when ready!');
  } catch(e) {
    alert('Error submitting pre-order: ' + e.message);
  }
}

function preorderBadge(p) {
  return `<span class="avail-badge preorder-badge" onclick="event.stopPropagation();openPreorderModal(${p.id},'${p.name.replace(/'/g,"\\'")}','${p.preorder_expected_date||''}','${(p.preorder_note||'').replace(/'/g,"\\'")}')">\u23F3 Pre-order</span>`;
}

// \u2500\u2500 INIT: auto-login from stored customer token \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem(CUST_TOKEN_KEY);
  if (token) {
    try {
      const data = await custApi('GET', '/me');
      setCustomer(data, null);
    } catch { localStorage.removeItem(CUST_TOKEN_KEY); }
  }
});
