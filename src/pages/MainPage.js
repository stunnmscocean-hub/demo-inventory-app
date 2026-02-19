import React, { useState, useEffect, useCallback, useRef } from 'react';
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
} from '../utils/googleSheetPdfExporter'; // Import Google Sheet PDF exporter, updater, and readiness checker
import { parseEquipmentCsv, parseUsageCsv, parsePartnerCsv } from '../utils/csvParser';
import { getEquipmentData, getPartnerData, returnEquipment, uploadFile, updateFormSubmission } from '../services/api';
import { setCacheData, getForceCacheData, findDataChanges, CACHE_KEYS } from '../utils/dataCache';
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
        placeholder="장비 이름, 시리얼"
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
        <th>선택</th>
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

// 내 데모 현황용 스켈레톤 (8개 칼럼 - 선택 칼럼 + 파트너명 칼럼 추가)
const SkeletonMyDemoRow = () => (
  <tr>
    <td style={{ textAlign: 'center' }}><div className={`${styles.skeleton} ${styles.skeletonCellSmall}`} /></td>
    <td data-label="장비명"><div className={`${styles.skeleton} ${styles.skeletonCellLarge}`} /></td>
    <td data-label="시리얼 넘버"><div className={`${styles.skeleton} ${styles.skeletonCellMedium}`} /></td>
    <td data-label="대여 시작일"><div className={`${styles.skeleton} ${styles.skeletonCellMedium}`} /></td>
    <td data-label="반납 예정일"><div className={`${styles.skeleton} ${styles.skeletonCellMedium}`} /></td>
    <td data-label="파트너명"><div className={`${styles.skeleton} ${styles.skeletonCellMedium}`} /></td>
    <td data-label="신청 양식"><div className={`${styles.skeleton} ${styles.skeletonButton}`} /></td>
    <td data-label="관리"><div className={`${styles.skeleton} ${styles.skeletonButton}`} /></td>
  </tr>
);

const SkeletonMyDemoTable = ({ rows = 3 }) => {
  const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 600);
  const [isTablet, setIsTablet] = React.useState(window.innerWidth <= 720 && window.innerWidth > 600);

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 600);
      setIsTablet(window.innerWidth <= 720 && window.innerWidth > 600);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <table>
      <thead>
        <tr>
          <th style={{ width: '40px', textAlign: 'center' }}>선택</th>
          <th>{isMobile ? '장비' : (isTablet ? '장비' : '장비명')}</th>
          <th>{isMobile ? '시리얼' : (isTablet ? '시리얼' : '시리얼 넘버')}</th>
          <th>{isMobile ? '시작일' : (isTablet ? '시작일' : '대여 시작일')}</th>
          <th>{isMobile ? '반납일' : (isTablet ? '반납일' : '반납 예정일')}</th>
          <th>{isMobile ? '파트너' : (isTablet ? '파트너' : '파트너명')}</th>
          <th>{isMobile ? '양식' : (isTablet ? '양식' : '신청 양식')}</th>
          <th>{isMobile ? '관리' : '관리'}</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, index) => (
          <SkeletonMyDemoRow key={index} />
        ))}
      </tbody>
    </table>
  );
};

