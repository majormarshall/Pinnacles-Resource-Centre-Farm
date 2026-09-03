// ── AdminScreen (Order Management) ───────────────────────────────────────
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  Alert, ActivityIndicator, TextInput, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOW } from '../theme/tokens';
import { useAuth } from '../context/AuthContext';
import { getOrders, updateOrderStatus, deleteOrder, getMessages, markMessageRead } from '../services/api';

const STATUS_OPTIONS = ['pending', 'confirmed', 'processing', 'delivered', 'cancelled'];
const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  confirmed: '#3b82f6',
  processing: '#8b5cf6',
  delivered: '#10b981',
  cancelled: '#ef4444',
};
const STATUS_ICONS: Record<string, string> = {
  pending: 'time-outline',
  confirmed: 'checkmark-circle-outline',
  processing: 'refresh-circle-outline',
  delivered: 'bicycle-outline',
  cancelled: 'close-circle-outline',
};

export default function AdminScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { username, logout } = useAuth();
  const [tab, setTab] = useState<'orders' | 'messages'>('orders');
  const [orders, setOrders] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [unread, setUnread] = useState(0);
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [ordersRes, msgsRes] = await Promise.all([
        getOrders(filterStatus || undefined),
        getMessages(),
      ]);
      setOrders(ordersRes.data.orders || []);
      setStats(ordersRes.data.stats || {});
      setMessages(msgsRes.data.messages || []);
      setUnread(msgsRes.data.unread || 0);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to load data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterStatus]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleStatusChange = async (orderId: number, newStatus: string) => {
    try {
      await updateOrderStatus(orderId, newStatus);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    } catch (e) {
      Alert.alert('Error', 'Failed to update order status.');
    }
  };

  const handleDeleteOrder = (orderId: number) => {
    Alert.alert('Delete Order', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteOrder(orderId);
          setOrders(prev => prev.filter(o => o.id !== orderId));
        }
      }
    ]);
  };

  const handleMarkRead = async (msgId: number) => {
    await markMessageRead(msgId);
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_read: 1 } : m));
    setUnread(u => Math.max(0, u - 1));
  };

  if (loading) {
    return (
      <View style={styles.loadingCenter}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading admin panel...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={styles.headerTitle}>⚙️ Admin Panel</Text>
          <Text style={styles.headerSub}>Welcome, {username}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => Alert.alert('Logout', 'Are you sure?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Logout', style: 'destructive', onPress: logout },
        ])}>
          <Ionicons name="log-out-outline" size={22} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* ── Stats Cards ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsScroll} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
        {[
          { label: 'Total Orders', value: stats.total || 0, color: COLORS.primary, icon: 'receipt-outline' },
          { label: 'Pending', value: stats.pending || 0, color: '#f59e0b', icon: 'time-outline' },
          { label: 'Confirmed', value: stats.confirmed || 0, color: '#3b82f6', icon: 'checkmark-circle-outline' },
          { label: 'Delivered', value: stats.delivered || 0, color: '#10b981', icon: 'bicycle-outline' },
          { label: 'Revenue', value: `₦${Number(stats.revenue || 0).toLocaleString()}`, color: COLORS.gold, icon: 'cash-outline' },
        ].map((s, i) => (
          <View key={i} style={[styles.statCard, { borderLeftColor: s.color }]}>
            <Ionicons name={s.icon as any} size={20} color={s.color} />
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </ScrollView>

      {/* ── Tabs ── */}
      <View style={styles.tabBar}>
        {(['orders', 'messages'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'orders' ? '📦 Orders' : `💬 Messages${unread > 0 ? ` (${unread})` : ''}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Content ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={COLORS.primary} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
      >
        {tab === 'orders' && (
          <>
            {/* Filter pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>
              {['', ...STATUS_OPTIONS].map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.filterChip, filterStatus === s && { backgroundColor: STATUS_COLORS[s] || COLORS.primary }]}
                  onPress={() => setFilterStatus(s)}
                >
                  <Text style={[styles.filterChipText, filterStatus === s && { color: COLORS.white }]}>
                    {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {orders.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 48 }}>📦</Text>
                <Text style={styles.emptyText}>No orders found</Text>
              </View>
            ) : (
              orders.map(order => (
                <TouchableOpacity
                  key={order.id}
                  style={styles.orderCard}
                  onPress={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                  activeOpacity={0.85}
                >
                  <View style={styles.orderHeader}>
                    <View style={styles.orderMeta}>
                      <Text style={styles.orderId}>Order #{order.id}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[order.status] || COLORS.textLight }]}>
                        <Ionicons name={STATUS_ICONS[order.status] as any || 'help-circle-outline'} size={12} color={COLORS.white} />
                        <Text style={styles.statusText}>{order.status}</Text>
                      </View>
                    </View>
                    <Text style={styles.orderTotal}>₦{Number(order.total).toLocaleString()}</Text>
                  </View>

                  <Text style={styles.orderCustomer}>👤 {order.customer_name} • 📞 {order.customer_phone || 'N/A'}</Text>
                  <Text style={styles.orderDate}>{new Date(order.created_at).toLocaleString()}</Text>

                  {expandedOrder === order.id && (
                    <View style={styles.orderExpanded}>
                      {/* Items */}
                      {order.items?.map((item: any, idx: number) => (
                        <View key={idx} style={styles.orderItem}>
                          <Text style={styles.orderItemName}>{item.emoji || '🌿'} {item.name} x{item.qty}</Text>
                          <Text style={styles.orderItemPrice}>₦{(item.price * item.qty).toLocaleString()}</Text>
                        </View>
                      ))}
                      {order.notes ? <Text style={styles.orderNotes}>📝 {order.notes}</Text> : null}

                      {/* Status update */}
                      <Text style={styles.statusUpdateLabel}>Update Status:</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                        {STATUS_OPTIONS.map(s => (
                          <TouchableOpacity
                            key={s}
                            style={[styles.statusOption, { borderColor: STATUS_COLORS[s] }, order.status === s && { backgroundColor: STATUS_COLORS[s] }]}
                            onPress={() => handleStatusChange(order.id, s)}
                          >
                            <Text style={[styles.statusOptionText, { color: STATUS_COLORS[s] }, order.status === s && { color: COLORS.white }]}>
                              {s}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>

                      {/* Actions */}
                      <View style={styles.orderActions}>
                        {order.customer_phone && (
                          <TouchableOpacity
                            style={styles.waBtn}
                            onPress={() => Linking.openURL(`https://wa.me/${order.customer_phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hello ${order.customer_name}! This is Pinnacles Farm regarding Order #${order.id}. `)}`)}
                          >
                            <Ionicons name="logo-whatsapp" size={16} color={COLORS.white} />
                            <Text style={styles.waBtnText}>WhatsApp</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteOrder(order.id)}>
                          <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                          <Text style={styles.deleteBtnText}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        {tab === 'messages' && (
          <>
            {messages.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 48 }}>💬</Text>
                <Text style={styles.emptyText}>No messages yet</Text>
              </View>
            ) : (
              messages.map(msg => (
                <View key={msg.id} style={[styles.msgCard, !msg.is_read && styles.msgCardUnread]}>
                  <View style={styles.msgHeader}>
                    <View>
                      <Text style={styles.msgName}>{msg.name}</Text>
                      {msg.phone ? <Text style={styles.msgPhone}>📞 {msg.phone}</Text> : null}
                    </View>
                    <Text style={styles.msgDate}>{new Date(msg.created_at).toLocaleDateString()}</Text>
                  </View>
                  <Text style={styles.msgText}>{msg.message}</Text>
                  {!msg.is_read && (
                    <TouchableOpacity style={styles.readBtn} onPress={() => handleMarkRead(msg.id)}>
                      <Text style={styles.readBtnText}>Mark as Read</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.offWhite },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: COLORS.textLight, fontSize: 14 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingBottom: 20,
  },
  headerTitle: { color: COLORS.white, fontSize: 22, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 3 },
  logoutBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },

  statsScroll: { paddingVertical: 12 },
  statCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: 14,
    alignItems: 'center', gap: 4, borderLeftWidth: 4, minWidth: 100, ...SHADOW.sm,
  },
  statValue: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 11, color: COLORS.textLight },

  tabBar: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 4, backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: RADIUS.sm },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.textLight },
  tabTextActive: { color: COLORS.white },

  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full,
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
  },
  filterChipText: { fontSize: 12, fontWeight: '600', color: COLORS.textMid },

  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { color: COLORS.textLight, fontSize: 14 },

  orderCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 14, marginBottom: 10, ...SHADOW.sm },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  orderMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderId: { fontSize: 14, fontWeight: '800', color: COLORS.textDark },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { color: COLORS.white, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  orderTotal: { fontSize: 16, fontWeight: '900', color: COLORS.primary },
  orderCustomer: { fontSize: 13, color: COLORS.textMid },
  orderDate: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },

  orderExpanded: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 8 },
  orderItem: { flexDirection: 'row', justifyContent: 'space-between' },
  orderItemName: { fontSize: 13, color: COLORS.textMid, flex: 1 },
  orderItemPrice: { fontSize: 13, fontWeight: '700', color: COLORS.textDark },
  orderNotes: { fontSize: 12, color: COLORS.textLight, fontStyle: 'italic' },

  statusUpdateLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textMid, marginTop: 4 },
  statusOption: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full,
    borderWidth: 1.5, textTransform: 'capitalize',
  },
  statusOptionText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },

  orderActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  waBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#25D366', borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 8,
  },
  waBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 12 },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: COLORS.danger, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 8,
  },
  deleteBtnText: { color: COLORS.danger, fontWeight: '700', fontSize: 12 },

  msgCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 14, marginBottom: 10, ...SHADOW.sm },
  msgCardUnread: { borderLeftWidth: 4, borderLeftColor: COLORS.primary },
  msgHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  msgName: { fontSize: 14, fontWeight: '800', color: COLORS.textDark },
  msgPhone: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  msgDate: { fontSize: 11, color: COLORS.textMuted },
  msgText: { fontSize: 13, color: COLORS.textMid, lineHeight: 20 },
  readBtn: { alignSelf: 'flex-end', marginTop: 8 },
  readBtnText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
});
