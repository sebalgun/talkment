@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"

echo ========================================
echo   음성 기반 재고관리 — 서버 시작
echo ========================================
echo.

where npm >nul 2>&1
if errorlevel 1 (
  echo [오류] Node.js가 설치되어 있지 않습니다.
  echo https://nodejs.org 에서 LTS 버전을 설치해 주세요.
  pause
  exit /b 1
)

if not exist "backend\.env" (
  echo [안내] backend\.env 파일이 없습니다. .env.example을 복사합니다...
  copy "backend\.env.example" "backend\.env" >nul
)

if not exist "node_modules" (
  echo [설치] 최초 실행 — 패키지 설치 중...
  call npm run setup
)

echo [시작] 앱 빌드 후 단일 서버 실행 (포트 3001)
echo        PC: http://localhost:3001
echo        휴대폰: 같은 Wi-Fi에서 아래 IP 주소로 접속
echo.
call npm start

pause
