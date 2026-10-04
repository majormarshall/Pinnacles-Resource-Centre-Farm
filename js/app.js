// ===== CONFIG =====
const WA_NUMBER  = '2349037505632'; // +234 903 750 5632 Ã¢â‚¬â€ primary
const WA_NUMBER2 = '2347078210834'; // +234 707 821 0834 Ã¢â‚¬â€ secondary
const API_BASE = '/api'; // Backend API base URL
const USE_BACKEND = true; // Set false to run without backend

// ===== FALLBACK PRODUCTS (used if backend is offline) =====
const fallbackProducts = [
  { id:1, name:'Fresh Tomatoes', emoji:'Ã°Å¸Ââ€¦', img:'images/tomatoes.png', price:1500, unit:'per basket', description:'Sun-ripened, juicy tomatoes grown naturally on our farm.', category:'vegetables', tag:'Bestseller', in_stock:1 },
  { id:2, name:'Peppers', emoji:'Ã°Å¸Â«â€˜', img:'images/pepper.png', price:1200, unit:'per pack', description:'Fresh bell peppers and chili peppers. Vibrant and full of flavour.', category:'vegetables', tag:'Fresh', in_stock:1 },
  { id:3, name:'Strawberries', emoji:'Ã°Å¸Ââ€œ', img:'images/strawberry.png', price:3500, unit:'per punnet', description:'Sweet, juicy strawberries picked at peak ripeness.', category:'fruits', tag:'Premium', in_stock:1 },
  { id:4, name:'Sweet Maize', emoji:'Ã°Å¸Å’Â½', img:'images/maize.png', price:800, unit:'per 3 cobs', description:'Golden sweet maize cobs freshly harvested.', category:'grains', tag:'Fresh', in_stock:1 },
  { id:5, name:'Carrots', emoji:'Ã°Å¸Â¥â€¢', img:'images/carrots.png', price:1000, unit:'per bunch', description:'Crunchy sweet orange carrots. Great for juices and soups.', category:'vegetables', tag:'Organic', in_stock:1 },
  { id:6, name:'Farm Fresh Eggs', emoji:'Ã°Å¸Â¥Å¡', img:null, price:2500, unit:'per crate (30)', description:'Free-range farm eggs Ã¢â‚¬â€ rich, healthy and full of protein.', category:'proteins', tag:'Popular', in_stock:1 },
  { id:7, name:'Green Peas', emoji:'Ã°Å¸Â«â€º', img:null, price:1800, unit:'per kg', description:'Tender sweet green peas. Perfect for soups and rice dishes.', category:'vegetables', tag:'Fresh', in_stock:1 },
  { id:8, name:'Fresh Greens', emoji:'Ã°Å¸Â¥Â¬', img:null, price:600, unit:'per bunch', description:'Assorted fresh leafy greens including spinach and ugwu.', category:'vegetables', tag:'Daily Harvest', in_stock:1 },
  { id:9, name:'Garden Cucumber', emoji:'Ã°Å¸Â¥â€™', img:null, price:700, unit:'per pack', description:'Cool crisp cucumbers perfect for salads and juicing.', category:'vegetables', tag:'Fresh', in_stock:1 },
  { id:10, name:'Spring Onions', emoji:'Ã°Å¸Â§â€¦', img:null, price:500, unit:'per bunch', description:'Fresh spring onions with a mild sweet flavour.', category:'vegetables', tag:'Fresh', in_stock:1 },
  { id:11, name:'Sweet Pepper', emoji:'Ã°Å¸Å’Â¶Ã¯Â¸Â', img:null, price:900, unit:'per pack', description:'Colourful sweet peppers Ã¢â‚¬â€ red, yellow and green.', category:'vegetables', tag:'Seasonal', in_stock:1 },
  { id:12, name:'Farm Honey', emoji:'Ã°Å¸ÂÂ¯', img:null, price:4500, unit:'per jar', description:'Pure raw natural honey from our farm bees.', category:'fruits', tag:'Natural', in_stock:1 },
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
  } catch { /* backend offline Ã¢â‚¬â€ use fallback */ }
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
  try {
  const grid = document.getElementById('products-grid');
  const filtered = filter === 'all' ? products : products.filter(p => p.category === filter);
  if (!grid) return;
  try { grid.innerHTML = filtered.map(p => {
    const inStock = p.in_stock === true || p.in_stock === 1 || Number(p.in_stock) > 0;
    const waMsg = encodeURIComponent(`Hello Pinnacles Farm! I'd like to order:\n\n${p.emoji} *${p.name}* Ã¢â‚¬â€ Ã¢â€šÂ¦${Number(p.price||0).toLocaleString()} ${p.unit}\n\nPlease confirm availability and delivery cost.`);
    return `
    <div class="product-card${inStock ? '' : ' out-of-stock'}" data-id="${p.id}">
      <div class="product-img-wrap" onclick="openModal(${p.id})" style="cursor:pointer">
        ${p.img ? `<img src="${p.img}" alt="${p.name}" onerror="this.parentElement.innerHTML='<div class=product-emoji-placeholder>${p.emoji}</div>'" />` : `<div class="product-emoji-placeholder">${p.emoji}</div>`}
        <span class="product-tag">${p.tag}</span>
        ${inStock ? '<span class="avail-badge avail-in">Ã°Å¸Å¸Â¢ In Stock</span>' : (p.preorder_available ? '<span class="avail-badge preorder-badge" onclick="event.stopPropagation();openPreorderModal('+p.id+',\''+p.name+'\',\''+( p.preorder_expected_date||'')+'\',\''+( p.preorder_note||'')+'\')">Ã¢ÂÂ³ Pre-order</span>' : '<span class="avail-badge avail-out">Ã°Å¸â€Â´ Out of Stock</span>')}
      </div>
      <div class="product-info">
        <div class="product-name">${p.emoji} ${p.name}</div>
        <div class="product-price-row">
          <div class="product-price">Ã¢â€šÂ¦${Number(p.price||0).toLocaleString()} <span>${p.unit}</span></div>
        </div>
        <div class="product-qty-row">
          <button class="qty-btn" onclick="changeCardQty(${p.id},-1)" ${!inStock?'disabled':''}>Ã¢Ë†â€™</button>
          <span class="qty-val" id="card-qty-${p.id}">1</span>
          <button class="qty-btn" onclick="changeCardQty(${p.id},1)" ${!inStock?'disabled':''}>+</button>
        </div>
        <div class="product-card-actions">
          ${inStock ? `<button class="btn-cart" onclick="addToCartWithQty(${p.id})">Ã°Å¸â€ºâ€™ Add to Cart</button>` : (p.preorder_available ? `<button class="btn-cart" style="background:linear-gradient(135deg,#92400e,#b45309)" onclick="openPreorderModal(${p.id},'${p.name}','${p.preorder_expected_date||''}','${p.preorder_note||''}')">Ã¢ÂÂ³ Pre-order</button>` : `<button class="btn-cart" disabled>Ã°Å¸â€Â´ Out of Stock</button>`)}
          <a class="btn-wa-card" href="https://wa.me/2349037505632?text=${waMsg}" target="_blank" ${!inStock?'style="opacity:.5;pointer-events:none"':''}>Ã°Å¸â€™Â¬ WhatsApp</a>
        </div>
      </div>
    </div>`;
  }).join(''); } catch(renderErr) { console.error('renderProducts error:', renderErr); grid.innerHTML = '<p style="color:red;padding:20px">Error loading products. Please refresh.</p>'; }
  } catch(e) { console.error('renderProducts outer:', e); }
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
    <div class="modal-price">Ã¢â€šÂ¦${Number(p.price||0).toLocaleString()} <small style="font-weight:400;color:var(--text-muted);font-size:.8rem">${p.unit}</small></div>
    <div class="modal-desc">${p.desc}</div>
    <div class="modal-actions">
      ${p.in_stock !== 0
        ? '<button class="btn-primary" onclick="addToCart(' + p.id + '); closeModal()">Ã°Å¸â€ºâ€™ Add to Cart</button><button class="btn-outline" onclick="directOrder(' + p.id + ')">Ã°Å¸â€œÂ² Order Now</button>'
        : '<button class="btn-primary" disabled style="opacity:.45;cursor:not-allowed;">Ã¢ÂÅ’ Out of Stock</button>'}
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
  if (p.in_stock === 0) { showCartToast('Ã¢ÂÅ’ ' + p.name + ' is out of stock'); return; }
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
    container.innerHTML = `<div class="cart-empty" id="cart-empty"><div class="empty-icon">Ã°Å¸â€ºâ€™</div><p>Your cart is empty</p><span>Add some fresh produce!</span></div>`;
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
        <div class="cart-item-price">Ã¢â€šÂ¦${(item.price * item.qty).toLocaleString()}</div>
      </div>
      <div class="cart-item-controls">
        <button class="qty-btn" onclick="changeQty(${item.id},-1)">Ã¢Ë†â€™</button>
        <span class="qty-num">${item.qty}</span>
        <button class="qty-btn" onclick="changeQty(${item.id},1)">+</button>
        <button class="remove-item" onclick="removeFromCart(${item.id})">Ã°Å¸â€”â€˜Ã¯Â¸Â</button>
      </div>
    </div>
  `).join('');
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  document.getElementById('cart-total-price').textContent = `Ã¢â€šÂ¦${total.toLocaleString()}`;
  footer.style.display = 'block';
}

function toggleCart() {
  document.getElementById('cart-sidebar').classList.toggle('open');
  document.getElementById('cart-overlay').classList.toggle('open');
}

function showCartToast(name) {
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;bottom:100px;right:32px;background:var(--green);color:#fff;padding:12px 20px;border-radius:50px;font-weight:600;font-size:.9rem;z-index:3000;animation:slideIn .3s ease';
  toast.textContent = `Ã¢Å“â€¦ ${name} added!`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

// ===== WHATSAPP =====
function openWhatsApp(message) {
  const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
  return false;
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Order Checkout Modal Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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
        <span style="font-size:.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${i.name} Ãƒâ€”${i.qty}</span>
      </div>
      <strong style="color:var(--green-light);flex-shrink:0;">Ã¢â€šÂ¦${(i.price*i.qty).toLocaleString()}</strong>
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
          <h3 style="color:#fff;margin:0;font-size:1.1rem;">Ã°Å¸â€œÂ¦ Confirm Your Order</h3>
          <p style="color:rgba(255,255,255,.7);margin:4px 0 0;font-size:.82rem;">Review items &amp; enter your details</p>
        </div>
        <button onclick="closeOrderModal()" style="background:rgba(255,255,255,.15);border:none;color:#fff;width:36px;height:36px;border-radius:50%;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;">Ã¢Å“â€¢</button>
      </div>

      <!-- Scrollable Body -->
      <div style="padding:20px 24px;overflow-y:auto;flex:1;-webkit-overflow-scrolling:touch;">
        <!-- Order Summary -->
        <div style="margin-bottom:18px;">
          <div style="font-size:.78rem;font-weight:700;color:var(--green-light);letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px;">Order Summary</div>
          ${itemsSummary}
          <div style="display:flex;justify-content:space-between;padding:12px 0;margin-top:4px;">
            <strong style="color:#fff;">Total</strong>
            <strong style="color:var(--green-light);font-size:1.15rem;">Ã¢â€šÂ¦${total.toLocaleString()}</strong>
          </div>
          <p style="font-size:.75rem;color:var(--text-muted);margin:4px 0 0;line-height:1.6;">
            Ã°Å¸â€œÅ’ Farm gate prices Ã¢â‚¬â€ delivery cost not included. Final delivery charge will be confirmed via WhatsApp.
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
                <option value="+234">Ã°Å¸â€¡Â³Ã°Å¸â€¡Â¬ +234 Nigeria</option>
                <option value="+233">Ã°Å¸â€¡Â¬Ã°Å¸â€¡Â­ +233 Ghana</option>
                <option value="+27">Ã°Å¸â€¡Â¿Ã°Å¸â€¡Â¦ +27 S.Africa</option>
                <option value="+254">Ã°Å¸â€¡Â°Ã°Å¸â€¡Âª +254 Kenya</option>
                <option value="+44">Ã°Å¸â€¡Â¬Ã°Å¸â€¡Â§ +44 UK</option>
                <option value="+1">Ã°Å¸â€¡ÂºÃ°Å¸â€¡Â¸ +1 USA/Canada</option>
              </optgroup>
              <optgroup label="Africa">
                <option value="+20">Ã°Å¸â€¡ÂªÃ°Å¸â€¡Â¬ +20 Egypt</option>
                <option value="+212">Ã°Å¸â€¡Â²Ã°Å¸â€¡Â¦ +212 Morocco</option>
                <option value="+213">Ã°Å¸â€¡Â©Ã°Å¸â€¡Â¿ +213 Algeria</option>
                <option value="+216">Ã°Å¸â€¡Â¹Ã°Å¸â€¡Â³ +216 Tunisia</option>
                <option value="+221">Ã°Å¸â€¡Â¸Ã°Å¸â€¡Â³ +221 Senegal</option>
                <option value="+225">Ã°Å¸â€¡Â¨Ã°Å¸â€¡Â® +225 Ivory Coast</option>
                <option value="+226">Ã°Å¸â€¡Â§Ã°Å¸â€¡Â« +226 Burkina Faso</option>
                <option value="+227">Ã°Å¸â€¡Â³Ã°Å¸â€¡Âª +227 Niger</option>
                <option value="+228">Ã°Å¸â€¡Â¹Ã°Å¸â€¡Â¬ +228 Togo</option>
                <option value="+229">Ã°Å¸â€¡Â§Ã°Å¸â€¡Â¯ +229 Benin</option>
                <option value="+237">Ã°Å¸â€¡Â¨Ã°Å¸â€¡Â² +237 Cameroon</option>
                <option value="+243">Ã°Å¸â€¡Â¨Ã°Å¸â€¡Â© +243 DR Congo</option>
                <option value="+244">Ã°Å¸â€¡Â¦Ã°Å¸â€¡Â´ +244 Angola</option>
                <option value="+249">Ã°Å¸â€¡Â¸Ã°Å¸â€¡Â© +249 Sudan</option>
                <option value="+250">Ã°Å¸â€¡Â·Ã°Å¸â€¡Â¼ +250 Rwanda</option>
                <option value="+251">Ã°Å¸â€¡ÂªÃ°Å¸â€¡Â¹ +251 Ethiopia</option>
                <option value="+255">Ã°Å¸â€¡Â¹Ã°Å¸â€¡Â¿ +255 Tanzania</option>
                <option value="+256">Ã°Å¸â€¡ÂºÃ°Å¸â€¡Â¬ +256 Uganda</option>
                <option value="+260">Ã°Å¸â€¡Â¿Ã°Å¸â€¡Â² +260 Zambia</option>
                <option value="+263">Ã°Å¸â€¡Â¿Ã°Å¸â€¡Â¼ +263 Zimbabwe</option>
              </optgroup>
              <optgroup label="Europe">
                <option value="+33">Ã°Å¸â€¡Â«Ã°Å¸â€¡Â· +33 France</option>
                <option value="+49">Ã°Å¸â€¡Â©Ã°Å¸â€¡Âª +49 Germany</option>
                <option value="+39">Ã°Å¸â€¡Â®Ã°Å¸â€¡Â¹ +39 Italy</option>
                <option value="+34">Ã°Å¸â€¡ÂªÃ°Å¸â€¡Â¸ +34 Spain</option>
                <option value="+31">Ã°Å¸â€¡Â³Ã°Å¸â€¡Â± +31 Netherlands</option>
                <option value="+32">Ã°Å¸â€¡Â§Ã°Å¸â€¡Âª +32 Belgium</option>
                <option value="+353">Ã°Å¸â€¡Â®Ã°Å¸â€¡Âª +353 Ireland</option>
                <option value="+46">Ã°Å¸â€¡Â¸Ã°Å¸â€¡Âª +46 Sweden</option>
                <option value="+47">Ã°Å¸â€¡Â³Ã°Å¸â€¡Â´ +47 Norway</option>
                <option value="+45">Ã°Å¸â€¡Â©Ã°Å¸â€¡Â° +45 Denmark</option>
                <option value="+41">Ã°Å¸â€¡Â¨Ã°Å¸â€¡Â­ +41 Switzerland</option>
                <option value="+7">Ã°Å¸â€¡Â·Ã°Å¸â€¡Âº +7 Russia</option>
              </optgroup>
              <optgroup label="Americas">
                <option value="+55">Ã°Å¸â€¡Â§Ã°Å¸â€¡Â· +55 Brazil</option>
                <option value="+52">Ã°Å¸â€¡Â²Ã°Å¸â€¡Â½ +52 Mexico</option>
                <option value="+54">Ã°Å¸â€¡Â¦Ã°Å¸â€¡Â· +54 Argentina</option>
                <option value="+57">Ã°Å¸â€¡Â¨Ã°Å¸â€¡Â´ +57 Colombia</option>
                <option value="+58">Ã°Å¸â€¡Â»Ã°Å¸â€¡Âª +58 Venezuela</option>
              </optgroup>
              <optgroup label="Asia &amp; Middle East">
                <option value="+91">Ã°Å¸â€¡Â®Ã°Å¸â€¡Â³ +91 India</option>
                <option value="+86">Ã°Å¸â€¡Â¨Ã°Å¸â€¡Â³ +86 China</option>
                <option value="+81">Ã°Å¸â€¡Â¯Ã°Å¸â€¡Âµ +81 Japan</option>
                <option value="+82">Ã°Å¸â€¡Â°Ã°Å¸â€¡Â· +82 S.Korea</option>
                <option value="+966">Ã°Å¸â€¡Â¸Ã°Å¸â€¡Â¦ +966 Saudi Arabia</option>
                <option value="+971">Ã°Å¸â€¡Â¦Ã°Å¸â€¡Âª +971 UAE</option>
                <option value="+974">Ã°Å¸â€¡Â¶Ã°Å¸â€¡Â¦ +974 Qatar</option>
                <option value="+965">Ã°Å¸â€¡Â°Ã°Å¸â€¡Â¼ +965 Kuwait</option>
                <option value="+92">Ã°Å¸â€¡ÂµÃ°Å¸â€¡Â° +92 Pakistan</option>
                <option value="+880">Ã°Å¸â€¡Â§Ã°Å¸â€¡Â© +880 Bangladesh</option>
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
            Ã°Å¸â€™Â³ Pay Online (Card / Bank Transfer)
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

// Ã¢â€â‚¬Ã¢â€â‚¬ Online Payment via PayIsland Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
async function submitOrderOnline() {
  const name  = (document.getElementById('oc-name').value  || '').trim() || 'Customer';
  const phoneCode = (document.getElementById('oc-phone-code') ? document.getElementById('oc-phone-code').value : '+234');
  const rawPhone  = (document.getElementById('oc-phone').value || '').trim().replace(/^0+/, '');
  const phone     = rawPhone ? phoneCode + rawPhone : '';
  const notes = (document.getElementById('oc-notes').value || '').trim();
  const errEl = document.getElementById('oc-error');

  if (!phone) {
    errEl.textContent = 'Ã¢Å¡Â Ã¯Â¸Â Please enter your phone number so we can contact you about your order.';
    errEl.style.display = 'block';
    document.getElementById('oc-phone').focus();
    return;
  }
  errEl.style.display = 'none';

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const onlineBtn = document.getElementById('oc-pay-online-btn');
  const waBtn     = document.getElementById('oc-submit-btn');
  onlineBtn.disabled = true; onlineBtn.style.opacity = '.6'; onlineBtn.textContent = 'Ã¢ÂÂ³ ConnectingÃ¢â‚¬Â¦';
  if (waBtn) { waBtn.disabled = true; waBtn.style.opacity = '.6'; }

  try {
    const res = await fetch(API_BASE + '/payment/initialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name:  name,
        customer_phone: phone,
        customer_email: '',           // optional Ã¢â‚¬â€ user can leave blank
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
    onlineBtn.disabled = false; onlineBtn.style.opacity = '1'; onlineBtn.textContent = 'Ã°Å¸â€™Â³ Pay Online (Card / Bank Transfer)';
    if (waBtn) { waBtn.disabled = false; waBtn.style.opacity = '1'; }
    errEl.textContent = 'Ã¢ÂÅ’ ' + err.message;
    errEl.style.display = 'block';
  }
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Handle PayIsland payment callback (check URL params on load) Ã¢â€â‚¬
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
      <div style="font-size:3.5rem;margin-bottom:12px;">Ã¢Å“â€¦</div>
      <h3 style="color:#fff;font-size:1.2rem;margin-bottom:8px;">Payment Confirmed!</h3>
      <p style="color:var(--text-muted);font-size:.9rem;line-height:1.6;margin-bottom:24px;">
        Thank you, ${name}! Your payment was successful and order ${orderId ? '#' + orderId : ''} is now confirmed.<br>We'll be in touch shortly via WhatsApp. Ã°Å¸Å’Â¿
      </p>
      <button onclick="this.closest('div[style*=fixed]').remove()" style="background:var(--green);color:#fff;border:none;padding:12px 32px;border-radius:50px;font-size:.95rem;font-weight:700;cursor:pointer;">Done</button>
    </div>`;
    document.body.appendChild(banner);
  } else if (payStatus === 'failed') {
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:#e76f51;color:#fff;padding:14px 24px;border-radius:50px;font-weight:600;font-size:.9rem;z-index:3000;';
    toast.textContent = 'Ã¢ÂÅ’ Payment was not completed. Please try again or use WhatsApp checkout.';
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
    errEl.textContent = 'Ã¢Å¡Â Ã¯Â¸Â Please enter your WhatsApp/phone number so we can confirm your order.';
    errEl.style.display = 'block';
    document.getElementById('oc-phone').focus();
    return;
  }
  errEl.style.display = 'none';

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  btn.disabled = true;
  btn.style.opacity = '.6';
  btn.innerHTML = 'Ã¢ÂÂ³ Sending...';

  // 2 Ã¢â€â‚¬Ã¢â€â‚¬ Build WhatsApp message to farm (plain text Ã¢â‚¬â€ no emoji to avoid diamond symbols)
  let msg = `Hello Pinnacles Resource Centre Farm!\n\n*NEW ORDER*\n\n`;
  cart.forEach(item => {
    msg += `- *${item.name}* x${item.qty} -- N${(item.price * item.qty).toLocaleString()}\n`;
  });
  msg += `\n*Total: N${total.toLocaleString()}*`;
  msg += `\n\n*Customer:* ${name}`;
  msg += `\n*Phone:* ${phone}`;
  if (notes) msg += `\n*Notes:* ${notes}`;
  msg += `\n\nPlease confirm availability and delivery. Thank you!`;

  // 1 Ã¢â€â‚¬Ã¢â€â‚¬ Save to backend (and trigger admin email)
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
    } catch { /* backend offline Ã¢â‚¬â€ still open WhatsApp */ }
  }

  // 3 Ã¢â€â‚¬Ã¢â€â‚¬ Show success with two send buttons
  showOrderSuccess(name, msg);

  // 4 Ã¢â€â‚¬Ã¢â€â‚¬ Clear cart
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
      <div style="font-size:3.5rem;margin-bottom:12px;">Ã¢Å“â€¦</div>
      <h3 style="color:#fff;font-size:1.2rem;margin-bottom:8px;">Order Recorded!</h3>
      <p style="color:var(--text-muted);font-size:.88rem;margin-bottom:24px;line-height:1.6;">Hi ${name}! Tap the buttons below to send your order to us on WhatsApp.</p>
      <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px;">
        <a href="${wa1}" target="_blank" style="display:flex;align-items:center;justify-content:center;gap:10px;background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;border:none;padding:14px 20px;border-radius:50px;font-size:.95rem;font-weight:700;cursor:pointer;text-decoration:none;">
          Ã°Å¸â€œÂ² Send to +234 903 750 5632
        </a>
        <a href="${wa2}" target="_blank" style="display:flex;align-items:center;justify-content:center;gap:10px;background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;border:none;padding:14px 20px;border-radius:50px;font-size:.95rem;font-weight:700;cursor:pointer;text-decoration:none;opacity:.85;">
          Ã°Å¸â€œÂ² Send to +234 707 821 0834
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
  const msg = `Ã°Å¸Å’Â¿ *Pinnacles Resource Centre Farm*\n\nGet fresh farm produce delivered to you!\n\nÃ°Å¸Ââ€¦ Tomatoes  Ã°Å¸Â«â€˜ Peppers  Ã°Å¸Ââ€œ Strawberries\nÃ°Å¸Å’Â½ Maize  Ã°Å¸Â¥â€¢ Carrots  Ã°Å¸Â¥Å¡ Eggs  Ã°Å¸Â«â€º Green Peas\n\nÃ°Å¸â€œÂ² Order directly on WhatsApp!\n#PinnaclesFarm #FreshProduce #FarmToTable`;
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
  const advertText = `Ã°Å¸Å’Â¿ *PINNACLES RESOURCE CENTRE FARM* Ã°Å¸Å’Â¿\n\nÃ¢Å“â€¦ Fresh Farm Produce Available NOW!\n\nÃ°Å¸Ââ€¦ Tomatoes\nÃ°Å¸Â«â€˜ Peppers\nÃ°Å¸Ââ€œ Strawberries\nÃ°Å¸Å’Â½ Maize\nÃ°Å¸Â¥â€¢ Carrots\nÃ°Å¸Â¥Å¡ Farm Fresh Eggs\nÃ°Å¸Â«â€º Green Peas\nÃ°Å¸Â¥Â¬ And Much More!\n\nÃ°Å¸â€™Â¯ 100% Organically Grown\nÃ°Å¸Å¡Å¡ Fast Delivery Available\nÃ°Å¸â€™Â° Fair & Affordable Prices\n\nÃ°Å¸â€œÂ² Order via WhatsApp Now!\nDon't miss out Ã¢â‚¬â€ get your fresh produce today!\n\n#PinnaclesFarm #FreshProduce #OrganicFood #FarmToTable #NigeriaFarms`;

  document.getElementById('advert-modal-content').innerHTML = `
    <h3>Ã°Å¸â€œÂ¢ Your WhatsApp Advert</h3>
    <p>Copy and share this advert on WhatsApp, Facebook, or any platform!</p>
    <div class="advert-text-box">${advertText}</div>
    <div class="advert-modal-actions">
      <button class="share-btn wa" onclick="sendAdvertOnWhatsApp()">Ã°Å¸â€œÂ² Share on WhatsApp</button>
      <button class="share-btn copy" onclick="copyAdvert()">Ã°Å¸â€œâ€¹ Copy Text</button>
    </div>
    <div id="advert-copy-msg" class="copy-msg" style="display:none;margin-top:10px">Ã¢Å“â€¦ Advert copied!</div>
  `;
  document.getElementById('advert-modal-overlay').classList.add('open');
  document.getElementById('advert-modal').classList.add('open');
}

