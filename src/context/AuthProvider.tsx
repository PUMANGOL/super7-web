import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { signIn, validateToken } from '../api/auth';
import {
  clearAuth,
  getApiStatus,
  getAuthToken,
  getStoredUser,
  SESSION_EXPIRED_EVENT,
  setAuthToken,
  setStoredUser,
} from '../api/client';
import type { AuthUser } from '../types/api';
import { can as userCan, canAccessBackoffice, type Permission } from '../utils/auth';
import { AuthContext } from './auth';

function readStoredSession(): AuthUser | null {
  return getAuthToken() ? getStoredUser() : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readStoredSession);

  // Ao abrir a aplicação, confirma que o token guardado continua válido
  // (expira em 24 h e um novo login noutro dispositivo invalida-o).
  useEffect(() => {
    if (!getAuthToken()) return;

    validateToken()
      .then((fresh) => {
        if (fresh?.id) {
          setStoredUser(fresh);
          setUser(fresh);
        }
      })
      .catch((error: unknown) => {
        if (getApiStatus(error) === 401) {
          clearAuth();
          setUser(null);
        }
      });
  }, []);

  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await signIn({ email, password });
    setAuthToken(response.token);
    setStoredUser(response.user);
    setUser(response.user);
    return response.user;
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user !== null,
      canAccessBackoffice: canAccessBackoffice(user),
      can: (permission: Permission) => userCan(user, permission),
      login,
      logout,
    }),
    [user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
