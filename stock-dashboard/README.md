# 📦 재고 조회 시스템 - React Dashboard

ERP API와 실시간 연동되는 재고 관리 대시보드

## 🚀 빠른 시작

### 1. 의존성 설치
```bash
cd stock-dashboard
npm install
```

### 2. 개발 서버 실행
```bash
npm start
```

브라우저가 자동으로 열리며 `http://localhost:3000` 에서 확인할 수 있습니다.

### 3. C 프로그램 실행
별도 터미널에서:
```bash
cd ..
.\xlsx_watcher_ui.exe
```

## 🔧 환경 설정

### API URL 변경
`.env` 파일 생성:
```
REACT_APP_API_URL=http://192.168.0.32:18273
```

또는 배포 시 `App.js`에서 직접 수정:
```javascript
const API_URL = 'http://your-server-ip:18273';
```

## 📦 프로덕션 빌드

```bash
npm run build
```

`build/` 폴더에 최적화된 정적 파일이 생성됩니다.

## 🎨 주요 기능

- ✅ 실시간 재고 조회
- ✅ ERP API 직접 호출
- ✅ 상품명 검색
- ✅ 통계 대시보드
- ✅ 가용률 시각화
- ✅ 반응형 디자인
- ✅ 자동 새로고침 (10초)

## 🌐 배포 방법

### Netlify / Vercel
```bash
npm run build
# build 폴더를 드래그 앤 드롭
```

### Nginx
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    root /path/to/stock-dashboard/build;
    index index.html;
    
    location / {
        try_files $uri /index.html;
    }
    
    # API 프록시
    location /api/ {
        proxy_pass http://localhost:18273/api/;
    }
}
```

## 📱 스크린샷

- 모던하고 깔끔한 UI
- 그라데이션 디자인
- 카드형 통계
- 인터랙티브 테이블
- 프로그레스 바

## 🔗 API 엔드포인트

- `GET /api/stock` - 재고 조회
- `POST /api/refresh` - ERP 데이터 새로고침

