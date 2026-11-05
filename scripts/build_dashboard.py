"""Bangun dashboard mandiri (1 file HTML) dari src/ + data Excel.

Isi file Excel ditanam apa adanya (seluruh sel per sheet, termasuk judul dan
baris kosong) ke blok <script id="idr-embedded"> sebagai "data bawaan IDR".
Dashboard lalu mengenali letak tabel sendiri (sama seperti saat file di-upload),
jadi logika kode tidak pernah memuat angka hasil olahan.

Pemakaian:
    python3 scripts/build_dashboard.py [--synthetic] [file1.xlsx file2.xlsx ...]
Tanpa argumen file: memakai data/Assessment_RDDC.xlsx dan
data/Dictionary_Prompt_IDR_Assessment_RDDC.xlsx (ditandai sintetis).
"""

import json
import sys
from datetime import date, datetime
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
OUT = ROOT / "dist" / "Dashboard_Penjualan_Motor_Honda_2024.html"
DEFAULT_FILES = [ROOT / "data" / "Assessment_RDDC.xlsx",
                 ROOT / "data" / "Dictionary_Prompt_IDR_Assessment_RDDC.xlsx"]
CHART_JS = ROOT / "vendor" / "chart.umd.4.4.1.min.js"


def cell_value(v):
    if isinstance(v, datetime):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, float) and v.is_integer():
        return int(v)
    return v


def read_workbook(path):
    wb = load_workbook(path, read_only=True, data_only=True)
    sheets = []
    for ws in wb.worksheets:
        rows = []
        for row in ws.iter_rows(values_only=True):
            vals = [cell_value(v) for v in row]
            while vals and vals[-1] in (None, ""):
                vals.pop()
            rows.append(vals)
        while rows and not rows[-1]:
            rows.pop()
        sheets.append({"name": ws.title, "rows": rows})
    wb.close()
    return {"name": path.name, "sheets": sheets}


def main(argv):
    synthetic = "--synthetic" in argv
    files = [Path(a) for a in argv if not a.startswith("--")]
    if not files:
        files = DEFAULT_FILES
        synthetic = True
    payload = {
        "synthetic": synthetic,
        "builtAt": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "files": [read_workbook(f) for f in files],
    }
    data_json = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")

    html = (SRC / "index.html").read_text(encoding="utf-8")
    parts = {
        "/*__STYLES__*/": (SRC / "styles.css").read_text(encoding="utf-8"),
        "/*__CHARTJS__*/": CHART_JS.read_text(encoding="utf-8"),
        "/*__IDRDASH__*/": (SRC / "idrdash.js").read_text(encoding="utf-8"),
        "/*__APP__*/": (SRC / "app.js").read_text(encoding="utf-8"),
        "/*__IDR_EMBEDDED__*/": data_json,
    }
    for key, value in parts.items():
        if key not in html:
            raise SystemExit(f"Placeholder {key} tidak ditemukan di src/index.html")
        html = html.replace(key, value)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html, encoding="utf-8")
    rows = sum(len(s["rows"]) for f in payload["files"] for s in f["sheets"])
    print(f"OK -> {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024:.0f} KB, {rows} baris sel tertanam)")


if __name__ == "__main__":
    main(sys.argv[1:])
