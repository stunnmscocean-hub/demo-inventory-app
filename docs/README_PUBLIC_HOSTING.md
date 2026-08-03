# 재고 조회 시스템 Public 호스팅 가이드

## 🌍 외부에서 접근 가능하게 만들기

### 방법 1: 포트 포워딩 (가장 간단)

#### 1단계: 공인 IP 확인
```powershell
# 현재 공인 IP 확인
curl ifconfig.me
```

#### 2단계: 공유기 설정
1. 공유기 관리자 페이지 접속 (보통 192.168.0.1 또는 192.168.1.1)
2. 포트 포워딩 설정:
   - 외부 포트: 8080
   - 내부 IP: 현재 컴퓨터 IP (ipconfig로 확인)
   - 내부 포트: 8080
   - 프로토콜: TCP

#### 3단계: 방화벽 설정
```powershell
# Windows 방화벽에서 8080 포트 허용
netsh advfirewall firewall add rule name="Stock Check Server" dir=in action=allow protocol=TCP localport=8080
```

#### 4단계: 접근 테스트
- 외부에서: `http://[공인IP]:8080`
- 모바일(데이터 사용): `http://[공인IP]:8080`

### 방법 2: 동적 DNS 사용 (추천)

공인 IP가 자주 바뀌는 경우 도메인으로 접근하는 방법입니다.

#### 무료 DDNS 서비스
- **FreeDNS** (freedns.afraid.org) - 무료, 광고 없음
- **No-IP** (noip.com) - 무료 (30일마다 갱신 필요)
- **DuckDNS** (duckdns.org) - 무료, 간단

#### 설정 방법 (FreeDNS 예시)

1. **FreeDNS 계정 생성**
   - https://freedns.afraid.org 접속
   - 회원가입 후 로그인

2. **서브도메인 생성**
   - "Subdomains" → "Add"
   - 원하는 이름 입력 (예: mystock)
   - 도메인 선택 (예: mooo.com)
   - 결과: `mystock.mooo.com`

3. **Update Token 복사**
   - "Dynamic DNS" 메뉴
   - "Direct URL" 링크 복사

4. **프로그램 설정**
   - 아래 코드에서 UPDATE_URL 수정

### 방법 3: HTTPS 지원 (보안 강화)

Let's Encrypt 인증서를 사용하여 HTTPS를 지원합니다.

#### 준비물
- 도메인 이름 (위의 DDNS로 얻은 도메인)
- certbot 설치

#### 인증서 발급
```powershell
# Certbot 설치 (winget 사용)
winget install -e --id Certbot.Certbot

# 인증서 발급 (standalone 모드)
# 프로그램을 잠시 중지하고 실행
certbot certonly --standalone -d mystock.mooo.com
```

인증서는 `C:\Certbot\live\mystock.mooo.com\` 에 저장됩니다.

---

## 📋 보안 권장 사항

### 1. 기본 인증 추가
외부에 공개할 때는 인증을 추가하는 것이 좋습니다.

### 2. IP 화이트리스트
특정 IP만 접근하도록 제한할 수 있습니다.

### 3. Rate Limiting
과도한 요청을 차단합니다.

### 4. HTTPS 사용
민감한 데이터가 있다면 필수입니다.

---

## 🔧 문제 해결

### "연결할 수 없음" 오류
1. 방화벽 설정 확인
2. 포트 포워딩 설정 확인
3. 프로그램이 실행 중인지 확인
4. 공인 IP가 맞는지 확인

### "주기적으로 연결이 끊김"
- 공인 IP가 변경되었을 가능성
- 동적 DNS 사용 권장

### "느린 속도"
- ISP의 업로드 속도 확인
- 업로드 대역폭은 다운로드보다 느림

---

## 📱 모바일 앱에서 사용

React Native 앱이나 모바일 웹에서 사용할 때:

```javascript
// 설정 파일에 저장
const API_BASE_URL = 'http://mystock.mooo.com:8080';

// 또는 HTTPS 사용 시
const API_BASE_URL = 'https://mystock.mooo.com';

fetch(`${API_BASE_URL}/api/stock`)
  .then(res => res.json())
  .then(data => console.log(data));
```

---

## 🎯 최종 접근 URL

- **로컬**: http://localhost:8080
- **같은 네트워크**: http://192.168.x.x:8080
- **외부 (IP)**: http://공인IP:8080
- **외부 (도메인)**: http://mystock.mooo.com:8080
- **HTTPS**: https://mystock.mooo.com


