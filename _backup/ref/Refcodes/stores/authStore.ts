import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  role?: string;
}

interface AuthState {
  // 상태
  isAuthenticated: boolean;
  user: User | null;
  accessToken: string | null;
  
  // 액션
  setAccessToken: (token: string) => void;
  setUser: (user: User) => void;
  login: (user: User, accessToken?: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // 초기 상태
      isAuthenticated: false,
      user: null,
      accessToken: null,
      
      // 토큰만 설정
      setAccessToken: (token) => 
        set({ accessToken: token }),
      
      // 사용자만 설정
      setUser: (user) => 
        set({ 
          user,
          isAuthenticated: true 
        }),
      
      // 로그인 (사용자 + 토큰)
      login: (user, accessToken) => 
        set({ 
          user,
          accessToken: accessToken || null,
          isAuthenticated: true 
        }),
      
      // 로그아웃
      logout: () => 
        set({ 
          user: null,
          accessToken: null,
          isAuthenticated: false 
        }),
    }),
    {
      name: 'auth-storage', // localStorage 키 이름
    }
  )
);

