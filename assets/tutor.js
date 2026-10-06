/* ═══════════════════════════════════════════════════════════════════════
   PANDUAN PEMDA — TRIWULAN III

   Pemda menjalankan tiga misi berurutan:
     1. Pre test
     2. Konfirmasi data ruas  (terkunci sampai pre test selesai)
     3. Post test             (diajak setelah konfirmasi terkirim)

   Isinya:
     - Tur bergaya tutorial game saat akun pemda pertama kali dibuka di
       TW III: elemen yang dimaksud disorot, dan "Mas Bima", petugas
       lapangan, menjelaskannya satu per satu. Langkah terakhir meminta
       pemda mengklik sendiri kartu yang bersinar.
     - Kartu "Misi TW III" di dashboard.
     - Notifikasi bergambar setelah tiap misi selesai.
   Tanda "sudah dilihat" disimpan per akun di localStorage peramban.
   ═══════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const NAMA = 'Mas Bima';
const PERAN = 'Petugas lapangan';
const LS = pid => 'monevdak_tutor_tw3_' + pid;

const akun = () => (typeof ME !== 'undefined' && ME) ? ME : null;
const pemda = () => !!akun() && !(typeof pfid === 'function' && pfid());
const sudah = k => typeof hasilSaya === 'function' && !!hasilSaya(k);
const amanT = s => String(s == null ? '' : s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sapaan = () => { const n = String((akun() || {}).nama || '').trim().split(/\s+/)[0]; return n || 'Bapak/Ibu'; };

function bendera() {
  const m = akun(); if (!m) return {};
  try { return JSON.parse(localStorage.getItem(LS(m.pid))) || {}; } catch (e) { return {}; }
}
function tandai(k) {
  const m = akun(); if (!m) return;
  const b = bendera(); b[k] = Date.now();
  try { localStorage.setItem(LS(m.pid), JSON.stringify(b)); } catch (e) {}
}

/* Status konfirmasi terakhir dari KONF.ringkasSaya(): null berarti daerah
   ini tidak punya ruas di kertas kerja, sehingga misinya dilewati. */
let NKONF;
const adaKonf = () => !!NKONF && NKONF.total > 0;
const konfBeres = () => !adaKonf() || (NKONF.dikirim + NKONF.verif === NKONF.total && !NKONF.kembali);


/* ═══════════════════════════════════════════════════════════════
   1. KARAKTER — petugas lapangan berhelm proyek dan rompi reflektif.
   Volume "3D" dari gradasi radial dan bayangan; geraknya CSS:
   melayang, berkedip, melambai, bicara, melompat.
   ═══════════════════════════════════════════════════════════════ */
