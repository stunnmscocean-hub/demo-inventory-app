import React, { useState, useEffect, useMemo } from 'react';
import { getEquipmentData } from '../services/api';
import BarcodeSvg from '../components/BarcodeSvg';
import styles from './LabelPrintPage.module.css';

const LabelPrintPage = () => {
  const domain = window.location.origin.includes('localhost') ? 'http://localhost:3000' : 'https://demodevice.kr';
  const [allEquipments, setAllEquipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 출력 모드: 'barcode' (바코드 전용), 'dual_qr' (듀얼 QR), 'hybrid' (바코드+QR)
  const [labelMode, setLabelMode] = useState('barcode');

  // 선택된 인쇄 대기열: [{ id, name, serial, location, qty, isCustom }]
  const [printQueue, setPrintQueue] = useState([]);

  // 모달 제어
  const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  // 검색 및 필터 (모달 내부)
  const [modalSearch, setModalSearch] = useState('');
  const [modalLocationFilter, setModalLocationFilter] = useState('ALL');

  // 신규 장비 직접 입력 폼 상태
  const [manualForm, setManualForm] = useState({
    name: '',
    serial: '',
    qty: 1
  });

  // 인쇄 레이아웃 미세 설정
  const [col2Gap, setCol2Gap] = useState(2.5); // 2번째 열 우측 미세 간격 (mm)
  const [startSlotOffset, setStartSlotOffset] = useState(0); // 1페이지 시작 위치 (0~9: 1~10번째 칸부터 인쇄)
  const [highlightAlpha, setHighlightAlpha] = useState(true); // 시리얼 넘버 영문 하이라이트 여부

  // 구글 시트에서 전체 장비 데이터 로드
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
            ''
          ).toString().trim();

          const name = (
            item.name ||
            item['제품명'] ||
            item['장비명'] ||
            item['이름'] ||
            '이름 없음'
          ).toString().trim();

          const location = (
            item.location ||
            item['보관위치'] ||
            item['위치'] ||
            '본사'
          ).toString().trim();

          if (serial) {
            const cleanS = serial.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            if (cleanS && !serialMap.has(cleanS)) {
              serialMap.set(cleanS, {
                id: item.id || serial,
                name: name,
                serial: serial,
                location: location
              });
            }
          }
        });

        const list = Array.from(serialMap.values());
        setAllEquipments(list);

        // 초기 기본값: 최근 등록된 10개 장비 자동 큐에 추가
        setPrintQueue(prev => {
          if (prev.length === 0 && list.length > 0) {
            return list.slice(0, 10).map(item => ({ ...item, qty: 1 }));
          }
          return prev;
        });
      } catch (err) {
        console.error('장비 데이터 로드 실패:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchEquipments();
  }, []);

  // 전체 고유 위치 목록
  const uniqueLocations = useMemo(() => {
    const set = new Set();
    allEquipments.forEach(eq => {
      if (eq.location) set.add(eq.location);
    });
    return Array.from(set).sort();
  }, [allEquipments]);

  // 모달 내부 필터된 장비 목록
  const filteredEquipmentsForModal = useMemo(() => {
    return allEquipments.filter(eq => {
      const matchSearch =
        (eq.name || '').toLowerCase().includes(modalSearch.toLowerCase()) ||
        (eq.serial || '').toLowerCase().includes(modalSearch.toLowerCase());
      const matchLoc = modalLocationFilter === 'ALL' || eq.location === modalLocationFilter;
      return matchSearch && matchLoc;
    });
  }, [allEquipments, modalSearch, modalLocationFilter]);

  // 대기열 수량 변경
  const updateQueueQty = (serial, delta) => {
    setPrintQueue(prev => {
      return prev
        .map(item => {
          if (item.serial === serial) {
            const newQty = Math.max(1, (item.qty || 1) + delta);
            return { ...item, qty: newQty };
          }
          return item;
        })
        .filter(Boolean);
    });
  };

  // 대기열에서 개별 삭제
  const removeFromQueue = (serial) => {
    setPrintQueue(prev => prev.filter(item => item.serial !== serial));
  };

  // 대기열 전체 비우기
  const clearQueue = () => {
    if (window.confirm('출력 대기열을 모두 비우시겠습니까?')) {
      setPrintQueue([]);
    }
  };

  // 대기열 수량 일괄 설정
  const setAllQueueQty = (qty) => {
    setPrintQueue(prev => prev.map(item => ({ ...item, qty: qty })));
  };

  // 모달에서 장비 토글 선택
  const handleModalToggleEquipment = (eq) => {
    setPrintQueue(prev => {
      const exists = prev.some(item => item.serial === eq.serial);
      if (exists) {
        return prev.filter(item => item.serial !== eq.serial);
      } else {
        return [...prev, { ...eq, qty: 1 }];
      }
    });
  };

  // 모달에서 현재 필터된 장비 전체 선택
  const handleSelectAllFiltered = () => {
    const newItems = [...printQueue];
    filteredEquipmentsForModal.forEach(eq => {
      if (!newItems.some(item => item.serial === eq.serial)) {
        newItems.push({ ...eq, qty: 1 });
      }
    });
    setPrintQueue(newItems);
  };

  // 모달에서 현재 필터된 장비 선택 해제
  const handleDeselectAllFiltered = () => {
    const filterSerials = new Set(filteredEquipmentsForModal.map(e => e.serial));
    setPrintQueue(prev => prev.filter(item => !filterSerials.has(item.serial)));
  };

  // 신규 장비 직접 입력 추가
  const handleAddManualItem = (e) => {
    e.preventDefault();
    if (!manualForm.name.trim()) {
      alert('제품명을 입력해 주세요.');
      return;
    }
    if (!manualForm.serial.trim()) {
      alert('시리얼 번호를 입력해 주세요.');
      return;
    }

    const newItem = {
      id: `custom_${Date.now()}`,
      name: manualForm.name.trim(),
      serial: manualForm.serial.trim().toUpperCase(),
      location: '신규등록',
      qty: Math.max(1, parseInt(manualForm.qty, 10) || 1),
      isCustom: true
    };

    setPrintQueue(prev => {
      const existingIdx = prev.findIndex(item => item.serial === newItem.serial);
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx].qty += newItem.qty;
        return copy;
      }
      return [newItem, ...prev];
    });

    setManualForm({ name: '', serial: '', qty: 1 });
    setIsManualModalOpen(false);
  };

  // 실제 출력용 확장 리스트 (수량만큼 복제 + 시작 오프셋 빈칸 포함)
  const flattenedLabels = useMemo(() => {
    const list = [];

    // 시작 위치 오프셋 (1페이지의 앞부분 빈 슬롯)
    for (let i = 0; i < startSlotOffset; i++) {
      list.push({ isBlank: true, id: `blank_${i}` });
    }

    // 대기열 아이템들을 qty 수량만큼 반복 추가
    printQueue.forEach(item => {
      const count = item.qty || 1;
      for (let c = 0; c < count; c++) {
        list.push({
          ...item,
          isBlank: false,
          uniqueKey: `${item.serial}_${c}`
        });
      }
    });

    return list;
  }, [printQueue, startSlotOffset]);

  // 총 출력 라벨 수 및 페이지 수 계산
  const totalActualLabels = printQueue.reduce((acc, cur) => acc + (cur.qty || 1), 0);
  const totalPages = Math.ceil(flattenedLabels.length / 10);

  // 시리얼 넘버 영문 하이라이트 포맷 함수
  const renderHighlightedSerial = (serialText) => {
    if (!serialText) return '';
    const parts = serialText.toString().split(/([a-zA-Z가-힣_#-]+)/g);
    return (
      <span style={{ fontFamily: "'Roboto Mono', 'Courier New', monospace", letterSpacing: '0.3px' }}>
        {parts.map((part, index) => {
          if (!part) return null;
          if (highlightAlpha && /[a-zA-Z가-힣_#-]/.test(part)) {
            return (
              <span 
                key={index} 
                style={{ 
                  backgroundColor: '#e2e8f0', 
                  borderRadius: '2px',
                  padding: '0 1px',
                  fontWeight: '700' 
                }}
              >
                {part}
              </span>
            );
          }
          return <span key={index}>{part}</span>;
        })}
      </span>
    );
  };

  return (
    <div className={styles.container}>
      {/* ===== 인쇄 전용 CSS (Formtec LS-3510: 88.9mm × 52mm, 2열 × 5행) ===== */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0 !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            width: 210mm !important;
            height: 297mm !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print { display: none !important; }
          .label-sheet-wrapper {
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
          .label-page {
            width: 210mm !important;
            height: 297mm !important;
            padding-top: 17mm !important;
            padding-left: 16.1mm !important;
            padding-right: 16.1mm !important;
            page-break-after: always !important;
            box-sizing: border-box !important;
            display: grid !important;
            grid-template-columns: 88.9mm 88.9mm !important;
            grid-template-rows: repeat(5, 52mm) !important;
            column-gap: ${col2Gap}mm !important;
            row-gap: 0 !important;
          }
          .label-page:last-child {
            page-break-after: avoid !important;
          }
          .label-card {
            width: 88.9mm !important;
            height: 52mm !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 4mm 6mm !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            background: #fff !important;
          }
          .label-card.blank-slot {
            visibility: hidden !important;
          }
        }

        @media screen {
          .label-sheet-wrapper {
            max-width: 980px;
            margin: 20px auto;
            padding: 0 16px;
          }
          .label-page {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            margin-bottom: 32px;
            padding: 18px;
            background: #ffffff;
            border: 2px dashed #94a3b8;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          }
          .label-card {
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 12px 14px;
            background: #ffffff;
            min-height: 160px;
            box-sizing: border-box;
            transition: transform 0.15s ease, box-shadow 0.15s ease;
          }
          .label-card:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          }
          .label-card.blank-slot {
            background: #f8fafc;
            border: 1px dashed #cbd5e1;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #94a3b8;
            font-size: 12px;
            font-weight: 600;
          }
        }
      `}</style>

      {/* ===== 상단 컨트롤 바 (화면 전용) ===== */}
      <header className={`no-print ${styles.topBar}`}>
        <div className={styles.titleGroup}>
          <h1>🏷️ 스마트 라벨 출력 센터</h1>
          <p>
            Formtec LS-3510 (88.9 × 52.0mm) · ⚠️ <strong>인쇄 설정: 여백 [없음(None)], 배율 [100%]</strong>
          </p>
        </div>

        <div className={styles.controlsGroup}>
          {/* 모드 탭 스위처 */}
          <div className={styles.modeTabs}>
            <button
              onClick={() => setLabelMode('barcode')}
              className={`${styles.tabBtn} ${labelMode === 'barcode' ? styles.active : ''}`}
            >
              📊 바코드 라벨
            </button>
            <button
              onClick={() => setLabelMode('dual_qr')}
              className={`${styles.tabBtn} ${labelMode === 'dual_qr' ? styles.active : ''}`}
            >
              📱 듀얼 QR 라벨
            </button>
            <button
              onClick={() => setLabelMode('hybrid')}
              className={`${styles.tabBtn} ${labelMode === 'hybrid' ? styles.active : ''}`}
            >
              🏷️ 통합 라벨 (바코드+QR)
            </button>
          </div>

          {/* 장비 선택 버튼 */}
          <button
            onClick={() => setIsSelectModalOpen(true)}
            className={styles.btnSecondary}
          >
            📋 장비 목록 선택 ({printQueue.length}종류)
          </button>

          {/* 신규 직접 추가 버튼 */}
          <button
            onClick={() => setIsManualModalOpen(true)}
            className={styles.btnSuccess}
          >
            ➕ 신규 장비 직접 추가
          </button>

          {/* 2열 간격 미세 조정 */}
          <select
            value={col2Gap}
            onChange={(e) => setCol2Gap(parseFloat(e.target.value))}
            className={styles.optionSelect}
            title="2번째 열 라벨 우측 이동 간격"
          >
            <option value={0.0}>열 간격: +0.0 mm</option>
            <option value={1.5}>열 간격: +1.5 mm</option>
            <option value={2.0}>열 간격: +2.0 mm</option>
            <option value={2.5}>열 간격: +2.5 mm (추천)</option>
            <option value={3.0}>열 간격: +3.0 mm</option>
            <option value={3.5}>열 간격: +3.5 mm</option>
          </select>

          {/* 시작 위치 오프셋 */}
          <select
            value={startSlotOffset}
            onChange={(e) => setStartSlotOffset(parseInt(e.target.value, 10))}
            className={styles.optionSelect}
            title="첫 페이지 시작 칸 번호"
          >
            <option value={0}>시작 위치: 1번째 칸 (새 라벨지)</option>
            <option value={1}>시작 위치: 2번째 칸부터</option>
            <option value={2}>시작 위치: 3번째 칸부터</option>
            <option value={3}>시작 위치: 4번째 칸부터</option>
            <option value={4}>시작 위치: 5번째 칸부터</option>
            <option value={5}>시작 위치: 6번째 칸부터</option>
            <option value={6}>시작 위치: 7번째 칸부터</option>
            <option value={7}>시작 위치: 8번째 칸부터</option>
            <option value={8}>시작 위치: 9번째 칸부터</option>
            <option value={9}>시작 위치: 10번째 칸부터</option>
          </select>

          {/* 영문 하이라이트 토글 */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={highlightAlpha}
              onChange={(e) => setHighlightAlpha(e.target.checked)}
            />
            <span>영문 음영강조</span>
          </label>

          {/* 인쇄 실행 버튼 */}
          <button
            onClick={() => window.print()}
            className={styles.btnPrimary}
            disabled={totalActualLabels === 0}
          >
            🖨️ 라벨 인쇄 (총 {totalActualLabels}장)
          </button>
        </div>
      </header>

      {/* ===== 대기열 상태 바 & 칩 목록 (화면 전용) ===== */}
      <div className={`no-print ${styles.queueBar}`}>
        <div className={styles.queueInfo}>
          <span className={styles.queueBadge}>
            총 {totalActualLabels}장 출력 대기
          </span>
          <span style={{ color: '#64748b' }}>
            ({printQueue.length}종류 장비 · A4 {totalPages}페이지 소요)
          </span>
        </div>

        <div className={styles.queueActions}>
          <span style={{ fontSize: '12px', color: '#64748b', marginRight: '4px' }}>일괄 수량:</span>
          <button onClick={() => setAllQueueQty(1)} className={styles.btnSecondary} style={{ padding: '4px 8px', fontSize: '12px' }}>1장</button>
          <button onClick={() => setAllQueueQty(2)} className={styles.btnSecondary} style={{ padding: '4px 8px', fontSize: '12px' }}>2장</button>
          <button onClick={() => setAllQueueQty(3)} className={styles.btnSecondary} style={{ padding: '4px 8px', fontSize: '12px' }}>3장</button>
          <button onClick={clearQueue} className={styles.btnSecondary} style={{ padding: '4px 8px', fontSize: '12px', color: '#dc2626' }}>🧹 대기열 비우기</button>
        </div>
      </div>

      {/* 선택된 장비 칩 리스트 (수량 조절 및 삭제 가능) */}
      {printQueue.length > 0 && (
        <div className={`no-print ${styles.selectedChips}`}>
          {printQueue.map((item) => (
            <div key={item.serial} className={styles.chip}>
              <span className={styles.chipName}>{item.name}</span>
              <span className={styles.chipSerial}>({item.serial})</span>
              <div className={styles.chipQtyControl}>
                <button onClick={() => updateQueueQty(item.serial, -1)} className={styles.chipQtyBtn}>-</button>
                <span>{item.qty}장</span>
                <button onClick={() => updateQueueQty(item.serial, 1)} className={styles.chipQtyBtn}>+</button>
              </div>
              <button onClick={() => removeFromQueue(item.serial)} className={styles.chipDeleteBtn} title="삭제">×</button>
            </div>
          ))}
        </div>
      )}

      {/* 로딩 / 에러 표시 */}
      {loading && (
        <div className="no-print" style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
          ⏳ 구글 시트에서 장비 데이터를 불러오는 중...
        </div>
      )}
      {error && (
        <div className="no-print" style={{ textAlign: 'center', padding: '30px', color: '#dc2626', background: '#fef2f2', margin: '20px', borderRadius: '8px' }}>
          ❌ 데이터 로드 실패: {error}
        </div>
      )}

      {/* ===== 실제 라벨 시트 렌더링 (10칸씩 A4 한 페이지 분할) ===== */}
      <main className="label-sheet-wrapper">
        {totalActualLabels === 0 && !loading && (
          <div className="no-print" style={{ textAlign: 'center', padding: '80px 20px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
            <h3 style={{ fontSize: '18px', color: '#334155', marginBottom: '8px' }}>출력할 장비가 선택되지 않았습니다</h3>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>
              상단의 <strong>[📋 장비 목록 선택]</strong> 버튼을 눌러 출력할 장비를 선택하거나,<br />
              <strong>[➕ 신규 장비 직접 추가]</strong>로 라벨을 즉시 만들어 보세요.
            </p>
            <button onClick={() => setIsSelectModalOpen(true)} className={styles.btnPrimary} style={{ margin: '0 auto' }}>
              📋 장비 목록에서 선택하기
            </button>
          </div>
        )}

        {Array.from({ length: totalPages }, (_, pageIdx) => {
          const pageSlots = flattenedLabels.slice(pageIdx * 10, (pageIdx + 1) * 10);
          const actualPageNum = pageIdx + 1;

          return (
            <React.Fragment key={pageIdx}>
              {/* 페이지 헤더 (화면 전용) */}
              <div className="no-print" style={{ fontSize: '13px', fontWeight: '800', color: '#334155', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📄 A4 라벨지 {actualPageNum}페이지</span>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>
                    (슬롯 {pageIdx * 10 + 1} ~ {Math.min((pageIdx + 1) * 10, flattenedLabels.length)}번째)
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: '600' }}>
                  Formtec LS-3510 (88.9 × 52.0mm)
                </span>
              </div>

              {/* 10칸 그리드 페이지 */}
              <div className="label-page">
                {pageSlots.map((slot, slotIdx) => {
                  if (slot.isBlank) {
                    return (
                      <div key={slot.id || slotIdx} className="label-card blank-slot">
                        <span>[빈 슬롯 (오프셋 건너뜀)]</span>
                      </div>
                    );
                  }

                  const serial = (slot.serial || '').toString().trim();
                  const name = slot.name || '미등록 장비';
                  const applyUrl = `${domain}/?action=apply&serial=${encodeURIComponent(serial)}`;
                  const returnUrl = `${domain}/?action=return&serial=${encodeURIComponent(serial)}`;
                  const applyQr = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(applyUrl)}`;
                  const returnQr = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(returnUrl)}`;

                  return (
                    <div
                      key={slot.uniqueKey || slotIdx}
                      className="label-card"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxSizing: 'border-box'
                      }}
                    >
                      {/* 0. 상단 공통 헤더: 회사 로고 & 연락처 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px', marginBottom: '3px' }}>
                        <img
                          src="/logo_ocean.png"
                          alt="Logo"
                          style={{ width: '15px', height: '15px', objectFit: 'contain' }}
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        <span style={{ fontSize: '7.5pt', fontWeight: '700', color: '#1e293b', letterSpacing: '-0.3px', flex: 1, whiteSpace: 'nowrap' }}>
                          오우션테크놀러지 Demo Device
                        </span>
                        <span style={{ fontSize: '7pt', color: '#64748b', whiteSpace: 'nowrap' }}>
                          02-2188-7737
                        </span>
                      </div>

                      {/* 1. 장비명 & 시리얼 번호 (텍스트) */}
                      <div style={{ marginBottom: '2px' }}>
                        <div style={{
                          fontSize: '10.5pt',
                          fontWeight: '800',
                          color: '#0f172a',
                          lineHeight: '1.25',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {name}
                        </div>
                        <div style={{
                          fontSize: '9.5pt',
                          color: '#1e293b',
                          fontWeight: '700',
                          marginTop: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px'
                        }}>
                          <span style={{ color: '#64748b' }}>S/N: </span>
                          {renderHighlightedSerial(serial)}
                        </div>
                      </div>

                      {/* 2. 하단 렌더링 (모드별 분기) */}
                      {labelMode === 'barcode' && (
                        /* 📊 [바코드 전용 모드] Python generate_labels.py 규격 1:1 완벽 구현 */
                        <div style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          paddingTop: '2px'
                        }}>
                          <BarcodeSvg
                            value={serial}
                            width={1.25}
                            height={42}
                            displayValue={false}
                          />
                        </div>
                      )}

                      {labelMode === 'dual_qr' && (
                        /* 📱 [듀얼 QR 모드] 대여신청 + 반납처리 */
                        <div style={{
                          display: 'flex',
                          gap: '8px',
                          alignItems: 'center',
                          justifyContent: 'space-around',
                          flex: 1,
                          paddingTop: '2px'
                        }}>
                          {/* 대여 신청 QR */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{
                              fontSize: '7pt',
                              fontWeight: '800',
                              color: '#fff',
                              background: '#2563eb',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              marginBottom: '2px'
                            }}>
                              🔵 대여 신청
                            </span>
                            <img
                              src={applyQr}
                              alt="신청"
                              style={{ width: '84px', height: '84px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff' }}
                            />
                          </div>

                          {/* 반납 처리 QR */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{
                              fontSize: '7pt',
                              fontWeight: '800',
                              color: '#fff',
                              background: '#dc2626',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              marginBottom: '2px'
                            }}>
                              🔴 반납 처리
                            </span>
                            <img
                              src={returnQr}
                              alt="반납"
                              style={{ width: '84px', height: '84px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff' }}
                            />
                          </div>
                        </div>
                      )}

                      {labelMode === 'hybrid' && (
                        /* 🏷️ [통합 모드] 바코드 + 대여신청/반납 QR */
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '6px',
                          flex: 1,
                          paddingTop: '2px'
                        }}>
                          {/* 좌측: 바코드 */}
                          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                            <BarcodeSvg
                              value={serial}
                              width={1.05}
                              height={38}
                              displayValue={false}
                            />
                          </div>

                          {/* 우측: 콤팩트 QR */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{
                              fontSize: '6.5pt',
                              fontWeight: '800',
                              color: '#2563eb',
                              marginBottom: '1px'
                            }}>
                              스캔신청
                            </span>
                            <img
                              src={applyQr}
                              alt="신청QR"
                              style={{ width: '56px', height: '56px', border: '1px solid #cbd5e1', borderRadius: '3px', background: '#fff' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </React.Fragment>
          );
        })}
      </main>

      {/* ===== 모달 1: 장비 목록 선택 모달 ===== */}
      {isSelectModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsSelectModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>📋 출력할 장비 선택 (전체 {allEquipments.length}개 중)</h2>
              <button onClick={() => setIsSelectModalOpen(false)} className={styles.modalCloseBtn}>✕</button>
            </div>

            <div className={styles.modalBody}>
              {/* 검색 및 위치 필터 */}
              <div className={styles.tableSearchBox}>
                <input
                  type="text"
                  placeholder="🔍 장비명 또는 시리얼 넘버 검색..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className={styles.formInput}
                  style={{ flex: 1 }}
                />
                <select
                  value={modalLocationFilter}
                  onChange={(e) => setModalLocationFilter(e.target.value)}
                  className={styles.optionSelect}
                  style={{ minWidth: '130px' }}
                >
                  <option value="ALL">전체 위치</option>
                  {uniqueLocations.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              {/* 일괄 선택 컨트롤 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                  필터링된 결과: <strong>{filteredEquipmentsForModal.length}</strong>개
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={handleSelectAllFiltered} className={styles.btnSecondary} style={{ padding: '4px 10px', fontSize: '12px' }}>
                    ✓ 현재 결과 전체 선택
                  </button>
                  <button onClick={handleDeselectAllFiltered} className={styles.btnSecondary} style={{ padding: '4px 10px', fontSize: '12px' }}>
                    ✕ 현재 결과 선택 해제
                  </button>
                </div>
              </div>

              {/* 장비 선택 테이블 */}
              <div className={styles.tableContainer}>
                <table className={styles.selectItemTable}>
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>선택</th>
                      <th>장비명</th>
                      <th>시리얼 넘버</th>
                      <th>보관 위치</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEquipmentsForModal.map(eq => {
                      const isSelected = printQueue.some(item => item.serial === eq.serial);
                      return (
                        <tr
                          key={eq.serial}
                          className={isSelected ? styles.selectedRow : ''}
                          onClick={() => handleModalToggleEquipment(eq)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // 행 클릭으로 토글
                            />
                          </td>
                          <td style={{ fontWeight: '700', color: '#0f172a' }}>{eq.name}</td>
                          <td style={{ fontFamily: 'monospace', color: '#334155' }}>{eq.serial}</td>
                          <td>
                            <span style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>
                              {eq.location}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                onClick={() => setIsSelectModalOpen(false)}
                className={styles.btnPrimary}
              >
                완료 ({printQueue.length}개 장비 선택됨)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 모달 2: 신규 장비 직접 입력 모달 ===== */}
      {isManualModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsManualModalOpen(false)}>
          <div className={styles.modalContent} style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>➕ 신규 장비 직접 입력 추가</h2>
              <button onClick={() => setIsManualModalOpen(false)} className={styles.modalCloseBtn}>✕</button>
            </div>

            <form onSubmit={handleAddManualItem}>
              <div className={styles.modalBody}>
                <div className={styles.manualFormGroup}>
                  <div className={styles.formRow}>
                    <label>장비 제품명 *</label>
                    <input
                      type="text"
                      placeholder="예: Rally Bar, Spot, Connect..."
                      value={manualForm.name}
                      onChange={(e) => setManualForm(prev => ({ ...prev, name: e.target.value }))}
                      className={styles.formInput}
                      required
                      autoFocus
                    />
                  </div>

                  <div className={styles.formRow}>
                    <label>시리얼 넘버 (S/N) *</label>
                    <input
                      type="text"
                      placeholder="예: 2616CGW40X39"
                      value={manualForm.serial}
                      onChange={(e) => setManualForm(prev => ({ ...prev, serial: e.target.value }))}
                      className={styles.formInput}
                      required
                    />
                  </div>

                  <div className={styles.formRow}>
                    <label>출력 라벨 매수</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={manualForm.qty}
                      onChange={(e) => setManualForm(prev => ({ ...prev, qty: parseInt(e.target.value, 10) || 1 }))}
                      className={styles.formInput}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" onClick={() => setIsManualModalOpen(false)} className={styles.btnSecondary}>
                  취소
                </button>
                <button type="submit" className={styles.btnSuccess}>
                  대기열에 추가하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LabelPrintPage;