// EquipmentList 컴포넌트를 메인 컴포넌트 외부로 이동
const EquipmentList = React.memo(({ equipments, selectedEquipments, onEquipmentToggle, allEquipmentFromSheet }) => {
  // 확장된 장비 ID를 추적하는 state
  const [expandedEquipmentIds, setExpandedEquipmentIds] = useState(new Set());

  const handleCheckboxChange = (e, equipment) => {
    e.stopPropagation(); // Prevent event bubbling
    onEquipmentToggle(equipment);
  };

  const handleRowClick = (e, equipment) => {
    // 체크박스 클릭은 무시
    if (e.target.type === 'checkbox') {
      return;
    }

    // 확장/축소 토글
    setExpandedEquipmentIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(equipment.id)) {
        newSet.delete(equipment.id);
      } else {
        newSet.add(equipment.id);
      }
      return newSet;
    });
  };

  // 특정 장비의 대여 히스토리 가져오기 (최근 3개)
  const getEquipmentHistory = React.useCallback((equipment) => {
    if (!allEquipmentFromSheet || allEquipmentFromSheet.length === 0) {
      return [];
    }

    const serial = equipment.serial || equipment.serialNumber || equipment['시리얼넘버'] || '';
    if (!serial) return [];

    // 시리얼넘버로 필터링하고 "반납완료" 상태 제외
    const history = allEquipmentFromSheet.filter(item => {
      const itemSerial = (item.serial || item.serialNumber || item['시리얼넘버'] || '').toString().trim();
      const itemStatus = (item['대여가능여부'] || item.status || '').toString().trim();

      // 시리얼넘버가 일치하고 "반납완료" 상태가 아닌 것만
      if (itemSerial !== serial) return false;
      if (itemStatus === '반납완료') return false;

      return true;
    });

    // 날짜 기준 정렬 (오래된 것부터 - 오름차순)
    const sortedHistory = history.sort((a, b) => {
      const dateA = parseDateString(a['시작일'] || a.startDate || '');
      const dateB = parseDateString(b['시작일'] || b.startDate || '');

      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;

      return dateA.getTime() - dateB.getTime(); // 오래된 것부터 (오름차순)
    });

    // 최근 3개만 반환 (오래된 것부터)
    return sortedHistory.slice(0, 3);
  }, [allEquipmentFromSheet]);

  // 같은 시작일과 비고를 가진 다른 장비 찾기
  const getRelatedEquipments = React.useCallback((historyItem, currentSerial) => {
    if (!allEquipmentFromSheet || allEquipmentFromSheet.length === 0) {
      return [];
    }

    const startDate = (historyItem['시작일'] || historyItem.startDate || '').toString().trim();
    const memo = (historyItem['비고'] || historyItem.memo || '').toString().trim();

    if (!startDate || !memo) return [];

    // 같은 시작일과 비고를 가진 다른 장비 찾기 (현재 장비 제외, "반납완료" 상태 제외)
    const related = allEquipmentFromSheet.filter(item => {
      const itemSerial = (item.serial || item.serialNumber || item['시리얼넘버'] || '').toString().trim();
      const itemStartDate = (item['시작일'] || item.startDate || '').toString().trim();
      const itemMemo = (item['비고'] || item.memo || '').toString().trim();
      const itemStatus = (item['대여가능여부'] || item.status || '').toString().trim();

      // 현재 장비는 제외
      if (itemSerial === currentSerial) return false;

      // "반납완료" 상태는 제외
      if (itemStatus === '반납완료') return false;

      // 시작일과 비고가 모두 일치하는지 확인
      return itemStartDate === startDate && itemMemo === memo;
    });

    // 중복 제거 (시리얼넘버 기준)
    const uniqueRelated = [];
    const seenSerials = new Set();

    related.forEach(item => {
      const itemSerial = (item.serial || item.serialNumber || item['시리얼넘버'] || '').toString().trim();
      if (!seenSerials.has(itemSerial)) {
        seenSerials.add(itemSerial);
        uniqueRelated.push(item);
      }
    });

    return uniqueRelated;
  }, [allEquipmentFromSheet]);

  // 모바일 여부 확인 (600px 이하)
  const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 600);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 600);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 상태 텍스트 변환 (모바일에서 짧게)
  const getStatusText = (status) => {
    if (!isMobile) return status;

    // 모바일에서 텍스트 축약
    const statusMap = {
      '대여가능': '가능',
      '대여 가능': '가능',
      '대여신청': '신청',
      '대여중': '사용중',
      '사용중': '사용중',
      '반납완료': '완료'
    };

    return statusMap[status] || status;
  };

  // 카테고리 정의
  const CATEGORIES = [
    { id: 'rally', name: 'Rally 시리즈', icon: '📹' },
    { id: 'meetup', name: 'MeetUp 시리즈', icon: '🎥' },
    { id: 'mic', name: '연장 마이크', icon: '🎤' },
    { id: 'tap', name: 'TAP 시리즈', icon: '📱' },
    { id: 'pc', name: 'PC/컴퓨팅', icon: '💻' },
    { id: 'dock', name: 'Dock 시리즈', icon: '🖥️' },
    { id: 'ptz', name: 'PTZ/카메라', icon: '📷' },
    { id: 'webcam', name: '웹캠', icon: '📸' },
    { id: 'cable', name: '케이블', icon: '🔗' },
    { id: 'mount', name: '마운트류', icon: '📐' },
    { id: 'other', name: '기타', icon: '📦' }
  ];

  // 장비의 카테고리 결정
  const getEquipmentCategory = (equipment) => {
    const name = equipment.name || '';
    const lowerNameOriginal = name.toLowerCase(); // 원본 이름 (괄호 포함)
    const cleanName = name.replace(/\s*\([^)]*\)/g, '').trim();
    const lowerName = cleanName.toLowerCase();

    // includes 체크는 원본 이름으로 (괄호 안의 내용도 체크)

    // 5. PC/컴퓨팅 (Roommate, NUC, CTL, ThinkSmart includes) - 먼저 체크
    if (lowerNameOriginal.includes('roommate') || lowerNameOriginal.includes('nuc') ||
      lowerNameOriginal.includes('ctl') || lowerNameOriginal.includes('thinksmart')) {
      console.log(`[PC 카테고리] ${name}`);
      return 'pc';
    }

    // 1. Rally 시리즈
    const rallyList = [
      'Rally Plus', 'Rally System', 'Rally Camera', 'Rally', 'Rally Bar', 'Rally Bar Graphite', 'Rally Bar Mini', 'Rally Bar Huddle',
      'Rally Speaker'
    ];
    if (rallyList.some(model => cleanName === model || lowerName === model.toLowerCase())) return 'rally';

    // 2. MeetUp 시리즈
    const meetupList = ['MeetUp', 'MeetUp 2'];
    if (meetupList.some(model => cleanName === model || lowerName === model.toLowerCase())) return 'meetup';

    // 3. 연장 마이크 (Expansion includes만 허용)
    const micList = ['Rally Mic Pod', 'Mic Pod Expansion', 'MIc Pod'];
    if (micList.some(model => cleanName === model || lowerName === model.toLowerCase()) ||
      lowerNameOriginal.includes('expansion')) return 'mic';

    // 4. TAP 시리즈 (tap includes, mount 포함된 제목은 제외)
    if (lowerNameOriginal.includes('tap') && !lowerNameOriginal.includes('mount')) return 'tap';

    // 6. Dock 시리즈
    const dockList = ['Logi Dock Flex', 'Logi Dock'];
    if (dockList.some(model => cleanName === model || lowerName === model.toLowerCase())) return 'dock';

    // 7. PTZ/카메라
    const ptzList = ['PTZ Pro 2', 'Group', 'Sight', 'Connect', 'BCC950', 'Scribe', 'Reach'];
    if (ptzList.some(model => cleanName === model || lowerName === model.toLowerCase())) return 'ptz';

    // 8. 웹캠
    const webcamList = [
      'Brio', 'MX Brio 705', 'C930e', 'C925e', 'C920e', 'C505e',
      'Brio 705'
    ];
    if (webcamList.some(model => cleanName === model || lowerName === model.toLowerCase())) return 'webcam';

    // 9. 케이블
    const cableList = [
      'Active USB Cable', 'CAT5E Kit for TAP', 'Rally Mic Pod Extension Cable', 'Strong USB Cable',
      'Rally Mic Pod Cat Coupler', 'USB Strong Cable'
    ];
    if (cableList.some(model => cleanName === model || lowerName === model.toLowerCase())) return 'cable';

    // 10. 마운트류 (mount includes만 허용)
    if (lowerNameOriginal.includes('mount')) return 'mount';

    // 기타 (Screen Share, H570e 등)
    const otherList = ['Screen Share', 'H570e'];
    if (otherList.some(model => cleanName === model || lowerName === model.toLowerCase())) {
      console.log(`[기타 카테고리 - 명시적] ${name}`);
      return 'other';
    }

    // 기타 (나머지 모든 장비)
    console.log(`[기타 카테고리 - 기본] ${name}`);
    return 'other';
  };

  // 장비를 카테고리별로 그룹화
  const groupedEquipments = React.useMemo(() => {
    const groups = {};

    // console.log('===== 전체 장비 목록 =====');
    // console.log('총 장비 수:', equipments.length);

    equipments.forEach(eq => {
      const categoryId = getEquipmentCategory(eq);
      if (!groups[categoryId]) {
        groups[categoryId] = [];
      }
      groups[categoryId].push(eq);
    });

    // console.log('===== 카테고리별 그룹화 결과 =====');
    // Object.keys(groups).forEach(catId => {
    //   console.log(`[${catId}] ${groups[catId].length}개:`, groups[catId].map(e => e.name));
    // });

    return groups;
  }, [equipments]);

  // 렌더링할 카테고리 목록 (장비가 있는 카테고리만)
  const categoriesToRender = CATEGORIES.filter(cat =>
    groupedEquipments[cat.id] && groupedEquipments[cat.id].length > 0
  );

  return (
    <div>
      {categoriesToRender.map((category) => (
        <div key={category.id} className={styles.categorySection}>
          <div className={styles.categoryHeader}>
            <span className={styles.categoryIcon}>{category.icon}</span>
            <span className={styles.categoryName}>{category.name}</span>
            <span className={styles.categoryCount}>({groupedEquipments[category.id].length})</span>
          </div>
          <table className={styles.categoryTable}>
            <thead>
              <tr>
                <th>선택</th>
                <th>{isMobile ? '장비' : '장비명'}</th>
                <th>{isMobile ? '시리얼' : '시리얼 넘버'}</th>
                <th>{isMobile ? '위치' : '장비 위치'}</th>
                <th>{isMobile ? '현황' : '사용 현황'}</th>
              </tr>
            </thead>
            <tbody>
              {groupedEquipments[category.id].map((eq) => {
                const isSelected = selectedEquipments.some(selected => selected.id === eq.id);
                const isExpanded = expandedEquipmentIds.has(eq.id);
                const history = isExpanded ? getEquipmentHistory(eq) : [];
                const currentSerial = eq.serial || eq.serialNumber || eq['시리얼넘버'] || '';


                return (
                  <React.Fragment key={eq.id}>
                    <tr
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
                      <td>
                        {eq.name}
                      </td>
                      <td>{eq.serial}</td>
                      <td>{eq.location}</td>
                      <td>{getStatusText(eq.status)}</td>
                    </tr>
                    {isExpanded && history.length > 0 && (
                      <>
                        {history.map((historyItem, idx) => {
                          // 현재 히스토리 항목과 같은 비고를 가진 관련 장비 찾기
                          const related = getRelatedEquipments(historyItem, currentSerial);

                          // 장비 정보를 쌍으로 수집 (제품명 + 시리얼번호)
                          const equipmentPairs = [];

                          // 현재 장비 추가
                          if (eq.name || eq.serial) {
                            equipmentPairs.push({
                              name: (eq.name || '').toString().trim(),
                              serial: (eq.serial || eq.serialNumber || eq['시리얼넘버'] || '').toString().trim()
                            });
                          }

                          // 관련 장비 추가
                          related.forEach(item => {
                            const name = (item['제품명'] || item.name || '').toString().trim();
                            const serial = (item.serial || item.serialNumber || item['시리얼넘버'] || '').toString().trim();

                            // 현재 장비와 중복되지 않고, 이름이나 시리얼이 있는 경우만 추가
                            const isDuplicate = equipmentPairs.some(pair =>
                              (pair.name && pair.name === name) || (pair.serial && pair.serial === serial)
                            );

                            if (!isDuplicate && (name || serial)) {
                              equipmentPairs.push({ name, serial });
                            }
                          });

                          // 날짜 포맷팅
                          const assignee = (historyItem['대여담당자'] || historyItem.assignee || '').toString().trim();
                          const startDate = (historyItem['시작일'] || historyItem.startDate || '').toString().trim();
                          const endDate = (historyItem['종료일'] || historyItem.endDate || historyItem.returnDate || '').toString().trim();

                          let formattedStartDate = '';
                          if (startDate) {
                            const date = parseDateString(startDate);
                            if (date && !isNaN(date.getTime())) {
                              const year = String(date.getFullYear()).slice(-2);
                              const month = String(date.getMonth() + 1).padStart(2, '0');
                              const day = String(date.getDate()).padStart(2, '0');
                              formattedStartDate = `${year}/${month}/${day}`;
                            }
                          }

                          let formattedEndDate = '';
                          if (endDate) {
                            const date = parseDateString(endDate);
                            if (date && !isNaN(date.getTime())) {
                              const month = String(date.getMonth() + 1).padStart(2, '0');
                              const day = String(date.getDate()).padStart(2, '0');
                              formattedEndDate = `${month}/${day}`;
                            }
                          }

                          const memo = (historyItem['비고'] || historyItem.memo || '').toString().trim();

                          // 디버깅: 데이터 확인
                          if (idx === 0) {
                            console.log('First History Item Debug:', {
                              historyItem,
                              equipmentPairs,
                              assignee,
                              formattedStartDate,
                              memo,
                              eqName: eq.name,
                              eqSerial: eq.serial,
                              currentSerial
                            });
                          }

                          // 내용이 있는지 확인
                          const hasAnyContent = equipmentPairs.length > 0 || assignee || formattedStartDate || memo;

                          return (
                            <tr key={`${eq.id}-history-${idx}`} className={styles.historyRow}>
                              <td className={styles.historyBox} colSpan="5">
                                <div className={styles.historyBoxContent}>
                                  {hasAnyContent ? (
                                    <>
                                      {equipmentPairs.length > 0 && (
                                        <div className={styles.historyBoxGrid}>
                                          {equipmentPairs.map((pair, pairIdx) => (
                                            <div key={pairIdx} className={styles.historyBoxItem}>
                                              <div className={styles.historyBoxItemName}>{pair.name}</div>
                                              <div className={styles.historyBoxItemSerial}>{pair.serial}</div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {(assignee || formattedStartDate) && (
                                        <div className={styles.historyBoxRow}>
                                          <span>{assignee || '-'}</span>
                                          {formattedStartDate && (
                                            <span> ({formattedStartDate}{formattedEndDate ? ` - ${formattedEndDate}` : ''})</span>
                                          )}
                                        </div>
                                      )}
                                      {memo && (
                                        <div className={styles.historyBoxRow}>
                                          <div className={styles.historyBoxMemo}>{memo}</div>
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <div className={styles.historyBoxRow}>
                                      <span>대여 정보 없음</span>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
});


// 사용자 이름 표시 (ACL 시트에서 가져온 이름 사용)
const getUserDisplayName = (user) => {
  // OAuth 로그인 시 GAS에서 ACL 시트의 name을 user.name에 설정
  return user?.name || user?.email || '게스트';
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
// Helper functions and constants
// ----------------------------------------------------------------

// Custom sorting order
const customOrder = [
  // 1. Rally 시리즈
  "Rally Plus", "Rally System", "Rally Camera", "Rally", "Rally Bar", "Rally Bar Mini", "Rally Bar Huddle",
  "Rally Bar Graphite", "Rally Speaker",
  // 2. MeetUp 시리즈
  "MeetUp", "MeetUp 2",
  // 3. 연장 마이크 (Expansion 포함 + Rally Mic Pod)
  "Rally Mic Pod", "MIc Pod", "Mic Pod Expansion",
  // 4. TAP 시리즈 (tap includes)
  "TAP", "TAP IP",
  // 5. PC/컴퓨팅 (Roommate, NUC, CTL, ThinkSmart includes)
  "Google Chromebox",
  // 6. Dock 시리즈
  "Logi Dock Flex", "Logi Dock",
  // 7. PTZ/카메라
  "PTZ Pro 2", "Group", "Sight", "Connect", "BCC950", "Scribe", "Reach",
  // 8. 웹캠
  "Brio", "Brio 705", "MX Brio 705", "C930e", "C925e", "C920e", "C505e",
  // 9. 케이블
  "Active USB Cable", "CAT5E Kit for TAP", "Rally Mic Pod Extension Cable", "Rally Mic Pod Cat Coupler",
  "Strong USB Cable", "USB Strong Cable",
  // 10. 마운트류 (mount 포함)
  "TV Mount", "Wall Mount", "Secure Mount"
];

// Function to clean equipment names for sorting
const getCleanName = (name) => {
  let clean = name.replace(/\s*\([^)]*\)/g, '').trim(); // Remove text in parentheses
  // Do not remove numbers, as "MeetUp 2" is a distinct item
  return clean;
};

// 장비 카테고리 결정 함수
const getCategoryRank = (name) => {
  const lowerNameOriginal = name.toLowerCase(); // 원본 이름 (괄호 포함)
  const cleanName = getCleanName(name);

  // customOrder에 정확히 일치하는 항목이 있으면 그 위치 반환
  const exactIndex = customOrder.indexOf(cleanName);
  if (exactIndex !== -1) {
    return exactIndex;
  }

  // includes 체크는 원본 이름으로

  // 5. PC/컴퓨팅 (Roommate, NUC, CTL, ThinkSmart 포함) - 먼저 체크
  if (lowerNameOriginal.includes('roommate') || lowerNameOriginal.includes('nuc') ||
    lowerNameOriginal.includes('ctl') || lowerNameOriginal.includes('thinksmart')) {
    return customOrder.indexOf("Google Chromebox");
  }

  // 3. 연장 마이크 (Expansion 포함)
  if (lowerNameOriginal.includes('expansion')) {
    return customOrder.indexOf("Mic Pod Expansion");
  }

  // 4. TAP 시리즈 (tap 포함, mount 포함된 제목은 제외)
  if (lowerNameOriginal.includes('tap') && !lowerNameOriginal.includes('mount')) {
    return customOrder.indexOf("TAP");
  }

  // 10. 마운트류 (mount 포함)
  if (lowerNameOriginal.includes('mount')) {
    return customOrder.indexOf("TV Mount");
  }

  // customOrder에 없으면 맨 뒤로
  return customOrder.length;
};

// Sorting function
const sortEquipment = (a, b) => {
  const rankA = getCategoryRank(a.name);
  const rankB = getCategoryRank(b.name);

  // Sort by category rank first
  if (rankA !== rankB) {
    return rankA - rankB;
  }

  // 같은 카테고리 내에서는 이름 순으로 정렬
  const cleanNameA = getCleanName(a.name);
  const cleanNameB = getCleanName(b.name);
  return cleanNameA.localeCompare(cleanNameB);
};

// 대여 가능 상태 체크 (다양한 표기 허용)
const isAvailableStatus = (status) => {
  if (!status) return false;
  const normalizedStatus = status.toString().trim().toLowerCase().replace(/\s+/g, '');
  // '대여 가능', '대여가능', '대여  가능', '반납완료', '반납 완료' 등 모두 허용
  return normalizedStatus === '대여가능' || normalizedStatus === '반납완료';
};

// ----------------------------------------------------------------
// Main Page Component
// ----------------------------------------------------------------

const MainPage = ({ user, onLogout }) => {
  const [myDemos, setMyDemos] = useState([]);
  const [allAssigneeDemos, setAllAssigneeDemos] = useState([]); // 모든 담당자별 데모 현황
  const [currentAssigneeIndex, setCurrentAssigneeIndex] = useState(0); // 현재 보여주는 담당자 인덱스
  const [availableEquipments, setAvailableEquipments] = useState([]);
  const [filteredEquipments, setFilteredEquipments] = useState([]);
  const [allEquipments, setAllEquipments] = useState([]);
  const [allEquipmentFromSheet, setAllEquipmentFromSheet] = useState([]); // 시트1의 전체 히스토리 데이터
  const [allPartners, setAllPartners] = useState([]); // New state for partner data
  const [showInUseEquipment, setShowInUseEquipment] = useState(false);
  const [isMyDemosFolded, setIsMyDemosFolded] = useState(false); // State for folding MyDemoList
  const [applicationFormState, setApplicationFormState] = useState('folded'); // 'expanded', 'compact', 'folded' - 초기값 folded
  const [isBottomAreaExpanded, setIsBottomAreaExpanded] = useState(false); // 스크롤 시 높이 확장 상태
  const scrollableAreaRef = useRef(null); // Ref for scrollable area
  const bottomFixedAreaRef = useRef(null); // Ref for bottom fixed area
  const scrollCountRef = useRef(0); // 스크롤 카운터
  const lastScrollTopRef = useRef(0); // 마지막 스크롤 위치
  const isProcessingRef = useRef(false); // 상태 변경 처리 중 플래그
  const stateChangedRef = useRef(false); // 터치 이벤트 내 상태 변경 플래그
  const myDemoSectionRef = useRef(null); // 스와이프를 위한 ref

  // 섹션별 로딩 상태
  const [loadingMyDemos, setLoadingMyDemos] = useState(true);
  const [loadingEquipments, setLoadingEquipments] = useState(true);
  const [, setLoadingPartners] = useState(true); // loadingPartners는 사용하지 않지만 setLoadingPartners는 사용

  const [selectedEquipments, setSelectedEquipments] = useState([]); // State for selected equipments
  const [selectedDemos, setSelectedDemos] = useState([]); // State for selected demos to return
  const [isReturning, setIsReturning] = useState(false); // 반납 진행 중 상태
  const [returnLogs, setReturnLogs] = useState([]); // 반납 진행 로그
  // const [excelImage, setExcelImage] = useState(null); // State for Excel image preview (no longer needed for direct PDF export)
  const [showApplicationForm, setShowApplicationForm] = useState(false); // State for showing application form
  const [googleApiLoaded, setGoogleApiLoaded] = useState(false); // State to track Google API readiness
  const [googleTokenClient, setGoogleTokenClient] = useState(null); // State to store tokenClient
  const [pdfPreviewImages, setPdfPreviewImages] = useState([]); // State for PDF preview images (multiple pages)
  const [pdfUrl, setPdfUrl] = useState(null); // State for PDF URL
  const [pdfBase64, setPdfBase64] = useState(null); // State for PDF Base64 data
  const [pngFiles, setPngFiles] = useState([]); // State for PNG files
  const [isExportingToPng, setIsExportingToPng] = useState(false); // State for PNG export loading
  const [processMessage, setProcessMessage] = useState(''); // State for detailed process message
  const [sheetPngFiles, setSheetPngFiles] = useState([]); // State for specific sheet PNG files
  const [createdSpreadsheetUrl, setCreatedSpreadsheetUrl] = useState(null); // State for created spreadsheet URL
  const [createdPdfUrl, setCreatedPdfUrl] = useState(null); // State for created PDF URL
  const [createdPdfDownloadUrl, setCreatedPdfDownloadUrl] = useState(null); // State for PDF download URL
  const [isSheetBoxExpanded, setIsSheetBoxExpanded] = useState(false); // State for sheet box expand/collapse


  // 장비 데이터 처리 헬퍼 함수 (캐시와 서버 데이터 공통 로직)
  const processEquipmentData = useCallback((allEquipmentFromSheet, userName) => {
    // console.log('📋 [processEquipmentData] 시작 - 전체:', allEquipmentFromSheet.length, '건');

    // Step 1: 시리얼 넘버별로 최신 데이터만 추출 (히스토리 중복 제거)
    const latestEquipmentMap = new Map();

    // 역순으로 순회하여 각 시리얼 넘버의 최신 상태만 유지
    [...allEquipmentFromSheet].reverse().forEach((item, index) => {
      const serial = (item.serial || item.serialNumber || item['시리얼넘버'] || '').toString().trim();

      // 빈 시리얼은 건너뛰기
      if (!serial) {
        // console.log(`⚠️ 시리얼 번호 없는 장비 건너뜀:`, item.name);
        return;
      }

      // 이미 해당 시리얼의 최신 상태를 찾았으면 건너뛰기
      if (!latestEquipmentMap.has(serial)) {
        latestEquipmentMap.set(serial, item);
        // console.log(`[최신 장비] ${item.name} (${serial}) - 상태: ${item.status}`);
      } else {
        // console.log(`[건너뜀] ${item.name} (${serial}) - 상태: ${item.status} (이미 최신 존재)`);
      }
    });

    // Map에서 배열로 변환
    const uniqueEquipments = Array.from(latestEquipmentMap.values());
    // console.log(`📊 중복 제거 완료: ${allEquipmentFromSheet.length}건 → ${uniqueEquipments.length}건 (고유 장비)`);

    // Step 2: 정렬
    const sortedAllEquipment = [...uniqueEquipments].sort(sortEquipment);
    setAllEquipments(sortedAllEquipment);

    // console.log('📋 전체 장비 목록 확인 (NUC PC 포함 여부):');
    // const nucPcEquipments = sortedAllEquipment.filter(item => 
    //   item.name && item.name.toLowerCase().includes('nuc')
    // );
    // console.log('NUC 장비들:', nucPcEquipments.map(e => ({ name: e.name, status: e.status, available: isAvailableStatus(e.status) })));

    // Step 3: 대여 가능 여부로 필터링
    const initialFiltered = sortedAllEquipment.filter(item => {
      if (showInUseEquipment) return true; // 사용중인 장비도 보기가 켜져있으면 모두 표시
      const available = isAvailableStatus(item.status);
      // if (!available && item.name && item.name.toLowerCase().includes('nuc')) {
      //   console.log(`❌ NUC 장비 필터링됨: ${item.name}, status="${item.status}"`);
      // }
      return available; // 대여 가능한 장비만 표시
    });

    // console.log(`📋 장비 필터링: 전체 ${sortedAllEquipment.length}건 → 표시 ${initialFiltered.length}건 (showInUseEquipment: ${showInUseEquipment})`);
    setAvailableEquipments(initialFiltered);
    setFilteredEquipments(initialFiltered);
  }, [showInUseEquipment]);

  useEffect(() => {
    const fetchAllCsvData = async () => {
      const userName = (user.name === '테스트사용자' || user.name === 'test') ? '홍길동' : user.name;

      // 🚀 STEP 1: 캐시 데이터 즉시 로드 (빠른 표시)
      // console.log('⚡ [Step 1] 캐시 데이터 로드 시작...');
      const cachedEquipment = getForceCacheData(CACHE_KEYS.EQUIPMENT);
      const cachedPartners = getForceCacheData(CACHE_KEYS.PARTNER);

      if (cachedEquipment && cachedEquipment.length > 0) {
        // console.log('✅ [Cache Hit] 장비 데이터 캐시:', cachedEquipment.length, '건');
        // 캐시 데이터로 즉시 표시
        processEquipmentData(cachedEquipment, userName);
        setLoadingEquipments(false);
      } else {
        setLoadingEquipments(true);
      }

      if (cachedPartners && cachedPartners.length > 0) {
        // console.log('✅ [Cache Hit] 파트너 데이터 캐시:', cachedPartners.length, '건');
        setAllPartners(cachedPartners);
        setLoadingPartners(false);
      } else {
        setLoadingPartners(true);
      }

      // 내 데모는 항상 로딩 (빠르게 변경되므로)
      setLoadingMyDemos(true);

      // 🔄 STEP 2: 백그라운드에서 최신 데이터 가져오기
      // console.log('🔄 [Step 2] 서버 데이터 로드 시작...');

      try {
        // Fetch equipment data from Google Sheet (1번만 호출!)
        let allEquipmentFromSheet = [];
        try {
          // console.log('📦 장비 데이터 로딩 시작 (시트)...');
          const equipmentData = await getEquipmentData();
          allEquipmentFromSheet = equipmentData.data || [];
          // console.log(`✅ 장비 데이터 로드 완료: ${allEquipmentFromSheet.length}건`);

          // // 🔍 상태값 분석 (Mini 검색 문제 디버깅)
          // const statusMap = new Map();
          // allEquipmentFromSheet.forEach(item => {
          //   const status = (item.status || '없음').toString().trim();
          //   const name = item.name || '이름없음';
          //   statusMap.set(status, (statusMap.get(status) || 0) + 1);
          //   
          //   // Mini가 포함된 장비 상세 로그
          //   if (name.toLowerCase().includes('mini')) {
          //     console.log(`🔍 [Mini 장비 발견] ${name} - 상태: "${status}"`);
          //   }
          // });
          // 
          // console.log('📊 시트의 상태값 분포:', Object.fromEntries(statusMap));
          // console.log('Sample equipment data:', allEquipmentFromSheet[0]);

          // 🎯 클라이언트 사이드 필터링: 내 대여 현황
          // Step 1: 담당자가 나인 장비만 추출
          const myEquipments = allEquipmentFromSheet.filter(item => {
            const assignee = (item.assignee || item['대여담당자'] || '').toString().trim();
            return assignee === userName;
          });

          // console.log(`내가 담당한 장비 (전체 히스토리): ${myEquipments.length}건`);

          // Step 2: 시리얼넘버별로 최신 상태만 추출 (역순 검색)
          const latestEquipmentMap = new Map();

          // 역순으로 순회 (최신이 먼저)
          [...myEquipments].reverse().forEach((item, index) => {
            const serial = (item.serial || item.serialNumber || item['시리얼넘버'] || '').toString().trim();
            const status = (item.status || item['대여가능여부'] || '').toString().trim();

            // 이미 해당 시리얼의 최신 상태를 찾았으면 건너뛰기
            if (!latestEquipmentMap.has(serial)) {
              latestEquipmentMap.set(serial, { item, status });
              // console.log(`[최신] ${item.name} (${serial}) - 상태: ${status}`);
            } else {
              // console.log(`[건너뜀] ${item.name} (${serial}) - 상태: ${status} (이미 최신 존재)`);
            }
          });

          // Step 3: "대여신청" 또는 "대여중" 상태만 필터링 (GAS와 동일한 로직)
          const myDemoData = [];
          latestEquipmentMap.forEach(({ item, status }, serial) => {
            // "대여신청" 또는 "대여중"인 경우만 추가 (GAS handleGetMyDemoData와 동일)
            if (status === '대여신청' || status === '대여중') {
              myDemoData.push(item);
              // console.log(`✅ [표시] ${item.name} (${serial}) - 상태: ${status}`);
            } else {
              // console.log(`❌ [제외] ${item.name} (${serial}) - 상태: ${status}`);
            }
          });

          console.log(`✅ 최종 내 대여 현황: ${myDemoData.length}건`);

          // 내 데모 현황 데이터 변환
          console.log('\n🚨🚨🚨 [긴급] GAS에서 받은 원본 데이터:', JSON.stringify(myDemoData[0], null, 2));

          let initialMyDemos = myDemoData.map((item, index) => {
            const demo = {
              id: index,
              name: item.name || item['제품명'] || '',
              serial: item.serial || item.serialNumber || item['시리얼넘버'] || '',
              assignee: item.assignee || item['대여담당자'] || '',
              startDate: item.startDate || item['시작일'] || '',
              returnDate: item.endDate || item.returnDate || item['종료일'] || '',
              partnerName: item.partnerName || item['파트너명'] || '',
              partnerContact: item.partnerContact || item['파트너담당자명'] || '',
              partnerPhone: item.partnerPhone || '',
              userName: item.userName || item['사용자명'] || '',
              userContact: item.userContact || item['사용자담당자명'] || '',
              userPhone: item.userPhone || '',
              memo: item.memo || item['비고'] || '',
              formSubmitted: item.formSubmitted || false, // 시트에서 받아온 제출 여부
              fileUrl: item.fileUrl || item['신청양식제출'] || '', // 제출된 파일 URL
              location: item.location || item['보관위치'] || '본사',
              status: item.status || item['대여가능여부'] || ''
            };

            // 디버깅: 파트너 정보 확인
            if (demo.partnerName || demo.partnerPhone || demo.userPhone) {
              console.log(`\n📱 [React - 휴대폰 번호 디버깅] ${demo.name} (${demo.serial}):`, {
                파트너명: demo.partnerName,
                파트너담당자: demo.partnerContact,
                파트너휴대폰: demo.partnerPhone,
                사용자명: demo.userName,
                사용자담당자: demo.userContact,
                사용자휴대폰: demo.userPhone,
                비고: demo.memo
              });
            }

            return demo;
          });

          // 같은 대여건 그룹핑 및 제출 상태 동기화
          // 그룹 기준: 같은 담당자, 같은 시작일, 같은 비고
          // console.log('🔍 그룹핑 시작 - 총 장비:', initialMyDemos.length);

          const groupMap = new Map();

          initialMyDemos.forEach((demo, index) => {
            // 날짜 정규화 (YYYY/MM/DD 형식으로 통일)
            const normalizedStartDate = demo.startDate ? demo.startDate.toString().split('T')[0] : '';
            const groupKey = `${demo.assignee}_${normalizedStartDate}_${demo.memo || ''}`;

            // console.log(`  [${index}] ${demo.serial}: 담당자=${demo.assignee}, 시작일=${normalizedStartDate}, 비고=${demo.memo}, 제출=${demo.formSubmitted}, 그룹키=${groupKey}`);

            if (!groupMap.has(groupKey)) {
              groupMap.set(groupKey, []);
            }
            groupMap.get(groupKey).push(demo);
          });

          // console.log(`📦 생성된 그룹 수: ${groupMap.size}`);

          // 각 그룹에서 하나라도 제출 완료면 전체를 제출 완료로 처리
          groupMap.forEach((group, groupKey) => {
            const hasSubmitted = group.some(demo => demo.formSubmitted);
            const submittedDemo = group.find(demo => demo.formSubmitted);

            // console.log(`  📦 그룹 "${groupKey}": ${group.length}개 장비, 제출 완료=${hasSubmitted}`);

            if (hasSubmitted && submittedDemo) {
              // console.log(`    ✅ [그룹 제출 동기화] ${group.length}개 장비를 제출 완료로 처리, 파일 URL: ${submittedDemo.fileUrl}`);

              // 같은 그룹의 모든 장비를 제출 완료로 표시
              group.forEach(demo => {
                const wasPending = !demo.formSubmitted;
                demo.formSubmitted = true;
                demo.fileUrl = submittedDemo.fileUrl; // 같은 파일 URL 공유
                if (wasPending) {
                  // console.log(`      → ${demo.serial}: 제출 대기 → 제출 완료`);
                }
              });
            }
          });

          // 담당자 이름에서 괄호 이전만 추출하는 함수
          const getAssigneeBaseName = (assigneeName) => {
            if (!assigneeName) return '';
            const trimmed = assigneeName.toString().trim();
            const parenIndex = trimmed.indexOf('(');
            return parenIndex >= 0 ? trimmed.substring(0, parenIndex).trim() : trimmed;
          };

          // 모든 담당자별 데모 현황 생성
          // 먼저 담당자 이름을 괄호 이전만으로 그룹핑
          const assigneeBaseNameMap = new Map(); // baseName -> [원본 이름들]
          allEquipmentFromSheet.forEach(item => {
            const assignee = (item.assignee || item['대여담당자'] || '').toString().trim();
            if (assignee) {
              const baseName = getAssigneeBaseName(assignee);
              if (baseName) {
                if (!assigneeBaseNameMap.has(baseName)) {
                  assigneeBaseNameMap.set(baseName, []);
                }
                if (!assigneeBaseNameMap.get(baseName).includes(assignee)) {
                  assigneeBaseNameMap.get(baseName).push(assignee);
                }
              }
            }
          });

          // baseName으로 정렬된 담당자 목록 생성
          const assignees = Array.from(assigneeBaseNameMap.keys()).sort();
          const allAssigneeDemosData = {};

          assignees.forEach(baseName => {
            // 해당 baseName에 속하는 모든 원본 이름들
            const originalNames = assigneeBaseNameMap.get(baseName);

            // 각 담당자별 장비 필터링 (원본 이름들 모두 포함)
            const assigneeEquipments = allEquipmentFromSheet.filter(item => {
              const itemAssignee = (item.assignee || item['대여담당자'] || '').toString().trim();
              return originalNames.includes(itemAssignee);
            });

            // 시리얼넘버별로 최신 상태만 추출
            const latestEquipmentMap = new Map();
            [...assigneeEquipments].reverse().forEach((item) => {
              const serial = (item.serial || item.serialNumber || item['시리얼넘버'] || '').toString().trim();
              const status = (item.status || item['대여가능여부'] || '').toString().trim();

              if (!latestEquipmentMap.has(serial)) {
                latestEquipmentMap.set(serial, { item, status });
              }
            });

            // "대여신청" 또는 "대여중" 상태만 필터링 (GAS와 동일한 로직)
            const assigneeDemoData = [];

            latestEquipmentMap.forEach(({ item, status }, serial) => {
              // "대여신청" 또는 "대여중"인 경우만 추가 (GAS handleGetMyDemoData와 동일)
              if (status === '대여신청' || status === '대여중') {
                assigneeDemoData.push(item);
              }
            });

            // 데이터 변환
            const assigneeDemos = assigneeDemoData.map((item, index) => {
              const demo = {
                id: `${baseName}-${index}`,
                name: item.name || item['제품명'] || '',
                serial: item.serial || item.serialNumber || item['시리얼넘버'] || '',
                assignee: item.assignee || item['대여담당자'] || '',
                startDate: item.startDate || item['시작일'] || '',
                returnDate: item.endDate || item.returnDate || item['종료일'] || '',
                partnerName: item.partnerName || item['파트너명'] || '',
                partnerContact: item.partnerContact || item['파트너담당자명'] || '',
                partnerPhone: item.partnerPhone || '',
                userName: item.userName || item['사용자명'] || '',
                userContact: item.userContact || item['사용자담당자명'] || '',
                userPhone: item.userPhone || '',
                memo: item.memo || item['비고'] || '',
                formSubmitted: item.formSubmitted || false,
                fileUrl: item.fileUrl || item['신청양식제출'] || '',
                location: item.location || item['보관위치'] || '본사',
                status: item.status || item['대여가능여부'] || ''
              };
              return demo;
            });

            // 그룹핑 제거: 모든 항목을 개별적으로 표시 (검색 목록에서만 그룹핑 사용)
            allAssigneeDemosData[baseName] = assigneeDemos;
          });

          // 현재 사용자의 인덱스 찾기 (baseName으로 비교)
          const userBaseName = getAssigneeBaseName(userName);
          const currentUserIndex = assignees.findIndex(a => a === userBaseName);
          setCurrentAssigneeIndex(currentUserIndex >= 0 ? currentUserIndex : 0);

          setAllAssigneeDemos(allAssigneeDemosData);
          setMyDemos(initialMyDemos);
          setLoadingMyDemos(false); // 내 데모 현황 로딩 완료
          console.log(`✅ 내 데모 현황: ${initialMyDemos.length}건 (클라이언트 필터링)`);
          console.log(`✅ 전체 담당자 수: ${assignees.length}명`);

        } catch (error) {
          console.error('❌ Failed to load equipment data from sheet:', error);

          // Fallback to CSV if sheet fails
          try {
            console.log('⚠️ CSV 파일로 폴백...');

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
            console.log(`✅ CSV에서 내 데모 현황 로드: ${initialMyDemos.length}건`);

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
            console.log(`✅ CSV에서 장비 데이터 로드: ${allEquipmentFromSheet.length}건`);
          } catch (csvError) {
            console.error('❌ Failed to load CSV data as fallback:', csvError);
            allEquipmentFromSheet = [];
            setMyDemos([]);
          }
        }

        // 💾 캐시에 저장
        setCacheData(CACHE_KEYS.EQUIPMENT, allEquipmentFromSheet);

        // 🔄 전체 히스토리 데이터를 state에 저장
        setAllEquipmentFromSheet(allEquipmentFromSheet);

        // 🔄 변경사항 확인 및 업데이트
        if (cachedEquipment && cachedEquipment.length > 0) {
          const changes = findDataChanges(cachedEquipment, allEquipmentFromSheet, 'serial');
          if (changes.hasChanges) {
            // console.log('🆕 장비 데이터 변경사항 발견 - UI 업데이트');
            processEquipmentData(allEquipmentFromSheet, userName);
          } else {
            // console.log('✅ 장비 데이터 변경사항 없음');
          }
        } else {
          // 캐시가 없었으면 그냥 표시
          processEquipmentData(allEquipmentFromSheet, userName);
        }

        setLoadingEquipments(false); // 장비 목록 로딩 완료
        console.log('✅ 장비 데이터 처리 완료:', allEquipmentFromSheet.length, 'items');

        // Fetch partner data from Google Sheet instead of CSV
        let allPartnersFromSheet = [];
        try {
          // console.log('=== 파트너 데이터 로딩 시작 ===');
          const partnerData = await getPartnerData();
          // console.log('Raw partnerData response:', partnerData);
          // console.log('partnerData.data:', partnerData.data);
          // console.log('partnerData.data type:', typeof partnerData.data);
          // console.log('partnerData.data length:', partnerData.data ? partnerData.data.length : 'undefined');

          // GAS에서 이미 UI 형식으로 변환된 데이터 사용
          let rawPartnerData = partnerData.data || [];
          // console.log('Loaded partner data from sheet (raw):', rawPartnerData.length, 'items');

          // 🔄 중복 제거: companyName + contactPerson 조합이 같은 것 제거
          const uniquePartnersMap = new Map();
          rawPartnerData.forEach((partner) => {
            const companyName = (partner.companyName || '').trim();
            const contactPerson = (partner.contactPerson || '').trim();
            const uniqueKey = `${companyName}_${contactPerson}`;

            // 같은 조합이 없을 때만 추가
            if (!uniquePartnersMap.has(uniqueKey)) {
              uniquePartnersMap.set(uniqueKey, partner);
            } else {
              // console.log(`⚠️ [중복 제거] ${companyName} - ${contactPerson}`);
            }
          });

          allPartnersFromSheet = Array.from(uniquePartnersMap.values());
          console.log(`✅ 중복 제거 완료: ${rawPartnerData.length}건 → ${allPartnersFromSheet.length}건`);
        } catch (error) {
          console.error('❌ Failed to load partner data from sheet:', error);
          // Fallback to CSV if sheet fails
          try {
            const partnerResponse = await fetch('/파트너정보.csv');
            const partnerText = await partnerResponse.text();
            let parsedPartnerData = parsePartnerCsv(partnerText);

            // 🔄 중복 제거: companyName + contactPerson 조합이 같은 것 제거
            const uniquePartnersMap = new Map();
            parsedPartnerData.forEach((partner) => {
              const companyName = (partner.companyName || '').trim();
              const contactPerson = (partner.contactPerson || '').trim();
              const uniqueKey = `${companyName}_${contactPerson}`;

              if (!uniquePartnersMap.has(uniqueKey)) {
                uniquePartnersMap.set(uniqueKey, partner);
              }
            });

            allPartnersFromSheet = Array.from(uniquePartnersMap.values());
            console.log('✅ Fallback to CSV partner data (중복 제거):', parsedPartnerData.length, '→', allPartnersFromSheet.length, 'items');
          } catch (csvError) {
            console.error('❌ Failed to load CSV partner data as fallback:', csvError);
            allPartnersFromSheet = [];
          }
        }

        // 💾 캐시에 저장
        setCacheData(CACHE_KEYS.PARTNER, allPartnersFromSheet);

        // 🔄 변경사항 확인 및 업데이트
        if (cachedPartners && cachedPartners.length > 0) {
          const changes = findDataChanges(cachedPartners, allPartnersFromSheet, 'id');
          if (changes.hasChanges) {
            // console.log('🆕 파트너 데이터 변경사항 발견 - UI 업데이트');
            setAllPartners(allPartnersFromSheet);
          } else {
            // console.log('✅ 파트너 데이터 변경사항 없음');
          }
        } else {
          // 캐시가 없었으면 그냥 표시
          setAllPartners(allPartnersFromSheet);
        }

        setLoadingPartners(false); // 파트너 정보 로딩 완료
        console.log('✅ 파트너 데이터 처리 완료:', allPartnersFromSheet.length, 'items');

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.name, showInUseEquipment]); // sortEquipment는 존재하지 않는 함수

  // showInUseEquipment 변경 시 필터링 다시 적용
  useEffect(() => {
    if (allEquipments.length === 0) return;

    // console.log('🔄 showInUseEquipment 변경 감지 - 필터링 다시 적용');
    // console.log('showInUseEquipment:', showInUseEquipment);
    // console.log('allEquipments:', allEquipments.length);

    const newFiltered = allEquipments.filter(item => {
      if (showInUseEquipment) return true; // 사용중인 장비도 보기가 켜져있으면 모두 표시
      return isAvailableStatus(item.status); // 대여 가능한 장비만 표시
    });

    // console.log('필터링 결과:', newFiltered.length);
    setAvailableEquipments(newFiltered);
    setFilteredEquipments(newFiltered);
  }, [showInUseEquipment, allEquipments]);

  const handleSearch = useCallback((searchTerm) => {
    // console.log('Search term:', searchTerm);
    // console.log('Available equipments:', availableEquipments.length);
    // Use availableEquipments instead of allEquipments to avoid dependency issues
    const equipmentToFilter = availableEquipments;
    if (!searchTerm || searchTerm.trim() === '') {
      setFilteredEquipments(equipmentToFilter);
      // console.log('No search term, showing all available:', equipmentToFilter.length);
      return;
    }
    const filtered = equipmentToFilter.filter(eq =>
      eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eq.serial.toLowerCase().includes(searchTerm.toLowerCase())
    );
    // console.log('Filtered results:', filtered.length);
    setFilteredEquipments(filtered);
  }, [availableEquipments]);

  // 데모 선택/해제 핸들러
  const handleDemoToggle = (demo) => {
    setSelectedDemos(prev => {
      const isSelected = prev.some(d => d.id === demo.id);
      if (isSelected) {
        return prev.filter(d => d.id !== demo.id);
      } else {
        return [...prev, demo];
      }
    });
  };

  // 전체 선택/해제 핸들러
  const handleSelectAllDemos = () => {
    if (selectedDemos.length === myDemos.length) {
      setSelectedDemos([]);
    } else {
      setSelectedDemos([...myDemos]);
    }
  };

  // 일괄 반납 함수
  const handleBulkReturn = async () => {
    if (selectedDemos.length === 0) {
      alert('반납할 장비를 선택해주세요.');
      return;
    }

    if (!window.confirm(`선택한 ${selectedDemos.length}개의 장비를 반납하시겠습니까?`)) {
      return;
    }

    setIsReturning(true);
    setReturnLogs([]);
    const logs = [];

    const addLog = (message, type = 'info') => {
      const timestamp = new Date().toLocaleTimeString('ko-KR');
      const logEntry = { timestamp, message, type };
      logs.push(logEntry);
      setReturnLogs([...logs]);
    };

    console.log(`\n🚀 총 ${selectedDemos.length}개 장비 반납 시작...`);
    addLog(`총 ${selectedDemos.length}개 장비 반납 시작...`, 'info');

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < selectedDemos.length; i++) {
      const demo = selectedDemos[i];
      console.log(`\n🔄 [${i + 1}/${selectedDemos.length}] ${demo.name} (${demo.serial}) 반납 처리 중...`);
      addLog(`[${i + 1}/${selectedDemos.length}] ${demo.name} (${demo.serial}) 반납 처리 중...`, 'processing');

      try {
        // 전체 장비 데이터에서 해당 시리얼의 최신 대여 정보 찾기
        const matchingEquipments = allEquipments.filter(eq =>
          (eq.serial === demo.serial || eq.serialNumber === demo.serial)
        );
        console.log(`   매칭된 장비: ${matchingEquipments.length}개`);

        const fullEquipmentData = matchingEquipments
          .reverse()
          .find(eq => {
            const assignee = (eq.assignee || eq['대여담당자'] || '').toString().trim();
            const status = (eq.status || eq['대여가능여부'] || '').toString().trim();
            const isMyEquipment = assignee === user.name;
            const isActive = status === '대여신청' || status === '대여중' || status === '사용중';
            return isMyEquipment && isActive;
          });

        if (!fullEquipmentData) {
          console.error(`   ❌ ${demo.name} - 대여 정보를 찾을 수 없습니다.`);
          addLog(`  ❌ ${demo.name} - 대여 정보를 찾을 수 없습니다.`, 'error');
          failCount++;
          continue;
        }

        console.log(`   ✅ 최신 대여 정보 찾음:`, fullEquipmentData);

        // 반납할 장비 데이터 준비
        const equipmentDataToReturn = {
          serial: fullEquipmentData.serial || fullEquipmentData.serialNumber || demo.serial,
          serialNumber: fullEquipmentData.serial || fullEquipmentData.serialNumber || demo.serial,
          name: fullEquipmentData.name || fullEquipmentData['제품명'] || demo.name,
          tag: fullEquipmentData.tag || fullEquipmentData['Tag'] || '',
          location: fullEquipmentData.location || fullEquipmentData['보관위치'] || '본사',
          assignee: fullEquipmentData.assignee || fullEquipmentData['대여담당자'] || user.name,
          startDate: fullEquipmentData.startDate || fullEquipmentData['시작일'] || demo.startDate,
          returnDate: fullEquipmentData.endDate || fullEquipmentData.returnDate || fullEquipmentData['종료일'] || demo.returnDate,
          endDate: fullEquipmentData.endDate || fullEquipmentData.returnDate || fullEquipmentData['종료일'] || demo.returnDate,
          partnerName: fullEquipmentData.partnerName || fullEquipmentData['파트너명'] || '',
          partnerContact: fullEquipmentData.partnerContact || fullEquipmentData['파트너담당자명'] || '',
          partnerPhone: fullEquipmentData.partnerPhone || fullEquipmentData['휴대폰 번호'] || '',
          userName: fullEquipmentData.userName || fullEquipmentData['사용자명'] || '',
          userContact: fullEquipmentData.userContact || fullEquipmentData['사용자담당자명'] || '',
          userPhone: fullEquipmentData.userPhone || '',
          memo: fullEquipmentData.memo || fullEquipmentData['비고'] || ''
        };

        // Google Sheets에 반납 히스토리 추가
        console.log(`   📋 GAS로 전송할 데이터:`, equipmentDataToReturn);
        const result = await returnEquipment(equipmentDataToReturn);

        if (result.success) {
          console.log(`   ✅ ${demo.name} - 반납 완료`);
          addLog(`  ✅ ${demo.name} - 반납 완료`, 'success');
          successCount++;
        } else {
          console.error(`   ❌ ${demo.name} - 반납 실패:`, result.error || '알 수 없는 오류');
          addLog(`  ❌ ${demo.name} - 반납 실패: ${result.error || '알 수 없는 오류'}`, 'error');
          failCount++;
        }

      } catch (error) {
        console.error(`반납 처리 실패 (${demo.name}):`, error);
        addLog(`  ❌ ${demo.name} - 오류 발생: ${error.message}`, 'error');
        failCount++;
      }

      // 각 처리 사이에 짧은 딜레이 (과부하 방지)
      if (i < selectedDemos.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`\n✅ 반납 처리 완료! 성공: ${successCount}개, 실패: ${failCount}개`);
    addLog(`\n반납 처리 완료! 성공: ${successCount}개, 실패: ${failCount}개`, successCount > 0 ? 'success' : 'error');

    setIsReturning(false);

    if (successCount > 0) {
      // 성공한 경우 선택 초기화 및 페이지 새로고침
      setSelectedDemos([]);

      setTimeout(() => {
        alert(`✅ ${successCount}개 장비 반납이 완료되었습니다!${failCount > 0 ? `\n(실패: ${failCount}개)` : ''}\n페이지를 새로고침합니다.`);
        window.location.reload();
      }, 1000);
    } else {
      alert(`❌ 반납 처리에 실패했습니다. 로그를 확인해주세요.`);
    }
  };

  const handleReturn = async (demoId) => {
    if (window.confirm("반납 하시겠습니까?")) {
      // 현재 표시된 목록에서 장비 찾기 (내 담당자 또는 다른 담당자 목록)
      const assignees = Object.keys(allAssigneeDemos).sort();
      const currentAssignee = assignees[currentAssigneeIndex] || '';
      const currentDemos = currentAssignee ? (allAssigneeDemos[currentAssignee] || []) : myDemos;

      const returnedDemo = currentDemos.find(demo => demo.id === demoId) || myDemos.find(demo => demo.id === demoId);
      if (!returnedDemo) {
        alert("반납할 장비를 찾을 수 없습니다.");
        return;
      }

      // UI 로그 초기화
      setReturnLogs([]);
      const logs = [];
      const addLog = (message, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString('ko-KR');
        const logEntry = { timestamp, message, type };
        logs.push(logEntry);
        setReturnLogs([...logs]);
      };

      try {
        console.log('반납 처리 시작:', returnedDemo);
        addLog(`${returnedDemo.name} (${returnedDemo.serial}) 반납 처리 시작...`, 'processing');
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
          addLog('❌ 대여 중인 상세 정보를 찾을 수 없습니다!', 'error');
          alert('대여 정보를 찾을 수 없습니다. 새로고침 후 다시 시도해주세요.');
          return;
        }

        console.log('✅ 최신 대여 정보 찾음:', fullEquipmentData);
        addLog('✅ 최신 대여 정보 확인 완료', 'success');

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
        addLog('📋 시트에 반납 히스토리 추가 중...', 'processing');

        // Google Sheets에 반납 히스토리 추가
        const result = await returnEquipment(equipmentDataToReturn);

        if (result.success) {
          console.log('✅ 반납 처리 성공:', result);
          addLog(`✅ ${returnedDemo.name} 반납 완료!`, 'success');

          // 클라이언트 상태 업데이트
          // 1. 내 데모 목록에서 제거
          setMyDemos(prev => prev.filter(demo => demo.id !== demoId));

          // 2. 전체 장비 데이터 새로고침 (다음 로딩 시 반영)
          // 실시간 반영을 위해 상태만 업데이트 (서버 데이터는 다음 새로고침 시 반영)

          setTimeout(() => {
            alert(`✅ ${returnedDemo.name} 반납이 완료되었습니다!\n담당자에게 전달해주세요.`);
            // 페이지 새로고침으로 최신 데이터 반영
            window.location.reload();
          }, 1000);
        } else {
          addLog(`❌ 반납 실패: ${result.error || '알 수 없는 오류'}`, 'error');
          alert(`반납 처리에 실패했습니다: ${result.error || '알 수 없는 오류'}`);
        }

      } catch (error) {
        console.error('❌ 반납 처리 실패:', error);
        addLog(`❌ 오류 발생: ${error.message}`, 'error');
        alert(`반납 처리 중 오류가 발생했습니다: ${error.message}`);
      }
    }
  };

  const handleFormSubmit = async (demo) => {
    try {
      if (!demo) {
        alert('데모 정보를 찾을 수 없습니다.');
        return;
      }

      console.log('제출할 데모 정보:', demo);

      // 파일 선택 input 생성 (숨김)
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.pdf,.png,.jpg,.jpeg'; // PDF, PNG, JPG 파일만 허용
      fileInput.style.display = 'none';

      // 파일 선택 이벤트 리스너
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) {
          return;
        }

        console.log('선택된 파일:', file.name, file.type, file.size);

        // 파일 크기 확인 (10MB 제한)
        if (file.size > 10 * 1024 * 1024) {
          alert('파일 크기는 10MB 이하여야 합니다.');
          return;
        }

        // 파일 확장자 추출
        const fileExtension = file.name.split('.').pop();

        // 파일명 생성: 장비대여신청서_{대여담당자}_{시작일}_{파트너명}
        // 시트에서 직접 조회한 데이터 사용 (allEquipments에서 해당 장비 찾기)
        console.log('🔍 [파일명 생성] 검색 대상 시리얼:', demo.serial);
        console.log('🔍 [파일명 생성] 전체 장비 수:', allEquipments.length);
        console.log('🔍 [파일명 생성] 샘플 장비 데이터:', allEquipments[0]);

        const fullEquipmentData = allEquipments.find(eq => {
          const match = eq.serial === demo.serial ||
            eq.serialNumber === demo.serial ||
            eq['시리얼넘버'] === demo.serial ||
            eq.id === demo.id;
          if (match) {
            console.log('✅ [파일명 생성] 매칭된 장비:', eq);
          }
          return match;
        });

        if (!fullEquipmentData) {
          console.error('❌ [파일명 생성] 장비를 찾을 수 없습니다!');
          console.error('검색 조건:', {
            serial: demo.serial,
            id: demo.id,
            availableSerials: allEquipments.slice(0, 5).map(eq => ({
              serial: eq.serial,
              serialNumber: eq.serialNumber,
              '시리얼넘버': eq['시리얼넘버']
            }))
          });
        } else {
          console.log('✅ [파일명 생성] 시트에서 조회한 장비 데이터:', fullEquipmentData);
        }

        // 시트 데이터에서 파일명에 필요한 정보 추출
        const assignee = fullEquipmentData?.assignee || fullEquipmentData?.['대여담당자'] || user?.name || '담당자';
        const rawStartDate = fullEquipmentData?.startDate || fullEquipmentData?.['시작일'] || '';
        const partnerName = fullEquipmentData?.partnerName || fullEquipmentData?.['파트너명'] || '파트너미정';

        console.log('📝 [파일명 생성] 추출된 정보:', {
          assignee,
          rawStartDate,
          partnerName,
          '원본 partnerName 필드': fullEquipmentData?.partnerName,
          '원본 파트너명 필드': fullEquipmentData?.['파트너명'],
          '전체 필드 목록': fullEquipmentData ? Object.keys(fullEquipmentData) : '없음'
        });

        // 날짜를 YYYYMMDD 형식으로 변환 (시트 원본 데이터 그대로 사용)
        let startDateFormatted = '';
        if (rawStartDate) {
          const dateStr = rawStartDate.toString();
          // 모든 구분자 제거하고 숫자만 추출 (YYYY/MM/DD -> YYYYMMDD)
          startDateFormatted = dateStr.replace(/[^\d]/g, '').slice(0, 8);
        } else {
          // 시작일이 없으면 오늘 날짜 사용
          const today = new Date();
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const day = String(today.getDate()).padStart(2, '0');
          startDateFormatted = `${year}${month}${day}`;
        }

        const newFileName = `장비대여신청서_${assignee}_${startDateFormatted}_${partnerName}.${fileExtension}`;

        console.log('생성된 파일명:', newFileName);

        // 업로드 확인
        if (!window.confirm(`다음 파일을 업로드하시겠습니까?\n\n파일명: ${newFileName}\n크기: ${(file.size / 1024).toFixed(2)} KB`)) {
          return;
        }

        try {
          // 로딩 표시
          alert('파일을 업로드하는 중입니다. 잠시만 기다려주세요...');

          // 파일 업로드
          const result = await uploadFile(file, newFileName);

          console.log('업로드 결과:', result);

          if (result.success) {
            // 시트에 제출 상태 업데이트
            try {
              const updateResult = await updateFormSubmission(demo.serial, result.fileUrl);
              console.log('시트 업데이트 결과:', updateResult);

              // 성공 시 로컬 상태 업데이트 (모든 리스트 동기화)
              const updateDemoInList = (list) => list.map(d =>
                d.serial === demo.serial ? { ...d, formSubmitted: true, fileUrl: result.fileUrl } : d
              );

              setMyDemos(prev => updateDemoInList(prev));

              setAllAssigneeDemos(prev => {
                const newMap = { ...prev };
                Object.keys(newMap).forEach(assignee => {
                  newMap[assignee] = updateDemoInList(newMap[assignee]);
                });
                return newMap;
              });

              alert(`✅ 파일이 성공적으로 업로드되었습니다!\n\n파일명: ${result.fileName}\n\n시트에 제출 상태가 기록되었습니다.\n\nGoogle Drive에서 확인하세요:\n${result.fileUrl}`);
            } catch (updateError) {
              console.error('시트 업데이트 실패:', updateError);
              // 파일은 업로드되었지만 시트 업데이트 실패
              alert(`⚠️ 파일은 업로드되었으나 시트 업데이트에 실패했습니다.\n\n파일: ${result.fileName}\n오류: ${updateError.message}\n\n관리자에게 문의하세요.`);
            }
          } else {
            throw new Error('업로드에 실패했습니다.');
          }
        } catch (error) {
          console.error('파일 업로드 실패:', error);
          alert(`파일 업로드 중 오류가 발생했습니다:\n${error.message}`);
        } finally {
          // input 엘리먼트 제거
          document.body.removeChild(fileInput);
        }
      });

      // input을 DOM에 추가하고 클릭
      document.body.appendChild(fileInput);
      fileInput.click();

    } catch (error) {
      console.error('handleFormSubmit 오류:', error);
      alert(`오류가 발생했습니다: ${error.message}`);
    }
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
    const newAvailable = updatedAllEquipments.filter(item => {
      if (showInUseEquipment) return true;
      return isAvailableStatus(item.status);
    });
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

  // 스크롤 이벤트 감지하여 내 데모 현황 자동 접기 및 신청 폼 상태 변경
  useEffect(() => {
    const scrollableArea = scrollableAreaRef.current;
    if (!scrollableArea) return;

    const handleScroll = () => {
      const scrollTop = scrollableArea.scrollTop;
      const scrollThreshold = 50; // 50px 스크롤 시 내 데모 현황 접기

      // 내 데모 현황 자동 접기
      if (scrollTop > scrollThreshold && !isMyDemosFolded) {
        setIsMyDemosFolded(true);
      }

      // 신청 폼 상태 변경 (스크롤 방향 감지)
      if (selectedEquipments.length > 0 && showApplicationForm) {
        const currentScrollTop = scrollTop;
        const scrollDelta = Math.abs(currentScrollTop - lastScrollTopRef.current);

        // 의미있는 스크롤인지 확인 (최소 10px 이상)
        if (scrollDelta > 10) {
          lastScrollTopRef.current = currentScrollTop;
          scrollCountRef.current += 1;

          console.log('Scroll count:', scrollCountRef.current);

          // 1회 스크롤: 살짝 줄이기
          if (scrollCountRef.current === 1 && applicationFormState === 'expanded') {
            setApplicationFormState('compact');
            console.log('Form state: compact');
          }
          // 3회 이상 스크롤: 완전히 접기
          else if (scrollCountRef.current >= 3 && applicationFormState !== 'folded') {
            setApplicationFormState('folded');
            console.log('Form state: folded');
          }
        }
      }
    };

    scrollableArea.addEventListener('scroll', handleScroll);

    return () => {
      scrollableArea.removeEventListener('scroll', handleScroll);
    };
  }, [isMyDemosFolded, selectedEquipments.length, showApplicationForm, applicationFormState]); // 의존성 추가

  // 장비 선택이 변경되면 스크롤 카운터와 폼 상태 초기화
  useEffect(() => {
    if (selectedEquipments.length === 0) {
      scrollCountRef.current = 0;
      lastScrollTopRef.current = 0;
      setApplicationFormState('folded');
    } else if (selectedEquipments.length > 0 && applicationFormState === 'folded' && scrollCountRef.current === 0) {
      // 최초 장비 선택 시 '접기' 상태로 시작
      setApplicationFormState('folded');
    }
  }, [selectedEquipments.length, applicationFormState]);

  // 하단 영역 스크롤/터치 이벤트로 확대 및 접기
  useEffect(() => {
    const bottomArea = bottomFixedAreaRef.current;
    if (!bottomArea) {
      console.log('[useEffect] bottomArea not found, skipping event listener setup');
      return;
    }

    console.log('[useEffect] Setting up event listeners for bottom area');

    let touchStartY = 0;

    const handleBottomScroll = () => {
      const scrollTop = bottomArea.scrollTop;

      // 접힌 상태이거나 축소 상태일 때만 확대
      if (applicationFormState === 'folded') {
        setApplicationFormState('compact');
        setIsBottomAreaExpanded(false); // 확장 상태 초기화
        console.log('Bottom area scrolled: folded → compact');
      } else if (applicationFormState === 'compact') {
        setApplicationFormState('expanded');
        setIsBottomAreaExpanded(false); // 확장 상태 초기화
        console.log('Bottom area scrolled: compact → expanded');
      } else if (applicationFormState === 'expanded') {
        // expanded 상태에서만 스크롤 위치에 따라 높이 확장
        if (scrollTop >= 30 && !isBottomAreaExpanded) {
          setIsBottomAreaExpanded(true);
          console.log('Bottom area: expanded to 77vh (scrollTop >= 30px)');
          // 전체 페이지를 맨 아래로 스크롤
          setTimeout(() => {
            window.scrollTo({
              top: document.documentElement.scrollHeight,
              behavior: 'smooth'
            });
          }, 50);
        } else if (scrollTop < 30 && isBottomAreaExpanded) {
          setIsBottomAreaExpanded(false);
          console.log('Bottom area: back to normal height');
        }
      }
    };

    // 클릭 이벤트로 접힌/축소 상태 확대 (모바일 터치 대응)
    const handleClick = (e) => {
      // 버튼 클릭은 제외
      if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
        return;
      }

      if (applicationFormState === 'folded') {
        setApplicationFormState('compact');
        console.log('Bottom area clicked: folded → compact');
      } else if (applicationFormState === 'compact') {
        setApplicationFormState('expanded');
        console.log('Bottom area clicked: compact → expanded');
      }
    };

    // 맨 위에서 위로 스크롤 시도 시 접기 (마우스 휠 - 오버스크롤)
    const handleWheel = (e) => {
      const scrollTop = bottomArea.scrollTop;
      const isAtTop = scrollTop === 0;
      const isScrollingUp = e.deltaY < 0; // 음수 = 위로 스크롤하려는 시도

      // 맨 위에서 위로 더 스크롤하려고 하면 접기
      if (isAtTop && isScrollingUp && applicationFormState !== 'folded') {
        e.preventDefault();
        setApplicationFormState('folded');
        scrollCountRef.current = 3;
        console.log('Bottom area: overscroll at top → folded');
      }
    };

    // 터치 이벤트 - 스와이프 감지
    const handleTouchStart = (e) => {
      touchStartY = e.touches[0].clientY;
      isProcessingRef.current = false;
      stateChangedRef.current = false;
      console.log(`[Touch Start] Y: ${touchStartY}, State: ${applicationFormState}`);
    };

    const handleTouchMove = (e) => {
      if (isProcessingRef.current || stateChangedRef.current) {
        console.log('[Touch Move] Blocked - processing or already changed');
        return;
      }

      const scrollTop = bottomArea.scrollTop;
      const isAtTop = scrollTop === 0;
      const touchCurrentY = e.touches[0].clientY;
      const touchDelta = touchCurrentY - touchStartY;
      const isSwipingUp = touchDelta < 0; // 음수 = 위로 스와이프
      const isSwipingDown = touchDelta > 0; // 양수 = 아래로 스와이프
      const swipeDistance = Math.abs(touchDelta);

      console.log(`[Touch Move] Delta: ${touchDelta}, Distance: ${swipeDistance}, Direction: ${isSwipingUp ? 'UP' : 'DOWN'}, State: ${applicationFormState}`);

      // 위로 스와이프: 접힌/축소 상태일 때 확대
      if (isSwipingUp && swipeDistance > 20 && !stateChangedRef.current) {
        if (applicationFormState === 'folded') {
          isProcessingRef.current = true;
          stateChangedRef.current = true;
          setApplicationFormState('compact');
          console.log('✅ Bottom area: swipe up → folded to compact');
          setTimeout(() => { isProcessingRef.current = false; }, 300);
        } else if (applicationFormState === 'compact') {
          isProcessingRef.current = true;
          stateChangedRef.current = true;
          setApplicationFormState('expanded');
          console.log('✅ Bottom area: swipe up → compact to expanded');
          setTimeout(() => { isProcessingRef.current = false; }, 300);
        }
      }

      // 아래로 스와이프: 맨 위에서 아래로 스와이프 시 접기 (접힌 상태가 아닐 때)
      else if (isAtTop && isSwipingDown && swipeDistance > 40 && applicationFormState !== 'folded' && !stateChangedRef.current) {
        isProcessingRef.current = true;
        stateChangedRef.current = true;
        setApplicationFormState('folded');
        scrollCountRef.current = 3;
        console.log('Bottom area: swipe down from top → folded');
        setTimeout(() => { isProcessingRef.current = false; }, 300);
      }
    };

    const handleTouchEnd = () => {
      // 터치 종료 시 플래그 리셋
      isProcessingRef.current = false;
      stateChangedRef.current = false;
    };

    bottomArea.addEventListener('click', handleClick);
    bottomArea.addEventListener('scroll', handleBottomScroll);
    bottomArea.addEventListener('wheel', handleWheel, { passive: false });
    bottomArea.addEventListener('touchstart', handleTouchStart, { passive: true });
    bottomArea.addEventListener('touchmove', handleTouchMove, { passive: true });
    bottomArea.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      bottomArea.removeEventListener('click', handleClick);
      bottomArea.removeEventListener('scroll', handleBottomScroll);
      bottomArea.removeEventListener('wheel', handleWheel);
      bottomArea.removeEventListener('touchstart', handleTouchStart);
      bottomArea.removeEventListener('touchmove', handleTouchMove);
      bottomArea.removeEventListener('touchend', handleTouchEnd);
      console.log('[useEffect] Cleaned up event listeners');
    };
  }, [applicationFormState, isBottomAreaExpanded, selectedEquipments.length, showApplicationForm]);

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

  // 파트너명 툴팁 컴포넌트
  const PartnerTooltip = ({ partnerName, partnerContact, partnerPhone, userName, userContact, userPhone, memo }) => {
    const [tooltipStyle, setTooltipStyle] = useState({});
    const [isTooltipAbove, setIsTooltipAbove] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const containerRef = useRef(null);
    const tooltipRef = useRef(null);

    // 툴팁 위치 계산 함수
    const calculateTooltipPosition = useCallback(() => {
      if (!containerRef.current || !tooltipRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      // 기본적으로 아래쪽에 표시
      let top = containerRect.bottom + 8;
      let left = containerRect.left + containerRect.width / 2;
      let tooltipAbove = false;

      // 아래쪽이 잘리면 위쪽에 표시
      if (top + tooltipRect.height > viewportHeight) {
        top = containerRect.top - tooltipRect.height - 8;
        tooltipAbove = true;
      }

      // 위쪽이 잘리면 다시 아래쪽에 표시
      if (top < 0) {
        top = containerRect.bottom + 8;
        tooltipAbove = false;
      }

      // 왼쪽이 잘리면 조정
      if (left - tooltipRect.width / 2 < 0) {
        left = tooltipRect.width / 2 + 10;
      }

      // 오른쪽이 잘리면 조정
      if (left + tooltipRect.width / 2 > viewportWidth) {
        left = viewportWidth - tooltipRect.width / 2 - 10;
      }

      setIsTooltipAbove(tooltipAbove);
      setTooltipStyle({
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        transform: 'translateX(-50%)',
        opacity: 1
      });
    }, []);

    // 툴팁 위치 계산 및 표시
    const showTooltip = () => {
      if (!containerRef.current) return;

      // 먼저 isVisible을 true로 설정하여 툴팁을 렌더링
      setIsVisible(true);

      // 먼저 툴팁을 보이지 않게 렌더링 (높이 계산을 위해)
      setTooltipStyle({
        position: 'fixed',
        top: '-9999px',
        left: '-9999px',
        transform: 'translateX(-50%)',
        opacity: 0
      });
    };

    // isVisible이 true가 되면 위치 계산
    useEffect(() => {
      if (!isVisible) return;

      // 툴팁이 렌더링된 후 위치 계산
      const timer = setTimeout(() => {
        calculateTooltipPosition();
      }, 10);

      return () => clearTimeout(timer);
    }, [isVisible, calculateTooltipPosition]);

    const hideTooltip = useCallback(() => {
      setTooltipStyle({
        opacity: 0
      });
      setIsVisible(false);
    }, []);

    const handleClick = (e) => {
      e.stopPropagation();
      if (isVisible) {
        hideTooltip();
      } else {
        showTooltip();
      }
    };

    // 외부 클릭 감지
    useEffect(() => {
      if (!isVisible) return;

      const handleClickOutside = (event) => {
        if (
          containerRef.current &&
          tooltipRef.current &&
          !containerRef.current.contains(event.target) &&
          !tooltipRef.current.contains(event.target)
        ) {
          hideTooltip();
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('touchstart', handleClickOutside);
      };
    }, [isVisible, hideTooltip]);

    return (
      <div
        className={styles.partnerTooltipContainer}
        ref={containerRef}
      >
        <span
          className={styles.partnerNameText}
          onClick={handleClick}
          style={{ cursor: 'pointer' }}
        >
          {partnerName}
        </span>
        {isVisible && (
          <div
            className={`${styles.partnerTooltip} ${isTooltipAbove ? styles.tooltipAbove : styles.tooltipBelow}`}
            ref={tooltipRef}
            style={tooltipStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.tooltipRow}>
              <span className={styles.tooltipLabel}>파트너명:</span>
              <span className={styles.tooltipValue}>{partnerName || '-'}</span>
            </div>
            <div className={styles.tooltipRow}>
              <span className={styles.tooltipLabel}>파트너 담당자명:</span>
              <span className={styles.tooltipValue}>{partnerContact || '-'}</span>
            </div>
            <div className={styles.tooltipRow}>
              <span className={styles.tooltipLabel}>파트너 휴대폰 번호:</span>
              <span className={styles.tooltipValue}>{partnerPhone || '-'}</span>
            </div>
            <div className={styles.tooltipRow}>
              <span className={styles.tooltipLabel}>사용자명:</span>
              <span className={styles.tooltipValue}>{userName || '-'}</span>
            </div>
            <div className={styles.tooltipRow}>
              <span className={styles.tooltipLabel}>사용자 담당자명:</span>
              <span className={styles.tooltipValue}>{userContact || '-'}</span>
            </div>
            <div className={styles.tooltipRow}>
              <span className={styles.tooltipLabel}>사용자 휴대폰 번호:</span>
              <span className={styles.tooltipValue}>{userPhone || '-'}</span>
            </div>
            <div className={styles.tooltipRow}>
              <span className={styles.tooltipLabel}>비고:</span>
              <span className={styles.tooltipValue}>{memo || '-'}</span>
            </div>
            <button
              className={styles.tooltipCloseButton}
              onClick={hideTooltip}
              aria-label="닫기"
            >
              ×
            </button>
          </div>
        )}
      </div>
    );
  };

  const MyDemoList = ({ demos, onReturn, selectedDemos, onDemoToggle, onSelectAll, isCurrentUser = true }) => {
    const isOverdue = (returnDate) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // 시간은 비교에서 제외
      const parsedReturnDate = parseDateString(returnDate);
      return parsedReturnDate && parsedReturnDate < today;
    };

    // 화면 크기 확인 (모바일: 600px 이하, 태블릿: 720px 이하)
    const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 600);
    const [isTablet, setIsTablet] = React.useState(window.innerWidth <= 720 && window.innerWidth > 600);

    React.useEffect(() => {
      const handleResize = () => {
        setIsMobile(window.innerWidth <= 600);
        setIsTablet(window.innerWidth <= 720 && window.innerWidth > 600);
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);

    // 날짜 포맷 (모바일: MM/DD, 웹: YYYY/MM/DD)
    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      const formatted = formatDateToYYYYMMDD(dateStr);
      if (isMobile && formatted) {
        // YYYY/MM/DD -> MM/DD
        const parts = formatted.split('/');
        if (parts.length === 3) {
          return `${parts[1]}/${parts[2]}`;
        }
      }
      return formatted;
    };

    const allSelected = demos.length > 0 && selectedDemos.length === demos.length;

    return (
      <table>
        <thead>
          <tr>
            <th style={{ width: '40px', textAlign: 'center' }}>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onSelectAll}
                className={styles.equipmentCheckbox}
                title="전체 선택"
              />
            </th>
            <th>{isMobile ? '장비' : (isTablet ? '장비' : '장비명')}</th>
            <th>{isMobile ? '시리얼' : (isTablet ? '시리얼' : '시리얼 넘버')}</th>
            <th>{isMobile ? '시작일' : (isTablet ? '시작일' : '대여 시작일')}</th>
            <th>{isMobile ? '반납일' : (isTablet ? '반납일' : '반납 예정일')}</th>
            <th>{isMobile ? '파트너' : (isTablet ? '파트너' : '파트너명')}</th>
            <th>{isMobile ? '양식' : (isTablet ? '양식' : '신청 양식')}</th>
            <th>{isMobile ? '관리' : '관리'}</th>
          </tr>
        </thead>
        <tbody>
          {demos.map((demo) => {
            const isSelected = selectedDemos.some(d => d.id === demo.id);
            return (
              <tr key={demo.id}>
                <td style={{ textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onDemoToggle(demo)}
                    className={styles.equipmentCheckbox}
                  />
                </td>
                <td data-label="장비명">{demo.name}</td>
                <td data-label="시리얼 넘버">{demo.serial}</td>
                <td data-label="대여 시작일">{formatDate(demo.startDate)}</td>
                <td data-label="반납 예정일" className={isOverdue(demo.returnDate) ? styles.overdue : ''}>
                  {formatDate(demo.returnDate)}
                  {isOverdue(demo.returnDate) && <span className={styles.overdueText}>(반납일 초과)</span>}
                </td>
                <td data-label="파트너명" className={styles.partnerNameCell}>
                  {demo.partnerName ? (
                    <PartnerTooltip
                      partnerName={demo.partnerName}
                      partnerContact={demo.partnerContact}
                      partnerPhone={demo.partnerPhone}
                      userName={demo.userName || demo.assignee}
                      userContact={demo.userContact}
                      userPhone={demo.userPhone}
                      memo={demo.memo}
                    />
                  ) : '-'}
                </td>
                <td data-label="신청 양식">
                  {demo.formSubmitted ? (isMobile ? '완료' : (isTablet ? '완료' : '제출 완료')) : (
                    <button onClick={() => handleFormSubmit(demo)} className="button-primary">
                      {isMobile ? '제출' : (isTablet ? '제출' : '제출하기')}
                    </button>
                  )}
                </td>
                <td data-label="관리">
                  {isCurrentUser && (
                    <button onClick={() => onReturn(demo.id)} className="button-secondary">
                      {isMobile ? '반납' : (isTablet ? '반납' : '반납하기')}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
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


    const handleDownloadPng = async (e) => {
      e.preventDefault(); // Prevent default form submission behavior
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

      // Set loading state for PNG export
      setIsExportingToPng(true);
      setProcessMessage('🚀 데모 신청 처리를 시작합니다...');

      try {
        console.log("MultiEquipmentApplicationForm: Initiating PNG export workflow.");

        setProcessMessage('🔧 Google API 초기화 중...');
        // Initialize Google APIs (simplified for Apps Script)
        await initGoogleApis();

        // For Apps Script mode, we don't need real access token
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
          // 실패해도 계속 진행 (복제 워크플로우)
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

          // Clear auth data if there's an authentication error
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

          // Generate Google Sheets URL
          const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${newSpreadsheetId}/edit`;
          setCreatedSpreadsheetUrl(spreadsheetUrl);

          console.log('✅ 스프레드시트 생성 및 업데이트 완료!');
          console.log('📄 스프레드시트 URL:', spreadsheetUrl);
          console.log('📋 스프레드시트 ID:', newSpreadsheetId);
          setProcessMessage('✅ 신청 정보 입력 완료!');

          // 스프레드시트 URL을 클립보드에 복사
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

          // Clear auth data if there's an authentication error
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

        // ===== PDF 변환 추가 =====
        let pdfFileUrl = null;
        try {
          setProcessMessage('📄 PDF 변환 중...');
          logOperation('exportToPdf', { spreadsheetId: newSpreadsheetId, fileName: newSpreadsheetTitle });

          const pdfResult = await exportGoogleSheetToPdfAndConvertToJpg(
            accessToken,
            newSpreadsheetId,
            TEMPLATE_SHEET_GID,
            newSpreadsheetTitle
          );

          console.log('=== PDF Export 응답 상세 ===');
          console.log('전체 응답:', pdfResult);
          console.log('success:', pdfResult?.success);
          console.log('fileId:', pdfResult?.fileId);
          console.log('fileUrl:', pdfResult?.fileUrl);
          console.log('fileName:', pdfResult?.fileName);
          console.log('pdfUrl:', pdfResult?.pdfUrl);
          console.log('error:', pdfResult?.error);

          if (pdfResult && pdfResult.success && pdfResult.fileId && pdfResult.fileUrl) {
            const pdfDownloadUrl = pdfResult.pdfUrl || pdfResult.fileUrl;

            setCreatedPdfUrl(pdfFileUrl); // PDF URL을 state에 저장
            setCreatedPdfDownloadUrl(pdfDownloadUrl); // PDF 다운로드 URL 저장

            logOperation('exportToPdf', {
              success: true,
              fileId: pdfResult.fileId,
              fileUrl: pdfResult.fileUrl,
              downloadUrl: pdfDownloadUrl,
              actualSheetGid: pdfResult.actualSheetGid
            });
            console.log('✅ PDF 변환 완료!');
            console.log('📄 PDF URL:', pdfFileUrl);
            console.log('📥 PDF 다운로드 URL:', pdfDownloadUrl);
            console.log('📋 실제 시트 GID:', pdfResult.actualSheetGid);
            setProcessMessage('✅ PDF 변환 완료!');
          } else {
            // pdfResult에 에러가 있으면 상세 로그
            if (pdfResult && pdfResult.error) {
              console.error('=== PDF 변환 서버 에러 ===');
              console.error('에러:', pdfResult.error);
              console.error('에러 이름:', pdfResult.errorName);
              console.error('에러 메시지:', pdfResult.errorMessage);
              if (pdfResult.stack) {
                console.error('스택 트레이스:', pdfResult.stack);
              }
              throw new Error(`PDF export failed: ${pdfResult.errorMessage || pdfResult.error}`);
            } else {
              console.error('PDF 결과 없음:', pdfResult);
              throw new Error("PDF export failed - no valid result returned");
            }
          }
        } catch (pdfError) {
          logOperation('exportToPdf', { success: false, error: pdfError.message }, 'error');
          console.error('=== ⚠️ PDF 변환 실패 (신청은 완료됨) ===');
          console.error('에러:', pdfError);
          console.error('에러 메시지:', pdfError.message);
          console.error('에러 스택:', pdfError.stack);
          setProcessMessage('⚠️ PDF 변환 실패 (신청은 완료됨)');
          // PDF 변환 실패해도 신청은 완료된 것으로 간주
        }

        // ===== 워크플로우 완료 =====
        const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${newSpreadsheetId}/edit`;
        console.log('🎉 전체 워크플로우 완료!');
        console.log('📄 생성된 스프레드시트:', spreadsheetUrl);
        console.log('📄 스프레드시트 제목:', newSpreadsheetTitle);
        if (pdfFileUrl) {
          console.log('📄 생성된 PDF:', pdfFileUrl);
        }

        setProcessMessage('🎉 데모 신청이 완료되었습니다!');

        // 최종 완료 메시지 (간단하게)
        alert('🎉 모든 작업이 완료되었습니다!');

      } catch (error) {
        logOperation('workflowError', { error: error.message }, 'error');

        // Clear auth data if there's an authentication error
        if (error.message.includes('Authentication') || error.message.includes('token')) {
          clearAuthData();
        }

        setProcessMessage('');
        alert(`❌ 전체 워크플로우 중 오류 발생: ${getUserFriendlyErrorMessage(error)}`);
      } finally {
        // Reset loading state
        setIsExportingToPng(false);
        // processMessage는 유지 (사용자가 확인할 수 있도록)
        setTimeout(() => setProcessMessage(''), 3000); // 3초 후 메시지 제거
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

                    // 클립보드에서 텍스트 읽기
                    if (navigator.clipboard && navigator.clipboard.readText) {
                      clipboardText = await navigator.clipboard.readText();
                    } else {
                      // 폴백: prompt 사용
                      clipboardText = prompt('클립보드 내용을 붙여넣으세요:');
                      if (!clipboardText) return;
                    }

                    console.log('클립보드 내용:', clipboardText);

                    // 파트너 정보 파싱
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
                      // 체크 시 사용처 정보 초기화
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

                    // 클립보드에서 텍스트 읽기
                    if (navigator.clipboard && navigator.clipboard.readText) {
                      clipboardText = await navigator.clipboard.readText();
                    } else {
                      // 폴백: prompt 사용
                      clipboardText = prompt('클립보드 내용을 붙여넣으세요:');
                      if (!clipboardText) return;
                    }

                    console.log('클립보드 내용:', clipboardText);

                    // 사용처 정보 파싱
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
            <div className={styles.formField}><label>사용처 사업자번호 :</label><input type="text" name="usageBusinessNumber" value={formData.usageBusinessNumber} onChange={handleChange} disabled={skipUsageInfo} style={{ width: '150px', backgroundColor: skipUsageInfo ? '#f0f0f0' : 'white' }} /></div>
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
            <div className={styles.formField}><label>사용처 담당자 연락처 *(필수) :</label><input type="text" name="usageContactNumber" value={formData.usageContactNumber} onChange={handleChange} required disabled={skipUsageInfo} style={{ width: '150px', backgroundColor: skipUsageInfo ? '#f0f0f0' : 'white' }} /></div>
            <div className={styles.formFieldFullWidth}><label>사용처 주소 *(필수) :</label><input type="text" name="usageAddress" value={formData.usageAddress} onChange={handleChange} required disabled={skipUsageInfo} placeholder="" style={{ width: '500px', backgroundColor: skipUsageInfo ? '#f0f0f0' : 'white' }} /></div>
          </div>
        </div>

        <div className={styles.formActions}>
          {/* 테스트 버튼들 (주석처리 - 개발 완료) */}
          {/* 
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
          */}

          {/* 실시간 처리 메시지 표시 */}
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
            <button onClick={onCancel} className="button-secondary">취소</button>
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
                  onClick={() => {
                    const downloadUrl = createdPdfDownloadUrl || createdPdfUrl;
                    window.open(downloadUrl, '_blank');
                  }}
                  className={styles.spreadsheetResultButton}
                >
                  📥 다운로드
                </button>
                <button
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

  // MainPage component return statement
  return (
    <div className={styles.container}>
      {!isMyDemosFolded && <Header user={user} onLogout={onLogout} />}

      <div className={styles.mainContent}>
        {/* 고정 영역 1: 내 데모 현황 */}
        <div
          ref={myDemoSectionRef}
          className={`${styles.fixedArea} ${styles.section} ${styles.myDemoSection} ${isMyDemosFolded ? styles.folded : ''}`}
        >
          <div className={styles.sectionHeaderWithButton}>
            <h2>
              {(() => {
                const assignees = Object.keys(allAssigneeDemos).sort();
                const currentAssignee = assignees[currentAssigneeIndex] || '';
                const userName = (user.name === '테스트사용자' || user.name === 'test') ? '홍길동' : user.name;
                const getAssigneeBaseName = (name) => {
                  if (!name) return '';
                  const trimmed = name.toString().trim();
                  const parenIndex = trimmed.indexOf('(');
                  return parenIndex >= 0 ? trimmed.substring(0, parenIndex).trim() : trimmed;
                };
                const userBaseName = getAssigneeBaseName(userName);
                const isCurrentUser = currentAssignee === userBaseName;
                return isCurrentUser ? '내 데모 현황' : `${currentAssignee}님의 데모 현황`;
              })()}
            </h2>
            <button
              onClick={() => setIsMyDemosFolded(!isMyDemosFolded)}
              className={styles.foldButtonInline}
            >
              {isMyDemosFolded ? '▼ 펼치기' : '▲ 접기'}
            </button>
          </div>
          {!isMyDemosFolded && (
            <>
              {/* 담당자 선택 버튼 영역 */}
              {Object.keys(allAssigneeDemos).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                  {Object.keys(allAssigneeDemos).sort().map((assignee, index) => {
                    const userName = (user.name === '테스트사용자' || user.name === 'test') ? '홍길동' : user.name;
                    const getAssigneeBaseName = (name) => {
                      if (!name) return '';
                      const trimmed = name.toString().trim();
                      const parenIndex = trimmed.indexOf('(');
                      return parenIndex >= 0 ? trimmed.substring(0, parenIndex).trim() : trimmed;
                    };
                    const userBaseName = getAssigneeBaseName(userName);
                    const isCurrentUser = assignee === userBaseName;
                    const isSelected = currentAssigneeIndex === index;

                    return (
                      <button
                        key={assignee}
                        onClick={() => setCurrentAssigneeIndex(index)}
                        className={`${styles.assigneeButton} ${isSelected ? styles.assigneeButtonActive : ''}`}
                        style={{
                          backgroundColor: isSelected ? '#4caf50' : '#ffffff',
                          color: isSelected ? '#ffffff' : '#495057',
                          border: `1px solid ${isSelected ? '#4caf50' : '#dee2e6'}`,
                          fontWeight: isSelected ? '600' : '400'
                        }}
                      >
                        {isCurrentUser ? '내 현황' : assignee}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className={styles.tableContainer}>
                {loadingMyDemos ? (
                  <SkeletonMyDemoTable rows={3} />
                ) : (() => {
                  const assignees = Object.keys(allAssigneeDemos).sort();
                  const currentAssignee = assignees[currentAssigneeIndex] || '';
                  const currentDemos = currentAssignee ? (allAssigneeDemos[currentAssignee] || []) : myDemos;
                  const userName = (user.name === '테스트사용자' || user.name === 'test') ? '홍길동' : user.name;
                  const getAssigneeBaseName = (name) => {
                    if (!name) return '';
                    const trimmed = name.toString().trim();
                    const parenIndex = trimmed.indexOf('(');
                    return parenIndex >= 0 ? trimmed.substring(0, parenIndex).trim() : trimmed;
                  };
                  const userBaseName = getAssigneeBaseName(userName);
                  const isCurrentUser = currentAssignee === userBaseName || !currentAssignee;

                  return currentDemos.length > 0 ? (
                    <MyDemoList
                      demos={currentDemos}
                      onReturn={handleReturn}
                      selectedDemos={selectedDemos}
                      onDemoToggle={handleDemoToggle}
                      onSelectAll={handleSelectAllDemos}
                      isCurrentUser={isCurrentUser}
                    />
                  ) : (
                    <p className={styles.noData}>현재 대여 중인 장비가 없습니다.</p>
                  );
                })()}
              </div>

              {/* 일괄 반납 버튼 */}
              {(() => {
                const assignees = Object.keys(allAssigneeDemos).sort();
                const currentAssignee = assignees[currentAssigneeIndex] || '';
                const currentDemos = currentAssignee ? (allAssigneeDemos[currentAssignee] || []) : myDemos;
                const userName = (user.name === '테스트사용자' || user.name === 'test') ? '홍길동' : user.name;
                const getAssigneeBaseName = (name) => {
                  if (!name) return '';
                  const trimmed = name.toString().trim();
                  const parenIndex = trimmed.indexOf('(');
                  return parenIndex >= 0 ? trimmed.substring(0, parenIndex).trim() : trimmed;
                };
                const userBaseName = getAssigneeBaseName(userName);
                const isCurrentUser = currentAssignee === userBaseName || !currentAssignee;

                return currentDemos.length > 0 && !isMyDemosFolded && isCurrentUser ? (
                  <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      onClick={handleBulkReturn}
                      className="button-primary"
                      disabled={selectedDemos.length === 0 || isReturning}
                      style={{
                        opacity: selectedDemos.length === 0 ? 0.5 : 1,
                        cursor: selectedDemos.length === 0 || isReturning ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isReturning ? '반납 처리 중...' : `선택한 장비 반납 (${selectedDemos.length})`}
                    </button>
                    {selectedDemos.length > 0 && (
                      <button
                        onClick={() => setSelectedDemos([])}
                        className="button-secondary"
                        style={{ padding: '8px 16px' }}
                      >
                        선택 해제
                      </button>
                    )}
                  </div>
                ) : null;
              })()}

              {/* 반납 진행 로그 UI */}
              {returnLogs.length > 0 && (
                <div style={{
                  marginTop: '16px',
                  padding: '16px',
                  backgroundColor: '#f8f9fa',
                  border: '1px solid #dee2e6',
                  borderRadius: '8px',
                  maxHeight: '400px',
                  overflowY: 'auto'
                }}>
                  <h4 style={{
                    margin: '0 0 12px 0',
                    fontSize: '16px',
                    fontWeight: 600,
                    color: '#495057',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    {isReturning && (
                      <div className={styles.processSpinner} />
                    )}
                    반납 진행 상황
                  </h4>
                  <div style={{
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    lineHeight: '1.8'
                  }}>
                    {returnLogs.map((log, index) => (
                      <div
                        key={index}
                        style={{
                          padding: '4px 8px',
                          marginBottom: '2px',
                          borderRadius: '4px',
                          backgroundColor:
                            log.type === 'success' ? '#d4edda' :
                              log.type === 'error' ? '#f8d7da' :
                                log.type === 'processing' ? '#fff3cd' :
                                  'transparent',
                          color:
                            log.type === 'success' ? '#155724' :
                              log.type === 'error' ? '#721c24' :
                                log.type === 'processing' ? '#856404' :
                                  '#495057'
                        }}
                      >
                        <span style={{ color: '#6c757d', marginRight: '8px' }}>
                          [{log.timestamp}]
                        </span>
                        {log.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 고정 영역 2: 장비 검색 */}
        <div className={`${styles.fixedArea} ${styles.searchFixedSection}`}>
          <div className={styles.compactSearchHeader}>
            <h2 className={styles.compactTitle}>신청</h2>
            <div className={styles.searchBarCompact}>
              <SearchBar onSearch={handleSearch} />
            </div>
            <label className={styles.filterLabelCompact}>
              <input
                type="checkbox"
                checked={showInUseEquipment}
                onChange={(e) => setShowInUseEquipment(e.target.checked)}
              />
              <span>사용중인 장비</span>
            </label>
          </div>
        </div>

        {/* 스크롤 가능 영역: 장비 목록만 */}
        <div className={styles.scrollableArea} ref={scrollableAreaRef}>
          <div className={styles.section}>
            <div className={styles.tableContainer}>
              {loadingEquipments ? (
                <SkeletonTable rows={5} />
              ) : (
                <EquipmentList
                  equipments={filteredEquipments}
                  selectedEquipments={selectedEquipments}
                  onEquipmentToggle={handleEquipmentToggle}
                  allEquipmentFromSheet={allEquipmentFromSheet}
                />
              )}
            </div>
          </div>
        </div>

        {/* 하단 고정 영역: 데모 신청 정보 */}
        {(selectedEquipments.length > 0 || pdfPreviewImages?.length > 0 || pngFiles?.length > 0 || sheetPngFiles?.length > 0 || pdfBase64 || pdfUrl) && (
          <div
            ref={bottomFixedAreaRef}
            className={`${styles.bottomFixedArea} ${applicationFormState === 'compact' ? styles.bottomFixedAreaCompact :
              applicationFormState === 'folded' ? styles.bottomFixedAreaFolded : ''
              } ${isBottomAreaExpanded ? styles.bottomFixedAreaExpanded : ''}`}
          >
            {/* 데모 신청 정보 */}
            {showApplicationForm && selectedEquipments.length > 0 && (
              <div className={styles.applicationFormContainer}>
                <div className={styles.applicationFormHeader}>
                  <h3>데모 신청 정보</h3>
                  <div className={styles.formControlButtons}>
                    <button
                      onClick={() => {
                        if (applicationFormState === 'folded') {
                          setApplicationFormState('expanded');
                          scrollCountRef.current = 0;
                        } else {
                          setApplicationFormState('folded');
                          scrollCountRef.current = 3;
                        }
                      }}
                      className={styles.foldFormButton}
                    >
                      {applicationFormState === 'folded' ? '▼ 펼치기' : '▲ 접기'}
                    </button>
                  </div>
                </div>
                {applicationFormState !== 'folded' && (
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
                )}
              </div>
            )}

            {/* JPG 이미지 미리보기 */}
            {pdfPreviewImages && pdfPreviewImages.length > 0 && (
              <JpgViewer
                images={pdfPreviewImages}
                title="데모 신청 양식 미리보기"
                showDownload={true}
                onClose={() => {
                  setPdfPreviewImages([]);
                  setPdfUrl(null);
                  setPdfBase64(null);
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
        )}
      </div>
    </div>
  );
};

export default MainPage;
