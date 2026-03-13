# ThreadBot Plan

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

## 완료 상태
- [x] 평일만 게시 / 주말 스킵
- [x] KST 날짜 계산 공통화
- [x] 하루 1회 게시 가드
- [x] 첫 게시/연속 게시 최소 150자
- [x] 7개 주제 순환 로직 도입
- [x] 생성 가이드 자기모순 제거
- [x] 이전 날짜 초안 fallback 제거
- [x] `publishing` 잠금 도입
- [x] detached standalone fallback 제거
- [x] 설정 저장 `app_settings` 우선화
- [x] 초안 생성/재작성 공통화
- [x] 재작성 API에 동일 규칙 적용
- [x] 대시보드 문구/표 정리
- [x] 문서 3종 최신 규칙 기준 업데이트

## 남은 운영 체크
- Supabase에 `app_settings` 테이블이 없는 기존 프로젝트라면 `schema.sql` 기준으로 추가
- 실제 운영 env에서 `POSTING_THEME_ROTATION_START_DATE`를 변경할 필요가 있는지 확인
- 배포 후 대시보드에서 다음 게시일 주제가 기대 순서대로 나오는지 확인
- cron 실행 로그에서 `morning/post`가 주말에 스킵되는지 확인
- 09:00 성공일에 09:30 cron이 `already_publishing` 또는 `already_posted_today`로 스킵되는지 확인
