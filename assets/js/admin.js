/* ============================================================
   Frog Call Atlas -- admin.js
   A browser-only CMS: reads and writes data/species.json (and
   audio / QR files) straight to the GitHub repo via the REST
   Contents API, using a personal access token the user supplies.
   No backend of any kind -- this is what makes "upload from the
   website" possible on a plain GitHub Pages site.
   ============================================================ */

const CREDS_KEY = 'fca_admin_creds';
let state = {
  token: null, owner: null, repo: null, branch: 'main',
  catalog: null, sha: null,
  activeSlug: null, isNew: false,
  pendingAudioFile: null,
};

function apiBase() {
  return `https://api.github.com/repos/${state.owner}/${state.repo}`;
}

async function ghRequest(path, options) {
  options = options || {};
  const headers = Object.assign({
    'Authorization': `Bearer ${state.token}`,
    'Accept': 'application/vnd.github+json',
  }, options.headers || {});
  const res = await fetch(apiBase() + path, Object.assign({}, options, { headers }));
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).message; } catch (e) {}
    throw new Error(`GitHub API ${res.status}${detail ? ': ' + detail : ''}`);
  }
  return res.json();
}

async function ghGetFile(path) {
  try {
    return await ghRequest(`/contents/${path}?ref=${encodeURIComponent(state.branch)}`);
  } catch (err) {
    if (err.message.includes('404')) return null;
    throw err;
  }
}

async function ghPutFile(path, base64Content, message, sha) {
  const body = { message, content: base64Content, branch: state.branch };
  if (sha) body.sha = sha;
  return ghRequest(`/contents/${path}`, { method: 'PUT', body: JSON.stringify(body) });
}

async function ghDeleteFile(path, message, sha) {
  return ghRequest(`/contents/${path}`, {
    method: 'DELETE',
    body: JSON.stringify({ message, sha, branch: state.branch }),
  });
}

