/* ============================================================
   Frog Call Atlas -- util.js
   Shared helpers used by catalog.js, species.js and admin.js.
   No framework, no build step: plain static files on GitHub Pages.
   ============================================================ */

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Renders a small bar-chart "voiceprint" svg into el, seeded by `seed`.
   Placeholder only -- used where no real recording exists yet, so no
   catalog entry ever looks empty or broken. */
function renderVoiceprint(el, seed, opts) {
  opts = opts || {};
  const bars = opts.bars || 24;
  const w = opts.width || 120;
  const h = opts.height || 28;
  const color = opts.color || 'var(--forest)';
  const rand = mulberry32(hashSeed(seed));
  const barW = w / bars;
  let pathBars = '';
  for (let i = 0; i < bars; i++) {
    const amp = 0.15 + rand() * 0.85;
    const barH = Math.max(2, amp * h);
    const x = i * barW + barW * 0.2;
    const y = (h - barH) / 2;
    pathBars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(barW * 0.6).toFixed(1)}" height="${barH.toFixed(1)}" rx="1" fill="${color}" opacity="${(0.55 + amp * 0.45).toFixed(2)}"></rect>`;
  }
  el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${pathBars}</svg>`;
}

function renderChorus(el) {
  const seeds = ['leithii', 'semipalmata', 'chiravasi', 'phrynoderma', 'leptodactyla', 'gundia', 'tenuilingua', 'diplosticta'];
  el.innerHTML = '';
  seeds.forEach((seed, i) => {
    const strip = document.createElement('div');
    strip.style.position = 'absolute';
    strip.style.left = ((i / seeds.length) * 100) + '%';
    strip.style.width = (100 / seeds.length) + '%';
    strip.style.top = '0';
    strip.style.opacity = '0.5';
    strip.style.animation = `chorus-breathe ${(3.2 + (i % 4) * 0.9).toFixed(1)}s ease-in-out ${(i * 0.25).toFixed(2)}s infinite`;
    renderVoiceprint(strip, seed, { bars: 10, width: 90, height: 60, color: i % 3 === 0 ? 'var(--clay)' : 'var(--forest)' });
    el.appendChild(strip);
  });
  el.style.position = 'relative';
  if (!document.getElementById('chorus-keyframes')) {
    const style = document.createElement('style');
    style.id = 'chorus-keyframes';
    style.textContent = `@keyframes chorus-breathe { 0%,100% { transform: scaleY(0.7); opacity:0.35; } 50% { transform: scaleY(1); opacity:0.75; } }`;
    document.head.appendChild(style);
  }
}

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(genus, species) {
  return (genus + '-' + species).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/* Fetches data/species.json relative to the given root ('' for pages
   at the site root, '../' for pages one folder down). Cache-busts so
   admin edits show up immediately after a commit. */
async function loadCatalog(root) {
  root = root || '';
  const res = await fetch(root + 'data/species.json?_=' + Date.now());
  if (!res.ok) throw new Error('Could not load data/species.json (' + res.status + ')');
  return res.json();
}

function groupByFamilyAndGenus(speciesList) {
  const families = {};
  speciesList.forEach((sp) => {
    const fam = sp.family || 'Unclassified';
    families[fam] = families[fam] || {};
    const gen = sp.genus || 'Unclassified';
    families[fam][gen] = families[fam][gen] || [];
    families[fam][gen].push(sp);
  });
  return families;
}

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}
