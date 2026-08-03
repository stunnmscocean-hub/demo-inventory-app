@echo off
title 재고 조회 시스템 - Python 서버 (Google OAuth)
echo.
echo ====================================
echo   재고 조회 시스템 (Security Ver.)
echo ====================================
echo.
echo 1. 필요한 라이브러리 확인 중...
pip install requests > nul 2>&1
echo.
echo 2. 서버 시작 중...
echo    접속 주소: http://localhost:18273
echo.
echo [주의] 창을 닫으면 서버가 종료됩니다.
echo.

python server.py

pause
