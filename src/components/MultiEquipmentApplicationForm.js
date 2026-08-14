import React, { useState } from 'react';
import {
  duplicateSpreadsheet,
  updateGoogleSheetWithData,
  initGoogleApis,
  addDataToSheet,
  exportGoogleSheetToPdfAndConvertToJpg,
  TEMPLATE_SPREADSHEET_ID,
  TEMPLATE_SHEET_GID,
  getUserFriendlyErrorMessage,
  logOperation,
  checkFolderAccess,
  DRIVE_FOLDER_ID,
  clearAuthData
} from '../utils/googleSheetPdfExporter';
import styles from '../pages/MainPage.module.css';

// 날짜 문자열 파싱 헬퍼 함수
const parseDateString = (dateString) => {
  if (!dateString) return null;
  const str = dateString.toString().trim();
  if (!str) return null;

  if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return new Date(str);
  }

  const parts = str.split(/[/.]/);
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
  }

  const koreanMatch = str.match(/(\d+)월\s*(\d+)일/);
  if (koreanMatch) {
    const month = koreanMatch[1].padStart(2, '0');
    const day = koreanMatch[2].padStart(2, '0');
    const currentYear = new Date().getFullYear();
    return new Date(`${currentYear}-${month}-${day}`);
  }

  if (/^\d{8}$/.test(str)) {
    const y = parseInt(str.substring(0, 4), 10);
    const m = parseInt(str.substring(4, 6), 10) - 1;
    const day = parseInt(str.substring(6, 8), 10);
    return new Date(y, m, day);
  }

  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
};

// Helper function to format a Date object or date string to yyyy/mm/dd
const formatDateToYYYYMMDD = (dateInput) => {
  if (!dateInput) return '';
  const date = (dateInput instanceof Date) ? dateInput : parseDateString(dateInput);
  if (!date || isNaN(date.getTime())) return String(dateInput);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
};

