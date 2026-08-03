import pandas as pd
import os

# 테스트용 데이터 생성
data = {
    '상품명': ['상품A', '상품B', '상품C'],
    '재고수량': [10, 20, 30],
    '가격': [1000, 2000, 3000]
}

df = pd.DataFrame(data)

# 테스트 파일 저장 경로 (Downloads 폴더)
test_file_path = r"C:\Users\Choijay\Downloads\현재재고조회_테스트.xlsx"

try:
    df.to_excel(test_file_path, index=False)
    print(f"테스트 파일 생성 완료: {test_file_path}")
except Exception as e:
    print(f"테스트 파일 생성 실패: {e}")
