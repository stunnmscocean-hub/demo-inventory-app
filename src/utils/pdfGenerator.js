import jsPDF from 'jspdf';
// 한글 폰트를 사용하려면 폰트 파일(.ttf)을 프로젝트에 포함하고 아래와 같이 설정해야 합니다.
// import myFont from '../assets/fonts/NanumGothic-Regular.ttf';

export const generatePdf = (data) => {
  const doc = new jsPDF();

  // --- 한글 깨짐 방지를 위한 폰트 설정 (주석 처리됨) ---
  // 1. 폰트 파일을 프로젝트에 추가합니다. (예: src/assets/fonts/...)
  // 2. 폰트를 Base64로 변환하거나, jspdf-autotable 같은 라이브러리의 폰트 지원 기능을 사용합니다.
  // 아래는 폰트가 추가되었다고 가정했을 때의 예시 코드입니다.
  // doc.addFileToVFS('NanumGothic-Regular.ttf', myFont);
  // doc.addFont('NanumGothic-Regular.ttf', 'NanumGothic', 'normal');
  // doc.setFont('NanumGothic');

  doc.setFontSize(22);
  doc.text("데모 장비 신청 양식", 20, 20);
  
  doc.setFontSize(12);
  
  let yOffset = 40;

  // 기본정보
  doc.text(`요청자: ${data.requester || ''}`, 20, yOffset); yOffset += 10;
  doc.text(`장비명: ${data.equipmentName || ''}`, 20, yOffset); yOffset += 10;
  doc.text(`시리얼 넘버: ${data.equipmentSerial || ''}`, 20, yOffset); yOffset += 10;
  doc.text(`반출일자: ${data.checkoutDate || ''}`, 20, yOffset); yOffset += 10;
  doc.text(`반납일자: ${data.returnDate || ''}`, 20, yOffset); yOffset += 10;
  doc.text(`반출 사유: ${data.checkoutReason || ''}`, 20, yOffset); yOffset += 10;
  doc.text(`반출 장소: ${data.checkoutLocation || ''}`, 20, yOffset); yOffset += 10;
  
  doc.line(20, yOffset, 190, yOffset); yOffset += 10; // 구분선

  // 파트너 정보
  doc.text(`파트너 상호: ${data.partnerCompanyName || ''}`, 20, yOffset); yOffset += 10;
  doc.text(`파트너 사업자번호: ${data.partnerBusinessNumber || ''}`, 20, yOffset); yOffset += 10;
  doc.text(`파트너 담당자: ${data.partnerContactPerson || ''}`, 20, yOffset); yOffset += 10;
  doc.text(`파트너 연락처: ${data.partnerContactNumber || ''}`, 20, yOffset); yOffset += 10;
  doc.text(`파트너 주소: ${data.partnerAddress || ''}`, 20, yOffset); yOffset += 10;
  
  doc.line(20, yOffset, 190, yOffset); yOffset += 10; // 구분선

  // 사용처 정보
  doc.text(`사용처 상호: ${data.usageCompanyName || ''}`, 20, yOffset); yOffset += 10;
  doc.text(`사용처 사업자번호: ${data.usageBusinessNumber || ''}`, 20, yOffset); yOffset += 10;
  doc.text(`사용처 주소: ${data.usageAddress || ''}`, 20, yOffset); yOffset += 10;
  doc.text(`사용처 담당자: ${data.usageContactPerson || ''}`, 20, yOffset); yOffset += 10;
  doc.text(`사용처 연락처: ${data.usageContactNumber || ''}`, 20, yOffset); yOffset += 10;

  doc.line(20, yOffset, 190, yOffset); yOffset += 10; // 구분선

  doc.text("위와 같이 데모 장비 대여를 신청합니다.", 20, yOffset); yOffset += 10;
  doc.text(`신청일: ${new Date().toLocaleDateString('ko-KR')}`, 20, yOffset); yOffset += 10;


  doc.save("demo-application-form.pdf");
};