let NO_SVG = 0;
function avatar(mood, ukuran) {
  const u = 'tv' + (++NO_SVG);   // id gradasi unik per gambar
  return `<div class="tutor-ava tutor-ava--${mood || 'halo'}" style="width:${ukuran || 120}px">
  <svg viewBox="0 0 200 262" aria-hidden="true">
    <defs>
      <radialGradient id="${u}k" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#ffe2c4"/><stop offset=".6" stop-color="#f4b98d"/><stop offset="1" stop-color="#d98f63"/></radialGradient>
      <radialGradient id="${u}h" cx="35%" cy="25%" r="80%"><stop offset="0" stop-color="#fff59d"/><stop offset=".45" stop-color="#facc15"/><stop offset="1" stop-color="#b45309"/></radialGradient>
      <linearGradient id="${u}r" x1="0" x2="1"><stop offset="0" stop-color="#c2410c"/><stop offset=".35" stop-color="#fb923c"/><stop offset=".65" stop-color="#f97316"/><stop offset="1" stop-color="#9a3412"/></linearGradient>
      <linearGradient id="${u}b" x1="0" x2="1"><stop offset="0" stop-color="#1e2a4f"/><stop offset=".45" stop-color="#3b4f8c"/><stop offset="1" stop-color="#18213f"/></linearGradient>
      <linearGradient id="${u}c" x1="0" x2="1"><stop offset="0" stop-color="#1f2937"/><stop offset=".5" stop-color="#475569"/><stop offset="1" stop-color="#111827"/></linearGradient>
      <linearGradient id="${u}s" x1="0" x2="1"><stop offset="0" stop-color="#cbd5e1"/><stop offset=".5" stop-color="#ffffff"/><stop offset="1" stop-color="#94a3b8"/></linearGradient>
      <linearGradient id="${u}p" y1="0" y2="1"><stop offset="0" stop-color="#92400e"/><stop offset="1" stop-color="#451a03"/></linearGradient>
    </defs>
    <ellipse class="tutor-ava__bayang" cx="100" cy="252" rx="50" ry="7" fill="rgba(0,0,0,.4)"/>
    <g class="tutor-ava__tubuh">
      <!-- kaki & sepatu bot -->
      <rect x="78" y="178" width="21" height="58" rx="9" fill="url(#${u}c)"/>
      <rect x="101" y="178" width="21" height="58" rx="9" fill="url(#${u}c)"/>
      <path d="M72 238 q0-12 14-12 h12 v16 h-22 q-4 0-4-4z" fill="url(#${u}p)"/>
      <path d="M128 238 q0-12 -14-12 h-12 v16 h22 q4 0 4-4z" fill="url(#${u}p)"/>
      <!-- lengan kiri + papan klip -->
      <g class="tutor-ava__kiri">
        <rect x="47" y="118" width="19" height="54" rx="9.5" fill="url(#${u}b)"/>
        <rect x="34" y="146" width="32" height="40" rx="4" fill="#7c4a1e"/>
        <rect x="37" y="152" width="26" height="31" rx="2" fill="#f8fafc"/>
        <path d="M41 160h18M41 166h14M41 172h17M41 178h10" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
        <rect x="44" y="143" width="12" height="7" rx="2" fill="#9ca3af"/>
        <circle cx="62" cy="170" r="9" fill="url(#${u}k)"/>
      </g>
      <!-- badan: kemeja + rompi reflektif -->
      <rect x="62" y="110" width="76" height="80" rx="26" fill="url(#${u}b)"/>
      <path d="M64 132 q0-20 22-20 h6 l8 24 l8-24 h6 q22 0 22 20 v40 q0 18-20 18 h-32 q-20 0-20-18z" fill="url(#${u}r)"/>
      <rect x="64" y="150" width="72" height="7" fill="url(#${u}s)" opacity=".95"/>
      <rect x="64" y="166" width="72" height="7" fill="url(#${u}s)" opacity=".95"/>
      <path d="M100 138 v50" stroke="#9a3412" stroke-width="2"/>
      <rect x="110" y="128" width="16" height="12" rx="3" fill="#ea580c" stroke="#9a3412" stroke-width="1.5"/>
      <!-- leher & kepala -->
      <rect x="91" y="98" width="18" height="18" rx="6" fill="#d98f63"/>
      <g class="tutor-ava__kepala">
        <circle cx="67" cy="82" r="7.5" fill="#e9a77b"/>
        <circle cx="133" cy="82" r="7.5" fill="#e9a77b"/>
        <circle cx="100" cy="78" r="33" fill="url(#${u}k)"/>
        <path d="M70 70 q-2 14 3 22 M130 70 q2 14 -3 22" stroke="#4a2c14" stroke-width="5" stroke-linecap="round" fill="none"/>
        <path d="M81 69 q7-5 14 0 M105 69 q7-5 14 0" stroke="#4a2c14" stroke-width="3.2" stroke-linecap="round" fill="none"/>
        <g class="tutor-ava__mata">
          <ellipse cx="88" cy="80" rx="4.4" ry="5.4" fill="#1f2937"/><ellipse cx="112" cy="80" rx="4.4" ry="5.4" fill="#1f2937"/>
          <circle cx="89.6" cy="78" r="1.6" fill="#fff"/><circle cx="113.6" cy="78" r="1.6" fill="#fff"/>
        </g>
        <ellipse cx="79" cy="92" rx="6.5" ry="3.6" fill="#fb7185" opacity=".45"/>
        <ellipse cx="121" cy="92" rx="6.5" ry="3.6" fill="#fb7185" opacity=".45"/>
        <ellipse cx="100" cy="88" rx="3.4" ry="2.6" fill="#d98a5c"/>
        <path class="tutor-ava__mulut" d="M89 95 Q100 108 111 95 Q100 100 89 95Z" fill="#7f1d1d"/>
        <!-- helm proyek -->
        <path d="M64 66 C62 30 138 30 136 66 Z" fill="url(#${u}h)"/>
        <rect x="95" y="36" width="10" height="30" rx="5" fill="#fde047" opacity=".9"/>
        <ellipse cx="100" cy="66" rx="44" ry="7.5" fill="#ca8a04"/>
        <ellipse cx="100" cy="64.5" rx="44" ry="5" fill="#eab308"/>
        <ellipse cx="82" cy="46" rx="9" ry="4.5" fill="#fff" opacity=".55" transform="rotate(-28 82 46)"/>
        <circle cx="118" cy="52" r="5" fill="#2563eb" stroke="#fff" stroke-width="1.5"/>
      </g>
      <!-- lengan kanan (melambai / menunjuk) -->
      <g class="tutor-ava__kanan">
        <rect x="134" y="118" width="19" height="52" rx="9.5" fill="url(#${u}b)"/>
        <circle cx="143.5" cy="170" r="9.5" fill="url(#${u}k)"/>
      </g>
    </g>
  </svg></div>`;
}


/* ═══════════════════════════════════════════════════════════════
   2. GAYA
   ═══════════════════════════════════════════════════════════════ */
