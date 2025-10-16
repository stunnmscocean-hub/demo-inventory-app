// axios import removed - using fetch instead

// Google Apps Script 배포 URL (.env.local에서 읽어옴)
const GAS_URL = process.env.REACT_APP_GAS_URL || 'https://script.google.com/macros/s/AKfycbyX8DtKe0BGugzw-Ycs6jsEP733UmidYWAi2DK0tftJbYwTYC1mMyMiIyfh_LsPeis3/exec';
const GAS_URL2 = process.env.REACT_APP_GAS_URL2;

// ===== Step 1: 기본 연결 테스트 =====
export const pingGAS = async () => {
  try {
    const response = await fetch(`${GAS_URL}?action=ping`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Ping GAS error:', error);
    throw new Error(`Failed to connect to GAS: ${error.message}`);
  }
};

// ===== Step 2: ACL 테스트 (단일 이메일) - CORS 문제로 인해 사용 중단, 전체 목록 조회로 대체 =====
// export const testACL = async (email) => {
//   try {
//     const response = await fetch(`${GAS_URL}?action=testACL&email=${encodeURIComponent(email)}`);
//     if (!response.ok) {
//       throw new Error(`HTTP error! status: ${response.status}`);
//     }
//     return await response.json();
//   } catch (error) {
//     console.error('Test ACL error:', error);
//     throw new Error(`Failed to test ACL: ${error.message}`);
//   }
// };

// ===== Step 2-1: 모든 ACL 엔트리 가져오기 =====
export const getAllAclEntries = async () => {
  try {
    const response = await fetch(`${GAS_URL}?action=getAllAclEntries`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    if (data.success === false) {
      throw new Error(data.message || data.error);
    }
    return data.data.entries || [];
  } catch (error) {
    console.error('Get All ACL Entries error:', error);
    throw new Error(`Failed to get all ACL entries: ${error.message}`);
  }
};

// ACL 테스트 함수를 getAllAclEntries로 대체
export const testACL = async () => {
  return await getAllAclEntries();
};

// ===== Step 3: OAuth 처리 (JWT 토큰) =====
export const processOAuth = async (jwtToken, redirectUri) => {
  try {
    const response = await fetch(
      `${GAS_URL}?action=processOAuth&jwt_token=${encodeURIComponent(jwtToken)}&redirect_uri=${encodeURIComponent(redirectUri)}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('GAS response:', data);
    
    if (data.success === false) {
      throw new Error(data.message || data.error);
    }
    
    // GAS 응답에서 사용자 정보 추출
    return data.data || data;
  } catch (error) {
    console.error('Process OAuth error:', error);
    throw new Error(`Failed to process OAuth: ${error.message}`);
  }
};

// ===== Step 3-1: 기존 OAuth 처리 (인증 코드) =====
export const processOAuthWithCode = async (code, redirectUri) => {
  try {
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

    const response = await fetch(requestUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    return data;
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
    const response = await fetch(`${GAS_URL}?action=getEquipmentData`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success === false) {
      throw new Error(data.message || data.error);
    }
    
    return data.data || data;
  } catch (error) {
    console.error('Get equipment data error:', error);
    throw new Error(`Failed to get equipment data: ${error.message}`);
  }
};

// ===== 장비 시트 초기화 =====
export const initializeEquipmentSheet = async () => {
  try {
    const response = await fetch(`${GAS_URL}?action=initializeEquipmentSheet`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success === false) {
      throw new Error(data.message || data.error);
    }
    
    return data.data || data;
  } catch (error) {
    console.error('Initialize equipment sheet error:', error);
    throw new Error(`Failed to initialize equipment sheet: ${error.message}`);
  }
};

// ===== 파트너 데이터 조회 =====
export const getPartnerData = async () => {
  try {
    const response = await fetch(`${GAS_URL}?action=getPartnerData`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success === false) {
      throw new Error(data.message || data.error);
    }
    
    return data.data || data;
  } catch (error) {
    console.error('Get partner data error:', error);
    throw new Error(`Failed to get partner data: ${error.message}`);
  }
};

// ===== 초기 데이터 조회 (장비 + 파트너 데이터 통합) =====
export const getInitialData = async () => {
  try {
    const response = await fetch(`${GAS_URL}?action=getInitialData`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success === false) {
      throw new Error(data.message || data.error);
    }
    
    return data.data || data;
  } catch (error) {
    console.error('Get initial data error:', error);
    throw new Error(`Failed to get initial data: ${error.message}`);
  }
};

// ===== 시트 데이터 테스트 =====
export const testSheetData = async () => {
  try {
    const response = await fetch(`${GAS_URL}?action=testSheetData`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Test sheet data response:', data);
    return data;
  } catch (error) {
    console.error('Test sheet data error:', error);
    throw new Error(`Failed to test sheet data: ${error.message}`);
  }
};

// ===== 장비 데이터 추가 =====
export const addEquipment = async (equipmentData) => {
  try {
    const response = await fetch(`${GAS_URL}?action=addEquipment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(equipmentData)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success === false) {
      throw new Error(data.message || data.error);
    }
    
    return data.data || data;
  } catch (error) {
    console.error('Add equipment error:', error);
    throw new Error(`Failed to add equipment: ${error.message}`);
  }
};

// ===== 파트너 데이터 추가 =====
export const addPartner = async (partnerData) => {
  try {
    const response = await fetch(`${GAS_URL}?action=addPartner`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(partnerData)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success === false) {
      throw new Error(data.message || data.error);
    }
    
    return data.data || data;
  } catch (error) {
    console.error('Add partner error:', error);
    throw new Error(`Failed to add partner: ${error.message}`);
  }
};

// ===== 시트 입력 서비스 API 함수들 =====

// 시트 입력 서비스 핑 테스트 (REACT_APP_GAS_URL2 사용)
export const pingSheetInputService = async () => {
  if (!GAS_URL2) {
    throw new Error('REACT_APP_GAS_URL2 is not configured');
  }
  
  try {
    const response = await fetch(`${GAS_URL2}?action=ping`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Ping sheet input service error:', error);
    throw new Error(`Failed to connect to sheet input service: ${error.message}`);
  }
};

// 시트1에 장비 데이터 추가 (REACT_APP_GAS_URL2 사용)
export const addEquipmentToSheet = async (equipmentData) => {
  if (!GAS_URL2) {
    throw new Error('REACT_APP_GAS_URL2 is not configured');
  }
  
  try {
    const response = await fetch(`${GAS_URL2}?action=addEquipment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(equipmentData)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success === false) {
      throw new Error(data.error?.message || data.message);
    }
    
    return data.data || data;
  } catch (error) {
    console.error('Add equipment to sheet error:', error);
    throw new Error(`Failed to add equipment to sheet: ${error.message}`);
  }
};

// 파트너정보 시트에 파트너 데이터 추가 (REACT_APP_GAS_URL2 사용)
export const addPartnerToSheet = async (partnerData) => {
  if (!GAS_URL2) {
    throw new Error('REACT_APP_GAS_URL2 is not configured');
  }
  
  try {
    const response = await fetch(`${GAS_URL2}?action=addPartner`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(partnerData)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success === false) {
      throw new Error(data.error?.message || data.message);
    }
    
    return data.data || data;
  } catch (error) {
    console.error('Add partner to sheet error:', error);
    throw new Error(`Failed to add partner to sheet: ${error.message}`);
  }
};
