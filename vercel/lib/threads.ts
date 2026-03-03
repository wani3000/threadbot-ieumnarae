const GRAPH_BASE = (process.env.THREADS_GRAPH_BASE || "https://graph.threads.net").replace(/\/$/, "");

function splitSlides(postText: string): string[] {
  const lines = postText.split("\n");
  const numberedSlides: string[] = [];
  let buf: string[] = [];
  const numbering = /^\s*([1-5])\s*\/\s*5\s*$/;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line && buf.length === 0) continue;
    buf.push(line);
    if (numbering.test(line.trim())) {
      const text = buf.join("\n").trim();
      if (text) numberedSlides.push(text);
      buf = [];
    }
  }

  if (buf.length > 0) {
    const tail = buf.join("\n").trim();
    if (tail) numberedSlides.push(tail);
  }

  if (numberedSlides.length >= 2) return numberedSlides;

  return postText
    .split(/\n\s*\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
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
  const slides = splitSlides(postText);

  if (slides.length > 1) {
    let replyToId: string | undefined;
    const publishedIds: string[] = [];
    const detachedIndices: number[] = [];
    for (let i = 0; i < slides.length; i += 1) {
      const text = slides[i];
      let create = await createTextContainer(token, text, replyToId);
      let creationId = (create.json as { id?: string })?.id;

      if ((!create.ok || !creationId) && replyToId && isMediaNotFound(create.json)) {
        await sleep(1500);
        create = await createTextContainer(token, text, replyToId);
        creationId = (create.json as { id?: string })?.id;
      }
      if ((!create.ok || !creationId) && replyToId) {
        // Fallback: publish this slide as a standalone post instead of aborting all slides.
        create = await createTextContainer(token, text);
        creationId = (create.json as { id?: string })?.id;
        if (create.ok && creationId) detachedIndices.push(i);
      }
      if (!create.ok || !creationId) {
        return {
          ok: false,
          status: create.status,
          body: { step: "create_series", index: i, response: create.json },
        };
      }

      let publish = await publishContainer(token, creationId);
      let publishedId = (publish.json as { id?: string })?.id;
      if ((!publish.ok || !publishedId) && isMediaNotFound(publish.json)) {
        await sleep(1200);
        publish = await publishContainer(token, creationId);
        publishedId = (publish.json as { id?: string })?.id;
      }
      if ((!publish.ok || !publishedId) && isMediaNotFound(publish.json)) {
        // Fallback: recreate as standalone and publish, so a single failing reply chain does not abort all slides.
        const standaloneCreate = await createTextContainer(token, text);
        const standaloneCreationId = (standaloneCreate.json as { id?: string })?.id;
        if (standaloneCreate.ok && standaloneCreationId) {
          publish = await publishContainer(token, standaloneCreationId);
          publishedId = (publish.json as { id?: string })?.id;
          if (publish.ok && publishedId) detachedIndices.push(i);
        }
      }
      if (!publish.ok || !publishedId) {
        return {
          ok: false,
          status: publish.status,
          body: { step: "publish_series", index: i, response: publish.json },
        };
      }
      publishedIds.push(publishedId);
      replyToId = publishedId;
      await sleep(900);
    }
    return {
      ok: true,
      status: 200,
      body: { step: "publish_series", count: slides.length, ids: publishedIds, detached_indices: detachedIndices },
    };
  }

  // Single post fallback
  const create = await createTextContainer(token, postText);
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
