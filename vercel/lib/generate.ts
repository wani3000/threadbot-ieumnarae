import OpenAI from "openai";
import type { Signal } from "./types";
import { FULL_CONTENT_GUIDE } from "./contentGuide";

export type GeneratePostResult = {
  post: string;
  provider: "openai" | "fallback";
  reason?: string;
};

function splitSlides(text: string): string[] {
  return text
    .split(/\n\s*\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isNumbering(line: string): boolean {
  return /^\d+\/\d+$/.test(line.trim());
}

function isTooShortPost(text: string): boolean {
  const slides = splitSlides(text);
  if (slides.length < 2) return true;
  const allLines = text
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);
  const contentLines = allLines.filter((l) => !isNumbering(l));
  if (contentLines.length < 10) return true;
  const totalChars = contentLines.reduce((acc, cur) => acc + cur.length, 0);
  if (totalChars < 140) return true;
  return false;
}

function sanitizeGeneratedPost(raw: string): string {
  const banned = [
    "아니면 제 프로필 링크도 참고해보세요",
    "이음나래아카데미 나래쌤",
    "ieumnarae.com",
    "최신 채용 소식과 면접 자료를 제공해드려요",
    "1:1 과외도 진행 중이에요",
    "소중한 기회를 놓치지 않도록 도와드릴게요",
    "댓글 남겨주세요",
    "댓글로 알려주세요",
  ];
  const lines = raw
    .split("\n")
    .filter((line) => {
      const low = line.toLowerCase();
      if (/https?:\/\//i.test(line)) return false;
      if (/\[[^\]]+\]\((https?:\/\/|manual:\/\/)[^)]+\)/i.test(line)) return false;
      if (/댓글|dm|문의|신청|상담/i.test(line) && /(남겨|주세요|해요|바랍니다)/.test(line)) return false;
      if (/제공해드려요|도와드릴게요|과외도 진행 중/i.test(line)) return false;
      return !banned.some((b) => low.includes(b.toLowerCase()));
    });
  const cleaned = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return ensureHeartEnding(cleaned);
}

function ensureHeartEnding(text: string): string {
  const lines = text.split("\n");
  const lastNumberIdx = [...lines].reverse().findIndex((v) => /^\s*2\s*\/\s*2\s*$/.test(v.trim()));
  if (lastNumberIdx === -1) return text;
  const idx = lines.length - 1 - lastNumberIdx;
  for (let i = idx - 1; i >= 0; i -= 1) {
    const t = lines[i].trim();
    if (!t) continue;
    if (/^\d+\s*\/\s*\d+$/.test(t)) continue;
    if (!t.includes("❤️")) lines[i] = `${t.replace(/[.!?]+$/g, "").trim()} ❤️`;
    break;
  }
  return lines.join("\n");
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
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: options?.temperature ?? 0.5,
      messages: [
        {
          role: "system",
          content: [
            "아래 가이드를 반드시 준수한다.",
            FULL_CONTENT_GUIDE,
            "출력은 반드시 본문 1개 + 이어지는 글 1개, 총 2개로 작성한다.",
            "각 게시글은 5~8줄을 쓰고 마지막 줄을 1/2, 2/2 넘버링으로 끝낸다.",
            "슬라이드 사이에는 빈 줄 하나만 둔다.",
            "'슬라이드 1:' 같은 라벨 금지.",
            "굵게(**)나 번호목록 마크다운 금지.",
            "해시태그는 사용하지 않는다.",
            "사실은 [팩트]에 있는 내용만 사용한다.",
            "과장/추측/지어낸 후기 금지.",
            "프로필 링크/개인 사이트 링크/ieumnarae.com/이음나래아카데미 문구 금지.",
            "본문/마지막 모두 링크 금지.",
            "자기 서비스 홍보 문장(제공해드려요/과외 진행 중/도와드릴게요) 금지.",
            "댓글 유도 문장 금지.",
            "쉬운 평서문으로 작성하고 어려운 용어를 피한다.",
            "두 번째 게시글 마지막 문장은 반드시 ❤️ 로 끝낸다.",
            "각 슬라이드의 마무리 문장에는 가끔 :)를 넣되 과하지 않게 사용한다.",
            "너무 짧게 쓰지 말고, 전체 분량은 충분히 풍부하게 쓴다.",
            "딱딱하지 않게 중간 문장에 이모티콘을 자연스럽게 1~2개 사용한다.",
            "각 슬라이드 마지막 문장에는 이모티콘 1개를 붙여 마무리한다.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            `[스타일 샘플]\n${styleSample}`,
            `[팩트]\n${facts}`,
            "오늘 주제: 최근 일주일 항공사 채용 업데이트",
            "게시글 수: 2 (본문 + 이어지는 글 1개)",
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
    let sanitized = sanitizeGeneratedPost(text);
    if (isTooShortPost(sanitized)) {
      const retry = await client.chat.completions.create({
        model,
        temperature: Math.max(options?.temperature ?? 0.7, 0.8),
        messages: [
          {
            role: "system",
            content:
              "이전 결과가 너무 짧았습니다. 반드시 2개 게시글(본문+이어지는 글1개), 각 5~8줄(마지막 줄은 1/2,2/2), 총 정보량을 충분히 늘려 다시 작성하세요. 링크/댓글유도/자기홍보 문장은 금지, 마지막 문장은 ❤️, 쉬운 평서문 사용, 마무리 문장에 가끔 :)를 적용하세요.",
          },
          {
            role: "user",
            content: [
              `[스타일 샘플]\n${styleSample}`,
              `[팩트]\n${facts}`,
              "오늘 주제: 최근 일주일 항공사 채용 업데이트",
              "게시글 수: 2 (본문 + 이어지는 글 1개)",
              "요청: 내용 밀도를 높여 풍부하게 작성",
              extraPrompt ? `추가 요청: ${extraPrompt}` : "",
            ]
              .filter(Boolean)
              .join("\n\n"),
          },
        ],
      });
      const retryText = retry.choices[0]?.message?.content?.trim();
      if (retryText) sanitized = sanitizeGeneratedPost(retryText);
    }
    return { post: sanitized, provider: "openai" };
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
  const lines: string[] = [
    "공고 전 공백기죠?",
    "이때 방향을 잡아야",
    "합격 속도가 나요.",
    "저도 이 시기에",
    "루틴부터 만들었어요.",
    "1/2",
    "",
    "첫 번째는 정보선별.",
    "공식 채용 링크와",
    "강사/인플루언서 글을",
    "따로 정리해보세요.",
    "섞어보면 흐름이 보여요.",
    "2/2",
    "",
    "오늘 요약할게요.",
    "정보선별 + 자소서틀 +",
    "면접루틴이 기본이에요.",
    "내일 바로 실행해요 :)",
    "천천히 해도 괜찮아요 ❤️",
  ];
  return ensureHeartEnding(lines.join("\n"));
}