const CSS = `
.tutor-ava { position: relative; flex-shrink: 0; filter: drop-shadow(0 14px 20px rgba(0,0,0,.45)); }
.tutor-ava svg { display: block; width: 100%; height: auto; overflow: visible; }
.tutor-ava__tubuh { animation: tvMelayang 2.6s ease-in-out infinite; transform-box: view-box; transform-origin: 100px 250px; }
.tutor-ava__bayang { animation: tvBayang 2.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
.tutor-ava__mata { animation: tvKedip 4.2s infinite; transform-box: fill-box; transform-origin: center; }
.tutor-ava__kepala { animation: tvAngguk 5s ease-in-out infinite; transform-box: view-box; transform-origin: 100px 110px; }
.tutor-ava__kanan { transform-box: view-box; transform-origin: 143px 124px; transition: transform .45s cubic-bezier(.34,1.56,.64,1); }
.tutor-ava__kiri { transform-box: view-box; transform-origin: 56px 124px; }
.tutor-ava__mulut { transform-box: fill-box; transform-origin: 50% 20%; }
.tutor-ava--halo .tutor-ava__kanan { animation: tvLambai 1.1s ease-in-out infinite; }
.tutor-ava--tunjuk .tutor-ava__kanan { transform: rotate(-112deg); animation: tvTunjuk 1.4s ease-in-out infinite; }
.tutor-ava--senang .tutor-ava__tubuh { animation: tvLompat .9s cubic-bezier(.3,0,.3,1) infinite; }
.tutor-ava--senang .tutor-ava__bayang { animation: tvBayangLompat .9s cubic-bezier(.3,0,.3,1) infinite; }
.tutor-ava--senang .tutor-ava__kanan { animation: tvSorak .45s ease-in-out infinite alternate; }
.tutor-ava--senang .tutor-ava__kiri { animation: tvSorakKiri .45s ease-in-out infinite alternate; }
.tutor-ava--pikir .tutor-ava__kanan { transform: rotate(-150deg) translate(18px, 6px); }
.tutor-ava--pikir .tutor-ava__kepala { animation: tvMiring 3s ease-in-out infinite; }
.tutor-ava.bicara .tutor-ava__mulut { animation: tvBicara .18s ease-in-out infinite alternate; }
@keyframes tvMelayang { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
@keyframes tvBayang { 0%,100% { transform: scaleX(1); opacity: .4; } 50% { transform: scaleX(.86); opacity: .28; } }
@keyframes tvLompat { 0%,100% { transform: translateY(0) scaleY(1); } 15% { transform: translateY(0) scale(1.05,.93); } 50% { transform: translateY(-26px) scaleY(1.03); } 85% { transform: translateY(0) scale(1.04,.95); } }
@keyframes tvBayangLompat { 0%,100% { transform: scaleX(1); opacity: .45; } 50% { transform: scaleX(.6); opacity: .15; } }
@keyframes tvKedip { 0%,92%,100% { transform: scaleY(1); } 95% { transform: scaleY(.1); } }
@keyframes tvAngguk { 0%,100% { transform: rotate(0); } 25% { transform: rotate(-3deg); } 75% { transform: rotate(3deg); } }
@keyframes tvMiring { 0%,100% { transform: rotate(-6deg); } 50% { transform: rotate(-2deg); } }
@keyframes tvLambai { 0%,100% { transform: rotate(-150deg); } 50% { transform: rotate(-175deg); } }
@keyframes tvTunjuk { 0%,100% { transform: rotate(-112deg); } 50% { transform: rotate(-104deg) translateX(3px); } }
@keyframes tvSorak { from { transform: rotate(-160deg); } to { transform: rotate(-178deg); } }
@keyframes tvSorakKiri { from { transform: rotate(150deg); } to { transform: rotate(168deg); } }
@keyframes tvBicara { from { transform: scaleY(.35); } to { transform: scaleY(1.15); } }

.tutor { position: fixed; inset: 0; z-index: 90; }
.tutor-tirai { position: absolute; inset: 0; cursor: default; }
.tutor--polos .tutor-tirai { background: rgba(3,4,6,.66); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); animation: tvMuncul .3s ease; }
.tutor-sorot { position: fixed; pointer-events: none; border-radius: 22px; box-shadow: 0 0 0 9999px rgba(3,4,6,.72);
  transition: left .45s cubic-bezier(.22,.61,.36,1), top .45s cubic-bezier(.22,.61,.36,1), width .45s cubic-bezier(.22,.61,.36,1), height .45s cubic-bezier(.22,.61,.36,1); }
.tutor-sorot::after { content: ''; position: absolute; inset: -4px; border-radius: inherit; border: 2.5px solid #facc15; animation: tvCincin 1.4s ease-out infinite; }
.tutor-sorot.klik::after { border-color: #34d399; }
.tutor--polos .tutor-sorot, .tutor--polos .tutor-panah { display: none; }
@keyframes tvCincin { 0% { box-shadow: 0 0 0 0 rgba(250,204,21,.6); opacity: 1; } 100% { box-shadow: 0 0 0 18px rgba(250,204,21,0); opacity: .7; } }
.tutor-panah { position: fixed; pointer-events: none; z-index: 2; display: flex; flex-direction: column; align-items: center; gap: 2px;
  transition: left .45s cubic-bezier(.22,.61,.36,1), top .45s cubic-bezier(.22,.61,.36,1); }
.tutor-panah__ikon { animation: tvPantul .8s ease-in-out infinite alternate; filter: drop-shadow(0 4px 8px rgba(0,0,0,.6)); font-size: 30px; line-height: 1; }
.tutor-panah__teks { white-space: nowrap; border-radius: 9999px; background: #facc15; color: #1c1300; font-size: 11px; font-weight: 800; padding: .2rem .6rem; letter-spacing: .04em; }
.tutor-panah.bawah { flex-direction: column-reverse; }
.tutor-panah.bawah .tutor-panah__ikon { transform: rotate(180deg); animation-name: tvPantulBawah; }
@keyframes tvPantul { from { transform: translateY(-4px); } to { transform: translateY(6px); } }
@keyframes tvPantulBawah { from { transform: rotate(180deg) translateY(-4px); } to { transform: rotate(180deg) translateY(6px); } }

.tutor-panel { position: fixed; left: 50%; bottom: 18px; z-index: 3; display: flex; align-items: flex-end; gap: .25rem;
  width: min(680px, calc(100vw - 24px)); transform: translateX(-50%); animation: tvPanel .5s cubic-bezier(.34,1.56,.64,1); }
@media (max-width: 767px) { .tutor-panel { bottom: 76px; } }
@keyframes tvPanel { from { opacity: 0; transform: translate(-50%, 40px) scale(.95); } to { opacity: 1; transform: translate(-50%, 0); } }
@keyframes tvMuncul { from { opacity: 0; } to { opacity: 1; } }
.tutor-gelembung { position: relative; flex: 1; min-width: 0; margin-bottom: 18px; border-radius: 1.4rem; padding: 1rem 1.15rem .95rem;
  color: #0f172a; background: linear-gradient(180deg, #ffffff, #f1f5f9); box-shadow: 0 24px 60px rgba(0,0,0,.55), inset 0 -3px 0 rgba(15,23,42,.08); }
.tutor-gelembung::before { content: ''; position: absolute; left: -9px; bottom: 34px; width: 20px; height: 20px; background: #f4f6f9; transform: rotate(45deg); border-radius: 3px; }
.tutor-gelembung.goyang { animation: tvGoyang .45s ease; }
@keyframes tvGoyang { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-7px); } 40% { transform: translateX(7px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } }
.tutor-nama { display: inline-flex; align-items: center; gap: .4rem; font-size: 10.5px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: #c2410c; }
.tutor-langkah { margin-left: auto; font-size: 11px; font-weight: 700; color: #64748b; }
.tutor-judul { margin-top: .3rem; font-size: 17px; font-weight: 800; line-height: 1.3; letter-spacing: -.01em; }
.tutor-teks { margin-top: .35rem; min-height: 3.2em; font-size: 13.5px; line-height: 1.6; color: #334155; }
.tutor-teks .kursor { display: inline-block; width: 2px; height: 1em; margin-left: 1px; vertical-align: -2px; background: #f97316; animation: tvKursor .7s steps(1) infinite; }
@keyframes tvKursor { 50% { opacity: 0; } }
.tutor-kaki { margin-top: .8rem; display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; }
.tutor-titik { display: flex; gap: 5px; margin-right: auto; }
.tutor-titik span { height: 7px; width: 7px; border-radius: 9999px; background: #cbd5e1; transition: width .3s ease, background .3s ease; }
.tutor-titik span.on { width: 20px; background: #f97316; }
.tutor-tombol { min-height: 38px; border-radius: 9999px; padding: 0 1.1rem; font-size: 13px; font-weight: 700; transition: transform .15s ease, background .2s ease; }
.tutor-tombol:active { transform: scale(.95); }
.tutor-tombol--utama { color: #fff; background: linear-gradient(180deg, #fb923c, #ea580c); box-shadow: 0 6px 16px rgba(234,88,12,.45), inset 0 -3px 0 rgba(0,0,0,.15); }
.tutor-tombol--utama:hover { background: linear-gradient(180deg, #fdba74, #f97316); }
.tutor-tombol--lain { color: #475569; }
.tutor-tombol--lain:hover { background: #e2e8f0; }
@media (max-width: 520px) { .tutor-panel .tutor-ava { width: 84px !important; } .tutor-judul { font-size: 15.5px; } .tutor-teks { font-size: 13px; } }

.tutor-konfeti { position: fixed; inset: 0; z-index: 95; pointer-events: none; overflow: hidden; }
.tutor-konfeti i { position: absolute; top: -20px; width: 9px; height: 14px; border-radius: 2px; animation: tvJatuh linear forwards; }
@keyframes tvJatuh { to { transform: translateY(110vh) rotate(720deg); } }

/* kartu misi di dashboard */
.misi { position: relative; overflow: hidden; border-radius: 1.6rem; border: 1px solid rgba(251,146,60,.35);
  background: radial-gradient(120% 140% at 0% 0%, rgba(251,146,60,.22), rgba(251,146,60,.04) 45%, rgba(255,255,255,.03)); }
.misi-langkah { position: relative; display: flex; align-items: center; gap: .8rem; border-radius: 1.1rem; padding: .75rem .9rem;
  background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); transition: transform .2s ease, background .2s ease; }
.misi-langkah.aktif { background: rgba(251,146,60,.14); border-color: rgba(251,146,60,.55); box-shadow: 0 10px 30px -12px rgba(249,115,22,.7); }
.misi-langkah.aktif::after { content: ''; position: absolute; inset: -1px; border-radius: inherit; border: 1.5px solid rgba(251,146,60,.7); animation: tvCincinMisi 1.8s ease-out infinite; pointer-events: none; }
@keyframes tvCincinMisi { 0% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(1.04); } }
.misi-langkah.kunci { opacity: .55; }
.misi-nomor { display: flex; height: 2.2rem; width: 2.2rem; flex-shrink: 0; align-items: center; justify-content: center; border-radius: 9999px;
  font-size: 14px; font-weight: 800; color: #fff; background: rgba(255,255,255,.12); }
.misi-langkah.aktif .misi-nomor { background: linear-gradient(180deg, #fb923c, #ea580c); }
.misi-langkah.beres .misi-nomor { background: #10b981; }
.misi-bar { height: 6px; border-radius: 9999px; background: rgba(255,255,255,.1); overflow: hidden; }
.misi-bar > div { height: 100%; border-radius: inherit; background: linear-gradient(90deg, #fb923c, #facc15, #34d399); transition: width .8s cubic-bezier(.22,.61,.36,1); }
.misi-gelembung { position: relative; border-radius: 1rem; background: #fff; color: #0f172a; padding: .55rem .8rem; font-size: 12.5px; font-weight: 600; line-height: 1.45; }
.misi-gelembung::before { content: ''; position: absolute; left: -6px; top: 50%; width: 12px; height: 12px; margin-top: -6px; background: #fff; transform: rotate(45deg); }
@media (prefers-reduced-motion: reduce) {
  .tutor-ava *, .tutor-sorot::after, .tutor-panah__ikon, .misi-langkah.aktif::after, .tutor-panel { animation: none !important; }
}`;
(() => { const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); })();


