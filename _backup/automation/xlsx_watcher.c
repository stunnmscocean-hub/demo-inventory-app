#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif

#include "mongoose.h"
#include <windows.h>
#include <commctrl.h>
#include <stdio.h>
#include <wchar.h>
#include <locale.h>

#pragma comment(lib, "comctl32.lib")
#pragma comment(lib, "ws2_32.lib")

#define WATCH_DIRECTORY L"C:\\Users\\Choijay\\Desktop\\React\\Stock_check"
#define CSV_FILE_NAME L"stock_data.csv"
#define PYTHON_SCRIPT "fetch_erp_stock.py"

// 웹 서버 설정
#define WEB_PORT "18273"  // 랜덤 포트로 보안 강화
#define ENABLE_PUBLIC_ACCESS 1  // 0: localhost만, 1: 외부 접근 허용
#define ENABLE_DDNS 0  // 1로 설정하면 동적 DNS 자동 업데이트 활성화
#define DDNS_UPDATE_URL "http://www.duckdns.org/update?domains=stockcheckot&token=d874a157-91ea-4f3d-b618-0649514f0ae5&ip="
#define DDNS_UPDATE_INTERVAL_SEC 600  // 10분마다 IP 업데이트

// 보안 설정
#define ENABLE_RATE_LIMIT 1  // Rate Limiting 활성화
#define MAX_REQUESTS_PER_MINUTE 60  // 1분에 최대 요청 수
#define RATE_LIMIT_WINDOW_SEC 60  // Rate Limit 시간 윈도우 (초)

typedef struct {
    WCHAR name[256];
    long long total_stock;      // 총재고
    long long reserved_stock;   // 예약재고
    long long available_stock;  // 가용재고
} Product;

Product products[1000];
int product_count = 0;
HWND hListView;
CRITICAL_SECTION products_lock;  // 스레드 안전성을 위한 뮤텍스
WCHAR last_update_time[64] = {0};  // 최종 업데이트 시간
char public_ip[64] = "알 수 없음";  // 현재 공인 IP
char access_url[256] = "";  // 외부 접근 URL

// Rate Limiting을 위한 구조체
typedef struct {
    char ip[64];
    int count;
    time_t window_start;
} RateLimitEntry;

RateLimitEntry rate_limit_table[100];  // 최대 100개 IP 추적
int rate_limit_count = 0;
CRITICAL_SECTION rate_limit_lock;

// 함수 프로토타입 선언
void FetchERPDataAndProcess();

// 디버그 출력을 위한 래퍼 함수 (터미널에 즉시 출력)
void DebugLog(const WCHAR* fmt, ...) {
    va_list args;
    va_start(args, fmt);
    vwprintf(fmt, args);
    va_end(args);
    wprintf(L"\n");
    fflush(stdout); // 터미널 버퍼를 강제로 비움
}

// Rate Limiting 체크
int CheckRateLimit(const char* client_ip) {
    if (!ENABLE_RATE_LIMIT) return 1;  // Rate Limit 비활성화 시 통과
    
    EnterCriticalSection(&rate_limit_lock);
    
    time_t now = time(NULL);
    int allowed = 1;
    
    // 기존 IP 찾기
    int found = -1;
    for (int i = 0; i < rate_limit_count; i++) {
        // 시간 윈도우가 지났으면 리셋
        if (now - rate_limit_table[i].window_start > RATE_LIMIT_WINDOW_SEC) {
            rate_limit_table[i].count = 0;
            rate_limit_table[i].window_start = now;
        }
        
        if (strcmp(rate_limit_table[i].ip, client_ip) == 0) {
            found = i;
            break;
        }
    }
    
    if (found >= 0) {
        // 기존 IP
        if (rate_limit_table[found].count >= MAX_REQUESTS_PER_MINUTE) {
            allowed = 0;  // 제한 초과
            DebugLog(L"[보안] Rate Limit 차단: %S (요청: %d회)", client_ip, rate_limit_table[found].count);
        } else {
            rate_limit_table[found].count++;
        }
    } else {
        // 새 IP
        if (rate_limit_count < 100) {
            strncpy(rate_limit_table[rate_limit_count].ip, client_ip, 63);
            rate_limit_table[rate_limit_count].count = 1;
            rate_limit_table[rate_limit_count].window_start = now;
            rate_limit_count++;
        }
    }
    
    LeaveCriticalSection(&rate_limit_lock);
    return allowed;
}

