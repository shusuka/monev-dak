/* ═══════════════════════════════════════════════════════════════════════
   KONFIRMASI DATA RUAS — TRIWULAN III

   Angka progres tiap ruas diambil dari eMonitoring (assets/data-tw3.js),
   tetapi eMon sering tertinggal dari keadaan lapangan. Menu ini menutup
   selisihnya dalam dua langkah:

     1. Pemda memeriksa tiap ruasnya: tiap angka ditandai "Sesuai" atau
        diperbarui dengan angka terakhir, lalu menuliskan kendalanya dan
        mengirimnya ke pusat.
     2. Pusat (petugas PFID atau admin) meninjau kiriman itu, mengisi
        kesesuaian item dan tindak lanjut, lalu memverifikasi atau
        mengembalikannya ke pemda dengan catatan.

   Dua koleksi, supaya izinnya sederhana dan tidak saling menimpa:
     konfirmasiTw3/{kunciDaerah}  ditulis pemda      { ruas: { [id]: jawaban } }
     verifikasiTw3/{kunciDaerah}  ditulis pusat      { ruas: { [id]: putusan } }
   Keduanya boleh dibaca pemda pemilik daerahnya, petugas PFID, dan admin.
   Tanpa Firebase (mode lokal) semuanya tersimpan di localStorage.
   ═══════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const el  = s => document.querySelector(s);
const els = s => Array.from(document.querySelectorAll(s));
const aman = s => String(s == null ? '' : s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slugK = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim().replace(/\s+/g, '-');

const DATA = window.DATA_TW3 || {};
const LS = 'monevdak_konfirmasi_tw3';
const LS_CADANGAN = 'monevdak_konfirmasi_tw3_cadangan';   // isian yang gagal tersimpan ke server
const COL_PEMDA = 'konfirmasiTw3';
const COL_PUSAT = 'verifikasiTw3';
const CDN_PIZZIP = 'https://unpkg.com/pizzip@3.2.0/dist/pizzip.min.js';
const TGL_EMON = '6 Oktober 2026';

/* Angka yang diperiksa pemda. PHO berbeda: yang ditanyakan bukan "sesuai
   atau tidak", melainkan sudah atau belum, dan tanggalnya bila sudah. */
const KOLOM = [
  { k: 'fisik',   label: 'Progres fisik',       tipe: 'persen' },
  { k: 'keu',     label: 'Progres keuangan',    tipe: 'persen', ket: 'terhadap pagu RK' },
  { k: 'kontrak', label: 'Nilai kontrak',       tipe: 'rp' },
  { k: 'real',    label: 'Realisasi keuangan',  tipe: 'rp' },
  { k: 'pho',     label: 'Serah terima (PHO)',  tipe: 'tgl' }
];
const LK  = ['Data kontrak', 'Data progres', 'Tenaga kerja', 'Foto kegiatan'];
const KES = ['Ruas dalam RK', 'DED', 'Jenis penanganan', 'Target penanganan', 'Bahu', 'Marka'];

const STATUS = {
  belum:   { label: 'Belum diperiksa',            rgb: '148 163 184' },
  draf:    { label: 'Draf tersimpan',             rgb: '251 191 36'  },
  dikirim: { label: 'Menunggu verifikasi pusat',  rgb: '56 189 248'  },
  kembali: { label: 'Dikembalikan pusat',         rgb: '251 113 133' },
  verif:   { label: 'Terverifikasi',              rgb: '52 211 153'  }
};
/* Daerah dengan beberapa ruas: tiap kartu diberi warna sendiri supaya
   ruas yang sedang diisi mudah dibedakan dari tetangganya. */
const AKSEN = ['45 212 191', '167 139 250', '251 191 36', '56 189 248', '251 113 133', '163 230 53', '251 146 60', '232 121 249'];
const URUT_STATUS = ['verif', 'dikirim', 'kembali', 'draf', 'belum'];   // urutan segmen bilah
const URUT_PUSAT  = ['dikirim', 'kembali', 'draf', 'verif', 'belum'];   // urutan daftar daerah

let KONF = {};          // kunci → dokumen pemda
let VERIF = {};         // kunci → dokumen pusat
let DIMUAT = {};        // kunci → true, atau '*' untuk seluruh koleksi
let BUKA = new Set();   // id ruas yang kartunya terbuka
let EDIT = {};          // salinan kerja jawaban pemda per ruas, belum disimpan
let PUTUS = {};         // salinan kerja putusan pusat per ruas
let PILIH = null;       // kunci daerah yang sedang ditinjau pusat
let SARING = { prov: '', status: '', cari: '' };
let WADAH = null;       // elemen tempat menggambar
let MODE_ADMIN = false; // dipanggil dari panel admin, bukan dari menu aplikasi
let SIBUK = '';

/* ME dideklarasikan `let` di index.html, jadi tidak tergantung di window. */
const akunSaya = () => (typeof ME !== 'undefined' && ME) ? ME : null;
const iniPusat = () => MODE_ADMIN || !!(akunSaya() && window.BA && window.BA.akunPfid(akunSaya()));
const kunciSaya = () => { const m = akunSaya(); return m ? (m.kunciKab || slugK(m.kab)) : ''; };
const pakaiFirebase = () => store.mode === 'firebase' && store.db;


/* ═══════════════════════════════════════════════════════════════
   1. FORMAT ANGKA
   ═══════════════════════════════════════════════════════════════ */
const fmtRp = n => (n == null || n === '' || isNaN(n)) ? '—' : 'Rp' + Math.round(Number(n)).toLocaleString('id-ID');
const fmtPersen = n => (n == null || n === '' || isNaN(n)) ? '—'
  : Number(n).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + '%';
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const fmtTgl = iso => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? (+m[3]) + ' ' + BULAN[+m[2] - 1] + ' ' + m[1] : '—';
};
const fmtNilai = (tipe, v) => tipe === 'rp' ? fmtRp(v) : tipe === 'persen' ? fmtPersen(v) : fmtTgl(v);

/** Ketikan pemda menjadi angka. Rupiah cukup diambil digitnya — titik ribuan
    dan "Rp" tidak penting. Persen boleh memakai koma maupun titik desimal. */
function bacaAngka(tipe, s) {
  s = String(s == null ? '' : s).trim();
  if (!s) return null;
  if (tipe === 'rp') {
    const d = s.replace(/[^\d]/g, '');
    return d ? Number(d) : null;
  }
  const n = parseFloat(s.replace(/\s/g, '').replace(',', '.'));
  return isFinite(n) ? n : null;
}

/** Angka tersimpan ditampilkan kembali di kotak isian dengan format ketikan:
    rupiah bertitik ribuan tanpa "Rp" (awalan sudah ada di kotaknya), persen
    dengan koma desimal. */
function teksIsian(tipe, v) {
  if (v == null || v === '') return '';
  if (tipe === 'rp') return Math.round(Number(v)).toLocaleString('id-ID');
  if (tipe === 'persen') return String(v).replace('.', ',');
  return String(v);
}

/** Kotak isian hanya menerima angka. Rupiah diberi titik ribuan sambil
    diketik; persen boleh satu koma dengan dua angka di belakangnya. Posisi
    kursor dijaga supaya tidak meloncat ke ujung saat titik bertambah. */
function rapikanKetikan(tipe, inp) {
  const lama = inp.value, pos = inp.selectionStart == null ? lama.length : inp.selectionStart;
  let baru;
  if (tipe === 'rp') {
    const dig = lama.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 15);
    baru = dig ? Number(dig).toLocaleString('id-ID') : '';
  } else {
    const t = lama.replace(/\./g, ',').replace(/[^\d,]/g, '');
    const [bulat, ...sisa] = t.split(',');
    baru = bulat.replace(/^0+(?=\d)/, '').slice(0, 3) + (sisa.length ? ',' + sisa.join('').slice(0, 2) : '');
  }
  if (baru === lama) return;
  const pentingSebelum = lama.slice(0, pos).replace(tipe === 'rp' ? /\D/g : /[^\d,.]/g, '').length;
  inp.value = baru;
  let i = 0, n = 0;
  while (i < baru.length && n < pentingSebelum) { if (tipe === 'rp' ? /\d/.test(baru[i]) : /[\d,]/.test(baru[i])) n++; i++; }
  try { inp.setSelectionRange(i, i); } catch (e) {}
}

function salahNilai(tipe, v) {
  if (tipe === 'tgl') return /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? '' : 'Pilih tanggal PHO.';
  if (v == null) return 'Isi angka terbarunya.';
  if (tipe === 'persen' && (v < 0 || v > 100)) return 'Persen harus di antara 0 dan 100.';
  if (tipe === 'rp' && v < 0) return 'Nilai tidak boleh negatif.';
  return '';
}


/* ═══════════════════════════════════════════════════════════════
   2. PENYIMPANAN
   ═══════════════════════════════════════════════════════════════ */
function lokal() {
  try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; }
}
function simpanLokal(d) { try { localStorage.setItem(LS, JSON.stringify(d)); } catch (e) {} }

async function muatDaerah(kunci, paksa) {
  if (!kunci || (DIMUAT[kunci] && !paksa)) return;
  if (pakaiFirebase()) {
    const { doc, getDoc, getDocFromServer } = store.fs;
    const baca = async col => {
      const ref = doc(store.db, col, kunci);
      let d;
      try { d = await (getDocFromServer ? getDocFromServer(ref) : getDoc(ref)); }
      catch (e) { d = await getDoc(ref); }
      return d.exists() ? d.data() : null;
    };
    const [a, b] = await Promise.all([baca(COL_PEMDA), baca(COL_PUSAT)]);
    if (a) KONF[kunci] = a; else delete KONF[kunci];
    if (b) VERIF[kunci] = b; else delete VERIF[kunci];
  } else {
    const L = lokal();
    KONF[kunci] = (L[COL_PEMDA] || {})[kunci];
    VERIF[kunci] = (L[COL_PUSAT] || {})[kunci];
  }
  DIMUAT[kunci] = true;
}

async function muatSemua(paksa) {
  if (DIMUAT['*'] && !paksa) return;
  if (pakaiFirebase()) {
    const { collection, getDocs } = store.fs;
    const [a, b] = await Promise.all([
      getDocs(collection(store.db, COL_PEMDA)),
      getDocs(collection(store.db, COL_PUSAT))
    ]);
    KONF = {}; VERIF = {};
    a.docs.forEach(d => { KONF[d.id] = d.data(); });
    b.docs.forEach(d => { VERIF[d.id] = d.data(); });
  } else {
    const L = lokal();
    KONF = { ...(L[COL_PEMDA] || {}) };
    VERIF = { ...(L[COL_PUSAT] || {}) };
  }
  DIMUAT = { '*': true };
  Object.keys(DATA).forEach(k => { DIMUAT[k] = true; });
}