/* ═══════════════════════════════════════════════════════════════
   3. MESIN TUR
   Satu langkah: { sasaran, mood, judul, teks, label, klikSasaran, tombol }
     sasaran     selektor / fungsi → elemen yang disorot (null = tanpa sorot)
     klikSasaran pemda wajib mengklik elemen yang bersinar untuk lanjut
     tombol      [{ teks, utama, aksi: 'lanjut' | 'tutup' | fungsi }]
   ═══════════════════════════════════════════════════════════════ */
let T = null;   // tur yang sedang tampil

function cariSasaran(s) {
  if (!s) return null;
  const daftar = typeof s === 'function' ? [].concat(s() || []) : Array.from(document.querySelectorAll(s));
  return daftar.find(x => x && x.offsetParent !== null && x.getBoundingClientRect().width > 0) || null;
}

function buka(langkah, opsi) {
  tutup(true);
  opsi = opsi || {};
  const akar = document.createElement('div');
  akar.className = 'tutor';
  akar.innerHTML = `<div class="tutor-tirai"></div><div class="tutor-sorot"></div>
    <div class="tutor-panah"><span class="tutor-panah__ikon">👇</span><span class="tutor-panah__teks"></span></div>
    <div class="tutor-panel" role="dialog" aria-modal="true" aria-live="polite"></div>`;
  document.body.appendChild(akar);
  T = { akar, langkah, i: 0, opsi, ketik: null, rangka: 0 };
  akar.querySelector('.tutor-tirai').addEventListener('click', klikTirai);
  document.addEventListener('keydown', tombolKunci);
  if (opsi.konfeti) konfeti();
  tampilLangkah();
  const ikuti = () => { if (!T) return; posisikan(); T.rangka = requestAnimationFrame(ikuti); };
  T.rangka = requestAnimationFrame(ikuti);
}

