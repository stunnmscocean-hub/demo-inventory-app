import { useAuthStore } from '../stores/authStore';

const GAS_URL = process.env.REACT_APP_GAS_URL || 'https://script.google.com/macros/s/AKfycbwx3YZD20ydlG9fgpb65Z1JiPMS_VpkiiD5iQqCKumjH5dJFVKBXKICuglBL2GxZ9QPHA/exec';

// ===== Step 1: 기본 연결 테스트 =====
export const pingGAS = async () => {
  const response = await fetch(`${GAS_URL}?action=ping`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return await response.json();
};

// ===== Step 2: ACL 테스트 =====
export const testACL = async (email: string) => {
  const response = await fetch(`${GAS_URL}?action=testACL&email=${encodeURIComponent(email)}`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return await response.json();
};

// ===== Step 3: OAuth 처리 =====
export const processOAuth = async (code: string, redirectUri: string) => {
  const response = await fetch(
    `${GAS_URL}?action=processOAuth&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}`
  );
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error);
  }
  
  return data;
};

// ===== Step 4: Task 가져오기 (인증 필요) =====
export const fetchTasks = async (userEmail: string) => {
  if (!userEmail) {
    throw new Error('User email is required for fetching tasks.');
  }

  console.log('api.ts - Fetching tasks with email:', userEmail); // 이메일 로깅 추가
  console.log('api.ts - Using GAS URL:', GAS_URL); // GAS URL 로깅 추가
  const requestUrl = `${GAS_URL}?action=getTasks&email=${encodeURIComponent(userEmail)}`;
  console.log('api.ts - Fetching getTasks with URL:', requestUrl); // 요청 URL 로깅 추가

  const response = await fetch(requestUrl);
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}. URL: ${requestUrl}`); // 오류 메시지에 URL 추가
  }
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error);
  }
  
  return data;
};

// ===== Step 5: Authorization 헤더 사용 (옵션) =====
