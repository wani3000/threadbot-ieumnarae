const GRAPH_BASE = (process.env.THREADS_GRAPH_BASE || "https://graph.threads.net").replace(/\/$/, "");
const MAX_CHAIN = Number(process.env.THREADS_MAX_CHAIN || "8");
const MIN_SEGMENT_CHARS = Number(process.env.THREADS_MIN_SEGMENT_CHARS || "150");

function stripSlideNumbering(text: string): string {
  return text
    .replace(/\(?\b\d+\s*\/\s*\d+\b\)?/g, "")
    .replace(/다음\s*슬라이드/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitSlides(postText: string): string[] {
  const rawSlides = stripSlideNumbering(postText)
    .split(/\n\s*---\s*\n|\n\s*\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const minChars = Number.isFinite(MIN_SEGMENT_CHARS) && MIN_SEGMENT_CHARS > 0 ? MIN_SEGMENT_CHARS : 150;
  const merged: string[] = [];
  let buffer = "";

  for (const slide of rawSlides) {
    buffer = buffer ? `${buffer}\n\n${slide}` : slide;
    if (buffer.length >= minChars) {
      merged.push(buffer.trim());
      buffer = "";
    }
  }

  if (buffer) {
    if (merged.length > 0) {
      merged[merged.length - 1] = `${merged[merged.length - 1]}\n\n${buffer}`.trim();
    } else {
      merged.push(buffer.trim());
    }
  }

  return merged.slice(0, Number.isFinite(MAX_CHAIN) && MAX_CHAIN > 0 ? MAX_CHAIN : 8);
}

async function createTextContainer(token: string, text: string, replyToId?: string) {
  const createBody = new URLSearchParams({
    media_type: "TEXT",
    text,
  });
  if (replyToId) createBody.set("reply_to_id", replyToId);

  const createRes = await fetch(`${GRAPH_BASE}/me/threads`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: createBody.toString(),
  });
  const createJson = await createRes.json().catch(async () => ({ raw: await createRes.text() }));
  return { ok: createRes.ok, status: createRes.status, json: createJson };
}

async function publishContainer(token: string, creationId: string) {
  const publishBody = new URLSearchParams({ creation_id: creationId });
  const publishRes = await fetch(`${GRAPH_BASE}/me/threads_publish`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: publishBody.toString(),
  });
  const publishJson = await publishRes.json().catch(async () => ({ raw: await publishRes.text() }));
  return { ok: publishRes.ok, status: publishRes.status, json: publishJson };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isMediaNotFound(json: unknown): boolean {
  const err = (json as { error?: { code?: number; error_subcode?: number } })?.error;
  return err?.code === 24 || err?.error_subcode === 4279009;
}

export async function publishThreads(
  postText: string,
  tokenArg?: string,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const token = tokenArg || process.env.THREADS_PUBLISH_TOKEN || "";
  const safeText = stripSlideNumbering(postText);
  const slides = splitSlides(safeText);

  if (slides.length > 1) {
    let replyToId: string | undefined;
    const publishedIds: string[] = [];
    for (let i = 0; i < slides.length; i += 1) {
      const text = slides[i];
      let create = await createTextContainer(token, text, replyToId);
      let creationId = (create.json as { id?: string })?.id;

      if ((!create.ok || !creationId) && replyToId && isMediaNotFound(create.json)) {
        await sleep(1500);
        create = await createTextContainer(token, text, replyToId);
        creationId = (create.json as { id?: string })?.id;
      }
      if (!create.ok || !creationId) {
        return {
          ok: false,
          status: create.status,
          body: {
            step: "create_series",
            index: i,
            response: create.json,
            chained_reply_to_id: replyToId || null,
          },
        };
      }

      let publish = await publishContainer(token, creationId);
      let publishedId = (publish.json as { id?: string })?.id;
      if ((!publish.ok || !publishedId) && isMediaNotFound(publish.json)) {
        await sleep(1200);
        publish = await publishContainer(token, creationId);
        publishedId = (publish.json as { id?: string })?.id;
      }
      if (!publish.ok || !publishedId) {
        return {
          ok: false,
          status: publish.status,
          body: {
            step: "publish_series",
            index: i,
            response: publish.json,
            chained_reply_to_id: replyToId || null,
          },
        };
      }
      publishedIds.push(publishedId);
      replyToId = publishedId;
      await sleep(900);
    }
    return {
      ok: true,
      status: 200,
      body: { step: "publish_series", count: slides.length, ids: publishedIds },
    };
  }

  // Single post fallback
  const create = await createTextContainer(token, safeText);
  const createJson = create.json;
  const creationId = (createJson as { id?: string })?.id;

  if (!create.ok || !creationId) {
    return {
      ok: false,
      status: create.status,
      body: { step: "create", response: createJson },
    };
  }

  const publish = await publishContainer(token, creationId);
  const publishJson = publish.json;
  return {
    ok: publish.ok,
    status: publish.status,
    body: { step: "publish", response: publishJson },
  };
}
