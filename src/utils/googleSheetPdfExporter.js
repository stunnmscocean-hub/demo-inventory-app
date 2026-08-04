/* global */
// src/utils/googleSheetPdfExporter.js - Google Apps Script 방식

// Google Apps Script Web App URL (.env.local에서 읽어옴)
export const APPS_SCRIPT_WEB_APP_URL = process.env.REACT_APP_GAS_URL || 'https://script.google.com/macros/s/AKfycbxMBYAV9wZXg4I0pYVG_HC5Tw5oxhLwjPA0Jb2e1tJx-1DopQJCMPiSlf_aZzb1K8VV/exec';

// 디버깅을 위한 URL 로그
console.log('Apps Script URL:', APPS_SCRIPT_WEB_APP_URL);
console.log('URL 접근 테스트를 위해 브라우저에서 직접 접속해보세요:', APPS_SCRIPT_WEB_APP_URL);

// Template Spreadsheet ID and GID from the provided URL
export const TEMPLATE_SPREADSHEET_ID = '13yJAh59CYIKYMV1LPlZR2m1Rqef3sHZFOvFHhx0lht0';
export const TEMPLATE_SHEET_GID = '1326732411'; // This is the gid for the specific sheet/tab

// Google Drive folder ID for saving PDFs
export const PDF_FOLDER_ID = '1x4dl_uWgrIcHbI19Il3xQzSEqY5Q68S4'; // PDF 저장 폴더
export const SHEET_FOLDER_ID = '1kwlO_ECacC1KDThPnZWpxXvLEqGUALvl'; // 복제된 스프레드시트 저장 폴더

// 하위 호환성을 위한 별칭
export const DRIVE_FOLDER_ID = PDF_FOLDER_ID;

// Configuration constants
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;
// const API_TIMEOUT_MS = 30000; // Unused for now

// Error types for better error handling
const ERROR_TYPES = {
  NETWORK: 'NETWORK',
  API: 'API',
  AUTHENTICATION: 'AUTHENTICATION',
  VALIDATION: 'VALIDATION',
  TIMEOUT: 'TIMEOUT'
};

// ===== 시트 입력 함수들 =====

/**
 * 시트 입력 서비스 핑 테스트
 */
export const pingSheetInputService = async () => {
  try {
    const response = await fetch(`${APPS_SCRIPT_WEB_APP_URL}?action=ping`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Ping sheet input service error:', error);
    throw new Error(`Failed to connect to sheet input service: ${error.message}`);
  }
};

/**
 * 시트에 새 데이터 추가 (updateGoogleSheetWithData와 동일한 방식)
 */
export const addDataToSheet = async (accessToken, spreadsheetId, formData, selectedEquipments) => {
  return await retryWithBackoff(async () => {
    console.log('addDataToSheet POST 요청 시작:', { spreadsheetId, equipmentCount: selectedEquipments.length });

    const now = new Date();
    const timestampStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const updatedFormData = {
      ...formData,
      processedAt: formData?.processedAt || timestampStr,
      timestamp: formData?.timestamp || timestampStr,
      '처리시간스탬프': formData?.['처리시간스탬프'] || timestampStr
    };

    const updatedEquipments = (selectedEquipments || []).map(eq => ({
      ...eq,
      processedAt: eq.processedAt || timestampStr,
      timestamp: eq.timestamp || timestampStr,
      '처리시간스탬프': eq['처리시간스탬프'] || timestampStr
    }));

    const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',  // 단순 요청으로 CORS 우회
      },
      body: JSON.stringify({
        action: 'addDataToSheet',
        spreadsheetId: spreadsheetId,
        formData: updatedFormData,
        selectedEquipments: updatedEquipments,
        accessToken: accessToken || 'apps-script-mode'
      })
    });

    console.log('addDataToSheet 응답 상태:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      throw new GoogleApiError(`HTTP ${response.status}: ${errorText}`, ERROR_TYPES.NETWORK);
    }

    const data = await response.json();
    console.log('addDataToSheet 응답 데이터:', data);

    if (data.error) {
      throw new GoogleApiError(`Apps Script error: ${data.error}`, ERROR_TYPES.API);
    }

    return data.success === true;
  });
};

/**
 * Custom error class for Google API errors
 */
