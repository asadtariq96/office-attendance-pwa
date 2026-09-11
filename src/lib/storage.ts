export type DayMark = 'office' | 'not_office';

export type AttendanceStore = {
  /** YYYY-MM-DD → mark. Unset days are omitted. */
  marks: Record<string, DayMark>;
};

const STORAGE_KEY = 'office-attendance-pwa:v1';

export function loadStore(): AttendanceStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { marks: {} };
    const parsed = JSON.parse(raw) as AttendanceStore;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.marks !== 'object') {
      return { marks: {} };
    }
    return { marks: parsed.marks ?? {} };
  } catch {
    return { marks: {} };
  }
}

export function saveStore(store: AttendanceStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function cycleMark(current: DayMark | undefined): DayMark | undefined {
  // unset → office → not_office → unset
  if (current === undefined) return 'office';
  if (current === 'office') return 'not_office';
  return undefined;
}
