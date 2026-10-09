/* ═══════════════════════════════════════════════════════════════════════
   GAMBAR ANIMASI SURVEI KEPUASAN

   Satu ilustrasi SVG bergerak untuk tiap pertanyaan survei, dipanggil
   assets/survei.js lewat window.SV_GAMBAR(kunciPertanyaan). Semuanya
   digambar dengan kode — tanpa berkas gambar, jadi tidak menambah unduhan
   dan tetap tajam di layar mana pun. Geraknya CSS (plus satu animateMotion),
   dan berhenti bila perangkat meminta gerak dikurangi.
   ═══════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const GAYA = `
.sg { display: block; width: 150px; height: 150px; overflow: visible; }
@media (max-width: 639px) { .sg { width: 112px; height: 112px; } }
/* Hanya elemen yang bergerak; transform="rotate(...)" pada elemen diam
   tetap memakai titik putar SVG biasa. */
.sg [class*="sg-"] { transform-box: fill-box; transform-origin: center; }
@keyframes sgApung  { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
@keyframes sgGoyang { 0%,100% { transform: rotate(0) } 20% { transform: rotate(-9deg) } 40% { transform: rotate(8deg) } 60% { transform: rotate(-5deg) } 80% { transform: rotate(3deg) } }
@keyframes sgDenyut { 0%,100% { transform: scale(1) } 50% { transform: scale(1.12) } }
@keyframes sgGelombang { 0% { opacity: 0; transform: scale(.6) } 40% { opacity: 1 } 100% { opacity: 0; transform: scale(1.25) } }
@keyframes sgKedip  { 0%,100% { opacity: 1 } 50% { opacity: .25 } }
@keyframes sgGaris  { 0% { stroke-dashoffset: 60 } 45%,80% { stroke-dashoffset: 0 } 100% { stroke-dashoffset: 0; opacity: 0 } }
@keyframes sgPutar  { to { transform: rotate(360deg) } }
@keyframes sgMuncul { 0%,8% { opacity: 0; transform: scale(.3) } 18% { opacity: 1; transform: scale(1.15) } 24%,85% { opacity: 1; transform: scale(1) } 100% { opacity: 0; transform: scale(1) } }
@keyframes sgJatuh  { 0% { opacity: 0; transform: translateY(-22px) } 20% { opacity: 1 } 60% { opacity: 1; transform: translateY(14px) } 70%,100% { opacity: 0; transform: translateY(14px) } }
@keyframes sgNaik   { 0% { opacity: 0; transform: translateY(8px) scale(.7) } 30% { opacity: 1 } 100% { opacity: 0; transform: translateY(-30px) scale(1.05) } }
@keyframes sgSapu   { 0%,100% { transform: translate(-14px, -8px) } 50% { transform: translate(14px, 10px) } }
@keyframes sgTulis  { 0%,100% { transform: translate(-16px, 0) } 50% { transform: translate(16px, 2px) } }
@keyframes sgTutup  { 0%,55%,100% { transform: translateY(0) rotate(0) } 65% { transform: translateY(-12px) rotate(-8deg) } 80% { transform: translateY(-4px) rotate(3deg) } }
@keyframes sgApi    { 0%,100% { transform: scaleY(1) } 50% { transform: scaleY(1.35) } }
@keyframes sgKetik  { 0%,60%,100% { transform: translateY(0); opacity: .45 } 30% { transform: translateY(-5px); opacity: 1 } }
@keyframes sgKilau  { 0%,100% { opacity: 0; transform: scale(.4) rotate(0) } 50% { opacity: 1; transform: scale(1) rotate(45deg) } }
.sg-apung { animation: sgApung 3s ease-in-out infinite }
.sg-goyang { animation: sgGoyang 1.6s ease-in-out infinite }
.sg-denyut { animation: sgDenyut 1.6s ease-in-out infinite }
.sg-gelombang { animation: sgGelombang 1.8s ease-out infinite }
.sg-kedip { animation: sgKedip 1.4s ease-in-out infinite }
.sg-garis { stroke-dasharray: 60; animation: sgGaris 3.6s ease-in-out infinite }
.sg-putar { animation: sgPutar 6s linear infinite }
.sg-putar-cepat { animation: sgPutar 1.2s linear infinite; transform-origin: 50% 100% }
.sg-muncul { animation: sgMuncul 3.6s ease-out infinite }
.sg-jatuh { animation: sgJatuh 2.2s ease-in infinite }
.sg-naik { animation: sgNaik 2.4s ease-out infinite }
.sg-sapu { animation: sgSapu 3.2s ease-in-out infinite }
.sg-tulis { animation: sgTulis 2.4s ease-in-out infinite }
.sg-tutup { animation: sgTutup 2.6s ease-in-out infinite }
.sg-api { animation: sgApi .35s ease-in-out infinite; transform-origin: 50% 0 }
.sg-ketik { animation: sgKetik 1.2s ease-in-out infinite }
.sg-kilau { animation: sgKilau 2s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) {
  .sg *, .sg { animation: none !important; }
  .sg animateMotion { display: none; }
}`;

function pasangGaya() {
  if (document.getElementById('sgGaya')) return;
  const st = document.createElement('style');
  st.id = 'sgGaya';
  st.textContent = GAYA;
  document.head.appendChild(st);
}

/* Bingkai bersama: lingkaran latar berwarna redup + bayangan di tanah. */
const bingkai = (warna, isi) => `
<svg class="sg" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">
  <circle cx="80" cy="78" r="70" fill="${warna}" opacity=".13"/>
  <circle cx="80" cy="78" r="70" fill="none" stroke="${warna}" stroke-opacity=".28" stroke-width="1.5" stroke-dasharray="3 7"/>
  <ellipse cx="80" cy="134" rx="38" ry="5" fill="#000" opacity=".28"/>
  ${isi}
</svg>`;

const centang = (x, y, warna, tunda) =>
  `<g class="sg-muncul" style="animation-delay:${tunda}s"><circle cx="${x}" cy="${y}" r="9" fill="${warna}"/>
   <path d="M${x - 4} ${y} l3 3 6-6" fill="none" stroke="#0b1220" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></g>`;

const bintang = (cx, cy, r) => {
  const t = [];
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 5 * i - Math.PI / 2, rr = i % 2 ? r * .45 : r;
    t.push((cx + rr * Math.cos(a)).toFixed(1) + ' ' + (cy + rr * Math.sin(a)).toFixed(1));
  }
  return 'M' + t.join(' L') + 'Z';
};

const kilau = (x, y, w, tunda) =>
  `<path class="sg-kilau" style="animation-delay:${tunda}s" d="M${x} ${y - 6} L${x + 1.6} ${y - 1.6} L${x + 6} ${y} L${x + 1.6} ${y + 1.6} L${x} ${y + 6} L${x - 1.6} ${y + 1.6} L${x - 6} ${y} L${x - 1.6} ${y - 1.6}Z" fill="${w}"/>`;

const GAMBAR = {
  /* Nomor HP — telepon berdering */
  hp: () => bingkai('#38bdf8', `
    <g class="sg-gelombang"><path d="M112 48 a24 24 0 0 1 0 40" fill="none" stroke="#7dd3fc" stroke-width="4" stroke-linecap="round"/></g>
    <g class="sg-gelombang" style="animation-delay:.6s"><path d="M122 38 a38 38 0 0 1 0 60" fill="none" stroke="#7dd3fc" stroke-width="4" stroke-linecap="round"/></g>
    <g class="sg-goyang">
      <rect x="54" y="30" width="48" height="94" rx="10" fill="#e2e8f0"/>
      <rect x="59" y="40" width="38" height="66" rx="4" fill="#0ea5e9"/>
      <circle cx="78" cy="115" r="4" fill="#94a3b8"/>
      <path d="M70 62 c0 12 10 22 22 22 l3-6 -7-4 -3 3 c-5-2-8-5-10-10 l3-3 -4-7z" fill="#fff"/>
    </g>`),

  /* Kemudahan prosedur — alur tiga langkah yang dilalui titik */
  prosedur: () => bingkai('#a78bfa', `
    <path id="sgJalur" d="M40 52 H80 V92 H120" fill="none" stroke="#c4b5fd" stroke-width="4" stroke-dasharray="2 8" stroke-linecap="round"/>
    <rect x="22" y="36" width="36" height="32" rx="9" fill="#ede9fe"/>
    <rect x="62" y="76" width="36" height="32" rx="9" fill="#ede9fe"/>
    <rect x="104" y="78" width="34" height="30" rx="9" fill="#ede9fe"/>
    <text x="40" y="57" text-anchor="middle" font-size="14" font-weight="700" fill="#6d28d9">1</text>
    <text x="80" y="97" text-anchor="middle" font-size="14" font-weight="700" fill="#6d28d9">2</text>
    <text x="121" y="98" text-anchor="middle" font-size="14" font-weight="700" fill="#6d28d9">3</text>
    ${centang(54, 38, '#34d399', 0)}${centang(94, 78, '#34d399', .9)}${centang(134, 80, '#34d399', 1.8)}
    <circle r="6" fill="#facc15"><animateMotion dur="3.6s" repeatCount="indefinite"><mpath href="#sgJalur"/></animateMotion></circle>`),

  /* Kesesuaian persyaratan — papan klip yang dicentang satu per satu */
  persyaratan: () => bingkai('#2dd4bf', `
    <g class="sg-apung">
      <rect x="46" y="30" width="68" height="94" rx="9" fill="#f1f5f9"/>
      <rect x="64" y="24" width="32" height="14" rx="5" fill="#0d9488"/>
      ${[56, 80, 104].map((y, i) => `
        <rect x="56" y="${y - 7}" width="14" height="14" rx="3.5" fill="none" stroke="#94a3b8" stroke-width="2"/>
        <rect x="76" y="${y - 3}" width="28" height="6" rx="3" fill="#cbd5e1"/>
        <path class="sg-garis" style="animation-delay:${i * .6}s" d="M58 ${y} l4 4 8-9" fill="none" stroke="#0d9488" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}
    </g>`),

  /* Kecepatan pelayanan — stopwatch dengan garis laju */
  kecepatan: () => bingkai('#fb923c', `
    ${[56, 74, 92].map((y, i) => `<path class="sg-kedip" style="animation-delay:${i * .25}s" d="M${18 + i * 4} ${y} h22" stroke="#fdba74" stroke-width="4" stroke-linecap="round"/>`).join('')}
    <g class="sg-apung">
      <rect x="83" y="22" width="18" height="10" rx="3" fill="#fb923c"/>
      <circle cx="92" cy="80" r="40" fill="#fff7ed"/>
      <circle cx="92" cy="80" r="40" fill="none" stroke="#fb923c" stroke-width="6"/>
      ${[0, 90, 180, 270].map(a => `<path d="M92 46 v6" stroke="#9a3412" stroke-width="3" stroke-linecap="round" transform="rotate(${a} 92 80)"/>`).join('')}
      <g><rect class="sg-putar-cepat" x="90" y="50" width="4" height="30" rx="2" fill="#ea580c"/></g>
      <circle cx="92" cy="80" r="5" fill="#9a3412"/>
    </g>`),

  /* Kompetensi petugas — topi wisuda dan roda gigi */
  kompetensi: () => bingkai('#38bdf8', `
    <g transform="translate(104 98)"><g class="sg-putar">
      <path d="M0 -22 l5 0 2 7 6 3 6-4 4 4-4 6 3 6 7 2 0 5-7 2-3 6 4 6-4 4-6-4-6 3-2 7-5 0-2-7-6-3-6 4-4-4 4-6-3-6-7-2 0-5 7-2 3-6-4-6 4-4 6 4 6-3z" fill="#7dd3fc" transform="translate(-2.5 0)"/>
      <circle r="8" fill="#0c4a6e"/>
    </g></g>
    <g class="sg-apung">
      <path d="M80 34 L132 56 L80 78 L28 56Z" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/>
      <path d="M50 66 v18 c0 10 60 10 60 0 v-18 l-30 12z" fill="#334155"/>
      <path d="M124 60 v26" stroke="#facc15" stroke-width="3"/>
      <circle class="sg-goyang" cx="124" cy="90" r="5" fill="#facc15"/>
    </g>
    ${kilau(40, 36, '#fde68a', 0)}${kilau(122, 30, '#fde68a', 1)}`),

  /* Kesopanan & keramahan — wajah tersenyum dengan hati yang naik */
  perilaku: () => bingkai('#f472b6', `
    <g class="sg-apung">
      <circle cx="80" cy="82" r="40" fill="#fde68a"/>
      <g class="sg-kedip" style="animation-duration:3s"><ellipse cx="66" cy="74" rx="4.5" ry="6" fill="#422006"/><ellipse cx="94" cy="74" rx="4.5" ry="6" fill="#422006"/></g>
      <circle cx="58" cy="90" r="6" fill="#fb7185" opacity=".55"/><circle cx="102" cy="90" r="6" fill="#fb7185" opacity=".55"/>
      <path d="M64 94 q16 16 32 0" fill="none" stroke="#422006" stroke-width="4" stroke-linecap="round"/>
    </g>
    ${[[118, 44, 0], [40, 52, .8], [126, 74, 1.6]].map(([x, y, t]) => `<path class="sg-naik" style="animation-delay:${t}s" d="M${x} ${y + 8} c-10-7-10-15-4-16 3 0 4 2 4 3 0-1 1-3 4-3 6 1 6 9-4 16z" fill="#fb7185"/>`).join('')}`),

  /* Penanganan pengaduan — keluhan dibalas dengan centang */
  pengaduan: () => bingkai('#fbbf24', `
    <g class="sg-goyang" style="animation-duration:2.4s">
      <path d="M24 40 h62 a10 10 0 0 1 10 10 v26 a10 10 0 0 1-10 10 h-40 l-14 12 v-12 h-8 a10 10 0 0 1-10-10 v-26 a10 10 0 0 1 10-10z" fill="#fde68a"/>
      <rect x="52" y="48" width="6" height="20" rx="3" fill="#92400e"/><circle cx="55" cy="76" r="3.5" fill="#92400e"/>
    </g>
    <g class="sg-muncul" style="animation-delay:.6s">
      <path d="M136 76 h-50 a10 10 0 0 0-10 10 v20 a10 10 0 0 0 10 10 h32 l12 10 v-10 h6 a10 10 0 0 0 10-10 v-20 a10 10 0 0 0-10-10z" fill="#34d399"/>
      <path d="M98 96 l7 7 14-14" fill="none" stroke="#064e3b" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
    </g>`),

  /* Informasi yang didapat — pengeras suara dengan gelombang */
  informasi: () => bingkai('#22d3ee', `
    ${[0, .5, 1].map((t, i) => `<g class="sg-gelombang" style="animation-delay:${t}s"><path d="M${108 + i * 10} ${62 - i * 8} a${20 + i * 10} ${20 + i * 10} 0 0 1 0 ${36 + i * 16}" fill="none" stroke="#67e8f9" stroke-width="4" stroke-linecap="round"/></g>`).join('')}
    <g class="sg-goyang" style="animation-duration:2.2s">
      <path d="M36 66 h16 l44-24 v72 l-44-24 h-16 a6 6 0 0 1-6-6 v-12 a6 6 0 0 1 6-6z" fill="#e0f2fe"/>
      <rect x="44" y="90" width="12" height="26" rx="4" fill="#0891b2"/>
      <circle cx="96" cy="78" r="6" fill="#0891b2"/>
    </g>
    <g class="sg-denyut"><circle cx="40" cy="38" r="13" fill="#0891b2"/><text x="40" y="44" text-anchor="middle" font-size="17" font-weight="800" font-family="Georgia,serif" fill="#fff">i</text></g>`),

  /* Penarikan biaya — dompet dengan koin, dicoret */
  biaya: () => bingkai('#34d399', `
    <g class="sg-jatuh"><circle cx="80" cy="34" r="11" fill="#facc15"/><text x="80" y="39" text-anchor="middle" font-size="13" font-weight="800" fill="#854d0e">Rp</text></g>
    <rect x="38" y="56" width="84" height="58" rx="12" fill="#065f46"/>
    <rect x="38" y="56" width="84" height="18" rx="9" fill="#047857"/>
    <rect x="96" y="78" width="30" height="20" rx="6" fill="#10b981"/><circle cx="106" cy="88" r="4" fill="#ecfdf5"/>
    <g class="sg-denyut"><circle cx="80" cy="84" r="50" fill="none" stroke="#fb7185" stroke-width="7" opacity=".9"/>
    <path d="M45 49 L115 119" stroke="#fb7185" stroke-width="7" stroke-linecap="round" opacity=".9"/></g>`),

  /* Permintaan imbalan — kado yang ditolak */
  imbalan: () => bingkai('#fb7185', `
    <rect x="44" y="72" width="64" height="50" rx="6" fill="#fda4af"/>
    <rect x="70" y="72" width="12" height="50" fill="#be123c"/>
    <g class="sg-tutup">
      <rect x="38" y="58" width="76" height="18" rx="5" fill="#fb7185"/>
      <rect x="70" y="58" width="12" height="18" fill="#9f1239"/>
      <path d="M76 58 c-14-18-26-6-14 0z M76 58 c14-18 26-6 14 0z" fill="#9f1239"/>
    </g>
    <g class="sg-denyut" style="animation-delay:.4s">
      <circle cx="120" cy="44" r="18" fill="#0b1220" stroke="#f43f5e" stroke-width="5"/>
      <path d="M110 34 L130 54" stroke="#f43f5e" stroke-width="5" stroke-linecap="round"/>
    </g>`),

  /* Hal yang kurang berkenan — catatan dengan tanda perhatian */
  kurang: () => bingkai('#f59e0b', `
    <g class="sg-apung">
      <rect x="40" y="32" width="72" height="90" rx="8" fill="#fef3c7"/>
      ${[56, 72, 88, 104].map((y, i) => `<path class="sg-garis" style="animation-delay:${i * .5}s" d="M52 ${y} h${i === 3 ? 30 : 48}" stroke="#d97706" stroke-width="4" stroke-linecap="round"/>`).join('')}
    </g>
    <g class="sg-goyang"><path d="M118 28 l20 34 h-40z" fill="#f59e0b" stroke="#78350f" stroke-width="2" stroke-linejoin="round"/>
      <rect x="116" y="38" width="4" height="12" rx="2" fill="#78350f"/><circle cx="118" cy="55" r="2.5" fill="#78350f"/></g>`),

  /* Hal paling berkesan — bintang besar berkilau */
  berkesan: () => bingkai('#facc15', `
    <g class="sg-denyut"><path d="${bintang(80, 80, 44)}" fill="#facc15" stroke="#fde68a" stroke-width="3" stroke-linejoin="round"/>
      <path d="M68 82 q12 12 24 0" fill="none" stroke="#854d0e" stroke-width="4" stroke-linecap="round"/>
      <circle cx="68" cy="70" r="4" fill="#854d0e"/><circle cx="92" cy="70" r="4" fill="#854d0e"/></g>
    ${kilau(30, 40, '#fef9c3', 0)}${kilau(132, 50, '#fef9c3', .7)}${kilau(126, 116, '#fef9c3', 1.3)}${kilau(36, 112, '#fef9c3', 1.8)}`),

  /* Harapan untuk rakor berikutnya — roket meluncur */
  harapan: () => bingkai('#818cf8', `
    ${[[34, 40, 0], [124, 34, .6], [130, 100, 1.2], [30, 96, 1.6]].map(([x, y, t]) => kilau(x, y, '#c7d2fe', t)).join('')}
    <g class="sg-apung" style="animation-duration:1.8s">
      <path class="sg-api" d="M70 108 q10 30 20 0z" fill="#fb923c"/>
      <path class="sg-api" style="animation-delay:.15s" d="M74 108 q6 18 12 0z" fill="#fde047"/>
      <path d="M80 26 c18 14 22 40 16 82 h-32 c-6-42-2-68 16-82z" fill="#e0e7ff"/>
      <circle cx="80" cy="62" r="10" fill="#6366f1" stroke="#c7d2fe" stroke-width="4"/>
      <path d="M64 86 l-16 22 h18z M96 86 l16 22 h-18z" fill="#6366f1"/>
    </g>`),

  /* Desk koordinator wilayah — peta dengan pin daerah */
  deskWilayah: () => bingkai('#34d399', `
    <path d="M22 96 c10-8 22-6 30-12 s16-14 28-10 22 12 34 8 18-8 24-4 l-4 22 c-10 4-20 2-30 6 s-22 10-34 6 -22-4-30-2 -14 6-22 4z" fill="#065f46"/>
    <path d="M34 92 c8-4 14-2 20-6 M90 82 c10 2 18 4 28-2" stroke="#34d399" stroke-width="3" fill="none" stroke-linecap="round"/>
    <ellipse class="sg-gelombang" cx="82" cy="94" rx="18" ry="6" fill="none" stroke="#6ee7b7" stroke-width="3"/>
    <g class="sg-apung" style="animation-duration:1.4s">
      <path d="M82 92 c-16-18-22-28-22-38 a22 22 0 0 1 44 0 c0 10-6 20-22 38z" fill="#f43f5e"/>
      <circle cx="82" cy="54" r="8" fill="#fff"/>
    </g>`),

  /* Skor petugas wilayah — lima bintang menyala bergiliran */
  skorWilayah: () => bingkai('#fbbf24', `
    ${[0, 1, 2, 3, 4].map(i => {
      const x = 28 + i * 26, y = i % 2 ? 92 : 78;
      return `<path d="${bintang(x, y, 13)}" fill="#334155"/>
        <path class="sg-muncul" style="animation-delay:${i * .35}s" d="${bintang(x, y, 13)}" fill="#facc15" stroke="#fde68a" stroke-width="1.5" stroke-linejoin="round"/>`;
    }).join('')}
    ${kilau(80, 44, '#fef3c7', .4)}`),

  /* Alasan skor wilayah — gelembung obrolan sedang mengetik */
  alasanWilayah: () => bingkai('#60a5fa', `
    <g class="sg-apung">
      <path d="M30 40 h100 a12 12 0 0 1 12 12 v38 a12 12 0 0 1-12 12 h-56 l-20 18 v-18 h-24 a12 12 0 0 1-12-12 v-38 a12 12 0 0 1 12-12z" fill="#dbeafe"/>
      ${[0, 1, 2].map(i => `<circle class="sg-ketik" style="animation-delay:${i * .18}s" cx="${62 + i * 18}" cy="71" r="7" fill="#2563eb"/>`).join('')}
    </g>`),

  /* Desk verifikator — kaca pembesar memeriksa dokumen */
  deskVerifikator: () => bingkai('#a78bfa', `
    <rect x="40" y="28" width="66" height="92" rx="8" fill="#f5f3ff"/>
    ${[48, 62, 76, 90, 104].map((y, i) => `<rect x="50" y="${y}" width="${i % 2 ? 34 : 46}" height="5" rx="2.5" fill="#c4b5fd"/>`).join('')}
    <g class="sg-sapu">
      <circle cx="84" cy="74" r="20" fill="#ede9fe" fill-opacity=".35" stroke="#7c3aed" stroke-width="7"/>
      <path d="M99 89 l20 20" stroke="#4c1d95" stroke-width="10" stroke-linecap="round"/>
    </g>
    ${centang(112, 34, '#34d399', 1)}`),

  /* Skor verifikator — piala berkilau */
  skorVerifikator: () => bingkai('#facc15', `
    <g class="sg-apung">
      <path d="M52 32 h56 v22 a28 28 0 0 1-56 0z" fill="#facc15"/>
      <path d="M52 40 h-12 a14 14 0 0 0 14 22 M108 40 h12 a14 14 0 0 1-14 22" fill="none" stroke="#facc15" stroke-width="6"/>
      <rect x="74" y="80" width="12" height="18" fill="#eab308"/>
      <rect x="58" y="98" width="44" height="14" rx="4" fill="#a16207"/>
      <path d="${bintang(80, 50, 11)}" fill="#fff7cc"/>
    </g>
    ${kilau(42, 30, '#fef9c3', 0)}${kilau(122, 24, '#fef9c3', .8)}${kilau(124, 92, '#fef9c3', 1.4)}`),

  /* Alasan skor verifikator — pensil menulis di kertas */
  alasanVerifikator: () => bingkai('#2dd4bf', `
    <rect x="34" y="36" width="92" height="82" rx="8" fill="#f0fdfa"/>
    ${[56, 74, 92].map((y, i) => `<path class="sg-garis" style="animation-delay:${i * .7}s" d="M46 ${y} c8-6 12 6 20 0 s12-6 20 0 12 6 20 0" fill="none" stroke="#0f766e" stroke-width="3.5" stroke-linecap="round"/>`).join('')}
    <g class="sg-tulis"><g transform="translate(96 54) rotate(40)">
      <rect x="0" y="-6" width="44" height="12" rx="2" fill="#facc15"/>
      <rect x="36" y="-6" width="8" height="12" fill="#fb7185"/>
      <path d="M0 -6 L-12 0 L0 6z" fill="#fde68a"/><path d="M-8 -2 L-12 0 L-8 2z" fill="#1e293b"/>
    </g></g>`)
};

window.SV_GAMBAR = kunci => {
  pasangGaya();
  const g = GAMBAR[kunci];
  return g ? g() : '';
};

})();
