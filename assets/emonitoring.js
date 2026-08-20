/* ═══════════════════════════════════════════════════════════════════════
   PROGRES eMONITORING — tab di panel admin

   Angka pada berita acara adalah keadaan saat rapat; yang dipakai menagih
   adalah keadaan hari ini di aplikasi eMonitoring. Angka itu tidak bisa
   diambil sendiri oleh aplikasi ini, jadi admin mengunggahnya secara berkala
   dalam bentuk .xlsx atau .csv, lalu tiap daerah bisa langsung dihubungi
   lewat WhatsApp dari barisnya masing-masing.

   Kerangkanya 164 daerah penerima DAK di assets/wilayah.js — sama seperti
   ceklis kesiapan — sehingga daerah yang belum pernah melapor sekalipun tetap
   punya barisnya sendiri.

   Nomor telepon dicari berurutan: nomor yang diketik admin sendiri lebih
   dulu, lalu kolom pada berkas unggahan, baru nomor yang pernah diisi daerah
   itu pada survei kepuasan. Nomor survei dipakai apa adanya, tidak disalin ke
   tempat lain — termasuk tidak dijadikan isi awal kotak isian manual.

   Dua bentuk berkas diterima, dan bentuknya dikenali sendiri dari judul kolom:

     1. Unduhan mentah eMonitoring — satu baris satu paket. Kolomnya per
        triwulan (Fisik TW I…IV, Realisasi TW I…IV) beserta Dana DAK dan
        kolom tgl… (tglkontrak, tglpho, tglded, tglabd). Diringkas jadi satu
        baris per daerah; lihat ringkasMentah() untuk caranya.
     2. Rekap sederhana — satu baris satu daerah:
        Provinsi · Kabupaten/Kota · Fisik (%) · Keuangan (%) ·
        Nama Kontak · No HP · Tanggal Data
        Hanya nama daerah, fisik, dan keuangan yang wajib ada.

   Kolom dikenali dari judulnya, bukan urutannya, supaya format berkas masih
   boleh berubah tanpa menyentuh berkas ini.

   Penyimpanannya di koleksi Firestore `emonitoring`, satu dokumen per daerah,
   supaya admin di perangkat lain melihat angka yang sama. Bila Firebase tidak
   aktif, disimpan di peramban ini saja.
   ═══════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const el   = s => document.querySelector(s);
const aman = s => String(s == null ? '' : s)
  .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CDN_PIZZIP = 'https://unpkg.com/pizzip@3.2.0/dist/pizzip.min.js';
const LS_DATA  = 'monevdak_emonitoring';
const LS_PESAN = 'monevdak_emon_pesan';

/* Sama persis dengan kunciDaerah() pada assets/berita-acara.js: nomor telepon
   dari survei dan berita acara daerah yang sama harus bertemu di kunci yang
   sama. Jangan diubah sendirian di sini. */
const slugKunci = s => String(s == null ? '' : s).toLowerCase()
  .replace(/[^a-z0-9 ]/g, '').trim().replace(/\s+/g, '-');

const kunciDaerah = teks => slugKunci(String(teks || '')
  .replace(/^\s*(kabupaten|kab\.?)\s+/i, '')
  .replace(/^\s*kep\.?\s+/i, 'Kepulauan '));


/* ═══════════════════════════════════════════════════════════════
   1. KERANGKA 164 DAERAH
   ═══════════════════════════════════════════════════════════════ */
/* Daftar wilayah menyimpan kabupaten tanpa awalan — "Magelang" — sedangkan
   kota memakainya. Di pesan WhatsApp yang dikirim ke orangnya, penyebutan
   seperti itu berbahaya: "Magelang" saja tidak membedakan Kabupaten Magelang
   dari Kota Magelang, dan keduanya sama-sama penerima DAK. Karena itu nama
   yang dipakai menyebut daerah selalu bentuk lengkapnya. */
const labelKab = nama => (/^kota\b/i.test(nama) ? nama : 'Kab. ' + nama);
const labelPanjang = nama => (/^kota\b/i.test(nama) ? nama : 'Kabupaten ' + nama);

function daftarDaerah() {
  const w = window.WILAYAH || {};
  const keluar = [];
  Object.keys(w).sort((a, b) => a.localeCompare(b, 'id')).forEach(prov => {
    String(w[prov] || '').split(',').map(s => s.trim()).filter(Boolean).forEach(kab => {
      keluar.push({ prov, kab, label: labelKab(kab), kunci: kunciDaerah(kab) });
    });
  });
  return keluar;
}

/* Nama daerah pada berkas unggahan ditulis bebas — "Kab. Magelang",
   "KABUPATEN MAGELANG", atau singkatan yang biasa dipakai daerahnya sendiri.
   Alias di bawah menyamakan yang paling sering muncul; sisanya diserahkan
   pada kunciDaerah. */
const ALIAS = {
  tts: 'Timor Tengah Selatan', ttu: 'Timor Tengah Utara',
  sbd: 'Sumba Barat Daya', oki: 'Ogan Komering Ilir',
  'oku timur': 'Ogan Komering Ulu Timur', okut: 'Ogan Komering Ulu Timur',
  sitaro: 'Kepulauan Siau Tagulandang Biaro', pangkep: 'Pangkajene dan Kepulauan',
  sidrap: 'Sidenreng Rappang', yapen: 'Kepulauan Yapen',
  tanimbar: 'Kepulauan Tanimbar', mtb: 'Kepulauan Tanimbar',
  anambas: 'Kepulauan Anambas', pegaf: 'Pegunungan Arfak',
  'lubuk linggau': 'Kota Lubuklinggau', 'tanjung pinang': 'Kota Tanjungpinang',
  'pare pare': 'Kota Parepare'
};

let PETA_KUNCI = null;

/** Nama daerah bebas → salah satu dari 164 daerah, atau null. */
function cocokkanDaerah(teks) {
  if (!PETA_KUNCI) {
    PETA_KUNCI = new Map();
    daftarDaerah().forEach(d => PETA_KUNCI.set(d.kunci, d));
  }
  const bersih = String(teks || '').replace(/\s+/g, ' ').trim();
  if (!bersih) return null;

  const alias = ALIAS[bersih.toLowerCase().replace(/^\s*(kabupaten|kab\.?|kota)\s+/i, '').trim()];
  const langsung = PETA_KUNCI.get(kunciDaerah(bersih));
  if (langsung) return langsung;
  if (alias) return PETA_KUNCI.get(kunciDaerah(alias)) || null;

  /* "Dinas PUPR Kabupaten Magelang" — nama daerah kadang terselip di dalam
     nama instansi. Yang dipakai kecocokan terpanjang, supaya "Magelang" tidak
     merebut baris milik "Kota Magelang". */
  const rendah = ' ' + bersih.toLowerCase() + ' ';
  let terbaik = null;
  PETA_KUNCI.forEach(d => {
    const nama = d.kab.toLowerCase();
    if (rendah.indexOf(' ' + nama + ' ') < 0 && rendah.indexOf(nama) < 0) return;
    if (!terbaik || nama.length > terbaik.kab.length) terbaik = d;
  });
  return terbaik;
}


/* ═══════════════════════════════════════════════════════════════
   2. NOMOR TELEPON
   ═══════════════════════════════════════════════════════════════ */
/** "0812-3456-7890", "+62 812 3456 7890", "62812…" → "62812345678900".
    Kosong bila jelas bukan nomor Indonesia yang bisa dihubungi. */
function nomorWa(teks) {
  let s = String(teks == null ? '' : teks).replace(/[^\d+]/g, '');
  if (!s) return '';
  s = s.replace(/^\+/, '');
  if (s.startsWith('620')) s = '62' + s.slice(3);   // 62 08xx, salah tulis yang lazim
  else if (s.startsWith('0')) s = '62' + s.slice(1);
  else if (s.startsWith('8')) s = '62' + s;
  if (!s.startsWith('62')) return '';
  /* Nomor seluler Indonesia: 62 + 8xx + 6–10 angka. Nomor kantor tidak
     dipakai — WhatsApp-nya hampir pasti tidak ada. */
  return /^628\d{7,12}$/.test(s) ? s : '';
}

/** Ditampilkan sebagai 0812-3456-7890, bukan 62812…, supaya mudah dicocokkan. */
const nomorTampil = wa => {
  if (!wa) return '';
  const lokal = '0' + wa.slice(2);
  return lokal.replace(/^(\d{4})(\d{3,4})(\d+)$/, '$1-$2-$3');
};


/* ═══════════════════════════════════════════════════════════════
   3. PESAN WHATSAPP
   ═══════════════════════════════════════════════════════════════ */
/* Nama daerah disebut lengkap beserta provinsinya. Penerima pesan perlu tahu
   pasti daerah mana yang dimaksud sebelum menindaklanjuti — "Magelang" saja
   bisa berarti dua pemda yang berbeda. */
const PESAN_BAKU =
  'Selamat {waktu} Bapak/Ibu {nama}. Ingin menginfokan bahwa progres pelaporan ' +
  'di eMonitoring untuk {daerah}, Provinsi {provinsi}, yang ter-update per {tanggal} ' +
  'baru mencapai fisik {fisik}% dan keuangan {keuangan}%. Mohon segera update datanya. Terima kasih.';

const salamJam = jam => (jam < 11 ? 'pagi' : jam < 15 ? 'siang' : jam < 18 ? 'sore' : 'malam');

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
               'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function tanggalIndo(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return '';
  return `${+m[3]} ${BULAN[+m[2] - 1]} ${m[1]}`;
}

