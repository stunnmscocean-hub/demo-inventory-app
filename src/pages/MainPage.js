import React, { useState, useEffect, useCallback } from 'react';
import { 
  duplicateSpreadsheet, 
  updateGoogleSheetWithData, 
  initGoogleApis, 
  exportGoogleSheetToPng,
  convertPdfToPng,
  exportSheetToPng,
  addDataToSheet,
  TEMPLATE_SPREADSHEET_ID, 
  TEMPLATE_SHEET_GID, 
  getUserFriendlyErrorMessage,
  logOperation,
  checkFolderAccess,
  DRIVE_FOLDER_ID,
  clearAuthData,
  testAppsScriptConnection
} from '../utils/googleSheetPdfExporter'; // Import Google Sheet PDF exporter, updater, and readiness checker
import { parseEquipmentCsv, parseUsageCsv, parsePartnerCsv } from '../utils/csvParser';
import { getEquipmentData, initializeEquipmentSheet, getPartnerData, testSheetData, returnEquipment } from '../services/api';
import JpgViewer from '../components/JpgViewer';
import PdfViewer from '../components/PdfViewer';
import styles from './MainPage.module.css';

// SearchBar 컴포넌트를 메인 컴포넌트 외부로 이동
const SearchBar = React.memo(({ onSearch }) => {
  const [term, setTerm] = useState('');
  
  const handleChange = (e) => {
    e.stopPropagation(); // Prevent event bubbling
    const newTerm = e.target.value;
    setTerm(newTerm);
    onSearch(newTerm); // Trigger search on each change
  };

  const handleClick = (e) => {
    e.stopPropagation(); // Prevent event bubbling
  };
  
  return (
    <div className={styles.searchForm} onClick={handleClick}>
      <input 
        type="text" 
        placeholder="장비 이름 또는 시리얼 넘버로 검색" 
        value={term} 
        onChange={handleChange} 
        onClick={handleClick}
        className={styles.searchInput}
      />
    </div>
  );
});

// 스켈레톤 로딩 컴포넌트
const SkeletonRow = () => (
  <tr>
    <td><div className={`${styles.skeleton} ${styles.skeletonCellSmall}`} /></td>
    <td><div className={`${styles.skeleton} ${styles.skeletonCellLarge}`} /></td>
    <td><div className={`${styles.skeleton} ${styles.skeletonCellMedium}`} /></td>
    <td><div className={`${styles.skeleton} ${styles.skeletonCellMedium}`} /></td>
    <td><div className={`${styles.skeleton} ${styles.skeletonCellMedium}`} /></td>
  </tr>
);

const SkeletonTable = ({ rows = 5 }) => (
  <table>
    <thead>
      <tr>
        <th style={{ width: '40px' }}>선택</th>
        <th>장비명</th>
        <th>시리얼 넘버</th>
        <th>장비 위치</th>
        <th>사용 현황</th>
      </tr>
    </thead>
    <tbody>
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonRow key={index} />
      ))}
    </tbody>
  </table>
);

// 내 데모 현황용 스켈레톤 (6개 컬럼)
const SkeletonMyDemoRow = () => (
  <tr>
    <td><div className={`${styles.skeleton} ${styles.skeletonCellLarge}`} /></td>
    <td><div className={`${styles.skeleton} ${styles.skeletonCellMedium}`} /></td>
    <td><div className={`${styles.skeleton} ${styles.skeletonCellMedium}`} /></td>
    <td><div className={`${styles.skeleton} ${styles.skeletonCellMedium}`} /></td>
    <td><div className={`${styles.skeleton} ${styles.skeletonButton}`} /></td>
    <td><div className={`${styles.skeleton} ${styles.skeletonButton}`} /></td>
  </tr>
);

const SkeletonMyDemoTable = ({ rows = 3 }) => (
  <table>
    <thead>
      <tr>
        <th>장비명</th>
        <th>시리얼 넘버</th>
        <th>대여 시작일</th>
        <th>반납 예정일</th>
        <th>신청 양식</th>
        <th>관리</th>
      </tr>
    </thead>
    <tbody>
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonMyDemoRow key={index} />
      ))}
    </tbody>
  </table>
);

const SkeletonPartnerCard = () => (
  <div className={styles.skeletonPartnerCard}>
    <div className={`${styles.skeleton} ${styles.skeletonPartnerName}`} />
    <div className={`${styles.skeleton} ${styles.skeletonPartnerInfo}`} />
    <div className={`${styles.skeleton} ${styles.skeletonPartnerInfo}`} />
  </div>
);

const SkeletonPartnerList = ({ count = 3 }) => (
  <div>
    {Array.from({ length: count }).map((_, index) => (
      <SkeletonPartnerCard key={index} />
    ))}
    <div className={styles.loadingMessage}>파트너 정보를 불러오는 중...</div>
  </div>
);

