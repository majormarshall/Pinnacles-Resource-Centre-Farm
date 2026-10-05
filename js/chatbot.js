// ============================================================
// Pinnacles Farm \u2014 Chatbot Engine
// ============================================================

const FARM_WA = '2349037505632';

// \u2500\u2500 State \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
const ChatBot = (() => {
  let isOpen   = false;
  let products = [];           // loaded from API
  let msgCount = 0;
  let greeted  = false;
  let lastIntent = null;
  const chatSession = { lastProduct: null };   // context for follow-up messages

  // \u2500\u2500 Intents + Responses \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const intents = [
    {
      tags: ['hello','hi','hey','good morning','good afternoon','good evening','hiya','yo','start'],
      reply: () => `Hello there! \u{1F44B} Welcome to **Pinnacles Resource Centre Farm**! \u{1F33F}\n\nI'm **Harvest**, your farm assistant. I can help you:\n\u2022 Browse our fresh produce\n\u2022 Find products & prices\n\u2022 Add items to your cart\n\u2022 Answer any questions\n\nWhat can I do for you today?`,
      chips: ['\u{1F6D2} Browse Products','\u{1F345} Vegetables','\u{1F353} Fruits','\u{1F4B0} View Prices','\u{1F4CD} Location & Hours']
    },
    {
      tags: ['product','products','produce','sell','selling','available','stock','what do you have','what you have','items','menu','catalogue','catalog'],
      reply: () => {
        if (!products.length) return `We grow a wide range of fresh produce! \u{1F33F} Loading our latest stock...`;
        const sample = products.slice(0,4);
        return `We currently have **${products.length} fresh products** available! Here are some highlights:`;
      },
      chips: () => ['\u{1F966} Vegetables','\u{1F353} Fruits','\u{1F33D} Grains','\u{1F95A} Proteins','\u{1F6D2} View All'],
      action: 'showProducts'
    },
    {
      tags: ['vegetable','vegetables','veggie','veggies','greens'],
      reply: () => `Here are our fresh **vegetables** \u{1F966}`,
      action: 'showCategory',
      category: 'vegetables',
      chips: ['\u{1F353} Fruits','\u{1F33D} Grains','\u{1F95A} Proteins','\u{1F6D2} View All']
    },
    {
      tags: ['fruit','fruits','berry','berries','strawberr'],
      reply: () => `Here are our fresh **fruits** \u{1F353}`,
      action: 'showCategory',
      category: 'fruits',
      chips: ['\u{1F966} Vegetables','\u{1F33D} Grains','\u{1F95A} Proteins','\u{1F6D2} View All']
    },
    {
      tags: ['grain','grains','maize','corn','cereal'],
      reply: () => `Here are our **grains** \u{1F33D}`,
      action: 'showCategory',
      category: 'grains',
      chips: ['\u{1F966} Vegetables','\u{1F353} Fruits','\u{1F95A} Proteins','\u{1F6D2} View All']
    },
    {
      tags: ['protein','proteins','egg','eggs','meat'],
      reply: () => `Here are our **protein** products \u{1F95A}`,
      action: 'showCategory',
      category: 'proteins',
      chips: ['\u{1F966} Vegetables','\u{1F353} Fruits','\u{1F33D} Grains','\u{1F6D2} View All']
    },
    {
      tags: ['price','prices','cost','how much','naira','cheap','expensive','afford'],
      reply: () => {
        if (!products.length) return `Our prices start from as low as **\u20A6500** and go up to **\u20A64,500** depending on the product. Type a product name and I\'ll give you the exact price! \u{1F4B0}`;
        const sorted = [...products].sort((a,b) => a.price - b.price);
        const cheapest = sorted[0];
        const priciest = sorted[sorted.length - 1];
        return `Our prices range from **\u20A6${Number(cheapest.price).toLocaleString()}** (${cheapest.emoji || '\u{1F33F}'} ${cheapest.name}) to **\u20A6${Number(priciest.price).toLocaleString()}** (${priciest.emoji || '\u{1F33F}'} ${priciest.name}).\n\nAll prices are fair and direct from the farm! \u{1F4B0}`;
      },
      chips: ['\u{1F6D2} Browse All Products','\u{1F4AC} WhatsApp Us']
    },
    {
      tags: ['delivery','deliver','shipping','how to get','location','where','address','area'],
      reply: () => `We offer **fast delivery** \u{1F69A} straight from the farm to your door!\n\n\u{1F4CD} **Farm Location:** Pinnacles Resource Centre Farm\n\u{1F550} **Hours:** Mon \u2013 Sat, 7:00am \u2013 6:00pm\n\nTo arrange delivery, simply place your order via WhatsApp and we\'ll confirm pickup/delivery with you directly.`,
      chips: ['\u{1F4AC} Order on WhatsApp','\u{1F6D2} Shop Now']
    },
    {
      tags: ['hour','hours','open','opening','close','closing','time','when'],
      reply: () => `We are open **Monday to Saturday** \u{1F5D3}\uFE0F\n\u23F0 **7:00 AM \u2013 6:00 PM**\n\nFor urgent orders outside these hours, you can still message us on WhatsApp and we\'ll get back to you as soon as possible!`,
      chips: ['\u{1F4AC} WhatsApp Us','\u{1F6D2} Shop Now']
    },
    {
      tags: ['contact','phone','number','call','whatsapp','reach','email'],
      reply: () => `Here\'s how to reach us:\n\n\u{1F4F1} **WhatsApp:** +234 903 750 5632\n\u{1F4E7} **Email:** agribusiness@pinnaclescentre.com\n\nThe quickest way is WhatsApp \u2014 we respond within minutes! \u{1F4AC}`,
      chips: ['\u{1F4AC} Open WhatsApp','\u{1F6D2} Shop Now']
    },
    {
      tags: ['organic','natural','chemical','pesticide','gmo','safe','healthy','fresh'],
      reply: () => `Yes! \u{1F331} All our produce is **100% organically grown**.\n\nWe use no harmful chemicals or pesticides. Everything is grown naturally in rich Nigerian soil and harvested fresh daily. Good food starts with good farming! \u{1F33F}`,
      chips: ['\u{1F6D2} Shop Our Produce','\u{1F4AC} Learn More']
    },
    {
      tags: ['order','buy','purchase','checkout','cart','add','get'],
      reply: () => `Ready to order? \u{1F6D2} Here\'s how:\n\n**1.** Browse our products below\n**2.** Tap **+ Add** to add items to your cart\n**3.** Click the \u{1F6D2} cart icon and tap **Order via WhatsApp**\n**4.** Enter your name & phone number\n**5.** We\'ll confirm your order and arrange delivery!\n\nWant me to show you our products?`,
      chips: ['\u{1F6D2} Browse Products','\u{1F4AC} Order on WhatsApp']
    },
    {
      tags: ['cart','basket','my order'],
      reply: () => `Your cart is managed in the \u{1F6D2} shopping cart on the top menu!\n\nWant me to help you find something specific? Just tell me the product name.`,
      chips: ['\u{1F6D2} Browse Products','\u{1F4B0} View Prices']
    },
    {
      tags: ['thank','thanks','thank you','great','awesome','perfect','nice','good','excellent','wonderful'],
      reply: () => `You\'re very welcome! \u{1F60A} It\'s our pleasure to serve you.\n\nIs there anything else I can help you with? \u{1F33F}`,
      chips: ['\u{1F6D2} Browse Products','\u{1F4AC} Contact Us']
    },
    {
      tags: ['bye','goodbye','see you','later','done','exit','close'],
      reply: () => `Thank you for visiting Pinnacles Farm! \u{1F33F}\n\nCome back anytime for the freshest farm produce. Have a wonderful day! \u{1F60A}\u{1F331}`,
      chips: ['\u{1F6D2} Shop Again']
    },
    {
      tags: ['about','who are you','pinnacles','farm','story','history'],
      reply: () => `\u{1F33F} **About Pinnacles Resource Centre Farm**\n\nWe are a passionate agricultural enterprise dedicated to growing and delivering the highest quality, freshest farm produce directly to your table.\n\nFrom our rich soil, we cultivate a wide range of crops \u2014 tomatoes, peppers, strawberries, maize, carrots, eggs and more. We believe good food starts with good farming!`,
      chips: ['\u{1F6D2} Shop Our Produce','\u{1F4AC} Contact Us','\u{1F4CD} Location & Hours']
    },
  ];

  // \u2500\u2500 NLP: find best matching intent \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  function matchIntent(text) {
    const lower = text.toLowerCase().trim();
    let best = null, bestScore = 0;

    // Handle "Add N to Cart" chips from product search context
    if ((lower.includes('add') && lower.includes('cart')) || lower.includes('add 1') || lower.includes('add 3') || lower.includes('add 5')) {
      const numMatch = lower.match(/add\s+(\d+)/);
      const qty = numMatch ? parseInt(numMatch[1]) : 1;
      if (chatSession.lastProduct && typeof chatAddToCart === 'function') {
        for (let i = 0; i < qty; i++) chatAddToCart(chatSession.lastProduct.id);
        return {
          type: 'cart_added', product: chatSession.lastProduct, qty,
          reply: `\u2705 Done! I've added **${qty} x ${chatSession.lastProduct.name}** to your cart. \u{1F6D2}\n\nWould you like delivery or farm pickup?`,
          chips: ['\u{1F4E6} View Cart','\u{1F33F} Keep Shopping','\u{1F4AC} Order on WhatsApp']
        };
      }
    }

    // Check if user is searching for a specific product by name
    const productMatch = products.find(p =>
      lower.includes(p.name.toLowerCase()) ||
      p.name.toLowerCase().split(' ').some(w => w.length > 3 && lower.includes(w))
    );
    if (productMatch) return { type: 'product_search', product: productMatch };

    // Check chips/quick replies exact
    const chipMap = {
      '\u{1F6D2} browse products': 'products', '\u{1F6D2} view all': 'products', '\u{1F6D2} shop now': 'products', '\u{1F6D2} shop again': 'products', '\u{1F6D2} shop our produce': 'products',
      '\u{1F6D2} browse all': 'products', '\u{1F6D2} browse all products': 'products', '\u{1F6D2} browse more': 'products', '\u{1F6D2} browse available products': 'products',
      '\u{1F6CD}\uFE0F browse more': 'products',
      '\u{1F966} vegetables': 'vegetable', '\u{1F353} fruits': 'fruit', '\u{1F33D} grains': 'grain', '\u{1F95A} proteins': 'protein',
      '\u{1F4AC} whatsapp us': 'whatsapp', '\u{1F4AC} order on whatsapp': 'whatsapp', '\u{1F4AC} open whatsapp': 'whatsapp', '\u{1F4AC} notify me on whatsapp': 'whatsapp',
      '\u{1F4AC} contact us': 'contact', '\u{1F4AC} learn more': 'about',
      '\u{1F4B0} view prices': 'price', '\u{1F4B0} view all products': 'products',
      '\u{1F4CD} location & hours': 'hour',
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

  // \u2500\u2500 DOM helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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
          thumbHTML = `<div class="chat-product-thumb"><img src="${p.img.startsWith('/')?p.img:'/'+p.img}" alt="${p.name}" onerror="this.parentElement.textContent='${p.emoji||'\u{1F33F}'}'" /></div>`;
        } else {
          thumbHTML = `<div class="chat-product-thumb">${p.emoji||'\u{1F33F}'}</div>`;
        }

        card.innerHTML = `
          ${thumbHTML}
          <div class="chat-product-info">
            <div class="chat-product-name">${p.name}</div>
            <div class="chat-product-price">\u20A6${Number(p.price).toLocaleString()} <span style="font-weight:400;opacity:.7;font-size:.72rem">${p.unit||''}</span></div>
          </div>
          <button class="chat-add-btn" onclick="event.stopPropagation(); chatAddToCart(${p.id})">+ Add</button>
        `;
        msgs.appendChild(card);
        scrollDown();
        resolve();
      }, delay);
    });
  }

  // \u2500\u2500 Show products in chat \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  async function showProductsInChat(filtered) {
    const shown = (filtered || products).slice(0, 5);
    for (let i = 0; i < shown.length; i++) {
      await addProductCard(shown[i], i * 80);
    }
    if ((filtered || products).length > 5) {
      await addBubble(`...and ${(filtered||products).length - 5} more! Tap **\u{1F6D2} Browse Products** to see them all on the page.`, 'bot', shown.length * 80 + 100);
    }
  }

  // \u2500\u2500 Handle a user message \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  async 
