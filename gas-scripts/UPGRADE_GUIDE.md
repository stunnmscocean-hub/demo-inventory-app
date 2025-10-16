# 업그레이드 가이드 - Refcodes 패키지 버전 반영

## 🆕 새로 추가된 기능들

### 1. Google OAuth 라이브러리 통합
- `@react-oauth/google` 패키지 추가
- JWT 토큰 기반 인증 지원
- 더 간편한 OAuth 구현

### 2. TypeScript 지원
- TypeScript 및 관련 타입 정의 추가
- `@types/*` 패키지들 설치
- 향후 TypeScript 마이그레이션 준비

### 3. JWT 토큰 처리
- GAS에서 JWT 토큰 직접 처리
- 인증 코드와 JWT 토큰 모두 지원
- 더 안전한 토큰 검증

## 📦 새로 설치된 패키지들

```json
{
  "@react-oauth/google": "^0.12.2",
  "jwt-decode": "^4.0.0",
  "typescript": "^4.9.5",
  "@types/jest": "^27.5.2",
  "@types/node": "^16.18.126",
  "@types/react": "^19.2.2",
  "@types/react-dom": "^19.2.1",
  "cross-env": "^10.1.0"
}
```

## 🔧 설정 방법

### 1. 환경 변수 설정
```bash
# .env.local 파일 생성
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id
REACT_APP_GAS_URL=your_gas_web_app_url
```

### 2. Google OAuth 설정
1. Google Cloud Console에서 OAuth 2.0 클라이언트 ID 생성
2. 승인된 JavaScript 원본에 `http://localhost:3000` 추가
3. 승인된 리디렉션 URI에 `http://localhost:3000` 추가

### 3. GAS 배포
1. Google Apps Script에서 새 프로젝트 생성
2. 분리된 파일들을 각각 복사
3. Script Properties 설정:
   - `GOOGLE_CLIENT_ID`: Google OAuth 클라이언트 ID
   - `GOOGLE_CLIENT_SECRET`: Google OAuth 클라이언트 시크릿
4. 웹 앱으로 배포

## 🚀 새로운 컴포넌트들

### GoogleOAuthButton
- `@react-oauth/google` 라이브러리 사용
- JWT 토큰 기반 인증
- 자동 토큰 처리

### 업데이트된 API 서비스
- JWT 토큰 처리 지원
- 기존 인증 코드 방식도 유지
- 하위 호환성 보장

## 🔄 마이그레이션 가이드

### 기존 OAuth 콜백 방식에서 새 방식으로

1. **기존 방식 (유지됨)**
   ```javascript
   // 인증 코드 기반
   const userInfo = await processOAuthWithCode(code, redirectUri);
   ```

2. **새로운 방식**
   ```javascript
   // JWT 토큰 기반
   const userInfo = await processOAuth(jwtToken, redirectUri);
   ```

### GAS 코드 업데이트

1. **기존**: `code` 파라미터만 처리
2. **새로운**: `jwt_token` 또는 `code` 파라미터 모두 처리

```javascript
// main.gs에서
const tokenOrCode = e.parameter.jwt_token || e.parameter.code;
return handleProcessOAuth(tokenOrCode, e.parameter.redirect_uri);
```

## 🎯 장점

### 1. 사용자 경험 개선
- 원클릭 로그인
- 팝업 기반 인증
- 더 빠른 인증 처리

### 2. 보안 강화
- JWT 토큰 직접 처리
- 서버 사이드 토큰 검증
- 더 안전한 인증 플로우

### 3. 개발자 경험
- TypeScript 지원
- 더 나은 타입 안정성
- 향후 확장성

## 🐛 문제 해결

### 일반적인 문제들

1. **Google OAuth 버튼이 표시되지 않음**
   - `REACT_APP_GOOGLE_CLIENT_ID` 환경 변수 확인
   - GoogleOAuthProvider로 앱 감싸기 확인

2. **JWT 토큰 처리 실패**
   - GAS 코드에서 JWT 토큰 처리 로직 확인
   - 토큰 형식 검증

3. **TypeScript 에러**
   - 타입 정의 파일 확인
   - `@types/*` 패키지 설치 확인

## 📋 체크리스트

- [ ] 환경 변수 설정 완료
- [ ] Google OAuth 클라이언트 ID 설정
- [ ] GAS 웹 앱 배포 완료
- [ ] JWT 토큰 처리 테스트
- [ ] 기존 인증 코드 방식 테스트
- [ ] 로그인 플로우 전체 테스트

## 🔮 향후 계획

1. **TypeScript 마이그레이션**
   - `.js` 파일들을 `.ts`로 변환
   - 타입 정의 추가

2. **고급 인증 기능**
   - 토큰 갱신
   - 세션 관리
   - 다중 인증 제공자 지원

3. **성능 최적화**
   - 코드 스플리팅
   - 지연 로딩
   - 캐싱 전략