/** Tulis satu ruas tanpa menyentuh ruas lain di dokumen yang sama. */
async function tulisRuas(col, kunci, id, isi) {
  const d = DATA[kunci] || {};
  const oleh = (typeof ME !== 'undefined' && ME)
    ? { uid: ME.uid || '', nama: ME.nama || '' }
    : { uid: store.uid || '', nama: 'Admin' };
  const isiPenuh = { ...isi, oleh };
  if (pakaiFirebase()) {
    const { doc, setDoc, serverTimestamp } = store.fs;
    await setDoc(doc(store.db, col, kunci), {
      kunci, kab: d.kab || '', prov: d.prov || '',
      ruas: { [id]: isiPenuh },
      diperbaruiAt: serverTimestamp()
    }, { merge: true });
  } else {
    const L = lokal();
    L[col] = L[col] || {};
    const dok = L[col][kunci] || { kunci, kab: d.kab || '', prov: d.prov || '', ruas: {} };
    dok.ruas[id] = isiPenuh;
    dok.diperbaruiAt = Date.now();
    L[col][kunci] = dok;
    simpanLokal(L);
  }
  const tujuan = col === COL_PEMDA ? KONF : VERIF;
  tujuan[kunci] = tujuan[kunci] || { kunci, kab: d.kab, prov: d.prov, ruas: {} };
  tujuan[kunci].ruas = { ...(tujuan[kunci].ruas || {}), [id]: isiPenuh };
}

/** Hapus jawaban beberapa ruas dari satu koleksi. Bila tidak ada ruas yang
    tersisa, dokumennya ikut dihapus. */
async function hapusRuas(col, kunci, ids) {
  const sumber = col === COL_PEMDA ? KONF : VERIF;
  const dok = sumber[kunci];
  if (!dok || !ids.length) return;
  const sisa = Object.keys(dok.ruas || {}).filter(x => !ids.includes(x));
  if (pakaiFirebase()) {
    const { doc, deleteDoc, updateDoc, deleteField, FieldPath, serverTimestamp } = store.fs;
    const ref = doc(store.db, col, kunci);
    if (!sisa.length) await deleteDoc(ref);
    else {
      const arg = [];
      ids.forEach(id => arg.push(new FieldPath('ruas', id), deleteField()));
      await updateDoc(ref, ...arg, 'diperbaruiAt', serverTimestamp());
    }
  } else {
    const L = lokal();
    const d = (L[col] || {})[kunci];
    if (d) {
      ids.forEach(id => { delete d.ruas[id]; });
      if (!sisa.length) delete L[col][kunci];
      simpanLokal(L);
    }
  }
  if (!sisa.length) delete sumber[kunci];
  else ids.forEach(id => { delete dok.ruas[id]; });
}

/** Pusat mengosongkan seluruh data satu daerah — jawaban pemda sekaligus
    putusan pusat — supaya pemda mengisi ulang dari awal. */
async function hapusDaerah(kunci) {
  if (pakaiFirebase()) {
    const { doc, deleteDoc } = store.fs;
    await Promise.all([deleteDoc(doc(store.db, COL_PEMDA, kunci)), deleteDoc(doc(store.db, COL_PUSAT, kunci))]);
  } else {
    const L = lokal();
    [COL_PEMDA, COL_PUSAT].forEach(c => { if (L[c]) delete L[c][kunci]; });
    simpanLokal(L);
  }
  delete KONF[kunci]; delete VERIF[kunci];
}

/* Cadangan di perangkat: bila server menolak, isian pemda tidak hilang
   saat halaman dimuat ulang. Dihapus begitu penyimpanan berhasil. */
function cadangan() { try { return JSON.parse(localStorage.getItem(LS_CADANGAN)) || {}; } catch (e) { return {}; } }
function tulisCadangan(kunci, id, isi) {
  const c = cadangan();
  c[kunci] = c[kunci] || {};
  if (isi) c[kunci][id] = isi; else delete c[kunci][id];
  try { localStorage.setItem(LS_CADANGAN, JSON.stringify(c)); } catch (e) {}
}


/* ═══════════════════════════════════════════════════════════════
   3. STATUS
   ═══════════════════════════════════════════════════════════════ */
const jawabanPemda = (kunci, id) => ((KONF[kunci] || {}).ruas || {})[id] || null;
const putusanPusat = (kunci, id) => ((VERIF[kunci] || {}).ruas || {})[id] || null;

function statusRuas(kunci, id) {
  const j = jawabanPemda(kunci, id), p = putusanPusat(kunci, id);
  if (p && p.status === 'terverifikasi') return 'verif';
  /* Kiriman yang lebih baru dari pengembalian berarti pemda sudah memperbaiki. */
  if (p && p.status === 'dikembalikan' && !(j && j.status === 'dikirim' && (j.dikirimAt || 0) > (p.at || 0))) return 'kembali';
  if (j && j.status === 'dikirim') return 'dikirim';
  if (j) return 'draf';
  return 'belum';
}

function hitungDaerah(kunci) {
  const n = { total: 0, belum: 0, draf: 0, dikirim: 0, kembali: 0, verif: 0 };
  ((DATA[kunci] || {}).ruas || []).forEach(r => { n.total++; n[statusRuas(kunci, r.id)]++; });
  return n;
}

/** Status ringkas satu daerah untuk penyaring pusat. */
function statusDaerah(n) {
  if (!n.total) return 'belum';
  if (n.verif === n.total) return 'verif';
  if (n.kembali) return 'kembali';
  if (n.dikirim) return 'dikirim';
  if (n.draf || n.verif) return 'draf';
  return 'belum';
}

const chip = (st, kecil) => {
  const m = STATUS[st];
  return `<span class="konf-chip ${kecil ? 'konf-chip--kecil' : ''}" style="--st:${m.rgb}">
    <span class="konf-chip__titik ${st === 'dikirim' ? 'konf-denyut' : ''}"></span>${m.label}</span>`;
};


/* ═══════════════════════════════════════════════════════════════
   4. PEMDA — memeriksa dan mengirim
   ═══════════════════════════════════════════════════════════════ */
function salinanKerja(kunci, r) {
  if (EDIT[r.id]) return EDIT[r.id];
  const server = jawabanPemda(kunci, r.id);
  /* Cadangan yang lebih baru dari salinan server berarti penyimpanan
     terakhir gagal; isian itulah yang dilanjutkan. */
  const cad = (cadangan()[kunci] || {})[r.id];
  const pakaiCad = cad && (!server || (cad.diubahAt || 0) > (server.diubahAt || 0));
  const j = pakaiCad ? cad : server;
  const f = {};
  KOLOM.forEach(c => {
    const a = j && j.f && j.f[c.k];
    const v = a && a.v != null ? a.v : null;
    f[c.k] = a
      /* `ok`: angka perbaikan sudah di-submit. Jawaban lama tanpa tanda ini
         dianggap sudah, asalkan angkanya ada. */
      ? { s: a.s, v, teks: c.tipe === 'tgl' ? (v || '') : teksIsian(c.tipe, v), ok: a.ok != null ? !!a.ok : v != null }
      : { s: '', v: null, teks: '', ok: false };
  });
  const lk = (j && Array.isArray(j.lk) && j.lk.length === LK.length ? j.lk : r.lk).map(x => x ? 1 : 0);
  EDIT[r.id] = { f, lk, kendala: (j && j.kendala) || '', galat: {}, dariCadangan: !!pakaiCad };
  return EDIT[r.id];
}

/** Warna kartu ke-i, hanya bila daerahnya punya lebih dari satu ruas. */
const aksenKartu = (kunci, i) => ((DATA[kunci] || {}).ruas || []).length > 1 ? AKSEN[i % AKSEN.length] : '';

function ringkasanRing(n) {
  const R = 46, C = 2 * Math.PI * R;
  const selesai = n.dikirim + n.verif;
  const p = n.total ? selesai / n.total : 0;
  return `<svg viewBox="0 0 120 120" class="h-[120px] w-[120px] -rotate-90" aria-hidden="true">
      <circle cx="60" cy="60" r="${R}" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="10"/>
      <circle cx="60" cy="60" r="${R}" fill="none" stroke="rgb(45 212 191)" stroke-width="10" stroke-linecap="round"
        stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - p)).toFixed(1)}"
        class="ring-anim" style="--dash:${C.toFixed(1)}"/>
    </svg>
    <div class="absolute inset-0 flex flex-col items-center justify-center">
      <span class="text-[26px] font-semibold tabular-nums leading-none">${selesai}<span class="text-[15px] text-white/45">/${n.total}</span></span>
      <span class="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/50">terkirim</span>
    </div>`;
}

function renderPemda() {
  const kunci = kunciSaya();
  const d = DATA[kunci];
  if (!d) {
    WADAH.innerHTML = `<div class="glass konf-muncul rounded-3xl p-8 text-center">
      <h1 class="text-[22px] font-semibold">Belum ada data ruas untuk ${aman(ME.kab)}</h1>
      <p class="mx-auto mt-3 max-w-[460px] text-[14px] leading-[1.7] text-white/60">Daerah Anda tidak tercantum pada kertas kerja Rakor Triwulan III. Bila ini keliru, hubungi petugas PFID di desk Anda.</p>
    </div>`;
    return;
  }
  const n = hitungDaerah(kunci);
  const pertama = d.ruas.find(r => ['belum', 'draf', 'kembali'].includes(statusRuas(kunci, r.id)));
  if (!BUKA.size && pertama) BUKA.add(pertama.id);

  WADAH.innerHTML = `
    <p class="konf-muncul text-[12px] font-semibold uppercase tracking-[0.2em] text-teal-300/80">Konfirmasi data · Triwulan III</p>
    <h1 class="konf-muncul mt-3 text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] md:text-[40px]" style="animation-delay:.05s">Data ruas ${aman(d.kab)}</h1>
    <p class="konf-muncul mt-3 max-w-[680px] text-[15px] leading-[1.7] text-white/65" style="animation-delay:.1s">
      Angka di bawah diambil dari eMonitoring per ${TGL_EMON}. Periksa tiap ruas: tandai <strong class="font-semibold text-white">Sesuai</strong>
      bila angkanya benar, atau ketik angka terakhir bila sudah berubah. Setelah dikirim, petugas pusat akan memverifikasinya.
    </p>

    <div class="konf-muncul mt-9 grid gap-4 md:grid-cols-[auto,1fr]" style="animation-delay:.15s">
      <div class="glass flex items-center gap-6 rounded-3xl p-6">
        <div class="relative h-[120px] w-[120px] shrink-0">${ringkasanRing(n)}</div>
        <div>
          <p class="text-[13px] text-white/55">${n.total} ruas · ${aman(d.prov)}</p>
          <p class="mt-1 text-[17px] font-semibold leading-snug">${n.verif === n.total ? 'Semua ruas sudah terverifikasi'
            : n.dikirim + n.verif === n.total ? 'Semua ruas sudah dikirim' : (n.total - n.dikirim - n.verif) + ' ruas menunggu pemeriksaan Anda'}</p>
        </div>
      </div>
      <div class="glass grid grid-cols-2 gap-3 rounded-3xl p-5 sm:grid-cols-4">
        ${['kembali', 'dikirim', 'verif', 'belum'].map(st => `
          <div class="rounded-2xl px-4 py-3" style="background:rgb(${STATUS[st].rgb} / .09);border:1px solid rgb(${STATUS[st].rgb} / .25)">
            <p class="text-[24px] font-semibold tabular-nums" style="color:rgb(${STATUS[st].rgb})">${st === 'belum' ? n.belum + n.draf : n[st]}</p>
            <p class="mt-0.5 text-[11.5px] leading-snug text-white/60">${st === 'belum' ? 'Belum dikirim' : STATUS[st].label}</p>
          </div>`).join('')}
      </div>
    </div>

    <div class="konf-muncul mt-9 flex flex-wrap items-center justify-between gap-3" style="animation-delay:.18s">
      <p class="text-[13px] text-white/55">${d.ruas.length} ruas${d.ruas.length > 1 ? ' — tiap kartu diberi warna berbeda' : ''}</p>
      <button type="button" onclick="KONF.ulangSemua()" ${SIBUK ? 'disabled' : ''}
        class="inline-flex items-center gap-2 rounded-full border border-rose-400/40 px-4 py-2 text-[12.5px] font-semibold text-rose-200 transition hover:bg-rose-500/10 disabled:opacity-40">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
        Hapus isian &amp; ulang input</button>
    </div>
    <div id="konfDaftar" class="mt-4 space-y-4">
      ${d.ruas.map((r, i) => kartuPemda(kunci, r, i)).join('')}
    </div>`;
}

