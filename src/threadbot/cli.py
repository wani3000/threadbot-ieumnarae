from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from .config import load_settings
from .drafts import kst_now, load_today_draft, save_today_draft
from .emailer import send_email
from .models import HiringSignal
from .pipeline import run_weekly_collection
from .publisher import publish_to_threads
from .writer import read_style, save_post, write_post


def weekly_collect() -> None:
    parser = argparse.ArgumentParser(description="Collect weekly hiring signals")
    parser.add_argument("--days", type=int, default=7)
    args = parser.parse_args()

    settings = load_settings()
    json_path, md_path, items = run_weekly_collection(
        sources_file=settings.sources_file,
        manual_file=settings.manual_file,
        output_dir=settings.outputs_dir,
        days=args.days,
    )
    print(f"[weekly_collect] items={len(items)}")
    print(f"[weekly_collect] json={json_path}")
    print(f"[weekly_collect] report={md_path}")


def daily_post() -> None:
    parser = argparse.ArgumentParser(description="Generate and publish daily Threads post")
    parser.add_argument("--signals", type=str, default="", help="Path to signals json. If empty, latest file is used.")
    args = parser.parse_args()

    settings = load_settings()
    signals_path = _resolve_signals_path(args.signals, settings.outputs_dir)
    if not signals_path:
        raise SystemExit("signals JSON 파일이 없습니다. weekly_collect를 먼저 실행하세요.")

    payload = json.loads(signals_path.read_text(encoding="utf-8"))
    items = [HiringSignal.from_dict(x) for x in payload]
    style = read_style(settings.style_file)

    today_draft = load_today_draft(settings.outputs_dir)
    if today_draft and today_draft.get("post"):
        post_text = today_draft["post"]
        print("[daily_post] using today's draft text")
    else:
        post_text = write_post(items=items, style_text=style, api_key=settings.openai_api_key, model=settings.openai_model)

    post_stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    post_path = settings.outputs_dir / f"post_{post_stamp}.json"
    save_post(post_path, post_text, signals_path)

    log_path = publish_to_threads(
        post_text=post_text,
        output_dir=settings.outputs_dir,
        endpoint=settings.publish_endpoint,
        token=settings.publish_token,
        dry_run=settings.publish_dry_run,
    )
    print(f"[daily_post] source={signals_path}")
    print(f"[daily_post] post={post_path}")
    print(f"[daily_post] publish_log={log_path}")


def morning_prepare() -> None:
    parser = argparse.ArgumentParser(description="Generate morning draft and email it for review")
    parser.add_argument("--signals", type=str, default="", help="Path to signals json. If empty, latest file is used.")
    args = parser.parse_args()

    settings = load_settings()
    signals_path = _resolve_signals_path(args.signals, settings.outputs_dir)
    if not signals_path:
        raise SystemExit("signals JSON 파일이 없습니다. weekly_collect를 먼저 실행하세요.")

    payload = json.loads(signals_path.read_text(encoding="utf-8"))
    items = [HiringSignal.from_dict(x) for x in payload]
    style = read_style(settings.style_file)
    post_text = write_post(items=items, style_text=style, api_key=settings.openai_api_key, model=settings.openai_model)
    draft_path = save_today_draft(settings.outputs_dir, post_text, str(signals_path))

    edit_link = f"{settings.dashboard_base_url}/?view=edit&draft={draft_path.name}"
    body = (
        f"[threadbot-ieumnarae] 오늘 09:00 게시 예정 초안입니다.\\n\\n"
        f"생성시각(KST): {kst_now().isoformat()}\\n"
        f"수정 링크: {edit_link}\\n\\n"
        f"초안 본문:\\n{post_text}\\n"
    )
    print(f"[morning_prepare] draft={draft_path}")

    required = [
        settings.smtp_host,
        settings.smtp_user,
        settings.smtp_password,
        settings.email_from,
        settings.email_to,
    ]
    if all(required):
        send_email(
            smtp_host=settings.smtp_host or "",
            smtp_port=settings.smtp_port,
            smtp_user=settings.smtp_user or "",
            smtp_password=settings.smtp_password or "",
            sender=settings.email_from or "",
            recipient=settings.email_to or "",
            subject="[threadbot-ieumnarae] 09:00 자동게시 전 초안 확인",
            body=body,
        )
        print("[morning_prepare] email sent")
    else:
        print("[morning_prepare] SMTP/EMAIL 설정이 없어 이메일 발송은 건너뜀")
        print(body)


def _resolve_signals_path(value: str, output_dir: Path) -> Optional[Path]:
    if value:
        return Path(value)
    files = sorted(output_dir.glob("signals_*.json"))
    return files[-1] if files else None


if __name__ == "__main__":
    weekly_collect()
