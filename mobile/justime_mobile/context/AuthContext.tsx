import React, { createContext, useContext, useEffect, useMemo, useState, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getConfiguredApiBaseUrl, isManualApiBaseUrlEnabled, getApiBaseUrl } from '@/constants/app-config';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { hydrateAuthStorage, STORAGE_KEYS } from '@/context/auth-storage';

const TOKEN_VALIDATE_INTERVAL = 5 * 60 * 1000;

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
const safeParseUser = (value: string): AuthUser | null => {
  try {
    const parsed = JSON.parse(value) as Partial<AuthUser>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.id || !parsed.email) return null;
    return {
      id: parsed.id,
      email: parsed.email,
      displayName: parsed.displayName || parsed.email,
    };
  } catch {
    return null;
  }
};

const getDefaultBaseUrl = () => {
  return getApiBaseUrl();
};

const DEFAULT_BASE_URL = getDefaultBaseUrl();
const MANUAL_API_BASE_URL_ENABLED = isManualApiBaseUrlEnabled();

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [baseUrl, setBaseUrlState] = useState<string>(DEFAULT_BASE_URL);
  const [loading, setLoading] = useState<boolean>(true);
  const validateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const validateToken = async (
    tokenToValidate: string,
    targetBaseUrl: string
  ): Promise<{ valid: boolean; user?: AuthUser }> => {
    try {
      const response = await fetch(`${targetBaseUrl}${API_ENDPOINTS.AUTH.ME}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${tokenToValidate}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return { valid: false };
      }

      const result = await response.json();
      if (result.success && result.data?.user) {
        const serverUser = result.data.user;
        return {
          valid: true,
          user: {
            id: serverUser.id,
            email: serverUser.email,
            displayName: serverUser.displayName || serverUser.email,
          },
        };
      }

      return { valid: false };
    } catch (error) {
      console.error('Token validation failed:', error);
      return { valid: false };
    }
  };

  useEffect(() => {
    let settled = false;
    const failSafeTimer = setTimeout(() => {
      if (!settled) {
        setLoading(false);
      }
    }, 6000);

    const hydrate = async () => {
      try {
        const {
          token: savedToken,
          user: savedUser,
          baseUrl: savedBaseUrl,
        } = await hydrateAuthStorage();

        let currentBaseUrl = DEFAULT_BASE_URL;
        if (MANUAL_API_BASE_URL_ENABLED && savedBaseUrl) {
          const cleanSaved = normalizeBaseUrl(savedBaseUrl);
          currentBaseUrl = cleanSaved || DEFAULT_BASE_URL;
        }
        setBaseUrlState(currentBaseUrl);
        if (!MANUAL_API_BASE_URL_ENABLED) {
          await AsyncStorage.setItem(STORAGE_KEYS.baseUrl, DEFAULT_BASE_URL);
        }

        const parsedUser = savedUser ? safeParseUser(savedUser) : null;
        if (savedToken && parsedUser) {
          const validation = await validateToken(savedToken, currentBaseUrl);
          if (validation.valid && validation.user) {
            setToken(savedToken);
            setUser(validation.user);
            await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(validation.user));
          } else {
            await AsyncStorage.multiRemove([STORAGE_KEYS.token, STORAGE_KEYS.user]);
          }
        } else {
          const invalidKeys: string[] = [];
          if (savedToken) invalidKeys.push(STORAGE_KEYS.token);
          if (savedUser) invalidKeys.push(STORAGE_KEYS.user);
          if (invalidKeys.length) {
            await AsyncStorage.multiRemove(invalidKeys);
          }
        }
      } catch (error) {
        console.error('Auth hydrate failed:', error);
      } finally {
        settled = true;
        clearTimeout(failSafeTimer);
        setLoading(false);
      }
    };

    void hydrate();
    return () => {
      clearTimeout(failSafeTimer);
    };
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
      const response = await fetch(`${targetBaseUrl}${API_ENDPOINTS.AUTH.LOGIN}`, {
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
      const response = await fetch(`${targetBaseUrl}${API_ENDPOINTS.AUTH.REGISTER}`, {
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

  const validateTokenAlive = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${baseUrl}${API_ENDPOINTS.AUTH.ME}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        await signOut();
      }
    } catch {
      // network error, don't logout
    }
  }, [token, baseUrl]);

  useEffect(() => {
    if (token) {
      validateTimerRef.current = setInterval(validateTokenAlive, TOKEN_VALIDATE_INTERVAL);
    }
    return () => {
      if (validateTimerRef.current) {
        clearInterval(validateTimerRef.current);
        validateTimerRef.current = null;
      }
    };
  }, [token, validateTokenAlive]);

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
