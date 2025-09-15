import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import ExcelJS from 'exceljs';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const CELL_MAPPINGS = {
  // 요청자 정보
  requesterName: 'E3',
  requesterSignature: 'M3',
  checkoutDate: 'E4',
  returnDate: 'E5',
  checkoutReason: 'E6',
  checkoutLocation: 'E7',

  // 파트너 정보
  partnerCompanyName: 'D12',
  partnerCompanyNameStamp: 'M12', // M12:O13 셀 병합 추정
  partnerBusinessNumber: 'D13',
  partnerContactPerson: 'D14',
  partnerContactNumber: 'D15',
  partnerAddress: 'D16', // D16:O16 셀 병합 추정

  // 사용처 정보
  usageCompanyName: 'D19',
  usageBusinessNumber: 'M19',
  usageAddress: 'D20', // D20:O20 셀 병합 추정
  usageContactPerson: 'D21',
  usageContactNumber: 'M21',

  // 메모사항 (A24:O27 병합된 넓은 범위)
  memoContent: 'A24', 
};

const EQUIPMENT_ROW_START = 30; // B30, F30, M30, O30 for first item

// Python 서버를 통해 Excel → PDF → JPG 변환하는 함수
export const generateExcelAsImage = async (formData, selectedEquipments) => {
  try {
    console.log("🚀 Excel → PDF → JPG 변환 프로세스 시작 (Python 서버 사용)");
    
    // Python 서버로 요청 전송
    console.log("🐍 Python 서버로 변환 요청 전송 중...");
    const response = await fetch('http://localhost:5000/convert-excel-to-jpg', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        formData: formData,
        selectedEquipments: selectedEquipments
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Python 서버 오류: ${errorData.error || '알 수 없는 오류'}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(`변환 실패: ${result.error || '알 수 없는 오류'}`);
    }
    
    console.log("✅ Python 서버 변환 완료");
    console.log("🎉 전체 변환 프로세스 완료!");
    
    return result.imageData;

  } catch (error) {
    console.error("❌ Excel 이미지 생성 중 오류:", error);
    
    // Python 서버가 실행되지 않은 경우 대체 방법 사용
    if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
      console.warn("⚠️ Python 서버에 연결할 수 없습니다. 대체 방법을 사용합니다.");
      return await generateExcelAsImageFallback(formData, selectedEquipments);
    }
    
    throw new Error(`엑셀 이미지 생성 중 오류가 발생했습니다: ${error.message}`);
  }
};

// Python 서버가 사용 불가능할 때 사용하는 대체 방법
const generateExcelAsImageFallback = async (formData, selectedEquipments) => {
  try {
    console.log("🔄 대체 방법: Excel → JPG 직접 변환");
    
    // 1. Excel 파일 생성
    console.log("📊 1단계: Excel 파일 생성 중...");
    const excelBuffer = await generateExcelBuffer(formData, selectedEquipments);
    console.log("✅ Excel 파일 생성 완료 (크기:", excelBuffer.byteLength, "bytes)");
    
    // 2. Excel을 직접 JPG 이미지로 변환
    console.log("🖼️ 2단계: Excel을 직접 JPG 이미지로 변환 중...");
    const imageDataUrl = await convertExcelDirectlyToJpg(excelBuffer);
    console.log("✅ JPG 이미지 변환 완료");
    console.log("🎉 대체 방법 변환 프로세스 완료!");
    
    return imageDataUrl;

  } catch (error) {
    console.error("❌ 대체 방법도 실패:", error);
    throw new Error("엑셀 이미지 생성 중 오류가 발생했습니다.");
  }
};