function tutup(diam) {
  if (!T) return;
  cancelAnimationFrame(T.rangka);
  clearInterval(T.ketik);
  document.removeEventListener('keydown', tombolKunci);
  const { akar, opsi } = T;
  T = null;
  akar.remove();
  if (!diam && opsi.selesai) opsi.selesai();
}

function tombolKunci(e) {
  if (!T) return;
  if (e.key === 'Escape') { e.preventDefault(); tutup(); }
  else if ((e.key === 'Enter' || e.key === 'ArrowRight') && !T.langkah[T.i].klikSasaran) {
    if (document.activeElement && document.activeElement.closest && document.activeElement.closest('.tutor-kaki')) return;
    e.preventDefault(); lanjut();
  }
}

function klikTirai(e) {
  const L = T.langkah[T.i];
  const s = cariSasaran(L.sasaran);
  if (L.klikSasaran && s) {
    const r = s.getBoundingClientRect();
    if (e.clientX >= r.left - 8 && e.clientX <= r.right + 8 && e.clientY >= r.top - 8 && e.clientY <= r.bottom + 8) {
      tutup();
      (s.matches('button,a') ? s : (s.querySelector('button,a') || s)).click();
      return;
    }
  }
  const g = T.akar.querySelector('.tutor-gelembung');
  if (g) { g.classList.remove('goyang'); void g.offsetWidth; g.classList.add('goyang'); }
}

function lanjut() {
  if (!T) return;
  if (T.ketikSisa) { T.ketikSisa(); return; }   // klik pertama menuntaskan ketikan
  if (T.i < T.langkah.length - 1) { T.i++; tampilLangkah(); }
  else tutup();
}

function tampilLangkah() {
  const L = T.langkah[T.i], n = T.langkah.length;
  const s = cariSasaran(L.sasaran);
  T.akar.classList.toggle('tutor--polos', !s);
  T.akar.querySelector('.tutor-sorot').classList.toggle('klik', !!L.klikSasaran);
  T.akar.querySelector('.tutor-panah__teks').textContent = L.label || (L.klikSasaran ? 'KLIK DI SINI' : 'LIHAT INI');
  const tombol = L.tombol || (L.klikSasaran
    ? [{ teks: 'Nanti saja', aksi: 'tutup' }]
    : [{ teks: 'Lewati', aksi: 'tutup' }, { teks: T.i < n - 1 ? 'Lanjut' : 'Siap!', utama: true, aksi: 'lanjut' }]);
  const panel = T.akar.querySelector('.tutor-panel');
  panel.innerHTML = `${avatar(L.mood || 'tunjuk', 128)}
    <div class="tutor-gelembung">
      <div class="flex items-center"><span class="tutor-nama">⛑️ ${NAMA} · ${PERAN}</span>${n > 1 ? `<span class="tutor-langkah">${T.i + 1}/${n}</span>` : ''}</div>
      <p class="tutor-judul">${L.judul}</p>
      <p class="tutor-teks"></p>
      <div class="tutor-kaki">
        ${n > 1 ? `<div class="tutor-titik">${T.langkah.map((_, j) => `<span class="${j === T.i ? 'on' : ''}"></span>`).join('')}</div>` : '<div class="mr-auto"></div>'}
        ${tombol.map((b, j) => `<button type="button" data-t="${j}" class="tutor-tombol ${b.utama ? 'tutor-tombol--utama' : 'tutor-tombol--lain'}">${b.teks}</button>`).join('')}
      </div>
    </div>`;
  /* Panel digambar ulang tiap langkah supaya animasi masuknya terulang. */
  panel.style.animation = 'none'; void panel.offsetWidth; panel.style.animation = '';
  panel.querySelectorAll('[data-t]').forEach(btn => btn.addEventListener('click', () => {
    const b = tombol[+btn.dataset.t];
    if (b.aksi === 'lanjut') lanjut();
    else if (b.aksi === 'tutup') tutup();
    else { tutup(); b.aksi(); }
  }));
  ketikTeks(L.teks);
  const utama = panel.querySelector('.tutor-tombol--utama') || panel.querySelector('[data-t]');
  if (utama) utama.focus({ preventScroll: true });
  if (s) gulirKe(s);
}

