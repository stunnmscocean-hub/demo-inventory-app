/**
 * Google Apps Script - Main Router
 * 장비 관리 시스템의 메인 라우터
 */

// 설정은 각 함수에서 직접 사용

function doGet(e) {
  try {
    // 디버깅을 위해 파라미터 로그 출력
    console.log('--- doGet function started ---');
    console.log('Received parameters:', e.parameter);
    console.log('Action parameter:', e.parameter.action);
    console.log('Email parameter:', e.parameter.email);
    console.log('Full event object:', JSON.stringify(e));
    console.log('--- doGet function ended ---');
    
    const action = e.parameter.action;
    
    // 라우팅 로직
    switch (action) {
      case 'ping':
        return handlePing();
      
      case 'testACL': // 기존 testACL은 단일 이메일 테스트, 이제 getAllAclEntries로 대체됨
        return handleTestACL(e.parameter.email);
      
      case 'getAllAclEntries': // 모든 ACL 엔트리 가져오기
        return handleGetAllAclEntries();

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

/**
 * 에러 응답 생성 헬퍼 함수
 */
function createErrorResponse(error, message) {
  return ContentService.createTextOutput(JSON.stringify({
    success: false,
    error: error,
    message: message,
    timestamp: new Date().toISOString()
  }))
  .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 성공 응답 생성 헬퍼 함수
 */
function createSuccessResponse(data) {
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    data: data,
    timestamp: new Date().toISOString()
  }))
  .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 핑 테스트 핸들러
 */
function handlePing() {
  try {
    const response = {
      success: true,
      message: 'GAS server is reachable',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      features: ['authentication', 'acl', 'cors_support']
    };
    
    return createSuccessResponse(response);
    
  } catch (error) {
    console.error('Error in handlePing:', error);
    return createErrorResponse('ping_error', error.toString());
  }
}

/**
 * 사용자 정보 가져오기 핸들러
 */
function handleGetUserInfo(code, email) {
  try {
    const userEmail = email || Session.getActiveUser().getEmail();
    const userName = Session.getActiveUser().getUsername();
    
    console.log('Current user email:', userEmail);
    
    const userInfo = {
      id: userEmail,
      email: userEmail,
      name: userName || userEmail,
      picture: 'https://via.placeholder.com/40',
      role: 'viewer'
    };
    
    return createSuccessResponse(userInfo);
    
  } catch (error) {
    console.error('Error in handleGetUserInfo:', error);
    return createErrorResponse('user_info_error', error.toString());
  }
}

/**
 * OAuth 처리 핸들러
 */
function handleProcessOAuth(tokenOrCode, redirectUri) {
  try {
    console.log('Processing OAuth with token/code:', tokenOrCode);
    
    // 간단한 사용자 정보 반환 (실제 구현에서는 OAuth 검증 필요)
    const userInfo = {
      id: 'test-user',
      email: 'test@example.com',
      name: 'Test User',
      picture: 'https://via.placeholder.com/40',
      role: 'admin'
    };
    
    return createSuccessResponse(userInfo);
    
  } catch (error) {
    console.error('Error in handleProcessOAuth:', error);
    return createErrorResponse('oauth_error', error.toString());
  }
}

/**
 * 작업 목록 가져오기 핸들러
 */
function handleGetTasks(userEmail, sheetId) {
  try {
    console.log('Received email for getTasks:', userEmail);

    if (!userEmail || userEmail.trim() === '') {
      return createErrorResponse('email_required', 'Email parameter is required for getTasks action.');
    }
    
    // 간단한 작업 목록 반환 (실제 구현에서는 시트에서 데이터 가져오기)
    const tasks = [
      { id: 1, title: 'Task 1', status: 'pending' },
      { id: 2, title: 'Task 2', status: 'completed' }
    ];

    return createSuccessResponse(tasks);
    
  } catch (error) {
    console.error('Error in handleGetTasks:', error);
    return createErrorResponse('tasks_error', error.toString());
  }
}