function barMini(label, nilai, warna) {
  const p = Math.max(0, Math.min(100, Number(nilai) || 0));
  return `<div class="min-w-[110px] flex-1">
    <div class="flex items-baseline justify-between text-[11px] text-white/50"><span>${label}</span><span class="tabular-nums text-white/80">${fmtPersen(nilai)}</span></div>
    <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"><div class="bar-anim h-full rounded-full" style="width:${p}%;background:${warna}"></div></div>
  </div>`;
}

function kepalaKartu(kunci, r, st, buka, fungsi, i) {
  const j = jawabanPemda(kunci, r.id);
  const fisik = j && j.f && j.f.fisik && j.f.fisik.s === 'ubah' && j.f.fisik.v != null && j.f.fisik.ok !== false ? j.f.fisik.v : r.e.fisik;
  const keu = j && j.f && j.f.keu && j.f.keu.s === 'ubah' && j.f.keu.v != null && j.f.keu.ok !== false ? j.f.keu.v : r.e.keu;
  const aksen = aksenKartu(kunci, i);
  return `<button type="button" onclick="${fungsi}" aria-expanded="${buka}"
      class="flex w-full flex-wrap items-center gap-x-5 gap-y-3 px-5 py-5 text-left md:px-6">
    <div class="min-w-[220px] flex-[2]">
      <p class="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">${aksen
        ? `<span class="konf-nomor">Ruas ${i + 1}</span>` : ''}<span>${aman(r.rin)} · No. ${aman(r.kode)}</span></p>
      <h3 class="mt-1 text-[17px] font-semibold leading-snug">${aman(r.nama)}</h3>
      <p class="mt-1 text-[12.5px] text-white/50">${r.vol != null ? aman(String(r.vol).replace('.', ',')) + ' ' + aman(r.sat || '') + ' · ' : ''}Pagu ${fmtRp(r.pagu)}</p>
    </div>
    <div class="flex min-w-[240px] flex-[1.4] gap-4">
      ${barMini('Fisik', fisik, 'rgb(45 212 191)')}
      ${barMini('Keuangan', keu, 'rgb(129 140 248)')}
    </div>
    <div class="flex items-center gap-3">
      ${chip(st)}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
        class="konf-panah h-5 w-5 shrink-0 text-white/50 ${buka ? 'rotate-180' : ''}"><path d="M6 9l6 6 6-6"/></svg>
    </div>
  </button>`;
}

function kartuPemda(kunci, r, i) {
  const st = statusRuas(kunci, r.id);
  const buka = BUKA.has(r.id);
  return `<article id="konf-${aman(r.id)}" ${atributKartu(kunci, st, i, 0.2)}>
    ${kepalaKartu(kunci, r, st, buka, `KONF.buka('${aman(r.id)}')`, i)}
    ${buka ? `<div class="konf-isi border-t border-white/10 px-5 pb-6 pt-5 md:px-6">${st === 'verif' ? isiTerkunci(kunci, r) : isiPemda(kunci, r, st)}</div>` : ''}
  </article>`;
}

function atributKartu(kunci, st, i, jeda) {
  const aksen = aksenKartu(kunci, i);
  return `class="glass konf-kartu konf-muncul overflow-hidden rounded-3xl${aksen ? ' konf-kartu--aksen' : ''}"
    style="--st:${STATUS[st].rgb};${aksen ? `--aksen:${aksen};` : ''}animation-delay:${(jeda + i * 0.05).toFixed(2)}s"`;
}

function catatanPusat(kunci, r) {
  const p = putusanPusat(kunci, r.id);
  if (!p) return '';
  const kembali = p.status === 'dikembalikan';
  const warna = kembali ? '251 113 133' : '52 211 153';
  return `<div class="mb-5 rounded-2xl px-4 py-3.5" style="background:rgb(${warna} / .1);border:1px solid rgb(${warna} / .35)">
    <p class="text-[12px] font-semibold" style="color:rgb(${warna})">${kembali ? 'Catatan pusat — mohon diperbaiki' : 'Hasil verifikasi pusat'}${p.oleh && p.oleh.nama ? ' · ' + aman(p.oleh.nama) : ''}</p>
    ${p.catatan ? `<p class="mt-1.5 text-[13.5px] leading-[1.65] text-white/85">${aman(p.catatan)}</p>` : ''}
    ${p.tl ? `<p class="mt-1.5 text-[13px] leading-[1.65] text-white/70"><span class="text-white/45">Tindak lanjut:</span> ${aman(p.tl)}</p>` : ''}
  </div>`;
}

const IKON_CENTANG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3"><path d="M20 6 9 17l-5-5"/></svg>';
const IKON_SERU = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" class="h-3 w-3"><path d="M12 7v6M12 17h.01"/></svg>';

/** Isian angka perbaikan satu baris: kotak isian + tombol Submit selama
    belum dikonfirmasi; setelah di-submit berganti ringkasan rapi. */
function panelPerbaikan(r, c, a, id) {
  if (a.ok && a.v != null) {
    return `<div class="konf-perbaikan konf-perbaikan--ok">
      <span class="konf-perbaikan__ikon">${IKON_CENTANG}</span>
      <div class="min-w-0 flex-1">
        <p class="text-[11.5px] font-medium text-emerald-200/85">${c.tipe === 'tgl' ? 'Tanggal PHO tercatat' : 'Angka perbaikan tercatat'}</p>
        <p class="mt-0.5 text-[16px] font-semibold tabular-nums text-white">${fmtNilai(c.tipe, a.v)}</p>
      </div>
      <button type="button" onclick="KONF.ubahLagi('${id}','${c.k}')" class="rounded-full border border-white/20 px-3.5 py-1.5 text-[12px] font-medium text-white/80 transition hover:bg-white/10">Ubah</button>
    </div>`;
  }
  const enter = `onkeydown="if(event.key==='Enter'){event.preventDefault();KONF.terapkan('${id}','${c.k}')}"`;
  const kotak = c.tipe === 'tgl'
    ? `<input type="date" value="${aman(a.teks)}" oninput="KONF.isi('${id}','${c.k}',this.value)" ${enter}
         aria-label="Tanggal PHO ${aman(r.nama)}" class="konf-angka__isian" />`
    : `${c.tipe === 'rp' ? '<span class="konf-angka__imbuh">Rp</span>' : ''}
       <input type="text" inputmode="${c.tipe === 'rp' ? 'numeric' : 'decimal'}" autocomplete="off" value="${aman(a.teks)}"
         placeholder="${c.tipe === 'rp' ? '0' : '0,00'}" oninput="KONF.ketik(this,'${id}','${c.k}')" ${enter}
         aria-label="${c.label} terbaru ${aman(r.nama)}" class="konf-angka__isian tabular-nums" />
       ${c.tipe === 'persen' ? '<span class="konf-angka__imbuh">%</span>' : ''}`;
  return `<div class="konf-perbaikan">
    <p class="text-[11.5px] font-medium text-white/55">${c.tipe === 'tgl' ? 'Tanggal PHO' : c.tipe === 'rp' ? 'Nilai terbaru (angka saja)' : 'Persen terbaru (angka saja)'}</p>
    <div class="mt-1.5 flex flex-wrap items-stretch gap-2">
      <div class="konf-angka ${a.galat ? 'konf-angka--galat' : ''}">${kotak}</div>
      <button type="button" onclick="KONF.terapkan('${id}','${c.k}')" ${SIBUK ? 'disabled' : ''} class="konf-submit">Submit</button>
    </div>
  </div>`;
}

