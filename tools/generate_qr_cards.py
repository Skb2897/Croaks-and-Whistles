#!/usr/bin/env python3
"""
Generates:
  - assets/qr/<slug>.png     one QR code per species, linking to
                              <base_url>/species/<slug>.html
  - cards.html                a printable sheet of cards (QR + name +
                              accession number) ready to cut out and
                              laminate for field handouts

Run this AFTER you've set the real "base_url" in data/species.json
(i.e. after pushing to GitHub and enabling Pages, so you know your
real https://username.github.io/repo-name URL). Re-run any time the
URL or species list changes -- a printed QR is only valid as long as
the URL it points to doesn't move.

Usage:
    pip install qrcode --break-system-packages
    python3 tools/generate_qr_cards.py
"""
import json
import os
import html

import qrcode

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(ROOT, "data", "species.json")
QR_DIR = os.path.join(ROOT, "assets", "qr")


def esc(s):
    return html.escape(s or "")


def main():
    with open(DATA_PATH, encoding="utf-8") as f:
        data = json.load(f)

    base_url = data["config"]["base_url"].rstrip("/")
    if "USERNAME" in base_url or "REPO-NAME" in base_url:
        print("WARNING: base_url in data/species.json is still a placeholder")
        print(f"  ({base_url})")
        print("QR codes will be generated but will not resolve until you set")
        print("the real GitHub Pages URL and re-run this script.\n")

    os.makedirs(QR_DIR, exist_ok=True)

    cards = []
    for sp in data["species"]:
        page_url = f"{base_url}/species/{sp['slug']}.html"
        img = qrcode.make(page_url, box_size=8, border=2)
        out_path = os.path.join(QR_DIR, f"{sp['slug']}.png")
        img.save(out_path)

        common = f'<div class="card-common">{esc(sp["common_name"])}</div>' if sp.get("common_name") else ""
        cards.append(f"""
    <div class="qr-card">
      <img src="assets/qr/{sp['slug']}.png" alt="QR code for {esc(sp['genus'])} {esc(sp['species'])}">
      <div>
        <div class="card-acc">{esc(sp['accession'])}</div>
        <p class="card-sci"><i>{esc(sp['genus'])} {esc(sp['species'])}</i></p>
        {common}
      </div>
    </div>""")

    cards_html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Printable QR cards -- Frog Call Atlas</title>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,500;1,500&family=Source+Sans+3:wght@400;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/css/style.css">
<style>
  body {{ background: #f4f1ea; }}
  .page-head {{ padding: 30px 24px 0; }}
  .page-head h1 {{ font-family: var(--font-display); color: #111; }}
  .page-head p {{ color: #555; font-family: var(--font-body); }}
  .wrap-cards {{ max-width: 900px; margin: 0 auto; padding: 0 24px 60px; }}
</style>
</head>
<body>
  <div class="page-head no-print">
    <h1>Printable QR cards</h1>
    <p>One card per species &middot; cut along the dashed borders &middot; use your browser's Print (Ctrl/Cmd+P) to print this page.</p>
  </div>
  <div class="wrap-cards">
    <div class="card-grid">
      {''.join(cards)}
    </div>
  </div>
</body>
</html>
"""
    with open(os.path.join(ROOT, "cards.html"), "w", encoding="utf-8") as f:
        f.write(cards_html)

    print(f"Generated {len(data['species'])} QR codes in assets/qr/ and wrote cards.html")


if __name__ == "__main__":
    main()
