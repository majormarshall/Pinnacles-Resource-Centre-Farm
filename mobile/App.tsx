// ── App.tsx — Root Navigator ──────────────────────────────────────────────
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { View, ActivityIndicator } from 'react-native';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { CartProvider, useCart } from './src/context/CartContext';
import { COLORS } from './src/theme/tokens';

import HomeScreen from './src/screens/HomeScreen';
import ProductDetailScreen from './src/screens/ProductDetailScreen';
import CartScreen from './src/screens/CartScreen';
import ChatScreen from './src/screens/ChatScreen';
import AdminScreen from './src/screens/AdminScreen';
import AdminLoginScreen from './src/screens/AdminLoginScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// ── Customer Stack (Home + Product Detail) ────────────────────────────────
function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
    </Stack.Navigator>
  );
}

// ── Cart Tab Icon with badge ──────────────────────────────────────────────
function CartTabIcon({ color, size }: { color: string; size: number }) {
  const { state } = useCart();
  return (
    <View>
      <Ionicons name="cart-outline" size={size} color={color} />
      {state.count > 0 && (
        <View style={{
          position: 'absolute', top: -4, right: -6,
          backgroundColor: COLORS.gold, borderRadius: 10,
          minWidth: 18, height: 18,
          justifyContent: 'center', alignItems: 'center',
          paddingHorizontal: 3,
        }}>
          <View style={{ alignItems: 'center' }}>
            <Ionicons name="ellipse" size={0} />
          </View>
        </View>
      )}
    </View>
  );
}

// ── Customer Tabs ─────────────────────────────────────────────────────────
function CustomerTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: '#e2e8f0',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="CartTab"
        component={CartScreen}
        options={{
          tabBarLabel: 'Cart',
          tabBarIcon: ({ color, size }) => <CartTabIcon color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="ChatTab"
        component={ChatScreen}
        options={{
          tabBarLabel: 'Chat',
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-outline" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

// ── Admin Tabs ────────────────────────────────────────────────────────────
function AdminTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: '#e2e8f0',
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="AdminOrders"
        component={AdminScreen}
        options={{
          tabBarLabel: 'Admin',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="ShopTab"
        component={CustomerTabs}
        options={{
          tabBarLabel: 'Shop View',
          tabBarIcon: ({ color, size }) => <Ionicons name="storefront-outline" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

// ── Root — decides between admin/customer view ────────────────────────────
function RootNavigator() {
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primary }}>
        <ActivityIndicator size="large" color={COLORS.white} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAdmin ? (
          <Stack.Screen name="AdminRoot" component={AdminTabs} />
        ) : (
          <>
            <Stack.Screen name="CustomerRoot" component={CustomerTabs} />
            <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ── App Entry ─────────────────────────────────────────────────────────────
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <CartProvider>
            <RootNavigator />
          </CartProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
