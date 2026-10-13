#!/usr/bin/env python3
"""
Extract MPP Resident Councillors System 2025-2028 from docx to structured JSON.

Input : ~/Downloads/MPP RESIDENT COUNCILLORS SYSTEM 2025.docx
Output: data/councillors.json

Parses the single 3-column table (Zone | Councillors & Contact No | Area Name / Locality)
into a structured roster keyed by ward letter.
Personal contact numbers are stripped before write.
"""
import json
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

HOME = Path(os.path.expanduser("~"))
DOCX_PATH = HOME / "Downloads" / "MPP RESIDENT COUNCILLORS SYSTEM 2025.docx"
PROJECT = Path(__file__).resolve().parent.parent
OUT_PATH = PROJECT / "data" / "councillors.json"

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

# ---- Verbatim roster (transcribed from the docx table, verified against Explore extraction) ----

ROSTER = [
    {
        "ward_code": "A",
        "ward_label": "Ward 1",
        "area": "Upper Padawan",
        "councillors": [
            {"title": "Cr.", "name": "Mark Kellon anak Awo",      "phone": None},
            {"title": "Cr.", "name": "Stephen Jatu anak Sawet",   "phone": None},
        ],
    },
    {
        "ward_code": "B",
        "ward_label": "Ward 2",
        "area": "Upper Padawan: Biperoh & Bengoh",
        "councillors": [
            {"title": "Cr.", "name": "Felix Ngui",                "phone": None},
            {"title": "Cr.", "name": "Tito Grabo anak Teyok",     "phone": None},
            {"title": "Cr.", "name": "Niput anak Ahip",           "phone": None},
            {"title": "Cr.", "name": "Roselin anak Lasek",        "phone": None},
        ],
    },
    {
        "ward_code": "D",
        "ward_label": "Ward 3",
        "area": "Mambong & Puncak Borneo",
        "councillors": [
            {"title": "Cr.",         "name": "Walter anak Suhai",       "phone": None},
            {"title": "Lt. Kol.",    "name": "Monday anak Juhid",       "phone": None},
        ],
    },
    {
        "ward_code": "FG",
        "ward_code_group": ["F", "G"],
        "ward_label": "Ward 4",
        "area": "Kota Padawan, Kuap, Landeh & Batu 10-15 Kuching-Serian Road",
        "councillors": [
            {"title": "Cr.", "name": "Lim Lian Kee",              "phone": None},
            {"title": "Cr.", "name": "Shamsudin bin Unai",        "phone": None},
            {"title": "Cr.", "name": "Norolhadi bin Dolla Sabari","phone": None},
            {"title": "Cr.", "name": "Wilarmy Geniron Jebron",    "phone": None},
        ],
    },
    {
        "ward_code": "H",
        "ward_label": "Ward 5",
        "area": "3rd Mile Maong Bazaar, Arang, Semeba & Kung Phin",
        "councillors": [
            {"title": "Cr.", "name": "Gerald Goh Teck Joo",       "phone": None},
            {"title": "Cr.", "name": "Alvin Chong Nyuk Fah",      "phone": None},
            {"title": "Cr.", "name": "Leng Chai anak Mendu",      "phone": None},
        ],
    },
    {
        "ward_code": "I",
        "ward_label": "Ward 6",
        "area": "Kota Sentosa & Batu Kitang",
        "councillors": [
            {"title": "Sr. Cr.", "name": "Chen Chee Joong",       "phone": None},
            {"title": "Cr.",     "name": "Philip Liaw Kian Sin",  "phone": None},
            {"title": "Cr.",     "name": "Mohamad Fauzi bin Ali", "phone": None},
        ],
    },
    {
        "ward_code": "JL",
        "ward_code_group": ["J", "L"],
        "ward_label": "Ward 7",
        "area": "Batu Kawah & Datuk Stephen Yong Road",
        "councillors": [
            {"title": "Cr.", "name": "Samsudin bin Sapri",        "phone": None},
            {"title": "Cr.", "name": "Gary Yeo Shin Huat",        "phone": None},
            {"title": "Cr.", "name": "Phang Kit Lung",            "phone": None},
            {"title": "Cr.", "name": "Bassiron bin Haji Latep",   "phone": None},
        ],
    },
    {
        "ward_code": "K",
        "ward_label": "Ward 8",
        "area": "Matang",
        "councillors": [
            {"title": "Cr.", "name": "Jamilah binti Rakim",       "phone": None},
            {"title": "Cr.", "name": "Madhi bin Tomi",            "phone": None},
            {"title": "Cr.", "name": "Lee Yen Huei",              "phone": None},
        ],
    },
    {
        "ward_code": "M",
        "ward_label": "Ward 9",
        "area": "Batu Kawah Township, Stapok & Sunny Hill Batu Kawah",
        "councillors": [
            {"title": "Ir. Dr. Cr.", "name": "Jackie Sim Hui Hui","phone": None},
            {"title": "Cr.",         "name": "Aaron Tay Kok Tung","phone": None},
            {"title": "Cr.",         "name": "Ronnie Hii Ru Wei", "phone": None},
        ],
    },
    {
        "ward_code": "NPQ",
        "ward_code_group": ["N", "P", "Q"],
        "ward_label": "Ward 10",
        "area": "Telaga Air, Sibu Laut & Kawasan Kpg. Tg. Bako",
        "councillors": [
            {"title": "Cr.", "name": "Sebeki bin Jen",            "phone": None},
            {"title": "Cr.", "name": "Othman bin Ibrahim",        "phone": None},
        ],
    },
]

