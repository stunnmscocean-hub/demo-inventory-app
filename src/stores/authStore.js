import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { jwtDecode } from 'jwt-decode';

const useAuthStore = create(
  persist(
    (set, get) => ({
      // 상태
      isAuthenticated: false,
      user: null,
      accessToken: null,
      isLoading: false,
      error: null,
      
      // 액션
      setUser: (user) => 
        set({ 
          user,
          isAuthenticated: true,
          error: null
        }),
      
      setAccessToken: (token) => 
        set({ accessToken: token }),
      
      login: (user, accessToken) => {
        console.log('AuthStore login called with:', { user, accessToken: accessToken ? 'exists' : 'null' });
        set({ 
          user,
          accessToken: accessToken || null,
          isAuthenticated: true,
          error: null
        });
        console.log('AuthStore state after login:', get());
      },
      
      logout: () => 
        set({ 
          user: null,
          accessToken: null,
          isAuthenticated: false,
          error: null
        }),
      
      setLoading: (loading) => 
        set({ isLoading: loading }),
      
      setError: (error) => 
        set({ error }),
      
      clearError: () => 
        set({ error: null }),
      
      // authError 별칭 추가
      get authError() {
        return get().error;
      },

      // 토큰 만료 검증
      validateToken: () => {
        const { accessToken } = get();
        if (!accessToken) return false;
        
        try {
          const decoded = jwtDecode(accessToken);
          const currentTime = Date.now() / 1000;
          return decoded.exp > currentTime;
        } catch (error) {
          console.error('Token validation error:', error);
          return false;
        }
      },

      // 자동 로그아웃 (토큰 만료 시)
      checkTokenExpiry: () => {
        const { validateToken, logout, accessToken } = get();
        console.log('Checking token expiry, current token:', accessToken ? 'exists' : 'null');
        
        if (accessToken && !validateToken()) {
          console.log('Token expired, logging out...');
          logout();
        } else if (accessToken) {
          console.log('Token is valid');
        }
      },

      // localStorage 수동 초기화 (디버깅용)
      initializeFromStorage: () => {
        const { isAuthenticated } = get();
        // 이미 인증된 상태면 스킵
        if (isAuthenticated) {
          console.log('Already authenticated, skipping storage initialization');
          return;
        }
        
        const authData = localStorage.getItem('auth-storage');
        console.log('Manual storage check:', authData);
        if (authData) {
          try {
            const parsed = JSON.parse(authData);
            console.log('Parsed storage data:', parsed);
            if (parsed.state && parsed.state.isAuthenticated && parsed.state.user) {
              console.log('Restoring from storage...');
              set({
                isAuthenticated: parsed.state.isAuthenticated,
                user: parsed.state.user,
                accessToken: parsed.state.accessToken
              });
            }
          } catch (error) {
            console.error('Failed to parse storage data:', error);
          }
        }
      },
    }),
    {
      name: 'auth-storage', // localStorage 키 이름
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        accessToken: state.accessToken,
      }),
      // 수동으로 hydration 처리
      onRehydrateStorage: () => (state) => {
        console.log('Auth store rehydrated:', state);
      },
    }
  )
);

export default useAuthStore;
