// Uji asap dashboard di Chromium (Playwright).
// Pemakaian: node tests/smoke_test.js [folder_screenshot]
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const HTML = 'file://' + path.join(ROOT, 'dist', 'Dashboard_Penjualan_Motor_Honda_2024.html');
const OUT = process.argv[2] || path.join(ROOT, 'tests', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

async function noScroll(page) {
  return page.evaluate(() => {
    const d = document.documentElement;
    const overflowing = [];
    document.querySelectorAll('.page.active .card, .page.active .kpi, .page.active .insight, .hdr-row1, .hdr-row2').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom > window.innerHeight + 0.5 || r.right > window.innerWidth + 0.5) overflowing.push(el.className);
    });
    return { sh: d.scrollHeight, ch: window.innerHeight, sw: d.scrollWidth, cw: window.innerWidth, overflowing };
  });
}

async function chartsFilled(page) {
  return page.evaluate(() => {
    const out = {};
    document.querySelectorAll('.page.active canvas').forEach((c) => {
      const ch = window.Chart.getChart(c);
      out[c.id] = ch ? ch.data.datasets.reduce((a, d) => a + d.data.filter((v) => v > 0).length, 0) : 0;
    });
    return out;
  });
}

async function clipped(page) {
  return page.evaluate(() => {
    const sel = '.title, #hdrSub, .page.active .bq-text, .page.active .kpi-label, .page.active .kpi-value, .page.active .card figcaption, .idr-filter-btn';
    return Array.from(document.querySelectorAll(sel)).filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.className || e.id);
  });
}

async function insightLines(page) {
  return page.evaluate(() => {
    const p = document.querySelector('.page.active .ins-text');
    const lh = parseFloat(getComputedStyle(p).lineHeight);
    return { lines: Math.round(p.scrollHeight / lh), text: p.textContent };
  });
}

