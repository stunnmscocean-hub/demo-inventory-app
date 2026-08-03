import json
import csv

def save_to_csv(json_file, csv_file):
    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # 실제 데이터 리스트 추출
        stock_list = data['Data']['PIV_STCK_SUM_LIST0']
        
        if not stock_list:
            print("데이터가 비어있습니다.")
            return

        # 첫 번째 항목의 키들을 헤더(컬럼명)로 사용
        headers = stock_list[0].keys()

        with open(csv_file, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            writer.writerows(stock_list)
        
        print(f"[*] 성공! {len(stock_list)}건의 데이터를 '{csv_file}'로 저장했습니다.")
        print("[*] 엑셀에서 파일을 열어보세요.")

    except Exception as e:
        print(f"오류 발생: {e}")

if __name__ == "__main__":
    save_to_csv('erp_stock_result.json', 'stock_data.csv')