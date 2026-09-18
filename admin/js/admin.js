// ============================================================
// Pinnacles Farm — Admin Dashboard JavaScript
// ============================================================
const API = '/api';
let authToken = localStorage.getItem('pinnacles_admin_token');
let currentTab = 'overview';

// Ensure image paths resolve from root (handles relative paths like "images/foo.png")
// Also passes data: URLs (base64) through unchanged.
function imgSrc(url) {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('/') || url.startsWith('data:')) return url;
  return '/' + url;
}

// ── Boot ─────────────────────────────────────────────────────
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
}

function parseToken(token) {
  try { return JSON.parse(atob(token.split('.')[1])); } catch { return null; }
}

// ── Login ─────────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  const errEl = document.getElementById('login-error');
  btn.textContent = 'Signing in…';
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
  authToken = null;
  localStorage.removeItem('pinnacles_admin_token');
  showLogin();
}

// ── API Helper ────────────────────────────────────────────────
async function api(method, path, body = null, auth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  if (res.status === 401 || res.status === 403) { logout(); return {}; }
  return res.json();
}

// ── Tabs ──────────────────────────────────────────────────────
function showTab(tab, el) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  if (el) el.classList.add('active');
  currentTab = tab;
  const titles = { overview:'Dashboard Overview', orders:'Orders', products:'Products', gallery:'Farm Gallery', messages:'Messages', settings:'Settings' };
  document.getElementById('topbar-title').textContent = titles[tab] || tab;
  if (tab === 'overview') loadOverview();
  if (tab === 'orders')   loadOrders();
  if (tab === 'products') loadProducts();
  if (tab === 'gallery')  loadGallery();
  if (tab === 'messages') loadMessages();
}

// ── Overview ──────────────────────────────────────────────────
async function loadOverview() {
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
}

