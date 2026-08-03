import requests
import json
import csv
import sys
from datetime import datetime

def fetch_and_convert_stock_data():
    """ERP API에서 재고 데이터를 가져와 CSV로 변환"""
    
    URL = "http://112.175.234.175/api/Proc"
    
    headers = {
        "Host": "do3.dwcts.co.kr",
        "Content-Type": "application/json; charset=utf-8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "application/json, text/plain, */*",
        "Connection": "keep-alive"
    }
    
    today = datetime.now().strftime("%Y%m%d")
    
    payload = {
        "IsReal": "REAL",
        "BizID": "OCT",
        "ServiceId": "",
        "ProcId": "",
        "SqlId": "",
        "UserVersion": "1.3.2022.1533",
        "IsTransaction": True,
        "PageSize": 0,
        "PageNo": 1,
        "ProcParam": {
            "sendValue": {
                "PIV_STCK_SUM_LIST": [
                    {
                        "MAJ_CTGR_CD": "MC00000003",
                        "MAJ_CTGR_NM": "Logitech VC",
                        "BASE_DT": today
                    }
                ]
            }
        },
        "OtherValue": {
            "P_USER_ID": 100082,
            "P_USER_NM": "최진호",
            "P_USER_CD": "ME00000081",
            "P_CORP_CD": "OCT"
        },
        "NullToZero": True
    }
    
    print(f"[1/2] ERP API 호출 중... (날짜: {today})", file=sys.stderr)
    
    try:
        response = requests.post(URL, json=payload, headers=headers, timeout=15)
        
        if response.status_code not in [200, 201]:
            print(f"[에러] HTTP {response.status_code}", file=sys.stderr)
            return 1
        
        result = response.json()
        
        # 요청 정보를 응답에 추가하여 저장
        result['RequestInfo'] = {
            'BizID': payload['BizID'],
            'UserVersion': payload['UserVersion'],
            'P_USER_NM': payload['OtherValue']['P_USER_NM'],
            'RequestTime': datetime.now().isoformat()
        }
        
        # JSON 원본 저장
        with open('stock_data.json', 'w', encoding='utf-8') as jsonfile:
            json.dump(result, jsonfile, ensure_ascii=False, indent=2)
        
        # 데이터 추출
        if 'Data' not in result or 'PIV_STCK_SUM_LIST0' not in result['Data']:
            print("[에러] 응답에 데이터가 없습니다", file=sys.stderr)
            return 1
        
        data_list = result['Data']['PIV_STCK_SUM_LIST0']
        print(f"[성공] {len(data_list)}건의 데이터를 받았습니다.", file=sys.stderr)
        
        # CSV로 변환
        print(f"[2/2] CSV 변환 중...", file=sys.stderr)
        
        if not data_list:
            print("[경고] 데이터가 비어있습니다", file=sys.stderr)
            return 1
        
        # CSV 파일 생성 (탭 구분자)
        with open('stock_data.csv', 'w', newline='', encoding='utf-8-sig') as csvfile:
            # 첫 번째 항목의 키를 헤더로 사용
            fieldnames = list(data_list[0].keys())
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames, delimiter='\t')
            
            writer.writeheader()
            writer.writerows(data_list)
        
        print(f"[완료] stock_data.csv 생성 완료", file=sys.stderr)
        return 0
        
    except Exception as e:
        print(f"[에러] {e}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(fetch_and_convert_stock_data())

