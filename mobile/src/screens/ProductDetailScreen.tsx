// ── ProductDetailScreen ───────────────────────────────────────────────────
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  Animated, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOW } from '../theme/tokens';
import { useCart } from '../context/CartContext';

const { width } = Dimensions.get('window');

export default function ProductDetailScreen({ route, navigation }: any) {
  const { product } = route.params;
  const insets = useSafeAreaInsets();
  const { state: cart, dispatch } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const cartItem = cart.items.find(i => i.id === product.id);

  const handleAddToCart = () => {
    for (let i = 0; i < qty; i++) dispatch({ type: 'ADD', item: product });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Image ── */}
        <View style={styles.imageContainer}>
          {product.img ? (
            <Image source={{ uri: product.img }} style={styles.image} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={{ fontSize: 80 }}>{product.emoji || '🌿'}</Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.backBtn, { top: insets.top + 12 }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.textDark} />
          </TouchableOpacity>
          {product.tag && (
            <View style={styles.tagBadge}>
              <Text style={styles.tagText}>{product.tag}</Text>
            </View>
          )}
        </View>

        {/* ── Info ── */}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.emoji}>{product.emoji || '🌿'}</Text>
            <Text style={styles.name}>{product.name}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.price}>₦{Number(product.price).toLocaleString()}</Text>
            <Text style={styles.unit}>/ {product.unit}</Text>
          </View>

          {product.description ? (
            <View style={styles.descBox}>
              <Text style={styles.descLabel}>📋 About this product</Text>
              <Text style={styles.desc}>{product.description}</Text>
            </View>
          ) : null}

          {/* ── Details grid ── */}
          <View style={styles.detailsGrid}>
            {[
              { label: 'Category', value: product.category || 'General', icon: 'grid-outline' },
              { label: 'Stock', value: product.stock > 100 ? 'Available' : `${product.stock} left`, icon: 'cube-outline' },
              { label: 'Unit', value: product.unit, icon: 'scale-outline' },
              { label: 'Quality', value: 'Farm Fresh', icon: 'leaf-outline' },
            ].map((d, i) => (
              <View key={i} style={styles.detailCard}>
                <Ionicons name={d.icon as any} size={20} color={COLORS.primary} />
                <Text style={styles.detailValue}>{d.value}</Text>
                <Text style={styles.detailLabel}>{d.label}</Text>
              </View>
            ))}
          </View>

          {/* ── Cart status ── */}
          {cartItem && (
            <View style={styles.cartStatus}>
              <Ionicons name="cart" size={16} color={COLORS.primary} />
              <Text style={styles.cartStatusText}>
                {cartItem.qty} already in cart (₦{(cartItem.qty * cartItem.price).toLocaleString()})
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Bottom Action Bar ── */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 12 }]}>
        {/* Qty selector */}
        <View style={styles.qtyControl}>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => setQty(q => Math.max(1, q - 1))}>
            <Ionicons name="remove" size={20} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.qtyText}>{qty}</Text>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => setQty(q => q + 1)}>
            <Ionicons name="add" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Add to cart */}
        <TouchableOpacity style={[styles.addBtn, added && styles.addBtnSuccess]} onPress={handleAddToCart}>
          <Ionicons name={added ? 'checkmark' : 'cart-outline'} size={20} color={COLORS.white} />
          <Text style={styles.addBtnText}>
            {added ? 'Added!' : `Add ${qty} — ₦${(product.price * qty).toLocaleString()}`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },

  imageContainer: { width: '100%', height: 300, position: 'relative' },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  imagePlaceholder: {
    width: '100%', height: '100%', backgroundColor: COLORS.offWhite,
    justifyContent: 'center', alignItems: 'center',
  },
  backBtn: {
    position: 'absolute', left: 16, width: 42, height: 42,
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 21,
    justifyContent: 'center', alignItems: 'center', ...SHADOW.sm,
  },
  tagBadge: {
    position: 'absolute', top: 16, right: 16,
    backgroundColor: COLORS.gold, borderRadius: RADIUS.full,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  tagText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },

  info: { padding: 20 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  emoji: { fontSize: 28 },
  name: { flex: 1, fontSize: 24, fontWeight: '800', color: COLORS.textDark },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 20 },
  price: { fontSize: 32, fontWeight: '900', color: COLORS.primary },
  unit: { fontSize: 14, color: COLORS.textLight },

  descBox: {
    backgroundColor: COLORS.offWhite, borderRadius: RADIUS.md,
    padding: 16, marginBottom: 20, gap: 8,
  },
  descLabel: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  desc: { fontSize: 14, color: COLORS.textMid, lineHeight: 22 },

  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  detailCard: {
    flex: 1, minWidth: (width - 56) / 2,
    backgroundColor: COLORS.offWhite, borderRadius: RADIUS.md, padding: 14,
    alignItems: 'center', gap: 4,
  },
  detailValue: { fontSize: 14, fontWeight: '700', color: COLORS.textDark },
  detailLabel: { fontSize: 11, color: COLORS.textLight },

  cartStatus: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#e8f5e9', borderRadius: RADIUS.md, padding: 12,
  },
  cartStatusText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },

  actionBar: {
    flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    backgroundColor: COLORS.white, ...SHADOW.md,
  },
  qtyControl: {
    flexDirection: 'row', alignItems: 'center', gap: 0,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  qtyBtn: { paddingHorizontal: 14, paddingVertical: 10 },
  qtyText: { fontSize: 16, fontWeight: '700', color: COLORS.textDark, minWidth: 28, textAlign: 'center' },

  addBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingVertical: 14, gap: 8,
  },
  addBtnSuccess: { backgroundColor: COLORS.success },
  addBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
});
