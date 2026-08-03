import React, { useState, useEffect } from 'react';

// Google API 타입 정의
declare global {
  interface Window {
    google?: any;
  }
}

interface GoogleLoginProps {
  onLogin: (user: any) => void;
  onLogout: () => void;
  isLoggedIn: boolean;
}

const GoogleLogin: React.FC<GoogleLoginProps> = ({ onLogin, onLogout, isLoggedIn }) => {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Google OAuth 스크립트 로드
    const loadGoogleScript = () => {
      if (window.google) return;
      
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    };

    loadGoogleScript();
  }, []);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    
    try {
      // Google OAuth 2.0 인증 URL 생성
      const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || 'your-google-client-id-here';
      const redirectUri = window.location.origin;
      const scope = 'email profile';
      
      console.log('=== OAuth Debug ===');
      console.log('Client ID:', clientId);
      console.log('Redirect URI:', redirectUri);
      console.log('==================');
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent(scope)}&` +
        `access_type=offline&` +
        `prompt=select_account`;
      
      // 현재 창에서 Google 로그인으로 리다이렉트
      window.location.href = authUrl;
    } catch (error) {
      console.error('Google login error:', error);
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    onLogout();
  };

  if (isLoggedIn) {
    return (
      <div className="flex items-center gap-4">
        <span className="text-green-600">✓ 로그인됨</span>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <h2 className="text-xl font-bold">Google 로그인이 필요합니다</h2>
      <button
        onClick={handleGoogleLogin}
        disabled={isLoading}
        className="px-6 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {isLoading ? '로그인 중...' : 'Google로 로그인'}
      </button>
    </div>
  );
};

export default GoogleLogin;
