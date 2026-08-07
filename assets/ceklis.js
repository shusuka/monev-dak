/* ═══════════════════════════════════════════════════════════════════════
   CEKLIS KESIAPAN PEMDA — tab di panel admin

   Menjelang laporan, pertanyaannya selalu sama: daerah mana yang sudah
   lengkap, dan siapa yang masih harus ditagih. Tabel nilai hanya menjawab
   sebagiannya — isinya per orang, dan hanya memuat daerah yang sudah
   mendaftar. Ceklis ini memakai 164 daerah penerima DAK pada
   assets/wilayah.js sebagai kerangka, sehingga daerah yang belum menyentuh
   aplikasi sama sekali tetap muncul sebagai baris kosong. Justru baris itu
   yang paling dicari saat menagih.

   Tiga kolom ceklisnya: pre test, post test, dan survei kepuasan. Satu
   daerah dihitung sudah bila ada satu peserta dari daerah itu yang
   mengisinya — yang dinilai kesiapan pemdanya, bukan orang per orang.
   Petugas PFID tidak ikut terhitung: mereka penyusun berita acara, bukan
   pemda yang dinilai.
   ═══════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const el   = s => document.querySelector(s);
const els  = s => Array.from(document.querySelectorAll(s));
const aman = s => String(s == null ? '' : s)
  .replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

/* Provinsi ikut dipakai sebagai kunci: "Solok" ada di Sumatera Barat dan
   "Semarang" di Jawa Tengah, tetapi nama yang sama bisa muncul di provinsi
   lain pada data lama. */
const kunci = (prov, kab) => slug(prov || '') + '|' + slug(kab || '');

const LABEL = {
  lengkap:  'Lengkap',
  sebagian: 'Sebagian',
  belum:    'Belum mengisi',
  kosong:   'Belum mendaftar'
};

let SARING = { prov: '', status: '', cari: '' };

/* Nomor render. Penghitung angka yang sedang menghitung naik harus berhenti
   sendiri begitu tabelnya digambar ulang, kalau tidak angkanya berebut. */
let PUTARAN = 0;


/* ═══════════════════════════════════════════════════════════════
   1. DATA — satu baris per daerah
   ═══════════════════════════════════════════════════════════════ */

/** Daerah penerima DAK sebagai kerangka, lalu ditempeli peserta dan survei. */
function susunDaerah() {
  const peta = new Map();

  const W = window.WILAYAH || {};
  Object.keys(W).forEach(prov => {
    String(W[prov] || '').split(',').filter(Boolean).forEach(kab => {
      peta.set(kunci(prov, kab), { prov, kab, luar: false, orang: [], pre: 0, post: 0, survei: 0 });
    });
  });

  /* Daerah yang tidak ada di daftar DAK tetap ditampung — akun lama yang
     mendaftar sewaktu daftar wilayahnya masih seluruh Indonesia. Ditandai
     `luar` supaya terpisah dan tidak mengacaukan persentase. */
  const tampung = (prov, kab) => {
    const k = kunci(prov, kab);
    let d = peta.get(k);
    if (!d) peta.set(k, d = { prov: prov || '—', kab: kab || '—', luar: true, orang: [], pre: 0, post: 0, survei: 0 });
    return d;
  };

  const pfid = g => !!(window.BA && window.BA.akunPfid(g));

  ((typeof ADATA !== 'undefined' && ADATA.gabung) || []).forEach(g => {
    if (pfid(g) || (!g.prov && !g.kab)) return;
    const d = tampung(g.prov, g.kab);
    d.orang.push(g);
    if (g.pre)  d.pre++;
    if (g.post) d.post++;
  });

  const rekap = (window.SURVEI && window.SURVEI.rekap) ? window.SURVEI.rekap() : [];
  rekap.forEach(r => {
    if (pfid(r) || (!r.prov && !r.kab)) return;
    tampung(r.prov, r.kab).survei++;
  });

  return Array.from(peta.values()).map(d => {
    const c = { pre: d.pre > 0, post: d.post > 0, survei: d.survei > 0 };
    const skor = (c.pre ? 1 : 0) + (c.post ? 1 : 0) + (c.survei ? 1 : 0);
    return { ...d, c, skor,
      status: skor === 3 ? 'lengkap' : skor > 0 ? 'sebagian' : d.orang.length ? 'belum' : 'kosong' };
  }).sort((a, b) =>
    Number(a.luar) - Number(b.luar) ||
    a.prov.localeCompare(b.prov, 'id') ||
    a.kab.localeCompare(b.kab, 'id'));
}

