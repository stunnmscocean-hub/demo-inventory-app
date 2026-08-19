import React, { useEffect } from 'react';
import useAuthStore from '../stores/authStore';
import { pingGAS } from '../services/api';
import GoogleOAuthButton from '../components/GoogleOAuthButton';
import styles from './LoginPage.module.css';

const LoginPage = () => {
  const { isLoading, loadingMessage } = useAuthStore();

  // 🔥 사용자가 로그인 페이지를 보고 있는 동안 GAS 서버 컨테이너를 미리 깨워둠 (Warm-up)
  useEffect(() => {
    pingGAS()
      .then(() => console.log('🔥 [Warm-up] GAS 서버 웜업 완료'))
      .catch((err) => console.log('🔥 [Warm-up] GAS 웜업 백그라운드 진행 중:', err.message));
  }, []);
  // Google OAuth 로그인만 사용 (기존 로그인 폼 비활성화)
  // const [id, setId] = useState('');
  // const [password, setPassword] = useState('');
  // const [error, setError] = useState('');
  // const [isTestingConnection, setIsTestingConnection] = useState(false);
  // const [isTestingAcl, setIsTestingAcl] = useState(false);
  // const [aclTestResult, setAclTestResult] = useState(null);
  // const navigate = useNavigate();
  
  // const { error: authError } = useAuthStore();

  // const handleLogin = (e) => {
  //   e.preventDefault();
  //   if (id === 'test' && password === '1234') {
  //     const userData = { 
  //       id: 'test-user',
  //       email: 'test@example.com',
  //       name: '테스트사용자',
  //       role: 'admin'
  //     };
  //     useAuthStore.getState().login(userData);
  //     navigate('/');
  //   } else {
  //     setError('아이디 또는 비밀번호가 올바르지 않습니다.');
  //   }
  // };

  // const testConnection = async () => {
  //   setIsTestingConnection(true);
  //   try {
  //     const pingResult = await pingGAS();
  //     console.log('Ping result:', pingResult);
  //     alert('GAS 연결 성공!');
  //   } catch (error) {
  //     console.error('Connection test failed:', error);
  //     alert(`연결 실패: ${error.message}`);
  //   } finally {
  //     setIsTestingConnection(false);
  //   }
  // };

  // const handleAclTest = async () => {
  //   setIsTestingAcl(true);
  //   setAclTestResult(null);
  //   try {
  //     const result = await testACL();
  //     console.log('ACL test result:', result);
  //     if (Array.isArray(result)) {
  //       if (result.length > 0) {
  //         setAclTestResult(result);
  //       } else {
  //         setAclTestResult('ACL 시트에 등록된 이메일이 없습니다.');
  //       }
  //     } else {
  //       setAclTestResult(`ACL 테스트 실패: ${result.message || '알 수 없는 오류'}`);
  //     }
  //   } catch (error) {
  //     console.error('ACL test failed:', error);
  //     setAclTestResult(`ACL 테스트 중 오류 발생: ${error.message}`);
  //   } finally {
  //     setIsTestingAcl(false);
  //   }
  // };

  return (
    <div className={styles.container}>
      <div className={styles.loginBox}>
        <h1 className={styles.title}>데모 장비 관리 시스템</h1>
        
        {/* 로딩 메시지 표시 */}
        {isLoading && loadingMessage && (
          <div className={styles.loadingMessage}>
            <div className={styles.loadingSpinner}></div>
            <p>{loadingMessage}</p>
          </div>
        )}
        
        {/* Google OAuth 로그인 */}
        <div className={styles.oauthSection}>
          <GoogleOAuthButton />
        </div>
        
        {/* 기존 로그인 폼 (주석처리 - Google OAuth만 사용) */}
        {/* 
        <div className={styles.divider}>
          <span>또는</span>
        </div>
        
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
        */}
        
        {/* 연결 테스트 버튼 (주석처리) */}
        {/* 
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
        */}

        {/* ACL 테스트 섹션 (주석처리) */}
        {/* 
        <div className={styles.testSection} style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
          <h3>ACL 권한 테스트 (모든 등록 이메일 조회)</h3>
          <button
            onClick={handleAclTest}
            disabled={isTestingAcl}
            className={`${styles.testButton} button-secondary`}
          >
            {isTestingAcl ? 'ACL 테스트 중...' : '모든 ACL 엔트리 조회'}
          </button>
          {aclTestResult && (
            <div className={styles.aclResult} style={{ marginTop: '10px', textAlign: 'left' }}>
              {Array.isArray(aclTestResult) ? (
                aclTestResult.length > 0 ? (
                  <ul>
                    {aclTestResult.map((entry, index) => (
                      <li key={index}>{entry.email} (역할: {entry.role})</li>
                    ))}
                  </ul>
                ) : (
                  <p>{aclTestResult}</p>
                )
              ) : (
                <p>{aclTestResult}</p>
              )}
            </div>
          )}
        </div>
        */}
      </div>
    </div>
  );
};

export default LoginPage;
