// dom.js — tiny DOM helpers shared by the renderers. No framework, no build step.

/** Create an element with attributes and children (strings become text nodes). */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (value === true) node.setAttribute(key, '');
    else if (value !== false && value != null) node.setAttribute(key, String(value));
  }
  for (const child of [].concat(children)) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** Remove all children of a node. */
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

const GRADE_COLORS = { platinum: '#e2e8f0', gold: '#fbbf24', silver: '#c3cde0', bronze: '#d9915b' };

/** An original trophy glyph (inline SVG, drawn for this app — not game artwork). */
export function gemSVG(grade) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'gem');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('fill', GRADE_COLORS[grade] ?? '#94a3c4');
  path.setAttribute('d', 'M7 2h10v2h4v3a4 4 0 0 1-4 4h-.4A5 5 0 0 1 13 13.9V16h3v2h1v3H7v-3h1v-2h3v-2.1A5 5 0 0 1 7.4 11H7a4 4 0 0 1-4-4V4h4zm-2 4v1a2 2 0 0 0 2 2V6zm14 0h-2v3a2 2 0 0 0 2-2z');
  svg.append(path);
  return svg;
}

/** Format a tracked count for a badge: money counts get $ and separators. */
export function formatCount(count) {
  if (count >= 1000) return '$' + String(count).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return '×' + count;
}