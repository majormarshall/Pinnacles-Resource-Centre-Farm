// ===== CONFIG =====
const WA_NUMBER  = '2349037505632'; // +234 903 750 5632 — primary
const WA_NUMBER2 = '2347078210834'; // +234 707 821 0834 — secondary
const API_BASE = '/api'; // Backend API base URL
const USE_BACKEND = true; // Set false to run without backend

// ===== FALLBACK PRODUCTS (used if backend is offline) =====
const fallbackProducts = [
  { id:1, name:'Fresh Tomatoes', emoji:'🍅', img:'images/tomatoes.png', price:1500, unit:'per basket', description:'Sun-ripened, juicy tomatoes grown naturally on our farm.', category:'vegetables', tag:'Bestseller' },
  { id:2, name:'Peppers', emoji:'🫑', img:'images/pepper.png', price:1200, unit:'per pack', description:'Fresh bell peppers and chili peppers. Vibrant and full of flavour.', category:'vegetables', tag:'Fresh' },
  { id:3, name:'Strawberries', emoji:'🍓', img:'images/strawberry.png', price:3500, unit:'per punnet', description:'Sweet, juicy strawberries picked at peak ripeness.', category:'fruits', tag:'Premium' },
  { id:4, name:'Sweet Maize', emoji:'🌽', img:'images/maize.png', price:800, unit:'per 3 cobs', description:'Golden sweet maize cobs freshly harvested.', category:'grains', tag:'Fresh' },
  { id:5, name:'Carrots', emoji:'🥕', img:'images/carrots.png', price:1000, unit:'per bunch', description:'Crunchy sweet orange carrots. Great for juices and soups.', category:'vegetables', tag:'Organic' },
  { id:6, name:'Farm Fresh Eggs', emoji:'🥚', img:null, price:2500, unit:'per crate (30)', description:'Free-range farm eggs — rich, healthy and full of protein.', category:'proteins', tag:'Popular' },
  { id:7, name:'Green Peas', emoji:'🫛', img:null, price:1800, unit:'per kg', description:'Tender sweet green peas. Perfect for soups and rice dishes.', category:'vegetables', tag:'Fresh' },
  { id:8, name:'Fresh Greens', emoji:'🥬', img:null, price:600, unit:'per bunch', description:'Assorted fresh leafy greens including spinach and ugwu.', category:'vegetables', tag:'Daily Harvest' },
  { id:9, name:'Garden Cucumber', emoji:'🥒', img:null, price:700, unit:'per pack', description:'Cool crisp cucumbers perfect for salads and juicing.', category:'vegetables', tag:'Fresh' },
  { id:10, name:'Spring Onions', emoji:'🧅', img:null, price:500, unit:'per bunch', description:'Fresh spring onions with a mild sweet flavour.', category:'vegetables', tag:'Fresh' },
  { id:11, name:'Sweet Pepper', emoji:'🌶️', img:null, price:900, unit:'per pack', description:'Colourful sweet peppers — red, yellow and green.', category:'vegetables', tag:'Seasonal' },
  { id:12, name:'Farm Honey', emoji:'🍯', img:null, price:4500, unit:'per jar', description:'Pure raw natural honey from our farm bees.', category:'fruits', tag:'Natural' },
];

// ===== STATE =====
let products = [...fallbackProducts];
let cart = [];
let activeFilter = 'all';

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  await loadProductsFromAPI();
  renderProducts('all');
  await renderGallery();
  updateCartBadge();
  initNavScroll();
});

// ===== FETCH PRODUCTS FROM BACKEND =====
async function loadProductsFromAPI() {
  if (!USE_BACKEND) return;
  try {
    const res = await fetch(API_BASE + '/products');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        // Map backend field 'description' to 'desc' used in frontend
        products = data.map(p => ({ ...p, desc: p.description }));
      }
    }
  } catch { /* backend offline — use fallback */ }
}

// ===== NAVBAR =====
function initNavScroll() {
  const nav = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 60);
  });
}
function toggleNav() {
  document.getElementById('nav-links').classList.toggle('open');
}