// ── Orders ────────────────────────────────────────────────────
async function loadOrders() {
  const status = document.getElementById('order-status-filter')?.value || '';
  const data = await api('GET', `/orders${status ? '?status=' + status : ''}`);
  const orders = data.orders || [];
  document.getElementById('orders-list').innerHTML = orders.length
    ? orders.map(o => `
        <div class="order-item">
          <div class="order-info">
            <div class="order-id">#${o.id} · ${formatDate(o.created_at)}</div>
            <div class="order-name">${o.customer_name || 'Customer'}</div>
            <div class="order-meta">📱 ${o.customer_phone || 'No phone'}</div>
            <div class="order-meta" style="margin-top:4px">
              ${o.items.map(i => `${i.emoji||''} ${i.name} ×${i.qty}`).join(' · ')}
            </div>
            <div class="order-actions">
              <span class="status-badge status-${o.status}">${o.status}</span>
              <select class="select-input btn-sm" onchange="updateOrderStatus(${o.id}, this.value)" style="width:auto;padding:4px 10px;font-size:.78rem;">
                ${['pending','confirmed','processing','delivered','cancelled'].map(s =>
                  `<option value="${s}" ${o.status===s?'selected':''}>${s}</option>`).join('')}
              </select>
              <button class="btn-outline btn-sm" onclick="openOrderModal(${o.id})">View</button>
              <button class="btn-outline btn-sm" onclick="waOrderReply(${o.id})">💬 WhatsApp</button>
              <button class="btn-outline btn-sm" onclick="openReceiptModal(${o.id})">📄 Receipt</button>
              <button class="btn-outline btn-sm btn-danger" onclick="deleteOrder(${o.id})">Delete</button>
            </div>
          </div>
          <div class="order-total">₦${Number(o.total).toLocaleString()}</div>
        </div>`).join('')
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
      <div style="font-size:.8rem;color:var(--text-muted);margin-bottom:4px">#${order.id} · ${formatDate(order.created_at)}</div>
      <div style="font-weight:700;font-size:1.1rem">${order.customer_name || 'Customer'}</div>
      <div style="color:var(--text-muted);font-size:.88rem">📱 ${order.customer_phone || 'No phone provided'}</div>
    </div>
    <div style="margin-bottom:16px">
      ${order.items.map(i => `
        <div class="order-detail-item">
          <span>${i.emoji||'🌿'} ${i.name} ×${i.qty}</span>
          <span>₦${Number(i.price * i.qty).toLocaleString()}</span>
        </div>`).join('')}
      <div class="order-detail-total"><span>Total</span><span>₦${Number(order.total).toLocaleString()}</span></div>
    </div>
    ${order.notes ? `<div class="msg-text" style="margin-bottom:16px">📝 ${order.notes}</div>` : ''}
    <span class="status-badge status-${order.status}" style="margin-bottom:16px;display:inline-block">${order.status}</span>

    ${order.whatsapp_msg ? `
    <div style="margin-bottom:16px">
      <button id="wa-toggle-${order.id}"
        onclick="toggleWaMsg('${order.id}')"
        style="background:rgba(37,211,102,.12);border:1px solid rgba(37,211,102,.35);color:#25D366;padding:9px 16px;border-radius:50px;font-size:.82rem;font-weight:700;cursor:pointer;width:100%;text-align:left;">
        📲 Show WhatsApp Message Sent
      </button>
      <div id="wa-box-${order.id}" style="display:none;margin-top:10px;background:rgba(37,211,102,.07);border:1px solid rgba(37,211,102,.2);border-radius:12px;padding:14px 16px;">
        <div style="font-size:.72rem;font-weight:700;color:#25D366;letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px;">Message sent to WhatsApp</div>
        <pre id="wa-pre-${order.id}" style="font-family:'Outfit',sans-serif;font-size:.83rem;color:var(--text-light);white-space:pre-wrap;word-break:break-word;margin:0;line-height:1.6"></pre>
        <button onclick="navigator.clipboard.writeText(document.getElementById('wa-pre-${order.id}').textContent).then(()=>showToast('Copied to clipboard!'))"
          style="margin-top:10px;background:none;border:1px solid rgba(37,211,102,.4);color:#25D366;padding:6px 14px;border-radius:50px;font-size:.78rem;font-weight:600;cursor:pointer;">📋 Copy Message</button>
      </div>
    </div>` : ''}

    ${order.customer_phone ? `<a href="https://wa.me/${order.customer_phone.replace(/\D/g,'')}?text=${encodeURIComponent('Hello '+order.customer_name+'! Your Pinnacles Farm order #'+order.id+' has been received. We will confirm shortly. 🌿')}" target="_blank" class="btn-primary wa-order-btn">💬 Message Customer on WhatsApp</a>` : ''}
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

// ── Products ──────────────────────────────────────────────────
let editingProductId = null;

async function loadProducts() {
  const products = await api('GET', '/products/all');
  document.getElementById('products-admin-grid').innerHTML = (Array.isArray(products) ? products : []).map(p => {
    const inStock = p.in_stock !== 0;
    const stockColor  = inStock ? 'rgba(82,183,136,.18)' : 'rgba(231,111,81,.15)';
    const stockText   = inStock ? 'rgba(82,183,136,1)'   : '#e76f51';
    const stockBorder = inStock ? 'rgba(82,183,136,.35)'  : 'rgba(231,111,81,.35)';
    const stockLabel  = inStock ? '✅ In Stock'           : '❌ Out of Stock';
    const toggleLabel = inStock ? '❌ Mark Out of Stock'  : '✅ Mark In Stock';
    const imgHtml = p.img
      ? '<img src="' + imgSrc(p.img) + '" alt="' + p.name + '" style="width:100%;height:100%;object-fit:cover;border-radius:12px" />'
      : '<div style="font-size:2.5rem;line-height:1">' + (p.emoji || '🌿') + '</div>';
    return '<div class="admin-product-card ' + (p.active ? '' : 'inactive') + '">' +
      '<div class="apc-img">' + imgHtml + '</div>' +
      '<div class="apc-body">' +
        '<div class="apc-name">' + p.name + '</div>' +
        '<div class="apc-price">\u20a6' + Number(p.price).toLocaleString() + ' <small style="color:var(--text-muted);font-weight:400">' + p.unit + '</small></div>' +
        '<div class="apc-meta" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;">' +
          '<span style="background:' + stockColor + ';color:' + stockText + ';border:1px solid ' + stockBorder + ';border-radius:50px;padding:2px 10px;font-size:.72rem;font-weight:700;">' + stockLabel + '</span>' +
          '<span style="color:var(--text-muted);font-size:.75rem;">' + p.category + ' · ' + p.tag + ' · Qty: ' + p.stock + '</span>' +
        '</div>' +
        '<div class="apc-actions">' +
          '<button class="btn-outline btn-sm" onclick="toggleProductStock(' + p.id + ',' + (inStock ? 0 : 1) + ')">' + toggleLabel + '</button>' +
          '<button class="btn-outline btn-sm" onclick="editProduct(' + p.id + ')">✏️ Edit</button>' +
          '<button class="btn-outline btn-sm btn-danger" onclick="deleteProduct(' + p.id + ')">Delete</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

async function toggleProductStock(id, newVal) {
  await api('PATCH', '/products/' + id + '/stock', { in_stock: newVal });
  showToast(newVal ? '✅ Marked In Stock' : '❌ Marked Out of Stock');
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
  document.getElementById('prod-emoji').value = product?.emoji || '🌿';
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
  btn.textContent = 'Saving…';

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
    showToast('❌ Error: ' + err.message);
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

// ── Messages ──────────────────────────────────────────────────
async function loadMessages() {
  const data = await api('GET', '/messages');
  const messages = data.messages || [];
  document.getElementById('messages-list').innerHTML = messages.length
    ? messages.map(m => `
        <div class="message-item ${m.is_read ? '' : 'msg-unread'}">
          <div style="flex:1">
            <div class="msg-name">${m.name} ${m.is_read ? '' : '<span style="background:var(--green-light);color:#fff;font-size:.65rem;padding:2px 8px;border-radius:50px;margin-left:6px">NEW</span>'}</div>
            <div class="msg-meta">📱 ${m.phone || 'No phone'} · ${formatDate(m.created_at)}</div>
            <div class="msg-text">${m.message}</div>
            <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
              ${!m.is_read ? `<button class="btn-outline btn-sm" onclick="markMsgRead(${m.id})">✅ Mark Read</button>` : ''}
              ${m.phone ? `<a href="https://wa.me/${m.phone.replace(/\D/g,'')}?text=${encodeURIComponent('Hello '+m.name+'! Thank you for contacting Pinnacles Resource Centre Farm. 🌿')}" target="_blank" class="btn-outline btn-sm">💬 Reply via WhatsApp</a>` : ''}
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

// ── Settings ──────────────────────────────────────────────────
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
  const text = `🌿 *PINNACLES RESOURCE CENTRE FARM* 🌿

✅ Fresh Farm Produce Available NOW!

🍅 Tomatoes
🫑 Peppers
🍓 Strawberries
🌽 Maize
🥕 Carrots
🥚 Farm Fresh Eggs
🫛 Green Peas
🥬 And Much More!

💯 100% Organically Grown
🚚 Fast Delivery Available
💰 Fair & Affordable Prices

📲 Order via WhatsApp: +234 903 750 5632
📧 agribusiness@pinnaclescentre.com

#PinnaclesFarm #FreshProduce #FarmToTable`;
  const box = document.getElementById('advert-output');
  box.textContent = text;
  box.style.display = 'block';
  // Copy to clipboard
  navigator.clipboard.writeText(text).then(() => showToast('Advert copied to clipboard!'));
}

// ── Helpers ───────────────────────────────────────────────────
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
  t.textContent = '✅ ' + msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

function toggleWaMsg(orderId) {
  const box = document.getElementById('wa-box-' + orderId);
  const btn = document.getElementById('wa-toggle-' + orderId);
  if (!box) return;
  const isOpen = box.style.display === 'block';
  box.style.display = isOpen ? 'none' : 'block';
  btn.textContent = isOpen ? '📲 Show WhatsApp Message Sent' : '📲 Hide WhatsApp Message';
}

// ── Gallery ───────────────────────────────────────────────────
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
             onerror="this.outerHTML='<div style=\'font-size:3rem;display:flex;align-items:center;justify-content:center;height:100%\'>🖼️</div>'" />
        ${item.wide ? '<span class="gac-wide-badge">WIDE</span>' : ''}
      </div>
      <div class="gac-body">
        <div class="gac-alt">${item.alt || '<em style="color:var(--text-muted)">No alt text</em>'}</div>
        ${item.caption ? `<div class="gac-caption">"${item.caption}"</div>` : ''}
        <div class="gac-order">Order: #${item.sort_order ?? idx}</div>
        <div class="gac-actions">
          <button class="btn-outline btn-sm" onclick="editGalleryItem(${item.id})">✏️ Edit</button>
          <button class="btn-outline btn-sm" onclick="moveGalleryItem(${item.id}, ${(item.sort_order ?? idx) - 1})" ${idx === 0 ? 'disabled' : ''}>↑</button>
          <button class="btn-outline btn-sm" onclick="moveGalleryItem(${item.id}, ${(item.sort_order ?? idx) + 1})" ${idx === items.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="btn-outline btn-sm btn-danger" onclick="deleteGalleryItem(${item.id})">🗑️ Delete</button>
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
  btn.textContent = 'Saving…';

  try {
    const fileInput = document.getElementById('gal-img-file');
    const isNew = !editingGalleryId;

    if (isNew && !fileInput.files[0]) {
      showToast('❌ Please select a photo to upload.');
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

    showToast(editingGalleryId ? 'Photo updated! 🖼️' : 'Photo added to gallery! 🌱');
    closeGalleryModal();
    loadGallery();
  } catch (err) {
    showToast('❌ Error: ' + err.message);
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

// ── Receipt Modal ─────────────────────────────────────────────
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
  document.getElementById('receipt-order-summary').innerHTML = '<div style="color:var(--text-muted);font-size:.85rem;">Loading…</div>';

  document.getElementById('receipt-modal-overlay').classList.add('open');
  document.getElementById('receipt-modal').classList.add('open');

  try {
    const data = await api('GET', '/orders');
    const order = (data.orders || []).find(o => o.id === orderId);
    if (order) {
      currentReceiptOrder = order;
      const itemsHtml = order.items.map(i =>
        '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);">' +
        '<span>' + (i.emoji || '🌿') + ' ' + i.name + ' ×' + i.qty + '</span>' +
        '<span style="font-weight:700;">₦' + Number(i.price * i.qty).toLocaleString() + '</span></div>'
      ).join('');
      document.getElementById('receipt-order-summary').innerHTML =
        '<div style="font-weight:700;margin-bottom:10px;color:var(--text-light);">Order #' + order.id + ' — ' + (order.customer_name || 'Customer') + '</div>' +
        '<div style="color:var(--text-muted);font-size:.8rem;margin-bottom:10px;">📱 ' + (order.customer_phone || 'No phone') + '</div>' +
        itemsHtml +
        '<div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:800;color:var(--green-light);">' +
        '<span>Total</span><span>₦' + Number(order.total).toLocaleString() + '</span></div>';
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

function sendReceiptWhatsApp() {
  if (!currentReceiptOrder) return;
  const o = currentReceiptOrder;

  // Format date like "18 September 2026"
  const dateStr = new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const receiptNo = String(o.id).padStart(4, '0');

  // Build items rows — padded to look tabular
  const itemLines = o.items.map(i => {
    const name = (i.emoji || '🌿') + ' ' + i.name;
    const qty  = '×' + i.qty;
    const amt  = '₦' + Number(i.price * i.qty).toLocaleString('en-NG');
    return name + '   ' + qty + '   *' + amt + '*';
  }).join('\n');

  const statusMap = { pending: '⏳ Pending', confirmed: '✅ Confirmed', processing: '🔄 Processing', delivered: '🚚 Delivered', cancelled: '❌ Cancelled' };
  const statusStr = statusMap[o.status] || o.status;
  const payMethod = (o.whatsapp_msg || '').startsWith('payisland_ref:') ? '💳 Online Payment' : '💬 WhatsApp Order';

  const pdfLink = currentReceiptUrl ? currentReceiptUrl + '/pdf' : null;
  const linkLine = pdfLink ? '\n📄 *Download PDF Receipt:*\n' + pdfLink : '';

  const SEP  = '━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  const LINE = '───────────────────────────';

  const msg =
    '🌿 *PINNACLES RESOURCE CENTRE FARM*\n' +
    '_FRESH · ORGANIC · FARM TO TABLE_\n\n' +
    SEP + '\n' +
    '       *OFFICIAL RECEIPT*\n' +
    'Receipt #' + receiptNo + '  |  ' + dateStr + '\n' +
    SEP + '\n\n' +
    '*BILLED TO*\n' +
    (o.customer_name || 'Customer') + '\n' +
    '📱 ' + (o.customer_phone || '—') + '\n\n' +
    '*ORDER DETAILS*\n' +
    'Order #' + o.id + '\n' +
    'Date: ' + dateStr + '\n\n' +
    LINE + '\n' +
    '*ITEMS PURCHASED*\n' +
    LINE + '\n' +
    itemLines + '\n' +
    LINE + '\n' +
    '*TOTAL          ₦' + Number(o.total).toLocaleString('en-NG') + '*\n' +
    LINE + '\n\n' +
    'Status:  ' + statusStr + '\n' +
    'Payment: ' + payMethod + '\n\n' +
    SEP + '\n' +
    'Thank you for shopping with us! 🌱\n' +
    '📧 agribusiness@pinnaclescentre.com\n' +
    '📲 +234 903 750 5632' +
    linkLine;

  const phone = (o.customer_phone || '').replace(/\D/g, '');
  const url = phone
    ? 'https://wa.me/' + phone + '?text=' + encodeURIComponent(msg)
    : 'https://wa.me/?text=' + encodeURIComponent(msg);
  window.open(url, '_blank');
}
function copyReceiptLink() {
  if (!currentReceiptUrl) { showToast('Receipt link not ready yet.'); return; }
  navigator.clipboard.writeText(currentReceiptUrl).then(() => showToast('🔗 Receipt link copied!'));
}

