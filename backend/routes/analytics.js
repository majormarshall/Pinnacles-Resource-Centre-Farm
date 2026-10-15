const express = require('express');
const router = express.Router();
const supabase = require('../db');
const { requireAuth } = require('../middleware/auth');

// GET /api/analytics/customers — aggregates customer data from orders
// Returns: customer_name, customer_phone, order_count, total_spend, last_order_date, favourite_product
router.get('/customers', requireAuth, async (req, res) => {
  try {
    const { data: orders, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);

    const customerMap = {};

    (orders || []).forEach(o => {
      const name = (o.customer_name || 'Walk-in Customer').trim();
      const phone = (o.customer_phone || '').trim();
      const key = phone || name.toLowerCase();

      if (!customerMap[key]) {
        customerMap[key] = {
          customer_name: name,
          customer_phone: phone,
          order_count: 0,
          total_spend: 0,
          last_order_date: o.created_at,
          product_counts: {},
          favourite_product: 'N/A'
        };
      }

      const c = customerMap[key];
      if (name && (!c.customer_name || c.customer_name === 'Walk-in Customer')) {
        c.customer_name = name;
      }
      if (phone && !c.customer_phone) {
        c.customer_phone = phone;
      }

      c.order_count += 1;
      c.total_spend += Number(o.total || 0);

      if (new Date(o.created_at) > new Date(c.last_order_date)) {
        c.last_order_date = o.created_at;
      }

      let items = [];
      try {
        items = typeof o.items_json === 'string' ? JSON.parse(o.items_json || '[]') : (o.items_json || []);
      } catch (_) {}

      items.forEach(it => {
        const pName = it.name || 'Product';
        const qty = Number(it.qty || 1);
        c.product_counts[pName] = (c.product_counts[pName] || 0) + qty;
      });
    });

    const customers = Object.values(customerMap).map(c => {
      let fav = 'N/A';
      let maxQty = 0;
      for (const [prodName, qty] of Object.entries(c.product_counts)) {
        if (qty > maxQty) {
          maxQty = qty;
          fav = prodName;
        }
      }
      return {
        customer_name: c.customer_name,
        customer_phone: c.customer_phone,
        order_count: c.order_count,
        total_spend: c.total_spend,
        last_order_date: c.last_order_date,
        favourite_product: fav
      };
    });

    customers.sort((a, b) => b.total_spend - a.total_spend);
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/bestsellers — top products by order count/revenue
router.get('/bestsellers', async (req, res) => {
  try {
    const { data: orders, error } = await supabase.from('orders').select('*');
    if (error) throw new Error(error.message);

    const productMap = {};

    (orders || []).forEach(o => {
      let items = [];
      try {
        items = typeof o.items_json === 'string' ? JSON.parse(o.items_json || '[]') : (o.items_json || []);
      } catch (_) {}

      items.forEach(it => {
        const name = it.name || 'Unknown Product';
        if (!productMap[name]) {
          productMap[name] = {
            name,
            emoji: it.emoji || '🌿',
            qty: 0,
            revenue: 0,
            order_count: 0
          };
        }
        const qty = Number(it.qty || 1);
        const price = Number(it.price || 0);
        productMap[name].qty += qty;
        productMap[name].revenue += price * qty;
        productMap[name].order_count += 1;
      });
    });

    const bestsellers = Object.values(productMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    res.json(bestsellers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/peak-hours — orders grouped by hour of day (0-23)
router.get('/peak-hours', async (req, res) => {
  try {
    const { data: orders, error } = await supabase.from('orders').select('created_at');
    if (error) throw new Error(error.message);

    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));

    (orders || []).forEach(o => {
      if (!o.created_at) return;
      const d = new Date(o.created_at);
      const watHour = (d.getUTCHours() + 1) % 24; // West Africa Time (UTC+1)
      hours[watHour].count += 1;
    });

    res.json(hours);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/summary — overall stats
router.get('/summary', async (req, res) => {
  try {
    const { data: orders, error } = await supabase.from('orders').select('*');
    if (error) throw new Error(error.message);

    const totalOrders = (orders || []).length;
    const totalRevenue = (orders || []).reduce((s, o) => s + Number(o.total || 0), 0);
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    const phones = new Set();
    const repeatPhones = new Set();
    (orders || []).forEach(o => {
      const ph = (o.customer_phone || '').trim();
      if (ph) {
        if (phones.has(ph)) repeatPhones.add(ph);
        phones.add(ph);
      }
    });

    res.json({
      total_orders: totalOrders,
      total_revenue: totalRevenue,
      avg_order_value: avgOrderValue,
      total_customers: phones.size,
      repeat_customers: repeatPhones.size
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
