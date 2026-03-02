import OpenAI from "openai";
import type { Signal } from "./types";

export async function generatePost(signals: Signal[], styleSample: string): Promise<string> {
  if (signals.length === 0) {
    return "오늘은 공식 채용 업데이트가 확인되지 않았어요. 원문 공고를 수시로 확인하고 새로운 공지가 뜨면 바로 정리해드릴게요.";
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
          content:
            "당신은 전직 대한항공 승무원 출신 취업 코치 계정 라이터다. 사실 기반만 사용. 형식은 훅 문장 뒤에 첫 번째/두 번째/세 번째 포인트와 마무리 체크 문장. 350~650자, 과장 금지, 링크 1~2개 포함.",
        },
        {
          role: "user",
          content: `[스타일 샘플]\n${styleSample}\n\n[팩트]\n${facts}\n\n오늘 아침 게시 초안 1개 작성`,
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
  const body = top.map((s) => `- ${s.title}\n  ${s.link}`).join("\n");
  return (
    "오늘 업데이트된 항공사 채용 공지 핵심만 빠르게 정리할게요.\n" +
    "첫 번째 - 공식 채용 페이지 업데이트 여부를 먼저 확인하세요.\n" +
    "두 번째 - 지원 기간/자격요건은 공고 원문으로 재확인하세요.\n" +
    "세 번째 - 마감 임박 공고부터 우선 지원 전략을 세우세요.\n\n" +
    body +
    "\n\n원문 기준으로 준비하면 실수를 줄일 수 있어요."
  );
}