// EquipmentList 컴포넌트를 메인 컴포넌트 외부로 이동
const EquipmentList = React.memo(({ equipments, selectedEquipments, onEquipmentToggle }) => {
  
  const handleCheckboxChange = (e, equipment) => {
    e.stopPropagation(); // Prevent event bubbling
    onEquipmentToggle(equipment);
  };

  const handleRowClick = (e, equipment) => {
    // Only toggle if clicking on the row, not the checkbox
    if (e.target.type !== 'checkbox') {
      onEquipmentToggle(equipment);
    }
  };
  
  return (
    <table>
      <thead>
        <tr>
          <th style={{ width: '40px' }}>선택</th>
          <th>장비명</th>
          <th>시리얼 넘버</th>
          <th>장비 위치</th>
          <th>사용 현황</th>
        </tr>
      </thead>
      <tbody>
        {equipments.map((eq) => {
          const isSelected = selectedEquipments.some(selected => selected.id === eq.id);
          return (
            <tr 
              key={eq.id} 
              className={styles.selectableRow}
              onClick={(e) => handleRowClick(e, eq)}
            >
              <td>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => handleCheckboxChange(e, eq)}
                  className={styles.equipmentCheckbox}
                  onClick={(e) => e.stopPropagation()}
                />
              </td>
              <td>{eq.name}</td>
              <td>{eq.serial}</td>
              <td>{eq.location}</td>
              <td>{eq.status}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
});

// SelectedEquipmentsList 컴포넌트를 메인 컴포넌트 외부로 이동
const SelectedEquipmentsList = React.memo(({ selectedEquipments, onRemoveEquipment }) => {
  if (selectedEquipments.length === 0) return null;

  return (
    <div className={styles.selectedEquipmentsContainer}>
      <div className={styles.selectedEquipmentsHeader}>
        <h3>선택된 장비 ({selectedEquipments.length}개)</h3>
      </div>
      <div className={styles.selectedEquipmentsList}>
        {selectedEquipments.map((equipment) => (
          <div key={equipment.id} className={styles.selectedEquipmentItem}>
            <span className={styles.equipmentInfo}>
              {equipment.name} ({equipment.serial})
            </span>
            <button 
              onClick={() => onRemoveEquipment(equipment.id)}
              className={styles.removeButton}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
});

// 사용자 이름 매핑 (임시 해결책)
const getUserDisplayName = (user) => {
  const nameMapping = {
    'stunnmsc@gmail.com': '백두산',
    'dpommusic@gmail.com': '홍길동',
    'eddiem9x': '백두산' // Google OAuth 이름을 실명으로 매핑
  };
  
  return nameMapping[user.email] || nameMapping[user.name] || user.name;
};

// Helper function to parse yyyy/mm/dd or yyyy-mm-dd into a Date object
const parseDateString = (dateString) => {
  if (!dateString) return null;
  
  // yyyy-mm-dd format (from input type="date")
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return new Date(dateString);
  }
  
  // yyyy/mm/dd format (from CSV)
  const parts = dateString.split('/');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return new Date(`${year}-${month}-${day}`); // Convert to yyyy-mm-dd for reliable Date parsing
  }
  
  // Korean date format (e.g., "12월 12일")
  const koreanMatch = dateString.match(/(\d+)월\s*(\d+)일/);
  if (koreanMatch) {
    const month = koreanMatch[1].padStart(2, '0');
    const day = koreanMatch[2].padStart(2, '0');
    const currentYear = new Date().getFullYear();
    return new Date(`${currentYear}-${month}-${day}`);
  }
  
  // Fallback for other formats
  return new Date(dateString);
};

// Helper function to format a Date object or date string to yyyy/mm/dd
const formatDateToYYYYMMDD = (dateInput) => {
  if (!dateInput) return '';
  const date = (dateInput instanceof Date) ? dateInput : parseDateString(dateInput);
  if (!date || isNaN(date.getTime())) return String(dateInput); // Return original if invalid

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

// 날짜를 YYYY/MM/DD 형식으로 표시하는 함수
const formatDateForDisplay = (dateInput) => {
  if (!dateInput) return '';
  const date = (dateInput instanceof Date) ? dateInput : parseDateString(dateInput);
  if (!date || isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
};

// 날짜 입력을 YYYY/MM/DD 형식으로 변환하는 함수
const formatDateInput = (inputValue) => {
  if (!inputValue) return '';
  
  // 이미 YYYY/MM/DD 형식인 경우
  if (inputValue.match(/^\d{4}\/\d{2}\/\d{2}$/)) {
    return inputValue;
  }
  
  // YYYY-MM-DD 형식인 경우
  if (inputValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return inputValue.replace(/-/g, '/');
  }
  
  // DD/MM/YYYY 형식인 경우
  if (inputValue.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
    const parts = inputValue.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}/${month.padStart(2, '0')}/${day.padStart(2, '0')}`;
    }
  }
  
  // MM/DD/YYYY 형식인 경우
  if (inputValue.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
    const parts = inputValue.split('/');
    if (parts.length === 3) {
      const [month, day, year] = parts;
      return `${year}/${month.padStart(2, '0')}/${day.padStart(2, '0')}`;
    }
  }
  
  // 기타 형식은 그대로 반환
  return inputValue;
};




// ----------------------------------------------------------------
// Main Page Component
// ----------------------------------------------------------------

const MainPage = ({ user, onLogout }) => {
  const [myDemos, setMyDemos] = useState([]);
  const [availableEquipments, setAvailableEquipments] = useState([]);
  const [filteredEquipments, setFilteredEquipments] = useState([]);
  const [allEquipments, setAllEquipments] = useState([]);
  const [allPartners, setAllPartners] = useState([]); // New state for partner data
  const [showInUseEquipment, setShowInUseEquipment] = useState(false);
  const [isMyDemosFolded, setIsMyDemosFolded] = useState(false); // State for folding MyDemoList
  const [loading, setLoading] = useState(false); // 전체 로딩 상태 (사용 안 함)
  
  // 섹션별 로딩 상태
  const [loadingMyDemos, setLoadingMyDemos] = useState(true);
  const [loadingEquipments, setLoadingEquipments] = useState(true);
  const [loadingPartners, setLoadingPartners] = useState(true);
  
  const [selectedEquipments, setSelectedEquipments] = useState([]); // State for selected equipments
  // const [excelImage, setExcelImage] = useState(null); // State for Excel image preview (no longer needed for direct PDF export)
  const [showApplicationForm, setShowApplicationForm] = useState(false); // State for showing application form
  const [googleApiLoaded, setGoogleApiLoaded] = useState(false); // State to track Google API readiness
  const [googleTokenClient, setGoogleTokenClient] = useState(null); // State to store tokenClient
  const [pdfPreviewImages, setPdfPreviewImages] = useState([]); // State for PDF preview images (multiple pages)
  const [pdfUrl, setPdfUrl] = useState(null); // State for PDF URL
  const [pdfBase64, setPdfBase64] = useState(null); // State for PDF Base64 data
  const [pngFiles, setPngFiles] = useState([]); // State for PNG files
  const [isExportingToPng, setIsExportingToPng] = useState(false); // State for PNG export loading
  const [sheetPngFiles, setSheetPngFiles] = useState([]); // State for specific sheet PNG files
  const [isExportingSheetToPng, setIsExportingSheetToPng] = useState(false); // State for sheet PNG export loading
  const [createdSpreadsheetUrl, setCreatedSpreadsheetUrl] = useState(null); // State for created spreadsheet URL

  // Custom sorting order
  const customOrder = [
    "Rally Plus", "Rally System", "Rally Camera", "Rally", "Rally Bar", "Rally Bar Mini",
    "Rally Bar Huddle", "MeetUp", "MeetUp 2", "TAP", "TAP IP", "Extend", "SWYTCH", "Logi Dock Flex",
    "Logi Dock", "PTZ Pro 2", "Group", "Sight", "Connect", "BCC950", "Scribe", "Reach",
    "Brio", "MX Brio 705", "C930e", "C925e", "C920e", "C505e",
    "Active USB Cable", "CAT5E Kit for TAP", "Rally Mic Pod Extension Cable", "Strong USB Cable"
  ];

  // Function to clean equipment names for sorting
  const getCleanName = (name) => {
    let clean = name.replace(/\s*\([^)]*\)/g, '').trim(); // Remove text in parentheses
    // Do not remove numbers, as "MeetUp 2" is a distinct item
    return clean;
  };

  // Sorting function
  const sortEquipment = (a, b) => {
    const cleanNameA = getCleanName(a.name);
    const cleanNameB = getCleanName(b.name);

    const rankA = customOrder.indexOf(cleanNameA);
    const rankB = customOrder.indexOf(cleanNameB);

    // Assign a large rank for items not in customOrder to place them at the end
    const finalRankA = rankA === -1 ? customOrder.length : rankA;
    const finalRankB = rankB === -1 ? customOrder.length : rankB;

    // Sort by custom order rank first
    if (finalRankA !== finalRankB) {
      return finalRankA - finalRankB;
    }

    // If custom order ranks are the same (or both not in custom order), sort by clean name alphabetically
    return cleanNameA.localeCompare(cleanNameB);
  };

  useEffect(() => {
    const fetchAllCsvData = async () => {
      // 섹션별 로딩 시작
      setLoadingMyDemos(true);
      setLoadingEquipments(true);
      setLoadingPartners(true);
      
      try {
        const userName = (user.name === '테스트사용자' || user.name === 'test') ? '홍길동' : user.name;
        
        // Fetch equipment data from Google Sheet (1번만 호출!)
        let allEquipmentFromSheet = [];
        try {
          console.log('📦 장비 데이터 로딩 시작 (시트1)...');
          const equipmentData = await getEquipmentData();
          allEquipmentFromSheet = equipmentData.data || [];
          console.log(`✅ 장비 데이터 로드 완료: ${allEquipmentFromSheet.length}건`);
          console.log('Sample equipment data:', allEquipmentFromSheet[0]); // 디버깅용
          
          // 🎯 클라이언트 사이드 필터링: 내 대여 현황
          // Step 1: 담당자가 나인 장비만 추출
          const myEquipments = allEquipmentFromSheet.filter(item => {
            const assignee = (item.assignee || item['대여담당자'] || '').toString().trim();
            return assignee === userName;
          });
          
          console.log(`내가 담당한 장비 (전체 히스토리): ${myEquipments.length}건`);
          
          // Step 2: 시리얼넘버별로 최신 상태만 추출 (역순 검색)
          const latestEquipmentMap = new Map();
          
          // 역순으로 순회 (최신이 먼저)
          [...myEquipments].reverse().forEach((item, index) => {
            const serial = (item.serial || item.serialNumber || item['시리얼넘버'] || '').toString().trim();
            const status = (item.status || item['대여가능여부'] || '').toString().trim();
            
            // 이미 해당 시리얼의 최신 상태를 찾았으면 건너뛰기
            if (!latestEquipmentMap.has(serial)) {
              latestEquipmentMap.set(serial, { item, status });
              console.log(`[최신] ${item.name} (${serial}) - 상태: ${status}`);
            } else {
              console.log(`[건너뜀] ${item.name} (${serial}) - 상태: ${status} (이미 최신 존재)`);
            }
          });
          
          // Step 3: 제외할 상태 필터링
          const excludedStatuses = ['반납완료', '대여 가능', '대여가능', '반납', '완료'];
          
          const myDemoData = [];
          latestEquipmentMap.forEach(({ item, status }, serial) => {
            const isExcluded = excludedStatuses.some(excluded => 
              status.toLowerCase().includes(excluded.toLowerCase())
            );
            
            if (!isExcluded && status !== '') {
              myDemoData.push(item);
              console.log(`✅ [표시] ${item.name} (${serial}) - 상태: ${status}`);
            } else {
              console.log(`❌ [제외] ${item.name} (${serial}) - 상태: ${status}`);
            }
          });
          
          console.log(`최종 내 대여 현황: ${myDemoData.length}건`);
          
          // 내 데모 현황 데이터 변환
          const initialMyDemos = myDemoData.map((item, index) => ({
            id: index,
            name: item.name || item['제품명'] || '',
            serial: item.serial || item.serialNumber || item['시리얼넘버'] || '',
            startDate: item.startDate || item['시작일'] || '',
            returnDate: item.endDate || item.returnDate || item['종료일'] || '',
            formSubmitted: false,
            location: item.location || item['보관위치'] || '본사',
            status: item.status || item['대여가능여부'] || ''
          }));
          
          setMyDemos(initialMyDemos);
          setLoadingMyDemos(false); // 내 데모 현황 로딩 완료
          console.log(`✅ 내 대모 현황: ${initialMyDemos.length}건 (클라이언트 필터링)`);
          
        } catch (error) {
          console.error('Failed to load equipment data from sheet:', error);
          
          // Fallback to CSV if sheet fails
          try {
            console.log('CSV 파일로 폴백...');
            
            // 사용내역 CSV
            const usageResponse = await fetch('/사용내역.csv');
            const usageText = await usageResponse.text();
            const parsedUsageData = parseUsageCsv(usageText);
            
            const userPartnerName = userName;
            const initialMyDemos = parsedUsageData
              .filter(item => item.partnerName === userPartnerName && item.status === '사용중')
              .map(item => ({
                id: item.id,
                name: item.name,
                serial: item.serial,
                startDate: item.startDate,
                returnDate: item.returnDate,
                formSubmitted: false,
                location: '본사'
              }));
            setMyDemos(initialMyDemos);
            console.log(`CSV에서 내 데모 현황 로드: ${initialMyDemos.length}건`);
            
            // 장비현황 CSV
            const equipmentResponse = await fetch('/장비현황.csv');
            const equipmentText = await equipmentResponse.text();
            const parsedEquipmentData = parseEquipmentCsv(equipmentText);
            allEquipmentFromSheet = parsedEquipmentData.map(item => ({
              id: item.id,
              name: item.name,
              serial: item.serial,
              location: item.location,
              status: item.status
            }));
            console.log(`CSV에서 장비 데이터 로드: ${allEquipmentFromSheet.length}건`);
          } catch (csvError) {
            console.error('Failed to load CSV data as fallback:', csvError);
            allEquipmentFromSheet = [];
            setMyDemos([]);
          }
        }
        
        // Apply sorting to all equipment data
        const sortedAllEquipment = [...allEquipmentFromSheet].sort(sortEquipment);
        setAllEquipments(sortedAllEquipment);
        console.log('Sorted all equipment:', sortedAllEquipment.length, 'items');
        
        const initialFiltered = sortedAllEquipment.filter(item => showInUseEquipment ? true : item.status === '대여 가능');
        setAvailableEquipments(initialFiltered);
        setFilteredEquipments(initialFiltered);
        setLoadingEquipments(false); // 장비 목록 로딩 완료
        console.log('Initial filtered equipment:', initialFiltered.length, 'items');
        console.log('Show in use equipment:', showInUseEquipment);

        // Fetch partner data from Google Sheet instead of CSV
        let allPartnersFromSheet = [];
        try {
          console.log('=== 파트너 데이터 로딩 시작 ===');
          const partnerData = await getPartnerData();
          console.log('Raw partnerData response:', partnerData);
          console.log('partnerData.data:', partnerData.data);
          console.log('partnerData.data type:', typeof partnerData.data);
          console.log('partnerData.data length:', partnerData.data ? partnerData.data.length : 'undefined');
          
          // GAS에서 이미 UI 형식으로 변환된 데이터 사용
          allPartnersFromSheet = partnerData.data || [];
          console.log('Loaded partner data from sheet:', allPartnersFromSheet.length, 'items');
          console.log('All partner data from GAS:', allPartnersFromSheet); // 모든 파트너 데이터
          console.log('Sample partner data from GAS:', allPartnersFromSheet[0]); // 디버깅용
          
          // 각 파트너 데이터를 개별적으로 로그
          allPartnersFromSheet.forEach((partner, index) => {
            console.log(`Partner ${index + 1}:`, partner);
          });
        } catch (error) {
          console.error('Failed to load partner data from sheet:', error);
          // Fallback to CSV if sheet fails
          try {
            const partnerResponse = await fetch('/파트너정보.csv');
            const partnerText = await partnerResponse.text();
            const parsedPartnerData = parsePartnerCsv(partnerText);
            allPartnersFromSheet = parsedPartnerData;
            console.log('Fallback to CSV partner data:', allPartnersFromSheet.length, 'items');
          } catch (csvError) {
            console.error('Failed to load CSV partner data as fallback:', csvError);
            allPartnersFromSheet = [];
          }
        }
        setAllPartners(allPartnersFromSheet);
        setLoadingPartners(false); // 파트너 정보 로딩 완료

      } catch (error) {
        console.error("Error fetching or parsing CSV:", error);
      }
    };

    fetchAllCsvData();

    // Initialize Google APIs
    const initializeApis = async () => {
      console.log("MainPage: Attempting to initialize Google APIs.");
      const { tokenClient } = await initGoogleApis();
      setGoogleTokenClient(tokenClient);
      setGoogleApiLoaded(true);
      console.log("MainPage: Google API and GIS are ready!");
    };
    initializeApis();

  }, [user?.name, showInUseEquipment]);

  const handleSearch = useCallback((searchTerm) => {
    console.log('Search term:', searchTerm);
    console.log('Available equipments:', availableEquipments.length);
    // Use availableEquipments instead of allEquipments to avoid dependency issues
    const equipmentToFilter = availableEquipments;
    if (!searchTerm || searchTerm.trim() === '') {
      setFilteredEquipments(equipmentToFilter);
      console.log('No search term, showing all available:', equipmentToFilter.length);
      return;
    }
    const filtered = equipmentToFilter.filter(eq => 
      eq.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      eq.serial.toLowerCase().includes(searchTerm.toLowerCase())
    );
    console.log('Filtered results:', filtered.length);
    setFilteredEquipments(filtered);
  }, [availableEquipments]);
  
  const handleReturn = async (demoId) => {
    if (window.confirm("반납 하시겠습니까?")) {
      const returnedDemo = myDemos.find(demo => demo.id === demoId);
      if (!returnedDemo) {
        alert("반납할 장비를 찾을 수 없습니다.");
        return;
      }
      
      try {
        console.log('반납 처리 시작:', returnedDemo);
        console.log('전체 장비 데이터 개수:', allEquipments.length);
        
        // 전체 장비 데이터에서 해당 시리얼의 최신 대여 정보 찾기 (역순 검색)
        // 히스토리가 쌓이므로 가장 최근 것을 찾아야 함
        const matchingEquipments = allEquipments.filter(eq => 
          (eq.serial === returnedDemo.serial || eq.serialNumber === returnedDemo.serial)
        );
        
        console.log(`시리얼 ${returnedDemo.serial}와 매칭되는 장비:`, matchingEquipments.length, '개');
        
        // 가장 최근 대여 중인 데이터 찾기 (담당자가 본인이고 대여 중인 것)
        const fullEquipmentData = matchingEquipments
          .reverse() // 역순으로 (최신이 먼저)
          .find(eq => {
            const assignee = (eq.assignee || eq['대여담당자'] || '').toString().trim();
            const status = (eq.status || eq['대여가능여부'] || '').toString().trim();
            const isMyEquipment = assignee === user.name;
            const isActive = status === '대여신청' || status === '대여중' || status === '사용중';
            
            console.log(`체크: ${eq.name} / 담당자:${assignee} / 상태:${status} / 매칭:${isMyEquipment && isActive}`);
            
            return isMyEquipment && isActive;
          });
        
        if (!fullEquipmentData) {
          console.error('❌ 대여 중인 상세 정보를 찾을 수 없습니다!');
          console.log('내 데모 목록:', returnedDemo);
          console.log('매칭 시도한 장비들:', matchingEquipments);
          alert('대여 정보를 찾을 수 없습니다. 새로고침 후 다시 시도해주세요.');
          return;
        }
        
        console.log('✅ 최신 대여 정보 찾음:', fullEquipmentData);
        
        // 반납할 장비 데이터 준비 (찾은 전체 데이터 복사)
        const equipmentDataToReturn = {
          // 기본 정보
          serial: fullEquipmentData.serial || fullEquipmentData.serialNumber || returnedDemo.serial,
          serialNumber: fullEquipmentData.serial || fullEquipmentData.serialNumber || returnedDemo.serial,
          name: fullEquipmentData.name || fullEquipmentData['제품명'] || returnedDemo.name,
          tag: fullEquipmentData.tag || fullEquipmentData['Tag'] || '',
          location: fullEquipmentData.location || fullEquipmentData['보관위치'] || '본사',
          
          // 대여 정보 (필수!)
          assignee: fullEquipmentData.assignee || fullEquipmentData['대여담당자'] || user.name,
          startDate: fullEquipmentData.startDate || fullEquipmentData['시작일'] || returnedDemo.startDate,
          returnDate: fullEquipmentData.endDate || fullEquipmentData.returnDate || fullEquipmentData['종료일'] || returnedDemo.returnDate,
          endDate: fullEquipmentData.endDate || fullEquipmentData.returnDate || fullEquipmentData['종료일'] || returnedDemo.returnDate,
          
          // 파트너 정보
          partnerName: fullEquipmentData.partnerName || fullEquipmentData['파트너명'] || '',
          partnerContact: fullEquipmentData.partnerContact || fullEquipmentData['파트너담당자명'] || '',
          partnerPhone: fullEquipmentData.partnerPhone || fullEquipmentData['휴대폰 번호'] || '',
          
          // 사용자 정보
          userName: fullEquipmentData.userName || fullEquipmentData['사용자명'] || '',
          userContact: fullEquipmentData.userContact || fullEquipmentData['사용자담당자명'] || '',
          userPhone: fullEquipmentData.userPhone || '',
          
          // 비고
          memo: fullEquipmentData.memo || fullEquipmentData['비고'] || ''
        };
        
        console.log('📋 GAS로 전송할 반납 데이터 (전체):', equipmentDataToReturn);
        
        // Google Sheets에 반납 히스토리 추가
        const result = await returnEquipment(equipmentDataToReturn);
        
        if (result.success) {
          console.log('✅ 반납 처리 성공:', result);
          
          // 클라이언트 상태 업데이트
          // 1. 내 데모 목록에서 제거
          setMyDemos(prev => prev.filter(demo => demo.id !== demoId));
          
          // 2. 전체 장비 데이터 새로고침 (다음 로딩 시 반영)
          // 실시간 반영을 위해 상태만 업데이트 (서버 데이터는 다음 새로고침 시 반영)
          
          alert(`✅ ${returnedDemo.name} 반납이 완료되었습니다!\n담당자에게 전달해주세요.`);
          
          // 페이지 새로고침으로 최신 데이터 반영
          window.location.reload();
        }
        
      } catch (error) {
        console.error('반납 처리 실패:', error);
        alert(`반납 처리 중 오류가 발생했습니다: ${error.message}`);
      }
    }
  };

  const handleFormSubmit = (demoId) => {
    alert(`(ID: ${demoId}) 신청 양식을 제출합니다.`);
    const updatedDemos = myDemos.map(demo => demo.id === demoId ? { ...demo, formSubmitted: true } : demo);
    setMyDemos(updatedDemos);
  };
  
  const handleEquipmentToggle = (equipment) => {
    setSelectedEquipments(prev => {
      const isSelected = prev.some(eq => eq.id === equipment.id);
      if (isSelected) {
        return prev.filter(eq => eq.id !== equipment.id);
      } else {
        return [...prev, equipment];
      }
    });
  };

  const handleRemoveEquipment = (equipmentId) => {
    setSelectedEquipments(prev => prev.filter(eq => eq.id !== equipmentId));
  };
  

  const handleMultipleNewDemo = (returnDate) => {
    if (selectedEquipments.length === 0) return;

    const updatedDemos = selectedEquipments.map(equipment => ({
      ...equipment,
      status: '사용중',
      startDate: formatDateToYYYYMMDD(new Date()),
      returnDate: returnDate,
      formSubmitted: false
    }));

    setMyDemos(prev => [...prev, ...updatedDemos]);
    
    const updatedAllEquipments = allEquipments.map(eq => {
      const selected = selectedEquipments.find(sel => sel.id === eq.id);
      if (selected) {
        return {
          ...eq,
          status: '사용중',
          startDate: formatDateToYYYYMMDD(new Date()),
          returnDate: returnDate,
          formSubmitted: false
        };
      }
      return eq;
    }).sort(sortEquipment);
    
    setAllEquipments(updatedAllEquipments);

    const searchTerm = document.querySelector(`.${styles.searchInput}`)?.value || '';
    const newAvailable = updatedAllEquipments.filter(item => showInUseEquipment ? true : item.status === '대여 가능');
    setAvailableEquipments(newAvailable);
    setFilteredEquipments(newAvailable.filter(eq => 
      eq.name.toLowerCase().includes(searchTerm.toLowerCase()) || eq.serial.toLowerCase().includes(searchTerm.toLowerCase())
    ));

    // Clear selections and hide form
    setSelectedEquipments([]);
    setShowApplicationForm(false);
  };

  const handleJpgImagesGenerated = (images, title) => {
    if (images && images.length > 0) {
      // 모든 페이지 이미지를 미리보기로 사용
      setPdfPreviewImages(images);
      console.log(`PDF preview images generated: ${images.length} pages`);
    }
  };

  // 새로운 함수: 특정 Google Sheets를 PNG로 변환
  const handleExportSheetToPng = async () => {
    // 사용자가 제공한 Google Sheets URL에서 ID와 GID 추출
    const sheetUrl = 'https://docs.google.com/spreadsheets/d/1SrMKt20djDcs4zYJZfnfi_yQmQN-OEaId5ZHP3wWqLU/edit?gid=1326732411#gid=1326732411';
    const spreadsheetId = '1SrMKt20djDcs4zYJZfnfi_yQmQN-OEaId5ZHP3wWqLU';
    const sheetGid = '1326732411';
    const fileName = '행사장비요청서_PNG';

    setIsExportingSheetToPng(true);

    try {
      console.log("특정 Google Sheets PNG 변환 시작:", { spreadsheetId, sheetGid, fileName });
      
      // Initialize Google APIs (simplified for Apps Script)
      await initGoogleApis();
      
      // For Apps Script mode, we don't need access token
      const accessToken = 'apps-script-mode';
      console.log("Apps Script mode initialized for sheet PNG export.");

      // ===== PNG 변환 비활성화 (주석처리됨) =====
      // Export the specific Google Sheet to PNG images
      console.log('[비활성화] PNG 변환이 주석처리되어 건너뜁니다.');
      console.log('[비활성화] 원래 실행될 액션: exportSheetToPng', { spreadsheetId, sheetGid, fileName });
      
      // logOperation('exportSheetToPng', { spreadsheetId, sheetGid, fileName });
      // try {
      //   const result = await exportSheetToPng(
      //     accessToken, 
      //     spreadsheetId, 
      //     sheetGid, 
      //     fileName
      //   );
      //   
      //   if (!result || !result.pngFiles || result.pngFiles.length === 0) {
      //     throw new Error("Sheet PNG export returned no files");
      //   }
      //   
      //   logOperation('exportSheetToPng', { 
      //     success: true, 
      //     fileCount: result.pngFiles.length
      //   });
      //   
      //   console.log(`Google Sheets가 PNG 이미지로 변환되어 Google Drive에 저장되었습니다. 파일 수: ${result.pngFiles.length}`);
      //   
      //   // PNG 파일 정보를 상태에 저장
      //   setSheetPngFiles(result.pngFiles);
      //   
      //   alert(`Google Sheets가 PNG 이미지로 변환되어 Google Drive에 저장되었습니다!\n생성된 파일 수: ${result.pngFiles.length}개`);
      //   
      // } catch (error) {
      //   logOperation('exportSheetToPng', { success: false, error: error.message }, 'error');
      //   
      //   if (error.message.includes('Authentication') || error.message.includes('token')) {
      //     clearAuthData();
      //   }
      //   
      //   alert(getUserFriendlyErrorMessage(error));
      //   return;
      // }

    } catch (error) {
      logOperation('sheetPngWorkflowError', { error: error.message }, 'error');
      
      if (error.message.includes('Authentication') || error.message.includes('token')) {
        clearAuthData();
      }
      
      alert(getUserFriendlyErrorMessage(error));
    } finally {
      setIsExportingSheetToPng(false);
    }
  };
  
  useEffect(() => {
      // Re-apply search term when availableEquipments changes
      const searchTerm = document.querySelector(`.${styles.searchInput}`)?.value || '';
      handleSearch(searchTerm);
  }, [availableEquipments, showInUseEquipment, selectedEquipments, handleSearch]);

  useEffect(() => {
    if (selectedEquipments.length > 0) {
      setShowApplicationForm(true);
    } else {
      setShowApplicationForm(false);
    }
  }, [selectedEquipments]);

  // ----------------------------------------------------------------
  // Sub-components defined within the same file
  // ----------------------------------------------------------------
  const Header = ({ user, onLogout }) => {
    const displayName = user ? getUserDisplayName(user) : '게스트';
    return (
      <header className={styles.header}>
        <h1 className={styles.headerTitle}>{displayName}님, 환영합니다.</h1>
        {user && onLogout && ( // Only show logout button if user and onLogout are provided
          <button onClick={onLogout} className="button-secondary">
            로그아웃
          </button>
        )}
      </header>
    );
  };

  const MyDemoList = ({ demos, onReturn }) => { // Removed onFormSubmit from props
    const isOverdue = (returnDate) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // 시간은 비교에서 제외
      const parsedReturnDate = parseDateString(returnDate);
      return parsedReturnDate && parsedReturnDate < today;
    };
    
    return (
      <table>
        <thead>
          <tr>
            <th>장비명</th><th>시리얼 넘버</th><th>대여 시작일</th><th>반납 예정일</th><th>신청 양식</th><th>관리</th>
          </tr>
        </thead>
        <tbody>
          {demos.map((demo) => (
            <tr key={demo.id}>
              <td>{demo.name}</td>
              <td>{demo.serial}</td>
              <td>{formatDateToYYYYMMDD(demo.startDate)}</td>
              <td className={isOverdue(demo.returnDate) ? styles.overdue : ''}>
                {formatDateToYYYYMMDD(demo.returnDate)}
                {isOverdue(demo.returnDate) && <span className={styles.overdueText}>(반납일 초과)</span>}
              </td>
              <td>{demo.formSubmitted ? '제출 완료' : <button onClick={() => handleFormSubmit(demo.id)} className="button-primary">제출하기</button>}</td>
              <td><button onClick={() => onReturn(demo.id)} className="button-secondary">반납하기</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };





// MultiEquipmentApplicationForm 컴포넌트를 메인 컴포넌트 외부로 이동
const MultiEquipmentApplicationForm = React.memo(({ selectedEquipments, applicantName, allPartners, onNewDemo, onCancel, isGoogleApiLoaded, googleTokenClient, onJpgImagesGenerated }) => {
    console.log("MultiEquipmentApplicationForm: isGoogleApiLoaded =", isGoogleApiLoaded);
    const todayFormatted = formatDateToYYYYMMDD(new Date());
    const [formData, setFormData] = useState({
      requester: applicantName,
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
        // 파트너 정보만 자동 완성
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
        // 사용처 정보만 자동 완성
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


    const testConnection = async () => {
      try {
        console.log("Testing Apps Script connection...");
        const result = await testAppsScriptConnection();
        console.log("Apps Script connection test result:", result);
        alert(`Apps Script 연결 테스트 성공: ${result.message}`);
      } catch (error) {
        console.error("Apps Script connection test failed:", error);
        alert(`Apps Script 연결 테스트 실패: ${error.message}`);
      }
    };

    const initializeSheet = async () => {
      try {
        console.log("Initializing equipment sheet...");
        const result = await initializeEquipmentSheet();
        console.log("Sheet initialization result:", result);
        alert(`시트 초기화 성공: ${result.message}`);
        
        // Refresh equipment data after initialization
        window.location.reload();
      } catch (error) {
        console.error("Sheet initialization failed:", error);
        alert(`시트 초기화 실패: ${error.message}`);
      }
    };

    const handleTestSheetData = async () => {
      try {
        console.log('=== 시트 데이터 테스트 시작 ===');
        const result = await testSheetData();
        console.log('테스트 결과:', result);
        
        if (result.success) {
          alert(`테스트 성공!\n\n총 행 수: ${result.totalRows}\n데이터 행 수: ${result.dataRows}\n비어있지 않은 행 수: ${result.nonEmptyRows}\n파트너 데이터 수: ${result.data.length}\n\n자세한 내용은 콘솔을 확인하세요.`);
        } else {
          alert(`테스트 실패: ${result.error}`);
        }
      } catch (error) {
        console.error('시트 테스트 오류:', error);
        alert('시트 테스트에 실패했습니다: ' + error.message);
      }
    };

    const handleFillDummyData = () => {
      setFormData(prev => ({
        ...prev,
        returnDate: '2025/09/26',
        checkoutReason: '고객사 기능 시연 및 제품 성능 테스트',
        checkoutLocation: '서울시 강남구 테헤란로 445, 2층',
        partnerCompanyName: '(주)테크파트너스',
        partnerBusinessNumber: '123-45-67890',
        partnerContactPerson: '김파트너',
        partnerContactNumber: '02-1234-5678',
        partnerAddress: '서울시 서초구 서초대로 123, 4층',
        usageCompanyName: '(주)에이비씨사용처',
        usageBusinessNumber: '234-56-78901',
        usageContactPerson: '이사용',
        usageContactNumber: '031-987-6543',
        usageAddress: '경기도 성남시 분당구 판교역로 456, 7층',
      }));
      console.log('✅ 빈칸에 더미 데이터가 채워졌습니다.');
    };

    const handleDownloadPng = async (e) => {
      e.preventDefault(); // Prevent default form submission behavior
      console.log("MultiEquipmentApplicationForm: handleDownloadPng called.");
      console.log("Form Data before validation (Multi):", formData);

      if (!formData.returnDate || !formData.checkoutReason || !formData.usageCompanyName || !formData.usageAddress || !formData.usageContactPerson || !formData.usageContactNumber) {
        alert("필수 입력 항목을 모두 채워주세요: 반납일자, 반출 사유, 사용처 상호, 사용처 주소, 사용처 담당자, 사용처 연락처");
        console.log("MultiEquipmentApplicationForm: Validation failed.");
        return;
      }
      console.log("MultiEquipmentApplicationForm: Validation passed.");
      
      const memoData = memoItems.filter(memo => memo.trim() !== '');
      if (memoData.length > 0) {
        formData.memoItems = memoData;
      }

      // Set loading state for PNG export
      setIsExportingToPng(true);

      try {
        console.log("MultiEquipmentApplicationForm: Initiating PNG export workflow.");
        
        // Initialize Google APIs (simplified for Apps Script)
        await initGoogleApis();
        
        // For Apps Script mode, we don't need access token
        const accessToken = 'apps-script-mode';
        console.log("MultiEquipmentApplicationForm: Apps Script mode initialized.");

        // 0. 기존 시트에 데이터 추가 (마지막 줄에 추가)
        const MAIN_SHEET_ID = '13cKidfXW_tENgtbx65AqWxRJvi7s86JcBcrMQHfK3oQ';
        logOperation('addDataToMainSheet', { spreadsheetId: MAIN_SHEET_ID, equipmentCount: selectedEquipments.length });
        try {
          console.log('기존 시트에 데이터 추가 시작:', { spreadsheetId: MAIN_SHEET_ID });
          const addDataSuccess = await addDataToSheet(accessToken, MAIN_SHEET_ID, formData, selectedEquipments);
          if (!addDataSuccess) {
            throw new Error("Main sheet data addition returned false");
          }
          
          logOperation('addDataToMainSheet', { success: true });
          console.log('✅ 기존 시트에 데이터가 추가되었습니다!');
          alert('✅ 장비 데이터가 기존 시트에 추가되었습니다!\n\n스프레드시트: https://docs.google.com/spreadsheets/d/13cKidfXW_tENgtbx65AqWxRJvi7s86JcBcrMQHfK3oQ/edit');
          
        } catch (error) {
          logOperation('addDataToMainSheet', { success: false, error: error.message }, 'error');
          console.error('기존 시트 데이터 추가 실패:', error);
          alert(`기존 시트에 데이터 추가 실패: ${getUserFriendlyErrorMessage(error)}`);
          // 실패해도 계속 진행 (복제 워크플로우)
        }

        // 1. Duplicate the template spreadsheet
        logOperation('duplicateSpreadsheet', { requester: formData.requester });
        const newSpreadsheetTitle = `장비_대여요청서_${formData.requester}_${new Date().toISOString().slice(0, 10)}`;
        
        let newSpreadsheetId;
        try {
          newSpreadsheetId = await duplicateSpreadsheet(accessToken, TEMPLATE_SPREADSHEET_ID, newSpreadsheetTitle);
          
          if (!newSpreadsheetId) {
            throw new Error("Spreadsheet duplication returned no ID");
          }
          
          logOperation('duplicateSpreadsheet', { success: true, spreadsheetId: newSpreadsheetId });
        } catch (error) {
          logOperation('duplicateSpreadsheet', { success: false, error: error.message }, 'error');
          
          // Clear auth data if there's an authentication error
          if (error.message.includes('Authentication') || error.message.includes('token')) {
            clearAuthData();
          }
          
          alert(`1. 스프레드시트 복제 실패: ${getUserFriendlyErrorMessage(error)}`);
          return;
        }

        // 2. Update the duplicated Google Sheet with form data
        logOperation('updateGoogleSheet', { spreadsheetId: newSpreadsheetId, equipmentCount: selectedEquipments.length });
        try {
          const updateSuccess = await updateGoogleSheetWithData(accessToken, newSpreadsheetId, formData, selectedEquipments);
          if (!updateSuccess) {
            throw new Error("Sheet update returned false");
          }
          
          logOperation('updateGoogleSheet', { success: true });
          
          // Generate Google Sheets URL
          const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${newSpreadsheetId}/edit`;
          setCreatedSpreadsheetUrl(spreadsheetUrl);
          
          console.log('✅ 스프레드시트 생성 및 업데이트 완료!');
          console.log('📄 스프레드시트 URL:', spreadsheetUrl);
          console.log('📋 스프레드시트 ID:', newSpreadsheetId);
          
        } catch (error) {
          logOperation('updateGoogleSheet', { success: false, error: error.message }, 'error');
          
          // Clear auth data if there's an authentication error
          if (error.message.includes('Authentication') || error.message.includes('token')) {
            clearAuthData();
          }
          
          alert(`2. Google Sheet 업데이트 실패: ${getUserFriendlyErrorMessage(error)}`);
          return;
        }

        // 3. Check folder access before exporting
        logOperation('checkFolderAccess', { folderId: DRIVE_FOLDER_ID });
        const hasFolderAccess = await checkFolderAccess(accessToken, DRIVE_FOLDER_ID);
        if (!hasFolderAccess) {
          console.warn(`Warning: Cannot access folder ${DRIVE_FOLDER_ID}. PNG files will be saved to root directory.`);
        }

        // ===== PNG 변환 비활성화 (주석처리됨) =====
        // 4. Export the updated Google Sheet to PNG images
        console.log('[비활성화] PNG 변환이 주석처리되어 건너뜁니다.');
        console.log('[비활성화] 원래 실행될 액션: exportGoogleSheetToPng', { spreadsheetId: newSpreadsheetId, fileName: newSpreadsheetTitle });
        
        // logOperation('exportToPng', { spreadsheetId: newSpreadsheetId, fileName: newSpreadsheetTitle });
        // try {
        //   const result = await exportGoogleSheetToPng(
        //     accessToken, 
        //     newSpreadsheetId, 
        //     TEMPLATE_SHEET_GID, 
        //     newSpreadsheetTitle
        //   );
        //   
        //   console.log('PNG export result:', result);
        //   
        //   // GAS에서 반환된 결과를 기존 PNG 표시 형식으로 변환
        //   if (result && result.success && result.fileId && result.fileUrl) {
        //     const pngFile = {
        //       fileName: result.fileName || newSpreadsheetTitle,
        //       fileUrl: result.fileUrl,
        //       fileId: result.fileId,
        //       pageNumber: 1,
        //       sheetName: '장비 대여요청서'
        //     };
        //     
        //     logOperation('exportToPng', { 
        //       success: true, 
        //       fileCount: 1,
        //       fileId: result.fileId,
        //       fileUrl: result.fileUrl
        //     });
        //     
        //     // PNG 파일 정보를 상태에 저장 (기존 방식과 동일)
        //     setPngFiles([pngFile]);
        //     
        //     console.log(`데모 신청 양식이 PNG 이미지로 변환되어 Google Drive에 저장되었습니다.`);
        //     alert(`데모 신청 양식이 PNG 이미지로 변환되어 Google Drive에 저장되었습니다!\n파일명: ${result.fileName}`);
        //     
        //   } else {
        //     throw new Error("PNG export failed - no valid result returned");
        //   }
        //   
        // } catch (error) {
        //   logOperation('exportToPng', { success: false, error: error.message }, 'error');
        //   
        //   // Clear auth data if there's an authentication error
        //   if (error.message.includes('Authentication') || error.message.includes('token')) {
        //     clearAuthData();
        //   }
        //   
        //   alert(`4. PNG 이미지 내보내기 실패: ${getUserFriendlyErrorMessage(error)}`);
        //   return;
        // }

        // ===== 워크플로우 완료 =====
        const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${newSpreadsheetId}/edit`;
        console.log('🎉 전체 워크플로우 완료!');
        console.log('📄 생성된 스프레드시트:', spreadsheetUrl);
        console.log('📄 스프레드시트 제목:', newSpreadsheetTitle);
        
        // URL을 클립보드에 복사 (선택적)
        if (navigator.clipboard && navigator.clipboard.writeText) {
          try {
            await navigator.clipboard.writeText(spreadsheetUrl);
            console.log('📋 URL이 클립보드에 복사되었습니다!');
          } catch (clipboardError) {
            console.log('클립보드 복사 실패:', clipboardError);
          }
        }

      } catch (error) {
        logOperation('workflowError', { error: error.message }, 'error');
        
        // Clear auth data if there's an authentication error
        if (error.message.includes('Authentication') || error.message.includes('token')) {
          clearAuthData();
        }
        
        alert(`전체 워크플로우 중 오류 발생: ${getUserFriendlyErrorMessage(error)}`);
      } finally {
        // Reset loading state
        setIsExportingToPng(false);
      }
    };

    return (
      <div className={styles.formContainer}>
        <div className={styles.selectedEquipmentsSummary}>
          <h4>선택된 장비 목록:</h4>
          <ul>
            {selectedEquipments.map(equipment => (
              <li key={equipment.id}>{equipment.name} ({equipment.serial})</li>
            ))}
          </ul>
        </div>
        
        <div className={styles.infoBox}>
          <h3>[기본정보]</h3>
          <div className={styles.formGrid}>
            <div className={styles.formField} style={{ gridColumn: '1 / -1' }}><label>요청자 :</label><input type="text" name="requester" value={formData.requester} onChange={handleChange} style={{ width: '120px' }} /></div>
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
            <div className={styles.formFieldFullWidth}><label>반출 사유 :</label><input type="text" name="checkoutReason" value={formData.checkoutReason} onChange={handleChange} required style={{ width: '600px', height: '60px' }} /></div>
            <div className={styles.formFieldFullWidth}><label>반출 장소 :</label><input type="text" name="checkoutLocation" value={formData.checkoutLocation} onChange={handleChange} style={{ width: '300px' }} /></div>
          </div>
        </div>

        <div className={styles.infoBox}>
          <h3>[파트너 정보]</h3>
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
                      <li key={partner.id} onClick={() => handlePartnerSelect(partner)}>
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
            <div className={styles.formField}><label>파트너 사업자번호 *(필수) :</label><input type="text" name="partnerBusinessNumber" value={formData.partnerBusinessNumber} onChange={handleChange} style={{ width: '150px' }} /></div>
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
                      <li key={partner.id} onClick={() => handlePartnerSelect(partner)}>
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
            <div className={styles.formField}><label>파트너 연락처 *(필수) :</label><input type="text" name="partnerContactNumber" value={formData.partnerContactNumber} onChange={handleChange} style={{ width: '150px' }} /></div>
            <div className={styles.formFieldFullWidth}><label>파트너 주소 *(필수) :</label><input type="text" name="partnerAddress" value={formData.partnerAddress} onChange={handleChange} style={{ width: '500px' }} /></div>
          </div>
        </div>

        <div className={styles.infoBox}>
          <h3>[사용처 정보]</h3>
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
                  style={{ width: '150px' }} 
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
            <div className={styles.formField}><label>사용처 사업자번호 :</label><input type="text" name="usageBusinessNumber" value={formData.usageBusinessNumber} onChange={handleChange} style={{ width: '150px' }} /></div>
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
                  style={{ width: '150px' }} 
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
            <div className={styles.formField}><label>사용처 담당자 연락처 *(필수) :</label><input type="text" name="usageContactNumber" value={formData.usageContactNumber} onChange={handleChange} required style={{ width: '150px' }} /></div>
            <div className={styles.formFieldFullWidth}><label>사용처 주소 *(필수) :</label><input type="text" name="usageAddress" value={formData.usageAddress} onChange={handleChange} required placeholder="" style={{ width: '500px'}} /></div>
          </div>
        </div>

        <div className={styles.formActions}>
          <button 
            onClick={testConnection} 
            className="button-secondary" 
            style={{ marginRight: '10px' }}
          >
            연결 테스트
          </button>
          <button 
            onClick={initializeSheet} 
            className="button-secondary" 
            style={{ marginRight: '10px' }}
          >
            시트 초기화
          </button>
          <button 
            onClick={handleTestSheetData} 
            className="button-secondary" 
            style={{ marginRight: '10px' }}
          >
            시트 데이터 테스트
          </button>
          <button 
            onClick={handleFillDummyData} 
            className="button-secondary" 
            style={{ marginRight: '10px' }}
          >
            입력 테스트
          </button>
          <button 
            onClick={handleDownloadPng} 
            className="button-primary" 
            disabled={!isGoogleApiLoaded || isExportingToPng}
          >
            {isExportingToPng ? 'PNG 이미지 생성 중...' : 'PNG 이미지로 출력'}
          </button>
          <button onClick={onCancel} className="button-secondary">취소</button>
        </div>

        {/* 생성된 스프레드시트 결과 표시 */}
        {createdSpreadsheetUrl && (
          <div className={styles.spreadsheetResultBox}>
            <div className={styles.spreadsheetResultHeader}>
              <span className={styles.successIcon}>✅</span>
              <h4>스프레드시트가 생성되었습니다!</h4>
            </div>
            <div className={styles.spreadsheetResultContent}>
              <p className={styles.spreadsheetResultDescription}>
                생성된 장비 대여요청서를 확인하세요.
              </p>
              <a 
                href={createdSpreadsheetUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className={styles.spreadsheetResultButton}
              >
                📄 Google Sheets에서 열기
              </a>
              <div className={styles.spreadsheetResultUrl}>
                <code>{createdSpreadsheetUrl}</code>
              </div>
              <button 
                onClick={() => {
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(createdSpreadsheetUrl)
                      .then(() => alert('URL이 클립보드에 복사되었습니다!'))
                      .catch(err => console.error('클립보드 복사 실패:', err));
                  }
                }}
                className={styles.copyUrlButtonInline}
              >
                📋 URL 복사
              </button>
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

  // MainPage component return statement
  return (
    <div className={styles.container}>
      <Header user={user} onLogout={onLogout} />
      
      <div className={styles.mainContent}>
        <div className={`${styles.section} ${styles.myDemoSection} ${isMyDemosFolded ? styles.folded : ''}`}>
          <div className={styles.sectionHeader}>
            <h2>내 데모 현황</h2>
          </div>
          {!isMyDemosFolded && (
            <div className={styles.tableContainer}>
              {loadingMyDemos ? (
                <SkeletonMyDemoTable rows={3} />
              ) : myDemos.length > 0 ? (
                <MyDemoList demos={myDemos} onReturn={handleReturn} />
              ) : (
                <p className={styles.noData}>현재 대여 중인 장비가 없습니다.</p>
              )}
            </div>
          )}
          <div className={styles.sectionFooter}>
            <button 
              onClick={() => setIsMyDemosFolded(!isMyDemosFolded)}
              className={styles.foldButton}
            >
              {isMyDemosFolded ? '▼ 펼치기' : '▲ 접기'}
            </button>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>새 데모 신청</h2>
            <div className={styles.filterControls}>
              <label className={styles.filterLabel}>
                <input
                  type="checkbox"
                  checked={showInUseEquipment}
                  onChange={(e) => setShowInUseEquipment(e.target.checked)}
                />
                사용 중인 장비도 보기
              </label>
              <button 
                onClick={handleExportSheetToPng}
                className="button-primary"
                disabled={!googleApiLoaded || isExportingSheetToPng}
                style={{ marginLeft: '20px' }}
              >
                {isExportingSheetToPng ? 'Google Sheets PNG 변환 중...' : 'Google Sheets PNG 변환'}
              </button>
            </div>
          </div>
          
          <div className={styles.searchSection}>
            <SearchBar onSearch={handleSearch} />
          </div>
          
          <div className={styles.tableContainer}>
            {loadingEquipments ? (
              <SkeletonTable rows={5} />
            ) : (
              <EquipmentList 
                equipments={filteredEquipments} 
                selectedEquipments={selectedEquipments}
                onEquipmentToggle={handleEquipmentToggle}
              />
            )}
          </div>

          <SelectedEquipmentsList
            selectedEquipments={selectedEquipments}
            onRemoveEquipment={handleRemoveEquipment}
          />

          {showApplicationForm && selectedEquipments.length > 0 && (
            <div className={styles.applicationFormContainer}>
              <h3>데모 신청 정보</h3>
              <MultiEquipmentApplicationForm 
                selectedEquipments={selectedEquipments}
                applicantName={getUserDisplayName(user)}
                allPartners={allPartners}
                onNewDemo={handleMultipleNewDemo}
                onCancel={() => setShowApplicationForm(false)}
                isGoogleApiLoaded={googleApiLoaded}
                googleTokenClient={googleTokenClient}
                onJpgImagesGenerated={handleJpgImagesGenerated}
              />
            </div>
          )}

          {/* JPG 이미지 미리보기 */}
          {pdfPreviewImages && pdfPreviewImages.length > 0 && (
            <JpgViewer 
              images={pdfPreviewImages}
              title="데모 신청 양식 미리보기" // Static title
              showDownload={true} 
              onClose={() => {
                setPdfPreviewImages([]); // Clear JPG previews
                setPdfUrl(null); // Clear PDF URL if it was set for fallback
                setPdfBase64(null); // Clear Base64 if it was set
              }}
            />
          )}

          {/* PNG 이미지 미리보기 */}
          {pngFiles && pngFiles.length > 0 && (
            <div className={styles.pngViewer}>
              <div className={styles.pngViewerHeader}>
                <h3>PNG 이미지 미리보기</h3>
                <button 
                  onClick={() => setPngFiles([])}
                  className={styles.closeButton}
                >
                  ✕
                </button>
              </div>
              <div className={styles.pngViewerContent}>
                {pngFiles.map((pngFile, index) => (
                  <div key={index} className={styles.pngFileItem}>
                    <h4>{pngFile.fileName}</h4>
                    <p>페이지: {pngFile.pageNumber || index + 1}</p>
                    <p>시트: {pngFile.sheetName || 'N/A'}</p>
                    <a 
                      href={pngFile.fileUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className={styles.downloadLink}
                    >
                      Google Drive에서 보기
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Google Sheets PNG 이미지 미리보기 */}
          {sheetPngFiles && sheetPngFiles.length > 0 && (
            <div className={styles.pngViewer}>
              <div className={styles.pngViewerHeader}>
                <h3>Google Sheets PNG 이미지 미리보기</h3>
                <button 
                  onClick={() => setSheetPngFiles([])}
                  className={styles.closeButton}
                >
                  ✕
                </button>
              </div>
              <div className={styles.pngViewerContent}>
                {sheetPngFiles.map((pngFile, index) => (
                  <div key={index} className={styles.pngFileItem}>
                    <h4>{pngFile.fileName}</h4>
                    <p>페이지: {pngFile.pageNumber || index + 1}</p>
                    <p>시트: {pngFile.sheetName || '행사장비요청서'}</p>
                    <a 
                      href={pngFile.fileUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className={styles.downloadLink}
                    >
                      Google Drive에서 보기
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PDF 뷰어 (JPG 이미지가 없을 때만) */}
          {!pdfPreviewImages && (pdfBase64 || pdfUrl) && (
            <PdfViewer 
              pdfUrl={pdfBase64 ? `data:application/pdf;base64,${pdfBase64}` : pdfUrl}
              onImagesGenerated={handleJpgImagesGenerated}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default MainPage;
