// filters.js — filter state and the predicate that decides which trophies a view shows.

export const KINDS = [
  { id: 'all', label: 'All' },
  { id: 'story', label: 'Story' },
  { id: 'missable', label: 'Missable' },
  { id: 'collectibles', label: 'Collectibles' },
  { id: 'activities', label: 'Activities' },
  { id: 'online', label: 'Online' },
  { id: 'meta', label: 'Meta' },
];

/** Fresh filter state (session-only; progress and the spoiler setting persist separately). */
export function createFilterState() {
  return { kind: 'all', grade: 'all', query: '', hideEarned: false };
}

/** A story trophy is masked while spoiler-safe mode is on and it is not earned. */
export function isMasked(trophy, tracker, spoilerOn) {
  return spoilerOn && trophy.kind === 'story' && !tracker.isEarned(trophy.id);
}

/** Does one trophy pass the active filters? Masked trophies never match a text query. */
export function matchesFilters(trophy, state, tracker, spoilerOn) {
  if (state.kind === 'missable') {
    if (trophy.missable !== 'potential') return false;
  } else if (state.kind === 'online') {
    if (trophy.kind !== 'online') return false;
  } else if (state.kind !== 'all' && trophy.kind !== state.kind) {
    return false;
  }
  if (state.grade !== 'all' && trophy.grade !== state.grade) return false;
  if (state.hideEarned && tracker.isEarned(trophy.id)) return false;
  const q = state.query.trim().toLowerCase();
  if (q) {
    if (isMasked(trophy, tracker, spoilerOn)) return false;
    const haystack = `${trophy.name} ${trophy.description} ${trophy.guide}`.toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

/** Counts per kind chip, respecting the grade/query/hide-earned filters but not the kind itself. */
export function kindCounts(trophies, state, tracker, spoilerOn) {
  const base = { ...state, kind: 'all' };
  const passing = trophies.filter((t) => matchesFilters(t, base, tracker, spoilerOn));
  const counts = { all: passing.length, missable: 0, online: 0 };
  for (const kind of ['story', 'collectibles', 'activities', 'meta']) counts[kind] = 0;
  for (const t of passing) {
    if (t.missable === 'potential') counts.missable += 1;
    if (t.kind === 'online') counts.online += 1;
    if (counts[t.kind] !== undefined) counts[t.kind] += 1;
  }
  return counts;
}