/** Baris yang lolos penyaring — dipakai bersama oleh tabel dan unduhan. */
function barisTampil(semua) {
  const q = norm(SARING.cari || '');
  return semua.filter(d =>
       (!SARING.prov   || d.prov === SARING.prov)
    && (!SARING.status || (SARING.status === 'luar' ? d.luar : (!d.luar && d.status === SARING.status)))
    && (!q || norm(d.kab + ' ' + d.prov + ' ' + d.orang.map(o => o.nama).join(' ')).includes(q)));
}

function hitungRingkas(semua) {
  const dak = semua.filter(d => !d.luar);
  const n = x => dak.filter(x).length;
  return {
    total:   dak.length,
    pre:     n(d => d.c.pre),
    post:    n(d => d.c.post),
    survei:  n(d => d.c.survei),
    lengkap: n(d => d.skor === 3),
    kosong:  n(d => d.status === 'kosong'),
    luar:    semua.length - dak.length
  };
}


/* ═══════════════════════════════════════════════════════════════
   2. GAMBAR — kerucut, centang, dan jalan yang dipadatkan
   ═══════════════════════════════════════════════════════════════ */

/* Ceklis yang sudah: lingkaran hijau dengan centang yang menggambar dirinya
   sendiri, berurutan dari baris atas ke bawah supaya terasa "dihitung". */
function tandaSudah(tunda) {
  return `<span class="ck-sudah" style="--tunda:${tunda}ms" title="Sudah">
    <span class="ck-denyut"></span>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <path class="ck-garis" d="M5 12.5l4.5 4.5L19 7.5"/>
    </svg>
  </span>`;
}

/* Ceklis yang belum: kerucut lalu lintas yang bergoyang pelan, dan jatuh
   miring kalau ditunjuk. Menandai pekerjaan yang belum selesai jauh lebih
   ramah ditagih daripada silang merah. */
function tandaBelum(tunda) {
  return `<span class="ck-belum" style="--tunda:${tunda}ms" title="Belum">
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M12 3.4l5.6 15.2H6.4z" fill="rgba(251,146,60,.92)"/>
      <path d="M9.1 11.2h5.8M8.1 14.4h7.8" stroke="rgba(255,255,255,.85)" stroke-width="1.6" stroke-linecap="round"/>
      <rect x="3.6" y="18.4" width="16.8" height="2.6" rx="1.3" fill="rgba(251,146,60,.75)"/>
    </svg>
  </span>`;
}

const sel = (ada, tunda) => ada ? tandaSudah(tunda) : tandaBelum(tunda);

/* Tandem roller sungguhan, dipotong dari foto yang dikirim user menjadi
   gambar berlatar transparan — assets/roller.webp, cara pembuatannya dicatat
   di README. Justru karena latarnya transparan ia tetap bisa berjalan ke
   titik persentase, hal yang tidak mungkin dilakukan foto utuh yang posisi
   rollernya sudah matang di satu tempat.

   Drumnya tidak lagi berputar seperti pada gambar SVG yang digantikannya —
   foto tidak bisa diputar per bagian. Sebagai gantinya seluruh mesin
   mengayun pelan, cukup untuk memberi kesan bekerja. */
function roller() {
  return `<img src="assets/roller.webp" alt="" class="ck-mesin-img" />`;
}

