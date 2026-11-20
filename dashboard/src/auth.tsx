import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { api, setToken, getToken } from './api';

export type Role = 'super_admin' | 'admin' | 'driver' | 'customer';

export interface User {
  id: number;
  fullName: string;
  role: Role;
  officeId: number | null;
}

export interface OfficeInfo {
  name: string | null;
  daysLeft: number;
  warning: boolean;
}

export interface Session {
  user: User;
  office: OfficeInfo | null;
}

interface AuthCtx {
  session: Session | null;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

function loadSession(): Session | null {
  if (!getToken()) return null;
  try {
    const raw = localStorage.getItem('session');
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(loadSession);

  async function login(phone: string, password: string) {
    const r = await api<{ token: string; user: User; office: OfficeInfo | null }>(
      '/auth/login',
      { method: 'POST', body: { phone, password } },
    );
    if (r.user.role !== 'admin' && r.user.role !== 'super_admin') {
      throw new Error('هذه اللوحة للأدمن والسوبر أدمن فقط استخدم تطبيق الموبايل');
    }
    setToken(r.token);
    const s = { user: r.user, office: r.office };
    localStorage.setItem('session', JSON.stringify(s));
    setSession(s);
  }

  function logout() {
    setToken(null);
    localStorage.removeItem('session');
    setSession(null);
  }

  return <Ctx.Provider value={{ session, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}
