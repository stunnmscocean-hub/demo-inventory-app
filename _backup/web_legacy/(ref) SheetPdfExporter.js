// import React, { useState } from 'react';

// /**
//  * Google 스프레드시트를 PDF로 내보내고 Google Drive에 저장하는 기능을 제공하는 React 컴포넌트입니다.
//  * 이 컴포넌트는 Google Apps Script로 배포된 웹 앱을 호출합니다.
//  */
// function SheetPdfExporter() {
//   // 로딩 상태 및 결과 메시지 관리를 위한 useState 훅
//   const [isLoading, setIsLoading] = useState(false);
//   const [message, setMessage] = useState('');
//   const [fileUrl, setFileUrl] = useState('');
//   const [jpgPreviewUrl, setJpgPreviewUrl] = useState('');

//   // 스프레드시트 ID (기본값 또는 필요에 따라 변경)
//   // Apps Script 웹 앱 URL에 쿼리 매개변수로 전달될 수 있습니다.
//   const spreadsheetId = '1Mvx-mVxeLkv2a9jKPVE5Y6Ugf8vGjSmidE1FWPn-U6Y'; 

//   // Apps Script 웹 앱 URL (실제 배포된 URL로 변경해야 합니다)
//   // 예시: 'YOUR_APPS_SCRIPT_WEB_APP_URL'
//   // 이 URL은 Apps Script 프로젝트를 웹 앱으로 배포할 때 얻을 수 있습니다.
//   const appsScriptUrl = 'https://script.google.com/macros/s/AKfycbwg7N4735L7bo-xMc-OZh7s0WBmVcYfWvA7xb6SwZjCR8TzFHJiFfI9jU8cTHH-9yY/exec'; 

//   /**
//    * 이미지를 클립보드에 복사하는 함수 (PNG 형식으로 변환)
//    */
//   const copyImageToClipboard = async () => {
//     try {
//       if (!jpgPreviewUrl) return;
      
//       // Canvas를 사용하여 이미지를 PNG로 변환
//       const canvas = document.createElement('canvas');
//       const ctx = canvas.getContext('2d');
//       const img = new Image();
      
//       img.onload = async () => {
//         canvas.width = img.width;
//         canvas.height = img.height;
//         ctx.drawImage(img, 0, 0);
        
//         try {
//           // Canvas를 PNG Blob으로 변환
//           canvas.toBlob(async (blob) => {
//             try {
//               const clipboardItem = new ClipboardItem({
//                 'image/png': blob
//               });
              
//               await navigator.clipboard.write([clipboardItem]);
              
//               // 성공 메시지 표시
//               setMessage('이미지가 클립보드에 복사되었습니다!');
//               console.log('이미지 클립보드 복사 성공');
              
//               // 3초 후 메시지 제거
//               setTimeout(() => {
//                 setMessage('스프레드시트가 PDF로 성공적으로 변환되어 Drive에 저장되었습니다.');
//               }, 3000);
              
//             } catch (clipboardError) {
//               console.error('클립보드 복사 실패:', clipboardError);
//               fallbackCopyMethod();
//             }
//           }, 'image/png');
          
//         } catch (canvasError) {
//           console.error('Canvas 변환 실패:', canvasError);
//           fallbackCopyMethod();
//         }
//       };
      
//       img.onerror = () => {
//         console.error('이미지 로드 실패');
//         fallbackCopyMethod();
//       };
      
//       img.src = jpgPreviewUrl;
      
//     } catch (error) {
//       console.error('이미지 복사 오류:', error);
//       fallbackCopyMethod();
//     }
//   };

//   /**
//    * 클립보드 복사 실패 시 대체 방법
//    */
//   const fallbackCopyMethod = () => {
//     setMessage('자동 복사가 지원되지 않습니다. 우클릭 → "이미지 복사"를 사용해주세요.');
    
//     // 5초 후 원래 메시지로 복원
//     setTimeout(() => {
//       setMessage('스프레드시트가 PDF로 성공적으로 변환되어 Drive에 저장되었습니다.');
//     }, 5000);
//   };

