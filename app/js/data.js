// data.js — loads the guide's own JSON files (same origin, no network beyond the app's server).

/** Fetch and validate trophies.json + roadmap.json; returns {trophies, byId, roadmap}. */
export async function loadGuideData() {
  const [trophiesRes, roadmapRes] = await Promise.all([
    fetch('data/trophies.json'),
    fetch('data/roadmap.json'),
  ]);
  if (!trophiesRes.ok || !roadmapRes.ok) throw new Error('guide data files are missing');
  const trophiesDoc = await trophiesRes.json();
  const roadmap = await roadmapRes.json();
  const trophies = Array.isArray(trophiesDoc) ? trophiesDoc : trophiesDoc.trophies;
  if (!Array.isArray(trophies) || trophies.length === 0) throw new Error('trophies.json holds no trophies array');
  for (const t of trophies) {
    if (typeof t.name !== 'string' || typeof t.guide !== 'string' || !t.guide.trim()) {
      throw new Error('every trophy needs a name and a non-blank guide');
    }
  }
  const byId = new Map(trophies.map((t) => [t.id, t]));
  return { trophies, byId, roadmap, listVersion: trophiesDoc.listVersion ?? '' };
}