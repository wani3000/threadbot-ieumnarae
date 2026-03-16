# ieumnarae-threadbot

## 프로젝트 개요
이 저장소는 항공사 채용 및 승무원 준비 관련 정보를 수집하고, 이를 바탕으로 Threads 초안을 생성한 뒤 예약 게시까지 이어지는 자동화 시스템이다.

코드베이스는 두 축으로 나뉜다.
- 루트 Python 코드: 초기 MVP. 로컬 파일 중심 수집/초안 생성/이메일 발송/Streamlit 검수 UI
- `vercel/`: 현재 운영형 구조. Next.js API, Supabase, Resend, Threads Graph API, Google 로그인 기반 관리자 UI

현재 운영 기준은 `vercel/`이다.

## 에이전트 역할 분담
- 직전 담당 에이전트 완료 범위:
  - PT-54, PT-55, PT-56, PT-57 후속 안정화 점검 및 문서 최신화 완료
  - cron 인증 강화 1차, 공식 채용 수집 fallback 확장, 대시보드 추적/공고 판정 보강 완료
- 현재 담당 에이전트 완료 범위:
  - PT-60, PT-61, PT-62 완료
  - cron 인증 2차 강화, 공식 항공사 채용 사이트별 fallback 파서 추가 완료
- 다음 담당자:
  - 미정

## 작업 진행 상태
### 완료된 대표/하위 태스크
- PT-54 이어쓰기형 Threads 생성 최적화 및 코드 리팩토링: Done
- PT-55 [BE] 이어쓰기형 Threads 생성·저장·게시 파이프라인 구현: Done
- PT-56 [BE] 전면 코드 검토 및 리팩토링: Done
- PT-57 [BE] Threads reply 게시 재시도 및 부분 성공 상태 저장 보강: Done
- PT-60 [INFRA] threadbot 운영 안정화 후속 보강: Done
- PT-61 [INFRA] cron 인증을 CRON_SECRET 중심 경로로 추가 강화: Done
- PT-62 [BE] 공식 항공사 채용 사이트별 파서 추가: Done

### 다음으로 처리할 태스크
- 운영 관찰: 다음 평일 실제 cron 결과에서 중복 게시/반복 글 재발 여부 확인
- 품질 개선(후속): anti-bot/JS 렌더링이 강한 공식 채용 사이트용 개별 파서 정밀화

## 현재 운영 규칙
- 게시와 초안 생성은 평일만 실행한다.
- 토요일, 일요일은 게시하지 않는다.
- 주제는 요일 고정이 아니라 평일 게시 순서 기준으로 7개를 순환한다.
- 다음 게시일 초안은 `scheduledPostingDate()` 기준으로 생성한다.
- 첫 게시와 연속 게시 각각 최소 150자 이상이어야 한다.
- 링크 삽입, 댓글 유도, 자기홍보 문구, 숫자 표기(`1/5`, `2/5`)는 금지한다.
- `다음 슬라이드` 표현은 금지한다.
- 마지막 문장은 반드시 `❤️`로 끝난다.
- 전날 게시글과 훅/전개/사례가 비슷해 보이지 않게 작성한다.

## 평일 게시 순서 기준 7개 주제
1. 면접 예상질문 관련
2. 대한항공 지원 비전공자 조언
3. 승무원 준비 꿀팁
4. 면접 관련
5. 전직 승무원이 본 객실승무원 필요 역량
6. 영상면접 꿀팁
7. 대면 면접 관련

이 순서는 달력 요일에 묶이지 않는다. 평일 게시가 한 번 일어날 때마다 다음 주제로 한 칸 이동한다.

예시:
- 월: 1번
- 화: 2번
- 수: 3번
- 목: 4번
- 금: 5번
- 다음 월: 6번
- 다음 화: 7번
- 다음 수: 다시 1번

기본 순환 시작일은 `2026-03-09`이며, `POSTING_THEME_ROTATION_START_DATE` 환경변수로 변경할 수 있다.