const isoHariIni = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function ambilPesan() {
  try { return localStorage.getItem(LS_PESAN) || PESAN_BAKU; } catch (e) { return PESAN_BAKU; }
}
function simpanPesan(teks) {
  try { localStorage.setItem(LS_PESAN, teks || ''); } catch (e) { /* peramban menolak, pakai bawaan */ }
}

const angkaId = n => (n == null ? '—' : String(Math.round(n * 100) / 100).replace('.', ','));

/** Isi pola pesan untuk satu baris. Nama kontak yang kosong tidak boleh
    meninggalkan "Bapak/Ibu ." — spasi ganda dan tanda baca menggantung
    dirapikan sesudah penggantian. */
function susunPesan(baris, pola) {
  const isi = (pola || ambilPesan())
    .replace(/\{waktu\}/g, salamJam(new Date().getHours()))
    .replace(/\{nama\}/g, baris.namaKontak || '')
    .replace(/\{daerah\}/g, baris.label || labelKab(baris.kab || ''))
    .replace(/\{daerahPanjang\}/g, labelPanjang(baris.kab || ''))
    .replace(/\{provinsi\}/g, baris.prov || '')
    .replace(/\{fisik\}/g, angkaId(baris.fisik))
    .replace(/\{keuangan\}/g, angkaId(baris.keuangan))
    .replace(/\{tanggal\}/g, tanggalIndo(baris.tanggalData) || 'hari ini');
  return isi.replace(/[ \t]{2,}/g, ' ').replace(/\s+([.,])/g, '$1').trim();
}

/** wa.me dipakai, bukan web.whatsapp.com: tautan yang sama membuka WhatsApp
    Web di komputer dan aplikasinya di ponsel. */
const tautanWa = baris =>
  'https://wa.me/' + baris.wa + '?text=' + encodeURIComponent(susunPesan(baris));


/* ═══════════════════════════════════════════════════════════════
   4. PENYIMPANAN
   ═══════════════════════════════════════════════════════════════ */
let DATA = {};        // kunciDaerah → { fisik, keuangan, hp, namaKontak, tanggalData, diperbaruiAt }
let DIMUAT = false;
let GALAT = '';

const pakaiFirebase = () => store.mode === 'firebase' && !!store.db;

const bacaLokal = () => { try { return JSON.parse(localStorage.getItem(LS_DATA) || '{}'); } catch (e) { return {}; } };
const tulisLokal = x => { try { localStorage.setItem(LS_DATA, JSON.stringify(x)); } catch (e) { /* penuh */ } };

async function muat(paksa) {
  if (DIMUAT && !paksa) return;
  GALAT = '';
  if (pakaiFirebase()) {
    try {
      const { collection, getDocs } = store.fs;
      const snap = await getDocs(collection(store.db, 'emonitoring'));
      DATA = {};
      snap.docs.forEach(d => { DATA[d.id] = d.data(); });
    } catch (e) {
      /* Koleksi ini baru; selama aturannya belum dipublikasikan di Firebase
         Console, pembacaannya ditolak. Beri tahu apa adanya, jangan diam. */
      GALAT = (e.code === 'permission-denied')
        ? 'Firestore menolak membaca koleksi emonitoring. Tempelkan ulang firestore.rules di Firebase Console, lalu muat ulang halaman ini. Sementara itu data yang tersimpan di peramban ini tetap dipakai.'
        : 'Data eMonitoring gagal dibaca: ' + (e.code || e.message);
      DATA = bacaLokal();
    }
  } else {
    DATA = bacaLokal();
  }
  DIMUAT = true;
}

/** Tulis hasil unggahan. Isi lama daerah itu tidak dibuang, hanya ditimpa
    kolom yang memang ada di berkasnya: unduhan mentah eMonitoring tidak
    memuat kontak sama sekali, dan nomor yang diketik admin harus selamat.
    `bersihkan` membuang daerah yang tidak ada di berkas itu — kecuali daerah
    yang nomornya diisi manual, yang dilepas cuma angka progresnya. */
async function simpan(baru, bersihkan) {
  const sekarang = Date.now();
  const isi = {};
  Object.keys(baru).forEach(k => {
    isi[k] = { ...(DATA[k] || {}), ...baru[k], diperbaruiAt: sekarang };
  });

  const sisa = {};
  if (bersihkan) {
    Object.keys(DATA).forEach(k => {
      const x = DATA[k] || {};
      if (k in isi || !(x.hpManual || x.namaKontakManual)) return;
      sisa[k] = { kunciDaerah: k, prov: x.prov || '', kab: x.kab || '',
                  namaKontakManual: x.namaKontakManual || '', hpManual: x.hpManual || '',
                  kontakAt: x.kontakAt || sekarang };
    });
  }

  const tulis = bersihkan ? { ...isi, ...sisa } : isi;
  const gabung = bersihkan ? tulis : { ...DATA, ...isi };

  if (pakaiFirebase()) {
    const { doc, setDoc, deleteDoc, writeBatch } = store.fs;
    const buang = bersihkan ? Object.keys(DATA).filter(k => !(k in tulis)) : [];
    if (writeBatch) {
      /* Satu batch Firestore memuat 500 tulisan; 164 daerah masih jauh di
         bawahnya, tetapi pemotongannya tetap dipasang untuk jaga-jaga. */
      const semua = Object.keys(tulis).map(k => ['set', k]).concat(buang.map(k => ['hapus', k]));
      for (let i = 0; i < semua.length; i += 400) {
        const b = writeBatch(store.db);
        semua.slice(i, i + 400).forEach(([jenis, k]) => {
          const acuan = doc(store.db, 'emonitoring', k);
          if (jenis === 'set') b.set(acuan, tulis[k]); else b.delete(acuan);
        });
        await b.commit();
      }
    } else {
      for (const k of Object.keys(tulis)) await setDoc(doc(store.db, 'emonitoring', k), tulis[k]);
      for (const k of buang) await deleteDoc(doc(store.db, 'emonitoring', k));
    }
  }

  DATA = gabung;
  tulisLokal(gabung);            // cadangan lokal selalu ikut ditulis
}

/** Nomor dan nama yang diketik admin untuk satu daerah. Disimpan pada dokumen
    daerah itu juga, tetapi di kolom sendiri (`hpManual`, `namaKontakManual`)
    supaya unggahan berikutnya tidak menimpanya. Nilai kosong menghapus kolom
    itu, artinya daerah tersebut kembali memakai nomor berkas atau survei. */
async function simpanKontak(kunci, nama, wa) {
  const d = daftarDaerah().find(x => x.kunci === kunci);
  const isi = { ...(DATA[kunci] || {}), kunciDaerah: kunci,
                prov: (d && d.prov) || '', kab: (d && d.kab) || '', kontakAt: Date.now() };
  if (nama) isi.namaKontakManual = nama; else delete isi.namaKontakManual;
  if (wa) isi.hpManual = wa; else delete isi.hpManual;

  if (pakaiFirebase()) {
    const { doc, setDoc } = store.fs;
    await setDoc(doc(store.db, 'emonitoring', kunci), isi);
  }
  DATA = { ...DATA, [kunci]: isi };
  tulisLokal(DATA);
}


/* ═══════════════════════════════════════════════════════════════
   5. PEMBACA BERKAS
   ═══════════════════════════════════════════════════════════════ */
let dimuatPizzip = null;
function muatPizzip() {
  if (window.PizZip) return Promise.resolve();
  if (dimuatPizzip) return dimuatPizzip;
  dimuatPizzip = new Promise((selesai, gagal) => {
    const s = document.createElement('script');
    s.src = CDN_PIZZIP;
    s.onload = selesai;
    s.onerror = () => { dimuatPizzip = null; gagal(new Error('pustaka pembaca Excel gagal dimuat')); };
    document.head.appendChild(s);
  });
  return dimuatPizzip;
}

const ENTITAS = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const bacaEntitas = s => String(s == null ? '' : s).replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (utuh, kode) => {
  if (kode[0] === '#') {
    const n = kode[1] === 'x' || kode[1] === 'X' ? parseInt(kode.slice(2), 16) : parseInt(kode.slice(1), 10);
    return isFinite(n) ? String.fromCodePoint(n) : utuh;
  }
  return ENTITAS[kode] != null ? ENTITAS[kode] : utuh;
});

/** "AB" → 27. Huruf kolom pada ref sel, dipakai supaya sel yang dilewati
    Excel tidak menggeser kolom berikutnya. */