// Excel 파일을 생성하고 버퍼로 반환하는 함수
const generateExcelBuffer = async (formData, selectedEquipments) => {
  console.log("📊 Excel 템플릿 파일 로드 중...");
  // Fetch the template Excel file
  const response = await fetch('/장비 대여요청서.xlsx');
  const arrayBuffer = await response.arrayBuffer();
  console.log("📊 템플릿 파일 로드 완료, 크기:", arrayBuffer.byteLength, "bytes");
  
  // ExcelJS로 워크북 로드
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  console.log("📊 워크북 로드 완료");
  
  const worksheet = workbook.getWorksheet(1);
  console.log("📊 워크시트 로드 완료, 이름:", worksheet.name);

  // Helper to write data to a cell while preserving existing styles
  const writeCell = (cellAddress, value) => {
    const cell = worksheet.getCell(cellAddress);
    cell.value = value;
  };

  console.log("📊 요청자 정보 입력 중...");
  // Populate Requester Info
  writeCell(CELL_MAPPINGS.requesterName, formData.requester || '');
  writeCell(CELL_MAPPINGS.requesterSignature, formData.requester || '');
  writeCell(CELL_MAPPINGS.checkoutDate, formData.checkoutDate || '');
  writeCell(CELL_MAPPINGS.returnDate, formData.returnDate || '');
  writeCell(CELL_MAPPINGS.checkoutReason, formData.checkoutReason || '');
  writeCell(CELL_MAPPINGS.checkoutLocation, formData.checkoutLocation || '');

  console.log("📊 파트너 정보 입력 중...");
  // Populate Partner Info
  writeCell(CELL_MAPPINGS.partnerCompanyName, formData.partnerCompanyName || '');
  writeCell(CELL_MAPPINGS.partnerCompanyNameStamp, formData.partnerCompanyName || '');
  writeCell(CELL_MAPPINGS.partnerBusinessNumber, formData.partnerBusinessNumber || '');
  writeCell(CELL_MAPPINGS.partnerContactPerson, formData.partnerContactPerson || '');
  writeCell(CELL_MAPPINGS.partnerContactNumber, formData.partnerContactNumber || '');
  writeCell(CELL_MAPPINGS.partnerAddress, formData.partnerAddress || '');

  console.log("📊 사용처 정보 입력 중...");
  // Populate Usage Info
  writeCell(CELL_MAPPINGS.usageCompanyName, formData.usageCompanyName || '');
  writeCell(CELL_MAPPINGS.usageBusinessNumber, formData.usageBusinessNumber || '');
  writeCell(CELL_MAPPINGS.usageAddress, formData.usageAddress || '');
  writeCell(CELL_MAPPINGS.usageContactPerson, formData.usageContactPerson || '');
  writeCell(CELL_MAPPINGS.usageContactNumber, formData.usageContactNumber || '');

  console.log("📊 메모 정보 입력 중...");
  // Populate Memo Items
  const memoContent = (formData.memoItems || []).filter(memo => memo.trim() !== '').join('\n');
  writeCell(CELL_MAPPINGS.memoContent, memoContent);

  console.log("📊 장비 목록 입력 중... (선택된 장비 수:", selectedEquipments.length, ")");
  // Populate Equipment List
  selectedEquipments.slice(0, 5).forEach((equipment, index) => {
    const row = EQUIPMENT_ROW_START + index;
    writeCell(`B${row}`, equipment.name || '');
    writeCell(`F${row}`, equipment.name || '');
    writeCell(`M${row}`, 1);
    writeCell(`O${row}`, '');
    console.log(`📊 장비 ${index + 1}: ${equipment.name} (행 ${row})`);
  });

  console.log("📊 Excel 파일 버퍼 생성 중...");
  // Excel 파일을 버퍼로 변환
  const buffer = await workbook.xlsx.writeBuffer();
  console.log("📊 Excel 파일 버퍼 생성 완료, 크기:", buffer.byteLength, "bytes");
  
  return buffer;
};

