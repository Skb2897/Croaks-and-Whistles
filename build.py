#!/usr/bin/env python3
"""
Frog Call Atlas -- static site builder.

Reads data/species.json and generates:
  - index.html                 (the full catalog, grouped by genus)
  - species/<slug>.html         (one page per species)

Re-run this script (`python3 build.py`) any time you edit
data/species.json -- e.g. after adding a recording, filling in
morphology data, or writing field notes. It always overwrites the
generated HTML, so make content edits in species.json, not in the
generated .html files directly.
"""
import json
import os
import html

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(ROOT, "data", "species.json")

HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{description}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,500;0,600;1,500;1,600&family=Source+Sans+3:wght@400;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{root}assets/css/style.css">
</head>
<body>
"""

HEADER = """<header class="site-header">
  <div class="wrap">
    <a class="brand" href="{root}index.html">Frog Call Atlas <em>/ Ranixalidae</em></a>
    <nav>
      <a href="{root}index.html">Catalog</a>
      <a href="{root}cards.html">Print cards</a>
    </nav>
  </div>
</header>
"""

FOOTER = """<footer class="site-footer">
  <div class="wrap">
    Anurans Acoustics &amp; Anthropogenic Climate Change Lab, SMIAT&ndash;MAHE &middot;
    Family Ranixalidae, Western Ghats, India &middot;
    built as a static field reference -- <a href="https://github.com/">source on GitHub</a>
  </div>
</footer>
<script src="{root}assets/js/main.js"></script>
</body>
</html>
"""


def esc(s):
    return html.escape(s or "")


def genus_italic(genus, species):
    return f"<i>{esc(genus)} {esc(species)}</i>"


def build_index(data):
    cfg = data["config"]
    species_list = data["species"]
    genera = {}
    for sp in species_list:
        genera.setdefault(sp["genus"], []).append(sp)

    total = len(species_list)
    catalogued = sum(1 for s in species_list if s.get("has_audio"))

    rows = []
    for genus in sorted(genera.keys()):
        items = sorted(genera[genus], key=lambda s: s["species"])
        rows.append(f'<div class="genus-heading">{esc(genus)}<span class="count">{len(items)} species</span></div>')
        for sp in items:
            status_class = "catalogued" if sp.get("has_audio") else "pending"
            status_label = "call: catalogued" if sp.get("has_audio") else "call: pending"
            common = f'<div class="common">{esc(sp["common_name"])}</div>' if sp.get("common_name") else ""
            rows.append(f"""
      <a class="entry" href="species/{sp['slug']}.html">
        <span class="acc">{esc(sp['accession'])}</span>
        <span class="names">
          <span class="sci">{genus_italic(sp['genus'], sp['species'])}</span>
          {common}
        </span>
        <span class="status-pill {status_class}">{status_label}</span>
        <span class="voiceprint" data-voiceprint="{esc(sp['slug'])}" data-bars="14" data-width="80" data-height="22"></span>
      </a>""")

    body = f"""
<section class="hero">
  <div class="wrap">
    <p class="hero-eyebrow">Field reference &middot; audio catalog</p>
    <h1>Calls of the <i>Ranixalidae</i>,<br>Western Ghats</h1>
    <p class="lede">A working catalog of advertisement calls for the leaping frogs of peninsular India -- built to sit behind a QR code on a card in the field, and to grow one recording at a time.</p>
    <div class="chorus" data-chorus></div>
  </div>
</section>

<section class="stat-strip">
  <div class="wrap" style="display:flex; gap:36px; flex-wrap:wrap;">
    <div class="stat"><b>{total}</b><span>Species tracked</span></div>
    <div class="stat"><b>{catalogued}</b><span>Calls catalogued</span></div>
    <div class="stat"><b>{len(genera)}</b><span>Genera</span></div>
  </div>
</section>

<section class="ledger">
  <div class="wrap">
    {''.join(rows)}
  </div>
