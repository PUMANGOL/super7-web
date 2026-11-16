import { createContext, useContext } from 'react';
import type { AuthUser } from '../types/api';
import type { Permission } from '../utils/auth';

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  canAccessBackoffice: boolean;
  can: (permission: Permission) => boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth tem de ser usado dentro de AuthProvider');
  return context;
}
