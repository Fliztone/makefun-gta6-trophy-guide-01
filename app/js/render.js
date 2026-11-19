// render.js — every view's renderer: progress header, kind chips, trophy list,
// the guide detail panel (with its cited sources), the roadmap and the missables view.

import { el, clear, gemSVG, formatCount } from './dom.js';
import { KINDS, isMasked, matchesFilters, kindCounts } from './filters.js';

const MASK_NAME = '▓▓▓▓▓ ▓▓▓▓▓▓';
const MASK_DESC = 'Story trophy — hidden by Spoiler-safe mode. Mark it earned to reveal.';

function badge(text, cls) {
  return el('span', { class: `badge ${cls}`, text });
}

function trophyBadges(trophy) {
  const badges = [badge(trophy.kind, `kind-${trophy.kind}`)];
  if (trophy.hidden === true) badges.push(badge('Hidden', 'hidden-b'));
  if (trophy.missable === 'potential') badges.push(badge('Missable risk', 'missable-b'));
  if (trophy.unverified) badges.push(badge('Unverified', 'unverified-b'));
  if (trophy.count) badges.push(badge(formatCount(trophy.count), 'count-b'));
  return badges;
}

/** Header progress: percent, bar, earned count and per-grade pills. */
export function renderProgress(node, trophies, tracker) {
  const total = trophies.length;
  const done = tracker.earnedCount();
  const pct = total ? Math.round((done / total) * 100) : 0;
  const grades = ['platinum', 'gold', 'silver', 'bronze'];
  const pills = grades.map((g) => {
    const ofGrade = trophies.filter((t) => t.grade === g);
    const got = ofGrade.filter((t) => tracker.isEarned(t.id)).length;
    return el('span', { class: `grade-pill g-${g}` }, [el('b', { text: `${got}/${ofGrade.length}` }), ` ${g}`]);
  });
  clear(node).append(
    el('div', { class: 'progress-top' }, [
      el('span', { class: 'progress-pct', text: `${pct}%` }),
      el('span', { class: 'progress-count', text: `${done} of ${total} trophies earned · saved in this browser` }),
    ]),
    el('div', { class: 'progress-bar' }, [el('div', { class: 'progress-fill', style: `width:${pct}%` })]),
    el('div', { class: 'grade-pills' }, pills),
  );
}

/** The kind filter chips with live counts. */
export function renderChips(node, trophies, state, tracker, spoilerOn, onPick) {
  const counts = kindCounts(trophies, state, tracker, spoilerOn);
  clear(node);
  for (const kind of KINDS) {
    const chip = el('button', {
      type: 'button',
      class: `chip${state.kind === kind.id ? ' active' : ''}${kind.id === 'missable' ? ' warn-chip' : ''}`,
      'aria-pressed': state.kind === kind.id ? 'true' : 'false',
      onclick: () => onPick(kind.id),
    }, [kind.label, el('span', { class: 'n', text: String(counts[kind.id] ?? 0) })]);
    node.append(chip);
  }
}

/** One trophy row: tick, grade gem, name + official description, badges. */
function trophyRow(trophy, tracker, spoilerOn, selectedId, onSelect, onToggle) {
  const masked = isMasked(trophy, tracker, spoilerOn);
  const earned = tracker.isEarned(trophy.id);
  const row = el('li');
  const button = el('button', {
    type: 'button',
    class: `trow${earned ? ' earned' : ''}${selectedId === trophy.id ? ' selected' : ''}`,
    onclick: () => onSelect(trophy.id),
  }, [
    el('span', {
      class: 'tick',
      role: 'checkbox',
      'aria-checked': earned ? 'true' : 'false',
      'aria-label': `Mark ${masked ? 'story trophy' : trophy.name} ${earned ? 'not earned' : 'earned'}`,
      tabindex: '0',
      text: '✓',
      onclick: (event) => { event.stopPropagation(); onToggle(trophy.id); },
      onkeydown: (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onToggle(trophy.id); } },
    }),
    gemSVG(trophy.grade),
    el('span', { class: 'tmain' }, [
      el('span', { class: `tname${masked ? ' masked' : ''}`, text: masked ? MASK_NAME : trophy.name }),
      el('span', { class: `tdesc${masked ? ' masked' : ''}`, text: masked ? MASK_DESC : trophy.description }),
    ]),
    el('span', { class: 'tbadges' }, trophyBadges(trophy)),
  ]);
  row.append(button);
  return row;
}

/** The checklist: rows for every trophy passing the filters, plus the count line. */
export function renderList(listNode, headNode, trophies, state, tracker, spoilerOn, selectedId, onSelect, onToggle) {
  const passing = trophies.filter((t) => matchesFilters(t, state, tracker, spoilerOn));
  clear(headNode).append(
    `Showing ${passing.length} of ${trophies.length} trophies · ${tracker.earnedCount()} earned`,
    state.kind !== 'all' ? ` · filter: ${state.kind}` : '',
    state.grade !== 'all' ? ` · grade: ${state.grade}` : '',
    state.query.trim() ? ` · search: “${state.query.trim()}”` : '',
  );
  clear(listNode);
  if (passing.length === 0) {
    const message = state.kind === 'online'
      ? 'No online trophies: all 55 GTA VI trophies are offline single-player (PowerPyx). The partner trophies — Hot Together and Retail Therapy — use the story partner, not GTA Online.'
      : 'No trophies match the current filters. Clear the search or pick another kind.';
    listNode.append(el('li', { class: 'empty-state', text: message }));
    return;
  }
  for (const trophy of passing) {
    listNode.append(trophyRow(trophy, tracker, spoilerOn, selectedId, onSelect, onToggle));
  }
}