class GoogleApiError extends Error {
  constructor(message, type = ERROR_TYPES.API, originalError = null) {
    super(message);
    this.name = 'GoogleApiError';
    this.type = type;
    this.originalError = originalError;
  }
}

/**
 * Retry utility with exponential backoff
 */
async function retryWithBackoff(fn, maxAttempts = MAX_RETRY_ATTEMPTS) {
  let attempt = 0;
  
  while (attempt < maxAttempts) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      
      if (attempt >= maxAttempts) {
        throw error;
      }
      
      // 진짜 지수 백오프: 기본 지연시간 * 2^시도횟수
      const backoffDelay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      
      // 에러 메시지 안전하게 출력
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      console.warn(`Attempt ${attempt} failed, retrying in ${backoffDelay}ms:`, errorMessage);
      
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
}

/**
 * Initialize Google APIs (simplified for Apps Script)
 */
export const initGoogleApis = async () => {
  console.log("googleSheetPdfExporter: initGoogleApis called (Apps Script mode).");
  return Promise.resolve({ success: true });
};

/**
 * Test Apps Script connection
 */
export const testAppsScriptConnection = async () => {
  try {
    return new Promise((resolve, reject) => {
      const callbackName = 'jsonpCallback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      
      window[callbackName] = (data) => {
        delete window[callbackName];
        if (document.head.contains(script)) {
          document.head.removeChild(script);
        }
        
        if (data.error) {
          reject(new GoogleApiError(`Apps Script test failed: ${data.error}`, ERROR_TYPES.API));
        } else {
          resolve({ success: true, message: data.message || 'Connection successful' });
        }
      };
      
      const script = document.createElement('script');
      script.src = `${APPS_SCRIPT_WEB_APP_URL}?callback=${callbackName}`;
      script.onerror = (error) => {
        console.error('Apps Script connection test failed:', error);
        delete window[callbackName];
        if (document.head.contains(script)) {
          document.head.removeChild(script);
        }
        reject(new GoogleApiError('Apps Script connection test failed', ERROR_TYPES.NETWORK));
      };
      
      setTimeout(() => {
        if (window[callbackName]) {
          delete window[callbackName];
          if (document.head.contains(script)) {
            document.head.removeChild(script);
          }
          reject(new GoogleApiError('Apps Script connection test timeout', ERROR_TYPES.TIMEOUT));
        }
      }, 10000);
      
      document.head.appendChild(script);
    });
  } catch (error) {
    throw new GoogleApiError(`Apps Script connection test error: ${error.message}`, ERROR_TYPES.NETWORK);
  }
};

/**
 * Duplicate spreadsheet using Apps Script (POST 방식)
 */
export const duplicateSpreadsheet = async (accessToken, templateId, newTitle) => {
  return await retryWithBackoff(async () => {
    console.log('duplicateSpreadsheet POST 요청 시작:', { templateId, newTitle, targetFolder: SHEET_FOLDER_ID });
    
    const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',  // 단순 요청으로 CORS 우회
      },
      body: JSON.stringify({
        action: 'duplicateSpreadsheet',
        templateId: templateId,
        newTitle: newTitle,
        accessToken: accessToken || 'apps-script-mode'
      })
    });

    console.log('duplicateSpreadsheet 응답 상태:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('duplicateSpreadsheet 응답 에러:', errorText);
      throw new GoogleApiError(
        `Apps Script request failed: ${response.status} ${response.statusText} - ${errorText}`,
        ERROR_TYPES.API
      );
    }

    const result = await response.json();
    console.log('duplicateSpreadsheet 응답 데이터:', result);
    
    if (result.error) {
      throw new GoogleApiError(`Apps Script error: ${result.error}`, ERROR_TYPES.API);
    }
    
    if (!result.spreadsheetId) {
      throw new GoogleApiError('No spreadsheet ID returned from Apps Script', ERROR_TYPES.API);
    }
    
    return result.spreadsheetId;
  });
};

/**
 * Update Google Sheet with form data using Apps Script
 */