function b64FromUnicodeString(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function unicodeStringFromB64(b64) {
  return decodeURIComponent(escape(atob(b64.replace(/\n/g, ''))));
}
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/* ---------------- connection ---------------- */

function loadStoredCreds() {
  try {
    const raw = localStorage.getItem(CREDS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function storeCreds() {
  localStorage.setItem(CREDS_KEY, JSON.stringify({
    token: state.token, owner: state.owner, repo: state.repo, branch: state.branch,
  }));
}

async function connect(ownerRepo, branch, token) {
  const [owner, repo] = ownerRepo.split('/').map((s) => s.trim());
  if (!owner || !repo) throw new Error('Enter the repo as "owner/repo"');
  state.owner = owner; state.repo = repo; state.branch = branch || 'main'; state.token = token;
  const file = await ghGetFile('data/species.json');
  if (!file) throw new Error('data/species.json not found on that branch');
  state.sha = file.sha;
  state.catalog = JSON.parse(unicodeStringFromB64(file.content));
  storeCreds();
}

/* ---------------- rendering ---------------- */

function renderList() {
  const listEl = document.getElementById('admin-list');
  const species = (state.catalog.species || []).slice().sort((a, b) =>
    (a.family + a.genus + a.species).localeCompare(b.family + b.genus + b.species));
  if (!species.length) {
    listEl.innerHTML = '<p class="field-hint" style="padding:14px;">No species yet. Use "+ New species" to add one.</p>';
    return;
  }
  listEl.innerHTML = species.map((sp) => `
    <button type="button" class="admin-list-item ${sp.slug === state.activeSlug ? 'active' : ''}" data-slug="${escapeHtml(sp.slug)}">
      <span class="sci">${escapeHtml(sp.genus)} ${escapeHtml(sp.species)}</span>
      <span class="acc">${escapeHtml(sp.accession || '')} \u00b7 ${escapeHtml(sp.family || '')}</span>
    </button>`).join('');
  listEl.querySelectorAll('.admin-list-item').forEach((btn) => {
    btn.addEventListener('click', () => selectSpecies(btn.getAttribute('data-slug')));
  });
}

function clearForm() {
  ['family', 'accession', 'genus', 'species', 'authority', 'common', 'slug', 'identification', 'habitat']
    .forEach((id) => { document.getElementById('f-' + id).value = ''; });
  document.getElementById('audio-current').textContent = '';
  state.pendingAudioFile = null;
  const vizContainer = document.getElementById('audio-viz-container');
  vizContainer.innerHTML = '';
}

function selectSpecies(slug) {
  const sp = state.catalog.species.find((s) => s.slug === slug);
  if (!sp) return;
  state.activeSlug = slug;
  state.isNew = false;
  clearForm();
  document.getElementById('panel-title').textContent = `${sp.genus} ${sp.species}`;
  document.getElementById('species-form').style.display = '';
  document.getElementById('delete-btn').style.display = '';
  document.getElementById('f-family').value = sp.family || '';
  document.getElementById('f-accession').value = sp.accession || '';
  document.getElementById('f-genus').value = sp.genus || '';
  document.getElementById('f-species').value = sp.species || '';
  document.getElementById('f-authority').value = sp.authority || '';
  document.getElementById('f-common').value = sp.common_name || '';
  document.getElementById('f-slug').value = sp.slug || '';
  document.getElementById('f-identification').value = sp.identification || '';
  document.getElementById('f-habitat').value = sp.habitat || '';
  if (sp.audio) {
    document.getElementById('audio-current').textContent = `Current file: ${sp.audio}`;
    const vizContainer = document.getElementById('audio-viz-container');
    const viz = AudioViz.attach(vizContainer);
    viz.loadFromUrl(sp.audio);
  }
  updateQrPreview(sp.slug);
  renderList();
}

function newSpeciesForm() {
  state.activeSlug = null;
  state.isNew = true;
  clearForm();
  document.getElementById('panel-title').textContent = 'New species';
  document.getElementById('species-form').style.display = '';
  document.getElementById('delete-btn').style.display = 'none';
  updateQrPreview('');
  renderList();
}

function updateQrPreview(slug) {
  const canvas = document.getElementById('qr-canvas');
  const baseUrl = (state.catalog.config && state.catalog.config.base_url || '').replace(/\/$/, '');
  if (!slug) {
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    document.getElementById('qr-url-hint').textContent = 'Save this species first, then a QR can be generated.';
    return;
  }
  const url = `${baseUrl}/species.html?slug=${encodeURIComponent(slug)}`;
  document.getElementById('qr-url-hint').textContent = url;
  if (window.QRCode) QRCode.toCanvas(canvas, url, { width: 120, margin: 1 });
}

/* ---------------- form -> data ---------------- */

function collectFormValues() {
  const genus = document.getElementById('f-genus').value.trim();
  const species = document.getElementById('f-species').value.trim();
  let slug = document.getElementById('f-slug').value.trim();
  if (!slug) slug = slugify(genus, species);
  return {
    slug,
    family: document.getElementById('f-family').value.trim(),
    accession: document.getElementById('f-accession').value.trim(),
    genus, species,
    authority: document.getElementById('f-authority').value.trim(),
    common_name: document.getElementById('f-common').value.trim(),
    identification: document.getElementById('f-identification').value.trim(),
    habitat: document.getElementById('f-habitat').value.trim(),
  };
}

function setSaveStatus(msg, isErr) {
  const el = document.getElementById('save-status');
  el.textContent = msg;
  el.style.color = isErr ? 'var(--danger)' : 'var(--forest)';
}

async function saveSpecies(evt) {
  evt.preventDefault();
  const saveBtn = document.getElementById('save-btn');
  saveBtn.disabled = true;
  try {
    const values = collectFormValues();
    if (!values.family || !values.genus || !values.species) {
      throw new Error('Family, genus and species are required.');
    }
    let audioPath = null;
    const existing = state.catalog.species.find((s) => s.slug === values.slug);
    audioPath = existing ? existing.audio || '' : '';

    if (state.pendingAudioFile) {
      setSaveStatus('Uploading audio file\u2026');
      const file = state.pendingAudioFile;
      const ext = (file.name.split('.').pop() || 'mp3').toLowerCase();
      const path = `assets/audio/${values.slug}.${ext}`;
      const existingAudioFile = await ghGetFile(path);
      const buf = await file.arrayBuffer();
      await ghPutFile(path, arrayBufferToBase64(buf), `Add/update call recording for ${values.slug}`,
        existingAudioFile ? existingAudioFile.sha : undefined);
      audioPath = path;
    }

    const entry = Object.assign({}, values, { audio: audioPath || '' });

    if (state.isNew) {
      if (state.catalog.species.some((s) => s.slug === entry.slug)) {
        throw new Error(`A species with slug "${entry.slug}" already exists.`);
      }
      state.catalog.species.push(entry);
    } else {
      const idx = state.catalog.species.findIndex((s) => s.slug === state.activeSlug);
      if (idx === -1) throw new Error('Could not find the original entry to update.');
      state.catalog.species[idx] = entry;
    }

    setSaveStatus('Saving species.json\u2026');
    const content = b64FromUnicodeString(JSON.stringify(state.catalog, null, 2));
    const result = await ghPutFile('data/species.json', content,
      `${state.isNew ? 'Add' : 'Update'} species: ${entry.genus} ${entry.species}`, state.sha);
    state.sha = result.content.sha;

    setSaveStatus('Saved. Live site will update in a minute or two.');
    state.pendingAudioFile = null;
    state.isNew = false;
    state.activeSlug = entry.slug;
    selectSpecies(entry.slug);
  } catch (err) {
    setSaveStatus(err.message, true);
  } finally {
    saveBtn.disabled = false;
  }
}

async function deleteSpecies() {
  if (!state.activeSlug) return;
  if (!confirm('Delete this species entry from the catalog? This does not remove any committed audio file.')) return;
  try {
    state.catalog.species = state.catalog.species.filter((s) => s.slug !== state.activeSlug);
    const content = b64FromUnicodeString(JSON.stringify(state.catalog, null, 2));
    const result = await ghPutFile('data/species.json', content, `Remove species: ${state.activeSlug}`, state.sha);
    state.sha = result.content.sha;
    state.activeSlug = null;
    document.getElementById('species-form').style.display = 'none';
    document.getElementById('panel-title').textContent = 'Select a species';
    renderList();
  } catch (err) {
    setSaveStatus(err.message, true);
  }
}

async function commitQr() {
  const slug = state.isNew ? document.getElementById('f-slug').value.trim() : state.activeSlug;
  if (!slug) { setSaveStatus('Save the species before committing its QR code.', true); return; }
  try {
    const canvas = document.getElementById('qr-canvas');
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const buf = await blob.arrayBuffer();
    const path = `assets/qr/${slug}.png`;
    const existingFile = await ghGetFile(path);
    await ghPutFile(path, arrayBufferToBase64(buf), `Add QR code for ${slug}`, existingFile ? existingFile.sha : undefined);
    setSaveStatus('QR code committed to ' + path + '.');
  } catch (err) {
    setSaveStatus(err.message, true);
  }
}

/* ---------------- wiring ---------------- */

document.addEventListener('DOMContentLoaded', () => {
  const stored = loadStoredCreds();
  if (stored) {
    document.getElementById('gh-owner-repo').value = `${stored.owner}/${stored.repo}`;
    document.getElementById('gh-branch').value = stored.branch || 'main';
    document.getElementById('gh-token').value = stored.token;
  }

  document.getElementById('connect-btn').addEventListener('click', async () => {
    const statusEl = document.getElementById('connect-status');
    statusEl.textContent = 'Connecting\u2026';
    try {
      await connect(
        document.getElementById('gh-owner-repo').value,
        document.getElementById('gh-branch').value,
        document.getElementById('gh-token').value
      );
      document.getElementById('admin-gate').style.display = 'none';
      document.getElementById('admin-main').style.display = '';
      document.getElementById('admin-status').textContent = `Connected to ${state.owner}/${state.repo} (${state.branch})`;
      renderList();
    } catch (err) {
      statusEl.textContent = err.message;
      statusEl.style.color = 'var(--danger)';
    }
  });

  document.getElementById('signout-btn').addEventListener('click', () => {
    localStorage.removeItem(CREDS_KEY);
    location.reload();
  });

  document.getElementById('new-species-btn').addEventListener('click', newSpeciesForm);
  document.getElementById('species-form').addEventListener('submit', saveSpecies);
  document.getElementById('delete-btn').addEventListener('click', deleteSpecies);
  document.getElementById('commit-qr-btn').addEventListener('click', commitQr);

  const dropzone = document.getElementById('audio-dropzone');
  const audioInput = document.getElementById('audio-input');
  dropzone.addEventListener('click', () => audioInput.click());
  ['dragover', 'dragleave', 'drop'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.toggle('drag', evt === 'dragover');
    });
  });
  dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (file) handleAudioFile(file);
  });
  audioInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleAudioFile(file);
  });

  function handleAudioFile(file) {
    state.pendingAudioFile = file;
    document.getElementById('audio-current').textContent = `Pending upload: ${file.name}`;
    const vizContainer = document.getElementById('audio-viz-container');
    const viz = AudioViz.attach(vizContainer);
    viz.loadFromFile(file);
  }

  // Auto-fill slug suggestion as genus/species are typed, only for new entries
  ['f-genus', 'f-species'].forEach((id) => {
    document.getElementById(id).addEventListener('input', () => {
      if (!state.isNew) return;
      const genus = document.getElementById('f-genus').value.trim();
      const species = document.getElementById('f-species').value.trim();
      if (genus && species) document.getElementById('f-slug').value = slugify(genus, species);
    });
  });
});