/** Teks muncul huruf demi huruf, mulut karakter bergerak selama itu. */
function ketikTeks(teks) {
  clearInterval(T.ketik);
  const p = T.akar.querySelector('.tutor-teks');
  const ava = T.akar.querySelector('.tutor-ava');
  const polos = String(teks);
  let i = 0;
  const kurangi = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const akhir = () => { clearInterval(T.ketik); T.ketikSisa = null; p.innerHTML = amanT(polos); ava && ava.classList.remove('bicara'); };
  if (kurangi) return akhir();
  ava && ava.classList.add('bicara');
  T.ketikSisa = akhir;
  T.ketik = setInterval(() => {
    i += 2;
    if (i >= polos.length) return akhir();
    p.innerHTML = amanT(polos.slice(0, i)) + '<span class="kursor"></span>';
  }, 18);
}

function gulirKe(s) {
  const panel = T.akar.querySelector('.tutor-panel');
  const r = s.getBoundingClientRect();
  const atas = 96, bawah = innerHeight - (panel ? panel.offsetHeight : 220) - 40;
  if (r.top >= atas && r.bottom <= bawah) return;
  window.scrollTo({ top: Math.max(0, scrollY + r.top - atas - Math.max(0, (bawah - atas - r.height) / 3)), behavior: 'smooth' });
}

function posisikan() {
  const L = T.langkah[T.i];
  const s = cariSasaran(L.sasaran);
  const sorot = T.akar.querySelector('.tutor-sorot'), panah = T.akar.querySelector('.tutor-panah');
  T.akar.classList.toggle('tutor--polos', !s);
  if (!s) return;
  const r = s.getBoundingClientRect(), pad = 8;
  const rad = parseFloat(getComputedStyle(s).borderTopLeftRadius) || 12;
  Object.assign(sorot.style, { left: (r.left - pad) + 'px', top: (r.top - pad) + 'px',
    width: (r.width + pad * 2) + 'px', height: (r.height + pad * 2) + 'px', borderRadius: (rad + pad) + 'px' });
  /* Panah di atas sasaran; bila tidak muat (sasaran di pucuk layar), di bawahnya. */
  const tinggiPanah = 58, diBawah = r.top - pad - tinggiPanah < 70;
  panah.classList.toggle('bawah', diBawah);
  panah.style.left = (r.left + r.width / 2 - panah.offsetWidth / 2) + 'px';
  panah.style.top = (diBawah ? r.bottom + pad + 4 : r.top - pad - tinggiPanah) + 'px';
}

function konfeti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const w = document.createElement('div');
  w.className = 'tutor-konfeti';
  const warna = ['#fb923c', '#facc15', '#34d399', '#38bdf8', '#f472b6', '#a78bfa'];
  w.innerHTML = Array.from({ length: 70 }, () => `<i style="left:${Math.random() * 100}%;background:${warna[Math.floor(Math.random() * warna.length)]};
    animation-duration:${(1.8 + Math.random() * 1.8).toFixed(2)}s;animation-delay:${(Math.random() * .6).toFixed(2)}s;
    transform:rotate(${Math.floor(Math.random() * 360)}deg)"></i>`).join('');
  document.body.appendChild(w);
  setTimeout(() => w.remove(), 4400);
}


/* ═══════════════════════════════════════════════════════════════
   4. ISI TUR & NOTIFIKASI
   ═══════════════════════════════════════════════════════════════ */
const sasaranKonf = () => [document.querySelector('#dashKonf'), ...document.querySelectorAll('[data-nav="konfirmasi"]')];