// ===== PRODUCTS =====
function renderProducts(filter) {
  const grid = document.getElementById('products-grid');
  const filtered = filter === 'all' ? products : products.filter(p => p.category === filter);
  grid.innerHTML = filtered.map(p => `
    <div class="product-card" data-id="${p.id}" onclick="openModal(${p.id})">
      <div class="product-img-wrap">
        ${p.img ? `<img src="${p.img}" alt="${p.name}" onerror="this.parentElement.innerHTML='<div class=product-emoji-placeholder>${p.emoji}</div>'" />` : `<div class="product-emoji-placeholder">${p.emoji}</div>`}
        <span class="product-tag">${p.tag}</span>
      </div>
      <div class="product-info">
        <div class="product-name">${p.emoji} ${p.name}</div>
        <div class="product-desc">${p.desc}</div>
        <div class="product-footer">
          <div class="product-price">₦${p.price.toLocaleString()} <span>${p.unit}</span></div>
          <button class="add-to-cart" onclick="event.stopPropagation(); addToCart(${p.id})">+ Add</button>
        </div>
      </div>
    </div>
  `).join('');
}

function filterProducts(filter, btn) {
  activeFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderProducts(filter);
}

// ===== MODAL =====
function openModal(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const content = document.getElementById('modal-content');
  content.innerHTML = `
    ${p.img ? `<img src="${p.img}" alt="${p.name}" class="modal-img" onerror="this.outerHTML='<div class=modal-emoji>${p.emoji}</div>'" />` : `<div class="modal-emoji">${p.emoji}</div>`}
    <div class="modal-name">${p.name}</div>
    <div class="modal-price">₦${p.price.toLocaleString()} <small style="font-weight:400;color:var(--text-muted);font-size:.8rem">${p.unit}</small></div>
    <div class="modal-desc">${p.desc}</div>
    <div class="modal-actions">
      <button class="btn-primary" onclick="addToCart(${p.id}); closeModal()">🛒 Add to Cart</button>
      <button class="btn-outline" onclick="directOrder(${p.id})">📲 Order Now</button>
    </div>
  `;
  document.getElementById('modal-overlay').classList.add('open');
  document.getElementById('product-modal').classList.add('open');
}
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.getElementById('product-modal').classList.remove('open');
}

// ===== CART =====
function addToCart(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const existing = cart.find(x => x.id === id);
  if (existing) existing.qty++;
  else cart.push({ ...p, qty: 1 });
  updateCartBadge();
  renderCartItems();
  showCartToast(p.name);
}

function removeFromCart(id) {
  cart = cart.filter(x => x.id !== id);
  renderCartItems();
  updateCartBadge();
}

function changeQty(id, delta) {
  const item = cart.find(x => x.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) removeFromCart(id);
  else { renderCartItems(); updateCartBadge(); }
}

function updateCartBadge() {
  const total = cart.reduce((s, i) => s + i.qty, 0);
  document.getElementById('cart-badge').textContent = total;
}

