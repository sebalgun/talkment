#!/bin/bash
set -e

echo "=== Talkment 시작 ==="
echo "[1/3] 프론트엔드: dist 사용"
echo "[2/3] 백엔드: node_modules 사용"
echo "[3/3] 서버 시작..."
cd backend
exec node src/index.js