function mulaiTur() {
  if (!pemda()) return;
  const pre = sudah('pre'), post = sudah('post');
  const langkah = [
    { mood: 'halo', judul: `Halo, ${amanT(sapaan())}! 👋`,
      teks: `Saya ${NAMA}, petugas lapangan yang akan memandu Anda di Triwulan III. Ada 3 misi yang dikerjakan berurutan. Yuk, kita lihat satu per satu — tidak lama kok!` },
    { sasaran: '#dashMisi', mood: 'tunjuk', label: 'MISI ANDA',
      judul: 'Ini papan misi Anda',
      teks: 'Urutannya: ① Pre test → ② Konfirmasi data ruas → ③ Post test. Misi berikutnya terbuka setelah misi sebelumnya selesai, dan progresnya tercatat di sini.' },
    { sasaran: '[data-tutor="pre"]', mood: 'tunjuk', label: 'MISI 1',
      judul: pre ? 'Misi 1 · Pre test — sudah beres ✅' : 'Misi 1 · Pre test',
      teks: pre ? 'Pre test Anda sudah tercatat. Mantap! Nilainya bisa dilihat di kartu ini beserta pembahasannya.'
                : `${ATURAN_SOAL()} Kerjakan dengan tenang — hanya bisa sekali, dan inilah kunci pembuka misi berikutnya.` },
    { sasaran: sasaranKonf, mood: 'tunjuk', label: 'MISI 2',
      judul: 'Misi 2 · Konfirmasi data ruas',
      teks: adaKonf()
        ? `Periksa angka eMonitoring tiap ruas ${akun().kab}: klik "Sesuai" bila benar, atau "Perbarui" lalu "Submit" angka terbarunya. Setelah itu kirim ke pusat. ${pre ? '' : '🔒 Terbuka setelah pre test selesai.'}`
        : 'Daerah Anda tidak punya ruas di kertas kerja TW III, jadi misi ini otomatis dilewati.' },
    { sasaran: '[data-tutor="post"]', mood: 'tunjuk', label: 'MISI 3',
      judul: 'Misi 3 · Post test',
      teks: 'Terakhir, kerjakan post test untuk melihat peningkatan nilai Anda. Saya akan memberi tahu begitu waktunya tiba!' }
  ];
  /* Langkah penutup: pemda sendiri yang mengklik kartu misi berikutnya. */
  if (!pre) langkah.push({ sasaran: '[data-tutor="pre"]', mood: 'halo', klikSasaran: true, label: 'KLIK DI SINI',
    judul: 'Ayo mulai! Klik kartu yang bersinar',
    teks: 'Klik kartu Pre test yang bersinar untuk memulai misi pertama. Semangat! 💪' });
  else if (!konfBeres()) langkah.push({ sasaran: () => document.querySelector('#dashKonf button'), mood: 'halo', klikSasaran: true, label: 'KLIK DI SINI',
    judul: 'Lanjut ke Misi 2',
    teks: 'Pre test sudah beres. Klik tombol yang bersinar untuk memeriksa data ruas Anda.' });
  else if (!post) langkah.push({ sasaran: '[data-tutor="post"]', mood: 'halo', klikSasaran: true, label: 'KLIK DI SINI',
    judul: 'Tinggal satu misi lagi!',
    teks: 'Klik kartu Post test yang bersinar untuk menyelesaikan misi terakhir.' });
  else langkah.push({ mood: 'senang', judul: 'Semua misi sudah beres! 🎉', teks: 'Terima kasih atas kerja kerasnya. Sampai jumpa di triwulan berikutnya!' });

  buka(langkah, { selesai: () => renderMisi() });
  tandai('tur');
}

const ATURAN_SOAL = () => (typeof ATURAN !== 'undefined')
  ? `${ATURAN.jumlahSoal} soal pilihan ganda, ${ATURAN.durasiMenit} menit.` : '';

function notif(L, opsi) { buka([L], opsi); }

function ajakKonfirmasi() {
  tandai('preOk');
  notif({ mood: 'senang', judul: 'Misi 1 beres! 🎉 Pre test terkirim',
    teks: `Kerja bagus, ${sapaan()}! Misi 2 sudah terbuka: periksa dan konfirmasi data ruas ${akun().kab}.`,
    tombol: [{ teks: 'Lihat pembahasan dulu', aksi: 'tutup' }, { teks: 'Ke Konfirmasi Data →', utama: true, aksi: () => go('konfirmasi') }] },
  { konfeti: true });
}

function ajakPost() {
  tandai('konfOk');
  notif({ mood: 'senang', judul: adaKonf() ? 'Misi 2 beres! Data ruas terkirim 🎉' : 'Saatnya misi terakhir!',
    teks: adaKonf()
      ? 'Terima kasih, data ruas Anda sudah sampai di pusat. Sekarang tinggal Misi 3: kerjakan post test untuk melihat peningkatan nilai Anda.'
      : 'Daerah Anda tidak punya ruas untuk dikonfirmasi, jadi langsung ke Misi 3: post test.',
    tombol: [{ teks: 'Nanti', aksi: 'tutup' }, { teks: 'Kerjakan post test →', utama: true, aksi: () => startQuiz('post') }] },
  { konfeti: true });
}

function rayakan() {
  tandai('postOk');
  notif({ mood: 'senang', judul: 'Semua misi TW III selesai! 🏆',
    teks: `Luar biasa, ${sapaan()}! Pre test, konfirmasi data, dan post test sudah lengkap. Terima kasih atas kerja samanya.`,
    tombol: [{ teks: 'Siap, terima kasih!', utama: true, aksi: 'tutup' }] }, { konfeti: true });
}


/* ═══════════════════════════════════════════════════════════════
   5. KARTU MISI DI DASHBOARD
   ═══════════════════════════════════════════════════════════════ */
