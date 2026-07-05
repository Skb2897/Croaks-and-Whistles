#!/usr/bin/env python3
"""
Generates one QR PNG per species into assets/qr/<slug>.png, each
pointing at <base_url>/species.html?slug=<slug> -- the single dynamic
species page that data/species.json now drives.

This is an optional bulk/offline alternative to the "Save QR to repo"
button in the admin panel (admin.html), useful for regenerating every
QR at once, e.g. after changing base_url.

Usage:
    pip install qrcode --break-system-packages
    python3 tools/generate_qr_cards.py
"""
import json
import os

import qrcode

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(ROOT, "data", "species.json")
QR_DIR = os.path.join(ROOT, "assets", "qr")


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

    for sp in data["species"]:
        page_url = f"{base_url}/species.html?slug={sp['slug']}"
        img = qrcode.make(page_url, box_size=8, border=2)
        out_path = os.path.join(QR_DIR, f"{sp['slug']}.png")
        img.save(out_path)

    print(f"Generated {len(data['species'])} QR codes in assets/qr/")
    print("cards.html reads species.json directly, so no other file needs regenerating.")


if __name__ == "__main__":
    main()
