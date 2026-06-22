# 음성 기반 자산·소모품 재고관리 시스템

구글 스프레드시트를 DB로 활용하는 음성 기반 재고관리 웹/앱 프로토타입입니다.

## 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐ │
│  │ 음성입력  │  │ 출고폼   │  │ 서명패드  │  │ 반납/현황  │ │
│  │ Web STT  │  │ 자동입력  │  │ Canvas   │  │ 실시간조회 │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └─────┬──────┘ │
│       └──────────────┴─────────────┴──────────────┘         │
│                          │ REST API (no-cache fetch)         │
└──────────────────────────┼──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 Backend (Node.js + Express)                  │
│  ┌────────────┐ ┌────────────┐ ┌───────────┐ ┌────────────┐ │
│  │ voiceParser│ │ checkout   │ │ signature │ │ return     │ │
│  │ GPT/mock   │ │ Service    │ │ Drive+IMG │ │ Reminder   │ │
│  └─────┬──────┘ └─────┬──────┘ └─────┬─────┘ └─────┬──────┘ │
│        └──────────────┴──────────────┴──────────────┘       │
│                          │ googleapis                         │
└──────────────────────────┼──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Google Sheets (4 tabs) + Google Drive           │
│  [명단] [시리얼 물품 관리] [일반 물품 관리] [일반 입출고 내역]   │
└─────────────────────────────────────────────────────────────┘
```

### 기술 스택 선정 이유

| 계층 | 선택 | 이유 |
|------|------|------|
| Frontend | **React + Vite** | 모바일/웹 반응형, 터치 서명 패드, Web Speech API |
| Backend | **Node.js + Express** | `googleapis` 공식 SDK, Nodemailer, node-cron 통합 용이 |
| DB | **Google Sheets API** | PRD 요구사항, 비개발자도 시트에서 직접 수정 가능 |
| STT | **Web Speech API + GPT** | 브라우저 내장 STT(무료) + GPT 구조화 파싱 |
| Storage | **Google Drive** | 서명 PNG 저장 + `=IMAGE()` 시트 삽입 |

## 프로젝트 구조

```
음성기반 재고관리/
├── backend/
│   ├── src/
│   │   ├── index.js              # Express 서버 + cron 스케줄러
│   │   ├── config/env.js
│   │   ├── services/             # Sheets, Drive, Voice, Checkout, Return, Email
│   │   ├── routes/               # REST API
│   │   └── jobs/returnReminder.js
│   ├── credentials/              # 서비스 계정 JSON (gitignore)
│   └── .env.example
├── frontend/
│   └── src/
│       ├── App.jsx               # 탭: 출고 / 반납 / 현황
│       ├── api/client.js
│       └── components/
└── README.md
```

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/employees` | 임직원 명단 |
| GET | `/api/assets` | 시리얼 자산 목록 |
| GET | `/api/consumables/log` | 소모품 입출고 내역 |
| POST | `/api/voice/parse` | 음성 텍스트 → GPT 구조화 + 임직원 매칭 |
| POST | `/api/checkout` | 출고 등록 |
| GET | `/api/returns/search?q=` | 미반납 검색 |
| POST | `/api/returns` | 반납 처리 |
| POST | `/api/signature` | PNG 업로드 + IMAGE() 삽입 |

## 실행 방법

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend (별도 터미널)
cd frontend && npm install && npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## Google Cloud 사전 준비

1. Google Sheets API, Google Drive API 활성화
2. 서비스 계정 JSON → `backend/credentials/service-account.json`
3. 스프레드시트 4탭 생성 후 서비스 계정을 **편집자**로 공유
4. Drive에 서명 저장 폴더 생성 → 폴더 ID를 `.env`에 설정
5. `backend/.env.example`을 `.env`로 복사 후 값 입력

## OpenAI (선택)

`OPENAI_API_KEY` 설정 시 GPT-4o-mini 파싱. 미설정 시 mock 파서 동작.
