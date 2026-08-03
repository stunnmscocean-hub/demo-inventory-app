@echo off
chcp 65001 >nul
title AWS 재고 서버 시작
color 0A

echo ========================================
echo AWS 재고 서버 시작
echo ========================================
echo.

:: AWS 서버 디렉토리로 이동
cd /d C:\stock_check_excel

echo [1단계] 기존 서버 프로세스 종료 중...
echo.

:: Python 프로세스 중 server.py만 종료
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :18273 ^| findstr LISTENING') do (
    echo   프로세스 ID: %%a 종료 중...
    taskkill /F /PID %%a >nul 2>&1
)

echo ✓ 기존 서버 종료 완료
echo.

:: 1초 대기
timeout /t 1 /nobreak >nul

echo [2단계] 서버 시작 중...
echo.

:: 서버 실행 (이 창에서 실행)
python server.py

:: 서버가 종료되면 여기로 옴
echo.
echo ========================================
echo 서버가 종료되었습니다
echo ========================================
echo.
pause

