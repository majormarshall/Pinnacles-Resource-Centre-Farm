// ── HomeScreen ───────────────────────────────────────────────────────────
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Image, Animated, Dimensions, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOW } from '../theme/tokens';
import { getProducts } from '../services/api';
import { useCart } from '../context/CartContext';

const { width } = Dimensions.get('window');

const CATEGORIES = ['All', 'Vegetables', 'Fruits', 'Grains', 'Herbs', 'Livestock'];

export default function HomeScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { state: cart, dispatch } = useCart();
  const [products, setProducts] = useState<any[]>([]);
  const [featured, setFeatured] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [adminTaps, setAdminTaps] = useState(0);

  const handleAdminTap = () => {
    const next = adminTaps + 1;
    if (next >= 5) { navigation.navigate('AdminLogin'); setAdminTaps(0); }
    else setAdminTaps(next);
  };
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const load = async () => {
    try {
      const res = await getProducts();
      const data = res.data || [];
      setProducts(data);
      setFeatured(data.slice(0, 4));
    } catch (e) {
      console.error('Failed to load products', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const filtered = activeCategory === 'All'
    ? products
    : products.filter(p => p.category?.toLowerCase() === activeCategory.toLowerCase());

  const addToCart = (product: any) => {
    dispatch({ type: 'ADD', item: { ...product } });
  };

  if (loading) {
    return (
      <View style={styles.loadingCenter}>
        <Image
          source={require('../../assets/logo.png')}
          style={{ width: 80, height: 80, resizeMode: 'contain', marginBottom: 4 }}
        />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading fresh produce...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />}
    >
      {/* ── Hero ── */}
      <Animated.View style={[styles.hero, { paddingTop: insets.top + 16, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.heroHeader}>
          <View style={styles.heroLeft}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.heroLogo}
            />
            <View>
              <TouchableOpacity onPress={handleAdminTap} activeOpacity={1}>
                <Text style={styles.heroTitle}>Pinnacles Farm</Text>
              </TouchableOpacity>
              <Text style={styles.heroSub}>Fresh from the earth, straight to you</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.cartButton} onPress={() => navigation.navigate('Cart')}>
            <Ionicons name="cart-outline" size={26} color={COLORS.white} />
            {cart.count > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cart.count}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Stats ── */}
        <View style={styles.statsRow}>
          {[
            { label: 'Products', value: products.length, icon: 'leaf' },
            { label: 'Categories', value: 6, icon: 'grid' },
            { label: 'Fresh Daily', value: '✓', icon: 'checkmark-circle' },
          ].map((s, i) => (
            <View key={i} style={styles.statCard}>
              <Ionicons name={s.icon as any} size={20} color={COLORS.accentLight} />
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </Animated.View>

      {/* ── Featured ── */}
      {featured.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>⭐ Featured Products</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Shop')}>
              <Text style={styles.sectionLink}>See all</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
            {featured.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.featuredCard}
                onPress={() => navigation.navigate('ProductDetail', { product: p })}
                activeOpacity={0.85}
              >
                {p.img ? (
                  <Image source={{ uri: p.img }} style={styles.featuredImg} />
                ) : (
                  <View style={styles.featuredImgPlaceholder}>
                    <Text style={{ fontSize: 40 }}>{p.emoji || '🌿'}</Text>
                  </View>
                )}
                <View style={styles.featuredInfo}>
                  <Text style={styles.featuredName} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.featuredPrice}>₦{Number(p.price).toLocaleString()}</Text>
                  <Text style={styles.featuredUnit}>{p.unit}</Text>
                </View>
                <TouchableOpacity style={styles.featuredAdd} onPress={() => addToCart(p)}>
                  <Ionicons name="add" size={20} color={COLORS.white} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Categories ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🛒 Browse by Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20, paddingTop: 12 }}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.catChip, activeCategory === c && styles.catChipActive]}
              onPress={() => setActiveCategory(c)}
            >
              <Text style={[styles.catChipText, activeCategory === c && styles.catChipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Product Grid ── */}
      <View style={styles.gridSection}>
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48 }}>🌱</Text>
            <Text style={styles.emptyText}>No products in this category yet</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {filtered.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.productCard}
                onPress={() => navigation.navigate('ProductDetail', { product: p })}
                activeOpacity={0.88}
              >
                {p.img ? (
                  <Image source={{ uri: p.img }} style={styles.productImg} />
                ) : (
                  <View style={styles.productImgPlaceholder}>
                    <Text style={{ fontSize: 36 }}>{p.emoji || '🌿'}</Text>
                  </View>
                )}
                {p.tag && <View style={styles.tagBadge}><Text style={styles.tagText}>{p.tag}</Text></View>}
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={2}>{p.name}</Text>
                  <Text style={styles.productPrice}>₦{Number(p.price).toLocaleString()}</Text>
                  <Text style={styles.productUnit}>{p.unit}</Text>
                  <TouchableOpacity style={styles.addBtn} onPress={() => addToCart(p)}>
                    <Ionicons name="add" size={16} color={COLORS.white} />
                    <Text style={styles.addBtnText}>Add</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* ── About Banner ── */}
      <View style={styles.aboutBanner}>
        <Text style={styles.aboutTitle}>🏡 About Pinnacles Farm</Text>
        <Text style={styles.aboutText}>
          We are a family-run resource centre farm committed to growing fresh, sustainable produce. 
          All our products are harvested daily and delivered with care directly to your doorstep.
        </Text>
        <TouchableOpacity style={styles.contactBtn} onPress={() => navigation.navigate('ChatTab')}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={COLORS.white} />
          <Text style={styles.contactBtnText}>Chat with Us</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.offWhite },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.offWhite, gap: 12 },
  loadingText: { color: COLORS.textLight, fontSize: 14 },

  hero: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  heroLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  heroLogo: { width: 52, height: 52, resizeMode: 'contain', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: 4 },
  heroTitle: { color: COLORS.white, fontSize: 22, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  cartButton: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  cartBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: COLORS.gold, borderRadius: 10, minWidth: 20, height: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  cartBadgeText: { color: COLORS.white, fontSize: 11, fontWeight: '800' },

  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: RADIUS.md, padding: 12, alignItems: 'center', gap: 4,
  },
  statValue: { color: COLORS.white, fontSize: 18, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },

  section: { marginTop: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 4 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textDark },
  sectionLink: { color: COLORS.primaryLight, fontSize: 13, fontWeight: '600' },

  featuredCard: {
    width: 160, backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    marginRight: 14, overflow: 'hidden', ...SHADOW.md,
  },
  featuredImg: { width: '100%', height: 110, resizeMode: 'cover' },
  featuredImgPlaceholder: {
    width: '100%', height: 110, backgroundColor: COLORS.offWhite,
    justifyContent: 'center', alignItems: 'center',
  },
  featuredInfo: { padding: 10, paddingBottom: 4 },
  featuredName: { fontSize: 13, fontWeight: '700', color: COLORS.textDark },
  featuredPrice: { fontSize: 15, fontWeight: '800', color: COLORS.primary, marginTop: 4 },
  featuredUnit: { fontSize: 11, color: COLORS.textLight, marginTop: 1 },
  featuredAdd: {
    margin: 10, marginTop: 6, backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full, height: 32, justifyContent: 'center', alignItems: 'center',
  },

  catChip: {
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: RADIUS.full,
    backgroundColor: COLORS.white, marginRight: 10, borderWidth: 1.5, borderColor: COLORS.border,
  },
  catChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catChipText: { fontSize: 13, fontWeight: '600', color: COLORS.textMid },
  catChipTextActive: { color: COLORS.white },

  gridSection: { paddingHorizontal: 16, marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  productCard: {
    width: (width - 44) / 2,
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg, overflow: 'hidden', ...SHADOW.sm,
  },
  productImg: { width: '100%', height: 120, resizeMode: 'cover' },
  productImgPlaceholder: {
    width: '100%', height: 120, backgroundColor: COLORS.offWhite,
    justifyContent: 'center', alignItems: 'center',
  },
  tagBadge: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: COLORS.gold, borderRadius: RADIUS.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  tagText: { color: COLORS.white, fontSize: 10, fontWeight: '700' },
  productInfo: { padding: 10 },
  productName: { fontSize: 13, fontWeight: '700', color: COLORS.textDark },
  productPrice: { fontSize: 14, fontWeight: '800', color: COLORS.primary, marginTop: 4 },
  productUnit: { fontSize: 11, color: COLORS.textLight, marginTop: 1 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary, borderRadius: RADIUS.full,
    paddingVertical: 7, marginTop: 8, gap: 4,
  },
  addBtnText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },

  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { color: COLORS.textLight, fontSize: 14 },

  aboutBanner: {
    margin: 20, backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl, padding: 24, gap: 12,
  },
  aboutTitle: { color: COLORS.white, fontSize: 18, fontWeight: '800' },
  aboutText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 20 },
  contactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.accent, borderRadius: RADIUS.full,
    alignSelf: 'flex-start', paddingHorizontal: 18, paddingVertical: 10,
  },
  contactBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
});
