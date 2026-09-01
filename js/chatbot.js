// ============================================================
// Pinnacles Farm — Chatbot Engine
// ============================================================

const FARM_WA = '2349037505632';

// ── State ─────────────────────────────────────────────────────
const ChatBot = (() => {
  let isOpen   = false;
  let products = [];           // loaded from API
  let msgCount = 0;
  let greeted  = false;
  let lastIntent = null;

  // ── Intents + Responses ────────────────────────────────────
  const intents = [
    {
      tags: ['hello','hi','hey','good morning','good afternoon','good evening','hiya','yo','start'],
      reply: () => `Hello there! 👋 Welcome to **Pinnacles Resource Centre Farm**! 🌿\n\nI'm **Harvest**, your farm assistant. I can help you:\n• Browse our fresh produce\n• Find products & prices\n• Add items to your cart\n• Answer any questions\n\nWhat can I do for you today?`,
      chips: ['🛒 Browse Products','🍅 Vegetables','🍓 Fruits','💰 View Prices','📍 Location & Hours']
    },
    {
      tags: ['product','products','produce','sell','selling','available','stock','what do you have','what you have','items','menu','catalogue','catalog'],
      reply: () => {
        if (!products.length) return `We grow a wide range of fresh produce! 🌿 Loading our latest stock...`;
        const sample = products.slice(0,4);
        return `We currently have **${products.length} fresh products** available! Here are some highlights:`;
      },
      chips: () => ['🥦 Vegetables','🍓 Fruits','🌽 Grains','🥚 Proteins','🛒 View All'],
      action: 'showProducts'
    },
    {
      tags: ['vegetable','vegetables','veggie','veggies','greens'],
      reply: () => `Here are our fresh **vegetables** 🥦`,
      action: 'showCategory',
      category: 'vegetables',
      chips: ['🍓 Fruits','🌽 Grains','🥚 Proteins','🛒 View All']
    },
    {
      tags: ['fruit','fruits','berry','berries','strawberr'],
      reply: () => `Here are our fresh **fruits** 🍓`,
      action: 'showCategory',
      category: 'fruits',
      chips: ['🥦 Vegetables','🌽 Grains','🥚 Proteins','🛒 View All']
    },
    {
      tags: ['grain','grains','maize','corn','cereal'],
      reply: () => `Here are our **grains** 🌽`,
      action: 'showCategory',
      category: 'grains',
      chips: ['🥦 Vegetables','🍓 Fruits','🥚 Proteins','🛒 View All']
    },
    {
      tags: ['protein','proteins','egg','eggs','meat'],
      reply: () => `Here are our **protein** products 🥚`,
      action: 'showCategory',
      category: 'proteins',
      chips: ['🥦 Vegetables','🍓 Fruits','🌽 Grains','🛒 View All']
    },
    {
      tags: ['price','prices','cost','how much','naira','cheap','expensive','afford'],
      reply: () => {
        if (!products.length) return `Our prices start from as low as **₦500** and go up to **₦4,500** depending on the product. Type a product name and I\'ll give you the exact price! 💰`;
        const sorted = [...products].sort((a,b) => a.price - b.price);
        const cheapest = sorted[0];
        const priciest = sorted[sorted.length - 1];
        return `Our prices range from **₦${Number(cheapest.price).toLocaleString()}** (${cheapest.emoji || '🌿'} ${cheapest.name}) to **₦${Number(priciest.price).toLocaleString()}** (${priciest.emoji || '🌿'} ${priciest.name}).\n\nAll prices are fair and direct from the farm! 💰`;
      },
      chips: ['🛒 Browse All Products','💬 WhatsApp Us']
    },
    {
      tags: ['delivery','deliver','shipping','how to get','location','where','address','area'],
      reply: () => `We offer **fast delivery** 🚚 straight from the farm to your door!\n\n📍 **Farm Location:** Pinnacles Resource Centre Farm\n🕐 **Hours:** Mon – Sat, 7:00am – 6:00pm\n\nTo arrange delivery, simply place your order via WhatsApp and we\'ll confirm pickup/delivery with you directly.`,
      chips: ['💬 Order on WhatsApp','🛒 Shop Now']
    },
    {
      tags: ['hour','hours','open','opening','close','closing','time','when'],
      reply: () => `We are open **Monday to Saturday** 🗓️\n⏰ **7:00 AM – 6:00 PM**\n\nFor urgent orders outside these hours, you can still message us on WhatsApp and we\'ll get back to you as soon as possible!`,
      chips: ['💬 WhatsApp Us','🛒 Shop Now']
    },
    {
      tags: ['contact','phone','number','call','whatsapp','reach','email'],
      reply: () => `Here\'s how to reach us:\n\n📱 **WhatsApp:** +234 903 750 5632\n📧 **Email:** agribusiness@pinnaclescentre.com\n\nThe quickest way is WhatsApp — we respond within minutes! 💬`,
      chips: ['💬 Open WhatsApp','🛒 Shop Now']
    },
    {
      tags: ['organic','natural','chemical','pesticide','gmo','safe','healthy','fresh'],
      reply: () => `Yes! 🌱 All our produce is **100% organically grown**.\n\nWe use no harmful chemicals or pesticides. Everything is grown naturally in rich Nigerian soil and harvested fresh daily. Good food starts with good farming! 🌿`,
      chips: ['🛒 Shop Our Produce','💬 Learn More']
    },
    {
      tags: ['order','buy','purchase','checkout','cart','add','get'],
      reply: () => `Ready to order? 🛒 Here\'s how:\n\n**1.** Browse our products below\n**2.** Tap **+ Add** to add items to your cart\n**3.** Click the 🛒 cart icon and tap **Order via WhatsApp**\n**4.** Enter your name & phone number\n**5.** We\'ll confirm your order and arrange delivery!\n\nWant me to show you our products?`,
      chips: ['🛒 Browse Products','💬 Order on WhatsApp']
    },
    {
      tags: ['cart','basket','my order'],
      reply: () => `Your cart is managed in the 🛒 shopping cart on the top menu!\n\nWant me to help you find something specific? Just tell me the product name.`,
      chips: ['🛒 Browse Products','💰 View Prices']
    },
    {
      tags: ['thank','thanks','thank you','great','awesome','perfect','nice','good','excellent','wonderful'],
      reply: () => `You\'re very welcome! 😊 It\'s our pleasure to serve you.\n\nIs there anything else I can help you with? 🌿`,
      chips: ['🛒 Browse Products','💬 Contact Us']
    },
    {
      tags: ['bye','goodbye','see you','later','done','exit','close'],
      reply: () => `Thank you for visiting Pinnacles Farm! 🌿\n\nCome back anytime for the freshest farm produce. Have a wonderful day! 😊🌱`,
      chips: ['🛒 Shop Again']
    },
    {
      tags: ['about','who are you','pinnacles','farm','story','history'],
      reply: () => `🌿 **About Pinnacles Resource Centre Farm**\n\nWe are a passionate agricultural enterprise dedicated to growing and delivering the highest quality, freshest farm produce directly to your table.\n\nFrom our rich soil, we cultivate a wide range of crops — tomatoes, peppers, strawberries, maize, carrots, eggs and more. We believe good food starts with good farming!`,
      chips: ['🛒 Shop Our Produce','💬 Contact Us','📍 Location & Hours']
    },
  ];

  // ── NLP: find best matching intent ────────────────────────
  function matchIntent(text) {
    const lower = text.toLowerCase().trim();
    let best = null, bestScore = 0;

    // Check if user is searching for a specific product by name
    const productMatch = products.find(p =>
      lower.includes(p.name.toLowerCase()) ||
      p.name.toLowerCase().split(' ').some(w => w.length > 3 && lower.includes(w))
    );
    if (productMatch) return { type: 'product_search', product: productMatch };

    // Check chips/quick replies exact
    const chipMap = {
      '🛒 browse products': 'products', '🛒 view all': 'products', '🛒 shop now': 'products', '🛒 shop again': 'products', '🛒 shop our produce': 'products',
      '🥦 vegetables': 'vegetable', '🍓 fruits': 'fruit', '🌽 grains': 'grain', '🥚 proteins': 'protein',
      '💬 whatsapp us': 'whatsapp', '💬 order on whatsapp': 'whatsapp', '💬 open whatsapp': 'whatsapp',
      '💬 contact us': 'contact', '💬 learn more': 'about',
      '💰 view prices': 'price', '💰 view all products': 'products',
      '📍 location & hours': 'hour',
    };
    const cleanChip = lower.replace(/^[^\w]*/,'').trim();
    for (const [chip, tag] of Object.entries(chipMap)) {
      if (lower === chip || cleanChip === chip.replace(/^[^\w]*/,'').trim()) {
        return intents.find(i => i.tags.includes(tag)) || null;
      }
    }

    for (const intent of intents) {
      for (const tag of intent.tags) {
        if (lower.includes(tag)) {
          const score = tag.length;
          if (score > bestScore) { best = intent; bestScore = score; }
        }
      }
    }
    return best;
  }

  // ── DOM helpers ────────────────────────────────────────────
  function el(id) { return document.getElementById(id); }

  function scrollDown() {
    const msgs = el('chat-messages');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }

  function addBubble(text, side = 'bot', delay = 0) {
    return new Promise(resolve => {
      setTimeout(() => {
        const msgs = el('chat-messages');
        const div = document.createElement('div');
        div.className = `chat-bubble ${side}`;
        // Bold markdown support
        div.innerHTML = text
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\n/g, '<br>');
        msgs.appendChild(div);
        scrollDown();
        resolve();
      }, delay);
    });
  }

  function addChips(chips, delay = 0) {
    return new Promise(resolve => {
      setTimeout(() => {
        const msgs = el('chat-messages');
        const wrap = document.createElement('div');
        wrap.className = 'chat-chips';
        (Array.isArray(chips) ? chips : chips()).forEach(label => {
          const btn = document.createElement('button');
          btn.className = 'chip';
          btn.textContent = label;
          btn.onclick = () => handleUserMessage(label);
          wrap.appendChild(btn);
        });
        msgs.appendChild(wrap);
        scrollDown();
        resolve();
      }, delay);
    });
  }

  function addTyping(duration = 900) {
    return new Promise(resolve => {
      const msgs = el('chat-messages');
      const dot = document.createElement('div');
      dot.className = 'chat-typing';
      dot.id = 'chat-typing-indicator';
      dot.innerHTML = '<span></span><span></span><span></span>';
      msgs.appendChild(dot);
      scrollDown();
      setTimeout(() => { dot.remove(); resolve(); }, duration);
    });
  }

  function addProductCard(p, delay = 0) {
    return new Promise(resolve => {
      setTimeout(() => {
        const msgs = el('chat-messages');
        const card = document.createElement('div');
        card.className = 'chat-product-card';
        card.onclick = () => {
          if (typeof openModal === 'function') openModal(p.id);
        };

        let thumbHTML = '';
        if (p.img && !p.img.startsWith('data:')) {
          thumbHTML = `<div class="chat-product-thumb"><img src="${p.img.startsWith('/')?p.img:'/'+p.img}" alt="${p.name}" onerror="this.parentElement.textContent='${p.emoji||'🌿'}'" /></div>`;
        } else {
          thumbHTML = `<div class="chat-product-thumb">${p.emoji||'🌿'}</div>`;
        }

        card.innerHTML = `
          ${thumbHTML}
          <div class="chat-product-info">
            <div class="chat-product-name">${p.name}</div>
            <div class="chat-product-price">₦${Number(p.price).toLocaleString()} <span style="font-weight:400;opacity:.7;font-size:.72rem">${p.unit||''}</span></div>
          </div>
          <button class="chat-add-btn" onclick="event.stopPropagation(); chatAddToCart(${p.id})">+ Add</button>
        `;
        msgs.appendChild(card);
        scrollDown();
        resolve();
      }, delay);
    });
  }

  // ── Show products in chat ──────────────────────────────────
  async function showProductsInChat(filtered) {
    const shown = (filtered || products).slice(0, 5);
    for (let i = 0; i < shown.length; i++) {
      await addProductCard(shown[i], i * 80);
    }
    if ((filtered || products).length > 5) {
      await addBubble(`...and ${(filtered||products).length - 5} more! Tap **🛒 Browse Products** to see them all on the page.`, 'bot', shown.length * 80 + 100);
    }
  }

  // ── Handle a user message ──────────────────────────────────
  async function handleUserMessage(text) {
    if (!text.trim()) return;

    // Show user bubble
    await addBubble(text, 'user');

    // Disable input briefly
    const input = el('chat-input');
    if (input) input.disabled = true;

    // Typing animation
    const typingDelay = 600 + Math.random() * 400;
    await addTyping(typingDelay);

    const intent = matchIntent(text);

    if (intent && intent.type === 'product_search') {
      const p = intent.product;
      await addBubble(`Great choice! Here's **${p.name}** 🌿`, 'bot');
      await addProductCard(p, 100);
      await addChips(['🛒 Browse All','💰 View Prices','💬 WhatsApp Us'], 300);
    } else if (intent) {
      const replyText = typeof intent.reply === 'function' ? intent.reply() : intent.reply;
      await addBubble(replyText, 'bot');

      // Handle actions
      if (intent.action === 'showProducts' || text.toLowerCase().includes('view all') || text.toLowerCase().includes('browse')) {
        await showProductsInChat(products);
      } else if (intent.action === 'showCategory') {
        const cat = intent.category;
        const filtered = products.filter(p => p.category === cat);
        if (filtered.length) await showProductsInChat(filtered);
        else await addBubble(`Hmm, we don't have any ${cat} listed right now. Check back soon or message us on WhatsApp!`, 'bot');
      } else if (intent.tags.includes('contact') || text.toLowerCase().includes('whatsapp')) {
        // WhatsApp special chip handled below
      }

      // Chips
      if (intent.chips) {
        const chips = typeof intent.chips === 'function' ? intent.chips() : intent.chips;
        // Replace "💬 WhatsApp Us" chip with actual WhatsApp opener
        await addChips(chips.filter(c => !c.toLowerCase().includes('whatsapp')), 200);
        if (chips.some(c => c.toLowerCase().includes('whatsapp'))) {
          setTimeout(() => {
            const msgs = el('chat-messages');
            const wa = document.createElement('button');
            wa.className = 'chip';
            wa.style.background = 'rgba(37,211,102,.15)';
            wa.style.borderColor = 'rgba(37,211,102,.4)';
            wa.style.color = '#25D366';
            wa.textContent = '💬 WhatsApp Us';
            wa.onclick = () => window.open(`https://wa.me/${FARM_WA}?text=${encodeURIComponent('Hello Pinnacles Farm! 🌿 I need help with an order.')}`, '_blank');
            // Append to last chip group
            const lastChips = msgs.querySelector('.chat-chips:last-child');
            if (lastChips) lastChips.appendChild(wa);
            else {
              const wrap = document.createElement('div');
              wrap.className = 'chat-chips';
              wrap.appendChild(wa);
              msgs.appendChild(wrap);
            }
            scrollDown();
          }, 300);
        }
      }
    } else {
      // Fallback
      await addBubble(`I'm not sure I understand that 🤔 Let me connect you to our team on WhatsApp for a better answer!`, 'bot');
      await addChips(['🛒 Browse Products','💬 WhatsApp Us','💰 View Prices'], 200);
    }

    if (input) input.disabled = false;
    input?.focus();
    lastIntent = intent;
  }

  // ── Open / Close ───────────────────────────────────────────
  function open() {
    isOpen = true;
    const win = el('chat-window');
    const btn = el('chat-launcher');
    win.classList.add('open');
    btn.classList.add('open');
    el('chat-unread-badge').classList.remove('show');
    el('chat-input').focus();

    if (!greeted) {
      greeted = true;
      setTimeout(async () => {
        await addTyping(800);
        await addBubble(`👋 Hello! I'm **Harvest**, your Pinnacles Farm assistant.\n\nI can help you find fresh produce, check prices, and place orders! What are you looking for?`, 'bot');
        await addChips(['🛒 Browse Products','💰 View Prices','📍 Location & Hours','💬 Contact Us'], 200);
      }, 200);
    }
  }

  function close() {
    isOpen = false;
    el('chat-window').classList.remove('open');
    el('chat-launcher').classList.remove('open');
  }

  function toggle() { isOpen ? close() : open(); }

  // ── Init ───────────────────────────────────────────────────
  async function init() {
    // Load products from the API (same endpoint used by the main site)
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          products = data.map(p => ({ ...p, desc: p.description }));
        }
      }
    } catch { /* use empty */ }

    // Wire up events
    el('chat-launcher').addEventListener('click', toggle);
    el('chat-close-btn').addEventListener('click', close);
    el('chat-input').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    el('chat-send-btn').addEventListener('click', sendMessage);

    // Show unread badge after 4s to entice user
    setTimeout(() => {
      if (!isOpen) {
        el('chat-unread-badge').classList.add('show');
        el('chat-unread-badge').textContent = '1';
      }
    }, 4000);
  }

  function sendMessage() {
    const input = el('chat-input');
    const text = (input.value || '').trim();
    if (!text) return;
    input.value = '';
    handleUserMessage(text);
  }

  return { init, open, close, toggle, handleUserMessage };
})();

// ── Global helper: add to cart from chatbot card ───────────────
function chatAddToCart(productId) {
  if (typeof addToCart === 'function') {
    addToCart(productId);
    // Visual feedback on the button
    const btn = document.activeElement;
    if (btn && btn.classList.contains('chat-add-btn')) {
      btn.textContent = '✓ Added';
      btn.style.background = '#2d6a4f';
      setTimeout(() => { btn.textContent = '+ Add'; btn.style.background = ''; }, 1500);
    }
  }
}

// ── Boot ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => ChatBot.init());
