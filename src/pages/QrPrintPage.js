import React, { useState, useEffect, useMemo } from 'react';
import { getEquipmentData } from '../services/api';

const QrPrintPage = () => {
  const [domain, setDomain] = useState(window.location.origin.includes('localhost') ? 'http://localhost:3000' : 'https://demodevice.kr');
  const [search, setSearch] = useState('');
  const [allEquipments, setAllEquipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [startPageRange, setStartPageRange] = useState('8'); // 기본값: 8페이지부터 출력 (71번째~)
  const [startSlotOffset, setStartSlotOffset] = useState(0); // 1페이지 시작 칸 오프셋 (0~9)
  const [sortPage8ByProduct, setSortPage8ByProduct] = useState(true); // 8페이지 이후 제품명 정렬 여부
  const [col2Gap, setCol2Gap] = useState(2.5); // 2번째 열 우측 미세 이동 간격 (mm)

  // 구글 시트에서 전체 장비 데이터 가져오기
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

        console.log('📦 [QR 라벨] API 응답 타입:', typeof data, '추출된 장비 수:', rawList.length);

        const serialMap = new Map();
        [...rawList].reverse().forEach(item => {
          const serial = (item.serial || item.serialNumber || item['시리얼넘버'] || '').toString().trim();
          if (serial && !serialMap.has(serial)) {
            serialMap.set(serial, {
              name: item.name || item['장비명'] || item['이름'] || '',
              serial: serial
            });
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

  const filtered = useMemo(() => {
    return allEquipments.filter(eq => {
      const name = (eq.name || '').toLowerCase();
      const serial = (eq.serial || '').toLowerCase();
      const q = search.toLowerCase().trim();
      return name.includes(q) || serial.includes(q);
    });
  }, [allEquipments, search]);

  // 1. 1~7페이지(1~70번째 장비)와 8페이지 이후(71번째 장비~) 분리 및 정렬
  const targetEquipments = useMemo(() => {
    const page1To7Items = filtered.slice(0, 70);
    const page8PlusItems = filtered.slice(70);

    const sortedPage8Plus = sortPage8ByProduct ? [...page8PlusItems].sort((a, b) => {
      const nameA = (a.name || '').toString().trim();
      const nameB = (b.name || '').toString().trim();
      return nameA.localeCompare(nameB, 'ko', { numeric: true, sensitivity: 'base' });
    }) : page8PlusItems;

    return startPageRange === '8' ? sortedPage8Plus : [...page1To7Items, ...sortedPage8Plus];
  }, [filtered, sortPage8ByProduct, startPageRange]);

  const startPageNum = startPageRange === '8' ? 8 : 1;

  // 4. 시작 위치 오프셋 (1페이지 앞부분 빈 슬롯) 적용 - 용지 재활용 건너뛰기
  const targetSlots = useMemo(() => {
    const slots = [];
    for (let i = 0; i < startSlotOffset; i++) {
      slots.push({ isBlank: true, id: `blank_${i}` });
    }
    targetEquipments.forEach((eq, idx) => {
      slots.push({
        ...eq,
        isBlank: false,
        slotKey: `eq_${eq.serial || idx}`
      });
    });
    return slots;
  }, [targetEquipments, startSlotOffset]);

  const formatSerial = (serialText) => {
    if (!serialText) return '';
    const parts = serialText.toString().split(/([a-zA-Z가-힣_#-]+)/g);
    return (
      <span>
        {parts.map((part, index) => {
          if (!part) return null;
          if (/[a-zA-Z가-힣_#-]/.test(part)) {
            return <span key={index} style={{ backgroundColor: '#d9d9d9' }}>{part}</span>;
          }
          return <span key={index}>{part}</span>;
        })}
      </span>
    );
  };

  return (
    <div style={{ fontFamily: "'Noto Sans KR', 'Inter', sans-serif", backgroundColor: '#f1f5f9', minHeight: '100vh' }}>
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
          .label-sheet {
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
            border: none !important;
            background: transparent !important;
          }
        }

        @media screen {
          .label-sheet {
            max-width: 900px;
            margin: 0 auto;
            padding: 24px;
          }
          .label-page {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            margin-bottom: 32px;
            padding: 16px;
            background: #fff;
            border: 2px dashed #94a3b8;
            border-radius: 12px;
          }
          .label-card {
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 12px;
            background: #fff;
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
            min-height: 160px;
          }
        }
      `}</style>

      {/* ===== 상단 컨트롤 바 (화면에서만 표시) ===== */}
      <div className="no-print" style={{
        background: '#ffffff',
        padding: '16px 24px',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', margin: '0 0 4px 0' }}>
            🏷️ 장비 QR 라벨 출력 (Formtec LS-3510)
          </h1>
          <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
            88.9×52mm 라벨지 · 2열×5행 · ⚠️ <strong>인쇄 설정: 여백 [없음(None)], 비율 [100%]</strong>
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* 출력 범위 선택 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>출력 범위:</span>
            <select
              value={startPageRange}
              onChange={(e) => setStartPageRange(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #2563eb', backgroundColor: '#eff6ff', fontSize: '13px', fontWeight: '700', color: '#1e40af' }}
            >
              <option value="8">8페이지부터 출력 (71번째~)</option>
              <option value="1">1페이지부터 전체 출력 (1번째~)</option>
            </select>
          </div>

          {/* 시작 위치 오프셋 (칸 건너뛰기) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>시작 칸:</span>
            <select
              value={startSlotOffset}
              onChange={(e) => setStartSlotOffset(parseInt(e.target.value, 10))}
              title="첫 페이지 시작 칸 번호 (용지 재활용 건너뛰기)"
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #10b981',
                backgroundColor: startSlotOffset > 0 ? '#ecfdf5' : '#ffffff',
                fontSize: '13px',
                fontWeight: '700',
                color: startSlotOffset > 0 ? '#047857' : '#334155'
              }}
            >
              <option value={0}>시작: 1번째 칸 (새 라벨지)</option>
              <option value={1}>시작: 2번째 칸부터 (1칸 건너뜀)</option>
              <option value={2}>시작: 3번째 칸부터 (2칸 건너뜀)</option>
              <option value={3}>시작: 4번째 칸부터 (3칸 건너뜀)</option>
              <option value={4}>시작: 5번째 칸부터 (4칸 건너뜀)</option>
              <option value={5}>시작: 6번째 칸부터 (5칸 건너뜀)</option>
              <option value={6}>시작: 7번째 칸부터 (6칸 건너뜀)</option>
              <option value={7}>시작: 8번째 칸부터 (7칸 건너뜀)</option>
              <option value={8}>시작: 9번째 칸부터 (8칸 건너뜀)</option>
              <option value={9}>시작: 10번째 칸부터 (9칸 건너뜀)</option>
            </select>
          </div>

          {/* 8페이지 이후 제품명 정렬 옵션 */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: '600', color: '#334155', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={sortPage8ByProduct}
              onChange={(e) => setSortPage8ByProduct(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            🏷️ 8페이지~ 제품명 정렬
          </label>

          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
          >
            <option value="https://demodevice.kr">demodevice.kr (운영)</option>
            <option value="http://localhost:3000">localhost:3000 (로컬)</option>
          </select>

          <input
            type="text"
            placeholder="장비/시리얼 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', width: '140px' }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>2열 이동:</span>
            <select
              value={col2Gap}
              onChange={(e) => setCol2Gap(parseFloat(e.target.value))}
              style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '600' }}
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

          <button
            onClick={() => window.print()}
            style={{
              backgroundColor: '#2563eb',
              color: '#fff',
              fontWeight: '700',
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            🖨️ 라벨 인쇄
          </button>
        </div>
      </div>

      {/* 로딩/에러 */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>⏳ 장비 데이터 로딩 중...</div>
      )}
      {error && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#dc2626', background: '#fef2f2', margin: '24px', borderRadius: '8px' }}>
          ❌ 로드 실패: {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* 장비 수 및 팁 */}
          <div className="no-print" style={{ maxWidth: '900px', margin: '16px auto 8px', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#1e40af', fontWeight: '700', background: '#dbeafe', padding: '4px 10px', borderRadius: '6px' }}>
              📦 {startPageRange === '8' ? '8페이지부터 출력 중' : '전체 출력 중'} · 총 {targetEquipments.length}개 장비 {startSlotOffset > 0 ? `(첫 장 ${startSlotOffset + 1}번째 칸부터 시작)` : ''} · 총 {Math.ceil(targetSlots.length / 10)}페이지 {sortPage8ByProduct ? '(8페이지~ 제품명 가나다순 정렬 적용)' : ''}
            </span>
            <span style={{ fontSize: '12px', color: '#0284c7', background: '#e0f2fe', padding: '4px 10px', borderRadius: '4px', fontWeight: '500' }}>
              💡 크롬 인쇄 팁: 설정 → [여백: 없음] 설정 필수
            </span>
          </div>

          {/* ===== 라벨 시트 렌더링 (10개씩 한 페이지) ===== */}
          <div className="label-sheet">
            {Array.from({ length: Math.ceil(targetSlots.length / 10) }, (_, pageIdx) => {
              const pageSlots = targetSlots.slice(pageIdx * 10, (pageIdx + 1) * 10);
              const actualPageNum = pageIdx + startPageNum;

              return (
                <React.Fragment key={pageIdx}>
                  <div className="no-print" style={{ fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>📄 {actualPageNum}페이지</span>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>
                      (슬롯 {pageIdx * 10 + 1} ~ {Math.min((pageIdx + 1) * 10, targetSlots.length)}번째)
                    </span>
                  </div>
                  <div className="label-page">
                    {pageSlots.map((slot, slotIdx) => {
                      if (slot.isBlank) {
                        return (
                          <div key={slot.id || slotIdx} className="label-card blank-slot">
                            <span>[빈 칸 - 건너뜀 (시작 위치 오프셋)]</span>
                          </div>
                        );
                      }

                      const serial = (slot.serial || '').toString().trim();
                      const applyUrl = `${domain}/?action=apply&serial=${encodeURIComponent(serial)}`;
                      const returnUrl = `${domain}/?action=return&serial=${encodeURIComponent(serial)}`;
                      const applyQr = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(applyUrl)}`;
                      const returnQr = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(returnUrl)}`;

                      return (
                        <div key={slot.slotKey || slotIdx} className="label-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
                          {/* 0. 헤더: 회사명 & 연락처 */}
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
                              {slot.name}
                            </div>
                            <div style={{ fontSize: '10.5px', color: '#334155', fontWeight: '700', fontFamily: "'Inter', monospace", marginTop: '2px' }}>
                              S/N: {formatSerial(serial)}
                            </div>
                          </div>

                          {/* 2. 하단: 듀얼 QR (크기 확대하여 52mm 칸 내부 여백 가득 채움) */}
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-around', flex: 1 }}>
                            {/* 대여 신청 QR */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <span style={{
                                fontSize: '8px', fontWeight: '800', color: '#fff', background: '#2563eb',
                                padding: '1.5px 6px', borderRadius: '3px', marginBottom: '3px', letterSpacing: '-0.3px'
                              }}>🔵 대여 신청</span>
                              <img src={applyQr} alt="신청" style={{ width: '92px', height: '92px', border: '1px solid #94a3b8', borderRadius: '4px', background: '#fff' }} />
                            </div>

                            {/* 반납 QR */}
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
        </>
      )}
    </div>
  );
};

export default QrPrintPage;
