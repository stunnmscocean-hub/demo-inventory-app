/**
 * Google Apps Script - Authentication
 * 인증 관련 함수들
 */

/**
 * OAuth 처리 (JWT 토큰 또는 인증 코드)
 */
function handleProcessOAuth(codeOrJwt, redirectUri) {
  try {
    console.log('Processing OAuth with token/code:', codeOrJwt);
    console.log('Redirect URI:', redirectUri);
    
    let userData;
    
    // JWT 토큰인지 확인 (JWT는 점으로 구분된 3부분으로 구성)
    if (codeOrJwt.includes('.')) {
      console.log('Processing JWT token');
      userData = processJwtToken(codeOrJwt);
    } else {
      console.log('Processing authorization code');
      // 1. 인증 코드를 액세스 토큰으로 교환
      const tokenData = exchangeCodeForToken(codeOrJwt, redirectUri);
      if (!tokenData || !tokenData.access_token) {
        throw new Error('Failed to exchange code for token');
      }
      
      // 2. 액세스 토큰을 사용하여 사용자 정보 가져오기
      userData = getUserInfoFromGoogle(tokenData.access_token);
    }
    
    if (!userData || !userData.email) {
      throw new Error('Failed to get user info from OAuth');
    }
    
    console.log('User data from OAuth:', userData);
    console.log('Email from OAuth:', userData.email);
    
    // 3. ACL 시트에서 이메일 권한 및 역할 확인
    const aclEntry = findAclEntryByEmail(userData.email);
    if (!aclEntry) {
      console.log('Unauthorized access attempt by:', userData.email);
      return createErrorResponse('unauthorized', `Access denied for ${userData.email}`);
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
    
    return createSuccessResponse(userInfo);
    
  } catch (error) {
    console.error('Error in handleProcessOAuth:', error);
    return createErrorResponse('oauth_error', error.toString());
  }
}

/**
 * JWT 토큰 처리
 */
function processJwtToken(jwtToken) {
  try {
    // JWT 토큰을 디코드 (간단한 base64 디코딩)
    const parts = jwtToken.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT token format');
    }
    
    // 페이로드 부분 디코드
    const payload = parts[1];
    const decodedPayload = Utilities.base64Decode(payload);
    const userData = JSON.parse(Utilities.newBlob(decodedPayload).getDataAsString());
    
    console.log('Decoded JWT payload:', userData);
    
    return {
      id: userData.sub || userData.id,
      email: userData.email,
      name: userData.name,
      picture: userData.picture,
      verified_email: userData.email_verified
    };
    
  } catch (error) {
    console.error('Error processing JWT token:', error);
    throw new Error('Failed to process JWT token: ' + error.toString());
  }
}

/**
 * 인증 코드를 액세스 토큰으로 교환
 */
function exchangeCodeForToken(code, redirectUri) {
  const tokenUrl = CONFIG.TOKEN_URL;
  const tokenPayload = {
    'client_id': CONFIG.CLIENT_ID,
    'client_secret': CONFIG.CLIENT_SECRET,
    'code': code,
    'grant_type': 'authorization_code',
    'redirect_uri': redirectUri
  };
  
  const tokenResponse = UrlFetchApp.fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    payload: Object.keys(tokenPayload).map(key => 
      key + '=' + encodeURIComponent(tokenPayload[key])
    ).join('&')
  });
  
  if (tokenResponse.getResponseCode() !== 200) {
    throw new Error('Failed to exchange code for token: ' + tokenResponse.getContentText());
  }
  
  return JSON.parse(tokenResponse.getContentText());
}

/**
 * Google API에서 사용자 정보 가져오기
 */
function getUserInfoFromGoogle(accessToken) {
  const userResponse = UrlFetchApp.fetch(CONFIG.USER_INFO_URL, {
    headers: {
      'Authorization': 'Bearer ' + accessToken
    }
  });
  
  if (userResponse.getResponseCode() !== 200) {
    throw new Error('Failed to get user info: ' + userResponse.getContentText());
  }
  
  return JSON.parse(userResponse.getContentText());
}

/**
 * 사용자 정보 요청 처리
 */
function handleGetUserInfo(code, email) {
  try {
    const userEmail = email || Session.getActiveUser().getEmail();
    const userName = Session.getActiveUser().getUsername();
    
    console.log('Current user email (handleGetUserInfo):', userEmail);
    console.log('Current user name (handleGetUserInfo):', userName);
    
    // ACL 시트에서 이메일 권한 확인 및 역할 조회
    const aclEntry = findAclEntryByEmail(userEmail);
    if (!aclEntry) {
      console.log('Unauthorized access attempt by (handleGetUserInfo):', userEmail);
      return createErrorResponse('unauthorized', 'Access denied');
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
    
    return createSuccessResponse(userInfo);
    
  } catch (error) {
    console.error('Error in handleGetUserInfo:', error);
    return createErrorResponse('user_info_error', error.toString());
  }
}
