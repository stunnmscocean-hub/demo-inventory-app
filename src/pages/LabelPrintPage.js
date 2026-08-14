import React, { useState, useEffect, useMemo } from 'react';
import { getEquipmentData } from '../services/api';
import BarcodeSvg from '../components/BarcodeSvg';
import styles from './LabelPrintPage.module.css';

const LabelPrintPage = () => {
  const [domain, setDomain] = useState(
    window.location.origin.includes('localhost') ? 'http://localhost:3000' : 'https://demodevice.kr'
  );
  const [allEquipments, setAllEquipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 다중 시리얼 넘버 텍스트 입력 상태
  const [serialInputText, setSerialInputText] = useState('');

  // 사용자가 수정한 장비명 맵: { [serial]: customName }
  const [customNameMap, setCustomNameMap] = useState({});

  // 선택된 인쇄 대기열: [{ id, name, serial, location, type: 'barcode' | 'qr', qty: number }]
  // 기본값: 0개 (빈 목록)
  const [printQueue, setPrintQueue] = useState([]);

  // 인쇄 옵션 (기존 QR 인쇄 설정과 100% 동일)
  const [col2Gap, setCol2Gap] = useState(2.5); // 2번째 열 우측 미세 이동 간격 (mm)
  const [startSlotOffset, setStartSlotOffset] = useState(0); // 1페이지 시작 위치 오프셋 (0~9)
  const [highlightAlpha, setHighlightAlpha] = useState(true); // 영문 음영 강조 여부

  // 구글 시트에서 전체 장비 마스터 데이터 로드
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

        setAllEquipments(Array.from(serialMap.values()));
      } catch (err) {
        console.error('장비 데이터 로드 실패:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchEquipments();
  }, []);

  // 시리얼 넘버 데이터베이스 검색용 인덱스 맵 (대소문자/특수문자 무시)
  const equipmentLookupMap = useMemo(() => {
    const map = new Map();
    allEquipments.forEach(eq => {
      const clean = eq.serial.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      map.set(clean, eq);
    });
    return map;
  }, [allEquipments]);

  // 입력된 텍스트에서 시리얼 넘버들을 파싱하여 장비 객체 목록 생성
  const parsedEnteredItems = useMemo(() => {
    if (!serialInputText.trim()) return [];

    const lines = serialInputText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    return lines.map((line, idx) => {
      const trimmedSerial = line;
      const clean = trimmedSerial.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const matched = equipmentLookupMap.get(clean);

      const defaultName = matched ? matched.name : '신규 등록 제품';
      const finalName = customNameMap[trimmedSerial] || defaultName;
      const location = matched ? (matched.location || '본사') : '신규등록';

      return {
        id: `entered_${idx}_${trimmedSerial}`,
        serial: trimmedSerial,
        name: finalName,
        location: location,
        isMatched: Boolean(matched)
      };
    });
  }, [serialInputText, equipmentLookupMap, customNameMap]);

  // 제품명 직접 수정
  const handleNameChange = (serial, newName) => {
    setCustomNameMap(prev => ({ ...prev, [serial]: newName }));
  };

  // 대기열에 아이템 추가
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

  // 입력된 모든 장비를 바코드로 일괄 추가
  const handleAddAllAsBarcode = () => {
    if (parsedEnteredItems.length === 0) {
      alert('시리얼 넘버를 먼저 입력해 주세요.');
      return;
    }
    parsedEnteredItems.forEach(item => {
      addToQueue(item, 'barcode');
    });
  };

  // 입력된 모든 장비를 QR로 일괄 추가
  const handleAddAllAsQr = () => {
    if (parsedEnteredItems.length === 0) {
      alert('시리얼 넘버를 먼저 입력해 주세요.');
      return;
    }
    parsedEnteredItems.forEach(item => {
      addToQueue(item, 'qr');
    });
  };

  // 텍스트 및 대기열 전체 비우기
  const handleResetAll = () => {
    setSerialInputText('');
    setPrintQueue([]);
  };

  // 예시 시리얼 넘버 입력
  const handleLoadSampleSerials = () => {
    const sample = [
      '2233FD2H3N58',
      '2445WDU0SLA8',
      '7276FF0045060FA2',
      '7276FF0045060F90',
      '2621DM1G0DT9',
      '2621DMSG0069',
      '2616CG141WP9'
    ].join('\n');
    setSerialInputText(sample);
  };

  // ===== 최종 출력 데이터 목록 계산 =====
  const targetLabelList = useMemo(() => {
    const rawTarget = [];

    // 대기열 아이템들을 qty 수량만큼 반복
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

    // 시작 위치 오프셋 (1페이지 앞부분 빈 슬롯) 적용
    const finalSlots = [];
    for (let i = 0; i < startSlotOffset; i++) {
      finalSlots.push({ isBlank: true, id: `blank_${i}` });
    }
    finalSlots.push(...rawTarget);

    return finalSlots;
  }, [printQueue, startSlotOffset]);

  const totalActualLabels = targetLabelList.filter(s => !s.isBlank).length;
  const totalPages = Math.ceil(targetLabelList.length / 10);

  // 기존 QrPrintPage.js와 100% 동일한 시리얼 포맷 함수 (QR 라벨용)
  const formatSerial = (serialText) => {
    if (!serialText) return '';
    const parts = serialText.toString().split(/([a-zA-Z가-힣_#-]+)/g);
    return (
      <span>
        {parts.map((part, index) => {
          if (!part) return null;
          if (highlightAlpha && /[a-zA-Z가-힣_#-]/.test(part)) {
            return <span key={index} style={{ backgroundColor: '#d9d9d9' }}>{part}</span>;
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
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          /* 부모 레이아웃의 고정 높이 및 overflow:hidden 완전 해제 */
          div, main, aside, section, article {
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            position: static !important;
          }
          .label-sheet-wrapper {
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            display: block !important;
          }
          .label-page {
            width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            max-height: 297mm !important;
            padding-top: 17mm !important;
            padding-left: 16.1mm !important;
            padding-right: 16.1mm !important;
            page-break-before: auto !important;
            page-break-after: always !important;
            break-after: page !important;
            box-sizing: border-box !important;
            display: grid !important;
            grid-template-columns: 88.9mm 88.9mm !important;
            grid-template-rows: repeat(5, 52mm) !important;
            column-gap: ${col2Gap}mm !important;
            row-gap: 0 !important;
            background: #fff !important;
            overflow: hidden !important;
          }
          .label-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
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

      {/* ===== 2열 분할 레이아웃 (좌측 시리얼 입력/제품 스택 + 우측 라벨 시트 프리뷰) ===== */}
      <div className={styles.splitLayout}>
        {/* 좌측 패널: 시리얼 넘버 다중 입력 & 제품 스택 */}
        <aside className={`no-print ${styles.leftSidebar}`}>
          <div className={styles.sidebarHeader}>
            <div className={styles.sidebarTitle}>
              <span>📝 시리얼 넘버 입력 (줄바꿈 구분)</span>
              <button onClick={handleLoadSampleSerials} className={styles.btnReset} style={{ padding: '2px 6px', fontSize: '11px' }}>
                샘플 입력
              </button>
            </div>

            {/* 다중 시리얼 넘버 텍스트에어리어 */}
            <textarea
              className={styles.serialTextarea}
              placeholder="시리얼 넘버를 줄바꿈(엔터)하여 붙여넣으세요.&#13;&#10;예:&#13;&#10;2233FD2H3N58&#13;&#10;2445WDU0SLA8&#13;&#10;7276FF0045060FA2"
              value={serialInputText}
              onChange={(e) => setSerialInputText(e.target.value)}
            />

            {/* 일괄 추가 버튼 영역 */}
            <div className={styles.batchActionRow}>
              <button
                onClick={handleAddAllAsBarcode}
                className={styles.btnBatchBarcode}
                disabled={parsedEnteredItems.length === 0}
              >
                📊 + 전체 바코드 추가 ({parsedEnteredItems.length})
              </button>
              <button
                onClick={handleAddAllAsQr}
                className={styles.btnBatchQr}
                disabled={parsedEnteredItems.length === 0}
              >
                📱 + 전체 QR 추가 ({parsedEnteredItems.length})
              </button>
              <button
                onClick={handleResetAll}
                className={styles.btnReset}
                title="전체 비우기"
              >
                🧹 비우기
              </button>
            </div>
          </div>

          {/* 파싱된 장비 카드 스택 리스트 */}
          <div className={styles.equipmentListScroll}>
            <div className={styles.listHeaderInfo}>
              <span>인식된 제품 목록 ({parsedEnteredItems.length}개)</span>
              {loading && <span style={{ color: '#2563eb' }}>데이터 조회 중...</span>}
            </div>

            {error && (
              <div style={{ textAlign: 'center', padding: '10px', color: '#dc2626', fontSize: '12px' }}>
                ❌ 로드 실패: {error}
              </div>
            )}

            {parsedEnteredItems.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: '#94a3b8', fontSize: '12.5px' }}>
                위 텍스트창에 시리얼 넘버를 붙여넣으시면<br />
                구글 시트에서 제품명을 자동 조회하여<br />
                이곳에 제품 카드가 차곡차곡 쌓입니다.
              </div>
            )}

            {parsedEnteredItems.map((item, idx) => {
              const barcodeItem = printQueue.find(q => q.serial === item.serial && q.type === 'barcode');
              const qrItem = printQueue.find(q => q.serial === item.serial && q.type === 'qr');
              const inQueue = Boolean(barcodeItem || qrItem);

              return (
                <div key={`${item.serial}_${idx}`} className={`${styles.equipmentCard} ${inQueue ? styles.inQueue : ''}`}>
                  <div className={styles.cardHeader}>
                    {/* 제품명 (수정 가능 인풋) */}
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleNameChange(item.serial, e.target.value)}
                      style={{
                        fontSize: '13px',
                        fontWeight: '800',
                        color: '#0f172a',
                        border: 'none',
                        borderBottom: '1px dotted #cbd5e1',
                        background: 'transparent',
                        padding: '1px 2px',
                        outline: 'none',
                        width: '75%'
                      }}
                      title="제품명을 수정할 수 있습니다"
                    />
                    <span className={styles.cardLocation} style={{ background: item.isMatched ? '#f1f5f9' : '#fef3c7', color: item.isMatched ? '#475569' : '#b45309' }}>
                      {item.isMatched ? item.location : '신규미등록'}
                    </span>
                  </div>

                  <div className={styles.cardSerial}>
                    S/N: {item.serial}
                  </div>

                  <div className={styles.cardActionRow}>
                    {/* 바코드 버튼/수량 */}
                    {barcodeItem ? (
                      <div className={`${styles.queueBadge} ${styles.barcode}`}>
                        <span>바코드:</span>
                        <button onClick={() => updateQueueQty(item.serial, 'barcode', -1)} className={styles.badgeQtyBtn}>-</button>
                        <span>{barcodeItem.qty}장</span>
                        <button onClick={() => updateQueueQty(item.serial, 'barcode', 1)} className={styles.badgeQtyBtn}>+</button>
                        <button onClick={() => removeFromQueue(item.serial, 'barcode')} style={{ border: 'none', background: 'transparent', color: '#6b7280', cursor: 'pointer', marginLeft: '2px' }}>×</button>
                      </div>
                    ) : (
                      <button onClick={() => addToQueue(item, 'barcode')} className={styles.btnBarcodeAdd}>
                        + 바코드
                      </button>
                    )}

                    {/* QR 버튼/수량 */}
                    {qrItem ? (
                      <div className={`${styles.queueBadge} ${styles.qr}`}>
                        <span>QR:</span>
                        <button onClick={() => updateQueueQty(item.serial, 'qr', -1)} className={styles.badgeQtyBtn}>-</button>
                        <span>{qrItem.qty}장</span>
                        <button onClick={() => updateQueueQty(item.serial, 'qr', 1)} className={styles.badgeQtyBtn}>+</button>
                        <button onClick={() => removeFromQueue(item.serial, 'qr')} style={{ border: 'none', background: 'transparent', color: '#6b7280', cursor: 'pointer', marginLeft: '2px' }}>×</button>
                      </div>
                    ) : (
                      <button onClick={() => addToQueue(item, 'qr')} className={styles.btnQrAdd}>
                        + QR
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 사이드바 하단 큐 요약 */}
          <div className={styles.sidebarFooter}>
            <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#1e40af' }}>
              📦 인쇄 대기열: {printQueue.reduce((a, c) => a + c.qty, 0)}장
            </span>
            <span style={{ fontSize: '11.5px', color: '#64748b' }}>
              (A4 {totalPages}페이지 소요)
            </span>
          </div>
        </aside>

        {/* 우측 메인 뷰: Formtec LS-3510 라벨지 실물 미리보기 & 인쇄 영역 */}
        <main className={styles.rightMain}>
          <div className="label-sheet-wrapper">
            {totalActualLabels === 0 && (
              <div className="no-print" style={{ textAlign: 'center', padding: '80px 20px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏷️</div>
                <h3 style={{ fontSize: '18px', color: '#334155', marginBottom: '8px' }}>출력 대기열이 비어 있습니다</h3>
                <p style={{ fontSize: '13px', color: '#64748b' }}>
                  좌측 입력창에 시리얼 넘버를 입력하신 후<br />
                  <strong>[📊 + 전체 바코드 추가]</strong> 또는 <strong>[📱 + 전체 QR 추가]</strong> 버튼을 누르시면<br />
                  이곳에 실물 폼텍 라벨지가 즉시 렌더링됩니다.
                </p>
              </div>
            )}

            {Array.from({ length: totalPages }, (_, pageIdx) => {
              const pageSlots = targetLabelList.slice(pageIdx * 10, (pageIdx + 1) * 10);
              const actualPageNum = pageIdx + 1;

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

                      return slot.type === 'barcode' ? (
                        /* 📊 [바코드 라벨 전용: Python generate_labels.py 규격 100% 동일] */
                        <div
                          key={slot.uniqueKey || slotIdx}
                          className="label-card label-barcode-card"
                          style={{
                            width: '88.9mm',
                            height: '52mm',
                            padding: '3.5mm 10mm',
                            boxSizing: 'border-box',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'flex-start',
                            fontFamily: "'Malgun Gothic', '맑은 고딕', 'Noto Sans KR', sans-serif",
                            background: '#ffffff'
                          }}
                        >
                          {/* 0. Logo and Header (8mm logo + 8pt text) */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '2mm', marginBottom: '3.5mm' }}>
                            <img
                              src="/logo_ocean.png"
                              alt="Logo"
                              style={{ width: '8mm', height: '8mm', objectFit: 'contain' }}
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                            <span style={{ fontSize: '8pt', color: '#000000', fontWeight: '400', whiteSpace: 'nowrap' }}>
                              오우션테크놀러지 Demo Device (02-2188-7737)
                            </span>
                          </div>

                          {/* 1. Product Name (10pt regular/bold black) */}
                          <div style={{
                            fontSize: '10pt',
                            fontWeight: '600',
                            color: '#000000',
                            lineHeight: '1.2',
                            marginBottom: '2.5mm',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {name}
                          </div>

                          {/* 2. Serial Number (10pt, S/N: + alphabet highlighted) */}
                          <div style={{
                            fontSize: '10pt',
                            color: '#000000',
                            fontWeight: '400',
                            marginBottom: '3mm',
                            display: 'flex',
                            alignItems: 'center'
                          }}>
                            <span>S/N:&nbsp;</span>
                            {formatSerial(serial)}
                          </div>

                          {/* 3. Barcode (Left-aligned, height 13mm, barWidth 1.1) */}
                          <div style={{ marginTop: 'auto', marginBottom: '1.5mm', display: 'flex', justifyContent: 'flex-start' }}>
                            <BarcodeSvg
                              value={serial}
                              width={1.1}
                              height={46}
                              displayValue={false}
                            />
                          </div>
                        </div>
                      ) : (
                        /* 📱 [듀얼 QR 라벨 전용: QrPrintPage.js 규격 100% 동일] */
                        <div
                          key={slot.uniqueKey || slotIdx}
                          className="label-card label-qr-card"
                          style={{
                            width: '88.9mm',
                            height: '52mm',
                            padding: '3.5mm 4.5mm',
                            boxSizing: 'border-box',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            fontFamily: "'Noto Sans KR', 'Inter', sans-serif",
                            background: '#ffffff'
                          }}
                        >
                          {/* 0. 헤더: 회사명 & 연락처 (하단 구분선) */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '8px', fontWeight: '700', color: '#334155' }}>
                              오우션테크놀러지 Demo Device
                            </span>
                            <span style={{ fontSize: '7.5px', color: '#64748b' }}>
                              02-2188-7737
                            </span>
                          </div>

                          {/* 1. 상단: 장비명 + 시리얼 */}
                          <div style={{ marginBottom: '4px' }}>
                            <div style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a', lineHeight: '1.25', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {name}
                            </div>
                            <div style={{ fontSize: '10.5px', color: '#334155', fontWeight: '700', fontFamily: "'Inter', monospace", marginTop: '2px' }}>
                              S/N: {formatSerial(serial)}
                            </div>
                          </div>

                          {/* 2. 하단: 듀얼 QR (대여신청 + 반납처리) */}
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-around', flex: 1 }}>
                            {/* 대여 신청 QR */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <span style={{
                                fontSize: '8px', fontWeight: '800', color: '#fff', background: '#2563eb',
                                padding: '1.5px 6px', borderRadius: '3px', marginBottom: '3px', letterSpacing: '-0.3px'
                              }}>🔵 대여 신청</span>
                              <img src={applyQr} alt="신청" style={{ width: '92px', height: '92px', border: '1px solid #94a3b8', borderRadius: '4px', background: '#fff' }} />
                            </div>

                            {/* 반납 처리 QR */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <span style={{
                                fontSize: '8px', fontWeight: '800', color: '#fff', background: '#dc2626',
                                padding: '1.5px 6px', borderRadius: '3px', marginBottom: '3px', letterSpacing: '-0.3px'
                              }}>🔴 반납 처리</span>
                              <img src={returnQr} alt="반납" style={{ width: '92px', height: '92px', border: '1px solid #94a3b8', borderRadius: '4px', background: '#fff' }} />
                            </div>
                          </div>
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
