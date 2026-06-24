FROM node:20-slim
WORKDIR /app

# 백엔드 의존성만 설치 (devDependencies 제외)
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

# 나머지 파일 복사 (frontend/dist 포함)
COPY . .

EXPOSE 3001
CMD ["bash", "start.sh"]