function renderCartItems() {
  const container = document.getElementById('cart-items');
  const footer = document.getElementById('cart-footer');
  const empty = document.getElementById('cart-empty');
  if (cart.length === 0) {
    container.innerHTML = `<div class="cart-empty" id="cart-empty"><div class="empty-icon">🛒</div><p>Your cart is empty</p><span>Add some fresh produce!</span></div>`;
    footer.style.display = 'none';
    return;
  }
  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-emoji">
        ${item.img
          ? `<img src="${item.img}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;" onerror="this.outerHTML='${item.emoji}'" />`
          : item.emoji}
      </div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">₦${(item.price * item.qty).toLocaleString()}</div>
      </div>
      <div class="cart-item-controls">
        <button class="qty-btn" onclick="changeQty(${item.id},-1)">−</button>
        <span class="qty-num">${item.qty}</span>
        <button class="qty-btn" onclick="changeQty(${item.id},1)">+</button>
        <button class="remove-item" onclick="removeFromCart(${item.id})">🗑️</button>
      </div>
    </div>
  `).join('');
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  document.getElementById('cart-total-price').textContent = `₦${total.toLocaleString()}`;
  footer.style.display = 'block';
}

function toggleCart() {
  document.getElementById('cart-sidebar').classList.toggle('open');
  document.getElementById('cart-overlay').classList.toggle('open');
}

function showCartToast(name) {
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;bottom:100px;right:32px;background:var(--green);color:#fff;padding:12px 20px;border-radius:50px;font-weight:600;font-size:.9rem;z-index:3000;animation:slideIn .3s ease';
  toast.textContent = `✅ ${name} added!`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

// ===== WHATSAPP =====
function openWhatsApp(message) {
  const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
  return false;
}

// ── Order Checkout Modal ──────────────────────────────────────
function sendOrderToWhatsApp() {
  if (cart.length === 0) return;
  showOrderModal();
}

function showOrderModal() {
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const itemsSummary = cart.map(i => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);gap:12px;">
      <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
        <div style="width:36px;height:36px;border-radius:8px;overflow:hidden;flex-shrink:0;background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:1.3rem;">
          ${i.img ? `<img src="${i.img}" alt="${i.name}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'" />` : i.emoji}
        </div>
        <span style="font-size:.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${i.name} ×${i.qty}</span>
      </div>
      <strong style="color:var(--green-light);flex-shrink:0;">₦${(i.price*i.qty).toLocaleString()}</strong>
    </div>`).join('');

  // Inject modal HTML
  let modal = document.getElementById('order-checkout-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'order-checkout-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:5000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.75);backdrop-filter:blur(6px);padding:16px;';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:24px;width:100%;max-width:480px;max-height:90vh;display:flex;flex-direction:column;animation:slideIn .3s ease;overflow:hidden;">
      <!-- Header (always visible) -->
      <div style="background:linear-gradient(135deg,#1b4332,#2d6a4f);padding:20px 24px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
        <div>
          <h3 style="color:#fff;margin:0;font-size:1.1rem;">📦 Confirm Your Order</h3>
          <p style="color:rgba(255,255,255,.7);margin:4px 0 0;font-size:.82rem;">Review items &amp; enter your details</p>
        </div>
        <button onclick="closeOrderModal()" style="background:rgba(255,255,255,.15);border:none;color:#fff;width:36px;height:36px;border-radius:50%;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;">✕</button>
      </div>

      <!-- Scrollable Body -->
      <div style="padding:20px 24px;overflow-y:auto;flex:1;-webkit-overflow-scrolling:touch;">
        <!-- Order Summary -->
        <div style="margin-bottom:18px;">
          <div style="font-size:.78rem;font-weight:700;color:var(--green-light);letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px;">Order Summary</div>
          ${itemsSummary}
          <div style="display:flex;justify-content:space-between;padding:12px 0;margin-top:4px;">
            <strong style="color:#fff;">Total</strong>
            <strong style="color:var(--green-light);font-size:1.15rem;">₦${total.toLocaleString()}</strong>
          </div>
          <p style="font-size:.75rem;color:var(--text-muted);margin:4px 0 0;line-height:1.6;">
            📌 Farm gate prices — delivery cost not included. Final delivery charge will be confirmed via WhatsApp.
          </p>
        </div>

        <!-- Customer Details -->
        <div style="font-size:.78rem;font-weight:700;color:var(--green-light);letter-spacing:.08em;text-transform:uppercase;margin-bottom:12px;">Your Details</div>
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:.85rem;font-weight:600;color:var(--text-light);margin-bottom:6px;">Full Name</label>
          <input id="oc-name" type="text" placeholder="Enter your name" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:11px 14px;color:#fff;font-family:'Outfit',sans-serif;font-size:.95rem;" />
        </div>
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:.85rem;font-weight:600;color:var(--text-light);margin-bottom:6px;">WhatsApp / Phone Number <span style="color:var(--green-light)">*</span></label>
          <input id="oc-phone" type="tel" placeholder="e.g. 08012345678" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:11px 14px;color:#fff;font-family:'Outfit',sans-serif;font-size:.95rem;" />
        </div>
        <div style="margin-bottom:8px;">
          <label style="display:block;font-size:.85rem;font-weight:600;color:var(--text-light);margin-bottom:6px;">Delivery Notes (optional)</label>
          <textarea id="oc-notes" rows="2" placeholder="e.g. deliver to Lekki Phase 1, gate 5..." style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:11px 14px;color:#fff;font-family:'Outfit',sans-serif;font-size:.95rem;resize:none;"></textarea>
        </div>

        <div id="oc-error" style="display:none;background:rgba(231,111,81,.15);border:1px solid rgba(231,111,81,.4);color:#f87171;border-radius:8px;padding:10px 14px;margin-bottom:10px;font-size:.88rem;"></div>
      </div>

      <!-- Submit Button (always visible at bottom) -->
      <div style="padding:16px 24px;background:var(--bg2);border-top:1px solid var(--border);flex-shrink:0;">
        <button id="oc-submit-btn" onclick="submitOrder()" style="width:100%;background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;border:none;padding:15px;border-radius:50px;font-size:1rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;transition:opacity .2s;">
          <svg width="20" height="20" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="rgba(255,255,255,0.2)"/><path d="M23.5 8.5A10.45 10.45 0 0 0 16 5.5C10.2 5.5 5.5 10.2 5.5 16c0 1.85.48 3.65 1.4 5.24L5.5 26.5l5.4-1.38A10.43 10.43 0 0 0 16 26.5c5.8 0 10.5-4.7 10.5-10.5 0-2.8-1.09-5.43-3-7.5z" fill="white"/></svg>
          Send Order via WhatsApp
        </button>
        <p style="text-align:center;font-size:.75rem;color:var(--text-muted);margin-top:8px;">Your order will be saved &amp; sent directly to our WhatsApp for confirmation.</p>
      </div>
    </div>`;

  modal.style.display = 'flex';
  setTimeout(() => { const inp = document.getElementById('oc-name'); if(inp) inp.focus(); }, 100);
}

function closeOrderModal() {
  const modal = document.getElementById('order-checkout-modal');
  if (modal) modal.style.display = 'none';
}

async function submitOrder() {
  const name  = (document.getElementById('oc-name').value  || '').trim() || 'Customer';
  const phone = (document.getElementById('oc-phone').value || '').trim();
  const notes = (document.getElementById('oc-notes').value || '').trim();
  const errEl = document.getElementById('oc-error');
  const btn   = document.getElementById('oc-submit-btn');

  if (!phone) {
    errEl.textContent = '⚠️ Please enter your WhatsApp/phone number so we can confirm your order.';
    errEl.style.display = 'block';
    document.getElementById('oc-phone').focus();
    return;
  }
  errEl.style.display = 'none';

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  btn.disabled = true;
  btn.style.opacity = '.6';
  btn.innerHTML = '⏳ Sending...';

  // 2 ── Build WhatsApp message to farm (plain text — no emoji to avoid diamond symbols)
  let msg = `Hello Pinnacles Resource Centre Farm!\n\n*NEW ORDER*\n\n`;
  cart.forEach(item => {
    msg += `- *${item.name}* x${item.qty} -- N${(item.price * item.qty).toLocaleString()}\n`;
  });
  msg += `\n*Total: N${total.toLocaleString()}*`;
  msg += `\n\n*Customer:* ${name}`;
  msg += `\n*Phone:* ${phone}`;
  if (notes) msg += `\n*Notes:* ${notes}`;
  msg += `\n\nPlease confirm availability and delivery. Thank you!`;

  // 1 ── Save to backend (and trigger admin email)
  if (USE_BACKEND) {
    try {
      await fetch(API_BASE + '/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: name,
          customer_phone: phone,
          items: cart.map(i => ({ id: i.id, name: i.name, emoji: i.emoji, price: i.price, qty: i.qty })),
          total,
          notes,
          whatsapp_msg: msg
        })
      });
    } catch { /* backend offline — still open WhatsApp */ }
  }

  // 3 ── Show success with two send buttons
  showOrderSuccess(name, msg);

  // 4 ── Clear cart
  cart = [];
  updateCartBadge();
  renderCartItems();
  toggleCart();
}

function showOrderSuccess(name, msg) {
  const modal = document.getElementById('order-checkout-modal');
  if (!modal) return;
  const wa1 = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
  const wa2 = `https://wa.me/${WA_NUMBER2}?text=${encodeURIComponent(msg)}`;
  modal.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:24px;width:100%;max-width:420px;padding:40px 28px;text-align:center;animation:slideIn .3s ease;">
      <div style="font-size:3.5rem;margin-bottom:12px;">✅</div>
      <h3 style="color:#fff;font-size:1.2rem;margin-bottom:8px;">Order Recorded!</h3>
      <p style="color:var(--text-muted);font-size:.88rem;margin-bottom:24px;line-height:1.6;">Hi ${name}! Tap the buttons below to send your order to us on WhatsApp.</p>
      <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px;">
        <a href="${wa1}" target="_blank" style="display:flex;align-items:center;justify-content:center;gap:10px;background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;border:none;padding:14px 20px;border-radius:50px;font-size:.95rem;font-weight:700;cursor:pointer;text-decoration:none;">
          📲 Send to +234 903 750 5632
        </a>
        <a href="${wa2}" target="_blank" style="display:flex;align-items:center;justify-content:center;gap:10px;background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;border:none;padding:14px 20px;border-radius:50px;font-size:.95rem;font-weight:700;cursor:pointer;text-decoration:none;opacity:.85;">
          📲 Send to +234 707 821 0834
        </a>
      </div>
      <button onclick="closeOrderModal()" style="background:var(--bg3);border:1px solid var(--border);color:var(--text-muted);padding:10px 28px;border-radius:50px;font-size:.88rem;font-weight:600;cursor:pointer;">Done</button>
    </div>`;
}

function directOrder(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const msg = `Hello Pinnacles Resource Centre Farm!\n\nI would like to order:\n- *${p.name}* -- N${p.price.toLocaleString()} ${p.unit}\n\nPlease confirm availability. Thank you!`;
  openWhatsApp(msg);
  closeModal();
}

// ===== SHARE =====
function shareOnWhatsApp() {
  const msg = `🌿 *Pinnacles Resource Centre Farm*\n\nGet fresh farm produce delivered to you!\n\n🍅 Tomatoes  🫑 Peppers  🍓 Strawberries\n🌽 Maize  🥕 Carrots  🥚 Eggs  🫛 Green Peas\n\n📲 Order directly on WhatsApp!\n#PinnaclesFarm #FreshProduce #FarmToTable`;
  openWhatsApp(msg);
}