/** The detail panel: official description, the cited guide, steps and sources. */
export function renderDetail(node, trophy, tracker, spoilerOn, onToggle) {
  clear(node);
  if (!trophy) {
    node.append(el('p', { class: 'detail-empty', text: 'Select a trophy to read its guide, steps and sources.' }));
    return;
  }
  const masked = isMasked(trophy, tracker, spoilerOn);
  const earned = tracker.isEarned(trophy.id);
  node.append(
    el('div', { class: 'detail-head' }, [
      gemSVG(trophy.grade),
      el('div', {}, [
        el('h2', { class: 'detail-title', text: masked ? MASK_NAME : trophy.name }),
        el('div', { class: `detail-grade ${trophy.grade}`, text: `${trophy.grade} trophy${trophy.hidden === true ? ' · hidden on PSN' : ''}` }),
      ]),
    ]),
    el('div', { class: 'detail-badges' }, trophyBadges(trophy)),
    el('blockquote', { class: 'official-desc' }, [
      el('span', { class: 'lbl', text: 'Official PlayStation description' }),
      masked ? MASK_DESC : trophy.description,
    ]),
  );
  if (masked) {
    node.append(
      el('p', { class: 'section-lbl', text: 'Guide' }),
      el('p', { class: 'masked-note', text: 'The guide is hidden too — it names story missions. Mark the trophy earned (or switch off Spoiler-safe) to read it.' }),
    );
    return;
  }
  node.append(el('p', { class: 'section-lbl', text: 'Guide', id: 'detail-guide-label' }), el('p', { class: 'detail-guide', text: trophy.guide }));
  if (trophy.unverified) {
    node.append(el('p', { class: 'unverified-note', text: 'Unverified at launch: no confirmed method in the cited sources yet. This guide says what is known and marks the rest as speculation — check the sources for updates.' }));
  }
  if (Array.isArray(trophy.steps) && trophy.steps.length) {
    node.append(el('p', { class: 'section-lbl', text: 'Steps' }), el('ol', { class: 'detail-steps' }, trophy.steps.map((s) => el('li', { text: s }))));
  }
  node.append(
    el('p', { class: 'section-lbl', text: 'Sources' }),
    el('ul', { class: 'source-list' }, (trophy.sources ?? []).map((s) =>
      el('li', {}, [el('a', { href: s.url, target: '_blank', rel: 'noopener', text: s.label })]),
    )),
    el('div', { class: 'detail-actions' }, [
      el('button', {
        type: 'button',
        class: `mark-btn${earned ? ' earned' : ''}`,
        text: earned ? '✓ Earned — click to unmark' : 'Mark as earned',
        onclick: () => onToggle(trophy.id),
      }),
    ]),
  );
}

/** A clickable trophy chip used by the roadmap; masked under spoiler-safe mode. */
function trophyChip(trophy, tracker, spoilerOn, onJump) {
  const masked = isMasked(trophy, tracker, spoilerOn);
  return el('button', {
    type: 'button',
    class: `tchip${tracker.isEarned(trophy.id) ? ' done' : ''}${masked ? ' masked' : ''}`,
    title: masked ? 'Hidden story trophy' : trophy.description,
    onclick: () => onJump(trophy.id),
  }, [gemSVG(trophy.grade), masked ? MASK_NAME : trophy.name]);
}