// Excel을 직접 JPG 이미지로 변환하는 함수 (PDF 단계 생략)
const convertExcelDirectlyToJpg = async (excelBuffer) => {
  console.log("📊 Excel 버퍼를 직접 JPG로 변환 시작...");
  
  // ExcelJS로 워크북 로드
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(excelBuffer);
  console.log("📊 Excel 워크북 로드 완료");
  
  const worksheet = workbook.getWorksheet(1);
  console.log("📊 워크시트 정보 - 행:", worksheet.rowCount, "열:", worksheet.columnCount);
  
  // 워크시트를 HTML 테이블로 변환
  const htmlTable = workbookToHtmlTable(worksheet);
  console.log("📊 HTML 테이블 생성 완료, 길이:", htmlTable.length, "characters");
  
  // 임시 DOM 요소 생성
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlTable;
  tempDiv.style.position = 'absolute';
  tempDiv.style.left = '-9999px';
  tempDiv.style.top = '-9999px';
  tempDiv.style.width = '800px';
  tempDiv.style.fontFamily = 'Arial, sans-serif';
  tempDiv.style.fontSize = '12px';
  tempDiv.style.backgroundColor = '#ffffff';
  document.body.appendChild(tempDiv);
  console.log("📊 임시 DOM 요소 생성 완료");
  
  // HTML2Canvas로 Canvas 생성
  console.log("📊 Canvas 생성 시작...");
  const canvas = await html2canvas(tempDiv.firstChild, {
    width: 800,
    height: 600,
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: true
  });
  console.log("📊 Canvas 생성 완료, 크기:", canvas.width, "x", canvas.height);
  
  // 임시 요소 제거
  document.body.removeChild(tempDiv);
  
  // Canvas가 비어있는지 확인
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  let hasNonWhitePixels = false;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r !== 255 || g !== 255 || b !== 255) {
      hasNonWhitePixels = true;
      break;
    }
  }
  
  console.log("📊 Canvas 내용 확인:", hasNonWhitePixels ? "내용 있음" : "흰색만 있음");
  
  if (!hasNonWhitePixels) {
    console.warn("⚠️ Canvas가 흰색으로만 채워져 있음. Excel 렌더링에 문제가 있을 수 있습니다.");
  }
  
  // Canvas를 JPG 이미지로 변환
  const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
  console.log("📊 JPG 이미지 변환 완료, 크기:", imageDataUrl.length, "characters");
  
  return imageDataUrl;
};

// Excel을 PDF로 변환하는 함수
const convertExcelToPdf = async (excelBuffer) => {
  console.log("📊 Excel 버퍼를 PDF로 변환 시작...");
  
  // ExcelJS로 워크북 로드
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(excelBuffer);
  console.log("📊 Excel 워크북 로드 완료");
  
  const worksheet = workbook.getWorksheet(1);
  console.log("📊 워크시트 정보 - 행:", worksheet.rowCount, "열:", worksheet.columnCount);
  
  // 워크시트를 HTML 테이블로 변환
  const htmlTable = workbookToHtmlTable(worksheet);
  console.log("📊 HTML 테이블 생성 완료, 길이:", htmlTable.length, "characters");
  
  // HTML을 PDF로 변환
  const pdf = new jsPDF('l', 'mm', 'a4'); // 가로 방향 A4
  console.log("📊 PDF 문서 생성 완료");
  
  // 임시 DOM 요소 생성
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlTable;
  tempDiv.style.position = 'absolute';
  tempDiv.style.left = '-9999px';
  tempDiv.style.top = '-9999px';
  tempDiv.style.width = '800px';
  tempDiv.style.fontFamily = 'Arial, sans-serif';
  tempDiv.style.fontSize = '12px';
  document.body.appendChild(tempDiv);
  console.log("📊 임시 DOM 요소 생성 완료");
  
  // HTML2Canvas로 Canvas 생성
  console.log("📊 Canvas 생성 시작...");
  const canvas = await html2canvas(tempDiv.firstChild, {
    width: 800,
    height: 600,
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: true
  });
  console.log("📊 Canvas 생성 완료, 크기:", canvas.width, "x", canvas.height);
  
  // 임시 요소 제거
  document.body.removeChild(tempDiv);
  
  // Canvas를 이미지로 변환하여 PDF에 추가
  const imgData = canvas.toDataURL('image/png');
  console.log("📊 이미지 데이터 생성 완료, 크기:", imgData.length, "characters");
  
  const imgWidth = 210; // A4 width in mm
  const pageHeight = 295; // A4 height in mm
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  let heightLeft = imgHeight;
  
  let position = 0;
  
  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;
  
  while (heightLeft >= 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }
  
  const pdfBuffer = pdf.output('arraybuffer');
  console.log("📊 PDF 생성 완료, 크기:", pdfBuffer.byteLength, "bytes");
  
  return pdfBuffer;
};


