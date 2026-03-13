from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import quote
from xml.etree import ElementTree

import requests
import streamlit as st
import yaml

from .config import load_settings
from .drafts import list_drafts, load_draft, update_draft

TAG_KEYWORDS = [
    "항공사",
    "대한항공",
    "아시아나항공",
    "승무원",
    "승무원채용",
    "승무원취업",
]


def run_dashboard() -> None:
    settings = load_settings()
    st.set_page_config(page_title="ieumnarae-threadbot Dashboard", layout="wide")

    st.title("ieumnarae-threadbot Dashboard")
    st.caption("Threads 계정 운영 자동화 모니터링")

    query_view = str(st.query_params.get("view", "") or "")
    query_draft = str(st.query_params.get("draft", "") or "")

    if query_view == "edit":
        render_edit(settings, query_draft)
        return

    page = st.sidebar.radio("메뉴", ["홈", "수집", "글수정"], index=0)

    if page == "홈":
        render_home(settings)
    elif page == "수집":
        render_collection(settings)
    else:
        render_edit(settings, query_draft)


def render_home(settings) -> None:
    st.subheader("1) 최근 내 Threads 게시글 (최근 7일)")
    recent_posts = load_recent_posts(settings.outputs_dir, days=7)
    if not recent_posts:
        st.info("최근 7일 내 자동 게시 기록이 없습니다.")
    else:
        for item in recent_posts:
            created = item.get("created_at") or item.get("file_time") or "-"
            st.markdown(f"- `{created}`")
            st.write(item.get("post") or item.get("message") or "(본문 없음)")
            st.divider()

    st.subheader("2) 수집 정보 기반 주간 추천 글 5개")
    signals = load_latest_signals(settings.outputs_dir)
    recos = build_recommended_posts(signals, max_items=5)
    if not recos:
        st.info("추천할 수집 데이터가 없습니다. 먼저 수집을 실행하세요.")
    else:
        for idx, reco in enumerate(recos, start=1):
            with st.expander(f"추천 {idx}: {reco['title']}", expanded=(idx == 1)):
                st.write(reco["post"])
                if reco.get("source"):
                    st.markdown(f"원문: {reco['source']}")

    st.subheader("3) Threads 태그 기반 최신 글 리스팅")
    st.caption("로그인 없는 공개 검색 기준이며, 일부 태그는 노출 제한으로 누락될 수 있습니다.")
    tag_rows = fetch_threads_tag_listings(TAG_KEYWORDS)
    if not tag_rows:
        st.warning("태그 리스팅을 가져오지 못했습니다. 네트워크/검색 제한 상태일 수 있습니다.")
    else:
        for row in tag_rows:
            st.markdown(
                f"- **#{row['tag']}** | [{row['title']}]({row['link']})"
            )

    st.subheader("4) 최근 승무원 채용 정보 (진행중 추정)")
    ongoing = filter_ongoing_hiring(signals)
    if not ongoing:
        st.info("진행중으로 판별된 공고가 없습니다. 원문 일정을 확인해 주세요.")
    else:
        for item in ongoing:
            st.markdown(f"- [{item['title']}]({item['link']})")
            st.caption(item.get("summary", ""))


def render_collection(settings) -> None:
    st.subheader("수집된 정보 URL")

    sources = load_sources_yaml(settings.sources_file)
    for src in sources:
        st.markdown(f"- {src.get('name','(no-name)')}: {src.get('url')}" )

    st.markdown("---")
    st.markdown("### URL 추가하기")
    with st.form("add_url_form", clear_on_submit=True):
        name = st.text_input("소스 이름")
        url = st.text_input("URL")
        submitted = st.form_submit_button("URL추가")

    if submitted:
        if not url.strip():
            st.error("URL을 입력해 주세요.")
        elif not re.match(r"^https?://", url.strip()):
            st.error("http(s) URL만 추가할 수 있습니다.")
        else:
            added = append_source(settings.sources_file, name.strip() or url.strip(), url.strip())
            if added:
                st.success("수집 URL을 추가했습니다.")
                st.rerun()
            else:
                st.warning("이미 등록된 URL입니다.")


def render_edit(settings, draft_name: str) -> None:
    st.subheader("게시글 수정")
    drafts = list_drafts(settings.outputs_dir)
    if not drafts:
        st.info("수정할 초안이 없습니다.")
        return

    options = [p.name for p in drafts]
    if draft_name and draft_name in options:
        selected = draft_name
    else:
        selected = options[0]

    selected = st.selectbox("초안 선택", options, index=options.index(selected))
    path = settings.outputs_dir / selected
    payload = load_draft(path)
    if not payload:
        st.error("초안 파일을 읽을 수 없습니다.")
        return

    st.caption(f"생성: {payload.get('created_at','-')} / 상태: {payload.get('status','-')}")
    text = st.text_area("게시글 본문", value=payload.get("post", ""), height=300)

    col1, col2 = st.columns(2)
    if col1.button("수정 저장", use_container_width=True):
        update_draft(path, text, approved=False)
        st.success("수정 내용을 저장했습니다.")
    if col2.button("승인 완료(09:00 게시 사용)", use_container_width=True):
        update_draft(path, text, approved=True)
        st.success("승인 완료되었습니다. 09:00 자동게시에 이 본문이 사용됩니다.")


