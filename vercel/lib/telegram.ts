const TELEGRAM_API_BASE = "https://api.telegram.org";
const MAX_MESSAGE_LENGTH = 3500;

function normalizePreviewText(post: string): string[] {
  const sections = post
    .split(/\n\s*---\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (sections.length === 0) {
    return [post.trim()].filter(Boolean);
  }
  return sections;
}

function splitLongChunk(text: string, limit = MAX_MESSAGE_LENGTH): string[] {
  if (text.length <= limit) return [text];

  const out: string[] = [];
  let remaining = text;
  while (remaining.length > limit) {
    let cut = remaining.lastIndexOf("\n", limit);
    if (cut < limit * 0.5) cut = remaining.lastIndexOf(" ", limit);
    if (cut < limit * 0.5) cut = limit;
    out.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) out.push(remaining);
  return out;
}

function previewChunks(targetDate: string, post: string, editUrl: string): string[] {
  const header = [
    `[ieumnarae-threadbot] ${targetDate} 09:00 자동게시 예정 초안`,
    `수정 링크: ${editUrl}`,
    "",
  ].join("\n");

  const sections = normalizePreviewText(post).flatMap((section) => splitLongChunk(section));
  if (sections.length === 0) return [header.trim()];
  return sections.map((section, index) => (index === 0 ? `${header}${section}` : section));
}

async function sendTelegramMessage(token: string, chatId: string, text: string): Promise<void> {
  const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Telegram sendMessage failed (${res.status}): ${body}`);
  }

  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
  if (json.ok !== true) {
    throw new Error(`Telegram sendMessage error: ${json.description || "unknown"}`);
  }
}

export async function sendDraftTelegramPreview(params: {
  token: string;
  chatId: string;
  targetDate: string;
  post: string;
  editUrl: string;
}): Promise<{ count: number }> {
  const chunks = previewChunks(params.targetDate, params.post, params.editUrl);
  for (const chunk of chunks) {
    await sendTelegramMessage(params.token, params.chatId, chunk);
  }
  return { count: chunks.length };
}
