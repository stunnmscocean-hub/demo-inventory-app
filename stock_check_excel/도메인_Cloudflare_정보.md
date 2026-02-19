# 도메인 및 Cloudflare 설정 정보

## 📋 도메인 정보

### 도메인명
- **도메인**: `otinventory.com`
- **등록 기관**: Namecheap
- **등록일**: 2025-12-29
- **만료일**: 2026-12-29
- **갱신 가격**: $11.28/년

### 도메인 관리
- **등록 기관 사이트**: https://www.namecheap.com
- **로그인 필요**: Namecheap 계정으로 로그인
- **관리 페이지**: Domain List → otinventory.com → Manage

---

## ☁️ Cloudflare 설정 정보

### 계정 정보
- **서비스**: Cloudflare (무료 플랜)
- **사이트**: https://dash.cloudflare.com
- **도메인**: otinventory.com

### 네임서버
```
donna.ns.cloudflare.com
trey.ns.cloudflare.com
```

### Zone ID
```
1d69d177437fb8d69a5aded3994e0598
```

### Account ID
```
342301c93076d92bc5fa8eea3df52440
```

---

## 🔧 DNS 설정

### A 레코드
```
Type: A
Name: @
IPv4 address: 3.35.238.188
Proxy status: DNS only (회색 구름) ⚠️ (포트 18273 사용 시 필수)
TTL: Auto
```
**주의**: 포트 18273은 Cloudflare가 프록시할 수 없으므로 DNS only 모드 사용

### 서브도메인 A 레코드 (IP 직접 접속용)
```
Type: A
Name: ip
IPv4 address: 3.35.238.188
Proxy status: DNS only (회색 구름) ⚠️
TTL: Auto
```
**용도**: 도메인 활성화 전까지 `http://ip.otinventory.com:18273`로 접속 가능
**주의**: 포트 18273은 Cloudflare가 프록시할 수 없으므로 DNS only 모드 사용

### 기타 레코드
- **MX 레코드**: 이메일 전달용 (유지)
- **TXT 레코드**: SPF 레코드 (유지)
- **CNAME (www)**: 삭제 또는 유지 가능

---

## 🔒 SSL/TLS 설정

### Encryption Mode
- **설정**: Full
- **설명**: Cloudflare와 서버 간 HTTPS 통신

### Edge Certificates
- **Always Use HTTPS**: ON
- **Automatic HTTPS Rewrites**: ON

---

## 🔀 Page Rules (포트 리디렉션)

### 규칙 1: 메인 도메인 리디렉션
```
URL: otinventory.com/*
Setting: Forwarding URL
Status Code: 301 - Permanent Redirect
Destination URL: https://otinventory.com:18273/$1
```

**효과**: 
- `https://otinventory.com` → 자동으로 `https://otinventory.com:18273`로 리디렉션
- 포트 번호가 URL에 표시되지 않음 (보안 강화)

### 규칙 2: 서브도메인 리디렉션 (IP 접속용)
```
URL: ip.otinventory.com/*
Setting: Forwarding URL
Status Code: 301 - Permanent Redirect
Destination URL: https://ip.otinventory.com:18273/$1
```

**효과**: 
- `https://ip.otinventory.com` → 자동으로 `https://ip.otinventory.com:18273`로 리디렉션
- 도메인 활성화 전까지 임시 접속용

---

## 🛡️ 보안 설정

### 서버 보안 (server.py)
- **Cloudflare IP 화이트리스트**: 활성화
- **직접 IP 접속 차단**: `3.35.238.188:18273` 직접 접속 차단
- **허용되는 접속**:
  - Cloudflare를 통한 접속 (`https://otinventory.com`)
  - localhost (127.0.0.1) - excel_reader.py용

### Rate Limiting
- **활성화**: ON
- **제한**: 분당 60회 요청
- **차단 시**: 429 Too Many Requests

---

## 📍 서버 정보

### AWS Lightsail
- **Public IP**: 3.35.238.188
- **Private IP**: 172.26.10.159
- **인스턴스 타입**: Windows Server
- **포트**: 18273

### 방화벽 규칙
- **SSH**: TCP 22 (Any IPv4)
- **HTTP**: TCP 80 (Any IPv4)
- **RDP**: TCP 3389 (Any IPv4)
- **Custom**: TCP 18273 (Any IPv4)

---

## 🔍 확인 방법

### 네임서버 확인
```
https://www.whatsmydns.net/#NS/otinventory.com
```
- Cloudflare 네임서버가 표시되면 정상

### 도메인 접속 테스트
- **정상**: `http://otinventory.com:18273` → 접속 가능 (포트 포함 필수!)
- **정상**: `http://ip.otinventory.com:18273` → 접속 가능
- **에러**: `http://otinventory.com` (포트 없음) → Error 522 (서버가 포트 80에서 리스닝 안 함)
- **차단**: `http://3.35.238.188:18273` → 403 Forbidden (보안 활성화 시)

---

## 📝 유지보수 가이드

### 도메인 갱신
1. Namecheap 로그인
2. Domain List → otinventory.com
3. "Add Years" 또는 "Renew" 클릭
4. 결제 완료

### Cloudflare 설정 변경
1. https://dash.cloudflare.com 로그인
2. otinventory.com 선택
3. DNS, SSL/TLS, Rules 등 메뉴에서 설정 변경

### 네임서버 확인
- 변경 후 5분~2시간 소요 (최대 48시간)
- https://www.whatsmydns.net 에서 확인

### 서버 IP 변경 시
1. Cloudflare → DNS → Records
2. A 레코드의 IPv4 address 수정
3. Save

---

## ⚠️ 주의사항

1. **DNSSEC**: Cloudflare 사용 시 Namecheap에서 OFF로 설정
2. **네임서버**: Cloudflare 네임서버로 변경 필수
3. **직접 IP 접속**: 보안상 차단됨 (의도된 동작)
4. **포트 18273**: 서버에서 직접 접근 시 localhost만 허용

---

## 📞 지원

### Namecheap 지원
- https://www.namecheap.com/support/

### Cloudflare 지원
- https://support.cloudflare.com/
- Community: https://community.cloudflare.com/

---

**마지막 업데이트**: 2025-12-29

