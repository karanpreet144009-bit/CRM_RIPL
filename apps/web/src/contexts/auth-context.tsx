import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, setAccessToken } from '../lib/api';

type User = { id: string; email: string; roles: string[]; forcePasswordChange: boolean; employee?: { id: string; fullName: string } };
type Auth = { user?: User; ready: boolean; login: (email: string, password: string) => Promise<void>; logout: () => Promise<void> };
const Context = createContext<Auth | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>();
  const [ready, setReady] = useState(false);
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    let active = true;
    void api.post('/auth/refresh').then(({ data }) => { setAccessToken(data.data.accessToken); if (active) setUser(data.data.user); }).catch(() => setAccessToken()).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  const login = async (email: string, password: string) => { const { data } = await api.post('/auth/login', { email, password }); setAccessToken(data.data.accessToken); setUser(data.data.user); setReady(true); };
  const logout = async () => { try { await api.post('/auth/logout'); } finally { setAccessToken(); setUser(undefined); setReady(true); } };
  return <Context.Provider value={{ user, ready, login, logout }}>{children}</Context.Provider>;
}

export function useAuth() { const context = useContext(Context); if (!context) throw new Error('AuthProvider missing'); return context; }