(async () => {
  const browser = await chromium.launch();
  for (const vp of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
    const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(HTML);
    await page.waitForTimeout(900);
    const tag = `${vp.width}x${vp.height}`;

    for (let i = 0; i < 2; i++) {
      if (i === 1) { await page.click('#nextPage'); await page.waitForTimeout(700); }
      const ns = await noScroll(page);
      check(`[${tag}] hal ${i + 1}: tanpa scroll`, ns.sh <= ns.ch && ns.sw <= ns.cw && !ns.overflowing.length, JSON.stringify(ns));
      const cf = await chartsFilled(page);
      check(`[${tag}] hal ${i + 1}: semua grafik berisi data`, Object.values(cf).length >= 3 && Object.values(cf).every((n) => n > 0), JSON.stringify(cf));
      const kpis = await page.$$eval('.page.active .kpi-value', (els) => els.map((e) => e.textContent.trim()));
      check(`[${tag}] hal ${i + 1}: 3 KPI terisi`, kpis.length === 3 && kpis.every((k) => k && k !== '–'), kpis.join(' | '));
      const il = await insightLines(page);
      check(`[${tag}] hal ${i + 1}: insight ≤ 2 baris`, il.lines <= 2 && il.text.length > 40, `${il.lines} baris`);
      const cl = await clipped(page);
      check(`[${tag}] hal ${i + 1}: teks utama tidak terpotong`, cl.length === 0, cl.join(', '));
      await page.screenshot({ path: path.join(OUT, `${tag}_hal${i + 1}.png`) });
    }
    const hdrH = await page.$eval('.hdr-row1', (e) => e.getBoundingClientRect().height);
    check(`[${tag}] header baris 1 ≤ 56px`, hdrH <= 56, hdrH + 'px');

    // chat terbuka
    await page.click('#chatToggle');
    await page.waitForTimeout(600);
    const chatW = await page.$eval('#chat', (e) => e.getBoundingClientRect().width);
    check(`[${tag}] sidebar chat 420px`, Math.round(chatW) === 420, chatW + 'px');
    const ns2 = await noScroll(page);
    check(`[${tag}] chat terbuka: tanpa scroll`, ns2.sh <= ns2.ch && ns2.sw <= ns2.cw && !ns2.overflowing.length, JSON.stringify(ns2));
    const il2 = await insightLines(page);
    check(`[${tag}] chat terbuka: insight ≤ 2 baris`, il2.lines <= 2, `${il2.lines} baris`);
    const cl2 = await clipped(page);
    check(`[${tag}] chat terbuka: teks utama tidak terpotong`, cl2.length === 0, cl2.join(', '));
    await page.click('#prevPage');
    await page.waitForTimeout(500);
    const il3 = await insightLines(page);
    const cl3 = await clipped(page);
    check(`[${tag}] chat terbuka hal 1: insight ≤ 2 baris & tidak terpotong`, il3.lines <= 2 && cl3.length === 0, `${il3.lines} baris; ${cl3.join(', ')}`);
    await page.screenshot({ path: path.join(OUT, `${tag}_hal1_chat.png`) });
    await page.click('#nextPage');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, `${tag}_hal2_chat.png`) });
    check(`[${tag}] tanpa error konsol`, errors.length === 0, errors.join(' || '));
    await page.close();
  }

  // ---------- Interaksi lengkap (1366x768)
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(HTML);
  await page.waitForTimeout(800);

  const chatClosedInitially = await page.$eval('#app', (e) => !e.classList.contains('chat-open'));
  check('chat tertutup saat pertama dibuka', chatClosedInitially);
  const tables = await page.$$eval('table', (t) => t.length);
  check('tidak ada elemen tabel', tables === 0, String(tables));
  const toolbarIn = await page.$eval('[data-idr-toolbar]', (e) => !!e.querySelector('.idr-upload') && !!e.querySelector('.idr-status') && !!e.querySelector('.idr-more'));
  check('toolbar IDR (status, Upload, ⋮) di baris 2', toolbarIn);
  const filterBtns = await page.$$eval('[data-idr-filters] .idr-filter-btn', (b) => b.map((x) => x.textContent));
  check('3 filter IDR di header', filterBtns.length === 3, filterBtns.join(' | '));

  const total0 = await page.$eval('#k1a .kpi-value', (e) => e.textContent);
  // filter Segmen = SPORT lewat UI
  await page.click('[data-idr-filters] .idr-filter-btn[data-key="SEGMEN"]');
  await page.waitForSelector('.idr-pop');
  await page.hover('.idr-opt:has-text("SPORT")');
  await page.click('.idr-opt:has-text("SPORT") .only');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const total1 = await page.$eval('#k1a .kpi-value', (e) => e.textContent);
  const seg1 = await page.$eval('#k1b .kpi-value', (e) => e.textContent);
  check('filter Segmen=SPORT mengubah KPI', total1 !== total0 && /SPORT/.test(seg1), `${total0} → ${total1}; ${seg1}`);
  const legendShown = await page.evaluate(() => ['ch1a', 'ch1c'].map((id) => window.Chart.getChart(document.getElementById(id)).options.plugins.legend.display));
  check('legenda disembunyikan saat 1 seri/kategori', legendShown.every((v) => v === false), JSON.stringify(legendShown));
  await page.screenshot({ path: path.join(OUT, 'filter_sport_hal1.png') });

  // filter kombinasi + klik kolom usia (cross-filter)
  await page.click('#nextPage');
  await page.waitForTimeout(600);
  const cf = await chartsFilled(page);
  check('hal 2 terfilter: grafik tetap berisi', Object.values(cf).every((n) => n > 0), JSON.stringify(cf));
  await page.click('.idr-reset');
  await page.waitForTimeout(500);
  await page.click('#prevPage');
  await page.waitForTimeout(500);
  const total2 = await page.$eval('#k1a .kpi-value', (e) => e.textContent);
  check('Reset filter mengembalikan total', total2 === total0, total2);

  // panel ⓘ
  await page.click('#infoBtn');
  await page.waitForTimeout(300);
  const info = await page.$eval('#infoBody', (e) => e.textContent);
  check('ⓘ: tabel dipakai/tidak dipakai', /DIPAKAI/.test(info) && /LATIHAN/.test(info) && /TIDAK DIPAKAI/.test(info));
  check('ⓘ: null → Unknown & tanggal tidak valid', /Unknown/.test(info) && /Tanggal tidak valid/.test(info) && /20240231/.test(info));
  check('ⓘ: n < 5 tercatat', /n=3/.test(info), (info.match(/Kelompok usia: [^\n]{0,60}/) || [''])[0]);
  check('ⓘ: kamus & "arti tidak tersedia"', /Automatic Transmission/.test(info) && /arti tidak tersedia/.test(info));
  const infoFits = await page.$eval('#infoBody', (e) => e.scrollHeight <= e.clientHeight + 1);
  check('ⓘ: muat tanpa scroll', infoFits);
  await page.screenshot({ path: path.join(OUT, 'info_panel.png') });
  await page.keyboard.press('Escape');

  // chatbot
  await page.click('#chatToggle');
  await page.waitForTimeout(400);
  const quick = await page.$$eval('#quickPrompts button', (b) => b.map((x) => x.textContent));
  check('quick prompts tersedia', quick.length >= 6, quick.length + ' tombol');
  const qs = [
    'Berapa total penjualan dan porsi tiap segmen?',
    'Apa 10 varian terlaris?',
    'Bagaimana tren penjualan per kuartal?',
    'Konsumen paling banyak pindah dari merek apa?',
    'Varian apa yang perlu dijaga stoknya?',
    'Kecamatan mana yang jadi prioritas promosi?',
    quick.find((q) => /Bandingkan/.test(q)) || 'Bandingkan Pedurungan vs Tembalang',
    'Top 3 varian AT di Tembalang',
    'Usia berapa pembeli CUB?',
    'Apa arti CUB?',
    'Apa arti WARNA?',
    'Bagaimana kualitas data ini?'
  ];
  const answers = [];
  for (const q of qs) {
    await page.fill('#chatText', q);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(450);
    const a = await page.$$eval('.msg.bot', (m) => m[m.length - 1].innerText);
    answers.push({ q, a });
  }
  answers.forEach(({ q, a }) => check(`chat: "${q}"`, a.length > 20 && !/gagal/i.test(a) && /\d|arti|kamus/.test(a), a.replace(/\s+/g, ' ').slice(0, 150)));
  fs.writeFileSync(path.join(OUT, 'chat_answers.txt'), answers.map((x) => `Q: ${x.q}\nA: ${x.a}\n`).join('\n'));
  await page.screenshot({ path: path.join(OUT, 'chat_answers.png') });

  // upload Excel (2 file sekaligus) lewat input bawaan IDR
  await page.setInputFiles('input[data-idr-upload]', [
    path.join(ROOT, 'data', 'Assessment_RDDC.xlsx'),
    path.join(ROOT, 'data', 'Dictionary_Prompt_IDR_Assessment_RDDC.xlsx')
  ]);
  await page.waitForTimeout(2500);
  const status = await page.$eval('.idr-status', (e) => e.textContent);
  const total3 = await page.$eval('#k1a .kpi-value', (e) => e.textContent);
  check('upload .xlsx terbaca (status & total sama)', /Upload: Assessment_RDDC\.xlsx/.test(status) && total3 === total0, `${status} | ${total3}`);
  const sub = await page.$eval('#hdrSub', (e) => e.textContent);
  check('sub-teks header memuat periode & nama file', /Periode 1 Jan – 31 Des 2024/.test(sub) && /Assessment_RDDC\.xlsx/.test(sub), sub);

  // upload file rusak -> status error, data lama tetap
  const bad = path.join(OUT, 'rusak.xlsx');
  fs.writeFileSync(bad, 'bukan excel');
  await page.setInputFiles('input[data-idr-upload]', bad);
  await page.waitForTimeout(800);
  const status2 = await page.$eval('.idr-status', (e) => e.textContent);
  const total4 = await page.$eval('#k1a .kpi-value', (e) => e.textContent);
  check('upload file rusak → pesan error, data tetap', /Gagal/.test(status2) && total4 === total0, status2);
  fs.unlinkSync(bad);
  check('tanpa error konsol (interaksi)', errors.filter((e) => !/upload gagal|bukan \.xlsx|zip/i.test(e)).length === 0, errors.join(' || '));

  // mode gelap
  const dark = await browser.newPage({ viewport: { width: 1366, height: 768 }, colorScheme: 'dark', deviceScaleFactor: 1 });
  await dark.goto(HTML);
  await dark.waitForTimeout(800);
  await dark.screenshot({ path: path.join(OUT, 'dark_hal1.png') });
  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} cek lulus`);
  process.exit(failed.length ? 1 : 0);
})();