//   /**
//    * Base64 PDF를 JPG로 변환하는 함수
//    */
//   const convertPdfBase64ToJpg = async (pdfBase64) => {
//     try {
//       console.log('Base64 PDF를 JPG로 변환 시작, 길이:', pdfBase64.length);
      
//       // PDF.js 라이브러리 동적 로드
//       if (!window.pdfjsLib) {
//         const script = document.createElement('script');
//         script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
//         script.onload = () => {
//           window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
//           processPdfBase64(pdfBase64);
//         };
//         document.head.appendChild(script);
//       } else {
//         processPdfBase64(pdfBase64);
//       }
      
//     } catch (error) {
//       console.error('PDF 변환 오류:', error);
//     }
//   };

//   /**
//    * Base64 PDF 처리 함수
//    */
//   const processPdfBase64 = async (pdfBase64) => {
//     try {
//       // Base64를 ArrayBuffer로 변환
//       const binaryString = atob(pdfBase64);
//       const bytes = new Uint8Array(binaryString.length);
//       for (let i = 0; i < binaryString.length; i++) {
//         bytes[i] = binaryString.charCodeAt(i);
//       }
      
//       console.log('PDF ArrayBuffer 생성 완료, 크기:', bytes.length);
      
//       // PDF 문서 로드
//       const pdf = await window.pdfjsLib.getDocument(bytes).promise;
//       const page = await pdf.getPage(1); // 첫 번째 페이지
      
//       console.log('PDF 페이지 로드 완료');
      
//       // Canvas 설정
//       const canvas = document.createElement('canvas');
//       const context = canvas.getContext('2d');
      
//       // 고해상도 설정
//       const scale = 2;
//       const viewport = page.getViewport({ scale });
      
//       canvas.height = viewport.height;
//       canvas.width = viewport.width;
      
//       console.log('Canvas 크기:', canvas.width, 'x', canvas.height);
      
//       // PDF 페이지를 Canvas에 렌더링
//       const renderContext = {
//         canvasContext: context,
//         viewport: viewport
//       };
      
//       await page.render(renderContext).promise;
//       console.log('PDF 렌더링 완료');
      
//       // Canvas를 JPG로 변환
//       const jpgDataUrl = canvas.toDataURL('image/jpeg', 0.8);
//       console.log('JPG 변환 완료, 길이:', jpgDataUrl.length);
      
//       setJpgPreviewUrl(jpgDataUrl);
      
//     } catch (error) {
//       console.error('PDF 처리 오류:', error);
//     }
//   };

//   /**
//    * PDF 내보내기 버튼 클릭 시 호출되는 함수
//    */
//   const handleExportPdf = async () => {
//     // 로딩 상태 활성화 및 이전 메시지 초기화
//     setIsLoading(true);
//     setMessage('');
//     setFileUrl('');
//     setJpgPreviewUrl('');

//     // Apps Script 웹 앱 URL이 설정되었는지 확인
//     if (!appsScriptUrl || appsScriptUrl === 'YOUR_APPS_SCRIPT_WEB_APP_URL') {
//       setMessage('오류: Apps Script 웹 앱 URL이 설정되지 않았습니다. Code.gs 파일에서 appsScriptUrl 변수를 실제 URL로 업데이트해주세요.');
//       setIsLoading(false);
//       return;
//     }

//     try {
//       // JSONP 방식으로 요청 (CORS 문제 우회)
//       const script = document.createElement('script');
//       const callbackName = `jsonp_callback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
//       // 전역 콜백 함수 생성
//       window[callbackName] = (result) => {
//         // 스크립트 태그 제거
//         document.head.removeChild(script);
//         delete window[callbackName];
        
//         // 결과 처리
//         console.log('응답 결과:', result);
//         setMessage(result.message);
//         if (result.success && result.fileUrl) {
//           setFileUrl(result.fileUrl);
//         }
//         if (result.success && result.pdfBase64) {
//           // Base64 PDF 데이터를 JPG로 변환
//           convertPdfBase64ToJpg(result.pdfBase64);
//         }
//         setIsLoading(false);
//       };
      
//       // 스크립트 태그로 JSONP 요청
//       script.src = `${appsScriptUrl}?spreadsheetId=${spreadsheetId}&gid=0&callback=${callbackName}`;
//       document.head.appendChild(script);
      
