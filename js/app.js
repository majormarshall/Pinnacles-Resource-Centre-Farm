// ===== CONFIG =====
const WA_NUMBER = '2347078210834'; // +234 707 821 0834 — Pinnacles Resource Centre Farm
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
  renderGallery();
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
      <div class="cart-item-emoji">${item.emoji}</div>
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

async function sendOrderToWhatsApp() {
  if (cart.length === 0) return;
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  // Show name/phone prompt
  const name = prompt('Your name (optional):') || 'Customer';
  const phone = prompt('Your phone/WhatsApp number (optional):') || '';

  // Save order to backend
  if (USE_BACKEND) {
    try {
      await fetch(API_BASE + '/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: name,
          customer_phone: phone,
          items: cart.map(i => ({ id:i.id, name:i.name, emoji:i.emoji, price:i.price, qty:i.qty })),
          total
        })
      });
    } catch { /* backend offline — still send WhatsApp */ }
  }

  let msg = `Hello Pinnacles Resource Centre Farm! 🌿\n\nI would like to place the following order:\n\n`;
  cart.forEach(item => {
    msg += `${item.emoji} *${item.name}* x${item.qty} — ₦${(item.price * item.qty).toLocaleString()}\n`;
  });
  msg += `\n*Total: ₦${total.toLocaleString()}*`;
  if (name !== 'Customer') msg += `\n*Name:* ${name}`;
  if (phone) msg += `\n*Phone:* ${phone}`;
  msg += `\n\nPlease confirm availability and delivery. Thank you!`;
  openWhatsApp(msg);
}

function directOrder(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const msg = `Hello Pinnacles Farm! 🌿\n\nI would like to order:\n${p.emoji} *${p.name}* — ₦${p.price.toLocaleString()} ${p.unit}\n\nPlease confirm availability. Thank you!`;
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

  const waMsg = `Hello Pinnacles Farm! 🌿\n\n*Name:* ${name}\n*Phone:* ${phone || 'Not provided'}\n\n*Message:*\n${msg}`;
  openWhatsApp(waMsg);
}

// ===== GALLERY =====
function renderGallery() {
  const items = [
    { img:'images/farm_hero.png', emoji:'🌿', wide:true, alt:'Pinnacles Farm Fields' },
    { img:'images/tomatoes.png', emoji:'🍅', wide:false, alt:'Fresh Tomatoes' },
    { img:'images/strawberry.png', emoji:'🍓', wide:false, alt:'Strawberries' },
    { img:'images/pepper.png', emoji:'🫑', wide:false, alt:'Peppers' },
    { img:'images/maize.png', emoji:'🌽', wide:false, alt:'Sweet Maize' },
    { img:'images/carrots.png', emoji:'🥕', wide:false, alt:'Carrots' },
  ];
  document.getElementById('gallery-grid').innerHTML = items.map(item => `
    <div class="gallery-item${item.wide?' wide':''}">
      ${item.img ? `<img src="${item.img}" alt="${item.alt}" onerror="this.outerHTML='<div class=gallery-emoji>${item.emoji}</div>'" />` : `<div class="gallery-emoji">${item.emoji}</div>`}
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