// \u2500\u2500 Harvest AI backend call \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function callHarvestAI(userMsg) {
  try {
    const cart = window._cartItems ? [...window._cartItems] : [];
    const customerId = null; // TODO: link to customer account
    const res  = await fetch('/api/harvest-ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMsg, cart, customer_id: customerId }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Handle actions from AI
    if (data.actions?.length) {
      data.actions.forEach(action => {
        if (action.type === 'add_to_cart' && window.addToCart) {
          for (let i = 0; i < (action.qty || 1); i++) window.addToCart(action.id);
          setTimeout(() => { if (window.toggleCart) window.toggleCart(); }, 400);
        }
      });
    }
    return data.reply || null;
  } catch { return null; }
}

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

    // Try Harvest AI backend first (live inventory-aware responses)
    const aiReply = await callHarvestAI(text);
    if (aiReply) {
      addBotMsg(aiReply.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>'));
      if (input) input.disabled = false;
      return;
    }

    const intent = matchIntent(text);

    if (intent && intent.type === 'cart_added') {
      await addBubble(intent.reply, 'bot');
      await addChips(intent.chips, 300);
      // Open cart panel
      setTimeout(() => { if (typeof toggleCart === 'function') toggleCart(); }, 600);
    } else if (intent && intent.type === 'product_search') {
      const p = intent.product;
      const inStock = p.in_stock !== 0;

      // Conversational availability response
      if (inStock) {
        await addBubble(
          `Yes! \u2705 We currently have **${p.name}** available.\n\n` +
          `${p.emoji} **${p.name}** \u2014 \u20A6${Number(p.price).toLocaleString()} ${p.unit}\n\n` +
          `Would you like to add some to your cart, or order directly via WhatsApp?`,
          'bot'
        );
        await addProductCard(p, 200);
        // Store context for follow-up "yes, 3 baskets" type replies
        chatSession.lastProduct = p;
        await addChips(['\u{1F6D2} Add 1 to Cart', '\u{1F6D2} Add 3 to Cart', '\u{1F4AC} Order on WhatsApp', '\u{1F6CD}\uFE0F Browse More'], 400);
      } else {
        await addBubble(
          `Sorry, **${p.name}** is currently **out of stock** \u{1F614}\n\nBut you can message us on WhatsApp \u2014 we restock regularly and can let you know when it's back!`,
          'bot'
        );
        await addChips(['\u{1F4AC} Notify Me on WhatsApp', '\u{1F6D2} Browse Available Products'], 300);
      }
    } else if (intent && intent.type === 'add_to_cart') {
      const p = intent.product;
      const qty = intent.qty || 1;
      const inStock = p.in_stock !== 0;
      if (!inStock) {
        await addBubble(`Sorry, **${p.name}** is currently \u{1F534} out of stock and can't be added to cart.`, 'bot');
        await addChips(['\u{1F6D2} Browse All Products', '\u{1F4AC} WhatsApp Us'], 200);
      } else {
        if (typeof window !== 'undefined' && typeof window.addToCart === 'function') {
          for (let i = 0; i < qty; i++) window.addToCart(p.id);
          await addBubble(`\u2705 Added **${qty}\u00D7 ${p.name}** to your cart! \u{1F6D2}\n\nYour cart has been updated. Open the \u{1F6D2} cart icon to review your order.`, 'bot');
        } else {
          await addBubble(`I'd love to add **${qty}\u00D7 ${p.name}** to your cart! Tap the product card below then use **\u{1F6D2} Add to Cart** on the page.`, 'bot');
          await addProductCard(p, 100);
        }
        await addChips(['\u{1F6D2} Browse More', '\u{1F4AC} WhatsApp Us'], 200);
      }
    } else if (intent && intent.type === 'order_product') {
      const p = intent.product;
      const inStock = p.in_stock !== 0;
      await addBubble(`Great choice! **${p.name}** is ${inStock ? '\u{1F7E2} in stock' : '\u{1F534} currently out of stock'} at \u20A6${Number(p.price).toLocaleString()} ${p.unit || ''}.\n\n${inStock ? 'You can add it to your cart or order directly on WhatsApp! \u{1F447}' : 'Message us on WhatsApp \u2014 we restock regularly and can reserve it for you!'}`, 'bot');
      await addProductCard(p, 100);
      await addChips(['\u{1F6D2} Browse All', '\u{1F4AC} WhatsApp Us'], 300);
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
        // Replace "\u{1F4AC} WhatsApp Us" chip with actual WhatsApp opener
        await addChips(chips.filter(c => !c.toLowerCase().includes('whatsapp')), 200);
        if (chips.some(c => c.toLowerCase().includes('whatsapp'))) {
          setTimeout(() => {
            const msgs = el('chat-messages');
            const wa = document.createElement('button');
            wa.className = 'chip';
            wa.style.background = 'rgba(37,211,102,.15)';
            wa.style.borderColor = 'rgba(37,211,102,.4)';
            wa.style.color = '#25D366';
            wa.textContent = '\u{1F4AC} WhatsApp Us';
            wa.onclick = () => window.open(`https://wa.me/${FARM_WA}?text=${encodeURIComponent('Hello Pinnacles Farm! \u{1F33F} I need help with an order.')}`, '_blank');
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
      await addBubble(`I'm not sure I understand that \u{1F914} Let me connect you to our team on WhatsApp for a better answer!`, 'bot');
      await addChips(['\u{1F6D2} Browse Products','\u{1F4AC} WhatsApp Us','\u{1F4B0} View Prices'], 200);
    }

    if (input) input.disabled = false;
    input?.focus();
    lastIntent = intent;
  }

  // \u2500\u2500 Open / Close \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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
        await addBubble(`\u{1F44B} Hello! I'm **Harvest**, your Pinnacles Farm assistant.\n\nI can help you find fresh produce, check prices, and place orders! What are you looking for?`, 'bot');
        await addChips(['\u{1F6D2} Browse Products','\u{1F4B0} View Prices','\u{1F4CD} Location & Hours','\u{1F4AC} Contact Us'], 200);
      }, 200);
    }
  }

  function close() {
    isOpen = false;
    el('chat-window').classList.remove('open');
    el('chat-launcher').classList.remove('open');
  }

  function toggle() { isOpen ? close() : open(); }

  // \u2500\u2500 Init \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  async function init() {
    // Load products from the API (same endpoint used by the main site)
    // Wire up events immediately so the UI is responsive
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

    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          products = data.map(p => ({ ...p, desc: p.description }));
        }
      }
    } catch { /* use empty */ }
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

// \u2500\u2500 Global helper: add to cart from chatbot card \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function chatAddToCart(productId) {
  if (typeof addToCart === 'function') {
    addToCart(productId);
    // Visual feedback on the button
    const btn = document.activeElement;
    if (btn && btn.classList.contains('chat-add-btn')) {
      btn.textContent = '\u2713 Added';
      btn.style.background = '#2d6a4f';
      setTimeout(() => { btn.textContent = '+ Add'; btn.style.background = ''; }, 1500);
    }
  }
}

// \u2500\u2500 Boot \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
document.addEventListener('DOMContentLoaded', () => ChatBot.init());
