/* ============================================================
   Frog Call Atlas -- species.js
   One generic template renders any species' detail page, keyed
   by ?slug=<slug> in the URL and looked up in data/species.json.
   ============================================================ */

function renderSpecies(sp, cfg) {
  document.title = `${sp.genus} ${sp.species} \u2014 ${cfg.site_title}`;

  document.getElementById('species-family').textContent = sp.family || '';
  document.getElementById('species-acc').textContent = sp.accession || '';
  document.getElementById('species-genus').textContent = sp.genus || '';
  document.getElementById('species-epithet').textContent = sp.species || '';
  const authorityEl = document.getElementById('species-authority');
  authorityEl.textContent = sp.authority || '';
  authorityEl.style.display = sp.authority ? '' : 'none';
  const commonEl = document.getElementById('species-common');
  commonEl.textContent = sp.common_name || '';
  commonEl.style.display = sp.common_name ? '' : 'none';

  // Call / player / visualizations
  const callSection = document.getElementById('call-card');
  if (sp.audio) {
    callSection.classList.remove('empty');
    callSection.setAttribute('data-src', sp.audio);
    callSection.querySelector('.play-btn').removeAttribute('disabled');
    document.getElementById('call-empty-msg').style.display = 'none';
    const vizContainer = document.getElementById('call-viz');
    vizContainer.style.display = '';
    const viz = AudioViz.attach(vizContainer);
    viz.loadFromUrl(sp.audio);
  } else {
    document.getElementById('call-viz').style.display = 'none';
    document.getElementById('call-empty-msg').style.display = '';
  }
  renderVoiceprint(document.getElementById('call-voiceprint'), sp.slug, { bars: 20, width: 260, height: 34 });
  initPlayer(callSection);

  // Identification / habitat -- free text, editable via the admin panel
  const idEl = document.getElementById('identification-text');
  if (sp.identification) { idEl.textContent = sp.identification; idEl.classList.remove('tbd'); }
  else { idEl.textContent = 'No identification notes yet.'; idEl.classList.add('tbd'); }

  const habEl = document.getElementById('habitat-text');
  if (sp.habitat) { habEl.textContent = sp.habitat; habEl.classList.remove('tbd'); }
  else { habEl.textContent = 'No habitat notes yet.'; habEl.classList.add('tbd'); }


document.addEventListener('DOMContentLoaded', async () => {
  const slug = qs('slug');
  const root = document.getElementById('species-root');
  if (!slug) {
    root.innerHTML = '<p class="empty-state">No species specified. Return to the <a href="index.html">catalog</a>.</p>';
    return;
  }
  try {
    const data = await loadCatalog('');
    const sp = (data.species || []).find((s) => s.slug === slug);
    if (!sp) {
      root.innerHTML = `<p class="empty-state">No species found for "${escapeHtml(slug)}". Return to the <a href="index.html">catalog</a>.</p>`;
      return;
    }
    renderSpecies(sp, data.config);
  } catch (err) {
    root.innerHTML = `<p class="empty-state">Could not load catalog: ${escapeHtml(err.message)}</p>`;
  }
});
