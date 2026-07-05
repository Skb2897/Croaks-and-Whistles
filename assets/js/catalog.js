/* ============================================================
   Frog Call Atlas -- catalog.js
   Renders the homepage: hero, stat strip, and the family/genus
   ledger, all driven by data/species.json so the site works for
   any number of families, not just one.
   ============================================================ */

let ALL_SPECIES = [];

function renderLedger(speciesList) {
  const ledgerEl = document.getElementById('ledger');
  if (!speciesList.length) {
    ledgerEl.innerHTML = '<p class="empty-state">No species match that search.</p>';
    return;
  }
  const families = groupByFamilyAndGenus(speciesList);
  let html = '';
  Object.keys(families).sort().forEach((fam) => {
    html += `<div class="family-heading">Family ${escapeHtml(fam)}</div>`;
    const genera = families[fam];
    Object.keys(genera).sort().forEach((genus) => {
      const items = genera[genus].slice().sort((a, b) => a.species.localeCompare(b.species));
      html += `<div class="genus-heading">${escapeHtml(genus)}<span class="count">${items.length} species</span></div>`;
      items.forEach((sp) => {
        const hasAudio = !!sp.audio;
        const common = sp.common_name ? `<div class="common">${escapeHtml(sp.common_name)}</div>` : '';
        html += `
        <a class="entry" href="species.html?slug=${encodeURIComponent(sp.slug)}">
          <span class="acc">${escapeHtml(sp.accession)}</span>
          <span class="names">
            <span class="sci"><i>${escapeHtml(sp.genus)} ${escapeHtml(sp.species)}</i></span>
            ${common}
          </span>
          <span class="status-pill ${hasAudio ? 'catalogued' : ''}">call: ${hasAudio ? 'catalogued' : 'pending'}</span>
          <span class="voiceprint" data-voiceprint="${escapeHtml(sp.slug)}" data-bars="14" data-width="80" data-height="22"></span>
        </a>`;
      });
    });
  });
  ledgerEl.innerHTML = html;
  ledgerEl.querySelectorAll('[data-voiceprint]').forEach((el) => {
    renderVoiceprint(el, el.getAttribute('data-voiceprint'), {
      bars: parseInt(el.getAttribute('data-bars') || '24', 10),
      width: parseInt(el.getAttribute('data-width') || '120', 10),
      height: parseInt(el.getAttribute('data-height') || '28', 10),
    });
  });
}

function renderStats(speciesList) {
  const total = speciesList.length;
  const catalogued = speciesList.filter((s) => s.audio).length;
  const families = new Set(speciesList.map((s) => s.family || 'Unclassified'));
  const genera = new Set(speciesList.map((s) => s.genus || 'Unclassified'));
  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-catalogued').textContent = catalogued;
  document.getElementById('stat-families').textContent = families.size;
  document.getElementById('stat-genera').textContent = genera.size;
}

function applyFilters() {
  const q = (document.getElementById('search-input').value || '').toLowerCase().trim();
  const famFilter = document.getElementById('family-select').value;
  let filtered = ALL_SPECIES;
  if (famFilter) filtered = filtered.filter((s) => (s.family || 'Unclassified') === famFilter);
  if (q) {
    filtered = filtered.filter((s) => {
      const hay = [s.genus, s.species, s.common_name, s.accession, s.family].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }
  renderLedger(filtered);
}

function populateFamilyFilter(speciesList) {
  const select = document.getElementById('family-select');
  const families = Array.from(new Set(speciesList.map((s) => s.family || 'Unclassified'))).sort();
  select.innerHTML = '<option value="">All families</option>' +
    families.map((f) => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('');
}

document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('[data-chorus]').forEach(renderChorus);
  try {
    const data = await loadCatalog('');
    ALL_SPECIES = data.species || [];
    if (data.config) {
      document.title = `${data.config.site_title} \u2014 ${data.config.site_subtitle}`;
      const subtitleEl = document.getElementById('hero-subtitle');
      if (subtitleEl) subtitleEl.textContent = data.config.site_subtitle;
    }
    renderStats(ALL_SPECIES);
    populateFamilyFilter(ALL_SPECIES);
    renderLedger(ALL_SPECIES);
    document.getElementById('search-input').addEventListener('input', applyFilters);
    document.getElementById('family-select').addEventListener('change', applyFilters);
  } catch (err) {
    document.getElementById('ledger').innerHTML = `<p class="empty-state">Could not load catalog: ${escapeHtml(err.message)}</p>`;
  }
});
