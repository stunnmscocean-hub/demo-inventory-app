#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
두드림 ERP 자동화
프로세스 활성화 및 자동 클릭 시나리오
"""

import psutil
import win32gui
import win32con
import win32process
import win32api
import time
import sys

def find_process_by_pid(target_pid):
    """
    PID로 프로세스 찾기
    
    Args:
        target_pid: 찾을 프로세스 PID
    
    Returns:
        psutil.Process 또는 None
    """
    try:
        proc = psutil.Process(target_pid)
        return proc
    except psutil.NoSuchProcess:
        return None

def find_window_by_pid(target_pid):
    """
    PID로 윈도우 핸들 찾기
    
    Args:
        target_pid: 찾을 프로세스의 PID
    
    Returns:
        list: 찾은 윈도우 핸들 리스트 [(hwnd, title), ...]
    """
    window_handles = []
    
    def callback(hwnd, _):
        if win32gui.IsWindowVisible(hwnd):
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
            if pid == target_pid:
                window_title = win32gui.GetWindowText(hwnd)
                window_handles.append((hwnd, window_title))
        return True
    
    win32gui.EnumWindows(callback, None)
    return window_handles

def bring_window_to_front(hwnd):
    """
    윈도우를 최상위로 가져오기
    
    Args:
        hwnd: 윈도우 핸들
    
    Returns:
        bool: 성공 여부
    """
    try:
        # 최소화된 경우 복원
        if win32gui.IsIconic(hwnd):
            win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
        
        # 윈도우를 최상위로
        win32gui.SetForegroundWindow(hwnd)
        win32gui.BringWindowToTop(hwnd)
        
        # 안정화 대기
        time.sleep(0.5)
        
        return True
    except Exception as e:
        print(f"[에러] 윈도우 활성화 실패: {e}")
        return False

def click_at_position(x, y, delay_before=0.5, delay_after=0.3):
    """
    특정 좌표 클릭
    
    Args:
        x: X 좌표
        y: Y 좌표
        delay_before: 클릭 전 대기 시간 (초)
        delay_after: 클릭 후 대기 시간 (초)
    """
    # 클릭 전 대기
    time.sleep(delay_before)
    
    # 현재 마우스 위치 저장
    old_pos = win32api.GetCursorPos()
    
    # 마우스 이동
    win32api.SetCursorPos((x, y))
    time.sleep(0.1)
    
    # 클릭 (왼쪽 버튼 다운)
    win32api.mouse_event(win32con.MOUSEEVENTF_LEFTDOWN, x, y, 0, 0)
    time.sleep(0.05)
    
    # 클릭 (왼쪽 버튼 업)
    win32api.mouse_event(win32con.MOUSEEVENTF_LEFTUP, x, y, 0, 0)
    
    print(f"[클릭] 좌표 ({x}, {y}) 클릭 완료")
    
    # 클릭 후 대기
    time.sleep(delay_after)

def press_enter(delay_before=0.5, delay_after=0.3):
    """
    Enter 키 입력
    
    Args:
        delay_before: 입력 전 대기 시간 (초)
        delay_after: 입력 후 대기 시간 (초)
    """
    time.sleep(delay_before)
    
    # Enter 키 다운
    win32api.keybd_event(win32con.VK_RETURN, 0, 0, 0)
    time.sleep(0.05)
    
    # Enter 키 업
    win32api.keybd_event(win32con.VK_RETURN, 0, win32con.KEYEVENTF_KEYUP, 0)
    
    print(f"[키입력] Enter 키 입력 완료")
    
    time.sleep(delay_after)

def wait_with_countdown(seconds, message="대기 중"):
    """
    카운트다운과 함께 대기
    
    Args:
        seconds: 대기할 초
        message: 표시할 메시지
    """
    print(f"[대기] {message} ({seconds}초)...")
    for i in range(seconds, 0, -1):
        print(f"  └─ {i}초 남음...", end='\r')
        time.sleep(1)
    print(f"  └─ 완료!      ")

def run_automation_scenario(pid):
    """
    자동화 시나리오 실행
    
    시나리오:
    1. 두드림 PID를 최상위로 띄우기
    2. 마우스 좌표 (840, 70) 클릭
    3. 마우스 좌표 (940, 70) 클릭
    4. 10초 대기
    5. 마우스 좌표 (970, 70) 클릭
    6. 5초 대기
    7. Enter 키 입력
    8. 10초 대기
    9. 마우스 좌표 (940, 70) 클릭
    
    Args:
        pid: 두드림 프로세스 PID
    
    Returns:
        bool: 성공 여부
    """
    print("=" * 60)
    print("두드림 ERP 자동화 시작")
    print("=" * 60)
    
    # 1. 프로세스 확인
    print(f"\n[1단계] PID {pid} 프로세스 확인 중...")
    proc = find_process_by_pid(pid)
    
    if not proc:
        print(f"❌ PID {pid} 프로세스를 찾을 수 없습니다.")
        return False
    
    print(f"✓ 프로세스 발견: {proc.name()} (PID: {pid})")
    
    # 2. 윈도우 찾기
    print(f"\n[2단계] 윈도우 검색 중...")
    windows = find_window_by_pid(pid)
    
    if not windows:
        print(f"❌ 표시 가능한 윈도우를 찾을 수 없습니다.")
        return False
    
    hwnd, title = windows[0]
    print(f"✓ 윈도우 발견: '{title}' (핸들: {hwnd})")
    
    # 3. 윈도우 활성화
    print(f"\n[3단계] 윈도우를 최상위로 가져오는 중...")
    if not bring_window_to_front(hwnd):
        print(f"❌ 윈도우 활성화 실패")
        return False
    
    print(f"✓ 윈도우가 활성화되었습니다!")
    
    # 안정화 대기
    print(f"\n[준비] 자동화 시작 전 준비 중...")
    time.sleep(1)
    
    print(f"\n" + "=" * 60)
    print("자동화 시나리오 실행")
    print("=" * 60)
    
    # 4. 시나리오 실행
    print(f"\n[4단계] 첫 번째 클릭 (840, 70)")
    click_at_position(840, 70)
    
    print(f"\n[5단계] 두 번째 클릭 (940, 70)")
    click_at_position(940, 70)
    
    print(f"\n[6단계] 10초 대기")
    wait_with_countdown(10, "데이터 로딩 대기")
    
    print(f"\n[7단계] 세 번째 클릭 (970, 70)")
    click_at_position(970, 70)
    
    print(f"\n[8단계] 5초 대기")
    wait_with_countdown(5, "처리 대기")
    
    print(f"\n[9단계] Enter 키 입력")
    press_enter()
    
    print(f"\n[10단계] 10초 대기")
    wait_with_countdown(10, "다운로드 준비 대기")
    
    print(f"\n[11단계] 네 번째 클릭 (940, 70)")
    click_at_position(940, 70)
    
    print(f"\n" + "=" * 60)
    print("✅ 자동화 시나리오 완료!")
    print("=" * 60)
    
    return True

def main():
    """메인 함수"""
    # 두드림 PID
    TARGET_PID = 4112
    
    print("\n" + "=" * 60)
    print("두드림 ERP 자동화 프로그램")
    print("=" * 60)
    print(f"\n대상 PID: {TARGET_PID}")
    print(f"\n⚠️  주의: 자동화가 시작되면 마우스와 키보드가 자동으로 조작됩니다.")
    print(f"         자동화를 중단하려면 마우스를 화면 모서리로 빠르게 이동하세요.")
    
    # 5초 카운트다운
    print(f"\n자동화 시작까지:")
    for i in range(5, 0, -1):
        print(f"  {i}초...", end='\r')
        time.sleep(1)
    print(f"  시작!  ")
    
    # 자동화 실행
    success = run_automation_scenario(TARGET_PID)
    
    print(f"\n" + "=" * 60)
    if success:
        print("프로그램 종료: 성공")
    else:
        print("프로그램 종료: 실패")
    print("=" * 60 + "\n")
    
    return 0 if success else 1

if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\n[중단] 사용자가 프로그램을 중단했습니다.")
        sys.exit(1)
    except Exception as e:
        print(f"\n[에러] 예상치 못한 오류: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

