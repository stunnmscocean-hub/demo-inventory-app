// Split a CSV line into fields, handling quoted commas and escaped quotes
const splitCsvLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      // handle double quotes inside quotes
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
};

const normalizeWhitespace = (text) => (text || '').replace(/[\u00A0\u2000-\u200B\u3000\s]/g, ' ').trim();
const stripWrappingQuotes = (text) => {
  let t = text == null ? '' : String(text);
  t = t.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    t = t.slice(1, -1);
  }
  return t.trim();
};

const canonicalizeStatus = (raw) => {
  const s = normalizeWhitespace(raw).replace(/\s/g, '');
  if (!s) return '';
  // Map common variants to canonical set
  if (['사용중', '사용중입니다', '사용중임'].includes(s)) return '사용중';
  if (['대여가능', '사용가능', '대여가', '가능'].includes(s)) return '대여 가능';
  if (['반납완료', '반납완료됨', '반납완료요'].includes(s)) return '반납완료';
  if (['반납완료', '반납완료됨', '반납완료요', '반납완료', '반납완료'].includes(s)) return '반납완료';
  if (['반납완료', '반납완료', '반납 완료'].includes(normalizeWhitespace(raw))) return '반납완료';
  if (['사용불가', '불량'].includes(s)) return '사용 불가';
  return normalizeWhitespace(raw); // fallback readable
};

export const parseEquipmentCsv = (csvString) => {
  const lines = (csvString || '').split(/\r?\n/).filter(l => l != null && l !== '');
  if (lines.length < 2) {
    console.error('CSV data is too short to parse.');
    return [];
  }

  // Use first line as header; our file appears to have a single header row
  const dataLines = lines.slice(1);

  const parsedData = dataLines
    .map((line) => splitCsvLine(line))
    .filter(cols => cols.length > 0 && cols.some(c => normalizeWhitespace(c) !== ''))
    .map((columns, index) => {
      // Expected columns for 장비현황.csv: 장비, 제품, Tag, 사용 현황, 제품 PN, 제품 위치
      const serialRaw = columns[0];
      const nameRaw = columns[1];
      const tagRaw = columns[2];
      const statusRaw = columns[3];
      const productPNRaw = columns[4];
      const locationRaw = columns[5];

      const serial = normalizeWhitespace(stripWrappingQuotes(serialRaw)) || `GEN_SN_${index}`;
      const name = normalizeWhitespace(stripWrappingQuotes(nameRaw)) || `Unknown Equipment ${index}`;
      const tag = normalizeWhitespace(stripWrappingQuotes(tagRaw));
      const status = canonicalizeStatus(statusRaw);
      const productPN = normalizeWhitespace(stripWrappingQuotes(productPNRaw));
      const location = normalizeWhitespace(stripWrappingQuotes(locationRaw));

      return {
        id: `${serial}-${index}`, // Generate a unique ID by combining serial and index
        serial,
        name,
        tag,
        status,
        productPN,
        location,
      };
    });

  return parsedData;
};

export const parseUsageCsv = (csvString) => {
  const lines = (csvString || '').split(/\r?\n/).filter(l => l != null && l !== '');
  if (lines.length < 2) {
    console.error('CSV data is too short to parse.');
    return [];
  }

  const dataLines = lines.slice(1);

  const parsedData = dataLines
    .map((line) => splitCsvLine(line))
    .filter(cols => cols.length > 0 && cols.some(c => normalizeWhitespace(c) !== ''))
    .map((columns, index) => {
      // Expected columns: 장비(serial), 제품명(name), 시작일, 종료일, 사용자명, 파트너 담당자, 휴대폰 번호, 사용 여부, 비고
      const serialRaw = columns[0];
      const nameRaw = columns[1];
      const startRaw = columns[2];
      const endRaw = columns[3];
      const userNameRaw = columns[4];
      const partnerNameRaw = columns[5];
      const phoneRaw = columns[6];
      const statusRaw = columns[7];
      const notesRaw = columns[8];

      const serial = normalizeWhitespace(stripWrappingQuotes(serialRaw)) || `GEN_SN_${index}`;
      const name = normalizeWhitespace(stripWrappingQuotes(nameRaw)) || `Unknown Equipment ${index}`;
      const startDate = normalizeWhitespace(stripWrappingQuotes(startRaw));
      const returnDate = normalizeWhitespace(stripWrappingQuotes(endRaw));
      const userName = normalizeWhitespace(stripWrappingQuotes(userNameRaw));
      let partnerName = normalizeWhitespace(stripWrappingQuotes(partnerNameRaw));
      if (partnerName.includes(',')) {
        const parts = partnerName.split(',').map(p => normalizeWhitespace(p));
        partnerName = parts[parts.length - 1];
      }
      partnerName = partnerName.replace(/^"+|"+$/g, '').trim();

      const phoneNumber = normalizeWhitespace(stripWrappingQuotes(phoneRaw));
      const status = canonicalizeStatus(statusRaw);
      const notes = normalizeWhitespace(stripWrappingQuotes(notesRaw));

      return {
        id: `${serial}-${index}`, // Ensure unique ID for usage data as well
        serial,
        name,
        startDate,
        returnDate,
        userName,
        partnerName,
        phoneNumber,
        status,
        notes,
      };
    });

  return parsedData;
};

export const parsePartnerCsv = (csvString) => {
  const lines = (csvString || '').split(/\r?\n/).filter(l => l != null && l !== '');
  if (lines.length < 2) {
    console.error('Partner CSV data is too short to parse.');
    return [];
  }

  const dataLines = lines.slice(1);

  const parsedData = dataLines
    .map((line) => splitCsvLine(line))
    .filter(cols => cols.length > 0 && cols.some(c => normalizeWhitespace(c) !== ''))
    .map((columns, index) => {
      // Expected columns: 파트너 상호,파트너 사업자번호,파트너 담당자,파트너 연락처,파트너 주소
      const companyNameRaw = columns[0];
      const businessNumberRaw = columns[1];
      const contactPersonRaw = columns[2];
      const contactNumberRaw = columns[3];
      const addressRaw = columns[4];

      const companyName = normalizeWhitespace(stripWrappingQuotes(companyNameRaw));
      const businessNumber = normalizeWhitespace(stripWrappingQuotes(businessNumberRaw));
      const contactPerson = normalizeWhitespace(stripWrappingQuotes(contactPersonRaw));
      const contactNumber = normalizeWhitespace(stripWrappingQuotes(contactNumberRaw));
      const address = normalizeWhitespace(stripWrappingQuotes(addressRaw));

      return {
        id: `${companyName}-${businessNumber}-${index}`, // Unique ID for partner data
        companyName,
        businessNumber,
        contactPerson,
        contactNumber,
        address,
      };
    });

  return parsedData;
};
