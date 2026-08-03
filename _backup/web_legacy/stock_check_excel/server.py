#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
재고 조회 시스템 - Python 웹 서버 (엑셀 파일 기반)
Windows 서버용
보안 기능: Google OAuth 2.0 인증 + Cloudflare IP 화이트리스트
"""

import os
import json
import subprocess
import sys
import threading
from datetime import datetime, timedelta, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, quote
import time
from collections import defaultdict
import ipaddress
import requests  # Authentication
import secrets   # Session Management
import re

# 스크립트가 있는 디렉토리를 기준으로 경로 설정
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# 설정 파일 로드 (.env)
def load_env_file(filepath):
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

ENV_PATH = os.path.join(SCRIPT_DIR, '.env')
env_config = load_env_file(ENV_PATH)

# OAuth 설정
GOOG_CLIENT_ID = env_config.get('GOOG_CLIENT_ID', '')
GOOG_CLIENT_SECRET = env_config.get('GOOG_CLIENT_SECRET', '')
GOOG_CALLBACK_URL = env_config.get('GOOG_CALLBACK_URL', 'http://otinventory.com:18273/oauth/callback')
SECRET_KEY = env_config.get('SECRET_KEY', 'default_secret_key')
ALLOWED_USERS = [u.strip() for u in env_config.get('ALLOWED_USERS', '').split(',') if u.strip()]

# 파일 경로 설정
CSV_FILE = os.path.join(SCRIPT_DIR, 'stock_data.csv')
JSON_FILE = os.path.join(SCRIPT_DIR, 'stock_data.json')
HTML_FILE = os.path.join(SCRIPT_DIR, 'dashboard_modern.html')
LOGIN_FILE = os.path.join(SCRIPT_DIR, 'login.html')
FAVICON_FILE = os.path.join(SCRIPT_DIR, 'favicon.ico')
FAVICON_96_FILE = os.path.join(SCRIPT_DIR, 'favicon-96x96.png')
APPLE_ICON_FILE = os.path.join(SCRIPT_DIR, 'apple-icon-180x180.png')

# 설정
PORT = 18273

# Rate Limiting 설정
RATE_LIMIT_ENABLED = True
MAX_REQUESTS_PER_MINUTE = 60  # 분당 최대 요청 수
RATE_LIMIT_WINDOW = 60  # 초 단위

# Cloudflare IP 화이트리스트 (보안 강화)
CLOUDFLARE_IP_WHITELIST_ENABLED = False  # DNS only 모드 사용 시 False

# Cloudflare IPv4 CIDR 범위
CLOUDFLARE_IPV4_RANGES = [
    "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22",
    "141.101.64.0/18", "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20",
    "197.234.240.0/22", "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13",
    "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22", "192.0.0.0/24",
    "185.228.0.0/16", "2a06:98c0::/29", "2c0f:f248::/32",
]

# 테스트/개발용: 특정 IP 허용 (예: 관리자 IP, 로컬 루프백)
ALLOWED_DIRECT_IPS = [
    "127.0.0.1", "::1"
]

# 전역 변수
products = []
products_lock = threading.Lock()
last_update_time = ""

# Rate Limiting & Session Storage
rate_limit_data = defaultdict(list)
rate_limit_lock = threading.Lock()

sessions = {} # {session_id: {'email': email, 'created_at': timestamp, 'ip': ip}}
session_lock = threading.Lock()

def get_kst_time():
    """한국 시간(KST, UTC+9)으로 현재 시간 반환"""
    kst = timezone(timedelta(hours=9))
    return datetime.now(kst).strftime("%Y-%m-%d %H:%M:%S")

def load_products_from_json(json_data):
    """JSON 데이터에서 재고 데이터 로드"""
    global products, last_update_time
    
    try:
        if 'Data' not in json_data or 'PIV_STCK_SUM_LIST0' not in json_data['Data']:
            print("[에러] JSON 데이터 형식이 올바르지 않습니다.")
            return False
        
        data_list = json_data['Data']['PIV_STCK_SUM_LIST0']
        if not data_list:
            print("[경고] 데이터가 비어있습니다.")
            return False
        
        new_products = {}
        # target_warehouses 삭제: 모든 창고 데이터를 로드하여 프론트엔드에서 필터링
        
        for item in data_list:
            if 'PRDT_NM' not in item or 'WHSE_NM' not in item:
                continue
            
            whse_name = str(item.get('WHSE_NM', '')).strip()
            # if whse_name not in target_warehouses: continue  <-- 삭제됨 (모든 창고 허용)
            
            name = str(item.get('PRDT_NM', '')).strip()
            if not name:
                continue
            
            model_name = str(item.get('MODEL_NM', '')).strip()
            
            try:
                total = int(float(item.get('STCK_SUM_QTY', 0) or 0))
                reserved = int(float(item.get('STCK_RSV_QTY', 0) or 0))
                available = int(float(item.get('STCK_CAN_QTY', 0) or 0))
            except (ValueError, TypeError):
                continue
            
            category = str(item.get('대분류명', '')).strip()
            
            # 식별 키: SKU(모델명) 또는 상품명
            key = model_name if model_name else name
            
            if key not in new_products:
                new_products[key] = {
                    'name': name,
                    'model_name': model_name,
                    'total_stock': 0,
                    'reserved_stock': 0,
                    'available_stock': 0,
                    'category': category if category else '',
                    'warehouses': {} # 창고별 재고 정보
                }
            
            # 전체 재고 합산
            new_products[key]['total_stock'] += total
            new_products[key]['reserved_stock'] += reserved
            new_products[key]['available_stock'] += available
            
            # 창고별 재고 저장
            if whse_name not in new_products[key]['warehouses']:
                new_products[key]['warehouses'][whse_name] = {
                    'total': 0, 'reserved': 0, 'available': 0
                }
            
            new_products[key]['warehouses'][whse_name]['total'] += total
            new_products[key]['warehouses'][whse_name]['reserved'] += reserved
            new_products[key]['warehouses'][whse_name]['available'] += available
        
        excel_read_time = get_kst_time()
        time_source = "현재 시간"
        
        if 'RequestInfo' in json_data:
            if 'FileName' in json_data['RequestInfo']:
                filename = json_data['RequestInfo']['FileName']
                match = re.search(r'(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})', filename)
                if match:
                    year, month, day, hour, minute, second = match.groups()
                    excel_read_time = f"{year}-{month}-{day} {hour}:{minute}:{second}"
                    time_source = f"파일명 ({filename})"
            
            if time_source == "현재 시간" and 'ReadTime' in json_data['RequestInfo']:
                try:
                    dt = datetime.fromisoformat(json_data['RequestInfo']['ReadTime'])
                    excel_read_time = dt.strftime('%Y-%m-%d %H:%M:%S')
                    time_source = "ReadTime"
                except:
                    pass
        
        print(f"[시간] 최종 업데이트 시간: {excel_read_time} (출처: {time_source})")
        
        with products_lock:
            products = list(new_products.values())
            last_update_time = excel_read_time
        
        # JSON 백업
        if 'RequestInfo' in json_data:
            json_data['RequestInfo']['ProcessTime'] = get_kst_time()
            json_data['RequestInfo']['DisplayTime'] = excel_read_time
        with open(JSON_FILE, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2)
        
        return True
    except Exception as e:
        print(f"[에러] JSON 로드 실패: {e}")
        return False

def is_cloudflare_ip(ip_str):
    try:
        ip = ipaddress.ip_address(ip_str)
        for cidr_str in CLOUDFLARE_IPV4_RANGES:
            if '/' in cidr_str:
                network = ipaddress.ip_network(cidr_str, strict=False)
                if ip in network:
                    return True
        return False
    except:
        return False

def check_rate_limit(client_ip):
    if not RATE_LIMIT_ENABLED:
        return True
    current_time = time.time()
    with rate_limit_lock:
        rate_limit_data[client_ip] = [ts for ts in rate_limit_data[client_ip] if current_time - ts < RATE_LIMIT_WINDOW]
        if len(rate_limit_data[client_ip]) >= MAX_REQUESTS_PER_MINUTE:
            return False
        rate_limit_data[client_ip].append(current_time)
        return True

class StockHandler(BaseHTTPRequestHandler):
    def get_client_ip(self):
        forwarded = self.headers.get('X-Forwarded-For')
        if forwarded:
            return forwarded.split(',')[0].strip()
        return self.client_address[0]
    
    def is_cloudflare_request(self):
        if self.headers.get('CF-Connecting-IP') or self.headers.get('CF-RAY') or self.headers.get('CF-Visitor'):
            return True
        if is_cloudflare_ip(self.client_address[0]):
            return True
        return False

    def get_session_id(self):
        cookie_header = self.headers.get('Cookie')
        if not cookie_header: return None
        try:
            for cookie in cookie_header.split(';'):
                if '=' in cookie:
                    name, value = cookie.strip().split('=', 1)
                    if name == 'session_id': return value
        except: pass
        return None

    def is_authenticated(self):
        session_id = self.get_session_id()
        if not session_id: return False
        with session_lock:
            session = sessions.get(session_id)
            if not session: return False
            if time.time() - session['created_at'] > 86400: # 24시간 만료
                del sessions[session_id]
                return False
            return True

    def serve_file(self, filepath, content_type='text/html; charset=utf-8'):
        try:
            if os.path.exists(filepath):
                mode = 'rb' if 'image' in content_type or 'icon' in content_type else 'r'
                encoding = None if 'image' in content_type or 'icon' in content_type else 'utf-8'
                with open(filepath, mode, encoding=encoding) as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-Type', content_type)
                self.send_header('Cache-Control', 'no-cache' if 'html' in content_type else 'public, max-age=86400')
                self.end_headers()
                if mode == 'rb':
                    self.wfile.write(content)
                else:
                    self.wfile.write(content.encode('utf-8'))
            else:
                self.send_error(404, "Not Found")
        except Exception as e:
            self.send_error(500, f"Error: {e}")

    def do_GET(self):
        client_ip = self.get_client_ip()
        direct_ip = self.client_address[0]
        
        # 1. IP 화이트리스트 / 보안 체크 (Cloudflare)
        if CLOUDFLARE_IP_WHITELIST_ENABLED:
            is_cf = self.is_cloudflare_request()
            if not is_cf and not is_cloudflare_ip(direct_ip) and direct_ip not in ALLOWED_DIRECT_IPS:
                self.send_error(403, "Forbidden: Access denied from this IP.")
                print(f"[보안] 차단된 접근: {direct_ip} (Client: {client_ip})")
                return

        # 2. Rate Limiting
        if not check_rate_limit(client_ip):
            self.send_error(429, "Too Many Requests")
            return
            
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        # [공개 경로] - 로그인 관련 및 정적 리소스(favicon 등)
        if path == '/login':
            self.serve_file(LOGIN_FILE)
            return
        if path == '/login/google':
            auth_url = (f"https://accounts.google.com/o/oauth2/v2/auth?client_id={GOOG_CLIENT_ID}&"
                        f"redirect_uri={quote(GOOG_CALLBACK_URL)}&response_type=code&scope=email profile")
            self.send_response(302)
            self.send_header('Location', auth_url)
            self.end_headers()
            return
        if path == '/oauth/callback':
            self.handle_oauth_callback(parsed_path)
            return
        if path == '/logout':
            self.handle_logout()
            return
        # 정적 파일 (로그인 페이지에서도 보일 수 있음)
        if path in ['/favicon.ico', '/favicon-96x96.png', '/apple-icon-180x180.png']:
             # 단순화: 원래 로직 호출
            if path == '/favicon.ico': self.serve_file(FAVICON_FILE, 'image/x-icon')
            elif path == '/favicon-96x96.png': self.serve_file(FAVICON_96_FILE, 'image/png')
            elif path == '/apple-icon-180x180.png': self.serve_file(APPLE_ICON_FILE, 'image/png')
            return

        # [인증 필요 경로] - 대시보드 및 데이터 API
        if not self.is_authenticated():
            if path.startswith('/api/') or path.endswith('.json'):
                self.send_error(401, "Unauthorized")
            else:
                self.send_response(302)
                self.send_header('Location', '/login')
                self.end_headers()
            return

        # 인증 성공 시
        self.send_cors_headers()
        
        if path == '/':
            self.serve_file(HTML_FILE)
        elif path == '/api/stock':
            self.serve_stock_json()
        elif path == '/stock_data.json':
            self.serve_file(JSON_FILE, "application/json")
        else:
            self.send_error(404, "Not Found")

    def handle_oauth_callback(self, parsed_path):
        query = parse_qs(parsed_path.query)
        code = query.get('code', [None])[0]
        if not code:
            self.send_error(400, "Code missing")
            return
        
        try:
            # Token Exchange
            res = requests.post("https://oauth2.googleapis.com/token", data={
                'code': code, 'client_id': GOOG_CLIENT_ID, 'client_secret': GOOG_CLIENT_SECRET,
                'redirect_uri': GOOG_CALLBACK_URL, 'grant_type': 'authorization_code'
            })
            token_data = res.json()
            access_token = token_data.get('access_token')
            if not access_token:
                self.send_error(401, "Failed to retrieve access token")
                return
            
            # User Info
            user_res = requests.get("https://www.googleapis.com/oauth2/v2/userinfo", 
                                  headers={'Authorization': f'Bearer {access_token}'})
            email = user_res.json().get('email')
            
            # Check Valid User
            if not ALLOWED_USERS or email in ALLOWED_USERS:
                session_id = secrets.token_hex(16)
                with session_lock:
                    sessions[session_id] = {'email': email, 'created_at': time.time(), 'ip': self.get_client_ip()}
                self.send_response(302)
                self.send_header('Location', '/')
                self.send_header('Set-Cookie', f'session_id={session_id}; Path=/; HttpOnly')
                self.end_headers()
                print(f"[로그인 성공] {email}")
            else:
                self.send_response(403)
                self.end_headers()
                self.wfile.write(b"Access Denied.")
                print(f"[로그인 실패] 허용되지 않은 사용자: {email}")
        except Exception as e:
            print(f"[OAuth 에러] {e}")
            self.send_error(500, "Auth Error")

    def handle_logout(self):
        session_id = self.get_session_id()
        if session_id:
            with session_lock:
                if session_id in sessions: del sessions[session_id]
        self.send_response(302)
        self.send_header('Location', '/login')
        self.send_header('Set-Cookie', 'session_id=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT')
        self.end_headers()

    def do_POST(self):
        client_ip = self.get_client_ip()
        
        # 1. 보안 체크 (Cloudflare/RateLimit)
        # 중요: /api/upload_stock 은 자동화 스크립트가 사용하므로 별도 처리 필요
        # 하지만 기본 IP 차단은 적용해야 함
        if CLOUDFLARE_IP_WHITELIST_ENABLED:
            direct_ip = self.client_address[0]
            is_cf = self.is_cloudflare_request()
            if not is_cf and not is_cloudflare_ip(direct_ip) and direct_ip not in ALLOWED_DIRECT_IPS:
                self.send_error(403, "Forbidden")
                return

        if not check_rate_limit(client_ip):
            self.send_error(429, "Too Many Requests")
            return
        
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        self.send_cors_headers()

        # [예외] 데이터 업로드 API는 인증 제외 (단, 로컬호스트나 허용된 IP만 가능하면 더 좋음)
        # 자동화 스크립트는 보통 로컬이나 같은 네트워크에서 실행됨
        if path == '/api/upload_stock':
            self.handle_upload_stock()
            return
            
        # [그 외] POST 요청은 인증 필요
        if not self.is_authenticated():
            self.send_error(401, "Unauthorized")
            return
            
        self.send_error(404, "Not Found")

    def send_cors_headers(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        
    def serve_stock_json(self):
        try:
            with products_lock:
                products_copy = products.copy()
                last_update = last_update_time
            response = {'count': len(products_copy), 'last_update': last_update, 'products': products_copy}
            json_str = json.dumps(response, ensure_ascii=False, indent=2)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json_str.encode('utf-8'))
        except Exception as e:
            self.send_error(500, f"Error: {e}")

    def handle_upload_stock(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self.send_error(400, "Empty body")
                return
            body = self.rfile.read(content_length)
            json_data = json.loads(body.decode('utf-8'))
            print(f"[수신] 재고 데이터: {len(json_data.get('Data', {}).get('PIV_STCK_SUM_LIST0', []))}건")
            if load_products_from_json(json_data):
                res = {'status': 'success', 'message': 'Uploaded', 'count': len(products)}
                self.send_response(200)
            else:
                res = {'status': 'error', 'message': 'Processing Failed'}
                self.send_response(400)
            
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(res, ensure_ascii=False).encode('utf-8'))
        except Exception as e:
            print(f"[업로드 에러] {e}")
            self.send_error(500, "Error")

    def do_OPTIONS(self):
        self.send_cors_headers()
        self.end_headers()

def main():
    print("=" * 60)
    print("재고 조회 시스템 - Python 웹 서버 (Secured Production)")
    print("=" * 60)
    print(f"포트: {PORT}")
    print(f"관리자/로컬 IP: {ALLOWED_DIRECT_IPS}")
    print(f"구글 로그인: 활성화 ({len(ALLOWED_USERS)}명 허용)")
    
    # 초기 데이터 로드
    if os.path.exists(JSON_FILE):
        try:
            with open(JSON_FILE, 'r', encoding='utf-8') as f:
                load_products_from_json(json.load(f))
        except: pass
    
    httpd = HTTPServer(('0.0.0.0', PORT), StockHandler)
    print(f"\n✅ 서버 시작됨. (http://localhost:{PORT})")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n서버 종료")
        httpd.shutdown()

if __name__ == '__main__':
    main()
