import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import api from '@/lib/api';
import type { User, AuthUser, ApiResponse } from '@calendar/shared';

// ----------------------------------------------------------------
// Token storage
// Raw JWT is stored under this key so non-React code (e.g. api.ts)
// can read it without importing the context.
// ----------------------------------------------------------------

const TOKEN_KEY = 'calendar_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function storeToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/** Detect the browser's IANA timezone (e.g. "Asia/Kolkata"). */
function detectTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

// ----------------------------------------------------------------
// Context shape
// ----------------------------------------------------------------

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (authUser: AuthUser) => void;
  logout: () => void;
  /** Merge partial profile changes into the local user state (after a PATCH). */
  updateUser: (patch: Partial<User>) => void;
}

// ----------------------------------------------------------------
// Context + hook
// ----------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

// ----------------------------------------------------------------
// Provider
// ----------------------------------------------------------------

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // ── On mount: validate stored token → sync timezone if needed ──
  useEffect(() => {
    const token = getStoredToken();
    if (!token) { setLoading(false); return; }

    api
      .get<ApiResponse<User>>('/auth/me')
      .then(({ data }) => {
        if (data.success) {
          const serverUser = data.data;
          setUser(serverUser);

          // Sync timezone: if the server has a stale/different value, push the
          // browser's real timezone silently in the background.
          const localTz = detectTimezone();
          if (serverUser.timezone !== localTz) {
            api
              .patch<ApiResponse<User>>('/auth/users/me', { timezone: localTz })
              .then(({ data: patchData }) => {
                if (patchData.success) setUser(patchData.data);
              })
              .catch(() => undefined); // non-critical; ignore errors
          }
        } else {
          clearToken();
        }
      })
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback((authUser: AuthUser) => {
    storeToken(authUser.token);
    const { token: _token, ...userFields } = authUser;
    const user = userFields as User;
    setUser(user);

    // After login, sync the browser's timezone to the profile in the background
    const localTz = detectTimezone();
    if (user.timezone !== localTz) {
      api
        .patch<ApiResponse<User>>('/auth/users/me', { timezone: localTz })
        .then(({ data }) => {
          if (data.success) setUser(data.data);
        })
        .catch(() => undefined);
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    api.post('/auth/logout').catch(() => undefined);
  }, []);

  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}
