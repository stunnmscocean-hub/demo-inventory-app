import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './LoginPage.module.css';

const LoginPage = ({ onLogin }) => {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    // --- API 호출: 로그인 인증 (현재는 하드코딩된 값으로 시뮬레이션) ---
    if (id === 'test' && password === '1234') {
      const userData = { name: '테스트사용자' }; // 실제로는 서버로부터 사용자 정보를 받음
      onLogin(userData);
      navigate('/');
    } else {
      setError('아이디 또는 비밀번호가 올바르지 않습니다.');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.loginBox}>
        <h1 className={styles.title}>데모 장비 관리 시스템</h1>
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
        <p className={styles.error}>{error}</p>
      </div>
    </div>
  );
};

export default LoginPage;
