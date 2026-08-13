/* ═══════════════════════════════════════════════════════════════════════
   PETA SEBARAN BERITA ACARA — panel admin, tab Berita Acara

   Arsip berita acara memuat seluruh pemda penerima DAK di Indonesia, dan
   daftar kartu sepanjang ratusan baris tidak menjawab pertanyaan yang biasa
   ditanyakan pimpinan: daerah mana yang tertinggal, dan di mana letaknya.
   Peta ini menjawabnya dalam satu layar — tiap kabupaten/kota diwarnai
   menurut progresnya, diklik untuk melihat ringkasan fisik, keuangan, jumlah
   paket, dan anggarannya, lalu ditelusuri sampai ke berita acaranya.

   Batas wilayahnya ada di assets/peta-geo.js (sumber: assai-id/nemesis).
   Berkas ini hanya menggambar; angkanya disiapkan assets/berita-acara.js
   dan dikirim lewat window.PETA_DAK.render().
   ═══════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const aman = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const NS = 'http://www.w3.org/2000/svg';

/* Batas wilayahnya hampir 300 KB dan hanya dibutuhkan admin di satu tab.
   Karena itu berkasnya baru diambil saat petanya benar-benar digambar —
   pemda yang membuka aplikasi dari ponsel tidak ikut menanggung unduhannya. */
const GEO_URL = 'assets/peta-geo.js';
let janjiGeo = null;

function muatGeo() {
  if (window.PETA_GEO) return Promise.resolve();
  if (janjiGeo) return janjiGeo;
  janjiGeo = new Promise((selesai, gagal) => {
    const s = document.createElement('script');
    s.src = GEO_URL;
    s.onload = () => (window.PETA_GEO ? selesai() : gagal(new Error('isi peta kosong')));
    s.onerror = () => { janjiGeo = null; gagal(new Error('berkas peta tidak terambil')); };
    document.head.appendChild(s);
  });
  return janjiGeo;
}

/* ── skala warna ──────────────────────────────────────────────────
   Merah → jingga → kuning → hijau. Urutan warna ini sudah dipakai di
   seluruh aplikasi untuk arti "tertinggal → aman", jadi pembacanya tidak
   perlu belajar sandi baru. Warnanya dipilih yang cukup terang untuk latar
   gelap; nilai di antara dua patokan dicampur agar gradasinya mulus. */
const SKALA = [
  [0,   [244,  63,  94]],   // rose-500
  [30,  [251, 146,  60]],   // orange-400
  [55,  [250, 204,  21]],   // yellow-400
  [80,  [163, 230,  53]],   // lime-400
  [100, [ 16, 185, 129]]    // emerald-500
];

function warna(v) {
  const n = Math.max(0, Math.min(100, Number(v) || 0));
  for (let i = 1; i < SKALA.length; i++) {
    if (n > SKALA[i][0] && i < SKALA.length - 1) continue;
    const [a, ca] = SKALA[i - 1], [b, cb] = SKALA[i];
    const t = b === a ? 0 : (n - a) / (b - a);
    return `rgb(${ca.map((c, j) => Math.round(c + (cb[j] - c) * t)).join(',')})`;
  }
  return 'rgb(16,185,129)';
}

const KOSONG      = 'rgba(255,255,255,.05)';   // daerah tanpa berita acara
const KOSONG_TEPI = 'rgba(255,255,255,.16)';

/* ── angka ────────────────────────────────────────────────────────
   Isian berita acara ditulis petugas mengikuti kebiasaan Indonesia:
   koma sebagai desimal, titik sebagai pemisah ribuan. */
const persen = t => {
  const s = String(t == null ? '' : t).replace(/%/g, '').replace(/\./g, '').replace(/,/g, '.').trim();
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null;
};

const rupiah = t => {
  const s = String(t == null ? '' : t).replace(/[^\d.,]/g, '').split(',')[0].replace(/\./g, '');
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
};

const rata = xs => {
  const a = xs.filter(x => x != null);
  return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
};

const angkaId = (n, desimal) =>
  Number(n).toLocaleString('id-ID', { minimumFractionDigits: desimal || 0, maximumFractionDigits: desimal || 0 });