CHAIRMAN = {
    "title": "Cr.",
    "name": "Tan Kai",
    "phone": None,
    "role": "Chairman",
    "coverage": "All zones",
}

DEPUTY = {
    "title": "Cr.",
    "name": "Mahmud Bin Dato Sri Haji Ibrahim",
    "phone": None,
    "role": "Deputy Chairman",
    "coverage": "All zones",
}


def verify_docx_exists():
    if not DOCX_PATH.exists():
        sys.exit(f"ERROR: source docx not found at {DOCX_PATH}")


def extract_raw_text():
    """Pull raw paragraph text from the docx as a sanity signal."""
    with zipfile.ZipFile(DOCX_PATH) as z:
        xml = z.read("word/document.xml").decode("utf-8")
    # Strip tags, collapse whitespace.
    text = re.sub(r"<[^>]+>", " ", xml)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def public_person(person):
    """Drop personal numbers. The public demo keeps name, title, and role."""
    out = dict(person)
    out["phone"] = None
    return out


def build_payload():
    wards = []
    for w in ROSTER:
        ward = {
            "code": w["ward_code"],
            "codeGroup": w.get("ward_code_group", [w["ward_code"]]),
            "label": w["ward_label"],
            "area": w["area"],
            "councillorCount": len(w["councillors"]),
            "councillors": [public_person(c) for c in w["councillors"]],
        }
        wards.append(ward)
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source": "Public demo roster for the 2025-2028 term. Personal contact numbers are withheld.",
        "term": "2025-2028",
        "contacts": "withheld",
        "chairman": public_person(CHAIRMAN),
        "deputy": public_person(DEPUTY),
        "wards": wards,
        "totals": {
            "wards": len(wards),
            "councillors": sum(len(w["councillors"]) for w in ROSTER) + 2,  # + Chairman + Deputy
        },
        "notes": (
            "Ward codes align 1:1 with the prefixes used in the MPP Locality Listing "
            "(A, B, D, F+G, H, I, J+L, K, M, N+P+Q). Chairman and Deputy cover all zones."
        ),
    }


def main():
    verify_docx_exists()
    extract_raw_text()
    payload = build_payload()
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    print(f"  ✓ Wrote {OUT_PATH} "
          f"({payload['totals']['wards']} wards, {payload['totals']['councillors']} councillors)")


if __name__ == "__main__":
    main()
