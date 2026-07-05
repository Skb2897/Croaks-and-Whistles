/* Minimal custom audio player. If data-src is empty the button stays
   disabled -- the surrounding card should already carry the "empty"
   styling from the template. */
function initPlayer(root) {
  const src = root.getAttribute('data-src');
  const btn = root.querySelector('.play-btn');
  const timeEl = root.querySelector('.player-time');
  if (!src) {
    if (btn) { btn.disabled = true; }
    return;
  }
  const audio = new Audio(src);
  let playing = false;
  btn.addEventListener('click', () => {
    if (!playing) { audio.play(); btn.textContent = '\u275A\u275A'; }
    else { audio.pause(); btn.textContent = '\u25B6'; }
    playing = !playing;
  });
  audio.addEventListener('ended', () => { playing = false; btn.textContent = '\u25B6'; });
  audio.addEventListener('timeupdate', () => {
    if (!timeEl) return;
    const cur = audio.currentTime || 0;
    const dur = audio.duration || 0;
    const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    timeEl.textContent = `${fmt(cur)} / ${isNaN(dur) ? '--:--' : fmt(dur)}`;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-player]').forEach(initPlayer);
});
