const KST_TIME_ZONE = "Asia/Seoul";
const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function dateParts(baseDate: Date): { year: string; month: string; day: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(baseDate);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: values.year,
    month: values.month,
    day: values.day,
  };
}

function timeParts(baseDate: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: KST_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(baseDate);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    hour: Number(values.hour || "0"),
    minute: Number(values.minute || "0"),
  };
}

export function kstDate(offsetDays = 0, baseDate = new Date()): string {
  const shifted = new Date(baseDate.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  const { year, month, day } = dateParts(shifted);
  return `${year}-${month}-${day}`;
}

export function kstWeekday(baseDate = new Date()): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: KST_TIME_ZONE,
    weekday: "short",
  }).format(baseDate);
  return WEEKDAY_MAP[weekday] ?? 0;
}

export function isKstWeekend(baseDate = new Date()): boolean {
  const weekday = kstWeekday(baseDate);
  return weekday === 0 || weekday === 6;
}

export function nextPostingDate(offsetBusinessDays = 1, baseDate = new Date()): string {
  let cursor = new Date(baseDate);
  let remaining = Math.max(0, offsetBusinessDays);

  while (remaining > 0) {
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    if (isKstWeekend(cursor)) continue;
    remaining -= 1;
  }

  if (offsetBusinessDays === 0 && isKstWeekend(cursor)) {
    do {
      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    } while (isKstWeekend(cursor));
  }

  return kstDate(0, cursor);
}

export function scheduledPostingDate(baseDate = new Date(), postingHourKst = 9): string {
  if (isKstWeekend(baseDate)) {
    return nextPostingDate(0, baseDate);
  }
  const { hour } = timeParts(baseDate);
  if (hour < postingHourKst) {
    return kstDate(0, baseDate);
  }
  return nextPostingDate(1, baseDate);
}