const teksPersen = v => (v == null ? '—' : angkaId(v, v % 1 ? 2 : 0) + '%');

/** Rupiah ringkas: pimpinan membaca "Rp 14,29 M", bukan sebelas angka. */
function teksRupiah(n, penuh) {
  if (n == null) return '—';
  if (penuh) return 'Rp ' + angkaId(n);
  if (n >= 1e12) return 'Rp ' + angkaId(n / 1e12, 2) + ' T';
  if (n >= 1e9)  return 'Rp ' + angkaId(n / 1e9, 2) + ' M';
  if (n >= 1e6)  return 'Rp ' + angkaId(n / 1e6, 1) + ' Jt';
  return 'Rp ' + angkaId(n);
}


/* ═══════════════════════════════════════════════════════════════
   KEADAAN
   ═══════════════════════════════════════════════════════════════ */
let METRIK  = 'fisik';    // fisik · keuangan
let PILIH   = '';         // kunci daerah yang sedang dibuka
let DATA    = new Map();  // kunci → ringkasan daerah
let DETAIL  = null;       // penangan tombol "lihat berita acara"
let SVG     = null;
let BENTUK  = new Map();  // kunci → { path, titik }
let DASAR   = null;       // viewBox awal
let VB      = null;       // viewBox sekarang
let WADAH   = null;

const METRIK_LABEL = { fisik: 'Progres fisik', keuangan: 'Progres keuangan' };


/* ═══════════════════════════════════════════════════════════════
   GAMBAR PETA
   ═══════════════════════════════════════════════════════════════ */
const nilai = r => (r ? (METRIK === 'fisik' ? r.fisik : r.keuangan) : null);

function isiWarna(kunci) {
  const r = DATA.get(kunci);
  const v = nilai(r);
  return v == null ? KOSONG : warna(v);
}

/** Warnai ulang seluruh daerah — dipanggil saat metrik atau data berganti,
    tanpa menggambar ulang peta sehingga perbesaran tidak ikut kembali. */
function warnai() {
  BENTUK.forEach((b, kunci) => {
    const r = DATA.get(kunci);
    const v = nilai(r);
    const isi = v == null ? KOSONG : warna(v);
    const dipilih = kunci === PILIH;
    b.path.setAttribute('fill', isi);
    b.path.setAttribute('fill-opacity', v == null ? '1' : '.88');
    b.path.setAttribute('stroke', dipilih ? '#ffffff' : (v == null ? KOSONG_TEPI : 'rgba(0,0,0,.45)'));
    b.path.setAttribute('stroke-width', dipilih ? '1.6' : '.35');
    if (b.titik) {
      b.titik.setAttribute('fill', isi);
      b.titik.setAttribute('stroke', dipilih ? '#ffffff' : 'rgba(0,0,0,.55)');
      b.titik.setAttribute('stroke-width', dipilih ? '1.2' : '.5');
    }
  });
}