const GAYA = `
<style id="ckGaya">
  /* ── jalan progres ──
     Latarnya aspal sungguhan: satu ubin kecil yang dipotong dari foto roller
     (assets/aspal.webp, lihat catatan di bawah) lalu diulang mendatar. Ubinnya
     sudah dicerminkan sewaktu dibuat, jadi sambungannya tidak terlihat pada
     lebar layar berapa pun. Rollernya sendiri sengaja tidak ikut dipotong dari
     foto — yang berjalan mengikuti persentase tetap roller SVG di bawah ini,
     supaya tidak ada dua roller di satu layar. */
  .ck-jalan { position: relative; height: 150px; border-radius: 1.25rem; overflow: hidden;
              background: #14161a url("assets/aspal.webp") repeat-x center / auto 100%;
              border: 1px solid rgba(255,255,255,.1);
              box-shadow: inset 0 22px 34px -18px rgba(0,0,0,.85); }
  /* bagian yang sudah dipadatkan: aspalnya tetap terlihat, hanya bersemu hijau
     dan sedikit lebih terang — seperti lajur yang baru selesai dikerjakan */
  .ck-aspal { position: absolute; inset: 0 auto 0 0; width: 0; border-radius: inherit;
              background: linear-gradient(90deg, rgba(16,185,129,.34), rgba(52,211,153,.2));
              box-shadow: inset 0 0 46px rgba(16,185,129,.3), 1px 0 18px rgba(52,211,153,.45);
              transition: width 1.7s cubic-bezier(.22,1,.36,1); }
  /* marka yang bergeser terus, jadi jalannya terasa hidup */
  .ck-marka { position: absolute; left: 0; right: 0; top: 68%; height: 4px; margin-top: -2px;
              background: repeating-linear-gradient(90deg, rgba(255,255,255,.62) 0 34px, transparent 34px 78px);
              animation: ckMarka 1.9s linear infinite; opacity: .55; }
  .ck-mesin { position: absolute; bottom: 10px; left: 0; width: 132px; margin-left: -66px;
              filter: drop-shadow(0 12px 16px rgba(0,0,0,.6));
              transition: left 1.7s cubic-bezier(.22,1,.36,1); animation: ckBob 1.7s ease-in-out infinite; }
  .ck-mesin-img { display: block; width: 100%; height: auto; }
  .ck-kilau  { animation: ckKilau 2s ease-in-out infinite; }

  /* satu putaran = satu jarak antar marka, supaya sambungannya tak terlihat */
  @keyframes ckMarka  { to { background-position-x: -78px } }
  @keyframes ckBob    { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-2.5px) } }
  @keyframes ckKilau  { 0%,100% { opacity: .2; transform: scale(.7) } 50% { opacity: 1; transform: scale(1) } }

  /* ── tanda ceklis ── */
  .ck-sudah, .ck-belum { position: relative; display: inline-flex; height: 26px; width: 26px;
                         align-items: center; justify-content: center; }
  .ck-sudah { border-radius: 9999px; color: #05140d;
              background: linear-gradient(150deg, #6ee7b7, #10b981);
              box-shadow: 0 4px 14px rgba(16,185,129,.35);
              animation: ckPop .5s cubic-bezier(.34,1.56,.64,1) both; animation-delay: var(--tunda); }
  .ck-sudah svg { height: 15px; width: 15px; }
  .ck-garis { stroke-dasharray: 26; stroke-dashoffset: 26;
              animation: ckCentang .4s ease-out forwards; animation-delay: calc(var(--tunda) + .22s); }
  /* denyut sekali saat muncul — seperti stempel yang baru dibubuhkan */
  .ck-denyut { position: absolute; inset: 0; border-radius: 9999px; border: 2px solid rgba(52,211,153,.8);
               animation: ckDenyut .8s ease-out both; animation-delay: calc(var(--tunda) + .1s); }
  @keyframes ckPop     { 0% { transform: scale(.2); opacity: 0 } 60% { transform: scale(1.16) } 100% { transform: scale(1); opacity: 1 } }
  @keyframes ckCentang { to { stroke-dashoffset: 0 } }
  @keyframes ckDenyut  { 0% { transform: scale(.7); opacity: .7 } 100% { transform: scale(2.1); opacity: 0 } }

  .ck-belum svg { height: 21px; width: 21px; transform-origin: 50% 88%;
                  animation: ckGoyang 3.4s ease-in-out infinite; animation-delay: var(--tunda); }
  /* kerucutnya jatuh miring kalau ditunjuk; menagih boleh sambil tersenyum */
  .ck-belum:hover svg { animation: none; transform: rotate(-26deg) translateY(1px); transition: transform .35s cubic-bezier(.34,1.56,.64,1); }
  @keyframes ckGoyang { 0%,88%,100% { transform: rotate(0) } 92% { transform: rotate(-7deg) } 96% { transform: rotate(7deg) } }

  /* ── baris ── */
  .ck-baris { transition: background-color .2s ease, transform .2s ease; }
  .ck-baris:hover { background: rgba(255,255,255,.05); }
  .ck-lengkap { background: linear-gradient(90deg, rgba(16,185,129,.12), transparent 62%); }
  .ck-kosong td { opacity: .62; }

  @media (prefers-reduced-motion: reduce) {
    .ck-marka, .ck-mesin, .ck-kilau,
    .ck-sudah, .ck-garis, .ck-denyut, .ck-belum svg { animation: none; }
    .ck-aspal, .ck-mesin { transition: none; }
    .ck-garis { stroke-dashoffset: 0; }
    .ck-denyut { display: none; }
  }
</style>`;


/* ═══════════════════════════════════════════════════════════════
   3. TAMPILAN
   ═══════════════════════════════════════════════════════════════ */