export const updateGoogleSheetWithData = async (accessToken, spreadsheetId, formData, selectedEquipments) => {
  return await retryWithBackoff(async () => {
    console.log('updateGoogleSheetWithData POST 요청 시작:', { spreadsheetId, equipmentCount: selectedEquipments.length });

    const now = new Date();
    const timestampStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const updatedFormData = {
      ...formData,
      processedAt: formData?.processedAt || timestampStr,
      timestamp: formData?.timestamp || timestampStr,
      '처리시간스탬프': formData?.['처리시간스탬프'] || timestampStr
    };

    const updatedEquipments = (selectedEquipments || []).map(eq => ({
      ...eq,
      processedAt: eq.processedAt || timestampStr,
      timestamp: eq.timestamp || timestampStr,
      '처리시간스탬프': eq['처리시간스탬프'] || timestampStr
    }));

    const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',  // 단순 요청으로 CORS 우회
      },
      body: JSON.stringify({
        action: 'updateSpreadsheet',
        spreadsheetId: spreadsheetId,
        formData: updatedFormData,
        selectedEquipments: updatedEquipments,
        accessToken: accessToken || 'apps-script-mode'
      })
    });

    console.log('updateGoogleSheetWithData 응답 상태:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      throw new GoogleApiError(`HTTP ${response.status}: ${errorText}`, ERROR_TYPES.NETWORK);
    }

    const data = await response.json();
    console.log('updateGoogleSheetWithData 응답 데이터:', data);

    if (data.error) {
      throw new GoogleApiError(`Apps Script error: ${data.error}`, ERROR_TYPES.API);
    }

    return data.success === true;
  });
};

/**
 * Export Google Sheet to PDF and convert to JPG using Apps Script
 */
export const exportGoogleSheetToPdfAndConvertToJpg = async (accessToken, spreadsheetId, sheetGid, fileName) => {
  return await retryWithBackoff(async () => {
    const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'exportToPdfAndJpg',
        spreadsheetId: spreadsheetId,
        sheetGid: sheetGid,
        fileName: fileName,
        folderId: PDF_FOLDER_ID, // PDF 저장 폴더
        accessToken: accessToken
      })
    });

    if (!response.ok) {
      throw new GoogleApiError(
        `Apps Script request failed: ${response.status} ${response.statusText}`,
        ERROR_TYPES.API
      );
    }

    const result = await response.json();
    
    console.log('=== GAS PDF Export 응답 ===');
    console.log('전체 result:', result);
    console.log('result.success:', result.success);
    console.log('result.fileId:', result.fileId);
    console.log('result.fileName:', result.fileName);
    console.log('result.fileUrl:', result.fileUrl);
    console.log('result.pdfUrl:', result.pdfUrl);
    console.log('result.viewerDownloadUrl:', result.viewerDownloadUrl);
    console.log('result.error:', result.error);
    
    if (result.error) {
      throw new GoogleApiError(
        `Apps Script error: ${result.error}`,
        ERROR_TYPES.API
      );
    }

    // Apps Script가 fileId를 반환했는지 확인
    if (!result.fileId && !result.pdfUrl && !result.fileUrl) {
      console.error('PDF export 응답에 파일 정보 없음:', result);
      throw new GoogleApiError('PDF export returned no file ID or URL', ERROR_TYPES.API);
    }

    return {
      success: true,
      fileId: result.fileId,
      fileName: result.fileName,
      fileUrl: result.fileUrl,  // ✅ GAS에서 받은 fileUrl 추가
      pdfUrl: result.pdfUrl,  // 다운로드 URL
      viewerDownloadUrl: result.viewerDownloadUrl,  // 뷰어 다운로드 URL
      actualSheetGid: result.actualSheetGid,  // 실제 시트 GID
      jpgImages: result.jpgImages || [],
      conversionError: result.conversionError || null
    };
  });
};

export const fetchPdfBase64ByFileId = async (fileId) => {
  const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'getPdfBase64', fileId })
  });
  if (!response.ok) {
    throw new GoogleApiError(`Apps Script request failed: ${response.status} ${response.statusText}`, ERROR_TYPES.API);
  }
  const result = await response.json();
  if (result.error) {
    throw new GoogleApiError(`Apps Script error: ${result.error}`, ERROR_TYPES.API);
  }
  return result; // { success, fileName, mimeType, base64 }
};

/**
 * Export Google Sheet directly to PNG images using Apps Script
 */
