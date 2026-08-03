#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
두드림 ERP 자동화 (최종 복원판)
- 로그인: Desktop 모드 (ClickOnce 실행 문제 해결)
- 나머지: Application.connect 모드 (기존 성공 로직 유지)
"""

import os
import sys
import time
import subprocess
import win32gui
import win32con
import win32api
import psutil
import argparse

from pywinauto import Application, Desktop

# UTF-8 출력 설정
if sys.platform == 'win32':
    os.environ['PYTHONIOENCODING'] = 'utf-8'
    try:
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except: pass

def get_screen_resolution():
    try:
        width = win32api.GetSystemMetrics(0)
        height = win32api.GetSystemMetrics(1)
        return width, height
    except: return None, None

def wait_with_countdown(seconds, message="대기 중"):
    print(f"[대기] {message} ({seconds}초)...")
    for i in range(seconds, 0, -1):
        print(f"  └─ {i}초 남음...", end='\r')
        time.sleep(1)
    print(f"  └─ 완료!      ")

def find_process_by_name(process_name):
    for proc in psutil.process_iter(['pid', 'name']):
        try:
            if process_name.lower() in proc.info['name'].lower():
                return proc.info['pid'], proc.info['name']
        except: pass
    return None, None

# ============================================================================
# [수정됨] 1. 프로그램 실행 및 로그인 (Desktop 모드 적용)
# ============================================================================
def start_and_login_erp():
    print("\n" + "=" * 60)
    print("1. 실행 및 로그인 (Desktop 모드)")
    print("=" * 60)
    
    # 1. 프로그램 실행
    shortcut_path = r"C:\Users\Administrator\Desktop\두드림 Lite.appref-ms"
    print("\n[실행] 프로그램 실행 요청...")
    
    try:
        # ClickOnce 호환성을 위해 explorer로 실행
        subprocess.Popen(["explorer", shortcut_path])
        print("   ✓ 실행 명령 전송 완료")
    except Exception as e:
        print(f"   ✗ 오류: 실행 파일을 찾을 수 없습니다. ({e})")
        return False
    
    # 2. 로딩 대기
    wait_with_countdown(20, "프로그램 구동")
    
    # 3. 로그인 (Desktop 모드로 창 찾기)
    print("\n[로그인] 창 탐색...")
    try:
        # ★ 여기가 수정된 부분입니다: Desktop 객체 사용
        desktop = Desktop(backend="uia")
        
        # '로그인'이라는 제목의 창을 찾습니다.
        login_dlg = desktop.window(title="로그인")
        
        if not login_dlg.exists(timeout=10):
            print("   ✗ 오류: '로그인' 창을 찾을 수 없습니다.")
            return False
        
        print(f"   ✓ 창 발견: {login_dlg.window_text()}")
        
        # 창 활성화
        try: login_dlg.set_focus()
        except: pass
        
        # 로그인 버튼 클릭
        login_btn = login_dlg.child_window(title="로그인", control_type="Button")
        
        if login_btn.exists():
            print("   ✓ 로그인 버튼 클릭 시도...")
            try: login_btn.invoke()
            except: login_btn.click_input()
            print("   ✓ 클릭 성공")
        else:
            print("   ✗ 오류: 로그인 버튼 없음")
            return False
            
        # 로그인 창 사라짐 대기
        time.sleep(3)
        return True
            
    except Exception as e:
        print(f"   ✗ 로그인 단계 오류: {e}")
        return False

# ============================================================================
# [기존 유지] 2. 메뉴 이동 (Application.connect 사용)
# ============================================================================
def navigate_to_stock_menu():
    print("\n" + "=" * 60)
    print("2. 재고 조회 메뉴로 이동 (Application 모드)")
    print("=" * 60)
    
    # 메인 화면 로딩 대기
    wait_with_countdown(25, "메인 화면 로딩")
    
    try:
        print("\n[연결] 두드림 프로세스 연결 중...")
        # ★ 기존 성공 코드: 프로세스에 직접 연결
        app = Application(backend="uia").connect(path="DW.ERP.exe", timeout=30)
        
        print("[검색] 메인 창 찾는 중...")
        main_dlg = app.window(title_re=".*두드림.*")
        main_dlg.wait('visible', timeout=30)
        
        print(f"   ✓ 메인 창 발견: {main_dlg.window_text()}")
        
        # [Menu Button] 클릭
        print("\n[1단계] 메뉴 버튼 클릭 시도...")
        menu_btn = main_dlg.child_window(title="Menu Button", control_type="ListItem")
        
        if menu_btn.exists():
            menu_btn.invoke()
            print("   ✓ 'Menu Button' 클릭 완료")
            time.sleep(2)
        else:
            print("   ⚠ 'Menu Button'을 찾을 수 없습니다. (패스)")
        
        # [4.4.1.현재재고조회] 클릭
        print("\n[2단계] '4.4.1.현재재고조회' 메뉴 클릭 시도...")
        tree_item = main_dlg.child_window(title="4.4.1.현재재고조회", control_type="TreeItem")
        
        if tree_item.exists():
            try: tree_item.invoke()
            except: tree_item.click_input(double=True)
            print("   ✓ 메뉴 진입 성공!")
            time.sleep(5)
            return True
        else:
            print("   ✗ 오류: 메뉴 항목 없음")
            return False
            
    except Exception as e:
        print(f"   ✗ 메뉴 이동 단계 오류: {e}")
        return False

# ============================================================================
# [기존 유지] 3. 자동화 시나리오 (Application.connect 사용)
# ============================================================================
def run_automation_scenario(pid=None):
    try:
        print("\n" + "=" * 60)
        print("3. 조회 및 엑셀 저장 (Application 모드)")
        print("=" * 60)
        
        # ★ [1단계] Desktop 모드로 창 찾고 활성화 (더 안정적)
        print("\n[1단계] Desktop 모드로 두드림 창 활성화...")
        try:
            desktop = Desktop(backend="uia")
            
            # "두드림"이 포함된 창 찾기
            dudream_window = None
            for win in desktop.windows():
                try:
                    title = win.window_text()
                    if title and "두드림" in title and title != "로그인":
                        dudream_window = win
                        print(f"   ✓ 창 발견: {title}")
                        break
                except:
                    continue
            
            if dudream_window:
                # 창 활성화 (Win32 API 사용 - 더 강력함)
                try:
                    hwnd = dudream_window.handle
                    print(f"   → 창 활성화 시도 (Handle: {hwnd})...")
                    
                    # 최소화되어 있으면 복원
                    win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
                    time.sleep(0.5)
                    
                    # 맨 앞으로 가져오기
                    win32gui.SetForegroundWindow(hwnd)
                    time.sleep(0.5)
                    
                    print("   ✓ 창 활성화 완료!")
                except Exception as activate_err:
                    print(f"   ⚠ Win32 활성화 실패, pywinauto 시도: {activate_err}")
                    try:
                        dudream_window.set_focus()
                        print("   ✓ pywinauto로 활성화 완료")
                    except:
                        print("   ⚠ 창 활성화 실패 (계속 진행)")
            else:
                print("   ⚠ Desktop 모드로 창 못 찾음 (계속 진행)")
        except Exception as desktop_err:
            print(f"   ⚠ Desktop 모드 에러: {desktop_err} (계속 진행)")
        
        # ★ [2단계] Application 모드로 프로세스 연결
        print("\n[2단계] Application 모드로 프로세스 연결...")
        app = Application(backend="uia").connect(path="DW.ERP.exe")
        
        # 메인 창 찾기
        try:
            main_dlg = app.window(title_re=".*두드림.*")
            main_dlg.wait('visible', timeout=10)
            print(f"   ✓ 메인 창 연결 성공: {main_dlg.window_text()}")
        except Exception as e:
            print(f"[에러] 메인 창 찾기 실패: {e}")
            return False

        # 1. [조회] 버튼
        print("\n[1단계] '조회' 버튼 클릭...")
        try:
            btn_search = main_dlg.child_window(title="조회", control_type="Button")
            if btn_search.exists():
                btn_search.invoke()
                print("✓ '조회' 버튼 클릭 완료!")
            else:
                print("[에러] '조회' 버튼 없음")
                return False
        except Exception as e:
            print(f"[에러] 조회 버튼 처리 실패: {e}")
            return False

        # 데이터 로딩 대기
        wait_with_countdown(10, "데이터 로딩")

        # 2. [엑셀] 버튼
        print("\n[2단계] '엑셀' 버튼 클릭...")
        try:
            btn_excel = main_dlg.child_window(title="엑셀", control_type="Button")
            if btn_excel.exists():
                try:
                    btn_excel.invoke()
                    print("✓ '엑셀' 버튼 클릭 완료.")
                except:
                    print("   (참고) 팝업 발생으로 예외 무시.")
            else:
                print("[에러] '엑셀' 버튼 없음")
                return False
        except Exception as e:
            print(f"[에러] 엑셀 버튼 처리 실패: {e}")
            return False

        # 팝업 대기
        print("\n[3단계] 팝업 대기 중...")
        time.sleep(3)

        # 3. [저장 팝업] (Win32 API - 이건 원래 잘 되던 방식)
        print("\n[4단계] 저장 팝업 제어...")
        hwnd = 0
        for i in range(10):
            try: hwnd = win32gui.FindWindow("#32770", "Save Grid Excel File")
            except: pass
            if hwnd != 0: break
            time.sleep(1)

        if hwnd == 0:
            print("[경고] 팝업창을 찾을 수 없습니다.")
            return False

        print(f"✓ 팝업 발견 (Handle: {hwnd})")

        # 4. 엔터키 전송
        print("\n[5단계] '저장' 명령 전송...")
        try:
            win32api.PostMessage(hwnd, win32con.WM_KEYDOWN, win32con.VK_RETURN, 0)
            time.sleep(0.1)
            win32api.PostMessage(hwnd, win32con.WM_KEYUP, win32con.VK_RETURN, 0)
            print("✓ 엔터키 메시지 전송 완료")
        except:
            return False
        
        print("\n" + "=" * 60)
        print("✅ 자동화 완료! (파일 저장됨)")
        print("=" * 60)
        return True

    except Exception as e:
        print(f"\n[에러] 오류 발생: {e}")
        return False

# ============================================================================
# 메인 함수
# ============================================================================
def main():
    parser = argparse.ArgumentParser(description='두드림 ERP 자동화')
    parser.add_argument('--auto-start', action='store_true', help='자동 실행 모드')
    parser.add_argument('--pid', type=int, help='프로세스 PID (호환성용)')
    parser.add_argument('--name', type=str, help='프로세스 이름 (예: DW.ERP.exe)')
    parser.add_argument('--no-countdown', action='store_true', help='시작 카운트다운 생략')
    args = parser.parse_args()
    
    print("\n" + "=" * 60)
    print("두드림 ERP 자동화 프로그램")
    print("=" * 60)
    
    # 화면 해상도 확인
    width, height = get_screen_resolution()
    if width and height:
        print(f"\n[화면 정보] 현재 해상도: {width} x {height}")
    
    # 프로세스 확인
    print("\n[검색] 두드림 ERP 프로세스 찾는 중...")
    pid, proc_name = find_process_by_name("DW.ERP")
    
    if pid:
        print(f"✓ 프로세스 발견: {proc_name} (PID: {pid})")
        print("→ 두드림이 이미 실행 중입니다. 조회/엑셀 저장을 시작합니다.\n")
        
        # 카운트다운
        if not args.no_countdown:
            print(f"자동화 시작까지:")
            for i in range(5, 0, -1):
                print(f"  {i}초...", end='\r')
                time.sleep(1)
            print(f"  시작!  ")
        
        # 두드림이 켜져 있으면 → 조회 + 엑셀 + 저장만 실행
        success = run_automation_scenario(pid)
        
        if success:
            print("\n✅ 작업 완료!")
            return 0
        else:
            print("\n❌ 작업 실패")
            return 1
    else:
        print("✗ 두드림 ERP 프로세스를 찾을 수 없습니다.")
        print("→ 프로그램을 실행하고 로그인합니다.\n")
        
        # 두드림이 안 켜져 있으면 → 로그인 + 메뉴 이동
        # 1. 실행 및 로그인 (Desktop 모드)
        if not start_and_login_erp():
            print("\n❌ 로그인 실패")
            return 1
        
        # 2. 메뉴 이동 (Application 모드)
        if not navigate_to_stock_menu():
            print("\n❌ 메뉴 이동 실패")
            return 1
        
        # 3. 엑셀 저장 (Application 모드)
        success = run_automation_scenario(None)
        
        if success:
            print("\n✅ 작업 완료!")
            return 0
        else:
            print("\n❌ 작업 실패")
            return 1

if __name__ == "__main__":
    sys.exit(main())