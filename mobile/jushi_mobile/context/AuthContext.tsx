import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  token: '@jushi/token',
  user: '@jushi/user',
  baseUrl: '@jushi/base_url',
};

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
};

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  baseUrl: string;
  loading: boolean;
  signIn: (identifier: string, password: string, overrideBaseUrl?: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName?: string,
    overrideBaseUrl?: string
  ) => Promise<void>;
  signOut: () => Promise<void>;
  setBaseUrl: (url: string) => Promise<void>;
};

const normalizeBaseUrl = (value: string) => value.trim().replace(/\/+$/, '');
const getDefaultBaseUrl = () => {
  const envUrl = (process.env.EXPO_PUBLIC_API_BASE_URL || '').trim();
  return normalizeBaseUrl(envUrl) || 'http://127.0.0.1:8080';
};

const DEFAULT_BASE_URL = getDefaultBaseUrl();

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [baseUrl, setBaseUrlState] = useState<string>(DEFAULT_BASE_URL);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const hydrate = async () => {
      try {
        const [savedToken, savedUser, savedBaseUrl] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.token),
          AsyncStorage.getItem(STORAGE_KEYS.user),
          AsyncStorage.getItem(STORAGE_KEYS.baseUrl),
        ]);

        if (savedToken) {
          setToken(savedToken);
        }
        if (savedUser) {
          setUser(JSON.parse(savedUser) as AuthUser);
        }
        if (savedBaseUrl) {
          const cleanSaved = normalizeBaseUrl(savedBaseUrl);
          setBaseUrlState(cleanSaved || DEFAULT_BASE_URL);
        }
      } finally {
        setLoading(false);
      }
    };

    hydrate();
  }, []);

  const setBaseUrl = async (url: string) => {
    const cleanUrl = normalizeBaseUrl(url);
    const nextUrl = cleanUrl || DEFAULT_BASE_URL;
    setBaseUrlState(nextUrl);
    await AsyncStorage.setItem(STORAGE_KEYS.baseUrl, nextUrl);
  };

  const signIn = async (identifier: string, password: string, overrideBaseUrl?: string) => {
    setLoading(true);
    try {
      const targetBaseUrl = normalizeBaseUrl(overrideBaseUrl || baseUrl) || DEFAULT_BASE_URL;
      const response = await fetch(`${targetBaseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password, rememberMe: true }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || result.error || '登录失败');
      }

      const nextToken = result.data?.token as string | undefined;
      const nextUser = result.data?.user as AuthUser | undefined;

      if (!nextToken || !nextUser) {
        throw new Error('登录响应缺少必要字段');
      }

      const safeUser: AuthUser = {
        id: nextUser.id,
        email: nextUser.email,
        displayName: nextUser.displayName || nextUser.email,
      };

      setToken(nextToken);
      setUser(safeUser);

      await AsyncStorage.setItem(STORAGE_KEYS.token, nextToken);
      await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(safeUser));
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    displayName?: string,
    overrideBaseUrl?: string
  ) => {
    setLoading(true);
    try {
      const targetBaseUrl = normalizeBaseUrl(overrideBaseUrl || baseUrl) || DEFAULT_BASE_URL;
      const response = await fetch(`${targetBaseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          display_name: displayName || email.split('@')[0],
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || result.error || '注册失败');
      }

      const nextToken = result.data?.token as string | undefined;
      const nextUser = result.data?.user as AuthUser | undefined;

      if (!nextToken || !nextUser) {
        throw new Error('注册响应缺少必要字段');
      }

      const safeUser: AuthUser = {
        id: nextUser.id,
        email: nextUser.email,
        displayName: nextUser.displayName || nextUser.email,
      };

      setToken(nextToken);
      setUser(safeUser);

      await AsyncStorage.setItem(STORAGE_KEYS.token, nextToken);
      await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(safeUser));
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setToken(null);
    setUser(null);
    await AsyncStorage.multiRemove([STORAGE_KEYS.token, STORAGE_KEYS.user]);
  };

  const value = useMemo(
    () => ({
      token,
      user,
      baseUrl,
      loading,
      signIn,
      signUp,
      signOut,
      setBaseUrl,
    }),
    [token, user, baseUrl, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
