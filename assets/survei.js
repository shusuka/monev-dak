/* ═══════════════════════════════════════════════════════════════════════
   SURVEI KEPUASAN PEMERINTAH DAERAH

   Isi pertanyaannya diambil dari kuesioner Google Formulir milik PFID
   (forms.gle/qokEKXodasXaG9Be9), tetapi diisi di dalam aplikasi supaya:
     - nama, instansi, dan email tidak perlu diketik lagi — sudah ada di akun;
     - jawabannya masuk ke Firestore, jadi admin bisa merekap dan mengunduhnya
       sebagai Excel tanpa membuka Google Formulir;
     - pertanyaannya bisa disajikan satu per satu dengan tombol yang hidup,
       bukan gulungan formulir yang panjang.

   Satu akun satu dokumen; mengisi ulang berarti memperbarui jawabannya
   sendiri, bukan menambah baris baru. Tiap triwulan punya koleksi sendiri
   supaya pemda mengisi ulang dari kosong tanpa menimpa penilaian lama:
     TW II  → `survei/{uid}`      (ditutup, tinggal dibaca admin)
     TW III → `surveiTw3/{pid}`   (aktif; pid = akun asal, sehingga sesi
                                   masuk-dengan-nama tetap satu dokumen)
   ═══════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const LS_SURVEI = 'monevdak_survei';
const CDN_PIZZIP = 'https://unpkg.com/pizzip@3.2.0/dist/pizzip.min.js';

/* Triwulan yang sedang diisi pemda, dan nama koleksinya per triwulan. */
const TW_ISI = 3;
const KOLEKSI = { 2: 'survei', 3: 'surveiTw3' };
const LABEL_TW = { 2: 'TW II', 3: 'TW III' };
const judulKegiatan = tw => `Rapat Koordinasi ${LABEL_TW[tw]} DAK Fisik Bidang Konektivitas Subbidang Jalan TA 2026`;

/* Empat wajah untuk skala 1–4; angka saja terasa dingin dan lambat dibaca. */
const WAJAH = ['😞', '😕', '🙂', '😄'];

/* Urutan pertanyaan persis mengikuti kuesioner aslinya. `tipe`:
   skala = 1–4 dengan label ujung · pilih = pilihan tunggal
   teks/paragraf = isian · bintang = skor 1–5 */
const PERTANYAAN = [
  { k: 'hp', tipe: 'teks', judul: 'Nomor handphone yang bisa dihubungi',
    petunjuk: 'Hanya ini yang belum ada pada akun Anda. Nama, instansi, dan email diambil otomatis.',
    contoh: '08xxxxxxxxxx' },

  { k: 'prosedur', tipe: 'skala', kiri: 'Sangat Sulit', kanan: 'Sangat Mudah',
    judul: 'Bagaimana pemahaman Saudara tentang kemudahan prosedur pelayanan pada kegiatan ini?' },
  { k: 'persyaratan', tipe: 'skala', kiri: 'Tidak Sesuai', kanan: 'Sangat Sesuai',
    judul: 'Bagaimana pendapat Saudara tentang kesesuaian persyaratan pelayanan dengan jenis pelayanannya?' },
  { k: 'kecepatan', tipe: 'skala', kiri: 'Lama', kanan: 'Sangat Cepat',
    judul: 'Bagaimana pendapat Saudara tentang kecepatan pelayanan pada kegiatan ini?' },
  { k: 'kompetensi', tipe: 'skala', kiri: 'Tidak Kompeten', kanan: 'Sangat Kompeten',
    judul: 'Bagaimana pendapat Saudara tentang kompetensi petugas dalam memberikan pelayanan?' },
  { k: 'perilaku', tipe: 'skala', kiri: 'Tidak Ramah & Sopan', kanan: 'Sangat Ramah & Sopan',
    judul: 'Bagaimana pendapat Saudara tentang perilaku petugas terkait kesopanan dan keramahan?' },
  { k: 'pengaduan', tipe: 'skala', kiri: 'Tidak Baik', kanan: 'Sangat Baik',
    judul: 'Bagaimana pendapat Saudara tentang penanganan pengaduan pengguna layanan?' },
  { k: 'informasi', tipe: 'skala', kiri: 'Tidak Informatif', kanan: 'Sangat Informatif',
    judul: 'Bagaimana pendapat Saudara tentang informasi yang didapatkan pada kegiatan ini?' },

  { k: 'biaya', tipe: 'pilih', opsi: ['Tidak Ada Penarikan', 'Ada Penarikan'],
    judul: 'Apakah ada penarikan biaya/tarif dalam pelayanan pada kegiatan ini?' },
  { k: 'imbalan', tipe: 'pilih', opsi: ['Tidak', 'Ya'],
    judul: 'Apakah ada pejabat/pegawai PFID yang meminta imbalan atau menjanjikan sesuatu dalam pelaksanaan kegiatan ini?' },

  { k: 'kurang', tipe: 'teks', judul: 'Hal apa yang Anda rasa kurang berkenan pada pelayanan kami?',
    petunjuk: 'Ditulis apa adanya; masukan yang jujur justru paling berguna.' },
  { k: 'berkesan', tipe: 'teks', judul: 'Hal apa yang menurut Anda paling berkesan pada pelayanan kami?' },
  { k: 'harapan', tipe: 'paragraf', judul: 'Apa harapan Anda untuk Rapat Koordinasi TW berikutnya?' },

  { k: 'deskWilayah', tipe: 'pilih', bagian: 'Penilaian terhadap pelayanan petugas',
    opsi: ['Sinta / Yusrel', 'Akram / Yusuf', 'Frandi / Dyah', 'Yolanda / Robby'],
    judul: 'Petugas Desk Koordinator Wilayah yang melayani daerah Anda' },
  { k: 'skorWilayah', tipe: 'bintang', judul: 'Skor pelayanan petugas Desk Koordinator Wilayah' },
  { k: 'alasanWilayah', tipe: 'teks', judul: 'Berikan alasan atas skor tersebut' },

  { k: 'deskVerifikator', tipe: 'pilih', opsi: ['Desi Meriana'],
    judul: 'Petugas Desk Verifikator yang melayani daerah Anda' },
  { k: 'skorVerifikator', tipe: 'bintang', judul: 'Skor pelayanan petugas Desk Verifikator' },
  { k: 'alasanVerifikator', tipe: 'teks', judul: 'Berikan alasan atas skor tersebut' }
];

/* Tujuh unsur pelayanan yang dihitung menjadi indeks kepuasan. */
const UNSUR = ['prosedur', 'persyaratan', 'kecepatan', 'kompetensi', 'perilaku', 'pengaduan', 'informasi'];

const el  = s => document.querySelector(s);
const els = s => Array.from(document.querySelectorAll(s));
const aman = s => String(s == null ? '' : s)
  .replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

const pakaiFirebase = () => store.mode === 'firebase' && !!store.db;
const pfidan = () => !!(window.BA && window.BA.akunPfid(ME));

const waktuTeks = t => {
  const d = t && typeof t.toDate === 'function' ? t.toDate() : (t ? new Date(t) : null);
  if (!d || isNaN(d.getTime())) return '';
  const b = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  return `${d.getDate()} ${b[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2,'0')}.${String(d.getMinutes()).padStart(2,'0')}`;
};

/** Indeks kepuasan 0–100 dari tujuh unsur, mengikuti cara hitung IKM. */
function indeksKepuasan(j) {
  const nilai = UNSUR.map(k => Number(j[k])).filter(n => n >= 1 && n <= 4);
  if (!nilai.length) return null;
  return Math.round((nilai.reduce((a, b) => a + b, 0) / nilai.length) * 25 * 10) / 10;
}

/** Huruf mutu saja — dipakai penyaring dan grafik; MUTU() menambahkan artinya. */
const HURUF_MUTU = n => n == null ? ''
  : n >= 88.31 ? 'A'
  : n >= 76.61 ? 'B'
  : n >= 65    ? 'C'
  : 'D';

const ARTI_MUTU = { A: 'Sangat Baik', B: 'Baik', C: 'Kurang Baik', D: 'Tidak Baik' };

const MUTU = n => {
  const h = HURUF_MUTU(n);
  return h ? h + ' · ' + ARTI_MUTU[h] : '—';
};

/* Warna dipakai berulang di grafik; dituliskan sekali di sini supaya kartu,
   donat, dan batang tidak pernah berbeda warna untuk mutu yang sama. */
const WARNA_MUTU  = { A: '#34d399', B: '#38bdf8', C: '#fbbf24', D: '#fb7185' };
const WARNA_SKALA = ['#fb7185', '#fbbf24', '#7dd3fc', '#6ee7b7'];   // jawaban 1 → 4

/* Nama pendek unsur untuk sumbu radar, nama panjang untuk daftar. */
const NAMA_UNSUR = {
  prosedur:    ['Prosedur',    'Kemudahan prosedur pelayanan'],
  persyaratan: ['Persyaratan', 'Kesesuaian persyaratan'],
  kecepatan:   ['Kecepatan',   'Kecepatan pelayanan'],
  kompetensi:  ['Kompetensi',  'Kompetensi petugas'],
  perilaku:    ['Perilaku',    'Kesopanan & keramahan petugas'],
  pengaduan:   ['Pengaduan',   'Penanganan pengaduan'],
  informasi:   ['Informasi',   'Informasi yang didapat']
};


/* ═══════════════════════════════════════════════════════════════
   1. PENYIMPANAN
   ═══════════════════════════════════════════════════════════════ */
const kunciLs = tw => tw === 2 ? LS_SURVEI : LS_SURVEI + '_tw' + tw;
const bacaLokal = (tw = TW_ISI) => { try { return JSON.parse(localStorage.getItem(kunciLs(tw)) || '{}'); } catch (e) { return {}; } };
const tulisLokal = (x, tw = TW_ISI) => { try { localStorage.setItem(kunciLs(tw), JSON.stringify(x)); } catch (e) {} };

/* Dokumen TW III dinamai pid akun asal, bukan uid sesi: pemda yang masuk
   dengan memilih nama mendapat sesi anonim baru tiap kali masuk. */
const idSaya = () => (ME && (ME.pid || ME.uid)) || '';

async function ambilSurveiSaya() {
  const uid = idSaya();
  if (!uid) return null;
  if (pakaiFirebase()) {
    const { doc, getDoc } = store.fs;
    const d = await getDoc(doc(store.db, KOLEKSI[TW_ISI], uid));
    return d.exists() ? d.data() : null;
  }
  return bacaLokal()[uid] || null;
}

async function kirimSurvei(jawaban) {
  const uid = idSaya();
  if (!uid) throw new Error('Akun tidak dikenali.');
  const rekaman = {
    uid, sesi: (ME && ME.uid) || '', tw: TW_ISI,
    nama: ME.nama || '',
    prov: ME.prov || '',
    kab: ME.kab || '',
    email: ME.email || '',
    jawaban,
    indeks: indeksKepuasan(jawaban)
  };
  if (pakaiFirebase()) {
    const { doc, setDoc, serverTimestamp } = store.fs;
    await setDoc(doc(store.db, KOLEKSI[TW_ISI], uid), { ...rekaman, dikirimAt: serverTimestamp() });
  } else {
    const semua = bacaLokal();
    semua[uid] = { ...rekaman, dikirimAt: Date.now() };
    tulisLokal(semua);
  }
  return rekaman;
}

