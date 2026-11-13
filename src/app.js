/* Dashboard Penjualan Motor Honda 2024 — logika aplikasi.
 * Semua angka dihitung dari data yang diberikan IDRDash (bawaan maupun upload).
 */
(function () {
  'use strict';

  var IDR = window.IDRDash;

  /* ================================================================ KONSTAN */
  var AGE_ORDER = ['<16', '16 - 20', '21 - 25', '26 - 30', '31 - 35', '36 - 40', '41 - 45', '46 - 50', '51 - 55', '>55'];
  var SEG_ORDER = ['AT', 'CUB', 'SPORT'];
  var NEW_BUYER = 'BELUM PERNAH MEMILIKI';
  var UNKNOWN = 'Unknown';
  var DEFAULT_MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var BRAND_SLOTS = ['HONDA', NEW_BUYER, 'YAMAHA', 'SUZUKI']; // urutan slot warna tervalidasi
  var DICT_TERMS = ['AT', 'CUB', 'SPORT', 'CUST KEY', 'VARIANT KEY', 'MEREK SBLMNYA', 'BELUM PERNAH MEMILIKI', 'AGE GROUP'];
  var OTHER_TERMS = ['SALES DATE', 'SEGMEN', 'VARIAN', 'WARNA', 'DEALER', 'KECAMATAN', 'PENDIDIKAN'];

  var PAGES = [
    { title: 'Kontributor Penjualan', render: renderP1 },
    { title: 'Profil Konsumen', render: renderP2 }
  ];

  var FILTERS = [
    { key: 'SEGMEN', label: 'Segmen', short: 'Segmen', order: SEG_ORDER },
    { key: 'AGE GROUP', label: 'Kelompok Usia', short: 'Usia', order: AGE_ORDER },
    { key: 'MEREK SBLMNYA', label: 'Merek Sebelumnya', short: 'Merek' }
  ];

  var COLUMNS = [
    { key: 'SALES DATE', label: 'SALES DATE' },
    { key: 'TGL', label: 'TANGGAL (ISO)' },
    { key: 'KUARTAL', label: 'KUARTAL' },
    { key: 'CUST KEY', label: 'CUST KEY' },
    { key: 'VARIANT KEY', label: 'VARIANT KEY' },
    { key: 'VARIAN', label: 'NAMA VARIAN' },
    { key: 'SEGMEN', label: 'SEGMEN' },
    { key: 'WARNA', label: 'WARNA' },
    { key: 'DEALER', label: 'DEALER' },
    { key: 'KECAMATAN', label: 'KECAMATAN' },
    { key: 'MEREK SBLMNYA', label: 'MEREK SBLMNYA' },
    { key: 'PENDIDIKAN', label: 'PENDIDIKAN' },
    { key: 'AGE GROUP', label: 'AGE GROUP' },
    { key: 'TIPE KONSUMEN', label: 'TIPE KONSUMEN' }
  ];

  var APP = { page: 0, ctx: null, charts: {}, stale: [], infoOpen: false, entityIndex: null, entityIndexFor: null };

  /* ================================================================ UTIL */
  var nf = new Intl.NumberFormat('id-ID');
  function fmt(n) { return nf.format(Math.round(n)); }
  function share(a, b) { return b ? a / b * 100 : 0; }
  function fmtPct(v, d) {
    d = d == null ? 1 : d;
    return Number(v).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function trunc(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s; }
  function isUnknown(v) { return v == null || v === UNKNOWN || /^Unknown\b/.test(String(v)); }
  function norm(s) { return String(s == null ? '' : s).toUpperCase().replace(/[\s_.]+/g, ' ').trim(); }
  function titleCase(s) { return String(s).toLowerCase().replace(/(^|[\s\/(-])([a-z])/g, function (m, p, c) { return p + c.toUpperCase(); }); }
  function safe(fn, onErr) {
    try { return fn(); } catch (e) {
      console.error('[dashboard]', e);
      if (onErr) { try { onErr(e); } catch (e2) { console.error(e2); } }
      return undefined;
    }
  }
  function countBy(rows, key) {
    var m = new Map();
    for (var i = 0; i < rows.length; i++) { var v = rows[i][key]; m.set(v, (m.get(v) || 0) + 1); }
    return m;
  }
  function ranked(map, excludeUnknown) {
    return Array.from(map.entries())
      .filter(function (e) { return !excludeUnknown || !isUnknown(e[0]); })
      .sort(function (a, b) { return b[1] - a[1] || String(a[0]).localeCompare(String(b[0])); });
  }
  function ordered(map, order) {
    var keys = Array.from(map.keys());
    return keys.sort(function (a, b) {
      if (isUnknown(a) !== isUnknown(b)) return isUnknown(a) ? 1 : -1;
      var ia = order.indexOf(a), ib = order.indexOf(b);
      if (ia >= 0 || ib >= 0) return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
      return map.get(b) - map.get(a);
    }).map(function (k) { return [k, map.get(k)]; });
  }
  function nSmall(n) { return n > 0 && n < 5; }
  function ageShort(a) { return String(a).replace(/\s*-\s*/g, '–'); }
  function monthName(m, meta) {
    var list = (meta && meta.months && meta.months.length === 12) ? meta.months : DEFAULT_MONTHS;
    return list[m - 1] || String(m);
  }
  function ageSpan(a, b) {
    if (!a) return '';
    if (!b) return a;
    var ia = AGE_ORDER.indexOf(a), ib = AGE_ORDER.indexOf(b);
    var lo = AGE_ORDER[Math.min(ia, ib)], hi = AGE_ORDER[Math.max(ia, ib)];
    if (ia >= 0 && ib >= 0 && Math.abs(ia - ib) === 1 && / - /.test(lo) && / - /.test(hi)) return lo.split(' - ')[0] + '–' + hi.split(' - ')[1];
    return a + ' & ' + b;
  }
  function brandLabel(b) { return b === NEW_BUYER ? 'Belum Pernah Memiliki' : isUnknown(b) ? UNKNOWN : titleCase(b); }

  /* ================================================== PERSIAPAN DATA (JOIN) */
  var SALES_SPEC = {
    'SALES DATE': ['SALES DATE', 'TANGGAL', 'TANGGAL JUAL', 'TGL JUAL', 'SALESDATE', 'TGL PENJUALAN', 'TANGGAL PENJUALAN'],
    'CUST KEY': ['CUST KEY', 'CUSTOMER KEY', 'CUSTKEY', 'KODE KONSUMEN'],
    'VARIANT KEY': ['VARIANT KEY', 'VARIAN KEY', 'VARIANTKEY', 'KODE VARIAN'],
    'WARNA': ['WARNA', 'COLOR', 'COLOUR'],
    'DEALER': ['DEALER', 'NAMA DEALER', 'KODE DEALER'],
    'KECAMATAN': ['KECAMATAN', 'KEC'],
    'MEREK SBLMNYA': ['MEREK SBLMNYA', 'MEREK SEBELUMNYA', 'MERK SBLMNYA', 'MERK SEBELUMNYA', 'MEREK SBLM'],
    'PENDIDIKAN': ['PENDIDIKAN', 'EDUCATION'],
    'AGE GROUP': ['AGE GROUP', 'KELOMPOK USIA', 'AGEGROUP', 'KEL USIA'],
    'SEGMEN': ['SEGMEN', 'SEGMENT'],
    'NAMA VARIAN': ['NAMA VARIAN', 'DESKRIPSI VARIAN']
  };
  var MAP_SPEC = {
    'VARIAN': ['VARIAN', 'KODE VARIAN', 'VARIANT', 'VARIANT KEY', 'KODE'],
    'NAMA': ['NAMA VARIAN', 'NAMA', 'DESKRIPSI', 'DESKRIPSI VARIAN', 'TIPE', 'TYPE', 'NAMA TIPE', 'VARIANT NAME', 'NAME'],
    'SEGMEN': ['SEGMEN', 'SEGMENT', 'KATEGORI']
  };
  var MONTH_SPEC = {
    'NO': ['NO BULAN', 'BULAN KE', 'ANGKA BULAN', 'KODE BULAN', 'NO'],
    'NAMA': ['NAMA BULAN', 'BULAN', 'MONTH']
  };
  var DICT_SPEC = {
    'ISTILAH': ['ISTILAH', 'TERM', 'NAMA ISTILAH', 'KATA', 'KOLOM'],
    'ARTI': ['ARTI', 'DEFINISI', 'KETERANGAN', 'DESKRIPSI', 'MEANING', 'DEFINITION']
  };

  function findHeader(rows, spec, minHits, required) {
    var lim = Math.min(rows.length, 40);
    for (var i = 0; i < lim; i++) {
      var r = rows[i] || [];
      var normed = r.map(norm);
      var map = {};
      var hits = 0;
      Object.keys(spec).forEach(function (key) {
        var idx = -1;
        for (var s = 0; s < spec[key].length && idx < 0; s++) idx = normed.indexOf(spec[key][s]);
        if (idx >= 0) { map[key] = idx; hits++; }
      });
      if (hits >= minHits && required.every(function (k) { return k in map; })) return { row: i, cols: map };
    }
    return null;
  }

  function colLetter(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function colsLabel(cols) {
    var idx = Object.keys(cols).map(function (k) { return cols[k]; }).sort(function (a, b) { return a - b; });
    return colLetter(idx[0]) + '–' + colLetter(idx[idx.length - 1]);
  }

  function cleanText(v) {
    if (v == null) return null;
    var s = String(v).replace(/\s+/g, ' ').trim();
    if (!s || /^(-|–|NULL|N\/A|NA|NAN|#N\/A|NONE|\?)$/i.test(s)) return null;
    return s;
  }

  function ymd(y, m, d) {
    if (!(y >= 1900 && y <= 2100) || m < 1 || m > 12 || d < 1) return null;
    var dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
    if (d > dim) return null;
    return { y: y, m: m, d: d };
  }
  function parseSalesDate(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') {
      if (Number.isInteger(v) && v >= 19000101 && v <= 21001231) return ymd(Math.floor(v / 10000), Math.floor(v / 100) % 100, v % 100);
      if (v > 20000 && v < 80000) { // serial tanggal Excel
        var dt = new Date(Math.round((v - 25569) * 86400000));
        return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
      }
      return null;
    }
    var s = String(v).trim();
    var m;
    if (/^\d{8}$/.test(s)) return ymd(+s.slice(0, 4), +s.slice(4, 6), +s.slice(6, 8));
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return ymd(+m[1], +m[2], +m[3]);
    if ((m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/.exec(s))) return ymd(+m[3], +m[2], +m[1]);
    return null;
  }

  var AGE_KEYS = new Map(AGE_ORDER.map(function (a) { return [a.replace(/\s+/g, ''), a]; }));
  function bucketAge(n) {
    if (n < 16) return '<16';
    if (n > 55) return '>55';
    var lo = Math.floor((n - 16) / 5) * 5 + 16;
    return lo + ' - ' + (lo + 4);
  }
  function normAge(v) {
    var s = cleanText(v);
    if (!s) return UNKNOWN;
    var k = s.replace(/\s+/g, '').replace(/[–—]/g, '-').toUpperCase();
    if (AGE_KEYS.has(k)) return AGE_KEYS.get(k);
    if (/^\d{1,3}$/.test(k)) return bucketAge(+k);
    return s;
  }
  function normBrand(v) {
    var s = cleanText(v);
    if (!s) return UNKNOWN;
    s = s.toUpperCase();
    if (/BELUM/.test(s)) return NEW_BUYER;
    if (s === 'MERK LAIN' || s === 'LAINNYA') return 'LAINNYA';
    return s;
  }

  function makeCanon() {
    var seen = new Map();
    return function (v) {
      var s = cleanText(v);
      if (!s) return UNKNOWN;
      var key = s.toUpperCase();
      if (!seen.has(key)) seen.set(key, s === s.toLowerCase() ? titleCase(s) : s);
      return seen.get(key);
    };
  }

  function prepare(workbooks, prevMeta) {
    var meta = {
      files: workbooks.map(function (w) { return w.name; }),
      tables: [], unused: [], nulls: {}, invalidDates: [], unmapped: {}, normalized: 0, normalizedExamples: [],
      skipped: 0, dict: {}, months: null, period: null, mappingCount: 0, mappingSource: 'file', dictSource: 'file'
    };
    var sales = null, mapping = null, months = null, dict = null;

    workbooks.forEach(function (wb) {
      wb.sheets.forEach(function (sh) {
        var rows = sh.rows || [];
        var roles = [];
        var hs = findHeader(rows, SALES_SPEC, 4, ['VARIANT KEY']);
        if (hs && !sales) { sales = { wb: wb, sh: sh, h: hs }; roles.push('sales'); }
        if (!hs) {
          var hm = findHeader(rows, MAP_SPEC, 2, ['VARIAN', 'SEGMEN']);
          if (hm && !mapping) { mapping = { wb: wb, sh: sh, h: hm }; roles.push('mapping'); }
          var hb = findHeader(rows, MONTH_SPEC, 1, ['NAMA']);
          if (hb && !months && (!hm || hb.row === hm.row)) { months = { wb: wb, sh: sh, h: hb }; roles.push('months'); }
          var hd = findHeader(rows, DICT_SPEC, 2, ['ISTILAH', 'ARTI']);
          if (hd && !dict) { dict = { wb: wb, sh: sh, h: hd }; roles.push('dict'); }
        }
        if (!roles.length) {
          var reason = /latihan/i.test(sh.name) ? 'sheet latihan, sesuai instruksi tidak dipakai (bukan data transaksi)'
            : rows.some(function (r) { return r && r.length; }) ? 'tidak berisi tabel yang dibutuhkan (judul/keterangan/logo saja)' : 'sheet kosong';
          meta.unused.push({ file: wb.name, sheet: sh.name, reason: reason });
        }
      });
    });

    if (!sales) throw new Error('Tabel penjualan (kolom VARIANT KEY, SALES DATE, AGE GROUP, …) tidak ditemukan di file yang di-upload.');

    /* ---- Mapping varian */
    var vmap = new Map();
    if (mapping) {
      var mc = mapping.h.cols;
      var mrows = mapping.sh.rows;
      for (var i = mapping.h.row + 1; i < mrows.length; i++) {
        var r = mrows[i] || [];
        var code = cleanText(r[mc.VARIAN]);
        if (!code) continue;
        var seg = cleanText(r[mc.SEGMEN]);
        var nm = mc.NAMA != null ? cleanText(r[mc.NAMA]) : null;
        vmap.set(code.toUpperCase(), { name: nm || code, seg: seg ? seg.toUpperCase() : UNKNOWN });
      }
      meta.tables.push({ role: 'mapping', file: mapping.wb.name, sheet: mapping.sh.name, header: mapping.h.row + 1, cols: colsLabel(mapping.h.cols), n: vmap.size });
    } else if (prevMeta && prevMeta.mappingEntries) {
      prevMeta.mappingEntries.forEach(function (e) { vmap.set(e[0], e[1]); });
      meta.mappingSource = 'previous';
    } else {
      meta.mappingSource = 'none';
    }
    meta.mappingCount = vmap.size;
    meta.mappingEntries = Array.from(vmap.entries());

    /* ---- Daftar bulan */
    if (months) {
      var bc = months.h.cols;
      var list = [];
      for (var b = months.h.row + 1; b < months.sh.rows.length; b++) {
        var br = months.sh.rows[b] || [];
        var name = cleanText(br[bc.NAMA]);
        if (!name) continue;
        var no = bc.NO != null ? Number(br[bc.NO]) : list.length + 1;
        if (no >= 1 && no <= 12) list[no - 1] = name;
      }
      if (list.filter(Boolean).length === 12) {
        meta.months = list;
        meta.tables.push({ role: 'months', file: months.wb.name, sheet: months.sh.name, header: months.h.row + 1, cols: colsLabel(months.h.cols), n: 12 });
      }
    }
    if (!meta.months && prevMeta && prevMeta.months) meta.months = prevMeta.months;

    /* ---- Kamus */
    if (dict) {
      var dc = dict.h.cols;
      for (var d = dict.h.row + 1; d < dict.sh.rows.length; d++) {
        var dr = dict.sh.rows[d] || [];
        var term = cleanText(dr[dc.ISTILAH]);
        var arti = cleanText(dr[dc.ARTI]);
        if (term && arti) meta.dict[norm(term)] = arti;
      }
      meta.tables.push({ role: 'dict', file: dict.wb.name, sheet: dict.sh.name, header: dict.h.row + 1, cols: colsLabel(dict.h.cols), n: Object.keys(meta.dict).length });
    } else if (prevMeta && prevMeta.dict && Object.keys(prevMeta.dict).length) {
      meta.dict = prevMeta.dict;
      meta.dictSource = 'previous';
      meta.dictFile = prevMeta.dictFile;
    } else {
      meta.dictSource = 'none';
    }
    if (dict) meta.dictFile = dict.wb.name;

    /* ---- Penjualan (fakta) + join */
    var sc = sales.h.cols;
    var srows = sales.sh.rows;
    var canonWarna = makeCanon(), canonDealer = makeCanon(), canonKec = makeCanon();
    var nullCols = ['SALES DATE', 'CUST KEY', 'VARIANT KEY', 'WARNA', 'DEALER', 'KECAMATAN', 'MEREK SBLMNYA', 'PENDIDIKAN', 'AGE GROUP'];
    nullCols.forEach(function (c) { meta.nulls[c] = 0; });
    var data = [];
    var minD = null, maxD = null;
    var cell = function (r, key) { return sc[key] != null ? r[sc[key]] : null; };
    function noteNorm(raw, val, col) {
      if (raw == null || isUnknown(val)) return;
      if (String(raw) !== String(val)) {
        meta.normalized++;
        if (meta.normalizedExamples.length < 4) meta.normalizedExamples.push(col + ' "' + raw + '" → "' + val + '"');
      }
    }

    for (var s = sales.h.row + 1; s < srows.length; s++) {
      var row = srows[s] || [];
      var filled = 0;
      nullCols.forEach(function (c) { var v = cell(row, c); if (v != null && String(v).trim() !== '') filled++; });
      if (filled < 2) { if (row.some(function (v) { return v != null && v !== ''; })) meta.skipped++; continue; }

      nullCols.forEach(function (c) { if (cleanText(cell(row, c)) == null) meta.nulls[c]++; });

      var rawDate = cell(row, 'SALES DATE');
      var dt = parseSalesDate(rawDate);
      if (!dt) meta.invalidDates.push({ raw: rawDate == null || rawDate === '' ? '(kosong)' : String(rawDate), row: s + 1 });
      else {
        var key = dt.y * 10000 + dt.m * 100 + dt.d;
        if (minD == null || key < minD.k) minD = { k: key, v: dt };
        if (maxD == null || key > maxD.k) maxD = { k: key, v: dt };
      }

      var vk = cleanText(cell(row, 'VARIANT KEY'));
      var vkU = vk ? vk.toUpperCase() : null;
      var mp = vkU ? vmap.get(vkU) : null;
      var segmen, varian;
      if (mp) { segmen = mp.seg || UNKNOWN; varian = mp.name; }
      else if (vkU) {
        var ownSeg = cleanText(cell(row, 'SEGMEN'));
        var ownName = cleanText(cell(row, 'NAMA VARIAN'));
        segmen = ownSeg ? ownSeg.toUpperCase() : UNKNOWN;
        varian = ownName || (UNKNOWN + ' · ' + vkU);
        if (!ownSeg) meta.unmapped[vkU] = (meta.unmapped[vkU] || 0) + 1;
      } else { segmen = UNKNOWN; varian = UNKNOWN; }

      var rawBrand = cell(row, 'MEREK SBLMNYA');
      var brand = normBrand(rawBrand);
      noteNorm(rawBrand, brand, 'MEREK SBLMNYA');
      var rawAge = cell(row, 'AGE GROUP');
      var age = normAge(rawAge);
      noteNorm(rawAge, age, 'AGE GROUP');
      var rawWarna = cell(row, 'WARNA');
      var warna = canonWarna(rawWarna);
      noteNorm(rawWarna, warna, 'WARNA');
      var edu = cleanText(cell(row, 'PENDIDIKAN'));

      data.push({
        'SALES DATE': rawDate,
        'TGL': dt ? dt.y + '-' + String(dt.m).padStart(2, '0') + '-' + String(dt.d).padStart(2, '0') : null,
        'TAHUN': dt ? dt.y : null,
        'BULAN': dt ? dt.m : null,
        'KUARTAL': dt ? 'Q' + Math.ceil(dt.m / 3) + ' ' + dt.y : null,
        'CUST KEY': cleanText(cell(row, 'CUST KEY')) || UNKNOWN,
        'VARIANT KEY': vkU || UNKNOWN,
        'VARIAN': varian,
        'SEGMEN': segmen,
        'WARNA': warna,
        'DEALER': canonDealer(cell(row, 'DEALER')),
        'KECAMATAN': canonKec(cell(row, 'KECAMATAN')),
        'MEREK SBLMNYA': brand,
        'PENDIDIKAN': edu ? edu.toUpperCase() : UNKNOWN,
        'AGE GROUP': age,
        'TIPE KONSUMEN': brand === NEW_BUYER ? 'Konsumen baru' : brand === 'HONDA' ? 'Repeat Honda' : isUnknown(brand) ? UNKNOWN : 'Pindahan merek lain'
      });
    }
    meta.tables.unshift({ role: 'sales', file: sales.wb.name, sheet: sales.sh.name, header: sales.h.row + 1, cols: colsLabel(sales.h.cols), n: data.length });
    meta.period = minD ? { min: minD.v, max: maxD.v } : null;
    return { data: data, meta: meta };
  }

  /* ================================================================ TEMA */
  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function theme() {
    var rootFs = parseFloat(getComputedStyle(document.documentElement).fontSize) || 13;
    return {
      fs: Math.max(10, Math.min(12.5, Math.round(rootFs * 0.84 * 2) / 2)),
      text: cssVar('--text'), text2: cssVar('--text-2'), text3: cssVar('--text-3'),
      grid: cssVar('--grid'), surface: cssVar('--surface'), warn: cssVar('--warn'),
      seg: { AT: cssVar('--s-at'), CUB: cssVar('--s-cub'), SPORT: cssVar('--s-sport') },
      extraSeg: [cssVar('--b-4'), cssVar('--b-3'), cssVar('--s-measure')],
      unknown: cssVar('--s-unknown'), other: cssVar('--s-other'), measure: cssVar('--s-measure'),
      brands: [cssVar('--b-1'), cssVar('--b-2'), cssVar('--b-3'), cssVar('--b-4')]
    };
  }
  function segColor(seg, T, allSegs) {
    if (T.seg[seg]) return T.seg[seg];
    if (isUnknown(seg)) return T.unknown;
    var extras = (allSegs || []).filter(function (s) { return !T.seg[s] && !isUnknown(s); });
    var i = extras.indexOf(seg);
    return T.extraSeg[i] || T.other;
  }
  function alpha(hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  /* ======================================================= CHART PLUGINS */
  // Plugin dibuat per grafik (closure) agar opsi array/fungsi tidak di-resolve ulang oleh Chart.js.
  function valueLabels(o) {
    return {
      id: 'valueLabels',
      afterDatasetsDraw: function (chart) {
        var meta = chart.getDatasetMeta(0);
        if (!meta || meta.hidden) return;
        var ctx = chart.ctx;
        var horizontal = chart.options.indexAxis === 'y';
        ctx.save();
        ctx.font = '600 ' + o.size + 'px ' + Chart.defaults.font.family;
        meta.data.forEach(function (bar, i) {
          var v = chart.data.datasets[0].data[i];
          if (v == null) return;
          var small = o.flagSmall && nSmall(v);
          var txt = fmt(v) + (small ? ' · n<5' : '');
          ctx.fillStyle = small ? o.warn : o.color;
          if (horizontal) { ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(txt, bar.x + 4, bar.y); }
          else { ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(txt, bar.x, bar.y - 3); }
        });
        ctx.restore();
      }
    };
  }
  function stackTotals(o) {
    return {
      id: 'stackTotals',
      afterDatasetsDraw: function (chart) {
        var ctx = chart.ctx;
        var y = chart.scales.y;
        var n = chart.data.labels.length;
        ctx.save();
        ctx.font = '600 ' + o.size + 'px ' + Chart.defaults.font.family;
        ctx.fillStyle = o.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        for (var i = 0; i < n; i++) {
          var sum = 0, x = null;
          chart.data.datasets.forEach(function (ds, di) {
            if (!chart.isDatasetVisible(di)) return;
            sum += ds.data[i] || 0;
            var el = chart.getDatasetMeta(di).data[i];
            if (el && x == null) x = el.x;
          });
          if (x != null && sum > 0) ctx.fillText(fmt(sum), x, y.getPixelForValue(sum) - 3);
        }
        ctx.restore();
      }
    };
  }
  function smallMarks(o) {
    return {
      id: 'smallMarks',
      afterDatasetsDraw: function (chart) {
        if (!o.indices.length) return;
        var ctx = chart.ctx;
        var meta = chart.getDatasetMeta(0);
        ctx.save();
        ctx.font = '700 ' + o.size + 'px ' + Chart.defaults.font.family;
        ctx.fillStyle = o.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        o.indices.forEach(function (i) {
          var el = meta.data[i];
          if (el) ctx.fillText('n<5', el.x, chart.chartArea.top - 1);
        });
        ctx.restore();
      }
    };
  }
  function centerText(o) {
    return {
      id: 'centerText',
      afterDraw: function (chart) {
        var arc = chart.getDatasetMeta(0).data[0];
        if (!arc) return;
        var p = arc.getProps(['x', 'y', 'innerRadius'], true);
        var ctx = chart.ctx;
        var big = Math.max(11, Math.min(24, p.innerRadius * 0.36));
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = o.color;
        ctx.font = '700 ' + big + 'px ' + Chart.defaults.font.family;
        ctx.fillText(o.value, p.x, p.y - big * 0.3);
        ctx.fillStyle = o.sub;
        ctx.font = '500 ' + Math.max(9, big * 0.48) + 'px ' + Chart.defaults.font.family;
        ctx.fillText(o.label, p.x, p.y + big * 0.55);
        ctx.restore();
      }
    };
  }

  /* ======================================================= CHART HELPERS */
  function chartDefaults(T) {
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    Chart.defaults.font.size = T.fs;
    Chart.defaults.color = T.text2;
    Chart.defaults.borderColor = T.grid;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.responsive = true;
    Chart.defaults.animation.duration = 260;
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(17,20,24,.94)';
    Chart.defaults.plugins.tooltip.titleColor = '#fff';
    Chart.defaults.plugins.tooltip.bodyColor = '#e8e9ec';
    Chart.defaults.plugins.tooltip.footerColor = '#c9ccd3';
    Chart.defaults.plugins.tooltip.padding = 8;
    Chart.defaults.plugins.tooltip.cornerRadius = 6;
    Chart.defaults.plugins.tooltip.boxPadding = 4;
    Chart.defaults.plugins.legend.labels.boxWidth = 10;
    Chart.defaults.plugins.legend.labels.boxHeight = 10;
    Chart.defaults.plugins.legend.labels.padding = 8;
  }

  function destroyChart(id) {
    if (APP.charts[id]) { APP.charts[id].destroy(); delete APP.charts[id]; }
  }
  function makeChart(id, config) {
    destroyChart(id);
    var canvas = document.getElementById(id);
    var cv = canvas.parentElement;
    var old = cv.querySelector('.empty');
    if (old) old.remove();
    canvas.style.display = '';
    APP.charts[id] = new Chart(canvas, config);
    return APP.charts[id];
  }
  function emptyChart(id, msg) {
    destroyChart(id);
    var canvas = document.getElementById(id);
    var cv = canvas.parentElement;
    canvas.style.display = 'none';
    var e = cv.querySelector('.empty') || document.createElement('div');
    e.className = 'empty';
    e.textContent = msg;
    cv.appendChild(e);
  }
  function truncTick(maxFrac, pxPerChar) {
    return function (value) {
      var lbl = this.getLabelForValue(value);
      var n = Math.max(6, Math.min(26, Math.floor(this.chart.width * maxFrac / pxPerChar)));
      return trunc(lbl, n);
    };
  }
  function hoverPointer(evt, els) {
    var t = evt && evt.native && evt.native.target;
    if (t) t.style.cursor = els && els.length ? 'pointer' : 'default';
  }
  function toggleFilter(key, values) {
    if (!IDR || typeof IDR.setFilter !== 'function' || typeof IDR.getState !== 'function') return;
    var cur = IDR.getState().filters.filter(function (f) { return f.key === key; })[0];
    var same = cur && cur.values.length === values.length && values.every(function (v) { return cur.values.indexOf(v) >= 0; });
    IDR.setFilter(key, same ? [] : values);
  }
  function initialLegendPos(id) {
    var cv = document.getElementById(id).parentElement;
    return cv.clientWidth > cv.clientHeight * 1.25 ? 'right' : 'bottom';
  }
  function legendPos(chart, size) {
    var pos = size.width > size.height * 1.25 ? 'right' : 'bottom';
    if (chart.options.plugins.legend.position !== pos) chart.options.plugins.legend.position = pos;
  }
  function doughnutLegendLabels(fullLabels, total, counts) {
    return function (chart) {
      var base = Chart.overrides.doughnut.plugins.legend.labels.generateLabels(chart);
      var maxChars = chart.options.plugins.legend.position === 'right' ? 22 : 20;
      base.forEach(function (it) {
        var c = counts[it.index];
        it.text = trunc(fullLabels[it.index], maxChars) + '  ' + fmtPct(share(c, total), 1);
        it.fontColor = chart.options.plugins.legend.labels.color;
        it.strokeStyle = it.fillStyle;
        it.lineWidth = 0;
      });
      return base;
    };
  }
  function nNote(n) { return nSmall(n) ? '⚠ n kecil (n=' + n + ')' : ''; }

  /* ================================================================ RENDER */
  function render(ctx) {
    APP.ctx = ctx;
    APP.stale = PAGES.map(function () { return true; });
    safe(renderHeaderSub);
    safe(renderFilterSummary);
    renderPage(APP.page);
    queueFit();
    safe(updateChatContext);
    if (APP.infoOpen) safe(renderInfo);
  }

  function renderPage(i) {
    if (!APP.ctx) return;
    chartDefaults(theme());
    PAGES[i].render(APP.ctx);
    APP.stale[i] = false;
    queueFit();
  }

  function periodText(meta, short) {
    if (!meta || !meta.period) return 'Periode: data tidak tersedia';
    var a = meta.period.min, b = meta.period.max;
    var mn = function (m) { var n = monthName(m, meta); return short ? n.slice(0, 3) : n; };
    if (a.y === b.y) return 'Periode ' + a.d + ' ' + mn(a.m) + ' – ' + b.d + ' ' + mn(b.m) + ' ' + b.y;
    return 'Periode ' + a.d + ' ' + mn(a.m) + ' ' + a.y + ' – ' + b.d + ' ' + mn(b.m) + ' ' + b.y;
  }

  function renderHeaderSub() {
    var ctx = APP.ctx;
    var src = ctx.source || {};
    var files = src.kind === 'upload' ? src.label : (ctx.meta.files || []).join(' + ');
    var el = document.getElementById('hdrSub');
    var syn = ctx.meta.synthetic && src.kind !== 'upload';
    el.innerHTML = esc(periodText(ctx.meta, true)) +
      (syn ? '<span class="pill" title="Data bawaan adalah reproduksi sintetis, bukan data resmi">DATA SINTETIS</span>' : '') +
      ' · ' + esc(files || 'data tidak tersedia');
    el.title = periodText(ctx.meta) + ' · ' + files + (syn ? ' · data reproduksi sintetis' : '');
  }

  function filterText(ctx) {
    if (!ctx.filters.length) return 'Semua data';
    return ctx.filters.map(function (f) {
      return f.label + ' = ' + (f.values.length > 2 ? f.values.slice(0, 2).join(', ') + ' +' + (f.values.length - 2) : f.values.join(', '));
    }).join(' · ');
  }
  function renderFilterSummary() {
    var t = 'Filter: ' + filterText(APP.ctx) + ' · n = ' + fmt(APP.ctx.rows.length) + ' unit';
    document.querySelectorAll('[data-filter-summary]').forEach(function (e) { e.textContent = t; e.title = t; });
  }

  function setKpi(id, valueHtml, subHtml, title) {
    var el = document.getElementById(id);
    el.querySelector('.kpi-value').innerHTML = valueHtml;
    el.querySelector('.kpi-sub').innerHTML = subHtml || '';
    el.title = title || el.querySelector('.kpi-label').textContent + ': ' + el.textContent.replace(/\s+/g, ' ').trim();
  }
  function kpiFail(id) { setKpi(id, '–', 'data tidak tersedia'); }
  function setInsight(id, html) {
    var box = document.getElementById(id);
    box.querySelector('.ins-text').innerHTML = html;
    fitInsight(box);
  }
  function fitInsight(box) {
    if (!box) return;
    var p = box.querySelector('.ins-text');
    var rootFs = parseFloat(getComputedStyle(document.documentElement).fontSize) || 13;
    var fs = Math.max(11, Math.min(14, rootFs));
    p.style.setProperty('--ins-fs', fs + 'px');
    var guard = 0;
    while (p.scrollHeight > Math.ceil(fs * 1.35 * 2) + 2 && fs > 9 && guard++ < 20) {
      fs -= 0.5;
      p.style.setProperty('--ins-fs', fs + 'px');
    }
  }

  // Perkecil font elemen satu baris sampai muat (tanpa terpotong); "…" hanya bila sudah di batas minimum.
  function fitLine(el, minPx) {
    el.style.fontSize = '';
    var fs = parseFloat(getComputedStyle(el).fontSize);
    var guard = 0;
    while (el.scrollWidth > el.clientWidth + 0.5 && fs > minPx && guard++ < 40) {
      fs -= 0.5;
      el.style.fontSize = fs + 'px';
    }
  }
  var FIT_RULES = [['.title', 12], ['#hdrSub', 9], ['.page.active .bq-text', 10.5], ['.page.active .kpi-label', 8.5],
    ['.page.active .kpi-value', 12], ['.page.active .kpi-sub', 8.5], ['.page.active .card figcaption', 10]];
  function fitAll() {
    FIT_RULES.forEach(function (r) { document.querySelectorAll(r[0]).forEach(function (el) { fitLine(el, r[1]); }); });
    fitInsight(document.querySelector('.page.active .insight'));
  }
  var fitQueued = false;
  function queueFit() {
    if (fitQueued) return;
    fitQueued = true;
    requestAnimationFrame(function () { fitQueued = false; safe(fitAll); });
  }

  /* ------------------------------------------------------------ HALAMAN 1 */
  function renderP1(ctx) {
    var rows = ctx.rows;
    var total = rows.length;
    var T = theme();
    var EMPTY = 'Tidak ada data untuk kombinasi filter ini — ubah atau reset filter.';
    var segMap = countBy(rows, 'SEGMEN');
    var allSegs = Array.from(countBy(ctx.allRows, 'SEGMEN').keys());
    var segs = ordered(segMap, SEG_ORDER);
    var segRank = ranked(segMap, true);
    var varRank = ranked(countBy(rows, 'VARIAN'), true);
    var varSeg = {};
    rows.forEach(function (r) { varSeg[r.VARIAN] = r.SEGMEN; });

    // KPI 1 — Total penjualan
    safe(function () {
      if (!total) return kpiFail('k1a');
      var inv = rows.filter(function (r) { return !r.TGL; }).length;
      var all = ctx.allRows.length;
      var sub = total === all ? '100% data · ' : fmtPct(share(total, all)) + ' dari ' + fmt(all) + ' unit · ';
      sub += inv ? fmt(inv) + ' tgl tidak valid (di luar grafik kuartal)' : 'semua tanggal valid';
      setKpi('k1a', fmt(total) + '<span class="unit">unit</span>', sub);
    }, function () { kpiFail('k1a'); });

    // KPI 2 — Segmen terbesar
    safe(function () {
      if (!segRank.length) return kpiFail('k1b');
      var top = segRank[0];
      var rest = segRank.slice(1, 3).map(function (e) { return esc(e[0]) + ' ' + fmtPct(share(e[1], total)); }).join(' · ');
      setKpi('k1b', esc(top[0]) + '<span class="sep">·</span>' + fmtPct(share(top[1], total)),
        fmt(top[1]) + ' unit' + (rest ? ' · ' + rest : '') + (nSmall(top[1]) ? ' · <span class="nsmall">n kecil</span>' : ''));
    }, function () { kpiFail('k1b'); });

    // KPI 3 — Varian terlaris
    safe(function () {
      if (!varRank.length) return kpiFail('k1c');
      var top = varRank[0];
      setKpi('k1c', esc(top[0]) + '<span class="sep">·</span>' + fmt(top[1]) + '<span class="unit">unit</span>',
        'Segmen ' + esc(varSeg[top[0]] || UNKNOWN) + ' · ' + fmtPct(share(top[1], total)) + ' dari total' + (nSmall(top[1]) ? ' · <span class="nsmall">n kecil</span>' : ''),
        'Varian terlaris: ' + top[0] + ' — ' + fmt(top[1]) + ' unit');
    }, function () { kpiFail('k1c'); });

    // Grafik 1 — Doughnut segmen
    safe(function () {
      if (!total) return emptyChart('ch1a', EMPTY);
      var labels = segs.map(function (e) { return e[0]; });
      var counts = segs.map(function (e) { return e[1]; });
      makeChart('ch1a', {
        type: 'doughnut',
        data: { labels: labels, datasets: [{ data: counts, backgroundColor: labels.map(function (s) { return segColor(s, T, allSegs); }), borderColor: T.surface, borderWidth: 2, hoverOffset: 5 }] },
        options: {
          cutout: '60%',
          layout: { padding: 4 },
          onResize: legendPos,
          onHover: hoverPointer,
          onClick: function (e, els) { if (els.length) toggleFilter('SEGMEN', [labels[els[0].index]]); },
          plugins: {
            legend: { display: labels.length > 1, position: initialLegendPos('ch1a'), labels: { color: T.text2, generateLabels: doughnutLegendLabels(labels, total, counts) } },
            tooltip: {
              callbacks: {
                title: function (it) { return 'Segmen ' + labels[it[0].dataIndex]; },
                label: function (it) { return fmt(it.raw) + ' unit (' + fmtPct(share(it.raw, total)) + ')'; },
                afterLabel: function (it) { return nNote(it.raw); },
                footer: function () { return 'Klik untuk memfilter segmen'; }
              }
            },
          }
        },
        plugins: [centerText({ value: fmt(total), label: 'unit', color: T.text, sub: T.text3 })]
      });
    }, function () { emptyChart('ch1a', 'data tidak tersedia'); });

    // Grafik 2 — 10 varian terlaris
    safe(function () {
      var top = varRank.slice(0, 10);
      if (!top.length) return emptyChart('ch1b', EMPTY);
      var labels = top.map(function (e) { return e[0]; });
      makeChart('ch1b', {
        type: 'bar',
        data: { labels: labels, datasets: [{ label: 'Unit', data: top.map(function (e) { return e[1]; }), backgroundColor: labels.map(function (v) { return segColor(varSeg[v], T, allSegs); }), borderRadius: 4, borderSkipped: 'start', barPercentage: 0.8, categoryPercentage: 0.88, maxBarThickness: 24 }] },
        options: {
          indexAxis: 'y',
          layout: { padding: { right: 40 } },
          scales: {
            x: { beginAtZero: true, grace: '4%', border: { display: false }, grid: { color: T.grid }, ticks: { maxTicksLimit: 5, color: T.text3, callback: function (v) { return fmt(v); } } },
            y: { border: { display: false }, grid: { display: false }, ticks: { autoSkip: false, color: T.text2, callback: truncTick(0.36, T.fs * 0.58) } }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: function (it) { return labels[it[0].dataIndex]; },
                label: function (it) { return fmt(it.raw) + ' unit · ' + fmtPct(share(it.raw, total)) + ' dari total'; },
                afterLabel: function (it) { var s = varSeg[labels[it.dataIndex]]; return ['Segmen ' + s, nNote(it.raw)].filter(Boolean); }
              }
            },
          }
        },
        plugins: [valueLabels({ size: T.fs - 0.5, color: T.text2, warn: T.warn, flagSmall: true })]
      });
    }, function () { emptyChart('ch1b', 'data tidak tersedia'); });

    // Grafik 3 — unit per kuartal per segmen (stacked)
    safe(function () {
      var dated = rows.filter(function (r) { return r.KUARTAL; });
      if (!dated.length) return emptyChart('ch1c', total ? 'Tanggal valid tidak tersedia untuk grafik kuartal.' : EMPTY);
      var inv = total - dated.length;
      var qs = Array.from(new Set(dated.map(function (r) { return r.TAHUN * 10 + Math.ceil(r.BULAN / 3); }))).sort(function (a, b) { return a - b; });
      var years = new Set(qs.map(function (q) { return Math.floor(q / 10); }));
      var qLabel = function (q) { return 'Q' + (q % 10) + ' ' + Math.floor(q / 10); };
      var qShort = function (q) { return years.size > 1 ? 'Q' + (q % 10) + "'" + String(Math.floor(q / 10)).slice(2) : 'Q' + (q % 10); };
      var segList = ordered(countBy(dated, 'SEGMEN'), SEG_ORDER).map(function (e) { return e[0]; });
      var grid = {};
      dated.forEach(function (r) {
        var q = r.TAHUN * 10 + Math.ceil(r.BULAN / 3);
        var k = r.SEGMEN + '|' + q;
        grid[k] = (grid[k] || 0) + 1;
      });
      var sets = segList.map(function (s) { return qs.map(function (q) { return grid[s + '|' + q] || 0; }); });
      var topIdx = qs.map(function (q, i) { var t = -1; sets.forEach(function (d, di) { if (d[i] > 0) t = di; }); return t; });
      var totals = qs.map(function (q, i) { return sets.reduce(function (a, d) { return a + d[i]; }, 0); });
      makeChart('ch1c', {
        type: 'bar',
        data: {
          labels: qs.map(qShort),
          datasets: segList.map(function (s, di) {
            return {
              label: s, data: sets[di], backgroundColor: segColor(s, T, allSegs),
              borderColor: T.surface, borderWidth: { top: 2, left: 0, right: 0, bottom: 0 }, borderSkipped: 'start',
              borderRadius: function (c) { return topIdx[c.dataIndex] === c.datasetIndex ? { topLeft: 4, topRight: 4 } : 0; },
              maxBarThickness: 46
            };
          })
        },
        options: {
          layout: { padding: { top: 16 } },
          scales: {
            x: { stacked: true, border: { display: false }, grid: { display: false }, ticks: { color: T.text2, maxRotation: 0, minRotation: 0 } },
            y: { stacked: true, beginAtZero: true, border: { display: false }, grid: { color: T.grid }, ticks: { maxTicksLimit: 5, color: T.text3, callback: function (v) { return fmt(v); } } }
          },
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: segList.length > 1, position: 'bottom', labels: { color: T.text2 } },
            tooltip: {
              callbacks: {
                title: function (it) { return qLabel(qs[it[0].dataIndex]); },
                label: function (it) { return it.dataset.label + ': ' + fmt(it.raw) + ' unit (' + fmtPct(share(it.raw, totals[it.dataIndex])) + ')' + (nSmall(it.raw) ? ' · n kecil' : ''); },
                footer: function (it) { return ['Total: ' + fmt(totals[it[0].dataIndex]) + ' unit'].concat(inv ? [fmt(inv) + ' baris tgl tidak valid tidak dihitung'] : []); }
              }
            },
          }
        },
        plugins: [stackTotals({ size: T.fs - 0.5, color: T.text2 })]
      });
    }, function () { emptyChart('ch1c', 'data tidak tersedia'); });

    // Insight halaman 1
    safe(function () {
      if (!total) return setInsight('ins1', 'Tidak ada data pada kombinasi filter ini — <b>ubah atau reset filter</b> untuk melihat insight.');
      var parts = [];
      var s1 = segRank[0];
      var top3 = varRank.slice(0, 3);
      var share3 = share(top3.reduce(function (a, e) { return a + e[1]; }, 0), total);
      if (s1) parts.push('Segmen <b>' + esc(s1[0]) + '</b> = <b>' + fmtPct(share(s1[1], total)) + '</b> unit (' + fmt(s1[1]) + ' dari ' + fmt(total) + ')');
      if (top3.length) parts.push('<b>' + esc(top3[0][0]) + '</b> terlaris (<b>' + fmt(top3[0][1]) + ' unit</b>)' + (top3.length > 1 ? ', ' + top3.length + ' varian teratas = <b>' + fmtPct(share3) + '</b>' : ''));
      var dated = rows.filter(function (r) { return r.KUARTAL; });
      var qCount = ranked(countBy(dated, 'KUARTAL'), true);
      var action = 'Aksi: <b>jaga stok ' + top3.map(function (e) { return esc(e[0]); }).join(', ').replace(/, ([^,]*)$/, ' &amp; $1') + '</b>';
      if (qCount.length) action += ' + buffer menjelang <b>' + esc(qCount[0][0].split(' ')[0]) + '</b> (puncak, ' + fmt(qCount[0][1]) + ' unit)';
      var s2 = segRank[1];
      if (s2) {
        var s2Top = ranked(countBy(rows.filter(function (r) { return r.SEGMEN === s2[0]; }), 'VARIAN'), true)[0];
        action += '; amankan pasokan <b>' + esc(s2[0]) + '</b> (' + fmtPct(share(s2[1], total)) + ')' + (s2Top ? ', terutama <b>' + esc(s2Top[0]) + '</b>' : '');
      }
      setInsight('ins1', parts.join('; ') + '. ' + action + '.');
    }, function () { setInsight('ins1', 'Insight: data tidak tersedia.'); });
  }

  /* ------------------------------------------------------------ HALAMAN 2 */
  function brandSlots(allRows) {
    var rank = ranked(countBy(allRows, 'MEREK SBLMNYA'), true);
    var top = rank.slice(0, 4).map(function (e) { return e[0]; });
    var slots = {};
    var free = [0, 1, 2, 3];
    top.forEach(function (b) { var i = BRAND_SLOTS.indexOf(b); if (i >= 0) { slots[b] = i; free.splice(free.indexOf(i), 1); } });
    top.forEach(function (b) { if (!(b in slots)) slots[b] = free.shift(); });
    return slots;
  }

  function renderP2(ctx) {
    var rows = ctx.rows;
    var total = rows.length;
    var T = theme();
    var EMPTY = 'Tidak ada data untuk kombinasi filter ini — ubah atau reset filter.';
    var allSegs = Array.from(countBy(ctx.allRows, 'SEGMEN').keys());
    var ageMap = countBy(rows, 'AGE GROUP');
    var ageRank = ranked(ageMap, true);
    var brandMap = countBy(rows, 'MEREK SBLMNYA');
    var nNew = brandMap.get(NEW_BUYER) || 0;
    var switchers = rows.filter(function (r) { return r['TIPE KONSUMEN'] === 'Pindahan merek lain'; });
    var swRank = ranked(countBy(switchers, 'MEREK SBLMNYA'), true);
    var kecRank = ranked(countBy(rows, 'KECAMATAN'), true);

    // KPI 1 — Kelompok usia terbesar
    safe(function () {
      if (!ageRank.length) return kpiFail('k2a');
      var a = ageRank[0], b = ageRank[1];
      setKpi('k2a', esc(a[0]) + '<span class="sep">·</span>' + fmtPct(share(a[1], total)),
        fmt(a[1]) + ' unit' + (b ? ' · berikutnya ' + esc(b[0]) + ' ' + fmtPct(share(b[1], total)) : '') + (nSmall(a[1]) ? ' · <span class="nsmall">n kecil</span>' : ''));
    }, function () { kpiFail('k2a'); });

    // KPI 2 — Konsumen baru
    safe(function () {
      if (!total) return kpiFail('k2b');
      setKpi('k2b', fmtPct(share(nNew, total)),
        fmt(nNew) + ' dari ' + fmt(total) + ' unit belum pernah memiliki motor' + (nSmall(nNew) ? ' · <span class="nsmall">n kecil</span>' : ''));
    }, function () { kpiFail('k2b'); });

    // KPI 3 — Pindahan merek lain
    safe(function () {
      if (!total) return kpiFail('k2c');
      var top = swRank[0];
      var rep = brandMap.get('HONDA') || 0;
      setKpi('k2c', fmtPct(share(switchers.length, total)),
        fmt(switchers.length) + ' unit' + (top ? ' · terbanyak ' + esc(brandLabel(top[0])) + ' ' + fmtPct(share(top[1], total)) : '') + ' · repeat Honda ' + fmtPct(share(rep, total)) + (nSmall(switchers.length) ? ' · <span class="nsmall">n kecil</span>' : ''));
    }, function () { kpiFail('k2c'); });

    // Grafik 1 — Unit per kelompok usia
    safe(function () {
      if (!total) return emptyChart('ch2a', EMPTY);
      var ages = ordered(ageMap, AGE_ORDER);
      var labels = ages.map(function (e) { return e[0]; });
      var data = ages.map(function (e) { return e[1]; });
      makeChart('ch2a', {
        type: 'bar',
        data: { labels: labels.map(ageShort), datasets: [{ label: 'Unit', data: data, backgroundColor: labels.map(function (l, i) { var c = isUnknown(l) ? T.unknown : T.measure; return nSmall(data[i]) ? alpha(c, 0.45) : c; }), borderRadius: 4, borderSkipped: 'start', maxBarThickness: 40, categoryPercentage: 0.86 }] },
        options: {
          layout: { padding: { top: 16 } },
          onHover: hoverPointer,
          onClick: function (e, els) { if (els.length) toggleFilter('AGE GROUP', [labels[els[0].index]]); },
          scales: {
            x: { border: { display: false }, grid: { display: false }, ticks: { autoSkip: false, maxRotation: 0, minRotation: 0, color: T.text2, callback: function (v) { var l = this.getLabelForValue(v); var n = Math.max(3, Math.floor(this.chart.width / labels.length / (T.fs * 0.6))); return trunc(l, n); } } },
            y: { beginAtZero: true, grace: '6%', border: { display: false }, grid: { color: T.grid }, ticks: { maxTicksLimit: 5, color: T.text3, callback: function (v) { return fmt(v); } } }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: function (it) { return 'Usia ' + labels[it[0].dataIndex]; },
                label: function (it) { return fmt(it.raw) + ' unit (' + fmtPct(share(it.raw, total)) + ')'; },
                afterLabel: function (it) { return nNote(it.raw); },
                footer: function () { return 'Klik untuk memfilter kelompok usia'; }
              }
            },
          }
        },
        plugins: [valueLabels({ size: T.fs - 1, color: T.text2, warn: T.warn, flagSmall: true })]
      });
    }, function () { emptyChart('ch2a', 'data tidak tersedia'); });

    // Grafik 2 — Komposisi merek sebelumnya
    safe(function () {
      if (!total) return emptyChart('ch2b', EMPTY);
      var slots = brandSlots(ctx.allRows);
      var named = [], other = [], unk = 0;
      brandMap.forEach(function (n, b) {
        if (isUnknown(b)) unk += n;
        else if (b in slots) named.push([b, n]);
        else other.push([b, n]);
      });
      named.sort(function (a, b) { return slots[a[0]] - slots[b[0]]; });
      other.sort(function (a, b) { return b[1] - a[1]; });
      var cats = named.map(function (e) { return { key: e[0], label: brandLabel(e[0]), n: e[1], color: T.brands[slots[e[0]]], members: [e[0]] }; });
      var oN = other.reduce(function (a, e) { return a + e[1]; }, 0);
      if (oN) cats.push({ key: 'Lainnya', label: 'Lainnya', n: oN, color: T.other, members: other.map(function (e) { return e[0]; }), detail: other });
      if (unk) cats.push({ key: UNKNOWN, label: UNKNOWN, n: unk, color: T.unknown, members: [UNKNOWN] });
      var counts = cats.map(function (c) { return c.n; });
      var labels = cats.map(function (c) { return c.label; });
      makeChart('ch2b', {
        type: 'doughnut',
        data: { labels: labels, datasets: [{ data: counts, backgroundColor: cats.map(function (c) { return c.color; }), borderColor: T.surface, borderWidth: 2, hoverOffset: 5 }] },
        options: {
          cutout: '58%',
          layout: { padding: 4 },
          onResize: legendPos,
          onHover: hoverPointer,
          onClick: function (e, els) { if (els.length) toggleFilter('MEREK SBLMNYA', cats[els[0].index].members); },
          plugins: {
            legend: { display: labels.length > 1, position: initialLegendPos('ch2b'), labels: { color: T.text2, generateLabels: doughnutLegendLabels(labels, total, counts) } },
            tooltip: {
              callbacks: {
                title: function (it) { var c = cats[it[0].dataIndex]; return c.key === 'Lainnya' ? 'Lainnya (merek lain)' : c.members[0]; },
                label: function (it) { return fmt(it.raw) + ' unit (' + fmtPct(share(it.raw, total)) + ')'; },
                afterLabel: function (it) {
                  var c = cats[it.dataIndex];
                  var out = [];
                  if (c.detail) c.detail.forEach(function (d) { out.push('• ' + d[0] + ': ' + fmt(d[1]) + (nSmall(d[1]) ? ' (n kecil)' : '')); });
                  if (nSmall(it.raw)) out.push(nNote(it.raw));
                  return out;
                },
                footer: function () { return 'Klik untuk memfilter merek'; }
              }
            },
          }
        },
        plugins: [centerText({ value: fmtPct(share(switchers.length, total), 0), label: 'pindahan', color: T.text, sub: T.text3 })]
      });
    }, function () { emptyChart('ch2b', 'data tidak tersedia'); });

    // Grafik 3 — Segmen per kelompok usia (100% stacked)
    safe(function () {
      if (!total) return emptyChart('ch2c', EMPTY);
      var ages = ordered(ageMap, AGE_ORDER).map(function (e) { return e[0]; });
      var segList = ordered(countBy(rows, 'SEGMEN'), SEG_ORDER).map(function (e) { return e[0]; });
      var cnt = {};
      rows.forEach(function (r) { var k = r['AGE GROUP'] + '|' + r.SEGMEN; cnt[k] = (cnt[k] || 0) + 1; });
      var gTot = ages.map(function (a) { return ageMap.get(a) || 0; });
      var counts = segList.map(function (s) { return ages.map(function (a) { return cnt[a + '|' + s] || 0; }); });
      var topIdx = ages.map(function (a, i) { var t = -1; counts.forEach(function (d, di) { if (d[i] > 0) t = di; }); return t; });
      var smallIdx = gTot.map(function (n, i) { return nSmall(n) ? i : -1; }).filter(function (i) { return i >= 0; });
      makeChart('ch2c', {
        type: 'bar',
        data: {
          labels: ages.map(ageShort),
          datasets: segList.map(function (s, di) {
            return {
              label: s, data: counts[di].map(function (n, i) { return gTot[i] ? share(n, gTot[i]) : 0; }),
              backgroundColor: segColor(s, T, allSegs), borderColor: T.surface, borderWidth: { top: 2, left: 0, right: 0, bottom: 0 }, borderSkipped: 'start',
              borderRadius: function (c) { return topIdx[c.dataIndex] === c.datasetIndex ? { topLeft: 4, topRight: 4 } : 0; },
              maxBarThickness: 40, categoryPercentage: 0.86
            };
          })
        },
        options: {
          layout: { padding: { top: smallIdx.length ? 14 : 4 } },
          interaction: { mode: 'index', intersect: false },
          scales: {
            x: { stacked: true, border: { display: false }, grid: { display: false }, ticks: { autoSkip: false, maxRotation: 0, minRotation: 0, color: T.text2, callback: function (v) { var l = this.getLabelForValue(v); var n = Math.max(3, Math.floor(this.chart.width / ages.length / (T.fs * 0.6))); return trunc(l, n); } } },
            y: { stacked: true, min: 0, max: 100, border: { display: false }, grid: { color: T.grid }, ticks: { stepSize: 25, color: T.text3, callback: function (v) { return v + '%'; } } }
          },
          plugins: {
            legend: { display: segList.length > 1, position: 'bottom', labels: { color: T.text2 } },
            tooltip: {
              callbacks: {
                title: function (it) { return 'Usia ' + ages[it[0].dataIndex]; },
                label: function (it) { var n = counts[it.datasetIndex][it.dataIndex]; return it.dataset.label + ': ' + fmtPct(it.raw) + ' (' + fmt(n) + ' unit)' + (nSmall(n) ? ' · n kecil' : ''); },
                footer: function (it) { var g = gTot[it[0].dataIndex]; return 'Total kelompok: ' + fmt(g) + ' unit' + (nSmall(g) ? ' · ⚠ n kecil' : ''); }
              }
            },
          }
        },
        plugins: [smallMarks({ indices: smallIdx, size: T.fs - 1.5, color: T.warn })]
      });
    }, function () { emptyChart('ch2c', 'data tidak tersedia'); });

    // Grafik 4 — 10 kecamatan teratas
    safe(function () {
      var top = kecRank.slice(0, 10);
      if (!top.length) return emptyChart('ch2d', EMPTY);
      var labels = top.map(function (e) { return e[0]; });
      makeChart('ch2d', {
        type: 'bar',
        data: { labels: labels, datasets: [{ label: 'Unit', data: top.map(function (e) { return e[1]; }), backgroundColor: T.measure, borderRadius: 4, borderSkipped: 'start', barPercentage: 0.8, categoryPercentage: 0.88, maxBarThickness: 20 }] },
        options: {
          indexAxis: 'y',
          layout: { padding: { right: 40 } },
          scales: {
            x: { beginAtZero: true, grace: '4%', border: { display: false }, grid: { color: T.grid }, ticks: { maxTicksLimit: 5, color: T.text3, callback: function (v) { return fmt(v); } } },
            y: { border: { display: false }, grid: { display: false }, ticks: { autoSkip: false, color: T.text2, callback: truncTick(0.32, T.fs * 0.58) } }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: function (it) { return 'Kecamatan ' + labels[it[0].dataIndex]; },
                label: function (it) { return fmt(it.raw) + ' unit (' + fmtPct(share(it.raw, total)) + ')'; },
                afterLabel: function (it) { return nNote(it.raw); }
              }
            },
          }
        },
        plugins: [valueLabels({ size: T.fs - 0.5, color: T.text2, warn: T.warn, flagSmall: true })]
      });
    }, function () { emptyChart('ch2d', 'data tidak tersedia'); });

    // Insight halaman 2
    safe(function () {
      if (!total) return setInsight('ins2', 'Tidak ada data pada kombinasi filter ini — <b>ubah atau reset filter</b> untuk melihat insight.');
      var a1 = ageRank[0], a2 = ageRank[1];
      var parts = [];
      var span = ageSpan(a1 && a1[0], a2 && a2[0]);
      if (a1 && a2) parts.push('Usia <b>' + esc(span) + '</b> dominan (<b>' + fmtPct(share(a1[1] + a2[1], total)) + '</b>: ' + esc(a1[0]) + ' ' + fmtPct(share(a1[1], total)) + ', ' + esc(a2[0]) + ' ' + fmtPct(share(a2[1], total)) + ')');
      else if (a1) parts.push('Usia <b>' + esc(a1[0]) + '</b> dominan (<b>' + fmtPct(share(a1[1], total)) + '</b>)');
      var sw = swRank[0];
      parts.push('<b>' + fmtPct(share(nNew, total)) + '</b> konsumen baru, <b>' + fmtPct(share(switchers.length, total)) + '</b> pindahan merek lain' + (sw ? ' (terbanyak <b>' + esc(brandLabel(sw[0])) + '</b> ' + fmtPct(share(sw[1], total)) + ')' : ''));
      var targetAges = [a1, a2].filter(Boolean).map(function (e) { return e[0]; });
      var tRows = rows.filter(function (r) { return targetAges.indexOf(r['AGE GROUP']) >= 0; });
      var tSeg = ranked(countBy(tRows, 'SEGMEN'), true)[0];
      var areas = kecRank.slice(0, 3).map(function (e) { return esc(e[0]); });
      var action = 'Aksi: promosi' + (tSeg ? ' <b>' + esc(tSeg[0]) + '</b>' : '') + (targetAges.length ? ' untuk usia ' + esc(span) : '') +
        (areas.length ? ' di <b>' + areas.join(', ').replace(/, ([^,]*)$/, ' &amp; $1') + '</b>' : '');
      if (sw) action += ', <b>tukar-tambah</b> bagi pengguna ' + esc(brandLabel(sw[0]));
      if (share(nNew, total) >= 10) action += ', dan <b>DP ringan</b> untuk pembeli pertama';
      setInsight('ins2', parts.join('; ') + '. ' + action + '.');
    }, function () { setInsight('ins2', 'Insight: data tidak tersedia.'); });
  }

  /* ============================================================ NAVIGASI */
  function buildTabs() {
    var host = document.getElementById('tabs');
    host.innerHTML = '';
    if (PAGES.length > 4) {
      var sel = document.createElement('select');
      sel.className = 'page-select';
      sel.setAttribute('aria-label', 'Pilih halaman');
      PAGES.forEach(function (p, i) { var o = document.createElement('option'); o.value = i; o.textContent = (i + 1) + '. ' + p.title; sel.appendChild(o); });
      sel.addEventListener('change', function () { setPage(+sel.value); });
      host.appendChild(sel);
      return;
    }
    PAGES.forEach(function (p, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tab';
      b.id = 'tab-' + i;
      b.setAttribute('role', 'tab');
      b.title = 'Halaman ' + (i + 1) + ': ' + p.title;
      b.innerHTML = '<span class="tab-num">' + (i + 1) + '</span><span class="tab-text">' + esc(p.title) + '</span>';
      b.addEventListener('click', function () { setPage(i); });
      host.appendChild(b);
    });
  }

  function setPage(i) {
    i = Math.max(0, Math.min(PAGES.length - 1, i));
    APP.page = i;
    document.querySelectorAll('.page').forEach(function (p) { p.classList.toggle('active', +p.dataset.page === i); });
    document.querySelectorAll('#tabs .tab').forEach(function (t, ti) { t.setAttribute('aria-selected', String(ti === i)); t.tabIndex = ti === i ? 0 : -1; });
    var sel = document.querySelector('#tabs select');
    if (sel) sel.value = String(i);
    document.getElementById('prevPage').disabled = i === 0;
    document.getElementById('nextPage').disabled = i === PAGES.length - 1;
    if (APP.stale[i] !== false) renderPage(i);
    else {
      Object.keys(APP.charts).forEach(function (id) { if (APP.charts[id].canvas.closest('.page.active')) APP.charts[id].resize(); });
      queueFit();
    }
  }

  /* ============================================================ PANEL ⓘ */
  function roleText(t) {
    return { sales: 'tabel fakta penjualan (1 baris = 1 unit)', mapping: 'master varian → nama & segmen (join VARIANT KEY = VARIAN)', months: 'daftar nama bulan → label periode & jawaban tren bulanan chatbot', dict: 'kamus istilah → arti istilah di panel ini & chatbot' }[t.role];
  }
  function smallGroups(rows) {
    var dims = [['SEGMEN', 'Segmen'], ['AGE GROUP', 'Kelompok usia'], ['MEREK SBLMNYA', 'Merek sebelumnya'], ['VARIAN', 'Varian'], ['KECAMATAN', 'Kecamatan'], ['DEALER', 'Dealer'], ['WARNA', 'Warna'], ['PENDIDIKAN', 'Pendidikan']];
    var out = [];
    dims.forEach(function (d) {
      var list = ranked(countBy(rows, d[0]), false).filter(function (e) { return nSmall(e[1]); });
      if (list.length) out.push([d[1], list]);
    });
    return out;
  }
  function renderInfo() {
    var ctx = APP.ctx;
    if (!ctx) return;
    var m = ctx.meta || {};
    var h = [];
    var src = ctx.source || {};
    // 1. Tabel
    h.push('<section><h3>Sumber &amp; tabel</h3><ul>');
    (m.tables || []).forEach(function (t) {
      h.push('<li><span class="tag-ok">DIPAKAI</span><code>' + esc(t.file) + ' › ' + esc(t.sheet) + '</code> — header baris ' + t.header + ', kolom ' + esc(t.cols) + ', ' + fmt(t.n) + ' baris: ' + esc(roleText(t)) + '.</li>');
    });
    if (m.mappingSource === 'previous') h.push('<li><span class="tag-ok">DIPAKAI</span>Mapping dari data sebelumnya (file upload tidak memuat sheet Mapping).</li>');
    if (m.mappingSource === 'none') h.push('<li><span class="tag-no">TIDAK ADA</span>Mapping varian: data tidak tersedia → semua segmen Unknown.</li>');
    if (m.dictSource === 'previous') h.push('<li><span class="tag-ok">DIPAKAI</span>Kamus dari <code>' + esc(m.dictFile || 'data sebelumnya') + '</code> (tidak ikut di-upload).</li>');
    if (m.dictSource === 'none') h.push('<li><span class="tag-no">TIDAK ADA</span>Kamus istilah: data tidak tersedia → semua istilah "arti tidak tersedia".</li>');
    (m.unused || []).forEach(function (u) {
      h.push('<li><span class="tag-no">TIDAK DIPAKAI</span><code>' + esc(u.file) + ' › ' + esc(u.sheet) + '</code> — ' + esc(u.reason) + '.</li>');
    });
    h.push('<li>Penggabungan: setiap baris PENJUALAN di-join ke Mapping lewat <code>VARIANT KEY = VARIAN</code>; penjualan = jumlah baris.</li>');
    h.push('<li>Data Planning/target: <b>data tidak tersedia</b> → tidak ada KPI realisasi (bila diminta tampil "–"). Filter Bulan tidak termasuk filter global; ketiga filter global (Segmen, Kelompok Usia, Merek Sebelumnya) berlaku di semua halaman.</li>');
    if (m.synthetic && src.kind !== 'upload') h.push('<li><b>Data bawaan = reproduksi SINTETIS</b> (file asli tidak tersedia saat dashboard dibuat) — angka bukan data resmi. Gunakan <b>Upload Excel</b> untuk memakai file asli.</li>');
    h.push('</ul></section>');

    // 2. Penanganan data
    h.push('<section><h3>Penanganan data</h3><ul>');
    var nulls = Object.keys(m.nulls || {}).filter(function (k) { return m.nulls[k] > 0; });
    h.push('<li><b>Null/kosong → "Unknown"</b>: ' + (nulls.length ? nulls.map(function (k) { return esc(k) + ' ' + fmt(m.nulls[k]); }).join(' · ') : 'tidak ada') + '. Unknown tetap dihitung di total & komposisi, tetapi dikecualikan dari peringkat (terbesar/terlaris/top 10).</li>');
    var inv = m.invalidDates || [];
    h.push('<li><b>Tanggal tidak valid</b>: ' + fmt(inv.length) + ' baris' + (inv.length ? ' (' + inv.slice(0, 8).map(function (d) { return '<code>' + esc(d.raw) + '</code>'; }).join(' ') + (inv.length > 8 ? ' …' : '') + ')' : '') + ' — tetap dihitung di total/KPI, <b>tidak dihitung</b> di grafik per kuartal.</li>');
    var um = Object.keys(m.unmapped || {});
    h.push('<li><b>VARIANT KEY tidak ada di Mapping</b>: ' + (um.length ? um.map(function (k) { return '<code>' + esc(k) + '</code> (' + m.unmapped[k] + ')'; }).join(' ') + ' → segmen Unknown, nama "Unknown · kode"' : 'tidak ada') + '.</li>');
    h.push('<li><b>Normalisasi teks</b>: ' + fmt(m.normalized || 0) + ' nilai dirapikan (spasi, huruf besar/kecil, format usia)' + ((m.normalizedExamples || []).length ? ', mis. ' + m.normalizedExamples.map(esc).join('; ') : '') + '.</li>');
    if (m.skipped) h.push('<li>Baris non-data (keterangan/footer) dilewati: ' + fmt(m.skipped) + '.</li>');
    h.push('<li>Rasio = total ÷ total pada filter yang sama; nilai dihitung penuh lalu dibulatkan saat tampil (maks. 2 desimal).</li>');
    h.push('</ul></section>');

    // 3. n kecil
    var sg = smallGroups(ctx.rows);
    h.push('<section><h3>Kelompok sampel kecil (n &lt; 5)</h3>');
    h.push('<p class="term">Dihitung pada filter aktif (' + esc(filterText(ctx)) + '). Ditandai "n kecil"/"n&lt;5" di tooltip, label grafik, KPI, dan filter; tafsirkan dengan hati-hati.</p><ul>');
    if (!sg.length) h.push('<li>Tidak ada kelompok dengan n &lt; 5.</li>');
    sg.forEach(function (g) {
      h.push('<li><b>' + esc(g[0]) + '</b>: ' + g[1].slice(0, 10).map(function (e) { return esc(e[0]) + ' (n=' + e[1] + ')'; }).join(', ') + (g[1].length > 10 ? ' …' : '') + '</li>');
    });
    h.push('</ul></section>');

    // 4. Kamus
    h.push('<section><h3>Kamus istilah</h3>');
    DICT_TERMS.concat(OTHER_TERMS).forEach(function (t) {
      var arti = (m.dict || {})[norm(t)];
      h.push('<p class="term"><b>' + esc(t) + '</b> — ' + (arti ? esc(arti) : '<span class="na">arti tidak tersedia</span>') + '</p>');
    });
    h.push('</section>');

    // 5. Cara baca
    h.push('<section><h3>Cara pakai</h3><ul>');
    h.push('<li>Klik irisan doughnut Segmen/Merek atau kolom Kelompok Usia untuk memfilter; klik lagi untuk melepas.</li>');
    h.push('<li>Nama panjang di sumbu dipotong "…"; nama lengkap ada di tooltip.</li>');
    h.push('<li>Upload Excel (.xlsx/.csv, boleh beberapa file sekaligus) mengganti data; letak tabel dikenali otomatis (judul, logo, dan baris kosong di atas tabel dilewati).</li>');
    h.push('<li>Navigasi halaman: tombol ‹ › atau tombol panah kiri/kanan di keyboard.</li>');
    h.push('</ul></section>');
    document.getElementById('infoBody').innerHTML = h.join('');
  }
  function openInfo(open) {
    APP.infoOpen = open;
    var ov = document.getElementById('infoOverlay');
    var btn = document.getElementById('infoBtn');
    ov.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open) { safe(renderInfo); document.getElementById('infoClose').focus(); }
    else btn.focus();
  }

  /* ============================================================ CHATBOT */
  var chatImage = null;

  function quickPrompts() {
    var ctx = APP.ctx;
    var kec = ctx ? ranked(countBy(ctx.allRows, 'KECAMATAN'), true).slice(0, 2).map(function (e) { return e[0]; }) : [];
    var list = [
      'Berapa total penjualan dan porsi tiap segmen?',
      'Apa 10 varian terlaris?',
      'Bagaimana tren penjualan per kuartal?',
      'Kelompok usia mana yang paling banyak membeli?',
      'Konsumen paling banyak pindah dari merek apa?',
      'Kecamatan mana yang jadi prioritas promosi?',
      'Varian apa yang perlu dijaga stoknya?'
    ];
    if (kec.length === 2) list.push('Bandingkan ' + kec[0] + ' vs ' + kec[1]);
    list.push('Bagaimana kualitas data ini?');
    list.push('Apa arti BELUM PERNAH MEMILIKI?');
    return list;
  }
  function buildQuickPrompts() {
    var host = document.getElementById('quickPrompts');
    host.innerHTML = '';
    quickPrompts().forEach(function (q) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = q;
      b.addEventListener('click', function () { send(q); });
      host.appendChild(b);
    });
  }
  function updateChatContext() {
    var c = APP.ctx;
    var el = document.getElementById('chatCtx');
    el.textContent = 'Konteks: ' + fmt(c.rows.length) + ' unit · ' + filterText(c);
    el.title = el.textContent;
    if (APP.quickFor !== c.allRows) { APP.quickFor = c.allRows; buildQuickPrompts(); }
  }

  function mdInline(s) {
    return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])_(.+?)_(?=$|[\s).,;:])/g, '$1<em>$2</em>');
  }
  function md(text) {
    var lines = esc(text).split('\n');
    var html = '', list = null;
    lines.forEach(function (line) {
      var ul = /^\s*[-•]\s+(.*)$/.exec(line);
      var ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
      var type = ul ? 'ul' : ol ? 'ol' : null;
      if (type) {
        if (list !== type) { if (list) html += '</' + list + '>'; html += '<' + type + '>'; list = type; }
        html += '<li>' + mdInline((ul || ol)[1]) + '</li>';
      } else {
        if (list) { html += '</' + list + '>'; list = null; }
        if (line.trim()) html += '<p>' + mdInline(line) + '</p>';
      }
    });
    if (list) html += '</' + list + '>';
    return html;
  }

  function addMsg(role, html, img) {
    var box = document.getElementById('msgs');
    var m = document.createElement('div');
    m.className = 'msg ' + role;
    if (img) { var im = document.createElement('img'); im.src = img.url; im.alt = img.name; m.appendChild(im); }
    var body = document.createElement('div');
    body.innerHTML = html;
    m.appendChild(body);
    box.appendChild(m);
    var cb = document.getElementById('chatBody');
    cb.scrollTop = cb.scrollHeight;
    return m;
  }

  function send(text) {
    text = String(text || '').trim();
    var img = chatImage;
    if (!text && !img) return;
    addMsg('user', esc(text || '(gambar)'), img);
    clearImage();
    var ta = document.getElementById('chatText');
    ta.value = '';
    autoSize(ta);
    updateSendState();
    var typing = addMsg('bot typing', 'Menghitung dari data…');
    setTimeout(function () {
      var out = safe(function () { return answer(text, img); }, function () {}) || 'Maaf, jawaban gagal dihitung — **data tidak tersedia** untuk pertanyaan ini.';
      typing.className = 'msg bot';
      typing.innerHTML = '';
      var body = document.createElement('div');
      body.innerHTML = md(out);
      typing.appendChild(body);
      var cb = document.getElementById('chatBody');
      cb.scrollTop = cb.scrollHeight;
    }, 280);
  }

  /* ---- ekstraksi entitas dari pertanyaan */
  function qNorm(s) { return ' ' + String(s).toLowerCase().replace(/[^a-z0-9<>\/\-\s:]/g, ' ').replace(/\s+/g, ' ').trim() + ' '; }
  var ENTITY_DIMS = [
    { key: 'VARIAN', label: 'Varian', prefixMin: 1 },
    { key: 'KECAMATAN', label: 'Kecamatan', prefixMin: 0 },
    { key: 'DEALER', label: 'Dealer', prefixMin: 2 },
    { key: 'MEREK SBLMNYA', label: 'Merek sebelumnya', prefixMin: 0 },
    { key: 'WARNA', label: 'Warna', prefixMin: 0 },
    { key: 'PENDIDIKAN', label: 'Pendidikan', prefixMin: 0 }
  ];
  function buildEntityIndex(allRows) {
    var phrases = [];
    ENTITY_DIMS.forEach(function (d) {
      var groups = new Map();
      var add = function (ph, v) {
        ph = qNorm(ph).trim();
        if (ph.length < 2) return;
        if (!groups.has(ph)) groups.set(ph, new Set());
        groups.get(ph).add(v);
      };
      Array.from(countBy(allRows, d.key).keys()).forEach(function (v) {
        if (isUnknown(v)) return;
        add(v, v);
        if (d.key === 'MEREK SBLMNYA' && v === NEW_BUYER) { add('belum pernah', v); add('belum punya', v); }
        if (d.key === 'PENDIDIKAN' && /SMA|SMK/.test(v)) { add('sma', v); add('smk', v); }
        if (d.prefixMin) {
          var toks = qNorm(v).trim().split(' ');
          for (var k = d.prefixMin; k < toks.length; k++) {
            var ph = toks.slice(0, k).join(' ');
            if (ph.length >= 3 && !/^\d+$/.test(ph)) add(ph, v);
          }
        }
      });
      groups.forEach(function (vals, ph) { phrases.push({ dim: d, phrase: ph, values: vals }); });
    });
    phrases.sort(function (a, b) { return b.phrase.length - a.phrase.length; });
    return phrases;
  }
  function extractEntities(raw, allRows) {
    if (APP.entityIndexFor !== allRows) { APP.entityIndex = buildEntityIndex(allRows); APP.entityIndexFor = allRows; }
    var q = qNorm(raw);
    var taken = [];
    var hits = [];
    var overlaps = function (s, e) { return taken.some(function (t) { return s < t[1] && e > t[0]; }); };
    var allowHonda = /sebelum|repeat|loyal|dari honda|pindah|merek|merk/.test(q);
    APP.entityIndex.forEach(function (p) {
      if (p.dim.key === 'MEREK SBLMNYA' && p.phrase === 'honda' && !allowHonda) return;
      var needle = ' ' + p.phrase + ' ';
      var from = 0, idx;
      while ((idx = q.indexOf(needle, from)) >= 0) {
        var s = idx + 1, e = idx + needle.length - 1;
        if (!overlaps(s, e)) { taken.push([s, e]); hits.push({ dim: p.dim, phrase: p.phrase, values: p.values, pos: s }); }
        from = idx + 1;
      }
    });
    // segmen
    var segHits = [];
    if (/\bAT\b/.test(raw) || /\b(matic|matik|skutik|skuter)\b/i.test(raw)) segHits.push('AT');
    if (/\b(cub|bebek)\b/i.test(raw)) segHits.push('CUB');
    if (/\bsport\b/i.test(raw)) segHits.push('SPORT');
    segHits.forEach(function (s) { hits.push({ dim: { key: 'SEGMEN', label: 'Segmen' }, phrase: s, values: new Set([s]), pos: q.indexOf(s.toLowerCase()) }); });
    // usia
    var ageRe = /(<\s*16|>\s*55|di ?bawah 16|di ?atas 55|lebih dari 55|\b(\d{2})\s*(?:-|–|sampai|s\/d|hingga|sd)\s*(\d{2})\b)/gi;
    var m;
    while ((m = ageRe.exec(raw))) {
      var lbl = null;
      if (/<|bawah/i.test(m[1])) lbl = '<16';
      else if (/>|atas|lebih/i.test(m[1])) lbl = '>55';
      else lbl = m[2] + ' - ' + m[3];
      if (AGE_ORDER.indexOf(lbl) >= 0) hits.push({ dim: { key: 'AGE GROUP', label: 'Kelompok usia' }, phrase: lbl, values: new Set([lbl]), pos: m.index });
    }
    hits.sort(function (a, b) { return a.pos - b.pos; });
    var byDim = {};
    hits.forEach(function (hh) {
      var k = hh.dim.key;
      if (!byDim[k]) byDim[k] = { key: k, label: hh.dim.label, groups: [] };
      byDim[k].groups.push(hh);
    });
    return Object.keys(byDim).map(function (k) { return byDim[k]; });
  }
  function groupDisplay(g) {
    var vals = Array.from(g.values);
    return vals.length === 1 ? vals[0] : titleCase(g.phrase) + ' (' + vals.length + ' ' + (g.dim.key === 'VARIAN' ? 'varian' : 'nilai') + ')';
  }
  function applyConds(rows, dims) {
    if (!dims.length) return rows;
    return rows.filter(function (r) {
      return dims.every(function (d) {
        return d.groups.some(function (g) { return g.values.has(r[d.key]); });
      });
    });
  }

  /* ---- pembantu jawaban */
  function topN(q, def) {
    var m = /(?:top|\b)(\d{1,2})\b/.exec(q.replace(/\b\d{2}\s*-\s*\d{2}\b/g, ''));
    var n = m ? parseInt(m[1], 10) : def;
    return Math.max(1, Math.min(20, n || def));
  }
  function listLines(entries, total, n, fmtName) {
    return entries.slice(0, n).map(function (e, i) {
      return (i + 1) + '. **' + (fmtName ? fmtName(e[0]) : e[0]) + '** — ' + fmt(e[1]) + ' unit (' + fmtPct(share(e[1], total)) + ')' + (nSmall(e[1]) ? ' ⚠ n kecil' : '');
    });
  }
  function quarterStats(rows) {
    var dated = rows.filter(function (r) { return r.KUARTAL; });
    var qs = {};
    dated.forEach(function (r) { var k = r.TAHUN * 10 + Math.ceil(r.BULAN / 3); qs[k] = (qs[k] || 0) + 1; });
    var keys = Object.keys(qs).map(Number).sort(function (a, b) { return a - b; });
    return { dated: dated, keys: keys, qs: qs, label: function (k) { return 'Q' + (k % 10) + ' ' + Math.floor(k / 10); } };
  }

  function answer(raw, img) {
    var ctx = APP.ctx;
    if (!ctx) return 'Data belum siap.';
    var q = raw.toLowerCase();
    var out = [];
    if (img) out.push('_Gambar **' + img.name + '** (' + fmt(img.size / 1024) + ' KB) diterima sebagai konteks. Engine lokal tidak membaca isi gambar; jawaban dihitung dari data dashboard._');
    if (!raw.trim()) { out.push('Silakan ketik pertanyaan tentang data, misalnya **"Apa 10 varian terlaris?"**'); return out.join('\n'); }

    // Kamus istilah
    if (/\b(arti|artinya|apa itu|apa sih|definisi|maksud|pengertian|singkatan)\b/.test(q)) {
      var terms = DICT_TERMS.concat(OTHER_TERMS).concat(Object.keys(ctx.meta.dict || {}))
        .filter(function (t, i, a) { return a.indexOf(t) === i; })
        .sort(function (a, b) { return b.length - a.length; });
      var qq = qNorm(raw);
      var found = terms.filter(function (t) { return qq.indexOf(' ' + qNorm(t).trim() + ' ') >= 0; });
      if (found.length) {
        found.slice(0, 3).forEach(function (t) {
          var arti = (ctx.meta.dict || {})[norm(t)];
          out.push('**' + t + '**: ' + (arti || 'arti tidak tersedia'));
        });
        out.push('_Sumber: kamus ' + (ctx.meta.dictFile || 'Dictionary') + '_');
        return out.join('\n');
      }
      var mm = /(?:arti|artinya|apa itu|definisi|maksud|pengertian)\s+(?:dari\s+)?(.+?)\??$/.exec(q);
      if (mm) { out.push('**' + mm[1].toUpperCase() + '**: arti tidak tersedia (tidak ada di kamus).'); return out.join('\n'); }
    }

    var dims = extractEntities(raw, ctx.allRows);
    var rows = applyConds(ctx.rows, dims);
    var focus = dims.map(function (d) { return d.label + ' = ' + d.groups.map(groupDisplay).join(' / '); }).join('; ');
    var foot = '_Konteks: ' + fmt(rows.length) + ' unit · filter: ' + filterText(ctx) + (focus ? ' · fokus: ' + focus : '') + '_';
    var total = rows.length;
    var asc = /(terendah|paling sedikit|paling rendah|terkecil|terburuk|paling kecil|kurang laku|tidak laku)/.test(q);
    var N = topN(q, 5);

    var has = function (re) { return re.test(q); };
    var intent =
      has(/(kualitas data|tidak valid|invalid|null|kosong|audit|data quality|anomali)/) ? 'quality'
      : has(/\b(filter)\b/) && !dims.length ? 'filter'
      : has(/(bantuan|\bhelp\b|bisa apa|contoh pertanyaan)/) ? 'help'
      : has(/(banding|\bvs\b|versus|dibanding)/) ? 'compare'
      : has(/(rekomendasi|saran|aksi|strategi|stok|promosi|sebaiknya|prioritas|harus|action)/) ? 'reco'
      : has(/(tren|trend|kuartal|quarter|bulan|bulanan|musim|naik|turun|pertumbuhan|growth|periode)/) ? 'trend'
      : has(/(varian|tipe|model|terlaris|laris|produk)/) ? 'variant'
      : has(/(segmen|segment|porsi|komposisi|kontribusi|kontributor)/) ? 'segment'
      : has(/(usia|umur|\bage\b|muda|tua|generasi)/) ? 'age'
      : has(/(merek|merk|brand|pindah|switch|konsumen baru|belum pernah|first buyer|loyal|repeat|asal)/) ? 'brand'
      : has(/(kecamatan|wilayah|area|daerah|lokasi|domisili|kota)/) ? 'area'
      : has(/(dealer|diler)/) ? 'dealer'
      : has(/(warna|color)/) ? 'color'
      : has(/(pendidikan|edukasi|sekolah|lulusan)/) ? 'edu'
      : has(/(total|berapa|jumlah|banyak|penjualan|unit|terjual)/) ? (dims.length ? 'entity' : 'total')
      : dims.length ? 'entity' : 'help';

    if (!total && intent !== 'help' && intent !== 'filter' && intent !== 'quality') {
      out.push('Tidak ada data untuk ' + (focus ? '**' + focus + '**' : 'filter ini') + ' — **data tidak tersedia**. Coba ubah filter atau pertanyaan.');
      out.push(foot);
      return out.join('\n');
    }

    var ans = {
      quality: function () {
        var m = ctx.meta;
        var nulls = Object.keys(m.nulls || {}).filter(function (k) { return m.nulls[k] > 0; });
        var sg = smallGroups(ctx.rows);
        out.push('**Ringkasan kualitas data** (' + fmt(ctx.allRows.length) + ' baris):');
        out.push('- **Tanggal tidak valid: ' + fmt((m.invalidDates || []).length) + ' baris** — dihitung di total, tidak di grafik kuartal');
        out.push('- **Null → Unknown**: ' + (nulls.length ? nulls.map(function (k) { return k + ' ' + fmt(m.nulls[k]); }).join(', ') : 'tidak ada'));
        var um = Object.keys(m.unmapped || {});
        out.push('- **Kode varian tidak ada di Mapping**: ' + (um.length ? um.map(function (k) { return k + ' (' + m.unmapped[k] + ')'; }).join(', ') : 'tidak ada'));
        out.push('- **Normalisasi teks**: ' + fmt(m.normalized || 0) + ' nilai dirapikan');
        out.push('- **Kelompok n < 5** (filter aktif): ' + (sg.length ? sg.map(function (g) { return g[0] + ' ' + g[1].map(function (e) { return e[0]; }).slice(0, 3).join('/'); }).join('; ') : 'tidak ada'));
        if (m.synthetic && ctx.source.kind !== 'upload') out.push('_Catatan: data bawaan adalah reproduksi sintetis, bukan data resmi._');
      },
      filter: function () {
        out.push('**Filter aktif:** ' + filterText(ctx));
        out.push('Data terfilter: **' + fmt(ctx.rows.length) + ' unit** dari ' + fmt(ctx.allRows.length) + ' (' + fmtPct(share(ctx.rows.length, ctx.allRows.length)) + ').');
      },
      help: function () {
        out.push('Saya menjawab langsung dari **data yang sedang terfilter**. Contoh pertanyaan:');
        out.push('- **Angka utama**: "Berapa total penjualan segmen SPORT?"');
        out.push('- **Peringkat**: "Top 5 varian terlaris di Tembalang", "Kecamatan paling sedikit"');
        out.push('- **Tren**: "Bagaimana tren per kuartal untuk Vario 160?"');
        out.push('- **Konsumen**: "Usia berapa pembeli CUB?", "Pindahan dari Yamaha pilih segmen apa?"');
        out.push('- **Aksi**: "Varian apa yang perlu dijaga stoknya?", "Kecamatan prioritas promosi?"');
        out.push('- **Istilah**: "Apa arti AGE GROUP?"');
      },
      compare: function () {
        var d = dims.filter(function (x) { return x.groups.length >= 2; })[0];
        if (!d) { out.push('Sebutkan **dua nilai** yang ingin dibandingkan, mis. "Bandingkan Pedurungan vs Tembalang" atau "AT vs SPORT".'); return; }
        var others = dims.filter(function (x) { return x !== d; });
        var base = applyConds(ctx.rows, others);
        out.push('**Perbandingan ' + d.label.toLowerCase() + '** (dari ' + fmt(base.length) + ' unit):');
        d.groups.slice(0, 4).forEach(function (g) {
          var rs = base.filter(function (r) { return g.values.has(r[d.key]); });
          var tv = ranked(countBy(rs, 'VARIAN'), true)[0];
          var ta = ranked(countBy(rs, 'AGE GROUP'), true)[0];
          var ts = ranked(countBy(rs, 'SEGMEN'), true)[0];
          out.push('- **' + groupDisplay(g) + '**: **' + fmt(rs.length) + ' unit** (' + fmtPct(share(rs.length, base.length)) + ')' +
            (ts ? ' · segmen utama ' + ts[0] + ' ' + fmtPct(share(ts[1], rs.length)) : '') +
            (tv ? ' · terlaris ' + tv[0] + ' (' + fmt(tv[1]) + ')' : '') + (ta ? ' · usia ' + ta[0] : '') + (nSmall(rs.length) ? ' ⚠ n kecil' : ''));
        });
        var c = d.groups.slice(0, 2).map(function (g) { return base.filter(function (r) { return g.values.has(r[d.key]); }).length; });
        if (c.length === 2 && c[1]) out.push('Selisih: **' + fmt(Math.abs(c[0] - c[1])) + ' unit** (' + groupDisplay(d.groups[c[0] >= c[1] ? 0 : 1]) + ' lebih tinggi ' + fmtPct(share(Math.abs(c[0] - c[1]), Math.min(c[0], c[1]))) + ').');
      },
      reco: function () {
        var wantStock = /stok|stock|varian|persediaan/.test(q);
        var wantPromo = /promosi|promo|sasaran|target|wilayah|kecamatan|usia/.test(q);
        if (!wantStock && !wantPromo) { wantStock = true; wantPromo = true; }
        var vr = ranked(countBy(rows, 'VARIAN'), true);
        var st = quarterStats(rows);
        var peak = st.keys.slice().sort(function (a, b) { return st.qs[b] - st.qs[a]; })[0];
        out.push('**Rekomendasi aksi** (dihitung dari ' + fmt(total) + ' unit):');
        if (wantStock && vr.length) {
          var t3 = vr.slice(0, 3);
          out.push('- **Jaga stok**: ' + t3.map(function (e) { return '**' + e[0] + '** (' + fmt(e[1]) + ' unit, ' + fmtPct(share(e[1], total)) + ')'; }).join(', ') +
            ' — gabungan ' + fmtPct(share(t3.reduce(function (a, e) { return a + e[1]; }, 0), total)) + ' penjualan' + (peak ? '; siapkan buffer menjelang **' + st.label(peak) + '** (puncak ' + fmt(st.qs[peak]) + ' unit)' : '') + '.');
          var segR = ranked(countBy(rows, 'SEGMEN'), true);
          if (st.keys.length >= 2) {
            var a = st.keys[st.keys.length - 2], b = st.keys[st.keys.length - 1];
            var grow = segR.map(function (s) {
              var ra = st.dated.filter(function (r) { return r.SEGMEN === s[0] && r.TAHUN * 10 + Math.ceil(r.BULAN / 3) === a; }).length;
              var rb = st.dated.filter(function (r) { return r.SEGMEN === s[0] && r.TAHUN * 10 + Math.ceil(r.BULAN / 3) === b; }).length;
              return [s[0], ra, rb, ra ? (rb - ra) / ra * 100 : 0];
            }).filter(function (g) { return g[1] >= 5; }).sort(function (x, y) { return y[3] - x[3]; });
            if (grow.length) out.push('- **Momentum segmen**: ' + grow.map(function (g) { return g[0] + ' ' + (g[3] >= 0 ? '+' : '') + fmtPct(g[3]); }).join(', ') + ' (' + st.label(b) + ' vs ' + st.label(a) + ') — sesuaikan alokasi ke segmen yang tumbuh.');
          }
          var slow = vr.filter(function (e) { return e[1] >= 5; }).slice(-2);
          if (vr.length > 6 && slow.length) out.push('- **Kurangi pesanan** varian lambat: ' + slow.map(function (e) { return e[0] + ' (' + fmt(e[1]) + ')'; }).join(', ') + '.');
        }
        if (wantPromo) {
          var ar = ranked(countBy(rows, 'AGE GROUP'), true).slice(0, 2);
          var kr = ranked(countBy(rows, 'KECAMATAN'), true).slice(0, 3);
          var tRows = rows.filter(function (r) { return ar.some(function (e) { return e[0] === r['AGE GROUP']; }); });
          var tSeg = ranked(countBy(tRows, 'SEGMEN'), true)[0];
          if (ar.length) out.push('- **Sasaran promosi**: usia **' + ar.map(function (e) { return e[0]; }).join(' & ') + '** (' + fmtPct(share(ar.reduce(function (s, e) { return s + e[1]; }, 0), total)) + ' pembeli)' + (tSeg ? ', tawarkan segmen **' + tSeg[0] + '**' : '') + (kr.length ? ' di **' + kr.map(function (e) { return e[0]; }).join(', ') + '**' : '') + '.');
          var sw = ranked(countBy(rows.filter(function (r) { return r['TIPE KONSUMEN'] === 'Pindahan merek lain'; }), 'MEREK SBLMNYA'), true)[0];
          if (sw) out.push('- **Program tukar-tambah** untuk pengguna **' + brandLabel(sw[0]) + '** (' + fmt(sw[1]) + ' unit pindahan, ' + fmtPct(share(sw[1], total)) + ').');
          var nn = rows.filter(function (r) { return r['MEREK SBLMNYA'] === NEW_BUYER; });
          var nnAge = ranked(countBy(nn, 'AGE GROUP'), true)[0];
          if (nn.length) out.push('- **Pembeli motor pertama** ' + fmtPct(share(nn.length, total)) + (nnAge ? ', terbanyak usia **' + nnAge[0] + '**' : '') + ' → paket **DP ringan/kredit** & edukasi safety riding.');
        }
      },
      trend: function () {
        var st = quarterStats(rows);
        if (!st.keys.length) { out.push('Tanggal valid **tidak tersedia** untuk analisis tren.'); return; }
        out.push('**Tren penjualan per kuartal' + (focus ? ' — ' + focus : '') + '**:');
        st.keys.forEach(function (k, i) {
          var prev = i ? st.qs[st.keys[i - 1]] : null;
          out.push('- **' + st.label(k) + '**: ' + fmt(st.qs[k]) + ' unit (' + fmtPct(share(st.qs[k], st.dated.length)) + ')' + (prev ? ' · ' + (st.qs[k] >= prev ? '▲ +' : '▼ ') + fmtPct((st.qs[k] - prev) / prev * 100) + ' QoQ' : '') + (nSmall(st.qs[k]) ? ' ⚠ n kecil' : ''));
        });
        var mon = {};
        st.dated.forEach(function (r) { var k = r.TAHUN * 100 + r.BULAN; mon[k] = (mon[k] || 0) + 1; });
        var mk = Object.keys(mon).map(Number).sort(function (a, b) { return mon[b] - mon[a]; });
        if (mk.length > 1) {
          var mlabel = function (k) { return monthName(k % 100, ctx.meta) + ' ' + Math.floor(k / 100); };
          out.push('Bulan tertinggi **' + mlabel(mk[0]) + '** (' + fmt(mon[mk[0]]) + ' unit), terendah **' + mlabel(mk[mk.length - 1]) + '** (' + fmt(mon[mk[mk.length - 1]]) + ' unit).');
        }
        var inv = total - st.dated.length;
        if (inv) out.push('_' + fmt(inv) + ' baris bertanggal tidak valid tidak dihitung pada tren._');
      },
      variant: function () {
        var vr = ranked(countBy(rows, 'VARIAN'), true);
        if (/\b10\b/.test(q)) N = 10;
        var list = asc ? vr.slice().reverse() : vr;
        out.push('**' + (asc ? N + ' varian dengan unit terendah' : 'Top ' + Math.min(N, vr.length) + ' varian terlaris') + (focus ? ' — ' + focus : '') + '** (dari ' + fmt(total) + ' unit):');
        var segOf = {};
        rows.forEach(function (r) { segOf[r.VARIAN] = r.SEGMEN; });
        listLines(list, total, N, function (v) { return v + ' [' + segOf[v] + ']'; }).forEach(function (l) { out.push(l); });
        if (vr.length > N) out.push('Total ' + vr.length + ' varian terjual; ' + Math.min(N, vr.length) + ' teratas menyumbang **' + fmtPct(share(vr.slice(0, N).reduce(function (a, e) { return a + e[1]; }, 0), total)) + '**.');
      },
      segment: function () {
        var sr = ordered(countBy(rows, 'SEGMEN'), SEG_ORDER);
        out.push('**Total ' + fmt(total) + ' unit' + (focus ? ' — ' + focus : '') + '**, porsi per segmen:');
        sr.forEach(function (e) {
          var tv = ranked(countBy(rows.filter(function (r) { return r.SEGMEN === e[0]; }), 'VARIAN'), true)[0];
          out.push('- **' + e[0] + '**: ' + fmt(e[1]) + ' unit (**' + fmtPct(share(e[1], total)) + '**)' + (tv ? ' · terlaris ' + tv[0] + ' (' + fmt(tv[1]) + ')' : '') + (nSmall(e[1]) ? ' ⚠ n kecil' : ''));
        });
      },
      age: function () {
        var am = countBy(rows, 'AGE GROUP');
        var ar = ranked(am, true);
        out.push('**Kelompok usia' + (focus ? ' — ' + focus : '') + '** (dari ' + fmt(total) + ' unit):');
        if (ar[0]) out.push('Terbesar **' + ar[0][0] + '** (' + fmt(ar[0][1]) + ' unit, **' + fmtPct(share(ar[0][1], total)) + '**)' + (ar[1] ? ', disusul **' + ar[1][0] + '** (' + fmtPct(share(ar[1][1], total)) + ')' : '') + '.');
        ordered(am, AGE_ORDER).forEach(function (e) { out.push('- ' + e[0] + ': ' + fmt(e[1]) + ' (' + fmtPct(share(e[1], total)) + ')' + (nSmall(e[1]) ? ' ⚠ n kecil' : '')); });
      },
      brand: function () {
        var bm = countBy(rows, 'MEREK SBLMNYA');
        var nn = bm.get(NEW_BUYER) || 0;
        var sw = rows.filter(function (r) { return r['TIPE KONSUMEN'] === 'Pindahan merek lain'; });
        var swr = ranked(countBy(sw, 'MEREK SBLMNYA'), true);
        out.push('**Asal konsumen' + (focus ? ' — ' + focus : '') + '** (dari ' + fmt(total) + ' unit):');
        out.push('- **Konsumen baru** (belum pernah memiliki): **' + fmtPct(share(nn, total)) + '** (' + fmt(nn) + ')');
        out.push('- **Repeat Honda**: ' + fmtPct(share(bm.get('HONDA') || 0, total)) + ' (' + fmt(bm.get('HONDA') || 0) + ')');
        out.push('- **Pindahan merek lain**: **' + fmtPct(share(sw.length, total)) + '** (' + fmt(sw.length) + ')');
        swr.slice(0, 5).forEach(function (e) {
          var ts = ranked(countBy(sw.filter(function (r) { return r['MEREK SBLMNYA'] === e[0]; }), 'SEGMEN'), true)[0];
          out.push('  - dari **' + brandLabel(e[0]) + '**: ' + fmt(e[1]) + ' (' + fmtPct(share(e[1], total)) + ')' + (ts ? ' → paling banyak pilih ' + ts[0] : '') + (nSmall(e[1]) ? ' ⚠ n kecil' : ''));
        });
        if (bm.get(UNKNOWN)) out.push('_Merek sebelumnya Unknown: ' + fmt(bm.get(UNKNOWN)) + ' unit._');
      },
      area: function () {
        var kr = ranked(countBy(rows, 'KECAMATAN'), true);
        var list = asc ? kr.slice().reverse() : kr;
        if (/\b10\b/.test(q)) N = 10;
        out.push('**' + (asc ? N + ' kecamatan dengan unit terendah' : 'Top ' + Math.min(N, kr.length) + ' kecamatan') + (focus ? ' — ' + focus : '') + '**:');
        listLines(list, total, N).forEach(function (l) { out.push(l); });
        if (!asc && kr.length) out.push('3 kecamatan teratas = **' + fmtPct(share(kr.slice(0, 3).reduce(function (a, e) { return a + e[1]; }, 0), total)) + '** unit → prioritas promosi & aktivasi dealer.');
      },
      dealer: function () {
        var dr = ranked(countBy(rows, 'DEALER'), true);
        out.push('**Peringkat dealer' + (focus ? ' — ' + focus : '') + '**:');
        listLines(asc ? dr.slice().reverse() : dr, total, Math.max(N, 6)).forEach(function (l) { out.push(l); });
      },
      color: function () {
        out.push('**Warna terlaris' + (focus ? ' — ' + focus : '') + '**:');
        listLines(ranked(countBy(rows, 'WARNA'), true), total, N).forEach(function (l) { out.push(l); });
      },
      edu: function () {
        out.push('**Pendidikan konsumen' + (focus ? ' — ' + focus : '') + '**:');
        listLines(ranked(countBy(rows, 'PENDIDIKAN'), true), total, 8).forEach(function (l) { out.push(l); });
      },
      total: function () {
        var st = quarterStats(rows);
        var sr = ordered(countBy(rows, 'SEGMEN'), SEG_ORDER);
        out.push('**Total penjualan: ' + fmt(total) + ' unit**' + (ctx.filters.length ? ' (' + fmtPct(share(total, ctx.allRows.length)) + ' dari ' + fmt(ctx.allRows.length) + ')' : '') + '.');
        sr.forEach(function (e) { out.push('- ' + e[0] + ': **' + fmt(e[1]) + '** (' + fmtPct(share(e[1], total)) + ')'); });
        var months = new Set(st.dated.map(function (r) { return r.TAHUN * 100 + r.BULAN; }));
        if (months.size) out.push('Rata-rata **' + fmt(st.dated.length / months.size) + ' unit/bulan** (' + months.size + ' bulan bertanggal valid).');
      },
      entity: function () {
        var single = dims.length === 1 && dims[0].groups.length === 1 && dims[0].groups[0].values.size === 1;
        out.push('**' + (focus || 'Data terfilter') + '**: **' + fmt(total) + ' unit** (' + fmtPct(share(total, ctx.rows.length)) + ' dari ' + fmt(ctx.rows.length) + ' unit terfilter)' + (nSmall(total) ? ' ⚠ n kecil' : '') + '.');
        if (single) {
          var d = dims[0], v = Array.from(d.groups[0].values)[0];
          var rk = ranked(countBy(ctx.rows, d.key), true);
          var pos = rk.findIndex(function (e) { return e[0] === v; });
          if (pos >= 0) out.push('- Peringkat **#' + (pos + 1) + '** dari ' + rk.length + ' ' + d.label.toLowerCase());
        }
        var ts = ordered(countBy(rows, 'SEGMEN'), SEG_ORDER).map(function (e) { return e[0] + ' ' + fmtPct(share(e[1], total), 0); }).join(' · ');
        if (!dims.some(function (x) { return x.key === 'SEGMEN'; })) out.push('- Segmen: ' + ts);
        var tv = ranked(countBy(rows, 'VARIAN'), true)[0];
        if (tv && !dims.some(function (x) { return x.key === 'VARIAN' && x.groups[0].values.size === 1; })) out.push('- Varian terlaris: **' + tv[0] + '** (' + fmt(tv[1]) + ')');
        var ta = ranked(countBy(rows, 'AGE GROUP'), true)[0];
        if (ta) out.push('- Usia terbanyak: **' + ta[0] + '** (' + fmtPct(share(ta[1], total)) + ')');
        var tk = ranked(countBy(rows, 'KECAMATAN'), true)[0];
        if (tk && !dims.some(function (x) { return x.key === 'KECAMATAN'; })) out.push('- Kecamatan terbanyak: **' + tk[0] + '** (' + fmt(tk[1]) + ')');
        var st = quarterStats(rows);
        var peak = st.keys.slice().sort(function (a, b) { return st.qs[b] - st.qs[a]; })[0];
        if (peak) out.push('- Kuartal puncak: **' + st.label(peak) + '** (' + fmt(st.qs[peak]) + ' unit)');
      }
    };
    ans[intent]();
    if (intent !== 'help') out.push(foot);
    return out.join('\n');
  }

  function autoSize(ta) {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }
  function updateSendState() {
    document.getElementById('chatSend').disabled = !document.getElementById('chatText').value.trim() && !chatImage;
  }
  function clearImage() {
    chatImage = null;
    var pv = document.getElementById('attachPreview');
    pv.hidden = true;
    pv.innerHTML = '';
    document.getElementById('chatImage').value = '';
  }
  function setChat(open) {
    var app = document.getElementById('app');
    app.classList.toggle('chat-open', open);
    document.getElementById('chatToggle').setAttribute('aria-expanded', String(open));
    document.getElementById('chat').setAttribute('aria-hidden', String(!open));
    if (open) setTimeout(function () { document.getElementById('chatText').focus(); }, 240);
  }

  /* ============================================================ UI BINDING */
  function bindUI() {
    document.getElementById('prevPage').addEventListener('click', function () { setPage(APP.page - 1); });
    document.getElementById('nextPage').addEventListener('click', function () { setPage(APP.page + 1); });
    document.getElementById('chatToggle').addEventListener('click', function () { setChat(!document.getElementById('app').classList.contains('chat-open')); });
    document.getElementById('chatClose').addEventListener('click', function () { setChat(false); document.getElementById('chatToggle').focus(); });
    document.getElementById('infoBtn').addEventListener('click', function () { openInfo(!APP.infoOpen); });
    document.getElementById('infoClose').addEventListener('click', function () { openInfo(false); });
    document.getElementById('infoOverlay').addEventListener('mousedown', function (e) { if (e.target.id === 'infoOverlay') openInfo(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && APP.infoOpen) { openInfo(false); return; }
      var tag = (e.target && e.target.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag) || APP.infoOpen) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { setPage(APP.page + 1); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { setPage(APP.page - 1); }
    });
    var ta = document.getElementById('chatText');
    ta.addEventListener('input', function () { autoSize(ta); updateSendState(); });
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(ta.value); }
    });
    document.getElementById('chatForm').addEventListener('submit', function (e) { e.preventDefault(); send(ta.value); });
    document.getElementById('chatImage').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      if (!/^image\//.test(f.type)) { clearImage(); return; }
      var reader = new FileReader();
      reader.onload = function () {
        chatImage = { name: f.name, size: f.size, url: reader.result };
        var pv = document.getElementById('attachPreview');
        pv.innerHTML = '<img alt=""><span></span><button type="button" aria-label="Hapus lampiran">&times;</button>';
        pv.querySelector('img').src = reader.result;
        pv.querySelector('span').textContent = f.name + ' · ' + fmt(f.size / 1024) + ' KB';
        pv.querySelector('button').addEventListener('click', function () { clearImage(); updateSendState(); });
        pv.hidden = false;
        updateSendState();
      };
      reader.readAsDataURL(f);
    });
    updateSendState();
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(queueFit);
      ro.observe(document.getElementById('main'));
      document.querySelectorAll('.insight').forEach(function (b) { ro.observe(b); });
    }
    var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    if (mq && mq.addEventListener) mq.addEventListener('change', function () { if (APP.ctx) render(APP.ctx); });
  }

  /* ============================================================ INIT */
  function init() {
    buildTabs();
    bindUI();
    if (!IDR || typeof IDR.mount !== 'function') {
      document.getElementById('hdrSub').textContent = 'IDRDash tidak tersedia — dashboard tidak dapat dimuat.';
      return;
    }
    var emb = (typeof IDR.embedded === 'function' ? IDR.embedded() : null) || window.__IDR_DATA__ || { files: [] };
    var model;
    try { model = prepare(emb.files || [], null); }
    catch (e) {
      console.error(e);
      model = { data: [], meta: { files: [], tables: [], unused: [], nulls: {}, invalidDates: [], unmapped: {}, dict: {}, error: e.message } };
    }
    model.meta.synthetic = !!emb.synthetic;
    setPage(0); // aktifkan halaman dulu agar grafik dirender pada kontainer yang terlihat
    IDR.mount({
      data: model.data,
      columns: COLUMNS,
      filters: FILTERS,
      render: render,
      prepare: function (workbooks, prev) {
        var res = prepare(workbooks, prev && prev.meta);
        res.meta.synthetic = false;
        return res;
      },
      meta: model.meta,
      source: { kind: 'embedded', label: 'Data bawaan IDR', files: model.meta.files }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
