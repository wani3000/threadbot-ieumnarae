import OpenAI from "openai";
import type { Signal } from "./types";
import { FULL_CONTENT_GUIDE } from "./contentGuide";

export type GeneratePostResult = {
  post: string;
  provider: "openai" | "fallback";
  reason?: string;
};

function sanitizeGeneratedPost(raw: string): string {
  const banned = [
    "아니면 제 프로필 링크도 참고해보세요",
    "이음나래아카데미 나래쌤",
    "ieumnarae.com",
  ];
  const lines = raw
    .split("\n")
    .filter((line) => {
      const low = line.toLowerCase();
      return !banned.some((b) => low.includes(b.toLowerCase()));
    });
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export async function generatePostDetailed(
  signals: Signal[],
  styleSample: string,
  extraPrompt = "",
  options?: { temperature?: number },
): Promise<GeneratePostResult> {
  if (signals.length === 0) {
    return {
      provider: "fallback",
      reason: "empty_signals",
      post: [
      "오늘 공고 없네요?",
      "불안하실 수 있죠.",
      "저도 그랬어요.",
      "다음 공고 전 준비가",
      "진짜 승부예요.",
      "1/5",
      "",
      "첫 번째 준비는",
      "자소서 문항 정리예요.",
      "갑자기 열리면",
      "시간이 없거든요.",
      "2/5",
      "",
      "두 번째 준비는",
      "면접 답변 틀 잡기.",
      "짧고 또렷하게요.",
      "3/5",
      "",
      "세 번째 준비는",
      "체력 루틴 고정.",
      "면접 전에 티나요.",
      "4/5",
      "",
      "오늘 요약 끝.",
      "저장해두고",
      "다음 공고 같이 봐요.",
      "5/5",
      ].join("\n"),
    };
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
    return { post: fallbackPost(signals), provider: "fallback", reason: "missing_api_key" };
  }

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: options?.temperature ?? 0.5,
      messages: [
        {
          role: "system",
          content: [
            "아래 가이드를 반드시 준수한다.",
            FULL_CONTENT_GUIDE,
            "출력은 반드시 5슬라이드로 작성한다.",
            "슬라이드마다 3~6줄을 쓰고 마지막 줄을 1/5, 2/5, 3/5, 4/5, 5/5 순서 넘버링으로 끝낸다.",
            "슬라이드 사이에는 빈 줄 하나만 둔다.",
            "'슬라이드 1:' 같은 라벨 금지.",
            "굵게(**)나 번호목록 마크다운 금지.",
            "해시태그는 사용하지 않는다.",
            "사실은 [팩트]에 있는 내용만 사용한다.",
            "과장/추측/지어낸 후기 금지.",
            "프로필 링크/개인 사이트 링크/ieumnarae.com/이음나래아카데미 문구 금지.",
            "마지막 슬라이드에만 원문 링크 1~2개를 넣는다.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            `[스타일 샘플]\n${styleSample}`,
            `[팩트]\n${facts}`,
            "오늘 주제: 최근 일주일 항공사 채용 업데이트",
            "슬라이드 수: 5",
            "요청: 가이드 전부 반영해서 스레드 초안 1개 작성",
            extraPrompt ? `추가 요청: ${extraPrompt}` : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
    });

    const text = response.choices[0]?.message?.content?.trim();
    if (!text) {
      return { post: sanitizeGeneratedPost(fallbackPost(signals)), provider: "fallback", reason: "empty_model_output" };
    }
    return { post: sanitizeGeneratedPost(text), provider: "openai" };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "openai_error";
    return { post: sanitizeGeneratedPost(fallbackPost(signals)), provider: "fallback", reason };
  }
}

export async function generatePost(signals: Signal[], styleSample: string): Promise<string> {
  const result = await generatePostDetailed(signals, styleSample);
  return result.post;
}

function fallbackPost(signals: Signal[]): string {
  const top = signals.slice(0, 3);
  const lines: string[] = [
    "공고 뜨기 전이죠?",
    "이때가 더 중요해요.",
    "준비 차이가 나요.",
    "1/5",
    "",
    "첫 번째는 공고 확인.",
    "공식 링크만 보세요.",
    "헷갈리신 적 있죠?",
    "2/5",
    "",
    "두 번째는 문항 정리.",
    "자소서 틀 먼저 잡아요.",
    "열리면 바로 써야죠.",
    "3/5",
    "",
    "세 번째는 면접 루틴.",
    "답변 길이 줄이세요.",
    "짧게 말하는 연습요.",
    "4/5",
    "",
    "오늘 요약 끝.",
    "원문 확인은 필수예요.",
  ];
  for (const item of top) {
    lines.push(item.link);
  }
  lines.push("저장해두고");
  lines.push("다음 공고 같이 봐요.");
  lines.push("5/5");
  return lines.join("\n");
}
