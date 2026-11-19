// gta6-trophy-guide-01 entrypoint — Node 22, standard library only, no network.
//
// Hands the guide in: copies this repository's app/ and screenshots/ into the
// output directory (/output in the grader, $MAKEFUN_OUTPUT_DIR elsewhere) and
// writes dossier.json with the kit's vendored buildDossier, byte for byte as
// the scorer expects. The guide itself is plain static files under app/ that
// any static HTTP server can serve with app/ at its root.
//
// Before copying, it runs the preflight checks the gate cares about: the
// trophy file's structure, load-bearing references that reach the network,
// and the screenshots' formats, dimensions and sizes.
//
// Run locally:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's caps (RULES.txt "The gate"): app/ at most 993 entries and 48 MiB,
// 3-4 screenshots at most 256 KiB each (long side <= 1280, short side >= 480),
// dossier text capped at 160 KiB. buildDossier enforces these; pass the same numbers.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
} as const;

function fail(message: string): never {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

/** Normalize a trophy name the way the gate compares them: case, curly quotes,
 *  dash signs, the ellipsis and runs of whitespace set aside. */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The trophy file must name 55 distinct trophies, each with a non-blank guide. */
function checkTrophyFile(appDir: string): number {
  const file = join(appDir, 'data', 'trophies.json');
  if (!existsSync(file)) fail('app/data/trophies.json is missing');
  const doc = JSON.parse(readFileSync(file, 'utf8'));
  const trophies = Array.isArray(doc) ? doc : doc.trophies;
  if (!Array.isArray(trophies)) fail('trophies.json must hold a trophies array');
  const seen = new Set<string>();
  for (const t of trophies) {
    if (typeof t?.name !== 'string' || !t.name.trim()) fail('a trophy has no name');
    if (typeof t?.guide !== 'string' || !t.guide.trim()) fail(`trophy "${t.name}" has a blank guide`);
    const key = normalizeName(t.name);
    if (seen.has(key)) fail(`duplicate trophy name: ${t.name}`);
    seen.add(key);
  }
  if (trophies.length !== 55) fail(`trophies.json holds ${trophies.length} trophies, the official list has 55`);
  return trophies.length;
}

/** Walk app/ and refuse any load-bearing reference that reaches the network.
 *  Anchor hrefs (citations) are not load references and are allowed. */
function checkReferences(appDir: string): void {
  const htmlPattern = /<(?:script|link|img|iframe|source|video|audio|track|embed|object|input)\b[^>]*\b(?:src|href|poster|data)\s*=\s*["']\s*(?:https?:|\/\/)/gi;
  const cssPattern = /(?:url\(\s*["']?|@import\s+["'])\s*(?:https?:|\/\/)/gi;
  const jsPattern = /(?:\bfrom\s*|\bimport\s*\(?\s*)["'](?:https?:|\/\/)/g;
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(html?|css|js|mjs)$/i.test(entry.name)) {
        const text = readFileSync(full, 'utf8');
        const pattern = /\.css$/i.test(entry.name) ? cssPattern : /\.(js|mjs)$/i.test(entry.name) ? jsPattern : htmlPattern;
        pattern.lastIndex = 0;
        const hit = pattern.exec(text);
        if (hit) fail(`network reference in app/${entry.name}: ${hit[0].slice(0, 80)}`);
      }
    }
  };
  walk(appDir);
}

/** Read a PNG's or JPEG's pixel dimensions from its header. */
function imageSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let at = 2;
    while (at + 9 < buf.length) {
      if (buf[at] !== 0xff) { at += 1; continue; }
      const marker = buf[at + 1]!;
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buf.readUInt16BE(at + 5), width: buf.readUInt16BE(at + 7) };
      }
      at += 2 + buf.readUInt16BE(at + 2);
    }
  }
  return null;
}

/** Screenshots: 3-4 whole PNG/JPEG files, each <= 256 KiB, long side <= 1280, short side >= 480. */
function checkScreenshots(shotsDir: string): string[] {
  const names = readdirSync(shotsDir).filter((n) => !n.startsWith('.') && statSync(join(shotsDir, n)).isFile()).sort();
  if (names.length < 3 || names.length > 4) fail(`screenshots/ holds ${names.length} images, the gate wants 3 or 4`);
  for (const name of names) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(name)) fail(`screenshot name not allowed: ${name}`);
    const buf = readFileSync(join(shotsDir, name));
    if (buf.length > 262144) fail(`screenshots/${name} is ${buf.length} bytes, over the 256 KiB cap`);
    const size = imageSize(buf);
    if (!size) fail(`screenshots/${name} is not a whole PNG or JPEG`);
    const long = Math.max(size.width, size.height);
    const short = Math.min(size.width, size.height);
    if (long > 1280 || short < 480) fail(`screenshots/${name} is ${size.width}x${size.height}: long side <= 1280, short side >= 480 required`);
  }
  return names;
}

function countTree(dir: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = countTree(full);
      files += sub.files;
      bytes += sub.bytes;
    } else if (entry.isFile()) {
      files += 1;
      bytes += statSync(full).size;
    }
  }
  return { files, bytes };
}

const appSrc = join(repoDir, 'app');
const shotsSrc = join(repoDir, 'screenshots');
if (!existsSync(join(appSrc, 'index.html'))) fail('app/index.html is missing');
if (!existsSync(shotsSrc)) fail('screenshots/ is missing');

const trophyCount = checkTrophyFile(appSrc);
checkReferences(appSrc);
const shotNames = checkScreenshots(shotsSrc);
console.log(`preflight: ${trophyCount} trophies with guides, no network references, ${shotNames.length} screenshots within caps`);

mkdirSync(outDir, { recursive: true });
cpSync(appSrc, join(outDir, 'app'), { recursive: true });
cpSync(shotsSrc, join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, CAPS);
writeFileSync(join(outDir, 'dossier.json'), dossier);

const app = countTree(join(outDir, 'app'));
console.log(`app/ copied: ${app.files} files, ${app.bytes} bytes`);
console.log(`screenshots/ copied: ${shotNames.length} images`);
console.log(`dossier.json written: ${dossier.length} bytes`);