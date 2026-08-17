import { create } from 'zustand';
import type { User } from '../api/types';

interface AuthState {
  token: string | null;
  user: User | null;
  setSession: (token: string, user: User) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

const storedToken = localStorage.getItem('tahdani_token');
const storedUser = localStorage.getItem('tahdani_user');

export const useAuthStore = create<AuthState>((set) => ({
  token: storedToken,
  user: storedUser ? (JSON.parse(storedUser) as User) : null,
  setSession: (token, user) => {
    localStorage.setItem('tahdani_token', token);
    localStorage.setItem('tahdani_user', JSON.stringify(user));
    set({ token, user });
  },
  setUser: (user) => {
    localStorage.setItem('tahdani_user', JSON.stringify(user));
    set({ user });
  },
  logout: () => {
    localStorage.removeItem('tahdani_token');
    localStorage.removeItem('tahdani_user');
    set({ token: null, user: null });
  },
}));
