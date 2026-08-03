@echo off
chcp 65001 >nul
echo ==========================================
echo Ubuntu 서버로 파일 업로드
echo ==========================================
echo.

REM SSH 키 파일 경로 (다운로드한 위치로 변경하세요)
set SSH_KEY="%USERPROFILE%\Downloads\default-key-seoul.pem"
set SERVER_IP=13.125.123.62
set SERVER_USER=ubuntu

echo [1/3] SSH 키 파일 확인...
if not exist %SSH_KEY% (
    echo ❌ SSH 키 파일을 찾을 수 없습니다: %SSH_KEY%
    echo.
    echo SSH 키 파일 위치를 확인하고 스크립트를 수정하세요.
    echo 또는 WinSCP를 사용하여 수동으로 업로드하세요.
    pause
    exit /b 1
)

echo ✅ SSH 키 파일 확인됨
echo.

echo [2/3] 필수 파일 확인...
if not exist server.py (
    echo ❌ server.py 파일이 없습니다!
    pause
    exit /b 1
)
if not exist dashboard_modern.html (
    echo ❌ dashboard_modern.html 파일이 없습니다!
    pause
    exit /b 1
)
if not exist fetch_erp_stock.py (
    echo ❌ fetch_erp_stock.py 파일이 없습니다!
    pause
    exit /b 1
)

echo ✅ 필수 파일 확인됨
echo.

echo [3/3] 서버로 파일 전송 중...
echo.

scp -i %SSH_KEY% server.py %SERVER_USER%@%SERVER_IP%:~/ 2>nul
if %errorlevel% neq 0 (
    echo ❌ server.py 전송 실패
    echo.
    echo SCP가 설치되어 있지 않을 수 있습니다.
    echo WinSCP를 사용하여 수동으로 업로드하세요.
    pause
    exit /b 1
)

scp -i %SSH_KEY% dashboard_modern.html %SERVER_USER%@%SERVER_IP%:~/ 2>nul
scp -i %SSH_KEY% fetch_erp_stock.py %SERVER_USER%@%SERVER_IP%:~/ 2>nul

if exist stock_data.json (
    scp -i %SSH_KEY% stock_data.json %SERVER_USER%@%SERVER_IP%:~/ 2>nul
    echo ✅ stock_data.json 전송됨
)

if exist stock_data.csv (
    scp -i %SSH_KEY% stock_data.csv %SERVER_USER%@%SERVER_IP%:~/ 2>nul
    echo ✅ stock_data.csv 전송됨
)

echo.
echo ==========================================
echo ✅ 파일 전송 완료!
echo ==========================================
echo.
echo 다음 단계:
echo 1. 서버에 SSH 접속:
echo    ssh -i %SSH_KEY% %SERVER_USER%@%SERVER_IP%
echo.
echo 2. 서버에서 다음 명령어 실행:
echo    sudo apt-get update
echo    sudo apt-get install -y python3 python3-pip
echo    pip3 install requests
echo    chmod +x server.py fetch_erp_stock.py
echo    python3 server.py
echo.
echo 자세한 내용은 DEPLOY_UBUNTU.md 파일을 참고하세요.
echo.
pause

