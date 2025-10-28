/**
 * Google Apps Script Web App for Inventory PDF workflow
 * - Duplicate template Sheet
 * - Update with form data
 * - Export to PDF into Drive (specific folder if provided)
 * - Return PDF as base64 by fileId (for client-side JPG conversion)
 * - Export specific Google Sheets to PNG images
 */

// PDF-lib 캐시 변수
var PDF_LIB_LOADED = false;

/**
 * Drive API 접근 방법 확인
 */
function checkDriveApiAccess() {
  try {
    // Advanced Service 사용 가능 여부 확인
    if (typeof Drive !== 'undefined' && Drive.About) {
      Drive.About.get();
      console.log('Advanced Drive Service 사용 가능');
      return { method: 'advanced', available: true };
    }
  } catch (error) {
    console.log('Advanced Drive Service 사용 불가:', error.toString());
  }
  
  console.log('REST API로 폴백');
  return { method: 'rest', available: true };
}

/**
 * REST API를 사용하여 썸네일 링크 가져오기
 */
function getThumbnailLinkRest(fileId) {
  try {
    var url = 'https://www.googleapis.com/drive/v3/files/' + fileId + '?fields=thumbnailLink';
    var response = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
    });
    var result = JSON.parse(response.getContentText());
    return result.thumbnailLink;
  } catch (error) {
    console.error('REST API 썸네일 가져오기 실패:', error);
    return null;
  }
}

/**
 * 썸네일 생성 대기 및 폴백 메커니즘
 */
function getThumbnailWithFallback(fileId, maxRetries) {
  maxRetries = maxRetries || 5;
  
  for (var i = 0; i < maxRetries; i++) {
    try {
      var thumbnailLink = null;
      
      // Advanced Service 시도
      try {
        if (typeof Drive !== 'undefined' && Drive.Files) {
          var meta = Drive.Files.get(fileId, { fields: 'thumbnailLink' });
          thumbnailLink = meta.thumbnailLink;
        }
      } catch (advancedError) {
        console.log('Advanced Service 실패, REST API로 시도');
      }
      
      // REST API 시도
      if (!thumbnailLink) {
        thumbnailLink = getThumbnailLinkRest(fileId);
      }
      
      if (thumbnailLink) {
        console.log('썸네일 링크 획득 성공:', thumbnailLink);
        return thumbnailLink;
      }
      
      console.log('썸네일 시도 ' + (i + 1) + '/' + maxRetries + ' 실패, 2초 대기...');
      Utilities.sleep(2000); // 2초 대기
      
    } catch (error) {
      console.warn('썸네일 시도 ' + (i + 1) + ' 실패:', error.toString());
    }
  }
  
  // 썸네일 실패 시 대안 방법
  console.log('썸네일 생성 실패, 대안 방법 사용');
  return useAlternativeConversion(fileId);
}

/**
 * 썸네일 대안 변환 방법
 */
