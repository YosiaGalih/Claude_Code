"""Reproduksi (sintetis) dua file sumber dashboard sesuai deskripsi prompt.

File asli (Assessment_RDDC.xlsx & Dictionary_Prompt_IDR_Assessment_RDDC.xlsx)
tidak tersedia saat dashboard dibuat, sehingga skrip ini membangun ulang
struktur yang dideskripsikan di prompt dengan data SINTETIS (bukan data resmi):

* Assessment_RDDC.xlsx
    - PENJUALAN : 1 baris = 1 unit motor terjual tahun 2024 (judul + catatan di atas tabel)
    - Mapping   : judul di baris 1, header di baris 2; master varian (A:C) + daftar bulan (E:F)
    - LATIHAN   : sheet latihan (tidak dipakai dashboard)
* Dictionary_Prompt_IDR_Assessment_RDDC.xlsx
    - Cover      : keterangan file (tanpa tabel)
    - Dictionary : kamus istilah (judul + keterangan di atas tabel)

Sengaja disisipkan kasus kualitas data agar aturan prompt teruji:
tanggal tidak valid, nilai kosong (Unknown), kode varian yang tidak ada di
Mapping, penulisan tidak konsisten, dan kelompok bersampel kecil (n < 5).

Pemakaian:  python3 scripts/generate_data.py [folder_output]
"""

import random
import sys
from datetime import date
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

SEED = 2024
N_BASE_ROWS = 4830

# ---------------------------------------------------------------- master varian
# (kode VARIAN, NAMA VARIAN, SEGMEN, bobot penjualan)
VARIANTS = [
    ("D1B02N12L2", "BeAT CBS", "AT", 14.0),
    ("D1B02N13L2", "BeAT Deluxe", "AT", 9.0),
    ("D1B02N26L2", "BeAT Street", "AT", 5.0),
    ("D1I02N22L1", "Genio CBS", "AT", 3.0),
    ("F1C02N46L0", "Scoopy Stylish", "AT", 7.0),
    ("F1C02N47L0", "Scoopy Prestige", "AT", 4.0),
    ("H1B02Q41L0", "Vario 125 CBS", "AT", 8.0),
    ("H1B02Q42L0", "Vario 125 Street", "AT", 3.0),
    ("J1B02N04L0", "Vario 160 CBS", "AT", 7.0),
    ("J1B02N05L0", "Vario 160 ABS", "AT", 3.0),
    ("K1H02N37L0", "PCX 160 CBS", "AT", 3.0),
    ("K1H02N38L0", "PCX 160 ABS", "AT", 1.5),
    ("X1H02N39L0", "ADV 160 CBS", "AT", 2.0),
    ("X1H02N40L0", "ADV 160 ABS", "AT", 1.0),
    ("S1F02N48L0", "Stylo 160 CBS", "AT", 2.0),
    ("S1F02N49L0", "Stylo 160 ABS", "AT", 1.0),
    ("Y1G02N02L0", "Revo Fit", "CUB", 3.0),
    ("Y1G02N03L0", "Revo X", "CUB", 1.5),
    ("N5D02N14L0", "Supra X 125 FI CW Luxury", "CUB", 3.0),
    ("G2E02R21L0", "Supra GTR 150 Exclusive", "CUB", 1.2),
    ("U1C02N10L0", "Super Cub C125", "CUB", 0.15),
    ("G5E02R12L0", "CB150R Streetfire", "SPORT", 3.0),
    ("M1F02N30L0", "CB150 Verza", "SPORT", 2.5),
    ("P5E02R25L0", "CBR150R", "SPORT", 2.5),
    ("T4G02R31L0", "CBR250RR SP Quick Shifter", "SPORT", 0.6),
    ("R1F02N20L0", "CRF150L", "SPORT", 1.5),
    ("V1J02Q34L0", "Sonic 150R", "SPORT", 1.5),
    ("W1D02N22L0", "CB150X", "SPORT", 0.7),
]
# Varian yang ada di Mapping tetapi sengaja diberi penjualan sangat kecil (n < 5)
SMALL_VARIANTS = [("U1C02N11L0", "CT125", "CUB", 4), ("R5F02N19L0", "CRF250 Rally", "SPORT", 2)]
# Varian di Mapping tanpa penjualan sama sekali (wajar terjadi di master data)
NO_SALES_VARIANTS = [("E1M02N01L0", "EM1 e:", "AT"), ("F2A02N15L0", "Forza 250", "AT")]
# Kode varian di PENJUALAN yang TIDAK ada di Mapping -> Unknown
UNMAPPED_CODES = [("Z9Z99X99L9", 3), ("Q0Q00A00L0", 2)]

MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
          "Agustus", "September", "Oktober", "November", "Desember"]
# pola musiman 2024 (Lebaran 10 April 2024 -> puncak Maret, turun April)
MONTH_WEIGHTS = [7.5, 7.8, 10.5, 6.0, 8.0, 8.3, 8.6, 8.8, 8.4, 8.7, 8.4, 9.0]

AGE_GROUPS = ["<16", "16 - 20", "21 - 25", "26 - 30", "31 - 35", "36 - 40",
              "41 - 45", "46 - 50", "51 - 55", ">55"]
AGE_WEIGHTS = [0.0, 9.0, 17.0, 17.0, 15.0, 13.0, 11.0, 8.0, 5.0, 3.5]  # "<16" dipaksa n=3
# afinitas segmen per kelompok usia (AT, CUB, SPORT)
SEGMENT_BY_AGE = {
    "<16": (0.95, 0.05, 0.0), "16 - 20": (0.78, 0.05, 0.17), "21 - 25": (0.74, 0.06, 0.20),
    "26 - 30": (0.77, 0.10, 0.13), "31 - 35": (0.78, 0.13, 0.09), "36 - 40": (0.76, 0.17, 0.07),
    "41 - 45": (0.72, 0.23, 0.05), "46 - 50": (0.66, 0.30, 0.04), "51 - 55": (0.60, 0.37, 0.03),
    ">55": (0.55, 0.43, 0.02),
}

# merek sebelumnya per kelompok usia
BRANDS = ["BELUM PERNAH MEMILIKI", "HONDA", "YAMAHA", "SUZUKI", "KAWASAKI", "TVS", "BAJAJ"]
BRAND_BY_AGE = {
    "young": (50, 25, 18, 4, 2, 1, 0),
    "21 - 25": (30, 33, 26, 6, 4, 1, 0),
    "26 - 30": (18, 38, 30, 8, 4.5, 1.5, 0),
    "mid": (10, 42, 32, 10, 4, 1.5, 0),
    "old": (6, 44, 30, 14, 3, 2.5, 0.3),
}

KECAMATAN = [  # (kecamatan, bobot)
    ("Pedurungan", 11), ("Tembalang", 10), ("Banyumanik", 8), ("Semarang Barat", 8),
    ("Ngaliyan", 7), ("Genuk", 6), ("Semarang Utara", 6), ("Mranggen", 5),
    ("Ungaran Barat", 5), ("Gunungpati", 4.5), ("Gayamsari", 4), ("Semarang Timur", 4),
    ("Candisari", 4), ("Mijen", 4), ("Ungaran Timur", 4), ("Semarang Selatan", 3.5),
    ("Semarang Tengah", 3), ("Gajahmungkur", 3), ("Bergas", 2.5), ("Sayung", 2.5), ("Tugu", 2),
]
DEALERS = {  # nama dealer fiktif -> kecamatan layanan
    "Sinar Jaya Motor Pedurungan": ["Pedurungan", "Gayamsari", "Genuk", "Mranggen", "Sayung"],
    "Mitra Abadi Motor Tembalang": ["Tembalang", "Banyumanik", "Candisari"],
    "Surya Kencana Motor Ngaliyan": ["Ngaliyan", "Mijen", "Tugu", "Semarang Barat", "Kaliwungu"],
    "Karya Utama Motor Simpang Lima": ["Semarang Tengah", "Semarang Selatan", "Semarang Timur",
                                       "Semarang Utara", "Gajahmungkur"],
    "Bintang Timur Motor Ungaran": ["Ungaran Barat", "Ungaran Timur", "Bergas", "Banyumanik", "Gunungpati"],
    "Prima Jaya Motor Kaligawe": ["Genuk", "Semarang Utara", "Gayamsari", "Sayung"],
}
COLORS = {
    "AT": [("Hitam", 30), ("Putih", 20), ("Merah", 14), ("Biru", 12), ("Abu-abu Doff", 12),
           ("Cokelat", 6), ("Hijau Doff", 6)],
    "CUB": [("Hitam", 40), ("Merah", 25), ("Biru", 20), ("Putih", 15)],
    "SPORT": [("Hitam", 35), ("Merah", 25), ("Putih", 15), ("Abu-abu Doff", 15), ("Tricolor", 10)],
}
EDU_YOUNG = [("SD", 5), ("SMP", 30), ("SMA/SMK", 65)]
EDU_ADULT = [("SD", 8), ("SMP", 15), ("SMA/SMK", 50), ("D3", 9), ("S1", 15), ("S2", 3)]

