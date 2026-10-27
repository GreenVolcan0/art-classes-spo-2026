import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, usersApi } from '../api/api';
import { TOKEN_KEY, USER_KEY } from '../api/client';

const AuthContext = createContext(null);

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(() => readStoredUser());
  const [initializing, setInitializing] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)));

  // При старте приложения обновляем профиль по токену.
  // Если токен просрочен — интерцептор axios сам разлогинит и перенаправит на /login.
  useEffect(() => {
    if (!token) {
      setInitializing(false);
      return;
    }
    let cancelled = false;
    usersApi
      .me()
      .then((res) => {
        if (cancelled) return;
        setUser(res.data);
        localStorage.setItem(USER_KEY, JSON.stringify(res.data));
      })
      .catch(() => {
        /* 401 обработан интерцептором; сетевые ошибки не критичны */
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await authApi.login({ email, password });
    localStorage.setItem(TOKEN_KEY, data.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setToken(data.access_token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const { data } = await authApi.register(payload);
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const updateStoredUser = useCallback((freshUser) => {
    setUser(freshUser);
    localStorage.setItem(USER_KEY, JSON.stringify(freshUser));
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      initializing,
      login,
      register,
      logout,
      updateStoredUser,
      isClient: user?.role === 'client',
      isMaster: user?.role === 'master',
      isAdmin: user?.role === 'admin',
      isMasterApproved: user?.role === 'master' && user?.is_approved === true,
    }),
    [user, token, initializing, login, register, logout, updateStoredUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth должен вызываться внутри <AuthProvider>');
  return ctx;
}
