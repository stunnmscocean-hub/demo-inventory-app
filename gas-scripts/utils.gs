/**
 * Google Apps Script - Utilities
 * 유틸리티 함수들
 */

/**
 * 기본 연결 테스트
 */
function handlePing() {
  try {
    const response = {
      success: true,
      message: 'GAS server is reachable',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
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

/**
 * 로깅 헬퍼 함수
 */
function logInfo(message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] INFO: ${message}`);
  if (data) {
    console.log(`[${timestamp}] DATA:`, JSON.stringify(data));
  }
}

function logError(message, error = null) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ERROR: ${message}`);
  if (error) {
    console.error(`[${timestamp}] ERROR_DETAILS:`, error.toString());
  }
}

/**
 * 응답 헤더 설정
 */
function setResponseHeaders() {
  Object.keys(CONFIG.RESPONSE_HEADERS).forEach(key => {
    // GAS에서는 직접 헤더를 설정할 수 없지만, 로깅용으로 사용
    console.log(`Response Header: ${key}: ${CONFIG.RESPONSE_HEADERS[key]}`);
  });
}

/**
 * 입력값 검증
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

function validateRequiredParams(params, requiredFields) {
  const missing = [];
  
  for (const field of requiredFields) {
    if (!params[field] || params[field].toString().trim() === '') {
      missing.push(field);
    }
  }
  
  return {
    isValid: missing.length === 0,
    missingFields: missing
  };
}

/**
 * 안전한 JSON 파싱
 */
function safeJsonParse(jsonString, defaultValue = null) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('JSON parse error:', error);
    return defaultValue;
  }
}

/**
 * 에러 메시지 생성
 */
function createErrorMessage(error, context = '') {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` [${context}]` : '';
  return `${timestamp}${contextStr}: ${error}`;
}