function gambarPeta(kotak) {
  const geo = window.PETA_GEO;
  DASAR = geo.viewBox.split(' ').map(Number);
  VB = DASAR.slice();

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', geo.viewBox);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('class', 'block h-full w-full touch-none select-none');
  svg.style.cursor = 'grab';

  /* Latar: garis 38 provinsi, termasuk provinsi tanpa penerima DAK. Tanpa
     latar ini kabupaten penerima tampak melayang tanpa bentuk Indonesia. */
  const latar = document.createElementNS(NS, 'g');
  latar.setAttribute('fill', 'rgba(255,255,255,.035)');
  latar.setAttribute('stroke', 'rgba(255,255,255,.13)');
  latar.setAttribute('stroke-width', '.35');
  latar.setAttribute('stroke-linejoin', 'round');
  latar.setAttribute('pointer-events', 'none');
  geo.provinsi.forEach(p => {
    const el = document.createElementNS(NS, 'path');
    el.setAttribute('d', p.d);
    latar.appendChild(el);
  });
  svg.appendChild(latar);

  const lapis = document.createElementNS(NS, 'g');
  lapis.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(lapis);

  const penanda = document.createElementNS(NS, 'g');
  svg.appendChild(penanda);

  const label = document.createElementNS(NS, 'g');
  label.setAttribute('id', 'petaLabel');
  label.setAttribute('pointer-events', 'none');
  svg.appendChild(label);

  BENTUK = new Map();
  geo.daerah.forEach(d => {
    const el = document.createElementNS(NS, 'path');
    el.setAttribute('d', d.d);
    el.setAttribute('class', 'peta-daerah');
    el.dataset.kunci = d.k;
    lapis.appendChild(el);
    BENTUK.set(d.k, { path: el, titik: null, geo: d });
  });

  kotak.innerHTML = '';
  kotak.appendChild(svg);
  SVG = svg;

  /* Daerah kepulauan kecil — Wakatobi, Anambas, Sitaro, Nias — hanya beberapa
     piksel pada peta seluruh Indonesia, praktis mustahil dilihat apalagi
     diklik. Untuk itu dipasang bulatan di titik wakilnya, jadi daerahnya
     tetap terbaca warnanya dan tetap bisa dibuka. */
  BENTUK.forEach((b, kunci) => {
    let kecil = !!b.geo.s;      // ditandai saat peta dibangun: wilayahnya mungil
    if (!kecil) {
      try {
        const k = b.path.getBBox();
        kecil = Math.max(k.width, k.height) < 7;
      } catch (e) { kecil = true; /* peta belum terpasang; beri penanda, aman */ }
    }
    if (!kecil) return;
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', b.geo.x);
    c.setAttribute('cy', b.geo.y);
    c.setAttribute('r', '3.2');
    c.setAttribute('class', 'peta-daerah');
    c.dataset.kunci = kunci;
    penanda.appendChild(c);
    b.titik = c;
  });

  pasangInteraksi(svg, kotak);
  warnai();
  gambarLabel();
}

/** Nama daerah baru ditulis saat peta cukup diperbesar; pada tampilan
    seluruh Indonesia tulisannya akan bertumpuk dan tidak terbaca. */
function gambarLabel() {
  if (!SVG) return;
  const g = SVG.querySelector('#petaLabel');
  if (!g) return;
  g.innerHTML = '';
  if (VB[2] > 320) return;

  const ukuran = Math.max(2.4, VB[2] / 90);
  let jumlah = 0;
  BENTUK.forEach((b, kunci) => {
    if (jumlah >= 45) return;
    const { x, y } = b.geo;
    if (x < VB[0] || x > VB[0] + VB[2] || y < VB[1] || y > VB[1] + VB[3]) return;
    jumlah++;
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', x);
    t.setAttribute('y', y - (b.titik ? 4.5 : 0.5));
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('font-size', ukuran);
    t.setAttribute('fill', kunci === PILIH ? '#ffffff' : 'rgba(255,255,255,.82)');
    t.setAttribute('stroke', 'rgba(0,0,0,.75)');
    t.setAttribute('stroke-width', ukuran / 7);
    t.setAttribute('paint-order', 'stroke');
    t.setAttribute('font-weight', '600');
    t.textContent = b.geo.n;
    g.appendChild(t);
  });
}

function terapkanVB() {
  const b = DASAR;
  VB[2] = Math.max(38, Math.min(b[2], VB[2]));
  VB[3] = VB[2] * b[3] / b[2];
  VB[0] = Math.max(b[0] - VB[2] * .2, Math.min(b[0] + b[2] - VB[2] * .8, VB[0]));
  VB[1] = Math.max(b[1] - VB[3] * .2, Math.min(b[1] + b[3] - VB[3] * .8, VB[1]));
  SVG.setAttribute('viewBox', VB.join(' '));
  gambarLabel();
}

/** Perbesar dengan titik jangkar tetap di tempatnya (0–1 relatif viewBox). */
function zum(faktor, rx, ry) {
  const lebarBaru = Math.max(38, Math.min(DASAR[2], VB[2] * faktor));
  const nyata = lebarBaru / VB[2];
  VB[0] += (VB[2] - VB[2] * nyata) * (rx == null ? .5 : rx);
  VB[1] += (VB[3] - VB[3] * nyata) * (ry == null ? .5 : ry);
  VB[2] = lebarBaru;
  terapkanVB();
}

