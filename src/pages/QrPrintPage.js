import React, { useState, useEffect } from 'react';
import { getEquipmentData } from '../services/api';

const QrPrintPage = () => {
  const [domain, setDomain] = useState(window.location.origin.includes('localhost') ? 'http://localhost:3000' : 'https://demodevice.kr');
  const [search, setSearch] = useState('');
  const [allEquipments, setAllEquipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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

  const filtered = allEquipments.filter(eq => {
    const name = (eq.name || '').toLowerCase();
    const serial = (eq.serial || '').toLowerCase();
    const q = search.toLowerCase().trim();
    return name.includes(q) || serial.includes(q);
  });

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
            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', width: '160px' }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>2열 우측 이동:</span>
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
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>
              📦 총 {filtered.length}개 장비 · {Math.ceil(filtered.length / 10)}페이지
            </span>
            <span style={{ fontSize: '12px', color: '#0284c7', background: '#e0f2fe', padding: '4px 10px', borderRadius: '4px', fontWeight: '500' }}>
              💡 크롬 인쇄 팁: 설정 → [여백: 없음] 설정 필수
            </span>
          </div>

          {/* ===== 라벨 시트 렌더링 (10개씩 한 페이지) ===== */}
          <div className="label-sheet">
            {Array.from({ length: Math.ceil(filtered.length / 10) }, (_, pageIdx) => {
              const pageItems = filtered.slice(pageIdx * 10, (pageIdx + 1) * 10);

              return (
                <div key={pageIdx} className="label-page">
                  {pageItems.map((eq, idx) => {
                    const serial = (eq.serial || '').toString().trim();
                    const applyUrl = `${domain}/?action=apply&serial=${encodeURIComponent(serial)}`;
                    const returnUrl = `${domain}/?action=return&serial=${encodeURIComponent(serial)}`;
                    const applyQr = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(applyUrl)}`;
                    const returnQr = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(returnUrl)}`;

                    return (
                      <div key={idx} className="label-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
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
                            {eq.name}
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
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default QrPrintPage;
