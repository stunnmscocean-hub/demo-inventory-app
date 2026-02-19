#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
두드림 ERP 자동화 (10분 반복 실행)
"""

import time
import sys
import os
import subprocess
from datetime import datetime, timedelta
import win32api

# erp_automation_dynamic 모듈 임포트
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from erp_automation_dynamic import (
    run_automation_scenario, 
    find_process_by_name, 
    start_and_login_erp, 
    navigate_to_stock_menu
)

# 로그 파일 경로
LOG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
os.makedirs(LOG_DIR, exist_ok=True)

def get_log_filename():
    """현재 날짜 기준 로그 파일명 생성"""
    return os.path.join(LOG_DIR, f"erp_warnings_{datetime.now().strftime('%Y%m%d')}.txt")

def log_message(message, save_to_file=False):
    """
    타임스탬프와 함께 메시지 출력 및 선택적 파일 저장
    
    Args:
        message: 출력할 메시지
        save_to_file: True면 파일에도 저장 (경고/에러 메시지용)
    """
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    full_message = f"[{timestamp}] {message}"
    print(full_message)
    
    # 파일 저장 옵션이 활성화된 경우
    if save_to_file:
        try:
            log_file = get_log_filename()
            with open(log_file, 'a', encoding='utf-8') as f:
                f.write(full_message + '\n')
        except Exception as e:
            print(f"[에러] 로그 파일 저장 실패: {e}")

def is_working_hours():
    """
    근무 시간인지 확인
    근무 시간: 오전 8시 ~ 밤 9시 (08:00 ~ 21:00)
    
    Returns:
        bool: 근무 시간이면 True, 아니면 False
    """
    now = datetime.now()
    current_hour = now.hour
    
    # 오전 8시(8) ~ 밤 9시(21) 미만
    return 8 <= current_hour < 21

def main():
    """메인 함수 - 10분마다 자동화 실행 (근무 시간에만)"""
    INTERVAL_MINUTES = 10
    INTERVAL_SECONDS = INTERVAL_MINUTES * 60
    WORK_START_HOUR = 8  # 오전 8시
    WORK_END_HOUR = 21   # 밤 9시
    
    # 화면 해상도 확인
    screen_width = win32api.GetSystemMetrics(0)
    screen_height = win32api.GetSystemMetrics(1)
    
    log_message("=" * 60)
    log_message("두드림 ERP 자동화 루프 시작")
    log_message(f"화면 해상도: {screen_width} x {screen_height}")
    log_message(f"실행 주기: {INTERVAL_MINUTES}분마다")
    log_message(f"근무 시간: {WORK_START_HOUR:02d}:00 ~ {WORK_END_HOUR:02d}:00")
    log_message("=" * 60)
    
    run_count = 0
    
    while True:
        try:
            # 근무 시간 체크
            if not is_working_hours():
                now = datetime.now()
                current_hour = now.hour
                
                # 다음 근무 시작 시간 계산
                if current_hour >= WORK_END_HOUR:
                    # 밤 9시 이후 -> 다음 날 오전 8시
                    next_work = now.replace(hour=WORK_START_HOUR, minute=0, second=0, microsecond=0)
                    next_work = next_work + timedelta(days=1)
                else:
                    # 오전 8시 이전 -> 오늘 오전 8시
                    next_work = now.replace(hour=WORK_START_HOUR, minute=0, second=0, microsecond=0)
                
                time_until_work = (next_work - now).total_seconds()
                hours_until = int(time_until_work // 3600)
                minutes_until = int((time_until_work % 3600) // 60)
                
                log_message(f"\n{'=' * 60}")
                log_message(f"[근무 시간 외] 현재 시각: {now.strftime('%H:%M:%S')}")
                log_message(f"[대기] 다음 근무 시작: {next_work.strftime('%Y-%m-%d %H:%M:%S')}")
                log_message(f"[대기] 남은 시간: {hours_until}시간 {minutes_until}분")
                log_message("=" * 60)
                
                # 30분마다 상태 출력하며 대기
                wait_interval = 30 * 60  # 30분
                while not is_working_hours():
                    now = datetime.now()
                    time_until_work = (next_work - now).total_seconds()
                    
                    if time_until_work <= 0:
                        break
                    
                    hours_until = int(time_until_work // 3600)
                    minutes_until = int((time_until_work % 3600) // 60)
                    
                    log_message(f"[대기 중] 근무 시작까지 {hours_until}시간 {minutes_until}분 남음...")
                    
                    # 30분 또는 남은 시간 중 짧은 시간만큼 대기
                    time.sleep(min(wait_interval, time_until_work))
                
                log_message(f"\n{'=' * 60}")
                log_message(f"[근무 시작] 자동화를 재개합니다")
                log_message("=" * 60)
                continue
            
            run_count += 1
            log_message(f"\n{'=' * 60}")
            log_message(f"[{run_count}회차] 자동화 시작")
            log_message("=" * 60)
            
            # 화면 해상도 확인 (매 회차마다)
            screen_width = win32api.GetSystemMetrics(0)
            screen_height = win32api.GetSystemMetrics(1)
            log_message(f"[화면 정보] 현재 해상도: {screen_width} x {screen_height}")
            
            # 두드림 프로세스 찾기
            log_message("[검색] 두드림 ERP 프로세스 찾는 중...")
            pid, proc_name = find_process_by_name("DW.ERP")
            
            if not pid:
                # ============================================================
                # 두드림이 안 켜져 있음 → 로그인 + 메뉴 이동 + 조회/저장
                # ============================================================
                log_message("[경고] 두드림 ERP 프로세스를 찾을 수 없습니다.", save_to_file=True)
                log_message("[자동 실행] 두드림을 자동으로 실행합니다...")
                
                try:
                    # 1. 두드림 실행 및 로그인 (Desktop 모드)
                    log_message("   [1/3] 두드림 프로그램 실행 및 로그인 중...")
                    if not start_and_login_erp():
                        log_message(f"[{run_count}회차] 프로그램 실행 또는 로그인 실패 ✗", save_to_file=True)
                        continue
                    
                    log_message("   ✓ 로그인 완료!")
                    
                    # 2. 재고 조회 메뉴로 이동 (Application 모드)
                    log_message("   [2/3] 재고 조회 메뉴로 이동 중...")
                    if not navigate_to_stock_menu():
                        log_message(f"[{run_count}회차] 재고 조회 메뉴 이동 실패 ✗", save_to_file=True)
                        continue
                    
                    log_message("   ✓ 메뉴 이동 완료!")
                    
                    # 3. 조회 및 엑셀 저장 (Application 모드)
                    log_message("   [3/3] 조회 및 엑셀 저장 중...")
                    success = run_automation_scenario(None)
                    
                    if success:
                        log_message(f"[{run_count}회차] 자동 실행 및 자동화 완료 ✓")
                    else:
                        log_message(f"[{run_count}회차] 엑셀 저장 실패 ✗", save_to_file=True)
                        
                except Exception as e:
                    log_message(f"[{run_count}회차] 자동 실행 중 오류: {e} ✗", save_to_file=True)
                    import traceback
                    log_message(f"[스택 트레이스]\n{traceback.format_exc()}", save_to_file=True)
            else:
                # ============================================================
                # 두드림이 켜져 있음 → 조회/엑셀 저장만 반복
                # ============================================================
                log_message(f"[발견] {proc_name} (PID: {pid})")
                log_message("→ 두드림이 이미 실행 중입니다. 조회/엑셀 저장을 시작합니다.")
                
                # 조회 및 엑셀 저장만 실행 (Application 모드)
                success = run_automation_scenario(pid)
                
                if success:
                    log_message(f"[{run_count}회차] 자동화 완료 ✓")
                else:
                    log_message(f"[{run_count}회차] 자동화 실패 ✗", save_to_file=True)
            
            # 다음 실행까지 대기
            log_message(f"\n[대기] 다음 실행까지 {INTERVAL_MINUTES}분 대기...")
            next_run = datetime.now() + timedelta(minutes=INTERVAL_MINUTES)
            log_message(f"[다음 실행] {next_run.strftime('%H:%M:%S')}")
            
            # 1분마다 남은 시간 표시
            for remaining in range(INTERVAL_MINUTES, 0, -1):
                log_message(f"  └─ {remaining}분 남음...")
                time.sleep(60)
            
        except KeyboardInterrupt:
            log_message("\n[종료] 사용자가 프로그램을 중단했습니다.")
            break
        except Exception as e:
            log_message(f"\n[에러] 예상치 못한 오류: {e}", save_to_file=True)
            import traceback
            traceback.print_exc()
            
            # 스택 트레이스도 파일에 저장
            try:
                log_file = get_log_filename()
                with open(log_file, 'a', encoding='utf-8') as f:
                    import traceback
                    f.write(traceback.format_exc() + '\n')
            except:
                pass
            
            log_message(f"[대기] 1분 후 재시도...")
            time.sleep(60)
    
    log_message("\n" + "=" * 60)
    log_message("두드림 ERP 자동화 루프 종료")
    log_message("=" * 60)

if __name__ == "__main__":
    main()

