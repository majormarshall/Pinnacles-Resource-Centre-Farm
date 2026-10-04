// ===== CONFIG =====
const WA_NUMBER  = '2349037505632'; // +234 903 750 5632 \u2014 primary
const WA_NUMBER2 = '2347078210834'; // +234 707 821 0834 \u2014 secondary
const API_BASE = '/api'; // Backend API base URL
const USE_BACKEND = true; // Set false to run without backend

// ===== FALLBACK PRODUCTS (used if backend is offline) =====
const fallbackProducts = [
  { id:1, name:'Fresh Tomatoes', emoji:'\u{1F345}', img:'images/tomatoes.png', price:1500, unit:'per basket', description:'Sun-ripened, juicy tomatoes grown naturally on our farm.', category:'vegetables', tag:'Bestseller', in_stock:1 },
  { id:2, name:'Peppers', emoji:'\u{1FAD1}', img:'images/pepper.png', price:1200, unit:'per pack', description:'Fresh bell peppers and chili peppers. Vibrant and full of flavour.', category:'vegetables', tag:'Fresh', in_stock:1 },
  { id:3, name:'Strawberries', emoji:'\u{1F353}', img:'images/strawberry.png', price:3500, unit:'per punnet', description:'Sweet, juicy strawberries picked at peak ripeness.', category:'fruits', tag:'Premium', in_stock:1 },
  { id:4, name:'Sweet Maize', emoji:'\u{1F33D}', img:'images/maize.png', price:800, unit:'per 3 cobs', description:'Golden sweet maize cobs freshly harvested.', category:'grains', tag:'Fresh', in_stock:1 },
  { id:5, name:'Carrots', emoji:'\u{1F955}', img:'images/carrots.png', price:1000, unit:'per bunch', description:'Crunchy sweet orange carrots. Great for juices and soups.', category:'vegetables', tag:'Organic', in_stock:1 },
  { id:6, name:'Farm Fresh Eggs', emoji:'\u{1F95A}', img:null, price:2500, unit:'per crate (30)', description:'Free-range farm eggs \u2014 rich, healthy and full of protein.', category:'proteins', tag:'Popular', in_stock:1 },
  { id:7, name:'Green Peas', emoji:'\u{1FADB}', img:null, price:1800, unit:'per kg', description:'Tender sweet green peas. Perfect for soups and rice dishes.', category:'vegetables', tag:'Fresh', in_stock:1 },
  { id:8, name:'Fresh Greens', emoji:'\u{1F96C}', img:null, price:600, unit:'per bunch', description:'Assorted fresh leafy greens including spinach and ugwu.', category:'vegetables', tag:'Daily Harvest', in_stock:1 },
  { id:9, name:'Garden Cucumber', emoji:'\u00F0\u0178\u00A5\u2019', img:null, price:700, unit:'per pack', description:'Cool crisp cucumbers perfect for salads and juicing.', category:'vegetables', tag:'Fresh', in_stock:1 },
  { id:10, name:'Spring Onions', emoji:'\u00F0\u0178\u00A7\u2026', img:null, price:500, unit:'per bunch', description:'Fresh spring onions with a mild sweet flavour.', category:'vegetables', tag:'Fresh', in_stock:1 },
  { id:11, name:'Sweet Pepper', emoji:'\u00F0\u0178\u0152\u00B6\u00EF\u00B8\u00C2\u008F', img:null, price:900, unit:'per pack', description:'Colourful sweet peppers \u2014 red, yellow and green.', category:'vegetables', tag:'Seasonal', in_stock:1 },
  { id:12, name:'Farm Honey', emoji:'\u00F0\u0178\u00C2\u008D\u00AF', img:null, price:4500, unit:'per jar', description:'Pure raw natural honey from our farm bees.', category:'fruits', tag:'Natural', in_stock:1 },
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
  checkPaymentReturn(); // Handle PayIsland redirect back
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
        products = data.map(p => ({ ...p, desc: p.description, price: Number(p.price||0), in_stock: (p.in_stock===true||p.in_stock===1||Number(p.in_stock)>0)?1:0 }));
      }
    }
  } catch { /* backend offline \u2014 use fallback */ }
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
  if (!grid) return;
  grid.innerHTML = filtered.map(p => {
    const inStock = p.in_stock === true || p.in_stock === 1 || Number(p.in_stock) > 0;
    const preorder = !inStock && p.preorder_available;
    const priceStr = '\u20A6' + Number(p.price || 0).toLocaleString();
    const waMsg = encodeURIComponent(
      'Hello Pinnacles Farm! I\'d like to order:\n\n' + (p.emoji||'') + ' *' + p.name + '* \u2014 ' +
      priceStr + ' ' + p.unit + '\n\nPlease confirm availability and delivery cost.'
    );
    const badge = inStock
      ? '<span class="avail-badge avail-in">\u{1F7E2} In Stock</span>'
      : preorder
        ? '<span class="avail-badge avail-pre" onclick="openPreorderModal(' + p.id + ')" style="cursor:pointer">\u23F3 Pre-order</span>'
        : '<span class="avail-badge avail-out">\u{1F534} Out of Stock</span>';
    const imgHtml = p.img
      ? '<img src="' + p.img + '" alt="' + p.name + '" onerror="this.parentElement.innerHTML=\'<div class=product-emoji-placeholder>' + (p.emoji||'') + '</div>\'" />'
      : '<div class="product-emoji-placeholder">' + (p.emoji||'') + '</div>';
    return '<div class="product-card' + (inStock ? '' : ' out-of-stock') + '" data-id="' + p.id + '">' +
      '<div class="product-img-wrap" onclick="openModal(' + p.id + ')" style="cursor:pointer">' +
        imgHtml +
        '<span class="product-tag">' + (p.tag||'') + '</span>' +
        badge +
      '</div>' +
      '<div class="product-info">' +
        '<div class="product-name">' + (p.emoji||'') + ' ' + p.name + '</div>' +
        '<div class="product-price-row">' +
          '<div class="product-price">' + priceStr + ' <span>' + p.unit + '</span></div>' +
        '</div>' +
        '<div class="product-qty-row">' +
          '<button class="qty-btn" onclick="changeCardQty(' + p.id + ',-1)"' + (!inStock ? ' disabled' : '') + '>\u2212</button>' +
          '<span class="qty-val" id="card-qty-' + p.id + '">1</span>' +
          '<button class="qty-btn" onclick="changeCardQty(' + p.id + ',1)"' + (!inStock ? ' disabled' : '') + '>+</button>' +
        '</div>' +
        '<div class="product-card-actions">' +
          (inStock
            ? '<button class="btn-cart" onclick="addToCartWithQty(' + p.id + ')">\u{1F6D2} Add to Cart</button>'
            : preorder
              ? '<button class="btn-cart" onclick="openPreorderModal(' + p.id + ')" style="background:linear-gradient(135deg,#92400e,#b45309)">\u23F3 Pre-order</button>'
              : '<button class="btn-cart" disabled>\u{1F534} Out of Stock</button>') +
          '<a class="btn-wa-card" href="https://wa.me/2349037505632?text=' + waMsg.replace(/'/g, "\'") + '" target="_blank"' +
            (!inStock ? ' style="opacity:.5;pointer-events:none"' : '') + '>\u{1F4AC} WhatsApp</a>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}
function changeCardQty(id, delta) {
  const el = document.getElementById('card-qty-' + id);
  if (!el) return;
  const current = parseInt(el.textContent) || 1;
  el.textContent = Math.max(1, current + delta);
}

function addToCartWithQty(id) {
  const el = document.getElementById('card-qty-' + id);
  const qty = el ? parseInt(el.textContent) || 1 : 1;
  for (let i = 0; i < qty; i++) addToCart(id);
  if (el) el.textContent = '1';
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
    <div class="modal-price">\u20A6${Number(p.price||0).toLocaleString()} <small style="font-weight:400;color:var(--text-muted);font-size:.8rem">${p.unit}</small></div>
    <div class="modal-desc">${p.desc}</div>
    <div class="modal-actions">
      ${p.in_stock !== 0
        ? '<button class="btn-primary" onclick="addToCart(' + p.id + '); closeModal()">\u{1F6D2} Add to Cart</button><button class="btn-outline" onclick="directOrder(' + p.id + ')">\u{1F4F2} Order Now</button>'
        : '<button class="btn-primary" disabled style="opacity:.45;cursor:not-allowed;">\u274C Out of Stock</button>'}
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
  if (p.in_stock === 0) { showCartToast('\u274C ' + p.name + ' is out of stock'); return; }
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
    container.innerHTML = `<div class="cart-empty" id="cart-empty"><div class="empty-icon">\u{1F6D2}</div><p>Your cart is empty</p><span>Add some fresh produce!</span></div>`;
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
        <div class="cart-item-price">\u20A6${(item.price * item.qty).toLocaleString()}</div>
      </div>
      <div class="cart-item-controls">
        <button class="qty-btn" onclick="changeQty(${item.id},-1)">\u2212</button>
        <span class="qty-num">${item.qty}</span>
        <button class="qty-btn" onclick="changeQty(${item.id},1)">+</button>
        <button class="remove-item" onclick="removeFromCart(${item.id})">\u{1F5D1}</button>
      </div>
    </div>
  `).join('');
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  document.getElementById('cart-total-price').textContent = `\u20A6${total.toLocaleString()}`;
  footer.style.display = 'block';
}

function toggleCart() {
  document.getElementById('cart-sidebar').classList.toggle('open');
  document.getElementById('cart-overlay').classList.toggle('open');
}

function showCartToast(name) {
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;bottom:100px;right:32px;background:var(--green);color:#fff;padding:12px 20px;border-radius:50px;font-weight:600;font-size:.9rem;z-index:3000;animation:slideIn .3s ease';
  toast.textContent = `\u2705 ${name} added!`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

// ===== WHATSAPP =====
function openWhatsApp(message) {
  const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
  return false;
}

// \u00E2\u00E2\u20AC\u009D\u2500 Order Checkout Modal \u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500
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
        <span style="font-size:.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${i.name} \u00C3\u2014${i.qty}</span>
      </div>
      <strong style="color:var(--green-light);flex-shrink:0;">\u20A6${(i.price*i.qty).toLocaleString()}</strong>
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
          <h3 style="color:#fff;margin:0;font-size:1.1rem;">\u00F0\u0178\u201C\u00A6 Confirm Your Order</h3>
          <p style="color:rgba(255,255,255,.7);margin:4px 0 0;font-size:.82rem;">Review items &amp; enter your details</p>
        </div>
        <button onclick="closeOrderModal()" style="background:rgba(255,255,255,.15);border:none;color:#fff;width:36px;height:36px;border-radius:50%;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;">\u00E2\u0153\u2022</button>
      </div>

      <!-- Scrollable Body -->
      <div style="padding:20px 24px;overflow-y:auto;flex:1;-webkit-overflow-scrolling:touch;">
        <!-- Order Summary -->
        <div style="margin-bottom:18px;">
          <div style="font-size:.78rem;font-weight:700;color:var(--green-light);letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px;">Order Summary</div>
          ${itemsSummary}
          <div style="display:flex;justify-content:space-between;padding:12px 0;margin-top:4px;">
            <strong style="color:#fff;">Total</strong>
            <strong style="color:var(--green-light);font-size:1.15rem;">\u20A6${total.toLocaleString()}</strong>
          </div>
          <p style="font-size:.75rem;color:var(--text-muted);margin:4px 0 0;line-height:1.6;">
            \u00F0\u0178\u201C\u0152 Farm gate prices \u2014 delivery cost not included. Final delivery charge will be confirmed via WhatsApp.
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
          <div style="display:flex;gap:8px;">
            <select id="oc-phone-code" style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:11px 8px;color:#fff;font-family:'Outfit',sans-serif;font-size:.85rem;flex-shrink:0;width:150px;cursor:pointer;">
              <optgroup label="Popular">
                <option value="+234">\u00F0\u0178\u2021\u00B3\u00F0\u0178\u2021\u00AC +234 Nigeria</option>
                <option value="+233">\u00F0\u0178\u2021\u00AC\u00F0\u0178\u2021\u00AD +233 Ghana</option>
                <option value="+27">\u00F0\u0178\u2021\u00BF\u00F0\u0178\u2021\u00A6 +27 S.Africa</option>
                <option value="+254">\u00F0\u0178\u2021\u00B0\u00F0\u0178\u2021\u00AA +254 Kenya</option>
                <option value="+44">\u00F0\u0178\u2021\u00AC\u00F0\u0178\u2021\u00A7 +44 UK</option>
                <option value="+1">\u00F0\u0178\u2021\u00BA\u00F0\u0178\u2021\u00B8 +1 USA/Canada</option>
              </optgroup>
              <optgroup label="Africa">
                <option value="+20">\u00F0\u0178\u2021\u00AA\u00F0\u0178\u2021\u00AC +20 Egypt</option>
                <option value="+212">\u00F0\u0178\u2021\u00B2\u00F0\u0178\u2021\u00A6 +212 Morocco</option>
                <option value="+213">\u00F0\u0178\u2021\u00A9\u00F0\u0178\u2021\u00BF +213 Algeria</option>
                <option value="+216">\u00F0\u0178\u2021\u00B9\u00F0\u0178\u2021\u00B3 +216 Tunisia</option>
                <option value="+221">\u00F0\u0178\u2021\u00B8\u00F0\u0178\u2021\u00B3 +221 Senegal</option>
                <option value="+225">\u00F0\u0178\u2021\u00A8\u00F0\u0178\u2021\u00AE +225 Ivory Coast</option>
                <option value="+226">\u00F0\u0178\u2021\u00A7\u00F0\u0178\u2021\u00AB +226 Burkina Faso</option>
                <option value="+227">\u00F0\u0178\u2021\u00B3\u00F0\u0178\u2021\u00AA +227 Niger</option>
                <option value="+228">\u00F0\u0178\u2021\u00B9\u00F0\u0178\u2021\u00AC +228 Togo</option>
                <option value="+229">\u00F0\u0178\u2021\u00A7\u00F0\u0178\u2021\u00AF +229 Benin</option>
                <option value="+237">\u00F0\u0178\u2021\u00A8\u00F0\u0178\u2021\u00B2 +237 Cameroon</option>
                <option value="+243">\u00F0\u0178\u2021\u00A8\u00F0\u0178\u2021\u00A9 +243 DR Congo</option>
                <option value="+244">\u00F0\u0178\u2021\u00A6\u00F0\u0178\u2021\u00B4 +244 Angola</option>
                <option value="+249">\u00F0\u0178\u2021\u00B8\u00F0\u0178\u2021\u00A9 +249 Sudan</option>
                <option value="+250">\u00F0\u0178\u2021\u00B7\u00F0\u0178\u2021\u00BC +250 Rwanda</option>
                <option value="+251">\u00F0\u0178\u2021\u00AA\u00F0\u0178\u2021\u00B9 +251 Ethiopia</option>
                <option value="+255">\u00F0\u0178\u2021\u00B9\u00F0\u0178\u2021\u00BF +255 Tanzania</option>
                <option value="+256">\u00F0\u0178\u2021\u00BA\u00F0\u0178\u2021\u00AC +256 Uganda</option>
                <option value="+260">\u00F0\u0178\u2021\u00BF\u00F0\u0178\u2021\u00B2 +260 Zambia</option>
                <option value="+263">\u00F0\u0178\u2021\u00BF\u00F0\u0178\u2021\u00BC +263 Zimbabwe</option>
              </optgroup>
              <optgroup label="Europe">
                <option value="+33">\u00F0\u0178\u2021\u00AB\u00F0\u0178\u2021\u00B7 +33 France</option>
                <option value="+49">\u00F0\u0178\u2021\u00A9\u00F0\u0178\u2021\u00AA +49 Germany</option>
                <option value="+39">\u00F0\u0178\u2021\u00AE\u00F0\u0178\u2021\u00B9 +39 Italy</option>
                <option value="+34">\u00F0\u0178\u2021\u00AA\u00F0\u0178\u2021\u00B8 +34 Spain</option>
                <option value="+31">\u00F0\u0178\u2021\u00B3\u00F0\u0178\u2021\u00B1 +31 Netherlands</option>
                <option value="+32">\u00F0\u0178\u2021\u00A7\u00F0\u0178\u2021\u00AA +32 Belgium</option>
                <option value="+353">\u00F0\u0178\u2021\u00AE\u00F0\u0178\u2021\u00AA +353 Ireland</option>
                <option value="+46">\u00F0\u0178\u2021\u00B8\u00F0\u0178\u2021\u00AA +46 Sweden</option>
                <option value="+47">\u00F0\u0178\u2021\u00B3\u00F0\u0178\u2021\u00B4 +47 Norway</option>
                <option value="+45">\u00F0\u0178\u2021\u00A9\u00F0\u0178\u2021\u00B0 +45 Denmark</option>
                <option value="+41">\u00F0\u0178\u2021\u00A8\u00F0\u0178\u2021\u00AD +41 Switzerland</option>
                <option value="+7">\u00F0\u0178\u2021\u00B7\u00F0\u0178\u2021\u00BA +7 Russia</option>
              </optgroup>
              <optgroup label="Americas">
                <option value="+55">\u00F0\u0178\u2021\u00A7\u00F0\u0178\u2021\u00B7 +55 Brazil</option>
                <option value="+52">\u00F0\u0178\u2021\u00B2\u00F0\u0178\u2021\u00BD +52 Mexico</option>
                <option value="+54">\u00F0\u0178\u2021\u00A6\u00F0\u0178\u2021\u00B7 +54 Argentina</option>
                <option value="+57">\u00F0\u0178\u2021\u00A8\u00F0\u0178\u2021\u00B4 +57 Colombia</option>
                <option value="+58">\u00F0\u0178\u2021\u00BB\u00F0\u0178\u2021\u00AA +58 Venezuela</option>
              </optgroup>
              <optgroup label="Asia &amp; Middle East">
                <option value="+91">\u00F0\u0178\u2021\u00AE\u00F0\u0178\u2021\u00B3 +91 India</option>
                <option value="+86">\u00F0\u0178\u2021\u00A8\u00F0\u0178\u2021\u00B3 +86 China</option>
                <option value="+81">\u00F0\u0178\u2021\u00AF\u00F0\u0178\u2021\u00B5 +81 Japan</option>
                <option value="+82">\u00F0\u0178\u2021\u00B0\u00F0\u0178\u2021\u00B7 +82 S.Korea</option>
                <option value="+966">\u00F0\u0178\u2021\u00B8\u00F0\u0178\u2021\u00A6 +966 Saudi Arabia</option>
                <option value="+971">\u00F0\u0178\u2021\u00A6\u00F0\u0178\u2021\u00AA +971 UAE</option>
                <option value="+974">\u00F0\u0178\u2021\u00B6\u00F0\u0178\u2021\u00A6 +974 Qatar</option>
                <option value="+965">\u00F0\u0178\u2021\u00B0\u00F0\u0178\u2021\u00BC +965 Kuwait</option>
                <option value="+92">\u00F0\u0178\u2021\u00B5\u00F0\u0178\u2021\u00B0 +92 Pakistan</option>
                <option value="+880">\u00F0\u0178\u2021\u00A7\u00F0\u0178\u2021\u00A9 +880 Bangladesh</option>
              </optgroup>
            </select>
            <input id="oc-phone" type="tel" placeholder="e.g. 08012345678" style="flex:1;min-width:0;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:11px 14px;color:#fff;font-family:'Outfit',sans-serif;font-size:.95rem;" />
          </div>
        </div>
        <div style="margin-bottom:8px;">
          <label style="display:block;font-size:.85rem;font-weight:600;color:var(--text-light);margin-bottom:6px;">Delivery Notes (optional)</label>
          <textarea id="oc-notes" rows="2" placeholder="e.g. deliver to Lekki Phase 1, gate 5..." style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:11px 14px;color:#fff;font-family:'Outfit',sans-serif;font-size:.95rem;resize:none;"></textarea>
        </div>

        <div id="oc-error" style="display:none;background:rgba(231,111,81,.15);border:1px solid rgba(231,111,81,.4);color:#f87171;border-radius:8px;padding:10px 14px;margin-bottom:10px;font-size:.88rem;"></div>
      </div>

      <!-- Payment Method Selector (always visible at bottom) -->
      <div style="padding:16px 24px;background:var(--bg2);border-top:1px solid var(--border);flex-shrink:0;">
        <div style="font-size:.78rem;font-weight:700;color:var(--green-light);letter-spacing:.08em;text-transform:uppercase;margin-bottom:12px;">Choose Payment Method</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <button id="oc-pay-online-btn" onclick="submitOrderOnline()" style="width:100%;background:linear-gradient(135deg,#1b4332,#2d6a4f);color:#fff;border:none;padding:14px;border-radius:50px;font-size:.95rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;transition:opacity .2s;">
            \u00F0\u0178\u2019\u00B3 Pay Online (Card / Bank Transfer)
          </button>
          <button id="oc-submit-btn" onclick="submitOrder()" style="width:100%;background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;border:none;padding:14px;border-radius:50px;font-size:.95rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;transition:opacity .2s;">
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="rgba(255,255,255,0.2)"/><path d="M23.5 8.5A10.45 10.45 0 0 0 16 5.5C10.2 5.5 5.5 10.2 5.5 16c0 1.85.48 3.65 1.4 5.24L5.5 26.5l5.4-1.38A10.43 10.43 0 0 0 16 26.5c5.8 0 10.5-4.7 10.5-10.5 0-2.8-1.09-5.43-3-7.5z" fill="white"/></svg>
            Send via WhatsApp
          </button>
        </div>
        <p style="text-align:center;font-size:.73rem;color:var(--text-muted);margin-top:8px;">Pay online with card or bank transfer, or send to WhatsApp for manual confirmation.</p>
      </div>
    </div>`;

  modal.style.display = 'flex';
  setTimeout(() => { const inp = document.getElementById('oc-name'); if(inp) inp.focus(); }, 100);
}

function closeOrderModal() {
  const modal = document.getElementById('order-checkout-modal');
  if (modal) modal.style.display = 'none';
}

// \u00E2\u00E2\u20AC\u009D\u2500 Online Payment via PayIsland \u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u20AC
async function submitOrderOnline() {
  const name  = (document.getElementById('oc-name').value  || '').trim() || 'Customer';
  const phoneCode = (document.getElementById('oc-phone-code') ? document.getElementById('oc-phone-code').value : '+234');
  const rawPhone  = (document.getElementById('oc-phone').value || '').trim().replace(/^0+/, '');
  const phone     = rawPhone ? phoneCode + rawPhone : '';
  const notes = (document.getElementById('oc-notes').value || '').trim();
  const errEl = document.getElementById('oc-error');

  if (!phone) {
    errEl.textContent = '\u26A0 Please enter your phone number so we can contact you about your order.';
    errEl.style.display = 'block';
    document.getElementById('oc-phone').focus();
    return;
  }
  errEl.style.display = 'none';

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const onlineBtn = document.getElementById('oc-pay-online-btn');
  const waBtn     = document.getElementById('oc-submit-btn');
  onlineBtn.disabled = true; onlineBtn.style.opacity = '.6'; onlineBtn.textContent = '\u23F3 Connecting\u00E2\u20AC\u00A6';
  if (waBtn) { waBtn.disabled = true; waBtn.style.opacity = '.6'; }

  try {
    const res = await fetch(API_BASE + '/payment/initialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name:  name,
        customer_phone: phone,
        customer_email: '',           // optional \u2014 user can leave blank
        items: cart.map(i => ({ id: i.id, name: i.name, emoji: i.emoji, price: i.price, qty: i.qty })),
        total,
        notes,
      }),
    });
    const data = await res.json();

    if (!res.ok || !data.checkoutUrl) {
      throw new Error(data.error || 'Payment gateway unavailable. Please use WhatsApp checkout.');
    }

    // Clear cart and redirect to PayIsland checkout
    cart = [];
    updateCartBadge();
    renderCartItems();
    closeOrderModal();
    // Redirect customer to PayIsland hosted checkout page
    window.location.href = data.checkoutUrl;

  } catch (err) {
    onlineBtn.disabled = false; onlineBtn.style.opacity = '1'; onlineBtn.textContent = '\u00F0\u0178\u2019\u00B3 Pay Online (Card / Bank Transfer)';
    if (waBtn) { waBtn.disabled = false; waBtn.style.opacity = '1'; }
    errEl.textContent = '\u274C ' + err.message;
    errEl.style.display = 'block';
  }
}

