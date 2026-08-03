#include <windows.h>
#include <stdio.h>
#include <wchar.h>

// 설정: 한글 깨짐 방지를 위해 명시적 유니코드(L) 사용
// 사용자 폴더명이 Choijay가 맞는지 꼭 확인하세요!
#define WATCH_DIRECTORY L"C:\\Users\\Choijay\\Downloads"
#define TARGET_PREFIX L"현재재고조회"
#define FILE_EXTENSION L".xlsx"

void convert_to_csv(const WCHAR* file_path) {
    wprintf(L"새로운 파일 감지됨: %s\n", file_path);
    
    // 파일이 완전히 저장될 때까지 1초 대기
    Sleep(1000);

    // 저장할 CSV 파일명 생성 (.xlsx -> .csv)
    WCHAR csv_path[MAX_PATH];
    wcscpy(csv_path, file_path);
    WCHAR* dot = wcsrchr(csv_path, L'.');
    if (dot != NULL) {
        wcscpy(dot, L".csv");
    }

    // C언어는 pandas가 없어서 실제 엑셀을 읽으려면 매우 복잡한 라이브러리가 필요합니다.
    // 여기서는 로직 확인을 위해 결과 파일만 생성합니다.
    FILE* fp = _wfopen(csv_path, L"w, ccs=UTF-8");
    if (fp) {
        // UTF-8 BOM (엑셀 한글 깨짐 방지)
        fputc(0xEF, fp); fputc(0xBB, fp); fputc(0xBF, fp);
        fwprintf(fp, L"결과;데이터;상태\nC언어 감지 완료;내용은 라이브러리 필요;성공\n");
        fclose(fp);
        wprintf(L"변환 완료 (더미 파일 생성): %s\n", csv_path);
    } else {
        wprintf(L"파일 생성 실패\n");
    }
}

int main() {
    // 디렉토리 핸들 열기
    HANDLE hDir = CreateFileW(
        WATCH_DIRECTORY,
        FILE_LIST_DIRECTORY,
        FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
        NULL,
        OPEN_EXISTING,
        FILE_FLAG_BACKUP_SEMANTICS,
        NULL
    );

    if (hDir == INVALID_HANDLE_VALUE) {
        fwprintf(stderr, L"오류: 디렉토리를 열 수 없습니다. 경로를 확인하세요.\n");
        fwprintf(stderr, L"에러 코드: %lu\n", GetLastError());
        return 1;
    }

    wprintf(L"모니터링 시작: %s\n", WATCH_DIRECTORY);

    BYTE buffer[1024];
    DWORD bytesReturned;

    while (TRUE) {
        // 폴더 내 변화 감지 (Windows API)
        if (ReadDirectoryChangesW(
            hDir, buffer, sizeof(buffer), FALSE,
            FILE_NOTIFY_CHANGE_FILE_NAME,
            &bytesReturned, NULL, NULL)) 
        {
            FILE_NOTIFY_INFORMATION* fni = (FILE_NOTIFY_INFORMATION*)buffer;
            do {
                // 새로운 파일이 생성된 경우
                if (fni->Action == FILE_ACTION_ADDED) {
                    WCHAR fileName[MAX_PATH] = { 0 };
                    memcpy(fileName, fni->FileName, fni->FileNameLength);
                    fileName[fni->FileNameLength / sizeof(WCHAR)] = L'\0';

                    // 조건 확인: 파일명이 TARGET_PREFIX로 시작하고 .xlsx로 끝나는가?
                    if (wcsstr(fileName, TARGET_PREFIX) == fileName && 
                        wcsstr(fileName, FILE_EXTENSION) != NULL) 
                    {
                        WCHAR fullPath[MAX_PATH];
                        swprintf(fullPath, MAX_PATH, L"%s\\%s", WATCH_DIRECTORY, fileName);
                        convert_to_csv(fullPath);
                    }
                }
                if (fni->NextEntryOffset == 0) break;
                fni = (FILE_NOTIFY_INFORMATION*)((BYTE*)fni + fni->NextEntryOffset);
            } while (TRUE);
        }
    }

    CloseHandle(hDir);
    return 0;
}