function copyLink() {
  navigator.clipboard.writeText(window.location.href).then(() => {
    const msg = document.getElementById('copy-msg');
    msg.style.display = 'block';
    setTimeout(() => msg.style.display = 'none', 3000);
  });
}

// ===== GENERATE ADVERT =====
function generateAdvert() {
  const advertText = `🌿 *PINNACLES RESOURCE CENTRE FARM* 🌿\n\n✅ Fresh Farm Produce Available NOW!\n\n🍅 Tomatoes\n🫑 Peppers\n🍓 Strawberries\n🌽 Maize\n🥕 Carrots\n🥚 Farm Fresh Eggs\n🫛 Green Peas\n🥬 And Much More!\n\n💯 100% Organically Grown\n🚚 Fast Delivery Available\n💰 Fair & Affordable Prices\n\n📲 Order via WhatsApp Now!\nDon't miss out — get your fresh produce today!\n\n#PinnaclesFarm #FreshProduce #OrganicFood #FarmToTable #NigeriaFarms`;

  document.getElementById('advert-modal-content').innerHTML = `
    <h3>📢 Your WhatsApp Advert</h3>
    <p>Copy and share this advert on WhatsApp, Facebook, or any platform!</p>
    <div class="advert-text-box">${advertText}</div>
    <div class="advert-modal-actions">
      <button class="share-btn wa" onclick="sendAdvertOnWhatsApp()">📲 Share on WhatsApp</button>
      <button class="share-btn copy" onclick="copyAdvert()">📋 Copy Text</button>
    </div>
    <div id="advert-copy-msg" class="copy-msg" style="display:none;margin-top:10px">✅ Advert copied!</div>
  `;
  document.getElementById('advert-modal-overlay').classList.add('open');
  document.getElementById('advert-modal').classList.add('open');
}

