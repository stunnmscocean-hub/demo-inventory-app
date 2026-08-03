function doGet(e) {
  try {
    // 디버깅을 위해 파라미터 로그 출력
    console.log('--- doGet function started ---');
    console.log('Received parameters:', e.parameter);
    console.log('Action parameter:', e.parameter.action);
    console.log('Email parameter:', e.parameter.email);
    console.log('Full event object:', JSON.stringify(e));
    console.log('--- doGet function ended ---');
    
    // [Step 1] 기본 연결 테스트
    if (e.parameter.action === 'ping') {
      return handlePing();
    }
    
    // [Step 2] ACL 체크 테스트 (이메일 파라미터로)
    if (e.parameter.action === 'testACL') {
      return handleTestACL(e.parameter.email);
    }
    
    // 사용자 정보 요청 처리 (현재 React 앱에서는 사용하지 않음)
    if (e.parameter.action === 'getUserInfo') {
      return handleGetUserInfo(e.parameter.code, e.parameter.email); // email 파라미터도 전달하도록 수정
    }
    
    // 이메일 확인 요청 처리 (현재 React 앱에서는 사용하지 않음)
    if (e.parameter.action === 'checkEmail') {
      return handleCheckEmail(e.parameter.email);
    }
    
    // OAuth 처리 요청 (현재 React 앱에서는 사용하지 않음)
    if (e.parameter.action === 'processOAuth') {
      return handleProcessOAuth(e.parameter.code, e.parameter.redirect_uri);
    }

    // 태스크 가져오기 요청 처리 (React 앱에서 이메일 전달)
    if (e.parameter.action === 'getTasks') {
      const userEmail = e.parameter.email;
      console.log('Received email for getTasks:', userEmail);

      if (!userEmail || userEmail.trim() === '') {
        return ContentService.createTextOutput(JSON.stringify({
          error: "email_required", 
          message: "Email parameter is required for getTasks action."
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // ACL 시트에서 이메일 권한 확인
      const aclEntry = findAclEntryByEmail(userEmail);
      if (!aclEntry) {
        console.log('Unauthorized access attempt by:', userEmail);
        return ContentService.createTextOutput(JSON.stringify({error: "unauthorized", checkedEmail: userEmail}))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      console.log('Authorized access for:', userEmail);
      
      let sheetId = e.parameter.sheetId; // URL 파라미터에서 sheetId 가져오기
      
      // 파라미터가 없으면 하드코딩된 값 사용
      if (!sheetId) {
        sheetId = '13cKidfXW_tENgtbx65AqWxRJvi7s86JcBcrMQHfK3oQ';
        console.log('Using hardcoded sheetId:', sheetId);
      }
      
      const sheet = SpreadsheetApp.openById(sheetId).getActiveSheet();
      const data = sheet.getDataRange().getValues();

      // 첫 번째 행을 헤더로 가정하고, 나머지 데이터를 객체 배열로 변환
      const headers = data.shift();
      const tasks = data.map(row => {
        const obj = {};
        headers.forEach((header, i) => {
          obj[header] = row[i];
        });
        return obj;
      });

      const jsonOutput = JSON.stringify(tasks);

      return ContentService.createTextOutput(jsonOutput)
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 기본 응답 (액션이 지정되지 않은 경우)
    return ContentService.createTextOutput(JSON.stringify({
      error: "invalid_action",
      message: "No valid action specified."
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({error: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function handleGetUserInfo(code, email) { // email 파라미터 추가
  try {
    // OAuth 코드를 사용하여 사용자 정보 가져오기 (현재 React 앱에서는 사용하지 않음)
    // 이 함수가 호출될 경우를 대비하여 email 파라미터를 사용하도록 수정
    const userEmail = email || Session.getActiveUser().getEmail(); // 전달받은 email이 없으면 Session에서 가져옴
    const userName = Session.getActiveUser().getUsername(); // Session에서 사용자 이름 가져옴
    
    console.log('Current user email (handleGetUserInfo):', userEmail);
    console.log('Current user name (handleGetUserInfo):', userName);
    
    // ACL 시트에서 이메일 권한 확인 및 역할 조회
    const aclEntry = findAclEntryByEmail(userEmail);
    if (!aclEntry) {
      console.log('Unauthorized access attempt by (handleGetUserInfo):', userEmail);
      return ContentService.createTextOutput(JSON.stringify({error: "unauthorized"}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    console.log('Authorized access for (handleGetUserInfo):', userEmail);
    
    // 사용자 정보 반환
    const userInfo = {
      id: userEmail,
      email: userEmail,
      name: userName || userEmail,
      picture: 'https://via.placeholder.com/40',
      role: aclEntry.role || 'viewer'
    };
    
    return ContentService.createTextOutput(JSON.stringify(userInfo))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    console.log('Error in handleGetUserInfo:', error);
    return ContentService.createTextOutput(JSON.stringify({error: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function handleCheckEmail(email) {
  try {
    console.log('Checking email:', email);
    
    const aclEntry = findAclEntryByEmail(email);
    if (!aclEntry) {
      console.log('Unauthorized email:', email);
      return ContentService.createTextOutput(JSON.stringify({error: "unauthorized"}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    console.log('Authorized email:', email);
    return ContentService.createTextOutput(JSON.stringify({authorized: true, role: aclEntry.role || 'viewer'}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    console.log('Error in handleCheckEmail:', error);
    return ContentService.createTextOutput(JSON.stringify({error: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function handleProcessOAuth(code, redirectUri) {
  try {
    console.log('Processing OAuth with code:', code);
    console.log('Redirect URI:', redirectUri);
    
    // Google OAuth 2.0 설정 (Script Properties에서 가져오기)
    const scriptProperties = PropertiesService.getScriptProperties();
    const clientId = scriptProperties.getProperty('GOOGLE_CLIENT_ID') || '378338099409-as7m74dg2v9adep2gq8ghs5csla601c0.apps.googleusercontent.com';
    const clientSecret = scriptProperties.getProperty('GOOGLE_CLIENT_SECRET') || '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';
    
    // 1. 인증 코드를 액세스 토큰으로 교환
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const tokenPayload = {
      'client_id': clientId,
      'client_secret': clientSecret,
      'code': code,
      'grant_type': 'authorization_code',
      'redirect_uri': redirectUri
    };
    
    const tokenResponse = UrlFetchApp.fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      payload: Object.keys(tokenPayload).map(key => key + '=' + encodeURIComponent(tokenPayload[key])).join('&')
    });
    
    if (tokenResponse.getResponseCode() !== 200) {
      throw new Error('Failed to exchange code for token: ' + tokenResponse.getContentText());
    }
    
    const tokenData = JSON.parse(tokenResponse.getContentText());
    const accessToken = tokenData.access_token;
    
    // 2. 액세스 토큰을 사용하여 사용자 정보 가져오기
    const userInfoUrl = 'https://www.googleapis.com/oauth2/v2/userinfo';
    const userResponse = UrlFetchApp.fetch(userInfoUrl, {
      headers: {
        'Authorization': 'Bearer ' + accessToken
      }
    });
    
    if (userResponse.getResponseCode() !== 200) {
      throw new Error('Failed to get user info: ' + userResponse.getContentText());
    }
    
    const userData = JSON.parse(userResponse.getContentText());
    console.log('User data from Google OAuth:', userData);
    console.log('Email from Google OAuth (userData.email):', userData.email);
    
    // 3. ACL 시트에서 이메일 권한 및 역할 확인
    const aclEntry = findAclEntryByEmail(userData.email);
    if (!aclEntry) {
      console.log('Unauthorized access attempt by (handleProcessOAuth):', userData.email);
      return ContentService.createTextOutput(JSON.stringify({error: "unauthorized", checkedEmail: userData.email}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    console.log('Authorized email:', userData.email, 'role:', aclEntry.role);
    
    // 사용자 정보 반환 (역할 포함)
    const userInfo = {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      picture: userData.picture,
      role: aclEntry.role || 'viewer'
    };
    
    return ContentService.createTextOutput(JSON.stringify(userInfo))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    console.log('Error in handleProcessOAuth:', error);
    return ContentService.createTextOutput(JSON.stringify({error: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ===== Test handlers for step-by-step debugging =====

// [Step 1] 기본 연결 테스트
function handlePing() {
  try {
    const response = {
      success: true,
      message: 'GAS server is reachable',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// [Step 2] ACL 테스트 (이메일로 직접 체크)
function handleTestACL(email) {
  try {
    if (!email) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'email parameter is required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    console.log('Testing ACL for email:', email);
    
    const aclEntry = findAclEntryByEmail(email);
    
    if (!aclEntry) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        authorized: false,
        checkedEmail: email,
        message: 'Email not found in ACL'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      authorized: true,
      email: aclEntry.email,
      role: aclEntry.role,
      message: 'Email found in ACL'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ===== Helper functions for ACL handling =====
function normalizeString_(value) {
  return (value || '').toString().trim().toLowerCase();
}

function openAclSheet_() {
  var aclSheetId = '13cKidfXW_tENgtbx65AqWxRJvi7s86JcBcrMQHfK3oQ';
  var ss = SpreadsheetApp.openById(aclSheetId);
  var sheet = ss.getSheetByName('ACL');
  if (sheet) return sheet;
  // Fallback: case-insensitive lookup
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (normalizeString_(sheets[i].getName()) === 'acl') {
      return sheets[i];
    }
  }
  // Fallback: find sheet with headers Email, Role in first row
  for (var j = 0; j < sheets.length; j++) {
    var rng = sheets[j].getRange(1, 1, 1, 2).getValues();
    var h1 = normalizeString_(rng[0][0]);
    var h2 = normalizeString_(rng[0][1]);
    if (h1 === 'email' && h2 === 'role') {
      return sheets[j];
    }
  }
  return null;
}

function readAclEntries_() {
  var sheet = openAclSheet_();
  if (!sheet) {
    return { error: 'ACL sheet not found', entries: [] };
  }
  var values = sheet.getDataRange().getValues();
  if (!values || values.length === 0) {
    return { error: null, entries: [] };
  }
  // Assume first row is header: [Email, Role, ...]
  var entries = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var email = normalizeString_(row[0]);
    if (!email) continue;
    var roleCell = (row.length > 1 ? row[1] : '');
    entries.push({ email: email, role: (roleCell || '').toString().trim() });
  }
  return { error: null, entries: entries };
}

function findAclEntryByEmail(email) {
  var normalizedEmail = normalizeString_(email);
  var result = readAclEntries_();
  if (result.error) {
    console.log(result.error);
    return null;
  }
  for (var i = 0; i < result.entries.length; i++) {
    if (result.entries[i].email === normalizedEmail) {
      return result.entries[i];
    }
  }
  return null;
}
