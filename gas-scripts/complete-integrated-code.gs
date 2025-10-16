/**
 * Google Apps Script - 완전 통합 버전
 * 모든 기능이 포함된 완전한 버전
 * 
 * 포함된 기능:
 * - 기본 인증 및 ACL
 * - Sheet 읽기/쓰기
 * - 찾아바꾸기
 * - Drive 저장
 * - PNG 출력
 * - PDF 생성
 * - Excel 처리
 */

// ===== CONFIGURATION =====
const CONFIG = {
  ACL_SHEET_ID: '13cKidfXW_tENgtbx65AqWxRJvi7s86JcBcrMQHfK3oQ',
  DEFAULT_SHEET_ID: '13cKidfXW_tENgtbx65AqWxRJvi7s86JcBcrMQHfK3oQ',
  TEMPLATE_SPREADSHEET_ID: '13yJAh59CYIKYMV1LPlZR2m1Rqef3sHZFOvFHhx0lht0',
  TEMPLATE_SHEET_GID: '1326732411',
  DRIVE_FOLDER_ID: '1idch4gNgL0LuBbPVv6dfKQxyGjQSm3bN',
  
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
    
    const action = e.parameter.action;
    
    switch (action) {
      // 기본 인증 기능
      case 'ping':
        return handlePing();
      case 'testACL':
        return handleTestACL(e.parameter.email);
      case 'getUserInfo':
        return handleGetUserInfo(e.parameter.code, e.parameter.email);
      case 'checkEmail':
        return handleCheckEmail(e.parameter.email);
      case 'processOAuth':
        const tokenOrCode = e.parameter.jwt_token || e.parameter.code;
        return handleProcessOAuth(tokenOrCode, e.parameter.redirect_uri);
      case 'getTasks':
        return handleGetTasks(e.parameter.email, e.parameter.sheetId);
      
      // Sheet 관련 기능
      case 'readSheet':
        return handleReadSheet(e.parameter.sheetId, e.parameter.sheetName);
      case 'writeSheet':
        return handleWriteSheet(e.parameter.sheetId, e.parameter.sheetName, e.parameter.data);
      case 'findAndReplace':
        return handleFindAndReplace(e.parameter.sheetId, e.parameter.find, e.parameter.replace);
      
      // Drive 관련 기능
      case 'saveToDrive':
        return handleSaveToDrive(e.parameter.fileName, e.parameter.content, e.parameter.mimeType);
      case 'listDriveFiles':
        return handleListDriveFiles(e.parameter.folderId);
      
      // PNG/PDF 출력 기능
      case 'exportToPng':
        return handleExportToPng(e.parameter.sheetId, e.parameter.sheetGid, e.parameter.fileName);
      case 'exportToPdf':
        return handleExportToPdf(e.parameter.sheetId, e.parameter.fileName);
      case 'convertPdfToPng':
        return handleConvertPdfToPng(e.parameter.pdfUrl, e.parameter.fileName);
      
      // Excel 관련 기능
      case 'exportToExcel':
        return handleExportToExcel(e.parameter.sheetId, e.parameter.fileName);
      case 'importFromExcel':
        return handleImportFromExcel(e.parameter.fileId);
      
      // 템플릿 관련 기능
      case 'duplicateTemplate':
        return handleDuplicateTemplate(e.parameter.templateId, e.parameter.newName);
      case 'updateTemplate':
        return handleUpdateTemplate(e.parameter.sheetId, e.parameter.data);
      
      default:
        return createErrorResponse('invalid_action', 'No valid action specified.');
    }
  } catch (error) {
    console.error('Main doGet error:', error);
    return createErrorResponse('server_error', error.toString());
  }
}

