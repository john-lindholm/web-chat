import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User } from '../types/index.js';
import { authApi } from '../lib/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for token in URL (from OAuth callback)
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (token) {
      localStorage.setItem('token', token);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Fetch user if token exists (from localStorage or cookie)
    const storedToken = localStorage.getItem('token');

    if (storedToken) {
      authApi
        .getMe()
        .then((res) => setUser(res.data))
        .catch(() => {
          localStorage.removeItem('token');
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = () => {
    // Redirect to Google OAuth
    const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
    const params = new URLSearchParams({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
      redirect_uri: import.meta.env.VITE_GOOGLE_REDIRECT_URI || 'http://localhost:4000/auth/google/callback',
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
    });

    window.location.href = `${GOOGLE_AUTH_URL}?${params.toString()}`;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    authApi.logout().catch(() => {}); // Best effort
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
