import axios from 'axios';

const GAS_URL = process.env.REACT_APP_GAS_URL || 'https://script.google.com/macros/s/AKfycbwx3YZD20ydlG9fgpb65Z1JiPMS_VpkiiD5iQqCKumjH5dJFVKBXKICuglBL2GxZ9QPHA/exec';

// ===== Step 1: 기본 연결 테스트 =====
export const pingGAS = async () => {
  try {
    const response = await axios.get(`${GAS_URL}?action=ping`);
    return response.data;
  } catch (error) {
    console.error('Ping GAS error:', error);
    throw new Error(`Failed to connect to GAS: ${error.message}`);
  }
};

// ===== Step 2: ACL 테스트 =====
export const testACL = async (email) => {
  try {
    const response = await axios.get(`${GAS_URL}?action=testACL&email=${encodeURIComponent(email)}`);
    return response.data;
  } catch (error) {
    console.error('Test ACL error:', error);
    throw new Error(`Failed to test ACL: ${error.message}`);
  }
};

// ===== Step 3: OAuth 처리 (JWT 토큰) =====
export const processOAuth = async (jwtToken, redirectUri) => {
  try {
    const response = await axios.get(
      `${GAS_URL}?action=processOAuth&jwt_token=${encodeURIComponent(jwtToken)}&redirect_uri=${encodeURIComponent(redirectUri)}`
    );
    
    console.log('GAS response:', response.data);
    
    if (response.data.success === false) {
      throw new Error(response.data.message || response.data.error);
    }
    
    // GAS 응답에서 사용자 정보 추출
    return response.data.data || response.data;
  } catch (error) {
    console.error('Process OAuth error:', error);
    throw new Error(`Failed to process OAuth: ${error.message}`);
  }
};

// ===== Step 3-1: 기존 OAuth 처리 (인증 코드) =====
export const processOAuthWithCode = async (code, redirectUri) => {
  try {
    const response = await axios.get(
      `${GAS_URL}?action=processOAuth&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}`
    );
    
    if (response.data.error) {
      throw new Error(response.data.error);
    }
    
    return response.data;
  } catch (error) {
    console.error('Process OAuth error:', error);
    throw new Error(`Failed to process OAuth: ${error.message}`);
  }
};

// ===== Step 4: Task 가져오기 (인증 필요) =====
export const fetchTasks = async (userEmail) => {
  if (!userEmail) {
    throw new Error('User email is required for fetching tasks.');
  }

  try {
    console.log('api.js - Fetching tasks with email:', userEmail);
    console.log('api.js - Using GAS URL:', GAS_URL);
    
    const requestUrl = `${GAS_URL}?action=getTasks&email=${encodeURIComponent(userEmail)}`;
    console.log('api.js - Fetching getTasks with URL:', requestUrl);

    const response = await axios.get(requestUrl);
    
    if (response.data.error) {
      throw new Error(response.data.error);
    }
    
    return response.data;
  } catch (error) {
    console.error('Fetch tasks error:', error);
    throw new Error(`Failed to fetch tasks: ${error.message}`);
  }
};

// ===== Google OAuth URL 생성 =====
export const getGoogleOAuthUrl = () => {
  const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || '378338099409-as7m74dg2v9adep2gq8ghs5csla601c0.apps.googleusercontent.com';
  const redirectUri = `${window.location.origin}/oauth/callback`;
  
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent'
  });
  
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

// ===== 사용자 정보 가져오기 =====
export const getUserInfo = async (code, redirectUri) => {
  try {
    const userData = await processOAuth(code, redirectUri);
    
    if (userData.error) {
      throw new Error(userData.error);
    }
    
    return {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      picture: userData.picture,
      role: userData.role,
    };
  } catch (error) {
    console.error('Get user info error:', error);
    throw error;
  }
};

// ===== 장비 데이터 조회 =====
export const getEquipmentData = async () => {
  try {
    const response = await axios.get(`${GAS_URL}?action=getEquipmentData`);
    
    if (response.data.success === false) {
      throw new Error(response.data.message || response.data.error);
    }
    
    return response.data.data || response.data;
  } catch (error) {
    console.error('Get equipment data error:', error);
    throw new Error(`Failed to get equipment data: ${error.message}`);
  }
};

// ===== 장비 시트 초기화 =====
export const initializeEquipmentSheet = async () => {
  try {
    const response = await axios.get(`${GAS_URL}?action=initializeEquipmentSheet`);
    
    if (response.data.success === false) {
      throw new Error(response.data.message || response.data.error);
    }
    
    return response.data.data || response.data;
  } catch (error) {
    console.error('Initialize equipment sheet error:', error);
    throw new Error(`Failed to initialize equipment sheet: ${error.message}`);
  }
};

// ===== 파트너 데이터 조회 =====
export const getPartnerData = async () => {
  try {
    const response = await axios.get(`${GAS_URL}?action=getPartnerData`);
    
    if (response.data.success === false) {
      throw new Error(response.data.message || response.data.error);
    }
    
    return response.data.data || response.data;
  } catch (error) {
    console.error('Get partner data error:', error);
    throw new Error(`Failed to get partner data: ${error.message}`);
  }
};

// ===== 시트 데이터 테스트 =====
export const testSheetData = async () => {
  try {
    const response = await axios.get(`${GAS_URL}?action=testSheetData`);
    
    console.log('Test sheet data response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Test sheet data error:', error);
    throw new Error(`Failed to test sheet data: ${error.message}`);
  }
};
