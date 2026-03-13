import { generatePostDetailed, type GeneratePostResult } from "./generate";
import { getPostingThemePrompt, isPostMatchingPostingTheme } from "./postingTheme";
import type { Signal } from "./types";

function normalizePost(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function previewLines(text: string, limit = 6): string {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, limit)
    .join(" / ");
}

function forceDifferentHook(post: string, oldPost: string): string {
  const hooks = [
    "면접 준비, 순서가 중요해요.",
    "이 부분은 꼭 한 번 점검해보세요.",
    "이런 포인트에서 차이가 나더라고요.",
    "준비가 막힐 때는 여기부터 보세요.",
  ];
  const oldFirst = oldPost.split("\n").find((line) => line.trim()) || "";
  const picked = hooks.find((hook) => hook !== oldFirst) || `${hooks[0]} :)`;
  const lines = post.split("\n");
  const firstLine = lines.findIndex((line) => line.trim());
  if (firstLine >= 0) lines[firstLine] = picked;
  return lines.join("\n");
}

function buildPrompt(args: {
  targetDate: string;
  latestPostText?: string;
  oldPost?: string;
  mode?: "fresh" | "regenerate";
  customInstructions?: string[];
  seed?: string;
}): string {
  const parts = [
    getPostingThemePrompt(args.targetDate),
    "직전 게시글과 주제, 훅, 사례, 전개 순서가 겹치면 안 됩니다.",
    "링크 금지, 댓글유도 금지, 자기홍보 금지, 마지막 문장 ❤️ 규칙을 유지합니다.",
  ];

  const latestPreview = args.latestPostText ? previewLines(args.latestPostText) : "";
  if (latestPreview) {
    parts.push(`직전 게시글 일부: ${latestPreview}`);
    parts.push("직전 게시글의 첫 문장, 사례, 결론을 반복하지 않습니다.");
  }

  const oldPreview = args.oldPost ? previewLines(args.oldPost) : "";
  if (args.mode === "regenerate" && oldPreview) {
    parts.push(`기존 초안 일부: ${oldPreview}`);
    parts.push("기존 초안과 첫 문장, 전개, 결론이 같아 보이면 안 됩니다.");
  }

  if (args.customInstructions?.length) {
    parts.push(...args.customInstructions.filter(Boolean));
  }

  if (args.seed) {
    parts.push(`고유 시드: ${args.seed}`);
  }

  return parts.join("\n");
}

type ComposeDraftArgs = {
  targetDate: string;
  signals: Signal[];
  styleSample: string;
  latestPostText?: string;
  oldPost?: string;
  mode?: "fresh" | "regenerate";
  customInstructions?: string[];
};

export async function composeDraftPost(args: ComposeDraftArgs): Promise<GeneratePostResult> {
  const maxAttempts = 4;
  let result: GeneratePostResult = {
    post: "",
    provider: "fallback",
    reason: "not_started",
  };

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const temperature = args.mode === "regenerate" ? 0.9 + attempt * 0.05 : 0.55 + attempt * 0.1;
    result = await generatePostDetailed(
      args.signals,
      args.styleSample,
      buildPrompt({
        targetDate: args.targetDate,
        latestPostText: args.latestPostText,
        oldPost: args.oldPost,
        mode: args.mode || "fresh",
        customInstructions: attempt === 0
          ? args.customInstructions
          : [
              ...(args.customInstructions || []),
              "이번 결과는 부족했습니다. 주제 키워드와 실제 예시를 더 분명하게 반영해 다시 작성합니다.",
              args.oldPost ? "기존 초안과 더 다르게 써야 합니다." : "",
            ].filter(Boolean),
        seed: `${Date.now()}-${attempt}`,
      }),
      { temperature: Math.min(1, temperature) },
    );

    if (result.provider !== "openai") break;

    const themeOk = isPostMatchingPostingTheme(args.targetDate, result.post);
    const differentEnough = args.oldPost ? normalizePost(result.post) !== normalizePost(args.oldPost) : true;
    if (themeOk && differentEnough) return result;
  }

  if (result.provider === "openai" && args.oldPost && normalizePost(result.post) === normalizePost(args.oldPost)) {
    result = {
      ...result,
      post: forceDifferentHook(result.post, args.oldPost),
    };
  }

  return result;
}
