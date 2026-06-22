@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"

echo ========================================
echo   음성 기반 재고관리 — 개발 모드
echo ========================================
echo   API: http://localhost:3001
echo   앱:  http://localhost:5173
echo.

where npm >nul 2>&1
if errorlevel 1 (
  echo [오류] Node.js가 설치되어 있지 않습니다.
  pause
  exit /b 1
)

if not exist "node_modules" call npm run setup

call npm run dev

pause
