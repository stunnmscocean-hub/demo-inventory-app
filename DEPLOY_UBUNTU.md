# Ubuntu 서버 배포 가이드

## 📋 준비사항

- Ubuntu 서버 IP: `13.125.123.62`
- SSH 키 파일 (다운로드한 `.pem` 파일)

---

## 🚀 배포 단계

### 1. 필요한 파일 준비

다음 파일들을 서버로 전송해야 합니다:

```
필수 파일:
- server.py              (Python 웹 서버)
- dashboard_modern.html  (웹 UI)
- fetch_erp_stock.py     (ERP 데이터 가져오기)
- datatocsv.py           (선택사항)

선택 파일:
- stock_data.json        (초기 데이터, 있으면 좋음)
- stock_data.csv         (초기 데이터, 있으면 좋음)
```

---

### 2. Windows에서 파일 전송 (SCP 사용)

**PowerShell에서 실행:**

```powershell
# 1. SSH 키 파일 위치 확인 (보통 Downloads 폴더)
cd ~/Downloads

# 2. 파일 전송
scp -i "default-key-seoul.pem" `
    server.py `
    dashboard_modern.html `
    fetch_erp_stock.py `
    ubuntu@13.125.123.62:~/

# 3. 초기 데이터도 전송 (있는 경우)
scp -i "default-key-seoul.pem" `
    stock_data.json `
    stock_data.csv `
    ubuntu@13.125.123.62:~/
```

**또는 WinSCP 같은 GUI 도구 사용 가능**

---

### 3. 서버에 SSH 접속

```powershell
ssh -i "default-key-seoul.pem" ubuntu@13.125.123.62
```

---

### 4. 서버에서 설정 및 실행

서버에 접속한 후:

```bash
# 1. 필요한 패키지 설치
sudo apt-get update
sudo apt-get install -y python3 python3-pip

# 2. Python 패키지 설치
pip3 install requests

# 3. 파일 권한 설정
chmod +x server.py
chmod +x fetch_erp_stock.py

# 4. 초기 데이터 로드 (선택사항)
# stock_data.json과 stock_data.csv가 있으면 자동으로 로드됨

# 5. 웹 서버 실행 (테스트)
python3 server.py
```

**Ctrl+C로 종료하고, 백그라운드 실행:**

```bash
# screen 또는 nohup 사용
screen -S stock-server
python3 server.py
# Ctrl+A, D로 detach

# 또는 nohup 사용
nohup python3 server.py > server.log 2>&1 &
```

---

### 5. systemd 서비스로 등록 (권장)

```bash
# 서비스 파일 생성
sudo nano /etc/systemd/system/stock-check.service
```

다음 내용 입력:

```ini
[Unit]
Description=Stock Check System
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu
ExecStart=/usr/bin/python3 /home/ubuntu/server.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

저장 후:

```bash
# 서비스 활성화
sudo systemctl daemon-reload
sudo systemctl enable stock-check
sudo systemctl start stock-check

# 상태 확인
sudo systemctl status stock-check

# 로그 확인
sudo journalctl -u stock-check -f
```

---

### 6. 방화벽 설정

```bash
# 포트 18273 열기
sudo ufw allow 18273/tcp
sudo ufw enable
sudo ufw status
```

---

### 7. 접속 확인

브라우저에서 접속:

```
http://13.125.123.62:18273
```

---

## 🔧 문제 해결

### 서버가 응답하지 않을 때

```bash
# 서비스 상태 확인
sudo systemctl status stock-check

# 로그 확인
sudo journalctl -u stock-check -n 50

# 수동 실행 (디버깅)
python3 server.py
```

### 포트가 열려있지 않을 때

```bash
# 방화벽 확인
sudo ufw status

# 포트 열기
sudo ufw allow 18273/tcp
```

### Python 패키지 에러

```bash
# requests 재설치
pip3 install --upgrade requests
```

---

## 📝 파일 구조

서버에 다음과 같이 배치됩니다:

```
/home/ubuntu/
├── server.py              # Python 웹 서버
├── dashboard_modern.html  # 웹 UI
├── fetch_erp_stock.py     # ERP 데이터 가져오기
├── stock_data.json        # JSON 데이터 (자동 생성)
└── stock_data.csv         # CSV 데이터 (자동 생성)
```

---

## ✅ 완료 체크리스트

- [ ] 파일 전송 완료
- [ ] Python 패키지 설치 완료
- [ ] 서버 실행 확인
- [ ] 방화벽 설정 완료
- [ ] 브라우저에서 접속 확인
- [ ] systemd 서비스 등록 (선택사항)

---

## 🎉 완료!

이제 `http://13.125.123.62:18273`에서 재고 조회 시스템을 사용할 수 있습니다!

