#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
마우스 좌표 추적기
실시간으로 마우스 커서 좌표를 표시하는 GUI
"""

import tkinter as tk
from tkinter import ttk
import win32api
import win32con
import time
import sys

class MouseTracker:
    def __init__(self, root):
        self.root = root
        self.root.title("마우스 좌표 추적기")
        self.root.geometry("400x250")
        self.root.resizable(False, False)
        
        # 항상 최상위 옵션
        self.always_on_top = tk.BooleanVar(value=True)
        self.root.attributes('-topmost', True)
        
        # GUI 설정
        self.setup_ui()
        
        # 좌표 기록 리스트
        self.recorded_positions = []
        
        # 업데이트 시작
        self.update_position()
    
    def setup_ui(self):
        """UI 구성"""
        # 메인 프레임
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # 제목
        title_label = ttk.Label(main_frame, text="마우스 좌표 추적기", 
                                font=('맑은 고딕', 14, 'bold'))
        title_label.grid(row=0, column=0, columnspan=2, pady=(0, 5))
        
        # 화면 해상도 표시
        screen_width = win32api.GetSystemMetrics(0)
        screen_height = win32api.GetSystemMetrics(1)
        resolution_label = ttk.Label(main_frame, 
                                     text=f"화면 해상도: {screen_width} x {screen_height}",
                                     font=('맑은 고딕', 9),
                                     foreground='blue')
        resolution_label.grid(row=1, column=0, columnspan=2, pady=(0, 10))
        
        # 현재 좌표 표시
        coord_frame = ttk.LabelFrame(main_frame, text="현재 좌표", padding="10")
        coord_frame.grid(row=2, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=5)
        
        # X 좌표
        ttk.Label(coord_frame, text="X:", font=('맑은 고딕', 12)).grid(row=0, column=0, sticky=tk.W)
        self.x_label = ttk.Label(coord_frame, text="0", font=('맑은 고딕', 16, 'bold'), 
                                 foreground='blue')
        self.x_label.grid(row=0, column=1, sticky=tk.W, padx=(10, 20))
        
        # Y 좌표
        ttk.Label(coord_frame, text="Y:", font=('맑은 고딕', 12)).grid(row=0, column=2, sticky=tk.W)
        self.y_label = ttk.Label(coord_frame, text="0", font=('맑은 고딕', 16, 'bold'), 
                                 foreground='red')
        self.y_label.grid(row=0, column=3, sticky=tk.W, padx=(10, 0))
        
        # 기록된 좌표 표시
        record_frame = ttk.LabelFrame(main_frame, text="기록된 좌표 (Ctrl+클릭)", padding="10")
        record_frame.grid(row=3, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=5)
        
        self.record_text = tk.Text(record_frame, height=4, width=40, font=('Consolas', 10))
        self.record_text.grid(row=0, column=0, sticky=(tk.W, tk.E))
        self.record_text.config(state=tk.DISABLED)
        
        # 버튼 프레임
        button_frame = ttk.Frame(main_frame)
        button_frame.grid(row=4, column=0, columnspan=2, pady=10)
        
        # 기록 버튼
        self.record_btn = ttk.Button(button_frame, text="좌표 기록 (Space)", 
                                     command=self.record_position)
        self.record_btn.grid(row=0, column=0, padx=5)
        
        # 복사 버튼
        self.copy_btn = ttk.Button(button_frame, text="복사", command=self.copy_last_position)
        self.copy_btn.grid(row=0, column=1, padx=5)
        
        # 초기화 버튼
        self.clear_btn = ttk.Button(button_frame, text="초기화", command=self.clear_records)
        self.clear_btn.grid(row=0, column=2, padx=5)
        
        # 체크박스
        check_frame = ttk.Frame(main_frame)
        check_frame.grid(row=4, column=0, columnspan=2)
        
        ttk.Checkbutton(check_frame, text="항상 위에 표시", 
                       variable=self.always_on_top,
                       command=self.toggle_topmost).grid(row=0, column=0)
        
        # 키보드 단축키
        self.root.bind('<space>', lambda e: self.record_position())
        self.root.bind('<Control-c>', lambda e: self.copy_last_position())
        
        # 설명
        info_label = ttk.Label(main_frame, 
                              text="Space: 좌표 기록 | Ctrl+C: 복사 | Esc: 종료", 
                              font=('맑은 고딕', 8), foreground='gray')
        info_label.grid(row=5, column=0, columnspan=2, pady=(10, 0))
        
        # ESC로 종료
        self.root.bind('<Escape>', lambda e: self.root.quit())
    
    def update_position(self):
        """마우스 위치 업데이트"""
        try:
            # 현재 마우스 좌표 가져오기
            x, y = win32api.GetCursorPos()
            
            # 라벨 업데이트
            self.x_label.config(text=str(x))
            self.y_label.config(text=str(y))
            
            # 50ms마다 업데이트 (초당 20회)
            self.root.after(50, self.update_position)
        except:
            pass
    
    def record_position(self):
        """현재 좌표 기록"""
        try:
            x, y = win32api.GetCursorPos()
            self.recorded_positions.append((x, y))
            
            # 텍스트 업데이트
            self.record_text.config(state=tk.NORMAL)
            self.record_text.insert(tk.END, f"({x}, {y})\n")
            self.record_text.see(tk.END)
            self.record_text.config(state=tk.DISABLED)
            
            # 시각적 피드백
            self.root.bell()
        except Exception as e:
            print(f"[에러] 좌표 기록 실패: {e}")
    
    def copy_last_position(self):
        """마지막 좌표 클립보드에 복사"""
        if self.recorded_positions:
            x, y = self.recorded_positions[-1]
            coords_text = f"({x}, {y})"
            self.root.clipboard_clear()
            self.root.clipboard_append(coords_text)
            
            # 피드백
            self.copy_btn.config(text="복사됨!")
            self.root.after(1000, lambda: self.copy_btn.config(text="복사"))
        else:
            # 현재 좌표 복사
            x, y = win32api.GetCursorPos()
            coords_text = f"({x}, {y})"
            self.root.clipboard_clear()
            self.root.clipboard_append(coords_text)
            self.copy_btn.config(text="복사됨!")
            self.root.after(1000, lambda: self.copy_btn.config(text="복사"))
    
    def clear_records(self):
        """기록 초기화"""
        self.recorded_positions.clear()
        self.record_text.config(state=tk.NORMAL)
        self.record_text.delete(1.0, tk.END)
        self.record_text.config(state=tk.DISABLED)
    
    def toggle_topmost(self):
        """최상위 토글"""
        self.root.attributes('-topmost', self.always_on_top.get())

def main():
    """메인 함수"""
    root = tk.Tk()
    app = MouseTracker(root)
    root.mainloop()

if __name__ == "__main__":
    main()