function sendAdvertOnWhatsApp() {
  const msg = `Ã°Å¸Å’Â¿ *PINNACLES RESOURCE CENTRE FARM* Ã°Å¸Å’Â¿\n\nÃ¢Å“â€¦ Fresh Farm Produce Available NOW!\n\nÃ°Å¸Ââ€¦ Tomatoes | Ã°Å¸Â«â€˜ Peppers | Ã°Å¸Ââ€œ Strawberries\nÃ°Å¸Å’Â½ Maize | Ã°Å¸Â¥â€¢ Carrots | Ã°Å¸Â¥Å¡ Farm Fresh Eggs\nÃ°Å¸Â«â€º Green Peas | Ã°Å¸Â¥Â¬ And Much More!\n\nÃ°Å¸â€™Â¯ 100% Organically Grown\nÃ°Å¸Å¡Å¡ Fast Delivery Available\nÃ°Å¸â€™Â° Fair & Affordable Prices\n\nÃ°Å¸â€œÂ² Order via WhatsApp Now!\n\n#PinnaclesFarm #FreshProduce #FarmToTable`;
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
    } catch { /* backend offline Ã¢â‚¬â€ use fallback */ }
  }
  document.getElementById('gallery-grid').innerHTML = items.map(item => `
    <div class="gallery-item${item.wide ? ' wide' : ''}">
      <img src="${item.img}" alt="${item.alt || 'Farm photo'}"
           onerror="this.outerHTML='<div class=gallery-emoji>Ã°Å¸Å’Â¿</div>'" />
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

// Ã¢â€â‚¬Ã¢â€â‚¬ Today's Harvest Banner Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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
      `<div class="harvest-item${item.limited ? ' limited' : ''}">${item.emoji || 'Ã°Å¸Å’Â¿'} ${item.name}${item.limited ? ' Ã¢â‚¬â€ Limited' : ' Ã¢â‚¬â€ Available'}</div>`
    ).join('');
    section.style.display = 'block';
  } catch (_) { /* silent Ã¢â‚¬â€ endpoint may not be ready */ }
}
document.addEventListener('DOMContentLoaded', () => { loadTodaysHarvest(); });


// Ã¢â€â‚¬Ã¢â€â‚¬ PRE-ORDER SYSTEM Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function openPreorderModal(productId, productName, expectedDate, note) {
  const modal = document.getElementById('preorder-modal');
  const body  = document.getElementById('preorder-modal-body');
  if (!modal || !body) return;

  // Find the product to get unit and price
  const p = products.find(x => x.id === productId) || {};

  body.innerHTML = `
    <div style="margin-bottom:16px">
      <div style="font-size:1.2rem;font-weight:700;color:#fff;margin-bottom:4px">${p.emoji || 'Ã°Å¸Å’Â¿'} ${productName}</div>
      <div style="font-size:.85rem;color:#52b788">Ã¢â€šÂ¦${Number(p.price||0).toLocaleString()} ${p.unit||''}</div>
      ${expectedDate ? `<div style="margin-top:10px;background:rgba(251,191,36,.12);border:1px solid rgba(251,191,36,.3);border-radius:10px;padding:10px 14px;font-size:.82rem;color:#fbbf24">Ã°Å¸â€œâ€¦ Expected availability: <strong>${new Date(expectedDate).toLocaleDateString('en-NG',{day:'numeric',month:'long',year:'numeric'})}</strong></div>` : ''}
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
      <button onclick="submitPreorder(${productId},'${productName}','${(p.unit||'').replace(/'/g,"\\'")}')" style="flex:1;background:linear-gradient(135deg,#92400e,#b45309);color:#fff;border:none;border-radius:12px;padding:12px;font-size:.9rem;font-weight:700;cursor:pointer;font-family:inherit">Ã¢ÂÂ³ Reserve This Now</button>
      <a href="https://wa.me/2349037505632?text=${encodeURIComponent('Hello Pinnacles Farm! I want to pre-order: '+productName+(expectedDate?' (expected '+expectedDate+')':'')+'.')}" target="_blank" style="display:flex;align-items:center;gap:6px;background:#25D366;color:#fff;border-radius:12px;padding:12px 16px;font-size:.9rem;font-weight:700;text-decoration:none;white-space:nowrap">Ã°Å¸â€™Â¬ WhatsApp</a>
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
      '<div style="font-size:3rem;margin-bottom:16px">âœ…</div>' +
      '<h4 style="font-size:1.1rem;color:#a3d9b8;margin-bottom:10px">Pre-order Reserved!</h4>' +
      '<p style="font-size:.85rem;color:rgba(255,255,255,.6);line-height:1.7">Thank you <strong style="color:#fff">' + name + '</strong>! We\'ll contact you on <strong style="color:#fff">' + phone + '</strong> when <strong style="color:#52b788">' + productName + '</strong> is ready.</p>' +
      '<a href="https://wa.me/2349037505632?text=' + waConfirm + '" target="_blank" style="display:inline-block;margin-top:20px;background:#25D366;color:#fff;border-radius:50px;padding:10px 24px;font-weight:700;font-size:.85rem;text-decoration:none">&#128172; Confirm on WhatsApp</a>' +
      '<br><button onclick="closePreorderModal()" style="margin-top:12px;background:none;border:none;color:rgba(255,255,255,.4);font-size:.82rem;cursor:pointer;font-family:inherit">Close</button>' +
      '</div>';
  } catch(e) {
    if (errEl) { errEl.textContent = e.message; errEl.style.display = 'block'; }
  }
}

// ── BULK / WHOLESALE ORDER SYSTEM ────────────────────────────────────────
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
    '<button onclick="document.getElementById(\'bk-row-' + bulkItemCount + '\').remove()" style="background:rgba(248,113,113,.15);color:#f87171;border:none;border-radius:8px;padding:9px 12px;font-size:.9rem;cursor:pointer">✕</button>';
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
      '<div style="font-size:3.5rem;margin-bottom:16px">✅</div>' +
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
