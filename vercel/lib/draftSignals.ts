import type { Signal } from "./types";
import type { WriteMode } from "./writeMode";

type DbLike = any;

export async function loadDirectSignals(db: DbLike, limit = 120): Promise<Signal[]> {
  const since = new Date();
  since.setDate(since.getDate() - 180);
  const { data: manualRows } = await db
    .from("signals")
    .select("source_name,source_url,title,link,published_at,airline,role,summary,confidence,created_at")
    .eq("source_name", "manual-upload")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(1000);
  return ((manualRows || []) as Signal[]).slice(0, limit);
}

export async function loadSignalsForDraft(
  db: DbLike,
  writeMode: WriteMode,
  sourceJson: Signal[] | null | undefined,
  limit = 120,
): Promise<{ signals: Signal[]; sourceType: "manual-upload" | "crawl-signals" }> {
  if (writeMode === "direct") {
    return {
      signals: await loadDirectSignals(db, limit),
      sourceType: "manual-upload",
    };
  }

  return {
    signals: (sourceJson || []).slice(0, limit),
    sourceType: "crawl-signals",
  };
}
