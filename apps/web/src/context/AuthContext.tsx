import React, { createContext, useContext, useEffect, useState } from 'react';
import { loginSession, logoutSession, refreshSession, getUserProfile } from '../api/client';
import { getAccessToken } from '../auth/session';

export type UserRole =
  | 'SUPER_ADMIN'
  | 'FARM_MANAGER'
  | 'VETERINARIAN'
  | 'MILKER'
  | 'ACCOUNTANT'
  | 'WORKER';

export interface User {
  id: string;
  username: string;
  fullName: string;
  email?: string;
  role: UserRole;
  farmId?: string;
  farm?: {
    id: string;
    name: string;
    location: string | null;
    managerName?: string | null;
    phone?: string | null;
  };
}

interface AuthContextType {
  user: User | null;
  role: UserRole;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (username: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
  updateUserFarm: (farm: { id: string; name: string; location?: string | null; managerName?: string | null; phone?: string | null }) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: 'WORKER',
  isLoggedIn: false,
  isLoading: true,
  login: async () => ({ success: false }),
  logout: async () => {},
  hasRole: () => false,
  updateUserFarm: () => {},
});

const AUTH_USER_STORAGE_KEY = 'saraya.auth.user';
const FARM_SETTINGS_STORAGE_KEY = 'saraya.farm_settings';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = sessionStorage.getItem(AUTH_USER_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => !user);

  const clearSession = () => {
    try {
      sessionStorage.removeItem(AUTH_USER_STORAGE_KEY);
    } catch {}
    setUser(null);
  };

  const updateUserFarm = (farm: { id: string; name: string; location?: string | null; managerName?: string | null; phone?: string | null }) => {
    try {
      localStorage.setItem(FARM_SETTINGS_STORAGE_KEY, JSON.stringify(farm));
    } catch {}

    setUser(prev => {
      if (!prev) return null;
      const updated: User = {
        ...prev,
        farmId: farm.id,
        farm: {
          id: farm.id,
          name: farm.name,
          location: farm.location ?? null,
          managerName: farm.managerName ?? null,
          phone: farm.phone ?? null,
        },
      };
      try {
        sessionStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const applyProfile = (profile: any) => {
    let userFarm = profile.farm;
    if (!userFarm) {
      try {
        const cached = localStorage.getItem(FARM_SETTINGS_STORAGE_KEY);
        if (cached) userFarm = JSON.parse(cached);
      } catch {}
    } else {
      try {
        localStorage.setItem(FARM_SETTINGS_STORAGE_KEY, JSON.stringify(userFarm));
      } catch {}
    }

    const restoredUser: User = {
      id: profile.id,
      username: profile.username,
      fullName: profile.fullName,
      email: profile.email ?? undefined,
      role: profile.role,
      farmId: profile.farmId ?? userFarm?.id ?? undefined,
      farm: userFarm ?? undefined,
    };

    try {
      sessionStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(restoredUser));
    } catch {}

    setUser(restoredUser);
    return restoredUser;
  };

  useEffect(() => {
    const restoreSession = async () => {
      try {
        // 1. If we have an access token, try to load profile directly (fast & doesn't invalidate token)
        const token = getAccessToken();
        if (token) {
          try {
            const profile = await getUserProfile();
            if (profile?.id) {
              applyProfile(profile);
              return;
            }
          } catch {
            // Token might be expired, will attempt refresh below
          }
        }

        // 2. Attempt refresh session
        const authentication = await refreshSession();
        if (authentication?.user) {
          applyProfile(authentication.user);
          return;
        }

        // 3. Neither worked - clear session if not already logged out
        if (!sessionStorage.getItem(AUTH_USER_STORAGE_KEY)) {
          clearSession();
        }
      } catch {
        if (!sessionStorage.getItem(AUTH_USER_STORAGE_KEY)) {
          clearSession();
        }
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => clearSession();
    window.addEventListener('saraya:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('saraya:unauthorized', handleUnauthorized);
  }, []);

  const login = async (username: string, pass: string) => {
    try {
      const data = await loginSession(username, pass);
      applyProfile(data.user);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'تعذر الاتصال بالخادم. لا يتوفر دخول محلي غير موثّق.',
      };
    }
  };

  const logout = async () => {
    try {
      sessionStorage.removeItem(AUTH_USER_STORAGE_KEY);
    } catch {}
    await logoutSession();
    clearSession();
  };
  const role = user?.role || 'WORKER';
  const hasRole = (...roles: UserRole[]) => Boolean(user && (role === 'SUPER_ADMIN' || roles.includes(role)));

  return (
    <AuthContext.Provider
      value={{ user, role, isLoggedIn: Boolean(user), isLoading, login, logout, hasRole, updateUserFarm }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
