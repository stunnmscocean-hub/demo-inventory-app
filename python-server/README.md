# Excel to PDF Converter Server

Windows COM 자동화를 사용하여 Excel 파일을 PDF로 변환한 후 JPG 이미지로 변환하는 Python 서버입니다.

## 요구사항

- Windows 운영체제
- Microsoft Excel 설치 (2016 이상 권장)
- Python 3.7 이상
- 관리자 권한 (COM 자동화를 위해)

## 설치 및 실행

### 1. Python 패키지 설치

```bash
pip install -r requirements.txt
```

### 2. 서버 실행

#### 방법 1: 배치 파일 사용 (권장)
```bash
start_server.bat
```

#### 방법 2: 직접 실행
```bash
python excel_to_pdf_converter.py
```

### 3. 서버 상태 확인

브라우저에서 `http://localhost:5000/health`에 접속하여 서버가 정상적으로 실행되는지 확인합니다.

## API 엔드포인트

### POST /convert-excel-to-jpg

Excel 데이터를 받아서 JPG 이미지로 변환합니다.

**요청 본문:**
```json
{
  "formData": {
    "requester": "홍길동",
    "checkoutDate": "2024-01-15",
    "returnDate": "2024-01-20",
    "checkoutReason": "데모 테스트",
    "checkoutLocation": "서울사무소",
    "partnerCompanyName": "ABC회사",
    "partnerBusinessNumber": "123-45-67890",
    "partnerContactPerson": "김담당",
    "partnerContactNumber": "010-1234-5678",
    "partnerAddress": "서울시 강남구",
    "usageCompanyName": "XYZ회사",
    "usageBusinessNumber": "987-65-43210",
    "usageAddress": "서울시 서초구",
    "usageContactPerson": "이담당",
    "usageContactNumber": "010-9876-5432",
    "memoItems": ["메모1", "메모2"]
  },
  "selectedEquipments": [
    {"name": "Rally Plus", "serial": "RP001"},
    {"name": "Sight", "serial": "ST001"}
  ]
}
```

**응답:**
```json
{
  "success": true,
  "imageData": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ..."
}
```

## 문제 해결

### 1. Excel COM 자동화 오류
- Microsoft Excel이 설치되어 있는지 확인
- Excel이 다른 프로세스에서 사용 중이지 않은지 확인
- 관리자 권한으로 실행

### 2. PDF 변환 오류
- Excel 템플릿 파일이 올바른 위치에 있는지 확인 (`../public/장비 대여요청서.xlsx`)
- Excel 파일이 손상되지 않았는지 확인

### 3. 포트 충돌
- 5000번 포트가 사용 중인 경우 `excel_to_pdf_converter.py`에서 포트 번호를 변경

## 로그 확인

서버 실행 시 콘솔에서 다음과 같은 로그를 확인할 수 있습니다:

```
Excel to PDF Converter Server 시작...
서버 주소: http://localhost:5000
Excel 애플리케이션 시작됨
변환 요청 받음 - 요청자: 홍길동
Excel 데이터 입력 완료
PDF 내보내기 완료: C:\Users\...\temp.pdf
PDF를 JPG로 변환 완료
Excel 애플리케이션 종료됨
```




