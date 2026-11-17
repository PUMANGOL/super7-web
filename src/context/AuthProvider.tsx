import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { signIn, signOut, validateToken } from '../api/auth';
import {
  AUTH_TOKEN_KEY,
  AUTH_USER_KEY,
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
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(readStoredSession);

  /**
   * Termina a sessão neste browser: apaga o token e o utilizador guardados e esvazia o cache
   * dos pedidos, para as encomendas e os dados dos clientes não ficarem em memória para a
   * próxima pessoa que entrar no mesmo separador.
   */
  const endSession = useCallback(() => {
    clearAuth();
    queryClient.clear();
    setUser(null);
  }, [queryClient]);

  /**
   * Botão "Terminar sessão": pede à API que invalide o token (deixa de servir mesmo que tenha sido
   * copiado) e termina já a sessão neste browser, sem esperar pela resposta. Sem rede, a sessão
   * local termina na mesma e o token expira sozinho em 24 h.
   * Sessão expirada e logout noutro separador usam só endSession: aí o token já não é válido.
   */
  const logout = useCallback(() => {
    const token = getAuthToken();
    if (token) {
      signOut(token).catch(() => {
        // Ignorado de propósito: a sessão local termina de qualquer forma.
      });
    }
    endSession();
  }, [endSession]);

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
        if (getApiStatus(error) === 401) endSession();
      });
  }, [endSession]);

  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED_EVENT, endSession);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, endSession);
  }, [endSession]);

  // Sessão terminada (ou iniciada) noutro separador: este acompanha, em vez de continuar
  // a mostrar o back-office sem token.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) return;
      if (event.key !== null && event.key !== AUTH_TOKEN_KEY && event.key !== AUTH_USER_KEY) return;

      if (event.key !== AUTH_USER_KEY) queryClient.clear();
      setUser(readStoredSession());
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [queryClient]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await signIn({ email, password });
    setAuthToken(response.token);
    setStoredUser(response.user);
    setUser(response.user);
    return response.user;
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
