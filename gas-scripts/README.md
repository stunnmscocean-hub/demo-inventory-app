# Google Apps Script - 분리된 구조

## 📁 파일 구조

```
gas-scripts/
├── main.gs          # 메인 라우터 및 진입점
├── config.gs        # 설정값 관리
├── auth.gs          # 인증 관련 함수
├── acl.gs           # 권한 관리 (Access Control List)
├── tasks.gs         # 태스크 관련 함수
├── utils.gs         # 유틸리티 함수
└── README.md        # 이 파일
```

## 🔧 설정 방법

### 1. Google Apps Script에서 새 프로젝트 생성

### 2. 각 파일의 내용을 복사하여 붙여넣기

### 3. Script Properties 설정
- `GOOGLE_CLIENT_ID`: Google OAuth 클라이언트 ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth 클라이언트 시크릿

### 4. 배포 설정
- 배포 유형: 웹 앱
- 실행: 나
- 액세스: 모든 사용자

## 📋 API 엔드포인트

### 기본 연결 테스트
```
GET ?action=ping
```

### ACL 테스트
```
GET ?action=testACL&email=user@example.com
```

### OAuth 처리
```
GET ?action=processOAuth&code=AUTH_CODE&redirect_uri=REDIRECT_URI
```

### 태스크 가져오기
```
GET ?action=getTasks&email=user@example.com&sheetId=SHEET_ID
```

## 🔒 보안 고려사항

1. **Script Properties 사용**: 민감한 정보는 Script Properties에 저장
2. **ACL 검증**: 모든 요청에 대해 ACL 검증 수행
3. **에러 처리**: 상세한 에러 정보 노출 방지
4. **로깅**: 보안 관련 이벤트 로깅

## 🚀 장점

1. **유지보수성**: 기능별 파일 분리로 코드 관리 용이
2. **확장성**: 새로운 기능 추가 시 해당 파일만 수정
3. **가독성**: 각 파일의 역할이 명확
4. **테스트**: 개별 함수 단위 테스트 가능
5. **협업**: 팀원별로 다른 파일 담당 가능

## 📝 사용 예시

### React 앱에서 사용
```javascript
// 기본 연결 테스트
const response = await fetch(`${GAS_URL}?action=ping`);

// OAuth 처리
const userInfo = await fetch(`${GAS_URL}?action=processOAuth&code=${code}&redirect_uri=${redirectUri}`);

// 태스크 가져오기
const tasks = await fetch(`${GAS_URL}?action=getTasks&email=${email}`);
```

## 🔄 마이그레이션 가이드

기존 단일 파일에서 분리된 구조로 마이그레이션:

1. 기존 `code.gs` 백업
2. 새 파일들 생성 및 내용 복사
3. Script Properties 설정 확인
4. 배포 및 테스트
5. 기존 코드 제거

## 🐛 디버깅

### 로그 확인
- Google Apps Script 에디터에서 "실행" → "로그 보기"

### 일반적인 문제
1. **ACL 시트 접근 불가**: 시트 ID 및 권한 확인
2. **OAuth 실패**: 클라이언트 ID/시크릿 확인
3. **권한 오류**: 사용자 이메일이 ACL에 등록되어 있는지 확인
