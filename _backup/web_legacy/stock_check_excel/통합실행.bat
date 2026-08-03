@echo off
chcp 65001 >nul
title 재고 시스템 통합 실행
color 0A

echo ========================================
echo 재고 조회 시스템 통합 실행
echo ========================================
echo.

:: 현재 디렉토리로 이동
cd /d "%~dp0"

echo [1단계] 기존 프로세스 종료 중...
echo.

:: Python 프로세스 종료 (server.py, excel_reader.py, erp_automation)
for /f "tokens=2" %%a in ('tasklist ^| findstr /i "python.exe"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo ✓ 기존 프로세스 종료 완료
echo.

:: 1초 대기
timeout /t 1 /nobreak >nul

echo [2단계] 서버 시작 중...
echo.

:: 서버 실행 (별도 창)
start "Stock Server" python server.py

echo ✓ 서버 시작됨 (별도 창)
echo   포트: 18273
echo.

:: 2초 대기 (서버 초기화)
timeout /t 2 /nobreak >nul

echo [3단계] Excel Reader 시작 중...
echo.

:: Excel Reader 실행 (별도 창)
start "Excel Reader" python excel_reader.py

echo ✓ Excel Reader 시작됨 (별도 창)
echo   모니터링: Downloads 폴더
echo.

:: 2초 대기
timeout /t 2 /nobreak >nul

echo [4단계] ERP 자동화 시작 중...
echo.

:: ERP 자동화 실행 (별도 창, 10분마다 반복)
start "ERP Automation" python erp_automation_loop.py

echo ✓ ERP 자동화 시작됨 (별도 창)
echo   주기: 10분마다 실행
echo.

:: 2초 대기
timeout /t 2 /nobreak >nul

echo [5단계] 포트 리디렉션 서버 시작 중...
echo.
echo ⚠️  주의: 포트 80 리디렉션 서버는 관리자 권한이 필요합니다.
echo    관리자 권한으로 실행하지 않으면 이 단계는 건너뜁니다.
echo.

:: 포트 리디렉션 서버 실행 (관리자 권한 필요, 별도 창)
start "Redirect Server" python redirect_server.py

echo ✓ 포트 리디렉션 서버 시작 시도 (별도 창)
echo   포트: 80 → 18273 리디렉션
echo   (관리자 권한 없으면 실패할 수 있음)
echo.

echo ========================================
echo ✅ 모든 프로그램이 실행되었습니다!
echo ========================================
echo.
echo 실행 중인 프로그램:
echo   1. Stock Server (포트 18273)
echo   2. Excel Reader (Downloads 폴더 모니터링)
echo   3. ERP Automation (10분마다 두드림 자동화)
echo   4. Redirect Server (포트 80 → 18273, 관리자 권한 필요)
echo.
echo 접속 주소:
echo   - http://otinventory.com:18273 (포트 포함)
echo   - http://otinventory.com (포트 80 리디렉션 서버 실행 시)
echo.
echo 각 프로그램은 별도의 창에서 실행됩니다.
echo 종료하려면 각 창을 닫거나 Ctrl+C를 누르세요.
echo.
pause

