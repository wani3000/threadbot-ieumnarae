import { getAppSettingText, setAppSettingText } from "./appSettings";

export type WriteMode = "crawl" | "direct";

const ROWS = {
  crawl: { name: "__write_mode_crawl", url: "manual://mode/crawl" },
  direct: { name: "__write_mode_direct", url: "manual://mode/direct" },
} as const;
const WRITE_MODE_KEY = "write_mode";

export async function getWriteMode(db: any): Promise<WriteMode> {
  const stored = await getAppSettingText(db, WRITE_MODE_KEY);
  if (stored === "crawl" || stored === "direct") return stored;

  const { data } = await db.from("sources").select("url,enabled").in("url", [ROWS.crawl.url, ROWS.direct.url]);
  const rows = (data || []) as Array<{ url: string; enabled: boolean }>;
  const directOn = rows.some((r) => r.url === ROWS.direct.url && r.enabled);
  return directOn ? "direct" : "crawl";
}

export async function setWriteMode(db: any, mode: WriteMode): Promise<{ ok: boolean; error?: string }> {
  try {
    await setAppSettingText(db, WRITE_MODE_KEY, mode);
    const rows = [
      { ...ROWS.crawl, enabled: mode === "crawl" },
      { ...ROWS.direct, enabled: mode === "direct" },
    ];
    const { error } = await db.from("sources").upsert(rows, { onConflict: "url" });
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
