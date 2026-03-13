const TABLE = "app_settings";

type DbLike = any;

async function readAppSettingRow(db: DbLike, key: string): Promise<{ value_text: string | null } | null> {
  try {
    const { data, error } = await db.from(TABLE).select("value_text").eq("key", key).maybeSingle();
    if (error) throw error;
    return data || null;
  } catch (error) {
    console.warn(`[appSettings] read fallback for key=${key}`, error);
    return null;
  }
}

async function writeAppSettingRow(db: DbLike, key: string, valueText: string): Promise<boolean> {
  try {
    const { error } = await db.from(TABLE).upsert(
      {
        key,
        value_text: valueText,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
    if (error) throw error;
    return true;
  } catch (error) {
    console.warn(`[appSettings] write fallback for key=${key}`, error);
    return false;
  }
}

export async function getAppSettingText(
  db: DbLike,
  key: string,
  options?: { legacyUrl?: string; legacyEnabledAsBoolean?: boolean },
): Promise<string | null> {
  const direct = await readAppSettingRow(db, key);
  const text = direct?.value_text?.trim();
  if (text) return text;

  if (!options?.legacyUrl) return null;

  try {
    const query = options.legacyEnabledAsBoolean ? "name,enabled" : "name";
    const { data, error } = await db.from("sources").select(query).eq("url", options.legacyUrl).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    if (options.legacyEnabledAsBoolean) {
      return data.enabled ? "true" : "false";
    }
    const legacy = String(data.name || "").trim();
    return legacy || null;
  } catch (error) {
    console.warn(`[appSettings] legacy read failed for key=${key}`, error);
    return null;
  }
}

export async function setAppSettingText(
  db: DbLike,
  key: string,
  valueText: string,
  options?: { legacyUrl?: string; legacyEnabled?: boolean },
): Promise<void> {
  const wrote = await writeAppSettingRow(db, key, valueText);

  if (!options?.legacyUrl) {
    if (!wrote) throw new Error(`Failed to persist app setting: ${key}`);
    return;
  }

  const legacyRow = {
    name: valueText,
    url: options.legacyUrl,
    enabled: options.legacyEnabled ?? false,
  };

  const { error } = await db.from("sources").upsert(legacyRow, { onConflict: "url" });
  if (!wrote && error) {
    throw error;
  }
}