function isiPemda(kunci, r, st) {
  const w = salinanKerja(kunci, r);
  const id = aman(r.id);
  const baris = KOLOM.map(c => {
    const a = w.f[c.k];
    const emon = c.tipe === 'tgl'
      ? (r.e.pho ? aman(r.e.pho) : 'Belum ada BA PHO')
      : fmtNilai(c.tipe, r.e[c.k]);
    const opsi = c.tipe === 'tgl'
      ? [['belum', 'Belum PHO'], ['sudah', 'Sudah PHO']]
      : [['ok', 'Sesuai'], ['ubah', 'Perbarui']];
    const perbaikan = c.tipe === 'tgl' ? a.s === 'sudah' : a.s === 'ubah';
    const tercatat = perbaikan && a.ok && a.v != null;
    const galat = w.galat[c.k];
    return `<div class="konf-baris py-4">
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
        <div class="min-w-0">
          <p class="text-[13.5px] font-medium">${c.label}${c.ket ? ` <span class="text-[11.5px] font-normal text-white/40">${c.ket}</span>` : ''}</p>
          <p class="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-white/45">eMon:
            <span class="tabular-nums ${tercatat && c.tipe !== 'tgl' ? 'text-white/40 line-through decoration-white/30' : 'text-white/75'}">${emon}</span>
            ${tercatat ? `<span class="text-amber-300/80">→</span><span class="font-semibold tabular-nums text-amber-200">${fmtNilai(c.tipe, a.v)}</span>` : ''}
          </p>
        </div>
        <div class="konf-segmen" role="radiogroup" aria-label="${c.label}">
          ${opsi.map(([s, t]) => `<button type="button" role="radio" aria-checked="${a.s === s}" onclick="KONF.pilih('${id}','${c.k}','${s}')"
              class="konf-segmen__opsi ${a.s === s ? 'on' : ''} ${s === 'ok' || s === 'belum' ? 'konf-segmen__opsi--ok' : ''}">${t}</button>`).join('')}
        </div>
      </div>
      <div class="konf-input-wadah ${perbaikan ? 'buka' : ''}">
        <div>${perbaikan ? panelPerbaikan(r, c, { ...a, galat }, id) : ''}</div>
      </div>
      ${galat ? `<p class="mt-2 text-[12px] font-medium text-rose-300">${aman(galat)}</p>` : ''}
    </div>`;
  }).join('');

  const lk = LK.map((t, i) => {
    const on = !!w.lk[i];
    return `<button type="button" role="switch" aria-checked="${on}" onclick="KONF.lk('${id}',${i})"
        title="Klik untuk menandai ${on ? 'belum lengkap (merah)' : 'lengkap (hijau)'}"
        class="konf-lk ${on ? 'konf-lk--ok' : 'konf-lk--kurang'}">
      <span class="konf-lk__ikon">${on ? IKON_CENTANG : IKON_SERU}</span>${t}
      <span class="konf-lk__ket">${on ? 'Lengkap' : 'Belum'}</span></button>`;
  }).join('');
  const lkBeda = w.lk.some((x, i) => !!x !== !!r.lk[i]);
  const adaJawaban = !!jawabanPemda(kunci, r.id);

  return `${catatanPusat(kunci, r)}
    ${w.dariCadangan ? `<div class="mb-4 rounded-2xl border border-amber-300/35 bg-amber-400/10 px-4 py-3 text-[12.5px] leading-[1.6] text-amber-100">
      Isian ini dipulihkan dari perangkat Anda karena penyimpanan terakhir ke server gagal. Klik <strong>Simpan draf</strong> atau <strong>Kirim</strong> untuk mencoba lagi.</div>` : ''}
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="max-w-[560px] text-[13px] leading-[1.6] text-white/60">Periksa lima isian berikut. Bila angka berubah, pilih <strong class="font-semibold text-white/85">Perbarui</strong>, ketik angkanya, lalu klik <strong class="font-semibold text-white/85">Submit</strong>.</p>
      <button type="button" onclick="KONF.semuaSesuai('${id}')" class="rounded-full border border-teal-300/40 px-4 py-2 text-[12.5px] font-semibold text-teal-200 transition hover:bg-teal-400/10">Tandai semua sesuai eMon</button>
    </div>
    <div class="mt-1 divide-y divide-white/[.07]">${baris}</div>

    <div class="mt-5">
      <label for="konf-kendala-${id}" class="text-[13.5px] font-medium">Kendala atau permasalahan <span class="font-normal text-white/40">(bila ada)</span></label>
      <textarea id="konf-kendala-${id}" rows="3" oninput="KONF.kendala('${id}',this.value)" placeholder="Mis. cuaca, keterlambatan material, addendum kontrak"
        class="konf-input mt-2 w-full resize-y leading-[1.6]">${aman(w.kendala)}</textarea>
    </div>

    <div class="mt-5">
      <p class="text-[13.5px] font-medium">Kelengkapan di aplikasi eMonitoring</p>
      <p class="mt-0.5 text-[12px] leading-[1.6] text-white/50">Klik tiap item untuk memverifikasi: <span class="text-emerald-300">hijau</span> = sudah lengkap di eMon, <span class="text-rose-300">merah</span> = belum lengkap.${lkBeda ? ' <span class="text-amber-200/90">Berbeda dari catatan eMon.</span>' : ''}</p>
      <div class="mt-2.5 flex flex-wrap gap-2">${lk}</div>
    </div>

    <div id="konf-galat-${id}" class="mt-4 hidden rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-[13px] leading-[1.6] text-rose-200"></div>

    <div class="mt-6 flex flex-wrap items-center justify-end gap-3">
      ${adaJawaban ? `<button type="button" onclick="KONF.ulangRuas('${id}')" ${SIBUK ? 'disabled' : ''}
        class="mr-auto rounded-full px-3 py-2.5 text-[12.5px] font-medium text-rose-200/80 transition hover:bg-rose-500/10 hover:text-rose-200 disabled:opacity-40">Kosongkan ruas ini</button>` : ''}
      ${st === 'dikirim' ? `<p class="${adaJawaban ? '' : 'mr-auto'} text-[12.5px] text-sky-200/80">Sudah terkirim. Perubahan akan dikirim ulang.</p>` : ''}
      <button type="button" onclick="KONF.simpan('${id}',false)" ${SIBUK ? 'disabled' : ''}
        class="rounded-full border border-white/20 px-5 py-2.5 text-[13px] font-medium text-white/85 transition hover:bg-white/10 disabled:opacity-40">Simpan draf</button>
      <button type="button" onclick="KONF.simpan('${id}',true)" ${SIBUK ? 'disabled' : ''}
        class="cta-glow inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-[13px] font-semibold text-black disabled:opacity-40">
        ${SIBUK === r.id ? '<span class="konf-putar"></span>Menyimpan…' : st === 'kembali' ? 'Kirim perbaikan ke pusat' : 'Kirim ke pusat'}
      </button>
    </div>`;
}

/** Ringkasan baca-saja: dipakai pemda setelah ruasnya terverifikasi. */
function isiTerkunci(kunci, r) {
  const j = jawabanPemda(kunci, r.id);
  const p = putusanPusat(kunci, r.id);
  const nilai = c => {
    const a = j && j.f && j.f[c.k];
    if (c.tipe === 'tgl') return a && a.s === 'sudah' ? fmtTgl(a.v) : (r.e.pho || 'Belum PHO');
    return a && a.s === 'ubah' ? fmtNilai(c.tipe, a.v) : fmtNilai(c.tipe, r.e[c.k]);
  };
  const kes = (p && p.kes) || r.tw2;
  const lk = lkAkhir(j, r);
  return `${catatanPusat(kunci, r)}
    <dl class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      ${KOLOM.map(c => `<div class="rounded-2xl bg-white/[.04] px-4 py-3"><dt class="text-[11.5px] text-white/50">${c.label}</dt>
        <dd class="mt-1 text-[15px] font-semibold tabular-nums">${nilai(c)}</dd></div>`).join('')}
    </dl>
    <p class="mt-5 text-[12px] text-white/50">Kesesuaian item menurut pusat</p>
    <div class="mt-2 flex flex-wrap gap-2">${KES.map((t, i) => `<span class="rounded-full px-3 py-1 text-[11.5px] font-medium ${kes[i] === 'S'
        ? 'bg-emerald-400/10 text-emerald-200 ring-1 ring-emerald-400/30' : kes[i] === 'T'
        ? 'bg-rose-400/10 text-rose-200 ring-1 ring-rose-400/30' : 'bg-white/5 text-white/50 ring-1 ring-white/15'}">${t}</span>`).join('')}</div>
    <p class="mt-4 text-[12px] text-white/50">Kelengkapan eMonitoring menurut pemda</p>
    <div class="mt-2 flex flex-wrap gap-2">${LK.map((t, i) => `<span class="konf-lk konf-lk--diam ${lk[i] ? 'konf-lk--ok' : 'konf-lk--kurang'}">
        <span class="konf-lk__ikon">${lk[i] ? IKON_CENTANG : IKON_SERU}</span>${t}</span>`).join('')}</div>`;
}

/** Kelengkapan eMon versi pemda bila sudah diverifikasinya, selain itu catatan eMon. */
const lkAkhir = (j, r) => (j && Array.isArray(j.lk) && j.lk.length === LK.length ? j.lk : r.lk).map(x => x ? 1 : 0);

/** Gambar ulang satu kartu. Kartu yang sekadar berubah isinya digambar
    `diam` — animasi masuk hanya untuk kartu yang baru dibuka, supaya klik
    Sesuai/Perbarui tidak membuat seluruh kartu berkedip. */
function gambarUlangKartu(id, animasi) {
  const kunci = PILIH || kunciSaya();
  const d = DATA[kunci];
  const r = d && d.ruas.find(x => x.id === id);
  const lama = el('#konf-' + CSS.escape(id));
  if (!r || !lama) return;
  const i = d.ruas.indexOf(r);
  const tmp = document.createElement('div');
  tmp.innerHTML = PILIH && iniPusat() ? kartuPusat(kunci, r, i) : kartuPemda(kunci, r, i);
  const baru = tmp.firstElementChild;
  baru.classList.remove('konf-muncul');
  if (!animasi) baru.classList.add('konf-diam');
  lama.replaceWith(baru);
  return baru;
}

function pilih(id, k, s) {
  const kunci = kunciSaya(), r = DATA[kunci].ruas.find(x => x.id === id);
  const w = salinanKerja(kunci, r);
  w.f[k].s = s;
  delete w.galat[k];
  const sebelumnya = el(`#konf-${CSS.escape(id)}`);
  const bukaLama = sebelumnya ? els(`#konf-${CSS.escape(id)} .konf-input-wadah`).map(x => x.classList.contains('buka')) : [];
  if (s === 'ok' || s === 'belum') { w.f[k].v = null; w.f[k].teks = ''; w.f[k].ok = false; }
  const kartu = gambarUlangKartu(id);
  if (!kartu) return;
  /* Kotak isian yang baru dibuka digambar tertutup dulu, lalu dibuka pada
     bingkai berikutnya, supaya peralihannya terlihat — begitu pula yang ditutup. */
  const idx = KOLOM.findIndex(c => c.k === k);
  const wadah = kartu.querySelectorAll('.konf-input-wadah')[idx];
  if (wadah && bukaLama[idx] !== undefined && bukaLama[idx] !== wadah.classList.contains('buka')) {
    const akhir = wadah.classList.contains('buka');
    wadah.classList.toggle('buka', !akhir);
    void wadah.offsetHeight;
    requestAnimationFrame(() => wadah.classList.toggle('buka', akhir));
  }
  if (s === 'ubah' || s === 'sudah') fokusIsian(kartu, k);
}

function fokusIsian(kartu, k) {
  const idx = KOLOM.findIndex(c => c.k === k);
  const wadah = kartu && kartu.querySelectorAll('.konf-input-wadah')[idx];
  const masuk = wadah && wadah.querySelector('input');
  if (masuk) {
    masuk.focus({ preventScroll: true });
    try { masuk.setSelectionRange(masuk.value.length, masuk.value.length); } catch (e) {}
  }
}

/** Tanggal PHO (kotak tanggal bawaan peramban). */
function isi(id, k, nilai) {
  const kunci = kunciSaya(), r = DATA[kunci].ruas.find(x => x.id === id);
  const w = salinanKerja(kunci, r);
  w.f[k].teks = nilai;
  w.f[k].v = nilai || null;
  w.f[k].ok = false;
}

/** Angka rupiah/persen: ketikan dirapikan, lalu dibaca menjadi angka. */
function ketik(inp, id, k) {
  const kunci = kunciSaya(), r = DATA[kunci].ruas.find(x => x.id === id);
  const w = salinanKerja(kunci, r);
  const c = KOLOM.find(x => x.k === k);
  rapikanKetikan(c.tipe, inp);
  w.f[k].teks = inp.value;
  w.f[k].v = bacaAngka(c.tipe, inp.value);
  w.f[k].ok = false;
  const kotak = inp.closest('.konf-angka');
  if (kotak && w.galat[k]) { delete w.galat[k]; kotak.classList.remove('konf-angka--galat'); }
}

/** Tombol Submit pada satu angka perbaikan: diperiksa, dicatat, lalu
    langsung disimpan sebagai draf supaya tidak hilang. */
function terapkan(id, k) {
  const kunci = kunciSaya(), r = DATA[kunci].ruas.find(x => x.id === id);
  const w = salinanKerja(kunci, r);
  const c = KOLOM.find(x => x.k === k);
  const g = salahNilai(c.tipe, w.f[k].v);
  if (g) {
    w.galat[k] = g;
    fokusIsian(gambarUlangKartu(id), k);
    return;
  }
  delete w.galat[k];
  w.f[k].ok = true;
  gambarUlangKartu(id);
  simpan(id, false, true);
}

