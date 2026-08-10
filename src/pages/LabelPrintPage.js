import React, { useState, useEffect, useMemo } from 'react';
import { getEquipmentData } from '../services/api';
import BarcodeSvg from '../components/BarcodeSvg';
import styles from './LabelPrintPage.module.css';

const LabelPrintPage = () => {
  const [domain, setDomain] = useState(
    window.location.origin.includes('localhost') ? 'http://localhost:3000' : 'https://demodevice.kr'
  );
  const [search, setSearch] = useState('');
  const [allEquipments, setAllEquipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 출력 범위 선택: 'queue' (선택 대기열만), '8' (8페이지부터), '1' (1페이지부터 전체)
  const [startPageRange, setStartPageRange] = useState('queue');
  const [sortPage8ByProduct, setSortPage8ByProduct] = useState(true); // 8페이지 이후 제품명 정렬 여부
  const [col2Gap, setCol2Gap] = useState(2.5); // 2번째 열 우측 미세 이동 간격 (mm)
  const [startSlotOffset, setStartSlotOffset] = useState(0); // 1페이지 시작 위치 오프셋 (0~9)
  const [highlightAlpha, setHighlightAlpha] = useState(true); // 영문 음영 강조 여부

  // 선택된 인쇄 대기열: [{ id, name, serial, location, type: 'barcode' | 'qr', qty: number }]
  const [printQueue, setPrintQueue] = useState([]);

  // 신규 장비 직접 입력 상태
  const [isManualAdding, setIsManualAdding] = useState(false);
  const [manualForm, setManualForm] = useState({
    name: '',
    serial: ''
  });

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

        // 초기 기본값: 최근 등록된 10개 장비를 바코드 1장씩 큐에 추가
        if (list.length > 0) {
          const initialQueue = list.slice(0, 10).map(item => ({
            ...item,
            type: 'barcode',
            qty: 1
          }));
          setPrintQueue(initialQueue);
        }
      } catch (err) {
        console.error('장비 데이터 로드 실패:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchEquipments();
  }, []);

  // 좌측 사이드바 필터된 장비 목록
  const filteredEquipments = useMemo(() => {
    return allEquipments.filter(eq => {
      const name = (eq.name || '').toLowerCase();
      const serial = (eq.serial || '').toLowerCase();
      const loc = (eq.location || '').toLowerCase();
      const q = search.toLowerCase().trim();
      return name.includes(q) || serial.includes(q) || loc.includes(q);
    });
  }, [allEquipments, search]);

  // 대기열에 아이템 추가 (type: 'barcode' | 'qr')
  const addToQueue = (item, type = 'barcode') => {
    setPrintQueue(prev => {
      const existingIdx = prev.findIndex(q => q.serial === item.serial && q.type === type);
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx].qty += 1;
        return copy;
      }
      return [...prev, { ...item, type, qty: 1 }];
    });
    // 대기열 뷰로 자동 전환
    if (startPageRange !== 'queue') {
      setStartPageRange('queue');
    }
  };

  // 대기열 수량 조절
  const updateQueueQty = (serial, type, delta) => {
    setPrintQueue(prev => {
      return prev
        .map(q => {
          if (q.serial === serial && q.type === type) {
            const nextQty = q.qty + delta;
            return nextQty > 0 ? { ...q, qty: nextQty } : null;
          }
          return q;
        })
        .filter(Boolean);
    });
  };

  // 대기열에서 아이템 삭제
  const removeFromQueue = (serial, type) => {
    setPrintQueue(prev => prev.filter(q => !(q.serial === serial && q.type === type)));
  };

  // 대기열 전체 비우기
  const clearQueue = () => {
    setPrintQueue([]);
  };

  // 현재 필터된 장비 전체를 바코드로 추가
  const addAllFilteredAsBarcode = () => {
    const newItems = [...printQueue];
    filteredEquipments.forEach(eq => {
      const existing = newItems.find(q => q.serial === eq.serial && q.type === 'barcode');
      if (existing) {
        existing.qty += 1;
      } else {
        newItems.push({ ...eq, type: 'barcode', qty: 1 });
      }
    });
    setPrintQueue(newItems);
    setStartPageRange('queue');
  };

  // 현재 필터된 장비 전체를 QR로 추가
  const addAllFilteredAsQr = () => {
    const newItems = [...printQueue];
    filteredEquipments.forEach(eq => {
      const existing = newItems.find(q => q.serial === eq.serial && q.type === 'qr');
      if (existing) {
        existing.qty += 1;
      } else {
        newItems.push({ ...eq, type: 'qr', qty: 1 });
      }
    });
    setPrintQueue(newItems);
    setStartPageRange('queue');
  };

  // 신규 장비 수동 입력 추가
  const handleAddManualItem = (type = 'barcode') => {
    if (!manualForm.name.trim()) {
      alert('제품명을 입력해 주세요.');
      return;
    }
    if (!manualForm.serial.trim()) {
      alert('시리얼 번호를 입력해 주세요.');
      return;
    }

    const newItem = {
      id: `manual_${Date.now()}`,
      name: manualForm.name.trim(),
      serial: manualForm.serial.trim().toUpperCase(),
      location: '신규등록',
      type: type,
      qty: 1
    };

    setPrintQueue(prev => {
      const existingIdx = prev.findIndex(q => q.serial === newItem.serial && q.type === type);
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx].qty += 1;
        return copy;
      }
      return [newItem, ...prev];
    });

    setManualForm({ name: '', serial: '' });
    setStartPageRange('queue');
  };

  // ===== 최종 출력 데이터 목록 계산 =====
  const targetLabelList = useMemo(() => {
    let rawTarget = [];

    if (startPageRange === 'queue') {
      // 1. 대기열 모드: 각 아이템을 qty 수량만큼 반복
      printQueue.forEach(item => {
        const count = item.qty || 1;
        for (let c = 0; c < count; c++) {
          rawTarget.push({
            ...item,
            isBlank: false,
            uniqueKey: `${item.serial}_${item.type}_${c}`
          });
        }
      });
    } else {
      // 2. 기존 QR 페이지 방식 (8페이지부터 or 1페이지부터 전체)
      const page1To7Items = allEquipments.slice(0, 70).map(eq => ({ ...eq, type: 'qr', qty: 1 }));
      const page8PlusItems = allEquipments.slice(70).map(eq => ({ ...eq, type: 'qr', qty: 1 }));

      const sortedPage8Plus = sortPage8ByProduct ? [...page8PlusItems].sort((a, b) => {
        const nameA = (a.name || '').toString().trim();
        const nameB = (b.name || '').toString().trim();
        return nameA.localeCompare(nameB, 'ko', { numeric: true, sensitivity: 'base' });
      }) : page8PlusItems;

      const baseList = startPageRange === '8' ? sortedPage8Plus : [...page1To7Items, ...sortedPage8Plus];
      rawTarget = baseList.map((eq, idx) => ({
        ...eq,
        isBlank: false,
        uniqueKey: `${eq.serial}_${idx}`
      }));
    }

    // 시작 위치 오프셋 (1페이지 앞부분 빈 슬롯) 적용
    const finalSlots = [];
    for (let i = 0; i < startSlotOffset; i++) {
      finalSlots.push({ isBlank: true, id: `blank_${i}` });
    }
    finalSlots.push(...rawTarget);

    return finalSlots;
  }, [startPageRange, printQueue, allEquipments, sortPage8ByProduct, startSlotOffset]);

  const totalActualLabels = targetLabelList.filter(s => !s.isBlank).length;
  const totalPages = Math.ceil(targetLabelList.length / 10);
  const startPageNum = startPageRange === '8' ? 8 : 1;

  // 시리얼 넘버 영문 하이라이트 포맷 함수
  const formatHighlightedSerial = (serialText) => {
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
                  backgroundColor: '#d9d9d9',
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
            padding: 3.5mm 4.5mm !important;
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
            max-width: 920px;
            margin: 0 auto;
            padding: 10px 0;
          }
          .label-page {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            margin-bottom: 28px;
            padding: 16px;
            background: #ffffff;
            border: 2px dashed #94a3b8;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.04);
          }
          .label-card {
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 12px 14px;
            background: #ffffff;
            min-height: 160px;
            box-sizing: border-box;
            transition: box-shadow 0.15s ease;
          }
          .label-card:hover {
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.06);
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

      {/* ===== 상단 컨트롤 바 (기존 QR 옵션 100% 동일 유지) ===== */}
      <header className={`no-print ${styles.topBar}`}>
        <div className={styles.titleGroup}>
          <h1>🏷️ 장비 바코드 / QR 라벨 출력 센터</h1>
          <p>
            Formtec LS-3510 (88.9 × 52.0mm) · ⚠️ <strong>인쇄 설정: 여백 [없음(None)], 비율 [100%]</strong>
          </p>
        </div>

        <div className={styles.controlsGroup}>
          {/* 출력 범위 선택 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>출력 범위:</span>
            <select
              value={startPageRange}
              onChange={(e) => setStartPageRange(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #2563eb',
                backgroundColor: '#eff6ff',
                fontSize: '13px',
                fontWeight: '700',
                color: '#1e40af'
              }}
            >
              <option value="queue">📋 선택 대기열만 출력 ({printQueue.reduce((a, c) => a + c.qty, 0)}장)</option>
              <option value="8">8페이지부터 전체 출력 (71번째~)</option>
              <option value="1">1페이지부터 전체 출력 (1번째~)</option>
            </select>
          </div>

          {/* 8페이지 이후 제품명 정렬 옵션 */}
          {startPageRange !== 'queue' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12.5px', fontWeight: '600', color: '#334155', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={sortPage8ByProduct}
                onChange={(e) => setSortPage8ByProduct(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              🏷️ 8페이지~ 제품명 정렬
            </label>
          )}

          {/* 도메인 선택 */}
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className={styles.optionSelect}
          >
            <option value="https://demodevice.kr">demodevice.kr (운영)</option>
            <option value="http://localhost:3000">localhost:3000 (로컬)</option>
          </select>

          {/* 2열 이동 간격 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>2열 이동:</span>
            <select
              value={col2Gap}
              onChange={(e) => setCol2Gap(parseFloat(e.target.value))}
              className={styles.optionSelect}
            >
              <option value={0}>0 mm (기본)</option>
              <option value={1.5}>+1.5 mm</option>
              <option value={2.0}>+2.0 mm</option>
              <option value={2.5}>+2.5 mm (추천)</option>
              <option value={3.0}>+3.0 mm</option>
              <option value={3.5}>+3.5 mm</option>
              <option value={4.0}>+4.0 mm</option>
            </select>
          </div>

          {/* 시작 위치 오프셋 */}
          <select
            value={startSlotOffset}
            onChange={(e) => setStartSlotOffset(parseInt(e.target.value, 10))}
            className={styles.optionSelect}
            title="첫 페이지 시작 칸 번호"
          >
            <option value={0}>시작: 1번째 칸 (새 라벨지)</option>
            <option value={1}>시작: 2번째 칸부터</option>
            <option value={2}>시작: 3번째 칸부터</option>
            <option value={3}>시작: 4번째 칸부터</option>
            <option value={4}>시작: 5번째 칸부터</option>
            <option value={5}>시작: 6번째 칸부터</option>
            <option value={6}>시작: 7번째 칸부터</option>
            <option value={7}>시작: 8번째 칸부터</option>
            <option value={8}>시작: 9번째 칸부터</option>
            <option value={9}>시작: 10번째 칸부터</option>
          </select>

          {/* 영문 하이라이트 */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={highlightAlpha}
              onChange={(e) => setHighlightAlpha(e.target.checked)}
            />
            <span>영문 음영</span>
          </label>

          {/* 인쇄 버튼 */}
          <button
            onClick={() => window.print()}
            className={styles.btnPrimary}
            disabled={totalActualLabels === 0}
          >
            🖨️ 라벨 인쇄 ({totalActualLabels}장)
          </button>
        </div>
      </header>

      {/* ===== 2열 분할 레이아웃 (좌측 제품 선택 사이드바 + 우측 라벨 시트 프리뷰) ===== */}
      <div className={styles.splitLayout}>
        {/* 좌측 사이드바: 제품 리스트 및 바코드/QR 선택 */}
        <aside className={`no-print ${styles.leftSidebar}`}>
          <div className={styles.sidebarHeader}>
            <div className={styles.sidebarTitle}>
              <span>📦 장비 목록 ({filteredEquipments.length}개)</span>
              <button
                onClick={() => setIsManualAdding(!isManualAdding)}
                className={styles.quickBtn}
                style={{ color: '#16a34a', fontWeight: '700' }}
              >
                {isManualAdding ? '✕ 닫기' : '➕ 신규 직접 입력'}
              </button>
            </div>

            {/* 검색창 */}
            <div className={styles.searchBox}>
              <input
                type="text"
                placeholder="🔍 제품명, 시리얼, 위치 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={styles.searchInput}
              />
            </div>

            {/* 빠른 일괄 추가 버튼 */}
            <div className={styles.quickActionBtns}>
              <button onClick={addAllFilteredAsBarcode} className={styles.quickBtn}>
                + 전체 바코드 추가
              </button>
              <button onClick={addAllFilteredAsQr} className={styles.quickBtn}>
                + 전체 QR 추가
              </button>
              <button onClick={clearQueue} className={styles.quickBtn} style={{ color: '#dc2626' }}>
                🧹 비우기
              </button>
            </div>

            {/* 신규 장비 직접 입력 인라인 폼 */}
            {isManualAdding && (
              <div className={styles.manualAddCard}>
                <h4>➕ 신규 미등록 장비 라벨 생성</h4>
                <div className={styles.manualInputRow}>
                  <input
                    type="text"
                    placeholder="제품명 (예: Spot, Rally Bar)"
                    value={manualForm.name}
                    onChange={(e) => setManualForm(prev => ({ ...prev, name: e.target.value }))}
                    className={styles.manualInput}
                  />
                  <input
                    type="text"
                    placeholder="S/N (예: 2616CGW40X39)"
                    value={manualForm.serial}
                    onChange={(e) => setManualForm(prev => ({ ...prev, serial: e.target.value }))}
                    className={styles.manualInput}
                  />
                </div>
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                  <button onClick={() => handleAddManualItem('barcode')} className={styles.btnBarcodeAdd}>
                    + 바코드 추가
                  </button>
                  <button onClick={() => handleAddManualItem('qr')} className={styles.btnQrAdd}>
                    + QR 추가
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 장비 카드 리스트 */}
          <div className={styles.equipmentListScroll}>
            {loading && (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: '#64748b', fontSize: '13px' }}>
                ⏳ 장비 데이터 로딩 중...
              </div>
            )}
            {error && (
              <div style={{ textAlign: 'center', padding: '20px 10px', color: '#dc2626', fontSize: '12px' }}>
                ❌ 로드 실패: {error}
              </div>
            )}

            {!loading && !error && filteredEquipments.map((eq) => {
              const barcodeItem = printQueue.find(q => q.serial === eq.serial && q.type === 'barcode');
              const qrItem = printQueue.find(q => q.serial === eq.serial && q.type === 'qr');
              const inQueue = Boolean(barcodeItem || qrItem);

              return (
                <div key={eq.serial} className={`${styles.equipmentCard} ${inQueue ? styles.inQueue : ''}`}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardName}>{eq.name}</span>
                    <span className={styles.cardLocation}>{eq.location || '본사'}</span>
                  </div>
                  <div className={styles.cardSerial}>
                    S/N: {eq.serial}
                  </div>

                  <div className={styles.cardActionRow}>
                    {/* 바코드 추가/수량 */}
                    {barcodeItem ? (
                      <div className={`${styles.queueBadge} ${styles.barcode}`}>
                        <span>바코드:</span>
                        <button onClick={() => updateQueueQty(eq.serial, 'barcode', -1)} className={styles.badgeQtyBtn}>-</button>
                        <span>{barcodeItem.qty}장</span>
                        <button onClick={() => updateQueueQty(eq.serial, 'barcode', 1)} className={styles.badgeQtyBtn}>+</button>
                        <button onClick={() => removeFromQueue(eq.serial, 'barcode')} style={{ border: 'none', background: 'transparent', color: '#6b7280', cursor: 'pointer', marginLeft: '2px' }}>×</button>
                      </div>
                    ) : (
                      <button onClick={() => addToQueue(eq, 'barcode')} className={styles.btnBarcodeAdd}>
                        + 바코드
                      </button>
                    )}

                    {/* QR 추가/수량 */}
                    {qrItem ? (
                      <div className={`${styles.queueBadge} ${styles.qr}`}>
                        <span>QR:</span>
                        <button onClick={() => updateQueueQty(eq.serial, 'qr', -1)} className={styles.badgeQtyBtn}>-</button>
                        <span>{qrItem.qty}장</span>
                        <button onClick={() => updateQueueQty(eq.serial, 'qr', 1)} className={styles.badgeQtyBtn}>+</button>
                        <button onClick={() => removeFromQueue(eq.serial, 'qr')} style={{ border: 'none', background: 'transparent', color: '#6b7280', cursor: 'pointer', marginLeft: '2px' }}>×</button>
                      </div>
                    ) : (
                      <button onClick={() => addToQueue(eq, 'qr')} className={styles.btnQrAdd}>
                        + QR
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 사이드바 하단 요약 */}
          <div className={styles.sidebarFooter}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#1e40af' }}>
              선택 대기열: {printQueue.reduce((a, c) => a + c.qty, 0)}장
            </span>
            <button
              onClick={() => setStartPageRange('queue')}
              className={styles.quickBtn}
              style={{ background: startPageRange === 'queue' ? '#2563eb' : '#fff', color: startPageRange === 'queue' ? '#fff' : '#334155' }}
            >
              대기열만 보기
            </button>
          </div>
        </aside>

        {/* 우측 메인 뷰: Formtec LS-3510 라벨지 실물 미리보기 & 인쇄 영역 */}
        <main className={styles.rightMain}>
          <div className="label-sheet-wrapper">
            {totalActualLabels === 0 && !loading && (
              <div className="no-print" style={{ textAlign: 'center', padding: '80px 20px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏷️</div>
                <h3 style={{ fontSize: '18px', color: '#334155', marginBottom: '8px' }}>출력할 라벨이 없습니다</h3>
                <p style={{ fontSize: '13px', color: '#64748b' }}>
                  좌측 장비 목록에서 <strong>[+ 바코드]</strong> 또는 <strong>[+ QR]</strong> 버튼을 눌러 라벨을 추가해 주세요.
                </p>
              </div>
            )}

            {Array.from({ length: totalPages }, (_, pageIdx) => {
              const pageSlots = targetLabelList.slice(pageIdx * 10, (pageIdx + 1) * 10);
              const actualPageNum = pageIdx + startPageNum;

              return (
                <React.Fragment key={pageIdx}>
                  {/* 페이지 헤더 (화면 전용) */}
                  <div className="no-print" style={{ fontSize: '13px', fontWeight: '800', color: '#334155', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>📄 {actualPageNum}페이지</span>
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>
                        (슬롯 {pageIdx * 10 + 1} ~ {Math.min((pageIdx + 1) * 10, targetLabelList.length)}번째)
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
                            <span>[빈 슬롯 (시작 위치 오프셋)]</span>
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
                            boxSizing: 'border-box',
                            fontFamily: "'Malgun Gothic', '맑은 고딕', 'Noto Sans KR', 'Inter', -apple-system, sans-serif"
                          }}
                        >
                          {/* 0. 상단 공통 헤더: 회사 로고 & 연락처 */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px', marginBottom: '3px' }}>
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

                          {/* 1. 장비명 & 시리얼 번호 */}
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
                              {formatHighlightedSerial(serial)}
                            </div>
                          </div>

                          {/* 2. 하단 렌더링: 바코드 or QR 선택에 따라 렌더링 */}
                          {slot.type === 'barcode' ? (
                            /* 📊 [바코드 라벨] Python generate_labels.py 규격 1:1 완벽 구현 */
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
                          ) : (
                            /* 📱 [듀얼 QR 라벨] 대여신청 + 반납처리 */
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
                        </div>
                      );
                    })}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
};

export default LabelPrintPage;
