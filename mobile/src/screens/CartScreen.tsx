// ── CartScreen ────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Image, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOW } from '../theme/tokens';
import { useCart } from '../context/CartContext';
import { placeOrder } from '../services/api';

const FARM_WHATSAPP = '2348012345678'; // ← Update with real number

export default function CartScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { state: cart, dispatch } = useCart();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [placing, setPlacing] = useState(false);

  const buildWhatsappMsg = (orderId: number) => {
    const lines = cart.items.map(i => `  • ${i.emoji || '🌿'} ${i.name} x${i.qty} = ₦${(i.price * i.qty).toLocaleString()}`).join('\n');
    return `Hello Pinnacles Farm! 🌿\n\nNew Order #${orderId}\n\n${lines}\n\n*Total: ₦${cart.total.toLocaleString()}*\n\nName: ${name}\nPhone: ${phone}\nAddress: ${address}${notes ? `\nNotes: ${notes}` : ''}`;
  };

  const handlePlaceOrder = async () => {
    if (!name.trim()) return Alert.alert('Name required', 'Please enter your full name.');
    if (!phone.trim()) return Alert.alert('Phone required', 'Please enter your phone number.');
    if (cart.items.length === 0) return Alert.alert('Empty cart', 'Please add items to your cart first.');

    setPlacing(true);
    try {
      const res = await placeOrder({
        customer_name: name,
        customer_phone: phone,
        items: cart.items.map(i => ({ id: i.id, name: i.name, emoji: i.emoji, price: i.price, qty: i.qty })),
        total: cart.total,
        notes,
      });

      const orderId = res.data.id;
      const msg = buildWhatsappMsg(orderId);
      const url = `https://wa.me/${FARM_WHATSAPP}?text=${encodeURIComponent(msg)}`;

      dispatch({ type: 'CLEAR' });

      Alert.alert(
        '✅ Order Placed!',
        `Order #${orderId} received! We'll confirm via WhatsApp shortly.\n\nTap OK to open WhatsApp and complete your order.`,
        [
          { text: 'Skip', style: 'cancel', onPress: () => navigation.navigate('Home') },
          { text: 'Open WhatsApp', onPress: () => { Linking.openURL(url); navigation.navigate('Home'); } },
        ]
      );
    } catch (e: any) {
      Alert.alert('Order Failed', e?.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  if (cart.items.length === 0) {
    return (
      <View style={[styles.emptyContainer, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.emptyIcon}>🛒</Text>
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptySub}>Add some fresh produce from our farm!</Text>
        <TouchableOpacity style={styles.shopBtn} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.shopBtnText}>Start Shopping</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 200 }}>
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.headerTitle}>🛒 Your Cart</Text>
          <Text style={styles.headerSub}>{cart.count} item{cart.count !== 1 ? 's' : ''}</Text>
        </View>

        {/* ── Items ── */}
        <View style={styles.section}>
          {cart.items.map((item) => (
            <View key={item.id} style={styles.cartItem}>
              <View style={styles.cartItemImg}>
                {item.img ? (
                  <Image source={{ uri: item.img }} style={{ width: 60, height: 60, borderRadius: 10 }} />
                ) : (
                  <Text style={{ fontSize: 32 }}>{item.emoji || '🌿'}</Text>
                )}
              </View>
              <View style={styles.cartItemInfo}>
                <Text style={styles.cartItemName} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.cartItemPrice}>₦{item.price.toLocaleString()} / {item.unit}</Text>
                <View style={styles.qtyRow}>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => dispatch({ type: 'DECREMENT', id: item.id })}>
                    <Ionicons name="remove" size={16} color={COLORS.primary} />
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{item.qty}</Text>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => dispatch({ type: 'INCREMENT', id: item.id })}>
                    <Ionicons name="add" size={16} color={COLORS.primary} />
                  </TouchableOpacity>
                  <Text style={styles.itemTotal}>₦{(item.price * item.qty).toLocaleString()}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => dispatch({ type: 'REMOVE', id: item.id })} style={styles.removeBtn}>
                <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* ── Order Summary ── */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Order Summary</Text>
          {cart.items.map(i => (
            <View key={i.id} style={styles.summaryRow}>
              <Text style={styles.summaryItem}>{i.emoji} {i.name} x{i.qty}</Text>
              <Text style={styles.summaryAmt}>₦{(i.price * i.qty).toLocaleString()}</Text>
            </View>
          ))}
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryTotal}>Total</Text>
            <Text style={styles.summaryTotalAmt}>₦{cart.total.toLocaleString()}</Text>
          </View>
        </View>

        {/* ── Customer Details ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Your Details</Text>
          {[
            { label: 'Full Name *', value: name, setter: setName, placeholder: 'e.g. John Doe', icon: 'person-outline' },
            { label: 'Phone Number *', value: phone, setter: setPhone, placeholder: 'e.g. 08012345678', icon: 'call-outline', keyboard: 'phone-pad' },
            { label: 'Delivery Address', value: address, setter: setAddress, placeholder: 'Street, Town, State', icon: 'location-outline' },
            { label: 'Additional Notes', value: notes, setter: setNotes, placeholder: 'Delivery instructions...', icon: 'document-text-outline' },
          ].map((f, i) => (
            <View key={i} style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{f.label}</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name={f.icon as any} size={18} color={COLORS.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={f.value}
                  onChangeText={f.setter}
                  placeholder={f.placeholder}
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType={(f.keyboard as any) || 'default'}
                />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* ── Sticky Place Order ── */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.totalPreview}>
          <Text style={styles.totalPreviewLabel}>Total</Text>
          <Text style={styles.totalPreviewAmt}>₦{cart.total.toLocaleString()}</Text>
        </View>
        <TouchableOpacity
          style={[styles.placeBtn, placing && { opacity: 0.7 }]}
          onPress={handlePlaceOrder}
          disabled={placing}
        >
          {placing ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.white} />
              <Text style={styles.placeBtnText}>Place Order</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.offWhite },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: COLORS.offWhite },
  emptyIcon: { fontSize: 72 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textDark },
  emptySub: { fontSize: 14, color: COLORS.textLight },
  shopBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingHorizontal: 28, paddingVertical: 12, marginTop: 8 },
  shopBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },

  header: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { color: COLORS.white, fontSize: 24, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 },

  section: { margin: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textDark, marginBottom: 12 },

  cartItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg, padding: 12, marginBottom: 10, gap: 12, ...SHADOW.sm,
  },
  cartItemImg: { width: 60, height: 60, borderRadius: 10, backgroundColor: COLORS.offWhite, justifyContent: 'center', alignItems: 'center' },
  cartItemInfo: { flex: 1, gap: 4 },
  cartItemName: { fontSize: 14, fontWeight: '700', color: COLORS.textDark },
  cartItemPrice: { fontSize: 12, color: COLORS.textLight },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.border,
    justifyContent: 'center', alignItems: 'center',
  },
  qtyText: { fontSize: 14, fontWeight: '700', color: COLORS.textDark, minWidth: 20, textAlign: 'center' },
  itemTotal: { fontSize: 13, fontWeight: '700', color: COLORS.primary, marginLeft: 'auto' },
  removeBtn: { padding: 8 },

  summaryCard: {
    margin: 16, marginTop: 0, backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg, padding: 16, ...SHADOW.sm,
  },
  summaryTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textDark, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryItem: { fontSize: 13, color: COLORS.textMid, flex: 1 },
  summaryAmt: { fontSize: 13, fontWeight: '600', color: COLORS.textDark },
  summaryDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 10 },
  summaryTotal: { fontSize: 15, fontWeight: '800', color: COLORS.textDark },
  summaryTotalAmt: { fontSize: 18, fontWeight: '900', color: COLORS.primary },

  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textMid, marginBottom: 6 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.border, ...SHADOW.sm,
  },
  inputIcon: { paddingLeft: 14 },
  input: { flex: 1, paddingVertical: 13, paddingHorizontal: 12, fontSize: 14, color: COLORS.textDark },

  actionBar: {
    flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    backgroundColor: COLORS.white, ...SHADOW.lg,
  },
  totalPreview: { justifyContent: 'center' },
  totalPreviewLabel: { fontSize: 11, color: COLORS.textLight },
  totalPreviewAmt: { fontSize: 20, fontWeight: '900', color: COLORS.primary },
  placeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingVertical: 15, gap: 8,
  },
  placeBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
});