def load_sources_yaml(path: Path) -> List[Dict]:
    if not path.exists():
        return []
    payload = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return payload.get("sources", [])


def append_source(path: Path, name: str, url: str) -> bool:
    payload = {"sources": load_sources_yaml(path)}
    normalized = url.strip().rstrip("/")
    existing = {x.get("url", "").strip().rstrip("/") for x in payload["sources"]}
    if normalized in existing:
        return False
    payload["sources"].append({"name": name, "url": url})
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(yaml.safe_dump(payload, allow_unicode=True, sort_keys=False), encoding="utf-8")
    return True


def load_latest_signals(output_dir: Path) -> List[Dict]:
    files = sorted(output_dir.glob("signals_*.json"))
    if not files:
        return []
    latest = files[-1]
    try:
        return json.loads(latest.read_text(encoding="utf-8"))
    except Exception:
        return []


def load_recent_posts(output_dir: Path, days: int = 7) -> List[Dict]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    results: List[Dict] = []

    for path in sorted(output_dir.glob("post_*.json"), reverse=True):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        created = parse_dt(payload.get("created_at"))
        if created and created >= cutoff:
            payload["file_time"] = created.isoformat()
            results.append(payload)

    return results[:10]


def parse_dt(raw: Optional[str]) -> Optional[datetime]:
    if not raw:
        return None
    value = raw.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(value)
        if not dt.tzinfo:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def build_recommended_posts(signals: List[Dict], max_items: int = 5) -> List[Dict]:
    if not signals:
        return []

    picked = []
    used = set()
    for signal in signals:
        title = signal.get("title", "")
        link = signal.get("link", "")
        key = (title.strip().lower(), link.strip().lower())
        if key in used:
            continue
        used.add(key)

        summary = signal.get("summary", "")
        airline = signal.get("airline") or "항공사"
        post = (
            f"[이번 주 {airline} 취업 포인트]\n"
            f"{title}\n\n"
            f"핵심: {summary[:200]}\n"
            f"지원 전 체크: 일정/자격요건/근무지 꼭 원문으로 재확인하세요.\n"
            f"원문: {link}"
        )
        picked.append({"title": title, "post": post, "source": link})
        if len(picked) >= max_items:
            break

    return picked


def fetch_threads_tag_listings(tags: List[str], per_tag: int = 3) -> List[Dict]:
    rows: List[Dict] = []
    for tag in tags:
        rows.extend(fetch_bing_threads_results_for_tag(tag, limit=per_tag))
        if len([x for x in rows if x["tag"] == tag]) == 0:
            rows.append(
                {
                    "tag": tag,
                    "title": f"Threads 태그 페이지 바로가기: #{tag}",
                    "link": f"https://www.threads.com/tag/{quote(tag)}",
                }
            )
    return rows


def fetch_bing_threads_results_for_tag(tag: str, limit: int = 3) -> List[Dict]:
    query = f'site:threads.com "{tag}" ("threads.com/@" OR "threads.com/tag/")'
    url = f"https://www.bing.com/search?q={quote(query)}&format=rss"
    try:
        res = requests.get(url, timeout=12)
        res.raise_for_status()
    except Exception:
        return []

    try:
        root = ElementTree.fromstring(res.text)
    except Exception:
        return []

    out: List[Dict] = []
    for item in root.findall("./channel/item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        if "threads.com" not in link:
            continue
        out.append({"tag": tag, "title": title, "link": link})
        if len(out) >= limit:
            break
    return out


def filter_ongoing_hiring(signals: List[Dict]) -> List[Dict]:
    now = datetime.now(timezone.utc)
    out = []
    for item in signals:
        text = f"{item.get('title','')} {item.get('summary','')}"
        if not is_hiring_like(text):
            continue
        deadline = extract_deadline(text, now.year)
        if deadline and deadline < now.date():
            continue
        out.append(item)
    return out[:20]


def is_hiring_like(text: str) -> bool:
    hay = text.lower()
    keys = ["채용", "모집", "공고", "승무원", "객실", "취업", "recruit", "hiring"]
    return any(k in hay for k in keys)


def extract_deadline(text: str, default_year: int) -> Optional[datetime.date]:
    # matches ~3/6, 3.6, 3-6, 03/06
    m = re.search(r"(?:~|까지|마감)?\s*(\d{1,2})[./-](\d{1,2})", text)
    if not m:
        return None
    month = int(m.group(1))
    day = int(m.group(2))
    try:
        return datetime(default_year, month, day, tzinfo=timezone.utc).date()
    except Exception:
        return None


if __name__ == "__main__":
    run_dashboard()