//       // 타임아웃 설정 (30초)
//       setTimeout(() => {
//         if (window[callbackName]) {
//           document.head.removeChild(script);
//           delete window[callbackName];
//           setMessage('요청 시간이 초과되었습니다. 다시 시도해주세요.');
//           setIsLoading(false);
//         }
//       }, 30000);
      
//       return; // JSONP는 비동기로 처리되므로 여기서 리턴

//     } catch (error) {
//       // 오류 발생 시 메시지 업데이트
//       setMessage(`요청 처리 중 오류가 발생했습니다: ${error.message}`);
//       console.error('PDF 내보내기 요청 오류:', error);
//       setIsLoading(false);
//     }
//   };

//   return (
//     <div>
//       <h2 className="pdf-exporter-title">Google 시트 PDF 내보내기</h2>
//       <p className="pdf-exporter-description">
//         아래 버튼을 클릭하면 '시트1'이 포함된 스프레드시트가 PDF로 변환되어 
//         Google Drive에 저장됩니다. (Apps Script 웹 앱 배포 및 URL 설정 필요)
//       </p>
//       <button 
//         className="pdf-export-button" 
//         onClick={handleExportPdf} 
//         disabled={isLoading}
//       >
//         {isLoading ? '내보내는 중...' : 'PDF 내보내기'}
//       </button>
      
//       {/* 결과 메시지 표시 */}
//       {message && (
//         <div className={`pdf-message ${message.includes('오류') ? 'error' : 'success'}`}>
//           {message}
//         </div>
//       )}
      
//       {/* 생성된 PDF 파일 링크 표시 */}
//       {fileUrl && (
//         <div className="pdf-file-link">
//           <strong>생성된 PDF 파일:</strong><br />
//           <a href={fileUrl} target="_blank" rel="noopener noreferrer">
//             {fileUrl}
//           </a>
//         </div>
//       )}
      
//       {/* JPG 미리보기 표시 (클릭하여 복사) */}
//       {jpgPreviewUrl && (
//         <div style={{ marginTop: '20px', textAlign: 'center' }}>
//           <div style={{ 
//             display: 'inline-block', 
//             position: 'relative',
//             cursor: 'pointer'
//           }}>
//             <img 
//               src={jpgPreviewUrl} 
//               alt="PDF 미리보기 (클릭하여 복사)" 
//               title="클릭하면 클립보드에 복사됩니다"
//               style={{
//                 maxWidth: '100%',
//                 height: 'auto',
//                 border: '2px solid transparent',
//                 borderRadius: '4px',
//                 boxShadow: 'none',
//                 background: 'transparent',
//                 pointerEvents: 'auto',
//                 userSelect: 'auto',
//                 cursor: 'pointer',
//                 WebkitUserSelect: 'auto',
//                 MozUserSelect: 'auto',
//                 msUserSelect: 'auto',
//                 transition: 'all 0.2s ease'
//               }}
//               onClick={copyImageToClipboard}
//               onLoad={() => console.log('JPG 이미지 로드 성공')}
//               onError={(e) => {
//                 console.error('JPG 이미지 로드 실패:', e);
//                 setJpgPreviewUrl('');
//               }}
//               onMouseOver={(e) => {
//                 e.target.style.borderColor = '#4CAF50';
//                 e.target.style.boxShadow = '0 4px 8px rgba(76, 175, 80, 0.3)';
//               }}
//               onMouseOut={(e) => {
//                 e.target.style.borderColor = 'transparent';
//                 e.target.style.boxShadow = 'none';
//               }}
//               onContextMenu={(e) => {
//                 // 우클릭 메뉴 허용 (이미지 복사 가능)
//               }}
//               draggable={true}
//             />
//             <div style={{
//               position: 'absolute',
//               bottom: '8px',
//               right: '8px',
//               background: 'rgba(0, 0, 0, 0.7)',
//               color: 'white',
//               padding: '4px 8px',
//               borderRadius: '4px',
//               fontSize: '12px',
//               pointerEvents: 'none'
//             }}>
//               📋 클릭하여 복사
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// export default SheetPdfExporter;
