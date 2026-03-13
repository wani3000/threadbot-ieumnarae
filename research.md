# ieumnarae-threadbot Research

## 1. 현재 운영 기준
이 프로젝트는 항공사 채용/승무원 준비 신호를 수집하고, 이를 바탕으로 Threads 게시글 초안을 생성한 뒤 예약 게시하는 시스템이다.

현재 운영 기준은 루트 Python MVP가 아니라 `vercel/`이다.

- Python MVP: 로컬 파일 중심 구조
- `vercel/`: 실운영형 구조

## 2. 레이어 구조
### 입력 레이어
- 외부 URL 수집
- Threads 키워드 검색
- 관리자 직접 업로드(`manual-upload`)

### 수집 레이어
- `vercel/lib/collect.ts`
- 공식 채용 페이지, 블로그, SNS, Threads 키워드 결과를 수집

### 생성 레이어
- `vercel/lib/generate.ts`
- `vercel/lib/contentGuide.ts`
- `vercel/lib/postingTheme.ts`

### 검수/운영 레이어
- `vercel/app/page.tsx`
- `vercel/app/edit/page.tsx`
- `vercel/app/upload/page.tsx`

### 게시 레이어
- `vercel/lib/threads.ts`
- `vercel/app/api/cron/post/route.ts`

### 관측 레이어
- `cron_runs`
- `posts`
- Threads 토큰 상태 카드

## 3. 데이터 구조
### `sources`
- 수집 URL 저장
- 레거시 호환을 위해 일부 설정값 특수 row가 남아 있을 수 있다

### `app_settings`
- 운영 설정 저장
- 쓰기 모드(`crawl`, `direct`)
- Threads publish token / expires_at
- 현재 코드는 `app_settings`를 우선 사용하고, 없으면 `sources` 특수 row를 fallback으로 읽는다

### `signals`
- 크롤링 결과 저장
- 직접 업로드한 원문도 `manual-upload`로 같이 저장

### `drafts`
- 게시 전 초안
- `draft_date`, `post`, `status`, `approved`, `source_json`

### `posts`
- 실제 게시 결과
- `publish_result`로 성공/실패 응답 보관

### `cron_runs`
- `morning`, `post`, `token-refresh` 실행 로그

## 4. 주제 선택 로직
### 현재 규칙
- 토요일, 일요일은 게시하지 않는다
- 게시 주제는 요일 고정이 아니다
- 평일 게시 슬롯이 한 번 진행될 때마다 다음 주제로 이동한다

### 순환 주제 목록
1. 면접 예상질문 관련
2. 대한항공 지원 비전공자 조언
3. 승무원 준비 꿀팁
4. 면접 관련
5. 전직 승무원이 본 객실승무원 필요 역량
6. 영상면접 꿀팁
7. 대면 면접 관련

### 구현 위치
- `vercel/lib/postingTheme.ts`

### 구현 방식
- 기준일: `POSTING_THEME_ROTATION_START_DATE` (기본 `2026-03-09`)
- 기준일과 목표 게시일 사이의 평일 슬롯 수를 계산한다
- 그 슬롯 수를 7개 주제 배열 길이로 modulo 연산해 현재 주제를 결정한다
- 주말 날짜는 유효한 게시일로 보지 않는다

이 구조의 장점은 공휴일, 주말, 게시 간격 변화가 있어도 주제 순서를 안정적으로 유지할 수 있다는 점이다.

## 5. 생성 규칙
### 핵심 규칙
- 한 문장 한 줄
- 짧고 읽히는 문장
- 너무 짧은 단문만 이어 쓰지 않기
- 쉬운 평서문 사용
- 실시간성 날짜 표현 금지
- 링크 금지
- 댓글 유도 금지
- 자기홍보 문구 금지
- 숫자 표기(`1/5`, `2/5`) 금지
- `다음 슬라이드` 금지
- 마지막 문장은 `❤️`
- 타 항공사/외항사 사례는 지인 사례 문맥으로 설명

### 구현 위치
- `vercel/lib/contentGuide.ts`
- `vercel/lib/generate.ts`

### 보정 방식
- 프롬프트에서 금지 규칙을 먼저 준다
- 생성 후 `sanitizeGeneratedPost()`로 다시 정제한다
- 게시 직전 `threads.ts`에서 숫자 표기와 금지 문구를 다시 제거한다
- 출력이 짧거나 문단별 길이가 부족하면 재시도한다

