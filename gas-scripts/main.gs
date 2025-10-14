/**
 * Google Apps Script - Main Router
 * 장비 관리 시스템의 메인 라우터
 */

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

/**
 * 에러 응답 생성 헬퍼 함수
 */
function createErrorResponse(error, message) {
  return ContentService.createTextOutput(JSON.stringify({
    success: false,
    error: error,
    message: message,
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * 성공 응답 생성 헬퍼 함수
 */
function createSuccessResponse(data) {
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    data: data,
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}