async function semuaSurvei(tw = TW_REKAP) {
  if (pakaiFirebase()) {
    const { collection, getDocs } = store.fs;
    const snap = await getDocs(collection(store.db, KOLEKSI[tw]));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  return Object.entries(bacaLokal(tw)).map(([id, x]) => ({ id, ...x }));
}

/** Hapus satu penilaian. Hanya admin yang diizinkan firestore.rules; pemda
    yang penilaiannya dihapus dapat mengisi surveinya lagi dari awal. */
async function hapusSurvei(id, tw = TW_REKAP) {
  if (pakaiFirebase()) {
    const { doc, deleteDoc } = store.fs;
    await deleteDoc(doc(store.db, KOLEKSI[tw], id));
  } else {
    const semua = bacaLokal(tw);
    delete semua[id];
    tulisLokal(semua, tw);
  }
}


/* ═══════════════════════════════════════════════════════════════
   2. TAMPILAN PENGISIAN — satu pertanyaan satu layar
   ═══════════════════════════════════════════════════════════════ */
let IDX      = 0;        // pertanyaan yang sedang tampil
let JAWAB    = {};
let TERKIRIM = null;     // rekaman yang sudah tersimpan, bila ada
let DIMUAT   = false;
let DIPERIKSA = false;   // status pengisian sudah pernah ditanyakan ke server
let TINJAU   = false;    // halaman periksa sebelum kirim
let GALAT    = '';

const GAYA = `
<style>
  @keyframes svMasuk  { from { opacity:0; transform: translateY(14px) } to { opacity:1; transform:none } }
  @keyframes svPop    { 0% { transform: scale(1) } 45% { transform: scale(1.16) } 100% { transform: scale(1.06) } }
  @keyframes svDenyut { 0%,100% { transform: scale(1); opacity:.55 } 50% { transform: scale(1.35); opacity:0 } }
  @keyframes svCentang{ from { stroke-dashoffset: 40 } to { stroke-dashoffset: 0 } }
  @keyframes svApung  { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
  .sv-masuk  { animation: svMasuk .35s cubic-bezier(.22,1,.36,1) both }
  .sv-pop    { animation: svPop .4s cubic-bezier(.34,1.56,.64,1) both }
  .sv-denyut { animation: svDenyut 1.1s ease-out infinite }
  .sv-apung  { animation: svApung 3s ease-in-out infinite }
  .sv-centang{ stroke-dasharray:40; animation: svCentang .5s ease-out .1s both }
  .sv-opsi   { transition: transform .18s cubic-bezier(.34,1.56,.64,1), background-color .18s, border-color .18s }
  .sv-opsi:hover { transform: translateY(-3px) }
  .sv-opsi:active { transform: scale(.97) }
</style>`;

const KELAS_TOMBOL = 'rounded-full border border-white/20 px-5 py-2.5 text-[13px] font-medium text-white/80 transition hover:bg-white/10';
const KELAS_UTAMA  = 'cta-glow rounded-full bg-white px-6 py-3 text-[14px] font-medium text-black transition disabled:opacity-40';
const KELAS_ISIAN  = 'w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-[14px] text-white outline-none transition placeholder:text-white/25 focus:border-white/45';

const terisi = k => {
  const v = JAWAB[k];
  return v !== undefined && v !== null && String(v).trim() !== '';
};

const belumTerisi = () => PERTANYAAN.filter(p => !terisi(p.k));

function render() {
  const wadah = el('#view-survei');
  if (!wadah) return;
  if (!ME) { wadah.innerHTML = ''; return; }

  if (TERKIRIM && !TINJAU && IDX < 0) { wadah.innerHTML = GAYA + viewTerimaKasih(); pasangTerimaKasih(); return; }

  wadah.innerHTML = GAYA + `
    <p class="text-[12px] font-semibold uppercase tracking-[0.2em] text-white/50">Survei kepuasan</p>
    <h1 class="mt-3 max-w-[760px] text-[26px] font-semibold leading-[1.2] tracking-[-0.02em] md:text-[34px]">
      Kuesioner kepuasan pemerintah daerah
    </h1>
    <p class="mt-3 max-w-[680px] text-[15px] text-white/65">${aman(judulKegiatan(TW_ISI))}</p>
    <p class="mt-2 text-[13px] text-white/45">
      ${aman(ME.nama)} · ${aman(ME.kab)}${ME.prov ? ', ' + aman(ME.prov) : ''} · ${aman(ME.email || '—')}
      <span class="ml-1 text-white/30">— diambil dari akun Anda, tidak perlu diketik lagi.</span>
    </p>
    ${GALAT ? `<div class="mt-6 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 py-4 text-[13px] text-rose-200">${aman(GALAT)}</div>` : ''}
    <div id="svIsi" class="mt-8"></div>`;

  el('#svIsi').innerHTML = TINJAU ? viewTinjau() : viewPertanyaan();
  if (TINJAU) pasangTinjau(); else pasangPertanyaan();
}

function bilahKemajuan() {
  const sudah = PERTANYAAN.filter(p => terisi(p.k)).length;
  const persen = Math.round(sudah / PERTANYAAN.length * 100);
  return `
    <div class="mb-6">
      <div class="flex items-center justify-between text-[12px] text-white/45">
        <span>Pertanyaan ${Math.min(IDX + 1, PERTANYAAN.length)} dari ${PERTANYAAN.length}</span>
        <span>${sudah} terjawab</span>
      </div>
      <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div class="h-full rounded-full bg-white transition-all duration-500" style="width:${persen}%"></div>
      </div>
    </div>`;
}

function viewPertanyaan() {
  const p = PERTANYAAN[IDX];
  const nilai = JAWAB[p.k];
  let isi = '';

  if (p.tipe === 'skala') {
    isi = `
      <div class="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
        ${[1, 2, 3, 4].map(n => {
          const on = Number(nilai) === n;
          return `<button data-nilai="${n}" class="sv-opsi ${on ? 'sv-pop border-white bg-white/[0.14]' : 'border-white/12 bg-white/[0.04] hover:border-white/35'} relative rounded-3xl border px-3 py-6 text-center">
            <span class="block text-[30px] leading-none">${WAJAH[n - 1]}</span>
            <span class="mt-3 block text-[20px] font-semibold ${on ? 'text-white' : 'text-white/70'}">${n}</span>
            ${on ? '<span class="absolute inset-0 rounded-3xl ring-2 ring-white/70"></span>' : ''}
          </button>`;
        }).join('')}
      </div>
      <div class="mt-3 flex items-center justify-between text-[12px] text-white/40">
        <span>${aman(p.kiri)}</span><span>${aman(p.kanan)}</span>
      </div>`;
  } else if (p.tipe === 'pilih') {
    isi = `
      <div class="mt-7 grid gap-2.5 ${p.opsi.length > 2 ? 'sm:grid-cols-2' : ''}">
        ${p.opsi.map(o => {
          const on = nilai === o;
          return `<button data-opsi="${aman(o)}" class="sv-opsi ${on ? 'sv-pop border-white bg-white/[0.14]' : 'border-white/12 bg-white/[0.04] hover:border-white/35'} flex items-center gap-3 rounded-2xl border px-5 py-4 text-left">
            <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${on ? 'border-white bg-white' : 'border-white/30'}">
              ${on ? '<svg viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3"><path class="sv-centang" d="m5 13 4 4L19 7"/></svg>' : ''}
            </span>
            <span class="text-[14px] ${on ? 'font-semibold text-white' : 'text-white/75'}">${aman(o)}</span>
          </button>`;
        }).join('')}
      </div>`;
  } else if (p.tipe === 'bintang') {
    isi = `
      <div class="mt-7 flex flex-wrap items-center gap-2">
        ${[1, 2, 3, 4, 5].map(n => {
          const on = Number(nilai) >= n;
          const dipilih = Number(nilai) === n;
          return `<button data-bintang="${n}" class="sv-opsi ${dipilih ? 'sv-pop' : ''} rounded-2xl border ${on ? 'border-amber-300/60 bg-amber-300/15' : 'border-white/12 bg-white/[0.04] hover:border-white/35'} px-4 py-3">
            <svg viewBox="0 0 24 24" class="h-7 w-7 ${on ? 'text-amber-300' : 'text-white/25'}" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">
              <path d="M12 3.6l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L3.4 10l6-.8z"/>
            </svg>
          </button>`;
        }).join('')}
        <span class="ml-2 text-[13px] text-white/55">${nilai ? aman(nilai) + ' dari 5' : 'belum dinilai'}</span>
      </div>`;
  } else {
    const baris = p.tipe === 'paragraf' ? 4 : 2;
    isi = `
      <div class="mt-6">
        <textarea id="svTeks" rows="${baris}" placeholder="${aman(p.contoh || 'Tulis jawaban Anda di sini…')}" class="${KELAS_ISIAN} resize-none">${aman(nilai || '')}</textarea>
      </div>`;
  }

  const p2 = PERTANYAAN[IDX];
  return `
  <div class="sv-masuk glass rounded-3xl p-6 md:p-9">
    ${bilahKemajuan()}
    <div class="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-7">
      ${window.SV_GAMBAR ? `<div class="sv-gambar shrink-0" aria-hidden="true">${window.SV_GAMBAR(p2.k)}</div>` : ''}
      <div class="min-w-0 flex-1 text-center sm:text-left">
        ${p2.bagian ? `<p class="mb-3 inline-block rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">${aman(p2.bagian)}</p>` : ''}
        <h2 class="max-w-[680px] text-[19px] font-semibold leading-[1.45] md:text-[21px]">${aman(p2.judul)}</h2>
        ${p2.petunjuk ? `<p class="mt-2 max-w-[620px] text-[13px] text-white/45">${aman(p2.petunjuk)}</p>` : ''}
      </div>
    </div>
    ${isi}
    <div class="mt-8 flex flex-wrap items-center justify-between gap-3">
      <button id="svMundur" class="${KELAS_TOMBOL}"${IDX === 0 ? ' disabled style="opacity:.35"' : ''}>Kembali</button>
      <div class="flex flex-wrap items-center gap-3">
        ${TERKIRIM || PERTANYAAN.every(x => terisi(x.k))
          ? '<button id="svKeTinjau" class="' + KELAS_TOMBOL + '">Periksa semua jawaban</button>' : ''}
        <button id="svMaju" class="${KELAS_UTAMA}">${IDX === PERTANYAAN.length - 1 ? 'Selesai' : 'Lanjut'}</button>
      </div>
    </div>
  </div>`;
}

function lanjut() {
  GALAT = '';
  if (IDX >= PERTANYAAN.length - 1) { TINJAU = true; render(); return; }
  IDX++;
  render();
}

function pasangPertanyaan() {
  const p = PERTANYAAN[IDX];

  /* Pilihan langsung melompat ke pertanyaan berikutnya — jedanya disengaja
     supaya animasi tombolnya sempat terlihat dulu. */
  const pilih = nilai => {
    JAWAB[p.k] = nilai;
    render();
    setTimeout(lanjut, 380);
  };

  els('#svIsi [data-nilai]').forEach(t => t.onclick = () => pilih(Number(t.dataset.nilai)));
  els('#svIsi [data-opsi]').forEach(t => t.onclick = () => pilih(t.dataset.opsi));
  els('#svIsi [data-bintang]').forEach(t => t.onclick = () => pilih(Number(t.dataset.bintang)));

  const teks = el('#svTeks');
  if (teks) {
    teks.oninput = () => { JAWAB[p.k] = teks.value; };
    teks.onkeydown = e => {
      if (e.key === 'Enter' && (p.tipe !== 'paragraf' || e.ctrlKey)) { e.preventDefault(); el('#svMaju').click(); }
    };
    setTimeout(() => teks.focus(), 60);
  }

  el('#svMundur').onclick = () => { if (IDX > 0) { IDX--; GALAT = ''; render(); } };
  el('#svMaju').onclick = () => {
    if (!terisi(p.k)) { GALAT = 'Pertanyaan ini wajib dijawab dulu.'; render(); return; }
    lanjut();
  };
  const tinjau = el('#svKeTinjau');
  if (tinjau) tinjau.onclick = () => { TINJAU = true; GALAT = ''; render(); };
}

/* ── halaman periksa sebelum kirim ──────────────────────────── */
function viewTinjau() {
  const kurang = belumTerisi();
  const ikm = indeksKepuasan(JAWAB);
  return `
  <div class="sv-masuk space-y-5">
    <div class="glass rounded-3xl p-6 md:p-8">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 class="text-[19px] font-semibold">Periksa sekali lagi</h2>
          <p class="mt-1 text-[13px] text-white/50">Ketuk baris mana pun untuk memperbaikinya.</p>
        </div>
        <div class="text-right">
          <p class="text-[11px] uppercase tracking-[0.16em] text-white/45">Indeks kepuasan Anda</p>
          <p class="text-[30px] font-semibold tabular-nums">${ikm == null ? '—' : ikm}</p>
          <p class="text-[12px] text-white/50">${aman(MUTU(ikm))}</p>
        </div>
      </div>

      <div class="mt-6 divide-y divide-white/8">
        ${PERTANYAAN.map((p, i) => {
          const v = JAWAB[p.k];
          const ada = terisi(p.k);
          const tampil = p.tipe === 'skala' ? `${WAJAH[Number(v) - 1] || ''} ${v} — ${Number(v) >= 3 ? p.kanan : p.kiri}`
                       : p.tipe === 'bintang' ? '★'.repeat(Number(v) || 0) + ' ' + (v || '')
                       : v;
          return `<button data-ke="${i}" class="flex w-full items-start justify-between gap-4 py-3 text-left transition hover:bg-white/[0.04]">
            <span class="max-w-[62%] text-[13px] leading-relaxed text-white/55">${aman(p.judul)}</span>
            <span class="text-right text-[13px] ${ada ? 'font-medium text-white' : 'text-rose-300'}">${ada ? aman(tampil) : 'belum dijawab'}</span>
          </button>`;
        }).join('')}
      </div>
    </div>

    ${kurang.length ? `<div class="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 py-4 text-[13px] text-rose-200">
      Masih ada ${kurang.length} pertanyaan yang belum dijawab.</div>` : ''}

    <div class="flex flex-wrap items-center justify-between gap-3 pb-4">
      <button id="svKembaliIsi" class="${KELAS_TOMBOL}">Kembali mengisi</button>
      <button id="svKirim" class="${KELAS_UTAMA}"${kurang.length ? ' disabled' : ''}>${TERKIRIM ? 'Perbarui jawaban' : 'Kirim penilaian'}</button>
    </div>
  </div>`;
}

function pasangTinjau() {
  els('#svIsi [data-ke]').forEach(t => t.onclick = () => {
    IDX = Number(t.dataset.ke); TINJAU = false; GALAT = ''; render();
  });
  el('#svKembaliIsi').onclick = () => {
    const kurang = belumTerisi();
    IDX = kurang.length ? PERTANYAAN.indexOf(kurang[0]) : 0;
    TINJAU = false; render();
  };
  el('#svKirim').onclick = async () => {
    const t = el('#svKirim');
    t.disabled = true; t.textContent = 'Mengirim…';
    try {
      const pertama = !TERKIRIM;
      TERKIRIM = await kirimSurvei(JAWAB);
      TERKIRIM.dikirimAt = Date.now();
      TINJAU = false; IDX = -1; GALAT = '';
      window.SURVEI.tandaiBelum(false);
      render();
      toast('Terima kasih, penilaian Anda tersimpan.');
      if (pertama && window.TUTOR && window.TUTOR.setelahSurvei) window.TUTOR.setelahSurvei();
    } catch (e) {
      GALAT = 'Penilaian belum tersimpan: ' + (e.code || e.message)
            + '. Pastikan aturan Firestore untuk koleksi survei sudah dipasang.';
      render();
    }
  };
}

/* ── layar terima kasih ─────────────────────────────────────── */
function viewTerimaKasih() {
  const ikm = indeksKepuasan(JAWAB);
  return `
  <div class="sv-masuk glass mt-2 rounded-3xl px-6 py-14 text-center">
    <div class="relative mx-auto flex h-20 w-20 items-center justify-center">
      <span class="sv-denyut absolute inset-0 rounded-full bg-emerald-400/40"></span>
      <span class="sv-apung relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-400/20 ring-1 ring-emerald-300/40">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="h-9 w-9 text-emerald-300">
          <path class="sv-centang" d="m5 13 4 4L19 7"/>
        </svg>
      </span>
    </div>
    <h2 class="mt-7 text-[22px] font-semibold">Terima kasih, ${aman(String(ME.nama).split(' ')[0])}.</h2>
    <p class="mx-auto mt-2 max-w-[520px] text-[14px] leading-relaxed text-white/60">
      Penilaian ${aman(ME.kab)} sudah kami terima${TERKIRIM && TERKIRIM.dikirimAt ? ' pada ' + aman(waktuTeks(TERKIRIM.dikirimAt)) : ''}.
      Masukan Anda dipakai untuk memperbaiki pelayanan rapat koordinasi berikutnya.
    </p>
    <div class="mx-auto mt-7 max-w-[300px] rounded-3xl border border-white/12 bg-white/[0.04] px-6 py-5">
      <p class="text-[11px] uppercase tracking-[0.16em] text-white/45">Indeks kepuasan</p>
      <p class="mt-1 text-[38px] font-semibold tabular-nums leading-none">${ikm == null ? '—' : ikm}</p>
      <p class="mt-1.5 text-[12px] text-white/55">${aman(MUTU(ikm))}</p>
    </div>
    <div class="mt-8 flex flex-wrap justify-center gap-3">
      <button id="svUbah" class="${KELAS_TOMBOL}">Ubah jawaban</button>
      ${typeof hasilSaya === 'function' && !hasilSaya('post')
        ? `<button onclick="startQuiz('post')" class="${KELAS_UTAMA}">Lanjut ke post test →</button>` : ''}
    </div>
  </div>`;
}

function pasangTerimaKasih() {
  el('#svUbah').onclick = () => { TINJAU = true; render(); };
}


/* ═══════════════════════════════════════════════════════════════
   3. REKAP ADMIN — penyaring, infografis, tabel, unduh Excel
   ═══════════════════════════════════════════════════════════════ */
let REKAP = [];
let REKAP_GALAT = '';
/* Triwulan yang sedang direkap admin; bawaannya yang sedang diisi pemda. */
let TW_REKAP = TW_ISI;
/* Rekap tiap triwulan, untuk cadangan nomor telepon lintas triwulan. */
const REKAP_TW = {};

/* Penyaring rekap. Provinsi yang utama — rapat koordinasi ditindaklanjuti
   per provinsi, jadi seluruh angka dan grafik ikut menyempit bersamanya. */
let SARING = { prov: '', mutu: '', cari: '', ganda: '' };

/* Landasan rekap. Jumlah penilaian yang masuk lebih besar daripada jumlah
   pemda penerima DAK, karena survei boleh diisi tanpa akun dan jawaban
   Google Formulir putaran pertama ikut diimpor. Supaya angkanya sebanding
   dengan rekap pre/post test, rekap disandarkan pada daftar yang sama:
     'pemda'  — hanya daerah penerima DAK yang pemdanya ada di data pre/post
                test (bawaan);
     'ketat'  — penilainya sendiri harus ada di daftar peserta terdaftar;
     'semua'  — apa adanya, seperti sebelumnya.
   Yang tersaring hanya disembunyikan dari rekap, bukan dihapus dari Firestore:
   pilih 'semua' untuk memeriksanya, lalu buang lewat tombol Hapus terpilih. */
let LANDASAN = 'pemda';

/* Unsur yang sedang dibedah di panel bawah grafik; null = tidak ada. */
let UNSUR_PILIH = null;

let JEDA_CARI = null;   // penunda pencarian, lihat pasangAdminSurvei()

const nomor = (n, desimal) => n == null || isNaN(n) ? '—'
  : String(Math.round(n * Math.pow(10, desimal || 0)) / Math.pow(10, desimal || 0));

/** Indeks dihitung ulang bila dokumen lama belum menyimpan `indeks`. */
const nilaiIndeks = r => (typeof r.indeks === 'number' ? r.indeks : indeksKepuasan(r.jawaban || {}));

const seragam = s => String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();

/* ── penyelarasan dengan data pre/post test ────────────────────────────── */

/** Kunci daerah yang bentuknya sama untuk survei, peserta, dan daftar DAK. */
const kunciWil = (prov, kab) => seragam(prov).replace(/[^a-z0-9]+/g, '')
                              + '|' + seragam(kab).replace(/[^a-z0-9]+/g, '');

let DAK_WIL = null;
/** Daftar daerah penerima DAK, dari assets/wilayah.js. */
function wilayahDak() {
  if (DAK_WIL) return DAK_WIL;
  DAK_WIL = new Set();
  const W = window.WILAYAH || {};
  Object.keys(W).forEach(prov => String(W[prov] || '').split(',').filter(Boolean)
    .forEach(kab => DAK_WIL.add(kunciWil(prov, kab))));
  return DAK_WIL;
}

const petugasPfid = x => !!(window.BA && window.BA.akunPfid(x));

/* Daftar peserta disusun sekali tiap penggambaran, bukan tiap baris: rekap
   survei dan daftar peserta sama-sama ratusan baris, dan pencocokannya
   dipanggil berkali-kali oleh kartu, grafik, tabel, dan unduhan. */
let PADANAN = null;
function padananPeserta() {
  if (PADANAN) return PADANAN;
  const daerah = new Set(), email = new Set(), nama = new Set();
  ((typeof ADATA !== 'undefined' && ADATA.gabung) || []).forEach(g => {
    if (petugasPfid(g)) return;
    if (g.email) email.add(seragam(g.email));
    if (g.nama)  nama.add(seragam(g.nama));
    /* Hanya pemda yang benar-benar mengerjakan tesnya yang jadi landasan. */
    if (g.kab && (g.pre || g.post)) daerah.add(kunciWil(g.prov, g.kab));
  });
  return (PADANAN = { daerah, email, nama });
}
/** Dipanggil tiap rekap digambar ulang: daftar pesertanya bisa sudah berubah. */
const lupakanPadanan = () => { PADANAN = null; };

/** Sebab satu penilaian berada di luar landasan; '' berarti ikut dihitung.
    Diperiksa berurutan supaya tiap penilaian hanya punya satu sebab. */
function sebabLuar(r) {
  if (petugasPfid(r)) return 'pfid';
  const wil = kunciWil(r.prov, r.kab);
  if (!r.kab || !wilayahDak().has(wil)) return 'luar';
  const p = padananPeserta();
  if (!p.daerah.has(wil)) return 'nontest';
  if (!p.email.has(seragam(r.email)) && !p.nama.has(seragam(r.nama))) return 'lepas';
  return '';
}

const SEBAB_LUAR = {
  pfid:    'petugas PFID',
  luar:    'daerah di luar daftar DAK',
  nontest: 'pemdanya tidak mengisi pre/post test',
  lepas:   'penilainya bukan peserta terdaftar'
};

/** Penilaian yang dipakai rekap, sebelum penyaring provinsi/mutu/pencarian. */
function rekapDasar() {
  if (LANDASAN === 'semua') return REKAP.slice();
  return REKAP.filter(r => {
    const sebab = sebabLuar(r);
    return !sebab || (LANDASAN === 'pemda' && sebab === 'lepas');
  });
}

/* ── pemda yang mengisi survei lebih dari sekali ───────────────────────────
   Satu pemda dapat menilai dua kali: petugasnya berganti, atau jawabannya
   sudah masuk lewat Google Formulir lalu diisi ulang di aplikasi. Di tiap
   daerah dipilih satu penilaian `utama` — yang penilainya peserta terdaftar,
   lalu yang jawabannya paling lengkap, lalu yang paling belakangan dikirim —
   dan sisanya `berlebih`, siap disaring lalu dihapus. */
const msKirim = v => (v && typeof v.toMillis === 'function') ? v.toMillis() : Number(v || 0);

const bobotSurvei = r => [
  sebabLuar(r) ? 0 : 1,
  Object.keys(r.jawaban || {}).filter(k => {
    const v = (r.jawaban || {})[k];
    return v !== '' && v != null;
  }).length,
  msKirim(r.dikirimAt)
];

let GANDA = null;
/** Peta id penilaian → { n, peran, urut } untuk daerah yang mengisi >1 kali. */
function petaGanda() {
  if (GANDA) return GANDA;
  GANDA = new Map();
  const grup = {};
  rekapDasar().forEach(r => {
    if (!r.kab) return;
    const k = kunciWil(r.prov, r.kab);
    (grup[k] || (grup[k] = [])).push(r);
  });
  Object.keys(grup).forEach(k => {
    const daftar = grup[k];
    if (daftar.length < 2) return;
    daftar.sort((a, b) => {
      const x = bobotSurvei(a), y = bobotSurvei(b);
      return y[0] - x[0] || y[1] - x[1] || y[2] - x[2] || seragam(a.nama).localeCompare(seragam(b.nama));
    });
    daftar.forEach((r, i) => GANDA.set(r.id, {
      n: daftar.length, peran: i === 0 ? 'utama' : 'berlebih', urut: i + 1
    }));
  });
  return GANDA;
}
const lupakanGanda = () => { GANDA = null; };

/** Ringkasan untuk keterangan: berapa pemda ganda dan berapa yang berlebih. */
function ringkasGandaSurvei() {
  const peta = petaGanda();
  let berlebih = 0, pemda = 0;
  peta.forEach(v => { if (v.peran === 'berlebih') berlebih++; else pemda++; });
  return { pemda, berlebih };
}

/** Cacah tiap sebab, untuk keterangan selisih di atas bilah penyaring. */
function cacahLuar() {
  const c = { pfid: 0, luar: 0, nontest: 0, lepas: 0, sesuai: 0 };
  REKAP.forEach(r => { const x = sebabLuar(r); c[x || 'sesuai']++; });
  return c;
}

/** Baris yang sedang tampil — dipakai bersama oleh kartu, grafik, tabel, dan ekspor. */
function rekapTampil() {
  const rows = rekapDasar().filter(r => {
    if (SARING.ganda) {
      const g = petaGanda().get(r.id);
      if (SARING.ganda === 'ganda'    && !g) return false;
      if (SARING.ganda === 'berlebih' && !(g && g.peran === 'berlebih')) return false;
      if (SARING.ganda === 'satu'     && g && g.peran === 'berlebih') return false;
    }
    if (SARING.prov && (r.prov || '') !== SARING.prov) return false;
    if (SARING.mutu && HURUF_MUTU(nilaiIndeks(r)) !== SARING.mutu) return false;
    if (SARING.cari) {
      const teks = seragam([r.kab, r.prov, r.nama, r.email, (r.jawaban || {}).hp].join(' '));
      if (!teks.includes(seragam(SARING.cari))) return false;
    }
    return true;
  });
  /* Sewaktu penyaring pemda ganda aktif, penilaian satu daerah dirapatkan
     supaya mudah dibandingkan — yang utama selalu di baris pertama. */
  if (!SARING.ganda) return rows;
  return rows.sort((a, b) =>
    seragam(a.prov).localeCompare(seragam(b.prov)) ||
    seragam(a.kab).localeCompare(seragam(b.kab)) ||
    ((petaGanda().get(a.id) || {}).urut || 1) - ((petaGanda().get(b.id) || {}).urut || 1));
}

const adaSaringan = () => !!(SARING.prov || SARING.mutu || SARING.cari || SARING.ganda);

/** Rata-rata satu unsur (skala 1–4) pada sekumpulan baris. */
function rataUnsur(rows, k) {
  const v = rows.map(r => Number((r.jawaban || {})[k])).filter(n => n >= 1 && n <= 4);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/** Cacah jawaban 1–4 satu unsur, untuk batang bertumpuk. */
function sebaranUnsur(rows, k) {
  const c = [0, 0, 0, 0];
  rows.forEach(r => {
    const n = Number((r.jawaban || {})[k]);
    if (n >= 1 && n <= 4) c[n - 1]++;
  });
  return c;
}

const KOLOM_EKSPOR = [
  ['Waktu kirim', r => waktuTeks(r.dikirimAt)],
  ['Nama', r => r.nama],
  ['Kabupaten/Kota', r => r.kab],
  ['Provinsi', r => r.prov],
  ['Email', r => r.email],
  ['No Handphone', r => (r.jawaban || {}).hp],
  ['Kemudahan prosedur', r => Number((r.jawaban || {}).prosedur) || ''],
  ['Kesesuaian persyaratan', r => Number((r.jawaban || {}).persyaratan) || ''],
  ['Kecepatan pelayanan', r => Number((r.jawaban || {}).kecepatan) || ''],
  ['Kompetensi petugas', r => Number((r.jawaban || {}).kompetensi) || ''],
  ['Perilaku petugas', r => Number((r.jawaban || {}).perilaku) || ''],
  ['Penanganan pengaduan', r => Number((r.jawaban || {}).pengaduan) || ''],
  ['Informasi yang didapat', r => Number((r.jawaban || {}).informasi) || ''],
  ['Indeks kepuasan', r => (nilaiIndeks(r) == null ? '' : Number(nilaiIndeks(r)))],
  ['Mutu', r => MUTU(nilaiIndeks(r))],
  ['Penarikan biaya', r => (r.jawaban || {}).biaya],
  ['Permintaan imbalan', r => (r.jawaban || {}).imbalan],
  ['Kurang berkenan', r => (r.jawaban || {}).kurang],
  ['Paling berkesan', r => (r.jawaban || {}).berkesan],
  ['Harapan', r => (r.jawaban || {}).harapan],
  ['Desk Koordinator Wilayah', r => (r.jawaban || {}).deskWilayah],
  ['Skor Desk Wilayah', r => Number((r.jawaban || {}).skorWilayah) || ''],
  ['Alasan skor Desk Wilayah', r => (r.jawaban || {}).alasanWilayah],
  ['Desk Verifikator', r => (r.jawaban || {}).deskVerifikator],
  ['Skor Desk Verifikator', r => Number((r.jawaban || {}).skorVerifikator) || ''],
  ['Alasan skor Verifikator', r => (r.jawaban || {}).alasanVerifikator]
];

/* ── penulis berkas .xlsx sederhana ─────────────────────────────
   Memakai PizZip yang sudah dipakai berita acara, jadi tidak ada pustaka
   tambahan. Teks ditulis sebagai inlineStr supaya tidak perlu tabel string
   bersama, dan angka tetap angka sehingga bisa dijumlah di Excel. */
const xmlAman = s => String(s == null ? '' : s)
  .replace(/[&<>]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c]))
  .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

