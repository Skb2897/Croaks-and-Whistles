#!/usr/bin/env python3
"""
Quick sanity check for data/species.json -- catches duplicate slugs,
missing required fields, and audio paths that don't exist on disk.
Run any time after hand-editing the JSON (the admin panel doesn't
need this, since it can't create duplicate slugs).

Usage: python3 tools/validate_species.py
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(ROOT, "data", "species.json")
REQUIRED = ["slug", "family", "genus", "species"]


def main():
    with open(DATA_PATH, encoding="utf-8") as f:
        data = json.load(f)

    problems = []
    seen_slugs = set()
    for i, sp in enumerate(data.get("species", [])):
        label = sp.get("slug") or f"entry #{i}"
        for field in REQUIRED:
            if not sp.get(field):
                problems.append(f"{label}: missing required field '{field}'")
        slug = sp.get("slug")
        if slug:
            if slug in seen_slugs:
                problems.append(f"{slug}: duplicate slug")
            seen_slugs.add(slug)
        audio = sp.get("audio")
        if audio and not os.path.exists(os.path.join(ROOT, audio)):
            problems.append(f"{label}: audio path '{audio}' does not exist on disk")

    if problems:
        print(f"Found {len(problems)} issue(s):")
        for p in problems:
            print(f"  - {p}")
        sys.exit(1)
    else:
        print(f"OK -- {len(data.get('species', []))} species, no issues found.")


if __name__ == "__main__":
    main()
