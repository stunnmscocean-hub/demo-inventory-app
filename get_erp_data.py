import requests
import json

# 1. 대상 URL (IP는 그대로 사용해도 됩니다)
URL = "http://112.175.234.175/api/Proc"

def get_stock_data():
    # 2. [가장 중요] 서버가 요구하는 이름표(Host)를 설정합니다.
    headers = {
        "Host": "do3.dwcts.co.kr",  # <--- 이게 없어서 404가 났던 것입니다!
        "Content-Type": "application/json; charset=utf-8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "application/json, text/plain, */*",
        "Connection": "keep-alive"
    }

    # 3. 아까 패킷에서 추출한 진짜 데이터 (재고 조회용 페이로드)
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
                        "BASE_DT": __import__('datetime').datetime.now().strftime("%Y%m%d")  # 자동으로 오늘 날짜
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

    print(f"[*] 데이터 조회 시도 중...")
    print(f"[*] 대상 주소: {URL}")
    print(f"[*] 호스트 헤더: {headers['Host']}")

    try:
        # POST 요청 전송
        response = requests.post(URL, json=payload, headers=headers, timeout=15)
        
        print(f"[*] 응답 코드: {response.status_code}")
        
        if response.status_code in [200, 201]:
            print("\n[성공!!!] 데이터를 정상적으로 수신했습니다.")
            
            result = response.json()
            
            # 4. 파일로 저장
            save_file = 'erp_stock_result.json'
            with open(save_file, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
            
            print(f"[*] 데이터가 '{save_file}'에 저장되었습니다.")
            
            # 수신된 데이터 구조에 따라 개수 확인 (예시)
            if isinstance(result, list):
                print(f"[*] 수신된 항목 수: {len(result)}개")
            else:
                print("[*] 데이터를 딕셔너리 형태로 수신했습니다.")
                
        else:
            print(f"[실패] 여전히 {response.status_code} 에러가 발생합니다.")
            print("서버 응답:", response.text[:200])

    except Exception as e:
        print(f"[에러] {e}")

if __name__ == "__main__":
    get_stock_data()