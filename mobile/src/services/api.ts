// ── API service — centralised axios instance ──────────────────────────────
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 🔑 Set EXPO_PUBLIC_API_URL in your .env file to your Vercel deployment URL
export const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  'https://pinnacles-resource-centre-farm.vercel.app';

const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request if present
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Products ──────────────────────────────────────────────────────────────
export const getProducts = () => api.get('/products');
export const getAllProducts = () => api.get('/products/all');
export const createProduct = (data: FormData) =>
  api.post('/products', data, { headers: { 'Content-Type': 'multipart/form-data' } });
export const updateProduct = (id: number, data: FormData) =>
  api.put(`/products/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
export const deleteProduct = (id: number) => api.delete(`/products/${id}`);

// ── Orders ────────────────────────────────────────────────────────────────
export const placeOrder = (data: object) => api.post('/orders', data);
export const getOrders = (status?: string) =>
  api.get('/orders', { params: status ? { status } : {} });
export const updateOrderStatus = (id: number, status: string) =>
  api.patch(`/orders/${id}/status`, { status });
export const deleteOrder = (id: number) => api.delete(`/orders/${id}`);

// ── Messages ──────────────────────────────────────────────────────────────
export const sendMessage = (data: object) => api.post('/messages', data);
export const getMessages = () => api.get('/messages');
export const markMessageRead = (id: number) => api.patch(`/messages/${id}/read`);
export const deleteMessage = (id: number) => api.delete(`/messages/${id}`);

// ── Auth ──────────────────────────────────────────────────────────────────
export const adminLogin = (username: string, password: string) =>
  api.post('/auth/login', { username, password });

export default api;