## 핵심 디렉토리
- `src/threadbot/`: Python MVP
- `data/inputs/`: MVP용 수집 소스/수동 입력 데이터
- `data/style/`: 말투 샘플
- `scripts/`: MVP용 자동 실행 스크립트
- `vercel/app/`: Next.js 페이지와 API 라우트
- `vercel/components/`: 관리자 UI 컴포넌트
- `vercel/lib/`: 수집/생성/게시/인증/토큰/주제 순환 로직
- `vercel/supabase/`: 스키마/초기 SQL

## 현재 운영형 구조 요약
- 수집 저장: `sources`, `signals`
- 운영 설정 저장: `app_settings` (기존 `sources` 특수 row는 레거시 fallback)
- 초안 저장: `drafts`
- 게시 결과: `posts`
- cron 로그: `cron_runs`
- 쓰기 모드: `crawl` / `direct`
- 인증: Supabase + Google 로그인
- 이메일: Resend
- 게시: Threads Graph API publish flow

## 핵심 서버 로직 파일
- `vercel/app/api/cron/morning/route.ts`: 수집 + 다음 게시일 초안 생성 + 이메일 발송
- `vercel/app/api/cron/post/route.ts`: 당일 게시 + 중복 게시 가드 + 게시 잠금
- `vercel/app/api/cron/token-refresh/route.ts`: Threads 장기 토큰 갱신
- `vercel/app/api/cron/regenerate-today/route.ts`: 수동 재작성
- `vercel/app/api/drafts/[draftDate]/route.ts`: 초안 조회/수정/AI 재작성
- `vercel/lib/collect.ts`: 수집 로직
- `vercel/lib/generate.ts`: OpenAI 기반 초안 생성/정제
- `vercel/lib/draftComposer.ts`: 초안 생성/재작성 공통 규칙 엔진
- `vercel/lib/draftSignals.ts`: `crawl`/`direct` 모드별 입력 signal 로딩
- `vercel/lib/threads.ts`: 연속 게시 분할 및 publish flow
- `vercel/lib/postingTheme.ts`: 7개 주제 순환 규칙
- `vercel/lib/kst.ts`: KST 날짜 유틸

## 운영 안전장치
- `/api/cron/post`는 `draft_date === 오늘(KST)` 초안만 게시한다.
- 오늘 초안이 없다고 어제 초안으로 fallback해서 게시하지 않는다.
- 게시 전에 초안을 `publishing` 상태로 잠근다.
- 09:30 재시도 cron은 `publishing`이 오래 남은 경우에만 다시 잡을 수 있다.
- reply chain 중간 실패 시 나머지 문단을 독립 게시로 풀지 않고 실패로 종료한다.
- `morning` 백업 cron은 동일 게시일 초안이 이미 있으면 기본적으로 덮어쓰지 않는다.

## UI 승인 대기 목록
- 없음

## 🔄 인계 요약 (다음 에이전트 필독)
- 마지막 완료 작업: [PT-60/PT-62] cron 인증 2차 강화와 공식 항공사 채용 사이트별 fallback 파서 추가
- 다음 작업: 운영 관찰 - 다음 평일 cron 실게시 결과에서 중복 게시/반복 글 재발 여부 확인
- 주의사항: 대한항공 공식 채용 페이지는 anti-bot 응답이 확인됐고, 아시아나/제주항공 일부 공식 URL은 환경에 따라 HTTP/SSL/DNS 오류가 발생한다. 공식 채용 수집은 사이트맵 실패 시 HTML fallback과 recruiter.co.kr 경로 보강까지 들어갔지만 여전히 휴리스틱 기반이다.
- UI 승인 대기: 없음
- 참고: `plan.md` Iteration 섹션에 상세 인계 메모 있음

## 참고 문서
- `plan.md`: 현재 운영 규칙 변경과 구현 범위 정리
- `research.md`: 현재 코드베이스 구조/데이터 흐름/주요 API 분석
