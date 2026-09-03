// ── Auth Store (Zustand-lite via AsyncStorage) ────────────────────────────
import { useState, useEffect, createContext, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { adminLogin } from '../services/api';

interface AuthState {
  token: string | null;
  username: string | null;
  isAdmin: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

import React from 'react';

const AuthContext = createContext<AuthState>({} as AuthState);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const t = await AsyncStorage.getItem('auth_token');
      const u = await AsyncStorage.getItem('auth_username');
      if (t) { setToken(t); setUsername(u); }
      setLoading(false);
    })();
  }, []);

  const login = async (user: string, pass: string) => {
    const res = await adminLogin(user, pass);
    await AsyncStorage.setItem('auth_token', res.data.token);
    await AsyncStorage.setItem('auth_username', res.data.username);
    setToken(res.data.token);
    setUsername(res.data.username);
  };

  const logout = async () => {
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('auth_username');
    setToken(null);
    setUsername(null);
  };

  return (
    <AuthContext.Provider value={{ token, username, isAdmin: !!token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
