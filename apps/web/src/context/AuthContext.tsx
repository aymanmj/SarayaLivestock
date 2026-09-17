import React, { createContext, useContext, useEffect, useState } from 'react';
import { loginSession, logoutSession, refreshSession } from '../api/client';

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
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: 'WORKER',
  isLoggedIn: false,
  isLoading: true,
  login: async () => ({ success: false }),
  logout: async () => {},
  hasRole: () => false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = () => {
    setUser(null);
  };

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const authentication = await refreshSession();
        if (!authentication) throw new Error('Session is no longer valid');
        const profile = authentication.user;
        const restoredUser: User = {
          id: profile.id,
          username: profile.username,
          fullName: profile.fullName,
          email: profile.email ?? undefined,
          role: profile.role,
          farmId: profile.farmId ?? undefined,
          farm: (profile as any).farm ?? undefined,
        };
        setUser(restoredUser);
      } catch {
        clearSession();
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

      const loggedUser: User = {
        id: data.user.id,
        username: data.user.username,
        fullName: data.user.fullName,
        email: data.user.email ?? undefined,
        role: data.user.role,
        farmId: data.user.farmId ?? undefined,
        farm: (data.user as any).farm ?? undefined,
      };

      setUser(loggedUser);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'تعذر الاتصال بالخادم. لا يتوفر دخول محلي غير موثّق.',
      };
    }
  };

  const logout = async () => {
    await logoutSession();
    clearSession();
  };
  const role = user?.role || 'WORKER';
  const hasRole = (...roles: UserRole[]) => Boolean(user && (role === 'SUPER_ADMIN' || roles.includes(role)));

  return (
    <AuthContext.Provider
      value={{ user, role, isLoggedIn: Boolean(user), isLoading, login, logout, hasRole }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
