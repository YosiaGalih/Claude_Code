# Claude_Code
Git tampung claude code

## Dashboard Penjualan Motor Honda 2024

Dashboard interaktif mandiri (1 file HTML, bisa langsung dibuka di browser, juga offline):

**`dist/Dashboard_Penjualan_Motor_Honda_2024.html`**

> ⚠️ **Data bawaan adalah data SINTETIS hasil reproduksi.** File asli (`Assessment_RDDC.xlsx`
> dan `Dictionary_Prompt_IDR_Assessment_RDDC.xlsx`) tidak tersedia saat dashboard dibuat, jadi
> struktur file dibangun ulang sesuai deskripsi prompt dengan angka acak (seed tetap). Angka di
> dashboard **bukan data resmi**. Header menampilkan label `DATA SINTETIS` selama data bawaan
> dipakai. Klik **Upload Excel** untuk memakai file asli tanpa build ulang.

### Isi
| Path | Keterangan |
|---|---|
| `data/Assessment_RDDC.xlsx` | Reproduksi: sheet `PENJUALAN` (4.850 baris, 1 baris = 1 unit 2024), `Mapping` (judul baris 1, header baris 2: master varian + nama bulan), `LATIHAN` (tidak dipakai) |
| `data/Dictionary_Prompt_IDR_Assessment_RDDC.xlsx` | Reproduksi kamus istilah (sheet `Dictionary`) |
| `src/` | Sumber dashboard: `index.html`, `styles.css`, `idrdash.js` (runtime IDRDash lokal), `app.js` |
| `vendor/chart.umd.4.4.1.min.js` | Chart.js 4.4.1 (MIT), ditanam ke HTML agar bisa offline |
| `scripts/generate_data.py` | Pembuat data sintetis |
| `scripts/build_dashboard.py` | Menanam isi Excel + kode ke 1 file HTML |
| `tests/smoke_test.js` | Uji Playwright (tanpa scroll, grafik terisi, filter, upload, chatbot, panel ⓘ) |

### Kasus kualitas data yang sengaja disisipkan
Tanggal tidak valid (mis. `20240231`, kosong) · nilai null → `Unknown` · kode varian yang tidak ada
di Mapping · penulisan tidak konsisten (`"honda"`, `"21-25"`) · kelompok n < 5 (`<16`, `VIAR`,
`CT125`, `Kaliwungu`). Semuanya dicatat otomatis di ikon ⓘ.

### Membangun ulang
```bash
python3 scripts/generate_data.py          # data sintetis (opsional)
python3 scripts/build_dashboard.py        # -> dist/...html
node tests/smoke_test.js                  # butuh Playwright + Chromium
```
Membangun dengan file asli (data asli ditanam, label sintetis hilang):
```bash
python3 scripts/build_dashboard.py /path/Assessment_RDDC.xlsx /path/Dictionary_Prompt_IDR_Assessment_RDDC.xlsx
```

### Catatan tentang IDRDash
`IDRDash` (fitur bawaan IDR) tidak tersedia di luar platform IDR, jadi `src/idrdash.js` adalah
runtime lokal dengan API `IDRDash.mount({ data, columns, filters, render })` plus ekstensi
`prepare` (gabung PENJUALAN ⨝ Mapping saat upload), `embedded()`, `setFilter()`, dan `getState()`.
Bila halaman dijalankan di platform IDR yang sudah menyediakan `window.IDRDash`, runtime lokal
tidak dipasang; ekstensi tersebut mungkin perlu disesuaikan dengan API IDR yang sebenarnya.
Upload `.xlsx` dibaca dengan `DecompressionStream` bawaan browser (tanpa pustaka pembaca file lain).
