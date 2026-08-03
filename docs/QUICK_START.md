# 🚀 빠른 시작 가이드

## 1️⃣ 로컬에서만 사용하기 (가장 간단)

현재 설정 그대로 실행하면 됩니다!

```powershell
# 실행
.\xlsx_watcher_v2.exe
```

**접속:**
- http://localhost:8080

---

## 2️⃣ 같은 WiFi의 다른 기기에서 접근하기

### 단계 1: 현재 컴퓨터 IP 확인
```powershell
ipconfig
```
→ IPv4 주소 확인 (예: 192.168.0.105)

### 단계 2: 방화벽 포트 열기 (관리자 권한 PowerShell)
```powershell
netsh advfirewall firewall add rule name="Stock Check Server" dir=in action=allow protocol=TCP localport=8080
```

### 단계 3: 다른 기기에서 접속
- 스마트폰 (같은 WiFi): `http://192.168.0.105:8080`
- 다른 PC (같은 WiFi): `http://192.168.0.105:8080`

---

## 3️⃣ 인터넷 어디서나 접근하기 (외부 공개)

### 방법 A: 공인 IP로 접근

#### 1. 공인 IP 확인
```powershell
curl ifconfig.me
```
→ 예: 123.456.78.90

#### 2. 공유기 포트 포워딩 설정
- 공유기 관리 페이지 접속 (192.168.0.1 또는 192.168.1.1)
- 포트 포워딩 추가:
  - 외부 포트: 8080
  - 내부 IP: 192.168.0.105 (ipconfig로 확인한 IP)
  - 내부 포트: 8080
  - 프로토콜: TCP

#### 3. 방화벽 설정 (위의 2️⃣-2 참고)

#### 4. 외부에서 접속
- `http://123.456.78.90:8080`

**단점:** 공인 IP가 변경되면 다시 확인해야 함

---

### 방법 B: 도메인으로 접근 (추천) 🌟

IP가 변경되어도 자동으로 업데이트됩니다!

#### 1. FreeDNS 계정 생성
- https://freedns.afraid.org 접속
- 회원가입 (무료)

#### 2. 서브도메인 생성
1. "Subdomains" 메뉴 클릭
2. "Add" 버튼 클릭
3. 입력:
   - Type: `A`
   - Subdomain: `mystock` (원하는 이름)
   - Domain: `mooo.com` 선택 (또는 다른 도메인)
4. 저장
5. 결과: `mystock.mooo.com`

#### 3. Update Token 복사
1. "Dynamic DNS" 메뉴 클릭
2. 방금 만든 도메인 찾기
3. "Direct URL" 링크 **전체** 복사
   - 예: `https://freedns.afraid.org/dynamic/update.php?abcd1234efgh5678...`

#### 4. 프로그램 설정
`xlsx_watcher.c` 파일 열기:

```c
// 17번째 줄 근처에서 찾아서 수정:

#define ENABLE_PUBLIC_ACCESS 1  // 0 → 1로 변경
#define ENABLE_DDNS 1           // 0 → 1로 변경
#define DDNS_UPDATE_URL "여기에_복사한_URL_붙여넣기"
```

**예시:**
```c
#define ENABLE_PUBLIC_ACCESS 1
#define ENABLE_DDNS 1
#define DDNS_UPDATE_URL "https://freedns.afraid.org/dynamic/update.php?abcd1234efgh5678"
```

#### 5. 재컴파일
```powershell
gcc xlsx_watcher.c mongoose.c -o xlsx_watcher_public.exe -lws2_32 -lcomctl32 -mwindows
```

#### 6. 포트 포워딩 설정 (방법 A의 2번 참고)

#### 7. 실행 및 테스트
```powershell
.\xlsx_watcher_public.exe
```

**접속:**
- 내부: `http://localhost:8080`
- 외부: `http://mystock.mooo.com:8080`

프로그램이 10분마다 자동으로 IP를 업데이트합니다!

---

## 📱 React/React Native에서 사용하기

```typescript
// config.ts
export const API_BASE_URL = 'http://mystock.mooo.com:8080';

// StockComponent.tsx
import { API_BASE_URL } from './config';

const fetchStock = async () => {
  const response = await fetch(`${API_BASE_URL}/api/stock`);
  const data = await response.json();
  console.log(data.products);
  // [
  //   { name: "Logitech MX Master 3", stock: 1250 },
  //   { name: "Logitech G502", stock: 3420 }
  // ]
};
```

---

## ✅ 접속 테스트 체크리스트

- [ ] 로컬 테스트: http://localhost:8080 ✓
- [ ] 같은 WiFi 모바일: http://192.168.x.x:8080
- [ ] 외부 (모바일 데이터): http://mystock.mooo.com:8080
- [ ] API 테스트: `/api/stock` 엔드포인트

---

## 🔥 자주 묻는 질문 (FAQ)

**Q: 컴파일 에러가 나요**
A: `mongoose.h`와 `mongoose.c`가 같은 폴더에 있는지 확인하세요.

**Q: 외부에서 연결이 안 돼요**
A: 
1. 방화벽 설정 확인
2. 포트 포워딩 확인
3. 공인 IP 확인 (`curl ifconfig.me`)
4. 프로그램이 실행 중인지 확인

**Q: IP가 자주 바뀌는데요**
A: 동적 DNS (방법 B) 사용을 권장합니다.

**Q: 포트 8080을 다른 프로그램이 사용 중이에요**
A: `WEB_PORT`를 `"8081"` 등으로 변경하고 재컴파일하세요.

**Q: HTTPS는 안 되나요?**
A: Mongoose가 TLS를 지원하므로 가능합니다. 별도로 설정이 필요합니다.

---

## 🎯 다음 단계

- [ ] 기본 인증 추가 (보안 강화)
- [ ] HTTPS 설정 (Let's Encrypt)
- [ ] 모바일 앱 개발
- [ ] 알림 기능 추가