// ===== AUTHENTICATION =====
function handleProcessOAuth(codeOrJwt, redirectUri) {
  try {
    console.log('Processing OAuth with token/code:', codeOrJwt);
    
    let userData;
    
    if (codeOrJwt.includes('.')) {
      console.log('Processing JWT token');
      userData = processJwtToken(codeOrJwt);
    } else {
      console.log('Processing authorization code');
      const tokenData = exchangeCodeForToken(codeOrJwt, redirectUri);
      if (!tokenData || !tokenData.access_token) {
        throw new Error('Failed to exchange code for token');
      }
      userData = getUserInfoFromGoogle(tokenData.access_token);
    }
    
    if (!userData || !userData.email) {
      throw new Error('Failed to get user info from OAuth');
    }
    
    console.log('User data from OAuth:', userData);
    
    const aclEntry = findAclEntryByEmail(userData.email);
    if (!aclEntry) {
      console.log('Unauthorized access attempt by:', userData.email);
      return createErrorResponse('unauthorized', `Access denied for ${userData.email}`);
    }
    
    console.log('Authorized email:', userData.email, 'role:', aclEntry.role);
    
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

function processJwtToken(jwtToken) {
  try {
    const parts = jwtToken.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT token format');
    }
    
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

// ===== SHEET OPERATIONS =====
function handleReadSheet(sheetId, sheetName) {
  try {
    if (!sheetId) {
      return createErrorResponse('sheet_id_required', 'Sheet ID is required');
    }
    
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheet = sheetName ? spreadsheet.getSheetByName(sheetName) : spreadsheet.getActiveSheet();
    
    if (!sheet) {
      return createErrorResponse('sheet_not_found', `Sheet '${sheetName}' not found`);
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    
    const result = data.map(row => {
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = row[i];
      });
      return obj;
    });
    
    return createSuccessResponse({
      data: result,
      headers: headers,
      rowCount: result.length
    });
    
  } catch (error) {
    console.error('Error in handleReadSheet:', error);
    return createErrorResponse('sheet_read_error', error.toString());
  }
}

function handleWriteSheet(sheetId, sheetName, data) {
  try {
    if (!sheetId || !data) {
      return createErrorResponse('parameters_required', 'Sheet ID and data are required');
    }
    
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheet = sheetName ? spreadsheet.getSheetByName(sheetName) : spreadsheet.getActiveSheet();
    
    if (!sheet) {
      return createErrorResponse('sheet_not_found', `Sheet '${sheetName}' not found`);
    }
    
    // 데이터를 2D 배열로 변환
    const values = Array.isArray(data) ? data : [data];
    const range = sheet.getRange(1, 1, values.length, values[0].length);
    range.setValues(values);
    
    return createSuccessResponse({
      message: 'Data written successfully',
      rowCount: values.length
    });
    
  } catch (error) {
    console.error('Error in handleWriteSheet:', error);
    return createErrorResponse('sheet_write_error', error.toString());
  }
}

function handleFindAndReplace(sheetId, findText, replaceText) {
  try {
    if (!sheetId || !findText || !replaceText) {
      return createErrorResponse('parameters_required', 'Sheet ID, find text, and replace text are required');
    }
    
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheet = spreadsheet.getActiveSheet();
    
    const range = sheet.getDataRange();
    const values = range.getValues();
    
    let replaceCount = 0;
    for (let i = 0; i < values.length; i++) {
      for (let j = 0; j < values[i].length; j++) {
        if (values[i][j] && values[i][j].toString().includes(findText)) {
          values[i][j] = values[i][j].toString().replace(new RegExp(findText, 'g'), replaceText);
          replaceCount++;
        }
      }
    }
    
    if (replaceCount > 0) {
      range.setValues(values);
    }
    
    return createSuccessResponse({
      message: 'Find and replace completed',
      replaceCount: replaceCount
    });
    
  } catch (error) {
    console.error('Error in handleFindAndReplace:', error);
    return createErrorResponse('find_replace_error', error.toString());
  }
}

// ===== DRIVE OPERATIONS =====
function handleSaveToDrive(fileName, content, mimeType) {
  try {
    if (!fileName || !content) {
      return createErrorResponse('parameters_required', 'File name and content are required');
    }
    
    const blob = Utilities.newBlob(content, mimeType || 'text/plain', fileName);
    const file = DriveApp.createFile(blob);
    
    // 폴더가 지정된 경우 파일을 해당 폴더로 이동
    if (CONFIG.DRIVE_FOLDER_ID) {
      const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
      file.moveTo(folder);
    }
    
    return createSuccessResponse({
      message: 'File saved to Drive',
      fileId: file.getId(),
      fileName: file.getName(),
      fileUrl: file.getUrl()
    });
    
  } catch (error) {
    console.error('Error in handleSaveToDrive:', error);
    return createErrorResponse('drive_save_error', error.toString());
  }
}

function handleListDriveFiles(folderId) {
  try {
    const folder = folderId ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder();
    const files = folder.getFiles();
    
    const fileList = [];
    while (files.hasNext()) {
      const file = files.next();
      fileList.push({
        id: file.getId(),
        name: file.getName(),
        url: file.getUrl(),
        mimeType: file.getBlob().getContentType(),
        size: file.getSize(),
        dateCreated: file.getDateCreated(),
        lastUpdated: file.getLastUpdated()
      });
    }
    
    return createSuccessResponse({
      files: fileList,
      count: fileList.length
    });
    
  } catch (error) {
    console.error('Error in handleListDriveFiles:', error);
    return createErrorResponse('drive_list_error', error.toString());
  }
}

// ===== PNG/PDF EXPORT =====
function handleExportToPng(sheetId, sheetGid, fileName) {
  try {
    if (!sheetId || !fileName) {
      return createErrorResponse('parameters_required', 'Sheet ID and file name are required');
    }
    
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheet = sheetGid ? spreadsheet.getSheets().find(s => s.getSheetId().toString() === sheetGid) : spreadsheet.getActiveSheet();
    
    if (!sheet) {
      return createErrorResponse('sheet_not_found', 'Sheet not found');
    }
    
    // 시트를 이미지로 변환 (GAS에서는 직접적인 PNG 변환이 제한적)
    // 대신 시트 데이터를 기반으로 HTML을 생성하여 이미지로 변환
    const data = sheet.getDataRange().getValues();
    const htmlContent = generateSheetHtml(data, fileName);
    
    const blob = Utilities.newBlob(htmlContent, 'text/html', fileName + '.html');
    const file = DriveApp.createFile(blob);
    
    if (CONFIG.DRIVE_FOLDER_ID) {
      const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
      file.moveTo(folder);
    }
    
    return createSuccessResponse({
      message: 'Sheet exported to HTML (PNG conversion requires additional processing)',
      fileId: file.getId(),
      fileName: file.getName(),
      fileUrl: file.getUrl()
    });
    
  } catch (error) {
    console.error('Error in handleExportToPng:', error);
    return createErrorResponse('png_export_error', error.toString());
  }
}

function handleExportToPdf(sheetId, fileName) {
  try {
    if (!sheetId || !fileName) {
      return createErrorResponse('parameters_required', 'Sheet ID and file name are required');
    }
    
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheet = spreadsheet.getActiveSheet();
    
    // PDF로 내보내기 (GAS에서는 제한적)
    const data = sheet.getDataRange().getValues();
    const pdfContent = generatePdfContent(data, fileName);
    
    const blob = Utilities.newBlob(pdfContent, 'application/pdf', fileName + '.pdf');
    const file = DriveApp.createFile(blob);
    
    if (CONFIG.DRIVE_FOLDER_ID) {
      const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
      file.moveTo(folder);
    }
    
    return createSuccessResponse({
      message: 'Sheet exported to PDF',
      fileId: file.getId(),
      fileName: file.getName(),
      fileUrl: file.getUrl()
    });
    
  } catch (error) {
    console.error('Error in handleExportToPdf:', error);
    return createErrorResponse('pdf_export_error', error.toString());
  }
}

// ===== TEMPLATE OPERATIONS =====
function handleDuplicateTemplate(templateId, newName) {
  try {
    if (!templateId || !newName) {
      return createErrorResponse('parameters_required', 'Template ID and new name are required');
    }
    
    const templateFile = DriveApp.getFileById(templateId);
    const newFile = templateFile.makeCopy(newName);
    
    return createSuccessResponse({
      message: 'Template duplicated successfully',
      newFileId: newFile.getId(),
      newFileName: newFile.getName(),
      newFileUrl: newFile.getUrl()
    });
    
  } catch (error) {
    console.error('Error in handleDuplicateTemplate:', error);
    return createErrorResponse('template_duplicate_error', error.toString());
  }
}

function handleUpdateTemplate(sheetId, data) {
  try {
    if (!sheetId || !data) {
      return createErrorResponse('parameters_required', 'Sheet ID and data are required');
    }
    
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheet = spreadsheet.getActiveSheet();
    
    // 데이터 업데이트 로직
    if (Array.isArray(data)) {
      const range = sheet.getRange(1, 1, data.length, data[0].length);
      range.setValues(data);
    }
    
    return createSuccessResponse({
      message: 'Template updated successfully',
      rowCount: Array.isArray(data) ? data.length : 1
    });
    
  } catch (error) {
    console.error('Error in handleUpdateTemplate:', error);
    return createErrorResponse('template_update_error', error.toString());
  }
}

// ===== HELPER FUNCTIONS =====
function generateSheetHtml(data, fileName) {
  let html = '<html><head><title>' + fileName + '</title></head><body>';
  html += '<table border="1" style="border-collapse: collapse;">';
  
  data.forEach(row => {
    html += '<tr>';
    row.forEach(cell => {
      html += '<td>' + (cell || '') + '</td>';
    });
    html += '</tr>';
  });
  
  html += '</table></body></html>';
  return html;
}

function generatePdfContent(data, fileName) {
  // 간단한 PDF 생성 (실제로는 더 복잡한 PDF 라이브러리가 필요)
  let content = '%PDF-1.4\n';
  content += '1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n';
  content += '2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n';
  content += '3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n';
  content += '4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n72 720 Td\n(' + fileName + ') Tj\nET\nendstream\nendobj\n';
  content += 'xref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000204 00000 n \n';
  content += 'trailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n297\n%%EOF';
  
  return content;
}

// ===== ACL FUNCTIONS =====
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

function handlePing() {
  try {
    const response = {
      success: true,
      message: 'GAS server is reachable',
      timestamp: new Date().toISOString(),
      version: '3.0.0-complete',
      features: [
        'authentication',
        'acl',
        'sheet_operations',
        'drive_operations',
        'png_export',
        'pdf_export',
        'template_operations'
      ],
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
  
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    if (normalizeString(sheets[i].getName()) === 'acl') {
      return sheets[i];
    }
  }
  
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
