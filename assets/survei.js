/* ═══════════════════════════════════════════════════════════════════════
   SURVEI KEPUASAN PEMERINTAH DAERAH

   Isi pertanyaannya diambil dari kuesioner Google Formulir milik PFID
   (forms.gle/qokEKXodasXaG9Be9), tetapi diisi di dalam aplikasi supaya:
     - nama, instansi, dan email tidak perlu diketik lagi — sudah ada di akun;
     - jawabannya masuk ke Firestore, jadi admin bisa merekap dan mengunduhnya
       sebagai Excel tanpa membuka Google Formulir;
     - pertanyaannya bisa disajikan satu per satu dengan tombol yang hidup,
       bukan gulungan formulir yang panjang.

   Satu pemda satu dokumen (`survei/{uid}`); mengisi ulang berarti memperbarui
   jawabannya sendiri, bukan menambah baris baru.
   ═══════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const LS_SURVEI = 'monevdak_survei';
const CDN_PIZZIP = 'https://unpkg.com/pizzip@3.2.0/dist/pizzip.min.js';

const JUDUL_KEGIATAN = 'Rapat Koordinasi TW II DAK Fisik Bidang Konektivitas Subbidang Jalan TA 2026';

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

const MUTU = n => n == null ? '—'
  : n >= 88.31 ? 'A · Sangat Baik'
  : n >= 76.61 ? 'B · Baik'
  : n >= 65    ? 'C · Kurang Baik'
  : 'D · Tidak Baik';


/* ═══════════════════════════════════════════════════════════════
   1. PENYIMPANAN
   ═══════════════════════════════════════════════════════════════ */
const bacaLokal = () => { try { return JSON.parse(localStorage.getItem(LS_SURVEI) || '{}'); } catch (e) { return {}; } };
const tulisLokal = x => { try { localStorage.setItem(LS_SURVEI, JSON.stringify(x)); } catch (e) {} };

async function ambilSurveiSaya() {
  const uid = (ME && (ME.uid || ME.pid)) || '';
  if (!uid) return null;
  if (pakaiFirebase()) {
    const { doc, getDoc } = store.fs;
    const d = await getDoc(doc(store.db, 'survei', uid));
    return d.exists() ? d.data() : null;
  }
  return bacaLokal()[uid] || null;
}

async function kirimSurvei(jawaban) {
  const uid = (ME && (ME.uid || ME.pid)) || '';
  if (!uid) throw new Error('Akun tidak dikenali.');
  const rekaman = {
    uid,
    nama: ME.nama || '',
    prov: ME.prov || '',
    kab: ME.kab || '',
    email: ME.email || '',
    jawaban,
    indeks: indeksKepuasan(jawaban)
  };
  if (pakaiFirebase()) {
    const { doc, setDoc, serverTimestamp } = store.fs;
    await setDoc(doc(store.db, 'survei', uid), { ...rekaman, dikirimAt: serverTimestamp() });
  } else {
    const semua = bacaLokal();
    semua[uid] = { ...rekaman, dikirimAt: Date.now() };
    tulisLokal(semua);
  }
  return rekaman;
}

