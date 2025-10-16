import React from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import useAuthStore from '../stores/authStore';
import { processOAuth } from '../services/api';

const GoogleOAuthButton = () => {
  const { login, setLoading, setError } = useAuthStore();

  const handleSuccess = async (credentialResponse) => {
    try {
      setLoading(true);
      setError(null); // 이전 에러 메시지 초기화
      console.log('Google OAuth credential received:', credentialResponse);
      
      // 실제 GAS 서버를 통한 OAuth 처리 (ACL 권한 확인 포함)
      const response = await processOAuth(credentialResponse.credential, window.location.origin);
      
      if (response && response.email) {
        const userInfo = {
          id: response.sub || response.id,
          email: response.email,
          name: response.name,
          picture: response.picture,
          role: response.role || 'viewer'
        };
        
        // JWT 토큰을 accessToken으로 저장
        login(userInfo, credentialResponse.credential);
        console.log('User logged in successfully:', userInfo);
        console.log('Access token stored:', credentialResponse.credential ? 'yes' : 'no');
      } else {
        throw new Error('Failed to get user information from GAS');
      }
    } catch (error) {
      console.error('OAuth login error:', error);
      
      // 에러 메시지 개선
      let errorMessage = '로그인에 실패했습니다.';
      
      if (error.message.includes('Access denied') || error.message.includes('unauthorized')) {
        errorMessage = '접근 권한이 없습니다. 관리자에게 문의하세요.';
      } else if (error.message.includes('Failed to process OAuth')) {
        errorMessage = '인증 처리 중 오류가 발생했습니다. 다시 시도해주세요.';
      } else if (error.message.includes('Failed to get user information')) {
        errorMessage = '사용자 정보를 가져올 수 없습니다. 다시 시도해주세요.';
      }
      
      setError(errorMessage);
      console.log('Setting error message:', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleError = (error) => {
    console.error('Google OAuth error:', error);
    setError('Google OAuth login failed');
  };

  return (
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID}>
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={handleError}
        useOneTap={false}
        theme="outline"
        size="large"
        width="100%"
        text="signin_with"
        shape="rectangular"
      />
    </GoogleOAuthProvider>
  );
};

export default GoogleOAuthButton;
