# 🚀 Google Apps Script 배포 가이드

## ⚠️ 중요: 단일 파일로 배포

`real-complete-code.gs` 파일을 **하나의 파일**로 배포해야 합니다.

---

## 📝 배포 단계

### 1️⃣ GAS 편집기 정리

1. Google Apps Script 편집기 열기: https://script.google.com/
2. **기존 파일 모두 삭제** (또는 새 프로젝트 생성)
   - 좌측 파일 목록에서 `main.gs`, `acl.gs` 등 모두 삭제
   - 파일 1개만 남기기

---

### 2️⃣ 코드 복사

1. `gas-scripts/real-complete-code.gs` 파일 열기
2. **전체 선택** (Ctrl+A)
3. **복사** (Ctrl+C)

---

### 3️⃣ GAS에 붙여넣기

1. GAS 편집기의 유일한 파일 선택
2. **기존 내용 전체 삭제**
3. **붙여넣기** (Ctrl+V)
4. 파일 이름을 `Code.gs`로 변경 (선택사항)

---

### 4️⃣ 필수 액션 확인

**Ctrl+F로 검색하여 다음 코드가 있는지 확인:**

```javascript
case 'getMyDemoData':
  return handleGetMyDemoData(e.parameter.userName);
```

```javascript
case 'getEquipmentData':
  return handleGetEquipmentData();
```

```javascript
case 'getPartnerData':
  return handleGetPartnerData();
```

✅ **모두 있으면 OK!**

---

### 5️⃣ 배포

#### 방법 A: 기존 배포 업데이트 (권장)

```
1. 상단 "배포" 클릭
2. "배포 관리" 선택
3. 활성 배포 항목 옆 "편집" 아이콘 (연필) 클릭
4. "버전" 드롭다운 → "새 버전" 선택
5. 설명: "getMyDemoData 액션 추가"
6. "배포" 클릭
```

#### 방법 B: 새 배포 생성

```
1. 상단 "배포" 클릭
2. "새 배포" 선택
3. "유형 선택" → "웹 앱" 선택
4. "실행 사용자": 나
5. "액세스 권한": 모든 사용자
6. "배포" 클릭
7. 새 URL 복사
8. .env.local 파일의 REACT_APP_GAS_URL 업데이트
```

---

### 6️⃣ 테스트

GAS 편집기에서 실행:

```javascript
function testGetMyDemoData() {
  const result = handleGetMyDemoData('홍길동');
  Logger.log(result);
  return result;
}
```

**실행** → "실행 로그" 확인

---

## 🐛 문제 해결

### 에러: "No valid action specified"

→ `doGet` 함수에 해당 액션이 없음
→ **1단계부터 다시 진행**

### 에러: "handleGetMyDemoData is not defined"

→ 함수가 없음
→ `real-complete-code.gs` **전체**를 복사했는지 확인

### 에러: "Permission denied"

→ 배포 설정 확인
→ "실행 사용자": 나
→ "액세스 권한": 모든 사용자

---

## ✅ 배포 완료 체크리스트

- [ ] `real-complete-code.gs` 파일 **전체** 복사
- [ ] GAS에 **단일 파일**로 붙여넣기
- [ ] `case 'getMyDemoData':` 존재 확인
- [ ] `case 'getEquipmentData':` 존재 확인
- [ ] `case 'getPartnerData':` 존재 확인
- [ ] 새 버전으로 배포
- [ ] React 앱 새로고침 (F5)
- [ ] 에러 없이 데이터 로드 확인

---

## 📞 도움이 필요하면

GAS 편집기의 `doGet` 함수 코드를 복사해서 보여주세요!

