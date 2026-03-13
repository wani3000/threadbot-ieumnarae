import OpenAI from "openai";
import type { Signal } from "./types";
import { FULL_CONTENT_GUIDE } from "./contentGuide";

const MIN_THREAD_SEGMENT_CHARS = Number(process.env.THREADS_MIN_SEGMENT_CHARS || "150");

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

const REALTIME_BANNED_PATTERNS = [
  /이번\s*주/g,
  /최근\s*일주일/g,
  /방금\s*올라온/g,
  /오늘(은|도|만|부터|의|요)?/g,
];

function isNumbering(line: string): boolean {
  return /^\d+\/\d+$/.test(line.trim());
}

function stripRealtimeExpressions(text: string): string {
  let next = text;
  for (const pattern of REALTIME_BANNED_PATTERNS) {
    next = next.replace(pattern, '');
  }
  return next
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeSentenceLines(text: string): string {
  const paragraphs = text
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const normalizedParagraphs = paragraphs.map((paragraph) => {
    const compact = paragraph.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    const pieces = compact
      .split(/(?<=[.!?❤️🙂😊😉😌✨✈️])\s+/)
      .map((line) => line.trim())
      .filter(Boolean);
    return pieces.join('\n');
  });

  return normalizedParagraphs.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

function hasRealtimeExpression(text: string): boolean {
  return REALTIME_BANNED_PATTERNS.some((pattern) => pattern.test(text));
}

function hasParagraphLines(text: string): boolean {
  return splitSlides(text).some((paragraph) => paragraph.split('\n').some((line) => line.trim().length > 65));
}

function isTooShortPost(text: string): boolean {
  const slides = splitSlides(text);
  if (slides.length < 2) return true;
  const minChars = Number.isFinite(MIN_THREAD_SEGMENT_CHARS) && MIN_THREAD_SEGMENT_CHARS > 0 ? MIN_THREAD_SEGMENT_CHARS : 150;
  if (slides.some((slide) => slide.length < minChars)) return true;
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
    "다음 슬라이드",
  ];
  const normalizedRaw = normalizeSentenceLines(stripRealtimeExpressions(raw))
    // Remove numbering tokens like "1/5", "(2/5)" anywhere in text.
    .replace(/\(?\b\d+\s*\/\s*\d+\b\)?/g, "")
    .replace(/\n{3,}/g, "\n\n");

  const lines = normalizedRaw
    .split("\n")
    .filter((line) => {
      const low = line.toLowerCase();
      if (/^\s*\d+\s*\/\s*\d+\s*$/.test(line.trim())) return false;
      if (/https?:\/\//i.test(line)) return false;
      if (/\[[^\]]+\]\((https?:\/\/|manual:\/\/)[^)]+\)/i.test(line)) return false;
      if (/댓글|dm|문의|신청|상담/i.test(line) && /(남겨|주세요|해요|바랍니다)/.test(line)) return false;
      if (/제공해드려요|도와드릴게요|과외도 진행 중/i.test(line)) return false;
      if (/다음\s*슬라이드/i.test(line)) return false;
      return !banned.some((b) => low.includes(b.toLowerCase()));
    });
  const cleaned = normalizeSentenceLines(lines.join("\n")).replace(/\n{3,}/g, "\n\n").trim();
  return ensureHeartEnding(cleaned);
}

