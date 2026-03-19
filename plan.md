# ieumnarae-threadbot Plan

## 목표
현재 운영형(`vercel/`) 기준으로, 게시 규칙과 생성 규칙을 코드/문서/UI 모두 같은 기준으로 유지한다.

## 최종 운영 규칙
1. 평일만 게시한다.
2. 토요일, 일요일은 게시하지 않는다.
3. 초안은 다음 평일 게시일 기준으로 생성한다.
4. 주제는 달력 요일 고정이 아니라 평일 게시 순서 기준 7개 순환이다.
5. 첫 게시와 연속 게시 각각 최소 150자 이상이어야 한다.
6. 링크, 댓글 유도, 자기홍보 문구는 금지한다.
7. `1/5`, `2/5` 같은 숫자 표기는 금지한다.
8. `다음 슬라이드` 같은 문구는 금지한다.
9. 마지막 문장은 `❤️`로 끝낸다.
10. 전날 글과 훅/전개/사례가 겹치지 않게 쓴다.

## 7개 주제 순환
1. 면접 예상질문 관련
2. 대한항공 지원 비전공자 조언
3. 승무원 준비 꿀팁
4. 면접 관련
5. 전직 승무원이 본 객실승무원 필요 역량
6. 영상면접 꿀팁
7. 대면 면접 관련

## 구현 포인트
### 1. 날짜와 게시일
- `vercel/lib/kst.ts`
- `scheduledPostingDate()`로 현재 시점 기준 다음 게시일 계산
- 주말 요청은 `morning`, `post` cron에서 스킵

### 2. 주제 선택
- `vercel/lib/postingTheme.ts`
- 기준일 `POSTING_THEME_ROTATION_START_DATE`에서 시작해 평일 게시 슬롯 수만큼 이동
- 달력 요일이 아니라 평일 게시 횟수 기준으로 순환

### 3. 생성 규칙 강제
- `vercel/lib/contentGuide.ts`
- `vercel/lib/generate.ts`
- `vercel/lib/draftComposer.ts`
- 프롬프트와 후처리 모두에서 금지 표현 제거
- 짧은 출력은 재시도
- 숫자 표기와 `다음 슬라이드`는 생성 후에도 다시 제거
- 초안 생성과 수동 재작성이 같은 규칙 엔진을 사용해야 한다

### 4. 게시 안전장치
- `vercel/app/api/cron/post/route.ts`
- 오늘 날짜 초안만 게시
- 이전 날짜 초안 fallback 금지
- 게시 전 `publishing` 잠금
- reply chain 실패 시 detached standalone fallback 금지

### 5. 재작성 경로 정합성
- `vercel/app/api/cron/regenerate-today/route.ts`
- `vercel/app/api/drafts/[draftDate]/route.ts`
- 수동 재작성도 같은 주제 순환 규칙과 금지 규칙을 따라야 한다

### 6. 설정 저장 분리
- `vercel/lib/appSettings.ts`
- `vercel/lib/writeMode.ts`
- `vercel/lib/threadsToken.ts`
- `sources` 특수 row 대신 `app_settings`를 우선 사용한다

### 7. 대시보드 반영
- `vercel/app/page.tsx`
- `vercel/components/TomorrowDraftPanel.tsx`
- `vercel/components/RegenerateDraftButton.tsx`
- `요일별 고정 카테고리`가 아니라 `평일 게시 시 7개 주제 순환`으로 표시
- 다음 게시일 주제와 전체 순환표를 보여준다

## Todo List
### Done
- [x] PT-54/PT-55 이어쓰기형 Threads 생성/저장/게시 파이프라인 구축
- [x] PT-56 전체 코드 검토 및 운영 규칙 정렬 리팩토링
- [x] PT-57 reply 게시 재시도 및 부분 성공 상태 저장 보강
- [x] KST 날짜 계산 공통화 및 `scheduledPostingDate()` 도입
- [x] 이전 날짜 초안 fallback 제거
- [x] `publishing` 잠금 도입과 하루 1회 게시 가드 정착
- [x] detached standalone fallback 제거
- [x] 생성/재작성 공통 규칙 엔진 도입
- [x] `app_settings` 우선화 및 대시보드 상태 반영
- [x] `morning` 백업 cron이 기존 초안을 덮어쓰지 않도록 수정
- [x] 브라우저 Supabase 공개 설정 로딩 재시도 가능화
- [x] 공식 채용 수집의 sitemap 실패 시 HTML fallback 확장
- [x] 대시보드 진행중 공식 채용 카드의 45일 lookback + 마감일 파싱 보강
- [x] 문서 3종과 대시보드 문구 최신 운영 규칙 기준으로 정렬

### Done
- [x] PT-60/PT-61: cron 인증을 `CRON_SECRET` 중심 경로 기준으로 추가 강화
  - 결과: 일반 수동/보조 경로는 `Authorization: Bearer CRON_SECRET` 전용으로 분리했고, 스케줄 cron만 강화된 Vercel 헤더 조합 또는 bearer secret으로 통과하게 정리했다.
- [x] PT-60/PT-62: 공식 채용 사이트별 fallback 파서 추가
  - 결과: `recruit.koreanair.com` -> `koreanair.recruiter.co.kr/career/apply`, `flyasiana.com` -> `flyasiana.recruiter.co.kr/career/recruitment`, `recruiter.co.kr` 루트 -> 기본 `/career/*` 경로 후보를 확장했다.
  - 결과: sitemap 실패 시에도 HTML title/meta/canonical/anchor 파싱으로 공식 채용 신호를 더 안정적으로 수집한다.