function ubahLagi(id, k) {
  const kunci = kunciSaya(), r = DATA[kunci].ruas.find(x => x.id === id);
  salinanKerja(kunci, r).f[k].ok = false;
  fokusIsian(gambarUlangKartu(id), k);
}

/** Kelengkapan eMon: pemda menandai sendiri hijau (lengkap) atau merah. */
function lk(id, i) {
  const kunci = kunciSaya(), r = DATA[kunci].ruas.find(x => x.id === id);
  const w = salinanKerja(kunci, r);
  w.lk[i] = w.lk[i] ? 0 : 1;
  gambarUlangKartu(id);
}

function kendala(id, nilai) {
  const kunci = kunciSaya(), r = DATA[kunci].ruas.find(x => x.id === id);
  salinanKerja(kunci, r).kendala = nilai;
}

function semuaSesuai(id) {
  const kunci = kunciSaya(), r = DATA[kunci].ruas.find(x => x.id === id);
  const w = salinanKerja(kunci, r);
  KOLOM.forEach(c => {
    if (c.tipe === 'tgl') { if (!w.f.pho.s) w.f.pho = { s: r.e.pho ? 'sudah' : 'belum', v: null, teks: '', ok: false }; }
    else w.f[c.k] = { s: 'ok', v: null, teks: '', ok: false };
  });
  /* BA PHO yang sudah terunggah tetap butuh tanggalnya; selain itu cukup "Belum". */
  if (w.f.pho.s === 'sudah' && !(w.f.pho.ok && w.f.pho.v)) w.galat = { pho: 'eMon mencatat BA PHO sudah terunggah. Isi tanggal PHO-nya, lalu Submit.' };
  else w.galat = {};
  gambarUlangKartu(id);
}