function sendAdvertOnWhatsApp() {
  const msg = `🌿 *PINNACLES RESOURCE CENTRE FARM* 🌿\n\n✅ Fresh Farm Produce Available NOW!\n\n🍅 Tomatoes | 🫑 Peppers | 🍓 Strawberries\n🌽 Maize | 🥕 Carrots | 🥚 Farm Fresh Eggs\n🫛 Green Peas | 🥬 And Much More!\n\n💯 100% Organically Grown\n🚚 Fast Delivery Available\n💰 Fair & Affordable Prices\n\n📲 Order via WhatsApp Now!\n\n#PinnaclesFarm #FreshProduce #FarmToTable`;
  openWhatsApp(msg);
}

function copyAdvert() {
  const text = document.querySelector('.advert-text-box').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const msg = document.getElementById('advert-copy-msg');
    msg.style.display = 'block';
    setTimeout(() => msg.style.display = 'none', 3000);
  });
}

function closeAdvertModal() {
  document.getElementById('advert-modal-overlay').classList.remove('open');
  document.getElementById('advert-modal').classList.remove('open');
}

// ===== CONTACT FORM =====
async function sendContactMessage(e) {
  e.preventDefault();
  const name = document.getElementById('contact-name').value;
  const phone = document.getElementById('contact-phone').value;
  const msg = document.getElementById('contact-msg').value;

  // Save to backend
  if (USE_BACKEND) {
    try {
      await fetch(API_BASE + '/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, message: msg })
      });
    } catch { /* offline fallback */ }
  }

  const waMsg = `Hello Pinnacles Resource Centre Farm!\n\n*Name:* ${name}\n*Phone:* ${phone || 'Not provided'}\n\n*Message:*\n${msg}`;
  openWhatsApp(waMsg);
}

