// backend/routes/harvest_ai.js — Harvest AI endpoint
// Inventory-aware assistant that builds carts, suggests baskets, answers questions
const express  = require('express');
const router   = express.Router();
const supabase = require('../db');

// POINTS SYSTEM CONFIG
const POINTS_PER_NGN = 1 / 100; // 1 point per ₦100 spent
const NGN_PER_POINT  = 0.5;     // Each point worth ₦0.50 on redemption

// GET /api/harvest-ai/inventory — return live inventory summary for AI context
router.get('/inventory', async (req, res) => {
  try {
    const { data: products } = await supabase.from('products')
      .select('id, name, emoji, price, unit, in_stock, category, preorder_available, preorder_expected_date, preorder_note')
      .neq('active', false).order('name');
    const { data: todayHarvest } = await supabase.from('products')
      .select('id, name, emoji').eq('today_harvest', 1).neq('in_stock', false);

    const normalised = (products || []).map(p => ({
      id:    p.id,
      name:  p.name,
      emoji: p.emoji,
      price: Number(p.price || 0),
      unit:  p.unit,
      in_stock: (p.in_stock === true || p.in_stock === 1 || Number(p.in_stock) > 0) ? true : false,
      category: p.category,
      preorder_available: (p.preorder_available === true || p.preorder_available === 1) ? true : false,
      preorder_expected_date: p.preorder_expected_date,
      preorder_note: p.preorder_note,
    }));

    res.json({
      products: normalised,
      harvested_today: todayHarvest || [],
      timestamp: new Date().toISOString(),
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/harvest-ai/chat — main AI endpoint
// Body: { message: string, cart: [{id, name, qty, price}], customer_id?: number }
router.post('/chat', async (req, res) => {
  const { message = '', cart = [], customer_id } = req.body;
  const msgLower = message.toLowerCase().trim();

  try {
    // Load live inventory
    const { data: products } = await supabase.from('products')
      .select('id, name, emoji, price, unit, in_stock, category, description, preorder_available, preorder_expected_date, preorder_note')
      .neq('active', false);
    const normalised = (products || []).map(p => ({
      ...p,
      price:    Number(p.price || 0),
      in_stock: (p.in_stock === true || p.in_stock === 1 || Number(p.in_stock) > 0),
      preorder_available: (p.preorder_available === true || p.preorder_available === 1),
    }));

    const inStock  = normalised.filter(p => p.in_stock);
    const preorder = normalised.filter(p => !p.in_stock && p.preorder_available);

    // Load customer loyalty points if logged in
    let loyaltyPoints = 0;
    if (customer_id) {
      const { data: c } = await supabase.from('customers').select('loyalty_points').eq('id', customer_id).single();
      loyaltyPoints = Number(c?.loyalty_points || 0);
    }

    // Cart total
    const cartTotal = cart.reduce((s, i) => s + (Number(i.price || 0) * Number(i.qty || 1)), 0);
    const cartItems = cart.map(i => `${i.emoji || ''} ${i.name} x${i.qty}`).join(', ');

    // ── INTENT DETECTION ───────────────────────────────────────────────
    let reply   = '';
    let actions = []; // { type: 'add_to_cart'|'suggest_basket'|'preorder', ... }

    // 1. Greet
    if (/^(hi|hello|hey|good|howdy|yo)\b/.test(msgLower)) {
      const todayList = inStock.slice(0, 4).map(p => `${p.emoji} **${p.name}** — ₦${p.price.toLocaleString('en-NG')} ${p.unit}`).join('\n');
      reply = `Hello! 👋 Welcome to **Pinnacles Farm**!\n\nHere's what's available fresh today:\n\n${todayList}\n\n${inStock.length > 4 ? `...and ${inStock.length - 4} more items.` : ''}\n\nYou can ask me to **build a basket**, check **prices**, or **add items to your cart**. What would you like? 🛒`;
    }

    // 2. What's available / in stock
    else if (/what.*(have|available|in stock|sell|got)|show.*products|list.*products/.test(msgLower)) {
      const list = inStock.map(p => `${p.emoji} **${p.name}** — ₦${p.price.toLocaleString('en-NG')} ${p.unit}`).join('\n');
      reply = `🌿 **Available right now:**\n\n${list || 'No products in stock right now — check back soon!'}`;
      if (preorder.length) reply += `\n\n⏳ **Coming soon (pre-order):** ${preorder.map(p => p.name).join(', ')}`;
    }

    // 3. Price check
    else if (/price|cost|how much|₦/.test(msgLower)) {
      const matchedProduct = normalised.find(p => msgLower.includes(p.name.toLowerCase().split(' ')[0]));
      if (matchedProduct) {
        reply = `${matchedProduct.emoji} **${matchedProduct.name}** costs **₦${matchedProduct.price.toLocaleString('en-NG')} ${matchedProduct.unit}**.\n\n`;
        reply += matchedProduct.in_stock
          ? `It's 🟢 **in stock** right now!\n\nWould you like me to add it to your cart?`
          : matchedProduct.preorder_available
            ? `It's not in stock yet, but you can **pre-order** it! Expected: ${matchedProduct.preorder_expected_date || 'soon'}.`
            : `Sorry, it's currently **out of stock**. I'll note your interest! 🤝`;
      } else {
        const allPrices = inStock.map(p => `${p.emoji} ${p.name}: ₦${p.price.toLocaleString('en-NG')} ${p.unit}`).join('\n');
        reply = `Here are all our current prices:\n\n${allPrices}`;
      }
    }

    // 4. Build me a basket / weekly shop / family basket
    else if (/basket|weekly|family|bundle|box|suggest|recommend/.test(msgLower)) {
      const size   = /small/.test(msgLower) ? 'small' : /large|big/.test(msgLower) ? 'large' : 'medium';
      const budget = msgLower.match(/(\d[\d,]+)/)?.[1]?.replace(',', '') || null;

      let suggested = [];
      if (inStock.length > 0) {
        // Build balanced basket: mix of veg, protein, fruit
        const vegs  = inStock.filter(p => ['vegetable','vegetables'].includes(p.category)).slice(0, 3);
        const prots = inStock.filter(p => ['protein','proteins','poultry'].includes(p.category)).slice(0, 2);
        const fruits= inStock.filter(p => ['fruit','fruits'].includes(p.category)).slice(0, 2);
        suggested   = [...vegs, ...prots, ...fruits];
        if (suggested.length === 0) suggested = inStock.slice(0, 5);
      }

      const basketTotal = suggested.reduce((s, p) => s + p.price, 0);
      const basketList  = suggested.map(p => `${p.emoji} **${p.name}** — ₦${p.price.toLocaleString('en-NG')} ${p.unit}`).join('\n');

      reply = `🧺 **I've built you a fresh basket:**\n\n${basketList}\n\n**Total: ₦${basketTotal.toLocaleString('en-NG')}**\n\nShall I add these to your cart? Just say **"yes, add all"**! 🛒`;
      actions = suggested.map(p => ({ type: 'suggest_add', id: p.id, name: p.name, emoji: p.emoji, price: p.price, unit: p.unit }));
    }

    // 5. "Add [item] to cart" / "I want [item]"
    else if (/add|want|order|buy|get me/.test(msgLower)) {
      const matched = normalised.filter(p => msgLower.includes(p.name.toLowerCase().split(' ')[0]));
      if (matched.length > 0) {
        const item = matched[0];
        const qtyMatch = msgLower.match(/(\d+)/);
        const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1;
        if (item.in_stock) {
          reply = `✅ Added **${qty}× ${item.emoji} ${item.name}** (₦${(item.price * qty).toLocaleString('en-NG')}) to your cart!`;
          actions = [{ type: 'add_to_cart', id: item.id, name: item.name, emoji: item.emoji, price: item.price, unit: item.unit, qty }];
        } else if (item.preorder_available) {
          reply = `⏳ **${item.name}** isn't available yet but you can **pre-order** it!\nExpected: ${item.preorder_expected_date || 'soon'}.\n\nWould you like to place a pre-order?`;
          actions = [{ type: 'preorder', id: item.id, name: item.name }];
        } else {
          reply = `😔 Sorry, **${item.name}** is out of stock right now.\n\nI can notify you when it's back — just share your WhatsApp number! Would you like to see what else is available?`;
        }
      } else {
        reply = `I'm not sure which product you mean. Here's what we have:\n\n${inStock.map(p => `${p.emoji} ${p.name}`).join(' · ')}\n\nWhich one would you like?`;
      }
    }

    // 6. Cart summary / checkout
    else if (/cart|checkout|total|pay/.test(msgLower)) {
      if (cart.length === 0) {
        reply = `Your cart is empty! 🛒\n\nTry asking me to **"build a basket"** or **"add tomatoes"** to get started.`;
      } else {
        reply = `🛒 **Your cart (${cart.length} items):**\n\n${cartItems}\n\n**Total: ₦${cartTotal.toLocaleString('en-NG')}**`;
        if (customer_id && loyaltyPoints >= 100) {
          const discount = Math.min(loyaltyPoints, 1000) * NGN_PER_POINT;
          reply += `\n\n💎 You have **${loyaltyPoints} loyalty points** worth ₦${discount.toLocaleString('en-NG')}. Would you like to use them?`;
        }
        reply += `\n\nReady to checkout? Click **"Place Order"** in your cart!`;
      }
    }

    // 7. Loyalty / points
    else if (/point|loyalt|reward|earn|redeem/.test(msgLower)) {
      reply = `💎 **Pinnacles Loyalty Programme**\n\n`;
      reply += `• Earn **1 point** for every ₦100 spent\n`;
      reply += `• Each point is worth **₦0.50** off your next order\n`;
      reply += `• 100 points minimum to redeem\n\n`;
      if (customer_id && loyaltyPoints > 0) {
        reply += `You currently have **${loyaltyPoints} points** = ₦${(loyaltyPoints * NGN_PER_POINT).toLocaleString('en-NG')} value! 🎉`;
      } else if (!customer_id) {
        reply += `**Create an account** to start earning points on every order! 👆`;
      } else {
        reply += `You'll earn points with your next order!`;
      }
    }

    // 8. Pre-order / coming soon
    else if (/pre.?order|coming soon|when.*available|reserve/.test(msgLower)) {
      const preList = preorder.map(p => `${p.emoji} **${p.name}** — Expected: ${p.preorder_expected_date || 'soon'}\n  ${p.preorder_note || ''}`).join('\n\n');
      if (preorder.length > 0) {
        reply = `⏳ **Available for Pre-order:**\n\n${preList}\n\nTo pre-order, just say **"pre-order [product name]"** and I'll take your details!`;
      } else {
        reply = `No pre-orders available right now. All products are in stock! 🌿\n\nWould you like to see what's available?`;
      }
    }

    // 9. Delivery
    else if (/deliver|ship|location|where|offa/.test(msgLower)) {
      reply = `🚚 **Delivery Info:**\n\n📍 **Offa Town** — Same-day delivery available\n📦 **Nearby areas** (Ajase-Ipo, Igbaja, Ilorin) — Fee confirmed on WhatsApp\n🌍 **Nationwide** — Via courier on request\n🌾 **Farm Pickup** — Free! Visit us in Offa\n\nShare your location at checkout and we'll confirm the fee via WhatsApp.`;
    }

    // 10. Fallback
    else {
      const randomPick = inStock[Math.floor(Math.random() * inStock.length)];
      reply = `I didn't quite catch that 😊 I'm here to help you shop for fresh farm produce!\n\nYou can ask me to:\n• **"What's available?"** — see all products\n• **"Build me a basket"** — I'll suggest a fresh mix\n• **"Add tomatoes to cart"** — I'll add items directly\n• **"What are your prices?"** — see the price list\n\n${randomPick ? `💡 Today's pick: ${randomPick.emoji} **${randomPick.name}** — ₦${randomPick.price.toLocaleString('en-NG')} ${randomPick.unit}` : ''}`;
    }

    res.json({ reply, actions, timestamp: new Date().toISOString() });

  } catch(e) {
    console.error('Harvest AI error:', e.message);
    res.json({ reply: "Sorry, I'm having a moment! 🌱 Please try again or contact us on WhatsApp.", actions: [] });
  }
});

module.exports = router;
