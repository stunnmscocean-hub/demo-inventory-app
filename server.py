#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
재고 조회 시스템 - Python 웹 서버
Ubuntu/Linux 서버용
보안 기능: Google OAuth 2.0 인증 추가
"""

import os
import json
import subprocess
import threading
from datetime import datetime, timedelta, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, quote
import time
from collections import defaultdict
import requests  # pip install requests 필요
import secrets
import string

# 설정 파일 로드 (.env)
def load_env_file(filepath='.env'):
    config = {}
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                if '=' in line:
                    key, value = line.split('=', 1)
                    config[key.strip()] = value.strip()
    return config

env_config = load_env_file()

# OAuth 설정
GOOG_CLIENT_ID = env_config.get('GOOG_CLIENT_ID', '')
GOOG_CLIENT_SECRET = env_config.get('GOOG_CLIENT_SECRET', '')
GOOG_CALLBACK_URL = env_config.get('GOOG_CALLBACK_URL', 'http://localhost:18273/oauth/callback')
SECRET_KEY = env_config.get('SECRET_KEY', 'default_secret_key')
ALLOWED_USERS = [u.strip() for u in env_config.get('ALLOWED_USERS', '').split(',') if u.strip()]

# 설정
PORT = 18273
CSV_FILE = 'stock_data.csv'
JSON_FILE = 'stock_data.json'
HTML_FILE = 'dashboard_modern.html'
LOGIN_FILE = 'login.html'
PYTHON_SCRIPT = 'fetch_erp_stock.py'

# Rate Limiting 설정
RATE_LIMIT_ENABLED = True
MAX_REQUESTS_PER_MINUTE = 120  # 인증된 사용자이므로 조금 더 여유있게
RATE_LIMIT_WINDOW = 60  # 초 단위

# 전역 변수
products = []
products_lock = threading.Lock()
last_update_time = ""

# Rate Limiting을 위한 딕셔너리
# {IP: [(timestamp1, timestamp2, ...)]}
rate_limit_data = defaultdict(list)
rate_limit_lock = threading.Lock()

# 세션 저장소 (메모리)
# {session_id: {'email': email, 'created_at': timestamp, 'ip': ip}}
sessions = {}
session_lock = threading.Lock()

def get_kst_time():
    """한국 시간(KST, UTC+9)으로 현재 시간 반환"""
    kst = timezone(timedelta(hours=9))
    return datetime.now(kst).strftime("%Y-%m-%d %H:%M:%S")

def load_products_from_csv():
    """CSV 파일에서 재고 데이터 로드"""
    global products, last_update_time
    
    if not os.path.exists(CSV_FILE):
        return
    
    try:
        with open(CSV_FILE, 'r', encoding='utf-8-sig') as f:
            lines = f.readlines()
        
        if len(lines) < 2:
            return
        
        # 헤더 파싱
        headers = lines[0].strip().split('\t')
        
        # 필수 컬럼 인덱스 찾기
        try:
            name_idx = headers.index('PRDT_NM')
            total_idx = headers.index('STCK_SUM_QTY')
            reserved_idx = headers.index('STCK_RSV_QTY')
            available_idx = headers.index('STCK_CAN_QTY')
            whse_idx = headers.index('WHSE_NM')
        except ValueError as e:
            print(f"[에러] 필수 칼럼을 찾을 수 없습니다: {e}")
            return
        
        new_products = {}
        target_warehouses = ["대원위탁창고", "본사임시창고"]
        
        # 데이터 파싱 및 집계
        for line in lines[1:]:
            if not line.strip():
                continue
            
            cols = line.strip().split('\t')
            if len(cols) <= max(name_idx, total_idx, reserved_idx, available_idx, whse_idx):
                continue
            
            whse_name = cols[whse_idx].strip()
            if whse_name not in target_warehouses:
                continue
            
            name = cols[name_idx].strip()
            try:
                total = int(float(cols[total_idx])) if cols[total_idx] else 0
                reserved = int(float(cols[reserved_idx])) if cols[reserved_idx] else 0
                available = int(float(cols[available_idx])) if cols[available_idx] else 0
            except (ValueError, IndexError):
                continue
            
            if name in new_products:
                new_products[name]['total_stock'] += total
                new_products[name]['reserved_stock'] += reserved
                new_products[name]['available_stock'] += available
            else:
                new_products[name] = {
                    'name': name,
                    'total_stock': total,
                    'reserved_stock': reserved,
                    'available_stock': available
                }
        
        with products_lock:
            products = list(new_products.values())
            last_update_time = get_kst_time()
        
        print(f"[성공] {len(products)}개 제품 로드 완료")
        
    except Exception as e:
        print(f"[에러] CSV 로드 실패: {e}")

def check_rate_limit(client_ip):
    """Rate Limiting 체크"""
    if not RATE_LIMIT_ENABLED:
        return True
    
    current_time = time.time()
    
    with rate_limit_lock:
        # 오래된 기록 제거 (1분 이상 지난 것)
        rate_limit_data[client_ip] = [
            ts for ts in rate_limit_data[client_ip]
            if current_time - ts < RATE_LIMIT_WINDOW
        ]
        
        # 현재 요청 수 확인
        if len(rate_limit_data[client_ip]) >= MAX_REQUESTS_PER_MINUTE:
            return False
        
        # 요청 기록 추가
        rate_limit_data[client_ip].append(current_time)
        return True

def fetch_erp_data():
    """ERP에서 데이터 가져오기 (별도 스레드)"""
    global last_update_time
    
    print("[ERP] 데이터 가져오기 시작...")
    try:
        result = subprocess.run(
            ['python3', PYTHON_SCRIPT],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            print("[ERP] 데이터 가져오기 성공")
            load_products_from_csv()
        else:
            print(f"[ERP] 에러: {result.stderr}")
    except Exception as e:
        print(f"[ERP] 실행 실패: {e}")

class StockHandler(BaseHTTPRequestHandler):
    def get_client_ip(self):
        """클라이언트 IP 주소 가져오기"""
        forwarded = self.headers.get('X-Forwarded-For')
        if forwarded:
            return forwarded.split(',')[0].strip()
        return self.client_address[0]
    
    def get_session_id(self):
        """쿠키에서 세션 ID 추출"""
        cookie_header = self.headers.get('Cookie')
        if not cookie_header:
            return None
        
        try:
            cookies = cookie_header.split(';')
            for cookie in cookies:
                cookie = cookie.strip()
                if '=' in cookie:
                    name, value = cookie.split('=', 1)
                    if name == 'session_id':
                        return value
        except:
            return None
        return None
    
    def is_authenticated(self):
        """인증 여부 확인"""
        session_id = self.get_session_id()
        if not session_id:
            return False
        
        with session_lock:
            session = sessions.get(session_id)
            if not session:
                return False
            
            # 세션 만료 체크 (24시간)
            if time.time() - session['created_at'] > 86400:
                del sessions[session_id]
                return False
                
            return True
            
    def do_GET(self):
        # Rate Limiting 체크
        client_ip = self.get_client_ip()
        if not check_rate_limit(client_ip):
            self.send_error(429, "Too Many Requests")
            return
        
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        # --- [인증 불필요 경로] ---
        
        # 로그인 페이지
        if path == '/login':
            self.serve_file(LOGIN_FILE)
            return
            
        # 구글 로그인 리다이렉트
        if path == '/login/google':
            auth_url = (
                "https://accounts.google.com/o/oauth2/v2/auth?"
                f"client_id={GOOG_CLIENT_ID}&"
                f"redirect_uri={quote(GOOG_CALLBACK_URL)}&"
                "response_type=code&"
                "scope=email profile"
            )
            self.send_response(302)
            self.send_header('Location', auth_url)
            self.end_headers()
            return
            
        # OAuth 콜백 처리
        if path == '/oauth/callback':
            query = parse_qs(parsed_path.query)
            code = query.get('code', [None])[0]
            
            if not code:
                self.send_error(400, "Authorization code missing")
                return
            
            # 1. 토큰 교환
            token_url = "https://oauth2.googleapis.com/token"
            data = {
                'code': code,
                'client_id': GOOG_CLIENT_ID,
                'client_secret': GOOG_CLIENT_SECRET,
                'redirect_uri': GOOG_CALLBACK_URL,
                'grant_type': 'authorization_code'
            }
            
            try:
                res = requests.post(token_url, data=data)
                token_data = res.json()
                access_token = token_data.get('access_token')
                
                if not access_token:
                    self.send_error(401, f"Failed to get access token: {token_data}")
                    return
                
                # 2. 사용자 정보 조회
                user_info_res = requests.get(
                    "https://www.googleapis.com/oauth2/v2/userinfo",
                    headers={'Authorization': f'Bearer {access_token}'}
                )
                user_info = user_info_res.json()
                email = user_info.get('email')
                
                print(f"[로그인 시도] Email: {email}")
                
                # 3. 허용된 사용자인지 확인
                if not ALLOWED_USERS or email in ALLOWED_USERS:
                    # 세션 생성
                    session_id = secrets.token_hex(16)
                    with session_lock:
                        sessions[session_id] = {
                            'email': email,
                            'created_at': time.time(),
                            'ip': client_ip
                        }
                    
                    print(f"[로그인 성공] {email} (Session: {session_id})")
                    
                    # 쿠키 설정 및 리다이렉트
                    self.send_response(302)
                    self.send_header('Location', '/')
                    # 쿠키 설정: HttpOnly, Secure(HTTPS일 경우)
                    self.send_header('Set-Cookie', f'session_id={session_id}; Path=/; HttpOnly')
                    self.end_headers()
                else:
                    self.send_response(403)
                    self.send_header('Content-Type', 'text/html; charset=utf-8')
                    self.end_headers()
                    self.wfile.write(b'Access Denied: You are not authorized to access this system.')
                    
            except Exception as e:
                print(f"OAuth Error: {e}")
                self.send_error(500, "Internal Server Error during Authentication")
            return

        # 로그아웃
        if path == '/logout':
            session_id = self.get_session_id()
            if session_id:
                with session_lock:
                    if session_id in sessions:
                        del sessions[session_id]
            
            self.send_response(302)
            self.send_header('Location', '/login')
            self.send_header('Set-Cookie', 'session_id=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT')
            self.end_headers()
            return
            
        # --- [보호된 경로 (인증 필요)] ---
        
        if not self.is_authenticated():
            # API 요청이면 401, 브라우저 요청이면 로그인 페이지로 리다이렉트
            if path.startswith('/api/'):
                self.send_error(401, "Unauthorized")
            else:
                self.send_response(302)
                self.send_header('Location', '/login')
                self.end_headers()
            return

        # 인증된 사용자만 접근 가능
        self.send_cors_headers()
        
        if path == '/':
            self.serve_file(HTML_FILE)
        elif path == '/api/stock':
            self.serve_stock_json()
        elif path == '/stock_data.json':
            self.serve_file(JSON_FILE, "application/json")
        else:
            self.send_error(404, "Not Found")
    
    def do_POST(self):
        # 인증 체크
        if not self.is_authenticated():
            self.send_error(401, "Unauthorized")
            return
            
        client_ip = self.get_client_ip()
        if not check_rate_limit(client_ip):
            self.send_error(429, "Too Many Requests")
            return
        
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        self.send_cors_headers()
        
        if path == '/api/refresh':
            self.handle_refresh()
        else:
            self.send_error(404, "Not Found")
    
    def do_OPTIONS(self):
        """CORS 프리플라이트 요청 처리"""
        self.send_cors_headers()
        self.end_headers()
    
    def send_cors_headers(self):
        """CORS 헤더 전송"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Content-Type', 'application/json; charset=utf-8')
    
    def serve_file(self, filepath, content_type='text/html; charset=utf-8'):
        """파일 서빙 공통 함수"""
        try:
            if os.path.exists(filepath):
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                self.send_response(200)
                self.send_header('Content-Type', content_type)
                self.send_header('Cache-Control', 'no-cache')
                self.end_headers()
                self.wfile.write(content.encode('utf-8'))
            else:
                self.send_error(404, f"{filepath} not found")
        except Exception as e:
            self.send_error(500, f"Error: {e}")
            
    def serve_stock_json(self):
        """재고 데이터 JSON 응답"""
        try:
            with products_lock:
                products_copy = products.copy()
                last_update = last_update_time
            
            response = {
                'count': len(products_copy),
                'last_update': last_update,
                'products': products_copy
            }
            
            json_str = json.dumps(response, ensure_ascii=False, indent=2)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json_str.encode('utf-8'))
        except Exception as e:
            self.send_error(500, f"Error: {e}")
    
    def handle_refresh(self):
        """ERP 데이터 새로고침"""
        thread = threading.Thread(target=fetch_erp_data)
        thread.daemon = True
        thread.start()
        
        response = {
            'status': 'processing',
            'message': 'ERP 데이터를 가져오는 중입니다...'
        }
        
        json_str = json.dumps(response, ensure_ascii=False)
        
        self.send_response(202)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json_str.encode('utf-8'))
    
    def log_message(self, format, *args):
        """로그 메시지 출력"""
        print(f"[{get_kst_time()}] {format % args}")

def main():
    print("=" * 60)
    print("재고 조회 시스템 - Python 웹 서버 (Secured)")
    print("=" * 60)
    print(f"포트: {PORT}")
    print(f"HTML 파일: {HTML_FILE}")
    print(f"CSV 파일: {CSV_FILE}")
    print(f"로그인 주소: http://otinventory.com:%s" % PORT)
    print(f"허용된 사용자: {len(ALLOWED_USERS)}명")
    print("=" * 60)
    
    # 초기 데이터 로드
    print("\n[초기화] 데이터 로드 중...")
    load_products_from_csv()
    
    # 웹 서버 시작
    server_address = ('0.0.0.0', PORT)
    httpd = HTTPServer(server_address, StockHandler)
    
    print(f"\n✅ 웹 서버 시작됨!")
    print("\n종료하려면 Ctrl+C를 누르세요.\n")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\n서버 종료 중...")
        httpd.shutdown()

if __name__ == '__main__':
    main()
