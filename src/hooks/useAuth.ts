import { useState, useEffect, useCallback } from 'react';
import { getToken, setToken, clearToken, fetchWithAuth } from '../lib/auth';

export interface User {
  id: string;
  email?: string;
  nickname?: string;
  roles: string[];
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 从 cookie 读取 OAuth 回调带来的 token（一次性）
    const cookieMatch = document.cookie.match(/auth_token=([^;]+)/);
    if (cookieMatch) {
      setToken(cookieMatch[1]);
      document.cookie = 'auth_token=; Path=/; Max-Age=0';
    }
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    fetchWithAuth('/api/auth/profile')
      .then((res) => {
        if (!res.ok) {
          clearToken();
          setUser(null);
          return;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
        } else {
          clearToken();
          setUser(null);
        }
      })
      .catch(() => {
        clearToken();
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = useCallback(() => {
    window.location.href = '/api/auth/login';
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return {
    user,
    isLoading,
    isLoggedIn: !!user,
    login,
    logout,
  };
}