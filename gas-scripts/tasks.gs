/**
 * Google Apps Script - Tasks
 * 태스크 관련 함수들
 */

/**
 * 태스크 가져오기 요청 처리
 */
function handleGetTasks(userEmail, sheetId) {
  try {
    console.log('Received email for getTasks:', userEmail);

    if (!userEmail || userEmail.trim() === '') {
      return createErrorResponse('email_required', 'Email parameter is required for getTasks action.');
    }

    // ACL 시트에서 이메일 권한 확인
    const aclEntry = findAclEntryByEmail(userEmail);
    if (!aclEntry) {
      console.log('Unauthorized access attempt by:', userEmail);
      return createErrorResponse('unauthorized', `Access denied for ${userEmail}`);
    }
    
    console.log('Authorized access for:', userEmail);
    
    // 시트 ID 결정
    const targetSheetId = sheetId || CONFIG.DEFAULT_SHEET_ID;
    console.log('Using sheetId:', targetSheetId);
    
    // 스프레드시트 열기
    const sheet = SpreadsheetApp.openById(targetSheetId).getActiveSheet();
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

    return createSuccessResponse(tasks);
    
  } catch (error) {
    console.error('Error in handleGetTasks:', error);
    return createErrorResponse('tasks_error', error.toString());
  }
}