function hurufKolom(i) {
  let s = '';
  i++;
  while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = (i - m - 1) / 26; }
  return s;
}

function lembarXml(baris) {
  const isiBaris = baris.map((r, i) => {
    const sel = r.map((v, j) => {
      const ref = hurufKolom(j) + (i + 1);
      if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`;
      return `<c r="${ref}" t="inlineStr"${i === 0 ? ' s="1"' : ''}><is><t xml:space="preserve">${xmlAman(v)}</t></is></c>`;
    }).join('');
    return `<row r="${i + 1}">${sel}</row>`;
  }).join('');
  const lebar = (baris[0] || []).map((_, j) =>
    `<col min="${j + 1}" max="${j + 1}" width="${j < 5 ? 22 : 18}" customWidth="1"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${lebar}</cols><sheetData>${isiBaris}</sheetData></worksheet>`;
}

async function buatXlsx(namaLembar, baris) {
  if (!window.PizZip) await new Promise((res, tolak) => {
    const s = document.createElement('script');
    s.src = CDN_PIZZIP; s.onload = res; s.onerror = () => tolak(new Error('gagal memuat pustaka pembuat Excel'));
    document.head.appendChild(s);
  });
  const zip = new window.PizZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`);
  zip.folder('_rels').file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
  const xl = zip.folder('xl');
  xl.file('workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${xmlAman(namaLembar).slice(0, 28)}" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  xl.folder('_rels').file('workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
  xl.file('styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
</styleSheet>`);
  xl.folder('worksheets').file('sheet1.xml', lembarXml(baris));

  return zip.generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    compression: 'DEFLATE'
  });
}

/** Berkas mengikuti penyaring yang sedang aktif, sama seperti rekap nilai. */
async function unduhExcel() {
  const rows = rekapTampil();
  const baris = [KOLOM_EKSPOR.map(k => k[0])].concat(
    rows.map(r => KOLOM_EKSPOR.map(k => {
      const v = k[1](r);
      return (v === undefined || v === null) ? '' : v;
    })));
  const blob = await buatXlsx('Survei Kepuasan', baris);
  const d = new Date();
  const tanda = SARING.prov ? ' - ' + SARING.prov.replace(/[\\/:*?"<>|]/g, ' ') : '';
  const nama = `Survei Kepuasan Pemda - Rakor ${LABEL_TW[TW_REKAP]} 2026${tanda} - ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.xlsx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nama;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return nama;
}

/* ── infografis ────────────────────────────────────────────────
   Semuanya SVG dan div biasa yang dibangun sendiri: tidak ada pustaka grafik
   yang perlu diunduh, jadi panel admin tetap terbuka walau koneksi seret. */

const GAYA_ADM = `
<style>
  @keyframes svaNaik   { from { opacity:0; transform: translateY(12px) } to { opacity:1; transform:none } }
  @keyframes svaTumbuh { from { width: 0 } }
  @keyframes svaBusur  { from { stroke-dashoffset: var(--panjang) } }
  @keyframes svaPutar  { from { opacity:0; transform: rotate(-155deg) scale(.9) } to { opacity:1; transform: rotate(-90deg) scale(1) } }
  @keyframes svaMekar  { from { opacity:0; transform: scale(.82) } to { opacity:1; transform: scale(1) } }
  .sva-naik   { animation: svaNaik .5s cubic-bezier(.22,1,.36,1) both }
  .sva-tumbuh { animation: svaTumbuh .9s cubic-bezier(.22,1,.36,1) both }
  .sva-busur  { stroke-dasharray: var(--panjang); animation: svaBusur 1.1s cubic-bezier(.22,1,.36,1) both }
  .sva-putar  { transform-origin: 70px 70px; animation: svaPutar .9s cubic-bezier(.22,1,.36,1) both }
  .sva-mekar  { transform-origin: center; animation: svaMekar .7s cubic-bezier(.34,1.4,.64,1) both }
  .sva-klik   { cursor: pointer; transition: transform .18s ease, background-color .18s ease, border-color .18s ease }
  .sva-klik:hover { transform: translateY(-2px) }
  .sva-simpul { transition: r .18s ease, opacity .18s ease; cursor: pointer }
  .sva-simpul:hover { r: 7 }
  #svTip { position: fixed; z-index: 120; pointer-events: none; opacity: 0; transform: translate(-50%, -118%);
           white-space: pre-line; border-radius: .8rem; padding: .5rem .7rem; font-size: 12px; line-height: 1.45;
           color: #fff; background: rgba(12,12,14,.94); border: 1px solid rgba(255,255,255,.16);
           box-shadow: 0 18px 40px -16px rgba(0,0,0,.9); transition: opacity .12s ease; max-width: 260px }
</style>`;

/* Warnanya mengikuti tab survei, diwarisi dari --tab pada #adPanelSurvei —
   lihat .kartu-tab pada <style> di index.html. `warna` hanya diisi bila
   angkanya membawa arti tersendiri, seperti mutu A–D atau laporan pungutan. */
function kartuAngka(judul, nilai, keterangan, warna) {
  return `<div class="kartu-tab sva-naik rounded-3xl p-5">
    <p class="kartu-judul text-[11px] uppercase tracking-[0.16em]">${aman(judul)}</p>
    <p class="mt-2 text-[28px] font-semibold tabular-nums leading-none ${warna || 'kartu-angka'}">${aman(nilai)}</p>
    ${keterangan ? `<p class="mt-1.5 text-[12px] text-white/45">${aman(keterangan)}</p>` : ''}
  </div>`;
}

const bungkusGrafik = (judul, sub, isi, kelas) => `
  <div class="glass sva-naik rounded-3xl p-5 md:p-6 ${kelas || ''}">
    <p class="text-[11px] uppercase tracking-[0.16em] text-white/45">${aman(judul)}</p>
    ${sub ? `<p class="mt-1 text-[12px] leading-relaxed text-white/40">${aman(sub)}</p>` : ''}
    <div class="mt-4">${isi}</div>
  </div>`;

/* ── 1. jarum indeks kepuasan ─────────────────────────────────── */
function grafikJarum(ikm, jml) {
  const cx = 130, cy = 120, R = 92, TEBAL = 17;
  const kutub = (r, deg) => { const a = deg * Math.PI / 180; return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; };
  const sudut = v => 180 - (Math.max(0, Math.min(100, v)) / 100) * 180;
  const busur = (r, v1, v2) => {
    const d1 = sudut(v1), d2 = sudut(v2);
    const [x1, y1] = kutub(r, d1), [x2, y2] = kutub(r, d2);
    return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };
  const panjang = v => Math.PI * R * (Math.max(0, Math.min(100, v)) / 100);

  const pita = [[0, 65, 'D'], [65, 76.61, 'C'], [76.61, 88.31, 'B'], [88.31, 100, 'A']];
  const cincin = pita.map(([a, b, h]) =>
    `<path d="${busur(R + 15, a + 0.6, b - 0.6)}" fill="none" stroke="${WARNA_MUTU[h]}" stroke-width="4" stroke-linecap="round" opacity=".55"
           data-tip="Mutu ${h} · ${ARTI_MUTU[h]}\nrentang indeks ${a} – ${b}"></path>`).join('');

  const huruf = HURUF_MUTU(ikm);
  const warna = huruf ? WARNA_MUTU[huruf] : '#94a3b8';
  const [jx, jy] = kutub(R, sudut(ikm == null ? 0 : ikm));

  return `
  <svg viewBox="0 0 260 172" class="w-full max-w-[320px]" role="img" aria-label="Indeks kepuasan ${nomor(ikm, 1)}">
    <defs>
      <linearGradient id="svgJarum" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0%" stop-color="${warna}" stop-opacity=".55"/><stop offset="100%" stop-color="${warna}"/>
      </linearGradient>
    </defs>
    ${cincin}
    <path d="${busur(R, 0, 100)}" fill="none" stroke="rgba(255,255,255,.09)" stroke-width="${TEBAL}" stroke-linecap="round"/>
    ${ikm == null ? '' : `
      <path class="sva-busur" style="--panjang:${panjang(ikm).toFixed(1)}" d="${busur(R, 0.01, ikm)}"
            fill="none" stroke="url(#svgJarum)" stroke-width="${TEBAL}" stroke-linecap="round"/>
      <circle class="sva-mekar" cx="${jx.toFixed(2)}" cy="${jy.toFixed(2)}" r="6" fill="#fff" stroke="${warna}" stroke-width="3"/>`}
    <text x="${cx}" y="96" text-anchor="middle" fill="#fff" font-size="42" font-weight="600" letter-spacing="-1">${nomor(ikm, 1)}</text>
    <text x="${cx}" y="118" text-anchor="middle" fill="${warna}" font-size="13" font-weight="600">${aman(MUTU(ikm))}</text>
    <text x="34" y="140" text-anchor="middle" fill="rgba(255,255,255,.35)" font-size="10">0</text>
    <text x="226" y="140" text-anchor="middle" fill="rgba(255,255,255,.35)" font-size="10">100</text>
    <text x="${cx}" y="160" text-anchor="middle" fill="rgba(255,255,255,.45)" font-size="11">dari ${jml} penilaian pemda</text>
  </svg>`;
}

/* ── 2. radar tujuh unsur ─────────────────────────────────────── */
function grafikRadar(rows) {
  /* Bidang gambar sengaja dilebihkan di kiri-kanan: nama unsur ditulis di luar
     jaring, dan SVG memangkas apa pun yang melewati viewBox-nya. */
  const n = UNSUR.length, cx = 160, cy = 132, R = 76;
  const titik = (i, r) => {
    const a = (-90 + i * 360 / n) * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const sudut = UNSUR.map(k => rataUnsur(rows, k));
  const jaring = [1, 2, 3, 4].map(g => {
    const p = UNSUR.map((_, i) => titik(i, R * g / 4).map(v => v.toFixed(1)).join(',')).join(' ');
    return `<polygon points="${p}" fill="none" stroke="rgba(255,255,255,${g === 4 ? '.18' : '.08'})" stroke-width="1"/>`;
  }).join('');
  const jari = UNSUR.map((_, i) => {
    const [x, y] = titik(i, R);
    return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,.08)"/>`;
  }).join('');

  const isiPoli = UNSUR.map((k, i) => titik(i, R * (sudut[i] || 0) / 4).map(v => v.toFixed(1)).join(',')).join(' ');

  const simpul = UNSUR.map((k, i) => {
    const v = sudut[i];
    const [x, y] = titik(i, R * (v || 0) / 4);
    const c = sebaranUnsur(rows, k);
    const aktif = UNSUR_PILIH === k;
    return `<circle class="sva-simpul" data-unsur="${k}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${aktif ? 7 : 4.5}"
      fill="${aktif ? '#fff' : '#e879f9'}" stroke="#0c0c0e" stroke-width="1.5"
      data-tip="${aman(NAMA_UNSUR[k][1])}\nrata-rata ${nomor(v, 2)} dari 4 · setara ${nomor(v == null ? null : v * 25, 1)}\n${c.map((x2, j) => (j + 1) + ': ' + x2).join(' · ')}\n(klik untuk membedah)"/>`;
  }).join('');

  const label = UNSUR.map((k, i) => {
    const [x, y] = titik(i, R + 18);
    const anchor = Math.abs(x - cx) < 12 ? 'middle' : (x > cx ? 'start' : 'end');
    const aktif = UNSUR_PILIH === k;
    return `<g class="sva-simpul" data-unsur="${k}">
      <text x="${x.toFixed(1)}" y="${(y + 1).toFixed(1)}" text-anchor="${anchor}" font-size="10"
            fill="${aktif ? '#fff' : 'rgba(255,255,255,.6)'}" font-weight="${aktif ? '600' : '400'}">${aman(NAMA_UNSUR[k][0])}</text>
      <text x="${x.toFixed(1)}" y="${(y + 12).toFixed(1)}" text-anchor="${anchor}" font-size="9.5"
            fill="${aktif ? '#e879f9' : 'rgba(255,255,255,.35)'}" class="tabular-nums">${nomor(sudut[i], 2)}</text>
    </g>`;
  }).join('');

  return `
  <svg viewBox="0 0 320 272" class="mx-auto w-full max-w-[360px]" role="img" aria-label="Radar tujuh unsur pelayanan">
    <defs>
      <radialGradient id="svgRadar" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#e879f9" stop-opacity=".55"/><stop offset="100%" stop-color="#e879f9" stop-opacity=".16"/>
      </radialGradient>
    </defs>
    ${jaring}${jari}
    <polygon class="sva-mekar" points="${isiPoli}" fill="url(#svgRadar)" stroke="#e879f9" stroke-width="2" stroke-linejoin="round" style="transform-origin:${cx}px ${cy}px"/>
    ${simpul}${label}
  </svg>`;
}

/* ── 3. donat mutu ────────────────────────────────────────────── */
function grafikDonat(rows) {
  const kel = ['A', 'B', 'C', 'D'];
  const cacah = {}; kel.forEach(h => cacah[h] = 0);
  let ada = 0;
  rows.forEach(r => { const h = HURUF_MUTU(nilaiIndeks(r)); if (h) { cacah[h]++; ada++; } });

  const K = 2 * Math.PI * 54;
  let jalan = 0;
  const potong = ada ? kel.filter(h => cacah[h]).map(h => {
    const bagi = cacah[h] / ada, p = K * bagi;
    const s = `<circle r="54" cx="70" cy="70" fill="none" stroke="${WARNA_MUTU[h]}" stroke-width="17"
      stroke-dasharray="${(p - 1.5).toFixed(2)} ${(K - p + 1.5).toFixed(2)}" stroke-dashoffset="${(-jalan).toFixed(2)}"
      opacity="${!SARING.mutu || SARING.mutu === h ? 1 : .22}"
      data-tip="Mutu ${h} · ${ARTI_MUTU[h]}\n${cacah[h]} pemda · ${Math.round(bagi * 100)}%"/>`;
    jalan += p;
    return s;
  }).join('') : `<circle r="54" cx="70" cy="70" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="17"/>`;

  const legenda = kel.map(h => {
    const aktif = SARING.mutu === h;
    return `<button data-mutu="${h}" class="sva-klik flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left ${aktif ? 'border-white/40 bg-white/10' : 'border-white/10 bg-white/[0.03] hover:border-white/25'}">
      <span class="flex items-center gap-2">
        <span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background:${WARNA_MUTU[h]}"></span>
        <span class="text-[12px] ${aktif ? 'font-semibold text-white' : 'text-white/70'}">${h} · ${ARTI_MUTU[h]}</span>
      </span>
      <span class="text-[12px] tabular-nums text-white/55">${cacah[h]}</span>
    </button>`;
  }).join('');

  return `
    <div class="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <svg viewBox="0 0 140 140" class="h-[150px] w-[150px] shrink-0" role="img" aria-label="Sebaran mutu pelayanan">
        <g class="sva-putar">${potong}</g>
        <text x="70" y="66" text-anchor="middle" fill="#fff" font-size="26" font-weight="600">${ada}</text>
        <text x="70" y="84" text-anchor="middle" fill="rgba(255,255,255,.45)" font-size="10">penilaian</text>
      </svg>
      <div class="grid w-full gap-2">${legenda}</div>
    </div>
    <p class="mt-4 text-[11px] text-white/35">Ketuk salah satu mutu untuk menyaring tabel dan grafik.</p>`;
}

/* ── 4. sebaran jawaban tiap unsur ────────────────────────────── */
function grafikSebaran(rows) {
  const baris = UNSUR.map((k, i) => {
    const c = sebaranUnsur(rows, k);
    const jml = c.reduce((a, b) => a + b, 0);
    const rata = rataUnsur(rows, k);
    const aktif = UNSUR_PILIH === k;
    const seg = c.map((n, j) => n
      ? `<div class="sva-tumbuh h-full" style="width:${(n / jml * 100).toFixed(2)}%;background:${WARNA_SKALA[j]};animation-delay:${(i * 0.05).toFixed(2)}s"
             data-tip="${aman(NAMA_UNSUR[k][1])}\njawaban ${j + 1} ${WAJAH[j]} — ${n} pemda (${Math.round(n / jml * 100)}%)"></div>`
      : '').join('');
    return `
      <button data-unsur="${k}" class="group block w-full rounded-2xl px-3 py-2.5 text-left transition ${aktif ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'}">
        <div class="flex items-baseline justify-between gap-3">
          <span class="text-[13px] ${aktif ? 'font-semibold text-white' : 'text-white/75'}">${aman(NAMA_UNSUR[k][1])}</span>
          <span class="shrink-0 text-[12px] tabular-nums ${aktif ? 'text-white' : 'text-white/50'}">${nomor(rata, 2)} <span class="text-white/30">/ 4</span></span>
        </div>
        <div class="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">${jml ? seg : ''}</div>
      </button>`;
  }).join('');

  const legenda = [1, 2, 3, 4].map(n => `
    <span class="flex items-center gap-1.5 text-[11px] text-white/45">
      <span class="h-2 w-2 rounded-full" style="background:${WARNA_SKALA[n - 1]}"></span>${WAJAH[n - 1]} ${n}
    </span>`).join('');

  return `<div class="-mx-1 grid gap-1">${baris}</div>
    <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-3">${legenda}</div>`;
}

/* ── 5. bedah satu unsur ──────────────────────────────────────── */
function panelUnsur(rows) {
  const k = UNSUR_PILIH;
  if (!k) return '';
  const c = sebaranUnsur(rows, k);
  const jml = c.reduce((a, b) => a + b, 0);
  const rata = rataUnsur(rows, k);

  const kolom = c.map((n, j) => {
    const tinggi = jml ? Math.max(3, n / Math.max(...c) * 100) : 3;
    return `<div class="flex flex-1 flex-col items-center gap-2">
      <span class="text-[12px] tabular-nums text-white/70">${n}</span>
      <div class="flex h-[86px] w-full items-end">
        <div class="sva-tumbuh w-full rounded-t-lg" style="height:${tinggi}%;background:${WARNA_SKALA[j]};opacity:.85;animation-name:svaNaik"
             data-tip="Jawaban ${j + 1} — ${n} pemda${jml ? ' (' + Math.round(n / jml * 100) + '%)' : ''}"></div>
      </div>
      <span class="text-[16px]">${WAJAH[j]}</span>
      <span class="text-[11px] text-white/40">${j + 1}</span>
    </div>`;
  }).join('');

  /* Daerah yang menilai paling rendah — ini yang perlu dihubungi lebih dulu. */
  const rendah = rows
    .filter(r => Number((r.jawaban || {})[k]) >= 1)
    .sort((a, b) => Number(a.jawaban[k]) - Number(b.jawaban[k]) || String(a.kab || '').localeCompare(String(b.kab || '')))
    .slice(0, 6);

  return `
  <div class="glass sva-naik mt-4 rounded-3xl border-fuchsia-400/25 p-5 md:p-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="text-[11px] uppercase tracking-[0.16em] text-white/45">Bedah unsur</p>
        <p class="mt-1 text-[17px] font-semibold">${aman(NAMA_UNSUR[k][1])}</p>
        <p class="mt-1 text-[12px] text-white/50">Rata-rata ${nomor(rata, 2)} dari 4 · setara indeks ${nomor(rata == null ? null : rata * 25, 1)} · ${jml} penilai</p>
      </div>
      <button id="svTutupUnsur" class="rounded-full border border-white/15 px-3.5 py-1.5 text-[12px] text-white/60 transition hover:bg-white/10">Tutup</button>
    </div>
    <div class="mt-5 grid gap-6 md:grid-cols-2">
      <div class="flex items-end gap-3">${kolom}</div>
      <div>
        <p class="text-[12px] text-white/45">Penilaian terendah pada unsur ini</p>
        <div class="mt-2 divide-y divide-white/8">
          ${rendah.length ? rendah.map(r => `
            <div class="flex items-center justify-between gap-3 py-2">
              <span class="truncate text-[13px] text-white/80">${aman(r.kab || '—')}<span class="ml-1.5 text-[11px] text-white/35">${aman(r.prov || '')}</span></span>
              <span class="shrink-0 text-[13px] tabular-nums">${WAJAH[Number(r.jawaban[k]) - 1] || ''} ${aman(r.jawaban[k])}</span>
            </div>`).join('')
          : '<p class="py-3 text-[13px] text-white/40">Belum ada jawaban pada unsur ini.</p>'}
        </div>
      </div>
    </div>
  </div>`;
}

/* ── 6. peringkat wilayah ─────────────────────────────────────── */
function grafikWilayah(rows) {
  /* Tanpa penyaring provinsi, dikelompokkan per provinsi; begitu satu provinsi
     dipilih, kartunya berganti sendiri menjadi peringkat kabupaten/kota. */
  const perKab = !!SARING.prov;
  const kunci = r => (perKab ? r.kab : r.prov) || '(tanpa nama)';

  const kel = {};
  rows.forEach(r => {
    const n = nilaiIndeks(r);
    if (n == null) return;
    (kel[kunci(r)] = kel[kunci(r)] || []).push(n);
  });
  const daftar = Object.entries(kel)
    .map(([nama, v]) => ({ nama, rata: v.reduce((a, b) => a + b, 0) / v.length, n: v.length }))
    .sort((a, b) => b.rata - a.rata);

  if (!daftar.length) return '<p class="text-[13px] text-white/40">Belum ada indeks yang dapat diperingkat.</p>';

  const baris = daftar.map((d, i) => {
    const h = HURUF_MUTU(d.rata);
    return `<${perKab ? 'div' : 'button'} ${perKab ? '' : `data-prov="${aman(d.nama)}"`}
        class="block w-full rounded-2xl px-3 py-2 text-left transition ${perKab ? '' : 'sva-klik hover:bg-white/[0.05]'}">
      <div class="flex items-baseline justify-between gap-3">
        <span class="truncate text-[13px] text-white/80"><span class="mr-1.5 text-white/30 tabular-nums">${i + 1}.</span>${aman(d.nama)}</span>
        <span class="shrink-0 text-[12px] tabular-nums text-white/60">${nomor(d.rata, 1)} <span class="text-white/25">· ${d.n}</span></span>
      </div>
      <div class="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div class="sva-tumbuh h-full rounded-full" style="width:${Math.max(2, d.rata).toFixed(1)}%;background:${WARNA_MUTU[h]};animation-delay:${Math.min(i * 0.04, 0.4).toFixed(2)}s"
             data-tip="${aman(d.nama)}\nindeks rata-rata ${nomor(d.rata, 1)} · mutu ${h}\n${d.n} penilaian"></div>
      </div>
    </${perKab ? 'div' : 'button'}>`;
  }).join('');

  return `<div class="-mx-1 max-h-[330px] overflow-y-auto pr-1">${baris}</div>
    ${perKab ? '' : '<p class="mt-3 px-3 text-[11px] text-white/35">Ketuk provinsi untuk menyaring seluruh halaman ini.</p>'}`;
}

/* ── 7. skor petugas desk ─────────────────────────────────────── */
function grafikPetugas(rows) {
  const kumpul = (kunciNama, kunciSkor, peran) => {
    const kel = {};
    rows.forEach(r => {
      const j = r.jawaban || {};
      const nama = j[kunciNama];
      const s = Number(j[kunciSkor]);
      if (!nama || !(s >= 1)) return;
      (kel[nama] = kel[nama] || []).push(s);
    });
    return Object.entries(kel).map(([nama, v]) => ({
      nama, peran, rata: v.reduce((a, b) => a + b, 0) / v.length, n: v.length
    }));
  };
  const daftar = kumpul('deskWilayah', 'skorWilayah', 'Koordinator wilayah')
    .concat(kumpul('deskVerifikator', 'skorVerifikator', 'Verifikator'))
    .sort((a, b) => b.rata - a.rata || b.n - a.n);

  if (!daftar.length) return '<p class="text-[13px] text-white/40">Belum ada penilaian petugas.</p>';

  const bintang = (rata) => [1, 2, 3, 4, 5].map(n => {
    const isi = rata >= n - 0.25;
    return `<svg viewBox="0 0 24 24" class="h-3.5 w-3.5 ${isi ? 'text-amber-300' : 'text-white/15'}" fill="${isi ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M12 3.6l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L3.4 10l6-.8z"/></svg>`;
  }).join('');

  return `<div class="grid gap-2.5 sm:grid-cols-2">
    ${daftar.map(d => `
      <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5"
           data-tip="${aman(d.nama)} · ${aman(d.peran)}\nrata-rata ${nomor(d.rata, 2)} dari 5\n${d.n} penilaian pemda">
        <div class="flex items-baseline justify-between gap-2">
          <span class="truncate text-[13px] font-medium text-white/85">${aman(d.nama)}</span>
          <span class="shrink-0 text-[13px] tabular-nums text-amber-200">${nomor(d.rata, 2)}</span>
        </div>
        <p class="mt-0.5 text-[11px] text-white/40">${aman(d.peran)} · ${d.n} penilai</p>
        <div class="mt-2 flex items-center gap-0.5">${bintang(d.rata)}</div>
        <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div class="sva-tumbuh h-full rounded-full bg-amber-300/80" style="width:${(d.rata / 5 * 100).toFixed(1)}%"></div>
        </div>
      </div>`).join('')}
  </div>`;
}

/* ── tooltip melayang, dipakai bersama seluruh grafik ─────────── */
function pasangTip(akar) {
  let tip = el('#svTip');
  if (!tip) { tip = document.createElement('div'); tip.id = 'svTip'; document.body.appendChild(tip); }
  const sembunyi = () => { tip.style.opacity = '0'; };
  sembunyi();
  akar.querySelectorAll('[data-tip]').forEach(n => {
    n.addEventListener('mouseenter', () => { tip.textContent = n.dataset.tip; tip.style.opacity = '1'; });
    n.addEventListener('mousemove', e => {
      tip.style.left = Math.min(window.innerWidth - 20, Math.max(20, e.clientX)) + 'px';
      tip.style.top = e.clientY - 10 + 'px';
    });
    n.addEventListener('mouseleave', sembunyi);
  });
  akar.onmouseleave = sembunyi;   // wadahnya tetap sama tiap render, jadi bukan addEventListener
}

/** Daftar provinsi yang benar-benar ada isinya, beserta jumlah penilaiannya. */
function pilihanProvinsi() {
  const c = {};
  rekapDasar().forEach(r => { const p = r.prov || ''; if (p) c[p] = (c[p] || 0) + 1; });
  return Object.keys(c).sort((a, b) => a.localeCompare(b)).map(p => ({ prov: p, n: c[p] }));
}

function bilahSaring() {
  const gaya = 'glass rounded-full px-5 py-2.5 text-[13px] font-medium text-white outline-none [&>option]:bg-ink';
  const provs = pilihanProvinsi();
  const tampil = rekapTampil();
  const dasar = rekapDasar().length;
  const c = cacahLuar();
  const rgd = ringkasGandaSurvei();
  const tersaring = REKAP.length - dasar;

  /* Uraian selisih: berapa penilaian yang masuk, berapa yang dipakai, dan
     apa sebab sisanya tidak ikut dihitung. Tanpa ini angka rekap survei
     tampak tidak sejalan dengan rekap pre/post test tanpa keterangan. */
  const uraian = ['luar', 'nontest', 'lepas', 'pfid']
    .filter(k => c[k] && !(k === 'lepas' && LANDASAN === 'pemda'))
    .map(k => c[k] + ' ' + SEBAB_LUAR[k]).join(' &middot; ');

  return `
    <div class="mt-6 rounded-3xl border border-white/12 bg-white/[0.04] px-5 py-4 text-[13px] leading-[1.7] text-white/65">
      <b class="text-white/85">${REKAP.length} penilaian masuk</b>, ${dasar} dipakai pada rekap ini.
      ${tersaring ? 'Disisihkan: ' + uraian + '.' : 'Seluruhnya sejalan dengan data pre/post test.'}
      ${rgd.berlebih ? `<span class="block">${rgd.pemda} pemda mengisi lebih dari sekali — <b class="text-white/85">${rgd.berlebih} penilaian berlebih</b>. Penilaian yang paling utuh ditandai <b>utama</b>; pakai penyaring <b>Penilaian berlebih</b> lalu centang “Pilih semua” untuk menghapusnya sekaligus.</span>` : ''}
      <span class="block text-[12px] text-white/40">Landasannya disamakan dengan rekap pre &amp; post test: ${wilayahDak().size} daerah penerima DAK, dan pemdanya memang mengerjakan tesnya. Yang disisihkan hanya disembunyikan — pilih “Semua penilaian” untuk memeriksa lalu menghapusnya.</span>
    </div>

    <div class="mt-4 flex flex-wrap items-center gap-3">
      <select id="svLandasan" class="${gaya}" title="Dasar penghitungan rekap survei">
        <option value="pemda"${LANDASAN === 'pemda' ? ' selected' : ''}>Sesuai data pre/post test (${REKAP.length - c.pfid - c.luar - c.nontest})</option>
        <option value="ketat"${LANDASAN === 'ketat' ? ' selected' : ''}>Ketat: penilai peserta terdaftar (${c.sesuai})</option>
        <option value="semua"${LANDASAN === 'semua' ? ' selected' : ''}>Semua penilaian (${REKAP.length})</option>
      </select>
      <select id="svGanda" class="${gaya}" title="Pemda yang mengisi survei lebih dari sekali">
        <option value="">Semua penilai</option>
        <option value="ganda"${SARING.ganda === 'ganda' ? ' selected' : ''}>Pemda yang mengisi &gt;1 kali${rgd.pemda ? ' (' + (rgd.pemda + rgd.berlebih) + ')' : ''}</option>
        <option value="berlebih"${SARING.ganda === 'berlebih' ? ' selected' : ''}>Penilaian berlebih${rgd.berlebih ? ' (' + rgd.berlebih + ')' : ''}</option>
        <option value="satu"${SARING.ganda === 'satu' ? ' selected' : ''}>Satu penilaian per pemda (${dasar - rgd.berlebih})</option>
      </select>
      <select id="svProv" class="${gaya}" title="Saring menurut provinsi">
        <option value="">Semua provinsi${dasar ? ' (' + dasar + ')' : ''}</option>
        ${provs.map(p => `<option value="${aman(p.prov)}"${SARING.prov === p.prov ? ' selected' : ''}>${aman(p.prov)} (${p.n})</option>`).join('')}
      </select>
      <select id="svMutu" class="${gaya}" title="Saring menurut mutu pelayanan">
        <option value="">Semua mutu</option>
        ${['A', 'B', 'C', 'D'].map(h => `<option value="${h}"${SARING.mutu === h ? ' selected' : ''}>${h} · ${ARTI_MUTU[h]}</option>`).join('')}
      </select>
      <div class="glass flex items-center gap-2 rounded-full px-5 py-2.5">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" class="h-4 w-4 text-white/50"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input id="svCari" value="${aman(SARING.cari)}" placeholder="Cari pemda atau penilai" class="w-48 bg-transparent text-[13px] outline-none placeholder:text-white/40" />
      </div>
      ${adaSaringan() ? `<button id="svReset" class="rounded-full border border-fuchsia-400/40 bg-fuchsia-400/10 px-4 py-2.5 text-[13px] font-medium text-fuchsia-200 transition hover:bg-fuchsia-400/20">
        ${tampil.length} dari ${dasar} · hapus penyaring</button>` : ''}
      <div class="ml-auto flex flex-wrap gap-2">
        <button id="svAdmMuat" class="rounded-full border border-white/20 px-5 py-2.5 text-[13px] font-medium text-white/85 transition hover:bg-white/10">Muat ulang</button>
        <!-- jawaban yang terlanjur masuk lewat Google Formulir putaran pertama -->
        <button id="svAdmImpor" ${TW_REKAP === 2 ? '' : 'hidden'} class="rounded-full border border-sky-400/50 bg-sky-500/15 px-5 py-2.5 text-[13px] font-medium text-sky-200 transition hover:bg-sky-500/25">Impor Google Formulir</button>
        <!-- pengisian coba-coba saat uji coba perlu bisa dibuang dari rekap -->
        <button id="svAdmHapus" disabled
                class="rounded-full border border-red-400/50 bg-red-500/15 px-5 py-2.5 text-[13px] font-medium text-red-200 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-40">
          Hapus terpilih <span id="svAdmHapusJml"></span>
        </button>
        <button id="svAdmExcel" class="cta-glow rounded-full bg-white px-5 py-2.5 text-[13px] font-medium text-black"${tampil.length ? '' : ' disabled style="opacity:.4"'}>Unduh Excel</button>
      </div>
    </div>`;
}

function bagianInfografis(rows) {
  const ikm = (() => {
    const v = rows.map(nilaiIndeks).filter(n => typeof n === 'number');
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : null;
  })();

  /* Unsur terkuat dan terlemah dijadikan satu kalimat, supaya kesimpulannya
     terbaca tanpa harus menafsirkan grafiknya lebih dulu. */
  const nilai = UNSUR.map(k => ({ k, v: rataUnsur(rows, k) })).filter(x => x.v != null);
  const urut = nilai.slice().sort((a, b) => b.v - a.v);
  const ringkas = urut.length
    ? `Unsur terkuat: ${NAMA_UNSUR[urut[0].k][1]} (${nomor(urut[0].v, 2)}). Paling perlu perhatian: ${NAMA_UNSUR[urut[urut.length - 1].k][1]} (${nomor(urut[urut.length - 1].v, 2)}).`
    : '';

  return `
    <div class="mt-6 grid gap-4 lg:grid-cols-3">
      ${bungkusGrafik('Indeks kepuasan' + (SARING.prov ? ' · ' + SARING.prov : ''),
        'Rata-rata tujuh unsur × 25, mengikuti cara hitung IKM.',
        `<div class="flex justify-center">${grafikJarum(ikm, rows.length)}</div>`)}
      ${bungkusGrafik('Tujuh unsur pelayanan', 'Ketuk salah satu sudut untuk membedah unsurnya.', grafikRadar(rows))}
      ${bungkusGrafik('Sebaran mutu', 'Berapa banyak pemda pada tiap kelas mutu.', grafikDonat(rows))}
    </div>

    ${ringkas ? `<p class="sva-naik mt-4 rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/[0.07] px-5 py-3 text-[13px] leading-relaxed text-fuchsia-100/90">${aman(ringkas)}</p>` : ''}

    <div class="mt-4 grid gap-4 lg:grid-cols-2">
      ${bungkusGrafik('Sebaran jawaban tiap unsur', 'Panjang warna = banyaknya pemda yang memberi nilai itu.', grafikSebaran(rows))}
      ${bungkusGrafik(SARING.prov ? 'Peringkat kabupaten/kota' : 'Peringkat provinsi',
        SARING.prov ? 'Indeks tiap pemda di ' + SARING.prov + '.' : 'Indeks rata-rata dan jumlah penilaian.',
        grafikWilayah(rows))}
    </div>

    ${panelUnsur(rows)}

    <div class="mt-4">
      ${bungkusGrafik('Skor pelayanan petugas desk', 'Rata-rata bintang 1–5 dari pemda yang dilayani.', grafikPetugas(rows))}
    </div>`;
}

/** Lencana penilaian ganda: berapa penilaian di pemda itu dan perannya. */
function lencanaGanda(r) {
  const g = petaGanda().get(r.id);
  if (!g) return '';
  const warna = g.peran === 'utama' ? 'bg-sky-400/20 text-sky-300' : 'bg-fuchsia-400/25 text-fuchsia-300';
  return `<span class="mr-1 mt-1 inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${warna}">${g.n} penilaian &middot; ${g.peran}</span>`;
}

/** Lencana sebab satu penilaian berada di luar landasan rekap. */
function lencanaLuar(r) {
  const sebab = sebabLuar(r);
  if (!sebab) return '';
  return `<span class="mt-1 inline-block whitespace-nowrap rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">${aman(SEBAB_LUAR[sebab])}</span>`;
}

function renderAdminSurvei() {
  const wadah = el('#adSurvei');
  if (!wadah) return;
  lupakanPadanan();
  lupakanGanda();

  /* Jumlah responden ikut tercetak di tabnya, supaya admin tahu ada isinya
     tanpa perlu membuka tab itu dulu. Yang dihitung selalu keseluruhan. */
  const jml = el('#adTabSurveiJml');
  if (jml) jml.textContent = rekapDasar().length ? ' · ' + rekapDasar().length : '';

  const rows = rekapTampil();
  const rata = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : null;
  const ikm = rata(rows.map(nilaiIndeks).filter(n => typeof n === 'number'));
  const skorPetugas = rata(rows.flatMap(r => [Number((r.jawaban || {}).skorWilayah), Number((r.jawaban || {}).skorVerifikator)].filter(n => n >= 1)));
  const adaPungutan = rows.filter(r => (r.jawaban || {}).biaya === 'Ada Penarikan' || (r.jawaban || {}).imbalan === 'Ya').length;
  const provAda = new Set(rows.map(r => r.prov).filter(Boolean)).size;

  /* Kolom pencarian dibangun ulang tiap render, jadi kursornya dikembalikan. */
  const sedangCari = document.activeElement && document.activeElement.id === 'svCari';

  wadah.innerHTML = GAYA_ADM + `
    <div class="mb-5 flex flex-wrap items-center gap-3">
      <div class="glass inline-flex rounded-full p-1" role="tablist" aria-label="Triwulan survei">
        ${[3, 2].map(tw => `<button data-svtw="${tw}" role="tab" aria-selected="${TW_REKAP === tw}"
          class="rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition ${TW_REKAP === tw ? 'bg-white text-black' : 'text-white/65 hover:text-white'}">
          ${LABEL_TW[tw]}${tw === TW_ISI ? ' · aktif' : ' · arsip'}${REKAP_TW[tw] ? ' (' + REKAP_TW[tw].length + ')' : ''}</button>`).join('')}
      </div>
      <p class="text-[12.5px] text-white/50">${aman(judulKegiatan(TW_REKAP))}</p>
    </div>
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      ${kartuAngka('Responden', rows.length, SARING.prov ? 'pemda di ' + SARING.prov
        : LANDASAN === 'semua' ? provAda + ' provinsi · seluruh penilaian'
        : provAda + ' provinsi · sesuai data tes')}
      ${kartuAngka('Indeks kepuasan', ikm == null ? '—' : ikm, MUTU(ikm),
        ikm == null ? '' : 'text-' + ({ A: 'emerald', B: 'sky', C: 'amber', D: 'rose' }[HURUF_MUTU(ikm)]) + '-300')}
      ${kartuAngka('Skor petugas', skorPetugas == null ? '—' : skorPetugas, 'rata-rata dari 5')}
      ${kartuAngka('Laporan pungutan', adaPungutan, adaPungutan ? 'perlu ditindaklanjuti' : 'tidak ada laporan',
        adaPungutan ? 'text-red-400' : '')}
    </div>

    ${REKAP_GALAT ? `<div class="mt-5 rounded-3xl border border-amber-400/40 bg-amber-400/10 px-5 py-4 text-[13px] text-amber-200">${aman(REKAP_GALAT)}</div>` : ''}

    ${bilahSaring()}

    ${rows.length ? bagianInfografis(rows) : ''}

    <div class="glass mt-6 overflow-hidden rounded-3xl">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[900px] text-left text-[13px]">
          <thead class="bg-white/[0.06] text-[11px] uppercase tracking-wider text-white/50">
            <tr>
              <th class="w-10 px-4 py-3">
                <input id="svPilihSemua" type="checkbox" class="h-4 w-4 cursor-pointer accent-white/90" title="Pilih semua" />
              </th>
              <th class="px-4 py-3 font-medium">Pemda</th>
              <th class="px-4 py-3 font-medium">Penilai</th>
              <th class="px-4 py-3 font-medium">Indeks</th>
              <th class="px-4 py-3 font-medium">Mutu</th>
              <th class="px-4 py-3 font-medium">Desk wilayah</th>
              <th class="px-4 py-3 font-medium">Skor</th>
              <th class="px-4 py-3 font-medium">Waktu</th>
              <th class="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/8">
            ${rows.length ? rows.map(r => `
              <tr class="transition hover:bg-white/[0.04]">
                <td class="px-4 py-3"><input type="checkbox" class="svPilih h-4 w-4 cursor-pointer accent-white/90" value="${aman(r.id)}" /></td>
                <td class="px-4 py-3 font-medium">${aman(r.kab || '—')}<span class="block text-[11px] text-white/40">${aman(r.prov || '')}</span>${lencanaGanda(r)}${lencanaLuar(r)}</td>
                <td class="px-4 py-3 text-white/75">${aman(r.nama || '—')}<span class="block text-[11px] text-white/40">${aman((r.jawaban || {}).hp || r.email || '')}</span></td>
                <td class="px-4 py-3 tabular-nums">${nilaiIndeks(r) == null ? '—' : aman(nilaiIndeks(r))}</td>
                <td class="px-4 py-3 text-white/70">${aman(MUTU(nilaiIndeks(r)))}</td>
                <td class="px-4 py-3 text-white/70">${aman((r.jawaban || {}).deskWilayah || '—')}</td>
                <td class="px-4 py-3 tabular-nums">${aman((r.jawaban || {}).skorWilayah || '—')}</td>
                <td class="px-4 py-3 text-white/50">${aman(waktuTeks(r.dikirimAt))}</td>
                <td class="px-4 py-3 text-right">
                  <button data-detail="${aman(r.id)}" class="rounded-full border border-white/15 px-3 py-1.5 text-[12px] text-white/70 transition hover:bg-white/10">Lihat</button>
                  <button data-hapus="${aman(r.id)}" title="Hapus penilaian ini" class="ml-1.5 rounded-full border border-white/12 px-3 py-1.5 text-[12px] text-white/45 transition hover:border-red-400/40 hover:text-red-300">Hapus</button>
                </td>
              </tr>`).join('')
            : `<tr><td colspan="9" class="px-4 py-10 text-center text-white/45">${REKAP.length
                ? 'Tidak ada penilaian yang cocok dengan penyaring ini.'
                : 'Belum ada pemda yang mengisi survei.'}</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;

  pasangAdminSurvei();
  if (sedangCari) {
    const c = el('#svCari');
    if (c) { c.focus(); c.setSelectionRange(c.value.length, c.value.length); }
  }
}

/** Seluruh pendengar panel admin; dipasang ulang tiap kali isinya digambar. */
function pasangAdminSurvei() {
  const wadah = el('#adSurvei');
  if (!wadah) return;

  const gambarUlang = () => renderAdminSurvei();

  el('#svLandasan').onchange = e => {
    LANDASAN = e.target.value;
    /* Provinsi yang sedang disaring bisa saja lenyap bersama landasannya. */
    if (SARING.prov && !pilihanProvinsi().some(p => p.prov === SARING.prov)) SARING.prov = '';
    gambarUlang();
  };
  el('#svGanda').onchange = e => { SARING.ganda = e.target.value; gambarUlang(); };
  el('#svProv').onchange = e => { SARING.prov = e.target.value; gambarUlang(); };
  el('#svMutu').onchange = e => { SARING.mutu = e.target.value; gambarUlang(); };
  /* Pencarian diberi jeda: tanpa itu seluruh grafik digambar ulang — beserta
     animasinya — pada tiap ketukan huruf. */
  el('#svCari').oninput = e => {
    const isi = e.target.value;
    clearTimeout(JEDA_CARI);
    JEDA_CARI = setTimeout(() => { SARING.cari = isi; gambarUlang(); }, 220);
  };
  const reset = el('#svReset');
  if (reset) reset.onclick = () => { SARING = { prov: '', mutu: '', cari: '', ganda: '' }; gambarUlang(); };

  /* Grafik yang bisa diketuk: provinsi, mutu, dan unsur. */
  els('#adSurvei [data-prov]').forEach(t => t.onclick = () => {
    SARING.prov = SARING.prov === t.dataset.prov ? '' : t.dataset.prov;
    gambarUlang();
    wadah.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  els('#adSurvei [data-mutu]').forEach(t => t.onclick = () => {
    SARING.mutu = SARING.mutu === t.dataset.mutu ? '' : t.dataset.mutu;
    gambarUlang();
  });
  els('#adSurvei [data-unsur]').forEach(t => t.onclick = () => {
    UNSUR_PILIH = UNSUR_PILIH === t.dataset.unsur ? null : t.dataset.unsur;
    gambarUlang();
  });
  const tutup = el('#svTutupUnsur');
  if (tutup) tutup.onclick = () => { UNSUR_PILIH = null; gambarUlang(); };

  el('#svAdmMuat').onclick = () => window.SURVEI.renderAdmin(true);
  els('#adSurvei [data-svtw]').forEach(t => t.onclick = () => {
    const tw = Number(t.dataset.svtw);
    if (tw === TW_REKAP) return;
    TW_REKAP = tw;
    REKAP = (REKAP_TW[tw] || []).slice();
    SARING = { prov: '', mutu: '', cari: '', ganda: '' };
    UNSUR_PILIH = null;
    gambarUlang();
    /* Ceklis kesiapan memakai rekap triwulan yang sedang dipilih. */
    if (window.CEKLIS) window.CEKLIS.render();
  });
  el('#svAdmImpor').onclick = () => pilihBerkasImpor();
  el('#svAdmExcel').onclick = async () => {
    const t = el('#svAdmExcel');
    t.disabled = true; t.textContent = 'Menyusun…';
    try { toast('Berkas ' + (await unduhExcel()) + ' diunduh.'); }
    catch (e) { toast('Gagal membuat Excel: ' + e.message); }
    t.disabled = false; t.textContent = 'Unduh Excel';
  };

  els('#adSurvei [data-detail]').forEach(t => t.onclick = () => {
    const r = REKAP.find(x => x.id === t.dataset.detail);
    if (r) bukaDetail(r);
  });
  els('#adSurvei .svPilih').forEach(c => c.onchange = perbaruiPilihanSurvei);
  if (el('#svPilihSemua')) el('#svPilihSemua').onchange = e => {
    els('#adSurvei .svPilih').forEach(c => c.checked = e.target.checked);
    perbaruiPilihanSurvei();
  };
  els('#adSurvei [data-hapus]').forEach(t => t.onclick = () => {
    const r = REKAP.find(x => x.id === t.dataset.hapus);
    if (r) jalankanHapusSurvei([r]);
  });
  el('#svAdmHapus').onclick = () => {
    const dipilih = idTerpilihSurvei();
    jalankanHapusSurvei(REKAP.filter(r => dipilih.includes(r.id)));
  };

  pasangTip(wadah);
  perbaruiPilihanSurvei();
}

/* ── pilih dan hapus penilaian ─────────────────────────────────
   Uji coba aplikasi meninggalkan pengisian coba-coba yang ikut terhitung di
   indeks kepuasan, jadi admin perlu dapat membuangnya dari rekap. */
const idTerpilihSurvei = () => els('#adSurvei .svPilih').filter(c => c.checked).map(c => c.value);

function perbaruiPilihanSurvei() {
  const n = idTerpilihSurvei().length;
  const total = els('#adSurvei .svPilih').length;
  const tombol = el('#svAdmHapus');
  if (!tombol) return;
  tombol.disabled = n === 0;
  el('#svAdmHapusJml').textContent = n ? '(' + n + ')' : '';
  const semua = el('#svPilihSemua');
  if (semua) {
    semua.checked = total > 0 && n === total;
    semua.indeterminate = n > 0 && n < total;
  }
}

async function jalankanHapusSurvei(daftar) {
  if (!daftar || !daftar.length) return;
  const contoh = daftar.slice(0, 6).map(r => '• ' + (r.kab || '?') + ' — ' + (r.nama || 'tanpa nama')).join('\n');
  const sisa = daftar.length > 6 ? '\n• … dan ' + (daftar.length - 6) + ' lainnya' : '';
  if (!confirm(
    'Hapus ' + daftar.length + ' penilaian berikut?\n\n' + contoh + sisa +
    '\n\nJawabannya hilang dari rekap dan dari perhitungan indeks kepuasan, dan TIDAK dapat dipulihkan.' +
    '\nPemda yang bersangkutan dapat mengisi surveinya lagi dari awal.'
  )) return;

  const tombol = el('#svAdmHapus');
  if (tombol) { tombol.disabled = true; tombol.textContent = 'Menghapus…'; }

  const gagal = [];
  let sukses = 0;
  for (const r of daftar) {
    try { await hapusSurvei(r.id); sukses++; }
    catch (e) {
      console.error('[MonevDAK] penilaian gagal dihapus', r.id, e);
      gagal.push({ nama: r.kab || r.nama || r.id, kode: (e && e.code) || e.message });
    }
  }

  await window.SURVEI.renderAdmin();

  if (!gagal.length) {
    toast(sukses + ' penilaian dihapus.');
  } else {
    const izin = gagal.some(x => /permission/.test(String(x.kode)));
    alert(
      sukses + ' penilaian dihapus, ' + gagal.length + ' gagal.\n\n' +
      gagal.slice(0, 5).map(x => '• ' + x.nama + ' (' + x.kode + ')').join('\n') +
      (izin ? '\n\nFirestore menolak penghapusan. Pastikan firestore.rules versi terbaru sudah dipublikasikan dan email admin ini terdaftar pada adminEmail().' : '')
    );
  }
}

function bukaDetail(r) {
  const j = r.jawaban || {};
  const isi = PERTANYAAN.map(p => {
    const v = j[p.k];
    const tampil = p.tipe === 'skala' ? `${WAJAH[Number(v) - 1] || ''} ${v || '—'}`
                 : p.tipe === 'bintang' ? '★'.repeat(Number(v) || 0) + ' ' + (v || '')
                 : (v || '—');
    return `<div class="border-b border-white/8 py-3">
      <p class="text-[12px] text-white/45">${aman(p.judul)}</p>
      <p class="mt-1 text-[14px] text-white/90">${aman(tampil)}</p>
    </div>`;
  }).join('');

  const lama = el('#svDetail');
  if (lama) lama.remove();
  const m = document.createElement('div');
  m.id = 'svDetail';
  m.className = 'fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm md:p-10';
  m.innerHTML = `
    <div class="glass w-full max-w-2xl rounded-[2rem] p-6 md:p-8">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-[11px] uppercase tracking-[0.16em] text-white/45">Penilaian pemda</p>
          <p class="text-[18px] font-semibold">${aman(r.kab || '—')}</p>
          <p class="text-[12px] text-white/50">${aman(r.nama || '')} · ${aman(r.email || '')} · indeks ${nilaiIndeks(r) == null ? '—' : aman(nilaiIndeks(r))} (${aman(MUTU(nilaiIndeks(r)))})</p>
        </div>
        <button data-tutup class="rounded-full p-2 text-white/60 transition hover:bg-white/10 hover:text-white">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="h-5 w-5"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>
      <div class="mt-5 max-h-[70vh] overflow-y-auto pr-1">${isi}</div>
    </div>`;
  document.body.appendChild(m);
  m.querySelector('[data-tutup]').onclick = () => m.remove();
  m.onclick = e => { if (e.target === m) m.remove(); };
}


/* ═══════════════════════════════════════════════════════════════
   3b. IMPOR DARI GOOGLE FORMULIR

   Survei putaran pertama sempat berjalan di Google Formulir sebelum
   kuesionernya pindah ke dalam aplikasi. Jawaban yang terlanjur masuk di
   sana tidak boleh hilang dari rekap, jadi berkas ekspornya (.csv) bisa
   dimuat langsung dari panel admin.

   Dua hal yang membedakannya dari pengisian biasa:
     - Respondennya belum tentu punya akun. Bila emailnya tidak ketemu di
       daftar peserta, dibuatkan id bayangan `gform-…` supaya penilaiannya
       tetap terhitung. Kelonggaran ini khusus survei kepuasan — nilai pre
       dan post test tetap harus dari akun sungguhan.
     - Daerahnya ditebak dari kolom "Instansi Daerah Asal" yang berupa teks
       bebas, lalu dicocokkan dengan daftar penerima DAK. Tebakannya selalu
       ditampilkan lebih dulu untuk diperiksa, tidak pernah langsung disimpan.
   ═══════════════════════════════════════════════════════════════ */

const PREFIKS_GFORM = 'gform-';

/* Singkatan yang lazim dipakai daerah menuliskan instansinya. */
const ALIAS_DAERAH = {
  tts: 'Timor Tengah Selatan', ttu: 'Timor Tengah Utara',
  sbd: 'Sumba Barat Daya', oki: 'Ogan Komering Ilir',
  'oku timur': 'Ogan Komering Ulu Timur', okut: 'Ogan Komering Ulu Timur',
  sitaro: 'Kepulauan Siau Tagulandang Biaro', pangkep: 'Pangkajene dan Kepulauan',
  sidrap: 'Sidenreng Rappang', yapen: 'Kepulauan Yapen',
  tanimbar: 'Kepulauan Tanimbar', mtb: 'Kepulauan Tanimbar',
  anambas: 'Kepulauan Anambas', pegaf: 'Pegunungan Arfak'
};

/** Pembaca CSV yang mengerti tanda kutip, koma di dalam sel, dan baris
    bersambung — kolom isian bebas Google Formulir penuh ketiganya. */
function uraiCsv(teks) {
  const baris = [];
  let sel = '', satu = [], kutip = false;
  const t = String(teks || '').replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (kutip) {
      if (c === '"') { if (t[i + 1] === '"') { sel += '"'; i++; } else kutip = false; }
      else sel += c;
    } else if (c === '"') kutip = true;
    else if (c === ',') { satu.push(sel); sel = ''; }
    else if (c === '\r') { /* diabaikan; \n yang menutup baris */ }
    else if (c === '\n') { satu.push(sel); baris.push(satu); satu = []; sel = ''; }
    else sel += c;
  }
  if (sel !== '' || satu.length) { satu.push(sel); baris.push(satu); }
  return baris.filter(b => b.some(x => String(x).trim() !== ''));
}

/** Nomor kolom dicari dari kata kunci judulnya, bukan urutannya, supaya
    ekspor Google Formulir yang kolomnya bergeser tetap terbaca. */
function petaKolom(kepala) {
  const cari = re => kepala.findIndex(h => re.test(String(h)));
  const k = {
    waktu:        cari(/timestamp|stempel waktu/i),
    nama:         cari(/^\s*nama\s*$/i),
    instansi:     cari(/instansi/i),
    email:        cari(/^\s*email\s*$/i),
    hp:           cari(/handphone|no\.?\s*hp|telepon/i),
    prosedur:     cari(/kemudahan prosedur/i),
    persyaratan:  cari(/kesesuaian persyaratan/i),
    kecepatan:    cari(/kecepatan pelayanan/i),
    kompetensi:   cari(/kompetensi/i),
    perilaku:     cari(/perilaku petugas/i),
    pengaduan:    cari(/penanganan pengaduan/i),
    informasi:    cari(/informasi yang didapat/i),
    biaya:        cari(/penarikan biaya/i),
    imbalan:      cari(/imbalan/i),
    kurang:       cari(/kurang berkenan/i),
    berkesan:     cari(/paling berkesan/i),
    harapan:      cari(/harapan/i),
    deskWilayah:  cari(/petugas desk koordinator/i),
    deskVerifikator: cari(/petugas desk verifikator/i)
  };
  /* Skor dan alasan tidak punya judul yang khas — keduanya bernama sama
     persis pada dua pasang kolom. Yang menentukan letaknya: keduanya selalu
     mengikuti kolom nama petugasnya. */
  if (k.deskWilayah >= 0)     { k.skorWilayah = k.deskWilayah + 1;     k.alasanWilayah = k.deskWilayah + 2; }
  if (k.deskVerifikator >= 0) { k.skorVerifikator = k.deskVerifikator + 1; k.alasanVerifikator = k.deskVerifikator + 2; }
  return k;
}

/** "2026/08/05 4:21:57 pm GMT+7" — bukan bentuk yang dimengerti Date(). */
function waktuGform(s) {
  const m = String(s || '').match(/(\d{4})\/(\d{1,2})\/(\d{1,2})[ ,]+(\d{1,2}):(\d{2}):(\d{2})\s*(am|pm)?\s*(?:GMT\s*([+-]\d{1,2}))?/i);
  if (!m) return null;
  let jam = Number(m[4]);
  const ap = (m[7] || '').toLowerCase();
  if (ap === 'pm' && jam < 12) jam += 12;
  if (ap === 'am' && jam === 12) jam = 0;
  const zona = Number(m[8] || 0);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], jam - zona, +m[5], +m[6]));
}

/** Daerah ditebak dari teks bebas, dicocokkan dengan penerima DAK. */
function cocokDaerah(teks) {
  const t = ' ' + norm(teks || '') + ' ';
  if (t.trim() === '') return null;
  const sebutKota = / kota /.test(t);
  const W = window.WILAYAH || {};

  /* Dua lintasan: yang pertama menuntut "kota" pada instansinya cocok dengan
     jenis daerahnya, supaya Kota Magelang tidak tertukar dengan Kab Magelang.
     Nama terpanjang menang — "Konawe Utara" mengalahkan "Konawe". */
  for (const ketat of [true, false]) {
    let terbaik = null;
    Object.keys(W).forEach(prov => {
      String(W[prov] || '').split(',').filter(Boolean).forEach(kab => {
        const kota = /^Kota /.test(kab);
        if (ketat && kota !== sebutKota) return;
        const inti = norm(kab.replace(/^Kota /, ''));
        if (!inti || t.indexOf(' ' + inti + ' ') < 0) return;
        if (!terbaik || inti.length > terbaik.n) terbaik = { prov, kab, n: inti.length };
      });
    });
    if (terbaik) return { prov: terbaik.prov, kab: terbaik.kab };
  }

  for (const sing of Object.keys(ALIAS_DAERAH)) {
    if (t.indexOf(' ' + sing + ' ') < 0) continue;
    const nama = ALIAS_DAERAH[sing];
    const prov = Object.keys(W).find(p => String(W[p] || '').split(',').includes(nama));
    if (prov) return { prov, kab: nama };
  }
  return null;
}

/** Akun peserta dengan email yang sama — supaya penilaiannya menempel pada
    akunnya sendiri, bukan menjadi baris kembar dengan id bayangan. */
function akunDenganEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  if (!e || e === '-') return null;
  const daftar = (typeof ADATA !== 'undefined' && ADATA.peserta) || [];
  return daftar.find(p => String(p.email || '').trim().toLowerCase() === e) || null;
}

function susunImpor(teks) {
  const baris = uraiCsv(teks);
  if (baris.length < 2) throw new Error('Berkasnya kosong atau bukan CSV.');
  const kol = petaKolom(baris[0]);
  if (kol.prosedur < 0 || kol.nama < 0)
    throw new Error('Judul kolomnya tidak dikenali. Pastikan yang diunggah ekspor CSV dari Google Formulir kuesioner ini.');

  const ambil = (b, i) => (i >= 0 && i < b.length) ? String(b[i]).trim() : '';
  const angka = v => { const n = Number(String(v).replace(/[^\d]/g, '')); return n > 0 ? n : null; };

  return baris.slice(1).map(b => {
    const nama     = ambil(b, kol.nama);
    const instansi = ambil(b, kol.instansi);
    const email    = ambil(b, kol.email);
    const daerah   = cocokDaerah(instansi);

    const jawaban = {
      hp: ambil(b, kol.hp),
      prosedur: angka(ambil(b, kol.prosedur)), persyaratan: angka(ambil(b, kol.persyaratan)),
      kecepatan: angka(ambil(b, kol.kecepatan)), kompetensi: angka(ambil(b, kol.kompetensi)),
      perilaku: angka(ambil(b, kol.perilaku)), pengaduan: angka(ambil(b, kol.pengaduan)),
      informasi: angka(ambil(b, kol.informasi)),
      biaya: ambil(b, kol.biaya), imbalan: ambil(b, kol.imbalan),
      kurang: ambil(b, kol.kurang), berkesan: ambil(b, kol.berkesan), harapan: ambil(b, kol.harapan),
      deskWilayah: ambil(b, kol.deskWilayah), skorWilayah: angka(ambil(b, kol.skorWilayah)),
      alasanWilayah: ambil(b, kol.alasanWilayah),
      deskVerifikator: ambil(b, kol.deskVerifikator), skorVerifikator: angka(ambil(b, kol.skorVerifikator)),
      alasanVerifikator: ambil(b, kol.alasanVerifikator)
    };

    const akun = akunDenganEmail(email) || akunDenganEmail(ambil(b, 1));
    const id = akun ? akun.pid
             : PREFIKS_GFORM + (slug(email && email !== '-' ? email.split('@')[0] : nama) || 'tanpa-nama').slice(0, 48);

    return {
      id, akun: !!akun, instansi, nama, email: email === '-' ? '' : email,
      prov: daerah ? daerah.prov : (akun ? akun.prov : ''),
      kab:  daerah ? daerah.kab  : (akun ? akun.kab  : ''),
      cocok: !!daerah,
      waktu: waktuGform(ambil(b, kol.waktu)),
      jawaban, indeks: indeksKepuasan(jawaban)
    };
  }).filter(r => r.nama || r.email);
}

async function tulisImpor(daftar) {
  if (pakaiFirebase()) {
    const { doc, setDoc, serverTimestamp } = store.fs;
    for (const r of daftar) {
      await setDoc(doc(store.db, KOLEKSI[TW_REKAP], r.id), {
        uid: r.id, nama: r.nama, prov: r.prov, kab: r.kab, email: r.email,
        jawaban: r.jawaban, indeks: r.indeks,
        /* Jejak asal-usul: dari mana datangnya, instansi apa adanya yang
           ditulis responden, dan kapan diimpor. */
        sumber: 'gform', instansiAsal: r.instansi, imporAt: serverTimestamp(),
        dikirimAt: r.waktu || serverTimestamp()
      });
    }
  } else {
    const semua = bacaLokal(TW_REKAP);
    daftar.forEach(r => {
      semua[r.id] = { uid: r.id, nama: r.nama, prov: r.prov, kab: r.kab, email: r.email,
        jawaban: r.jawaban, indeks: r.indeks, sumber: 'gform', instansiAsal: r.instansi,
        dikirimAt: r.waktu ? r.waktu.getTime() : Date.now() };
    });
    tulisLokal(semua, TW_REKAP);
  }
}

/** Pratinjau sebelum menyimpan: tebakan daerah dan baris yang akan tertimpa
    harus terlihat lebih dulu, karena keduanya yang paling mungkin keliru. */
function bukaImpor(daftar, namaBerkas) {
  const adaId = new Set(REKAP.map(r => r.id));
  const lolos = daftar.filter(r => r.cocok || r.akun);
  const ragu  = daftar.filter(r => !r.cocok && !r.akun);

  /* Baris yang daerahnya tidak dikenali dan pengisinya tidak punya akun
     hampir selalu pengisian coba-coba saat menyiapkan formulir — centangnya
     dilepas lebih dulu, tetapi tetap bisa dicentang lagi kalau memang nyata. */
  const barisPratinjau = (r, i) => `<tr class="border-b border-white/[.06]">
    <td class="px-3 py-2.5">
      <input type="checkbox" class="svImporPilih h-4 w-4 cursor-pointer rounded border-white/30 bg-transparent accent-sky-400"
             value="${i}"${(r.cocok || r.akun) ? ' checked' : ''} />
    </td>
    <td class="px-3 py-2.5">
      <p class="font-medium">${aman(r.nama || '—')}</p>
      <p class="text-[11px] text-white/40">${aman(r.email || 'tanpa email')}</p>
    </td>
    <td class="px-3 py-2.5 text-white/60">
      <p class="text-[12px]">${aman(r.instansi || '—')}</p>
      <p class="mt-0.5 text-[12px] ${r.cocok ? 'text-emerald-300' : 'text-amber-300'}">
        ${r.cocok ? '→ ' + aman(r.kab) + ', ' + aman(r.prov) : '→ daerah tidak dikenali'}</p>
    </td>
    <td class="px-3 py-2.5 text-center tabular-nums">${r.indeks == null ? '—' : aman(r.indeks)}</td>
    <td class="px-3 py-2.5 text-[12px]">
      ${r.akun ? '<span class="text-sky-300">akun terdaftar</span>'
               : '<span class="text-white/50">id bayangan</span>'}
      ${adaId.has(r.id) ? '<br><span class="text-amber-300">menimpa yang ada</span>' : ''}
    </td>
  </tr>`;

  const lama = el('#svImpor');
  if (lama) lama.remove();
  const m = document.createElement('div');
  m.id = 'svImpor';
  m.className = 'fixed inset-0 z-[92] flex items-start justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm md:p-10';
  m.innerHTML = `
    <div class="glass w-full max-w-4xl rounded-[2rem] p-6 md:p-8">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-[11px] uppercase tracking-[0.16em] text-white/45">Impor Google Formulir</p>
          <p class="text-[18px] font-semibold">${daftar.length} penilaian terbaca</p>
          <p class="text-[12px] text-white/50">${aman(namaBerkas)}</p>
        </div>
        <button data-tutup class="rounded-full p-2 text-white/60 transition hover:bg-white/10 hover:text-white">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="h-5 w-5"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>

      ${ragu.length ? `<div class="mt-5 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-[13px] leading-[1.7] text-amber-200/90">
        <span class="font-semibold">${ragu.length} baris daerahnya tidak dikenali</span> dan pengisinya tidak punya akun —
        biasanya pengisian coba-coba saat formulirnya disiapkan. Centangnya sudah dilepas; centang lagi bila memang nyata,
        tetapi baris itu tidak akan menyalakan ceklis daerah mana pun dan tidak terhitung pada peringkat provinsi.
      </div>` : ''}

      <div class="mt-5 max-h-[52vh] overflow-y-auto rounded-2xl border border-white/10">
        <table class="w-full min-w-[660px] text-left text-[13px]">
          <thead class="sticky top-0 border-b border-white/10 bg-ink/95 text-[10px] uppercase tracking-[0.14em] text-white/45">
            <tr>
              <th class="px-3 py-3 font-semibold">
                <input type="checkbox" id="svImporSemua" title="Pilih semua"
                       class="h-4 w-4 cursor-pointer rounded border-white/30 bg-transparent accent-sky-400" />
              </th>
              <th class="px-3 py-3 font-semibold">Pengisi</th>
              <th class="px-3 py-3 font-semibold">Instansi → daerah</th>
              <th class="px-3 py-3 text-center font-semibold">Indeks</th>
              <th class="px-3 py-3 font-semibold">Disimpan sebagai</th>
            </tr>
          </thead>
          <tbody>${daftar.map(barisPratinjau).join('')}</tbody>
        </table>
      </div>

      <div class="mt-5 flex flex-wrap items-center gap-3">
        <p class="text-[12px] leading-[1.7] text-white/45">
          ${lolos.length} dari ${daftar.length} baris menempel pada daerahnya.
          Mengimpor ulang berkas yang sama menimpa baris lama, bukan menggandakannya.
        </p>
        <span class="ml-auto flex gap-2">
          <button data-batal class="rounded-full border border-white/20 px-5 py-2.5 text-[13px] font-medium text-white/85 transition hover:bg-white/10">Batal</button>
          <button data-simpan class="cta-glow rounded-full bg-white px-5 py-2.5 text-[13px] font-medium text-black">Simpan</button>
        </span>
      </div>
    </div>`;

  document.body.appendChild(m);
  const tutup = () => m.remove();
  m.querySelector('[data-tutup]').onclick = tutup;
  m.querySelector('[data-batal]').onclick = tutup;
  m.onclick = e => { if (e.target === m) tutup(); };

  const centang = () => Array.from(m.querySelectorAll('.svImporPilih'));
  const terpilih = () => centang().filter(c => c.checked).map(c => daftar[Number(c.value)]);
  const tombol = m.querySelector('[data-simpan]');

  const perbarui = () => {
    const n = terpilih().length;
    tombol.disabled = n === 0;
    tombol.style.opacity = n ? '' : '.4';
    tombol.textContent = n ? 'Simpan ' + n + ' penilaian' : 'Tidak ada yang dipilih';
    const semua = m.querySelector('#svImporSemua');
    semua.checked = n === centang().length;
    semua.indeterminate = n > 0 && n < centang().length;
  };
  centang().forEach(c => c.onchange = perbarui);
  m.querySelector('#svImporSemua').onchange = e => {
    centang().forEach(c => c.checked = e.target.checked);
    perbarui();
  };
  perbarui();

  tombol.onclick = async () => {
    const pilih = terpilih();
    if (!pilih.length) return;
    tombol.disabled = true; tombol.textContent = 'Menyimpan…';
    try {
      await tulisImpor(pilih);
      tutup();
      await window.SURVEI.renderAdmin(true);
      if (window.CEKLIS) window.CEKLIS.render();
      toast(pilih.length + ' penilaian Google Formulir masuk ke rekap.');
    } catch (e) {
      console.error('[MonevDAK] impor gagal:', e);
      perbarui();
      alert('Gagal menyimpan: ' + ((e && e.code) || e.message) +
        (/permission/i.test(String((e && e.code) || e.message))
          ? '\n\nFirestore menolak penulisan. Aturan koleksi `survei` harus mengizinkan admin menulis dokumen milik orang lain — publikasikan ulang firestore.rules versi terbaru dari repositori.'
          : ''));
    }
  };
}

function pilihBerkasImpor() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.csv,text/csv';
  inp.onchange = () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    const baca = new FileReader();
    baca.onload = () => {
      try { bukaImpor(susunImpor(baca.result), f.name); }
      catch (e) { console.error(e); alert('Berkasnya tidak dapat dibaca.\n\n' + e.message); }
    };
    baca.readAsText(f, 'utf-8');
  };
  inp.click();
}


