import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import { getGoogleOAuthUrl, pingGAS, testACL } from '../services/api';
import GoogleOAuthButton from '../components/GoogleOAuthButton';
import styles from './LoginPage.module.css';

const LoginPage = () => {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const navigate = useNavigate();
  
  const { setLoading, setError: setAuthError, error: authError } = useAuthStore();

  const handleLogin = (e) => {
    e.preventDefault();
    // --- API 호출: 로그인 인증 (현재는 하드코딩된 값으로 시뮬레이션) ---
    if (id === 'test' && password === '1234') {
      const userData = { 
        id: 'test-user',
        email: 'test@example.com',
        name: '테스트사용자',
        role: 'admin'
      };
      useAuthStore.getState().login(userData);
      navigate('/');
    } else {
      setError('아이디 또는 비밀번호가 올바르지 않습니다.');
    }
  };

  const handleGoogleLogin = () => {
    setLoading(true);
    window.location.href = getGoogleOAuthUrl();
  };

  const testConnection = async () => {
    setIsTestingConnection(true);
    try {
      const pingResult = await pingGAS();
      console.log('Ping result:', pingResult);
      alert('GAS 연결 성공!');
    } catch (error) {
      console.error('Connection test failed:', error);
      alert(`연결 실패: ${error.message}`);
    } finally {
      setIsTestingConnection(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.loginBox}>
        <h1 className={styles.title}>데모 장비 관리 시스템</h1>
        
        {/* Google OAuth 로그인 */}
        <div className={styles.oauthSection}>
          <GoogleOAuthButton />
        </div>
        
        <div className={styles.divider}>
          <span>또는</span>
        </div>
        
        {/* 기존 로그인 폼 */}
        <form onSubmit={handleLogin} className={styles.form}>
          <input
            type="text"
            placeholder="아이디 (test)"
            value={id}
            onChange={(e) => setId(e.target.value)}
            className={styles.input}
          />
          <input
            type="password"
            placeholder="비밀번호 (1234)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={styles.input}
          />
          <button type="submit" className={`${styles.loginButton} button-primary`}>
            로그인
          </button>
        </form>
        
        {/* 연결 테스트 버튼 */}
        <div className={styles.testSection}>
          <button 
            onClick={testConnection}
            disabled={isTestingConnection}
            className={styles.testButton}
          >
            {isTestingConnection ? '연결 테스트 중...' : 'GAS 연결 테스트'}
          </button>
        </div>
        
        <p className={styles.error}>{error || authError}</p>
        {console.log('LoginPage error state:', { error, authError })}
      </div>
    </div>
  );
};

export default LoginPage;