DICTIONARY = [
    ("AT", "Automatic Transmission: sepeda motor skutik (skuter matik) bertransmisi otomatis CVT, "
           "tanpa perpindahan gigi manual."),
    ("CUB", "Sepeda motor bebek (underbone) bertransmisi manual semi-otomatis tanpa tuas kopling tangan."),
    ("SPORT", "Sepeda motor sport/laki dengan kopling manual dan posisi tangki di depan pengendara, "
              "berorientasi performa."),
    ("CUST KEY", "Kode unik identitas konsumen (pembeli) pada data penjualan."),
    ("VARIANT KEY", "Kode unik varian/tipe sepeda motor; terhubung ke kolom VARIAN pada sheet Mapping."),
    ("MEREK SBLMNYA", "Merek sepeda motor yang dimiliki konsumen sebelum membeli unit Honda ini."),
    ("BELUM PERNAH MEMILIKI", "Nilai MEREK SBLMNYA untuk konsumen yang belum pernah memiliki sepeda motor "
                              "(pembeli motor pertama)."),
    ("AGE GROUP", "Kelompok usia konsumen saat transaksi pembelian, dalam rentang 5 tahunan."),
]


def wchoice(rng, items):
    """Pilih satu item dari list (nilai, bobot)."""
    values = [v for v, _ in items]
    weights = [w for _, w in items]
    return rng.choices(values, weights=weights, k=1)[0]


def brand_profile(age):
    if age in ("<16", "16 - 20"):
        return BRAND_BY_AGE["young"]
    if age in ("21 - 25", "26 - 30"):
        return BRAND_BY_AGE[age]
    if age in ("31 - 35", "36 - 40"):
        return BRAND_BY_AGE["mid"]
    return BRAND_BY_AGE["old"]


def random_date(rng):
    month = rng.choices(range(1, 13), weights=MONTH_WEIGHTS, k=1)[0]
    last_day = (date(2024, month + 1, 1) - date(2024, month, 1)).days if month < 12 else 31
    day = rng.randint(1, last_day)
    return 2024 * 10000 + month * 100 + day


def pick_dealer(rng, kec):
    candidates = [d for d, kecs in DEALERS.items() if kec in kecs]
    if not candidates:
        candidates = list(DEALERS)
    # dealer pertama yang melayani kecamatan = dealer utama
    weights = [3] + [1] * (len(candidates) - 1)
    return rng.choices(candidates, weights=weights, k=1)[0]


