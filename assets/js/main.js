/* ============================================================
   Frog Call Atlas -- main.js
   No framework, no build step: this all needs to run as plain
   static files on GitHub Pages.
   ============================================================ */

/* Deterministic string hash -> used so each species gets a
   stable, unique "voiceprint" sprite even before real audio
   or a spectrogram has been uploaded. Once real audio exists,
   swap the placeholder svg for a real waveform/spectrogram
   image and this code is no longer needed for that species. */
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

/* Renders a small bar-chart "voiceprint" svg into el, seeded by `seed`. */
function renderVoiceprint(el, seed, opts) {
  opts = opts || {};
  const bars = opts.bars || 24;
  const w = opts.width || 120;
  const h = opts.height || 28;
  const color = opts.color || 'var(--moss)';
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

/* Ambient "chorus" for the homepage hero -- several voiceprints
   layered and gently breathing, evoking a night chorus of calls
   even though no real recordings are catalogued yet. */
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
    renderVoiceprint(strip, seed, { bars: 10, width: 90, height: 60, color: i % 3 === 0 ? 'var(--amber)' : 'var(--moss)' });
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

/* Minimal custom audio player. Works whether or not a real
   src has been set -- if data-src is empty/missing the button
   is disabled and the card should already carry the "empty"
   styling from the template. */
function initPlayer(root) {
  const src = root.getAttribute('data-src');
  const btn = root.querySelector('.play-btn');
  const timeEl = root.querySelector('.player-time');
  if (!src) {
    if (btn) { btn.disabled = true; btn.style.opacity = '0.4'; btn.style.cursor = 'not-allowed'; }
    return;
  }
  const audio = new Audio(src);
  let playing = false;
  btn.addEventListener('click', () => {
    if (!playing) { audio.play(); btn.textContent = '❚❚'; }
    else { audio.pause(); btn.textContent = '▶'; }
    playing = !playing;
  });
  audio.addEventListener('ended', () => { playing = false; btn.textContent = '▶'; });
  audio.addEventListener('timeupdate', () => {
    if (!timeEl) return;
    const cur = audio.currentTime || 0;
    const dur = audio.duration || 0;
    const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    timeEl.textContent = `${fmt(cur)} / ${isNaN(dur) ? '--:--' : fmt(dur)}`;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-voiceprint]').forEach((el) => {
    renderVoiceprint(el, el.getAttribute('data-voiceprint'), {
      bars: parseInt(el.getAttribute('data-bars') || '24', 10),
      width: parseInt(el.getAttribute('data-width') || '120', 10),
      height: parseInt(el.getAttribute('data-height') || '28', 10),
    });
  });
  document.querySelectorAll('[data-chorus]').forEach(renderChorus);
  document.querySelectorAll('[data-player]').forEach(initPlayer);
});
