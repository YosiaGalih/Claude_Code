/*!
 * IDRDash — runtime lokal (pengganti fitur bawaan IDR untuk mode standalone).
 * Menyediakan: data bawaan (blok #idr-embedded), Upload Excel (.xlsx/.csv) tanpa
 * pustaka pihak ketiga (unzip via DecompressionStream bawaan browser), filter
 * global multi-pilih di [data-idr-filters], dan toolbar data di [data-idr-toolbar].
 * Bila halaman dijalankan di platform IDR yang sudah menyediakan window.IDRDash,
 * runtime lokal ini tidak dipasang.
 */
(function (global) {
  'use strict';
  if (global.IDRDash) return;

  var fmtInt = function (n) { return Number(n).toLocaleString('id-ID'); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* ------------------------------------------------------------------ CSS */
  var CSS = [
    '.idr-filter{position:relative;flex:0 1 auto;min-width:0;display:flex}',
    '.idr-filter-btn{display:inline-flex;align-items:center;gap:6px;height:28px;max-width:100%;min-width:0;overflow:hidden;padding:0 9px 0 10px;border-radius:8px;border:1px solid var(--border-strong,#cfd4dc);background:var(--surface,#fff);font-size:12px;color:var(--text,#111);white-space:nowrap}',
    '.idr-filter-btn:hover{border-color:var(--focus,#2a78d6)}',
    '.idr-filter-btn .k{color:var(--text-3,#737a8a);font-weight:600;flex:none}',
    '.idr-filter-btn .k-short{display:none}',
    '.idr-filter-btn .v{overflow:hidden;text-overflow:ellipsis;font-weight:650;min-width:0}',
    '.idr-filter-btn .car{font-size:9px;color:var(--text-3,#737a8a)}',
    '.idr-filter-btn.active{border-color:var(--focus,#2a78d6);box-shadow:inset 0 0 0 1px var(--focus,#2a78d6)}',
    '.idr-filter-btn.active .v{color:var(--focus,#2a78d6)}',
    '.idr-reset{height:28px;padding:0 8px;border:0;border-radius:7px;background:transparent;color:var(--focus,#2a78d6);font-size:12px;font-weight:650;white-space:nowrap}',
    '.idr-reset:hover{background:var(--surface-3,#eef0f4)}',
    '.idr-filter-label{font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--text-3,#737a8a);margin-right:2px;white-space:nowrap}',
    '.idr-pop,.idr-menu{position:fixed;z-index:90;background:var(--surface,#fff);color:var(--text,#111);border:1px solid var(--border-strong,#cfd4dc);border-radius:10px;box-shadow:var(--shadow-lg,0 12px 40px rgba(0,0,0,.2));font-size:12px}',
    '.idr-pop{width:250px;padding:6px}',
    '.idr-pop input[type=search]{width:100%;height:28px;border:1px solid var(--border,#e2e5ea);border-radius:7px;padding:0 8px;margin-bottom:4px;background:var(--surface-2,#f7f8fa);outline:none}',
    '.idr-opts{overflow:auto;scrollbar-width:thin}',
    '.idr-opt{display:flex;align-items:center;gap:7px;padding:4px 6px;border-radius:6px;cursor:pointer}',
    '.idr-opt:hover{background:var(--surface-3,#eef0f4)}',
    '.idr-opt .lbl{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.idr-opt .cnt{color:var(--text-3,#737a8a);font-variant-numeric:tabular-nums;font-size:11px}',
    '.idr-opt .only{display:none;border:0;background:transparent;color:var(--focus,#2a78d6);font-size:10.5px;font-weight:700;padding:0 2px}',
    '.idr-opt:hover .only{display:inline}',
    '.idr-opt:hover .cnt{display:none}',
    '.idr-pop-foot{display:flex;justify-content:space-between;border-top:1px solid var(--border,#e2e5ea);margin-top:4px;padding-top:5px}',
    '.idr-pop-foot button{border:0;background:transparent;color:var(--focus,#2a78d6);font-weight:650;font-size:11.5px;padding:3px 6px;border-radius:6px}',
    '.idr-pop-foot button:hover{background:var(--surface-3,#eef0f4)}',
    '.idr-toolbar-wrap{display:flex;align-items:center;gap:6px;min-width:0}',
    '.idr-status{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:999px;background:var(--surface-3,#eef0f4);font-size:11.5px;color:var(--text-2,#4a5160);max-width:340px;min-width:0}',
    '.idr-status .dot{width:7px;height:7px;border-radius:50%;background:#0ca30c;flex:none}',
    '.idr-status.loading .dot{background:#eda100;animation:idrpulse 1s infinite}',
    '.idr-status.error{color:#d03b3b}',
    '.idr-status.error .dot{background:#d03b3b}',
    '.idr-status .txt{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}',
    '.idr-upload{height:28px;display:inline-flex;align-items:center;gap:6px;padding:0 11px;border-radius:8px;border:1px solid var(--border-strong,#cfd4dc);background:var(--surface,#fff);font-size:12px;font-weight:650;white-space:nowrap;flex:none}',
    '.idr-upload:hover{border-color:var(--focus,#2a78d6)}',
    '.idr-more{width:28px;height:28px;border-radius:8px;border:1px solid var(--border,#e2e5ea);background:var(--surface,#fff);font-size:16px;line-height:1;flex:none;padding:0}',
    '.idr-more:hover{background:var(--surface-3,#eef0f4)}',
    '.idr-menu{min-width:250px;padding:5px}',
    '.idr-menu button{display:block;width:100%;text-align:left;border:0;background:transparent;padding:7px 9px;border-radius:6px}',
    '.idr-menu button:hover:not(:disabled){background:var(--surface-3,#eef0f4)}',
    '.idr-menu button:disabled{opacity:.45;cursor:default}',
    '.idr-menu .meta{padding:6px 9px 4px;color:var(--text-3,#737a8a);font-size:11px;border-top:1px solid var(--border,#e2e5ea);margin-top:4px;line-height:1.4}',
    'body.idr-dragging::after{content:"Lepaskan file Excel untuk mengganti data";position:fixed;inset:10px;z-index:95;display:grid;place-items:center;border:2px dashed var(--focus,#2a78d6);border-radius:14px;background:rgba(42,120,214,.08);font:600 16px/1.4 system-ui,sans-serif;color:var(--focus,#2a78d6);pointer-events:none}',
    '@keyframes idrpulse{50%{opacity:.3}}'
  ].join('\n');

  function injectCss() {
    if (document.getElementById('idr-style')) return;
    var s = document.createElement('style');
    s.id = 'idr-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  /* --------------------------------------------------- PEMBACA XLSX / CSV */
  function inflateRaw(bytes) {
    if (typeof DecompressionStream === 'undefined') {
      return Promise.reject(new Error('Browser tidak mendukung pembacaan .xlsx (DecompressionStream). Gunakan Chrome/Edge/Firefox/Safari versi terbaru.'));
    }
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(stream).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }

  function unzip(buffer) {
    var u8 = new Uint8Array(buffer);
    var dv = new DataView(buffer);
    var eocd = -1;
    for (var i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('File bukan .xlsx yang valid (arsip zip tidak dikenali).');
    var count = dv.getUint16(eocd + 10, true);
    var p = dv.getUint32(eocd + 16, true);
    var dec = new TextDecoder('utf-8');
    var entries = {};
    for (var k = 0; k < count; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      var method = dv.getUint16(p + 10, true);
      var csize = dv.getUint32(p + 20, true);
      var nameLen = dv.getUint16(p + 28, true);
      var extraLen = dv.getUint16(p + 30, true);
      var cmtLen = dv.getUint16(p + 32, true);
      var lho = dv.getUint32(p + 42, true);
      var name = dec.decode(u8.subarray(p + 46, p + 46 + nameLen));
      entries[name.toLowerCase()] = { method: method, csize: csize, lho: lho };
      p += 46 + nameLen + extraLen + cmtLen;
    }
    return {
      text: function (name) {
        var f = entries[String(name).toLowerCase()];
        if (!f) return Promise.resolve(null);
        var lnl = dv.getUint16(f.lho + 26, true);
        var lel = dv.getUint16(f.lho + 28, true);
        var start = f.lho + 30 + lnl + lel;
        var raw = u8.subarray(start, start + f.csize);
        var pr = f.method === 0 ? Promise.resolve(raw)
          : f.method === 8 ? inflateRaw(raw)
          : Promise.reject(new Error('Metode kompresi zip tidak didukung (' + f.method + ').'));
        return pr.then(function (out) { return dec.decode(out); });
      }
    };
  }

  function parseXml(text) {
    var doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('XML di dalam file .xlsx rusak.');
    return doc;
  }
  function byTag(node, tag) { return node.getElementsByTagNameNS('*', tag); }
  function richText(node) {
    var ts = byTag(node, 't');
    var out = '';
    for (var i = 0; i < ts.length; i++) {
      var par = ts[i].parentNode;
      if (par && par.localName === 'rPh') continue; // abaikan teks fonetik
      out += ts[i].textContent;
    }
    return out;
  }
  function colIndex(ref) {
    var m = /^([A-Za-z]+)/.exec(ref);
    if (!m) return -1;
    var s = m[1].toUpperCase();
    var n = 0;
    for (var i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
    return n - 1;
  }
  function resolvePath(target) {
    if (!target) return '';
    if (target.charAt(0) === '/') return target.slice(1);
    var parts = ('xl/' + target).split('/');
    var out = [];
    parts.forEach(function (seg) {
      if (seg === '..') out.pop();
      else if (seg && seg !== '.') out.push(seg);
    });
    return out.join('/');
  }

  function parseSheet(doc, sst) {
    var rows = [];
    var rowEls = byTag(doc, 'row');
    var rIdx = -1;
    for (var i = 0; i < rowEls.length; i++) {
      var row = rowEls[i];
      var rAttr = row.getAttribute('r');
      rIdx = rAttr ? (parseInt(rAttr, 10) - 1) : rIdx + 1;
      var arr = [];
      var cIdx = -1;
      var cells = row.children;
      for (var j = 0; j < cells.length; j++) {
        var c = cells[j];
        if (c.localName !== 'c') continue;
        var ref = c.getAttribute('r');
        cIdx = ref ? colIndex(ref) : cIdx + 1;
        var t = c.getAttribute('t');
        var v = null;
        if (t === 'inlineStr') {
          var is = byTag(c, 'is')[0];
          v = is ? richText(is) : null;
        } else {
          var ve = byTag(c, 'v')[0];
          var raw = ve ? ve.textContent : null;
          if (raw == null) v = null;
          else if (t === 's') v = sst[parseInt(raw, 10)];
          else if (t === 'b') v = raw === '1';
          else if (t === 'e') v = null;
          else if (t === 'str' || t === 'd') v = raw;
          else {
            var num = Number(raw);
            v = isFinite(num) ? num : raw;
          }
        }
        if (v !== null && v !== undefined && v !== '') arr[cIdx] = v;
      }
      for (var h = 0; h < arr.length; h++) if (arr[h] === undefined) arr[h] = null;
      rows[rIdx] = arr;
    }
    for (var r = 0; r < rows.length; r++) if (!rows[r]) rows[r] = [];
    return rows;
  }

  function readXlsx(buffer, fileName) {
    var zip = unzip(buffer);
    var relMap = {};
    var sst = [];
    return Promise.all([
      zip.text('xl/workbook.xml'),
      zip.text('xl/_rels/workbook.xml.rels'),
      zip.text('xl/sharedStrings.xml')
    ]).then(function (res) {
      if (!res[0]) throw new Error('Struktur .xlsx tidak dikenali (xl/workbook.xml tidak ada).');
      if (res[1]) {
        var rels = byTag(parseXml(res[1]), 'Relationship');
        for (var i = 0; i < rels.length; i++) relMap[rels[i].getAttribute('Id')] = rels[i].getAttribute('Target');
      }
      if (res[2]) {
        var sis = byTag(parseXml(res[2]), 'si');
        for (var s = 0; s < sis.length; s++) sst.push(richText(sis[s]));
      }
      var sheetEls = byTag(parseXml(res[0]), 'sheet');
      var jobs = [];
      for (var k = 0; k < sheetEls.length; k++) {
        (function (sh) {
          var rid = null;
          for (var a = 0; a < sh.attributes.length; a++) if (sh.attributes[a].localName === 'id') rid = sh.attributes[a].value;
          var path = resolvePath(relMap[rid]);
          jobs.push(zip.text(path).then(function (xml) {
            return xml ? { name: sh.getAttribute('name'), rows: parseSheet(parseXml(xml), sst) } : null;
          }));
        })(sheetEls[k]);
      }
      return Promise.all(jobs);
    }).then(function (sheets) {
      return { name: fileName, sheets: sheets.filter(Boolean) };
    });
  }

  function readCsv(text, fileName) {
    text = text.replace(/^\ufeff/, '');
    var first = text.split(/\r?\n/, 1)[0] || '';
    var delim = [',', ';', '\t'].map(function (d) { return [d, first.split(d).length]; })
      .sort(function (a, b) { return b[1] - a[1]; })[0][0];
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    var conv = function (v) {
      var t = String(v).trim();
      if (t === '') return null;
      if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
      return t;
    };
    return { name: fileName, sheets: [{ name: fileName.replace(/\.[^.]+$/, ''), rows: rows.map(function (r) { return r.map(conv); }) }] };
  }

  function readFile(file) {
    var name = file.name || 'file';
    if (/\.csv$/i.test(name)) return file.text().then(function (t) { return readCsv(t, name); });
    if (/\.xls$/i.test(name)) return Promise.reject(new Error('Format .xls (Excel 97-2003) belum didukung — simpan ulang sebagai .xlsx.'));
    return file.arrayBuffer().then(function (buf) { return readXlsx(buf, name); });
  }

  /* ---------------------------------------------------------- DATA BAWAAN */
  var embeddedCache = null;
  function embedded() {
    if (embeddedCache) return embeddedCache;
    var node = document.getElementById('idr-embedded');
    try { embeddedCache = node ? JSON.parse(node.textContent) : { files: [] }; }
    catch (e) { console.error('[IDRDash] data bawaan tidak terbaca', e); embeddedCache = { files: [] }; }
    return embeddedCache;
  }

  /* ---------------------------------------------------------------- STATE */
  var S = {
    opts: null, all: [], meta: {}, source: null, initial: null,
    sel: {}, status: { kind: 'ok', text: '' },
    filterHost: null, toolbarHost: null, statusEl: null, pop: null
  };

  function filterDefs() { return (S.opts && S.opts.filters) || []; }
  function valueOf(row, key) { var v = row[key]; return v == null || v === '' ? 'Unknown' : String(v); }

  function activeFilters() {
    return filterDefs().filter(function (f) { return S.sel[f.key] && S.sel[f.key].size; })
      .map(function (f) { return { key: f.key, label: f.label || f.key, values: Array.from(S.sel[f.key]) }; });
  }

  function filteredRows() {
    var act = activeFilters();
    if (!act.length) return S.all;
    var sets = act.map(function (a) { return [a.key, S.sel[a.key]]; });
    return S.all.filter(function (r) {
      for (var i = 0; i < sets.length; i++) if (!sets[i][1].has(valueOf(r, sets[i][0]))) return false;
      return true;
    });
  }

  function emit() {
    if (!S.opts || typeof S.opts.render !== 'function') return;
    var ctx = {
      rows: filteredRows(), allRows: S.all, meta: S.meta, source: S.source,
      filters: activeFilters(), filterDefs: filterDefs(), columns: S.opts.columns || []
    };
    try { S.opts.render(ctx); } catch (e) { console.error('[IDRDash] render gagal', e); }
  }

  function optionsFor(f) {
    var counts = new Map();
    S.all.forEach(function (r) { var v = valueOf(r, f.key); counts.set(v, (counts.get(v) || 0) + 1); });
    var order = f.order || [];
    return Array.from(counts.entries()).sort(function (a, b) {
      if (a[0] === 'Unknown') return 1;
      if (b[0] === 'Unknown') return -1;
      var ia = order.indexOf(a[0]), ib = order.indexOf(b[0]);
      if (ia >= 0 || ib >= 0) return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
      return b[1] - a[1] || String(a[0]).localeCompare(String(b[0]));
    }).map(function (e) { return { value: e[0], count: e[1] }; });
  }

  /* -------------------------------------------------------------- FILTER UI */
  function buildFilters() {
    var host = S.filterHost;
    if (!host) return;
    host.innerHTML = '';
    host.appendChild(el('span', 'idr-filter-label', 'Filter'));
    filterDefs().forEach(function (f) {
      if (!S.sel[f.key]) S.sel[f.key] = new Set();
      var wrap = el('div', 'idr-filter');
      var btn = el('button', 'idr-filter-btn');
      btn.type = 'button';
      btn.setAttribute('aria-haspopup', 'listbox');
      btn.dataset.key = f.key;
      btn.addEventListener('click', function (ev) { ev.stopPropagation(); togglePop(f, btn); });
      wrap.appendChild(btn);
      host.appendChild(wrap);
    });
    var reset = el('button', 'idr-reset', '&#8634; Reset');
    reset.type = 'button';
    reset.title = 'Hapus semua filter';
    reset.addEventListener('click', function () { clearFilters(); });
    S.resetBtn = reset;
    host.appendChild(reset);
    updateFilterButtons();
  }

  function updateFilterButtons() {
    if (!S.filterHost) return;
    filterDefs().forEach(function (f) {
      var btn = S.filterHost.querySelector('.idr-filter-btn[data-key="' + CSS_escape(f.key) + '"]');
      if (!btn) return;
      var sel = S.sel[f.key];
      var txt = !sel.size ? 'Semua' : sel.size === 1 ? Array.from(sel)[0] : sel.size + ' dipilih';
      var full = f.label || f.key;
      btn.innerHTML = '<span class="k"><span class="k-full">' + esc(full) + '</span><span class="k-short">' + esc(f.short || full) + '</span>:</span><span class="v">' + esc(txt) + '</span><span class="car">&#9662;</span>';
      btn.classList.toggle('active', sel.size > 0);
      btn.title = (f.label || f.key) + ': ' + (sel.size ? Array.from(sel).join(', ') : 'Semua');
    });
    if (S.resetBtn) S.resetBtn.style.visibility = activeFilters().length ? 'visible' : 'hidden';
  }

  function CSS_escape(s) { return String(s).replace(/["\\]/g, '\\$&'); }

  function closePops() {
    if (S.pop) { S.pop.remove(); S.pop = null; }
    if (S.menu) { S.menu.remove(); S.menu = null; }
  }

  function placeFloating(node, anchor, alignRight) {
    var r = anchor.getBoundingClientRect();
    document.body.appendChild(node);
    var w = node.offsetWidth;
    var left = alignRight ? r.right - w : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    node.style.left = left + 'px';
    node.style.top = (r.bottom + 4) + 'px';
  }

  function togglePop(f, btn) {
    var wasOpen = S.pop && S.pop.dataset.key === f.key;
    closePops();
    if (wasOpen) return;
    var opts = optionsFor(f);
    var sel = S.sel[f.key];
    var pop = el('div', 'idr-pop');
    pop.dataset.key = f.key;
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'Filter ' + (f.label || f.key));
    var search = null;
    if (opts.length > 8) {
      search = el('input');
      search.type = 'search';
      search.placeholder = 'Cari ' + (f.label || f.key).toLowerCase() + '…';
      pop.appendChild(search);
    }
    var list = el('div', 'idr-opts');
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-multiselectable', 'true');
    pop.appendChild(list);

    function isOn(v) { return !sel.size || sel.has(v); }
    function apply() {
      if (sel.size === opts.length) sel.clear();
      updateFilterButtons();
      emit();
    }
    function draw() {
      var q = search ? search.value.trim().toLowerCase() : '';
      list.innerHTML = '';
      opts.filter(function (o) { return !q || o.value.toLowerCase().indexOf(q) >= 0; }).forEach(function (o) {
        var row = el('label', 'idr-opt');
        row.setAttribute('role', 'option');
        row.setAttribute('aria-selected', String(isOn(o.value)));
        var cb = el('input');
        cb.type = 'checkbox';
        cb.checked = isOn(o.value);
        cb.addEventListener('change', function () {
          if (!sel.size) opts.forEach(function (x) { sel.add(x.value); });
          if (cb.checked) sel.add(o.value); else sel.delete(o.value);
          if (!sel.size) { cb.checked = true; sel.add(o.value); } // minimal 1 nilai
          apply();
          draw();
        });
        var only = el('button', 'only', 'hanya');
        only.type = 'button';
        only.title = 'Pilih hanya ' + o.value;
        only.addEventListener('click', function (ev) {
          ev.preventDefault();
          sel.clear(); sel.add(o.value);
          apply(); draw();
        });
        row.appendChild(cb);
        row.appendChild(el('span', 'lbl', esc(o.value)));
        row.appendChild(el('span', 'cnt', fmtInt(o.count) + (o.count < 5 ? ' · n kecil' : '')));
        row.appendChild(only);
        row.title = o.value + ' — ' + fmtInt(o.count) + ' baris' + (o.count < 5 ? ' (n kecil)' : '');
        list.appendChild(row);
      });
    }
    var foot = el('div', 'idr-pop-foot');
    var all = el('button', null, 'Pilih semua');
    all.type = 'button';
    all.addEventListener('click', function () { sel.clear(); apply(); draw(); });
    var close = el('button', null, 'Tutup');
    close.type = 'button';
    close.addEventListener('click', closePops);
    foot.appendChild(all);
    foot.appendChild(close);
    pop.appendChild(foot);
    if (search) search.addEventListener('input', draw);
    draw();
    S.pop = pop;
    placeFloating(pop, btn, false);
    var top = parseFloat(pop.style.top);
    list.style.maxHeight = Math.max(120, Math.min(300, window.innerHeight - top - 70)) + 'px';
    if (search) search.focus(); else { var first = list.querySelector('input'); if (first) first.focus(); }
  }

  function clearFilters() {
    Object.keys(S.sel).forEach(function (k) { S.sel[k].clear(); });
    closePops();
    updateFilterButtons();
    emit();
  }

  function setFilter(key, values) {
    if (!S.sel[key]) return;
    S.sel[key].clear();
    (values || []).forEach(function (v) { S.sel[key].add(String(v)); });
    updateFilterButtons();
    emit();
  }

  function pruneSelections() {
    filterDefs().forEach(function (f) {
      var valid = new Set(optionsFor(f).map(function (o) { return o.value; }));
      var sel = S.sel[f.key] || new Set();
      Array.from(sel).forEach(function (v) { if (!valid.has(v)) sel.delete(v); });
      if (sel.size === valid.size) sel.clear();
      S.sel[f.key] = sel;
    });
  }

  /* ------------------------------------------------------------- TOOLBAR UI */
  var ICON_UP = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 16V4m0 0l-5 5m5-5l5 5M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3"/></svg>';

  function buildToolbar() {
    var host = S.toolbarHost;
    if (!host) return;
    host.innerHTML = '';
    var wrap = el('div', 'idr-toolbar-wrap');
    S.statusEl = el('span', 'idr-status', '<span class="dot"></span><span class="txt"></span>');
    S.statusEl.setAttribute('role', 'status');
    var up = el('button', 'idr-upload', ICON_UP + '<span>Upload Excel</span>');
    up.type = 'button';
    up.title = 'Upload file Excel (.xlsx) atau CSV untuk mengganti data';
    var input = el('input');
    input.type = 'file';
    input.accept = '.xlsx,.xlsm,.csv';
    input.multiple = true;
    input.hidden = true;
    input.setAttribute('data-idr-upload', '');
    up.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
      if (input.files && input.files.length) handleFiles(Array.from(input.files));
      input.value = '';
    });
    var more = el('button', 'idr-more', '&#8942;');
    more.type = 'button';
    more.setAttribute('aria-label', 'Menu data');
    more.addEventListener('click', function (ev) { ev.stopPropagation(); toggleMenu(more); });
    wrap.appendChild(S.statusEl);
    wrap.appendChild(up);
    wrap.appendChild(input);
    wrap.appendChild(more);
    host.appendChild(wrap);
  }

  function setStatus(kind, text) {
    if (kind) S.status = { kind: kind, text: text };
    else {
      var src = S.source || {};
      var label = src.kind === 'upload' ? 'Upload: ' + src.label : (src.label || 'Data bawaan IDR');
      var when = src.kind === 'upload' && src.at ? ' · ' + src.at.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';
      S.status = { kind: 'ok', text: label + ' · ' + fmtInt(S.all.length) + ' baris' + when };
    }
    if (!S.statusEl) return;
    S.statusEl.className = 'idr-status' + (S.status.kind !== 'ok' ? ' ' + S.status.kind : '');
    S.statusEl.querySelector('.txt').textContent = S.status.text;
    S.statusEl.title = S.status.text;
  }

  function toggleMenu(anchor) {
    var wasOpen = !!S.menu;
    closePops();
    if (wasOpen) return;
    var m = el('div', 'idr-menu');
    m.setAttribute('role', 'menu');
    var items = [
      ['Kembalikan data bawaan IDR', function () { restoreEmbedded(); }, !S.source || S.source.kind !== 'upload'],
      ['Unduh data terfilter (CSV)', function () { downloadCsv(); }, false],
      ['Hapus semua filter', function () { clearFilters(); }, !activeFilters().length]
    ];
    items.forEach(function (it) {
      var b = el('button', null, esc(it[0]));
      b.type = 'button';
      b.setAttribute('role', 'menuitem');
      b.disabled = !!it[2];
      b.addEventListener('click', function () { closePops(); it[1](); });
      m.appendChild(b);
    });
    var cols = (S.opts.columns || []).map(function (c) { return c.label || c.key; });
    m.appendChild(el('div', 'meta',
      'Sumber: ' + esc((S.source && S.source.label) || '-') + '<br>' +
      fmtInt(S.all.length) + ' baris · ' + cols.length + ' kolom<br>' +
      'Upload: .xlsx / .csv — boleh pilih beberapa file sekaligus (mis. Assessment + Dictionary).'));
    S.menu = m;
    placeFloating(m, anchor, true);
  }

  function restoreEmbedded() {
    if (!S.initial) return;
    S.all = S.initial.data;
    S.meta = S.initial.meta;
    S.source = S.initial.source;
    pruneSelections();
    buildFilters();
    setStatus();
    emit();
  }

  function downloadCsv() {
    var cols = (S.opts.columns && S.opts.columns.length) ? S.opts.columns : Object.keys(S.all[0] || {}).map(function (k) { return { key: k }; });
    var q = function (v) {
      var s = v == null ? '' : String(v);
      return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    var lines = [cols.map(function (c) { return q(c.label || c.key); }).join(',')];
    filteredRows().forEach(function (r) { lines.push(cols.map(function (c) { return q(r[c.key]); }).join(',')); });
    var blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'data_terfilter.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function genericPrepare(workbooks) {
    var sh = workbooks[0] && workbooks[0].sheets[0];
    if (!sh) throw new Error('File kosong.');
    var hi = sh.rows.findIndex(function (r) { return r.filter(function (v) { return v != null && v !== ''; }).length >= 2; });
    var head = sh.rows[hi].map(function (h) { return String(h == null ? '' : h).trim(); });
    var data = sh.rows.slice(hi + 1).filter(function (r) { return r.some(function (v) { return v != null && v !== ''; }); })
      .map(function (r) { var o = {}; head.forEach(function (h, i) { if (h) o[h] = r[i]; }); return o; });
    return { data: data, meta: {} };
  }

  function handleFiles(files) {
    var names = files.map(function (f) { return f.name; });
    setStatus('loading', 'Membaca ' + names.join(', ') + '…');
    return Promise.all(files.map(readFile)).then(function (wbs) {
      var prep = typeof S.opts.prepare === 'function' ? S.opts.prepare : genericPrepare;
      return prep(wbs, { meta: S.meta, source: S.source });
    }).then(function (res) {
      if (!res || !Array.isArray(res.data) || !res.data.length) throw new Error('Tidak ada baris data yang terbaca dari file.');
      S.all = res.data;
      S.meta = res.meta || {};
      S.source = { kind: 'upload', label: names.join(' + '), files: names, at: new Date() };
      pruneSelections();
      buildFilters();
      setStatus();
      emit();
      return res;
    }).catch(function (e) {
      console.error('[IDRDash] upload gagal', e);
      setStatus('error', 'Gagal memuat: ' + (e && e.message ? e.message : e) + ' (data sebelumnya tetap dipakai)');
      throw e;
    });
  }

  function bindGlobal() {
    document.addEventListener('mousedown', function (ev) {
      if (S.pop && !S.pop.contains(ev.target) && !ev.target.closest('.idr-filter-btn')) closePops();
      if (S.menu && !S.menu.contains(ev.target) && !ev.target.closest('.idr-more')) closePops();
    });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') closePops(); });
    window.addEventListener('resize', closePops);
    var depth = 0;
    window.addEventListener('dragenter', function (ev) {
      if (ev.dataTransfer && Array.from(ev.dataTransfer.types || []).indexOf('Files') >= 0) { depth++; document.body.classList.add('idr-dragging'); }
    });
    window.addEventListener('dragleave', function () { depth = Math.max(0, depth - 1); if (!depth) document.body.classList.remove('idr-dragging'); });
    window.addEventListener('dragover', function (ev) { ev.preventDefault(); });
    window.addEventListener('drop', function (ev) {
      ev.preventDefault();
      depth = 0;
      document.body.classList.remove('idr-dragging');
      var fs = Array.from((ev.dataTransfer && ev.dataTransfer.files) || []).filter(function (f) { return /\.(xlsx|xlsm|csv)$/i.test(f.name); });
      if (fs.length) handleFiles(fs).catch(function () {});
    });
  }

  /* ---------------------------------------------------------------- MOUNT */
  function mount(opts) {
    if (!opts || typeof opts.render !== 'function') throw new Error('IDRDash.mount membutuhkan opsi render.');
    injectCss();
    S.opts = opts;
    S.all = Array.isArray(opts.data) ? opts.data : [];
    S.meta = opts.meta || {};
    S.source = opts.source || { kind: 'embedded', label: 'Data bawaan IDR' };
    S.initial = { data: S.all, meta: S.meta, source: S.source };
    S.sel = {};
    filterDefs().forEach(function (f) { S.sel[f.key] = new Set(); });
    S.filterHost = document.querySelector('[data-idr-filters]');
    S.toolbarHost = document.querySelector('[data-idr-toolbar]');
    if (!S.filterHost || !S.toolbarHost) console.warn('[IDRDash] elemen [data-idr-filters] / [data-idr-toolbar] tidak ditemukan.');
    if (!S.bound) { bindGlobal(); S.bound = true; }
    buildToolbar();
    buildFilters();
    setStatus();
    emit();
    return api;
  }

  var api = {
    version: 'local-1.0',
    isLocalRuntime: true,
    mount: mount,
    embedded: embedded,
    readFile: readFile,
    upload: function (files) { return handleFiles(Array.from(files)); },
    setFilter: setFilter,
    clearFilters: clearFilters,
    refresh: emit,
    getState: function () {
      return { rows: filteredRows(), allRows: S.all, meta: S.meta, source: S.source, filters: activeFilters() };
    }
  };
  global.IDRDash = api;
})(window);