def build_rows(rng):
    by_segment = {"AT": [], "CUB": [], "SPORT": []}
    for code, _name, seg, w in VARIANTS:
        by_segment[seg].append((code, w))

    rows = []
    cust_seq = 10_000_000
    recent_customers = []

    def new_row(age=None, variant=None, brand=None, kec=None):
        nonlocal cust_seq
        if age is None:
            age = wchoice(rng, list(zip(AGE_GROUPS, AGE_WEIGHTS)))
        seg_w = SEGMENT_BY_AGE[age]
        if variant is None:
            seg = rng.choices(["AT", "CUB", "SPORT"], weights=seg_w, k=1)[0]
            variant = wchoice(rng, by_segment[seg])
            seg_of = seg
        else:
            seg_of = next((s for c, _n, s, _w in VARIANTS + [(c, n, s, 0) for c, n, s, _k in SMALL_VARIANTS]
                           if c == variant), "AT")
        if brand is None:
            brand = rng.choices(BRANDS, weights=brand_profile(age), k=1)[0]
        if kec is None:
            kec = wchoice(rng, KECAMATAN)
        edu = wchoice(rng, EDU_YOUNG if age in ("<16", "16 - 20") else EDU_ADULT)
        if recent_customers and rng.random() < 0.02:  # konsumen repeat (beli > 1 unit)
            cust = rng.choice(recent_customers)
        else:
            cust_seq += rng.randint(1, 37)
            cust = f"CK{cust_seq}"
            recent_customers.append(cust)
            if len(recent_customers) > 400:
                recent_customers.pop(0)
        return [random_date(rng), cust, variant, wchoice(rng, COLORS[seg_of]), pick_dealer(rng, kec),
                kec, brand, edu, age]

    for _ in range(N_BASE_ROWS):
        rows.append(new_row())

    # ---- kelompok sampel kecil (n < 5)
    for _ in range(3):
        rows.append(new_row(age="<16"))
    for _ in range(3):
        rows.append(new_row(brand="VIAR"))
    for _ in range(3):
        rows.append(new_row(kec="Kaliwungu"))
    for code, _name, _seg, n in SMALL_VARIANTS:
        for _ in range(n):
            rows.append(new_row(variant=code))

    # ---- kode varian yang tidak ada di Mapping
    for code, n in UNMAPPED_CODES:
        for _ in range(n):
            r = new_row()
            r[2] = code
            rows.append(r)

    rng.shuffle(rows)

    # ---- nilai kosong (null) -> akan tampil "Unknown" di dashboard
    def blank(col, n):
        for i in rng.sample(range(len(rows)), n):
            rows[i][col] = None

    blank(6, 86)   # MEREK SBLMNYA
    blank(8, 47)   # AGE GROUP
    blank(7, 58)   # PENDIDIKAN
    blank(5, 31)   # KECAMATAN
    blank(3, 12)   # WARNA
    blank(2, 2)    # VARIANT KEY

    # ---- penulisan tidak konsisten (dinormalisasi oleh dashboard)
    for i in rng.sample(range(len(rows)), 14):
        if rows[i][6]:
            rows[i][6] = rng.choice([rows[i][6].lower(), " " + rows[i][6].title(), rows[i][6] + " "])
    for i in rng.sample(range(len(rows)), 9):
        if rows[i][8] and " - " in rows[i][8]:
            rows[i][8] = rows[i][8].replace(" - ", "-")

    # ---- tanggal tidak valid (tidak dihitung pada grafik per kuartal)
    invalid = [20240231, 20240230, 20240431, 20240631, 20240931, 20241131, 2024123, None]
    for i, v in zip(rng.sample(range(len(rows)), len(invalid)), invalid):
        rows[i][0] = v
    return rows


HEADER_FILL = PatternFill("solid", fgColor="1F2937")
HEADER_FONT = Font(bold=True, color="FFFFFF")
TITLE_FONT = Font(bold=True, size=14)
NOTE_FONT = Font(italic=True, color="6B7280")


def style_header(ws, row, first_col, last_col):
    for c in range(first_col, last_col + 1):
        cell = ws.cell(row=row, column=c)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center")


def autosize(ws, widths):
    for idx, w in widths.items():
        ws.column_dimensions[get_column_letter(idx)].width = w


