import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import useAuthStore from './stores/authStore';
import LoginPage from './pages/LoginPage';
import MainPage from './pages/MainPage';
import QrPrintPage from './pages/QrPrintPage';
import InventoryAuditPage from './pages/InventoryAuditPage';
import OAuthCallback from './components/OAuthCallback';
import './App.css';

// 🔒 QR 쿼리 파라미터 동기적 보존 및 로그인 전용 라우터
const ProtectedRoute = ({ isAuthenticated, children }) => {
  const location = useLocation();

  if (!isAuthenticated) {
    // 렌더링 시점에 동기적으로 QR 파라미터(?action=apply...) 보존
    const search = location.search || window.location.search;
    if (search && (search.includes('action=') || search.includes('serial='))) {
      console.log('📱 [ProtectedRoute] 미로그인 상태 QR 쿼리 보존:', search);
      sessionStorage.setItem('pending_qr_params', search);
    }
    return <Navigate to="/login" replace />;
  }

  // 로그인 성공 시 보존된 QR 쿼리 파라미터 복원 리디렉션
  const pendingParams = sessionStorage.getItem('pending_qr_params');
  if (pendingParams) {
    console.log('📱 [ProtectedRoute] 로그인 성공 - QR 쿼리 복원:', pendingParams);
    sessionStorage.removeItem('pending_qr_params');
    const targetUrl = pendingParams.startsWith('/') ? pendingParams : `/${pendingParams}`;
    return <Navigate to={targetUrl} replace />;
  }

  return children;
};

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
  }, [checkTokenExpiry, initializeFromStorage]);

  // 주기적 토큰 만료 검증 (5분마다)
  useEffect(() => {
    if (isAuthenticated) {
      const interval = setInterval(() => {
        checkTokenExpiry();
      }, 5 * 60 * 1000); // 5분

      return () => clearInterval(interval);
    }
  }, [isAuthenticated, checkTokenExpiry]);

  return (
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID}>
      <Router>
        <Routes>
          <Route 
            path="/login" 
            element={
              isAuthenticated ? (
                <Navigate to={sessionStorage.getItem('pending_qr_params') ? (sessionStorage.getItem('pending_qr_params').startsWith('/') ? sessionStorage.getItem('pending_qr_params') : `/${sessionStorage.getItem('pending_qr_params')}`) : "/"} replace />
              ) : (
                <LoginPage />
              )
            } 
          />
          <Route 
            path="/oauth/callback" 
            element={<OAuthCallback />} 
          />
          <Route 
            path="/qr-print" 
            element={<QrPrintPage />} 
          />
          <Route 
            path="/audit" 
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <InventoryAuditPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/" 
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <MainPage user={user} onLogout={logout} />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </Router>
    </GoogleOAuthProvider>
  );
}

export default App;
