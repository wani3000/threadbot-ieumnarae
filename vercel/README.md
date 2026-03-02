# ThreadBot Vercel Migration (Vercel + Resend + Supabase)

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
- `EMAIL_FROM` (Resend verified sender, e.g. `ThreadBot <noreply@yourdomain.com>`)
- `EMAIL_TO` (`oxaz1234@gmail.com`)
- `ADMIN_PASSWORD` (dashboard/edit 관리자 로그인 비밀번호)
- `ADMIN_SESSION_SECRET` (세션 서명용 랜덤 긴 문자열)
- `EDIT_TOKEN` (optional, legacy fallback only)
- `APP_BASE_URL` (e.g. `https://threadbot.yourdomain.com`)
- `CRON_SECRET` (optional but recommended)
- `STYLE_SAMPLE` (optional long style prompt text)

## 2) Supabase Setup
1. Create a Supabase project.
2. Open SQL Editor and run [`supabase/schema.sql`](./supabase/schema.sql).

## 3) Deploy on Vercel
1. Import this repo to Vercel.
2. Set **Root Directory** to `vercel`.
3. Deploy.

## 4) Cron schedules (already in `vercel.json`, UTC)
- `59 14 * * *` -> KST 23:59 collect/write tomorrow draft + email
- `0 0 * * *` -> KST 09:00 auto post

Collection policy:
- Influencer/instructor sources: daily
- Official airline recruitment sources: weekly (KST weekday controlled by `OFFICIAL_SOURCE_WEEKDAY`)
- Writing mode:
  - `crawl`: generate from crawling signals
  - `direct`: generate from manually uploaded texts

## 5) Endpoints
- `GET /api/cron/morning` cron only
- `GET /api/cron/post` cron only
- `GET/PATCH /api/drafts/:date` draft edit (admin session required)
- `GET/POST /api/collection/sources` source list/add
- `POST /api/collection/sources/sync` sync built-in default sources (admin session required)
- `GET/POST /api/write-mode` get/set writing mode
- `GET/POST /api/manual/ingest` list/save manually pasted text corpus
- `GET/POST/DELETE /api/admin/session` 관리자 로그인/세션

## Threads publish note
- This code uses official 2-step publish flow:
  1. `POST /me/threads` with `media_type=TEXT,text=...`
  2. `POST /me/threads_publish` with `creation_id`
- Keyword discovery uses official endpoint:
  - `GET /keyword_search` with `q`, `search_type`, `search_mode`, `since`, `until`, `limit`, `fields`
  - Requires proper Threads permissions (e.g. keyword search scope approved in Meta App Review).

## 6) Email edit flow
Morning email includes tomorrow 09:00 scheduled draft link:
- `${APP_BASE_URL}/edit?date=YYYY-MM-DD`

Edit 페이지에서 관리자 로그인 후 수정/승인하면 next-day 09:00 자동게시에 반영됩니다.
