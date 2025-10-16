import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import { getUserInfo } from '../services/api';

const OAuthCallback = () => {
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  
  const { login, setLoading, setAuthError } = useAuthStore();

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        setLoading(true);
        
        // URL에서 인증 코드 추출
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');

        if (error) {
          setError(`OAuth error: ${error}`);
          setIsProcessing(false);
          return;
        }

        if (!code) {
          setError('No authorization code received');
          setIsProcessing(false);
          return;
        }

        // Google Apps Script를 통해 사용자 정보 가져오기
        const userInfo = await getUserInfo(code, window.location.origin);
        
        if (userInfo) {
          login(userInfo);
          // URL에서 인증 코드 제거
          window.history.replaceState({}, document.title, window.location.pathname);
          navigate('/');
        } else {
          setError('Failed to get user information');
        }
      } catch (err) {
        console.error('OAuth callback error:', err);
        setError(`Error processing OAuth callback: ${err.message}`);
      } finally {
        setIsProcessing(false);
        setLoading(false);
      }
    };

    handleOAuthCallback();
  }, [login, setLoading, setAuthError, navigate]);

  if (isProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">Processing login...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-600 text-lg mb-4">Error: {error}</div>
          <button 
            onClick={() => navigate('/login')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default OAuthCallback;
