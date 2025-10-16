/**
 * Google Apps Script - Configuration
 * 설정값 관리
 */

const CONFIG = {
  // ACL 시트 설정
  ACL_SHEET_ID: '13cKidfXW_tENgtbx65AqWxRJvi7s86JcBcrMQHfK3oQ',
  
  // 기본 시트 ID (하드코딩된 값)
  DEFAULT_SHEET_ID: '13cKidfXW_tENgtbx65AqWxRJvi7s86JcBcrMQHfK3oQ',
  
  // Google OAuth 설정 (Script Properties에서 가져오기)
  get CLIENT_ID() {
    return PropertiesService.getScriptProperties().getProperty('GOOGLE_CLIENT_ID') || 
           '378338099409-as7m74dg2v9adep2gq8ghs5csla601c0.apps.googleusercontent.com';
  },
  
  get CLIENT_SECRET() {
    return PropertiesService.getScriptProperties().getProperty('GOOGLE_CLIENT_SECRET') || 
           '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';
  },
  
  // API 엔드포인트
  TOKEN_URL: 'https://oauth2.googleapis.com/token',
  USER_INFO_URL: 'https://www.googleapis.com/oauth2/v2/userinfo',
  
  // 응답 설정
  RESPONSE_HEADERS: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }
};

/**
 * 설정값 검증
 */
function validateConfig() {
  const requiredProperties = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
  const scriptProperties = PropertiesService.getScriptProperties();
  
  for (const prop of requiredProperties) {
    if (!scriptProperties.getProperty(prop)) {
      console.warn(`Warning: ${prop} is not set in Script Properties`);
    }
  }
}

/**
 * 초기화 시 설정 검증
 */
function initializeConfig() {
  validateConfig();
  console.log('Configuration initialized');
}
