# Ubuntu 서버로 파일 전송 스크립트
# PowerShell에서 실행: .\전송하기.ps1

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Ubuntu 서버로 파일 전송" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 1. SSH 키 파일 찾기
Write-Host "[1/4] SSH 키 파일 찾는 중..." -ForegroundColor Yellow

$keyFiles = @(
    "$env:USERPROFILE\Downloads\default-key-seoul.pem",
    "$env:USERPROFILE\Downloads\*.pem",
    "$env:USERPROFILE\Desktop\*.pem"
)

$keyPath = $null
foreach ($pattern in $keyFiles) {
    $found = Get-ChildItem $pattern -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) {
        $keyPath = $found.FullName
        break
    }
}

if (-not $keyPath) {
    Write-Host "❌ SSH 키 파일을 찾을 수 없습니다!" -ForegroundColor Red
    Write-Host ""
    Write-Host "다음 중 하나를 수행하세요:" -ForegroundColor Yellow
    Write-Host "1. AWS Lightsail에서 SSH 키를 다운로드하세요" -ForegroundColor White
    Write-Host "2. 키 파일 경로를 직접 입력하세요" -ForegroundColor White
    Write-Host ""
    $keyPath = Read-Host "SSH 키 파일 전체 경로를 입력하세요 (또는 Enter로 취소)"
    
    if (-not $keyPath -or -not (Test-Path $keyPath)) {
        Write-Host "❌ 취소되었습니다." -ForegroundColor Red
        exit 1
    }
}

Write-Host "✅ SSH 키 파일: $keyPath" -ForegroundColor Green
Write-Host ""

# 2. 전송할 파일 확인
Write-Host "[2/4] 전송할 파일 확인 중..." -ForegroundColor Yellow

$filesToUpload = @(
    "server.py",
    "dashboard_modern.html",
    "fetch_erp_stock.py"
)

$optionalFiles = @(
    "stock_data.json",
    "stock_data.csv"
)

$missingFiles = @()
foreach ($file in $filesToUpload) {
    if (-not (Test-Path $file)) {
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host "❌ 다음 파일이 없습니다:" -ForegroundColor Red
    foreach ($file in $missingFiles) {
        Write-Host "   - $file" -ForegroundColor Red
    }
    exit 1
}

Write-Host "✅ 필수 파일 확인 완료" -ForegroundColor Green
Write-Host ""

# 3. 서버 정보
$serverIP = "13.125.123.62"
$serverUser = "ubuntu"
$server = "$serverUser@$serverIP"

Write-Host "[3/4] 서버 정보:" -ForegroundColor Yellow
Write-Host "   서버: $server" -ForegroundColor White
Write-Host ""

# 4. 파일 전송
Write-Host "[4/4] 파일 전송 중..." -ForegroundColor Yellow
Write-Host ""

$successCount = 0
$failCount = 0

foreach ($file in $filesToUpload) {
    Write-Host "📤 $file 전송 중..." -ForegroundColor Cyan
    try {
        $result = scp -i $keyPath $file $server:~/
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ 성공" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "   ❌ 실패 (코드: $LASTEXITCODE)" -ForegroundColor Red
            $failCount++
        }
    } catch {
        Write-Host "   ❌ 오류: $_" -ForegroundColor Red
        $failCount++
    }
}

# 선택 파일 전송
foreach ($file in $optionalFiles) {
    if (Test-Path $file) {
        Write-Host "📤 $file 전송 중..." -ForegroundColor Cyan
        try {
            $result = scp -i $keyPath $file $server:~/ 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "   ✅ 성공" -ForegroundColor Green
                $successCount++
            } else {
                Write-Host "   ⚠️  실패 (선택 파일이므로 무시)" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "   ⚠️  오류 (선택 파일이므로 무시)" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
if ($failCount -eq 0) {
    Write-Host "✅ 파일 전송 완료! ($successCount 개 파일)" -ForegroundColor Green
} else {
    Write-Host "⚠️  전송 완료 (성공: $successCount, 실패: $failCount)" -ForegroundColor Yellow
}
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "다음 단계:" -ForegroundColor Yellow
Write-Host "1. 서버에 접속:" -ForegroundColor White
Write-Host "   ssh -i `"$keyPath`" $server" -ForegroundColor Gray
Write-Host ""
Write-Host "2. 서버에서 실행:" -ForegroundColor White
Write-Host "   sudo apt-get update" -ForegroundColor Gray
Write-Host "   sudo apt-get install -y python3 python3-pip" -ForegroundColor Gray
Write-Host "   pip3 install requests" -ForegroundColor Gray
Write-Host "   chmod +x server.py fetch_erp_stock.py" -ForegroundColor Gray
Write-Host "   python3 server.py" -ForegroundColor Gray
Write-Host ""

