// tracker.js — progress persistence (localStorage), export to a file and import back.

const STORAGE_KEY = 'leonida-legend-v1';

/** Create the tracker: earned marks plus the spoiler-safe setting, saved in the browser. */
export function createTracker(validIds) {
  const valid = new Set(validIds);
  let state = { earned: [], spoiler: false };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.earned)) state.earned = parsed.earned.filter((id) => valid.has(id));
      if (typeof parsed.spoiler === 'boolean') state.spoiler = parsed.spoiler;
    }
  } catch {
    // A corrupt store starts fresh rather than breaking the guide.
  }
  const earned = new Set(state.earned);

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ earned: [...earned].sort((a, b) => a - b), spoiler: state.spoiler }));
    } catch {
      // Private-browsing quota errors must not break tracking for the session.
    }
  }

  return {
    isEarned: (id) => earned.has(id),
    earnedCount: () => earned.size,
    toggle(id) {
      if (!valid.has(id)) return false;
      if (earned.has(id)) earned.delete(id);
      else earned.add(id);
      save();
      return earned.has(id);
    },
    setSpoiler(on) {
      state.spoiler = Boolean(on);
      save();
    },
    get spoiler() {
      return state.spoiler;
    },
    reset() {
      earned.clear();
      save();
    },
    /** The export document: a plain JSON file the reader keeps. */
    exportDoc() {
      return {
        app: 'leonida-legend',
        game: 'Grand Theft Auto VI (PS5)',
        version: 1,
        earned: [...earned].sort((a, b) => a - b),
        spoiler: state.spoiler,
        exportedAt: new Date().toISOString(),
      };
    },
    /** Import an export document; returns the number of marks restored, or throws on bad input. */
    importDoc(doc) {
      if (!doc || typeof doc !== 'object' || !Array.isArray(doc.earned)) throw new Error('not a Leonida Legend export (no earned array)');
      const ids = doc.earned.filter((id) => valid.has(id));
      earned.clear();
      for (const id of ids) earned.add(id);
      if (typeof doc.spoiler === 'boolean') state.spoiler = doc.spoiler;
      save();
      return ids.length;
    },
  };
}

/** Trigger a browser download of the progress document (no network involved). */
export function downloadProgress(doc) {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'leonida-legend-progress.json';
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}