</section>
"""
    html_out = (
        HEAD.format(title=cfg["site_title"] + " -- " + cfg["site_subtitle"],
                    description="A field catalog of Ranixalidae frog calls from the Western Ghats, India.",
                    root="")
        + HEADER.format(root="")
        + body
        + FOOTER.format(root="")
    )
    with open(os.path.join(ROOT, "index.html"), "w", encoding="utf-8") as f:
        f.write(html_out)


FIELD_ROWS = [
    ("Peak frequency", "peak_frequency_hz", "Hz"),
    ("Dominant frequency", "dominant_frequency_hz", "Hz"),
    ("Call duration", "call_duration_s", "s"),
    ("Pulse rate", "pulse_rate_per_s", "pulses/s"),
    ("Ambient SPL", "amb_spl_db", "dB"),
    ("Call SPL", "call_spl_db", "dB"),
    ("SVL", "svl_mm", "mm"),
    ("Mass", "mass_g", "g"),
    ("Tympanum diameter", "tympanum_mm", "mm"),
]


def build_species_page(sp, cfg):
    root = "../"
    common = f'<div class="common-name">{esc(sp["common_name"])}</div>' if sp.get("common_name") else ""
    authority = f'<div class="authority">{esc(sp["authority"])}</div>' if sp.get("authority") else ""

    has_audio = bool(sp.get("has_audio"))
    audio_src = sp.get("audio_src", "")
    if has_audio:
        call_block = f"""<div class="call-card" data-player data-src="{esc(audio_src)}">
        <div class="player-row">
          <button class="play-btn" aria-label="Play call">&#9654;</button>
          <div class="voiceprint" data-voiceprint="{esc(sp['slug'])}" data-width="260" data-height="34"></div>
          <span class="player-time">0:00 / --:--</span>
        </div>
        <p class="prose">{esc(sp.get('call_description', ''))}</p>
      </div>"""
    else:
        call_block = f"""<div class="call-card empty" data-player data-src="">
        <div class="player-row">
          <button class="play-btn" aria-label="No recording yet" disabled>&#9654;</button>
          <div class="voiceprint" data-voiceprint="{esc(sp['slug'])}" data-width="260" data-height="34"></div>
          <span class="player-time">--:-- / --:--</span>
        </div>
        <p class="empty-title">No recording catalogued yet</p>
        <p class="empty-hint">Drop an .mp3 in assets/audio/{esc(sp['slug'])}.mp3, set "has_audio": true and "audio_src" in species.json, then re-run build.py.</p>
      </div>"""

    field_data_rows = ""
    for label, key, unit in FIELD_ROWS:
        val = sp.get(key)
        cell = f"{esc(str(val))} {unit}" if val not in (None, "") else '<span class="tbd">TBD</span>'
        field_data_rows += f"<tr><th>{esc(label)}</th><td class=\"{'tbd' if not val else ''}\">{cell}</td></tr>"

    distribution = sp.get("distribution", "")
    field_notes = sp.get("field_notes", "")

    distribution_html = f'<p class="prose">{esc(distribution)}</p>' if distribution else '<p class="prose tbd">No distribution notes yet.</p>'
    notes_html = f'<p class="prose">{esc(field_notes)}</p>' if field_notes else '<p class="prose tbd">No field notes yet.</p>'

    qr_path = f"../assets/qr/{sp['slug']}.png"
    qr_block = f"""<div class="qr-block">
        <img src="{qr_path}" alt="QR code linking to this page" width="120" height="120" onerror="this.style.display='none'">
        <p class="qr-note">This QR points to this page. Generate it (and a printable card) with <code>tools/generate_qr_cards.py</code> once <code>base_url</code> is set in data/species.json.</p>
      </div>"""

    body = f"""
<header class="species-header">
  <div class="wrap">
    <span class="acc">{esc(sp['accession'])}</span>
    <h1><span class="genus-tag">{esc(sp['genus'])}</span> <i>{esc(sp['species'])}</i></h1>
    {authority}
    {common}
  </div>
</header>

<section class="section">
  <div class="wrap">
    <h2>Call</h2>
    {call_block}
  </div>
</section>

<section class="section">
  <div class="wrap">
    <h2>Distribution</h2>
    {distribution_html}
  </div>
</section>

<section class="section">
  <div class="wrap">
    <h2>Bioacoustic &amp; field data</h2>
    <table class="field-data">
      {field_data_rows}
    </table>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <h2>Field notes</h2>
    {notes_html}
  </div>
</section>

<section class="section" style="border-bottom:none;">
  <div class="wrap">
    <h2>Card &amp; QR</h2>
    {qr_block}
  </div>
</section>
"""
    html_out = (
        HEAD.format(title=f"{sp['genus']} {sp['species']} -- {cfg['site_title']}",
                    description=f"Call catalog entry for {sp['genus']} {sp['species']}, family Ranixalidae.",
                    root=root)
        + HEADER.format(root=root)
        + body
        + FOOTER.format(root=root)
    )
    out_path = os.path.join(ROOT, "species", f"{sp['slug']}.html")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html_out)


def main():
    with open(DATA_PATH, encoding="utf-8") as f:
        data = json.load(f)
    build_index(data)
    for sp in data["species"]:
        build_species_page(sp, data["config"])
    print(f"Built index.html and {len(data['species'])} species pages.")


if __name__ == "__main__":
    main()
