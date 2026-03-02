from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from openai import OpenAI

from .models import HiringSignal


def read_style(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8").strip()


def build_fact_sheet(items: List[HiringSignal], limit: int = 10) -> str:
    lines = []
    for i, item in enumerate(items[:limit], start=1):
        published = item.published_at.isoformat() if item.published_at else "unknown"
        lines.append(
            f"{i}) 제목: {item.title}\n"
            f"   항공사: {item.airline or '-'} / 직무: {item.role or '-'}\n"
            f"   날짜: {published}\n"
            f"   요약: {item.summary}\n"
            f"   링크: {item.link}"
        )
    return "\n".join(lines)


def write_post(
    items: List[HiringSignal],
    style_text: str,
    api_key: Optional[str],
    model: str,
) -> str:
    if not items:
        return (
            "1/5\n"
            "오늘 공고 없네요?\n"
            "불안하실 수 있죠.\n"
            "저도 그랬어요.\n\n"
            "2/5\n"
            "첫 번째 준비는\n"
            "문항 정리예요.\n"
            "갑자기 열리거든요.\n\n"
            "3/5\n"
            "두 번째 준비는\n"
            "면접 답변 틀이에요.\n"
            "짧게 말해보세요.\n\n"
            "4/5\n"
            "세 번째 준비는\n"
            "체력 루틴이에요.\n"
            "면접 전 티나요.\n\n"
            "5/5\n"
            "오늘 요약 끝.\n"
            "저장해두고\n"
            "다음 공고 같이 봐요."
        )

    if not api_key:
        return fallback_post(items)

    client = OpenAI(api_key=api_key)
    facts = build_fact_sheet(items)

    system = (
        "당신은 전직 대한항공 승무원 출신 컨설턴트 계정 라이터다. "
        "주 독자는 승무원 준비생이다. "
        "반드시 사실 기반으로 작성한다. "
        "제공된 팩트 외 추측 금지. "
        "강매 문구 금지. "
        "학원식 정형화 표현 금지. "
        "해시태그 남발 금지. "
        "출력 형식은 슬라이드형이다. "
        "반드시 5슬라이드로 작성한다. "
        "각 슬라이드는 'n/5'로 시작한다. "
        "한 문장 한 줄로만 쓴다. "
        "짧은 구어체 존댓말로 쓴다. "
        "문장 길이는 매우 짧게 유지한다. "
        "구조는 공감→문제→내 경험→해결→행동 유도. "
        "첫 슬라이드는 훅이다. "
        "훅은 질문형 또는 반전형으로 시작한다. "
        "숫자 표현을 포함한다. "
        "슬라이드당 핵심 1개만 쓴다. "
        "각 슬라이드에 독자 질문 1개 포함을 권장한다. "
        "이모지는 전체 1~2개만 사용한다. "
        "마지막 슬라이드는 요약 1줄 + 부드러운 CTA. "
        "링크는 마지막 슬라이드에 1~2개만 넣는다."
    )
    user = (
        f"[계정 기존 말투 샘플]\n{style_text or '(샘플 없음: 교육자 톤으로 작성)'}\n\n"
        f"[최근 7일 채용 팩트]\n{facts}\n\n"
        "요청: 오늘 업로드할 Threads 게시글 1개를 규칙대로 작성해줘."
    )

    response = client.responses.create(
        model=model,
        input=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.5,
    )
    return response.output_text.strip()


def fallback_post(items: List[HiringSignal]) -> str:
    top = items[:2]
    lines = [
        "1/5",
        "공고 뜨기 전이죠?",
        "이때가 더 중요해요.",
        "준비 차이가 나요.",
        "",
        "2/5",
        "첫 번째는 공식 확인.",
        "공식 링크만 보세요.",
        "헷갈리신 적 있죠?",
        "",
        "3/5",
        "두 번째는 문항 정리.",
        "자소서 틀 잡아두세요.",
        "열리면 바로 써야죠.",
        "",
        "4/5",
        "세 번째는 면접 루틴.",
        "답변 길이 줄이세요.",
        "짧게 말해보세요.",
        "",
        "5/5",
        "오늘 요약 끝.",
        "원문 확인은 필수예요.",
    ]
    for item in top:
        lines.append(item.link)
    lines.append("저장해두고")
    lines.append("다음 공고 같이 봐요.")
    return "\n".join(lines)


def save_post(path: Path, post: str, source_json: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "created_at": datetime.utcnow().isoformat() + "Z",
        "source_json": str(source_json),
        "post": post,
    }
    with path.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
    return path
