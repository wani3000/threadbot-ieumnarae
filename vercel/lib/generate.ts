import OpenAI from "openai";
import type { Signal } from "./types";

export async function generatePost(signals: Signal[], styleSample: string): Promise<string> {
  if (signals.length === 0) {
    return [
      "1/5",
      "오늘 공고 없네요?",
      "불안하실 수 있죠.",
      "저도 그랬어요.",
      "다음 공고 전 준비가",
      "진짜 승부예요.",
      "",
      "2/5",
      "첫 번째 준비는",
      "자소서 문항 정리예요.",
      "갑자기 열리면",
      "시간이 없거든요.",
      "",
      "3/5",
      "두 번째 준비는",
      "면접 답변 틀 잡기.",
      "짧고 또렷하게요.",
      "",
      "4/5",
      "세 번째 준비는",
      "체력 루틴 고정.",
      "면접 전에 티나요.",
      "",
      "5/5",
      "오늘 요약 끝.",
      "저장해두고",
      "다음 공고 같이 봐요.",
    ].join("\n");
  }

  const facts = signals
    .slice(0, 8)
    .map(
      (s, i) =>
        `${i + 1}) 제목: ${s.title}\n   항공사: ${s.airline ?? "-"}\n   날짜: ${s.published_at ?? "-"}\n   링크: ${s.link}\n   요약: ${s.summary}`,
    )
    .join("\n");

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return fallbackPost(signals);
  }

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content: [
            "당신은 전직 대한항공 승무원 출신 컨설턴트 계정 라이터다.",
            "주 독자는 승무원 준비생이다.",
            "반드시 사실 기반으로 작성한다.",
            "제공된 팩트 외 추측 금지.",
            "강매 문구 금지.",
            "학원식 정형화 표현 금지.",
            "해시태그 남발 금지.",
            "출력 형식은 슬라이드형이다.",
            "반드시 5슬라이드로 작성한다.",
            "각 슬라이드는 'n/5'로 시작한다.",
            "한 문장 한 줄로만 쓴다.",
            "짧은 구어체 존댓말로 쓴다.",
            "문장 길이는 매우 짧게 유지한다.",
            "구조는 공감→문제→내 경험→해결→행동 유도.",
            "첫 슬라이드는 훅이다.",
            "훅은 질문형 또는 반전형으로 시작한다.",
            "숫자 표현을 포함한다.",
            "슬라이드당 핵심 1개만 쓴다.",
            "각 슬라이드에 독자 질문 1개 포함을 권장한다.",
            "이모지는 전체 1~2개만 사용한다.",
            "마지막 슬라이드는 요약 1줄 + 부드러운 CTA.",
            "링크는 마지막 슬라이드에 1~2개만 넣는다.",
          ].join(" "),
        },
        {
          role: "user",
          content: `[스타일 샘플]\n${styleSample}\n\n[팩트]\n${facts}\n\n오늘 주제: 최근 일주일 항공사 채용 업데이트\n슬라이드 수: 5\n요청: 규칙을 지켜 오늘 아침 게시 초안 1개 작성`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content?.trim();
    return text || fallbackPost(signals);
  } catch {
    return fallbackPost(signals);
  }
}

function fallbackPost(signals: Signal[]): string {
  const top = signals.slice(0, 3);
  const lines: string[] = [
    "1/5",
    "공고 뜨기 전이죠?",
    "이때가 더 중요해요.",
    "준비 차이가 나요.",
    "",
    "2/5",
    "첫 번째는 공고 확인.",
    "공식 링크만 보세요.",
    "헷갈리신 적 있죠?",
    "",
    "3/5",
    "두 번째는 문항 정리.",
    "자소서 틀 먼저 잡아요.",
    "열리면 바로 써야죠.",
    "",
    "4/5",
    "세 번째는 면접 루틴.",
    "답변 길이 줄이세요.",
    "짧게 말하는 연습요.",
    "",
    "5/5",
    "오늘 요약 끝.",
    "원문 확인은 필수예요.",
  ];
  for (const item of top) {
    lines.push(item.link);
  }
  lines.push("저장해두고");
  lines.push("다음 공고 같이 봐요.");
  return lines.join("\n");
}