// HTTP GET 요청 응답 저장용 전역 변수
static char g_http_response[1024];
static int g_http_done = 0;
    
// HTTP 응답 핸들러
static void http_response_handler(struct mg_connection *c, int ev, void *ev_data) {
    if (ev == MG_EV_HTTP_MSG) {
        struct mg_http_message *hm = (struct mg_http_message *) ev_data;
        int len = hm->body.len < sizeof(g_http_response) - 1 ? hm->body.len : sizeof(g_http_response) - 1;
        memcpy(g_http_response, hm->body.buf, len);
        g_http_response[len] = '\0';
        g_http_done = 1;
        c->is_closing = 1;
    } else if (ev == MG_EV_ERROR || ev == MG_EV_CLOSE) {
        g_http_done = 1;
    }
}

// HTTP GET 요청 수행 (공인 IP 조회 및 DDNS 업데이트용)
int HttpGet(const char* url, char* response, int response_size) {
    struct mg_mgr mgr;
    struct mg_connection *c;
    
    g_http_response[0] = '\0';
    g_http_done = 0;
    
    mg_mgr_init(&mgr);
    
    c = mg_http_connect(&mgr, url, http_response_handler, NULL);
    if (c == NULL) {
        mg_mgr_free(&mgr);
        return 0;
    }
    
    // 최대 10초 대기
    for (int i = 0; i < 100 && !g_http_done; i++) {
        mg_mgr_poll(&mgr, 100);
    }
    
    if (g_http_done && g_http_response[0]) {
        strncpy(response, g_http_response, response_size - 1);
        response[response_size - 1] = '\0';
    }
    
    mg_mgr_free(&mgr);
    
    return response[0] != '\0';
}

// 공인 IP 조회
void GetPublicIP() {
    char ip[64] = {0};
    
    // 여러 서비스 시도 (하나가 실패해도 다른 것으로 시도)
    const char* ip_services[] = {
        "http://api.ipify.org",
        "http://ifconfig.me/ip",
        "http://icanhazip.com"
    };
    
    for (int i = 0; i < 3; i++) {
        if (HttpGet(ip_services[i], ip, sizeof(ip))) {
            // 공백 및 개행 제거
            for (int j = 0; ip[j]; j++) {
                if (ip[j] == '\n' || ip[j] == '\r') {
                    ip[j] = '\0';
                    break;
                }
            }
            if (strlen(ip) > 6) {  // 최소한 "1.1.1.1" 형식
                strncpy(public_ip, ip, sizeof(public_ip) - 1);
                DebugLog(L"공인 IP: %S", public_ip);
                
                // 접근 URL 생성
                snprintf(access_url, sizeof(access_url), "http://%s:%s", public_ip, WEB_PORT);
                return;
            }
        }
    }
    
    DebugLog(L"[경고] 공인 IP를 가져올 수 없습니다");
    strcpy(public_ip, "알 수 없음");
}

// 동적 DNS 업데이트
void UpdateDDNS() {
    if (!ENABLE_DDNS || strlen(DDNS_UPDATE_URL) == 0) {
        return;
    }
    
    char response[256] = {0};
    if (HttpGet(DDNS_UPDATE_URL, response, sizeof(response))) {
        DebugLog(L"DDNS 업데이트 완료: %S", response);
    } else {
        DebugLog(L"[경고] DDNS 업데이트 실패");
    }
}

// DDNS 업데이트 스레드
DWORD WINAPI DDNSUpdateThread(LPVOID lpParam) {
    if (!ENABLE_DDNS) return 0;
    
    while (1) {
        UpdateDDNS();
        Sleep(DDNS_UPDATE_INTERVAL_SEC * 1000);
}
    return 0;
}

int compareProducts(const void* a, const void* b) {
    return wcscmp(((Product*)b)->name, ((Product*)a)->name);
}

