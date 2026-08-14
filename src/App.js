import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import useAuthStore from './stores/authStore';
import LoginPage from './pages/LoginPage';
import MainPage from './pages/MainPage';
import QrPrintPage from './pages/QrPrintPage';
import LabelPrintPage from './pages/LabelPrintPage';
import InventoryAuditPage from './pages/InventoryAuditPage';
import OAuthCallback from './components/OAuthCallback';
import './App.css';

// 🔒 QR 쿼리 파라미터 동기적 보존 및 로그인 전용 라우터
const ProtectedRoute = ({ isAuthenticated, isInitializing, children }) => {
  const location = useLocation();

  if (isInitializing) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc', color: '#64748b' }}>⏳ 로그인 상태 확인 중...</div>;
  }

  if (!isAuthenticated) {
    // 렌더링 시점에 동기적으로 QR 파라미터(?action=apply...) 보존
    const search = location.search || window.location.search;
    if (search && (search.includes('action=') || search.includes('serial='))) {
      console.log('📱 [ProtectedRoute] 미로그인 상태 QR 쿼리 보존:', search);
      sessionStorage.setItem('pending_qr_params', search);
    }
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  const { isAuthenticated, user, logout, checkTokenExpiry, initializeFromStorage } = useAuthStore();
  const [isInitializing, setIsInitializing] = useState(true);

  // 앱 초기화 시 인증 상태 확인
  useEffect(() => {
    initializeFromStorage();
    setIsInitializing(false);

    if (isAuthenticated) {
      checkTokenExpiry();
    }
  }, [initializeFromStorage, checkTokenExpiry, isAuthenticated]);

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
            path="/label-print" 
            element={<LabelPrintPage />} 
          />
          <Route 
            path="/qr-print" 
            element={<QrPrintPage />} 
          />
          <Route 
            path="/audit" 
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated} isInitializing={isInitializing}>
                <InventoryAuditPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/" 
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated} isInitializing={isInitializing}>
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