function nomorKolom(huruf) {
  let n = 0;
  for (const c of huruf) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

function teksBersama(xml) {
  return (xml.match(/<si[ >][\s\S]*?<\/si>|<si\/>/g) || []).map(si => {
    const tanpaFonetik = si.replace(/<rPh[\s\S]*?<\/rPh>/g, '');
    return (tanpaFonetik.match(/<t[^>]*>[\s\S]*?<\/t>/g) || [])
      .map(t => bacaEntitas(t.replace(/^<t[^>]*>/, '').replace(/<\/t>$/, ''))).join('');
  });
}

/** Tanggal di Excel tersimpan sebagai angka hari sejak 1899-12-30. */
function tanggalSerial(n) {
  const ms = Math.round((n - 25569) * 86400000);
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '';
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function barisLembar(xml, bersama) {
  const keluar = [];
  for (const baris of xml.match(/<row[ >][\s\S]*?<\/row>|<row[^>]*\/>/g) || []) {
    const sel = [];
    for (const m of baris.matchAll(/<c\s([^>]*?)(\/>|>([\s\S]*?)<\/c>)/g)) {
      const atribut = m[1], dalam = m[3] || '';
      const ref = /r="([A-Z]+)\d+"/.exec(atribut);
      const j = ref ? nomorKolom(ref[1]) : sel.length;
      const jenis = (/t="([^"]+)"/.exec(atribut) || [])[1] || 'n';
      let nilai = '';
      if (jenis === 'inlineStr') {
        nilai = (dalam.match(/<t[^>]*>[\s\S]*?<\/t>/g) || [])
          .map(t => bacaEntitas(t.replace(/^<t[^>]*>/, '').replace(/<\/t>$/, ''))).join('');
      } else {
        const v = /<v>([\s\S]*?)<\/v>/.exec(dalam);
        nilai = v ? bacaEntitas(v[1]) : '';
        if (jenis === 's') nilai = bersama[+nilai] != null ? bersama[+nilai] : '';
      }
      sel[j] = nilai;
    }
    for (let i = 0; i < sel.length; i++) if (sel[i] == null) sel[i] = '';
    keluar.push(sel);
  }
  return keluar.filter(b => b.some(x => String(x).trim() !== ''));
}

async function bacaXlsx(isi) {
  await muatPizzip();
  let zip;
  try { zip = new window.PizZip(isi); }
  catch (e) { throw new Error('berkas ini bukan .xlsx yang sah'); }

  const bersama = zip.file('xl/sharedStrings.xml')
    ? teksBersama(zip.file('xl/sharedStrings.xml').asText()) : [];

  /* Lembar pertama pada urutan buku kerja, bukan sheet1.xml begitu saja:
     berkas yang lembarnya pernah dihapus bisa mulai dari sheet2.xml. */
  let jalur = 'xl/worksheets/sheet1.xml';
  const wb = zip.file('xl/workbook.xml'), rels = zip.file('xl/_rels/workbook.xml.rels');
  if (wb && rels) {
    const rid = (/<sheet[^>]*r:id="([^"]+)"/.exec(wb.asText()) || [])[1];
    const target = rid && (new RegExp('Id="' + rid + '"[^>]*Target="([^"]+)"').exec(rels.asText()) || [])[1];
    if (target) jalur = 'xl/' + String(target).replace(/^\.?\//, '');
  }
  const lembar = zip.file(jalur) || zip.file('xl/worksheets/sheet1.xml');
  if (!lembar) throw new Error('berkas .xlsx ini tidak punya lembar kerja');
  return barisLembar(lembar.asText(), bersama);
}

/** CSV dari Excel Indonesia kerap memakai titik koma, bukan koma. Pemisahnya
    dihitung dari seluruh berkas, bukan dari baris pertama: baris pertama
    berkas ekspor biasanya judul laporan yang tidak memuat pemisah sama
    sekali, dan angka bergaya Indonesia ("32,5") membuat koma menang bila
    hanya sebagian berkas yang dilihat. */
function bacaCsv(teks) {
  const t = String(teks || '').replace(/^﻿/, '');
  const titikKoma = (t.match(/;/g) || []).length;
  const koma      = (t.match(/,/g) || []).length;
  const pisah = titikKoma >= Math.max(1, koma) ? ';' : ',';

  const baris = [];
  let sel = '', satu = [], kutip = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (kutip) {
      if (c === '"') { if (t[i + 1] === '"') { sel += '"'; i++; } else kutip = false; }
      else sel += c;
    } else if (c === '"') kutip = true;
    else if (c === pisah) { satu.push(sel); sel = ''; }
    else if (c === '\r') { /* \n yang menutup baris */ }
    else if (c === '\n') { satu.push(sel); baris.push(satu); satu = []; sel = ''; }
    else sel += c;
  }
  if (sel !== '' || satu.length) { satu.push(sel); baris.push(satu); }
  return baris.filter(b => b.some(x => String(x).trim() !== ''));
}

const bacaBerkas = (berkas, sebagai) => new Promise((res, tolak) => {
  const p = new FileReader();
  p.onload = () => res(p.result);
  p.onerror = () => tolak(new Error('berkas tidak terbaca'));
  if (sebagai === 'teks') p.readAsText(berkas, 'utf-8'); else p.readAsArrayBuffer(berkas);
});


/* ═══════════════════════════════════════════════════════════════
   6. MENGENALI KOLOM
   Judul dicari dari kata kuncinya. Yang paling khas dicari lebih dulu, dan
   kolom yang sudah terpakai tidak boleh direbut kolom berikutnya — "Nama
   Kontak" jangan sampai terbaca sebagai nomor telepon.
   ═══════════════════════════════════════════════════════════════ */
const POLA = [
  ['fisik',    /fisik/i],
  ['keuangan', /keuangan/i],
  ['namaKontak', /nama\s*(kontak|pic|petugas|narahubung)|^\s*(pic|narahubung)\s*$/i],
  ['hp',       /no\.?\s*(hp|telp)|handphone|nomor\s*(hp|telepon|wa)|telepon|whats\s*app|whatsapp|\bwa\b/i],
  ['tanggal',  /tanggal|per\s*tanggal|update|pembaruan/i],
  ['prov',     /provinsi/i],
  ['kab',      /kabupaten|kab\s*\/\s*kota|nama\s*daerah|^\s*daerah\s*$|kota|instansi|pemda/i]
];

function petaKolom(kepala) {
  const dipakai = new Set();
  const peta = {};
  POLA.forEach(([nama, pola]) => {
    for (let i = 0; i < kepala.length; i++) {
      if (dipakai.has(i)) continue;
      if (pola.test(String(kepala[i] || ''))) { peta[nama] = i; dipakai.add(i); return; }
    }
  });
  return peta;
}

/** Baris pertama yang tampak seperti judul kolom. Berkas hasil ekspor sering
    punya judul laporan di beberapa baris pertama. */
function cariKepala(baris) {
  for (let i = 0; i < Math.min(baris.length, 15); i++) {
    const peta = petaKolom(baris[i]);
    if (peta.kab != null && peta.fisik != null && peta.keuangan != null) return { nomor: i, peta };
  }
  return null;
}

function angka(teks) {
  if (typeof teks === 'number') return isFinite(teks) ? teks : null;
  const s = String(teks == null ? '' : teks).replace(/%/g, '').trim();
  if (!s) return null;
  /* "1.234,5" bergaya Indonesia dan "1234.5" bergaya Inggris sama-sama muncul.
     Koma dianggap desimal bila ada; kalau tidak, titik yang dianggap desimal. */
  const n = parseFloat(s.indexOf(',') > -1 ? s.replace(/\./g, '').replace(',', '.') : s);
  return isFinite(n) ? n : null;
}

/* Sebagian sumber menulis progres sebagai pecahan 0–1, bukan persen. */
const persen = v => (v == null ? null : (v > 0 && v <= 1 ? v * 100 : v));

