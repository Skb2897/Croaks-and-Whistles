# Frog Call Atlas

A field catalog of anuran (frog) advertisement calls, built to sit
behind a QR code on a printed card. No backend and no build step for
the site itself: it's plain HTML/CSS/JS on GitHub Pages, with an
in-browser admin panel that commits changes straight to this repo
using the GitHub API and a personal access token you control.

Catalogs any number of families and genera, not just one -- add a
new family and it shows up as its own section on the homepage.

Seeded with the 19-species Ranixalidae scaffold (15 *Indirana* + 4
*Walkerana*) as a starting point; no audio yet in the sample data.

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

Open `data/species.json` and replace `config.base_url` with your
actual Pages URL (no trailing slash):

```json
"base_url": "https://yourusername.github.io/frog-call-atlas"
```

This is the only place the URL lives -- QR codes (whether generated
from the admin panel or the offline script) derive from it.

## 3. Add and edit species from the website

Open `admin.html` on your live site (or locally). You'll need a
**fine-grained GitHub personal access token**:

1. GitHub → Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token.
2. Restrict it to **only this repository**.
3. Under Permissions, grant **Contents: Read and write**. Nothing else.
4. Paste the token into the admin panel along with `owner/repo` and
   your branch name (`main`).

From there you can add a species, fill in **Identification** and
**Habitat** as free text, upload a call recording (drag a file onto
the dropzone), preview its **oscillogram and spectrogram** instantly,
and save -- the panel commits `data/species.json` and the audio file
directly to the repo. A "Save QR to repo" button generates and
commits `assets/qr/<slug>.png` too, so a printable card is available
immediately without running any script.

The token is stored only in this browser's local storage and used
solely to call `api.github.com` -- treat it like a password, and only
use this on a device you trust.

## 4. Print QR cards

Open `cards.html` (linked from the site header) and print
(Ctrl/Cmd+P). It reads `data/species.json` directly, so newly added
species show up without regenerating anything. If a species doesn't
have a committed QR PNG yet, the page renders one on the fly.

To bulk-(re)generate PNGs offline instead (e.g. after changing
`base_url` for everything at once):

```bash
pip install qrcode --break-system-packages
python3 tools/generate_qr_cards.py
```

## Editing without the admin panel

Everything lives in `data/species.json` -- you can hand-edit it in
any text editor and push normally. Optional sanity check:

```bash
python3 tools/validate_species.py
```

## Species fields (`data/species.json`)

| Field | Notes |
|---|---|
| `slug` | used in the URL (`species.html?slug=...`) and audio/QR filenames |
| `accession` | your own catalog number, e.g. `RX-001` |
| `family`, `genus`, `species` | taxonomy -- any family works, not just Ranixalidae |
| `authority` | taxonomic authority citation, leave blank if unverified |
| `common_name` | leave blank if none is established |
| `identification` | free text, how to recognize this species in the field |
| `habitat` | free text, habitat and distribution notes |
| `audio` | path to the call recording, e.g. `assets/audio/genus-species.mp3`, or `""` if none yet |

Any field left blank just renders as "no notes yet" -- the catalog is
meant to be filled in incrementally.

## File structure

```
index.html                 catalog homepage -- rendered by catalog.js from species.json
species.html                one generic species page -- rendered by species.js, keyed by ?slug=
admin.html                   in-browser CMS -- rendered by admin.js, talks to the GitHub API
cards.html                    printable QR card sheet -- rendered client-side from species.json
data/species.json            single source of truth for all content
assets/css/style.css         site styling
assets/js/util.js            shared helpers (voiceprint sprite, JSON loading, escaping)
assets/js/audio-viz.js       spectrogram + oscillogram renderer (Web Audio API + canvas)
assets/js/player.js          minimal custom audio player
assets/js/catalog.js         homepage rendering + search/filter
assets/js/species.js         species page rendering
assets/js/admin.js           GitHub Contents API read/write logic
assets/audio/                call recordings (committed by the admin panel, or by hand)
assets/qr/                   QR PNGs (committed by the admin panel, or by tools/generate_qr_cards.py)
tools/generate_qr_cards.py   bulk-regenerates assets/qr/*.png offline
tools/validate_species.py    optional sanity check for species.json
```

## A note on the "voiceprint" sprites

Every species -- even ones with no recording yet -- gets a small
deterministic bar-sprite generated from a hash of its name (see
`assets/js/util.js`). It's a placeholder, not real acoustic data, so
no catalog row ever looks broken while the catalog is incomplete.
Once a real recording is uploaded, the species page shows an actual
oscillogram and spectrogram computed from that file instead.