function renderMisi() {
  const kotak = document.getElementById('dashMisi');
  if (!kotak) return;
  if (!pemda()) { kotak.className = 'hidden'; kotak.innerHTML = ''; return; }
  const pre = sudah('pre'), post = sudah('post'), konf = pre && konfBeres();
  const terkirim = adaKonf() ? NKONF.dikirim + NKONF.verif : 0;
  const misi = [
    { judul: 'Pre test', ket: pre ? 'Selesai' : (ATURAN_SOAL() || 'Kerjakan sekali'), beres: pre, kunci: false,
      aksi: pre ? `showResult('pre')` : `startQuiz('pre')`, tombol: pre ? 'Lihat' : 'Mulai' },
    { judul: 'Konfirmasi data', ket: !adaKonf() ? 'Tidak ada ruas — dilewati' : konf ? 'Semua ruas terkirim'
        : NKONF.kembali ? NKONF.kembali + ' ruas dikembalikan pusat' : terkirim + '/' + NKONF.total + ' ruas terkirim',
      beres: konf, kunci: !pre, aksi: `go('konfirmasi')`, tombol: konf ? 'Lihat' : 'Periksa' },
    { judul: 'Post test', ket: post ? 'Selesai' : 'Ukur peningkatan nilai', beres: post, kunci: !pre || !konf,
      aksi: post ? `showResult('post')` : `startQuiz('post')`, tombol: post ? 'Lihat' : 'Mulai' }
  ];
  const aktif = misi.findIndex(m => !m.beres);
  const jumlah = misi.filter(m => m.beres).length;
  const kata = aktif < 0 ? 'Semua misi beres. Terima kasih! 🎉'
    : aktif === 0 ? 'Mulai dari pre test dulu, ya!'
    : aktif === 1 ? 'Pre test beres! Sekarang cek data ruas Anda.'
    : 'Tinggal post test — semangat!';
  kotak.className = 'misi konf-muncul mt-7 p-5 md:p-6';
  kotak.innerHTML = `
    <div class="flex flex-wrap items-center gap-4">
      <div class="flex min-w-[260px] flex-1 items-center gap-3">
        ${avatar(aktif < 0 ? 'senang' : 'halo', 74)}
        <div class="min-w-0">
          <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-300">Misi Triwulan III · ${jumlah}/3</p>
          <div class="misi-gelembung mt-1.5">${kata}</div>
        </div>
      </div>
      <button type="button" onclick="TUTOR.mulaiTur()" class="rounded-full border border-white/20 px-4 py-2 text-[12px] font-semibold text-white/80 transition hover:bg-white/10">▶ Putar panduan</button>
    </div>
    <div class="misi-bar mt-4"><div style="width:${Math.round(jumlah / 3 * 100)}%"></div></div>
    <div class="mt-4 grid gap-3 md:grid-cols-3">
      ${misi.map((m, i) => `<div class="misi-langkah ${m.beres ? 'beres' : i === aktif ? 'aktif' : m.kunci ? 'kunci' : ''}">
        <span class="misi-nomor">${m.beres ? '✓' : m.kunci ? '🔒' : i + 1}</span>
        <div class="min-w-0 flex-1">
          <p class="text-[14px] font-semibold">${m.judul}</p>
          <p class="text-[11.5px] text-white/55">${m.kunci && !m.beres ? (i === 1 ? 'Terbuka setelah pre test' : 'Terbuka setelah misi 2') : amanT(m.ket)}</p>
        </div>
        ${!m.kunci || m.beres ? `<button type="button" onclick="${m.aksi}" class="shrink-0 rounded-full ${i === aktif
          ? 'bg-white text-black' : 'border border-white/20 text-white/80 hover:bg-white/10'} px-3.5 py-1.5 text-[12px] font-semibold">${m.tombol}</button>` : ''}
      </div>`).join('')}
    </div>`;
}


/* ═══════════════════════════════════════════════════════════════
   6. TITIK MASUK
   ═══════════════════════════════════════════════════════════════ */
const diDashboard = () => { const v = document.getElementById('view-dashboard'); return v && !v.classList.contains('hidden'); };

window.TUTOR = {
  avatar, mulaiTur, tutup: () => tutup(true),

  /** Dipanggil dashboard setelah status konfirmasi terbaca (n boleh null). */
  diDashboard(n) {
    NKONF = n;
    renderMisi();
    if (!pemda() || T || !diDashboard()) return;
    const b = bendera();
    if (!b.tur) return setTimeout(() => { if (!T && diDashboard()) mulaiTur(); }, 600);
    const pre = sudah('pre'), post = sudah('post');
    if (pre && !konfBeres() && !b.preOk) return ajakKonfirmasi();
    if (pre && konfBeres() && !post && !b.konfOk) return ajakPost();
    if (post && !b.postOk) return rayakan();
  },

  /** Setelah pre/post test dikirim (pemda sedang melihat halaman hasil). */
  async setelahTest(kind) {
    if (!pemda()) return;
    if (kind === 'pre') {
      try { NKONF = await window.KONF.ringkasSaya(); } catch (e) {}
      setTimeout(() => { if (konfBeres()) ajakPost(); else ajakKonfirmasi(); }, 1300);
    } else if (kind === 'post') setTimeout(rayakan, 1300);
  },

  /** Dari menu Konfirmasi Data, begitu semua ruas sudah terkirim. */
  setelahKonfirmasi(n) {
    if (!pemda()) return;
    NKONF = n;
    if (sudah('post') || !konfBeres()) return;
    setTimeout(ajakPost, 700);
  },

  /** Layar pengganti menu Konfirmasi Data selama pre test belum dikerjakan. */
  layarTerkunci() {
    return `<div class="misi konf-muncul mx-auto max-w-[760px] p-6 md:p-9">
      <div class="flex flex-col items-center gap-6 text-center md:flex-row md:text-left">
        ${avatar('pikir', 150)}
        <div>
          <p class="text-[12px] font-bold uppercase tracking-[0.18em] text-orange-300">🔒 Misi 2 masih terkunci</p>
          <h1 class="mt-2 text-[24px] font-semibold leading-tight md:text-[30px]">Kerjakan pre test dulu, ya!</h1>
          <p class="mt-3 text-[14.5px] leading-[1.7] text-white/65">Konfirmasi data ruas terbuka setelah pre test Triwulan III selesai.
            ${ATURAN_SOAL()} Setelah itu Anda langsung bisa kembali ke sini.</p>
          <div class="mt-6 flex flex-wrap justify-center gap-3 md:justify-start">
            <button type="button" onclick="startQuiz('pre')" class="tutor-tombol tutor-tombol--utama">Kerjakan pre test →</button>
            <button type="button" onclick="go('dashboard')" class="rounded-full border border-white/20 px-5 text-[13px] font-semibold text-white/80 hover:bg-white/10">Ke dashboard</button>
          </div>
        </div>
      </div>
    </div>`;
  }
};

})();