/** Bawa satu daerah ke tengah layar, cukup dekat untuk terbaca. */
function sorot(kunci) {
  const b = BENTUK.get(kunci);
  if (!b) return;
  let lebar = 150;
  try {
    const k = b.path.getBBox();
    lebar = Math.max(60, Math.max(k.width, k.height * DASAR[2] / DASAR[3]) * 3.2);
  } catch (e) { /* pakai bawaan */ }
  VB[2] = Math.min(DASAR[2], lebar);
  VB[3] = VB[2] * DASAR[3] / DASAR[2];
  VB[0] = b.geo.x - VB[2] / 2;
  VB[1] = b.geo.y - VB[3] / 2;
  terapkanVB();
}

function pasangInteraksi(svg, kotak) {
  const petunjuk = kotak.parentElement.querySelector('[data-peta-tip]');

  const titikRelatif = e => {
    const r = svg.getBoundingClientRect();
    return { rx: (e.clientX - r.left) / r.width, ry: (e.clientY - r.top) / r.height };
  };

  svg.addEventListener('wheel', e => {
    e.preventDefault();
    const { rx, ry } = titikRelatif(e);
    zum(e.deltaY > 0 ? 1.18 : 1 / 1.18, rx, ry);
  }, { passive: false });

  let seret = null;
  svg.addEventListener('pointerdown', e => {
    seret = { x: e.clientX, y: e.clientY, vb: VB.slice(), geser: false };
    try { svg.setPointerCapture(e.pointerId); } catch (err) { /* penunjuk tanpa id */ }
    svg.style.cursor = 'grabbing';
  });

  svg.addEventListener('pointermove', e => {
    if (seret) {
      const r = svg.getBoundingClientRect();
      const dx = (e.clientX - seret.x) * VB[2] / r.width;
      const dy = (e.clientY - seret.y) * VB[3] / r.height;
      if (Math.abs(e.clientX - seret.x) + Math.abs(e.clientY - seret.y) > 4) seret.geser = true;
      VB[0] = seret.vb[0] - dx;
      VB[1] = seret.vb[1] - dy;
      terapkanVB();
      return;
    }
    if (!petunjuk) return;
    const sasaran = e.target.closest ? e.target.closest('.peta-daerah') : null;
    if (!sasaran) { petunjuk.classList.add('hidden'); return; }
    const kunci = sasaran.dataset.kunci;
    const b = BENTUK.get(kunci);
    const r = DATA.get(kunci);
    const kotakR = kotak.getBoundingClientRect();
    petunjuk.innerHTML = `
      <p class="text-[12px] font-semibold text-white">${aman(b ? b.geo.n : '')}</p>
      <p class="text-[10.5px] text-white/55">${aman(b ? b.geo.p : '')}</p>
      ${r ? `<p class="mt-1 text-[11px] text-white/80">Fisik <span class="font-semibold tabular-nums">${teksPersen(r.fisik)}</span> · Keuangan <span class="font-semibold tabular-nums">${teksPersen(r.keuangan)}</span></p>`
          : '<p class="mt-1 text-[11px] text-white/45">Belum ada berita acara</p>'}`;
    petunjuk.classList.remove('hidden');
    const lebar = petunjuk.offsetWidth || 160;
    petunjuk.style.left = Math.max(4, Math.min(kotakR.width - lebar - 4, e.clientX - kotakR.left + 14)) + 'px';
    petunjuk.style.top  = Math.max(4, e.clientY - kotakR.top - 10) + 'px';
  });

  const lepas = e => {
    if (!seret) return;
    const geser = seret.geser;
    seret = null;
    svg.style.cursor = 'grab';
    if (geser) return;
    const sasaran = e.target.closest ? e.target.closest('.peta-daerah') : null;
    pilihDaerah(sasaran ? sasaran.dataset.kunci : '');
  };
  svg.addEventListener('pointerup', lepas);
  svg.addEventListener('pointercancel', () => { seret = null; svg.style.cursor = 'grab'; });
  svg.addEventListener('pointerleave', () => { if (petunjuk) petunjuk.classList.add('hidden'); });
}


/* ═══════════════════════════════════════════════════════════════
   PANEL KETERANGAN
   ═══════════════════════════════════════════════════════════════ */