export const exportGoogleSheetToPng = async (accessToken, spreadsheetId, sheetGid, fileName) => {
  return await retryWithBackoff(async () => {
    console.log('exportGoogleSheetToPng POST 요청 시작:', { spreadsheetId, sheetGid, fileName });
    
    const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',  // 단순 요청으로 CORS 우회
      },
      body: JSON.stringify({
        action: 'exportSheetToPng',
        spreadsheetId: spreadsheetId,
        sheetGid: sheetGid,
        fileName: fileName,
        folderId: DRIVE_FOLDER_ID,
        accessToken: accessToken || 'apps-script-mode'
      })
    });

    console.log('exportGoogleSheetToPng 응답 상태:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      throw new GoogleApiError(`HTTP ${response.status}: ${errorText}`, ERROR_TYPES.NETWORK);
    }

    const data = await response.json();
    console.log('exportGoogleSheetToPng 응답 데이터:', data);
    console.log('exportGoogleSheetToPng data.data:', data.data);
    console.log('exportGoogleSheetToPng data.data 타입:', typeof data.data);
    console.log('exportGoogleSheetToPng data.data 내용:', JSON.stringify(data.data, null, 2));

    if (data.error) {
      throw new GoogleApiError(`Apps Script error: ${data.error}`, ERROR_TYPES.API);
    }

    if (!data.success) {
      throw new GoogleApiError('PNG export failed', ERROR_TYPES.API);
    }

    // data.data 안에 실제 결과가 있음
    const result = data.data || data;
    console.log('exportGoogleSheetToPng result:', result);
    console.log('exportGoogleSheetToPng result.fileId:', result.fileId);
    console.log('exportGoogleSheetToPng result.fileName:', result.fileName);
    console.log('exportGoogleSheetToPng result.fileUrl:', result.fileUrl);

    return {
      success: true,
      fileId: result.fileId || result.pngFile?.fileId,
      fileName: result.fileName || result.pngFile?.fileName,
      fileUrl: result.fileUrl || result.pngFile?.fileUrl,
      method: result.method || 'unknown'
    };
  });
};

/**
 * Convert existing PDF file to PNG images using Apps Script
 */
export const convertPdfToPng = async (accessToken, fileId) => {
  return await retryWithBackoff(async () => {
    const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'convertPdfToPng',
        fileId: fileId,
        folderId: DRIVE_FOLDER_ID,
        accessToken: accessToken
      })
    });

    if (!response.ok) {
      throw new GoogleApiError(
        `Apps Script request failed: ${response.status} ${response.statusText}`,
        ERROR_TYPES.API
      );
    }

    const result = await response.json();
    
    if (result.error) {
      throw new GoogleApiError(
        `Apps Script error: ${result.error}`,
        ERROR_TYPES.API
      );
    }

    if (!result.pngFiles || result.pngFiles.length === 0) {
      throw new GoogleApiError('No PNG files generated', ERROR_TYPES.API);
    }

    return {
      success: true,
      pngFiles: result.pngFiles,
      totalPages: result.totalPages,
      originalFileName: result.originalFileName
    };
  });
};

/**
 * Export specific Google Sheet to PNG images using Apps Script
 * This function takes a spreadsheet ID and sheet GID, exports the sheet as PDF,
 * then converts it to PNG images
 */
