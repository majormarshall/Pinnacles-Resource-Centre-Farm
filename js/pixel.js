// js/pixel.js
// ═════════════════════════════════════════════════════════════════
// Multi-Pixel Tracking Engine: Meta (Facebook), TikTok, Google (GA4)
// Automatically initializes configured pixels and fires e-commerce events:
// PageView, ViewContent, AddToCart, InitiateCheckout, Purchase
// ═════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  var PixelEngine = {
    config: {
      meta_pixel_id: '',
      tiktok_pixel_id: '',
      google_tag_id: ''
    },

    init: async function () {
      try {
        var res = await fetch('/api/settings/pixels');
        if (res.ok) {
          var data = await res.json();
          if (data) {
            this.config.meta_pixel_id = (data.meta_pixel_id || '').trim();
            this.config.tiktok_pixel_id = (data.tiktok_pixel_id || '').trim();
            this.config.google_tag_id = (data.google_tag_id || '').trim();
          }
        }
      } catch (e) {
        // Fallback to empty if endpoint not reachable
      }

      this.initMeta();
      this.initTikTok();
      this.initGoogle();

      this.trackPageView();
    },

    // ── Meta / Facebook Pixel ────────────────────────────────────
    initMeta: function () {
      var id = this.config.meta_pixel_id;
      if (!id) return;

      if (!window.fbq) {
        /* eslint-disable */
        (function (f, b, e, v, n, t, s) {
          if (f.fbq) return;
          n = f.fbq = function () {
            n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
          };
          if (!f._fbq) f._fbq = n;
          n.push = n;
          n.loaded = !0;
          n.version = '2.0';
          n.queue = [];
          t = b.createElement(e);
          t.async = !0;
          t.src = v;
          s = b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t, s);
        })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
        /* eslint-enable */
      }
      try {
        window.fbq('init', id);
      } catch (_) {}
    },

    // ── TikTok Pixel ─────────────────────────────────────────────
    initTikTok: function () {
      var id = this.config.tiktok_pixel_id;
      if (!id) return;

      if (!window.ttq) {
        /* eslint-disable */
        (function (w, d, t) {
          w.TiktokAnalyticsObject = t;
          var ttq = (w[t] = w[t] || []);
          ttq.methods = [
            'page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias',
            'group', 'enableCookie', 'disableCookie', 'holdConsent', 'revokeConsent', 'grantConsent'
          ];
          ttq.setAndDefer = function (t, e) {
            t[e] = function () {
              t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
            };
          };
          for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
          ttq.instance = function (t) {
            for (var e = ttq._i[t] || [], n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]);
            return e;
          };
          ttq.load = function (e, n) {
            var r = 'https://analytics.tiktok.com/i18n/pixel/events.js',
              o = n && n.partner;
            ttq._i = ttq._i || {};
            ttq._i[e] = [];
            ttq._i[e]._u = r;
            ttq._t = ttq._t || {};
            ttq._t[e] = +new Date();
            ttq._o = ttq._o || {};
            ttq._o[e] = n || {};
            n = document.createElement('script');
            n.type = 'text/javascript';
            n.async = !0;
            n.src = r + '?sdkid=' + e + '&lib=' + t;
            e = document.getElementsByTagName('script')[0];
            e.parentNode.insertBefore(n, e);
          };
        })(window, document, 'ttq');
        /* eslint-enable */
      }
      try {
        window.ttq.load(id);
        window.ttq.page();
      } catch (_) {}
    },

    // ── Google Analytics 4 (Google Tag) ──────────────────────────
    initGoogle: function () {
      var id = this.config.google_tag_id;
      if (!id) return;

      if (!window.dataLayer) window.dataLayer = [];
      function gtag() { window.dataLayer.push(arguments); }
      window.gtag = window.gtag || gtag;

      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
      document.head.appendChild(s);

      gtag('js', new Date());
      gtag('config', id, { send_page_view: false });
    },

    // ── E-Commerce Event Dispatchers ─────────────────────────────
    trackPageView: function () {
      if (window.fbq && this.config.meta_pixel_id) {
        window.fbq('track', 'PageView');
      }
      if (window.ttq && this.config.tiktok_pixel_id) {
        window.ttq.page();
      }
      if (window.gtag && this.config.google_tag_id) {
        window.gtag('event', 'page_view', { page_title: document.title, page_location: window.location.href });
      }
    },

    trackViewContent: function (product) {
      if (!product) return;
      var price = Number(product.price || 0);

      if (window.fbq && this.config.meta_pixel_id) {
        window.fbq('track', 'ViewContent', {
          content_name: product.name,
          content_ids: [String(product.id)],
          content_type: 'product',
          value: price,
          currency: 'NGN'
        });
      }
      if (window.ttq && this.config.tiktok_pixel_id) {
        window.ttq.track('ViewContent', {
          content_id: String(product.id),
          content_name: product.name,
          content_type: 'product',
          value: price,
          currency: 'NGN'
        });
      }
      if (window.gtag && this.config.google_tag_id) {
        window.gtag('event', 'view_item', {
          currency: 'NGN',
          value: price,
          items: [{ item_id: String(product.id), item_name: product.name, price: price }]
        });
      }
    },

    trackAddToCart: function (product, qty) {
      if (!product) return;
      qty = qty || 1;
      var price = Number(product.price || 0);
      var value = price * qty;

      if (window.fbq && this.config.meta_pixel_id) {
        window.fbq('track', 'AddToCart', {
          content_name: product.name,
          content_ids: [String(product.id)],
          content_type: 'product',
          value: value,
          currency: 'NGN'
        });
      }
      if (window.ttq && this.config.tiktok_pixel_id) {
        window.ttq.track('AddToCart', {
          content_id: String(product.id),
          content_name: product.name,
          content_type: 'product',
          quantity: qty,
          value: value,
          currency: 'NGN'
        });
      }
      if (window.gtag && this.config.google_tag_id) {
        window.gtag('event', 'add_to_cart', {
          currency: 'NGN',
          value: value,
          items: [{ item_id: String(product.id), item_name: product.name, price: price, quantity: qty }]
        });
      }
    },

    trackInitiateCheckout: function (items, total) {
      items = items || [];
      total = Number(total || 0);

      if (window.fbq && this.config.meta_pixel_id) {
        window.fbq('track', 'InitiateCheckout', {
          num_items: items.length,
          value: total,
          currency: 'NGN'
        });
      }
      if (window.ttq && this.config.tiktok_pixel_id) {
        window.ttq.track('InitiateCheckout', {
          value: total,
          currency: 'NGN',
          contents: items.map(function(i) {
            return { content_id: String(i.id), content_name: i.name, quantity: i.qty, price: i.price };
          })
        });
      }
      if (window.gtag && this.config.google_tag_id) {
        window.gtag('event', 'begin_checkout', {
          currency: 'NGN',
          value: total,
          items: items.map(function(i) {
            return { item_id: String(i.id), item_name: i.name, price: i.price, quantity: i.qty };
          })
        });
      }
    },

    trackPurchase: function (orderData) {
      if (!orderData) return;
      var total = Number(orderData.total || 0);
      var items = orderData.items || [];

      if (window.fbq && this.config.meta_pixel_id) {
        window.fbq('track', 'Purchase', {
          value: total,
          currency: 'NGN',
          content_type: 'product',
          content_ids: items.map(function(i){ return String(i.id); })
        });
      }
      if (window.ttq && this.config.tiktok_pixel_id) {
        window.ttq.track('CompletePayment', {
          value: total,
          currency: 'NGN',
          contents: items.map(function(i) {
            return { content_id: String(i.id), content_name: i.name, quantity: i.qty, price: i.price };
          })
        });
      }
      if (window.gtag && this.config.google_tag_id) {
        window.gtag('event', 'purchase', {
          transaction_id: String(orderData.id || Date.now()),
          value: total,
          currency: 'NGN',
          items: items.map(function(i) {
            return { item_id: String(i.id), item_name: i.name, price: i.price, quantity: i.qty };
          })
        });
      }
    }
  };

  window.PixelEngine = PixelEngine;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { PixelEngine.init(); });
  } else {
    PixelEngine.init();
  }
})();