function ensureHeartEnding(text: string): string {
  const lines = text.split("\n");
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const t = lines[i].trim();
    if (!t) continue;
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
        "공고가 안 보여도",
        "준비가 멈추면 안 되죠.",
        "오히려 이런 때가",
        "기본기를 다질 시간이에요 🙂",
        "",
        "먼저 자소서 문항부터",
        "한 번 정리해보세요.",
        "회사별로 표현은 달라도",
        "보고 싶은 태도는 비슷하거든요.",
        "한 번 틀을 잡아두면 훨씬 편해요 🙂",
        "",
        "면접 답변도 마찬가지예요.",
        "길게 외우기보다",
        "핵심 장면을 먼저 잡아두세요.",
        "그래야 실제 면접에서",
        "말이 덜 흔들리더라고요 ✈️",
        "",
        "체력 루틴도 꼭 필요해요.",
        "잠드는 시간, 일어나는 시간,",
        "가벼운 운동 습관만 있어도",
        "면접 직전 컨디션이 달라져요.",
        "이 차이가 은근 크게 보여요 🙂",
        "",
        "공고가 없는 날에도",
        "할 수 있는 준비는 분명 있어요.",
        "작게라도 계속 쌓아두면",
        "기회가 열릴 때 훨씬 빠르게 움직일 수 있어요 ❤️",
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
            "출력은 4~6문단으로 작성한다.",
            "각 문단은 4~7줄로 작성한다.",
            "첫 게시글과 각 연속 스레드 문단은 모두 최소 150자 이상으로 작성한다.",
            "1/5, 2/5, 1/2 같은 넘버링 문장은 절대 쓰지 않는다.",
            "문단 사이에는 빈 줄 하나만 둔다.",
            "\"다음 슬라이드\"라는 표현은 절대 쓰지 않는다.",
            "'슬라이드 1:' 같은 라벨 금지.",
            "굵게(**)나 번호목록 마크다운 금지.",
            "해시태그는 사용하지 않는다.",
            "사실은 [팩트]에 있는 내용만 사용한다.",
            "과장/추측/지어낸 후기 금지.",
            "\"이번 주\", \"이번주\", \"오늘\", \"최근 일주일\", \"이번 주의 채용 업데이트\" 같은 실시간성 날짜 표현 금지.",
            "프로필 링크/개인 사이트 링크/ieumnarae.com/이음나래아카데미 문구 금지.",
            "본문/마지막 모두 링크 금지.",
            "자기 서비스 홍보 문장(제공해드려요/과외 진행 중/도와드릴게요) 금지.",
            "댓글 유도 문장 금지.",
            "쉬운 평서문으로 작성하고 어려운 용어를 피한다.",
            "두 번째 게시글 마지막 문장은 반드시 ❤️ 로 끝낸다.",
            "각 문단의 마무리 문장에는 가끔 :)를 넣되 과하지 않게 사용한다.",
            "너무 짧게 쓰지 말고, 전체 분량은 충분히 풍부하게 쓴다.",
            "딱딱하지 않게 중간 문장에 이모티콘을 자연스럽게 1~2개 사용한다.",
            "각 문단 마지막 문장에는 필요할 때만 이모티콘 1개를 붙여 마무리한다.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            `[스타일 샘플]\n${styleSample}`,
            `[팩트]\n${facts}`,
            "게시 주제와 세부 방향은 추가 요청을 따른다.",
            "문단 수: 4~6",
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
    if (isTooShortPost(sanitized) || hasRealtimeExpression(sanitized) || hasParagraphLines(sanitized)) {
      const retry = await client.chat.completions.create({
        model,
        temperature: Math.max(options?.temperature ?? 0.7, 0.8),
        messages: [
          {
            role: "system",
            content:
              "이전 결과가 규칙을 지키지 못했습니다. 반드시 한 문장 한 줄로 작성하고, 4~6문단, 각 문단 4~7줄, 첫 게시글과 각 연속 스레드 문단은 모두 최소 150자 이상으로 충분히 길게 작성하세요. 1/5, 2/5 같은 넘버링 금지, \"다음 슬라이드\" 문구 금지, 링크/댓글유도/자기홍보 문장 금지, \"오늘\" \"이번 주\" 같은 실시간성 표현 금지, 마지막 문장은 ❤️, 쉬운 평서문 사용, 마무리 문장에 가끔 :)를 적용하세요.",
          },
          {
            role: "user",
            content: [
              `[스타일 샘플]\n${styleSample}`,
              `[팩트]\n${facts}`,
              "게시 주제와 세부 방향은 추가 요청을 따른다.",
              "문단 수: 4~6",
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

export async function generatePost(signals: Signal[], styleSample: string, extraPrompt = ""): Promise<string> {
  const result = await generatePostDetailed(signals, styleSample, extraPrompt);
  return result.post;
}

function fallbackPost(signals: Signal[]): string {
  const lines: string[] = [
    "준비하다 보면",
    "갑자기 막막한 날이 오죠.",
    "저도 그럴 때가 있었어요.",
    "그럴수록 기본으로 돌아가야 해요 🙂",
    "",
    "첫 번째는 정보 정리예요.",
    "공식 채용 글과 후기 글을",
    "한꺼번에 보지 말고 나눠보세요.",
    "그래야 사실과 해석이",
    "머릿속에서 덜 섞이거든요 ✍️",
    "",
    "두 번째는 답변 틀이에요.",
    "문장을 길게 쓰기보다",
    "상황, 행동, 결과만 먼저 잡아두세요.",
    "실전에서는 그 틀이",
    "생각보다 큰 힘이 돼요 ✈️",
    "",
    "세 번째는 체력 루틴이에요.",
    "면접은 하루만 잘 버티는 일이 아니라",
    "준비 기간 전체를 버티는 일이에요.",
    "잠과 식사만 일정해져도",
    "표정이 훨씬 안정돼요 🙂",
    "",
    "정리하면,",
    "정보 분리, 답변 틀, 체력 루틴.",
    "이 세 가지를 먼저 잡아두면",
    "다음 준비가 훨씬 또렷해져요 ❤️",
  ];
  return ensureHeartEnding(lines.join("\n"));
}
