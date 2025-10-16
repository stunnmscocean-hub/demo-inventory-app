/**
 * Google Apps Script - 통합 버전
 * 모든 기능이 하나의 파일에 통합된 버전
 * 
 * 사용 시나리오:
 * - 간단한 프로젝트
 * - 단일 개발자
 * - 빠른 배포가 필요한 경우
 */

// ===== CONFIGURATION =====
const CONFIG = {
  ACL_SHEET_ID: '13cKidfXW_tENgtbx65AqWxRJvi7s86JcBcrMQHfK3oQ',
  DEFAULT_SHEET_ID: '13cKidfXW_tENgtbx65AqWxRJvi7s86JcBcrMQHfK3oQ',
  
  get CLIENT_ID() {
    return PropertiesService.getScriptProperties().getProperty('GOOGLE_CLIENT_ID') || 
           '378338099409-as7m74dg2v9adep2gq8ghs5csla601c0.apps.googleusercontent.com';
  },
  
  get CLIENT_SECRET() {
    return PropertiesService.getScriptProperties().getProperty('GOOGLE_CLIENT_SECRET') || 
           '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';
  },
  
  TOKEN_URL: 'https://oauth2.googleapis.com/token',
  USER_INFO_URL: 'https://www.googleapis.com/oauth2/v2/userinfo'
};

// ===== MAIN ROUTER =====
function doGet(e) {
  try {
    console.log('--- doGet function started ---');
    console.log('Received parameters:', e.parameter);
    console.log('Action parameter:', e.parameter.action);
    console.log('Email parameter:', e.parameter.email);
    
    const action = e.parameter.action;
    
    switch (action) {
      case 'ping':
        return handlePing();
      case 'testACL':
        return handleTestACL(e.parameter.email);
      case 'getUserInfo':
        return handleGetUserInfo(e.parameter.code, e.parameter.email);
      case 'checkEmail':
        return handleCheckEmail(e.parameter.email);
      case 'processOAuth':
        // JWT 토큰 또는 인증 코드 처리
        const tokenOrCode = e.parameter.jwt_token || e.parameter.code;
        return handleProcessOAuth(tokenOrCode, e.parameter.redirect_uri);
      case 'getTasks':
        return handleGetTasks(e.parameter.email, e.parameter.sheetId);
      default:
        return createErrorResponse('invalid_action', 'No valid action specified.');
    }
  } catch (error) {
    console.error('Main doGet error:', error);
    return createErrorResponse('server_error', error.toString());
  }
}

// ===== AUTHENTICATION =====
function handleProcessOAuth(code, redirectUri) {
  try {
    console.log('Processing OAuth with code:', code);
    
    // 1. 인증 코드를 액세스 토큰으로 교환
    const tokenData = exchangeCodeForToken(code, redirectUri);
    if (!tokenData || !tokenData.access_token) {
      throw new Error('Failed to exchange code for token');
    }
    
    // 2. 액세스 토큰을 사용하여 사용자 정보 가져오기
    const userData = getUserInfoFromGoogle(tokenData.access_token);
    if (!userData || !userData.email) {
      throw new Error('Failed to get user info from Google');
    }
    
    console.log('User data from Google OAuth:', userData);
    
    // 3. ACL 시트에서 이메일 권한 및 역할 확인
    const aclEntry = findAclEntryByEmail(userData.email);
    if (!aclEntry) {
      console.log('Unauthorized access attempt by:', userData.email);
      return createErrorResponse('unauthorized', `Access denied for ${userData.email}`);
    }
    
    console.log('Authorized email:', userData.email, 'role:', aclEntry.role);
    
    // 사용자 정보 반환
    const userInfo = {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      picture: userData.picture,
      role: aclEntry.role || 'viewer'
    };
    
    return createSuccessResponse(userInfo);
    
  } catch (error) {
    console.error('Error in handleProcessOAuth:', error);
    return createErrorResponse('oauth_error', error.toString());
  }
}

function exchangeCodeForToken(code, redirectUri) {
  const tokenPayload = {
    'client_id': CONFIG.CLIENT_ID,
    'client_secret': CONFIG.CLIENT_SECRET,
    'code': code,
    'grant_type': 'authorization_code',
    'redirect_uri': redirectUri
  };
  
  const tokenResponse = UrlFetchApp.fetch(CONFIG.TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    payload: Object.keys(tokenPayload).map(key => 
      key + '=' + encodeURIComponent(tokenPayload[key])
    ).join('&')
  });
  
  if (tokenResponse.getResponseCode() !== 200) {
    throw new Error('Failed to exchange code for token: ' + tokenResponse.getContentText());
  }
  
  return JSON.parse(tokenResponse.getContentText());
}

function getUserInfoFromGoogle(accessToken) {
  const userResponse = UrlFetchApp.fetch(CONFIG.USER_INFO_URL, {
    headers: { 'Authorization': 'Bearer ' + accessToken }
  });
  
  if (userResponse.getResponseCode() !== 200) {
    throw new Error('Failed to get user info: ' + userResponse.getContentText());
  }
  
  return JSON.parse(userResponse.getContentText());
}

function handleGetUserInfo(code, email) {
  try {
    const userEmail = email || Session.getActiveUser().getEmail();
    const userName = Session.getActiveUser().getUsername();
    
    console.log('Current user email:', userEmail);
    
    const aclEntry = findAclEntryByEmail(userEmail);
    if (!aclEntry) {
      console.log('Unauthorized access attempt by:', userEmail);
      return createErrorResponse('unauthorized', 'Access denied');
    }
    
    console.log('Authorized access for:', userEmail);
    
    const userInfo = {
      id: userEmail,
      email: userEmail,
      name: userName || userEmail,
      picture: 'https://via.placeholder.com/40',
      role: aclEntry.role || 'viewer'
    };
    
    return createSuccessResponse(userInfo);
    
  } catch (error) {
    console.error('Error in handleGetUserInfo:', error);
    return createErrorResponse('user_info_error', error.toString());
  }
}

