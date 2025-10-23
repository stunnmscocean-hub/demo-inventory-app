import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import useAuthStore from './stores/authStore';
import LoginPage from './pages/LoginPage';
import MainPage from './pages/MainPage';
import OAuthCallback from './components/OAuthCallback';
import './App.css';

function App() {
  const { isAuthenticated, user, logout, checkTokenExpiry, initializeFromStorage } = useAuthStore();

  // 앱 초기화 시 인증 상태 확인
  useEffect(() => {
    const initializeAuth = () => {
      console.log('App initialized, checking auth state...');
      console.log('Current isAuthenticated:', isAuthenticated);
      console.log('Current user:', user);
      
      // localStorage에서 인증 상태 복원 확인
      const authData = localStorage.getItem('auth-storage');
      console.log('Raw localStorage data:', authData);
      
      if (authData) {
        try {
          const parsed = JSON.parse(authData);
          console.log('Parsed localStorage data:', parsed);
          
          // 토큰 만료 검증 (인증된 상태일 때만)
          if (parsed.state && parsed.state.isAuthenticated && parsed.state.accessToken) {
            console.log('Checking token expiry...');
            checkTokenExpiry();
          }
        } catch (error) {
          console.error('Failed to parse auth data from localStorage:', error);
        }
      }
    };

    // 약간의 지연을 두고 초기화 (Zustand persist가 완료된 후)
    const timer = setTimeout(() => {
      initializeAuth();
      // 수동 초기화도 시도
      initializeFromStorage();
    }, 100);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkTokenExpiry, initializeFromStorage]); // isAuthenticated와 user는 초기화 시에만 실행되도록 의도적으로 제외

  // 주기적 토큰 만료 검증 (5분마다)
  useEffect(() => {
    if (isAuthenticated) {
      const interval = setInterval(() => {
        checkTokenExpiry();
      }, 5 * 60 * 1000); // 5분

      return () => clearInterval(interval);
    }
  }, [isAuthenticated, checkTokenExpiry]);

  // 로딩 상태는 제거 (Zustand persist가 자동으로 처리)

  return (
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID}>
      <Router>
        <Routes>
          <Route 
            path="/login" 
            element={isAuthenticated ? <Navigate to="/" /> : <LoginPage />} 
          />
          <Route 
            path="/oauth/callback" 
            element={<OAuthCallback />} 
          />
          <Route 
            path="/" 
            element={isAuthenticated ? <MainPage user={user} onLogout={logout} /> : <Navigate to="/login" />} 
          />
        </Routes>
      </Router>
    </GoogleOAuthProvider>
  );
}

export default App;