/** The roadmap view: meta cards, then the ordered stages with warnings and tips. */
export function renderRoadmap(node, roadmap, byId, tracker, spoilerOn, onJump) {
  clear(node);
  const m = roadmap.meta;
  const card = (k, v, sub, hot) => el('div', { class: `meta-card${hot ? ' hot' : ''}` }, [
    el('div', { class: 'k', text: k }),
    el('div', { class: 'v' }, [v, sub ? el('small', { text: sub }) : null]),
  ]);
  node.append(el('div', { class: 'road-meta' }, [
    card('Difficulty', m.difficultyShort, 'PowerPyx estimate · no difficulty settings'),
    card('Time to platinum', m.timeShort, 'Story 60–80 h · cleanup ~100 h (PowerPyx)'),
    card('Missable trophies', m.missableShort, 'Positive Mental Attitude — Ch. 1 meditation', true),
    card('Online trophies', `${m.onlineTrophies} of ${m.offlineTrophies}`, 'Fully offline · 0 glitched reported at launch'),
    card('Mission replay', m.replayShort, 'No mission gold medals either — keep manual saves'),
    card('100% checklist', m.hundredShort, 'Unlocks post-story · nothing it needs is missable'),
  ]));
  for (const stage of roadmap.stages) {
    const cards = stage.trophyIds.map((id) => byId.get(id)).filter(Boolean).map((t) => trophyChip(t, tracker, spoilerOn, onJump));
    node.append(el('article', { class: 'stage', id: `stage-${stage.id}` }, [
      el('div', { class: 'stage-head' }, [
        el('span', { class: 'stage-num', text: `STEP ${stage.id}` }),
        el('h2', { class: 'stage-title', text: stage.title }),
        el('span', { class: 'stage-hours', text: stage.hours }),
      ]),
      el('p', { class: 'stage-summary', text: stage.summary }),
      el('div', { class: 'stage-trophies' }, cards),
      ...stage.warnings.map((w) => el('p', { class: 'stage-warn', text: `⚠ ${w}` })),
      ...stage.tips.map((t) => el('p', { class: 'stage-tip', text: t })),
    ]));
  }
  node.append(el('p', { class: 'fine' }, ['Roadmap built from the official trophy descriptions and: ', ...m.sources.map((s, i) => [i ? ' · ' : '', el('a', { href: s.url, target: '_blank', rel: 'noopener', text: s.label })])]));
}

/** The missables view: the one at-risk trophy in full, plus what is safe and why. */
export function renderMissables(node, trophies, roadmap, tracker, spoilerOn, onJump) {
  clear(node);
  const risky = trophies.filter((t) => t.missable === 'potential');
  node.append(el('div', { class: 'miss-hero' }, [
    el('h2', { text: `Missable trophies: ${risky.length} at risk out of 55` }),
    el('p', { text: roadmap.meta.missableTrophies }),
    el('p', { text: 'Basis: the official descriptions plus PowerPyx’s launch roadmap, which reports potentially one missable trophy and zero glitched trophies. Everything the 100% checklist requires can be done after the story in free-roam.' }),
  ]));
  for (const trophy of risky) {
    const masked = isMasked(trophy, tracker, spoilerOn);
    node.append(el('article', { class: 'stage' }, [
      el('div', { class: 'stage-head' }, [
        gemSVG(trophy.grade),
        el('h2', { class: 'stage-title', text: masked ? MASK_NAME : trophy.name }),
        el('span', { class: 'stage-hours', text: `${trophy.grade} · ${trophy.kind}` }),
      ]),
      el('blockquote', { class: 'official-desc' }, [el('span', { class: 'lbl', text: 'Official PlayStation description' }), trophy.description]),
      el('p', { class: 'detail-guide', text: trophy.guide }),
      trophy.steps ? el('ol', { class: 'detail-steps' }, trophy.steps.map((s) => el('li', { text: s }))) : null,
      el('p', { class: 'section-lbl', text: 'Sources' }),
      el('ul', { class: 'source-list' }, (trophy.sources ?? []).map((s) => el('li', {}, [el('a', { href: s.url, target: '_blank', rel: 'noopener', text: s.label })]))),
      el('div', { class: 'detail-actions' }, [el('button', { type: 'button', class: 'mark-btn', text: 'Open in checklist', onclick: () => onJump(trophy.id) })]),
    ]));
  }
  node.append(el('div', { class: 'safe-card' }, [
    el('h3', { text: 'Everything else is safe — here is why' }),
    el('ul', {}, [
      el('li', { text: 'Story trophies (chapters, missions, heists) unlock automatically during their missions — they cannot be missed, and there are no mission gold medals to fail.' }),
      el('li', { text: 'Character questlines (Andy, Kenton, Billy, Randy, Tyrone, Bret, Cal) and all qualifying Strangers & Freaks strands remain available in post-story free-roam; later missions arrive by phone/text after in-game time passes.' }),
      el('li', { text: 'Gang Operations respawn after a long cooldown if you missed a key valuable (e.g. the Kingpin Bowling loot for Let’s Go Bowling).' }),
      el('li', { text: 'Time-sensitive optional missions (hourglass icon) — like Shirley’s Chapter 1 errands and Yago’s Race Against Yago — are missable content, but PowerPyx confirms they affect neither trophies nor 100% completion.' }),
      el('li', { text: 'GTA VI has no mission replay: keep a manual save at each chapter boundary if you want to revisit story moments (not needed for any trophy).' }),
    ]),
    el('p', {}, ['Sources: ', el('a', { href: 'https://www.powerpyx.com/gta-6-grand-theft-auto-vi-trophy-guide-roadmap', target: '_blank', rel: 'noopener', text: 'PowerPyx Trophy Guide & Roadmap' }), ' · ', el('a', { href: 'https://www.powerpyx.com/gta-6-full-walkthrough-all-missions', target: '_blank', rel: 'noopener', text: 'PowerPyx Full Walkthrough' }), ' · ', el('a', { href: 'https://www.powerpyx.com/gta-6-hit-kingpin-bowling-walkthrough', target: '_blank', rel: 'noopener', text: 'Hit Kingpin Bowling walkthrough' })]),
  ]));
}