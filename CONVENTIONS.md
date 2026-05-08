# CONVENTIONS.md — my-stock

## 프로젝트 개요

개인 주식 투자 리서치 앱. 보유·관심 종목의 시세·뉴스·공시를 수집하고 AI가 매수/매도/관망 의견을 제공한다.

---

## 기술 스택

- Framework: Next.js 15 App Router + TailwindCSS v4
- Database: Supabase (Auth + PostgreSQL + RLS)
- Deployment: Vercel
- AI: Gemini API (google-generative-ai)
- External API: yahoo-finance2 (시세), Google News RSS (뉴스), OpenDART (공시)
- Font: Pretendard

---

## 폴더 구조

my-stock/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   └── (routes)/
│       ├── stocks/page.tsx
│       └── stocks/[ticker]/page.tsx
├── components/
│   ├── ui/
│   └── features/
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   ├── yahoo.ts        — yahoo-finance2 래퍼
│   ├── news.ts         — Google News RSS 래퍼
│   ├── dart.ts         — OpenDART API 래퍼
│   └── utils.ts
├── hooks/
├── types/
│   ├── stock.ts
│   └── supabase.ts
├── feature_list/
│   ├── STOCK.json
│   ├── DASHBOARD.json
│   ├── DETAIL.json
│   ├── AI.json
│   ├── MEMO.json
│   └── BUG.json
├── .env.local
├── CLAUDE.md
├── HARNESS.md
├── CONVENTIONS.md
└── DESIGN.md

---

## DB 테이블

독립 Supabase 프로젝트. prefix 없음.

| 테이블 | 설명 |
|--------|------|
| `stocks` | 보유·관심 종목 목록 |
| `analyses` | AI 분석 결과 캐시 |
| `memos` | 종목별 투자 메모 |

---

## 환경변수

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GEMINI_API_KEY=
DART_API_KEY=

---

## feature_list/ ID 규칙

| prefix | 카테고리 |
|--------|----------|
| `STOCK-` | 종목 관리 (추가/삭제/보유구분) |
| `DASHBOARD-` | 종목 대시보드 (카드 목록) |
| `DETAIL-` | 종목 상세 (시세/차트/뉴스/공시) |
| `AI-` | AI 분석 리포트 |
| `MEMO-` | 투자 메모 |
| `BUG-` | 버그 수정 |

---

## 컴포넌트 패턴

- named export 사용
- 서버 컴포넌트 기본, 인터랙션 필요 시 `use client`
- props 타입은 인터페이스로 별도 정의

---

## AI (Gemini) 규칙

- Gemini API 호출은 반드시 try/catch로 감싼다
- 429 에러 시 `withRetry` 헬퍼로 처리 (retry delay는 에러 메시지에서 파싱)
- Google Search 도구 네이티브 연동 사용 가능 — 뉴스 수집 대체 가능
- AI 분석은 수동 트리거 방식 (자동 호출 금지)
- 분석 결과는 analyses 테이블에 캐시 — 동일 종목 재분석 시 덮어쓰기

---

## 외부 API 규칙

- yahoo-finance2: 일봉 기준 조회, 실시간 시세 사용 안 함
- Google News RSS: 종목명 기반 검색, 최신 5건만 표시
- OpenDART: 종목코드 기반 조회, 최신 5건만 표시
- 모든 외부 API 호출은 서버 사이드 (API Route 또는 Server Component)

---

## 스타일 규칙

- DESIGN.md (Linear 디자인 시스템) 기준 적용
- 폰트: Pretendard (Display/Text), JetBrains Mono (숫자/코드)
- 상승: semantic-success #27a644
- 하락: semantic-danger #e5484d
- 다크모드 차트: SVG + CSS 변수 사용 (Recharts 사용 안 함)
- 커스텀 클래스: `@layer utilities` 필수 (Tailwind v4)