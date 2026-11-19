import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { LoginCredentials, RegisterPayload, Role, User } from '../types/auth';
import { fetchCurrentUser, loginUser, registerUser, switchUserRole, updateUserAvatar } from '../lib/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  logout: () => void;
  switchRole: (role: Role) => Promise<void>;
  updateAvatar: (avatarUrl: string) => Promise<void>;
}

const TOKEN_KEY = 'gotogether_token';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadUser() {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const { user: profile } = await fetchCurrentUser(storedToken);
        setUser(profile);
        setToken(storedToken);
      } catch (error) {
        console.warn('Session expired or invalid token:', error);
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    const res = await loginUser(credentials);
    localStorage.setItem(TOKEN_KEY, res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const register = async (data: RegisterPayload) => {
    const res = await registerUser(data);
    localStorage.setItem(TOKEN_KEY, res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  const handleSwitchRole = async (role: Role) => {
    if (!token) return;
    const res = await switchUserRole(role, token);
    localStorage.setItem(TOKEN_KEY, res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const handleUpdateAvatar = async (avatarUrl: string) => {
    if (token) {
      try {
        const res = await updateUserAvatar(avatarUrl, token);
        setUser(res.user);
        return;
      } catch (err) {
        console.warn('Backend avatar update failed, updating locally:', err);
      }
    }
    // Optimistic fallback for demo / current session
    setUser((prev) => (prev ? { ...prev, avatarUrl } : null));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(user && token),
        isLoading,
        login,
        register,
        logout,
        switchRole: handleSwitchRole,
        updateAvatar: handleUpdateAvatar,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