function tanggalDari(sel) {
  const s = String(sel == null ? '' : sel).trim();
  if (!s) return '';
  if (/^\d+(\.\d+)?$/.test(s) && +s > 20000 && +s < 80000) return tanggalSerial(+s);
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${String(+m[2]).padStart(2, '0')}-${String(+m[3]).padStart(2, '0')}`;
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(s);        // 18/08/2026
  if (m) return `${m[3]}-${String(+m[2]).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`;
  m = /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/.exec(s);          // 18 Agustus 2026
  if (m) {
    const b = BULAN.findIndex(x => x.toLowerCase() === m[2].toLowerCase());
    if (b > -1) return `${m[3]}-${String(b + 1).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`;
  }
  return '';
}

/* ── format mentah eMonitoring ──────────────────────────────────
   Berkas yang diunduh langsung dari aplikasi eMonitoring berisi satu baris
   per paket, bukan per daerah: satu kabupaten bisa punya sepuluh baris, dan
   di antaranya ada paket penunjang yang nilainya kecil.

   Cara meringkasnya jadi satu angka per daerah:
     · triwulan — angka TW bersifat kumulatif, dan triwulan yang belum jalan
                  disalin dari triwulan sebelumnya. Yang dipakai angka
                  terbesar di antara TW I–IV, jadi urutan kolomnya bebas dan
                  triwulan berjalan tidak perlu ditebak.
     · fisik    — rata-rata tertimbang Dana DAK, bukan rata-rata biasa: paket
                  jalan Rp 30 M tidak boleh setara paket perjalanan dinas
                  Rp 150 juta. Bila dananya kosong, jatuh ke rata-rata biasa.
     · keuangan — jumlah realisasi dibagi jumlah Dana DAK daerah itu.
     · tanggal  — yang terbaru di antara seluruh kolom tgl… milik daerah itu
                  (tglkontrak, tglpho, tglded, tglabd, dan tgl… lain yang
                  menyusul). Itulah tanggal progres terakhir daerah tersebut,
                  dan itu yang disebut di pesan penagihan. Daerah yang belum
                  punya satu tanggal pun memakai tanggal terbaru seluruh
                  berkas — keadaan berkasnya sendiri.
   ═══════════════════════════════════════════════════════════════ */
function petaMentah(kepala) {
  const satu = pola => {
    for (let i = 0; i < kepala.length; i++) if (pola.test(String(kepala[i] || ''))) return i;
    return null;
  };
  const banyak = pola => kepala.map((h, i) => (pola.test(String(h || '')) ? i : -1)).filter(i => i > -1);

  /* "Fisik TW …" tidak pernah ada pada rekap sederhana; itu penanda yang
     memisahkan kedua bentuk berkas. */
  const fisik = banyak(/fisik\s*tw/i);
  const kab   = satu(/kab\s*\.?\s*\/\s*kota|kabupaten|nama\s*daerah/i);
  const dana  = satu(/dana\s*dak|pagu/i);
  const real  = banyak(/realisasi\s*tw/i);
  /* Dana atau realisasi harus ikut ada. Rekap buatan tangan yang kebetulan
     menamai satu kolomnya "Fisik TW II (%)" bukan berkas mentah, dan lebih
     baik dibaca sebagai rekap biasa supaya kolom Keuangan-nya tidak hilang. */
  if (!fisik.length || kab == null || (dana == null && !real.length)) return null;

  return { kab, prov: satu(/provinsi/i), dana, fisik, real, tgl: banyak(/^\s*tgl/i) };
}

function cariKepalaMentah(baris) {
  for (let i = 0; i < Math.min(baris.length, 15); i++) {
    const peta = petaMentah(baris[i]);
    if (peta) return { nomor: i, peta };
  }
  return null;
}

/** Baris per paket → satu baris per daerah, bentuknya sama dengan hasil
    pembacaan rekap sederhana supaya sisa berkas ini tidak perlu tahu bedanya. */
function ringkasMentah(baris, nomorKepala, peta) {
  const terbesar = (r, kolom) => {
    let n = null;
    kolom.forEach(i => { const v = angka(r[i]); if (v != null && (n == null || v > n)) n = v; });
    return n;
  };

  const kumpul = new Map();
  const gagal  = new Map();
  let tanggalBerkas = '', jumlahBaris = 0;

  baris.slice(nomorKepala + 1).forEach(r => {
    const nama = String(r[peta.kab] == null ? '' : r[peta.kab]).trim();
    if (!nama) return;
    jumlahBaris++;

    let tanggal = '';
    peta.tgl.forEach(i => { const t = tanggalDari(r[i]); if (t > tanggal) tanggal = t; });
    if (tanggal > tanggalBerkas) tanggalBerkas = tanggal;

    const daerah = cocokkanDaerah(nama);
    if (!daerah) {
      const g = gagal.get(nama) || { teks: nama, baris: 0 };
      g.baris++; gagal.set(nama, g);
      return;
    }

    const dana  = angka(peta.dana == null ? null : r[peta.dana]) || 0;
    const fisik = terbesar(r, peta.fisik);
    const real  = terbesar(r, peta.real);

    const a = kumpul.get(daerah.kunci) || {
      ...daerah, paket: 0, dana: 0, real: 0,
      danaFisik: 0, fisikTertimbang: 0, fisikJumlah: 0, fisikN: 0, tanggalData: ''
    };
    a.paket++;
    a.dana += dana;
    if (real != null) a.real += real;
    if (fisik != null) {
      a.fisikJumlah += fisik; a.fisikN++;
      if (dana > 0) { a.fisikTertimbang += fisik * dana; a.danaFisik += dana; }
    }
    if (tanggal > a.tanggalData) a.tanggalData = tanggal;
    kumpul.set(daerah.kunci, a);
  });

  const bulat = v => (v == null ? null : Math.round(v * 100) / 100);
  const cocok = Array.from(kumpul.values()).map(a => ({
    kunci: a.kunci, prov: a.prov, kab: a.kab, label: a.label,
    fisik: bulat(a.danaFisik > 0 ? a.fisikTertimbang / a.danaFisik
                 : a.fisikN ? a.fisikJumlah / a.fisikN : null),
    keuangan: bulat(a.dana > 0 ? a.real / a.dana * 100 : null),
    namaKontak: '', hp: '', hpMentah: '',
    tanggalData: a.tanggalData || tanggalBerkas,
    paket: a.paket, dana: a.dana
  }));
  cocok.sort((x, y) => x.prov.localeCompare(y.prov, 'id') || x.kab.localeCompare(y.kab, 'id'));

  return {
    cocok,
    gagal: Array.from(gagal.values()),
    /* Berkas mentah tidak punya kolom kontak sama sekali; daftar ini yang
       dipakai simpanUnggahan untuk memutuskan kolom mana yang boleh ditimpa. */
    kolom: ['prov', 'kab', 'fisik', 'keuangan', 'tanggal'],
    mentah: { baris: jumlahBaris, tanggal: tanggalBerkas }
  };
}


/** Satu berkas → daftar baris siap simpan, plus baris yang daerahnya tak
    dikenali supaya bisa diperlihatkan, bukan dibuang diam-diam. */
async function uraiBerkas(berkas) {
  const xlsx = /\.xlsx$/i.test(berkas.name);
  const baris = xlsx
    ? await bacaXlsx(await bacaBerkas(berkas))
    : bacaCsv(await bacaBerkas(berkas, 'teks'));

  /* Bentuk mentah diperiksa lebih dulu: berkas eMonitoring juga punya kolom
     Provinsi dan Kab/Kota, tetapi angkanya tersebar per triwulan sehingga
     pembacaan rekap sederhana akan salah membacanya. */
  const mentah = cariKepalaMentah(baris);
  if (mentah) return ringkasMentah(baris, mentah.nomor, mentah.peta);

  const kepala = cariKepala(baris);
  if (!kepala) {
    throw new Error('judul kolomnya tidak ditemukan. Berkas boleh berupa unduhan mentah eMonitoring (berkolom Kab/Kota, Dana DAK, dan Fisik TW …), atau rekap satu baris per daerah yang memuat nama daerah, Fisik, dan Keuangan — unduh berkas contoh di jendela ini bila ragu.');
  }

  const { nomor, peta } = kepala;
  const ambil = (r, k) => (peta[k] == null ? '' : (r[peta[k]] == null ? '' : r[peta[k]]));
  const cocok = [], gagal = [];

  baris.slice(nomor + 1).forEach(r => {
    const namaDaerah = String(ambil(r, 'kab') || '').trim();
    if (!namaDaerah) return;
    const daerah = cocokkanDaerah(namaDaerah);
    const fisik = persen(angka(ambil(r, 'fisik')));
    const keuangan = persen(angka(ambil(r, 'keuangan')));
    if (!daerah) { gagal.push({ teks: namaDaerah, fisik, keuangan }); return; }

    /* Baris kembar untuk satu daerah: yang terakhir dipakai, sesuai kebiasaan
       berkas yang ditambal di bawah. */
    const sudah = cocok.findIndex(x => x.kunci === daerah.kunci);
    const isi = {
      kunci: daerah.kunci, prov: daerah.prov, kab: daerah.kab, label: daerah.label,
      fisik, keuangan,
      namaKontak: String(ambil(r, 'namaKontak') || '').replace(/\s+/g, ' ').trim(),
      hp: nomorWa(ambil(r, 'hp')),
      hpMentah: String(ambil(r, 'hp') || '').trim(),
      tanggalData: tanggalDari(ambil(r, 'tanggal')) || isoHariIni()
    };
    if (sudah > -1) cocok[sudah] = isi; else cocok.push(isi);
  });

  return { cocok, gagal, kolom: Object.keys(peta) };
}


/* ═══════════════════════════════════════════════════════════════
   7. BARIS TAMPIL
   ═══════════════════════════════════════════════════════════════ */
/** Nomor telepon dan nama dari survei kepuasan daerah yang sama. Dipakai
    hanya sebagai cadangan bila berkas unggahan tidak memuatnya. */
function dariSurvei() {
  const peta = new Map();
  const rekap = (window.SURVEI && window.SURVEI.rekap) ? window.SURVEI.rekap() : [];
  rekap.forEach(r => {
    const k = kunciDaerah(r.kab || '');
    if (!k) return;
    const wa = nomorWa((r.jawaban || {}).hp);
    if (!wa) return;
    if (!peta.has(k)) peta.set(k, { wa, nama: r.nama || '' });
  });
  return peta;
}

/** Nama peserta terdaftar daerah itu, cadangan terakhir untuk sapaan. */
function dariPeserta() {
  const peta = new Map();
  const daftar = (typeof ADATA !== 'undefined' && ADATA && ADATA.peserta) ? ADATA.peserta : [];
  daftar.forEach(p => {
    const k = kunciDaerah(p.kab || '');
    if (k && p.nama && !peta.has(k)) peta.set(k, p.nama);
  });
  return peta;
}

function susunBaris() {
  const survei = dariSurvei();
  const peserta = dariPeserta();
  return daftarDaerah().map(d => {
    const x = DATA[d.kunci] || null;
    const s = survei.get(d.kunci) || null;
    /* Nomor yang diketik admin menang atas nomor berkas: ia diisi justru
       karena berkasnya tidak memuat nomor, atau nomornya sudah tidak aktif. */
    const wa = (x && nomorWa(x.hpManual)) || (x && nomorWa(x.hp)) || (s && s.wa) || '';
    return {
      ...d,
      /* Dokumen yang isinya cuma nomor manual belum berarti daerah itu punya
         data progres — ia tetap dihitung "belum ada data". */
      ada: !!x && (x.fisik != null || x.keuangan != null),
      fisik: x ? (x.fisik == null ? null : x.fisik) : null,
      keuangan: x ? (x.keuangan == null ? null : x.keuangan) : null,
      tanggalData: x ? (x.tanggalData || '') : '',
      namaKontak: (x && x.namaKontakManual) || (x && x.namaKontak) ||
                  (s && s.nama) || peserta.get(d.kunci) || '',
      wa,
      sumberWa: (x && nomorWa(x.hpManual)) ? 'diisi admin'
              : (x && nomorWa(x.hp)) ? 'unggahan'
              : wa ? 'survei' : ''
    };
  });
}

/* Ambang "perlu ditagih". Bukan aturan resmi — sekadar penyaring supaya
   daerah yang paling tertinggal gampang dikumpulkan. */
const AMBANG = 50;
const statusBaris = b =>
  !b.ada ? 'kosong'
  : (b.fisik != null && b.fisik < AMBANG) || (b.keuangan != null && b.keuangan < AMBANG) ? 'rendah'
  : 'aman';


/* ═══════════════════════════════════════════════════════════════
   8. TAMPILAN
   ═══════════════════════════════════════════════════════════════ */
let SARING = { prov: '', status: '', cari: '' };

const GAYA = `
<style>
  .em-bar { height: 6px; border-radius: 999px; background: rgba(255,255,255,.09); overflow: hidden; }
  .em-bar > i { display: block; height: 100%; border-radius: 999px; transition: width .5s ease; }
</style>`;

function kartu(judul, nilai, ket, warna) {
  return `
  <div class="glass rounded-3xl px-5 py-4">
    <p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">${aman(judul)}</p>
    <p class="mt-2 text-[26px] font-semibold tabular-nums ${warna || 'text-white'}">${aman(nilai)}</p>
    <p class="mt-0.5 text-[12px] text-white/45">${aman(ket)}</p>
  </div>`;
}

const bar = (v, warna) => `
  <div class="em-bar w-[86px]"><i style="width:${v == null ? 0 : Math.max(0, Math.min(100, v))}%;background:${warna}"></i></div>`;

/* Kepala kelompok provinsi, sebaris penuh di dalam tabel — bentuk yang sama
   dengan ceklis kesiapan, supaya kedua tab terbaca dengan cara yang sama. */
function kepalaProvinsi(prov, isi) {
  const ada = isi.filter(b => b.ada);
  const tagih = isi.filter(b => statusBaris(b) === 'rendah').length;
  const rerata = k => {
    const a = ada.map(b => b[k]).filter(v => v != null);
    return a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length * 10) / 10 : null;
  };
  const f = rerata('fisik'), u = rerata('keuangan');
  return `<tr class="border-b border-white/10 bg-white/[.04]">
    <td colspan="7" class="px-4 py-3">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span class="text-[13px] font-semibold tracking-[-0.01em]">${aman(prov)}</span>
        <span class="text-[12px] text-white/45">${ada.length} dari ${isi.length} daerah ada datanya</span>
        ${tagih ? `<span class="rounded-full bg-amber-400/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300">${tagih} perlu ditagih</span>` : ''}
        ${f == null ? '' : `<span class="ml-auto text-[12px] tabular-nums text-white/50">rerata fisik ${aman(angkaId(f))}% · keuangan ${aman(angkaId(u))}%</span>`}
      </div>
    </td>
  </tr>`;
}

function barisHtml(b, i) {
  const st = statusBaris(b);
  const nilai = v => (v == null ? '<span class="text-white/25">—</span>' : `<span class="tabular-nums">${aman(angkaId(v))}%</span>`);
  return `
  <tr class="border-t border-white/8 align-middle hover:bg-white/[.03]">
    <td class="px-4 py-3 text-[12px] tabular-nums text-white/35">${i}</td>
    <td class="px-4 py-3">
      <p class="text-[13.5px] font-medium text-white/85">${aman(b.label)}</p>
      <p class="mt-0.5 text-[11.5px] text-white/40">${aman(b.prov)}${b.tanggalData ? ' · data ' + aman(tanggalIndo(b.tanggalData)) : ''}</p>
    </td>
    <td class="px-4 py-3">
      <div class="flex items-center gap-2.5">${nilai(b.fisik)}${bar(b.fisik, 'rgb(56 189 248)')}</div>
    </td>
    <td class="px-4 py-3">
      <div class="flex items-center gap-2.5">${nilai(b.keuangan)}${bar(b.keuangan, 'rgb(52 211 153)')}</div>
    </td>
    <td class="px-4 py-3">
      ${b.namaKontak ? `<p class="text-[12.5px] text-white/70">${aman(b.namaKontak)}</p>` : '<p class="text-[12.5px] text-white/25">tanpa nama</p>'}
      <div class="mt-0.5 flex flex-wrap items-center gap-2">
        ${b.wa
          ? `<span class="text-[11.5px] tabular-nums text-white/40">${aman(nomorTampil(b.wa))} · ${aman(b.sumberWa)}</span>`
          : '<span class="text-[11.5px] text-amber-300/70">nomor belum ada</span>'}
        <button data-em-kontak="${aman(b.kunci)}"
          title="Ketik sendiri nama dan nomor WhatsApp daerah ini"
          class="rounded-full border border-white/15 px-2 py-0.5 text-[11px] text-white/50 transition hover:bg-white/10 hover:text-white/80">${b.wa ? 'Ubah' : 'Isi nomor'}</button>
      </div>
    </td>
    <td class="px-4 py-3 text-right">
      ${b.wa ? `
        <a href="${aman(tautanWa(b))}" target="_blank" rel="noopener"
           title="Buka WhatsApp dengan pesan yang sudah terisi"
           class="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3.5 py-1.5 text-[12.5px] font-medium text-emerald-300 transition hover:bg-emerald-400/25">
          <svg viewBox="0 0 24 24" fill="currentColor" class="h-3.5 w-3.5"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1-.4-.1-.9-.3-1.6-.6-2.7-1.2-4.5-4-4.6-4.2-.1-.2-1.1-1.4-1.1-2.7s.7-1.9 1-2.2c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2 0 .4-.1.5l-.3.4c-.1.1-.3.3-.1.6.1.3.6 1.1 1.4 1.7 1 .9 1.7 1.1 2 1.2.2.1.4.1.5-.1l.7-.8c.2-.2.3-.2.6-.1l1.7.8c.3.1.5.2.5.4.1.1.1.7-.1 1.3Z"/></svg>
          Kontak
        </a>`
        : `<button data-em-salin="${aman(b.kunci)}" title="Nomornya belum ada; salin pesannya lalu kirim manual"
             class="rounded-full border border-white/15 px-3.5 py-1.5 text-[12.5px] text-white/50 transition hover:bg-white/10">Salin pesan</button>`}
    </td>
    <td class="px-4 py-3">
      <span class="rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        st === 'kosong' ? 'bg-white/8 text-white/40'
        : st === 'rendah' ? 'bg-amber-400/15 text-amber-300'
        : 'bg-emerald-400/15 text-emerald-300'}">${
        st === 'kosong' ? 'Belum ada data' : st === 'rendah' ? 'Perlu ditagih' : 'Aman'}</span>
    </td>
  </tr>`;
}

/* Angka kecil di samping nama tab. Ditulis dari sini, bukan dari index.html:
   angkanya berubah setiap kali ada unggahan baru, dan yang tahu itu hanya
   berkas ini. */
function tandaiTab(rendah) {
  const t = el('#adTabEmonJml');
  if (t) t.textContent = rendah ? ' · ' + rendah : '';
}

function render() {
  const wadah = el('#adEmon');
  if (!wadah) return;

  const semua = susunBaris();
  const adaData = semua.filter(b => b.ada);
  const rendah  = semua.filter(b => statusBaris(b) === 'rendah');
  const bisaWa  = semua.filter(b => b.wa);
  const rerata = (kunci) => {
    const a = adaData.map(b => b[kunci]).filter(v => v != null);
    return a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length * 10) / 10 : null;
  };
  const tanggal = adaData.map(b => b.tanggalData).filter(Boolean).sort().pop() || '';
  tandaiTab(rendah.length);

  const provs = Array.from(new Set(semua.map(b => b.prov))).sort((a, b) => a.localeCompare(b, 'id'));
  const cari = SARING.cari.trim().toLowerCase();
  const tampil = semua.filter(b =>
    (!SARING.prov || b.prov === SARING.prov) &&
    (!SARING.status || statusBaris(b) === SARING.status ||
      (SARING.status === 'tanpaNomor' && !b.wa)) &&
    (!cari || (b.label + ' ' + b.kab + ' ' + b.prov + ' ' + b.namaKontak).toLowerCase().includes(cari)));

  /* Daftar dipecah per provinsi. Urutan daerah di dalamnya tidak diubah —
     daftar wilayah sudah menaruh kabupaten lebih dulu, kota di belakang. */
  const kelompok = [];
  tampil.forEach(b => {
    const akhir = kelompok[kelompok.length - 1];
    if (akhir && akhir.prov === b.prov) akhir.isi.push(b);
    else kelompok.push({ prov: b.prov, isi: [b] });
  });
  let nomor = 0;

  wadah.innerHTML = `${GAYA}

  <p class="mt-7 max-w-[760px] text-[14px] leading-[1.7] text-white/60">
    Progres pelaporan tiap pemda di aplikasi eMonitoring — angka yang lebih aktual daripada
    berita acara, karena diambil langsung dari aplikasinya. Datanya diunggah admin secara
    berkala; tombol Kontak membuka WhatsApp dengan pesan penagihan yang sudah terisi sendiri.
    ${tanggal ? 'Data terakhir per <span class="text-white/80">' + aman(tanggalIndo(tanggal)) + '</span>.' : ''}
  </p>

  ${GALAT ? `<div class="mt-6 rounded-3xl border border-amber-400/40 bg-amber-400/10 p-5 text-[13px] leading-[1.7] text-amber-200/90">${aman(GALAT)}</div>` : ''}

  <div class="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
    ${kartu('Daerah penerima DAK', semua.length, 'kerangka tetap')}
    ${kartu('Sudah ada datanya', adaData.length, semua.length ? Math.round(adaData.length / semua.length * 100) + '% daerah' : '—', 'text-sky-300')}
    ${kartu('Rerata fisik', rerata('fisik') == null ? '—' : angkaId(rerata('fisik')) + '%', 'dari daerah yang ada datanya', 'text-sky-300')}
    ${kartu('Rerata keuangan', rerata('keuangan') == null ? '—' : angkaId(rerata('keuangan')) + '%', 'dari daerah yang ada datanya', 'text-emerald-300')}
    ${kartu('Perlu ditagih', rendah.length, 'fisik atau keuangan di bawah ' + AMBANG + '%', rendah.length ? 'text-amber-300' : '')}
  </div>

  <div class="mt-8 flex flex-wrap items-center gap-3">
    <select id="emProv" class="glass rounded-full px-5 py-2.5 text-[13px] font-medium text-white outline-none [&>option]:bg-ink">
      <option value="">Semua provinsi</option>
      ${provs.map(p => `<option value="${aman(p)}"${SARING.prov === p ? ' selected' : ''}>${aman(p)}</option>`).join('')}
    </select>
    <select id="emStatus" class="glass rounded-full px-5 py-2.5 text-[13px] font-medium text-white outline-none [&>option]:bg-ink">
      <option value="">Semua status</option>
      <option value="rendah"${SARING.status === 'rendah' ? ' selected' : ''}>Perlu ditagih (di bawah ${AMBANG}%)</option>
      <option value="aman"${SARING.status === 'aman' ? ' selected' : ''}>Aman</option>
      <option value="kosong"${SARING.status === 'kosong' ? ' selected' : ''}>Belum ada data</option>
      <option value="tanpaNomor"${SARING.status === 'tanpaNomor' ? ' selected' : ''}>Belum ada nomornya (${semua.length - bisaWa.length})</option>
    </select>
    <div class="glass flex items-center gap-2 rounded-full px-5 py-2.5">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" class="h-4 w-4 text-white/50"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input id="emCari" value="${aman(SARING.cari)}" placeholder="Cari daerah atau nama kontak" class="w-52 bg-transparent text-[13px] outline-none placeholder:text-white/40" />
    </div>
    <div class="ml-auto flex flex-wrap gap-2">
      <button id="emPesan" class="glass rounded-full px-5 py-2.5 text-[13px] font-medium text-white/80 transition hover:bg-white/10">Format pesan</button>
      <button id="emMuat" class="glass rounded-full px-5 py-2.5 text-[13px] font-medium text-white/80 transition hover:bg-white/10">Muat ulang</button>
      <button id="emUnggah" class="cta-glow rounded-full bg-white px-5 py-2.5 text-[13px] font-medium text-black transition">Unggah data eMonitoring</button>
    </div>
  </div>

  <div class="glass mt-6 overflow-hidden rounded-3xl">
    <div class="overflow-x-auto">
      <table class="w-full min-w-[940px] border-collapse text-left">
        <thead class="bg-white/[.04]">
          <tr class="text-[11px] uppercase tracking-[0.1em] text-white/45">
            <th class="px-4 py-3 font-medium">#</th>
            <th class="px-4 py-3 font-medium">Daerah</th>
            <th class="px-4 py-3 font-medium">Fisik</th>
            <th class="px-4 py-3 font-medium">Keuangan</th>
            <th class="px-4 py-3 font-medium">Kontak</th>
            <th class="px-4 py-3 text-right font-medium">WhatsApp</th>
            <th class="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>${kelompok.length
          ? kelompok.map(k => kepalaProvinsi(k.prov, k.isi) + k.isi.map(b => barisHtml(b, ++nomor)).join('')).join('')
          : `<tr><td colspan="7" class="px-4 py-14 text-center text-[14px] text-white/50">Tidak ada daerah yang cocok dengan penyaring itu.</td></tr>`}
        </tbody>
      </table>
    </div>
  </div>

  <p class="mt-4 text-[12px] leading-[1.7] text-white/35">
    Nomor telepon dipakai berurutan: nomor yang diketik admin lewat tombol Isi nomor, lalu
    kolom pada berkas unggahan, lalu nomor yang pernah diisi daerah itu pada survei kepuasan.
    ${bisaWa.length} dari ${semua.length} daerah sudah punya nomor yang bisa dihubungi.
  </p>`;

  el('#emProv').onchange = e => { SARING.prov = e.target.value; render(); };
  el('#emStatus').onchange = e => { SARING.status = e.target.value; render(); };
  el('#emCari').oninput = e => {
    SARING.cari = e.target.value;
    const posisi = e.target.selectionStart;
    render();
    const baru = el('#emCari');
    baru.focus(); baru.setSelectionRange(posisi, posisi);
  };
  el('#emPesan').onclick = bukaFormatPesan;
  el('#emUnggah').onclick = bukaUnggah;
  el('#emMuat').onclick = async () => {
    await muat(true);
    render();
    toast('Data eMonitoring dimuat ulang.');
  };

  wadah.querySelectorAll('[data-em-kontak]').forEach(t =>
    t.onclick = () => bukaKontak(t.dataset.emKontak));

  wadah.querySelectorAll('[data-em-salin]').forEach(t => t.onclick = async () => {
    const b = semua.find(x => x.kunci === t.dataset.emSalin);
    if (!b) return;
    try {
      await navigator.clipboard.writeText(susunPesan(b));
      toast('Pesan untuk ' + b.label + ' tersalin.');
    } catch (e) {
      toast('Peramban menolak menyalin. Buka Format pesan untuk menyalinnya manual.');
    }
  });
}


/* ── jendela format pesan ───────────────────────────────────────
   Kalimat penagihan pasti berubah tiap triwulan, jadi polanya disunting di
   layar dan disimpan di peramban admin, bukan dipahat di dalam kode. */
function bukaFormatPesan() {
  const lama = el('#emFormat');
  if (lama) lama.remove();

  const contoh = susunBaris().find(b => b.ada) ||
    { kab: 'Magelang', label: 'Kab. Magelang', prov: 'Jawa Tengah',
      namaKontak: 'Andini', fisik: 32.5, keuangan: 21, tanggalData: isoHariIni() };

  const m = document.createElement('div');
  m.id = 'emFormat';
  m.className = 'fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-10 backdrop-blur-md';
  m.innerHTML = `
    <div class="glass w-full max-w-2xl rounded-[1.75rem] p-6 md:p-8">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Progres eMonitoring</p>
          <h3 class="mt-1.5 text-[20px] font-semibold">Format pesan WhatsApp</h3>
          <p class="mt-2 max-w-[520px] text-[13px] leading-[1.65] text-white/55">
            Penanda di dalam kurung kurawal diganti sendiri saat tombol Kontak ditekan.
            Tersedia: <code class="text-white/75">{waktu}</code> <code class="text-white/75">{nama}</code>
            <code class="text-white/75">{daerah}</code> <code class="text-white/75">{daerahPanjang}</code>
            <code class="text-white/75">{provinsi}</code> <code class="text-white/75">{fisik}</code>
            <code class="text-white/75">{keuangan}</code> <code class="text-white/75">{tanggal}</code>.
            <span class="mt-1 block text-white/40">{daerah} menghasilkan “Kab. Magelang”, {daerahPanjang}
            menghasilkan “Kabupaten Magelang” — keduanya sengaja tidak pernah menyebut “Magelang” saja.</span>
          </p>
        </div>
        <button id="emFmtTutup" aria-label="Tutup" class="-mr-1 -mt-1 shrink-0 rounded-full p-2 text-white/40 transition hover:bg-white/10 hover:text-white">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="h-5 w-5"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>

      <textarea id="emFmtIsi" rows="5"
        class="mt-6 w-full rounded-2xl border border-white/12 bg-black/40 px-4 py-3 text-[13.5px] leading-[1.7] text-white outline-none transition focus:border-white/35">${aman(ambilPesan())}</textarea>

      <p class="mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">Pratinjau</p>
      <p id="emFmtPratinjau" class="mt-2 rounded-2xl bg-emerald-400/10 px-4 py-3 text-[13px] leading-[1.7] text-emerald-100/90"></p>

      <div class="mt-6 flex flex-wrap items-center justify-end gap-2">
        <button id="emFmtBaku" class="rounded-full border border-white/20 px-4 py-2 text-[13px] font-medium text-white/70 transition hover:bg-white/10">Kembalikan bawaan</button>
        <button id="emFmtSimpan" class="cta-glow rounded-full bg-white px-5 py-2.5 text-[13px] font-medium text-black transition">Simpan format</button>
      </div>
    </div>`;
  document.body.appendChild(m);

  const segarkan = () => {
    m.querySelector('#emFmtPratinjau').textContent = susunPesan(contoh, m.querySelector('#emFmtIsi').value);
  };
  segarkan();

  const tutup = () => m.remove();
  m.querySelector('#emFmtIsi').oninput = segarkan;
  m.querySelector('#emFmtTutup').onclick = tutup;
  m.onclick = e => { if (e.target === m) tutup(); };
  m.querySelector('#emFmtBaku').onclick = () => { m.querySelector('#emFmtIsi').value = PESAN_BAKU; segarkan(); };
  m.querySelector('#emFmtSimpan').onclick = () => {
    simpanPesan(m.querySelector('#emFmtIsi').value.trim() || PESAN_BAKU);
    tutup(); render();
    toast('Format pesan disimpan.');
  };
}


/* ── jendela nomor kontak ───────────────────────────────────────
   Unduhan mentah eMonitoring tidak memuat nomor telepon sama sekali, dan
   tidak semua daerah pernah mengisi survei kepuasan. Nomor yang diketik di
   sini menempel pada daerahnya, bukan pada berkas unggahannya, sehingga
   unggahan berikutnya tidak menghapusnya.

   Kotak isian sengaja dibiarkan kosong meski daerahnya sudah punya nomor
   dari survei: nomor survei milik daerah itu, bukan salinan yang boleh
   berpindah tempat. Yang ditampilkan hanya keterangan di bawahnya.
   ═══════════════════════════════════════════════════════════════ */
function bukaKontak(kunci) {
  const lama = el('#emKontak');
  if (lama) lama.remove();

  const baris = susunBaris().find(b => b.kunci === kunci);
  if (!baris) return;
  const tersimpan = DATA[kunci] || {};
  const adaManual = !!(tersimpan.hpManual || tersimpan.namaKontakManual);

  const m = document.createElement('div');
  m.id = 'emKontak';
  m.className = 'fixed inset-0 z-[96] flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-10 backdrop-blur-md';
  m.innerHTML = `
    <div class="glass w-full max-w-lg rounded-[1.75rem] p-6 md:p-8">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Nomor kontak</p>
          <h3 class="mt-1.5 text-[20px] font-semibold">${aman(baris.label)}</h3>
          <p class="mt-1 text-[12.5px] text-white/45">${aman(baris.prov)}</p>
        </div>
        <button id="emKtkTutup" aria-label="Tutup" class="-mr-1 -mt-1 shrink-0 rounded-full p-2 text-white/40 transition hover:bg-white/10 hover:text-white">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="h-5 w-5"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>

      <label class="mt-6 block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">Nama kontak</label>
      <input id="emKtkNama" value="${aman(tersimpan.namaKontakManual || '')}" placeholder="Nama yang disapa di pesan"
        class="mt-2 w-full rounded-2xl border border-white/12 bg-black/40 px-4 py-2.5 text-[13.5px] text-white outline-none transition focus:border-white/35" />

      <label class="mt-4 block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">Nomor WhatsApp</label>
      <input id="emKtkHp" value="${aman(tersimpan.hpManual ? nomorTampil(nomorWa(tersimpan.hpManual)) : '')}" placeholder="0812-3456-7890" inputmode="tel"
        class="mt-2 w-full rounded-2xl border border-white/12 bg-black/40 px-4 py-2.5 text-[13.5px] tabular-nums text-white outline-none transition focus:border-white/35" />

      <p class="mt-3 text-[12px] leading-[1.65] text-white/45">
        ${baris.wa && !adaManual
          ? `Sekarang daerah ini memakai ${aman(nomorTampil(baris.wa))} dari ${aman(baris.sumberWa)}. Nomor yang diketik di sini akan dipakai menggantikannya.`
          : 'Nomor yang diketik di sini dipakai lebih dulu daripada nomor dari berkas unggahan maupun survei kepuasan, dan tidak terhapus saat data eMonitoring diunggah ulang.'}
        ${adaManual ? '<span class="mt-1 block text-white/35">Kosongkan kedua isian lalu simpan untuk kembali memakai nomor berkas atau survei.</span>' : ''}
      </p>

      <p id="emKtkGalat" class="mt-3 text-[12.5px] leading-[1.6] text-amber-300"></p>

      <div class="mt-6 flex flex-wrap items-center justify-end gap-2">
        <button id="emKtkBatal" class="rounded-full border border-white/20 px-4 py-2 text-[13px] font-medium text-white/70 transition hover:bg-white/10">Batal</button>
        <button id="emKtkSimpan" class="cta-glow rounded-full bg-white px-5 py-2.5 text-[13px] font-medium text-black transition disabled:opacity-40">Simpan nomor</button>
      </div>
    </div>`;
  document.body.appendChild(m);

  let sibuk = false;
  const tutup = () => { if (!sibuk) m.remove(); };
  m.querySelector('#emKtkTutup').onclick = tutup;
  m.querySelector('#emKtkBatal').onclick = tutup;
  m.onclick = e => { if (e.target === m) tutup(); };
  m.querySelector('#emKtkNama').focus();

  const tombol = m.querySelector('#emKtkSimpan');
  const simpanNomor = async () => {
    if (sibuk) return;
    const nama = m.querySelector('#emKtkNama').value.replace(/\s+/g, ' ').trim();
    const diketik = m.querySelector('#emKtkHp').value.trim();
    const wa = nomorWa(diketik);
    const galat = m.querySelector('#emKtkGalat');

    /* Nomor yang salah ketik lebih berbahaya daripada nomor yang kosong:
       pesan penagihan akan terkirim ke orang lain. */
    if (diketik && !wa) {
      galat.textContent = '“' + diketik + '” bukan nomor seluler Indonesia. Tulis seperti 0812-3456-7890 atau +62 812 3456 7890.';
      return;
    }
    galat.textContent = '';
    sibuk = true; tombol.disabled = true; tombol.textContent = 'Menyimpan…';
    try {
      await simpanKontak(kunci, nama, wa);
      sibuk = false;
      m.remove();
      render();
      toast(wa ? 'Nomor ' + baris.label + ' disimpan.' : 'Nomor manual ' + baris.label + ' dihapus.');
    } catch (e) {
      sibuk = false; tombol.disabled = false; tombol.textContent = 'Simpan nomor';
      galat.textContent = 'Gagal disimpan: ' + (e.code || e.message) +
        (e.code === 'permission-denied' ? '. Tempelkan ulang firestore.rules di Firebase Console.' : '');
    }
  };
  tombol.onclick = simpanNomor;
  m.querySelectorAll('#emKtkNama, #emKtkHp').forEach(i => {
    i.onkeydown = e => { if (e.key === 'Enter') simpanNomor(); };
  });
}


/* ── jendela unggah ─────────────────────────────────────────────
   Isinya diperlihatkan lebih dulu, tidak pernah langsung tersimpan: daerah
   yang tidak dikenali harus kelihatan sebelum datanya masuk.
   ═══════════════════════════════════════════════════════════════ */
let HASIL = null;      // { cocok, gagal, kolom, berkas }
let SIBUK = false;
let GANTI = false;     // hapus daerah yang tidak ada di berkas ini

function bukaUnggah() {
  const lama = el('#emUnggahKotak');
  if (lama) lama.remove();
  HASIL = null; SIBUK = false; GANTI = false;

  const m = document.createElement('div');
  m.id = 'emUnggahKotak';
  m.className = 'fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-10 backdrop-blur-md';
  m.innerHTML = `
    <div class="glass w-full max-w-4xl rounded-[1.75rem] p-6 md:p-8">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Progres eMonitoring</p>
          <h3 class="mt-1.5 text-[20px] font-semibold">Unggah data</h3>
          <p class="mt-2 max-w-[640px] text-[13px] leading-[1.65] text-white/55">
            Berkas .xlsx atau .csv. Kolomnya dikenali dari judulnya, jadi urutannya bebas dan
            kolom lain boleh ikut ada. Unduhan mentah dari eMonitoring bisa langsung diunggah
            apa adanya — barisnya yang per paket diringkas sendiri jadi satu angka per daerah,
            dan tanggal progres terakhirnya diambil dari kolom tglkontrak, tglpho, tglded, dan
            tglabd. Bentuk rekap satu baris per daerah juga tetap diterima; yang wajib nama
            daerah, Fisik, dan Keuangan, sisanya opsional.
          </p>
        </div>
        <button id="emUpTutup" aria-label="Tutup" class="-mr-1 -mt-1 shrink-0 rounded-full p-2 text-white/40 transition hover:bg-white/10 hover:text-white">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="h-5 w-5"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>

      <div class="mt-6 flex flex-wrap gap-2">
        <button id="emUpPilih" class="rounded-full border border-white/20 px-4 py-2 text-[13px] font-medium text-white/80 transition hover:bg-white/10">Pilih berkas…</button>
        <button id="emUpContoh" class="rounded-full border border-white/20 px-4 py-2 text-[13px] font-medium text-white/80 transition hover:bg-white/10">Unduh berkas contoh</button>
      </div>

      <div id="emUpIsi" class="mt-5"></div>

      <div class="mt-6 flex flex-wrap items-center justify-end gap-2">
        <button id="emUpBatal" class="rounded-full border border-white/20 px-4 py-2 text-[13px] font-medium text-white/70 transition hover:bg-white/10">Tutup</button>
        <button id="emUpSimpan" class="cta-glow rounded-full bg-white px-5 py-2.5 text-[13px] font-medium text-black transition disabled:opacity-40" disabled>Simpan</button>
      </div>
    </div>`;
  document.body.appendChild(m);

  const tutup = () => { if (!SIBUK) m.remove(); };
  m.querySelector('#emUpTutup').onclick = tutup;
  m.querySelector('#emUpBatal').onclick = tutup;
  m.onclick = e => { if (e.target === m) tutup(); };
  m.querySelector('#emUpPilih').onclick = pilihBerkas;
  m.querySelector('#emUpContoh').onclick = unduhContoh;
  m.querySelector('#emUpSimpan').onclick = simpanUnggahan;

  renderUnggah();
}

function pilihBerkas() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.xlsx,.csv';
  inp.onchange = async () => {
    const berkas = (inp.files || [])[0];
    if (!berkas) return;
    const isi = el('#emUpIsi');
    if (isi) isi.innerHTML = `<p class="px-2 py-10 text-center text-[13px] text-white/50">Membaca ${aman(berkas.name)}…</p>`;
    try {
      HASIL = { ...(await uraiBerkas(berkas)), berkas: berkas.name };
    } catch (e) {
      HASIL = { cocok: [], gagal: [], kolom: [], berkas: berkas.name, galat: e.message };
    }
    renderUnggah();
  };
  inp.click();
}

function renderUnggah() {
  const wadah = el('#emUpIsi');
  if (!wadah) return;

  if (!HASIL) {
    wadah.innerHTML = `
      <div class="rounded-2xl border border-dashed border-white/15 bg-white/[.02] px-6 py-12 text-center">
        <p class="text-[14px] font-medium text-white/70">Belum ada berkas dipilih.</p>
        <p class="mx-auto mt-2 max-w-[440px] text-[12.5px] leading-[1.6] text-white/45">
          Belum punya formatnya? Unduh berkas contoh — isinya sudah memuat 164 daerah penerima
          beserta judul kolom yang dikenali, tinggal diisi angkanya.
        </p>
      </div>`;
    const t = el('#emUpSimpan');
    if (t) t.disabled = true;
    return;
  }

  if (HASIL.galat) {
    wadah.innerHTML = `<div class="rounded-2xl border border-red-400/40 bg-red-500/10 px-5 py-4 text-[13px] leading-[1.7] text-red-200">
      <span class="font-semibold">${aman(HASIL.berkas)}</span> tidak terbaca: ${aman(HASIL.galat)}</div>`;
    el('#emUpSimpan').disabled = true;
    return;
  }

  const { cocok, gagal } = HASIL;
  wadah.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-[12.5px] text-white/55">
        <span class="font-semibold text-white/85">${cocok.length}</span> daerah terbaca dari
        <span class="text-white/75">${aman(HASIL.berkas)}</span>.
        ${HASIL.mentah ? `<span class="text-white/45">Unduhan mentah eMonitoring: ${HASIL.mentah.baris} baris paket diringkas per daerah${
          HASIL.mentah.tanggal ? `, progres terakhir seluruh berkas ${aman(tanggalIndo(HASIL.mentah.tanggal))}` : ''}.</span>` : ''}
        ${gagal.length ? `<span class="text-amber-300">${gagal.length} nama daerah tidak dikenali.</span>` : ''}
      </p>
      <label class="flex cursor-pointer items-center gap-2 text-[12.5px] text-white/60">
        <input type="checkbox" id="emUpGanti" ${GANTI ? 'checked' : ''} class="h-4 w-4 accent-white" />
        Hapus data daerah yang tidak ada di berkas ini
      </label>
    </div>

    <div class="mt-4 max-h-[42vh] overflow-auto rounded-2xl border border-white/10">
      <table class="w-full min-w-[620px] border-collapse text-left">
        <thead class="sticky top-0 z-10 bg-[#141821]">
          <tr class="text-[11px] uppercase tracking-[0.08em] text-white/45">
            <th class="px-4 py-2.5 font-medium">Daerah</th>
            <th class="px-4 py-2.5 font-medium">Fisik</th>
            <th class="px-4 py-2.5 font-medium">Keuangan</th>
            <th class="px-4 py-2.5 font-medium">Kontak</th>
            <th class="px-4 py-2.5 font-medium">Tanggal</th>
          </tr>
        </thead>
        <tbody>
          ${cocok.map(r => `
            <tr class="border-t border-white/8">
              <td class="px-4 py-2"><p class="text-[12.5px] text-white/80">${aman(r.label)}</p>
                <p class="text-[11px] text-white/35">${aman(r.prov)}${r.paket ? ' · ' + r.paket + ' paket' : ''}</p></td>
              <td class="px-4 py-2 text-[12.5px] tabular-nums text-white/70">${r.fisik == null ? '—' : aman(angkaId(r.fisik)) + '%'}</td>
              <td class="px-4 py-2 text-[12.5px] tabular-nums text-white/70">${r.keuangan == null ? '—' : aman(angkaId(r.keuangan)) + '%'}</td>
              <td class="px-4 py-2 text-[12px] text-white/55">${aman(r.namaKontak || '—')}${
                r.hp ? ` · ${aman(nomorTampil(r.hp))}` : r.hpMentah ? ` · <span class="text-amber-300">${aman(r.hpMentah)} tidak dikenali</span>` : ''}</td>
              <td class="px-4 py-2 text-[12px] tabular-nums text-white/45">${aman(r.tanggalData)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>

    ${gagal.length ? `
      <div class="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-5 py-4 text-[12.5px] leading-[1.7] text-amber-200/90">
        <p class="font-semibold text-amber-200">Baris berikut tidak masuk karena daerahnya di luar 164 penerima DAK</p>
        <p class="mt-1.5">${aman(gagal.map(g => g.teks).join(', '))}</p>
        <p class="mt-1.5 text-amber-200/60">Betulkan ejaannya di berkas lalu unggah ulang bila itu memang daerah penerima.</p>
      </div>` : ''}`;

  const ganti = el('#emUpGanti');
  if (ganti) ganti.onchange = e => { GANTI = e.target.checked; };
  el('#emUpSimpan').disabled = SIBUK || !cocok.length;
  el('#emUpSimpan').textContent = SIBUK ? 'Menyimpan…' : `Simpan ${cocok.length} daerah`;
}

async function simpanUnggahan() {
  if (!HASIL || !HASIL.cocok.length || SIBUK) return;
  SIBUK = true;
  renderUnggah();

  const kolom = HASIL.kolom || [];
  const baru = {};
  HASIL.cocok.forEach(r => {
    const isi = {
      kunciDaerah: r.kunci, prov: r.prov, kab: r.kab,
      fisik: r.fisik, keuangan: r.keuangan,
      tanggalData: r.tanggalData,
      dariBerkas: HASIL.berkas || ''
    };
    /* Kolom yang memang tidak ada di berkasnya tidak ikut ditulis: unduhan
       mentah eMonitoring tidak memuat kontak sama sekali, dan nama serta
       nomor yang sudah tersimpan tidak boleh hilang karenanya. */
    if (kolom.indexOf('namaKontak') > -1) isi.namaKontak = r.namaKontak;
    if (kolom.indexOf('hp') > -1) isi.hp = r.hp;
    if (r.paket != null) { isi.paket = r.paket; isi.dana = r.dana; }
    baru[r.kunci] = isi;
  });

  try {
    await simpan(baru, GANTI);
    const jml = HASIL.cocok.length;
    SIBUK = false;
    const kotak = el('#emUnggahKotak');
    if (kotak) kotak.remove();
    render();
    toast(jml + ' daerah tersimpan di progres eMonitoring.');
  } catch (e) {
    SIBUK = false;
    renderUnggah();
    const wadah = el('#emUpIsi');
    if (wadah) wadah.insertAdjacentHTML('beforeend',
      `<div class="mt-4 rounded-2xl border border-red-400/40 bg-red-500/10 px-5 py-4 text-[12.5px] leading-[1.7] text-red-200">
        Gagal disimpan: ${aman(e.code || e.message)}${e.code === 'permission-denied'
          ? '. Koleksi <code>emonitoring</code> belum diizinkan — tempelkan ulang firestore.rules di Firebase Console.' : ''}
      </div>`);
  }
}


/* ── berkas contoh ──────────────────────────────────────────────
   Judul kolom yang dikenali beserta 164 daerahnya, supaya admin tidak perlu
   menebak formatnya. Penulis .xlsx-nya sengaja seadanya: yang dibutuhkan
   cuma satu lembar berisi teks dan angka.
   ═══════════════════════════════════════════════════════════════ */
const xmlAman = s => String(s == null ? '' : s)
  .replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
  .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

function hurufKolom(i) {
  let s = '', n = i + 1;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; }
  return s;
}

async function unduhContoh() {
  await muatPizzip();
  const kepala = ['Provinsi', 'Kabupaten/Kota', 'Fisik (%)', 'Keuangan (%)', 'Nama Kontak', 'No HP', 'Tanggal Data'];
  const survei = dariSurvei();
  const baris = [kepala].concat(daftarDaerah().map(d => {
    const s = survei.get(d.kunci);
    return [d.prov, d.label, '', '', s ? s.nama : '', s ? nomorTampil(s.wa) : '', ''];
  }));

  const isiBaris = baris.map((r, i) => {
    const sel = r.map((v, j) => {
      const ref = hurufKolom(j) + (i + 1);
      if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`;
      if (v === '') return `<c r="${ref}"/>`;
      return `<c r="${ref}"${i === 0 ? ' s="1"' : ''} t="inlineStr"><is><t xml:space="preserve">${xmlAman(v)}</t></is></c>`;
    }).join('');
    return `<row r="${i + 1}">${sel}</row>`;
  }).join('');

  const lebar = kepala.map((_, j) =>
    `<col min="${j + 1}" max="${j + 1}" width="${[22, 30, 12, 14, 24, 18, 16][j]}" customWidth="1"/>`).join('');

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
<sheets><sheet name="Progres eMonitoring" sheetId="1" r:id="rId1"/></sheets></workbook>`);
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
  xl.folder('worksheets').file('sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${lebar}</cols><sheetData>${isiBaris}</sheetData></worksheet>`);

  const blob = zip.generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    compression: 'DEFLATE'
  });
  const nama = `Format Progres eMonitoring - ${isoHariIni()}.xlsx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nama;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast(nama + ' terunduh.');
}


/* ═══════════════════════════════════════════════════════════════
   9. TITIK MASUK
   ═══════════════════════════════════════════════════════════════ */
window.EMON = {
  /** Digambar saat tabnya dibuka; datanya baru dibaca sekali. */
  async render(paksa) {
    await muat(paksa);
    render();
  },

  reset() {
    DATA = {}; DIMUAT = false; GALAT = '';
    SARING = { prov: '', status: '', cari: '' };
    tandaiTab(0);
    const w = el('#adEmon');
    if (w) w.innerHTML = '';
  }
};

})();
