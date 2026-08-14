import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEquipmentData, logInventoryAudit } from '../services/api';
import styles from './InventoryAuditPage.module.css';

// 🔊 Web Audio API 기반 효과음 생성기 (외부 파일 없이 즉시 작동)
const playSound = (type) => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'success') {
      // 띵! (높고 경쾌한 톤)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now); // A5
      osc.frequency.exponentialRampToValueAtTime(1760, now + 0.15); // A6
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'warning') {
      // 삐-익! (경고 톤)
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(330, now + 0.1);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'duplicate') {
      // 뚜둥 (중복 톤)
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523, now); // C5
      osc.frequency.setValueAtTime(392, now + 0.08); // G4
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  } catch (e) {
    console.warn('Audio play failed:', e);
  }
};

const InventoryAuditPage = () => {
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const [allEquipments, setAllEquipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 실사 상태
  const [selectedLocation, setSelectedLocation] = useState('2층 창고');
  const [isAuditing, setIsAuditing] = useState(false);
  const [scanInputText, setScanInputText] = useState('');
  const [scannedSerialsSet, setScannedSerialsSet] = useState(new Set());
  const [scannedLogs, setScannedLogs] = useState([]); // { serial, rawSerial, timestamp }
  const [activeTab, setActiveTab] = useState('matched'); // 'matched' | 'missing' | 'unexpected'
  const [isSaving, setIsSaving] = useState(false);

  // 장비 데이터 수신
  useEffect(() => {
    const fetchEquipments = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getEquipmentData();

        let rawList = [];
        if (Array.isArray(data)) {
          rawList = data;
        } else if (data && typeof data === 'object') {
          rawList = data.equipments || data.items || data.rows || data.data || [];
          if (!Array.isArray(rawList)) {
            const firstArray = Object.values(data).find(v => Array.isArray(v));
            rawList = firstArray || [];
          }
        }

        console.log('📦 [재고실사] API 장비 수:', rawList.length);

        // 최근 입력 데이터 기준으로 장비 시리얼 중복제거 (모든 컬럼명 변종 지원)
        const serialMap = new Map();
        [...rawList].reverse().forEach(item => {
          const serial = (
            item.serial || 
            item.serialNumber || 
            item['시리얼넘버'] || 
            item['시리얼 넘버'] || 
            item['시리얼'] || 
            item['S/N'] || 
            item['SN'] || 
            item['시리얼 번호'] || 
            ''
          ).toString().trim();

          const name = (
            item.name || 
            item['제품명'] || 
            item['제품 명'] || 
            item['장비명'] || 
            item['장비 명'] || 
            item['모델명'] || 
            item['이름'] || 
            '이름 없음'
          ).toString().trim();

          const location = (
            item.location || 
            item['보관위치'] || 
            item['위치'] || 
            item['보관 장소'] || 
            '본사'
          ).toString().trim();

          const status = (
            item.status || 
            item['대여가능여부'] || 
            item['상태'] || 
            item['대여상태'] || 
            ''
          ).toString().trim();

          const assignee = (
            item.assignee || 
            item['대여담당자'] || 
            item['담당자'] || 
            ''
          ).toString().trim();

          if (serial) {
            const cleanS = serial.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            if (cleanS) {
              if (!serialMap.has(cleanS)) {
                // 최신 행 (가장 아래 행) 데이터를 최우선 등록
                serialMap.set(cleanS, {
                  id: item.id || serial,
                  name: name,
                  serial: serial,
                  location: location,
                  status: status,
                  assignee: assignee
                });
              } else {
                // 최신 행의 보관위치/상태가 누락된 경우 이전 행에서 보완
                const existing = serialMap.get(cleanS);
                if ((!existing.location || existing.location === '-') && location) {
                  existing.location = location;
                }
                if ((!existing.status || existing.status === '-') && status) {
                  existing.status = status;
                }
                if ((!existing.name || existing.name === '이름 없음') && name && name !== '이름 없음') {
                  existing.name = name;
                }
              }
            }
          }
        });

        setAllEquipments(Array.from(serialMap.values()));
      } catch (err) {
        console.error('장비 로드 실패:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchEquipments();
  }, []);

  // 수동 추가된 보관 장소 목록 (localStorage 보존)
  const [customLocations, setCustomLocations] = useState(() => {
    try {
      const saved = localStorage.getItem('custom_audit_locations');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // 구글 시트에 존재하는 위치 + 수동 추가된 위치 100% 동적 합성
  const availableLocations = useMemo(() => {
    const locSet = new Set();
    allEquipments.forEach(eq => {
      const loc = (eq.location || '').toString().trim();
      if (loc && loc !== '-' && loc !== 'undefined') {
        locSet.add(loc);
      }
    });

    customLocations.forEach(cLoc => {
      if (cLoc && cLoc.trim()) {
        locSet.add(cLoc.trim());
      }
    });

    const list = Array.from(locSet);
    if (list.length === 0) {
      return ['2층 창고', '본사', '1층 전시장'];
    }
    return list;
  }, [allEquipments, customLocations]);

  // 장소 수동 추가 핸들러
  const handleAddCustomLocation = () => {
    const input = window.prompt('➕ 새로 추가할 보관 장소명을 입력하세요:\n(예: 3층 창고, 지하 보관소, 외부 전시장 등)');
    if (!input) return;
    const trimmed = input.trim();
    if (!trimmed) return;

    if (!customLocations.includes(trimmed)) {
      const updated = [...customLocations, trimmed];
      setCustomLocations(updated);
      try {
        localStorage.setItem('custom_audit_locations', JSON.stringify(updated));
      } catch (e) {}
    }
    setSelectedLocation(trimmed);
  };

  // 구글 시트에서 위치 목록이 로드되면 첫 번째 위치를 자동 선택
  useEffect(() => {
    if (availableLocations.length > 0 && !availableLocations.includes(selectedLocation)) {
      setSelectedLocation(availableLocations[0]);
    }
  }, [availableLocations, selectedLocation]);

  // 실사 대상 위치에 보관 중이어야 하는 기준 장비 목록 (Expected List)
  const expectedEquipments = useMemo(() => {
    if (!selectedLocation) return [];
    return allEquipments.filter(eq => {
      const isLocMatch = eq.location.toLowerCase() === selectedLocation.toLowerCase();
      const cleanStatus = (eq.status || '').replace(/\s+/g, '').toLowerCase();

      // 1. 외부 반출/사용중 상태 제외
      const isCheckedOut = ['대여중', '대여신청', '사용중'].some(s => cleanStatus.includes(s.toLowerCase()));

      // 2. 사용 불가 / 고장 / 폐기 / 불량 / RMA 상태 제외 (스킵)
      const isUnusable = ['사용불가', '대여불가', '고장', '폐기', '불량', 'rma'].some(s => cleanStatus.includes(s.toLowerCase()));

      return isLocMatch && !isCheckedOut && !isUnusable;
    });
  }, [allEquipments, selectedLocation]);

  // 실사 자동 대조 분류 (Matched, Missing, Unexpected)
  const auditAnalysis = useMemo(() => {
    const matchedList = [];
    const missingList = [];
    const unexpectedList = [];

    // 기준 장비 목록 대조
    const expectedSerialMap = new Map();
    expectedEquipments.forEach(eq => {
      const cleanS = eq.serial.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      expectedSerialMap.set(cleanS, eq);
    });

    // 스캔된 시리얼 목록 대조
    const scannedCleanSet = new Set(
      Array.from(scannedSerialsSet).map(s => s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase())
    );

    // 1. Expected 장비 중 스캔 여부 판단
    expectedEquipments.forEach(eq => {
      const cleanS = eq.serial.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (scannedCleanSet.has(cleanS)) {
        matchedList.push(eq);
      } else {
        missingList.push(eq);
      }
    });

    // 2. 스캔된 장비 중 Expected에 없었던 장비 판단 (위치 불일치 / 초과 장비)
    scannedSerialsSet.forEach(rawScanned => {
      const cleanS = rawScanned.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (!expectedSerialMap.has(cleanS)) {
        // 전체 장비에서 검색
        const foundInMaster = allEquipments.find(eq => eq.serial.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanS);
        if (foundInMaster) {
          unexpectedList.push({
            ...foundInMaster,
            reason: foundInMaster.location !== selectedLocation ? `타 위치 등록 (${foundInMaster.location})` : `상태 불일치 (${foundInMaster.status})`
          });
        } else {
          unexpectedList.push({
            id: rawScanned,
            name: '미등록 장비',
            serial: rawScanned,
            location: '미등록',
            status: '-',
            reason: '구글 시트 미등록 장비'
          });
        }
      }
    });

    return { matchedList, missingList, unexpectedList };
  }, [expectedEquipments, scannedSerialsSet, allEquipments, selectedLocation]);

  // 실사 시작
  const handleStartAudit = () => {
    setIsAuditing(true);
    setScannedSerialsSet(new Set());
    setScannedLogs([]);
    setScanInputText('');
    setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 100);
  };

  // 실사 종료
  const handleStopAudit = () => {
    setIsAuditing(false);
  };

  // 스캔 시리얼 처리
  const processScannedSerial = (inputSerial) => {
    const trimmed = (inputSerial || '').trim();
    if (!trimmed) return;

    const cleanInput = trimmed.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    // 중복 체크
    let isAlreadyScanned = false;
    scannedSerialsSet.forEach(s => {
      if (s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanInput) {
        isAlreadyScanned = true;
      }
    });

    if (isAlreadyScanned) {
      playSound('duplicate');
      setScanInputText('');
      return;
    }

    // 신규 스캔 성공
    const isExpected = expectedEquipments.some(eq => eq.serial.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanInput);
    const foundEquipment = allEquipments.find(eq => eq.serial.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanInput);

    let logMsg = '';
    let logStatus = 'expected';

    if (isExpected) {
      logMsg = `✅ [정상 일치] ${foundEquipment ? foundEquipment.name : trimmed} (${trimmed})`;
      logStatus = 'expected';
    } else if (foundEquipment) {
      const reason = foundEquipment.location !== selectedLocation 
        ? `타 위치 등록 (${foundEquipment.location})` 
        : `상태 불일치 (${foundEquipment.status})`;
      logMsg = `⚠️ [위치 불일치/초과] ${foundEquipment.name} (${trimmed}) - ${reason}`;
      logStatus = 'unexpected';
    } else {
      logMsg = `⚠️ [미등록 장비 스캔됨] S/N: ${trimmed} (구글 시트 미등록)`;
      logStatus = 'unexpected';
    }

    playSound(isExpected ? 'success' : 'warning');

    setScannedSerialsSet(prev => new Set([...prev, trimmed]));
    setScannedLogs(prev => [
      { serial: trimmed, isExpected, logMsg, logStatus, time: new Date().toLocaleTimeString() },
      ...prev
    ]);

    setScanInputText('');
  };

  // 키보드 엔터 입력 처리
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      processScannedSerial(scanInputText);
    }
  };

  // 수동 스캔 추가 버튼
  const handleManualAdd = () => {
    processScannedSerial(scanInputText);
  };

  // 실사 결과 보고서 CSV 다운로드
  const handleDownloadReport = () => {
    const rows = [
      ['구분', '장비명', '시리얼넘버', '등록위치', '현재상태', '비고'],
      ...auditAnalysis.matchedList.map(item => ['✅ 일치', item.name, item.serial, item.location, item.status, '정상 보관 확인']),
      ...auditAnalysis.missingList.map(item => ['❌ 미발견(분실)', item.name, item.serial, item.location, item.status, '실사 시 발견되지 않음']),
      ...auditAnalysis.unexpectedList.map(item => ['⚠️ 위치불일치(초과)', item.name, item.serial, item.location, item.status, item.reason || ''])
    ];

    const csvContent = '\uFEFF' + rows.map(e => e.map(val => `"${val}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `재고실사보고서_${selectedLocation}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 구글 시트에 실사 결과 기록 (이슈 장비 한 줄씩 개별 저장)
  const handleSaveToSheet = async () => {
    try {
      setIsSaving(true);

      const missingItems = auditAnalysis.missingList.map(item => ({
        name: item.name || '미발견 장비',
        serial: item.serial || '-',
        location: item.location || selectedLocation,
        status: item.status || '보관중',
        reason: '실사 시 현장에서 발견되지 않음 (분실 의심)'
      }));

      const unexpectedItems = auditAnalysis.unexpectedList.map(item => ({
        name: item.name || '초과 스캔 장비',
        serial: item.serial || '-',
        location: item.location || '미등록',
        status: item.status || '-',
        reason: item.reason || '목록에 없는데 스캔됨 (위치 이탈)'
      }));

      const auditSummary = {
        location: selectedLocation,
        auditor: '재고담당자',
        totalExpected: expectedEquipments.length,
        matchedCount: auditAnalysis.matchedList.length,
        missingCount: auditAnalysis.missingList.length,
        unexpectedCount: auditAnalysis.unexpectedList.length,
        scannedCount: scannedSerialsSet.size,
        missingItems: missingItems,
        unexpectedItems: unexpectedItems,
        timestamp: new Date().toLocaleString()
      };

      await logInventoryAudit(auditSummary);
      alert(`✅ [실사 이력 구글 시트 저장 완료]\n\n📍 위치: ${selectedLocation}\n❌ 미발견: ${auditSummary.missingCount}개\n⚠️ 위치 불일치/초과: ${auditSummary.unexpectedCount}개\n\n이슈 장비들이 구글 시트에 한 줄씩 깔끔하게 기록되었습니다.`);
    } catch (err) {
      alert(`저장 실패: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const progressPercent = expectedEquipments.length > 0
    ? Math.min(100, Math.round((auditAnalysis.matchedList.length / expectedEquipments.length) * 100))
    : 0;

  return (
    <div className={styles.auditContainer}>
      {/* 헤더 */}
      <div className={styles.header}>
        <div className={styles.headerTitleGroup}>
          <h1>📦 스마트 장비 재고 실사 시스템</h1>
          <p>위치별 실시간 바코드/QR 스캔 및 재고 3원 대조 검증</p>
        </div>
        <div className={styles.headerActions}>
          <button 
            className={styles.backBtn} 
            onClick={() => window.open('/label-print', '_blank')}
            style={{ backgroundColor: '#4f46e5', color: '#ffffff', border: 'none' }}
          >
            🏷️ 바코드/QR 라벨 출력
          </button>
          <button className={styles.backBtn} onClick={() => navigate('/')}>
            🏠 메인 화면으로 돌아가기
          </button>
        </div>
      </div>

      <div className={styles.contentWrapper}>
        {/* 컨트롤 카드 */}
        <div className={styles.controlCard}>
          <div className={styles.controlRow}>
            <div className={styles.locationSelectGroup}>
              <span className={styles.selectLabel}>📍 실사 장소 선택:</span>
              <select
                className={styles.locationSelect}
                value={selectedLocation}
                onChange={(e) => {
                  if (e.target.value === '__ADD_NEW__') {
                    handleAddCustomLocation();
                  } else {
                    setSelectedLocation(e.target.value);
                  }
                }}
                disabled={isAuditing}
              >
                {availableLocations.map((loc, idx) => (
                  <option key={idx} value={loc}>{loc}</option>
                ))}
                <option value="__ADD_NEW__">➕ 새 장소 직접 추가...</option>
              </select>

              <button
                onClick={handleAddCustomLocation}
                disabled={isAuditing}
                style={{
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  border: 'none',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
                }}
              >
                ➕ 장소 추가
              </button>
            </div>

            <div>
              {!isAuditing ? (
                <button className={styles.startAuditBtn} onClick={handleStartAudit}>
                  🚀 재고 실사 시작 (스캐너 가동)
                </button>
              ) : (
                <button className={styles.stopAuditBtn} onClick={handleStopAudit}>
                  ⏹️ 실사 완료 및 분석 종료
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 로딩/에러 표시 */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', fontWeight: 'bold' }}>
            ⏳ 시트 장비 데이터 로딩 중...
          </div>
        )}
        {error && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#dc2626', background: '#fef2f2', borderRadius: '8px', marginBottom: '20px', fontWeight: 'bold' }}>
            ❌ 데이터 로드 실패: {error}
          </div>
        )}

        {/* 스캐너 입력 카운터 */}
        {isAuditing && (
          <div className={styles.scannerCard}>
            <div className={styles.scannerHeader}>
              <div className={styles.scannerTitle}>
                <div className={styles.livePulse} />
                <span>실시간 스캐너 입력 대기 중... [{selectedLocation}]</span>
              </div>
              <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 'bold' }}>
                총 {scannedSerialsSet.size}대 스캔 완료
              </span>
            </div>

            <div className={styles.scannerInputGroup}>
              <input
                ref={inputRef}
                type="text"
                className={styles.scannerInput}
                placeholder="스캐너로 장비 QR/바코드를 찍으세요..."
                value={scanInputText}
                onChange={(e) => setScanInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
              <button className={styles.manualAddBtn} onClick={handleManualAdd}>
                스캔 등록
              </button>
            </div>
            <p className={styles.scannerTip}>
              💡 무선 바코드 스캐너를 쥐고 장비 QR 라벨을 틱-틱 연속으로 찍으시면 자동으로 카운트됩니다. (엔터 자동 감지)
            </p>

            {/* ⚡ 실시간 스캔 피드 (초과/타위치 장비 즉시 하이라이트) */}
            {scannedLogs.length > 0 && (
              <div style={{ marginTop: '14px', borderTop: '1px solid #334155', paddingTop: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#94a3b8', marginBottom: '6px' }}>⚡ 최근 스캔 현황:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {scannedLogs.slice(0, 3).map((log, idx) => (
                    <div key={idx} style={{
                      fontSize: '13px',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontWeight: 'bold',
                      background: log.logStatus === 'expected' ? '#14532d' : '#7c2d12',
                      color: log.logStatus === 'expected' ? '#86efac' : '#fdba74',
                      border: log.logStatus === 'expected' ? '1px solid #22c55e' : '1px solid #f97316',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span>{log.logMsg}</span>
                      <span style={{ fontSize: '11px', opacity: 0.85 }}>{log.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 진척도 및 현황 통계 카드 */}
        <div className={styles.statsGrid}>
          <div className={`${styles.statCard} ${styles.matchedCard}`}>
            <div className={styles.statLabel}>✅ 정상 일치 (Matched)</div>
            <div className={styles.statVal} style={{ color: '#16a34a' }}>
              {auditAnalysis.matchedList.length} <span style={{ fontSize: '14px', color: '#64748b' }}>/ {expectedEquipments.length}대</span>
            </div>
            <div className={styles.progressBarBg}>
              <div className={styles.progressBarFill} style={{ width: `${progressPercent}%` }} />
            </div>
          </div>

          <div className={`${styles.statCard} ${styles.missingCard}`}>
            <div className={styles.statLabel}>❌ 미발견 / 분실 의심 (Missing)</div>
            <div className={styles.statVal} style={{ color: '#dc2626' }}>
              {auditAnalysis.missingList.length} <span style={{ fontSize: '14px', color: '#64748b' }}>대</span>
            </div>
          </div>

          <div className={`${styles.statCard} ${styles.unexpectedCard}`}>
            <div className={styles.statLabel}>⚠️ 위치 불일치 / 초과 (Unexpected)</div>
            <div className={styles.statVal} style={{ color: '#d97706' }}>
              {auditAnalysis.unexpectedList.length} <span style={{ fontSize: '14px', color: '#64748b' }}>대</span>
            </div>
          </div>
        </div>

        {/* 실사 대조 리포트 탭 테이블 */}
        <div className={styles.reportCard}>
          <div className={styles.tabHeader}>
            <button
              className={`${styles.tabBtn} ${activeTab === 'matched' ? styles.activeTabMatched : ''}`}
              onClick={() => setActiveTab('matched')}
            >
              <span>✅ 정상 일치</span>
              <span className={`${styles.badge} ${styles.badgeMatched}`}>{auditAnalysis.matchedList.length}</span>
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'missing' ? styles.activeTabMissing : ''}`}
              onClick={() => setActiveTab('missing')}
            >
              <span>❌ 미발견 (분실 의심)</span>
              <span className={`${styles.badge} ${styles.badgeMissing}`}>{auditAnalysis.missingList.length}</span>
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'unexpected' ? styles.activeTabUnexpected : ''}`}
              onClick={() => setActiveTab('unexpected')}
            >
              <span>⚠️ 위치 불일치 / 초과</span>
              <span className={`${styles.badge} ${styles.badgeUnexpected}`}>{auditAnalysis.unexpectedList.length}</span>
            </button>
          </div>

          <div className={styles.tableContainer}>
            {activeTab === 'matched' && (
              <table className={styles.auditTable}>
                <thead>
                  <tr>
                    <th>상태</th>
                    <th>장비명</th>
                    <th>시리얼 넘버</th>
                    <th>보관 위치</th>
                    <th>현황</th>
                  </tr>
                </thead>
                <tbody>
                  {auditAnalysis.matchedList.length === 0 ? (
                    <tr><td colSpan="5" className={styles.emptyMsg}>스캔하여 일치된 장비가 없습니다.</td></tr>
                  ) : (
                    auditAnalysis.matchedList.map((item, idx) => (
                      <tr key={idx}>
                        <td><span className={`${styles.badge} ${styles.badgeMatched}`}>✅ 정상</span></td>
                        <td style={{ fontWeight: '700' }}>{item.name}</td>
                        <td style={{ fontFamily: 'monospace' }}>{item.serial}</td>
                        <td>{item.location}</td>
                        <td>{item.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'missing' && (
              <table className={styles.auditTable}>
                <thead>
                  <tr>
                    <th>상태</th>
                    <th>장비명</th>
                    <th>시리얼 넘버</th>
                    <th>등록 위치</th>
                    <th>비고</th>
                  </tr>
                </thead>
                <tbody>
                  {auditAnalysis.missingList.length === 0 ? (
                    <tr><td colSpan="5" className={styles.emptyMsg}>🎉 모든 장비가 실사에서 정상 발견되었습니다!</td></tr>
                  ) : (
                    auditAnalysis.missingList.map((item, idx) => (
                      <tr key={idx}>
                        <td><span className={`${styles.badge} ${styles.badgeMissing}`}>❌ 미발견</span></td>
                        <td style={{ fontWeight: '700', color: '#dc2626' }}>{item.name}</td>
                        <td style={{ fontFamily: 'monospace' }}>{item.serial}</td>
                        <td>{item.location}</td>
                        <td style={{ color: '#ef4444', fontWeight: '600' }}>실사 현장에서 발견되지 않음 (확인 필요)</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'unexpected' && (
              <table className={styles.auditTable}>
                <thead>
                  <tr>
                    <th>상태</th>
                    <th>장비명</th>
                    <th>시리얼 넘버</th>
                    <th>등록된 위치/상태</th>
                    <th>불일치 사유</th>
                  </tr>
                </thead>
                <tbody>
                  {auditAnalysis.unexpectedList.length === 0 ? (
                    <tr><td colSpan="5" className={styles.emptyMsg}>위치 불일치 또는 미등록 초과 장비가 없습니다.</td></tr>
                  ) : (
                    auditAnalysis.unexpectedList.map((item, idx) => (
                      <tr key={idx}>
                        <td><span className={`${styles.badge} ${styles.badgeUnexpected}`}>⚠️ 초과/이탈</span></td>
                        <td style={{ fontWeight: '700', color: '#d97706' }}>{item.name}</td>
                        <td style={{ fontFamily: 'monospace' }}>{item.serial}</td>
                        <td>{item.location} ({item.status})</td>
                        <td style={{ color: '#b45309', fontWeight: '600' }}>{item.reason}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className={styles.actionFooter}>
            <button className={styles.downloadReportBtn} onClick={handleDownloadReport}>
              📥 실사 보고서 다운로드 (CSV)
            </button>
            <button className={styles.saveSheetBtn} onClick={handleSaveToSheet} disabled={isSaving}>
              {isSaving ? '⏳ 시트 저장 중...' : '📋 구글 시트에 실사 이력 저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryAuditPage;
