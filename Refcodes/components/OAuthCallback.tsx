import React, { useEffect, useState } from 'react';

interface OAuthCallbackProps {
  onLogin: (user: any) => void;
}

const OAuthCallback: React.FC<OAuthCallbackProps> = ({ onLogin }) => {
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
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
        const userInfo = await getUserInfoFromGAS(code);
        
        if (userInfo) {
          onLogin(userInfo);
          // URL에서 인증 코드 제거
          window.history.replaceState({}, document.title, window.location.pathname);
        } else {
          setError('Failed to get user information');
        }
      } catch (err: any) {
        setError(`Error processing OAuth callback: ${err.message}`);
      } finally {
        setIsProcessing(false);
      }
    };

    handleOAuthCallback();
  }, [onLogin]);

  const getUserInfoFromGAS = async (code: string) => {
    try {
      // Google Apps Script를 통해 OAuth 코드 처리
      const gasUrl = process.env.REACT_APP_GAS_URL || 'https://script.google.com/macros/s/AKfycbwx3YZD20ydlG9fgpb65Z1JiPMS_VpkiiD5iQqCKumjH5dJFVKBXKICuglBL2GxZ9QPHA/exec';
      console.log('OAuthCallback - Using GAS URL:', gasUrl); // GAS URL 로깅 추가

      if (!gasUrl) {
        throw new Error('REACT_APP_GAS_URL is not defined. Please check your .env.local file and restart the development server.');
      }
      
      const requestUrl = `${gasUrl}?action=processOAuth&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(window.location.origin)}`;
      console.log('OAuthCallback - Fetching processOAuth with URL:', requestUrl); // 요청 URL 로깅 추가

      const response = await fetch(requestUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to process OAuth with GAS. Status: ${response.status}. URL: ${requestUrl}`);
      }

      const userData = await response.json();
      
      if (userData.error) {
        const details = userData.checkedEmail ? ` (${userData.checkedEmail})` : '';
        throw new Error(`${userData.error}${details}`);
      }
      
      return {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        picture: userData.picture,
        role: userData.role,
      };
    } catch (error) {
      console.error('Error getting user info from GAS:', error);
      return null;
    }
  };

  if (isProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Processing login...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  return null;
};

export default OAuthCallback;