// ===== GALLERY =====
const FALLBACK_GALLERY = [
  { img:'images/farm_hero.png', alt:'Pinnacles Farm Fields', wide:1 },
  { img:'images/tomatoes.png',  alt:'Fresh Tomatoes',        wide:0 },
  { img:'images/strawberry.png',alt:'Strawberries',          wide:0 },
  { img:'images/pepper.png',    alt:'Peppers',               wide:0 },
  { img:'images/maize.png',     alt:'Sweet Maize',           wide:0 },
  { img:'images/carrots.png',   alt:'Carrots',               wide:0 },
];

async function renderGallery() {
  let items = FALLBACK_GALLERY;
  if (USE_BACKEND) {
    try {
      const res = await fetch(API_BASE + '/gallery');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) items = data;
      }
    } catch { /* backend offline — use fallback */ }
  }
  document.getElementById('gallery-grid').innerHTML = items.map(item => `
    <div class="gallery-item${item.wide ? ' wide' : ''}">
      <img src="${item.img}" alt="${item.alt || 'Farm photo'}"
           onerror="this.outerHTML='<div class=gallery-emoji>🌿</div>'" />
      ${item.caption ? `<div class="gallery-caption">${item.caption}</div>` : ''}
    </div>
  `).join('');
}

// ===== ANIMATION =====
const styleEl = document.createElement('style');
styleEl.textContent = `@keyframes slideIn{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}`;
document.head.appendChild(styleEl);

// Intersection Observer for fade-in
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => { if(e.isIntersecting) { e.target.style.opacity='1'; e.target.style.transform='translateY(0)'; }});
}, { threshold: 0.1 });
document.querySelectorAll('.why-card, .product-card, .contact-card').forEach(el => {
  el.style.opacity = '0'; el.style.transform = 'translateY(30px)'; el.style.transition = 'opacity .5s ease, transform .5s ease';
  observer.observe(el);
});
