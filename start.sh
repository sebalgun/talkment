#!/bin/bash
set -e

export PATH="$HOME/.nix-profile/bin:$PATH"

echo "=== Talkment 시작 ==="

# 프론트엔드 빌드 (dist 없거나 강제 재빌드 시)
if [ ! -d "frontend/dist" ] || [ "${REBUILD_FRONTEND}" = "true" ]; then
  echo "[1/3] 프론트엔드 빌드 중..."
  cd frontend
  npm install --silent
  npm run build
  cd ..
  echo "[1/3] 프론트엔드 빌드 완료"
else
  echo "[1/3] 프론트엔드 빌드 스킵 (dist 존재)"
fi

# 백엔드 의존성
echo "[2/3] 백엔드 패키지 설치..."
cd backend
npm install --silent
echo "[2/3] 완료"

# 기존 서버 프로세스 정리
pkill -f "node src/index.js" 2>/dev/null || true
sleep 1

# 서버 시작
echo "[3/3] 서버 시작..."
node src/index.js