// ===== ACCESS CONTROL =====
function handleTestACL(email) {
  try {
    if (!email) {
      return createErrorResponse('email_required', 'Email parameter is required');
    }
    
    console.log('Testing ACL for email:', email);
    
    const aclEntry = findAclEntryByEmail(email);
    
    if (!aclEntry) {
      return createErrorResponse('unauthorized', `Email ${email} not found in ACL`);
    }
    
    return createSuccessResponse({
      authorized: true,
      email: aclEntry.email,
      role: aclEntry.role,
      message: 'Email found in ACL'
    });
    
  } catch (error) {
    console.error('Error in handleTestACL:', error);
    return createErrorResponse('acl_test_error', error.toString());
  }
}

function handleCheckEmail(email) {
  try {
    console.log('Checking email:', email);
    
    const aclEntry = findAclEntryByEmail(email);
    if (!aclEntry) {
      console.log('Unauthorized email:', email);
      return createErrorResponse('unauthorized', 'Email not authorized');
    }
    
    console.log('Authorized email:', email);
    return createSuccessResponse({
      authorized: true, 
      role: aclEntry.role || 'viewer'
    });
    
  } catch (error) {
    console.error('Error in handleCheckEmail:', error);
    return createErrorResponse('email_check_error', error.toString());
  }
}

// ===== TASKS =====
function handleGetTasks(userEmail, sheetId) {
  try {
    console.log('Received email for getTasks:', userEmail);

    if (!userEmail || userEmail.trim() === '') {
      return createErrorResponse('email_required', 'Email parameter is required for getTasks action.');
    }

    const aclEntry = findAclEntryByEmail(userEmail);
    if (!aclEntry) {
      console.log('Unauthorized access attempt by:', userEmail);
      return createErrorResponse('unauthorized', `Access denied for ${userEmail}`);
    }
    
    console.log('Authorized access for:', userEmail);
    
    const targetSheetId = sheetId || CONFIG.DEFAULT_SHEET_ID;
    console.log('Using sheetId:', targetSheetId);
    
    const sheet = SpreadsheetApp.openById(targetSheetId).getActiveSheet();
    const data = sheet.getDataRange().getValues();

    const headers = data.shift();
    const tasks = data.map(row => {
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = row[i];
      });
      return obj;
    });

    return createSuccessResponse(tasks);
    
  } catch (error) {
    console.error('Error in handleGetTasks:', error);
    return createErrorResponse('tasks_error', error.toString());
  }
}

// ===== UTILITIES =====
function handlePing() {
  try {
    const response = {
      success: true,
      message: 'GAS server is reachable',
      timestamp: new Date().toISOString(),
      version: '2.0.0-integrated',
      config: {
        aclSheetId: CONFIG.ACL_SHEET_ID,
        hasClientId: !!CONFIG.CLIENT_ID,
        hasClientSecret: !!CONFIG.CLIENT_SECRET
      }
    };
    
    return createSuccessResponse(response);
    
  } catch (error) {
    console.error('Error in handlePing:', error);
    return createErrorResponse('ping_error', error.toString());
  }
}

// ===== ACL HELPER FUNCTIONS =====
function openAclSheet() {
  const aclSheetId = CONFIG.ACL_SHEET_ID;
  const ss = SpreadsheetApp.openById(aclSheetId);
  let sheet = ss.getSheetByName('ACL');
  
  if (sheet) return sheet;
  
  // Fallback: case-insensitive lookup
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    if (normalizeString(sheets[i].getName()) === 'acl') {
      return sheets[i];
    }
  }
  
  // Fallback: find sheet with headers Email, Role in first row
  for (let j = 0; j < sheets.length; j++) {
    const rng = sheets[j].getRange(1, 1, 1, 2).getValues();
    const h1 = normalizeString(rng[0][0]);
    const h2 = normalizeString(rng[0][1]);
    if (h1 === 'email' && h2 === 'role') {
      return sheets[j];
    }
  }
  
  return null;
}

function readAclEntries() {
  const sheet = openAclSheet();
  if (!sheet) {
    return { error: 'ACL sheet not found', entries: [] };
  }
  
  const values = sheet.getDataRange().getValues();
  if (!values || values.length === 0) {
    return { error: null, entries: [] };
  }
  
  const entries = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const email = normalizeString(row[0]);
    if (!email) continue;
    
    const roleCell = (row.length > 1 ? row[1] : '');
    entries.push({ 
      email: email, 
      role: (roleCell || '').toString().trim() 
    });
  }
  
  return { error: null, entries: entries };
}

function findAclEntryByEmail(email) {
  const normalizedEmail = normalizeString(email);
  const result = readAclEntries();
  
  if (result.error) {
    console.error(result.error);
    return null;
  }
  
  for (let i = 0; i < result.entries.length; i++) {
    if (result.entries[i].email === normalizedEmail) {
      return result.entries[i];
    }
  }
  
  return null;
}

function normalizeString(value) {
  return (value || '').toString().trim().toLowerCase();
}

// ===== RESPONSE HELPERS =====
function createErrorResponse(error, message) {
  return ContentService.createTextOutput(JSON.stringify({
    success: false,
    error: error,
    message: message,
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

function createSuccessResponse(data) {
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    data: data,
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}