void UpdateUI() {
    SendMessage(hListView, LVM_DELETEALLITEMS, 0, 0);
    qsort(products, product_count, sizeof(Product), compareProducts);

    for (int i = 0; i < product_count; i++) {
        LVITEMW lvi = { LVIF_TEXT, i, 0 };
        lvi.pszText = products[i].name;
        SendMessage(hListView, LVM_INSERTITEMW, 0, (LPARAM)&lvi);

        WCHAR totalStr[64], reservedStr[64], availableStr[64];
        swprintf(totalStr, 64, L"%lld", products[i].total_stock);
        swprintf(reservedStr, 64, L"%lld", products[i].reserved_stock);
        swprintf(availableStr, 64, L"%lld", products[i].available_stock);
        
        LVITEMW lviTotal = { LVIF_TEXT, i, 1 };
        lviTotal.pszText = totalStr;
        SendMessage(hListView, LVM_SETITEMW, i, (LPARAM)&lviTotal);
        
        LVITEMW lviReserved = { LVIF_TEXT, i, 2 };
        lviReserved.pszText = reservedStr;
        SendMessage(hListView, LVM_SETITEMW, i, (LPARAM)&lviReserved);
        
        LVITEMW lviAvailable = { LVIF_TEXT, i, 3 };
        lviAvailable.pszText = availableStr;
        SendMessage(hListView, LVM_SETITEMW, i, (LPARAM)&lviAvailable);
    }
}

// HTTP 요청 핸들러
static void HandleHttpRequest(struct mg_connection *c, int ev, void *ev_data) {
    if (ev == MG_EV_HTTP_MSG) {
        struct mg_http_message *hm = (struct mg_http_message *) ev_data;
        
        // 클라이언트 IP 가져오기
        char client_ip[64] = {0};
        snprintf(client_ip, sizeof(client_ip), "%M", mg_print_ip, &c->rem);
        
        // Rate Limiting 체크
        if (!CheckRateLimit(client_ip)) {
            mg_http_reply(c, 429, 
                "Content-Type: text/plain\r\n", 
                "Too Many Requests - Rate limit exceeded. Please try again later.");
            return;
        }
        
        // CORS 프리플라이트 요청 처리
        if (mg_strcmp(hm->method, mg_str("OPTIONS")) == 0) {
            mg_http_reply(c, 204, 
                "Access-Control-Allow-Origin: *\r\n"
                "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
                "Access-Control-Allow-Headers: Content-Type\r\n", 
                "");
            return;
        }
        
        // POST /api/refresh - ERP에서 새 데이터 가져오기
        if (mg_strcmp(hm->uri, mg_str("/api/refresh")) == 0 && mg_strcmp(hm->method, mg_str("POST")) == 0) {
            DebugLog(L"\n[웹 요청] ERP 데이터 새로고침 요청됨");
            
            // 별도 스레드에서 실행 (응답 블로킹 방지)
            CreateThread(NULL, 0, (LPTHREAD_START_ROUTINE)FetchERPDataAndProcess, NULL, 0, NULL);
            
            mg_http_reply(c, 202, 
                "Content-Type: application/json; charset=utf-8\r\n"
                "Access-Control-Allow-Origin: *\r\n", 
                "{\"status\":\"processing\",\"message\":\"ERP 데이터를 가져오는 중입니다...\"}");
        }
        // GET /api/stock - 재고 데이터 조회
        else if (mg_strcmp(hm->uri, mg_str("/api/stock")) == 0) {
            EnterCriticalSection(&products_lock);
            
            // JSON 응답 생성
            char json[65536];
            char update_time_utf8[128] = "N/A";
            
            // 최종 업데이트 시간 변환
            if (last_update_time[0]) {
                WideCharToMultiByte(CP_UTF8, 0, last_update_time, -1, update_time_utf8, sizeof(update_time_utf8), NULL, NULL);
            }
            
            sprintf(json, "{\"count\":%d,\"last_update\":\"%s\",\"products\":[", product_count, update_time_utf8);
            
            for (int i = 0; i < product_count; i++) {
                char item[1024];
                char name_utf8[512];
                
                // Wide char를 UTF-8로 변환
                WideCharToMultiByte(CP_UTF8, 0, products[i].name, -1, name_utf8, sizeof(name_utf8), NULL, NULL);
                
                // JSON 이스케이프 처리 (간단 버전)
                char escaped_name[512];
                int j = 0;
                for (int k = 0; name_utf8[k] && j < 510; k++) {
                    if (name_utf8[k] == '"' || name_utf8[k] == '\\') {
                        escaped_name[j++] = '\\';
                    }
                    escaped_name[j++] = name_utf8[k];
                }
                escaped_name[j] = '\0';
                
                sprintf(item, "{\"name\":\"%s\",\"total_stock\":%lld,\"reserved_stock\":%lld,\"available_stock\":%lld}%s", 
                    escaped_name, 
                    products[i].total_stock,
                    products[i].reserved_stock,
                    products[i].available_stock,
                    i < product_count-1 ? "," : "");
                strcat(json, item);
            }
            strcat(json, "]}");
            
            LeaveCriticalSection(&products_lock);
            
            mg_http_reply(c, 200, 
                "Content-Type: application/json; charset=utf-8\r\n"
                "Access-Control-Allow-Origin: *\r\n", 
                "%s", json);
        }
        // GET / - 모던 대시보드 (dashboard_modern.html 파일 서빙)
        else if (mg_strcmp(hm->uri, mg_str("/")) == 0) {
            // 파일 읽기
            FILE *fp = fopen("dashboard_modern.html", "rb");
            if (fp) {
                // 파일 크기 확인
                fseek(fp, 0, SEEK_END);
                long file_size = ftell(fp);
                fseek(fp, 0, SEEK_SET);
                
                // 파일 내용 읽기
                char *html_content = (char*)malloc(file_size + 1);
                if (html_content) {
                    size_t read_size = fread(html_content, 1, file_size, fp);
                    html_content[read_size] = '\0';
                    
                    // API_BASE를 동적으로 설정하기 위해 JavaScript 수정
                    // 현재는 하드코딩된 IP를 사용하므로 그대로 두거나
                    // 서버에서 동적으로 생성할 수 있음
                    
                    mg_http_reply(c, 200, 
                        "Content-Type: text/html; charset=utf-8\r\n"
                        "Cache-Control: no-cache\r\n", 
                        "%s", html_content);
                    
                    free(html_content);
                } else {
                    mg_http_reply(c, 500, "", "Memory allocation failed\n");
                }
                fclose(fp);
            } else {
                // 파일이 없으면 기본 HTML 반환
                mg_http_reply(c, 200, "Content-Type: text/html; charset=utf-8\r\n", 
                    "<!DOCTYPE html><html><head><meta charset='utf-8'><title>재고 조회 시스템</title></head>"
                    "<body><h1>대시보드 파일을 찾을 수 없습니다</h1>"
                    "<p>dashboard_modern.html 파일이 현재 디렉토리에 있어야 합니다.</p></body></html>");
            }
        }
        else {
            mg_http_reply(c, 404, "", "Not Found\n");
        }
    }
}

