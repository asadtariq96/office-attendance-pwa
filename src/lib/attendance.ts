import { listWorkingDaysInMonth, parseISODate, todayISO } from './dates';
import type { DayMark } from './storage';

export type MonthStats = {
  workingDays: number;
  required: number;
  officeCount: number;
  remaining: number;
  met: boolean;
  /** Behind | On track | Done */
  status: 'Behind' | 'On track' | 'Done';
  suggested: string[];
};

/**
 * Even-spread suggestion algorithm
 * --------------------------------
 * Given remaining R needed and candidate working days C (today + future unmarked
 * working days in the month), pick R days that maximize spacing across the span
 * of candidates.
 *
 * Approach: place R picks at even fractional positions along the candidate list
 * indices: index_i = round(i * (C.length - 1) / (R - 1)) for R > 1, or the
 * midpoint when R === 1. When existing confirmed office days exist, we still
 * only choose from unmarked candidates, but we bias toward maximizing minimum
 * distance from already-scheduled office days via a greedy farthest-point
 * refinement when multiple candidates share the same even slot.
 *
 * Concrete steps:
 * 1. Build candidates = working days in month with date >= today and no mark.
 * 2. If R <= 0 or candidates empty → [].
 * 3. If R >= candidates.length → all candidates.
 * 4. Seed picks at even intervals along the candidate index range.
 * 5. Deduplicate; if short, fill greedily with the candidate farthest (in day
 *    distance) from the union of picks ∪ existing office days.
 */
export function suggestEvenlySpacedDays(
  candidates: string[],
  remaining: number,
  existingOfficeDays: string[],
): string[] {
  const R = remaining;
  if (R <= 0 || candidates.length === 0) return [];
  if (R >= candidates.length) return [...candidates];

  const officeSet = new Set(existingOfficeDays);
  const candidateIndex = new Map(candidates.map((d, i) => [d, i]));

  // Even interval seeds along the candidate list
  const picks: string[] = [];
  const used = new Set<string>();
  if (R === 1) {
    const mid = candidates[Math.floor((candidates.length - 1) / 2)];
    picks.push(mid);
    used.add(mid);
  } else {
    for (let i = 0; i < R; i++) {
      const idx = Math.round((i * (candidates.length - 1)) / (R - 1));
      const day = candidates[idx];
      if (!used.has(day)) {
        picks.push(day);
        used.add(day);
      }
    }
  }

  const dayNumber = (iso: string) => parseISODate(iso).getTime();

  const minDistToScheduled = (iso: string, scheduled: string[]): number => {
    if (scheduled.length === 0) return Number.POSITIVE_INFINITY;
    const t = dayNumber(iso);
    let best = Number.POSITIVE_INFINITY;
    for (const s of scheduled) {
      best = Math.min(best, Math.abs(t - dayNumber(s)));
    }
    return best;
  };

  // Fill any shortfall greedily: farthest from picks ∪ existing office days
  while (picks.length < R) {
    let bestDay: string | null = null;
    let bestScore = -1;
    const scheduled = [...picks, ...existingOfficeDays];
    for (const c of candidates) {
      if (used.has(c)) continue;
      // Prefer days far from scheduled; slight preference for central even slots
      const dist = minDistToScheduled(c, scheduled);
      const centrality = 1 - Math.abs((candidateIndex.get(c) ?? 0) - (candidates.length - 1) / 2) / candidates.length;
      const score = dist + centrality * 86_400_000 * 0.01; // tiny tie-break
      if (score > bestScore) {
        bestScore = score;
        bestDay = c;
      }
    }
    if (!bestDay) break;
    picks.push(bestDay);
    used.add(bestDay);
  }

  // Optional refinement: for each pick, try swapping with unused candidate if
  // it improves minimum distance to (other picks ∪ office).
  const scheduledBase = [...officeSet];
  for (let i = 0; i < picks.length; i++) {
    const others = picks.filter((_, j) => j !== i);
    const currentMin = minDistToScheduled(picks[i], [...others, ...scheduledBase]);
    let improved = picks[i];
    let improvedMin = currentMin;
    for (const c of candidates) {
      if (used.has(c) && c !== picks[i]) continue;
      if (c === picks[i]) continue;
      const m = minDistToScheduled(c, [...others, ...scheduledBase]);
      if (m > improvedMin) {
        improvedMin = m;
        improved = c;
      }
    }
    if (improved !== picks[i]) {
      used.delete(picks[i]);
      used.add(improved);
      picks[i] = improved;
    }
  }

  return picks.sort();
}

export function computeMonthStats(
  year: number,
  monthIndex: number,
  marks: Record<string, DayMark>,
  today: string = todayISO(),
): MonthStats {
  const working = listWorkingDaysInMonth(year, monthIndex);
  const workingDays = working.length;
  const required = Math.ceil(0.6 * workingDays);
  const officeDays = working.filter((d) => marks[d] === 'office');
  const officeCount = officeDays.length;
  const remaining = Math.max(0, required - officeCount);
  const met = officeCount >= required;

  const candidates = working.filter((d) => d >= today && marks[d] === undefined);
  const suggested = suggestEvenlySpacedDays(candidates, remaining, officeDays);

  let status: MonthStats['status'];
  if (met) {
    status = 'Done';
  } else {
    // On track if remaining suggestions can still cover need (enough candidates)
    // and we're not behind the even pace relative to elapsed working days.
    const elapsed = working.filter((d) => d < today);
    const elapsedOffice = elapsed.filter((d) => marks[d] === 'office').length;
    const expectedByNow = elapsed.length === 0 ? 0 : Math.ceil(0.6 * elapsed.length);
    const canStillMeet = candidates.length >= remaining;
    if (!canStillMeet || elapsedOffice < expectedByNow) {
      status = 'Behind';
    } else {
      status = 'On track';
    }
  }

  return {
    workingDays,
    required,
    officeCount,
    remaining,
    met,
    status,
    suggested,
  };
}