// HTML5 date input용 YYYY-MM-DD 형식
const formatDateToHTML5Date = (dateInput) => {
  if (!dateInput) return '';
  const date = (dateInput instanceof Date) ? dateInput : parseDateString(dateInput);
  if (!date || isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 날짜 입력을 YYYY/MM/DD 형식으로 변환하는 함수
const formatDateInput = (inputValue) => {
  if (!inputValue) return '';

  if (inputValue.match(/^\d{4}\/\d{2}\/\d{2}$/)) {
    return inputValue;
  }

  if (inputValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return inputValue.replace(/-/g, '/');
  }

  if (inputValue.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
    const parts = inputValue.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}/${month.padStart(2, '0')}/${day.padStart(2, '0')}`;
    }
  }

  return inputValue;
};

const MultiEquipmentApplicationForm = React.memo(({
  selectedEquipments = [],
  applicantName,
  allPartners = [],
  onNewDemo,
  onCancel,
  isGoogleApiLoaded,
  googleTokenClient,
  onJpgImagesGenerated,
  onRemoveEquipment
}) => {
  console.log("MultiEquipmentApplicationForm: isGoogleApiLoaded =", isGoogleApiLoaded);
  const todayFormatted = formatDateToYYYYMMDD(new Date());
  
  const [formData, setFormData] = useState({
    requester: applicantName || '',
    checkoutDate: todayFormatted,
    returnDate: '',
    checkoutReason: '',
    checkoutLocation: '서울시 강남구 테헤란로 445, 2층',
    partnerCompanyName: '',
    partnerBusinessNumber: '',
    partnerContactPerson: '',
    partnerContactNumber: '',
    partnerAddress: '',
    usageCompanyName: '',
    usageBusinessNumber: '',
    usageAddress: '',
    usageContactPerson: '',
    usageContactNumber: '',
  });

  const [skipUsageInfo, setSkipUsageInfo] = useState(false); // 사용처 정보 입력 안함 체크박스

  const [companyNameSearchResults, setCompanyNameSearchResults] = useState([]);
  const [showCompanyNameSearchResults, setShowCompanyNameSearchResults] = useState(false);
  const [contactPersonSearchResults, setContactPersonSearchResults] = useState([]);
  const [showContactPersonSearchResults, setShowContactPersonSearchResults] = useState(false);

  // 사용처 검색을 위한 상태
  const [usageCompanyNameSearchResults, setUsageCompanyNameSearchResults] = useState([]);
  const [showUsageCompanyNameSearchResults, setShowUsageCompanyNameSearchResults] = useState(false);
  const [usageContactPersonSearchResults, setUsageContactPersonSearchResults] = useState([]);
  const [showUsageContactPersonSearchResults, setShowUsageContactPersonSearchResults] = useState(false);
  const [memoItems] = useState(['']);

  // 내부 프로세스 및 결과 상태
  const [isExportingToPng, setIsExportingToPng] = useState(false);
  const [processMessage, setProcessMessage] = useState('');
  const [createdSpreadsheetUrl, setCreatedSpreadsheetUrl] = useState(null);
  const [createdPdfUrl, setCreatedPdfUrl] = useState(null);
  const [createdPdfDownloadUrl, setCreatedPdfDownloadUrl] = useState(null);
  const [isSheetBoxExpanded, setIsSheetBoxExpanded] = useState(false);
  const [pngFiles] = useState([]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    // 날짜 필드의 경우 YYYY/MM/DD 형식으로 변환
    if (name === 'checkoutDate' || name === 'returnDate') {
      const formattedValue = formatDateInput(value);
      setFormData(prev => ({ ...prev, [name]: formattedValue }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }

    if (name === 'partnerCompanyName') {
      handleCompanyNameSearch(value);
    } else if (name === 'partnerContactPerson') {
      handleContactPersonSearch(value);
    } else if (name === 'usageCompanyName') {
      handleUsageCompanyNameSearch(value);
    } else if (name === 'usageContactPerson') {
      handleUsageContactPersonSearch(value);
    }
  };

  // 키보드 입력으로 숫자 선택
  const handleKeyDown = (e) => {
    const { name } = e.target;

    if (name === 'partnerCompanyName' && showCompanyNameSearchResults) {
      const number = parseInt(e.key);
      if (!isNaN(number) && number > 0 && number <= companyNameSearchResults.length) {
        e.preventDefault();
        handlePartnerSelectByNumber('company', number);
      }
    } else if (name === 'partnerContactPerson' && showContactPersonSearchResults) {
      const number = parseInt(e.key);
      if (!isNaN(number) && number > 0 && number <= contactPersonSearchResults.length) {
        e.preventDefault();
        handlePartnerSelectByNumber('contact', number);
      }
    } else if (name === 'usageCompanyName' && showUsageCompanyNameSearchResults) {
      const number = parseInt(e.key);
      if (!isNaN(number) && number > 0 && number <= usageCompanyNameSearchResults.length) {
        e.preventDefault();
        handleUsageSelectByNumber('company', number);
      }
    } else if (name === 'usageContactPerson' && showUsageContactPersonSearchResults) {
      const number = parseInt(e.key);
      if (!isNaN(number) && number > 0 && number <= usageContactPersonSearchResults.length) {
        e.preventDefault();
        handleUsageSelectByNumber('contact', number);
      }
    }
  };

  // 파트너 정보 검색 (파트너 정보만 검색)
  const handleCompanyNameSearch = (searchTerm) => {
    if (searchTerm.length > 0) {
      const results = allPartners.filter(partner =>
        partner.companyName &&
        partner.companyName !== '-' &&
        partner.companyName.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setCompanyNameSearchResults(results);
      setShowCompanyNameSearchResults(true);
    } else {
      setCompanyNameSearchResults([]);
      setShowCompanyNameSearchResults(false);
    }
  };

  const handleContactPersonSearch = (searchTerm) => {
    if (searchTerm.length > 0) {
      const results = allPartners.filter(partner =>
        partner.contactPerson &&
        partner.contactPerson !== '-' &&
        partner.contactPerson.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setContactPersonSearchResults(results);
      setShowContactPersonSearchResults(true);
    } else {
      setContactPersonSearchResults([]);
      setShowContactPersonSearchResults(false);
    }
  };

  // 사용처 정보 검색 (사용처 정보만 검색)
  const handleUsageCompanyNameSearch = (searchTerm) => {
    if (searchTerm.length > 0) {
      const results = allPartners.filter(partner =>
        partner.usageCompany &&
        partner.usageCompany !== '-' &&
        partner.usageCompany.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setUsageCompanyNameSearchResults(results);
      setShowUsageCompanyNameSearchResults(true);
    } else {
      setUsageCompanyNameSearchResults([]);
      setShowUsageCompanyNameSearchResults(false);
    }
  };

  const handleUsageContactPersonSearch = (searchTerm) => {
    if (searchTerm.length > 0) {
      const results = allPartners.filter(partner =>
        partner.usageContactPerson &&
        partner.usageContactPerson !== '-' &&
        partner.usageContactPerson.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setUsageContactPersonSearchResults(results);
      setShowUsageContactPersonSearchResults(true);
    } else {
      setUsageContactPersonSearchResults([]);
      setShowUsageContactPersonSearchResults(false);
    }
  };

  // 파트너 정보 선택 (파트너 정보만 채움)
  const handlePartnerSelect = (partner) => {
    setFormData(prev => ({
      ...prev,
      partnerCompanyName: partner.companyName || '',
      partnerBusinessNumber: partner.businessNumber || '',
      partnerContactPerson: partner.contactPerson || '',
      partnerContactNumber: partner.phone || '',
      partnerAddress: partner.address || '',
    }));
    setShowCompanyNameSearchResults(false);
    setCompanyNameSearchResults([]);
    setShowContactPersonSearchResults(false);
    setContactPersonSearchResults([]);
  };

  // 사용처 정보 선택 (사용처 정보만 채움)
  const handleUsageSelect = (partner) => {
    setFormData(prev => ({
      ...prev,
      usageCompanyName: partner.usageCompany || '',
      usageBusinessNumber: partner.usageBusinessNumber || '',
      usageContactPerson: partner.usageContactPerson || '',
      usageContactNumber: partner.usageContactNumber || '',
      usageAddress: partner.usageAddress || '',
    }));
    setShowUsageCompanyNameSearchResults(false);
    setUsageCompanyNameSearchResults([]);
    setShowUsageContactPersonSearchResults(false);
    setUsageContactPersonSearchResults([]);
  };

  // 숫자로 파트너 선택하는 함수
  const handlePartnerSelectByNumber = (searchType, number) => {
    let results;
    if (searchType === 'company') {
      results = companyNameSearchResults;
    } else {
      results = contactPersonSearchResults;
    }

    if (number > 0 && number <= results.length) {
      const selectedPartner = results[number - 1];
      handlePartnerSelect(selectedPartner);
    }
  };

  // 숫자로 사용처 선택하는 함수
  const handleUsageSelectByNumber = (searchType, number) => {
    let results;
    if (searchType === 'company') {
      results = usageCompanyNameSearchResults;
    } else {
      results = usageContactPersonSearchResults;
    }

    if (number > 0 && number <= results.length) {
      const selectedPartner = results[number - 1];
      handleUsageSelect(selectedPartner);
    }
  };

  const handleDownloadPng = async (e) => {
    e.preventDefault();
    console.log("MultiEquipmentApplicationForm: handleDownloadPng called.");
    console.log("Form Data before validation (Multi):", formData);

    // 기본 필수 항목 검사
    if (!formData.returnDate || !formData.checkoutReason) {
      alert("필수 입력 항목을 모두 채워주세요: 반납일자, 반출 사유");
      console.log("MultiEquipmentApplicationForm: Validation failed.");
      return;
    }

    // 사용처 정보 입력 안함이 체크되지 않은 경우에만 사용처 정보 검사
    if (!skipUsageInfo) {
      if (!formData.usageCompanyName || !formData.usageAddress || !formData.usageContactPerson || !formData.usageContactNumber) {
        alert("필수 입력 항목을 모두 채워주세요: 사용처 상호, 사용처 주소, 사용처 담당자, 사용처 연락처\n\n※ 사용처 정보를 입력하지 않으려면 '정보 입력 안함'을 체크하세요.");
        console.log("MultiEquipmentApplicationForm: Validation failed.");
        return;
      }
    }
    console.log("MultiEquipmentApplicationForm: Validation passed.");

    const memoData = memoItems.filter(memo => memo.trim() !== '');
    if (memoData.length > 0) {
      formData.memoItems = memoData;
    }

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const timestampStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${timeStr}`;

    formData.processedAt = timestampStr;
    formData.timestamp = timestampStr;
    formData['처리시간스탬프'] = timestampStr;

    // 시작일과 반납일은 시간 없이 YYYY/MM/DD 날짜만 전송
    if (formData.checkoutDate) {
      formData.checkoutDate = formatDateToYYYYMMDD(formData.checkoutDate);
    }
    if (formData.returnDate) {
      formData.returnDate = formatDateToYYYYMMDD(formData.returnDate);
    }

    setIsExportingToPng(true);
    setProcessMessage('🚀 데모 신청 처리를 시작합니다...');

    try {
      console.log("MultiEquipmentApplicationForm: Initiating PNG export workflow.");

      setProcessMessage('🔧 Google API 초기화 중...');
      await initGoogleApis();

      const accessToken = 'apps-script-mode';
      console.log("MultiEquipmentApplicationForm: Apps Script mode initialized.");

      // 0. 기존 시트에 데이터 추가 (마지막 줄에 추가)
      const MAIN_SHEET_ID = '13cKidfXW_tENgtbx65AqWxRJvi7s86JcBcrMQHfK3oQ';
      logOperation('addDataToMainSheet', { spreadsheetId: MAIN_SHEET_ID, equipmentCount: selectedEquipments.length });
      try {
        setProcessMessage('📝 기존 시트에 장비 데이터 추가 중...');
        console.log('기존 시트에 데이터 추가 시작:', { spreadsheetId: MAIN_SHEET_ID });
        const addDataSuccess = await addDataToSheet(accessToken, MAIN_SHEET_ID, formData, selectedEquipments);
        if (!addDataSuccess) {
          throw new Error("Main sheet data addition returned false");
        }

        logOperation('addDataToMainSheet', { success: true });
        console.log('✅ 기존 시트에 데이터가 추가되었습니다!');
        setProcessMessage('✅ 기존 시트에 데이터 추가 완료!');

      } catch (error) {
        logOperation('addDataToMainSheet', { success: false, error: error.message }, 'error');
        console.error('기존 시트 데이터 추가 실패:', error);
        setProcessMessage('⚠️ 기존 시트 데이터 추가 실패 (계속 진행)');
      }

      // 1. Duplicate the template spreadsheet
      logOperation('duplicateSpreadsheet', { requester: formData.requester });
      const newSpreadsheetTitle = `장비_대여요청서_${formData.requester}_${new Date().toISOString().slice(0, 10)}`;

      setProcessMessage('📋 템플릿 시트 복사 중...');
      let newSpreadsheetId;
      try {
        newSpreadsheetId = await duplicateSpreadsheet(accessToken, TEMPLATE_SPREADSHEET_ID, newSpreadsheetTitle);

        if (!newSpreadsheetId) {
          throw new Error("Spreadsheet duplication returned no ID");
        }

        logOperation('duplicateSpreadsheet', { success: true, spreadsheetId: newSpreadsheetId });
        setProcessMessage('✅ 템플릿 시트 복사 완료!');
      } catch (error) {
        logOperation('duplicateSpreadsheet', { success: false, error: error.message }, 'error');

        if (error.message.includes('Authentication') || error.message.includes('token')) {
          clearAuthData();
        }

        setProcessMessage('');
        alert(`❌ 스프레드시트 복제 실패: ${getUserFriendlyErrorMessage(error)}`);
        return;
      }

      // 2. Update the duplicated Google Sheet with form data
      logOperation('updateGoogleSheet', { spreadsheetId: newSpreadsheetId, equipmentCount: selectedEquipments.length });
      try {
        setProcessMessage('📝 신청 정보 입력 중...');
        const updateSuccess = await updateGoogleSheetWithData(accessToken, newSpreadsheetId, formData, selectedEquipments);
        if (!updateSuccess) {
          throw new Error("Sheet update returned false");
        }

        logOperation('updateGoogleSheet', { success: true });

        const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${newSpreadsheetId}/edit`;
        setCreatedSpreadsheetUrl(spreadsheetUrl);

        console.log('✅ 스프레드시트 생성 및 업데이트 완료!');
        console.log('📄 스프레드시트 URL:', spreadsheetUrl);
        console.log('📋 스프레드시트 ID:', newSpreadsheetId);
        setProcessMessage('✅ 신청 정보 입력 완료!');

        if (navigator.clipboard && navigator.clipboard.writeText) {
          try {
            await navigator.clipboard.writeText(spreadsheetUrl);
            console.log('📋 스프레드시트 URL이 클립보드에 복사되었습니다!');
          } catch (clipboardError) {
            console.log('클립보드 복사 실패:', clipboardError);
          }
        }

      } catch (error) {
        logOperation('updateGoogleSheet', { success: false, error: error.message }, 'error');

        if (error.message.includes('Authentication') || error.message.includes('token')) {
          clearAuthData();
        }

        setProcessMessage('');
        alert(`❌ Google Sheet 업데이트 실패: ${getUserFriendlyErrorMessage(error)}`);
        return;
      }

      // 3. Check folder access before exporting
      logOperation('checkFolderAccess', { folderId: DRIVE_FOLDER_ID });
      const hasFolderAccess = await checkFolderAccess(accessToken, DRIVE_FOLDER_ID);
      if (!hasFolderAccess) {
        console.warn(`Warning: Cannot access folder ${DRIVE_FOLDER_ID}. PDF files will be saved to root directory.`);
      }

      // 4. Export to PDF
      try {
        setProcessMessage('📄 PDF 변환 중...');
        logOperation('exportToPdf', { spreadsheetId: newSpreadsheetId, fileName: newSpreadsheetTitle });

        const pdfResult = await exportGoogleSheetToPdfAndConvertToJpg(
          accessToken,
          newSpreadsheetId,
          TEMPLATE_SHEET_GID,
          newSpreadsheetTitle
        );

        console.log('=== PDF Export 응답 상세 ===', pdfResult);

        if (pdfResult && pdfResult.success && pdfResult.fileId && pdfResult.fileUrl) {
          const pdfDownloadUrl = pdfResult.pdfUrl || pdfResult.fileUrl;

          setCreatedPdfUrl(pdfResult.fileUrl);
          setCreatedPdfDownloadUrl(pdfDownloadUrl);

          logOperation('exportToPdf', {
            success: true,
            fileId: pdfResult.fileId,
            fileUrl: pdfResult.fileUrl,
            downloadUrl: pdfDownloadUrl,
            actualSheetGid: pdfResult.actualSheetGid
          });
          console.log('✅ PDF 변환 완료!');
          setProcessMessage('✅ PDF 변환 완료!');
        } else {
          if (pdfResult && pdfResult.error) {
            console.error('=== PDF 변환 서버 에러 ===', pdfResult);
            throw new Error(`PDF export failed: ${pdfResult.errorMessage || pdfResult.error}`);
          } else {
            console.error('PDF 결과 없음:', pdfResult);
            throw new Error("PDF export failed - no valid result returned");
          }
        }
      } catch (pdfError) {
        logOperation('exportToPdf', { success: false, error: pdfError.message }, 'error');
        console.error('=== ⚠️ PDF 변환 실패 (신청은 완료됨) ===', pdfError);
        setProcessMessage('⚠️ PDF 변환 실패 (신청은 완료됨)');
      }

      // ===== 워크플로우 완료 =====
      const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${newSpreadsheetId}/edit`;
      console.log('🎉 전체 워크플로우 완료!', { spreadsheetUrl, newSpreadsheetTitle });

      setProcessMessage('🎉 데모 신청이 완료되었습니다!');
      alert('🎉 모든 작업이 완료되었습니다!');

    } catch (error) {
      logOperation('workflowError', { error: error.message }, 'error');

      if (error.message.includes('Authentication') || error.message.includes('token')) {
        clearAuthData();
      }

      setProcessMessage('');
      alert(`❌ 전체 워크플로우 중 오류 발생: ${getUserFriendlyErrorMessage(error)}`);
    } finally {
      setIsExportingToPng(false);
      setTimeout(() => setProcessMessage(''), 3000);
    }
  };

  return (
    <div className={styles.formContainer}>
      <div className={styles.selectedEquipmentsSummary}>
        <h4>선택된 장비 목록:</h4>
        <ul>
          {selectedEquipments.map(equipment => (
            <li key={equipment.id || equipment.serial} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <span>{equipment.name} ({equipment.serial})</span>
              <button
                type="button"
                onClick={() => {
                  if (onRemoveEquipment) {
                    onRemoveEquipment(equipment);
                  }
                }}
                style={{
                  background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer',
                  fontSize: '16px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px',
                  lineHeight: '1'
                }}
                title="장비 제거"
              >✕</button>
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.infoBox}>
        <h3>[기본정보]</h3>
        <div className={styles.formGrid}>
          <div className={styles.formField} style={{ gridColumn: '1 / -1' }}>
            <label>요청자 :</label>
            <input type="text" name="requester" value={formData.requester} onChange={handleChange} style={{ width: '120px' }} />
          </div>
          <div className={styles.formField} style={{ gridColumn: '1 / span 1' }}>
            <label>반출일자 :</label>
            <input type="date" name="checkoutDate" value={formatDateToHTML5Date(formData.checkoutDate)} onChange={handleChange} />
            <span className={styles.dateDisplay}>{formData.checkoutDate}</span>
          </div>
          <div className={styles.formField} style={{ gridColumn: '2 / span 1' }}>
            <label>회수일자 :</label>
            <input type="date" name="returnDate" value={formatDateToHTML5Date(formData.returnDate)} onChange={handleChange} required />
            <span className={styles.dateDisplay}>{formData.returnDate}</span>
          </div>
          <div className={styles.formFieldFullWidth}>
            <label>반출 사유 :</label>
            <input type="text" name="checkoutReason" value={formData.checkoutReason} onChange={handleChange} required style={{ width: '600px', height: '60px' }} />
          </div>
          <div className={styles.formFieldFullWidth}>
            <label>반출 장소 :</label>
            <input type="text" name="checkoutLocation" value={formData.checkoutLocation} onChange={handleChange} style={{ width: '300px' }} />
          </div>
        </div>
      </div>

      <div className={styles.infoBox}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'nowrap', gap: '8px' }}>
          <h3 style={{ margin: 0, whiteSpace: 'nowrap' }}>[파트너 정보]</h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                const formText = `[파트너 정보]
파트너 상호 *(필수) :
파트너 사업자번호 *(필수) :
파트너 담당자 *(필수) :
파트너 연락처 *(필수) :
파트너 주소 *(필수) :`;

                if (navigator.clipboard && navigator.clipboard.writeText) {
                  navigator.clipboard.writeText(formText)
                    .then(() => alert('✅ 파트너 정보 양식이 클립보드에 복사되었습니다!'))
                    .catch(err => {
                      console.error('클립보드 복사 실패:', err);
                      alert('❌ 클립보드 복사에 실패했습니다.');
                    });
                } else {
                  const textarea = document.createElement('textarea');
                  textarea.value = formText;
                  textarea.style.position = 'fixed';
                  textarea.style.opacity = '0';
                  document.body.appendChild(textarea);
                  textarea.select();
                  try {
                    document.execCommand('copy');
                    alert('✅ 파트너 정보 양식이 클립보드에 복사되었습니다!');
                  } catch (err) {
                    console.error('클립보드 복사 실패:', err);
                    alert('❌ 클립보드 복사에 실패했습니다.');
                  }
                  document.body.removeChild(textarea);
                }
              }}
              className={styles.utilityButton}
            >
              📋 양식 복사
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  let clipboardText = '';

                  if (navigator.clipboard && navigator.clipboard.readText) {
                    clipboardText = await navigator.clipboard.readText();
                  } else {
                    clipboardText = prompt('클립보드 내용을 붙여넣으세요:');
                    if (!clipboardText) return;
                  }

                  console.log('클립보드 내용:', clipboardText);

                  const patterns = {
                    partnerCompanyName: /파트너\s*상호[^:]*:\s*(.+)/i,
                    partnerBusinessNumber: /파트너\s*사업자번호[^:]*:\s*(.+)/i,
                    partnerContactPerson: /파트너\s*담당자[^:]*:\s*(.+)/i,
                    partnerContactNumber: /파트너\s*연락처[^:]*:\s*(.+)/i,
                    partnerAddress: /파트너\s*주소[^:]*:\s*(.+)/i
                  };

                  const newData = {};
                  let foundCount = 0;

                  Object.keys(patterns).forEach(key => {
                    const match = clipboardText.match(patterns[key]);
                    if (match && match[1]) {
                      newData[key] = match[1].trim();
                      foundCount++;
                    }
                  });

                  if (foundCount > 0) {
                    setFormData(prev => ({ ...prev, ...newData }));
                    alert(`✅ ${foundCount}개 항목이 자동으로 입력되었습니다!`);
                  } else {
                    alert('❌ 파트너 정보 양식을 찾을 수 없습니다.\n\n올바른 양식 형식인지 확인해주세요.');
                  }

                } catch (err) {
                  console.error('붙여넣기 실패:', err);
                  alert('❌ 클립보드 읽기에 실패했습니다.\n\n브라우저 권한을 확인해주세요.');
                }
              }}
              className={styles.utilityButton}
            >
              📥 정보 붙여넣기
            </button>
          </div>
        </div>
        <div className={styles.formGrid}>
          <div className={styles.formField}>
            <label>파트너 상호 *(필수) :</label>
            <div className={styles.inputWithResults}>
              <input
                type="text"
                name="partnerCompanyName"
                value={formData.partnerCompanyName}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                style={{ width: '150px' }}
              />
              {showCompanyNameSearchResults && companyNameSearchResults.length > 0 && (
                <ul className={styles.searchResults}>
                  <li style={{ padding: '8px 12px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6', fontSize: '12px', color: '#6c757d' }}>
                    💡 숫자 키를 눌러 선택하세요 (1-{companyNameSearchResults.length})
                  </li>
                  {companyNameSearchResults.map((partner, index) => (
                    <li key={partner.id || index} onClick={() => handlePartnerSelect(partner)}>
                      <div className={styles.searchResultNumber}>{index + 1}</div>
                      <div className={styles.searchResultContent}>
                        <div className={styles.searchResultTitle}>{partner.companyName}</div>
                        <div className={styles.searchResultSubtitle}>{partner.contactPerson}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className={styles.formField}>
            <label>파트너 사업자번호 *(필수) :</label>
            <input type="text" name="partnerBusinessNumber" value={formData.partnerBusinessNumber} onChange={handleChange} style={{ width: '150px' }} />
          </div>
          <div className={styles.formField} style={{ gridColumn: '1 / span 1' }}>
            <label>파트너 담당자 *(필수) :</label>
            <div className={styles.inputWithResults}>
              <input
                type="text"
                name="partnerContactPerson"
                value={formData.partnerContactPerson}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                style={{ width: '150px' }}
              />
              {showContactPersonSearchResults && contactPersonSearchResults.length > 0 && (
                <ul className={styles.searchResults}>
                  <li style={{ padding: '8px 12px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6', fontSize: '12px', color: '#6c757d' }}>
                    💡 숫자 키를 눌러 선택하세요 (1-{contactPersonSearchResults.length})
                  </li>
                  {contactPersonSearchResults.map((partner, index) => (
                    <li key={partner.id || index} onClick={() => handlePartnerSelect(partner)}>
                      <div className={styles.searchResultNumber}>{index + 1}</div>
                      <div className={styles.searchResultContent}>
                        <div className={styles.searchResultTitle}>{partner.contactPerson}</div>
                        <div className={styles.searchResultSubtitle}>{partner.companyName}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className={styles.formField}>
            <label>파트너 연락처 *(필수) :</label>
            <input type="text" name="partnerContactNumber" value={formData.partnerContactNumber} onChange={handleChange} style={{ width: '150px' }} />
          </div>
          <div className={styles.formFieldFullWidth}>
            <label>파트너 주소 *(필수) :</label>
            <input type="text" name="partnerAddress" value={formData.partnerAddress} onChange={handleChange} style={{ width: '500px' }} />
          </div>
        </div>
      </div>

      <div className={styles.infoBox}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'nowrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'nowrap' }}>
            <h3 style={{ margin: 0, whiteSpace: 'nowrap' }}>[사용처 정보]</h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
              <input
                type="checkbox"
                checked={skipUsageInfo}
                onChange={(e) => {
                  setSkipUsageInfo(e.target.checked);
                  if (e.target.checked) {
                    setFormData(prev => ({
                      ...prev,
                      usageCompanyName: '',
                      usageBusinessNumber: '',
                      usageAddress: '',
                      usageContactPerson: '',
                      usageContactNumber: '',
                    }));
                  }
                }}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span style={{ color: '#666' }}>정보 입력 안함</span>
            </label>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                const formText = `[사용처 정보]
사용처 상호 *(필수) :
사용처 사업자번호 :
사용처 담당자 *(필수) :
사용처 담당자 연락처 *(필수) :
사용처 주소 *(필수) :`;

                if (navigator.clipboard && navigator.clipboard.writeText) {
                  navigator.clipboard.writeText(formText)
                    .then(() => alert('✅ 사용처 정보 양식이 클립보드에 복사되었습니다!'))
                    .catch(err => {
                      console.error('클립보드 복사 실패:', err);
                      alert('❌ 클립보드 복사에 실패했습니다.');
                    });
                } else {
                  const textarea = document.createElement('textarea');
                  textarea.value = formText;
                  textarea.style.position = 'fixed';
                  textarea.style.opacity = '0';
                  document.body.appendChild(textarea);
                  textarea.select();
                  try {
                    document.execCommand('copy');
                    alert('✅ 사용처 정보 양식이 클립보드에 복사되었습니다!');
                  } catch (err) {
                    console.error('클립보드 복사 실패:', err);
                    alert('❌ 클립보드 복사에 실패했습니다.');
                  }
                  document.body.removeChild(textarea);
                }
              }}
              disabled={skipUsageInfo}
              className={styles.utilityButton}
            >
              📋 양식 복사
            </button>
            <button
              type="button"
              disabled={skipUsageInfo}
              onClick={async () => {
                try {
                  let clipboardText = '';

                  if (navigator.clipboard && navigator.clipboard.readText) {
                    clipboardText = await navigator.clipboard.readText();
                  } else {
                    clipboardText = prompt('클립보드 내용을 붙여넣으세요:');
                    if (!clipboardText) return;
                  }

                  console.log('클립보드 내용:', clipboardText);

                  const patterns = {
                    usageCompanyName: /사용처\s*상호[^:]*:\s*(.+)/i,
                    usageBusinessNumber: /사용처\s*사업자번호[^:]*:\s*(.+)/i,
                    usageContactPerson: /사용처\s*담당자[^:연락]*:\s*(.+)/i,
                    usageContactNumber: /사용처\s*담당자\s*연락처[^:]*:\s*(.+)/i,
                    usageAddress: /사용처\s*주소[^:]*:\s*(.+)/i
                  };

                  const newData = {};
                  let foundCount = 0;

                  Object.keys(patterns).forEach(key => {
                    const match = clipboardText.match(patterns[key]);
                    if (match && match[1]) {
                      newData[key] = match[1].trim();
                      foundCount++;
                    }
                  });

                  if (foundCount > 0) {
                    setFormData(prev => ({ ...prev, ...newData }));
                    alert(`✅ ${foundCount}개 항목이 자동으로 입력되었습니다!`);
                  } else {
                    alert('❌ 사용처 정보 양식을 찾을 수 없습니다.\n\n올바른 양식 형식인지 확인해주세요.');
                  }

                } catch (err) {
                  console.error('붙여넣기 실패:', err);
                  alert('❌ 클립보드 읽기에 실패했습니다.\n\n브라우저 권한을 확인해주세요.');
                }
              }}
              className={styles.utilityButton}
            >
              📥 정보 붙여넣기
            </button>
          </div>
        </div>
        <div className={styles.formGrid}>
          <div className={styles.formField}>
            <label>사용처 상호 *(필수) :</label>
            <div className={styles.inputWithResults}>
              <input
                type="text"
                name="usageCompanyName"
                value={formData.usageCompanyName}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                required
                disabled={skipUsageInfo}
                style={{ width: '150px', backgroundColor: skipUsageInfo ? '#f0f0f0' : 'white' }}
              />
              {showUsageCompanyNameSearchResults && usageCompanyNameSearchResults.length > 0 && (
                <div className={styles.searchResults}>
                  {usageCompanyNameSearchResults.map((partner, index) => (
                    <div
                      key={index}
                      className={styles.searchResultContent}
                      onClick={() => handleUsageSelect(partner)}
                    >
                      <div className={styles.searchResultNumber}>{index + 1}</div>
                      <div>
                        <div className={styles.searchResultTitle}>{partner.usageCompany}</div>
                        <div className={styles.searchResultSubtitle}>
                          {partner.usageContactPerson} | {partner.usageContactNumber}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className={styles.formField}>
            <label>사용처 사업자번호 :</label>
            <input type="text" name="usageBusinessNumber" value={formData.usageBusinessNumber} onChange={handleChange} disabled={skipUsageInfo} style={{ width: '150px', backgroundColor: skipUsageInfo ? '#f0f0f0' : 'white' }} />
          </div>
          <div className={styles.formField} style={{ gridColumn: '1 / span 1' }}>
            <label>사용처 담당자 *(필수) :</label>
            <div className={styles.inputWithResults}>
              <input
                type="text"
                name="usageContactPerson"
                value={formData.usageContactPerson}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                required
                disabled={skipUsageInfo}
                style={{ width: '150px', backgroundColor: skipUsageInfo ? '#f0f0f0' : 'white' }}
              />
              {showUsageContactPersonSearchResults && usageContactPersonSearchResults.length > 0 && (
                <div className={styles.searchResults}>
                  {usageContactPersonSearchResults.map((partner, index) => (
                    <div
                      key={index}
                      className={styles.searchResultContent}
                      onClick={() => handleUsageSelect(partner)}
                    >
                      <div className={styles.searchResultNumber}>{index + 1}</div>
                      <div>
                        <div className={styles.searchResultTitle}>{partner.usageContactPerson}</div>
                        <div className={styles.searchResultSubtitle}>
                          {partner.usageCompany} | {partner.usageContactNumber}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className={styles.formField}>
            <label>사용처 담당자 연락처 *(필수) :</label>
            <input type="text" name="usageContactNumber" value={formData.usageContactNumber} onChange={handleChange} required disabled={skipUsageInfo} style={{ width: '150px', backgroundColor: skipUsageInfo ? '#f0f0f0' : 'white' }} />
          </div>
          <div className={styles.formFieldFullWidth}>
            <label>사용처 주소 *(필수) :</label>
            <input type="text" name="usageAddress" value={formData.usageAddress} onChange={handleChange} required disabled={skipUsageInfo} placeholder="" style={{ width: '500px', backgroundColor: skipUsageInfo ? '#f0f0f0' : 'white' }} />
          </div>
        </div>
      </div>

      <div className={styles.formActions}>
        {processMessage && (
          <div className={styles.processMessage}>
            <div className={styles.processSpinner}></div>
            <p>{processMessage}</p>
          </div>
        )}

        <div>
          <button
            onClick={handleDownloadPng}
            className="button-primary"
            disabled={!isGoogleApiLoaded || isExportingToPng}
          >
            {isExportingToPng ? '신청 처리 중...' : '데모 신청하기'}
          </button>
          <button type="button" onClick={onCancel} className="button-secondary">취소</button>
        </div>
      </div>

      {/* 생성된 스프레드시트 결과 표시 */}
      {createdSpreadsheetUrl && (
        <div className={styles.spreadsheetResultBox}>
          <div className={styles.spreadsheetResultHeader} style={{ cursor: 'pointer' }} onClick={() => setIsSheetBoxExpanded(!isSheetBoxExpanded)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className={styles.successIcon}>✅</span>
              <h4>스프레드시트가 생성되었습니다!</h4>
            </div>
            <button
              type="button"
              className={styles.foldButtonInline}
              style={{ marginLeft: 'auto' }}
            >
              {isSheetBoxExpanded ? '▲ 접기' : '▼ 시트 수정 하기'}
            </button>
          </div>
          {isSheetBoxExpanded && (
            <div className={styles.spreadsheetResultContent}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <a
                  href={createdSpreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.spreadsheetResultButton}
                  style={{ textDecoration: 'none' }}
                >
                  📄 열기
                </a>
                <button
                  type="button"
                  onClick={() => {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                      navigator.clipboard.writeText(createdSpreadsheetUrl)
                        .then(() => alert('URL이 클립보드에 복사되었습니다!'))
                        .catch(err => console.error('클립보드 복사 실패:', err));
                    }
                  }}
                  className={styles.copyUrlButtonInline}
                >
                  📋 링크 복사
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 생성된 PDF 결과 표시 */}
      {createdPdfUrl && (
        <div className={styles.spreadsheetResultBox}>
          <div className={styles.spreadsheetResultHeader}>
            <span className={styles.successIcon}>📄</span>
            <h4>PDF가 생성되었습니다!</h4>
          </div>
          <div className={styles.spreadsheetResultContent}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <a
                href={createdPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.spreadsheetResultButton}
                style={{ textDecoration: 'none' }}
              >
                📄 열기
              </a>
              <button
                type="button"
                onClick={() => {
                  const downloadUrl = createdPdfDownloadUrl || createdPdfUrl;
                  window.open(downloadUrl, '_blank');
                }}
                className={styles.spreadsheetResultButton}
              >
                📥 다운로드
              </button>
              <button
                type="button"
                onClick={() => {
                  const urlToCopy = createdPdfUrl || createdPdfDownloadUrl;
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(urlToCopy)
                      .then(() => alert('PDF URL이 클립보드에 복사되었습니다!'))
                      .catch(err => console.error('클립보드 복사 실패:', err));
                  }
                }}
                className={styles.copyUrlButtonInline}
              >
                📋 링크 복사
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PNG 이미지 표시 영역 */}
      {pngFiles && pngFiles.length > 0 && (
        <div className={styles.pngDisplayArea}>
          {pngFiles.map((pngFile, index) => (
            <div key={index} className={styles.pngImageContainer}>
              <img
                src={pngFile.fileUrl}
                alt={pngFile.fileName}
                className={styles.pngImage}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

export default MultiEquipmentApplicationForm;