/* Warnanya mengikuti tab ceklis, diwarisi dari --tab pada #adPanelCeklis —
   lihat .kartu-tab pada <style> di index.html. */
function kartu(label, angka, sub, warna) {
  return `<div class="kartu-tab rounded-3xl p-5">
    <p class="kartu-judul text-[11px] uppercase tracking-[0.14em]">${aman(label)}</p>
    <p class="mt-2.5 text-[28px] font-semibold tabular-nums ${warna || 'kartu-angka'}" data-naik="${angka}">${angka}</p>
    <p class="mt-1 text-[11px] text-white/50">${sub}</p>
  </div>`;
}

function lencana(status) {
  const w = {
    lengkap:  'bg-emerald-400/20 text-emerald-300',
    sebagian: 'bg-amber-400/20 text-amber-300',
    belum:    'bg-red-400/20 text-red-300',
    kosong:   'bg-white/10 text-white/55'
  }[status];
  return `<span class="whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${w}">${LABEL[status]}</span>`;
}

function kepalaProvinsi(prov, daftar, luar) {
  const dak = daftar.filter(d => !d.luar);
  const lengkap = dak.filter(d => d.skor === 3).length;
  const pct = dak.length ? Math.round(lengkap / dak.length * 100) : 0;
  return `<tr class="border-b border-white/10 bg-white/[.04]">
    <td colspan="7" class="px-5 py-3">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span class="text-[13px] font-semibold tracking-[-0.01em]">${aman(prov)}</span>
        ${luar
          ? '<span class="rounded-full bg-amber-400/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300">Di luar daftar DAK</span>'
          : `<span class="text-[12px] text-white/45">${lengkap} dari ${dak.length} daerah lengkap</span>
             <span class="ml-auto flex items-center gap-2">
               <span class="h-1.5 w-28 overflow-hidden rounded-full bg-white/10">
                 <span class="block h-full rounded-full bg-emerald-400/80" style="width:${pct}%"></span>
               </span>
               <span class="w-9 text-right text-[12px] tabular-nums text-white/55">${pct}%</span>
             </span>`}
      </div>
    </td>
  </tr>`;
}

function baris(d, i) {
  /* Ceklisnya muncul berurutan, tetapi tundanya dibatasi supaya baris paling
     bawah tidak menunggu setengah menit pada 164 daerah. */
  const tunda = Math.min(i * 26, 900);
  const orang = d.orang.length;
  return `<tr class="ck-baris border-b border-white/[.06] ${d.skor === 3 ? 'ck-lengkap' : ''} ${d.status === 'kosong' ? 'ck-kosong' : ''}">
    <td class="px-5 py-3 tabular-nums text-white/40">${i + 1}</td>
    <td class="px-5 py-3">
      <p class="font-medium">${aman(d.kab)}</p>
      <p class="text-[12px] text-white/40">${aman(d.prov)}</p>
    </td>
    <td class="px-5 py-3 text-center tabular-nums ${orang ? 'text-white/70' : 'text-white/30'}">${orang || '—'}</td>
    <td class="px-5 py-3 text-center">${sel(d.c.pre, tunda)}</td>
    <td class="px-5 py-3 text-center">${sel(d.c.post, tunda + 90)}</td>
    <td class="px-5 py-3 text-center">${sel(d.c.survei, tunda + 180)}</td>
    <td class="px-5 py-3">${lencana(d.status)}</td>
  </tr>`;
}

