#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
DW.ERP.exe 윈도우 관리자
프로세스 감지 및 윈도우 활성화
"""

import psutil
import win32gui
import win32con
import win32process
import sys
import time

def find_process_by_name(process_name):
    """
    프로세스 이름으로 실행 중인 프로세스 찾기
    
    Args:
        process_name: 프로세스 이름 (예: "DW.ERP.exe")
    
    Returns:
        list: 찾은 프로세스의 (pid, name) 튜플 리스트
    """
    found_processes = []
    
    for proc in psutil.process_iter(['pid', 'name']):
        try:
            if proc.info['name'].lower() == process_name.lower():
                found_processes.append((proc.info['pid'], proc.info['name']))
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    
    return found_processes

def find_window_by_pid(target_pid):
    """
    PID로 윈도우 핸들 찾기
    
    Args:
        target_pid: 찾을 프로세스의 PID
    
    Returns:
        list: 찾은 윈도우 핸들 리스트
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
        
        # 활성화
        win32gui.BringWindowToTop(hwnd)
        
        return True
    except Exception as e:
        print(f"[에러] 윈도우 활성화 실패: {e}")
        return False

def check_and_activate_erp():
    """
    DW.ERP.exe를 찾아서 활성화
    
    Returns:
        bool: 성공 여부
    """
    process_name = "DW.ERP.exe"
    
    print("=" * 60)
    print(f"[검색] {process_name} 프로세스 찾는 중...")
    print("=" * 60)
    
    # 1. 프로세스 찾기
    processes = find_process_by_name(process_name)
    
    if not processes:
        print(f"❌ {process_name} 프로세스를 찾을 수 없습니다.")
        print(f"   프로그램이 실행 중인지 확인하세요.")
        return False
    
    print(f"✓ {len(processes)}개의 프로세스를 찾았습니다:")
    for pid, name in processes:
        print(f"  - PID: {pid}, 이름: {name}")
    
    # 2. 각 프로세스의 윈도우 찾기
    all_windows = []
    for pid, name in processes:
        windows = find_window_by_pid(pid)
        if windows:
            print(f"\n[윈도우] PID {pid}의 윈도우:")
            for hwnd, title in windows:
                print(f"  - 핸들: {hwnd}, 제목: '{title}'")
                all_windows.append((hwnd, title, pid))
    
    if not all_windows:
        print(f"\n❌ 표시 가능한 윈도우를 찾을 수 없습니다.")
        return False
    
    # 3. 첫 번째 윈도우를 최상위로
    hwnd, title, pid = all_windows[0]
    print(f"\n[활성화] 윈도우를 최상위로 가져옵니다...")
    print(f"  - PID: {pid}")
    print(f"  - 제목: '{title}'")
    
    if bring_window_to_front(hwnd):
        print(f"✓ 윈도우가 활성화되었습니다!")
        return True
    else:
        print(f"❌ 윈도우 활성화 실패")
        return False

def main():
    """메인 함수"""
    print("\n" + "=" * 60)
    print("DW.ERP.exe 윈도우 관리자")
    print("=" * 60)
    
    success = check_and_activate_erp()
    
    print("\n" + "=" * 60)
    if success:
        print("작업 완료!")
    else:
        print("작업 실패!")
    print("=" * 60)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())

