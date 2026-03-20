# Ops Access

## Purpose
This file lists the minimum tools and environment variables needed to verify production cron behavior for the Vercel deployment.

## What matters most
To confirm that the 09:30 retry run skips with `already_posted_today`, you need two access paths:

1. Vercel deployment logs
2. Supabase `public.cron_runs`

## Vercel CLI

### Installed locally
The project now has `vercel` installed as a local dev dependency in [`vercel/package.json`](./package.json).

### Common commands
Run from [`vercel/`](.).

```bash
npx vercel login
npx vercel link
npx vercel whoami
npx vercel logs
```

If your team already linked the project before, `npx vercel link` will connect the local folder to the Vercel project.

## Supabase query script

### Script
[`vercel/scripts/query-cron-runs.sh`](./scripts/query-cron-runs.sh)

### Example usage
```bash
cd /Users/chulwan/Documents/GitHub/threadbot-ieumnarae/vercel

SUPABASE_URL="https://your-project.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" \
CRON_NAME="post" \
LIMIT="20" \
./scripts/query-cron-runs.sh
```

### Example: only today's post runs
```bash
cd /Users/chulwan/Documents/GitHub/threadbot-ieumnarae/vercel

SUPABASE_URL="https://your-project.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" \
CRON_NAME="post" \
RUN_AT_GTE="2026-03-09T00:00:00Z" \
./scripts/query-cron-runs.sh
```

## Required env list

### Required to inspect Vercel logs
- Vercel login session via `npx vercel login`

### Required to inspect Supabase cron data
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Sometimes also needed for manual cron replay or endpoint checks
- `CRON_SECRET`
- `APP_BASE_URL`

## Recommended verification flow
1. Run `npx vercel login`
2. Run `npx vercel link`
3. Open deployment logs for the latest production deploy
4. Query `cron_runs` with `CRON_NAME=post`
5. Check that the first run shows publish success and the retry run shows a skip summary

## Expected success signal
For the retry run, the API currently returns:

```json
{
  "ok": true,
  "skipped": true,
  "reason": "already_posted_today",
  "draft_date": "YYYY-MM-DD"
}
```

And `public.cron_runs.summary` should be:

```text
오늘 이미 게시됨(스킵)
```