// \u00E2\u00E2\u20AC\u009D\u2500 Handle PayIsland payment callback (check URL params on load) \u00E2\u00E2\u20AC\u009D\u20AC
function checkPaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  const payStatus = params.get('payment');
  if (!payStatus) return;
  // Clean up the URL
  window.history.replaceState({}, document.title, window.location.pathname);
  if (payStatus === 'success') {
    const name    = params.get('name') || 'Customer';
    const orderId = params.get('order') || '';
    const banner  = document.createElement('div');
    banner.style.cssText = 'position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.8);backdrop-filter:blur(6px);padding:20px;';
    banner.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:24px;max-width:420px;width:100%;padding:40px 28px;text-align:center;">
      <div style="font-size:3.5rem;margin-bottom:12px;">\u2705</div>
      <h3 style="color:#fff;font-size:1.2rem;margin-bottom:8px;">Payment Confirmed!</h3>
      <p style="color:var(--text-muted);font-size:.9rem;line-height:1.6;margin-bottom:24px;">
        Thank you, ${name}! Your payment was successful and order ${orderId ? '#' + orderId : ''} is now confirmed.<br>We'll be in touch shortly via WhatsApp. \u{1F33F}
      </p>
      <button onclick="this.closest('div[style*=fixed]').remove()" style="background:var(--green);color:#fff;border:none;padding:12px 32px;border-radius:50px;font-size:.95rem;font-weight:700;cursor:pointer;">Done</button>
    </div>`;
    document.body.appendChild(banner);
  } else if (payStatus === 'failed') {
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:#e76f51;color:#fff;padding:14px 24px;border-radius:50px;font-weight:600;font-size:.9rem;z-index:3000;';
    toast.textContent = '\u274C Payment was not completed. Please try again or use WhatsApp checkout.';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }
}

async function submitOrder() {
  const name  = (document.getElementById('oc-name').value  || '').trim() || 'Customer';
  const phoneCode = (document.getElementById('oc-phone-code') ? document.getElementById('oc-phone-code').value : '+234');
  const rawPhone  = (document.getElementById('oc-phone').value || '').trim().replace(/^0+/, '');
  const phone     = rawPhone ? phoneCode + rawPhone : '';
  const notes = (document.getElementById('oc-notes').value || '').trim();
  const errEl = document.getElementById('oc-error');
  const btn   = document.getElementById('oc-submit-btn');

  if (!phone) {
    errEl.textContent = '\u26A0 Please enter your WhatsApp/phone number so we can confirm your order.';
    errEl.style.display = 'block';
    document.getElementById('oc-phone').focus();
    return;
  }
  errEl.style.display = 'none';

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  btn.disabled = true;
  btn.style.opacity = '.6';
  btn.innerHTML = '\u23F3 Sending...';

  // 2 \u00E2\u00E2\u20AC\u009D\u2500 Build WhatsApp message to farm (plain text \u2014 no emoji to avoid diamond symbols)
  let msg = `Hello Pinnacles Resource Centre Farm!\n\n*NEW ORDER*\n\n`;
  cart.forEach(item => {
    msg += `- *${item.name}* x${item.qty} -- N${(item.price * item.qty).toLocaleString()}\n`;
  });
  msg += `\n*Total: N${total.toLocaleString()}*`;
  msg += `\n\n*Customer:* ${name}`;
  msg += `\n*Phone:* ${phone}`;
  if (notes) msg += `\n*Notes:* ${notes}`;
  msg += `\n\nPlease confirm availability and delivery. Thank you!`;

  // 1 \u00E2\u00E2\u20AC\u009D\u2500 Save to backend (and trigger admin email)
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
    } catch { /* backend offline \u2014 still open WhatsApp */ }
  }

  // 3 \u00E2\u00E2\u20AC\u009D\u2500 Show success with two send buttons
  showOrderSuccess(name, msg);

  // 4 \u00E2\u00E2\u20AC\u009D\u2500 Clear cart
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
      <div style="font-size:3.5rem;margin-bottom:12px;">\u2705</div>
      <h3 style="color:#fff;font-size:1.2rem;margin-bottom:8px;">Order Recorded!</h3>
      <p style="color:var(--text-muted);font-size:.88rem;margin-bottom:24px;line-height:1.6;">Hi ${name}! Tap the buttons below to send your order to us on WhatsApp.</p>
      <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px;">
        <a href="${wa1}" target="_blank" style="display:flex;align-items:center;justify-content:center;gap:10px;background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;border:none;padding:14px 20px;border-radius:50px;font-size:.95rem;font-weight:700;cursor:pointer;text-decoration:none;">
          \u{1F4F2} Send to +234 903 750 5632
        </a>
        <a href="${wa2}" target="_blank" style="display:flex;align-items:center;justify-content:center;gap:10px;background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;border:none;padding:14px 20px;border-radius:50px;font-size:.95rem;font-weight:700;cursor:pointer;text-decoration:none;opacity:.85;">
          \u{1F4F2} Send to +234 707 821 0834
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
  const msg = `\u{1F33F} *Pinnacles Resource Centre Farm*\n\nGet fresh farm produce delivered to you!\n\n\u{1F345} Tomatoes  \u{1FAD1} Peppers  \u{1F353} Strawberries\n\u{1F33D} Maize  \u{1F955} Carrots  \u{1F95A} Eggs  \u{1FADB} Green Peas\n\n\u{1F4F2} Order directly on WhatsApp!\n#PinnaclesFarm #FreshProduce #FarmToTable`;
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
  const advertText = `\u{1F33F} *PINNACLES RESOURCE CENTRE FARM* \u{1F33F}\n\n\u2705 Fresh Farm Produce Available NOW!\n\n\u{1F345} Tomatoes\n\u{1FAD1} Peppers\n\u{1F353} Strawberries\n\u{1F33D} Maize\n\u{1F955} Carrots\n\u{1F95A} Farm Fresh Eggs\n\u{1FADB} Green Peas\n\u{1F96C} And Much More!\n\n\u{1F4AF} 100% Organically Grown\n\u{1F69A} Fast Delivery Available\n\u{1F4B0} Fair & Affordable Prices\n\n\u{1F4F2} Order via WhatsApp Now!\nDon't miss out \u2014 get your fresh produce today!\n\n#PinnaclesFarm #FreshProduce #OrganicFood #FarmToTable #NigeriaFarms`;

  document.getElementById('advert-modal-content').innerHTML = `
    <h3>\u00F0\u0178\u201C\u00A2 Your WhatsApp Advert</h3>
    <p>Copy and share this advert on WhatsApp, Facebook, or any platform!</p>
    <div class="advert-text-box">${advertText}</div>
    <div class="advert-modal-actions">
      <button class="share-btn wa" onclick="sendAdvertOnWhatsApp()">\u{1F4F2} Share on WhatsApp</button>
      <button class="share-btn copy" onclick="copyAdvert()">\u00F0\u0178\u201C\u2039 Copy Text</button>
    </div>
    <div id="advert-copy-msg" class="copy-msg" style="display:none;margin-top:10px">\u2705 Advert copied!</div>
  `;
  document.getElementById('advert-modal-overlay').classList.add('open');
  document.getElementById('advert-modal').classList.add('open');
}

