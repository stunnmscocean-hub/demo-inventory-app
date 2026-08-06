// axios import removed - using fetch instead

// Google Apps Script 배포 URL (.env.local에서 읽어옴)
const GAS_URL = process.env.REACT_APP_GAS_URL || 'https://script.google.com/macros/s/AKfycbxMBYAV9wZXg4I0pYVG_HC5Tw5oxhLwjPA0Jb2e1tJx-1DopQJCMPiSlf_aZzb1K8VV/exec';

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

// ===== 내 데모 현황 조회 (특정 사용자의 대여 중인 장비) =====
export const getMyDemoData = async (userName) => {
  try {
    console.log(`getMyDemoData 호출: 사용자=${userName}`);
    
    if (!userName) {
      throw new Error('사용자 이름이 필요합니다.');
    }
    
    const response = await fetch(`${GAS_URL}?action=getMyDemoData&userName=${encodeURIComponent(userName)}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('getMyDemoData 응답:', data);
    
    if (data.success === false) {
      throw new Error(data.message || data.error);
    }
    
    // GAS 응답 구조: { success: true, data: [...], count: 5, userName: 'xxx' }
    // data.data가 배열인지 확인하고, 중첩 구조 처리
    let actualData = [];
    let actualCount = 0;
    let actualUserName = userName;
    
    if (Array.isArray(data.data)) {
      // 정상 구조: data.data가 배열
      actualData = data.data;
      actualCount = data.count || data.data.length;
      actualUserName = data.userName || userName;
    } else if (data.data && typeof data.data === 'object' && Array.isArray(data.data.data)) {
      // 중첩 구조: data.data.data가 배열 (이중 래핑)
      console.log('⚠️ 중첩된 응답 구조 감지, 언래핑 중...');
      actualData = data.data.data;
      actualCount = data.data.count || data.data.data.length;
      actualUserName = data.data.userName || userName;
    } else {
      console.error('예상치 못한 응답 구조:', data);
    }
    
    console.log('📊 최종 데이터:', {
      dataLength: actualData.length,
      count: actualCount,
      userName: actualUserName
    });
    
    return {
      data: actualData,
      count: actualCount,
      userName: actualUserName
    };
  } catch (error) {
    console.error('Get my demo data error:', error);
    throw new Error(`Failed to get my demo data: ${error.message}`);
  }
};

// ===== 장비 반납 (히스토리 추가) =====
export const returnEquipment = async (equipmentData) => {
  try {
    if (!equipmentData) {
      throw new Error('장비 데이터가 필요합니다.');
    }

    const now = new Date();
    const timestampStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const dataWithTimestamp = {
      ...equipmentData,
      processedAt: equipmentData.processedAt || timestampStr,
      timestamp: equipmentData.timestamp || timestampStr,
      '처리시간스탬프': equipmentData['처리시간스탬프'] || timestampStr
    };

    console.log('returnEquipment 호출:', dataWithTimestamp);

    // 장비 데이터를 JSON 문자열로 변환
    const equipmentDataJson = JSON.stringify(dataWithTimestamp);

    const response = await fetch(`${GAS_URL}?action=returnEquipment&equipmentData=${encodeURIComponent(equipmentDataJson)}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('returnEquipment 응답:', data);
    
    if (data.success === false) {
      throw new Error(data.message || data.error);
    }
    
    return {
      success: true,
      message: data.message,
      serial: data.serial,
      name: data.name
    };
  } catch (error) {
    console.error('Return equipment error:', error);
    throw new Error(`Failed to return equipment: ${error.message}`);
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

// ===== 파일 업로드 (Google Drive) =====
/**
 * 파일을 Google Drive에 업로드
 * @param {File} file - 업로드할 파일 (File 객체)
 * @param {string} fileName - 저장할 파일명 (확장자 포함)
 * @returns {Promise<Object>} 업로드 결과 (fileId, fileUrl 포함)
 */
export const uploadFile = async (file, fileName) => {
  try {
    console.log('uploadFile 호출:', { fileName, fileType: file.type, fileSize: file.size });
    
    // 파일을 Base64로 변환
    const base64Data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Data URL에서 Base64 부분만 추출 (data:image/png;base64, 제거)
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    
    console.log('Base64 변환 완료, 길이:', base64Data.length);
    
    // GAS로 POST 요청
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8'
      },
      body: JSON.stringify({
        action: 'uploadFile',
        fileName: fileName,
        fileData: base64Data,
        mimeType: file.type
      })
    });
    
    console.log('uploadFile 응답 상태:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('uploadFile 응답 데이터:', data);
    
    if (data.success === false) {
      throw new Error(data.message || data.error);
    }
    
    return {
      success: true,
      fileId: data.fileId,
      fileName: data.fileName,
      fileUrl: data.fileUrl,
      message: data.message
    };
  } catch (error) {
    console.error('Upload file error:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
};

// ===== 신청 양식 제출 상태 업데이트 =====
/**
 * 시트의 신청 양식 제출 칼럼 업데이트
 * @param {string} serialNumber - 장비 시리얼 번호
 * @param {string} fileUrl - 업로드된 파일 URL
 * @returns {Promise<Object>} 업데이트 결과
 */
export const updateFormSubmission = async (serialNumber, fileUrl) => {
  try {
    console.log('updateFormSubmission 호출:', { serialNumber, fileUrl });
    
    if (!serialNumber) {
      throw new Error('시리얼 번호가 필요합니다.');
    }
    
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8'
      },
      body: JSON.stringify({
        action: 'updateFormSubmission',
        serialNumber: serialNumber,
        fileUrl: fileUrl || '제출완료'
      })
    });
    
    console.log('updateFormSubmission 응답 상태:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('updateFormSubmission 응답 데이터:', data);
    
    if (data.success === false) {
      throw new Error(data.message || data.error);
    }
    
    return {
      success: true,
      serialNumber: data.serialNumber,
      rowNumber: data.rowNumber,
      message: data.message
    };
  } catch (error) {
    console.error('Update form submission error:', error);
    throw new Error(`Failed to update form submission: ${error.message}`);
  }
};

// ===== 📱 기기 / 브라우저 정보 추출 헬퍼 함수 =====
export const getBrowserDeviceInfo = () => {
  if (typeof window === 'undefined' || !navigator || !navigator.userAgent) {
    return '알 수 없음';
  }

  const ua = navigator.userAgent;

  // OS 판별
  let os = '기타 OS';
  if (/iPhone/i.test(ua)) os = 'iPhone';
  else if (/iPad/i.test(ua)) os = 'iPad';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'Mac';
  else if (/Linux/i.test(ua)) os = 'Linux';

  // 브라우저 / 앱 판별
  let browser = '기타 브라우저';
  if (/KAKAOTALK/i.test(ua)) browser = '카카오톡';
  else if (/NAVER/i.test(ua)) browser = '네이버 App';
  else if (/SamsungBrowser/i.test(ua)) browser = '삼성 인터넷';
  else if (/Edg/i.test(ua)) browser = 'Edge';
  else if (/Chrome|CriOS/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome|CriOS/i.test(ua)) browser = 'Safari';
  else if (/Firefox|FxiOS/i.test(ua)) browser = 'Firefox';

  // 기기 분류
  const deviceCategory = /Mobi|Android|iPhone|iPad/i.test(ua) ? '모바일' : 'PC';

  return `${deviceCategory} (${os} / ${browser})`;
};

// ===== 📊 조회History 기록 (웹 검색 / QR 접속 로그) =====
export const logSearchHistory = async (logData = {}) => {
  try {
    const deviceInfo = logData.deviceInfo || getBrowserDeviceInfo();
    const email = logData.email && logData.email !== '미인증/확인중' ? logData.email : '-';
    const userName = logData.userName && logData.userName !== '사용자' ? logData.userName : (email !== '-' ? email : '비로그인 사용자');

    const params = new URLSearchParams({
      action: 'logSearchHistory',
      email: email,
      userName: userName,
      accessType: logData.accessType || '웹 검색',
      query: logData.query || logData.serial || '',
      equipmentName: logData.equipmentName || '',
      applied: logData.applied ? 'true' : 'false',
      deviceInfo: deviceInfo
    });

    const url = `${GAS_URL}?${params.toString()}`;
    console.log('🛫 [logSearchHistory] 시트 기록 요청 전송:', url);

    // 1. Image Beacon 전송 (CORS/302 리디렉션 영향 제로, GAS 100% 수신)
    if (typeof window !== 'undefined') {
      const img = new Image();
      img.src = url;
    }

    // 2. fetch no-cors 보조 전송
    fetch(url, { mode: 'no-cors' }).catch(() => {});

    console.log('✅ [조회History] 시트 기록 신호 전송 완료:', { userName, deviceInfo });
    return { success: true };
  } catch (error) {
    console.error('❌ [logSearchHistory] 에러 발생:', error);
    return null;
  }
};

// ===== 📦 재고 실사 기록 (실사History 시트에 기록) =====
export const logInventoryAudit = async (auditData = {}) => {
  try {
    const payload = {
      action: 'logInventoryAudit',
      spreadsheetId: '13cKidfXW_tENgtbx65AqWxRJvi7s86JcBcrMQHfK3oQ',
      location: auditData.location || '',
      auditor: auditData.auditor || auditData.userName || '담당자',
      totalExpected: auditData.totalExpected || 0,
      matchedCount: auditData.matchedCount || 0,
      missingCount: auditData.missingCount || 0,
      unexpectedCount: auditData.unexpectedCount || 0,
      scannedCount: auditData.scannedCount || 0,
      missingItemsJson: JSON.stringify(auditData.missingItems || []),
      unexpectedItemsJson: JSON.stringify(auditData.unexpectedItems || []),
      timestamp: auditData.timestamp || new Date().toLocaleString()
    };

    console.log('🛫 [logInventoryAudit] POST 실사 기록 요청 전송 (위치:', payload.location, ', 미발견:', payload.missingCount, ')');

    // POST 방식으로 데이터 전송 (URL 초과로 인한 400 Bad Request 방지)
    await fetch(GAS_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });

    console.log('✅ [logInventoryAudit] 시트 전송 완료 (POST)');
    return { success: true };
  } catch (error) {
    console.error('❌ [logInventoryAudit] 에러 발생:', error);
    return null;
  }
};