## 6. 게시 로직
### 구현 위치
- `vercel/lib/threads.ts`
- `vercel/app/api/cron/post/route.ts`

### 방식
- 문단 단위로 게시를 분리한다
- 첫 게시와 연속 게시 각각 최소 150자 이상이 되도록 병합한다
- 여러 문단이면 reply chain으로 발행한다
- 중간 reply 실패 시 독립 게시로 풀지 않고 실패로 종료한다

### 중복 게시 방지
- `draft_date === 오늘(KST)` 초안만 게시한다
- 오늘 초안이 없으면 이전 날짜 초안으로 fallback하지 않는다
- 게시 직전 초안을 `publishing` 상태로 잠근다
- `posts` 테이블에서 KST 하루 범위 내 성공 게시 여부 확인
- 이미 성공 게시가 있으면 skip
- `force=1`일 때만 재게시 허용

## 7. 초안 생성 로직
### 구현 위치
- `vercel/app/api/cron/morning/route.ts`

### 흐름
1. 주말이면 스킵
2. 기본 소스 동기화
3. 쓰기 모드 확인
4. `crawl`이면 외부 수집 + Threads 키워드 수집
5. `direct`이면 최근 `manual-upload`를 사용
6. dedupe + priority 적용
7. 다음 게시일 계산
8. `scheduledPostingDate()` 기준으로 현재 시점의 게시 대상 날짜를 결정
9. 다음 게시일 주제 순환 규칙을 프롬프트에 반영
10. 직전 게시글과 주제/훅/사례가 겹치지 않게 추가 프롬프트 적용
11. 초안 저장 + 이메일 발송 + cron 로그 기록
12. 생성/재작성 모두 `draftComposer.ts` 공통 규칙 엔진을 사용한다

## 8. 재작성 경로
### 수동 재작성 cron
- `vercel/app/api/cron/regenerate-today/route.ts`
- 오늘 초안만 다시 생성
- 같은 주제 순환 규칙을 적용

### 관리자 초안 재작성
- `vercel/app/api/drafts/[draftDate]/route.ts`
- 편집 화면이나 대시보드 버튼에서 호출
- `crawl` / `direct` 모드에 따라 입력 source를 다르게 선택
- 기존 글과 동일하면 훅을 바꾸고, 주제 불일치면 재시도

## 9. 대시보드 구성
### 메인
- 마지막 cron 실행 결과
- Threads 토큰 상태
- 관리자 로그인 상태
- 작성 방식 선택
- 평일 게시 시 7개 주제 순환 표
- 최근 실제 게시글
- 추천 글 샘플
- 키워드별 수집 건수/상위 글
- 진행 중 공식 캐빈 채용
- 수집 URL 관리
- 다음 게시일 초안 미리보기
- 다음 게시일 글 작성을 위한 수집 요약
- 전체 글 규칙

### 편집
- `vercel/app/edit/page.tsx`
- 초안 조회/수정/승인

### 직접 입력
- `vercel/app/upload/page.tsx`
- 긴 텍스트를 저장해 `direct` 모드 입력으로 사용

## 10. 관찰된 설계 특징
1. Python MVP와 운영형 Next.js가 병존한다.
2. `app_settings` 도입 전 흔적 때문에 `sources` 특수 row fallback이 남아 있다.
3. `signals`는 크롤링 결과와 직접 업로드를 함께 담는 다목적 저장소다.
4. 생성 규칙은 프롬프트뿐 아니라 후처리와 게시 직전 단계에서 중복으로 강제된다.
5. 현재 운영 핵심은 `postingTheme.ts`, `draftComposer.ts`, `threads.ts`, `cron` 라우트다.

## 11. 현재 결론
- 이 시스템의 실운영 기준은 `vercel/`이다.
- 주말 게시 없음, 평일 게시만 허용된다.
- 주제는 달력 요일이 아니라 평일 게시 순서 기준 7개 순환이다.
- 글 생성 규칙은 코드상 다중 단계로 강제된다.
- 앞으로 변경 시 가장 먼저 맞춰야 할 파일은 아래다.
  - `vercel/lib/postingTheme.ts`
  - `vercel/lib/contentGuide.ts`
  - `vercel/lib/generate.ts`
  - `vercel/lib/threads.ts`
  - `vercel/app/api/cron/morning/route.ts`
  - `vercel/app/api/drafts/[draftDate]/route.ts`
  - `vercel/app/page.tsx`