export const exportSheetToPng = async (accessToken, spreadsheetId, sheetGid, fileName) => {
  return await retryWithBackoff(async () => {
    return new Promise((resolve, reject) => {
      const callbackName = 'jsonpCallback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      
      const params = new URLSearchParams({
        action: 'exportSheetToPng',
        spreadsheetId: spreadsheetId,
        sheetGid: sheetGid,
        fileName: fileName,
        folderId: DRIVE_FOLDER_ID,
        accessToken: accessToken,
        callback: callbackName
      });
      
      window[callbackName] = (data) => {
        delete window[callbackName];
        if (document.head.contains(script)) {
          document.head.removeChild(script);
        }
        
        if (data.error) {
          reject(new GoogleApiError(`Apps Script error: ${data.error}`, ERROR_TYPES.API));
        } else if (!data.pngFiles || data.pngFiles.length === 0) {
          reject(new GoogleApiError('No PNG files generated', ERROR_TYPES.API));
        } else {
          resolve({
            success: true,
            pngFiles: data.pngFiles,
            totalFiles: data.totalFiles,
            spreadsheetId: data.spreadsheetId,
            sheetGid: data.sheetGid
          });
        }
      };
      
      const script = document.createElement('script');
      script.src = `${APPS_SCRIPT_WEB_APP_URL}?${params.toString()}`;
      script.onerror = () => {
        delete window[callbackName];
        if (document.head.contains(script)) {
          document.head.removeChild(script);
        }
        reject(new GoogleApiError('JSONP request failed', ERROR_TYPES.NETWORK));
      };
      
      setTimeout(() => {
        if (window[callbackName]) {
          delete window[callbackName];
          if (document.head.contains(script)) {
            document.head.removeChild(script);
          }
          reject(new GoogleApiError('JSONP request timeout', ERROR_TYPES.TIMEOUT));
        }
      }, 60000); // PNG 변환은 시간이 더 걸릴 수 있으므로 60초로 설정
      
      document.head.appendChild(script);
    });
  });
};

/**
 * Get user-friendly error message
 */
export const getUserFriendlyErrorMessage = (error) => {
  if (error instanceof GoogleApiError) {
    switch (error.type) {
      case ERROR_TYPES.NETWORK:
        return '네트워크 연결을 확인해주세요.';
      case ERROR_TYPES.AUTHENTICATION:
        return 'Google 인증에 실패했습니다. 다시 로그인해주세요.';
      case ERROR_TYPES.VALIDATION:
        return '입력 데이터를 확인해주세요.';
      case ERROR_TYPES.TIMEOUT:
        return '요청 시간이 초과되었습니다. 다시 시도해주세요.';
      default:
        return `오류가 발생했습니다: ${error.message}`;
    }
  }
  
  return `알 수 없는 오류가 발생했습니다: ${error.message}`;
};

/**
 * Log operation with structured format
 */
export const logOperation = (operation, data = {}, level = 'info') => {
  const logData = {
    timestamp: new Date().toISOString(),
    operation,
    ...data
  };
  
  switch (level) {
    case 'warn':
      console.warn(`[GoogleAPI] ${operation}:`, logData);
      break;
    case 'error':
      console.error(`[GoogleAPI] ${operation}:`, logData);
      break;
    default:
      console.log(`[GoogleAPI] ${operation}:`, logData);
  }
};

/**
 * Check if user has access to the specified Drive folder
 */
export const checkFolderAccess = async (accessToken, folderId) => {
  try {
    return new Promise((resolve) => {
      const callbackName = 'jsonpCallback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      
      const params = new URLSearchParams({
        action: 'checkFolderAccess',
        folderId: folderId,
        accessToken: accessToken,
        callback: callbackName
      });
      
      window[callbackName] = (data) => {
        delete window[callbackName];
        if (document.head.contains(script)) {
          document.head.removeChild(script);
        }
        resolve(data.hasAccess === true);
      };
      
      const script = document.createElement('script');
      script.src = `${APPS_SCRIPT_WEB_APP_URL}?${params.toString()}`;
      script.onerror = () => {
        delete window[callbackName];
        if (document.head.contains(script)) {
          document.head.removeChild(script);
        }
        resolve(false);
      };
      
      setTimeout(() => {
        if (window[callbackName]) {
          delete window[callbackName];
          if (document.head.contains(script)) {
            document.head.removeChild(script);
          }
          resolve(false);
        }
      }, 10000);
      
      document.head.appendChild(script);
    });
  } catch (error) {
    console.warn('Error checking folder access:', error);
    return false;
  }
};

/**
 * Clear all stored authentication data
 */
export const clearAuthData = () => {
  try {
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_token_expires_at');
    console.log('Authentication data cleared from localStorage');
  } catch (error) {
    console.warn('Error clearing auth data:', error);
  }
};

/**
 * Dummy functions for compatibility (not needed in Apps Script mode)
 */
export const handleAuthClick = () => {
  throw new GoogleApiError('Authentication not needed in Apps Script mode', ERROR_TYPES.API);
};

export const getCurrentAccessToken = () => {
  throw new GoogleApiError('Access token not needed in Apps Script mode', ERROR_TYPES.API);
};