# Frog Call Atlas — Ranixalidae of the Western Ghats

A static field catalog of frog advertisement calls, built to sit behind a
QR code on a printed card. No backend, no build tooling beyond two small
Python scripts — everything ships as plain HTML/CSS/JS on GitHub Pages.

Currently seeded with the full 19-species catalog structure (15 *Indirana*
+ 4 *Walkerana*) but no audio, photos, or morphology data yet — that's
the "clean slate" starting point. Fill it in species by species.

## 1. Put this on GitHub

```bash
git init
git add .
git commit -m "Initial catalog scaffold"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

Then in the repo on GitHub: **Settings → Pages → Deploy from branch →
`main` / `root`**. Wait a minute or two, and the site will be live at
`https://<your-username>.github.io/<your-repo>/`.

## 2. Set your real URL

Open `data/species.json` and replace `config.base_url` with your actual
Pages URL (no trailing slash), e.g.:

```json
"base_url": "https://shashank-frogs.github.io/frog-call-atlas"
```

This is the only place the URL lives — everything else derives from it.

## 3. Generate the QR codes and printable cards

```bash
pip install qrcode --break-system-packages
python3 tools/generate_qr_cards.py
```

This writes one PNG per species into `assets/qr/` and a `cards.html`
sheet you can open and print (Ctrl/Cmd+P) — one card per species, laid
out two-up, dashed cut lines. Re-run it any time `base_url` or the
species list changes; a printed QR is only valid as long as the URL it
encodes doesn't move.

## 4. Add a real recording

1. Drop the audio file in `assets/audio/`, e.g. `assets/audio/indirana-chiravasi.mp3`
   (compress to ~128kbps mp3 — keeps the repo light and pages fast on field data connections).
2. In `data/species.json`, on that species' entry, set:
   ```json
   "has_audio": true,
   "audio_src": "../assets/audio/indirana-chiravasi.mp3",
   "call_description": "A short prose description of the call."
   ```
3. Fill in whatever else you have for that species — see the field list below.
4. Re-run `python3 build.py` to regenerate the HTML.
5. Commit and push. The QR on the printed card doesn't need to change —
   it already points at this page.

## Editable fields per species (`data/species.json`)

| Field | Notes |
|---|---|
| `common_name` | leave blank if none is established |
| `authority` | taxonomic authority citation — verify against Amphibian Species of the World before adding, several are intentionally left blank in the seed data |
| `has_audio` / `audio_src` / `call_description` | drives the Call section |
| `distribution` | free text |
| `field_notes` | free text |
| `peak_frequency_hz`, `dominant_frequency_hz`, `call_duration_s`, `pulse_rate_per_s` | bioacoustic metrics |
| `amb_spl_db`, `call_spl_db`, `svl_mm`, `mass_g`, `tympanum_mm` | matches the field data schema from the offline survey app |

Any field left out just renders as "TBD" — the site is meant to be
filled in incrementally, not all at once.

## File structure

```
index.html              generated — do not hand-edit, edit species.json + re-run build.py
species/*.html          generated — one page per species
cards.html              generated — printable QR card sheet
build.py                regenerates index.html + species/*.html from data/species.json
tools/generate_qr_cards.py   regenerates assets/qr/*.png + cards.html
data/species.json       the single source of truth for all content
assets/css/style.css    site styling
assets/js/main.js       voiceprint sprite generator + audio player
assets/audio/           put .mp3 files here (create this folder as needed)
assets/qr/              generated QR PNGs
```

## A note on the "voiceprint" sprites

Every species — even ones with no recording yet — gets a small
deterministic bar-sprite generated from a hash of its name (see
`assets/js/main.js`). It's a placeholder, not real acoustic data. Once
a real recording is added, it's worth eventually swapping in an actual
waveform or spectrogram image for that species, but the placeholder
means no page ever looks broken or empty while the catalog is
incomplete.