def write_assessment(path, rows):
    wb = Workbook()

    # ---------------- PENJUALAN
    ws = wb.active
    ws.title = "PENJUALAN"
    ws["A1"] = "DATA PENJUALAN UNIT SEPEDA MOTOR HONDA 2024"
    ws["A1"].font = TITLE_FONT
    ws["A2"] = ("Keterangan: 1 baris = 1 unit terjual. DATA REPRODUKSI SINTETIS untuk uji dashboard "
                "(bukan data resmi).")
    ws["A2"].font = NOTE_FONT
    header = ["SALES DATE", "CUST KEY", "VARIANT KEY", "WARNA", "DEALER", "KECAMATAN",
              "MEREK SBLMNYA", "PENDIDIKAN", "AGE GROUP"]
    ws.append([])  # baris 3 kosong
    ws.append(header)  # baris 4
    style_header(ws, 4, 1, len(header))
    for r in rows:
        ws.append(r)
    ws.freeze_panes = "A5"
    autosize(ws, {1: 12, 2: 13, 3: 14, 4: 14, 5: 32, 6: 18, 7: 24, 8: 12, 9: 11})

    # ---------------- Mapping (judul baris 1, header baris 2)
    wm = wb.create_sheet("Mapping")
    wm["A1"] = "MAPPING MASTER VARIAN & NAMA BULAN"
    wm["A1"].font = TITLE_FONT
    wm.append(["VARIAN", "NAMA VARIAN", "SEGMEN", None, "NO BULAN", "NAMA BULAN"])
    style_header(wm, 2, 1, 3)
    style_header(wm, 2, 5, 6)
    master = [(c, n, s) for c, n, s, _w in VARIANTS]
    master += [(c, n, s) for c, n, s, _k in SMALL_VARIANTS]
    master += NO_SALES_VARIANTS
    master.sort(key=lambda x: ({"AT": 0, "CUB": 1, "SPORT": 2}[x[2]], x[1]))
    for i in range(max(len(master), 12)):
        left = list(master[i]) if i < len(master) else [None, None, None]
        right = [i + 1, MONTHS[i]] if i < 12 else [None, None]
        wm.append(left + [None] + right)
    autosize(wm, {1: 14, 2: 28, 3: 10, 4: 3, 5: 10, 6: 14})

    # ---------------- LATIHAN (tidak dipakai)
    wl = wb.create_sheet("LATIHAN")
    wl["A1"] = "LATIHAN"
    wl["A1"].font = TITLE_FONT
    wl["A2"] = "Soal: buat rekap jumlah unit per DEALER per bulan menggunakan data sheet PENJUALAN."
    wl["A2"].font = NOTE_FONT
    wl.append([])
    wl.append(["DEALER"] + [m[:3].upper() for m in MONTHS] + ["TOTAL"])
    style_header(wl, 4, 1, 14)
    for d in DEALERS:
        wl.append([d] + [None] * 13)
    autosize(wl, {1: 32})

    wb.save(path)


def write_dictionary(path):
    wb = Workbook()
    wc = wb.active
    wc.title = "Cover"
    wc["B2"] = "[LOGO]"
    wc["B4"] = "Dictionary Prompt IDR – Assessment RDDC"
    wc["B4"].font = TITLE_FONT
    wc["B5"] = "Kamus istilah yang dipakai sebagai acuan arti pada prompt dashboard IDR."
    wc["B6"] = "Isi kamus adalah REPRODUKSI (file asli tidak tersedia)."
    wc["B6"].font = NOTE_FONT

    wd = wb.create_sheet("Dictionary")
    wd["A1"] = "KAMUS ISTILAH AHM"
    wd["A1"].font = TITLE_FONT
    wd["A2"] = "Gunakan arti di bawah untuk setiap istilah. Istilah di luar daftar: arti tidak tersedia."
    wd["A2"].font = NOTE_FONT
    wd.append([])
    wd.append(["NO", "ISTILAH", "ARTI"])
    style_header(wd, 4, 1, 3)
    for i, (term, meaning) in enumerate(DICTIONARY, start=1):
        wd.append([i, term, meaning])
    autosize(wd, {1: 5, 2: 26, 3: 100})
    wb.save(path)


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "data"
    out.mkdir(parents=True, exist_ok=True)
    rng = random.Random(SEED)
    rows = build_rows(rng)
    write_assessment(out / "Assessment_RDDC.xlsx", rows)
    write_dictionary(out / "Dictionary_Prompt_IDR_Assessment_RDDC.xlsx")
    print(f"PENJUALAN: {len(rows)} baris -> {out / 'Assessment_RDDC.xlsx'}")
    print(f"Dictionary: {len(DICTIONARY)} istilah -> {out / 'Dictionary_Prompt_IDR_Assessment_RDDC.xlsx'}")


if __name__ == "__main__":
    main()
