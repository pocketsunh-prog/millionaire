import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type {ReactNode} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as authApi from '../api/auth';
import {ApiError, getToken, setToken} from '../api/client';
import type {User} from '../types';

interface AuthContextValue {
  user: User | null;
  isGuest: boolean;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<User>;
  register: (
    username: string,
    email: string,
    password: string,
  ) => Promise<User>;
  loginAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const USER_KEY = 'millionaire_user';
const GUEST_KEY = 'millionaire_guest';

const GUEST_USER: User = {
  id: 0,
  username: 'Guest',
  email: null,
  avatar: '🎮',
  role: 'guest',
  total_games: 0,
  total_wins: 0,
  best_score: 0,
  best_question: 0,
};

export function AuthProvider({children}: {children: ReactNode}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on launch.
  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (token) {
          const cached = await AsyncStorage.getItem(USER_KEY);
          if (cached) {
            setUser(JSON.parse(cached) as User);
          }
          try {
            const fresh = await authApi.fetchMe();
            setUser(fresh);
            await AsyncStorage.setItem(USER_KEY, JSON.stringify(fresh));
          } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
              // Token expired/invalid.
              await setToken(null);
              await AsyncStorage.removeItem(USER_KEY);
              setUser(null);
            }
            // For network errors keep the cached user (offline resume).
          }
        } else if ((await AsyncStorage.getItem(GUEST_KEY)) === '1') {
          // Offline guest session from a previous launch.
          setUser(GUEST_USER);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const u = await authApi.login(identifier, password);
    setUser(u);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(u));
    await AsyncStorage.removeItem(GUEST_KEY);
    return u;
  }, []);

  const register = useCallback(
    async (username: string, email: string, password: string) => {
      const u = await authApi.register(username, email, password);
      setUser(u);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(u));
      await AsyncStorage.removeItem(GUEST_KEY);
      return u;
    },
    [],
  );

  /** Enter offline guest mode — play locally without an account. */
  const loginAsGuest = useCallback(async () => {
    setUser(GUEST_USER);
    await AsyncStorage.setItem(GUEST_KEY, '1');
    await AsyncStorage.removeItem(USER_KEY);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
    await AsyncStorage.removeItem(USER_KEY);
    await AsyncStorage.removeItem(GUEST_KEY);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const u = await authApi.fetchMe();
      setUser(u);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(u));
    } catch {
      // ignore; session stays as-is
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      isGuest: user?.role === 'guest',
      loading,
      login,
      register,
      loginAsGuest,
      logout,
      refreshUser,
    }),
    [user, loading, login, register, loginAsGuest, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
