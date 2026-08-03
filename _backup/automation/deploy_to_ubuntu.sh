#!/bin/bash
# Ubuntu 서버 배포 스크립트

echo "=========================================="
echo "재고 조회 시스템 - Ubuntu 서버 배포"
echo "=========================================="

# 1. 필요한 패키지 설치
echo "[1/6] 필요한 패키지 설치 중..."
sudo apt-get update
sudo apt-get install -y build-essential gcc python3 python3-pip

# 2. Python 패키지 설치
echo "[2/6] Python 패키지 설치 중..."
pip3 install requests

# 3. 파일 권한 설정
echo "[3/6] 파일 권한 설정 중..."
chmod +x fetch_erp_stock.py
chmod +x datatocsv.py

# 4. C 프로그램 컴파일
echo "[4/6] C 프로그램 컴파일 중..."
gcc xlsx_watcher.c mongoose.c -o xlsx_watcher -lws2_32 -lcomctl32 2>&1 || \
gcc xlsx_watcher.c mongoose.c -o xlsx_watcher -lpthread

if [ $? -eq 0 ]; then
    echo "✅ 컴파일 성공!"
    chmod +x xlsx_watcher
else
    echo "❌ 컴파일 실패 - Windows 전용 라이브러리 사용 중"
    echo "Linux용으로 수정이 필요합니다."
    exit 1
fi

# 5. systemd 서비스 파일 생성
echo "[5/6] systemd 서비스 설정 중..."
sudo tee /etc/systemd/system/stock-check.service > /dev/null <<EOF
[Unit]
Description=Stock Check System
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=$(pwd)/xlsx_watcher
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# 6. 방화벽 설정 (포트 18273)
echo "[6/6] 방화벽 설정 중..."
sudo ufw allow 18273/tcp
sudo ufw --force enable

echo ""
echo "=========================================="
echo "✅ 배포 완료!"
echo "=========================================="
echo ""
echo "다음 명령어로 서비스를 시작하세요:"
echo "  sudo systemctl start stock-check"
echo "  sudo systemctl enable stock-check  # 부팅 시 자동 시작"
echo ""
echo "서비스 상태 확인:"
echo "  sudo systemctl status stock-check"
echo ""
echo "웹 접속:"
echo "  http://13.125.123.62:18273"
echo "=========================================="

