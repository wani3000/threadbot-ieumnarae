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
            "공고가 잠잠하면 더 불안해지죠.\n"
            "저도 그 마음을 잘 알아요.\n"
            "그래서 공고가 없을 때는 준비의 방향을 먼저 잡아두는 편이 좋아요.\n"
            "갑자기 일정이 열리면 마음이 더 급해지거든요.\n\n"
            "먼저 자소서 문항부터 정리해두세요.\n"
            "어떤 질문이 나와도 바로 꺼낼 수 있게 경험을 묶어두면 좋아요.\n"
            "한 번 써둔 답변은 면접 준비로도 이어지기 쉬워요.\n"
            "준비가 연결되면 훨씬 덜 흔들려요.\n\n"
            "면접 답변도 같이 다듬어두면 좋아요.\n"
            "길게 말하려고 하면 오히려 중심이 흐려지거든요.\n"
            "짧고 또렷하게 말하는 연습을 해두면 실제 자리에서 힘이 돼요.\n"
            "체력 루틴도 같이 챙기면 더 안정적이에요.\n\n"
            "공고가 없는 시간도 준비 시간으로 쓰면 차이가 생겨요.\n"
            "조금씩 쌓아두면 기회가 왔을 때 훨씬 덜 흔들려요.\n"
            "끝까지 차분하게 준비해보세요.\n"
            "❤️"
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
        "한 문장 한 줄로만 쓴다. "
        "한 줄에 두 문장을 넣지 않는다. "
        "친근한 구어체 존댓말로 쓴다. "
        "문단은 4~6개로 나눈다. "
        "각 문단은 4~7줄로 충분히 길게 쓴다. "
        "각 문단은 최소 150자 이상이 되도록 정보량을 확보한다. "
        "구조는 공감→문제→내 경험→해결→정리 순서를 따른다. "
        "숫자 표기 1/5, 2/5, 1/2 금지. "
        "\"다음 슬라이드\" 같은 문구 금지. "
        "링크 삽입 금지. "
        "댓글 유도 금지. "
        "자기 서비스 홍보 금지. "
        "\"오늘\", \"이번 주\", \"최근 일주일\" 같은 실시간 표현 금지. "
        "어려운 단어보다 쉬운 평서문을 사용한다. "
        "문단 중간이나 마무리에 :)를 가끔만 사용한다. "
        "마지막 문장은 반드시 ❤️ 로 끝낸다."
    )
    user = (
        f"[계정 기존 말투 샘플]\n{style_text or '(샘플 없음: 교육자 톤으로 작성)'}\n\n"
        f"[최근 7일 채용 팩트]\n{facts}\n\n"
        "요청: Threads 게시글 1개를 규칙대로 작성해줘."
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
    airline = items[0].airline if items and items[0].airline else "항공사"
    return (
        f"{airline} 준비를 하다 보면 정보가 많아 보여도 막상 무엇부터 챙겨야 할지 헷갈릴 때가 있어요.\n"
        "그럴수록 눈에 보이는 공고만 따라가기보다 기본 준비를 먼저 다져두는 편이 더 안정적이에요.\n"
        "특히 자소서와 면접 답변은 따로 준비하는 것 같아도 실제로는 같은 경험에서 출발하거든요.\n"
        "그래서 한 번 정리해두면 다음 단계가 훨씬 수월해져요.\n\n"
        "먼저 지원하려는 회사가 보는 태도를 정리해보세요.\n"
        "서비스 경험을 어떤 시선으로 말할지, 협업 경험을 어떤 장면으로 풀어낼지 미리 정해두면 좋아요.\n"
        "이 단계가 잡혀 있으면 문항이 달라져도 중심은 쉽게 흔들리지 않아요.\n"
        "비슷한 말만 반복하는 답변도 줄일 수 있어요.\n\n"
        "면접 준비에서는 답변 길이를 줄이는 연습이 꼭 필요해요.\n"
        "좋은 경험이 있어도 길게 말하면 오히려 핵심이 흐려질 수 있거든요.\n"
        "짧고 분명하게 말하는 연습을 해두면 영상 면접이든 대면 면접이든 전달력이 훨씬 좋아져요.\n"
        "표정과 자세까지 같이 점검하면 안정감도 더 살아나요 :)\n\n"
        "결국 준비는 공고가 뜬 뒤에 시작하는 게 아니라 그전부터 쌓아두는 거예요.\n"
        "기본기를 먼저 만들어두면 기회가 왔을 때 훨씬 덜 흔들려요.\n"
        "차분하게 한 가지씩 정리해보세요.\n"
        "❤️"
    )


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