/* ═══════════════════════════════════════════════════════════════
   4. TITIK MASUK
   ═══════════════════════════════════════════════════════════════ */
window.SURVEI = {
  /** Menu survei hanya untuk akun pemda; petugas PFID bukan respondennya.
      Menunya ada di dua deretan — atas dan deretan bawah untuk ponsel. */
  syncNav() {
    els('[data-nav="survei"]').forEach(b => b.classList.toggle('hidden', !ME || pfidan()));
  },

  /** Tandai menu survei selama penilaiannya belum masuk. Titik kuning kecil
      itu satu-satunya pengingat yang terlihat tanpa membuka menunya. */
  tandaiBelum(belum) {
    els('[data-nav="survei"]').forEach(b => b.classList.toggle('nav-belum', !!belum));
  },

  /** Penilaian pemda ini sudah masuk atau belum. Dibaca dashboard untuk
      memutuskan ajakan mengisi; hasilnya disimpan supaya Firestore tidak
      ditanya berulang tiap kali dashboard digambar ulang. */
  async sudahDiisi(paksa) {
    if (!ME || pfidan()) return null;
    if (TERKIRIM) return TERKIRIM;
    if (DIPERIKSA && !paksa) return null;
    DIPERIKSA = true;
    try {
      const lama = await ambilSurveiSaya();
      DIMUAT = true;                       // sudah dibaca, render() tak perlu mengulang
      if (lama) { TERKIRIM = lama; JAWAB = { ...(lama.jawaban || {}) }; IDX = -1; }
      return lama;
    } catch (e) {
      console.warn('[MonevDAK] status survei tidak terbaca:', e);
      return null;
    }
  },

  async render() {
    if (!ME || pfidan()) return;
    /* Misi 3 TW III: terbuka setelah pre test dan konfirmasi data. */
    const kunci = window.TUTOR && window.TUTOR.kunciSurvei ? await window.TUTOR.kunciSurvei() : '';
    if (kunci) { const w = el('#view-survei'); if (w) w.innerHTML = window.TUTOR.layarSurveiTerkunci(kunci); return; }
    if (!DIMUAT) {
      DIMUAT = true;
      try {
        const lama = await ambilSurveiSaya();
        if (lama) {
          TERKIRIM = lama;
          JAWAB = { ...(lama.jawaban || {}) };
          IDX = -1;                    // langsung ke layar terima kasih
        }
      } catch (e) {
        console.warn('[MonevDAK] survei tersimpan tidak terbaca:', e);
      }
    }
    render();
  },

  async renderAdmin(paksa) {
    const wadah = el('#adSurvei');
    if (!wadah) return;
    if (paksa) REKAP = [];
    const w = x => (x.dikirimAt && x.dikirimAt.toMillis ? x.dikirimAt.toMillis() : Number(x.dikirimAt || 0));
    REKAP_GALAT = '';
    for (const tw of Object.keys(KOLEKSI).map(Number)) {
      try {
        REKAP_TW[tw] = (await semuaSurvei(tw)).sort((a, b) => w(b) - w(a));
      } catch (e) {
        REKAP_TW[tw] = [];
        if (tw === TW_REKAP) REKAP_GALAT = 'Hasil survei ' + LABEL_TW[tw] + ' tidak terbaca (' + (e.code || e.message)
          + '). Pastikan aturan Firestore untuk koleksi ' + KOLEKSI[tw] + ' sudah dipasang dan email admin ini terdaftar.';
      }
    }
    REKAP = REKAP_TW[TW_REKAP].slice();
    renderAdminSurvei();
    if (paksa) toast('Rekap survei dimuat ulang.');
  },

  /** Penilaian yang sudah masuk, dipakai ceklis kesiapan pemda di panel admin
      untuk menandai daerah mana yang surveinya sudah terisi. Salinan, bukan
      larik aslinya, supaya pemanggilnya tidak dapat mengubah rekap. */
  rekap() { return REKAP.slice(); },

  /** Penilaian semua triwulan, terbaru dulu. Untuk cadangan nomor telepon:
      nomor yang ditulis di TW II tetap berguna selama TW III belum diisi. */
  rekapSemua() {
    return Object.keys(KOLEKSI).map(Number).sort((a, b) => b - a).flatMap(tw => REKAP_TW[tw] || []);
  },

  /** Hapus penilaian TW III milik satu akun (reset uji coba di panel admin). */
  async hapusSaya(pid) { await hapusSurvei(pid, TW_ISI); },

  /** Keterangan galat bila rekapnya gagal terbaca; kosong berarti aman. */
  galatRekap() { return REKAP_GALAT; },

  /** Buang satu penilaian. Dipakai ceklis kesiapan pemda sewaktu
      membersihkan daerah yang bukan penerima DAK — profil peserta dan
      penilaian surveinya harus ikut terbuang bersama, kalau tidak daerahnya
      tetap muncul di ceklis lewat surveinya saja. */
  async hapus(id) { await hapusSurvei(id); },

  reset() {
    IDX = 0; JAWAB = {}; TERKIRIM = null; DIMUAT = false; DIPERIKSA = false; TINJAU = false; GALAT = '';
  }
};

})();