async function semuaSurvei() {
  if (pakaiFirebase()) {
    const { collection, getDocs } = store.fs;
    const snap = await getDocs(collection(store.db, 'survei'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  return Object.entries(bacaLokal()).map(([id, x]) => ({ id, ...x }));
}

/** Hapus satu penilaian. Hanya admin yang diizinkan firestore.rules; pemda
    yang penilaiannya dihapus dapat mengisi surveinya lagi dari awal. */
async function hapusSurvei(id) {
  if (pakaiFirebase()) {
    const { doc, deleteDoc } = store.fs;
    await deleteDoc(doc(store.db, 'survei', id));
  } else {
    const semua = bacaLokal();
    delete semua[id];
    tulisLokal(semua);
  }
}


/* ═══════════════════════════════════════════════════════════════
   2. TAMPILAN PENGISIAN — satu pertanyaan satu layar
   ═══════════════════════════════════════════════════════════════ */
let IDX      = 0;        // pertanyaan yang sedang tampil
let JAWAB    = {};
let TERKIRIM = null;     // rekaman yang sudah tersimpan, bila ada
let DIMUAT   = false;
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
    <p class="mt-3 max-w-[680px] text-[15px] text-white/65">${aman(JUDUL_KEGIATAN)}</p>
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
    ${p2.bagian ? `<p class="mb-3 inline-block rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">${aman(p2.bagian)}</p>` : ''}
    <h2 class="max-w-[680px] text-[19px] font-semibold leading-[1.45] md:text-[21px]">${aman(p2.judul)}</h2>
    ${p2.petunjuk ? `<p class="mt-2 max-w-[620px] text-[13px] text-white/45">${aman(p2.petunjuk)}</p>` : ''}
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
      TERKIRIM = await kirimSurvei(JAWAB);
      TERKIRIM.dikirimAt = Date.now();
      TINJAU = false; IDX = -1; GALAT = '';
      render();
      toast('Terima kasih, penilaian Anda tersimpan.');
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
    <button id="svUbah" class="${KELAS_TOMBOL} mt-8">Ubah jawaban</button>
  </div>`;
}

function pasangTerimaKasih() {
  el('#svUbah').onclick = () => { TINJAU = true; render(); };
}


/* ═══════════════════════════════════════════════════════════════
   3. REKAP ADMIN + UNDUH EXCEL
   ═══════════════════════════════════════════════════════════════ */
let REKAP = [];
let REKAP_GALAT = '';

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
  ['Indeks kepuasan', r => (r.indeks == null ? '' : Number(r.indeks))],
  ['Mutu', r => MUTU(r.indeks)],
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

async function unduhExcel() {
  const baris = [KOLOM_EKSPOR.map(k => k[0])].concat(
    REKAP.map(r => KOLOM_EKSPOR.map(k => {
      const v = k[1](r);
      return (v === undefined || v === null) ? '' : v;
    })));
  const blob = await buatXlsx('Survei Kepuasan', baris);
  const d = new Date();
  const nama = `Survei Kepuasan Pemda - Rakor TW II 2026 - ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.xlsx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nama;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return nama;
}

function kartuAngka(judul, nilai, keterangan) {
  return `<div class="glass rounded-3xl p-5">
    <p class="text-[11px] uppercase tracking-[0.16em] text-white/45">${aman(judul)}</p>
    <p class="mt-2 text-[28px] font-semibold tabular-nums leading-none">${aman(nilai)}</p>
    ${keterangan ? `<p class="mt-1.5 text-[12px] text-white/45">${aman(keterangan)}</p>` : ''}
  </div>`;
}

function renderAdminSurvei() {
  const wadah = el('#adSurvei');
  if (!wadah) return;

  /* Jumlah responden ikut tercetak di tabnya, supaya admin tahu ada isinya
     tanpa perlu membuka tab itu dulu. */
  const jml = el('#adTabSurveiJml');
  if (jml) jml.textContent = REKAP.length ? ' · ' + REKAP.length : '';

  const rata = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : null;
  const ikmSemua = rata(REKAP.map(r => r.indeks).filter(n => typeof n === 'number'));
  const skorPetugas = rata(REKAP.flatMap(r => [Number((r.jawaban || {}).skorWilayah), Number((r.jawaban || {}).skorVerifikator)].filter(n => n >= 1)));
  const adaPungutan = REKAP.filter(r => (r.jawaban || {}).biaya === 'Ada Penarikan' || (r.jawaban || {}).imbalan === 'Ya').length;

  wadah.innerHTML = `
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      ${kartuAngka('Responden', REKAP.length, 'pemda yang sudah menilai')}
      ${kartuAngka('Indeks kepuasan', ikmSemua == null ? '—' : ikmSemua, MUTU(ikmSemua))}
      ${kartuAngka('Skor petugas', skorPetugas == null ? '—' : skorPetugas, 'rata-rata dari 5')}
      ${kartuAngka('Laporan pungutan', adaPungutan, adaPungutan ? 'perlu ditindaklanjuti' : 'tidak ada laporan')}
    </div>

    ${REKAP_GALAT ? `<div class="mt-5 rounded-3xl border border-amber-400/40 bg-amber-400/10 px-5 py-4 text-[13px] text-amber-200">${aman(REKAP_GALAT)}</div>` : ''}

    <div class="mt-6 flex flex-wrap items-center gap-3">
      <button id="svAdmMuat" class="rounded-full border border-white/20 px-5 py-2.5 text-[13px] font-medium text-white/85 transition hover:bg-white/10">Muat ulang</button>
      <!-- pengisian coba-coba saat uji coba perlu bisa dibuang dari rekap -->
      <button id="svAdmHapus" disabled
              class="rounded-full border border-red-400/50 bg-red-500/15 px-5 py-2.5 text-[13px] font-medium text-red-200 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-40">
        Hapus terpilih <span id="svAdmHapusJml"></span>
      </button>
      <button id="svAdmExcel" class="cta-glow ml-auto rounded-full bg-white px-5 py-2.5 text-[13px] font-medium text-black"${REKAP.length ? '' : ' disabled style="opacity:.4"'}>Unduh Excel</button>
    </div>

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
            ${REKAP.length ? REKAP.map((r, i) => `
              <tr class="transition hover:bg-white/[0.04]">
                <td class="px-4 py-3"><input type="checkbox" class="svPilih h-4 w-4 cursor-pointer accent-white/90" value="${aman(r.id)}" /></td>
                <td class="px-4 py-3 font-medium">${aman(r.kab || '—')}<span class="block text-[11px] text-white/40">${aman(r.prov || '')}</span></td>
                <td class="px-4 py-3 text-white/75">${aman(r.nama || '—')}<span class="block text-[11px] text-white/40">${aman((r.jawaban || {}).hp || r.email || '')}</span></td>
                <td class="px-4 py-3 tabular-nums">${r.indeks == null ? '—' : aman(r.indeks)}</td>
                <td class="px-4 py-3 text-white/70">${aman(MUTU(r.indeks))}</td>
                <td class="px-4 py-3 text-white/70">${aman((r.jawaban || {}).deskWilayah || '—')}</td>
                <td class="px-4 py-3 tabular-nums">${aman((r.jawaban || {}).skorWilayah || '—')}</td>
                <td class="px-4 py-3 text-white/50">${aman(waktuTeks(r.dikirimAt))}</td>
                <td class="px-4 py-3 text-right">
                  <button data-detail="${i}" class="rounded-full border border-white/15 px-3 py-1.5 text-[12px] text-white/70 transition hover:bg-white/10">Lihat</button>
                  <button data-hapus="${aman(r.id)}" title="Hapus penilaian ini" class="ml-1.5 rounded-full border border-white/12 px-3 py-1.5 text-[12px] text-white/45 transition hover:border-red-400/40 hover:text-red-300">Hapus</button>
                </td>
              </tr>`).join('')
            : '<tr><td colspan="9" class="px-4 py-10 text-center text-white/45">Belum ada pemda yang mengisi survei.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;

  el('#svAdmMuat').onclick = () => window.SURVEI.renderAdmin(true);
  el('#svAdmExcel').onclick = async () => {
    const t = el('#svAdmExcel');
    t.disabled = true; t.textContent = 'Menyusun…';
    try { toast('Berkas ' + (await unduhExcel()) + ' diunduh.'); }
    catch (e) { toast('Gagal membuat Excel: ' + e.message); }
    t.disabled = false; t.textContent = 'Unduh Excel';
  };
  els('#adSurvei [data-detail]').forEach(t => t.onclick = () => bukaDetail(REKAP[Number(t.dataset.detail)]));

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
          <p class="text-[12px] text-white/50">${aman(r.nama || '')} · ${aman(r.email || '')} · indeks ${r.indeks == null ? '—' : aman(r.indeks)} (${aman(MUTU(r.indeks))})</p>
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
   4. TITIK MASUK
   ═══════════════════════════════════════════════════════════════ */
window.SURVEI = {
  /** Menu survei hanya untuk akun pemda; petugas PFID bukan respondennya. */
  syncNav() {
    const b = el('[data-nav="survei"]');
    if (b) b.classList.toggle('hidden', !ME || pfidan());
  },

  async render() {
    if (!ME || pfidan()) return;
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
    try {
      REKAP_GALAT = '';
      REKAP = (await semuaSurvei()).sort((a, b) => {
        const w = x => (x.dikirimAt && x.dikirimAt.toMillis ? x.dikirimAt.toMillis() : Number(x.dikirimAt || 0));
        return w(b) - w(a);
      });
    } catch (e) {
      REKAP = [];
      REKAP_GALAT = 'Hasil survei tidak terbaca (' + (e.code || e.message)
                  + '). Pastikan aturan Firestore untuk koleksi survei sudah dipasang dan email admin ini terdaftar.';
    }
    renderAdminSurvei();
    if (paksa) toast('Rekap survei dimuat ulang.');
  },

  reset() {
    IDX = 0; JAWAB = {}; TERKIRIM = null; DIMUAT = false; TINJAU = false; GALAT = '';
  }
};

})();
