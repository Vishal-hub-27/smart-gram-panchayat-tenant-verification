import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);

const TOKEN_KEY = 'gp_token';
const USER_KEY = 'gp_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true); // true while checking existing session on mount

  // On mount, if a token exists, validate it against the server and
  // restore the session instead of trusting stale localStorage data.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }

    authService
      .getMe()
      .then((res) => {
        setUser(res.data.user);
        setProfile(res.data.profile);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      })
      .finally(() => setLoading(false));
  }, []);

  const persistSession = (data) => {
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setUser(data.user);
    setProfile(data.profile);
  };

  const login = useCallback(async (phone, password) => {
    const res = await authService.login(phone, password);
    persistSession(res.data);
    return res.data.user;
  }, []);

  const register = useCallback(async (formData) => {
    return authService.register(formData);
  }, []);

  const sendOtp = useCallback(async (phone) => {
    return authService.sendOtp(phone);
  }, []);

  const verifyOtp = useCallback(async (phone, otp) => {
    const res = await authService.verifyOtp(phone, otp);
    persistSession(res.data);
    return res.data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setProfile(null);
  }, []);

  const value = {
    user,
    profile,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    sendOtp,
    verifyOtp,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