function gambar() {
  const wadah = el('#adCeklis');
  if (!wadah) return;

  const semua = susunDaerah();
  const r = hitungRingkas(semua);
  const rows = barisTampil(semua);
  const pct = r.total ? Math.round(r.lengkap / r.total * 100) : 0;

  /* provinsi untuk penyaring: dari kerangka, jadi urutannya tetap walau
     datanya masih kosong */
  const provs = Array.from(new Set(semua.map(d => d.prov))).sort((a, b) => a.localeCompare(b, 'id'));

  const kelompok = [];
  rows.forEach(d => {
    const akhir = kelompok[kelompok.length - 1];
    if (akhir && akhir.prov === d.prov && akhir.luar === d.luar) akhir.isi.push(d);
    else kelompok.push({ prov: d.prov, luar: d.luar, isi: [d] });
  });

  const galatSurvei = (window.SURVEI && window.SURVEI.galatRekap) ? window.SURVEI.galatRekap() : '';
  let nomor = 0;

  wadah.innerHTML = `${GAYA}

  <p class="mt-7 max-w-[760px] text-[14px] leading-[1.7] text-white/60">
    Kesiapan tiap pemerintah daerah penerima DAK Fisik Bidang Jalan dalam satu layar:
    pre test, post test, dan survei kepuasan. Satu daerah dihitung sudah bila ada satu
    pesertanya yang mengisi. Seluruh ${r.total} daerah penerima tampil di sini, termasuk
    yang belum mendaftar sama sekali — baris itulah yang perlu ditagih.
  </p>

  ${galatSurvei ? `<div class="mt-6 rounded-3xl border border-amber-400/40 bg-amber-400/10 p-5 text-[13px] leading-[1.7] text-amber-200/90">
    <p class="font-semibold text-amber-200">Kolom survei belum dapat dipercaya</p>
    <p class="mt-1.5">${aman(galatSurvei)}</p>
  </div>` : ''}

  <!-- jalan progres: roller berjalan sampai titik daerah yang sudah lengkap -->
  <div class="mt-7">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <p class="text-[13px] text-white/55">Daerah yang sudah lengkap tiga-tiganya</p>
      <p class="text-[13px] font-semibold tabular-nums text-emerald-300">${r.lengkap} / ${r.total} · ${pct}%</p>
    </div>
    <div class="ck-jalan mt-3">
      <div class="ck-aspal" data-lebar="${pct}"></div>
      <div class="ck-marka"></div>
      <svg viewBox="0 0 24 24" class="ck-kilau absolute right-4 top-3 h-4 w-4" fill="rgba(253,230,138,.9)">
        <path d="M12 2l2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2z"/>
      </svg>
      <div class="ck-mesin" data-maju="${pct}">${roller()}</div>
    </div>
  </div>

  <div class="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
    ${kartu('Daerah penerima DAK', r.total, r.luar ? 'kerangka ceklis · +' + r.luar + ' di luar daftar' : 'kerangka ceklis')}
    ${kartu('Sudah pre test', r.pre, r.total ? Math.round(r.pre / r.total * 100) + '% daerah' : '—', 'text-emerald-400')}
    ${kartu('Sudah post test', r.post, r.total ? Math.round(r.post / r.total * 100) + '% daerah' : '—', 'text-emerald-400')}
    ${kartu('Sudah survei', r.survei, r.total ? Math.round(r.survei / r.total * 100) + '% daerah' : '—', 'text-emerald-400')}
    ${kartu('Lengkap 3 ceklis', r.lengkap, 'pre + post + survei', 'text-emerald-400')}
    ${kartu('Belum mendaftar', r.kosong, 'belum ada akunnya', r.kosong ? 'text-red-400' : '')}
  </div>

  <div class="mt-8 flex flex-wrap items-center gap-3">
    <select id="ckProv" class="glass rounded-full px-5 py-2.5 text-[13px] font-medium text-white outline-none [&>option]:bg-ink">
      <option value="">Semua provinsi</option>
      ${provs.map(p => `<option value="${aman(p)}"${SARING.prov === p ? ' selected' : ''}>${aman(p)}</option>`).join('')}
    </select>
    <select id="ckStatus" class="glass rounded-full px-5 py-2.5 text-[13px] font-medium text-white outline-none [&>option]:bg-ink">
      <option value="">Semua status</option>
      <option value="lengkap">Lengkap (3 ceklis)</option>
      <option value="sebagian">Sebagian (1–2 ceklis)</option>
      <option value="belum">Terdaftar, belum mengisi</option>
      <option value="kosong">Belum mendaftar</option>
      ${r.luar ? `<option value="luar">Di luar daftar DAK (${r.luar})</option>` : ''}
    </select>
    <div class="glass flex items-center gap-2 rounded-full px-5 py-2.5">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" class="h-4 w-4 text-white/50"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input id="ckCari" value="${aman(SARING.cari)}" placeholder="Cari daerah atau nama peserta" class="w-52 bg-transparent text-[13px] outline-none placeholder:text-white/40" />
    </div>
    <div class="ml-auto flex flex-wrap gap-2">
      ${r.luar ? `<button id="ckBersih" class="rounded-full border border-red-400/50 bg-red-500/15 px-5 py-2.5 text-[13px] font-medium text-red-200 transition hover:bg-red-500/25">
        Hapus ${r.luar} daerah di luar daftar</button>` : ''}
      <button id="ckCsv" class="rounded-full border border-white/20 px-5 py-2.5 text-[13px] font-medium text-white/85 transition hover:bg-white/10">Unduh CSV</button>
      <button id="ckXls" class="cta-glow rounded-full bg-white px-5 py-2.5 text-[13px] font-medium text-black">Unduh Excel</button>
    </div>
  </div>

  <div class="glass mt-6 overflow-hidden rounded-3xl">
    <div class="overflow-x-auto">
      <table class="w-full min-w-[820px] text-left text-[14px]">
        <thead class="border-b border-white/10 text-[11px] uppercase tracking-[0.14em] text-white/45">
          <tr>
            <th class="px-5 py-4 font-semibold">#</th>
            <th class="px-5 py-4 font-semibold">Kabupaten/Kota</th>
            <th class="px-5 py-4 text-center font-semibold">Peserta</th>
            <th class="px-5 py-4 text-center font-semibold">Pre Test</th>
            <th class="px-5 py-4 text-center font-semibold">Post Test</th>
            <th class="px-5 py-4 text-center font-semibold">Survei</th>
            <th class="px-5 py-4 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows.length
            ? kelompok.map(k => kepalaProvinsi(k.prov, k.isi, k.luar) + k.isi.map(d => baris(d, nomor++)).join('')).join('')
            : '<tr><td colspan="7" class="px-5 py-12 text-center text-white/50">Tidak ada daerah yang cocok dengan penyaring.</td></tr>'}
        </tbody>
      </table>
    </div>
    <p class="border-t border-white/10 px-5 py-4 text-[12px] leading-[1.7] text-white/40">
      Menampilkan ${rows.length} baris dari ${r.total} daerah penerima DAK${r.luar ? ' ditambah ' + r.luar + ' daerah di luar daftar' : ''}.
      Tombol unduh mengikuti penyaring yang sedang aktif.<br>
      Kolom Peserta adalah jumlah akun terdaftar dari daerah itu; ceklis menyala bila salah satunya sudah mengisi.
      ${r.luar ? 'Daerah di luar daftar berasal dari pendaftaran sewaktu daftar wilayahnya masih seluruh Indonesia. '
               + 'Seluruh persentase, kartu ringkasan, dan jalan progres di atas hanya menghitung ' + r.total + ' daerah penerima — '
               + 'pilih “Di luar daftar DAK” pada penyaring status untuk melihat yang ' + r.luar + ' itu.' : ''}
    </p>
  </div>`;

  /* Angka di samping nama tab ikut disegarkan di sini, bukan hanya sewaktu
     data admin dimuat — impor Google Formulir pun mengubahnya. */
  const tanda = el('#adTabCeklisJml');
  if (tanda) tanda.textContent = r.total ? ' · ' + r.lengkap + '/' + r.total : '';

  pasang();
  hidupkan(pct);
}