// 웹 서버 스레드
DWORD WINAPI WebServerThread(LPVOID lpParam) {
    struct mg_mgr mgr;
    mg_mgr_init(&mgr);
    
    // 바인딩 주소 설정
    char listen_addr[128];
    if (ENABLE_PUBLIC_ACCESS) {
        snprintf(listen_addr, sizeof(listen_addr), "http://0.0.0.0:%s", WEB_PORT);
    } else {
        snprintf(listen_addr, sizeof(listen_addr), "http://127.0.0.1:%s", WEB_PORT);
    }
    
    struct mg_connection *c = mg_http_listen(&mgr, listen_addr, HandleHttpRequest, NULL);
    if (c == NULL) {
        DebugLog(L"[에러] 웹 서버를 시작할 수 없습니다 (포트 %S 사용 중?)", WEB_PORT);
        return 1;
    }
    
    DebugLog(L"");
    DebugLog(L"✓ 웹 서버 시작 성공!");
    DebugLog(L"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    DebugLog(L"  로컬 접속: http://localhost:%S", WEB_PORT);
    
    if (ENABLE_PUBLIC_ACCESS) {
        DebugLog(L"  외부 접속 허용됨 ✓");
        
        // 공인 IP 조회 (별도 스레드에서 실행하여 서버 시작 지연 방지)
        HANDLE hIPThread = CreateThread(NULL, 0, (LPTHREAD_START_ROUTINE)GetPublicIP, NULL, 0, NULL);
        if (hIPThread) {
            WaitForSingleObject(hIPThread, 5000);  // 최대 5초 대기
            CloseHandle(hIPThread);
            
            if (strcmp(public_ip, "알 수 없음") != 0) {
                DebugLog(L"  공인 IP: %S", public_ip);
                DebugLog(L"  외부 접속 URL: %S", access_url);
            }
        }
        
        if (ENABLE_DDNS) {
            DebugLog(L"  동적 DNS: 활성화 (%d초마다 업데이트)", DDNS_UPDATE_INTERVAL_SEC);
            UpdateDDNS();  // 즉시 한 번 업데이트
            CreateThread(NULL, 0, DDNSUpdateThread, NULL, 0, NULL);
        }
    } else {
        DebugLog(L"  외부 접속: 비활성화 (localhost만)");
    }
    
    DebugLog(L"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    DebugLog(L"  API: /api/stock");
    DebugLog(L"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    DebugLog(L"");
    
    while (1) {
        mg_mgr_poll(&mgr, 1000);  // 1초마다 폴링
    }
    
    mg_mgr_free(&mgr);
    return 0;
}

long long SafeWtoi64(const WCHAR* str) {
    if (!str) return 0;
    WCHAR buf[128] = { 0 };
    int j = 0;
    for (int i = 0; str[i] != L'\0' && j < 127; i++) {
        if (iswdigit(str[i])) buf[j++] = str[i];
    }
    return (j > 0) ? _wtoi64(buf) : 0;
}

void ReadAndAggregateCSV(const WCHAR* csv_path) {
    EnterCriticalSection(&products_lock);
    product_count = 0;
    LeaveCriticalSection(&products_lock);
    
    // UTF-8 with BOM으로 읽기
    FILE* fp = _wfopen(csv_path, L"r, ccs=UTF-8");
    if (!fp) {
        DebugLog(L"[에러] CSV 파일을 열 수 없습니다: %s", csv_path);
        return;
    }

    WCHAR line[4096];
    int row = 0;
    DebugLog(L"--- CSV 데이터 읽기 시작 ---");

    // 칼럼 인덱스 찾기
    int prdt_nm_idx = -1;      // PRDT_NM (상품명)
    int whse_nm_idx = -1;      // WHSE_NM (창고명)
    int stck_sum_qty_idx = -1; // STCK_SUM_QTY (총재고)
    int stck_rsv_qty_idx = -1; // STCK_RSV_QTY (예약재고)
    int stck_can_qty_idx = -1; // STCK_CAN_QTY (가용재고)

    while (fgetws(line, 4096, fp)) {
        row++;
        
        // 개행 문자 제거
        size_t len = wcslen(line);
        while (len > 0 && (line[len-1] == L'\n' || line[len-1] == L'\r')) {
            line[--len] = L'\0';
        }
        
        if (row == 1) {
            // 헤더 행에서 칼럼 인덱스 찾기
            WCHAR* context = NULL;
            WCHAR* token = wcstok(line, L"\t", &context);
            int col_idx = 0;
            
            while (token) {
                // BOM 제거
                if (col_idx == 0 && token[0] == 0xFEFF) {
                    token++;
                }
                
                if (wcscmp(token, L"PRDT_NM") == 0) prdt_nm_idx = col_idx;
                else if (wcscmp(token, L"WHSE_NM") == 0) whse_nm_idx = col_idx;
                else if (wcscmp(token, L"STCK_SUM_QTY") == 0) stck_sum_qty_idx = col_idx;
                else if (wcscmp(token, L"STCK_RSV_QTY") == 0) stck_rsv_qty_idx = col_idx;
                else if (wcscmp(token, L"STCK_CAN_QTY") == 0) stck_can_qty_idx = col_idx;
                
                token = wcstok(NULL, L"\t", &context);
                col_idx++;
            }
            
            DebugLog(L"[칼럼 매핑] 상품명=%d, 창고명=%d, 총재고=%d, 예약=%d, 가용=%d", 
                     prdt_nm_idx, whse_nm_idx, stck_sum_qty_idx, stck_rsv_qty_idx, stck_can_qty_idx);
            
            if (prdt_nm_idx < 0 || whse_nm_idx < 0 || stck_sum_qty_idx < 0) {
                DebugLog(L"[에러] 필수 칼럼을 찾을 수 없습니다!");
                fclose(fp);
                return;
            }
            continue;
        }

        // 데이터 행 파싱
        WCHAR* context = NULL;
        WCHAR* token = wcstok(line, L"\t", &context);
        int col_idx = 0;
        
        WCHAR prdt_nm[256] = {0};
        WCHAR whse_nm[256] = {0};
        long long total = 0, reserved = 0, available = 0;
        
        while (token) {
            if (col_idx == prdt_nm_idx) {
                wcsncpy(prdt_nm, token, 255);
            } else if (col_idx == whse_nm_idx) {
                wcsncpy(whse_nm, token, 255);
            } else if (col_idx == stck_sum_qty_idx) {
                total = SafeWtoi64(token);
            } else if (col_idx == stck_rsv_qty_idx) {
                reserved = SafeWtoi64(token);
            } else if (col_idx == stck_can_qty_idx) {
                available = SafeWtoi64(token);
            }
            
            token = wcstok(NULL, L"\t", &context);
            col_idx++;
        }
        
        // 창고명 필터링: 대원위탁창고 또는 본사임시창고만
        if (wcsstr(whse_nm, L"대원위탁창고") || wcsstr(whse_nm, L"본사임시창고")) {
            EnterCriticalSection(&products_lock);
            int found = 0;
            for (int i = 0; i < product_count; i++) {
                if (wcscmp(products[i].name, prdt_nm) == 0) {
                    products[i].total_stock += total;
                    products[i].reserved_stock += reserved;
                    products[i].available_stock += available;
                    found = 1;
                    break;
                }
            }
            if (!found && product_count < 1000) {
                wcscpy(products[product_count].name, prdt_nm);
                products[product_count].total_stock = total;
                products[product_count].reserved_stock = reserved;
                products[product_count].available_stock = available;
                product_count++;
            }
            LeaveCriticalSection(&products_lock);
        }
    }
    fclose(fp);
    DebugLog(L"--- 읽기 완료 (총 상품 수: %d) ---", product_count);
    UpdateUI();
}

void FetchERPDataAndProcess() {
    DebugLog(L"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    DebugLog(L"  ERP API 호출 중...");
    DebugLog(L"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    // Python 스크립트 실행 (ERP API 호출 → CSV 변환)
    char cmd[512];
    snprintf(cmd, sizeof(cmd), "python %s 2>&1", PYTHON_SCRIPT);
    int ret = system(cmd);
    
    if (ret != 0) {
        DebugLog(L"[에러] ERP 데이터 가져오기 실패 (코드: %d)", ret);
        DebugLog(L"  Python 스크립트 확인: %S", PYTHON_SCRIPT);
        DebugLog(L"  또는 Python/requests 설치 확인");
        return;
    }
    
    Sleep(500); // 파일 쓰기 완료 대기
    
    // 현재 시간 저장
    SYSTEMTIME st;
    GetLocalTime(&st);
    swprintf(last_update_time, 64, L"%04d-%02d-%02d %02d:%02d:%02d",
             st.wYear, st.wMonth, st.wDay, st.wHour, st.wMinute, st.wSecond);
                    
    // CSV 파일 읽기 및 집계
    ReadAndAggregateCSV(CSV_FILE_NAME);
    
    DebugLog(L"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    DebugLog(L"  데이터 업데이트 완료! ✓");
    DebugLog(L"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

// 자동 업데이트 스레드 (10분마다)
DWORD WINAPI AutoUpdateThread(LPVOID lpParam) {
    Sleep(5000); // 시작 후 5초 대기
    
    // 첫 실행
    FetchERPDataAndProcess();
    
    // 10분마다 자동 업데이트
    while (1) {
        Sleep(10 * 60 * 1000); // 10분
        DebugLog(L"\n[자동 업데이트] 10분 경과 - 데이터 새로고침");
        FetchERPDataAndProcess();
    }
    return 0;
}

LRESULT CALLBACK WindowProc(HWND hwnd, UINT uMsg, WPARAM wParam, LPARAM lParam) {
    switch (uMsg) {
        case WM_CREATE: {
            INITCOMMONCONTROLSEX icex = { sizeof(icex), ICC_LISTVIEW_CLASSES };
            InitCommonControlsEx(&icex);
            hListView = CreateWindowExW(0, WC_LISTVIEWW, L"", WS_VISIBLE | WS_CHILD | LVS_REPORT, 10, 10, 760, 400, hwnd, NULL, NULL, NULL);
            SendMessage(hListView, LVM_SETEXTENDEDLISTVIEWSTYLE, 0, LVS_EX_FULLROWSELECT | LVS_EX_GRIDLINES);
            LVCOLUMNW lvc = { LVCF_TEXT | LVCF_WIDTH, 0, 300, L"상품명" };
            SendMessage(hListView, LVM_INSERTCOLUMNW, 0, (LPARAM)&lvc);
            lvc.cx = 120; lvc.pszText = L"총재고";
            SendMessage(hListView, LVM_INSERTCOLUMNW, 1, (LPARAM)&lvc);
            lvc.cx = 120; lvc.pszText = L"예약재고";
            SendMessage(hListView, LVM_INSERTCOLUMNW, 2, (LPARAM)&lvc);
            lvc.cx = 120; lvc.pszText = L"가용재고";
            SendMessage(hListView, LVM_INSERTCOLUMNW, 3, (LPARAM)&lvc);
            
            // 수동 새로고침 버튼
            CreateWindowExW(0, L"BUTTON", L"새로고침 (ERP 데이터)", 
                WS_VISIBLE | WS_CHILD | BS_PUSHBUTTON, 
                10, 420, 200, 35, hwnd, (HMENU)1, NULL, NULL);
            
            // 자동 업데이트 스레드 시작
            CreateThread(NULL, 0, AutoUpdateThread, NULL, 0, NULL);
            break;
        }
        case WM_COMMAND: {
            if (LOWORD(wParam) == 1) { // 버튼 클릭
                DebugLog(L"\n[수동 새로고침] 버튼 클릭됨");
                CreateThread(NULL, 0, (LPTHREAD_START_ROUTINE)FetchERPDataAndProcess, NULL, 0, NULL);
    }
            break;
        }
        case WM_DESTROY: PostQuitMessage(0); return 0;
    }
    return DefWindowProcW(hwnd, uMsg, wParam, lParam);
}

int main() {
    // 터미널 출력 설정
    _wsetlocale(LC_ALL, L"korean");
    
    // Critical Section 초기화
    InitializeCriticalSection(&products_lock);
    InitializeCriticalSection(&rate_limit_lock);
    
    DebugLog(L"===========================================");
    DebugLog(L"  재고 진단 시스템 v3.0 (ERP 연동)");
    DebugLog(L"===========================================");
    DebugLog(L"작업 폴더: %s", WATCH_DIRECTORY);
    DebugLog(L"데이터 소스: ERP API (두드림)");
    DebugLog(L"자동 업데이트: 10분마다");
    if (ENABLE_RATE_LIMIT) {
        DebugLog(L"보안: Rate Limiting 활성화 (%d req/min)", MAX_REQUESTS_PER_MINUTE);
    }
    DebugLog(L"");
    
    // 초기 데이터 로드
    DebugLog(L"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    DebugLog(L"  초기 ERP 데이터 로딩 중...");
    DebugLog(L"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    FetchERPDataAndProcess();
    DebugLog(L"");

    // 웹 서버 스레드 시작
    HANDLE hWebServerThread = CreateThread(NULL, 0, WebServerThread, NULL, 0, NULL);
    if (hWebServerThread == NULL) {
        DebugLog(L"[경고] 웹 서버 스레드를 시작할 수 없습니다");
    }

    WNDCLASSW wc = {0};
    wc.lpfnWndProc = WindowProc;
    wc.hInstance = GetModuleHandle(NULL);
    wc.lpszClassName = L"StockCheckUI";
    wc.hbrBackground = (HBRUSH)(COLOR_WINDOW + 1);
    wc.hCursor = LoadCursor(NULL, IDC_ARROW);
    RegisterClassW(&wc);

    WCHAR window_title[256];
    if (ENABLE_PUBLIC_ACCESS) {
        swprintf(window_title, 256, L"재고 진단 시스템 v2.0 (Public: http://0.0.0.0:%S)", WEB_PORT);
    } else {
        swprintf(window_title, 256, L"재고 진단 시스템 v2.0 (Local: http://localhost:%S)", WEB_PORT);
    }
    
    HWND hwnd = CreateWindowExW(0, L"StockCheckUI", window_title, 
        WS_OVERLAPPEDWINDOW | WS_VISIBLE, CW_USEDEFAULT, CW_USEDEFAULT, 800, 530, NULL, NULL, NULL, NULL);

    MSG msg;
    while (GetMessageW(&msg, NULL, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }
    
    // 정리
    DeleteCriticalSection(&products_lock);
    DeleteCriticalSection(&rate_limit_lock);
    if (hWebServerThread) CloseHandle(hWebServerThread);
    
    return 0;
}
