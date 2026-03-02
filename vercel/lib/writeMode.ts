export type WriteMode = "crawl" | "direct";

const ROWS = {
  crawl: { name: "__write_mode_crawl", url: "manual://mode/crawl" },
  direct: { name: "__write_mode_direct", url: "manual://mode/direct" },
} as const;

export async function getWriteMode(db: any): Promise<WriteMode> {
  const { data } = await db
    .from("sources")
    .select("url,enabled")
    .in("url", [ROWS.crawl.url, ROWS.direct.url]);

  const rows = (data || []) as Array<{ url: string; enabled: boolean }>;
  const directOn = rows.some((r) => r.url === ROWS.direct.url && r.enabled);
  return directOn ? "direct" : "crawl";
}

export async function setWriteMode(db: any, mode: WriteMode): Promise<{ ok: boolean; error?: string }> {
  const rows = [
    { ...ROWS.crawl, enabled: mode === "crawl" },
    { ...ROWS.direct, enabled: mode === "direct" },
  ];
  const { error } = await db.from("sources").upsert(rows, { onConflict: "url" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