/** Angka kartu naik dari nol, dan roller berjalan ke tempatnya.

    Semua yang bergerak di sini hanya hiasan, jadi tidak boleh ada angka atau
    panjang jalan yang bergantung padanya. Nilai akhirnya sudah tercetak di
    markah; animasinya yang mundur ke nol lebih dulu, lalu maju lagi. Dengan
    begitu tab yang sedang di latar belakang — requestAnimationFrame berhenti
    di sana — tetap menampilkan angka yang benar. */
function hidupkan(pct) {
  const putaran = ++PUTARAN;
  const lama = 850;
  const diam = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* setTimeout, bukan requestAnimationFrame: jedanya cuma perlu memisahkan
     lebar awal dari lebar tujuan agar transisi CSS-nya jalan, dan setTimeout
     tetap berdetak walau tabnya tidak sedang digambar. */
  setTimeout(() => {
    if (putaran !== PUTARAN) return;
    const jalan = el('.ck-aspal'), mesin = el('.ck-mesin');
    if (jalan) jalan.style.width = pct + '%';
    if (mesin) mesin.style.left  = pct + '%';
  }, 60);

  if (diam) return;

  els('#adCeklis [data-naik]').forEach(node => {
    const akhir = Number(node.dataset.naik) || 0;
    if (!akhir) return;
    const mulai = performance.now();
    node.textContent = '0';
    const langkah = t => {
      if (putaran !== PUTARAN || !document.body.contains(node)) return;
      const p = Math.min((t - mulai) / lama, 1);
      node.textContent = Math.round(akhir * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(langkah);
    };
    requestAnimationFrame(langkah);
    /* jaring pengaman bila animasinya tidak pernah berjalan */
    setTimeout(() => {
      if (putaran === PUTARAN && document.body.contains(node)) node.textContent = akhir;
    }, lama + 300);
  });
}

function pasang() {
  const ulang = () => gambar();
  el('#ckProv').onchange   = e => { SARING.prov = e.target.value; ulang(); };
  el('#ckStatus').onchange = e => { SARING.status = e.target.value; ulang(); };
  el('#ckStatus').value    = SARING.status;

  /* Kotak cari tidak ikut digambar ulang seluruhnya supaya kursor tidak
     melompat; hanya tabelnya yang perlu menyesuaikan. */
  const cari = el('#ckCari');
  let jeda = null;
  cari.oninput = e => {
    SARING.cari = e.target.value;
    clearTimeout(jeda);
    jeda = setTimeout(() => { gambar(); const c = el('#ckCari'); if (c) { c.focus(); c.setSelectionRange(c.value.length, c.value.length); } }, 220);
  };

  el('#ckCsv').onclick = () => unduhCsv();
  el('#ckXls').onclick = () => unduhExcel();

  const bersih = el('#ckBersih');
  if (bersih) bersih.onclick = () => bersihkanLuar();
}


/* ═══════════════════════════════════════════════════════════════
   3b. MEMBERSIHKAN DAERAH DI LUAR DAFTAR DAK

   Sisa pendaftaran sewaktu daftar wilayahnya masih seluruh Indonesia.
   Membersihkannya dari tab ini, bukan dari tabel nilai, karena hanya di
   sini daerah-daerah itu terkumpul jadi satu — di tabel nilai mereka
   berserak dan harus dicari satu per satu.

   Yang dibuang sekaligus: nilai pre/post, profil peserta, dan penilaian
   surveinya. Kalau surveinya ditinggal, daerahnya tetap muncul di ceklis
   lewat penilaian itu saja.
   ═══════════════════════════════════════════════════════════════ */
async function bersihkanLuar() {
  const luar = susunDaerah().filter(d => d.luar);
  if (!luar.length) return;

  const rekap = (window.SURVEI && window.SURVEI.rekap) ? window.SURVEI.rekap() : [];
  const kunciLuar = new Set(luar.map(d => kunci(d.prov, d.kab)));
  const survei = rekap.filter(x => kunciLuar.has(kunci(x.prov, x.kab)));
  const orang = luar.flatMap(d => d.orang);
  const bernilai = orang.filter(o => o.pre || o.post).length;

  const rincian = luar.map(d => '• ' + d.kab + ', ' + d.prov + ' — '
    + (d.orang.length ? d.orang.map(o => o.nama).join(', ') : 'tanpa akun peserta')).join('\n');

  if (!confirm(
    'Hapus ' + luar.length + ' daerah di luar daftar penerima DAK?\n\n' + rincian +
    '\n\nYang dibuang: ' + orang.length + ' profil peserta'
    + (bernilai ? ' (' + bernilai + ' di antaranya sudah punya nilai pre/post)' : '')
    + (survei.length ? ' dan ' + survei.length + ' penilaian survei' : '') + '.' +
    '\n\nNilainya hilang dari papan peringkat dan seluruh rekap, dan TIDAK dapat dipulihkan.' +
    '\n\nAkun masuknya tetap ada di Firebase Authentication dan harus dihapus terpisah dari Console. ' +
    'Selama belum dihapus, orangnya masih bisa masuk dan akan menemui pesan bahwa identitas pesertanya sudah terhapus.'
  )) return;

  const tombol = el('#ckBersih');
  if (tombol) { tombol.disabled = true; tombol.textContent = 'Menghapus…'; }

  const gagal = [];
  let sukses = 0;

  for (const o of orang) {
    try { await store.hapusPeserta(o.pid); sukses++; }
    catch (e) { console.error('[MonevDAK] peserta gagal dihapus', o.pid, e); gagal.push({ nama: o.nama, kode: (e && e.code) || e.message }); }
  }
  for (const s of survei) {
    try { await window.SURVEI.hapus(s.id); }
    catch (e) { console.error('[MonevDAK] survei gagal dihapus', s.id, e); gagal.push({ nama: (s.kab || s.nama) + ' (survei)', kode: (e && e.code) || e.message }); }
  }

  /* Seluruh panel dimuat ulang: tabel nilai, rekap survei, dan ceklis
     membaca sumber yang sama, jadi ketiganya harus ikut menyusut. */
  if (typeof muatAdmin === 'function') await muatAdmin(false);
  else gambar();

  if (!gagal.length) {
    toast(sukses + ' peserta dan ' + survei.length + ' penilaian dari luar daftar DAK dihapus.');
  } else {
    const izin = gagal.some(x => /permission/.test(String(x.kode)));
    alert(
      sukses + ' peserta dihapus, ' + gagal.length + ' gagal.\n\n' +
      gagal.slice(0, 6).map(x => '• ' + x.nama + ' (' + x.kode + ')').join('\n') +
      (izin ? '\n\nFirestore menolak penghapusan. Publikasikan ulang firestore.rules versi terbaru dan pastikan email admin ini terdaftar pada adminEmail().' : '')
    );
  }
}


/* ═══════════════════════════════════════════════════════════════
   4. UNDUHAN — bahan laporan
   ═══════════════════════════════════════════════════════════════ */

const YA = ada => ada ? 'Sudah' : 'Belum';

function barisUnduh() {
  return barisTampil(susunDaerah()).map((d, i) => ({
    'No': i + 1,
    'Provinsi': d.prov,
    'Kabupaten/Kota': d.kab,
    'Daftar DAK': d.luar ? 'Di luar daftar' : 'Ya',
    'Peserta Terdaftar': d.orang.length,
    'Pre Test': YA(d.c.pre),
    'Post Test': YA(d.c.post),
    'Survei Kepuasan': YA(d.c.survei),
    'Kelengkapan': d.skor + '/3',
    'Status': LABEL[d.status],
    'Sudah Pre': d.pre,
    'Sudah Post': d.post,
    'Sudah Survei': d.survei,
    'Nama Peserta': d.orang.map(o => o.nama).join('; ')
  }));
}

function namaBerkasCeklis(ext) {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `ceklis-pemda-tw${TW_AKTIF}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.${ext}`;
}

function unduhCsv() {
  const rows = barisUnduh();
  if (!rows.length) return toast('Tidak ada baris untuk diunduh.');
  const head = Object.keys(rows[0]);
  const kutip = v => { const s = v == null ? '' : String(v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const csv = [head.join(','), ...rows.map(r => head.map(k => kutip(r[k])).join(','))].join('\r\n');
  unduh('﻿' + csv, namaBerkasCeklis('csv'), 'text/csv;charset=utf-8');   // BOM agar Excel membaca UTF-8
  toast(rows.length + ' daerah diunduh sebagai CSV.');
}

/* Sama seperti ekspor rekap nilai: Excel dibentuk dari tabel HTML, bukan CSV,
   supaya kolomnya tidak bergantung pada pengaturan pemisah daftar di
   masing-masing komputer. */
function unduhExcel() {
  const rows = barisUnduh();
  if (!rows.length) return toast('Tidak ada baris untuk diunduh.');
  const head = Object.keys(rows[0]);
  const r = hitungRingkas(susunDaerah());
  const warna = v => v === 'Sudah' ? ' style="background:#d9f2e5;font-weight:bold"'
               : v === 'Belum'     ? ' style="background:#fde7d9"' : '';

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8"><style>
td,th{border:1px solid #999;padding:4px 7px;font-family:Calibri,sans-serif;font-size:11pt}
th{background:#e8eef7;font-weight:bold}
</style></head>
<body>
<h3>Ceklis Kesiapan Pemda — MonevDAK Triwulan ${TW_META[TW_AKTIF].rom}</h3>
<p>Diunduh ${aman(tglStr(Date.now()))} · ${rows.length} daerah ditampilkan</p>
<p>${r.lengkap} dari ${r.total} daerah penerima DAK sudah lengkap (pre test, post test, dan survei kepuasan).
Sudah pre test ${r.pre}, sudah post test ${r.post}, sudah survei ${r.survei}, belum mendaftar ${r.kosong}.</p>
<table><thead><tr>${head.map(h => `<th>${aman(h)}</th>`).join('')}</tr></thead>
<tbody>${rows.map(x => `<tr>${head.map(k => {
    const v = x[k] == null ? '' : x[k];
    return `<td${warna(v)}>${aman(v)}</td>`;
  }).join('')}</tr>`).join('')}</tbody></table>
</body></html>`;

  unduh(html, namaBerkasCeklis('xls'), 'application/vnd.ms-excel');
  toast(rows.length + ' daerah diunduh sebagai Excel.');
}


/* ═══════════════════════════════════════════════════════════════
   5. TITIK MASUK
   ═══════════════════════════════════════════════════════════════ */
window.CEKLIS = {
  render() { gambar(); },

  /** Jumlah daerah yang sudah lengkap, untuk angka kecil di samping nama tab. */
  jumlahLengkap() {
    const r = hitungRingkas(susunDaerah());
    return r.total ? r.lengkap + '/' + r.total : null;
  },

  reset() {
    SARING = { prov: '', status: '', cari: '' };
    const w = el('#adCeklis');
    if (w) w.innerHTML = '';
  }
};

})();