## Jira 상태 정리
- 확인한 threadbot 관련 visible 이슈
  - PT-54: Done
  - PT-55: Done
  - PT-56: Done
  - PT-57: Done
  - PT-60: Done
  - PT-61: Done
  - PT-62: Done
- PT-58 `[INFRA] Threads 인사이트 마이그레이션 적용 및 live sync 검증`은 현재 저장소 작업 범위와 무관하며 To Do 상태가 맞다.
- 일반 Atlassian search 앱은 이 인스턴스에 설치되지 않아 전역 검색은 403이 발생했다. Jira 상태 확인은 `project = PT` JQL 기준으로 수행했다.
- 현재 시점 기준 visible 이슈와 실제 작업 상태는 일치한다.
- PT-60/PT-61/PT-62는 이번 작업 완료 후 Done으로 정리했다.

## UI 승인 대기
- 없음

## Iteration
### 2026-03-15 인계 메모
- 완료한 작업 요약
  - 배포본과 저장소를 다시 맞춰 점검했다.
  - `app_settings` 적용 상태와 대시보드 표시를 확인했다.
  - `2026-03-16` 초안을 `crawl` 기반으로 재생성하고, 반복 fallback 글이 아니라는 점을 확인했다.
  - cron 인증을 느슨한 UA 기반 허용에서 강화된 헤더 조합 허용으로 바꿨다.
  - 공식 채용 수집은 sitemap 실패 시 HTML fallback으로 공고성 링크/메인 페이지를 다시 잡도록 보강했다.
  - `morning` 백업 cron의 초안 덮어쓰기, Supabase 브라우저 공개 설정 재시도, 대시보드 공식 채용 카드 판정도 함께 정리했다.
- 미완료 작업 및 현재 상태
  - cron 인증은 더 강화할 수 있다. 현재도 운영 가능하지만, 장기적으로는 `CRON_SECRET` 중심 단일 경로 또는 내부 전용 경로로 더 좁히는 편이 좋다.
  - 공식 채용 수집은 HTML fallback까지 들어갔지만 아직 휴리스틱이다. 사이트별 파서를 붙이면 정확도가 더 올라간다.
- 작업 중 발견한 이슈/주의사항
  - `https://recruit.koreanair.com`은 collector 환경에서 anti-bot 페이지를 반환했다.
  - `https://flyasiana.com/...`는 HTTP/2 internal error, `https://recruit.jejuair.net`은 SSL hostname mismatch를 보였다.
  - 일부 `recruiter.co.kr`/기타 공식 도메인은 DNS 실패가 간헐적으로 있었다. 이 때문에 공식 채용 수집은 네트워크/사이트 상태에 민감하다.
  - 공식 채용 카드와 초안 품질은 좋아졌지만, “절대 정확한 진행중 공고 판정”은 아직 아니다.
- 다음 에이전트 작업 순서
  1. 배포본에서 다음 평일 실제 cron 결과를 한 번 더 관찰해 중복 게시/반복 글 재발 여부 확인
  2. anti-bot 또는 브라우저 렌더링이 강한 공식 채용 사이트용 개별 파서/수동 확인 정책 검토
- 막히거나 판단이 필요한 부분
  - anti-bot 또는 브라우저 기반 렌더링이 필요한 공식 채용 페이지는 서버 fetch만으로는 한계가 있다. 필요하면 Playwright 계열 수집 또는 수동 확인 정책이 필요할 수 있다.
- UI 승인 대기 중인 이슈 목록
  - 없음

## 텔레그램 미리보기 알림
- [x] 07:00 KST 텔레그램 미리보기 cron 추가
- [x] `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` 기반 Bot API 전송 모듈 추가
- [x] 전송 성공/실패를 `cron_runs`에 `telegram-preview`로 기록

## 남은 운영 체크
- 실제 운영 env에서 `POSTING_THEME_ROTATION_START_DATE`를 변경할 필요가 있는지 확인
- 배포 후 대시보드에서 다음 게시일 주제가 기대 순서대로 나오는지 확인
- cron 실행 로그에서 `morning/post`가 주말에 스킵되는지 확인
- 09:00 성공일에 09:30 cron이 `already_publishing` 또는 `already_posted_today`로 스킵되는지 확인


### 2026-03-16 작업 메모
- 완료한 작업 요약
  - PT-61: cron 인증 경계를 scheduled cron과 secret-only 수동 경로로 분리했다.
  - PT-62: 공식 항공사 채용 수집에 후보 URL 확장과 canonical/meta/title/anchor 기반 HTML fallback 파서를 추가했다.
  - `regenerate-today`는 `Authorization: Bearer CRON_SECRET` 전용으로 잠갔다.
- 작업 중 확인한 사실
  - `recruit.koreanair.com`은 anti-bot 응답이 지속되어 `koreanair.recruiter.co.kr/career/apply` fallback이 중요하다.
  - `flyasiana.com`은 환경에 따라 불안정해 `flyasiana.recruiter.co.kr/career/recruitment` fallback 유지가 필요하다.
  - `recruiter.co.kr` 루트 소스는 `/career/apply`, `/career/recruitment`, `/career/recruit` 후보를 탐색해야 신호 누락이 줄어든다.
- 다음 순서
  1. 다음 평일 cron 실게시 관찰
  2. anti-bot/브라우저 렌더링 강한 공식 채용 사이트 정밀화 검토