// Excel 워크북을 HTML 테이블로 변환하는 함수 (PDF 생성을 위해)
const workbookToHtmlTable = (worksheet) => {
  const maxRow = worksheet.rowCount || 50;
  const maxCol = worksheet.columnCount || 15;
  
  let html = '<table style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 12px;">';
  
  for (let row = 1; row <= maxRow; row++) {
    html += '<tr>';
    for (let col = 1; col <= maxCol; col++) {
      const cell = worksheet.getCell(row, col);
      const cellValue = cell.value || '';
      
      // 셀 스타일 적용
      let cellStyle = 'border: 1px solid #000; padding: 4px; min-width: 50px; min-height: 20px; background-color: white;';
      
      if (cell.font) {
        if (cell.font.bold) cellStyle += ' font-weight: bold;';
        if (cell.font.size) cellStyle += ` font-size: ${cell.font.size}px;`;
        if (cell.font.color) cellStyle += ` color: ${cell.font.color.argb ? `#${cell.font.color.argb.slice(2)}` : '#000'};`;
      }
      
      if (cell.fill) {
        if (cell.fill.type === 'pattern' && cell.fill.fgColor) {
          cellStyle += ` background-color: #${cell.fill.fgColor.argb ? cell.fill.fgColor.argb.slice(2) : 'ffffff'};`;
        }
      }
      
      if (cell.alignment) {
        if (cell.alignment.horizontal === 'center') cellStyle += ' text-align: center;';
        else if (cell.alignment.horizontal === 'right') cellStyle += ' text-align: right;';
        else cellStyle += ' text-align: left;';
        
        if (cell.alignment.vertical === 'middle') cellStyle += ' vertical-align: middle;';
        else if (cell.alignment.vertical === 'bottom') cellStyle += ' vertical-align: bottom;';
        else cellStyle += ' vertical-align: top;';
      }
      
      // 병합 셀 처리
      if (cell.isMerged) {
        const mergeRange = cell.master ? cell.master.address : cell.address;
        if (mergeRange.includes(':')) {
          const [start, end] = mergeRange.split(':');
          const startCol = start.charCodeAt(0) - 64;
          const endCol = end.charCodeAt(0) - 64;
          const startRow = parseInt(start.slice(1));
          const endRow = parseInt(end.slice(1));
          
          if (startCol === col && startRow === row) {
            cellStyle += ` colspan="${endCol - startCol + 1}" rowspan="${endRow - startRow + 1}"`;
          } else {
            continue; // 병합된 셀의 일부이므로 건너뛰기
          }
        }
      }
      
      html += `<td style="${cellStyle}">${cellValue}</td>`;
    }
    html += '</tr>';
  }
  
  html += '</table>';
  return html;
};

