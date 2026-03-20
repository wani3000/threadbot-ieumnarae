# threadbot-ieumnarae Vercel Migration (Vercel + Resend + Supabase)

## 1) Environment Variables
Set these in Vercel Project Settings > Environment Variables.

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional, default `gpt-4o-mini`)
- `THREADS_PUBLISH_TOKEN`
- `THREADS_DISCOVERY_TOKEN` (optional, defaults to `THREADS_PUBLISH_TOKEN`)
- `THREADS_GRAPH_BASE` (optional, default `https://graph.threads.net`)
- `THREADS_SEARCH_QUERIES` (optional, comma separated keywords)
- `THREADS_SEARCH_LIMIT` (optional, default `25`)
- `THREADS_SEARCH_PAGES` (optional, default `1`, max `5`)
- `THREADS_SEARCH_MIN_SCORE` (optional, default `4`)
- `THREADS_SEARCH_MAX_QUERIES` (optional, default `12`)
- `THREADS_FETCH_TIMEOUT_MS` (optional, default `7000`)
- `SOURCE_FETCH_TIMEOUT_MS` (optional, default `8000`)
- `OFFICIAL_SOURCE_WEEKDAY` (optional, default `1` = Monday KST, official airline sources collected weekly only)
- `RESEND_API_KEY`
- `TELEGRAM_BOT_TOKEN` (Telegram bot token for preview alerts)
- `TELEGRAM_CHAT_ID` (Telegram chat id, e.g. `387557093`)
- `EMAIL_FROM` (Resend verified sender, e.g. `threadbot-ieumnarae <noreply@yourdomain.com>`)
- `EMAIL_TO` (`oxaz1234@gmail.com`)
- `ADMIN_EMAILS` (optional, admin 허용 이메일 CSV. 미입력 시 `EMAIL_TO` 사용)
- `NEXT_PUBLIC_SUPABASE_URL` (`SUPABASE_URL`와 동일 값)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Supabase publishable key)
- `APP_BASE_URL` (e.g. `https://threadbot.yourdomain.com`)
- `CRON_SECRET` (optional but recommended)
- `STYLE_SAMPLE` (optional long style prompt text)

## 2) Supabase Setup
1. Create a Supabase project.
2. Open SQL Editor and run [`supabase/schema.sql`](./supabase/schema.sql).
3. Existing projects should ensure `public.app_settings` exists so write mode and Threads token metadata are stored outside `sources`.

## 3) Deploy on Vercel
1. Import this repo to Vercel.
2. Set **Root Directory** to `vercel`.
3. Deploy.

## 4) Cron schedules (already in `vercel.json`, UTC)
- `59 14 * * 1-5` -> KST 23:59 collect/write next business-day draft + email
- `5 15 * * 1-5` -> KST 00:05 collect/write next business-day draft backup run
- `0 0 * * 1-5` -> KST 09:00 auto post
- `30 0 * * 1-5` -> KST 09:30 auto post retry run (same-day lock aware)
- `0 22 * * 1-5` -> KST 07:00 Telegram preview for the same-day 09:00 draft
- `10 15 * * *` -> KST 00:10 Threads long-lived token refresh

Collection policy:
- Influencer/instructor sources: daily
- Official airline recruitment sources: weekly (KST weekday controlled by `OFFICIAL_SOURCE_WEEKDAY`)
- Writing mode:
  - `crawl`: generate from crawling signals
  - `direct`: generate from manually uploaded texts

## 5) Endpoints
- `GET /api/cron/morning` cron only
- `GET /api/cron/post` cron only
- `GET /api/cron/regenerate-today` cron/admin utility only
- `GET/PATCH /api/drafts/:date` draft edit (admin session required)
- `GET/POST /api/collection/sources` source list/add
- `POST /api/collection/sources/sync` sync built-in default sources (admin session required)
- `GET/POST /api/write-mode` get/set writing mode
- `GET/POST /api/manual/ingest` list/save manually pasted text corpus
- `GET/POST /api/admin/session` Google 세션 검증

## Threads publish note
- This code uses official 2-step publish flow:
  1. `POST /me/threads` with `media_type=TEXT,text=...`
  2. `POST /me/threads_publish` with `creation_id`
- Keyword discovery uses official endpoint:
  - `GET /keyword_search` with `q`, `search_type`, `search_mode`, `since`, `until`, `limit`, `fields`
  - Requires proper Threads permissions (e.g. keyword search scope approved in Meta App Review).
- Token operations:
  - `GET /api/cron/token-refresh` refreshes a long-lived Threads token (`th_refresh_token`) and stores latest token/expiry in Supabase.
- `GET /api/cron/telegram-preview` sends the 09:00 scheduled draft preview to Telegram at 07:00 KST.
  - Post cron (`/api/cron/post`) also auto-attempts one refresh/retry when token error(code 190) is detected.
- Posting safety:
  - `/api/cron/post` publishes only the draft whose `draft_date` equals today in KST.
  - It sets the draft status to `publishing` before calling Threads API, so the 09:30 retry does not post twice.
  - Reply-chain failure no longer falls back to detached standalone posts.
- Cron run logs:
  - Cron endpoints write latest result to `public.cron_runs`.
  - Dashboard top card shows last success/failure reason per cron.

## 6) Email edit flow
Morning email includes tomorrow 09:00 scheduled draft link:
- `${APP_BASE_URL}/edit?date=YYYY-MM-DD`

Edit/대시보드 페이지에서 Google 로그인 후 수정/승인하면 next-day 09:00 자동게시에 반영됩니다.