function sendAdvertOnWhatsApp() {
  const msg = `\u{1F33F} *PINNACLES RESOURCE CENTRE FARM* \u{1F33F}\n\n\u2705 Fresh Farm Produce Available NOW!\n\n\u{1F345} Tomatoes | \u{1FAD1} Peppers | \u{1F353} Strawberries\n\u{1F33D} Maize | \u{1F955} Carrots | \u{1F95A} Farm Fresh Eggs\n\u{1FADB} Green Peas | \u{1F96C} And Much More!\n\n\u{1F4AF} 100% Organically Grown\n\u{1F69A} Fast Delivery Available\n\u{1F4B0} Fair & Affordable Prices\n\n\u{1F4F2} Order via WhatsApp Now!\n\n#PinnaclesFarm #FreshProduce #FarmToTable`;
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
    } catch { /* backend offline \u2014 use fallback */ }
  }
  document.getElementById('gallery-grid').innerHTML = items.map(item => `
    <div class="gallery-item${item.wide ? ' wide' : ''}">
      <img src="${item.img}" alt="${item.alt || 'Farm photo'}"
           onerror="this.outerHTML='<div class=gallery-emoji>\u{1F33F}</div>'" />
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

// \u00E2\u00E2\u20AC\u009D\u2500 Today's Harvest Banner \u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u20AC
async function loadTodaysHarvest() {
  try {
    const res = await fetch('/api/harvest/today');
    if (!res.ok) return;
    const data = await res.json();
    if (!data || !data.items || data.items.length === 0) return;
    const section   = document.getElementById('harvest-today');
    const container = document.getElementById('harvest-items');
    if (!section || !container) return;
    container.innerHTML = data.items.map(item =>
      `<div class="harvest-item${item.limited ? ' limited' : ''}">${item.emoji || '\u{1F33F}'} ${item.name}${item.limited ? ' \u2014 Limited' : ' \u2014 Available'}</div>`
    ).join('');
    section.style.display = 'block';
  } catch (_) { /* silent \u2014 endpoint may not be ready */ }
}
document.addEventListener('DOMContentLoaded', () => { loadTodaysHarvest(); });


// \u00E2\u00E2\u20AC\u009D\u2500 PRE-ORDER SYSTEM \u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500\u00E2\u00E2\u20AC\u009D\u2500
function openPreorderModal(productId, productName, expectedDate, note) {
  const modal = document.getElementById('preorder-modal');
  const body  = document.getElementById('preorder-modal-body');
  if (!modal || !body) return;

  // Find the product to get unit and price
  const p = products.find(x => x.id === productId) || {};

  body.innerHTML = `
    <div style="margin-bottom:16px">
      <div style="font-size:1.2rem;font-weight:700;color:#fff;margin-bottom:4px">${p.emoji || '\u{1F33F}'} ${productName}</div>
      <div style="font-size:.85rem;color:#52b788">\u20A6${Number(p.price||0).toLocaleString()} ${p.unit||''}</div>
      ${expectedDate ? `<div style="margin-top:10px;background:rgba(251,191,36,.12);border:1px solid rgba(251,191,36,.3);border-radius:10px;padding:10px 14px;font-size:.82rem;color:#fbbf24">\u00F0\u0178\u201C\u2026 Expected availability: <strong>${new Date(expectedDate).toLocaleDateString('en-NG',{day:'numeric',month:'long',year:'numeric'})}</strong></div>` : ''}
      ${note ? `<div style="margin-top:8px;font-size:.8rem;color:rgba(255,255,255,.5)">${note}</div>` : ''}
    </div>

    <div style="display:flex;flex-direction:column;gap:12px">
      <input id="po-name" type="text" placeholder="Your name *" style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:10px 14px;color:#fff;font-family:inherit;font-size:.9rem;outline:none" />
      <input id="po-phone" type="tel" placeholder="Your phone number *" style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:10px 14px;color:#fff;font-family:inherit;font-size:.9rem;outline:none" />
      <div style="display:flex;align-items:center;gap:10px">
        <label style="font-size:.82rem;color:rgba(255,255,255,.6);min-width:70px">Quantity</label>
        <input id="po-qty" type="number" value="1" min="1" style="width:70px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:8px 12px;color:#fff;font-family:inherit;font-size:.9rem;text-align:center;outline:none" />
        <span style="font-size:.82rem;color:rgba(255,255,255,.5)">${p.unit||''}</span>
      </div>
      <textarea id="po-notes" placeholder="Any special requests? (optional)" rows="2" style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:10px 14px;color:#fff;font-family:inherit;font-size:.9rem;outline:none;resize:vertical"></textarea>
    </div>

    <div id="po-error" style="display:none;color:#f87171;font-size:.82rem;margin-top:10px"></div>

    <div style="display:flex;gap:10px;margin-top:20px">
      <button onclick="submitPreorder(${productId},'${productName}','${(p.unit||'').replace(/'/g,"\\'")}')" style="flex:1;background:linear-gradient(135deg,#92400e,#b45309);color:#fff;border:none;border-radius:12px;padding:12px;font-size:.9rem;font-weight:700;cursor:pointer;font-family:inherit">\u23F3 Reserve This Now</button>
      <a href="https://wa.me/2349037505632?text=${encodeURIComponent('Hello Pinnacles Farm! I want to pre-order: '+productName+(expectedDate?' (expected '+expectedDate+')':'')+'.')}" target="_blank" style="display:flex;align-items:center;gap:6px;background:#25D366;color:#fff;border-radius:12px;padding:12px 16px;font-size:.9rem;font-weight:700;text-decoration:none;white-space:nowrap">\u00F0\u0178\u2019\u00AC WhatsApp</a>
    </div>
  `;

  modal.style.display = 'block';
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('po-name')?.focus(), 100);
}

function closePreorderModal() {
  const modal = document.getElementById('preorder-modal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
}

async function submitPreorder(productId, productName, unit) {
  const name  = (document.getElementById('po-name')?.value  || '').trim();
  const phone = (document.getElementById('po-phone')?.value || '').trim();
  const qty   = parseInt(document.getElementById('po-qty')?.value) || 1;
  const notes = (document.getElementById('po-notes')?.value || '').trim();
  const errEl = document.getElementById('po-error');
  if (!name)  { errEl.textContent = 'Please enter your name.';         errEl.style.display='block'; return; }
  if (!phone) { errEl.textContent = 'Please enter your phone number.'; errEl.style.display='block'; return; }
  errEl.style.display = 'none';
  try {
    const res = await fetch('/api/customers/preorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // API expects customer_name and customer_phone
      body: JSON.stringify({
        product_id: productId,
        product_name: productName,
        quantity: qty,
        unit: unit || '',
        notes: notes || '',
        customer_name: name,
        customer_phone: phone,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to submit pre-order');
    const waConfirm = encodeURIComponent('Hello Pinnacles Farm! I just pre-ordered ' + productName + ' on your website. My name is ' + name + ' and phone is ' + phone + '.');
    document.getElementById('preorder-modal-body').innerHTML =
      '<div style="text-align:center;padding:20px 0">' +
      '<div style="font-size:3rem;margin-bottom:16px">\u2705</div>' +
      '<h4 style="font-size:1.1rem;color:#a3d9b8;margin-bottom:10px">Pre-order Reserved!</h4>' +
      '<p style="font-size:.85rem;color:rgba(255,255,255,.6);line-height:1.7">Thank you <strong style="color:#fff">' + name + '</strong>! We\'ll contact you on <strong style="color:#fff">' + phone + '</strong> when <strong style="color:#52b788">' + productName + '</strong> is ready.</p>' +
      '<a href="https://wa.me/2349037505632?text=' + waConfirm + '" target="_blank" style="display:inline-block;margin-top:20px;background:#25D366;color:#fff;border-radius:50px;padding:10px 24px;font-weight:700;font-size:.85rem;text-decoration:none">&#128172; Confirm on WhatsApp</a>' +
      '<br><button onclick="closePreorderModal()" style="margin-top:12px;background:none;border:none;color:rgba(255,255,255,.4);font-size:.82rem;cursor:pointer;font-family:inherit">Close</button>' +
      '</div>';
  } catch(e) {
    if (errEl) { errEl.textContent = e.message; errEl.style.display = 'block'; }
  }
}

// \u2500\u2500 BULK / WHOLESALE ORDER SYSTEM \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
let bulkItemCount = 0;

function openBulkModal() {
  document.getElementById('bulk-modal').style.display = 'block';
  document.body.style.overflow = 'hidden';
  // Reset form
  ['bk-name','bk-biz','bk-phone','bk-location','bk-notes'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  const dateEl = document.getElementById('bk-date'); if(dateEl) dateEl.value='';
  document.getElementById('bk-error').style.display = 'none';
  document.getElementById('bk-items-list').innerHTML = '';
  bulkItemCount = 0;
  addBulkItem(); // start with one item row
  setTimeout(() => document.getElementById('bk-name')?.focus(), 100);
}

function closeBulkModal() {
  document.getElementById('bulk-modal').style.display = 'none';
  document.body.style.overflow = '';
}

function addBulkItem() {
  bulkItemCount++;
  const list = document.getElementById('bk-items-list');
  const row = document.createElement('div');
  row.id = 'bk-row-' + bulkItemCount;
  row.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:8px;align-items:center';
  row.innerHTML =
    '<input type="text" placeholder="Product (e.g. Tomatoes)" style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:9px 12px;color:#fff;font-family:inherit;font-size:.85rem;outline:none" />' +
    '<input type="number" placeholder="Qty" min="1" style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:9px 12px;color:#fff;font-family:inherit;font-size:.85rem;outline:none;text-align:center" />' +
    '<input type="text" placeholder="Unit (kg/bag)" style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:9px 12px;color:#fff;font-family:inherit;font-size:.85rem;outline:none" />' +
    '<button onclick="document.getElementById(\'bk-row-' + bulkItemCount + '\').remove()" style="background:rgba(248,113,113,.15);color:#f87171;border:none;border-radius:8px;padding:9px 12px;font-size:.9rem;cursor:pointer">\u2715</button>';
  list.appendChild(row);
}

function getBulkItems() {
  const rows = document.getElementById('bk-items-list').querySelectorAll('div[id^="bk-row-"]');
  return Array.from(rows).map(row => {
    const inputs = row.querySelectorAll('input');
    return { product: inputs[0]?.value?.trim(), qty: inputs[1]?.value?.trim(), unit: inputs[2]?.value?.trim() };
  }).filter(r => r.product);
}

async function submitBulkOrder() {
  const name     = (document.getElementById('bk-name')?.value     || '').trim();
  const phone    = (document.getElementById('bk-phone')?.value    || '').trim();
  const biz      = (document.getElementById('bk-biz')?.value      || '').trim();
  const location = (document.getElementById('bk-location')?.value || '').trim();
  const notes    = (document.getElementById('bk-notes')?.value    || '').trim();
  const date     = (document.getElementById('bk-date')?.value     || '');
  const delivery = document.querySelector('input[name="bk-delivery"]:checked')?.value || 'no';
  const items    = getBulkItems();
  const errEl    = document.getElementById('bk-error');

  if (!name)           { errEl.textContent='Please enter your name.';         errEl.style.display='block'; return; }
  if (!phone)          { errEl.textContent='Please enter your phone number.'; errEl.style.display='block'; return; }
  if (items.length===0){ errEl.textContent='Please add at least one product.'; errEl.style.display='block'; return; }
  errEl.style.display = 'none';

  const itemsText = items.map(i => i.product + (i.qty?' x '+i.qty:'') + (i.unit?' '+i.unit:'')).join(', ');
  const fullNotes = [
    biz      ? 'Business: ' + biz : '',
    location ? 'Location: ' + location : '',
    'Delivery: ' + (delivery==='yes'?'Yes':'Farm pickup'),
    date     ? 'Preferred date: ' + date : '',
    notes    ? 'Notes: ' + notes : '',
  ].filter(Boolean).join(' | ');

  try {
    const res = await fetch('/api/customers/preorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: name,
        customer_phone: phone,
        product_name: 'BULK ORDER: ' + itemsText,
        quantity: items.length,
        unit: 'items',
        notes: fullNotes,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');

    const waText = encodeURIComponent('Hello Pinnacles Farm! I just submitted a bulk order request on your website.\nName: ' + name + '\nPhone: ' + phone + '\nItems: ' + itemsText + '\n' + fullNotes);
    document.getElementById('bulk-modal-body').innerHTML =
      '<div style="text-align:center;padding:28px 0">' +
      '<div style="font-size:3.5rem;margin-bottom:16px">\u2705</div>' +
      '<h4 style="font-size:1.15rem;color:#a3d9b8;margin-bottom:12px">Bulk Request Submitted!</h4>' +
      '<p style="font-size:.85rem;color:rgba(255,255,255,.6);line-height:1.7;margin-bottom:20px">Thank you <strong style="color:#fff">' + name + '</strong>! We\'ve received your bulk order request and will contact you on <strong style="color:#fff">' + phone + '</strong> within 24 hours with pricing and availability.</p>' +
      '<a href="https://wa.me/2349037505632?text=' + waText + '" target="_blank" style="display:inline-block;background:#25D366;color:#fff;border-radius:50px;padding:11px 28px;font-weight:700;font-size:.88rem;text-decoration:none">&#128172; Follow Up on WhatsApp</a>' +
      '<br><button onclick="closeBulkModal()" style="margin-top:14px;background:none;border:none;color:rgba(255,255,255,.4);font-size:.82rem;cursor:pointer;font-family:inherit">Close</button>' +
      '</div>';
  } catch(e) {
    errEl.textContent = e.message; errEl.style.display = 'block';
  }
}

function sendBulkWhatsApp() {
  const name     = (document.getElementById('bk-name')?.value  || '').trim();
  const phone    = (document.getElementById('bk-phone')?.value || '').trim();
  const biz      = (document.getElementById('bk-biz')?.value   || '').trim();
  const items    = getBulkItems();
  const notes    = (document.getElementById('bk-notes')?.value || '').trim();
  const delivery = document.querySelector('input[name="bk-delivery"]:checked')?.value;
  const itemsText = items.length > 0
    ? items.map(i => i.product + (i.qty?' x '+i.qty:'') + (i.unit?' '+i.unit:'')).join('\n')
    : '(no items specified)';
  const msg = 'Hello Pinnacles Farm! I am interested in a bulk/wholesale order.\n\n' +
    'Name: ' + (name||'(not given)') + '\n' +
    (biz ? 'Business: ' + biz + '\n' : '') +
    'Phone: ' + (phone||'(not given)') + '\n\n' +
    'Items needed:\n' + itemsText + '\n\n' +
    'Delivery: ' + (delivery==='yes'?'Yes, please deliver':'Farm pickup') +
    (notes ? '\n\nNotes: ' + notes : '');
  window.open('https://wa.me/2349037505632?text=' + encodeURIComponent(msg), '_blank');
}
