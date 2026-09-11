/** Finnish public holidays via Nager.Date, cached in localStorage. */

export type Holiday = {
  date: string; // YYYY-MM-DD
  localName: string;
  name: string;
};

type CacheShape = {
  byYear: Record<string, Holiday[]>;
  fetchedAt: Record<string, number>;
};

const CACHE_KEY = 'office-attendance-pwa:fi-holidays:v1';
const TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

type NagerHoliday = {
  date: string;
  localName: string;
  name: string;
  types?: string[];
};

function loadCache(): CacheShape {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return { byYear: {}, fetchedAt: {} };
    const parsed = JSON.parse(raw) as CacheShape;
    if (!parsed?.byYear) return { byYear: {}, fetchedAt: {} };
    return { byYear: parsed.byYear ?? {}, fetchedAt: parsed.fetchedAt ?? {} };
  } catch {
    return { byYear: {}, fetchedAt: {} };
  }
}

function saveCache(cache: CacheShape): void {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

function isFresh(cache: CacheShape, year: number): boolean {
  const at = cache.fetchedAt[String(year)];
  if (!at) return false;
  return Date.now() - at < TTL_MS;
}

async function fetchYear(year: number): Promise<Holiday[]> {
  const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/FI`);
  if (!res.ok) throw new Error(`Holiday fetch failed: ${res.status}`);
  const data = (await res.json()) as NagerHoliday[];
  return data
    .filter((h) => !h.types || h.types.includes('Public'))
    .map((h) => ({ date: h.date, localName: h.localName, name: h.name }));
}

/** Ensure holidays for the given years are cached; returns a date→Holiday map. */
export async function ensureFinnishHolidays(years: number[]): Promise<Record<string, Holiday>> {
  const cache = loadCache();
  const unique = [...new Set(years)];
  await Promise.all(
    unique.map(async (year) => {
      if (isFresh(cache, year) && cache.byYear[String(year)]) return;
      try {
        const list = await fetchYear(year);
        cache.byYear[String(year)] = list;
        cache.fetchedAt[String(year)] = Date.now();
      } catch {
        if (!cache.byYear[String(year)]) cache.byYear[String(year)] = [];
      }
    }),
  );
  saveCache(cache);

  const map: Record<string, Holiday> = {};
  for (const year of unique) {
    for (const h of cache.byYear[String(year)] ?? []) {
      map[h.date] = h;
    }
  }
  return map;
}
