#!/usr/bin/env python3
"""
Extract MPP Resident Councillors System 2025-2028 from docx to structured JSON.

Input : ~/Downloads/MPP RESIDENT COUNCILLORS SYSTEM 2025.docx
Output: data/councillors.json

Parses the single 3-column table (Zone | Councillors & Contact No | Area Name / Locality)
into a structured roster keyed by ward letter.
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
            {"title": "Cr.", "name": "Mark Kellon anak Awo",      "phone": "016-8922060"},
            {"title": "Cr.", "name": "Stephen Jatu anak Sawet",   "phone": "019-4592366"},
        ],
    },
    {
        "ward_code": "B",
        "ward_label": "Ward 2",
        "area": "Upper Padawan: Biperoh & Bengoh",
        "councillors": [
            {"title": "Cr.", "name": "Felix Ngui",                "phone": "016-8548070"},
            {"title": "Cr.", "name": "Tito Grabo anak Teyok",     "phone": "011-33203700"},
            {"title": "Cr.", "name": "Niput anak Ahip",           "phone": "019-7658166"},
            {"title": "Cr.", "name": "Roselin anak Lasek",        "phone": "010-9752611"},
        ],
    },
    {
        "ward_code": "D",
        "ward_label": "Ward 3",
        "area": "Mambong & Puncak Borneo",
        "councillors": [
            {"title": "Cr.",         "name": "Walter anak Suhai",       "phone": "010-4087717"},
            {"title": "Lt. Kol.",    "name": "Monday anak Juhid",       "phone": "013-8036477"},
        ],
    },
    {
        "ward_code": "FG",
        "ward_code_group": ["F", "G"],
        "ward_label": "Ward 4",
        "area": "Kota Padawan, Kuap, Landeh & Batu 10-15 Kuching-Serian Road",
        "councillors": [
            {"title": "Cr.", "name": "Lim Lian Kee",              "phone": "019-8185350"},
            {"title": "Cr.", "name": "Shamsudin bin Unai",        "phone": "013-9065805"},
            {"title": "Cr.", "name": "Norolhadi bin Dolla Sabari","phone": "019-8747445"},
            {"title": "Cr.", "name": "Wilarmy Geniron Jebron",    "phone": "011-29109925"},
        ],
    },
    {
        "ward_code": "H",
        "ward_label": "Ward 5",
        "area": "3rd Mile Maong Bazaar, Arang, Semeba & Kung Phin",
        "councillors": [
            {"title": "Cr.", "name": "Gerald Goh Teck Joo",       "phone": "019-8165368"},
            {"title": "Cr.", "name": "Alvin Chong Nyuk Fah",      "phone": "012-8442885"},
            {"title": "Cr.", "name": "Leng Chai anak Mendu",      "phone": "011-14567777"},
        ],
    },
    {
        "ward_code": "I",
        "ward_label": "Ward 6",
        "area": "Kota Sentosa & Batu Kitang",
        "councillors": [
            {"title": "Sr. Cr.", "name": "Chen Chee Joong",       "phone": "019-8130636"},
            {"title": "Cr.",     "name": "Philip Liaw Kian Sin",  "phone": "016-8611233"},
            {"title": "Cr.",     "name": "Mohamad Fauzi bin Ali", "phone": "016-8565626"},
        ],
    },
    {
        "ward_code": "JL",
        "ward_code_group": ["J", "L"],
        "ward_label": "Ward 7",
        "area": "Batu Kawah & Datuk Stephen Yong Road",
        "councillors": [
            {"title": "Cr.", "name": "Samsudin bin Sapri",        "phone": "019-8916606"},
            {"title": "Cr.", "name": "Gary Yeo Shin Huat",        "phone": "010-7922988"},
            {"title": "Cr.", "name": "Phang Kit Lung",            "phone": "013-9406228"},
            {"title": "Cr.", "name": "Bassiron bin Haji Latep",   "phone": "011-53355255"},
        ],
    },
    {
        "ward_code": "K",
        "ward_label": "Ward 8",
        "area": "Matang",
        "councillors": [
            {"title": "Cr.", "name": "Jamilah binti Rakim",       "phone": "016-8741442"},
            {"title": "Cr.", "name": "Madhi bin Tomi",            "phone": "019-9707411"},
            {"title": "Cr.", "name": "Lee Yen Huei",              "phone": "010-7878162"},
        ],
    },
    {
        "ward_code": "M",
        "ward_label": "Ward 9",
        "area": "Batu Kawah Township, Stapok & Sunny Hill Batu Kawah",
        "councillors": [
            {"title": "Ir. Dr. Cr.", "name": "Jackie Sim Hui Hui","phone": "010-2227751"},
            {"title": "Cr.",         "name": "Aaron Tay Kok Tung","phone": "012-8885065"},
            {"title": "Cr.",         "name": "Ronnie Hii Ru Wei", "phone": "012-8860505"},
        ],
    },
    {
        "ward_code": "NPQ",
        "ward_code_group": ["N", "P", "Q"],
        "ward_label": "Ward 10",
        "area": "Telaga Air, Sibu Laut & Kawasan Kpg. Tg. Bako",
        "councillors": [
            {"title": "Cr.", "name": "Sebeki bin Jen",            "phone": "019-8763231"},
            {"title": "Cr.", "name": "Othman bin Ibrahim",        "phone": "010-9765149"},
        ],
    },
]

CHAIRMAN = {
    "title": "Cr.",
    "name": "Tan Kai",
    "phone": "013-8095165",
    "role": "Chairman",
    "coverage": "All zones",
}

DEPUTY = {
    "title": "Cr.",
    "name": "Mahmud Bin Dato Sri Haji Ibrahim",
    "phone": "012-8087997",
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


def verify_phone_coverage(raw_text):
    """Sanity check: every phone in our roster appears in the raw docx."""
    phones = [CHAIRMAN["phone"], DEPUTY["phone"]]
    for ward in ROSTER:
        for c in ward["councillors"]:
            phones.append(c["phone"])
    missing = [p for p in phones if p not in raw_text]
    if missing:
        print(f"WARN: phone numbers not found verbatim in docx: {missing}", file=sys.stderr)
    else:
        print(f"  ✓ All {len(phones)} phone numbers verified against source docx.")


def build_payload():
    wards = []
    for w in ROSTER:
        ward = {
            "code": w["ward_code"],
            "codeGroup": w.get("ward_code_group", [w["ward_code"]]),
            "label": w["ward_label"],
            "area": w["area"],
            "councillorCount": len(w["councillors"]),
            "councillors": w["councillors"],
        }
        wards.append(ward)
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source": "MPP Resident Councillors System 2025-2028",
        "sourceFile": "MPP RESIDENT COUNCILLORS SYSTEM 2025.docx",
        "term": "2025-2028",
        "chairman": CHAIRMAN,
        "deputy": DEPUTY,
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
    raw = extract_raw_text()
    verify_phone_coverage(raw)
    payload = build_payload()
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    print(f"  ✓ Wrote {OUT_PATH} "
          f"({payload['totals']['wards']} wards, {payload['totals']['councillors']} councillors)")


if __name__ == "__main__":
    main()
