# 🌐 FreeDNS 동적 DNS 설정 가이드

## 📋 준비물
- FreeDNS 계정 (https://freedns.afraid.org)
- 생성한 서브도메인 (예: mystock.mooo.com)

---

## 1️⃣ FreeDNS에서 Update URL 찾기

### 방법 1: 웹사이트에서 확인
1. https://freedns.afraid.org 로그인
2. 왼쪽 메뉴에서 **"Dynamic DNS"** 클릭
3. 본인의 도메인 찾기 (예: mystock.mooo.com)
4. 오른쪽에 있는 **"Direct URL"** 링크를 **우클릭** → "링크 주소 복사"

### URL 형식 예시:
```
v2 (최신): https://sync.afraid.org/u/CyTXMbtq5cPnLjEg5vKHTPDE/
v1 (구버전): https://freedns.afraid.org/dynamic/update.php?CyTXMbtq5cPnLjEg5vKHTPDE
```

---

## 2️⃣ 코드에 설정하기

### 단계 1: xlsx_watcher.c 파일 열기

23번째 줄 근처에서 다음 부분을 찾으세요:

```c
// 웹 서버 설정
#define WEB_PORT "8080"
#define ENABLE_PUBLIC_ACCESS 1
#define ENABLE_DDNS 1  // ← 이미 1로 설정됨
#define DDNS_UPDATE_URL "https://sync.afraid.org/u/YOUR_TOKEN_HERE/"  // ← 여기 수정!
#define DDNS_UPDATE_INTERVAL_SEC 600
```

### 단계 2: YOUR_TOKEN_HERE를 실제 토큰으로 교체

**예시 1 (v2 URL 사용):**
```c
#define DDNS_UPDATE_URL "https://sync.afraid.org/u/CyTXMbtq5cPnLjEg5vKHTPDE/"
```

**예시 2 (v1 URL 사용):**
```c
#define DDNS_UPDATE_URL "https://freedns.afraid.org/dynamic/update.php?CyTXMbtq5cPnLjEg5vKHTPDE"
```

> ⚠️ **중요:** 큰따옴표 `"` 를 유지하고, 세미콜론도 빠뜨리지 마세요!

---

## 3️⃣ 컴파일하기

### PowerShell에서 실행:
```powershell
gcc xlsx_watcher.c mongoose.c -o xlsx_watcher_public.exe -lws2_32 -lcomctl32 -mwindows
```

### 컴파일 성공 확인:
- 에러 없이 완료되면 `xlsx_watcher_public.exe` 파일 생성됨

---

## 4️⃣ 테스트하기

### 프로그램 실행:
```powershell
.\xlsx_watcher_public.exe
```

### 확인 사항:
프로그램 시작 시 터미널에 다음과 같은 메시지가 보여야 합니다:

```
===========================================
  재고 진단 시스템 v2.0 (웹 서버 내장)
===========================================
감시 경로: C:\Users\Choijay\Downloads

✓ 웹 서버 시작 성공!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  로컬 접속: http://localhost:8080
  외부 접속 허용됨 ✓
  공인 IP: 123.456.78.90
  외부 접속 URL: http://123.456.78.90:8080
  동적 DNS: 활성화 (600초마다 업데이트)
DDNS 업데이트 완료: Updated mystock.mooo.com from ...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 성공적으로 업데이트되면:
```
DDNS 업데이트 완료: Updated mystock.mooo.com from 1.2.3.4 to 5.6.7.8
```

### 실패하면:
```
[경고] DDNS 업데이트 실패
```
→ URL이 정확한지 다시 확인하세요!

---

## 5️⃣ 포트 포워딩 설정 (필수!)

외부에서 접근하려면 공유기 설정이 필요합니다.

### 필요한 정보 확인:
```powershell
# 현재 PC의 로컬 IP 확인
ipconfig
```
→ IPv4 주소 찾기 (예: 192.168.0.105)

### 공유기 설정:
1. 공유기 관리 페이지 접속 (192.168.0.1 또는 192.168.1.1)
2. "포트 포워딩" 또는 "가상 서버" 메뉴
3. 새 규칙 추가:
   ```
   외부 포트: 8080
   내부 IP: 192.168.0.105  ← ipconfig로 확인한 IP
   내부 포트: 8080
   프로토콜: TCP
   ```

### 방화벽 설정:
```powershell
# 관리자 권한 PowerShell에서 실행
netsh advfirewall firewall add rule name="Stock Check Server" dir=in action=allow protocol=TCP localport=8080
```

---

## 6️⃣ 접속 테스트

### 로컬 (같은 컴퓨터):
```
http://localhost:8080
```

### 같은 WiFi의 다른 기기:
```
http://192.168.0.105:8080
```

### 외부 (모바일 데이터, 다른 네트워크):
```
http://mystock.mooo.com:8080
```

### API 테스트:
```
http://mystock.mooo.com:8080/api/stock
```

---

## 🔧 문제 해결

### ❌ "DDNS 업데이트 실패"
**원인:**
- URL이 잘못됨
- 인터넷 연결 끊김
- FreeDNS 서버 일시 장애

**해결:**
1. DDNS_UPDATE_URL 다시 확인
2. 브라우저에서 URL 직접 열어보기
3. 복사할 때 공백이나 개행이 포함되지 않았는지 확인

### ❌ "외부에서 접속 안 됨"
**확인 사항:**
- [ ] 포트 포워딩 설정 완료
- [ ] 방화벽 포트 8080 허용
- [ ] 프로그램 실행 중
- [ ] 공인 IP가 맞는지 확인

**테스트 방법:**
```powershell
# 포트가 열려있는지 확인
# https://www.yougetsignal.com/tools/open-ports/ 에서 테스트
```

### ❌ "공인 IP를 가져올 수 없습니다"
**원인:**
- 인터넷 연결 문제
- IP 확인 서비스 일시 장애

**해결:**
- 잠시 후 자동으로 재시도됨
- 인터넷 연결 확인

---

## 📱 실전 사용 예시

### React 앱에서:
```javascript
// config.js
export const API_URL = 'http://mystock.mooo.com:8080';

// StockList.js
import { API_URL } from './config';

fetch(`${API_URL}/api/stock`)
  .then(res => res.json())
  .then(data => {
    console.log('총 상품 수:', data.count);
    console.log('상품 목록:', data.products);
  });
```

### Python 스크립트에서:
```python
import requests

response = requests.get('http://mystock.mooo.com:8080/api/stock')
data = response.json()

for product in data['products']:
    print(f"{product['name']}: {product['stock']}개")
```

### 모바일 앱에서:
```typescript
// React Native
const fetchStock = async () => {
  const response = await fetch('http://mystock.mooo.com:8080/api/stock');
  const data = await response.json();
  setStockData(data.products);
};
```

---

## 🎯 자동 업데이트 주기 변경

10분마다 업데이트하는 것이 기본값이지만, 변경할 수 있습니다:

```c
#define DDNS_UPDATE_INTERVAL_SEC 300  // 5분마다
#define DDNS_UPDATE_INTERVAL_SEC 1800  // 30분마다
#define DDNS_UPDATE_INTERVAL_SEC 3600  // 1시간마다
```

---

## ✅ 완료 체크리스트

- [ ] FreeDNS 계정 생성 완료
- [ ] 서브도메인 생성 (예: mystock.mooo.com)
- [ ] Update URL 복사 완료
- [ ] xlsx_watcher.c에 URL 입력 완료
- [ ] 컴파일 성공
- [ ] 프로그램 실행 시 "DDNS 업데이트 완료" 메시지 확인
- [ ] 포트 포워딩 설정 완료
- [ ] 방화벽 포트 허용 완료
- [ ] 외부에서 접속 테스트 완료

---

## 🎉 성공!

이제 전 세계 어디서나 `http://mystock.mooo.com:8080`으로 재고 데이터를 조회할 수 있습니다!

IP가 변경되어도 자동으로 업데이트되므로 계속 같은 URL로 접근 가능합니다.


