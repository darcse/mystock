# My Stock
## 스택
- Next.js 15 App Router + TailwindCSS v4
- Supabase (Auth + PostgreSQL + RLS)
- Anthropic Claude API
- yahoo-finance2 (시세)
- Google News RSS (뉴스)
- OpenDART API (공시)
- Vercel 배포

## 코딩 규칙
- TypeScript 사용, any 타입 지양
- 컴포넌트는 named export
- 서버 컴포넌트 우선, 필요할 때만 'use client'
- 환경변수는 .env.local, 절대 하드코딩 금지
- 지정된 파일 외 범위 벗어나지 말 것

## Git 규칙
- main 브랜치 직접 push
- PR 없음
- 커밋 메시지: 한국어 Conventional Commits

## 디자인 시스템
- 루트의 DESIGN.md 파일을 디자인 레퍼런스로 사용
- 모든 UI 작업 전 이 파일을 반드시 참고할 것
- 컬러, 타이포그래피, 컴포넌트 스타일은 DESIGN.md 기준을 따름
- Linear 커스텀 폰트 대신 Pretendard 사용 (Display/Text 모두)
- Mono 폰트는 JetBrains Mono 사용
- semantic-danger 추가: #e5484d (하락/손실/경고 표시용)
- semantic-success: #27a644 (상승/수익 표시용)