function pilihDaerah(kunci) {
  PILIH = kunci || '';
  warnai();
  gambarLabel();
  renderInfo();
  if (PILIH) {
    const p = WADAH && WADAH.querySelector('#petaInfo');
    if (p && window.innerWidth < 1024) p.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

const barisAngka = (judul, isi, kelas) => `
  <div class="rounded-2xl bg-white/[.05] px-3.5 py-2.5">
    <p class="text-[10.5px] uppercase tracking-[0.12em] text-white/45">${judul}</p>
    <p class="mt-1 text-[17px] font-semibold tabular-nums ${kelas || ''}">${isi}</p>
  </div>`;

function batangProgres(label, v) {
  const n = v == null ? 0 : v;
  return `
    <div>
      <div class="flex items-baseline justify-between gap-2">
        <span class="text-[11.5px] text-white/60">${label}</span>
        <span class="text-[13px] font-semibold tabular-nums" style="color:${v == null ? 'rgba(255,255,255,.4)' : warna(n)}">${teksPersen(v)}</span>
      </div>
      <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div class="h-full rounded-full" style="width:${n}%;background:${warna(n)}"></div>
      </div>
    </div>`;
}

function renderInfo() {
  const kotak = WADAH && WADAH.querySelector('#petaInfo');
  if (!kotak) return;

  if (!PILIH) {
    kotak.innerHTML = `
      <div class="glass flex h-full flex-col justify-center rounded-3xl px-5 py-6">
        <p class="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/45">Keterangan</p>
        <p class="mt-3 text-[13px] leading-[1.7] text-white/60">
          Warna tiap kabupaten/kota menunjukkan ${METRIK_LABEL[METRIK].toLowerCase()} pada berita acara terakhirnya.
          Klik satu daerah untuk melihat ringkasan progres, jumlah paket, dan anggarannya.
        </p>
        <div class="mt-5 space-y-2">
          <div class="h-2.5 rounded-full" style="background:linear-gradient(90deg,${SKALA.map(([p, c]) => `rgb(${c.join(',')}) ${p}%`).join(',')})"></div>
          <div class="flex justify-between text-[10.5px] tabular-nums text-white/45"><span>0%</span><span>50%</span><span>100%</span></div>
          <p class="flex items-center gap-2 pt-1 text-[11px] text-white/45">
            <span class="inline-block h-2.5 w-4 rounded-sm" style="background:${KOSONG};box-shadow:inset 0 0 0 1px ${KOSONG_TEPI}"></span>
            Belum ada berita acara
          </p>
        </div>
        <p class="mt-5 text-[11px] leading-[1.6] text-white/35">
          Gulir untuk memperbesar, seret untuk menggeser. Daerah kepulauan kecil ditandai bulatan.
        </p>
      </div>`;
    return;
  }

  const b = BENTUK.get(PILIH);
  const r = DATA.get(PILIH);
  const nama = b ? b.geo.n : PILIH;
  const prov = b ? b.geo.p : '';

  if (!r) {
    kotak.innerHTML = `
      <div class="glass flex h-full flex-col rounded-3xl px-5 py-6">
        <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">${aman(prov)}</p>
        <h3 class="mt-1.5 text-[19px] font-semibold">${aman(nama)}</h3>
        <p class="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/[.08] px-4 py-3 text-[12.5px] leading-[1.6] text-amber-100/80">
          Belum ada berita acara rapat pemantauan dan evaluasi untuk daerah ini.
        </p>
        <button data-peta-tutup class="mt-auto self-start pt-4 text-[12px] font-medium text-white/50 underline decoration-white/25 underline-offset-4 hover:text-white">Tutup</button>
      </div>`;
    pasangTombolInfo();
    return;
  }

  const sisa = r.riwayat.length - 1;
  kotak.innerHTML = `
    <div class="glass flex h-full flex-col rounded-3xl px-5 py-6">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">${aman(prov)}</p>
          <h3 class="mt-1.5 text-[19px] font-semibold leading-tight">${aman(nama)}</h3>
          <p class="mt-1 text-[11.5px] text-white/45">Rapat ${aman(r.tanggalTeks || '—')}${r.penyusun ? ' · ' + aman(r.penyusun) : ''}</p>
        </div>
        <button data-peta-tutup aria-label="Tutup" class="-mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-white/45 transition hover:bg-white/10 hover:text-white">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="h-4 w-4"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>

      <div class="mt-5 space-y-3.5">
        ${batangProgres('Progres fisik', r.fisik)}
        ${batangProgres('Progres keuangan', r.keuangan)}
      </div>

      <div class="mt-4 grid grid-cols-2 gap-2.5">
        ${barisAngka('Jumlah paket', r.paket ? angkaId(r.paket) + ' <span class="text-[12px] font-medium text-white/45">ruas</span>' : '—')}
        ${barisAngka('Pagu anggaran', teksRupiah(r.anggaran))}
      </div>
      ${r.realisasi != null ? `<p class="mt-2 text-[11.5px] text-white/45">Realisasi kontrak ${aman(teksRupiah(r.realisasi))}${r.anggaran ? ' · ' + teksPersen(r.realisasi / r.anggaran * 100) + ' dari pagu' : ''}</p>` : ''}
      ${r.anggaran != null ? `<p class="mt-1 text-[11px] text-white/35">Nilai kontrak seluruh ruas: ${aman(teksRupiah(r.anggaran, true))}</p>` : ''}

      <div class="mt-5 flex flex-wrap gap-2">
        <button data-peta-detail="${aman(r.id)}" class="cta-glow rounded-full bg-white px-4 py-2 text-[12.5px] font-medium text-black">Lihat berita acara</button>
        <button data-peta-unduh="${aman(r.id)}" class="rounded-full border border-white/20 px-4 py-2 text-[12.5px] font-medium text-white/80 transition hover:bg-white/10">Unduh Word</button>
      </div>

      ${sisa > 0 ? `
      <div class="mt-4 border-t border-white/10 pt-3">
        <p class="text-[11px] uppercase tracking-[0.12em] text-white/40">${sisa} berita acara lain</p>
        <div class="mt-2 space-y-1">
          ${r.riwayat.slice(1).map(x => `
            <button data-peta-detail="${aman(x.id)}" class="flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-1.5 text-left text-[12px] text-white/60 transition hover:bg-white/10 hover:text-white">
              <span class="truncate">${aman(x.tanggalTeks || x.tanggalIso || '—')}</span>
              <span class="shrink-0 text-[11px] text-white/35">${aman(x.penyusun || '')}</span>
            </button>`).join('')}
        </div>
      </div>` : ''}
    </div>`;
  pasangTombolInfo();
}

function pasangTombolInfo() {
  const kotak = WADAH && WADAH.querySelector('#petaInfo');
  if (!kotak) return;
  const t = kotak.querySelector('[data-peta-tutup]');
  if (t) t.onclick = () => pilihDaerah('');
  kotak.querySelectorAll('[data-peta-detail]').forEach(b => {
    b.onclick = () => DETAIL && DETAIL.lihat(b.dataset.petaDetail);
  });
  kotak.querySelectorAll('[data-peta-unduh]').forEach(b => {
    b.onclick = async () => {
      const semula = b.textContent;
      b.disabled = true; b.textContent = 'Menyusun…';
      try { await (DETAIL && DETAIL.unduh(b.dataset.petaUnduh)); }
      finally { b.disabled = false; b.textContent = semula; }
    };
  });
}


/* ═══════════════════════════════════════════════════════════════
   KERANGKA
   ═══════════════════════════════════════════════════════════════ */
function kartuRingkas() {
  const semua = Array.from(DATA.values());
  const total = (window.PETA_GEO && window.PETA_GEO.daerah.length) || 0;
  const fisik = rata(semua.map(r => r.fisik));
  const keuangan = rata(semua.map(r => r.keuangan));
  const paket = semua.reduce((s, r) => s + (r.paket || 0), 0);
  const anggaran = semua.reduce((s, r) => s + (r.anggaran || 0), 0);

  const kartu = (judul, isi, catatan) => `
    <div class="kartu-tab rounded-3xl px-5 py-4">
      <p class="kartu-judul text-[11px] font-semibold uppercase tracking-[0.14em]">${judul}</p>
      <p class="kartu-angka mt-2 text-[24px] font-semibold tabular-nums leading-none">${isi}</p>
      <p class="mt-1.5 text-[11px] text-white/40">${catatan}</p>
    </div>`;

  return `
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      ${kartu('Daerah terlapor', angkaId(semua.length), (total ? angkaId(total) : '—') + ' penerima DAK')}
      ${kartu('Rata-rata fisik', teksPersen(fisik), 'seluruh daerah terlapor')}
      ${kartu('Rata-rata keuangan', teksPersen(keuangan), 'seluruh daerah terlapor')}
      ${kartu('Jumlah paket', angkaId(paket), 'ruas jalan &amp; jembatan')}
      ${kartu('Nilai kontrak', teksRupiah(anggaran), 'akumulasi seluruh ruas')}
    </div>`;
}

function kerangka() {
  const tombolMetrik = (k, label) => `
    <button data-peta-metrik="${k}" class="rounded-full px-3.5 py-1.5 text-[12px] font-medium transition ${
      METRIK === k ? 'bg-white text-black' : 'text-white/65 hover:bg-white/10'}">${label}</button>`;

  const tombolZum = (aksi, ikon, judul) => `
    <button data-peta-zum="${aksi}" title="${judul}" aria-label="${judul}"
            class="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white/70 backdrop-blur-md transition hover:bg-white/15 hover:text-white">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">${ikon}</svg>
    </button>`;

  return `
    <h2 class="mt-9 text-[20px] font-semibold tracking-[-0.01em]">Sebaran progres DAK Fisik Bidang Jalan</h2>
    <p class="mt-2 max-w-[760px] text-[14px] leading-[1.7] text-white/60">
      Setiap kabupaten/kota penerima DAK diwarnai menurut progres pada berita acara terakhirnya —
      merah untuk yang paling tertinggal, hijau untuk yang hampir tuntas. Klik satu daerah untuk
      melihat progres fisik, keuangan, jumlah paket, dan anggarannya, lalu buka berita acaranya.
    </p>

    <div class="mt-6">${kartuRingkas()}</div>

    <div class="mt-5 flex flex-wrap items-center gap-3">
      <div class="glass flex items-center gap-1 rounded-full p-1">
        ${tombolMetrik('fisik', 'Progres fisik')}
        ${tombolMetrik('keuangan', 'Progres keuangan')}
      </div>
      <p class="text-[12px] text-white/40">Warna peta mengikuti pilihan ini.</p>
    </div>

    <div class="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
      <div class="glass relative overflow-hidden rounded-3xl">
        <div id="petaKanvas" class="h-[340px] w-full sm:h-[420px] lg:h-[520px]"></div>
        <div data-peta-tip class="pointer-events-none absolute hidden max-w-[210px] rounded-xl border border-white/15 bg-black/85 px-3 py-2 shadow-xl backdrop-blur-md"></div>
        <div class="absolute right-3 top-3 flex flex-col gap-1.5">
          ${tombolZum('in', '<path d="M12 5v14M5 12h14"/>', 'Perbesar')}
          ${tombolZum('out', '<path d="M5 12h14"/>', 'Perkecil')}
          ${tombolZum('reset', '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>', 'Kembali ke seluruh Indonesia')}
        </div>
        <div class="pointer-events-none absolute bottom-3 left-4 flex items-center gap-2 text-[10.5px] text-white/35">
          <span class="h-1.5 w-16 rounded-full" style="background:linear-gradient(90deg,${SKALA.map(([p, c]) => `rgb(${c.join(',')}) ${p}%`).join(',')})"></span>
          <span>0% → 100% ${aman(METRIK_LABEL[METRIK].toLowerCase())}</span>
        </div>
      </div>
      <div id="petaInfo" class="min-h-[220px]"></div>
    </div>`;
}


/* ═══════════════════════════════════════════════════════════════
   TITIK MASUK
   ═══════════════════════════════════════════════════════════════ */
window.PETA_DAK = {
  /** Ubah satu berita acara arsip menjadi angka peta. Dipakai juga oleh
      pemanggilnya untuk menyusun peringkat, jadi diletakkan di sini agar
      cara menghitungnya cuma ada satu. */
  ringkas(r) {
    const d = (r && r.data) || {};
    const progres = Array.isArray(d.progres) ? d.progres : [];
    const nilaiKontrak = progres.map(p => rupiah(p.nilaiKontrak));
    const realisasi = progres.map(p => rupiah(p.realisasiKontrak));
    const adaNilai = nilaiKontrak.some(x => x != null);
    const adaReal = realisasi.some(x => x != null);
    return {
      id: r.id,
      fisik: persen(d.fisikRata) != null ? persen(d.fisikRata) : rata(progres.map(p => persen(p.fisik))),
      keuangan: persen(d.keuanganRata) != null ? persen(d.keuanganRata) : rata(progres.map(p => persen(p.keuangan))),
      paket: progres.length || r.jumlahRuas || 0,
      anggaran: adaNilai ? nilaiKontrak.reduce((s, x) => s + (x || 0), 0) : null,
      realisasi: adaReal ? realisasi.reduce((s, x) => s + (x || 0), 0) : null
    };
  },

  /** Gambar petanya.
      `rekaman` — arsip berita acara, urut dari yang terbaru.
      `kunciDari` — cara mengambil kunci daerah dari satu rekaman.
      `aksi` — { lihat(id), unduh(id) } untuk tombol pada panel keterangan. */
  async render(wadah, { rekaman, kunciDari, aksi }) {
    if (!wadah) return;
    if (!window.PETA_GEO) {
      wadah.innerHTML = `<div class="glass mt-9 flex h-[220px] items-center justify-center rounded-3xl text-[13px] text-white/45">Memuat peta wilayah…</div>`;
    }
    try {
      await muatGeo();
    } catch (e) {
      wadah.innerHTML = `<div class="mt-9 rounded-2xl border border-amber-400/30 bg-amber-400/[.08] px-5 py-4 text-[13px] text-amber-100/80">
        Peta wilayah tidak termuat (${aman(e.message)}). Daftar berita acara di bawah tetap dapat dipakai.</div>`;
      return;
    }

    /* Satu daerah bisa punya beberapa berita acara. Yang terbaru dipakai
       untuk mewarnai peta; sisanya tetap dapat dibuka dari panel. */
    DATA = new Map();
    (rekaman || []).forEach(r => {
      const kunci = kunciDari(r);
      if (!kunci) return;
      const ringkas = { tanggalTeks: r.tanggalTeks, tanggalIso: r.tanggalIso, penyusun: r.penyusun, id: r.id };
      const lama = DATA.get(kunci);
      if (lama) { lama.riwayat.push(ringkas); return; }
      DATA.set(kunci, Object.assign(window.PETA_DAK.ringkas(r), ringkas, { riwayat: [ringkas] }));
    });

    DETAIL = aksi;
    WADAH = wadah;
    if (PILIH && !BENTUK.has(PILIH)) PILIH = '';
    wadah.innerHTML = kerangka();

    gambarPeta(wadah.querySelector('#petaKanvas'));
    renderInfo();
    pasangTombolKerangka(wadah);
  },

  /** Buka satu daerah dari luar peta, mis. dari kartu daftar di bawahnya. */
  buka(kunci) {
    if (!BENTUK.has(kunci)) return false;
    sorot(kunci);
    pilihDaerah(kunci);
    const k = WADAH && WADAH.querySelector('#petaKanvas');
    if (k) k.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return true;
  }
};

/** Tombol yang harus dipasang ulang tiap kerangka digambar ulang. */
function pasangTombolKerangka(wadah) {
  wadah.querySelectorAll('[data-peta-metrik]').forEach(b => b.onclick = () => {
    METRIK = b.dataset.petaMetrik;
    const vb = VB.slice(), pilih = PILIH;
    wadah.innerHTML = kerangka();
    gambarPeta(wadah.querySelector('#petaKanvas'));
    VB = vb; PILIH = pilih;
    terapkanVB(); warnai(); renderInfo();
    pasangTombolKerangka(wadah);
  });
  wadah.querySelectorAll('[data-peta-zum]').forEach(b => b.onclick = () => {
    const a = b.dataset.petaZum;
    if (a === 'reset') { VB = DASAR.slice(); terapkanVB(); return; }
    zum(a === 'in' ? 1 / 1.5 : 1.5);
  });
}

})();