function tampilGalat(id, pesan) {
  const kotak = el('#konf-galat-' + CSS.escape(id));
  if (!kotak) { toast(pesan); return; }
  kotak.innerHTML = pesan;
  kotak.classList.remove('hidden');
  kotak.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/** Pesan galat penyimpanan yang bisa ditindaklanjuti pengguna. */
function pesanGagal(e) {
  if (e && e.code === 'permission-denied') {
    return '<strong>Gagal menyimpan: server menolak (izin ditolak).</strong> Aturan Firestore terbaru untuk menu Konfirmasi Data belum '
      + 'di-<em>Publish</em> di Firebase Console, atau sesi masuk Anda sudah kedaluwarsa. Isian Anda sudah disimpan sementara di perangkat ini — '
      + 'coba keluar lalu masuk lagi; bila masih gagal, hubungi admin PFID.';
  }
  if (e && (e.code === 'unavailable' || e.code === 'deadline-exceeded')) {
    return '<strong>Gagal menyimpan: koneksi ke server terputus.</strong> Isian Anda disimpan sementara di perangkat ini. Periksa internet lalu coba lagi.';
  }
  return '<strong>Gagal menyimpan.</strong> ' + aman((e && (e.message || e.code)) || 'Periksa koneksi internet.') + ' Isian Anda disimpan sementara di perangkat ini.';
}

async function simpan(id, kirim, senyap) {
  if (SIBUK) return;
  const kunci = kunciSaya(), d = DATA[kunci], r = d.ruas.find(x => x.id === id);
  const w = salinanKerja(kunci, r);
  if (kirim) {
    w.galat = {};
    KOLOM.forEach(c => {
      const a = w.f[c.k];
      if (!a.s) { w.galat[c.k] = c.tipe === 'tgl' ? 'Pilih sudah atau belum PHO.' : 'Pilih Sesuai atau Perbarui.'; return; }
      if (a.s === 'ubah' || a.s === 'sudah') {
        const g = salahNilai(c.tipe, a.v);
        if (g) w.galat[c.k] = g;
        else if (!a.ok) w.galat[c.k] = 'Klik Submit untuk mengonfirmasi angka perbaikan ini.';
      }
    });
    if (Object.keys(w.galat).length) {
      gambarUlangKartu(id);
      tampilGalat(id, Object.keys(w.galat).length + ' isian belum lengkap. Periksa tanda merah di atas.');
      return;
    }
  }
  const f = {};
  KOLOM.forEach(c => {
    const a = w.f[c.k];
    if (!a.s) return;
    const pakaiNilai = a.s === 'ubah' || a.s === 'sudah';
    f[c.k] = { s: a.s, v: pakaiNilai ? (a.v == null ? null : a.v) : null, ok: pakaiNilai ? !!a.ok : true };
  });
  const lama = jawabanPemda(kunci, id);
  const isiBaru = {
    f, lk: w.lk.slice(), kendala: w.kendala.trim(),
    status: kirim ? 'dikirim' : (lama && lama.status === 'dikirim' ? 'dikirim' : 'draf'),
    dikirimAt: kirim ? Date.now() : ((lama && lama.dikirimAt) || null),
    diubahAt: Date.now()
  };
  SIBUK = id;
  gambarUlangKartu(id);
  try {
    await tulisRuas(COL_PEMDA, kunci, id, isiBaru);
    SIBUK = '';
    delete EDIT[id];
    tulisCadangan(kunci, id, null);
    if (kirim) {
      BUKA.delete(id);
      const berikut = d.ruas.find(x => x.id !== id && ['belum', 'draf', 'kembali'].includes(statusRuas(kunci, x.id)));
      if (berikut) BUKA.add(berikut.id);
      toast(berikut ? 'Terkirim ke pusat. Lanjut ke ruas berikutnya.' : 'Terkirim. Semua ruas sudah Anda periksa.');
      if (!berikut && window.TUTOR) window.TUTOR.setelahKonfirmasi(hitungDaerah(kunci));
      renderPemda();
      if (berikut) setTimeout(() => {
        const k = el('#konf-' + CSS.escape(berikut.id));
        if (k) k.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }, 120);
    } else {
      toast(senyap ? 'Perbaikan tersimpan.' : 'Draf tersimpan.');
      gambarUlangKartu(id);
    }
    tandaiNav();
  } catch (e) {
    console.error('[MonevDAK] konfirmasi gagal disimpan:', e);
    SIBUK = '';
    tulisCadangan(kunci, id, isiBaru);
    gambarUlangKartu(id);
    tampilGalat(id, pesanGagal(e));
  }
}

/* ── Hapus isian (ulang input) ───────────────────────────────── */

/** Dialog konfirmasi sederhana. Mengembalikan Promise<boolean>. */
function tanya(judul, isi, tombol) {
  return new Promise(selesai => {
    const lapis = document.createElement('div');
    lapis.className = 'konf-dialog';
    lapis.innerHTML = `<div class="konf-dialog__kotak" role="alertdialog" aria-modal="true" aria-labelledby="konfDialogJudul">
        <h2 id="konfDialogJudul" class="text-[18px] font-semibold">${judul}</h2>
        <p class="mt-2 text-[13.5px] leading-[1.7] text-white/65">${isi}</p>
        <div class="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" data-jawab="0" class="rounded-full border border-white/20 px-5 py-2.5 text-[13px] font-medium text-white/85 transition hover:bg-white/10">Batal</button>
          <button type="button" data-jawab="1" class="rounded-full bg-rose-500 px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-rose-400">${tombol}</button>
        </div>
      </div>`;
    const tutup = v => { document.removeEventListener('keydown', esc); lapis.remove(); selesai(v); };
    const esc = e => { if (e.key === 'Escape') tutup(false); };
    lapis.addEventListener('click', e => {
      if (e.target === lapis) return tutup(false);
      const b = e.target.closest('[data-jawab]');
      if (b) tutup(b.dataset.jawab === '1');
    });
    document.addEventListener('keydown', esc);
    document.body.appendChild(lapis);
    lapis.querySelector('[data-jawab="0"]').focus();
  });
}

/** Pemda mengosongkan isian ruas (yang belum terverifikasi) untuk diisi ulang. */
async function kosongkan(ids, pesanSukses) {
  const kunci = kunciSaya();
  SIBUK = '*';
  try {
    await hapusRuas(COL_PEMDA, kunci, ids.filter(id => jawabanPemda(kunci, id)));
    ids.forEach(id => { delete EDIT[id]; tulisCadangan(kunci, id, null); });
    SIBUK = '';
    toast(pesanSukses);
    renderPemda();
    tandaiNav();
  } catch (e) {
    console.error('[MonevDAK] isian gagal dihapus:', e);
    SIBUK = '';
    renderPemda();
    toast(e && e.code === 'permission-denied'
      ? 'Gagal menghapus: server menolak. Aturan Firestore terbaru belum di-Publish.'
      : 'Gagal menghapus: ' + ((e && (e.message || e.code)) || 'periksa koneksi.'));
  }
}

async function ulangRuas(id) {
  if (SIBUK) return;
  const kunci = kunciSaya(), r = DATA[kunci].ruas.find(x => x.id === id);
  const ok = await tanya('Kosongkan isian ruas ini?',
    `Semua isian untuk <strong class="text-white">${aman(r.nama)}</strong> — angka perbaikan, kelengkapan, dan kendala — dihapus, dan statusnya kembali “Belum diperiksa”. Ruas lain tidak tersentuh.`,
    'Kosongkan');
  if (!ok) return;
  BUKA = new Set([id]);
  kosongkan([id], 'Isian ruas dikosongkan. Silakan isi ulang.');
}

async function ulangSemua() {
  if (SIBUK) return;
  const kunci = kunciSaya(), d = DATA[kunci];
  const bisa = d.ruas.filter(r => statusRuas(kunci, r.id) !== 'verif').map(r => r.id);
  const terisi = bisa.filter(id => jawabanPemda(kunci, id) || EDIT[id]);
  if (!terisi.length) { toast('Belum ada isian yang perlu dihapus.'); return; }
  const verif = d.ruas.length - bisa.length;
  const ok = await tanya('Hapus semua isian dan ulang input?',
    `Isian ${terisi.length} ruas di <strong class="text-white">${aman(d.kab)}</strong> akan dihapus — termasuk yang sudah dikirim ke pusat — dan Anda mengisi ulang dari awal.`
    + (verif ? ` ${verif} ruas yang sudah terverifikasi pusat tidak ikut dihapus.` : '') + ' Tindakan ini tidak bisa dibatalkan.',
    'Hapus & ulang');
  if (!ok) return;
  BUKA = new Set();
  kosongkan(terisi, 'Isian dihapus. Silakan mulai input ulang.');
}

/** Pusat: kosongkan seluruh data satu daerah (jawaban pemda + verifikasi). */
async function hapusDataDaerah() {
  if (SIBUK || !PILIH) return;
  const kunci = PILIH, d = DATA[kunci];
  const ok = await tanya('Hapus data konfirmasi daerah ini?',
    `Seluruh jawaban pemda <strong class="text-white">${aman(d.kab)}</strong> dan hasil verifikasi pusat untuk ${d.ruas.length} ruas akan dihapus, sehingga pemda mengisi ulang dari awal. Tindakan ini tidak bisa dibatalkan.`,
    'Hapus data');
  if (!ok) return;
  SIBUK = '*';
  try {
    await hapusDaerah(kunci);
    SIBUK = '';
    BUKA = new Set(); PUTUS = {};
    toast('Data ' + d.kab + ' dihapus. Pemda dapat mengisi ulang.');
    renderDetailPusat();
  } catch (e) {
    console.error('[MonevDAK] data daerah gagal dihapus:', e);
    SIBUK = '';
    toast(e && e.code === 'permission-denied'
      ? 'Gagal menghapus: server menolak. Publish ulang firestore.rules di Firebase Console.'
      : 'Gagal menghapus: ' + ((e && (e.message || e.code)) || 'periksa koneksi.'));
  }
}


/* ═══════════════════════════════════════════════════════════════
   5. PUSAT — meninjau dan memverifikasi
   ═══════════════════════════════════════════════════════════════ */
function daftarDaerah() {
  return Object.entries(DATA).map(([kunci, d]) => {
    const n = hitungDaerah(kunci);
    return { kunci, prov: d.prov, kab: d.kab, n, st: statusDaerah(n) };
  });
}

function renderPusat() {
  if (PILIH && DATA[PILIH]) return renderDetailPusat();
  const semua = daftarDaerah();
  const tot = semua.reduce((a, x) => {
    ['total', 'dikirim', 'verif', 'kembali'].forEach(k => { a[k] += x.n[k]; });
    if (x.n.dikirim + x.n.verif + x.n.kembali > 0) a.daerah++;
    return a;
  }, { total: 0, dikirim: 0, verif: 0, kembali: 0, daerah: 0 });

  const prov = [...new Set(semua.map(x => x.prov))].sort((a, b) => a.localeCompare(b, 'id'));
  const q = SARING.cari.trim().toLowerCase();
  const tampil = semua
    .filter(x => (!SARING.prov || x.prov === SARING.prov)
              && (!SARING.status || x.st === SARING.status)
              && (!q || (x.kab + ' ' + x.prov).toLowerCase().includes(q)))
    /* Yang menunggu tindakan pusat di atas, baru sisanya per wilayah. */
    .sort((a, b) => URUT_PUSAT.indexOf(a.st) - URUT_PUSAT.indexOf(b.st)
      || a.prov.localeCompare(b.prov, 'id') || a.kab.localeCompare(b.kab, 'id'));

  const kartuAngka = (angka, label, rgb, i) => `<div class="glass konf-muncul rounded-3xl p-5" style="animation-delay:${(0.05 * i).toFixed(2)}s">
      <p class="text-[30px] font-semibold tabular-nums leading-none" style="color:rgb(${rgb})">${angka}</p>
      <p class="mt-2 text-[12.5px] text-white/55">${label}</p></div>`;

  const segmen = n => n.total ? URUT_STATUS.map(st => n[st]
      ? `<span class="konf-segbar" style="flex:${n[st]};background:rgb(${STATUS[st].rgb} / ${st === 'belum' ? '.25' : '.85'})" title="${STATUS[st].label}: ${n[st]}"></span>` : '').join('') : '';

  WADAH.innerHTML = `
    ${MODE_ADMIN ? '' : `<p class="konf-muncul text-[12px] font-semibold uppercase tracking-[0.2em] text-teal-300/80">Verifikasi pusat · Triwulan III</p>
    <h1 class="konf-muncul mt-3 text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] md:text-[40px]" style="animation-delay:.05s">Konfirmasi data ruas pemda</h1>`}
    <p class="konf-muncul mt-3 max-w-[720px] text-[14.5px] leading-[1.7] text-white/60" style="animation-delay:.08s">
      Pemda memeriksa angka eMonitoring per ${TGL_EMON} untuk tiap ruasnya. Tinjau kirimannya, isi kesesuaian item dan tindak lanjut,
      lalu verifikasi atau kembalikan dengan catatan.</p>

    <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      ${kartuAngka(tot.daerah + '<span class="text-[16px] text-white/40">/' + semua.length + '</span>', 'Daerah sudah mengirim', '45 212 191', 1)}
      ${kartuAngka(tot.dikirim, 'Ruas menunggu verifikasi', STATUS.dikirim.rgb, 2)}
      ${kartuAngka(tot.verif + '<span class="text-[16px] text-white/40">/' + tot.total + '</span>', 'Ruas terverifikasi', STATUS.verif.rgb, 3)}
      ${kartuAngka(tot.kembali, 'Ruas dikembalikan', STATUS.kembali.rgb, 4)}
    </div>

    <div class="mt-8 flex flex-wrap items-center gap-3">
      <select onchange="KONF.saring('prov',this.value)" aria-label="Saring provinsi" class="glass rounded-full px-5 py-2.5 text-[13px] font-medium text-white outline-none [&>option]:bg-ink">
        <option value="">Semua provinsi</option>${prov.map(p => `<option ${SARING.prov === p ? 'selected' : ''}>${aman(p)}</option>`).join('')}
      </select>
      <select onchange="KONF.saring('status',this.value)" aria-label="Saring status" class="glass rounded-full px-5 py-2.5 text-[13px] font-medium text-white outline-none [&>option]:bg-ink">
        <option value="">Semua status</option>
        ${['dikirim', 'kembali', 'draf', 'verif', 'belum'].map(st => `<option value="${st}" ${SARING.status === st ? 'selected' : ''}>${st === 'draf' ? 'Sebagian / draf' : STATUS[st].label}</option>`).join('')}
      </select>
      <div class="glass flex items-center gap-2 rounded-full px-5 py-2.5">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" class="h-4 w-4 text-white/50"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input id="konfCari" value="${aman(SARING.cari)}" oninput="KONF.saring('cari',this.value)" placeholder="Cari daerah" aria-label="Cari daerah"
          class="w-40 bg-transparent text-[13px] outline-none placeholder:text-white/40" />
      </div>
      <div class="ml-auto flex flex-wrap gap-2">
        <button type="button" onclick="KONF.muatUlang()" class="rounded-full border border-white/20 px-5 py-2.5 text-[13px] font-medium text-white/85 transition hover:bg-white/10">Muat ulang</button>
        <button type="button" onclick="KONF.unduh()" class="cta-glow rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-black">Unduh kertas kerja (.xlsx)</button>
      </div>
    </div>

    <div class="glass mt-6 overflow-hidden rounded-3xl">
      ${tampil.length ? tampil.map((x, i) => `
        <button type="button" onclick="KONF.periksa('${x.kunci}')"
          class="konf-daerah konf-muncul flex w-full flex-wrap items-center gap-x-5 gap-y-2 border-b border-white/[.07] px-5 py-4 text-left last:border-0 md:px-6"
          style="animation-delay:${Math.min(0.3 + i * 0.025, 0.9).toFixed(3)}s">
          <div class="min-w-[200px] flex-[1.3]">
            <p class="text-[15px] font-semibold">${aman(x.kab)}</p>
            <p class="text-[12px] text-white/45">${aman(x.prov)}</p>
          </div>
          <div class="min-w-[180px] flex-1">
            <div class="flex h-2 gap-[2px] overflow-hidden rounded-full bg-white/[.06]">${segmen(x.n)}</div>
            <p class="mt-1.5 text-[11.5px] tabular-nums text-white/50">${x.n.verif}/${x.n.total} terverifikasi${x.n.dikirim ? ' · ' + x.n.dikirim + ' menunggu' : ''}${x.n.kembali ? ' · ' + x.n.kembali + ' dikembalikan' : ''}</p>
          </div>
          <div class="flex items-center gap-3">${chip(x.st, true)}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="konf-maju h-4 w-4 text-white/40"><path d="M9 6l6 6-6 6"/></svg>
          </div>
        </button>`).join('')
      : '<p class="px-6 py-10 text-center text-[14px] text-white/50">Tidak ada daerah yang cocok dengan saringan.</p>'}
    </div>`;
}

function renderDetailPusat() {
  const kunci = PILIH, d = DATA[kunci], n = hitungDaerah(kunci);
  if (!BUKA.size) {
    const pertama = d.ruas.find(r => statusRuas(kunci, r.id) === 'dikirim') || d.ruas[0];
    if (pertama) BUKA.add(pertama.id);
  }
  WADAH.innerHTML = `
    <button type="button" onclick="KONF.kembaliDaftar()" class="konf-muncul mb-6 flex items-center gap-2 text-[13px] font-medium text-white/60 transition hover:text-white">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>Semua daerah
    </button>
    <p class="konf-muncul text-[12px] font-semibold uppercase tracking-[0.2em] text-teal-300/80">${aman(d.prov)}</p>
    <h1 class="konf-muncul mt-2 text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] md:text-[36px]" style="animation-delay:.05s">${aman(d.kab)}</h1>
    <div class="konf-muncul mt-2 flex flex-wrap items-center justify-between gap-3" style="animation-delay:.08s">
      <p class="text-[14px] text-white/60">${n.total} ruas · ${n.verif} terverifikasi · ${n.dikirim} menunggu · ${n.kembali} dikembalikan · ${n.belum + n.draf} belum dikirim pemda</p>
      ${KONF[kunci] || VERIF[kunci] ? `<button type="button" onclick="KONF.hapusDataDaerah()" ${SIBUK ? 'disabled' : ''}
        class="rounded-full border border-rose-400/40 px-4 py-2 text-[12.5px] font-semibold text-rose-200 transition hover:bg-rose-500/10 disabled:opacity-40">Hapus data &amp; minta pemda input ulang</button>` : ''}
    </div>
    <div class="mt-7 space-y-4">${d.ruas.map((r, i) => kartuPusat(kunci, r, i)).join('')}</div>`;
}

function kartuPusat(kunci, r, i) {
  const st = statusRuas(kunci, r.id);
  const buka = BUKA.has(r.id);
  return `<article id="konf-${aman(r.id)}" ${atributKartu(kunci, st, i, 0.1)}>
    ${kepalaKartu(kunci, r, st, buka, `KONF.buka('${aman(r.id)}')`, i)}
    ${buka ? `<div class="konf-isi border-t border-white/10 px-5 pb-6 pt-5 md:px-6">${isiPusat(kunci, r, st)}</div>` : ''}
  </article>`;
}

function salinanPutusan(kunci, r) {
  if (PUTUS[r.id]) return PUTUS[r.id];
  const p = putusanPusat(kunci, r.id);
  /* Catatan pengembalian sudah dibaca pemda; putusan berikutnya mulai dari
     kosong, dan catatan lamanya cukup ditampilkan sebagai riwayat. */
  const kembali = p && p.status === 'dikembalikan';
  PUTUS[r.id] = {
    kes: (p && p.kes ? p.kes : r.tw2).slice(),
    tl: (p && p.tl) || '',
    catatan: kembali ? '' : ((p && p.catatan) || ''),
    catatanLama: kembali ? (p.catatan || '') : '',
    galat: ''
  };
  return PUTUS[r.id];
}

function isiPusat(kunci, r, st) {
  const j = jawabanPemda(kunci, r.id);
  const w = salinanPutusan(kunci, r);
  const id = aman(r.id);
  const baris = KOLOM.map(c => {
    const a = j && j.f && j.f[c.k];
    const emon = c.tipe === 'tgl' ? (r.e.pho || 'Belum ada BA PHO') : fmtNilai(c.tipe, r.e[c.k]);
    let pemda = '<span class="text-white/35">belum diisi</span>', beda = false;
    if (a && (a.s === 'ok')) pemda = '<span class="text-emerald-300">Sesuai eMon</span>';
    if (a && a.s === 'belum') pemda = '<span class="text-white/70">Belum PHO</span>';
    if (a && (a.s === 'ubah' || a.s === 'sudah')) {
      beda = true;
      pemda = `<span class="font-semibold tabular-nums text-amber-200">${fmtNilai(c.tipe, a.v)}</span>`;
    }
    return `<tr class="${beda ? 'konf-beda' : ''}">
      <td class="py-2.5 pr-4 text-[13px] text-white/70">${c.label}</td>
      <td class="py-2.5 pr-4 text-[13px] tabular-nums text-white/60">${aman(emon)}</td>
      <td class="py-2.5 text-[13px]">${beda ? '<span class="mr-1.5 text-amber-300/80">→</span>' : ''}${pemda}</td>
    </tr>`;
  }).join('');

  const terkunciMode = st === 'verif';
  const kes = KES.map((t, i) => `<div class="flex items-center justify-between gap-3 rounded-2xl bg-white/[.035] px-3.5 py-2.5">
      <span class="text-[13px]">${t}</span>
      <div class="konf-segmen konf-segmen--kecil" role="radiogroup" aria-label="${t}">
        <button type="button" role="radio" aria-checked="${w.kes[i] === 'S'}" onclick="KONF.kes('${id}',${i},'S')" class="konf-segmen__opsi konf-segmen__opsi--ok ${w.kes[i] === 'S' ? 'on' : ''}">Sesuai</button>
        <button type="button" role="radio" aria-checked="${w.kes[i] === 'T'}" onclick="KONF.kes('${id}',${i},'T')" class="konf-segmen__opsi ${w.kes[i] === 'T' ? 'on' : ''}">Tidak</button>
      </div>
    </div>`).join('');

  return `
    <div class="grid gap-6 lg:grid-cols-[1.15fr,1fr]">
      <div>
        <p class="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/45">Jawaban pemda${j && j.oleh && j.oleh.nama ? ' · ' + aman(j.oleh.nama) : ''}</p>
        <table class="mt-2 w-full">
          <thead><tr class="text-left text-[11px] uppercase tracking-[0.12em] text-white/40">
            <th class="pb-1 font-medium">Isian</th><th class="pb-1 font-medium">eMon</th><th class="pb-1 font-medium">Pemda</th></tr></thead>
          <tbody class="divide-y divide-white/[.06]">${baris}</tbody>
        </table>
        <div class="mt-4 rounded-2xl bg-white/[.035] px-4 py-3">
          <p class="text-[11.5px] text-white/45">Kendala dari pemda</p>
          <p class="mt-1 text-[13.5px] leading-[1.6] ${j && j.kendala ? 'text-white/85' : 'text-white/35'}">${j && j.kendala ? aman(j.kendala) : 'Tidak ada'}</p>
        </div>
        <p class="mt-4 text-[11.5px] text-white/45">Kelengkapan eMon ${j && Array.isArray(j.lk) ? 'menurut verifikasi pemda' : '(catatan eMon, belum diverifikasi pemda)'}</p>
        <div class="mt-1.5 flex flex-wrap gap-1.5">${lkAkhir(j, r).map((x, i) => {
          const beda = !!x !== !!r.lk[i];
          return `<span class="rounded-full px-2.5 py-0.5 text-[11px] ${x ? 'bg-emerald-400/10 text-emerald-200' : 'bg-rose-400/10 text-rose-200'} ${beda ? 'ring-1 ring-amber-300/50' : ''}"
            title="${beda ? 'Berbeda dari catatan eMon (' + (r.lk[i] ? 'lengkap' : 'tidak lengkap') + ')' : ''}">${LK[i]}: ${x ? 'lengkap' : 'tidak lengkap'}${beda ? ' *' : ''}</span>`;
        }).join('')}</div>
      </div>
      <div>
        <p class="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/45">Kesesuaian item <span class="normal-case tracking-normal text-white/35">— terisi dari rakor TW II</span></p>
        <div class="mt-2 grid gap-2">${kes}</div>
        <label for="konf-tl-${id}" class="mt-4 block text-[13px] font-medium">Tindak lanjut</label>
        <textarea id="konf-tl-${id}" rows="2" oninput="KONF.teksPusat('${id}','tl',this.value)" class="konf-input mt-1.5 w-full resize-y">${aman(w.tl)}</textarea>
        <label for="konf-cat-${id}" class="mt-3 block text-[13px] font-medium">Catatan untuk pemda <span class="font-normal text-white/40">(wajib bila dikembalikan)</span></label>
        <textarea id="konf-cat-${id}" rows="2" oninput="KONF.teksPusat('${id}','catatan',this.value)" class="konf-input mt-1.5 w-full resize-y">${aman(w.catatan)}</textarea>
        ${w.catatanLama ? `<p class="mt-1.5 text-[12px] leading-[1.55] text-white/45">Catatan pengembalian sebelumnya: ${aman(w.catatanLama)}</p>` : ''}
      </div>
    </div>
    ${w.galat ? `<p class="mt-4 rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-200">${aman(w.galat)}</p>` : ''}
    <div class="mt-6 flex flex-wrap items-center justify-end gap-3">
      ${!j || j.status !== 'dikirim' ? `<p class="mr-auto text-[12.5px] text-amber-200/80">${j ? 'Pemda baru menyimpan draf, belum mengirim.' : 'Pemda belum memeriksa ruas ini.'}</p>` : ''}
      ${terkunciMode ? '<p class="mr-auto text-[12.5px] text-emerald-200/80">Sudah terverifikasi. Menyimpan lagi akan memperbarui hasil verifikasi.</p>' : ''}
      <button type="button" onclick="KONF.putuskan('${id}','dikembalikan')" ${SIBUK ? 'disabled' : ''}
        class="rounded-full border border-rose-400/50 bg-rose-500/10 px-5 py-2.5 text-[13px] font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-40">Kembalikan ke pemda</button>
      <button type="button" onclick="KONF.putuskan('${id}','terverifikasi')" ${SIBUK ? 'disabled' : ''}
        class="cta-glow inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-[13px] font-semibold text-black disabled:opacity-40">
        ${SIBUK === r.id ? '<span class="konf-putar"></span>Menyimpan…' : 'Verifikasi'}</button>
    </div>`;
}

async function putuskan(id, status) {
  if (SIBUK) return;
  const kunci = PILIH, r = DATA[kunci].ruas.find(x => x.id === id);
  const w = salinanPutusan(kunci, r);
  w.galat = '';
  if (status === 'dikembalikan' && !w.catatan.trim()) {
    w.galat = 'Tulis catatan supaya pemda tahu apa yang perlu diperbaiki.';
    gambarUlangKartu(id);
    return;
  }
  SIBUK = id;
  gambarUlangKartu(id);
  try {
    await tulisRuas(COL_PUSAT, kunci, id, { status, kes: w.kes, tl: w.tl.trim(), catatan: w.catatan.trim(), at: Date.now() });
    SIBUK = '';
    delete PUTUS[id];
    BUKA.delete(id);
    const d = DATA[kunci];
    const berikut = d.ruas.find(x => x.id !== id && statusRuas(kunci, x.id) === 'dikirim');
    if (berikut) BUKA.add(berikut.id);
    toast(status === 'terverifikasi' ? 'Ruas terverifikasi.' : 'Dikembalikan ke pemda dengan catatan.');
    renderDetailPusat();
  } catch (e) {
    console.error('[MonevDAK] verifikasi gagal disimpan:', e);
    SIBUK = '';
    w.galat = 'Gagal menyimpan: ' + (e.code === 'permission-denied'
      ? 'basis data menolak. Tempel ulang firestore.rules di Firebase Console.' : (e.message || e.code));
    gambarUlangKartu(id);
  }
}


/* ═══════════════════════════════════════════════════════════════
   6. UNDUH KERTAS KERJA
   Kolomnya mengikuti kertas kerja rakor, dengan angka akhir: angka
   pemda bila diperbarui, selain itu angka eMon.
   ═══════════════════════════════════════════════════════════════ */
let pizzipDimuat = null;
function muatPizzip() {
  if (window.PizZip) return Promise.resolve();
  if (pizzipDimuat) return pizzipDimuat;
  pizzipDimuat = new Promise((ok, gagal) => {
    const s = document.createElement('script');
    s.src = CDN_PIZZIP;
    s.onload = ok;
    s.onerror = () => { pizzipDimuat = null; gagal(new Error('PizZip tidak termuat')); };
    document.head.appendChild(s);
  });
  return pizzipDimuat;
}

const xmlAman = s => String(s == null ? '' : s)
  .replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
  .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
function hurufKolom(i) {
  let s = '', n = i + 1;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; }
  return s;
}