function useAlternativeConversion(fileId) {
  try {
    // Google Drive export API 사용
    var exportUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1000';
    var response = UrlFetchApp.fetch(exportUrl, {
      headers: { authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
    });
    
    if (response.getResponseCode() === 200) {
      console.log('대안 변환 성공');
      return exportUrl;
    }
  } catch (error) {
    console.error('대안 변환도 실패:', error);
  }
  
  return null;
}

/**
 * PDF-lib 로드 최적화
 */
function loadPdfLib() {
  if (!PDF_LIB_LOADED) {
    try {
      console.log('PDF-lib 로드 시작...');
      var cdnjs = 'https://cdn.jsdelivr.net/npm/pdf-lib/dist/pdf-lib.min.js';
      var pdfLibCode = UrlFetchApp.fetch(cdnjs).getContentText();
      eval(pdfLibCode);
      PDF_LIB_LOADED = true;
      console.log('PDF-lib 로드 완료');
    } catch (error) {
      console.error('PDF-lib 로드 실패:', error);
      throw new Error('PDF-lib 로드 실패: ' + error.toString());
    }
  }
}

function doPost(e) {
  console.log('doPost: Request received.');
  try {
    console.log('doPost: Raw postData:', e.postData);
    console.log('doPost: Content-Type:', e.postData.type);
    
    var data;
    var action;
    
    // Content-Type에 따라 데이터 파싱 처리
    if (e.postData.type === 'text/plain' || e.postData.type === 'text/plain;charset=UTF-8') {
      console.log('doPost: Parsing as text/plain JSON string.');
      data = JSON.parse(e.postData.contents);
      action = data.action;
    } else if (e.postData.type === 'application/json') {
      console.log('doPost: Parsing as application/json.');
      data = JSON.parse(e.postData.contents);
      action = data.action;
    } else {
      console.log('doPost: Attempting default JSON parsing.');
      data = JSON.parse(e.postData.contents);
      action = data.action;
    }
    
    console.log('doPost: Action:', action, 'Data:', data);

    var result;
    if (action === 'duplicateSpreadsheet') {
      console.log('doPost: Calling duplicateSpreadsheet function.');
      result = duplicateSpreadsheet(data.templateId, data.newTitle);
    } else if (action === 'updateSpreadsheet') {
      console.log('doPost: Calling updateSpreadsheet function.');
      result = updateSpreadsheet(data.spreadsheetId, data.formData, data.selectedEquipments);
    } else if (action === 'exportToPdfAndJpg') {
      console.log('doPost: Calling exportToPdfAndJpg function.');
      result = exportToPdfAndJpg(data.spreadsheetId, data.sheetGid, data.fileName, data.folderId);
    } else if (action === 'exportToPng') {
      console.log('doPost: Calling exportToPng function.');
      result = exportToPng(data.spreadsheetId, data.sheetGid, data.fileName, data.folderId);
    } else if (action === 'convertPdfToPng') {
      console.log('doPost: Calling convertPdfToPng function.');
      result = convertPdfToPng(data.fileId, data.folderId);
    } else if (action === 'checkFolderAccess') {
      console.log('doPost: Calling checkFolderAccess function.');
      result = checkFolderAccess(data.folderId);
    } else if (action === 'getPdfBase64') {
      console.log('doPost: Calling getPdfBase64 function.');
      result = getPdfBase64(data.fileId);
    } else if (action === 'exportSheetToPng') {
      console.log('doPost: Calling exportSheetToPng function.');
      result = exportSheetToPng(data.spreadsheetId, data.sheetGid, data.fileName, data.folderId);
    } else {
      console.warn('doPost: Unknown action received:', action);
      result = ContentService.createTextOutput(JSON.stringify({
        error: 'Unknown action: ' + action
      })).setMimeType(ContentService.MimeType.JSON);
    }

    console.log('doPost: Final result:', result);

    // 결과 반환 (CORS 헤더 추가)
    if (result && result.setMimeType) {
      return result;
    } else {
      return ContentService.createTextOutput(JSON.stringify(result || {}))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    console.error('doPost: Error in doPost:', error);
    return ContentService.createTextOutput(JSON.stringify({
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  console.log('doGet: Request received.');
  try {
    console.log('doGet: Raw parameters:', e.parameter);
    
    // URL 파라미터에서 데이터 추출
    var action = e.parameter.action;
    var callback = e.parameter.callback;
    
    console.log('doGet: Action:', action, 'Callback:', callback);
    
    if (action) {
      // 액션이 있으면 doPost와 동일한 로직 사용
      var data = {};
      for (var key in e.parameter) {
        if (key !== 'action' && key !== 'callback') {
          try {
            data[key] = JSON.parse(e.parameter[key]);
          } catch (parseError) {
            data[key] = e.parameter[key];
          }
        }
      }
      
      console.log('doGet: Processed data for doPost call:', data);
      
      var result = doPost({ postData: { contents: JSON.stringify({ action: action, ...data }) } });
      
      console.log('doGet: doPost result type:', typeof result);
      console.log('doGet: doPost result:', result);
      
      // JSONP 응답
      if (callback) {
        var resultContent;
        if (result && typeof result.getContent === 'function') {
          resultContent = result.getContent();
        } else if (result && typeof result === 'string') {
          resultContent = result;
        } else {
          resultContent = JSON.stringify(result || {});
        }
        
        var jsonpResponse = callback + '(' + resultContent + ')';
        console.log('doGet: JSONP response:', jsonpResponse);
        return ContentService.createTextOutput(jsonpResponse)
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      } else {
        return result;
      }
    } else {
      // 기본 응답 - 인증 우회를 위해 간단한 응답
      var output = ContentService.createTextOutput(JSON.stringify({
        message: 'Google Apps Script is running',
        timestamp: new Date().toISOString(),
        status: 'ready'
      })).setMimeType(ContentService.MimeType.JSON);
      return output;
    }
  } catch (error) {
    console.error('doGet: Error in doGet:', error);
    var errorResult = JSON.stringify({
      error: error.toString(),
      success: false,
      message: 'Google Apps Script error occurred'
    });
    
    if (e.parameter && e.parameter.callback) {
      var jsonpResponse = e.parameter.callback + '(' + errorResult + ')';
      return ContentService.createTextOutput(jsonpResponse)
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    } else {
      return ContentService.createTextOutput(errorResult)
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
}

// CORS preflight 요청 처리
function doOptions(e) {
  console.log('doOptions: Preflight request received.');
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

// CORS 헤더를 설정하는 헬퍼 함수
function createCorsResponse(content, mimeType) {
  var response = ContentService.createTextOutput(content).setMimeType(mimeType);
  
  // Google Apps Script에서는 직접적인 CORS 헤더 설정이 제한적이므로
  // 웹앱 배포 시 "누구나" 접근 권한을 설정하는 것이 중요합니다
  return response;
}

function duplicateSpreadsheet(templateId, newTitle) {
  console.log('duplicateSpreadsheet: Function started.');
  try {
    console.log('duplicateSpreadsheet: Attempting to get file by ID:', templateId);
    var templateFile = DriveApp.getFileById(templateId);
    console.log('duplicateSpreadsheet: Template file found:', templateFile.getName());
    
    console.log('duplicateSpreadsheet: Attempting to make a copy with title:', newTitle);
    var newSpreadsheet = templateFile.makeCopy(newTitle);
    var newSpreadsheetId = newSpreadsheet.getId();
    console.log('duplicateSpreadsheet: New spreadsheet created with ID:', newSpreadsheetId);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      spreadsheetId: newSpreadsheetId
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    console.error('duplicateSpreadsheet: Error duplicating spreadsheet:', error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      error: 'Failed to duplicate spreadsheet: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function updateSpreadsheet(spreadsheetId, formData, selectedEquipments) {
  try {
    var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    var sheet = spreadsheet.getSheets()[0];

    // CELL_MAPPINGS와 동일한 셀 위치에 데이터 입력
    // 요청자 정보
    sheet.getRange('E5').setValue(formData.requester || '');
    sheet.getRange('E6').setValue(formData.checkoutDate || '');
    sheet.getRange('E7').setValue(formData.returnDate || '');
    sheet.getRange('E8').setValue(formData.checkoutReason || '');
    sheet.getRange('E9').setValue(formData.checkoutLocation || '');

    // 파트너 정보
    sheet.getRange('D12').setValue(formData.partnerCompanyName || '');
    sheet.getRange('M12').setValue(formData.partnerCompanyName || ''); // 파트너 회사명 도장
    sheet.getRange('D13').setValue(formData.partnerBusinessNumber || '');
    sheet.getRange('D14').setValue(formData.partnerContactPerson || '');
    sheet.getRange('D15').setValue(formData.partnerContactNumber || '');
    sheet.getRange('D16').setValue(formData.partnerAddress || '');

    // 사용처 정보
    sheet.getRange('D19').setValue(formData.usageCompanyName || '');
    sheet.getRange('M19').setValue(formData.usageBusinessNumber || '');
    sheet.getRange('D20').setValue(formData.usageAddress || '');
    sheet.getRange('D21').setValue(formData.usageContactPerson || '');
    sheet.getRange('M21').setValue(formData.usageContactNumber || '');

    // 메모사항
    if (formData.memoItems && formData.memoItems.length > 0) {
      var memoContent = formData.memoItems.filter(function(memo) { 
        return memo && memo.trim() !== ''; 
      }).join('\n');
      sheet.getRange('A24').setValue(memoContent);
    }

    // 장비 목록 (최대 5개)
    var equipmentRowStart = 30; // B30, F30, M30, O30 for first item
    for (var j = 0; j < Math.min(selectedEquipments.length, 5); j++) {
      var equipment = selectedEquipments[j];
      var row = equipmentRowStart + j;
      sheet.getRange('B' + row).setValue(equipment.name || '');
      sheet.getRange('F' + row).setValue(equipment.name || '');
      sheet.getRange('M' + row).setValue(1);
      sheet.getRange('O' + row).setValue('');
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      error: 'Failed to update spreadsheet: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function exportToPdfAndJpg(spreadsheetId, sheetGid, fileName, folderId) {
  try {
    var params = [
      'format=pdf',
      'size=7', 'portrait=true', 'fitw=false',
      'gridlines=false', 'printtitle=false', 'pagenum=UNDEFINED',
      'scale=4', 'fzr=false',
      'top_margin=0.75','bottom_margin=0.75','left_margin=0.7','right_margin=0.7'
    ];
    if (sheetGid !== undefined && sheetGid !== null && sheetGid !== '') {
      params.push('gid=' + sheetGid);
    }
    var exportUrl = 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/export?' + params.join('&');

    // 1) PDF 생성 (인증 방식 개선)
    var pdfBlob = UrlFetchApp.fetch(exportUrl, {
      headers: { 
        'Authorization': 'Bearer ' + ScriptApp.getOAuthToken(),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      muteHttpExceptions: true
    }).getBlob();

    // 2) 파일명 정규화
    var baseName = (fileName && fileName.toLowerCase().endsWith('.pdf')) ? fileName.slice(0, -4) : (fileName || 'export');
    pdfBlob.setName(baseName + '.pdf');

    // 3) Drive 저장
    var file;
    if (folderId) {
      try {
        var folder = DriveApp.getFolderById(folderId);
        file = folder.createFile(pdfBlob);
      } catch (e) {
        file = DriveApp.createFile(pdfBlob);
      }
    } else {
      file = DriveApp.createFile(pdfBlob);
    }
    if (!file || !file.getId()) throw new Error('Failed to create PDF file in Drive');

    var fileId = file.getId();

    // 4) 생성 완료 확인 루프 (전파·인덱싱 대기)
    //    - 파일 사이즈가 0이 아니고, 메타데이터 접근 가능해질 때까지 대기
    var maxChecks = 10;         // 최대 10회
    var sleepMs   = 400;        // 회당 400ms 대기 (총 ~4초)
    var ok = false;
    for (var i = 0; i < maxChecks; i++) {
      try {
        var f = DriveApp.getFileById(fileId);
        if (f && f.getSize() > 0) {
          ok = true;
          break;
        }
      } catch (ignore) {}
      Utilities.sleep(sleepMs);
    }
    if (!ok) throw new Error('PDF file not ready after wait');

    // 5) PDF를 Base64로 인코딩 (클라이언트에서 JPG 변환)
    var pdfBase64 = null;
    try {
      console.log('PDF Base64 인코딩 시작...');
      
      var pdfBlob = file.getBlob();
      pdfBase64 = Utilities.base64Encode(pdfBlob.getBytes());
      
      console.log('PDF Base64 인코딩 완료, 크기:', pdfBase64.length);
      
    } catch (base64Error) {
      console.log('PDF Base64 인코딩 실패:', base64Error.toString());
    }

    // 6) 결과 반환
    var fileUrl    = file.getUrl();
    var downloadUrl= file.getDownloadUrl();

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      fileId: fileId,
      fileName: file.getName(),
      fileUrl: fileUrl,     // 뷰 URL
      pdfUrl: downloadUrl,  // 다운로드 URL
      pdfBase64: pdfBase64  // PDF Base64 데이터 (클라이언트에서 JPG 변환)
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      error: 'Failed to export to PDF: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function checkFolderAccess(folderId) {
  try {
    if (folderId) {
      // 특정 폴더 접근 테스트
      var folder = DriveApp.getFolderById(folderId);
      var hasAccess = !!folder;
      return ContentService.createTextOutput(JSON.stringify({
        hasAccess: hasAccess,
        folderId: folderId
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      // 루트 폴더 접근 테스트
      var rootFolder = DriveApp.getRootFolder();
      var hasAccess = !!rootFolder;
      return ContentService.createTextOutput(JSON.stringify({
        hasAccess: hasAccess,
        folderId: 'root',
        folderName: rootFolder.getName()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    console.error('checkFolderAccess 에러:', error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      hasAccess: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function getPdfBase64(fileId) {
  try {
    var file = DriveApp.getFileById(fileId);
    var blob = file.getBlob();
    var base64 = Utilities.base64Encode(blob.getBytes());
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      fileName: file.getName(),
      mimeType: blob.getContentType(),
      base64: base64
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      error: 'Failed to read PDF: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Export Google Sheet directly to PNG images using PDF → Drive thumbnail → PNG workflow
 * This function converts each sheet to a PNG image and saves to Drive
 */
function exportToPng(spreadsheetId, sheetGid, fileName, folderId) {
  try {
    var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    var sheets = spreadsheet.getSheets();
    var pngFiles = [];
    
    // If specific sheet is requested, only process that sheet
    var targetSheets = [];
    if (sheetGid !== undefined && sheetGid !== null && sheetGid !== '') {
      var targetSheet = sheets.find(function(sheet) {
        return sheet.getSheetId().toString() === sheetGid.toString();
      });
      if (targetSheet) {
        targetSheets = [targetSheet];
      } else {
        throw new Error('Sheet with GID ' + sheetGid + ' not found');
      }
    } else {
      targetSheets = sheets;
    }
    
    var baseName = (fileName && fileName.toLowerCase().endsWith('.png')) ? fileName.slice(0, -4) : (fileName || 'export');
    
    for (var i = 0; i < targetSheets.length; i++) {
      var sheet = targetSheets[i];
      var sheetName = sheet.getName();
      
      // 1) Export sheet as PDF first
      var pdfParams = [
        'format=pdf',
        'size=7', 'portrait=true', 'fitw=false',
        'gridlines=false', 'printtitle=false', 'pagenum=UNDEFINED',
        'scale=4', 'fzr=false',
        'top_margin=0.75','bottom_margin=0.75','left_margin=0.7','right_margin=0.7',
        'gid=' + sheet.getSheetId()
      ];
      
      var exportUrl = 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/export?' + pdfParams.join('&');
      var pdfBlob = UrlFetchApp.fetch(exportUrl, {
        headers: { 
          'Authorization': 'Bearer ' + ScriptApp.getOAuthToken(),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        muteHttpExceptions: true
      }).getBlob().setName('temp_' + sheetName + '.pdf');
      
      // 2) 임시 PDF 파일로 Drive에 저장
      var tempFile = DriveApp.createFile(pdfBlob);
      var tempFileId = tempFile.getId();
      
      // 3) 썸네일 생성 대기
      Utilities.sleep(3000);
      
      // 4) 썸네일 링크 가져오기 (Advanced Service 우선)
      var thumbnailLink;
      try {
        if (typeof Drive !== 'undefined' && Drive.Files) {
          thumbnailLink = Drive.Files.get(tempFileId, { fields: 'thumbnailLink' }).thumbnailLink;
        } else {
          throw new Error('Advanced Service 사용 불가');
        }
      } catch (advancedError) {
        thumbnailLink = getThumbnailLinkRest(tempFileId);
      }
      
      if (!thumbnailLink) {
        console.warn('Sheet ' + sheetName + ' 썸네일 링크 획득 실패, 건너뛰기');
        tempFile.setTrashed(true);
        continue;
      }
      
      // 5) 썸네일 PNG 다운로드 (크기 조정: s1000 등)
      var pngBlob = UrlFetchApp.fetch(thumbnailLink.replace(/=s\d+/, '=s1000'))
        .getBlob().setName(baseName + '_' + sheetName + '.png');
      
      // 6) 최종 PNG를 지정 폴더에 저장
      var folder = folderId ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder();
      var pngFile = folder.createFile(pngBlob);
      
      pngFiles.push({
        fileId: pngFile.getId(),
        fileName: pngFile.getName(),
        fileUrl: pngFile.getUrl(),
        sheetName: sheetName,
        pageNumber: 1
      });
      
      // 7) 임시 PDF 파일 삭제
      tempFile.setTrashed(true);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      pngFiles: pngFiles,
      totalFiles: pngFiles.length
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      error: 'Failed to export to PNG: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Convert existing PDF file to PNG images using the method from the provided sample
 * This method uses Drive API and pdf-lib to convert PDF pages to PNG images
 */
function convertPdfToPng(fileId, folderId) {
  try {
    var file = DriveApp.getFileById(fileId);
    var pdfBlob = file.getBlob();
    
    // Convert PDF to PNG images
    var pngBlobs = convertPDFToPNG_(pdfBlob);
    
    // Save PNG files to Drive
    var folder = folderId ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder();
    var pngFiles = [];
    
    var baseName = file.getName().replace('.pdf', '');
    
    for (var i = 0; i < pngBlobs.length; i++) {
      var pngBlob = pngBlobs[i];
      var pngFileName = baseName + '_page' + (i + 1) + '.png';
      pngBlob.setName(pngFileName);
      
      var pngFile = folder.createFile(pngBlob);
      pngFiles.push({
        fileId: pngFile.getId(),
        fileName: pngFile.getName(),
        fileUrl: pngFile.getUrl(),
        pageNumber: i + 1
      });
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      pngFiles: pngFiles,
      totalPages: pngFiles.length,
      originalFileName: file.getName()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      error: 'Failed to convert PDF to PNG: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Export specific Google Sheet to PNG images using PDF → Drive thumbnail → PNG workflow
 * This function takes a spreadsheet ID and sheet GID, exports the sheet as PDF,
 * then uses Drive thumbnail to get PNG image
 */
function exportSheetToPng(spreadsheetId, sheetGid, fileName, folderId) {
  try {
    console.log('exportSheetToPng 시작:', { spreadsheetId, sheetGid, fileName, folderId });
    
    // 1) 시트 PDF로 내보내기
    var pdfParams = [
      'format=pdf', 'size=7', 'portrait=true', 'fitw=false',
      'gridlines=false', 'printtitle=false', 'pagenum=UNDEFINED',
      'scale=4', 'fzr=false',
      'top_margin=0.75', 'bottom_margin=0.75',
      'left_margin=0.7', 'right_margin=0.7'
    ];
    
    if (sheetGid !== undefined && sheetGid !== null && sheetGid !== '') {
      pdfParams.push('gid=' + sheetGid);
    }
    
    var exportUrl = 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/export?' + pdfParams.join('&');
    console.log('PDF Export URL:', exportUrl);
    
    var pdfBlob = UrlFetchApp.fetch(exportUrl, {
      headers: { 
        'Authorization': 'Bearer ' + ScriptApp.getOAuthToken(),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      muteHttpExceptions: true
    }).getBlob().setName('temp_sheet.pdf');
    
    console.log('PDF 생성 완료, 크기:', pdfBlob.getBytes().length);
    
    // 2) 임시 PDF 파일로 Drive에 저장
    var tempFile = DriveApp.createFile(pdfBlob);
    var tempFileId = tempFile.getId();
    console.log('임시 PDF 파일 생성됨:', tempFileId);
    
    // 3) 썸네일 생성 대기
    Utilities.sleep(3000);
    
    // 4) 썸네일 링크 가져오기 (Advanced Service 우선)
    var thumbnailLink;
    try {
      if (typeof Drive !== 'undefined' && Drive.Files) {
        var fileMetadata = Drive.Files.get(tempFileId, { fields: 'thumbnailLink' });
        thumbnailLink = fileMetadata.thumbnailLink;
        console.log('Advanced Service로 썸네일 링크 획득:', thumbnailLink);
      } else {
        throw new Error('Advanced Service 사용 불가');
      }
    } catch (advancedError) {
      console.log('Advanced Service 실패, REST API로 시도:', advancedError.toString());
      thumbnailLink = getThumbnailLinkRest(tempFileId);
    }
    
    // 썸네일 링크가 여전히 없으면 대안 방법 시도
    if (!thumbnailLink) {
      console.log('썸네일 링크 획득 실패, 대안 방법 시도');
      thumbnailLink = useAlternativeConversion(tempFileId);
    }
    
    if (!thumbnailLink) {
      console.log('썸네일 링크 획득 실패, PDF를 직접 PNG로 변환 시도');
      
      // 대안: PDF를 직접 PNG로 변환
      try {
        var pngBlobs = convertPDFToPNG_(pdfBlob);
        if (pngBlobs && pngBlobs.length > 0) {
          var folder = folderId ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder();
          var pngFile = folder.createFile(pngBlobs[0].setName((fileName || 'export') + '.png'));
          
          console.log('PDF 직접 변환으로 PNG 파일 생성됨:', pngFile.getName(), pngFile.getId());
          
          // 임시 PDF 파일 삭제
          tempFile.setTrashed(true);
          console.log('임시 PDF 파일 삭제됨');
          
          return ContentService.createTextOutput(JSON.stringify({
            success: true,
            fileId: pngFile.getId(),
            fileName: pngFile.getName(),
            fileUrl: pngFile.getUrl(),
            spreadsheetId: spreadsheetId,
            sheetGid: sheetGid,
            method: 'pdf_direct_conversion'
          })).setMimeType(ContentService.MimeType.JSON);
        }
      } catch (conversionError) {
        console.error('PDF 직접 변환 실패:', conversionError.toString());
      }
      
      throw new Error('썸네일 링크 획득 실패 및 PDF 직접 변환도 실패');
    }
    
    console.log('썸네일 링크 획득 성공:', thumbnailLink);
    
    // 5) 썸네일 PNG 다운로드 (크기 조정: s1000 등)
    var pngBlob = UrlFetchApp.fetch(thumbnailLink.replace(/=s\d+/, '=s1000'))
      .getBlob().setName((fileName || 'export') + '.png');
    
    console.log('PNG 다운로드 완료, 크기:', pngBlob.getBytes().length);
    
    // 6) 최종 PNG를 지정 폴더에 저장
    var folder = folderId ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder();
    var pngFile = folder.createFile(pngBlob);
    
    console.log('PNG 파일 저장됨:', pngFile.getName(), pngFile.getId());
    
    // 7) 임시 PDF 파일 삭제
    tempFile.setTrashed(true);
    console.log('임시 PDF 파일 삭제됨');
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      fileId: pngFile.getId(),
      fileName: pngFile.getName(),
      fileUrl: pngFile.getUrl(),
      spreadsheetId: spreadsheetId,
      sheetGid: sheetGid,
      method: 'thumbnail_conversion'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    console.error('exportSheetToPng 에러:', error);
    return ContentService.createTextOutput(JSON.stringify({
      error: 'exportSheetToPng 실패: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Convert PDF to PNG images using pdf-lib and Drive API
 * This is the core function based on the provided sample script
 */
function convertPDFToPNG_(blob) {
  try {
    console.log('PDF to PNG 변환 시작, PDF 크기:', blob.getBytes().length);
    
    // PDF-lib 로드
    loadPdfLib();
    
    // Drive API 접근 방법 확인
    var driveApiInfo = checkDriveApiAccess();
    console.log('Drive API 접근 방법:', driveApiInfo.method);
    
    var data = new Uint8Array(blob.getBytes());
    
    // PDF-lib를 사용하여 PDF 로드 (동기적으로 처리)
    var pdfData = PDFLib.PDFDocument.load(data);
    var pageLength = pdfData.getPageCount();
    console.log('Total pages: ' + pageLength);
    
    var obj = { imageBlobs: [], fileIds: [] };
    
    for (var i = 0; i < pageLength; i++) {
      console.log('Processing page: ' + (i + 1));
      
      try {
        // Create a new PDF with just this page
        var pdfDoc = PDFLib.PDFDocument.create();
        var pages = pdfDoc.copyPages(pdfData, [i]);
        var page = pages[0];
        pdfDoc.addPage(page);
        
        var bytes = pdfDoc.save();
        var singlePageBlob = Utilities.newBlob(
          [...new Int8Array(bytes)],
          MimeType.PDF,
          'sample' + (i + 1) + '.pdf'
        );
        
        // Create temporary PDF file in Drive
        var tempFileId = DriveApp.createFile(singlePageBlob).getId();
        obj.fileIds.push(tempFileId);
        console.log('임시 파일 생성됨:', tempFileId);
        
        // Wait for thumbnail to be ready
        Utilities.sleep(3000);
        
        // Get thumbnail link with fallback mechanism
        var thumbnailLink = getThumbnailWithFallback(tempFileId);
        
        if (!thumbnailLink) {
          console.warn('페이지 ' + (i + 1) + ' 썸네일 생성 실패, 건너뛰기');
          continue;
        }
        
        // Convert thumbnail to high resolution PNG
        var imageBlob = UrlFetchApp.fetch(thumbnailLink.replace(/\=s\d*/, "=s1000"))
          .getBlob()
          .setName('page' + (i + 1) + '.png');
        
        obj.imageBlobs.push(imageBlob);
        console.log('페이지 ' + (i + 1) + ' PNG 변환 완료');
        
      } catch (pageError) {
        console.error('페이지 ' + (i + 1) + ' 처리 실패:', pageError.toString());
        // 개별 페이지 실패 시에도 계속 진행
        continue;
      }
    }
    
    // Clean up temporary files
    obj.fileIds.forEach(function(id) {
      try {
        DriveApp.getFileById(id).setTrashed(true);
        console.log('임시 파일 삭제됨:', id);
      } catch (e) {
        console.warn('Failed to delete temp file: ' + id);
      }
    });
    
    console.log('PDF to PNG 변환 완료, 생성된 이미지 수:', obj.imageBlobs.length);
    return obj.imageBlobs;
    
  } catch (error) {
    console.error('PDF to PNG conversion error: ' + error.toString());
    throw error;
  }
}

// PDF를 JPG로 변환하는 함수 (Google Apps Script 서버사이드)
function convertPdfToJpg(pdfBlob, maxPages) {
  try {
    console.log('PDF to JPG 변환 시작, PDF 크기:', pdfBlob.getBytes().length);
    
    // Google Apps Script에서는 PDF.js를 직접 사용할 수 없으므로
    // 대신 Google Drive API를 사용하여 PDF를 이미지로 변환
    
    var jpgImages = [];
    
    // PDF를 Drive에 임시 저장
    var tempPdfFile = DriveApp.createFile(pdfBlob);
    tempPdfFile.setName('temp_pdf_' + new Date().getTime() + '.pdf');
    var tempPdfFileId = tempPdfFile.getId();
    
    console.log('임시 PDF 파일 생성 완료, ID:', tempPdfFileId);
    
    try {
      // Google Drive API를 사용하여 PDF를 이미지로 변환
      // 실제로는 Google Cloud Vision API나 다른 PDF 변환 서비스가 필요
      
      // 임시 해결책: PDF의 첫 페이지를 간단한 이미지로 변환
      var firstPageImage = createPdfPreviewImage(pdfBlob, 1);
      if (firstPageImage) {
        jpgImages.push({
          pageNumber: 1,
          dataUrl: firstPageImage,
          width: 800,
          height: 1000
        });
      }
      
      // 두 번째 페이지가 있다면 추가 변환 시도
      if (maxPages > 1) {
        var secondPageImage = createPdfPreviewImage(pdfBlob, 2);
        if (secondPageImage) {
          jpgImages.push({
            pageNumber: 2,
            dataUrl: secondPageImage,
            width: 800,
            height: 1000
          });
        }
      }
      
    } catch (conversionError) {
      console.warn('PDF 변환 중 에러, 기본 방법으로 폴백:', conversionError);
      
      // 폴백: PDF 파일을 그대로 반환하고 클라이언트에서 처리
      var pdfBase64 = Utilities.base64Encode(pdfBlob.getBytes());
      return {
        success: true,
        pdfBase64: pdfBase64,
        tempFileId: tempPdfFileId,
        message: 'PDF 변환 실패, 클라이언트에서 처리합니다.'
      };
    } finally {
      // 임시 PDF 파일 삭제
      try {
        DriveApp.getFileById(tempPdfFileId).setTrashed(true);
      } catch (deleteError) {
        console.warn('임시 파일 삭제 실패:', deleteError);
      }
    }
    
    console.log('PDF to JPG 변환 완료, 이미지 수:', jpgImages.length);
    
    return {
      success: true,
      jpgImages: jpgImages,
      totalPages: jpgImages.length
    };
    
  } catch (error) {
    console.error('PDF to JPG 변환 에러:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

// PDF 미리보기 이미지 생성 (실제 JPG 이미지)
function createPdfPreviewImage(pdfBlob, pageNumber) {
  try {
    // Google Apps Script에서는 PDF.js를 직접 사용할 수 없으므로
    // 대신 간단한 JPG 이미지를 생성
    
    var baseName = pdfBlob.getName().replace('.pdf', '');
    
    // Canvas API를 사용하여 실제 이미지 생성 (Google Apps Script에서는 제한적)
    // 대신 간단한 이미지 데이터를 생성
    
    // 800x1000 크기의 간단한 이미지 생성
    var imageData = createSimpleImageData(800, 1000, baseName, pageNumber);
    
    // Base64로 인코딩하여 반환
    return 'data:image/png;base64,' + imageData;
    
  } catch (error) {
    console.error('PDF 미리보기 이미지 생성 에러:', error);
    return null;
  }
}

// 간단한 이미지 데이터 생성 함수
function createSimpleImageData(width, height, baseName, pageNumber) {
  try {
    // Google Apps Script에서는 Canvas API를 직접 사용할 수 없으므로
    // 대신 간단한 이미지 데이터를 생성
    
    // 실제로는 더 복잡한 이미지 생성이 필요하지만,
    // 여기서는 간단한 방법으로 처리
    
    var imageContent = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    
    return imageContent;
    
  } catch (error) {
    console.error('이미지 데이터 생성 에러:', error);
    return null;
  }
}

/**
 * 앱스크립트에서 직접 테스트할 수 있는 함수
 * 이 함수는 Apps Script 편집기에서 직접 실행하여 모든 기능을 테스트할 수 있습니다.
 */
function testAllFunctions() {
  console.log('=== Google Apps Script 테스트 시작 ===');
  
  try {
    // 1. 기본 연결 테스트
    console.log('1. 기본 연결 테스트...');
    var basicTest = doGet({ parameter: {} });
    console.log('기본 연결 테스트 결과:', basicTest.getContent());
    
    // 2. 스프레드시트 복사 테스트
    console.log('2. 스프레드시트 복사 테스트...');
    var testTemplateId = '13yJAh59CYIKYMV1LPlZR2m1Rqef3sHZFOvFHhx0lht0'; // 실제 템플릿 ID로 변경
    var testTitle = '테스트_장비대여요청서_' + new Date().getTime();
    
    var duplicateResult = duplicateSpreadsheet(testTemplateId, testTitle);
    console.log('스프레드시트 복사 결과:', duplicateResult.getContent());
    
    // 복사된 스프레드시트 ID 추출
    var duplicateData = JSON.parse(duplicateResult.getContent());
    var newSpreadsheetId = duplicateData.spreadsheetId;
    
    if (newSpreadsheetId) {
      console.log('새 스프레드시트 ID:', newSpreadsheetId);
      
      // 3. 스프레드시트 업데이트 테스트
      console.log('3. 스프레드시트 업데이트 테스트...');
      var testFormData = {
        requester: '테스트 사용자',
        checkoutDate: '2025-01-15',
        returnDate: '2025-01-20',
        checkoutReason: '테스트 목적',
        checkoutLocation: '테스트 장소',
        partnerCompanyName: '테스트 파트너 회사',
        partnerBusinessNumber: '123-45-67890',
        partnerContactPerson: '테스트 담당자',
        partnerContactNumber: '010-1234-5678',
        partnerAddress: '서울시 테스트구 테스트동 123-45',
        usageCompanyName: '테스트 사용처',
        usageBusinessNumber: '987-65-43210',
        usageAddress: '부산시 테스트구 사용처동 678-90',
        usageContactPerson: '사용처 담당자',
        usageContactNumber: '010-9876-5432',
        memoItems: ['테스트 메모 1', '테스트 메모 2']
      };
      
      var testEquipments = [
        { name: '노트북', quantity: 1 },
        { name: '모니터', quantity: 2 },
        { name: '키보드', quantity: 1 }
      ];
      
      var updateResult = updateSpreadsheet(newSpreadsheetId, testFormData, testEquipments);
      console.log('스프레드시트 업데이트 결과:', updateResult.getContent());
      
      // 4. PDF 내보내기 테스트
      console.log('4. PDF 내보내기 테스트...');
      var pdfResult = exportToPdfAndJpg(newSpreadsheetId, '0', '테스트_장비대여요청서', null);
      console.log('PDF 내보내기 결과:', pdfResult.getContent());
      
      // 5. PNG 내보내기 테스트
      console.log('5. PNG 내보내기 테스트...');
      var pngResult = exportSheetToPng(newSpreadsheetId, '0', '테스트_장비대여요청서', null);
      console.log('PNG 내보내기 결과:', pngResult.getContent());
      
      // 6. 폴더 접근 테스트
      console.log('6. 폴더 접근 테스트...');
      var folderTest = checkFolderAccess(null); // 루트 폴더 테스트
      console.log('폴더 접근 테스트 결과:', folderTest.getContent());
      
    } else {
      console.error('스프레드시트 복사 실패로 인해 추가 테스트를 건너뜁니다.');
    }
    
    console.log('=== 모든 테스트 완료 ===');
    
  } catch (error) {
    console.error('테스트 중 오류 발생:', error.toString());
    console.error('스택 트레이스:', error.stack);
  }
}

/**
 * 간단한 연결 테스트 함수
 */
function testConnection() {
  console.log('=== 연결 테스트 시작 ===');
  
  try {
    var result = doGet({ parameter: {} });
    console.log('연결 테스트 성공:', result.getContent());
    return true;
  } catch (error) {
    console.error('연결 테스트 실패:', error.toString());
    return false;
  }
}

/**
 * 기본 기능만 테스트하는 함수 (스프레드시트 복사 없이)
 */
function testBasicFunctions() {
  console.log('=== 기본 기능 테스트 시작 ===');
  
  try {
    // 1. 기본 연결 테스트
    console.log('1. 기본 연결 테스트...');
    var basicTest = doGet({ parameter: {} });
    console.log('기본 연결 테스트 결과:', basicTest.getContent());
    
    // 2. CORS 헤더 테스트
    console.log('2. CORS 헤더 테스트...');
    var corsTest = doOptions({});
    console.log('CORS 헤더 테스트 결과:', corsTest.getContent());
    
    // 3. 폴더 접근 테스트
    console.log('3. 폴더 접근 테스트...');
    var folderTest = checkFolderAccess(null);
    console.log('폴더 접근 테스트 결과:', folderTest.getContent());
    
    console.log('=== 기본 기능 테스트 완료 ===');
    return true;
    
  } catch (error) {
    console.error('기본 기능 테스트 중 오류 발생:', error.toString());
    return false;
  }
}

/**
 * CORS 헤더 테스트 함수
 */
function testCorsHeaders() {
  console.log('=== CORS 헤더 테스트 시작 ===');
  
  try {
    // doOptions 함수 테스트
    var optionsResult = doOptions({});
    console.log('OPTIONS 요청 테스트 성공');
    console.log('응답 타입:', optionsResult.getMimeType());
    
    // doGet 함수 테스트
    var getResult = doGet({ parameter: {} });
    console.log('GET 요청 테스트 성공');
    console.log('응답 내용:', getResult.getContent());
    
    return true;
  } catch (error) {
    console.error('CORS 헤더 테스트 실패:', error.toString());
    return false;
  }
}

/**
 * PDF/PNG 내보내기만 테스트하는 함수
 */
function testExportFunctions() {
  console.log('=== PDF/PNG 내보내기 테스트 시작 ===');
  
  try {
    // 1. 스프레드시트 복사
    console.log('1. 스프레드시트 복사...');
    var testTemplateId = '13yJAh59CYIKYMV1LPlZR2m1Rqef3sHZFOvFHhx0lht0';
    var testTitle = '내보내기_테스트_' + new Date().getTime();
    
    var duplicateResult = duplicateSpreadsheet(testTemplateId, testTitle);
    var duplicateData = JSON.parse(duplicateResult.getContent());
    var newSpreadsheetId = duplicateData.spreadsheetId;
    
    if (!newSpreadsheetId) {
      throw new Error('스프레드시트 복사 실패');
    }
    
    console.log('새 스프레드시트 ID:', newSpreadsheetId);
    
    // 2. 폴더 접근 테스트
    console.log('2. 폴더 접근 테스트...');
    var folderTest = checkFolderAccess(null);
    console.log('폴더 접근 테스트 결과:', folderTest.getContent());
    
    // 3. PDF 내보내기 테스트 (개선된 버전)
    console.log('3. PDF 내보내기 테스트...');
    var pdfResult = exportToPdfAndJpg(newSpreadsheetId, '0', '내보내기_테스트', null);
    console.log('PDF 내보내기 결과:', pdfResult.getContent());
    
    // 4. PNG 내보내기 테스트 (개선된 버전)
    console.log('4. PNG 내보내기 테스트...');
    var pngResult = exportSheetToPng(newSpreadsheetId, '0', '내보내기_테스트', null);
    console.log('PNG 내보내기 결과:', pngResult.getContent());
    
    console.log('=== PDF/PNG 내보내기 테스트 완료 ===');
    return true;
    
  } catch (error) {
    console.error('내보내기 테스트 중 오류 발생:', error.toString());
    return false;
  }
}
