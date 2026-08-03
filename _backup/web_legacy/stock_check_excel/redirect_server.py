#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
포트 리디렉션 서버
http://otinventory.com → http://otinventory.com:18273
포트 80에서 실행 (관리자 권한 필요)
보안: Cloudflare IP만 허용
"""

import sys
import ipaddress
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

# Cloudflare IPv4 CIDR 범위
CLOUDFLARE_IPV4_RANGES = [
    "173.245.48.0/20",
    "103.21.244.0/22",
    "103.22.200.0/22",
    "103.31.4.0/22",
    "141.101.64.0/18",
    "108.162.192.0/18",
    "190.93.240.0/20",
    "188.114.96.0/20",
    "197.234.240.0/22",
    "198.41.128.0/17",
    "162.158.0.0/15",
    "104.16.0.0/13",
    "104.24.0.0/14",
    "172.64.0.0/13",
    "131.0.72.0/22",
    "192.0.0.0/24",
    "185.228.0.0/16",
]

def is_cloudflare_ip(ip_str):
    """IP가 Cloudflare IP 범위에 있는지 확인"""
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

# 리디렉션 대상 포트
TARGET_PORT = 18273

class RedirectHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        """GET 요청 처리 - 18273 포트로 리디렉션"""
        # DNS only 모드에서는 Cloudflare IP 체크 비활성화
        # (모든 접속 허용, Rate Limiting은 메인 서버에서 처리)
        client_ip = self.client_address[0]
        
        # 호스트명 추출
        host = self.headers.get('Host', '')
        
        # 포트 제거 (이미 80 포트에서 실행 중)
        if ':' in host:
            host = host.split(':')[0]
        
        # 리디렉션 URL 생성 (HTTP로)
        redirect_url = f"http://{host}:{TARGET_PORT}{self.path}"
        
        # 301 Permanent Redirect
        self.send_response(301)
        self.send_header('Location', redirect_url)
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()
        
        # 로그 출력
        print(f"[리디렉션] {client_ip} → {redirect_url}")
    
    def do_POST(self):
        """POST 요청도 리디렉션"""
        self.do_GET()
    
    def log_message(self, format, *args):
        """로그 메시지 출력 (기본 로그 억제)"""
        pass

def main():
    """메인 함수"""
    PORT = 80
    
    # 관리자 권한 확인
    try:
        server = HTTPServer(('0.0.0.0', PORT), RedirectHandler)
        print("=" * 60)
        print("포트 리디렉션 서버 시작")
        print("=" * 60)
        print(f"포트: {PORT}")
        print(f"리디렉션 대상: 포트 {TARGET_PORT}")
        print(f"예: http://otinventory.com → https://otinventory.com:{TARGET_PORT}")
        print("=" * 60)
        print("\n⚠️  주의: 이 서버는 관리자 권한이 필요합니다.")
        print("   Windows에서 포트 80을 사용하려면 관리자로 실행하세요.")
        print("\n서버 실행 중... (종료: Ctrl+C)\n")
        
        server.serve_forever()
    except PermissionError:
        print("=" * 60)
        print("❌ 에러: 포트 80을 사용하려면 관리자 권한이 필요합니다!")
        print("=" * 60)
        print("\n해결 방법:")
        print("1. PowerShell을 관리자 권한으로 실행")
        print("2. 다음 명령어 실행:")
        print(f"   python {__file__}")
        print("\n또는")
        print("3. Cloudflare Page Rules 사용 (권장)")
        print("   - Cloudflare → Rules → Page Rules")
        print("   - URL: otinventory.com/*")
        print(f"   - Redirect: https://otinventory.com:{TARGET_PORT}/$1")
        sys.exit(1)
    except OSError as e:
        if "Address already in use" in str(e):
            print("=" * 60)
            print("❌ 에러: 포트 80이 이미 사용 중입니다!")
            print("=" * 60)
            print("\n해결 방법:")
            print("1. 포트 80을 사용하는 다른 프로그램 종료")
            print("2. 또는 Cloudflare Page Rules 사용 (권장)")
        else:
            print(f"❌ 에러: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n\n[종료] 리디렉션 서버를 종료합니다.")
        server.shutdown()

if __name__ == "__main__":
    main()