async function unduh() {
  try { await muatSemua(true); await muatPizzip(); }
  catch (e) { toast('Gagal menyiapkan unduhan: ' + (e.code || e.message)); return; }

  const GRUP = [['Data umum kegiatan', 7], ['Progres kegiatan', 5], ['Kelengkapan dalam aplikasi eMonitoring DAK', 4],
                ['Kesesuaian item', 6], ['Hasil evaluasi', 2], ['Status konfirmasi', 3]];
  const KEPALA = ['Provinsi', 'Daerah', 'Rincian', 'Ruas', 'Volume', 'Satuan', 'Nilai Usulan',
    'Progres Fisik (%)', 'Progres Keuangan (%)', 'Nilai Kontrak (Rp)', 'Realisasi Kontrak (Rp)', 'Tanggal PHO',
    'Data Kontrak', 'Data Progres', 'Data Tenaga Kerja', 'Foto Kegiatan',
    'Ruas dalam RK', 'DED', 'Jenis Penanganan', 'Target Penanganan', 'Bahu', 'Marka',
    'Kendala/Permasalahan', 'Tindak Lanjut', 'Status Pemda', 'Status Pusat', 'Angka diperbarui pemda'];
  const LEBAR = [20, 24, 22, 34, 9, 8, 16, 10, 11, 17, 17, 16, 12, 12, 12, 12, 11, 9, 11, 11, 9, 9, 34, 30, 16, 16, 24];

  const baris = [];
  Object.entries(DATA)
    .sort((a, b) => a[1].prov.localeCompare(b[1].prov, 'id') || a[1].kab.localeCompare(b[1].kab, 'id'))
    .forEach(([kunci, d]) => d.ruas.forEach(r => {
      const j = jawabanPemda(kunci, r.id) || {};
      const p = putusanPusat(kunci, r.id) || {};
      const f = j.f || {};
      const akhir = k => (f[k] && f[k].s === 'ubah' && f[k].v != null && f[k].ok !== false) ? f[k].v : r.e[k];
      const diubah = KOLOM.filter(c => f[c.k] && (f[c.k].s === 'ubah' || f[c.k].s === 'sudah')).map(c => c.label);
      const pho = f.pho && f.pho.s === 'sudah' ? fmtTgl(f.pho.v) : (f.pho && f.pho.s === 'belum' ? '' : (r.e.pho || ''));
      const kes = p.kes || r.tw2;
      const st = statusRuas(kunci, r.id);
      baris.push([
        'Provinsi ' + d.prov, d.kab, r.rin, r.kode + ' - ' + r.nama, r.vol == null ? '' : r.vol, r.sat || '', r.pagu == null ? '' : r.pagu,
        akhir('fisik') == null ? '' : akhir('fisik'), akhir('keu') == null ? '' : akhir('keu'),
        akhir('kontrak') == null ? '' : akhir('kontrak'), akhir('real') == null ? '' : akhir('real'), pho,
        ...lkAkhir(j, r).map(x => x ? 'Lengkap' : 'Tidak Lengkap'),
        ...kes.map(x => x === 'S' ? 'Sesuai' : x === 'T' ? 'Tidak Sesuai' : ''),
        j.kendala || '', p.tl || '',
        { belum: 'Belum diperiksa', draf: 'Draf', dikirim: 'Dikirim', kembali: 'Dikirim', verif: 'Dikirim' }[st],
        p.status === 'terverifikasi' ? 'Terverifikasi' : p.status === 'dikembalikan' ? 'Dikembalikan' : '',
        diubah.join(', ')
      ]);
    }));

  const sel = (ref, v, gaya) => {
    if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}" s="${gaya || 3}"><v>${v}</v></c>`;
    if (v === '' || v == null) return `<c r="${ref}"${gaya ? ` s="${gaya}"` : ''}/>`;
    return `<c r="${ref}" s="${gaya || 2}" t="inlineStr"><is><t xml:space="preserve">${xmlAman(v)}</t></is></c>`;
  };
  let kol = 0;
  const merge = [];
  const r1 = GRUP.map(([t, n]) => {
    const a = hurufKolom(kol) + '1', b = hurufKolom(kol + n - 1) + '1';
    if (n > 1) merge.push(`<mergeCell ref="${a}:${b}"/>`);
    const isi = [sel(a, t, 1)];
    for (let i = 1; i < n; i++) isi.push(sel(hurufKolom(kol + i) + '1', '', 1));
    kol += n;
    return isi.join('');
  }).join('');
  const r2 = KEPALA.map((t, j) => sel(hurufKolom(j) + '2', t, 1)).join('');
  const isiBaris = baris.map((r, i) => `<row r="${i + 3}">${r.map((v, j) => {
      const angka = typeof v === 'number';
      const gaya = angka ? ([9, 10, 11].includes(j) || j === 6 ? 4 : 3) : 2;
      return sel(hurufKolom(j) + (i + 3), v, gaya);
    }).join('')}</row>`).join('');

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
<sheets><sheet name="Kertas Kerja" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  xl.folder('_rels').file('workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
  xl.file('styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0"/></numFmts>
<fonts count="2"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFD966"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border/><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
</cellXfs>
</styleSheet>`);
  xl.folder('worksheets').file('sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane xSplit="4" ySplit="2" topLeftCell="E3" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>
<cols>${LEBAR.map((w, j) => `<col min="${j + 1}" max="${j + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>
<sheetData><row r="1" ht="22" customHeight="1">${r1}</row><row r="2" ht="42" customHeight="1">${r2}</row>${isiBaris}</sheetData>
<autoFilter ref="A2:${hurufKolom(KEPALA.length - 1)}${baris.length + 2}"/>
<mergeCells count="${merge.length}">${merge.join('')}</mergeCells>
</worksheet>`);

  const blob = zip.generate({ type: 'blob', compression: 'DEFLATE',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const t = new Date(), p = x => String(x).padStart(2, '0');
  const nama = `Kertas Kerja Rakor TW III TA 2026 - konfirmasi ${t.getFullYear()}${p(t.getMonth() + 1)}${p(t.getDate())}-${p(t.getHours())}${p(t.getMinutes())}.xlsx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nama;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast(nama + ' terunduh.');
}


/* ═══════════════════════════════════════════════════════════════
   7. DAFTAR NAMA UNTUK MASUK
   Pemda masuk dengan memilih namanya dari daftar akun daerahnya. Daftar
   itu dibentuk dari koleksi `peserta` (yang hanya boleh dibaca admin),
   jadi admin menyusunnya sekali; selanjutnya tiap akun memperbarui
   barisnya sendiri setiap kali masuk atau mendaftar.
   ═══════════════════════════════════════════════════════════════ */
async function susunAkun() {
  const tombol = el('#konfSusunAkun');
  if (tombol) { tombol.disabled = true; tombol.textContent = 'Menyusun…'; }
  try {
    const semua = await store.semuaPeserta();
    const sah = new Set(Object.keys(DATA));
    const akun = semua.filter(p => p.email && p.kab && !/jalan/i.test(p.nama || '') && !/jalan/i.test(String(p.email).split('@')[0])
                                   && sah.has(slugK(p.kab)));
    if (pakaiFirebase()) {
      const { doc, writeBatch, serverTimestamp } = store.fs;
      for (let i = 0; i < akun.length; i += 400) {
        const b = writeBatch(store.db);
        akun.slice(i, i + 400).forEach(p => b.set(doc(store.db, 'akunDaerah', slugK(p.kab), 'akun', p.pid), {
          uid: p.pid, nama: p.nama, email: p.email, kab: p.kab, prov: p.prov || '', diperbaruiAt: serverTimestamp()
        }, { merge: true }));
        await b.commit();
      }
    }
    toast(akun.length + ' akun pemda tersusun di daftar masuk.');
    if (tombol) tombol.textContent = akun.length + ' akun tersusun';
  } catch (e) {
    console.error(e);
    toast('Gagal menyusun daftar akun: ' + (e.code || e.message));
    if (tombol) { tombol.disabled = false; tombol.textContent = 'Susun daftar nama masuk'; }
  }
}


/* ═══════════════════════════════════════════════════════════════
   8. TITIK MASUK
   ═══════════════════════════════════════════════════════════════ */
function gambarGalat(e) {
  WADAH.innerHTML = `<div class="glass rounded-3xl border border-rose-400/30 p-7">
    <h2 class="text-[18px] font-semibold">Data konfirmasi belum dapat dibaca</h2>
    <p class="mt-2 text-[14px] leading-[1.7] text-white/65">${e && e.code === 'permission-denied'
      ? 'Basis data menolak permintaan. Aturan Firestore untuk koleksi konfirmasi belum dipasang — tempel ulang firestore.rules di Firebase Console.'
      : 'Periksa koneksi internet, lalu muat ulang.'}</p>
    <button type="button" onclick="KONF.muatUlang()" class="mt-5 rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-black">Coba lagi</button>
  </div>`;
}

function gambarMemuat() {
  WADAH.innerHTML = `<div class="space-y-4">${[0, 1, 2].map(i =>
    `<div class="glass konf-kerangka h-28 rounded-3xl" style="animation-delay:${i * 0.12}s"></div>`).join('')}</div>`;
}

function tandaiNav() {
  if (!akunSaya() || iniPusat()) {
    setLabelNav('');
    return;
  }
  const k = kunciSaya();
  const n = DATA[k] ? hitungDaerah(k) : null;
  if (!n || !n.total) { setLabelNav(''); return; }
  const terkirim = n.dikirim + n.verif;
  setLabelNav(terkirim === n.total ? 'hijau' : terkirim === 0 ? 'merah' : 'kuning');
}

/** Label NEW di menu: merah (belum dikirim), kuning (sebagian), hijau (semua terkirim). */
function setLabelNav(warna) {
  els('[data-nav="konfirmasi"]').forEach(b => {
    b.classList.remove('nav-belum', 'nav-new', 'nav-new--merah', 'nav-new--kuning', 'nav-new--hijau');
    if (warna) b.classList.add('nav-new', 'nav-new--' + warna);
  });
}

window.KONF = {
  /** Menu aplikasi: pemda melihat daerahnya, petugas PFID melihat semua. */
  async render() {
    MODE_ADMIN = false;
    WADAH = el('#view-konfirmasi');
    if (!WADAH || !akunSaya()) return;
    gambarMemuat();
    try {
      if (iniPusat()) { await muatSemua(); renderPusat(); }
      /* Pemda baru boleh mengonfirmasi setelah pre test TW III dikerjakan. */
      else if (typeof hasilSaya === 'function' && !hasilSaya('pre') && window.TUTOR) WADAH.innerHTML = window.TUTOR.layarTerkunci();
      else { await muatDaerah(kunciSaya()); renderPemda(); }
      tandaiNav();
    } catch (e) { console.error(e); gambarGalat(e); }
  },

  /** Tab di panel admin. */
  async renderAdmin(paksa) {
    MODE_ADMIN = true;
    WADAH = el('#adKonf');
    if (!WADAH) return;
    gambarMemuat();
    try { await muatSemua(paksa); renderPusat(); }
    catch (e) { console.error(e); gambarGalat(e); }
  },

  /** Ringkasan untuk kartu di dashboard pemda. */
  async ringkasSaya() {
    const k = kunciSaya();
    if (!DATA[k]) return null;
    await muatDaerah(k);
    tandaiNav();
    return hitungDaerah(k);
  },

  syncNav() {
    els('[data-nav="konfirmasi"]').forEach(b => b.classList.toggle('hidden', !akunSaya()));
  },

  reset() {
    KONF = {}; VERIF = {}; DIMUAT = {}; BUKA = new Set(); EDIT = {}; PUTUS = {};
    PILIH = null; SARING = { prov: '', status: '', cari: '' }; SIBUK = '';
  },

  buka(id) {
    if (BUKA.has(id)) BUKA.delete(id); else BUKA.add(id);
    gambarUlangKartu(id, true);
  },
  pilih, isi, ketik, terapkan, ubahLagi, lk, kendala, semuaSesuai, simpan, ulangRuas, ulangSemua, hapusDataDaerah,

  periksa(kunci) {
    PILIH = kunci; BUKA = new Set(); PUTUS = {};
    renderDetailPusat();
    (MODE_ADMIN ? el('#adKonf') : WADAH).scrollIntoView({ block: 'start', behavior: 'smooth' });
  },
  kembaliDaftar() { PILIH = null; BUKA = new Set(); renderPusat(); },
  kes(id, i, v) {
    const r = DATA[PILIH].ruas.find(x => x.id === id);
    salinanPutusan(PILIH, r).kes[i] = v;
    gambarUlangKartu(id);
  },
  teksPusat(id, k, v) {
    const r = DATA[PILIH].ruas.find(x => x.id === id);
    salinanPutusan(PILIH, r)[k] = v;
  },
  putuskan,

  saring(k, v) {
    SARING[k] = v;
    renderPusat();
    if (k === 'cari') {
      const c = el('#konfCari');
      if (c) { c.focus(); c.setSelectionRange(c.value.length, c.value.length); }
    }
  },
  async muatUlang() {
    DIMUAT = {}; EDIT = {}; PUTUS = {};
    if (MODE_ADMIN) return this.renderAdmin(true);
    return this.render();
  },
  unduh,
  susunAkun
};

})();
