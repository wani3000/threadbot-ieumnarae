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
- `RESEND_API_KEY`
- `EMAIL_FROM` (Resend verified sender, e.g. `ThreadBot <noreply@yourdomain.com>`)
- `EMAIL_TO` (`oxaz1234@gmail.com`)
- `EDIT_TOKEN` (random long string)
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
- `0 22 * * *` -> KST 07:00 collect/write tomorrow draft + email
- `0 0 * * *` -> KST 09:00 auto post

## 5) Endpoints
- `GET /api/cron/morning` cron only
- `GET /api/cron/post` cron only
- `GET/PATCH /api/drafts/:date?token=...` draft edit
- `GET/POST /api/collection/sources` source list/add

## Threads publish note
- This code uses official 2-step publish flow:
  1. `POST /me/threads` with `media_type=TEXT,text=...`
  2. `POST /me/threads_publish` with `creation_id`
- Keyword discovery uses official endpoint:
  - `GET /keyword_search` with `q`, `search_type`, `search_mode`, `since`, `until`, `limit`, `fields`
  - Requires proper Threads permissions (e.g. keyword search scope approved in Meta App Review).

## 6) Email edit flow
Morning email includes tomorrow 09:00 scheduled draft link:
- `${APP_BASE_URL}/edit?date=YYYY-MM-DD&token=${EDIT_TOKEN}`

Edit and approve there before next-day 09:00 post.