// ExcelJS를 사용한 새로운 Excel 생성 함수 (스타일 보존)
export const generateExcelWithExcelJS = async (formData, selectedEquipments) => {
  try {
    // Fetch the template Excel file
    const response = await fetch('/장비 대여요청서.xlsx');
    const arrayBuffer = await response.arrayBuffer();
    
    // ExcelJS로 워크북 로드
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    
    const worksheet = workbook.getWorksheet(1); // 첫 번째 워크시트

    // Helper to write data to a cell while preserving existing styles
    const writeCell = (cellAddress, value) => {
      const cell = worksheet.getCell(cellAddress);
      cell.value = value;
      // 기존 스타일은 자동으로 보존됨
    };

    // Populate Requester Info
    writeCell(CELL_MAPPINGS.requesterName, formData.requester || '');
    writeCell(CELL_MAPPINGS.requesterSignature, formData.requester || '');
    writeCell(CELL_MAPPINGS.checkoutDate, formData.checkoutDate || '');
    writeCell(CELL_MAPPINGS.returnDate, formData.returnDate || '');
    writeCell(CELL_MAPPINGS.checkoutReason, formData.checkoutReason || '');
    writeCell(CELL_MAPPINGS.checkoutLocation, formData.checkoutLocation || '');

    // Populate Partner Info
    writeCell(CELL_MAPPINGS.partnerCompanyName, formData.partnerCompanyName || '');
    writeCell(CELL_MAPPINGS.partnerCompanyNameStamp, formData.partnerCompanyName || '');
    writeCell(CELL_MAPPINGS.partnerBusinessNumber, formData.partnerBusinessNumber || '');
    writeCell(CELL_MAPPINGS.partnerContactPerson, formData.partnerContactPerson || '');
    writeCell(CELL_MAPPINGS.partnerContactNumber, formData.partnerContactNumber || '');
    writeCell(CELL_MAPPINGS.partnerAddress, formData.partnerAddress || '');

    // Populate Usage Info
    writeCell(CELL_MAPPINGS.usageCompanyName, formData.usageCompanyName || '');
    writeCell(CELL_MAPPINGS.usageBusinessNumber, formData.usageBusinessNumber || '');
    writeCell(CELL_MAPPINGS.usageAddress, formData.usageAddress || '');
    writeCell(CELL_MAPPINGS.usageContactPerson, formData.usageContactPerson || '');
    writeCell(CELL_MAPPINGS.usageContactNumber, formData.usageContactNumber || '');

    // Populate Memo Items (A24:O27)
    const memoContent = (formData.memoItems || []).filter(memo => memo.trim() !== '').join('\n');
    writeCell(CELL_MAPPINGS.memoContent, memoContent);

    // Populate Equipment List (up to 5 items)
    selectedEquipments.slice(0, 5).forEach((equipment, index) => {
      const row = EQUIPMENT_ROW_START + index;
      writeCell(`B${row}`, equipment.name || '');
      writeCell(`F${row}`, equipment.name || '');
      writeCell(`M${row}`, 1);
      writeCell(`O${row}`, '');
    });

    // Generate and save the file
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `장비 대여요청서_${formData.requester}_${formData.checkoutDate.replace(/\//g, '')}.xlsx`;
    saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);

  } catch (error) {
    console.error("Error generating Excel file with ExcelJS:", error);
    alert("엑셀 파일 생성 중 오류가 발생했습니다.");
  }
};

