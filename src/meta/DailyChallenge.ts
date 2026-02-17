const SG_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Singapore',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function formatDateFromMs(nowMs: number): string {
  const parts = SG_DATE_FORMATTER.formatToParts(new Date(nowMs));
  let year = '0000';
  let month = '01';
  let day = '01';
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (part.type === 'year') {
      year = part.value;
    } else if (part.type === 'month') {
      month = part.value;
    } else if (part.type === 'day') {
      day = part.value;
    }
  }
  return `${year}-${month}-${day}`;
}

export function getSingaporeDateKey(nowMs = Date.now()): string {
  return formatDateFromMs(nowMs);
}

export function getSingaporeDateKeyWithOffset(offsetDays: number, nowMs = Date.now()): string {
  const roundedOffset = Math.floor(offsetDays);
  const targetMs = nowMs + roundedOffset * 24 * 60 * 60 * 1000;
  return formatDateFromMs(targetMs);
}

export function seedFromDateKey(dateKey: string): number {
  let hash = 0x811c9dc5 >>> 0;
  for (let i = 0; i < dateKey.length; i += 1) {
    hash ^= dateKey.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function getDailySeed(nowMs = Date.now()): { dateKey: string; seed: number } {
  const dateKey = getSingaporeDateKey(nowMs);
  return {
    dateKey,
    seed: seedFromDateKey(dateKey),
  };
}