// 기존 XLSX 함수 (백업용)
export const generateExcel = async (formData, selectedEquipments) => {
  try {
    // Fetch the template Excel file
    const response = await fetch('/장비 대여요청서.xlsx');
    const arrayBuffer = await response.arrayBuffer();
    // Read the workbook, preserving cell styles and merged cells
    const workbook = XLSX.read(arrayBuffer, { 
      type: 'array', 
      cellStyles: true,
      cellNF: true,
      cellHTML: false
    });

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Helper to write data to a cell while preserving existing styles
    const writeCell = (cellAddress, value) => {
      if (!worksheet[cellAddress]) {
        worksheet[cellAddress] = {};
      }
      // Preserve existing cell properties and only update the value
      const existingCell = worksheet[cellAddress];
      existingCell.v = value;
      existingCell.t = 's'; // Set type to string
      // Keep all other existing properties (s, f, h, l, z, etc.)
    };

    // Populate Requester Info
    writeCell(CELL_MAPPINGS.requesterName, formData.requester || '');
    writeCell(CELL_MAPPINGS.requesterSignature, formData.requester || ''); // Assuming signature is requester's name
    writeCell(CELL_MAPPINGS.checkoutDate, formData.checkoutDate || '');
    writeCell(CELL_MAPPINGS.returnDate, formData.returnDate || '');
    writeCell(CELL_MAPPINGS.checkoutReason, formData.checkoutReason || '');
    writeCell(CELL_MAPPINGS.checkoutLocation, formData.checkoutLocation || '');

    // Populate Partner Info
    writeCell(CELL_MAPPINGS.partnerCompanyName, formData.partnerCompanyName || '');
    writeCell(CELL_MAPPINGS.partnerCompanyNameStamp, formData.partnerCompanyName || ''); // Assuming stamp is company name
    writeCell(CELL_MAPPINGS.partnerBusinessNumber, formData.partnerBusinessNumber || '');
    writeCell(CELL_MAPPINGS.partnerContactPerson, formData.partnerContactPerson || '');
    writeCell(CELL_MAPPINGS.partnerContactNumber, formData.partnerContactNumber || '');
    writeCell(CELL_MAPPINGS.partnerAddress, formData.partnerAddress || '');

    // Populate Usage Info
    writeCell(CELL_MAPPINGS.usageCompanyName, formData.usageCompanyName || '');
    writeCell(CELL_MAPPINGS.usageBusinessNumber, formData.usageBusinessNumber || '');
    writeCell(CELL_MAPPINGS.usageAddress, formData.usageAddress || '');
    writeCell(CELL_MAPPINGS.usageContactPerson, formData.usageContactPerson || '');
    writeCell(CELL_MAPPINGS.usageContactNumber, formData.usageContactNumber || '');

    // Populate Memo Items (A24:O27)
    // Combine all memo items into a single string, separated by newlines
    const memoContent = (formData.memoItems || []).filter(memo => memo.trim() !== '').join('\n');
    writeCell(CELL_MAPPINGS.memoContent, memoContent);
    
    // For merged cells, ensure the value is only in the top-left cell
    // Clear any values that might be in merged cell ranges to avoid conflicts
    const clearMergedCells = (startCell, endCell) => {
      const startCol = startCell.match(/[A-Z]+/)[0];
      const startRow = parseInt(startCell.match(/\d+/)[0]);
      const endCol = endCell.match(/[A-Z]+/)[0];
      const endRow = parseInt(endCell.match(/\d+/)[0]);
      
      // Convert column letters to numbers
      const colToNum = (col) => {
        let num = 0;
        for (let i = 0; i < col.length; i++) {
          num = num * 26 + (col.charCodeAt(i) - 64);
        }
        return num;
      };
      
      const startColNum = colToNum(startCol);
      const endColNum = colToNum(endCol);
      
      for (let row = startRow; row <= endRow; row++) {
        for (let col = startColNum; col <= endColNum; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row - 1, c: col - 1 });
          if (cellAddress !== startCell && worksheet[cellAddress]) {
            delete worksheet[cellAddress].v;
          }
        }
      }
    };
    
    // Clear merged cells for memo area (A24:O27)
    clearMergedCells('A24', 'O27');
    // Clear merged cells for partner address (D16:O16)
    clearMergedCells('D16', 'O16');
    // Clear merged cells for usage address (D20:O20)
    clearMergedCells('D20', 'O20');

    // Populate Equipment List (up to 5 items)
    selectedEquipments.slice(0, 5).forEach((equipment, index) => {
      const row = EQUIPMENT_ROW_START + index;
      writeCell(`B${row}`, equipment.name || ''); // 품목 (using name for 품목)
      writeCell(`F${row}`, equipment.name || ''); // 품명 (using name for 품명)
      writeCell(`M${row}`, 1); // 수량 (default to 1)
      writeCell(`O${row}`, ''); // 비고 (empty for now)
    });

    // Generate new workbook and save, preserving cell styles and merged cells
    const wbout = XLSX.write(workbook, { 
      bookType: 'xlsx', 
      type: 'array', 
      cellStyles: true,
      cellNF: true,
      compression: true
    });
    const fileName = `장비 대여요청서_${formData.requester}_${formData.checkoutDate.replace(/\//g, '')}.xlsx`;
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), fileName);

  } catch (error) {
    console.error("Error generating Excel file:", error);
    alert("엑셀 파일 생성 중 오류가 발생했습니다.");
  }
};
