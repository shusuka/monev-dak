/* ═══════════════════════════════════════════════════════════════════════
   BERITA ACARA eMONITORING — khusus akun PFID

   Akun yang user id-nya memuat kata "jalan" (mis. ahmadjalan, yolan_jalan)
   otomatis dikenali sebagai petugas PFID: menu ini muncul, pre/post test
   tidak wajib, dan namanya tercatat sebagai penyusun laporan.

   Alurnya empat langkah, sama seperti sinkronisasi foto di cashiermiuw:
   Identitas → Tempel screenshot → AI membaca → Periksa lalu unduh Word.

   Berkas Word dibuat dari `assets/ba-template.docx`, yaitu notulensi asli
   yang isinya diganti penanda docxtemplater. Format, kop, warna kuning /
   ungu / merah / hijau, dan penomoran hurufnya tidak disentuh sama sekali.
   ═══════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const TEMPLATE_URL = 'assets/ba-template.docx';
const CDN_PIZZIP   = 'https://unpkg.com/pizzip@3.2.0/dist/pizzip.min.js';
const CDN_DOCXTPL  = 'https://unpkg.com/docxtemplater@3.66.7/build/docxtemplater.js';

/* Centang yang dipakai di dokumen aslinya (U+2A57), bukan ✓ biasa —
   supaya hasilnya sama persis dengan notulensi terdahulu. */
const CENTANG = '⩗';

/* Penyedia AI yang bisa membaca gambar. Semuanya mengizinkan panggilan langsung
   dari peramban (CORS terbuka), jadi tidak perlu server perantara.
   `bentuk` menentukan susunan permintaannya — tiga saja yang berbeda. */
const PENYEDIA = {
  gemini: {
    label: 'Google Gemini', bentuk: 'gemini', biaya: 'GRATIS',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    /* Alias bergulir, bukan versi tetap: Google memensiunkan nomor versi lama
       (2.5 sudah hilang) sehingga bawaan yang dipatok pasti membalas 404 suatu
       hari. Kalau alias ini pun ditolak, tombol "Muat daftar model" menampilkan
       yang masih hidup untuk kunci tersebut. */
    model: 'gemini-flash-latest',
    maksKeluaran: 32000,
    petunjuk: 'Paling mudah: kunci gratis dari Google AI Studio, tanpa kartu kredit, kuota harian jauh melebihi kebutuhan rapat.',
    tautan: 'https://aistudio.google.com/apikey', namaTautan: 'Ambil kunci gratis di Google AI Studio'
  },
  openrouter: {
    label: 'OpenRouter', bentuk: 'openai', biaya: 'ADA YANG GRATIS',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'google/gemma-4-26b-a4b-it:free',
    maksKeluaran: 32000,
    petunjuk: 'Satu kunci untuk puluhan model. Yang berakhiran “:free” tidak dipungut biaya; sisanya bayar sesuai pemakaian dan jauh lebih murah daripada berlangganan.',
    tautan: 'https://openrouter.ai/keys', namaTautan: 'Ambil kunci di OpenRouter'
  },
  anthropic: {
    label: 'Anthropic (langsung)', bentuk: 'anthropic', biaya: 'BERBAYAR',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-sonnet-5',
    maksKeluaran: 32000,
    petunjuk: 'Bayar sesuai pemakaian, pembacaan tabel dari gambarnya paling teliti. Cocok bila hasil Gemini masih perlu banyak dikoreksi.',
    tautan: 'https://console.anthropic.com/settings/keys', namaTautan: 'Ambil kunci di Anthropic Console'
  },
  openai: {
    label: 'Gateway OpenAI-kompatibel lain', bentuk: 'openai', biaya: 'TERGANTUNG GATEWAY',
    baseUrl: 'https://agentrouter.org/v1',
    model: 'gpt-4o',
    petunjuk: 'AgentRouter, OpenAI, atau gateway lain yang meniru /v1/chat/completions. Isi Base URL sesuai penyedianya.',
    tautan: '', namaTautan: ''
  }
};

const bentukAi = () => (PENYEDIA[AI.penyedia] || PENYEDIA.openai).bentuk;

/* Notulensi dengan belasan ruas gampang melewati 8.000 token, dan balasan yang
   terpotong bukan JSON lagi — parsernya menyerah dan petugas melihat galat yang
   membingungkan. Plafonnya dinaikkan sampai mendekati batas tiap penyedia.
   Gateway pihak ketiga dibiarkan 16.000 karena gpt-4o menolak lebih dari itu. */
const maksKeluaran = () => (PENYEDIA[AI.penyedia] || PENYEDIA.openai).maksKeluaran || 16000;

/* Pasangan notulis yang boleh dipilih. Kolomnya tetap bisa diketik manual
   bila susunan pasangannya berbeda pada rapat tertentu. */
const PASANGAN_NOTULIS = [
  ['Akram Yonda Putra', 'Amiruddin Yusuf'],
  ['Sinta Nur Indah',   'Yusrel Ikhsan Wibawa'],
  ['Brigitta Yolanda',  'Robby Hidayat'],
  ['Frandi Sahabat',    'Dyah Nurnaningtyas']
];

/* Tiga slot foto pada halaman dokumentasi. Ukurannya diambil dari template
   (EMU), dipakai untuk membingkai screenshot supaya tidak gepeng. */
const SLOT_FOTO = [
  { berkas: 'word/media/image1.png', rasio: 2924175 / 1574800 },
  { berkas: 'word/media/image2.png', rasio: 2838450 / 1524000 },
  { berkas: 'word/media/image3.png', rasio: 2924175 / 1574800 }
];

const MAKS_FOTO = 8;          // yang dibaca AI
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
               'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const BUTIR_BAKU = [
  'Seluruh pelaksana kegiatan diminta menjaga mutu, waktu, dan administrasi pelaksanaan sesuai ketentuan DAK.',
  'Paket yang mengalami keterlambatan wajib menyampaikan rencana percepatan pelaksanaan.',
  'Pengawasan lapangan akan ditingkatkan untuk memastikan kualitas pekerjaan sesuai spesifikasi teknis.',
  'Monitoring progres fisik dan keuangan dilaksanakan secara berkala sebagai bahan evaluasi pimpinan.'
];

/* Dua butir tebal terakhir bagian Kesimpulan sudah tetap di template, jadi
   selalu tercetak paling bawah tanpa bisa terhapus atau tertukar urutannya.
   Butir yang sama pernah ikut daftar yang bisa diketik; kalau masih tersimpan
   di arsip, butir itu dibuang supaya tidak tercetak dua kali. */
const BUTIR_TETAP = [
  'Kelengkapan dokumen di aplikasi eMonitoring DAK berpengaruh pada penilain kinerja daerah, untuk daerah diminta melengkapi sampai dengan batas waktu satu minggu kedepan.',
  'Tidak melakukan perubahan tanpa melakukan konsultasi kepada Balai Jalan dan PFID.'
];

/* Perbandingannya longgar: butir yang pernah diketik sendiri oleh petugas
   biasanya beda titik atau huruf besarnya saja. */
const intiButir = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const INTI_TETAP = BUTIR_TETAP.map(intiButir);

const butirBebas = butir =>
  (butir || []).filter(Boolean).filter(x => !INTI_TETAP.includes(intiButir(x)));

const ITEM_UMUM = [
  { k: 'lp', label: 'Lebar Perkerasan Jalan' },
  { k: 'jp', label: 'Jenis Perkerasan' },
  { k: 'lb', label: 'Lebar bahu Jalan' },
  { k: 'jb', label: 'Jenis Bahu Jalan' }
];


/* ═══════════════════════════════════════════════════════════════
   1. UTIL
   ═══════════════════════════════════════════════════════════════ */
const el   = s => document.querySelector(s);
const els  = s => Array.from(document.querySelectorAll(s));
const aman = s => String(s == null ? '' : s)
  .replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

/** Akun PFID: user id (bagian email sebelum @) atau namanya memuat "jalan". */
function akunPfid(profil) {
  if (!profil) return false;
  const idUser = String(profil.email || '').split('@')[0];
  return /jalan/i.test(idUser) || /jalan/i.test(profil.nama || '');
}

function tanggalIndo(iso) {
  const d = iso ? new Date(iso + 'T00:00:00') : new Date();
  if (isNaN(d.getTime())) return '';
  return `${HARI[d.getDay()]}/ ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

const isoHariIni = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Kunci API sering terbawa spasi tak kasatmata saat disalin — fetch menolaknya. */
const bersihkanKunci = k => String(k || '').trim().replace(/[^\x21-\x7E]/g, '');

/** Balasan model kadang dibungkus ```json, kadang berisi kalimat pengantar.
    Pagar penutupnya kadang tidak ikut tercetak, jadi ujung teks pun diterima. */
function jsonAman(teks) {
  const blok = teks.match(/```(?:json)?\s*([\s\S]*?)\s*(?:```|$)/);
  if (blok) { try { return JSON.parse(blok[1].trim()); } catch (e) { /* lanjut */ } }
  const awal = teks.indexOf('{');
  if (awal < 0) return null;
  let dalam = 0, diTeks = false, lolos = false, akhir = -1;
  for (let i = awal; i < teks.length; i++) {
    const c = teks[i];
    if (lolos) { lolos = false; continue; }
    if (c === '\\' && diTeks) { lolos = true; continue; }
    if (c === '"') { diTeks = !diTeks; continue; }
    if (diTeks) continue;
    if (c === '{') dalam++;
    else if (c === '}' && --dalam === 0) { akhir = i; break; }
  }
  if (akhir < 0) return null;
  try { return JSON.parse(teks.slice(awal, akhir + 1)); } catch (e) { return null; }
}

const bacaBerkas = berkas => new Promise((res, tolak) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = () => tolak(new Error('gagal membaca ' + berkas.name));
  r.readAsDataURL(berkas);
});

const muatGambar = src => new Promise((res, tolak) => {
  const im = new Image();
  im.onload = () => res(im);
  im.onerror = () => tolak(new Error('gambar tidak terbaca'));
  im.src = src;
});

/** Muat pustaka dari CDN sekali saja. */
const sudahDimuat = {};
function muatSkrip(url) {
  if (sudahDimuat[url]) return sudahDimuat[url];
  sudahDimuat[url] = new Promise((res, tolak) => {
    const s = document.createElement('script');
    s.src = url;
    s.onload = res;
    s.onerror = () => { delete sudahDimuat[url]; tolak(new Error('gagal memuat ' + url)); };
    document.head.appendChild(s);
  });
  return sudahDimuat[url];
}


/* ═══════════════════════════════════════════════════════════════
   2. KEADAAN
   ═══════════════════════════════════════════════════════════════ */
let LANGKAH = 'identitas';       // identitas · tempel · baca · periksa
let GALAT   = '';
let KABAR   = '';                // pesan hijau, mis. hasil uji koneksi
let FOTO    = [];                // { berkas, url, urlAi }
let MODEL   = [];                // daftar model yang boleh dipakai kunci ini
let AI      = { penyedia: 'gemini', baseUrl: PENYEDIA.gemini.baseUrl, model: PENYEDIA.gemini.model, apiKey: '' };
let AI_DARI = 'lokal';           // 'bersama' bila kunci datang dari Firestore
let AI_OLEH = '';                // petugas yang terakhir menyimpan kunci bersama
let AI_GALAT = '';               // sebab kunci bersama gagal terbaca, bila ada

const kosongUmum = () => {
  const o = { namaRuas: '' };
  ITEM_UMUM.forEach(({ k }) => {
    o[k + 'Eksisting'] = ''; o[k + 'Rencana'] = '';
    o[k + 'Realisasi'] = ''; o[k + 'Keterangan'] = '';
  });
  return o;
};

let D = kosong();
function kosong() {
  return {
    tanggalIso: isoHariIni(),
    _prov: '', _kab: '',        // hanya pembantu pemilih wilayah, tidak dicetak
    daerah: '',
    pasangan: 0,
    notulis1: PASANGAN_NOTULIS[0][0],
    notulis2: PASANGAN_NOTULIS[0][1],
    progres: [],
    emon: [],
    infoUmum: [],
    catatan: [],
    fisikRata: '',
    keuanganRata: '',
    evaluasiPoin: [],
    permasalahanUtama: '',
    tindakLanjut: [],
    kesimpulan: [],
    butir: BUTIR_BAKU.slice()
  };
}


/* ═══════════════════════════════════════════════════════════════
   3. KONFIGURASI AI — dipakai bersama semua petugas PFID
   Kunci disimpan di Firestore `konfigurasi/ai` supaya cukup diisi
   sekali oleh siapa pun, lalu terpakai di semua perangkat.
   ═══════════════════════════════════════════════════════════════ */
const LS_AI = 'monevdak_ai';

/* Konfigurasi tersimpan sebelum ada pilihan penyedia selalu berupa gateway
   OpenAI-kompatibel. Jangan diam-diam dipindah ke penyedia lain. */
const rapikanKonfig = x => ({ ...x, penyedia: PENYEDIA[x.penyedia] ? x.penyedia : 'openai' });

let konfigDicoba = false;   // kunci bersama cukup diambil sekali per sesi

/** Kunci bersama selalu diutamakan: satu orang mengisinya, semua petugas
    yang namanya memuat "jalan" langsung memakainya tanpa mengisi ulang. */
async function muatKonfigAi(paksa) {
  if (konfigDicoba && !paksa) return;
  konfigDicoba = true;

  try {
    const lokal = JSON.parse(localStorage.getItem(LS_AI) || '{}');
    if (lokal.apiKey || lokal.baseUrl) AI = { ...AI, ...rapikanKonfig(lokal) };
  } catch (e) { /* abaikan */ }

  if (store.mode !== 'firebase' || !store.db) return;
  try {
    const { doc, getDocFromServer } = store.fs;
    const d = await getDocFromServer(doc(store.db, 'konfigurasi', 'ai'));
    if (d.exists()) {
      const x = d.data();
      if (x.apiKey) {
        AI = { ...AI, ...rapikanKonfig(x) };
        AI_DARI = 'bersama';
        AI_OLEH = String(x.diperbaruiOleh || '');
        /* Supaya tetap ada bila lain kali dibuka tanpa jaringan. */
        localStorage.setItem(LS_AI, JSON.stringify(AI));
      }
    }
  } catch (e) {
    console.warn('[MonevDAK] konfigurasi AI bersama belum terbaca:', e);
    AI_GALAT = 'Kunci bersama tidak terbaca dari server (' + (e.code || e.message) + '). '
             + 'Isi kunci di bawah, atau minta admin memperbarui aturan Firestore.';
  }
}

async function simpanKonfigAi() {
  localStorage.setItem(LS_AI, JSON.stringify(AI));
  if (store.mode !== 'firebase' || !store.db) return false;
  const { doc, setDoc, serverTimestamp } = store.fs;
  await setDoc(doc(store.db, 'konfigurasi', 'ai'), {
    penyedia: AI.penyedia, baseUrl: AI.baseUrl, model: AI.model, apiKey: AI.apiKey,
    diperbaruiOleh: (ME && ME.nama) || '', diperbaruiAt: serverTimestamp()
  });
  AI_DARI = 'bersama';
  AI_OLEH = (ME && ME.nama) || '';
  AI_GALAT = '';
  return true;
}


/* ═══════════════════════════════════════════════════════════════
   4. PEMANGGILAN AI
   ═══════════════════════════════════════════════════════════════ */
const PERINTAH = `Kamu membaca tangkapan layar rapat pemantauan dan evaluasi DAK Fisik Sub Bidang Jalan
(bahan paparan pemda, tabel progres, dan tangkapan aplikasi eMonitoring DAK).

Ambil datanya apa adanya dari gambar. JANGAN mengarang angka. Kalau sebuah nilai tidak
terlihat di gambar, isi dengan string kosong "".

Aturan penulisan:
- Angka persen dan ukuran memakai koma sebagai desimal (contoh "15,24", "2,2 Km", "3,5 m").
- Nilai rupiah ditulis tanpa "Rp", pemisah ribuan titik (contoh "14.293.180.810").
- Kolom kelengkapan eMonitoring dan tabel kesimpulan hanya boleh berisi "${CENTANG}" bila lengkap/sesuai,
  atau "-" bila belum ada.
- "fisikRata" dan "keuanganRata" adalah rata-rata progres seluruh ruas, format "15,24".
- "evaluasiPoin" berisi kalimat utuh, contoh "Terdapat 2 paket yang sesuai jadwal." dan
  "Terdapat 1 paket yang mengalami keterlambatan."
- "permasalahanUtama" hanya frasanya saja tanpa awalan, contoh "kelangkaan bahan bakar".
- "catatan" berisi koreksi/catatan rapat yang terlihat pada paparan; boleh array kosong.
- "tindakLanjut" diisi bila ada permasalahan; "no" mulai dari "1". Boleh array kosong.
- Satu ruas jalan = satu baris pada "progres", "emon", "infoUmum", dan "kesimpulan".
  Nama ruas harus sama persis di keempat tabel.

Balas HANYA JSON berikut, tanpa kalimat lain:
{"progres":[{"namaRuas":"","input":"","output":"","fisik":"","keuangan":"","nilaiKontrak":"","realisasiKontrak":""}],
"emon":[{"namaRuas":"","dataKontrak":"","dataProgres":"","dataTenagaKerja":"","fotoKegiatan":""}],
"infoUmum":[{"namaRuas":"","lpEksisting":"","lpRencana":"","lpRealisasi":"","lpKeterangan":"","jpEksisting":"","jpRencana":"","jpRealisasi":"","jpKeterangan":"","lbEksisting":"","lbRencana":"","lbRealisasi":"","lbKeterangan":"","jbEksisting":"","jbRencana":"","jbRealisasi":"","jbKeterangan":""}],
"catatan":[],
"fisikRata":"","keuanganRata":"",
"evaluasiPoin":[],"permasalahanUtama":"",
"tindakLanjut":[{"no":"","permasalahan":"","tindakLanjut":"","penanggungJawab":"","targetWaktu":""}],
"kesimpulan":[{"namaRuas":"","ruasDalamRk":"","ded":"","jenisPenanganan":"","targetPenanganan":"","bahu":"","marka":""}]}

Keterangan kolom "infoUmum": lp = Lebar Perkerasan Jalan, jp = Jenis Perkerasan,
lb = Lebar bahu Jalan, jb = Jenis Bahu Jalan. Akhiran Eksisting/Rencana/Realisasi/Keterangan
mengikuti kolom tabel "Informasi Umum Kegiatan DAK". Kolom Keterangan diisi "Sesuai" bila
realisasi sama dengan rencana.`;

const pangkal = () => AI.baseUrl.replace(/\/+$/, '');
const belahDataUrl = url => {
  const m = /^data:([^;]+);base64,(.*)$/.exec(url) || [];
  return { mime: m[1] || 'image/jpeg', data: m[2] || '' };
};

/** Ambil pesan galat yang berguna dari badan balasan penyedia mana pun. */
function pesanGalat(res, data) {
  const g = (data && (data.error || data.message)) || null;
  const kode = g && (g.code || g.type || g.status);
  let pesan = (g && (g.message || (typeof g === 'string' ? g : kode))) || ('HTTP ' + res.status);
  if (typeof pesan !== 'string') pesan = JSON.stringify(pesan);

  if (/content[-_ ]blocked/i.test(String(kode) + pesan)) {
    pesan = 'content-blocked — gateway ini menolak permintaannya, hampir selalu karena model "'
          + AI.model + '" tidak termasuk paket kunci API tersebut, bukan karena isi tangkapan layarnya. '
          + 'Pilih penyedia lain di atas, atau klik “Muat daftar model” untuk memilih model yang boleh dipakai.';
  } else if (res.status === 401 || res.status === 403) {
    pesan = 'kunci API ditolak (' + res.status + '). ' + pesan;
  } else if (res.status === 404) {
    pesan = 'model "' + AI.model + '" tidak dikenali penyedia ini (404). Klik “Muat daftar model” untuk melihat yang tersedia.';
  } else if (res.status === 429) {
    pesan = 'kuota atau batas laju terlampaui (429). Tunggu sebentar lalu coba lagi. ' + pesan;
  }
  return pesan;
}

/* Diisi ulang tiap panggilan: true bila model berhenti karena kehabisan jatah
   token, bukan karena jawabannya memang sudah selesai. Balasan begini selalu
   gagal diurai, dan penyebabnya perlu disebut terang-terangan. */
let TERPOTONG = false;

/* ── tiga bentuk permintaan; semuanya menerima teks + daftar dataURL ── */
const PANGGIL = {
  async gemini(teks, gambar, maksToken) {
    const parts = [{ text: teks }];
    gambar.forEach(u => {
      const { mime, data } = belahDataUrl(u);
      parts.push({ inline_data: { mime_type: mime, data } });
    });
    const alamat = pangkal() + '/models/' + encodeURIComponent(AI.model) + ':generateContent';
    const res = await fetch(alamat, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': bersihkanKunci(AI.apiKey) },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0, maxOutputTokens: maksToken }
      })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.error) throw new Error(pesanGalat(res, data));
    const c = (data.candidates || [])[0];
    if (!c) throw new Error('Gemini tidak mengembalikan jawaban. Kemungkinan permintaan tersaring.');
    if (c.finishReason === 'MAX_TOKENS') TERPOTONG = true;
    return ((c.content && c.content.parts) || []).map(p => p.text || '').join('');
  },

  async anthropic(teks, gambar, maksToken) {
    const isi = gambar.map(u => {
      const { mime, data } = belahDataUrl(u);
      return { type: 'image', source: { type: 'base64', media_type: mime, data } };
    });
    isi.push({ type: 'text', text: teks });
    const res = await fetch(pangkal() + '/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': bersihkanKunci(AI.apiKey),
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: AI.model, max_tokens: maksToken, temperature: 0,
        messages: [{ role: 'user', content: isi }]
      })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.type === 'error' || data.error) throw new Error(pesanGalat(res, data));
    if (data.stop_reason === 'max_tokens') TERPOTONG = true;
    const blok = (data.content || []).find(b => b.type === 'text');
    return blok ? blok.text : '';
  },

  async openai(teks, gambar, maksToken) {
    const isi = [{ type: 'text', text: teks }];
    gambar.forEach(u => isi.push({ type: 'image_url', image_url: { url: u } }));
    const res = await fetch(pangkal() + '/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + bersihkanKunci(AI.apiKey) },
      body: JSON.stringify({
        model: AI.model, max_tokens: maksToken, temperature: 0,
        messages: [{ role: 'user', content: isi }]
      })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.error) throw new Error(pesanGalat(res, data));
    const p = (data.choices || [])[0];
    if (p && p.finish_reason === 'length') TERPOTONG = true;
    return (p && p.message && p.message.content) || '';
  }
};

async function panggilAi(teks, gambar, maksToken) {
  if (!bersihkanKunci(AI.apiKey)) throw new Error('Kunci API belum diisi.');
  const fn = PANGGIL[bentukAi()];
  TERPOTONG = false;
  try {
    return await fn(teks, gambar, maksToken);
  } catch (e) {
    /* fetch yang gagal total (jaringan/CORS) tidak membawa pesan yang berguna. */
    if (e instanceof TypeError) {
      throw new Error((PENYEDIA[AI.penyedia] || {}).label + ' tidak dapat dihubungi. Periksa Base URL dan koneksi internet.');
    }
    throw e;
  }
}

/** Panggilan teks singkat untuk memastikan kunci dan model bisa dipakai. */
async function ujiKoneksi() {
  const teks = await panggilAi('Balas satu kata: siap', [], 16);
  return String(teks).trim().slice(0, 80);
}

async function bacaDenganAi() {
  if (!FOTO.length) throw new Error('Belum ada screenshot yang ditempel.');
  const teks = await panggilAi(PERINTAH, FOTO.map(f => f.urlAi || f.url), maksKeluaran());
  const hasil = jsonAman(typeof teks === 'string' ? teks : JSON.stringify(teks));
  if (!hasil) {
    /* Balasan yang berhenti di tengah kalimat memang mustahil diurai; menyebutnya
       "tidak berbentuk JSON" hanya menyesatkan petugas ke arah yang salah. */
    if (TERPOTONG) {
      throw new Error('Balasan AI terputus karena kepanjangan. Kurangi jumlah screenshot, '
        + 'atau pakai model dengan jatah keluaran lebih besar.');
    }
    throw new Error('Balasan AI tidak berbentuk JSON: ' + String(teks).slice(0, 160));
  }
  /* Terurai tetapi terpotong berarti ada ruas yang hilang diam-diam — dokumen
     dinas tidak boleh kehilangan baris tanpa ada yang tahu. */
  if (TERPOTONG) {
    throw new Error('Balasan AI terputus karena kepanjangan, sebagian ruas kemungkinan hilang. '
      + 'Kurangi jumlah screenshot lalu ulangi.');
  }
  return hasil;
}

/** Daftar model yang boleh dipakai kunci ini. Setiap butir: { id, gratis }. */
async function muatDaftarModel() {
  const kunci = bersihkanKunci(AI.apiKey);
  if (!kunci) throw new Error('Kunci API belum diisi.');

  if (bentukAi() === 'gemini') {
    const res = await fetch(pangkal() + '/models?pageSize=200', { headers: { 'x-goog-api-key': kunci } });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.error) throw new Error(pesanGalat(res, data));
    return (data.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => ({ id: String(m.name || '').replace(/^models\//, ''), gratis: true }))
      .filter(m => m.id)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  const kepala = bentukAi() === 'anthropic'
    ? { 'x-api-key': kunci, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }
    : { authorization: 'Bearer ' + kunci };
  const res = await fetch(pangkal() + '/models', { headers: kepala });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.error) throw new Error(pesanGalat(res, data));

  let daftar = (data.data || []).map(m => ({
    id: m.id,
    /* OpenRouter menyertakan kemampuan dan harga tiap model; penyedia lain tidak. */
    gambar: m.architecture ? (m.architecture.input_modalities || []).includes('image') : null,
    gratis: m.pricing ? Number(m.pricing.prompt) === 0 : /:free$/.test(String(m.id))
  })).filter(m => m.id);

  /* Kalau kemampuannya diketahui, sisakan yang bisa membaca gambar saja —
     memilih model tanpa kemampuan itu pasti berujung galat. */
  if (daftar.some(m => m.gambar === true)) daftar = daftar.filter(m => m.gambar === true);

  /* Yang gratis ditaruh paling atas. */
  return daftar.sort((a, b) => (b.gratis - a.gratis) || a.id.localeCompare(b.id));
}

/** Salin hasil AI ke formulir, sambil menyelaraskan daftar ruas antar tabel. */
function terapkanHasil(h) {
  const teks = v => (v == null ? '' : String(v));
  const larik = v => Array.isArray(v) ? v : [];

  D.progres = larik(h.progres).map(r => ({
    namaRuas: teks(r.namaRuas), input: teks(r.input), output: teks(r.output),
    fisik: teks(r.fisik), keuangan: teks(r.keuangan),
    nilaiKontrak: teks(r.nilaiKontrak), realisasiKontrak: teks(r.realisasiKontrak)
  }));

  const ruas = D.progres.map(r => r.namaRuas).filter(Boolean);
  const samakan = (baris, bawaan) => {
    const asal = larik(baris);
    if (!ruas.length) return asal.map(bawaan);
    return ruas.map(nama => {
      const cocok = asal.find(x => teks(x.namaRuas).trim() === nama.trim()) || {};
      return Object.assign(bawaan(cocok), { namaRuas: nama });
    });
  };

  D.emon = samakan(h.emon, r => ({
    namaRuas: teks(r.namaRuas),
    dataKontrak: teks(r.dataKontrak) || CENTANG, dataProgres: teks(r.dataProgres) || CENTANG,
    dataTenagaKerja: teks(r.dataTenagaKerja) || CENTANG, fotoKegiatan: teks(r.fotoKegiatan) || CENTANG
  }));

  D.infoUmum = samakan(h.infoUmum, r => {
    const o = kosongUmum();
    Object.keys(o).forEach(k => { if (r[k] != null) o[k] = teks(r[k]); });
    return o;
  });

  D.kesimpulan = samakan(h.kesimpulan, r => ({
    namaRuas: teks(r.namaRuas),
    ruasDalamRk: teks(r.ruasDalamRk) || CENTANG, ded: teks(r.ded) || CENTANG,
    jenisPenanganan: teks(r.jenisPenanganan) || CENTANG,
    targetPenanganan: teks(r.targetPenanganan) || CENTANG,
    bahu: teks(r.bahu) || CENTANG, marka: teks(r.marka) || CENTANG
  }));

  D.catatan = larik(h.catatan).map(teks).filter(Boolean);
  D.fisikRata = teks(h.fisikRata);
  D.keuanganRata = teks(h.keuanganRata);
  D.evaluasiPoin = larik(h.evaluasiPoin).map(teks).filter(Boolean);
  D.permasalahanUtama = teks(h.permasalahanUtama);
  D.tindakLanjut = larik(h.tindakLanjut)
    .map((r, i) => ({
      no: teks(r.no) || String(i + 1), permasalahan: teks(r.permasalahan),
      tindakLanjut: teks(r.tindakLanjut), penanggungJawab: teks(r.penanggungJawab),
      targetWaktu: teks(r.targetWaktu)
    }))
    .filter(r => r.permasalahan || r.tindakLanjut);
}


/* ═══════════════════════════════════════════════════════════════
   5. PEMBUATAN BERKAS WORD
   ═══════════════════════════════════════════════════════════════ */
/** Bingkai screenshot ke rasio slot template, latar putih, tanpa terpotong. */
async function bingkaiFoto(dataUrl, rasio) {
  const im = await muatGambar(dataUrl);
  const lebar = 1400;
  const tinggi = Math.round(lebar / rasio);
  const c = document.createElement('canvas');
  c.width = lebar; c.height = tinggi;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, lebar, tinggi);
  const s = Math.min(lebar / im.width, tinggi / im.height);
  const w = im.width * s, hh = im.height * s;
  g.drawImage(im, (lebar - w) / 2, (tinggi - hh) / 2, w, hh);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

/** Nama daerah, dibersihkan dari karakter yang tidak boleh ada di nama berkas.
    Kalau kolom daerah dikosongkan, pilihan kabupaten/kota yang dipakai. */
function daerahBersih(d) {
  d = d || D;
  const asal = (d.daerah || d._kab || '').replace(/[\\/:*?"<>|]/g, ' ');
  return asal.replace(/\s+/g, ' ').trim();
}

/** Berkas Word diberi nama daerahnya, supaya berkas dari banyak daerah
    tidak saling tertimpa di folder unduhan. */
function namaBerkas(d) {
  const daerah = daerahBersih(d);
  return (daerah ? daerah + ' - ' : '') + 'Notulensi Rakor PE DAK Jalan TA 2026 TW II.docx';
}

function dataTemplate(d, foto) {
  d = d || D; foto = foto || FOTO;
  const catatan = (d.catatan || []).filter(Boolean);
  const tindakLanjut = d.tindakLanjut || [];
  return {
    hariTanggal: tanggalIndo(d.tanggalIso),
    daerah: d.daerah,
    notulis1: d.notulis1,
    notulis2: d.notulis2,
    progres: d.progres || [],
    emon: d.emon || [],
    infoUmum: d.infoUmum || [],
    catatan,
    fisikRata: d.fisikRata,
    keuanganRata: d.keuanganRata,
    evaluasiPoin: d.evaluasiPoin || [],
    permasalahanUtama: d.permasalahanUtama,
    tindakLanjut,
    kesimpulan: d.kesimpulan || [],
    butir: butirBebas(d.butir),
    /* Bagian yang kosong dibuang seluruhnya — judul tanpa isi membuat
       susunan paragraf dokumen terlihat berantakan. */
    adaCatatan: catatan.length > 0,
    adaTindakLanjut: tindakLanjut.length > 0,
    adaFoto1: foto.length > 0,
    adaFoto2: foto.length > 1,
    adaFoto3: foto.length > 2
  };
}

/** Susun berkas Word-nya saja; pengunduhan dan pratinjau memakai ini bersama. */
async function susunBlob(d, foto) {
  d = d || D; foto = foto || FOTO;
  await Promise.all([muatSkrip(CDN_PIZZIP), muatSkrip(CDN_DOCXTPL)]);

  const res = await fetch(TEMPLATE_URL);
  if (!res.ok) throw new Error('Template berita acara tidak ditemukan (' + res.status + ').');
  const bahan = await res.arrayBuffer();

  const zip = new window.PizZip(bahan);
  const doc = new window.docxtemplater(zip, {
    paragraphLoop: true, linebreaks: true, nullGetter: () => ''
  });
  doc.render(dataTemplate(d, foto));

  /* Slot foto dokumentasi diisi dengan menukar byte gambar bawaan template —
     cara ini tidak butuh modul gambar docxtemplater yang berbayar. */
  const keluar = doc.getZip();
  for (let i = 0; i < SLOT_FOTO.length; i++) {
    if (!foto[i]) continue;
    const bit = await bingkaiFoto(foto[i].url, SLOT_FOTO[i].rasio);
    keluar.file(SLOT_FOTO[i].berkas, bit, { binary: true });
  }

  return keluar.generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE'
  });
}

/** Simpan blob ke folder unduhan peramban. */
function unduhBlob(blob, nama) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nama;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return nama;
}

async function buatWord() {
  const blob = await susunBlob(D, FOTO);
  return unduhBlob(blob, namaBerkas());
}


/* ═══════════════════════════════════════════════════════════════
   5b. ARSIP BERITA ACARA — dipakai bersama semua petugas
   Sekali AI membaca screenshot, hasilnya disimpan. Daerah yang sudah
   diperiksa pagi tadi bisa dibuka lagi sore hari untuk diperbaiki tanpa
   memanggil AI sekali lagi, dan petugas lain bisa ikut memeriksanya.
   ═══════════════════════════════════════════════════════════════ */
const LS_ARSIP   = 'monevdak_arsip';   // dipakai bila Firebase tidak aktif
const BATAS_FOTO = 900000;             // satu dokumen Firestore maksimal 1 MB
const CDN_MAMMOTH = 'https://unpkg.com/mammoth@1.11.0/mammoth.browser.min.js';

/* Sama persis dengan slug() di index.html supaya kunci daerah pada arsip dan
   kunciKab pada profil peserta bisa dibandingkan langsung oleh firestore.rules. */
const slugKunci = s => String(s == null ? '' : s).toLowerCase()
  .replace(/[^a-z0-9 ]/g, '').trim().replace(/\s+/g, '-');

/* "Kab Magelang" dan "Magelang" harus menghasilkan kunci yang sama, sedangkan
   "Kota Magelang" tetap terpisah — di daftar wilayah keduanya daerah berbeda.

   Nama daerah kepulauan kerap ditulis singkat — "Kab Kep. Siau Tagulandang
   Biaro" untuk "Kepulauan Siau Tagulandang Biaro" di assets/wilayah.js.
   Singkatannya dipanjangkan lebih dulu supaya kuncinya sama, sehingga berita
   acaranya tetap dikenali provinsinya, petanya, dan daftar arsip pemdanya. */
const kunciDaerah = teks => slugKunci(String(teks || '')
  .replace(/^\s*(kabupaten|kab\.?)\s+/i, '')
  .replace(/^\s*kep\.?\s+/i, 'Kepulauan '));

/** Daerah milik pengguna yang sedang masuk; petugas PFID tidak terikat daerah. */
const kunciSaya = () => (ME ? kunciDaerah(ME.kab) : '');

/* Provinsi tidak selalu ikut tersimpan: berita acara lama dibuat sebelum
   pemilih wilayah ada, dan nama daerah boleh diketik sendiri. Karena itu
   provinsinya dicari lagi dari daftar wilayah memakai nama kabupaten/kotanya. */
let PETA_PROV = null;

function provinsiDari(teks) {
  if (!PETA_PROV) {
    PETA_PROV = {};
    const w = window.WILAYAH || {};
    Object.keys(w).forEach(prov => String(w[prov]).split(',').forEach(kab => {
      const k = kunciDaerah(kab);
      if (k && !(k in PETA_PROV)) PETA_PROV[k] = prov;
    }));
  }
  return PETA_PROV[kunciDaerah(teks)] || '';
}

const provArsip = r => r.prov || provinsiDari(r.daerah || r.kab || '');
const penyusunArsip = r => String(r.penyusun || '').trim();

/* Nilai pilihan untuk berita acara yang provinsi atau penyusunnya kosong. */
const TANPA_ISI = '__tanpa__';

/** Isi satu saringan arsip: nilai yang ada beserta jumlahnya, urut abjad,
    yang kosong selalu di bawah. Pilihan yang sedang aktif tetap dimunculkan
    walau jumlahnya nol, supaya tidak terlihat berpindah sendiri. */
function pilihanSaring(rekaman, nilai, terpilih) {
  const jumlah = {};
  rekaman.forEach(r => {
    const v = nilai(r) || TANPA_ISI;
    jumlah[v] = (jumlah[v] || 0) + 1;
  });
  if (terpilih && !(terpilih in jumlah)) jumlah[terpilih] = 0;
  return Object.keys(jumlah)
    .sort((a, b) => (a === TANPA_ISI) - (b === TANPA_ISI) || a.localeCompare(b, 'id'))
    .map(v => ({ nilai: v, jumlah: jumlah[v] }));
}

let ARSIP        = [];        // daftar ringkas untuk menu arsip
let ARSIP_DIMUAT = false;
let ARSIP_GALAT  = '';
let ARSIP_CARI   = '';
let ARSIP_PROV   = '';        // saringan provinsi, hanya untuk petugas PFID
let ARSIP_OLEH   = '';        // saringan penyusun, hanya untuk petugas PFID
let ARSIP_ADMIN  = false;     // arsip sedang ditampilkan di panel admin
let ARSIP_BUKA   = {};        // provinsi yang kartunya sedang terbuka di panel admin
let ARSIP_STATUS = '';        // keterangan simpan terakhir pada langkah periksa
let SUDAH_UNDUH  = false;     // Word-nya sudah diunduh, daerah ini boleh ditutup

const idArsip = () => (window.slug ? window.slug(D.daerah || 'daerah') : String(D.daerah || 'daerah')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')) + '__' + D.tanggalIso;

/* ── penjaga tumpang tindih ─────────────────────────────────────
   Nama dokumen arsip adalah daerah + tanggal, jadi dua petugas PFID yang
   menggarap daerah yang sama pada tanggal yang sama menulis ke dokumen yang
   sama persis. Formulirnya digarap di peramban masing-masing dan tidak ada
   yang saling mengabari, sehingga yang menyimpan belakangan akan menghapus
   pekerjaan yang menyimpan lebih dulu tanpa siapa pun tahu.

   Yang dipasang di sini penguncian optimistis: tiap simpanan membubuhkan
   nomor revisi acak, dan penyimpanan berikutnya hanya boleh lewat bila
   revisi di server masih sama dengan yang terakhir dilihat peramban ini.
   Pemeriksaan dan penulisannya satu transaksi, jadi tidak ada celah walau
   keduanya menekan simpan pada detik yang sama. Bila revisinya sudah
   berganti, petugas ditanya lebih dulu — tidak pernah ditimpa diam-diam.

   `null` berarti dokumennya memang belum pernah ada; kalau ternyata sudah
   ada, itu pun bentrokan: berarti petugas lain mendahului membuatnya. */
let ARSIP_DASAR = null;   // { rev, waktu } dokumen sebagaimana terakhir dilihat

const revBaru = () => Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);

const dasarDari = r => ({ rev: (r && r.rev) || null, waktu: waktuAngka(r && r.diperbaruiAt) });

/** Dokumen di server sudah bergerak sejak terakhir dilihat peramban ini? */
function sudahBerubah(tersimpan) {
  if (!tersimpan) return false;               // belum ada, tidak mungkin bentrok
  if (!ARSIP_DASAR) return true;              // ada, padahal kita mengira baru
  if (ARSIP_DASAR.rev && tersimpan.rev) return tersimpan.rev !== ARSIP_DASAR.rev;
  /* Arsip lama belum bernomor revisi; waktu simpannya yang dibandingkan. */
  return waktuAngka(tersimpan.diperbaruiAt) !== ARSIP_DASAR.waktu;
}

const galatBentrok = tersimpan => Object.assign(new Error('bentrok'), {
  code: 'bentrok',
  oleh: (tersimpan && tersimpan.penyusun) || 'petugas lain',
  waktu: waktuArsip(tersimpan && tersimpan.diperbaruiAt),
  baru: !ARSIP_DASAR
});

const pakaiFirebase = () => store.mode === 'firebase' && !!store.db;

const bacaLokal = () => { try { return JSON.parse(localStorage.getItem(LS_ARSIP) || '{}'); } catch (e) { return {}; } };
const tulisLokal = x => { try { localStorage.setItem(LS_ARSIP, JSON.stringify(x)); return true; } catch (e) { return false; } };

const waktuArsip = t => {
  const d = t && typeof t.toDate === 'function' ? t.toDate() : (t ? new Date(t) : null);
  if (!d || isNaN(d.getTime())) return '';
  const jam = String(d.getHours()).padStart(2, '0') + '.' + String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}, ${jam}`;
};

/** Foto disimpan sebagai JPEG yang sudah dikecilkan; yang tetap terlalu besar
    dilewati supaya penyimpanan tidak menolak seluruh berita acaranya. */
async function fotoArsip(dataUrl) {
  const im = await muatGambar(dataUrl);
  const maks = 1500;
  const s = Math.min(1, maks / Math.max(im.width, im.height));
  const c = document.createElement('canvas');
  c.width = Math.round(im.width * s);
  c.height = Math.round(im.height * s);
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(im, 0, 0, c.width, c.height);
  for (const mutu of [0.82, 0.65, 0.5, 0.38]) {
    const u = c.toDataURL('image/jpeg', mutu);
    if (u.length <= BATAS_FOTO) return u;
  }
  return null;
}

function ringkasArsip() {
  return {
    daerah: D.daerah || '(tanpa daerah)',
    /* Kunci inilah yang dipakai firestore.rules untuk menentukan pemda mana
       yang boleh melihat berita acara ini. */
    kunciDaerah: kunciDaerah(D.daerah || D._kab),
    prov: D._prov || '',
    kab: D._kab || '',
    tanggalIso: D.tanggalIso,
    tanggalTeks: tanggalIndo(D.tanggalIso),
    notulis1: D.notulis1,
    notulis2: D.notulis2,
    penyusun: (ME && ME.nama) || '',
    jumlahRuas: D.progres.length
  };
}

/** Simpan berita acara yang sedang dikerjakan.
    `diam`    — simpan otomatis, tidak boleh menimpa dan tidak menyela layar.
    `paksa`   — petugas sudah diberi tahu ada bentrokan dan memilih menimpa.
    `salinan` — disimpan sebagai dokumen terpisah, supaya kedua pekerjaan utuh. */
async function simpanArsip(diam, paksa, salinan) {
  if (!D.daerah.trim()) {
    if (!diam) throw new Error('Daerah belum diisi, arsip perlu nama daerah.');
    return null;
  }
  const id = salinan ? idSalinan() : idBerjalan();
  const ringkas = ringkasArsip();
  const rev = revBaru();
  /* Tiga foto pertama saja: hanya itu yang tercetak di halaman dokumentasi. */
  const foto = [];
  for (const f of FOTO.slice(0, 3)) {
    try { const u = await fotoArsip(f.url); if (u) foto.push(u); } catch (e) { /* lewati */ }
  }

  /* Salinan adalah dokumen baru, jadi tidak membandingkan diri dengan apa pun. */
  if (salinan) ARSIP_DASAR = null;

  if (pakaiFirebase()) {
    const { doc, setDoc, deleteDoc, collection, getDocs, serverTimestamp, runTransaction } = store.fs;
    const acuan = doc(store.db, 'beritaAcara', id);
    const isi = {
      ...ringkas,
      uid: store.uid || '',
      jumlahFoto: foto.length,
      data: D,
      rev,
      diperbaruiAt: serverTimestamp()
    };
    /* Membaca lalu menulis dalam satu transaksi: kalau petugas lain menyimpan
       di sela keduanya, Firestore mengulang transaksinya sehingga
       pemeriksaannya tidak pernah memakai keadaan yang basi. */
    await runTransaction(store.db, async tx => {
      const kini = await tx.get(acuan);
      const tersimpan = kini.exists() ? kini.data() : null;
      if (!paksa && !salinan && sudahBerubah(tersimpan)) throw galatBentrok(tersimpan);
      tx.set(acuan, isi);
    });
    /* Foto ditaruh satu per dokumen; satu dokumen Firestore tidak muat tiga. */
    const lama = await getDocs(collection(store.db, 'beritaAcara', id, 'foto'));
    await Promise.all(lama.docs.map(d => deleteDoc(d.ref)));
    await Promise.all(foto.map((url, i) =>
      setDoc(doc(store.db, 'beritaAcara', id, 'foto', String(i)), { url })));
    await tulisIndeks(id, { ...ringkas, jumlahFoto: foto.length });
  } else {
    const semua = bacaLokal();
    if (!paksa && !salinan && sudahBerubah(semua[id])) throw galatBentrok(semua[id]);
    semua[id] = { ...ringkas, jumlahFoto: foto.length, data: D, foto, rev, diperbaruiAt: Date.now() };
    if (!tulisLokal(semua)) {
      /* Ruang localStorage habis: simpan tanpa foto daripada gagal seluruhnya. */
      semua[id] = { ...semua[id], foto: [], jumlahFoto: 0 };
      tulisLokal(semua);
    }
  }

  ARSIP_DIMUAT = false;
  DARI_ARSIP = id;          // sejak tersimpan, ini dokumennya sendiri
  /* Nomor revisi yang baru saja ditulis menjadi acuan simpanan berikutnya.
     Stempel waktunya diisi server dan belum diketahui di sini, tetapi tidak
     diperlukan lagi — sejak sekarang dokumen ini sudah bernomor revisi. */
  ARSIP_DASAR = { rev, waktu: 0 };
  ARSIP_STATUS = (salinan ? 'Tersimpan sebagai salinan terpisah ' : 'Tersimpan di arsip ') + waktuArsip(Date.now())
               + (foto.length < Math.min(FOTO.length, 3) ? ' (sebagian foto terlalu besar, tidak ikut tersimpan)' : '');
  return id;
}

/* ── impor dokumen Word ─────────────────────────────────────────
   Notulensi yang sudah pernah disusun manual dibaca kembali oleh
   assets/impor-ba.js, lalu ditulis ke arsip lewat sini. Sengaja TIDAK melewati
   penjaga bentrokan `simpanArsip`: permintaannya jelas — bila daerah dan
   tanggalnya sudah ada di arsip, isi dari dokumen impor yang dipakai. Yang
   tetap dipertahankan hanya foto dokumentasi yang sudah tersimpan, sebab
   dokumen impor belum tentu membawanya. */
function dataImpor(h) {
  const D = kosong();
  const teks = v => (v == null ? '' : String(v));
  Object.keys(D).forEach(k => { if (h[k] != null) D[k] = h[k]; });
  D.daerah = teks(h.daerah);
  D.tanggalIso = teks(h.tanggalIso) || isoHariIni();
  D._prov = provinsiDari(D.daerah) || '';
  D._kab = D.daerah;
  /* Dua butir terakhir sudah tercetak tetap di template; kalau ikut terbaca
     dari dokumen, butirnya akan muncul dua kali saat dicetak ulang. */
  D.butir = butirBebas(h.butir);
  const pasangan = PASANGAN_NOTULIS.findIndex(([a, b]) => a === D.notulis1 && b === D.notulis2);
  D.pasangan = pasangan < 0 ? 0 : pasangan;
  return D;
}

async function simpanImpor(baris) {
  const D2 = dataImpor(baris.data);
  const id = (window.slug ? window.slug(D2.daerah || 'daerah') : String(D2.daerah || 'daerah')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')) + '__' + D2.tanggalIso;

  const ringkas = {
    daerah: D2.daerah || '(tanpa daerah)',
    kunciDaerah: kunciDaerah(D2.daerah),
    prov: D2._prov || '', kab: D2._kab || '',
    tanggalIso: D2.tanggalIso, tanggalTeks: tanggalIndo(D2.tanggalIso),
    notulis1: D2.notulis1, notulis2: D2.notulis2,
    penyusun: (ME && ME.nama) || (ADMIN && 'Admin') || '',
    jumlahRuas: D2.progres.length
  };

  const foto = [];
  for (const url of (baris.foto || []).slice(0, 3)) {
    try { const u = await fotoArsip(url); if (u) foto.push(u); } catch (e) { /* lewati */ }
  }

  if (pakaiFirebase()) {
    const { doc, getDoc, setDoc, deleteDoc, collection, getDocs, serverTimestamp } = store.fs;
    const acuan = doc(store.db, 'beritaAcara', id);
    const lama = await getDoc(acuan);
    const fotoLama = lama.exists() ? (lama.data().jumlahFoto || 0) : 0;

    await setDoc(acuan, {
      ...ringkas,
      uid: store.uid || '',
      jumlahFoto: foto.length || fotoLama,
      data: D2,
      rev: revBaru(),
      diperbaruiAt: serverTimestamp(),
      dariImpor: baris.berkas || true
    });

    /* Foto lama hanya diganti bila dokumen impor membawa penggantinya. */
    if (foto.length) {
      const isi = await getDocs(collection(store.db, 'beritaAcara', id, 'foto'));
      await Promise.all(isi.docs.map(d => deleteDoc(d.ref)));
      await Promise.all(foto.map((url, i) =>
        setDoc(doc(store.db, 'beritaAcara', id, 'foto', String(i)), { url })));
    }
    await tulisIndeks(id, { ...ringkas, jumlahFoto: foto.length || fotoLama });
  } else {
    const semua = bacaLokal();
    const fotoLama = (semua[id] && semua[id].foto) || [];
    semua[id] = {
      ...ringkas, jumlahFoto: (foto.length ? foto : fotoLama).length,
      data: D2, foto: foto.length ? foto : fotoLama,
      rev: revBaru(), diperbaruiAt: Date.now(), dariImpor: baris.berkas || true
    };
    if (!tulisLokal(semua)) {
      semua[id] = { ...semua[id], foto: [], jumlahFoto: 0 };
      tulisLokal(semua);
    }
  }

  ARSIP_DIMUAT = false;
  return id;
}

/** Sudah ada berita acara daerah + tanggal yang sama di arsip? */
function arsipSudahAda(daerah, tanggalIso) {
  const kunci = kunciDaerah(daerah);
  return ARSIP.some(r => (r.kunciDaerah || kunciDaerah(r.daerah)) === kunci && r.tanggalIso === tanggalIso);
}

/** Buka jendela impor; dipakai tombol di menu arsip dan di panel admin. */
function bukaImporWord() {
  if (!window.IMPOR_BA) { toast('Modul impor belum termuat, muat ulang halamannya.'); return; }
  window.IMPOR_BA.buka({
    sudahAda: arsipSudahAda,
    simpan: baris => simpanImpor(baris),
    selesai: async () => {
      ARSIP_DIMUAT = false;
      await tampilkanArsip();
      if (ARSIP_ADMIN) tampilkanPeta();
    }
  });
}


/* ── rekapitulasi ke Excel ──────────────────────────────────────
   Notulensi menjawab "bagaimana satu daerah"; pimpinan menanyakan "bagaimana
   seluruh daerah". assets/rekap-ba.js merangkum seluruh arsip menjadi satu
   lembar berformat rekapitulasi rakor.

   Arsipnya dibaca ulang lebih dulu. Layar ini bisa sudah lama terbuka,
   sementara petugas lain terus menyimpan dan mengimpor berita acara — rekap
   yang disusun dari daftar lama akan memuat notulensi yang sudah usang tanpa
   ada yang tahu. Bila pembacaan ulangnya gagal, daftar yang ada tetap dipakai
   supaya rekapnya masih bisa keluar. */
async function bukaRekapExcel() {
  if (!window.REKAP_BA) { toast('Modul rekap belum termuat, muat ulang halamannya.'); return; }
  const t = el('#baArsipRekap');
  if (t) { t.disabled = true; t.textContent = 'Menyegarkan arsip…'; }
  try {
    await muatArsip();
  } catch (e) {
    console.warn('[MonevDAK] arsip gagal disegarkan sebelum rekap:', e);
    ARSIP_DIMUAT = true;
    toast('Arsip gagal disegarkan, rekap memakai daftar yang sudah termuat.');
  }
  renderArsip();               // tombolnya ikut tersusun ulang, kembali normal
  window.REKAP_BA.buka({ rekaman: ARSIP, kunci: kunciDaerah });
}


/** Nama dokumen untuk salinan: nama penyusunnya dibubuhkan supaya kedua
    berita acara daerah yang sama tetap bisa dibedakan di daftar arsip. */
function idSalinan() {
  const oleh = (window.slug ? window.slug((ME && ME.nama) || 'salinan') : 'salinan') || 'salinan';
  return idArsip() + '--' + oleh.slice(0, 24);
}

/** Dokumen mana yang sedang digarap.

    Biasanya sama dengan idArsip(), yaitu daerah + tanggal. Yang perlu
    diingat: begitu sebuah berita acara disimpan sebagai salinan, namanya
    berakhiran `--penyusun` dan tidak bisa disusun ulang oleh idArsip().
    Tanpa pengecualian ini, simpanan berikutnya akan berbalik menyasar
    dokumen asli milik petugas lain — persis tumpang tindih yang hendak
    dicegah. Bila daerah atau tanggalnya diganti, awalannya tidak cocok lagi
    dan memang seharusnya menjadi dokumen baru. */
function idBerjalan() {
  const dasar = idArsip();
  return (DARI_ARSIP && DARI_ARSIP.indexOf(dasar + '--') === 0) ? DARI_ARSIP : dasar;
}

const waktuAngka = t => (t && typeof t.toMillis === 'function') ? t.toMillis() : Number(t || 0);

/* ── indeks per daerah ──────────────────────────────────────────
   Pemda tidak boleh menelusuri seluruh koleksi `beritaAcara`, dan kueri
   bersyarat pun ditolak Firestore karena aturannya bergantung pada isi
   dokumen. Jadi tiap daerah punya satu dokumen indeks yang isinya ringkasan
   berita acara daerah itu saja: pemda cukup MEMBACA SATU dokumen yang nama
   dokumennya sama dengan kunci daerahnya sendiri — tidak ada penelusuran
   koleksi sama sekali, sehingga izinnya jelas dan tidak bisa bocor. */
const ringkasIndeks = (id, r) => ({
  id,
  daerah: r.daerah, tanggalIso: r.tanggalIso, tanggalTeks: r.tanggalTeks,
  notulis1: r.notulis1, notulis2: r.notulis2, penyusun: r.penyusun,
  jumlahRuas: r.jumlahRuas || 0, jumlahFoto: r.jumlahFoto || 0,
  diperbaruiAt: Date.now()
});

async function tulisIndeks(id, ringkas) {
  const kunci = ringkas.kunciDaerah || kunciDaerah(ringkas.daerah);
  if (!kunci) return;
  const { doc, setDoc } = store.fs;
  try {
    await setDoc(doc(store.db, 'indeksDaerah', kunci),
      { daftar: { [id]: ringkasIndeks(id, ringkas) } }, { merge: true });
  } catch (e) {
    /* Berita acaranya sudah tersimpan; yang gagal hanya daftar untuk pemda. */
    console.warn('[MonevDAK] indeks daerah tidak tersimpan:', e);
    ARSIP_STATUS = 'Tersimpan, tetapi daftar untuk pemda belum diperbarui ('
                 + (e.code || e.message) + ').';
  }
}

async function hapusIndeks(id, kunci) {
  if (!kunci) return;
  const { doc, updateDoc, deleteField } = store.fs;
  try {
    await updateDoc(doc(store.db, 'indeksDaerah', kunci), { ['daftar.' + id]: deleteField() });
  } catch (e) {
    console.warn('[MonevDAK] indeks daerah tidak dibersihkan:', e);
  }
}

/** Susun ulang seluruh indeks daerah dari arsip yang ada, sekaligus mengisi
    kunciDaerah pada berita acara lama yang disimpan sebelum fitur ini ada.

    Kuncinya selalu dihitung ulang dari nama daerahnya, bukan diambil dari yang
    tersimpan: berita acara yang kuncinya terbentuk sebelum sebuah ejaan dikenali
    — "Kab Kep. Siau Tagulandang Biaro", misalnya — jadi ikut diperbaiki, dan
    daerahnya kembali menemukan arsipnya sendiri. */
async function perbaikiIndeks() {
  if (!pakaiFirebase()) return 0;
  const { doc, setDoc } = store.fs;
  let jumlah = 0;
  for (const r of ARSIP) {
    const kunci = kunciDaerah(r.daerah) || r.kunciDaerah;
    if (!kunci) continue;
    if (r.kunciDaerah !== kunci) {
      await setDoc(doc(store.db, 'beritaAcara', r.id), { kunciDaerah: kunci }, { merge: true });
      r.kunciDaerah = kunci;      // daftar di layar ikut memakai kunci barunya
    }
    await setDoc(doc(store.db, 'indeksDaerah', kunci),
      { daftar: { [r.id]: ringkasIndeks(r.id, { ...r, kunciDaerah: kunci }) } }, { merge: true });
    jumlah++;
  }
  return jumlah;
}

async function muatArsip() {
  ARSIP_GALAT = '';
  /* Admin membaca seluruh koleksi seperti petugas PFID — izinnya sudah ada di
     firestore.rules — tetapi hanya untuk dilihat dan diunduh. */
  const pfid = ARSIP_ADMIN || akunPfid(ME);
  const kunci = kunciSaya();

  if (pakaiFirebase() && pfid) {
    const { collection, getDocs, query, orderBy } = store.fs;
    const snap = await getDocs(query(collection(store.db, 'beritaAcara'), orderBy('diperbaruiAt', 'desc')));
    ARSIP = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } else if (pakaiFirebase()) {
    /* Pemda: satu dokumen indeks daerahnya sendiri, bukan penelusuran koleksi.
       Dibaca langsung dari server — `getDoc` boleh menjawab dari singgahan
       peramban, dan itu membuat berita acara yang baru saja diperbaiki atau
       diimpor petugas belum terlihat oleh daerahnya. */
    if (!kunci) throw new Error('Profil Anda belum mencantumkan kabupaten/kota.');
    const { doc, getDoc, getDocFromServer } = store.fs;
    const acuan = doc(store.db, 'indeksDaerah', kunci);
    let d;
    try { d = await (getDocFromServer ? getDocFromServer(acuan) : getDoc(acuan)); }
    catch (e) { d = await getDoc(acuan); }   // sedang luring: singgahan lebih baik daripada kosong
    const daftar = (d.exists() && d.data().daftar) || {};
    ARSIP = Object.entries(daftar).map(([id, x]) => ({ ...x, id }));
  } else {
    ARSIP = Object.entries(bacaLokal())
      .map(([id, x]) => ({ id, ...x }))
      .filter(x => pfid || x.kunciDaerah === kunci);
  }
  ARSIP.sort((a, b) => waktuAngka(b.diperbaruiAt) - waktuAngka(a.diperbaruiAt));
  ARSIP_DIMUAT = true;
}

/* ── peringatan daerah kembar ───────────────────────────────────
   Dua petugas mudah mengerjakan daerah yang sama tanpa saling tahu, dan
   pembacaan kedua itu memakai token AI untuk hasil yang sudah ada. Begitu
   nama daerahnya diketik, indeks daerahnya dibaca — satu dokumen saja — lalu
   petugas diberi tahu bahwa daerah itu sudah pernah dibuat. */
let KEMBAR     = null;   // { kunci, daftar: [...] } bila daerahnya sudah ada
let DARI_ARSIP = '';     // id arsip yang sedang dikerjakan, bukan kembar
let jamKembar  = null;   // penunda saat nama daerah masih diketik

async function daftarDaerah(kunci) {
  if (pakaiFirebase()) {
    const { doc, getDoc } = store.fs;
    const d = await getDoc(doc(store.db, 'indeksDaerah', kunci));
    const daftar = (d.exists() && d.data().daftar) || {};
    return Object.entries(daftar).map(([id, x]) => ({ ...x, id }));
  }
  return Object.entries(bacaLokal())
    .map(([id, x]) => ({ id, ...x }))
    .filter(x => (x.kunciDaerah || kunciDaerah(x.daerah)) === kunci);
}

async function periksaKembar() {
  const kunci = kunciDaerah(D.daerah);
  if (!kunci) { KEMBAR = null; return; }
  try {
    const daftar = (await daftarDaerah(kunci))
      .filter(x => x.id !== DARI_ARSIP)     // yang sedang dikerjakan bukan kembar
      .sort((a, b) => waktuAngka(b.diperbaruiAt) - waktuAngka(a.diperbaruiAt));
    KEMBAR = daftar.length ? { kunci, daftar } : null;
  } catch (e) {
    console.warn('[MonevDAK] daftar daerah tidak terbaca:', e);
    KEMBAR = null;
  }
}

function kotakKembar() {
  if (!KEMBAR) return '';
  const r = KEMBAR.daftar[0];
  const lain = KEMBAR.daftar.length - 1;
  return `
  <div class="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-5 py-4">
    <div class="flex items-start gap-3">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" class="mt-0.5 h-5 w-5 shrink-0 text-amber-300"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg>
      <div class="min-w-0">
        <p class="text-[13px] font-semibold text-amber-100">${aman(r.daerah)} sudah pernah dibuat.</p>
        <p class="mt-1 text-[12px] leading-relaxed text-amber-100/75">
          ${aman(r.tanggalTeks || tanggalIndo(r.tanggalIso))} oleh ${aman(r.penyusun || '—')} · ${r.jumlahRuas || 0} ruas${lain ? ` · masih ada ${lain} berita acara lain untuk daerah ini` : ''}.
          Buka yang tersimpan saja: isinya bisa langsung diperbaiki, tanpa menempel ulang screenshot dan tanpa memakai token AI lagi.
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <button data-buka-kembar="${aman(r.id)}" class="rounded-full bg-amber-300/90 px-4 py-1.5 text-[12px] font-semibold text-black transition hover:bg-amber-200">Buka yang tersimpan</button>
          <button data-arsip-kembar class="rounded-full border border-amber-300/40 px-4 py-1.5 text-[12px] font-medium text-amber-100 transition hover:bg-amber-300/10">Lihat di arsip</button>
        </div>
      </div>
    </div>
  </div>`;
}

function pasangKembar() {
  els('#view-berita [data-buka-kembar]').forEach(t => t.onclick = async () => {
    t.disabled = true; t.textContent = 'Membuka…';
    try {
      await bukaArsip(t.dataset.bukaKembar);
      render();
      toast('Berita acara ' + D.daerah + ' dibuka dari arsip.');
    } catch (e) {
      GALAT = e.message;
      render();
    }
  });
  els('#view-berita [data-arsip-kembar]').forEach(t => t.onclick = () => {
    ARSIP_CARI = D.daerah;
    ARSIP_DIMUAT = false;
    go('arsip');
  });
}

/** Periksa ulang lalu perbarui kotaknya saja, supaya ketikan tidak terganggu. */
async function segarkanKembar() {
  await periksaKembar();
  const k = el('#baKembar');
  if (k) { k.innerHTML = kotakKembar(); pasangKembar(); }
}

/** Isi satu berita acara tersimpan, tanpa menyentuh formulir yang terbuka. */
async function ambilArsip(id) {
  if (pakaiFirebase()) {
    const { doc, getDoc, getDocFromServer, collection, getDocs } = store.fs;
    /* Dibaca dari server, bukan dari singgahan: dokumen yang baru saja
       diperbaiki petugas atau diimpor harus langsung terlihat isinya. */
    const acuan = doc(store.db, 'beritaAcara', id);
    let d;
    try { d = await (getDocFromServer ? getDocFromServer(acuan) : getDoc(acuan)); }
    catch (e) { d = await getDoc(acuan); }
    if (!d.exists()) throw new Error('Berita acara itu sudah tidak ada di arsip.');
    const snap = await getDocs(collection(store.db, 'beritaAcara', id, 'foto'));
    const foto = snap.docs
      .sort((a, b) => Number(a.id) - Number(b.id))
      .map(x => x.data().url)
      .filter(Boolean);
    return { rekaman: d.data(), foto };
  }
  const rekaman = bacaLokal()[id];
  if (!rekaman) throw new Error('Berita acara itu sudah tidak ada di arsip.');
  return { rekaman, foto: rekaman.foto || [] };
}

/** Isian formulir dari satu rekaman arsip, disamakan dengan bentuk terbaru:
    butir yang kini tetap di template dibuang dari daftar yang bisa diketik. */
function dataArsip(rekaman) {
  const d = Object.assign(kosong(), (rekaman && rekaman.data) || {});
  d.butir = butirBebas(d.butir);
  return d;
}

/** Pindahkan satu berita acara tersimpan ke formulir yang sedang dibuka. */
async function bukaArsip(id) {
  const { rekaman, foto } = await ambilArsip(id);
  D = dataArsip(rekaman);
  FOTO = foto.map(url => ({ url, urlAi: url }));
  ARSIP_STATUS = 'Dibuka dari arsip, terakhir disimpan ' + waktuArsip(rekaman.diperbaruiAt)
               + ' oleh ' + (rekaman.penyusun || 'petugas lain') + '.';
  LANGKAH = 'periksa';
  GALAT = ''; KABAR = ''; SUDAH_UNDUH = false;
  /* Keadaan dokumen saat dibuka menjadi acuan: simpanan nanti hanya lewat
     bila server masih pada revisi ini. Lihat ARSIP_DASAR. */
  ARSIP_DASAR = dasarDari(rekaman);
  /* Yang sedang dikerjakan tidak boleh dilaporkan sebagai daerah kembar. */
  DARI_ARSIP = id; KEMBAR = null;
}

/* ── bentrokan simpan ───────────────────────────────────────────
   Muncul hanya bila dokumennya benar-benar sudah berpindah tangan. Tidak ada
   pilihan bawaan yang membuang pekerjaan siapa pun: yang paling aman —
   menyimpan sebagai salinan — ditaruh sebagai tombol utama, dan menimpa
   harus dipilih sendiri setelah membaca siapa yang menyimpan terakhir. */
function tanyaBentrok(e) {
  return new Promise(pilih => {
    const lama = el('#baBentrok');
    if (lama) lama.remove();
    const m = document.createElement('div');
    m.id = 'baBentrok';
    m.className = 'fixed inset-0 z-[95] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm';
    m.innerHTML = `
      <div class="glass w-full max-w-lg rounded-[2rem] p-6 md:p-8">
        <p class="text-[11px] uppercase tracking-[0.16em] text-amber-300">Berita acara ini sudah berubah</p>
        <p class="mt-2 text-[18px] font-semibold">${aman(D.daerah)}</p>
        <p class="mt-3 text-[14px] leading-[1.7] text-white/70">
          ${e.baru
            ? `Petugas lain sudah lebih dulu membuat berita acara untuk daerah dan tanggal ini.`
            : `Sejak Anda membukanya, berita acara ini disimpan ulang oleh <span class="font-semibold text-white">${aman(e.oleh)}</span>.`}
          ${e.waktu ? `Simpanan terakhirnya ${aman(e.waktu)}.` : ''}
          Menyimpan sekarang akan menghapus pekerjaan itu, dan tidak dapat dikembalikan.
        </p>
        <div class="mt-6 flex flex-col gap-2">
          <button data-pilih="salinan" class="cta-glow rounded-full bg-white px-5 py-3 text-[13px] font-medium text-black">
            Simpan sebagai salinan terpisah — kedua pekerjaan utuh
          </button>
          <button data-pilih="muat" class="rounded-full border border-white/20 px-5 py-3 text-[13px] font-medium text-white/85 transition hover:bg-white/10">
            Buka versi terbaru — isian saya di layar dibuang
          </button>
          <button data-pilih="timpa" class="rounded-full border border-red-400/50 bg-red-500/15 px-5 py-3 text-[13px] font-medium text-red-200 transition hover:bg-red-500/25">
            Timpa dengan isian saya
          </button>
          <button data-pilih="batal" class="rounded-full px-5 py-2.5 text-[13px] font-medium text-white/50 transition hover:text-white">
            Batal, jangan simpan dulu
          </button>
        </div>
      </div>`;
    document.body.appendChild(m);
    m.querySelectorAll('[data-pilih]').forEach(b => b.onclick = () => { m.remove(); pilih(b.dataset.pilih); });
    m.onclick = ev => { if (ev.target === m) { m.remove(); pilih('batal'); } };
  });
}

async function hapusArsip(id) {
  if (pakaiFirebase()) {
    const { doc, deleteDoc, collection, getDocs } = store.fs;
    const r = ARSIP.find(x => x.id === id) || {};
    const snap = await getDocs(collection(store.db, 'beritaAcara', id, 'foto'));
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    await deleteDoc(doc(store.db, 'beritaAcara', id));
    await hapusIndeks(id, r.kunciDaerah || kunciDaerah(r.daerah));
  } else {
    const semua = bacaLokal();
    delete semua[id];
    tulisLokal(semua);
  }
  ARSIP_DIMUAT = false;
}

/* ── pratinjau dokumen ──────────────────────────────────────────
   Pemda hanya boleh melihat, bukan mengubah. Berkas Word-nya tetap disusun
   seperti biasa lalu diubah menjadi HTML oleh mammoth, jadi yang terbaca di
   layar benar-benar isi dokumen yang sama, bukan tiruan yang dibuat ulang. */
function tutupPratinjau() {
  const m = el('#baPratinjau');
  if (m) m.remove();
  document.removeEventListener('keydown', tombolEscPratinjau);
}

function tombolEscPratinjau(e) {
  if (e.key === 'Escape') tutupPratinjau();
}

function bingkaiPratinjau(judul, isi) {
  tutupPratinjau();
  const m = document.createElement('div');
  m.id = 'baPratinjau';
  m.className = 'fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm md:p-8';
  m.innerHTML = `
    <div class="w-full max-w-[900px] overflow-hidden rounded-3xl border border-white/15 bg-ink shadow-2xl">
      <div class="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
        <div class="min-w-0">
          <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Pratinjau dokumen</p>
          <p class="truncate text-[15px] font-semibold text-white">${aman(judul)}</p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <button data-unduh-pratinjau disabled class="rounded-full border border-white/20 px-3.5 py-1.5 text-[12px] font-medium text-white/80 transition hover:bg-white/10 disabled:opacity-40">Unduh Word</button>
          <button data-tutup class="rounded-full border border-white/20 p-2 text-white/70 transition hover:bg-white/10 hover:text-white" title="Tutup (Esc)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="h-4 w-4"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
      </div>
      <div id="baPratinjauIsi" class="max-h-[76vh] overflow-y-auto bg-white/[0.04] p-4 md:p-6">${isi}</div>
    </div>`;
  document.body.appendChild(m);
  m.querySelector('[data-tutup]').onclick = tutupPratinjau;
  m.onclick = e => { if (e.target === m) tutupPratinjau(); };
  document.addEventListener('keydown', tombolEscPratinjau);
  return m;
}

const MEMUAT_PRATINJAU = `
  <div class="px-6 py-16 text-center">
    <div class="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
    <p class="mt-5 text-[14px] text-white/70">Menyusun dokumen…</p>
  </div>`;

/* Kertas putih dengan huruf hitam supaya terbaca seperti dokumen aslinya. */
const GAYA_KERTAS = `
  <style>
    #baKertas { background:#fff; color:#111; font-family:Cambria,Georgia,serif; font-size:13px; line-height:1.6;
                padding:36px 40px; border-radius:14px; }
    #baKertas h1,#baKertas h2,#baKertas h3 { font-weight:700; margin:14px 0 8px; }
    #baKertas h1 { font-size:17px; text-align:center; }
    #baKertas p { margin:0 0 8px; }
    #baKertas table { border-collapse:collapse; width:100%; margin:10px 0 16px; font-size:12px; }
    #baKertas td,#baKertas th { border:1px solid #999; padding:5px 7px; vertical-align:top; }
    #baKertas img { max-width:100%; height:auto; margin:6px 0; }
    #baKertas ol,#baKertas ul { margin:0 0 10px 22px; }
  </style>`;

async function pratinjauArsip(id, judul) {
  bingkaiPratinjau(judul, MEMUAT_PRATINJAU);
  try {
    const { rekaman, foto } = await ambilArsip(id);
    const d = dataArsip(rekaman);
    const blob = await susunBlob(d, foto.map(url => ({ url, urlAi: url })));
    await muatSkrip(CDN_MAMMOTH);
    const hasil = await window.mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
    const wadah = el('#baPratinjauIsi');
    if (wadah) wadah.innerHTML = GAYA_KERTAS + '<div id="baKertas">' + hasil.value + '</div>';
    /* Dokumennya sudah tersusun, jadi unduhannya tinggal memakai blob yang sama. */
    const unduh = el('#baPratinjau [data-unduh-pratinjau]');
    if (unduh) {
      unduh.disabled = false;
      unduh.onclick = () => toast('Berkas ' + unduhBlob(blob, namaBerkas(d)) + ' diunduh.');
    }
  } catch (e) {
    const wadah = el('#baPratinjauIsi');
    if (wadah) wadah.innerHTML = `<div class="px-6 py-14 text-center text-[13px] text-rose-200">Dokumen tidak dapat ditampilkan: ${aman(e.message)}</div>`;
  }
}

/** Unduh satu berita acara tersimpan tanpa menyentuh formulir yang terbuka —
    pemda memakainya untuk menyimpan dokumen daerahnya sendiri. */
async function unduhArsip(id) {
  const { rekaman, foto } = await ambilArsip(id);
  const d = dataArsip(rekaman);
  const blob = await susunBlob(d, foto.map(url => ({ url, urlAi: url })));
  return unduhBlob(blob, namaBerkas(d));
}

/** Simpan otomatis sesudah AI selesai membaca; kegagalannya tidak menghentikan
    pekerjaan, cukup dicatat supaya petugas tahu arsipnya belum tersimpan.

    Simpan otomatis tidak pernah menimpa dan tidak pernah menyela dengan
    kotak pertanyaan — petugas sedang menunggu hasil pembacaan AI, bukan
    sedang memutuskan apa pun. Bentrokannya cukup dilaporkan pada baris
    keterangan, lalu diselesaikan saat ia menekan simpan sendiri. */
async function simpanDiam() {
  try {
    await simpanArsip(true);
  } catch (e) {
    console.warn('[MonevDAK] arsip tidak tersimpan:', e);
    ARSIP_STATUS = e.code === 'bentrok'
      ? 'Belum tersimpan: berita acara ini sudah disimpan ulang oleh ' + e.oleh
        + (e.waktu ? ' ' + e.waktu : '') + '. Tekan Simpan ke arsip untuk memilih apa yang dilakukan.'
      : 'Belum tersimpan di arsip: ' + (e.code || e.message);
  }
}

/** Tindak lanjut bentrokan sesuai pilihan petugas. */
async function selesaikanBentrok(e) {
  const pilihan = await tanyaBentrok(e);

  if (pilihan === 'batal') {
    ARSIP_STATUS = 'Belum tersimpan — berita acara ini sudah berubah di arsip.';
    return;
  }

  if (pilihan === 'muat') {
    try {
      await bukaArsip(DARI_ARSIP || idArsip());
      toast('Versi terbaru dari arsip dibuka.');
    } catch (ex) {
      ARSIP_STATUS = 'Versi terbaru gagal dibuka: ' + (ex.code || ex.message);
    }
    return;
  }

  try {
    await simpanArsip(false, pilihan === 'timpa', pilihan === 'salinan');
    toast(pilihan === 'salinan'
      ? 'Tersimpan sebagai salinan terpisah; pekerjaan ' + e.oleh + ' tetap utuh.'
      : 'Berita acara ' + D.daerah + ' ditimpa dengan isian Anda.');
  } catch (ex) {
    ARSIP_STATUS = 'Gagal menyimpan: ' + (ex.code || ex.message);
  }
}


/* ═══════════════════════════════════════════════════════════════
   6. TAMPILAN
   ═══════════════════════════════════════════════════════════════ */
const KELAS_INPUT = 'w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-[13px] text-white outline-none transition placeholder:text-white/30 focus:border-white/40';
const KELAS_SEL   = KELAS_INPUT + ' [&>option]:bg-ink';
const KELAS_TOMBOL= 'rounded-full border border-white/20 px-4 py-2 text-[13px] font-medium text-white/80 transition hover:bg-white/10';
const KELAS_UTAMA = 'cta-glow rounded-full bg-white px-6 py-3 text-[14px] font-medium text-black transition disabled:opacity-40';

/* Penunjuk alur: tiap langkah punya lambang sendiri dan bisa diklik untuk
   melompat mundur atau maju, selama syarat langkahnya sudah terpenuhi. */
const IKON = {
  identitas: '<path d="M9 3h6a1 1 0 0 1 1 1v1H8V4a1 1 0 0 1 1-1z"/><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M9 11h6M9 15h4"/>',
  tempel:    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="m21 15-4.35-4.35a2 2 0 0 0-2.83 0L4 20"/>',
  baca:      '<path d="M12 3.5 13.7 8l4.5 1.7-4.5 1.7L12 16l-1.7-4.6L5.8 9.7 10.3 8 12 3.5z"/><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z"/>',
  periksa:   '<path d="M14 3v5h5"/><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z"/><path d="m9 14 2 2 4-4"/>'
};

const LANGKAH_JUDUL = [
  ['identitas', 'Identitas rapat'],
  ['tempel',    'Tempel screenshot'],
  ['baca',      'AI membaca'],
  ['periksa',   'Periksa & unduh']
];

const urutanLangkah = k => LANGKAH_JUDUL.findIndex(([x]) => x === k);

/** Sudah ada isian hasil bacaan AI atau arsip yang dibuka. */
const adaIsi = () => D.progres.length > 0 || D.emon.length > 0 || D.evaluasiPoin.length > 0;

/** Alasan sebuah langkah belum boleh dibuka; string kosong berarti boleh. */
function halanganLangkah(k) {
  if (LANGKAH === 'baca') return 'Tunggu sampai AI selesai membaca.';
  if (k === 'baca')       return 'Langkah ini berjalan sendiri saat AI membaca.';
  if (k === 'tempel'  && !D.daerah.trim()) return 'Isi daerahnya dulu di langkah 1.';
  if (k === 'periksa' && !adaIsi())        return 'Belum ada isian; baca screenshot dengan AI dulu.';
  return '';
}

function penunjukLangkah() {
  const kini = urutanLangkah(LANGKAH);
  return `
    <div class="mt-8 flex flex-wrap items-center gap-1.5">
      ${LANGKAH_JUDUL.map(([k, t], i) => {
        const aktif = k === LANGKAH;
        const lewat = i < kini;
        const halangan = halanganLangkah(k);
        const warnaBulat = aktif ? 'bg-white text-black'
                         : lewat ? 'bg-emerald-400/20 text-emerald-200 ring-1 ring-emerald-300/30'
                         : 'bg-white/10 text-white/50';
        const warnaTeks = aktif ? 'font-semibold text-white' : lewat ? 'text-white/70' : 'text-white/40';
        return `<div class="flex items-center gap-1.5">
          <button data-langkah="${k}"${halangan ? ` disabled title="${aman(halangan)}"` : ` title="Ke langkah ${i + 1}: ${aman(t)}"`}
                  class="group flex items-center gap-2 rounded-full px-2.5 py-1.5 transition ${halangan ? 'cursor-not-allowed opacity-45' : 'hover:bg-white/10'}">
            <span class="flex h-8 w-8 items-center justify-center rounded-full transition ${warnaBulat}">
              ${lewat
                ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="m5 13 4 4L19 7"/></svg>'
                : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="h-[18px] w-[18px]">${IKON[k]}</svg>`}
            </span>
            <span class="text-[13px] ${warnaTeks}">${t}</span>
          </button>
          ${i < 3 ? '<span class="text-white/20">›</span>' : ''}
        </div>`;
      }).join('')}
    </div>`;
}

function pasangPenunjuk() {
  els('#view-berita [data-langkah]').forEach(t => t.onclick = () => {
    const k = t.dataset.langkah;
    if (k === LANGKAH || halanganLangkah(k)) return;
    GALAT = ''; KABAR = ''; LANGKAH = k;
    render();
  });
}

function render() {
  const wadah = el('#view-berita');
  if (!wadah) return;
  if (jamPesan) { clearInterval(jamPesan); jamPesan = null; }
  if (!akunPfid(ME)) { wadah.innerHTML = ''; return; }

  wadah.innerHTML = `
    <p class="text-[12px] font-semibold uppercase tracking-[0.2em] text-white/50">Petugas PFID</p>
    <h1 class="mt-3 text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] md:text-[40px]">Berita acara eMonitoring</h1>
    <p class="mt-3 max-w-[640px] text-[15px] text-white/65">
      Notulensi rapat koordinasi pemantauan dan evaluasi DAK Fisik Sub Bidang Jalan TA 2026 Triwulan II.
      Tempel tangkapan layar paparan dan aplikasi eMonitoring, biarkan AI mengisi tabelnya, periksa, lalu unduh sebagai Word.
    </p>
    <p class="mt-2 text-[13px] text-white/45">Penyusun laporan: <span class="font-semibold text-white/80">${aman(ME.nama)}</span></p>

    ${penunjukLangkah()}

    ${GALAT ? `<div class="mt-6 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 py-4 text-[13px] leading-relaxed text-rose-200">${aman(GALAT)}</div>` : ''}
    ${KABAR ? `<div class="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-4 text-[13px] leading-relaxed text-emerald-200">${aman(KABAR)}</div>` : ''}

    <div id="baIsi" class="mt-7"></div>`;

  const isi = el('#baIsi');
  if (LANGKAH === 'identitas')    isi.innerHTML = viewIdentitas();
  else if (LANGKAH === 'tempel')  isi.innerHTML = viewTempel();
  else if (LANGKAH === 'baca')    isi.innerHTML = viewBaca();
  else                            isi.innerHTML = viewPeriksa();

  pasangPenunjuk();
  if (LANGKAH === 'identitas') pasangIdentitas();
  if (LANGKAH === 'tempel')    pasangTempel();
  if (LANGKAH === 'baca')      pasangBaca();
  if (LANGKAH === 'periksa')   pasangPeriksa();
}

/* ── langkah 1: identitas ───────────────────────────────────── */
function viewIdentitas() {
  /* Daftar wilayah tersusun menurut letak geografis; di pemilih yang isinya 38
     baris, urutan abjad jauh lebih cepat dicari mata. */
  const prov = Object.keys(window.WILAYAH).sort((a, b) => a.localeCompare(b, 'id'));
  return `
  <div class="glass rounded-3xl p-6 md:p-8">
    <h2 class="text-[17px] font-semibold">Informasi rapat</h2>
    <p class="mt-1 text-[13px] text-white/50">Bagian kuning dan ungu pada format notulensi.</p>

    <div class="mt-6 grid gap-5 md:grid-cols-2">
      <div>
        <label class="mb-1.5 block text-[12px] font-medium text-white/60">Hari / Tanggal</label>
        <input id="baTgl" type="date" value="${aman(D.tanggalIso)}" class="${KELAS_INPUT}" />
        <p id="baTglTeks" class="mt-1.5 text-[12px] text-amber-300/80">${aman(tanggalIndo(D.tanggalIso))}</p>
      </div>
      <div>
        <label class="mb-1.5 block text-[12px] font-medium text-white/60">Tempat</label>
        <input value="Online melalui Zoom Meeting" disabled class="${KELAS_INPUT} opacity-60" />
      </div>

      <div>
        <label class="mb-1.5 block text-[12px] font-medium text-white/60">Provinsi</label>
        <select id="baProv" class="${KELAS_SEL}">
          <option value="">— pilih provinsi —</option>
          ${prov.map(p => `<option${p === D._prov ? ' selected' : ''}>${aman(p)}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="mb-1.5 block text-[12px] font-medium text-white/60">Kabupaten / Kota</label>
        <select id="baKab" class="${KELAS_SEL}"><option value="">— pilih provinsi dulu —</option></select>
      </div>

      <div class="md:col-span-2">
        <label class="mb-1.5 block text-[12px] font-medium text-white/60">Daerah (yang tercetak di notulensi)</label>
        <input id="baDaerah" value="${aman(D.daerah)}" placeholder="mis. Kab Kep. Siau Tagulandang Biaro" class="${KELAS_INPUT}" />
        <div id="baKembar" class="mt-3 empty:mt-0">${kotakKembar()}</div>
      </div>

      <div class="md:col-span-2">
        <label class="mb-1.5 block text-[12px] font-medium text-white/60">Notulis</label>
        <select id="baPasangan" class="${KELAS_SEL}">
          ${PASANGAN_NOTULIS.map((p, i) =>
            `<option value="${i}"${i === D.pasangan ? ' selected' : ''}>1. ${aman(p[0])} · 2. ${aman(p[1])}</option>`).join('')}
        </select>
        <div class="mt-3 grid gap-3 sm:grid-cols-2">
          <input id="baNot1" value="${aman(D.notulis1)}" class="${KELAS_INPUT}" />
          <input id="baNot2" value="${aman(D.notulis2)}" class="${KELAS_INPUT}" />
        </div>
      </div>
    </div>

    <div class="mt-7 flex justify-end">
      <button id="baKeTempel" class="${KELAS_UTAMA}">Lanjut</button>
    </div>
  </div>`;
}

function pasangIdentitas() {
  const isiKab = () => {
    const p = el('#baProv').value;
    const daftar = p ? (window.WILAYAH[p] || '').split(',').filter(Boolean) : [];
    el('#baKab').innerHTML = '<option value="">— pilih —</option>' +
      daftar.map(k => `<option${k === D._kab ? ' selected' : ''}>${aman(k)}</option>`).join('');
  };
  isiKab();
  pasangKembar();
  if (D.daerah.trim()) segarkanKembar();

  el('#baTgl').oninput = e => {
    D.tanggalIso = e.target.value;
    el('#baTglTeks').textContent = tanggalIndo(D.tanggalIso);
  };
  el('#baProv').onchange = e => { D._prov = e.target.value; D._kab = ''; isiKab(); };
  el('#baKab').onchange = e => {
    D._kab = e.target.value;
    if (!D._kab) return;
    D.daerah = /^Kota\s/i.test(D._kab) ? D._kab : 'Kab ' + D._kab;
    el('#baDaerah').value = D.daerah;
    segarkanKembar();
  };
  el('#baDaerah').oninput = e => {
    D.daerah = e.target.value;
    /* Ditunda sebentar: memeriksa tiap huruf yang diketik hanya buang bacaan. */
    clearTimeout(jamKembar);
    jamKembar = setTimeout(segarkanKembar, 600);
  };
  el('#baPasangan').onchange = e => {
    D.pasangan = Number(e.target.value);
    D.notulis1 = PASANGAN_NOTULIS[D.pasangan][0];
    D.notulis2 = PASANGAN_NOTULIS[D.pasangan][1];
    el('#baNot1').value = D.notulis1;
    el('#baNot2').value = D.notulis2;
  };
  el('#baNot1').oninput = e => { D.notulis1 = e.target.value; };
  el('#baNot2').oninput = e => { D.notulis2 = e.target.value; };
  el('#baKeTempel').onclick = () => {
    if (!D.daerah.trim()) { GALAT = 'Daerah belum diisi.'; return render(); }
    GALAT = ''; KABAR = ''; LANGKAH = 'tempel'; render();
  };
}

/* ── langkah 2: tempel screenshot ───────────────────────────── */
function viewTempel() {
  const bersama = AI_DARI === 'bersama';
  return `
  <div class="glass rounded-3xl p-6 md:p-8">
    <div id="baKembar" class="mb-6 empty:mb-0">${kotakKembar()}</div>
    <h2 class="text-[17px] font-semibold">Tangkapan layar rapat</h2>
    <p class="mt-1 text-[13px] text-white/50">
      Tekan <span class="rounded bg-white/12 px-1.5 py-0.5 font-mono text-[12px]">Ctrl</span> +
      <span class="rounded bg-white/12 px-1.5 py-0.5 font-mono text-[12px]">V</span>, klik kotak di bawah, atau seret berkasnya.
      Maksimal ${MAKS_FOTO} gambar. Tiga gambar pertama ikut tercetak di halaman foto dokumentasi.
    </p>

    <div id="baDrop" class="mt-5 cursor-pointer rounded-3xl border-2 border-dashed border-white/20 bg-white/[0.03] px-6 py-10 text-center transition hover:border-white/40 hover:bg-white/[0.06]">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" class="mx-auto h-8 w-8 text-white/40"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-4.35-4.35a2 2 0 0 0-2.83 0L4 20"/></svg>
      <p class="mt-3 text-[14px] font-medium text-white/75">Ctrl+V · Klik · Seret ke sini</p>
      <p class="mt-1 text-[12px] text-white/40">Paparan pemda, tabel progres, dan tangkapan eMonitoring DAK</p>
    </div>
    <input id="baBerkas" type="file" accept="image/*" multiple class="hidden" />

    <div id="baGaleri" class="mt-4 flex flex-wrap gap-3">${galeri()}</div>

    <div class="mt-7 border-t border-white/10 pt-6">
      <h3 class="text-[14px] font-semibold">Penyedia AI</h3>
      <p class="mt-1 text-[12px] text-white/45">
        ${bersama
          ? 'Kunci ini tersimpan bersama — semua petugas yang namanya memuat “jalan” memakai kunci yang sama'
            + (AI_OLEH ? ', terakhir disimpan oleh ' + aman(AI_OLEH) : '') + '.'
          : 'Kunci belum tersimpan bersama. Simpan sekali supaya petugas PFID lain tidak perlu mengisinya lagi.'}
      </p>
      ${AI_GALAT ? `<p class="mt-2 text-[12px] text-amber-300/80">${aman(AI_GALAT)}</p>` : ''}

      <div class="mt-4 grid gap-2 sm:grid-cols-2">
        ${Object.entries(PENYEDIA).map(([k, p]) => {
          const on = k === AI.penyedia;
          const warna = p.biaya === 'GRATIS' ? 'text-emerald-300'
                      : p.biaya === 'ADA YANG GRATIS' ? 'text-sky-300' : 'text-white/45';
          return `<button data-penyedia="${k}" class="rounded-2xl border px-4 py-3 text-left transition ${on ? 'border-white/60 bg-white/[0.10]' : 'border-white/12 hover:border-white/30 hover:bg-white/[0.05]'}">
            <span class="flex items-center gap-2">
              <span class="text-[13px] font-semibold">${aman(p.label)}</span>
              <span class="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide ${warna}">${aman(p.biaya)}</span>
            </span>
            <span class="mt-1 block text-[11px] leading-relaxed text-white/45">${aman(p.petunjuk)}</span>
          </button>`;
        }).join('')}
      </div>

      ${PENYEDIA[AI.penyedia] && PENYEDIA[AI.penyedia].tautan ? `
      <p class="mt-3 text-[12px] text-white/55">
        <a href="${aman(PENYEDIA[AI.penyedia].tautan)}" target="_blank" rel="noopener"
           class="font-semibold underline decoration-white/30 underline-offset-4 hover:text-white">${aman(PENYEDIA[AI.penyedia].namaTautan)} ↗</a>
      </p>` : ''}

      <div class="mt-4 grid gap-3 md:grid-cols-3">
        <div>
          <label class="mb-1.5 block text-[12px] font-medium text-white/60">Base URL</label>
          <input id="baUrl" value="${aman(AI.baseUrl)}" class="${KELAS_INPUT}" />
        </div>
        <div>
          <label class="mb-1.5 block text-[12px] font-medium text-white/60">Model</label>
          <input id="baModel" value="${aman(AI.model)}" class="${KELAS_INPUT}" />
        </div>
        <div>
          <label class="mb-1.5 block text-[12px] font-medium text-white/60">API key</label>
          <input id="baKunci" type="password" value="${aman(AI.apiKey)}" placeholder="tempel kunci di sini" class="${KELAS_INPUT}" />
        </div>
      </div>

      ${MODEL.length ? `
      <div class="mt-3">
        <label class="mb-1.5 block text-[12px] font-medium text-white/60">
          ${MODEL.length} model bisa membaca gambar pada kunci ini${MODEL.some(m => m.gratis) ? ' — yang gratis ada di urutan atas' : ''}
        </label>
        <select id="baModelPilih" class="${KELAS_SEL}">
          <option value="">— pilih model —</option>
          ${MODEL.map(m => `<option value="${aman(m.id)}"${m.id === AI.model ? ' selected' : ''}>${m.gratis ? '★ gratis · ' : ''}${aman(m.id)}</option>`).join('')}
        </select>
      </div>` : ''}

      <div class="mt-3 flex flex-wrap gap-2">
        <button id="baSimpanKunci" class="${KELAS_TOMBOL}">Simpan untuk semua petugas</button>
        <button id="baMuatModel" class="${KELAS_TOMBOL}">Muat daftar model</button>
        <button id="baUji" class="${KELAS_TOMBOL}">Uji koneksi</button>
      </div>
    </div>

    <div class="mt-7 flex items-center justify-between gap-3">
      <button id="baKeIdentitas" class="${KELAS_TOMBOL}">Kembali</button>
      <button id="baAnalisa" class="${KELAS_UTAMA}"${FOTO.length ? '' : ' disabled'}>Baca ${FOTO.length} gambar dengan AI</button>
    </div>
  </div>`;
}

function galeri() {
  if (!FOTO.length) return '';
  return FOTO.map((f, i) => `
    <div class="relative h-24 w-32 overflow-hidden rounded-xl border border-white/15">
      <img src="${f.url}" alt="" class="h-full w-full object-cover" />
      ${i < 3 ? `<span class="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold">dokumentasi ${i + 1}</span>` : ''}
      <button data-hapus="${i}" class="absolute right-1 top-1 rounded bg-black/70 p-1 text-white/80 transition hover:bg-black hover:text-white">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" class="h-3 w-3"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>`).join('');
}

function segarkanGaleri() {
  const g = el('#baGaleri');
  if (g) g.innerHTML = galeri();
  const b = el('#baAnalisa');
  if (b) { b.disabled = !FOTO.length; b.textContent = `Baca ${FOTO.length} gambar dengan AI`; }
  els('[data-hapus]').forEach(t => t.onclick = ev => {
    ev.stopPropagation();
    FOTO.splice(Number(t.dataset.hapus), 1);
    segarkanGaleri();
  });
}

/** Versi ramping untuk dikirim ke AI. Tangkapan layar mentah bisa beberapa MB
    per gambar; delapan sekaligus mudah melampaui batas ukuran gateway. Yang
    tercetak di dokumen tetap gambar aslinya. */
async function kecilkanUntukAi(dataUrl) {
  const im = await muatGambar(dataUrl);
  const maks = 1600;
  const s = Math.min(1, maks / Math.max(im.width, im.height));
  const c = document.createElement('canvas');
  c.width = Math.round(im.width * s);
  c.height = Math.round(im.height * s);
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(im, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}

async function tambahBerkas(daftar) {
  const gambar = Array.from(daftar).filter(f => f.type.startsWith('image/'));
  for (const f of gambar) {
    if (FOTO.length >= MAKS_FOTO) break;
    const url = await bacaBerkas(f);
    FOTO.push({ berkas: f, url, urlAi: await kecilkanUntukAi(url) });
  }
  segarkanGaleri();
}

let pasangTerpasang = false;
function pasangTempel() {
  pasangKembar();
  const drop = el('#baDrop');
  drop.onclick = () => el('#baBerkas').click();
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('border-white/50'); };
  drop.ondragleave = () => drop.classList.remove('border-white/50');
  drop.ondrop = e => {
    e.preventDefault(); drop.classList.remove('border-white/50');
    tambahBerkas(e.dataTransfer.files);
  };
  el('#baBerkas').onchange = e => { tambahBerkas(e.target.files); e.target.value = ''; };
  segarkanGaleri();

  /* Ctrl+V dipasang sekali di dokumen, dan hanya bekerja saat langkah ini. */
  if (!pasangTerpasang) {
    pasangTerpasang = true;
    document.addEventListener('paste', e => {
      if (LANGKAH !== 'tempel') return;
      const berkas = Array.from(e.clipboardData ? e.clipboardData.items : [])
        .filter(x => x.type.startsWith('image/'))
        .map(x => x.getAsFile())
        .filter(Boolean);
      if (berkas.length) { e.preventDefault(); tambahBerkas(berkas); toast(berkas.length + ' gambar ditempel.'); }
    });
  }

  els('#baIsi [data-penyedia]').forEach(t => t.onclick = () => {
    const k = t.dataset.penyedia;
    if (k === AI.penyedia) return;
    const p = PENYEDIA[k];
    /* Base URL dan model ikut berganti ke bawaan penyedia itu; kuncinya
       dikosongkan karena kunci satu penyedia tidak berlaku di penyedia lain. */
    AI = { penyedia: k, baseUrl: p.baseUrl, model: p.model, apiKey: '' };
    MODEL = []; GALAT = ''; KABAR = '';
    render();
  });

  el('#baUrl').oninput   = e => { AI.baseUrl = e.target.value; };
  el('#baModel').oninput = e => { AI.model = e.target.value; };
  el('#baKunci').oninput = e => { AI.apiKey = e.target.value; };

  el('#baSimpanKunci').onclick = async () => {
    if (!bersihkanKunci(AI.apiKey)) return toast('Kunci API masih kosong.');
    try {
      const bersama = await simpanKonfigAi();
      toast(bersama ? 'Kunci tersimpan — petugas PFID lain langsung bisa memakainya.'
                    : 'Kunci tersimpan di perangkat ini.');
      render();
    } catch (e) {
      toast('Gagal menyimpan: ' + e.message);
    }
  };

  const pilih = el('#baModelPilih');
  if (pilih) pilih.onchange = e => {
    if (!e.target.value) return;
    AI.model = e.target.value;
    el('#baModel').value = AI.model;
  };

  el('#baMuatModel').onclick = async () => {
    const tombol = el('#baMuatModel');
    tombol.disabled = true; tombol.textContent = 'Memuat…';
    try {
      MODEL = await muatDaftarModel();
      const gratis = MODEL.filter(m => m.gratis).length;
      GALAT = '';
      KABAR = MODEL.length + ' model terbaca dari kunci ini'
            + (gratis ? ', ' + gratis + ' di antaranya gratis' : '')
            + '. Pilih salah satu di daftar bawah kolom Model.';
      if (!MODEL.length) { KABAR = ''; GALAT = 'Kunci ini tidak mencantumkan satu pun model yang bisa membaca gambar.'; }
    } catch (e) {
      MODEL = [];
      GALAT = 'Daftar model tidak terbaca: ' + e.message;
    }
    render();
  };

  el('#baUji').onclick = async () => {
    const tombol = el('#baUji');
    tombol.disabled = true; tombol.textContent = 'Menguji…';
    try {
      const balas = await ujiKoneksi();
      GALAT = ''; KABAR = 'Koneksi baik — ' + (PENYEDIA[AI.penyedia] || {}).label + ' model "' + AI.model
            + '" membalas: ' + (balas || '(kosong)')
            + '. Kalau pembacaan gambar tetap ditolak, model ini kemungkinan tidak mendukung gambar.';
    } catch (e) {
      KABAR = ''; GALAT = e.message;
    }
    render();
  };

  el('#baKeIdentitas').onclick = () => { GALAT = ''; KABAR = ''; LANGKAH = 'identitas'; render(); };
  el('#baAnalisa').onclick = async () => {
    GALAT = ''; KABAR = ''; LANGKAH = 'baca'; render();
    try {
      terapkanHasil(await bacaDenganAi());
      /* Langsung diarsipkan: bacaan AI berbayar, jangan sampai hilang hanya
         karena petugas berpindah daerah lalu ingin kembali ke yang tadi. */
      await simpanDiam();
      LANGKAH = 'periksa';
    } catch (e) {
      GALAT = e.message;
      LANGKAH = 'tempel';
    }
    render();
  };
}

/* ── langkah 3: menunggu AI ─────────────────────────────────── */
/* Menunggu AI itu membosankan dan kadang sampai satu menit. Tandem roller yang
   mondar-mandir memadatkan aspal membuat jedanya terasa ringan — sekalian
   gambar pekerjaan yang sedang dipantau — dan kalimat yang berganti-ganti
   memperlihatkan pekerjaan masih berjalan. */
const PESAN_BACA = [
  'Menyipitkan mata ke tabel progres…',
  'Menyalin nama ruas satu per satu…',
  'Menghitung rata-rata fisik dan keuangan…',
  'Mengintip kelengkapan eMonitoring…',
  'Mencocokkan lebar perkerasan dan bahu jalan…',
  'Menghitung koma pada angka rupiah…',
  'Merapikan tabel supaya tidak miring…',
  'Menyusun butir kesimpulan…'
];

let jamPesan = null;

function viewBaca() {
  return `
  <style>
    /* Satu putaran 6 detik: maju memadatkan, berhenti sebentar di ujung, lalu
       mundur. Roda dan getarannya mengikuti irama yang sama. */
    @keyframes baJalan   { 0% { transform: translateX(0) }  46%,54% { transform: translateX(112px) }  100% { transform: translateX(0) } }
    @keyframes baGuling  { 0% { transform: rotate(0deg) }   46%,54% { transform: rotate(900deg) }     100% { transform: rotate(0deg) } }
    @keyframes baGetar   { 0%,100% { transform: translateY(0) }   50% { transform: translateY(.8px) } }
    @keyframes baAsap    { 0% { opacity: 0; transform: translate(0,0) scale(.5) }
                           30% { opacity: .55 }
                           100% { opacity: 0; transform: translate(-7px,-24px) scale(1.35) } }
    @keyframes baPadat   { 0%,100% { opacity: .12 }  50% { opacity: .5 } }
    @keyframes baKilau   { 0%,100% { opacity: .15; transform: scale(.7) }  50% { opacity: 1; transform: scale(1) } }
    @keyframes baTitik   { 0%,80%,100% { opacity: .2; transform: translateY(0) }  40% { opacity: 1; transform: translateY(-4px) } }
    .ba-mesin  { animation: baJalan 6s ease-in-out infinite }
    .ba-getar  { animation: baGetar .14s linear infinite }
    .ba-guling { animation: baGuling 6s ease-in-out infinite }
    .ba-asap   { animation: baAsap 2.4s ease-out infinite }
    .ba-padat  { animation: baPadat 2.8s ease-in-out infinite }
    .ba-kilau  { animation: baKilau 2s ease-in-out infinite }
    .ba-titik  { animation: baTitik 1.4s ease-in-out infinite }
  </style>

  <div class="glass rounded-3xl px-6 py-14 text-center">
    <div class="mx-auto w-[240px] max-w-full">
      <svg viewBox="0 0 220 132" class="h-auto w-full" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <!-- badan jalan yang sedang dipadatkan -->
      <rect x="4" y="96" width="212" height="24" rx="7" fill="rgba(255,255,255,.07)" stroke="rgba(255,255,255,.14)" stroke-width="1.5"/>
      <g fill="rgba(255,255,255,.5)">
        <rect class="ba-padat" x="18" y="106" width="16" height="3" rx="1.5"/>
        <rect class="ba-padat" x="52" y="106" width="16" height="3" rx="1.5" style="animation-delay:.4s"/>
        <rect class="ba-padat" x="86" y="106" width="16" height="3" rx="1.5" style="animation-delay:.8s"/>
        <rect class="ba-padat" x="120" y="106" width="16" height="3" rx="1.5" style="animation-delay:1.2s"/>
        <rect class="ba-padat" x="154" y="106" width="16" height="3" rx="1.5" style="animation-delay:1.6s"/>
        <rect class="ba-padat" x="188" y="106" width="14" height="3" rx="1.5" style="animation-delay:2s"/>
      </g>

      <!-- tandem roller: dua drum baja, mondar-mandir mengaspal -->
      <g class="ba-mesin">
        <g class="ba-getar">
          <!-- rangka penghubung dan bak -->
          <rect x="27" y="72" width="40" height="14" rx="3" fill="rgba(253,230,138,.9)"/>
          <rect x="24" y="86" width="46" height="5" rx="2.5" fill="rgba(255,255,255,.25)"/>
          <!-- kabin operator -->
          <rect x="33" y="48" width="27" height="25" rx="6" fill="rgba(253,230,138,.95)"/>
          <rect x="37" y="52" width="19" height="13" rx="3" fill="rgba(125,211,252,.45)"/>
          <rect x="30" y="45" width="33" height="4" rx="2" fill="rgba(253,230,138,.7)"/>
          <!-- knalpot dan asapnya -->
          <rect x="63" y="50" width="4.5" height="13" rx="2" fill="rgba(255,255,255,.45)"/>
          <g fill="rgba(255,255,255,.55)">
            <circle class="ba-asap" cx="65" cy="46" r="3.4"/>
            <circle class="ba-asap" cx="65" cy="46" r="2.8" style="animation-delay:.8s"/>
            <circle class="ba-asap" cx="65" cy="46" r="3.1" style="animation-delay:1.6s"/>
          </g>
          <!-- drum belakang -->
          <circle cx="24" cy="96" r="12.5" fill="rgba(226,232,240,.92)"/>
          <circle cx="24" cy="96" r="12.5" fill="none" stroke="rgba(15,17,20,.35)" stroke-width="2"/>
          <g class="ba-guling" style="transform-origin:24px 96px" stroke="rgba(15,17,20,.35)" stroke-width="2">
            <path d="M24 85.5v21M13.5 96h21"/>
          </g>
          <!-- drum depan -->
          <circle cx="70" cy="96" r="12.5" fill="rgba(226,232,240,.92)"/>
          <circle cx="70" cy="96" r="12.5" fill="none" stroke="rgba(15,17,20,.35)" stroke-width="2"/>
          <g class="ba-guling" style="transform-origin:70px 96px" stroke="rgba(15,17,20,.35)" stroke-width="2">
            <path d="M70 85.5v21M59.5 96h21"/>
          </g>
        </g>
      </g>

      <!-- aspal yang sudah padat mengkilap -->
      <g stroke="none" fill="rgba(253,230,138,.9)">
        <path class="ba-kilau" d="M186 24l3.2 8.2 8.2 3.2-8.2 3.2L186 47l-3.2-8.4-8.2-3.2 8.2-3.2z"/>
        <path class="ba-kilau" style="animation-delay:.7s" d="M203 56l2.2 5.6 5.6 2.2-5.6 2.2-2.2 5.6-2.2-5.6-5.6-2.2 5.6-2.2z"/>
        <path class="ba-kilau" style="animation-delay:1.3s" d="M15 40l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>
      </g>
      </svg>
    </div>

    <p class="mt-7 text-[15px] font-medium">Membaca ${FOTO.length} tangkapan layar…</p>
    <p id="baPesanAi" class="mt-2 text-[13px] text-white/60 transition-opacity duration-300">${aman(PESAN_BACA[0])}</p>

    <div class="mt-4 flex items-center justify-center gap-1.5">
      <span class="ba-titik h-1.5 w-1.5 rounded-full bg-white/70"></span>
      <span class="ba-titik h-1.5 w-1.5 rounded-full bg-white/70" style="animation-delay:.18s"></span>
      <span class="ba-titik h-1.5 w-1.5 rounded-full bg-white/70" style="animation-delay:.36s"></span>
    </div>

    <p class="mt-5 text-[12px] text-white/35">${aman(AI.model)} · gambar besar bisa memakan waktu sampai satu menit</p>
  </div>`;
}

function pasangBaca() {
  let i = 0;
  jamPesan = setInterval(() => {
    const p = el('#baPesanAi');
    if (!p) return;
    i = (i + 1) % PESAN_BACA.length;
    p.style.opacity = '0';
    setTimeout(() => { p.textContent = PESAN_BACA[i]; p.style.opacity = '1'; }, 300);
  }, 2600);
}

/* ── langkah 4: periksa & unduh ─────────────────────────────── */
function kolomTeks(jalur, nilai, lebar) {
  return `<input data-jalur="${jalur}" value="${aman(nilai)}" class="w-full min-w-0 rounded-lg border border-white/12 bg-white/5 px-2 py-1.5 text-[12px] text-white outline-none focus:border-white/40"${lebar ? ` style="width:${lebar}"` : ''} />`;
}

function tabel(judul, kunciLarik, kolom, tombolTambah) {
  const baris = D[kunciLarik];
  return `
  <div class="glass rounded-3xl p-5 md:p-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h3 class="text-[15px] font-semibold">${judul}</h3>
      <button data-tambah="${kunciLarik}" class="${KELAS_TOMBOL} !px-3 !py-1.5 !text-[12px]">+ ${tombolTambah}</button>
    </div>
    <div class="mt-4 overflow-x-auto">
      <table class="w-full min-w-[720px] border-separate border-spacing-y-1.5 text-[12px]">
        <thead class="text-left text-white/45">
          <tr>${kolom.map(c => `<th class="px-1 pb-1 font-medium">${aman(c.judul)}</th>`).join('')}<th></th></tr>
        </thead>
        <tbody>
          ${baris.map((r, i) => `<tr>
            ${kolom.map(c => `<td class="px-1 align-top">${kolomTeks(`${kunciLarik}.${i}.${c.k}`, r[c.k])}</td>`).join('')}
            <td class="px-1 align-top">
              <button data-buang="${kunciLarik}.${i}" class="rounded-lg border border-white/12 px-2 py-1.5 text-white/45 transition hover:border-rose-400/40 hover:text-rose-300">✕</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
      ${baris.length ? '' : '<p class="px-1 py-3 text-[12px] text-white/35">Belum ada baris.</p>'}
    </div>
  </div>`;
}

function daftarTeks(judul, kunciLarik, petunjuk, tombolTambah) {
  return `
  <div class="glass rounded-3xl p-5 md:p-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="text-[15px] font-semibold">${judul}</h3>
        ${petunjuk ? `<p class="mt-0.5 text-[12px] text-white/45">${aman(petunjuk)}</p>` : ''}
      </div>
      <button data-tambah="${kunciLarik}" class="${KELAS_TOMBOL} !px-3 !py-1.5 !text-[12px]">+ ${tombolTambah}</button>
    </div>
    <div class="mt-4 space-y-2">
      ${D[kunciLarik].map((t, i) => `
        <div class="flex items-start gap-2">
          <span class="mt-2 w-4 shrink-0 text-[12px] text-white/35">${String.fromCharCode(97 + i)}.</span>
          ${kolomTeks(`${kunciLarik}.${i}`, t)}
          <button data-buang="${kunciLarik}.${i}" class="mt-0.5 rounded-lg border border-white/12 px-2 py-1.5 text-[12px] text-white/45 transition hover:border-rose-400/40 hover:text-rose-300">✕</button>
        </div>`).join('')}
      ${D[kunciLarik].length ? '' : '<p class="text-[12px] text-white/35">Belum ada butir.</p>'}
    </div>
  </div>`;
}

const KOLOM_PROGRES = [
  { k: 'namaRuas', judul: 'Nama Ruas' }, { k: 'input', judul: 'Input (sesuai RK)' },
  { k: 'output', judul: 'Rencana Output' }, { k: 'fisik', judul: 'Fisik (%)' },
  { k: 'keuangan', judul: 'Keuangan (%)' }, { k: 'nilaiKontrak', judul: 'Nilai Kontrak (Rp)' },
  { k: 'realisasiKontrak', judul: 'Realisasi Kontrak (Rp)' }
];
const KOLOM_EMON = [
  { k: 'namaRuas', judul: 'Nama Ruas' }, { k: 'dataKontrak', judul: 'Data Kontrak' },
  { k: 'dataProgres', judul: 'Data Progres' }, { k: 'dataTenagaKerja', judul: 'Data Tenaga Kerja' },
  { k: 'fotoKegiatan', judul: 'Foto Kegiatan' }
];
const KOLOM_TL = [
  { k: 'no', judul: 'No' }, { k: 'permasalahan', judul: 'Permasalahan' },
  { k: 'tindakLanjut', judul: 'Tindak Lanjut' }, { k: 'penanggungJawab', judul: 'Penanggung Jawab' },
  { k: 'targetWaktu', judul: 'Target Waktu' }
];
const KOLOM_KESIMPULAN = [
  { k: 'namaRuas', judul: 'Nama Ruas' }, { k: 'ruasDalamRk', judul: 'Ruas dalam RK' },
  { k: 'ded', judul: 'DED' }, { k: 'jenisPenanganan', judul: 'Jenis Penanganan' },
  { k: 'targetPenanganan', judul: 'Target Penanganan' }, { k: 'bahu', judul: 'Bahu' },
  { k: 'marka', judul: 'Marka' }
];

function viewInfoUmum() {
  return `
  <div class="glass rounded-3xl p-5 md:p-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="text-[15px] font-semibold">Informasi Umum Kegiatan DAK TA 2026</h3>
        <p class="mt-0.5 text-[12px] text-white/45">Bagian hijau — empat item pekerjaan untuk tiap ruas.</p>
      </div>
      <button data-tambah="infoUmum" class="${KELAS_TOMBOL} !px-3 !py-1.5 !text-[12px]">+ Ruas</button>
    </div>
    <div class="mt-4 space-y-5">
      ${D.infoUmum.map((r, i) => `
        <div class="rounded-2xl border border-white/10 p-4">
          <div class="flex items-center gap-2">
            ${kolomTeks(`infoUmum.${i}.namaRuas`, r.namaRuas)}
            <button data-buang="infoUmum.${i}" class="rounded-lg border border-white/12 px-2 py-1.5 text-[12px] text-white/45 transition hover:border-rose-400/40 hover:text-rose-300">✕</button>
          </div>
          <div class="mt-3 overflow-x-auto">
            <table class="w-full min-w-[640px] border-separate border-spacing-y-1.5 text-[12px]">
              <thead class="text-left text-white/45"><tr>
                <th class="px-1 pb-1 font-medium">Item Pekerjaan</th>
                <th class="px-1 pb-1 font-medium">Eksisting</th>
                <th class="px-1 pb-1 font-medium">Rencana</th>
                <th class="px-1 pb-1 font-medium">Realisasi</th>
                <th class="px-1 pb-1 font-medium">Keterangan</th>
              </tr></thead>
              <tbody>
                ${ITEM_UMUM.map(({ k, label }) => `<tr>
                  <td class="px-1 text-white/70">${aman(label)}</td>
                  <td class="px-1">${kolomTeks(`infoUmum.${i}.${k}Eksisting`, r[k + 'Eksisting'])}</td>
                  <td class="px-1">${kolomTeks(`infoUmum.${i}.${k}Rencana`, r[k + 'Rencana'])}</td>
                  <td class="px-1">${kolomTeks(`infoUmum.${i}.${k}Realisasi`, r[k + 'Realisasi'])}</td>
                  <td class="px-1">${kolomTeks(`infoUmum.${i}.${k}Keterangan`, r[k + 'Keterangan'])}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>`).join('')}
      ${D.infoUmum.length ? '' : '<p class="text-[12px] text-white/35">Belum ada ruas.</p>'}
    </div>
  </div>`;
}

/** Kosongkan formulir untuk daerah berikutnya. Tanggal dan pasangan notulis
    dibawa serta: rapat sehari biasanya membahas beberapa daerah berturut-turut
    dengan notulis yang sama, dan keduanya tetap bisa diubah di langkah
    identitas. Kunci AI dan daftar arsip tidak disentuh — petugasnya sama. */
function mulaiBaru() {
  const { tanggalIso, pasangan, notulis1, notulis2 } = D;
  D = Object.assign(kosong(), { tanggalIso, pasangan, notulis1, notulis2 });
  FOTO = [];
  LANGKAH = 'identitas';
  GALAT = ''; KABAR = ''; ARSIP_STATUS = ''; SUDAH_UNDUH = false;
  KEMBAR = null; DARI_ARSIP = ''; ARSIP_DASAR = null; clearTimeout(jamKembar);
}

function viewPeriksa() {
  return `
  <div class="space-y-5">
    <div class="glass rounded-3xl p-5 md:p-6">
      <div class="flex items-start justify-between gap-3">
        <h3 class="text-[15px] font-semibold">Ringkasan</h3>
        <!-- Sengaja ikon kecil dan pucat: menekannya menimpa seluruh isian dan
             memakai token AI lagi, jadi jangan sampai terpencet tanpa sengaja. -->
        <button id="baUlangAi" title="Baca ulang screenshot dengan AI — seluruh isian yang sudah diperbaiki akan ditimpa"
                class="shrink-0 rounded-full border border-white/12 p-2 text-white/35 transition hover:border-white/30 hover:bg-white/10 hover:text-white/80">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
            <path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 4v5h-5"/>
          </svg>
        </button>
      </div>
      <div class="mt-4 grid gap-4 md:grid-cols-3">
        <div><label class="mb-1.5 block text-[12px] text-white/55">Hari / Tanggal</label>
          <input value="${aman(tanggalIndo(D.tanggalIso))}" disabled class="${KELAS_INPUT} opacity-60" /></div>
        <div><label class="mb-1.5 block text-[12px] text-white/55">Daerah</label>
          ${kolomTeks('daerah', D.daerah)}</div>
        <div><label class="mb-1.5 block text-[12px] text-white/55">Notulis</label>
          <input value="1. ${aman(D.notulis1)} · 2. ${aman(D.notulis2)}" disabled class="${KELAS_INPUT} opacity-60" /></div>
      </div>
    </div>

    ${tabel('Progres kegiatan DAK Triwulan II', 'progres', KOLOM_PROGRES, 'Ruas')}
    ${tabel('Kelengkapan data dalam Aplikasi eMonitoring DAK', 'emon', KOLOM_EMON, 'Ruas')}
    ${viewInfoUmum()}
    ${daftarTeks('Catatan', 'catatan', 'Koreksi yang muncul di rapat.', 'Catatan')}

    <div class="glass rounded-3xl p-5 md:p-6">
      <h3 class="text-[15px] font-semibold">Evaluasi Pelaksanaan Kegiatan</h3>
      <div class="mt-4 grid gap-4 md:grid-cols-3">
        <div><label class="mb-1.5 block text-[12px] text-white/55">Progres fisik rata-rata (%)</label>
          ${kolomTeks('fisikRata', D.fisikRata)}</div>
        <div><label class="mb-1.5 block text-[12px] text-white/55">Progres keuangan (%)</label>
          ${kolomTeks('keuanganRata', D.keuanganRata)}</div>
        <div><label class="mb-1.5 block text-[12px] text-white/55">Permasalahan utama berasal dari</label>
          ${kolomTeks('permasalahanUtama', D.permasalahanUtama)}</div>
      </div>
    </div>

    ${daftarTeks('Butir evaluasi', 'evaluasiPoin', 'Contoh: “Terdapat 2 paket yang sesuai jadwal.”', 'Butir')}
    ${tabel('Tindak Lanjut', 'tindakLanjut', KOLOM_TL, 'Baris')}
    ${tabel('Kesimpulan — kesesuaian item', 'kesimpulan', KOLOM_KESIMPULAN, 'Ruas')}
    ${daftarTeks('Butir kesimpulan', 'butir', 'Dua butir tebal terakhir — kelengkapan eMonitoring dan konsultasi ke Balai Jalan dan PFID — sudah tetap di template.', 'Butir')}

    <div class="glass rounded-3xl p-5 md:p-6">
      <h3 class="text-[15px] font-semibold">Foto dokumentasi</h3>
      <p class="mt-1 text-[12px] text-white/45">
        ${FOTO.length ? `${Math.min(FOTO.length, 3)} gambar pertama akan dipasang di halaman dokumentasi.` : 'Belum ada gambar — halaman dokumentasi akan kosong.'}
      </p>
      <div class="mt-4 flex flex-wrap gap-3">
        ${FOTO.slice(0, 3).map((f, i) => `
          <div class="relative h-24 w-32 overflow-hidden rounded-xl border border-white/15">
            <img src="${f.url}" alt="" class="h-full w-full object-cover" />
            <span class="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold">${i + 1}</span>
          </div>`).join('')}
      </div>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3 pb-4">
      <div class="flex flex-wrap gap-3">
        <button id="baKeTempel2" class="${KELAS_TOMBOL}">Kembali ke screenshot</button>
        <!-- Sesudah Word-nya diunduh, tombol inilah langkah berikutnya:
             daerah ini selesai, giliran daerah lain. -->
        <button id="baMulaiBaru" class="${KELAS_TOMBOL}${SUDAH_UNDUH ? ' !border-white/45 !text-white' : ''}">Mulai daerah baru</button>
      </div>
      <div class="flex flex-wrap gap-3">
        <button id="baSimpanArsip" class="${KELAS_TOMBOL}">Simpan ke arsip</button>
        <button id="baUnduh" class="${KELAS_UTAMA}">Unduh Word</button>
      </div>
    </div>
    ${ARSIP_STATUS ? `<p class="pb-6 text-right text-[12px] text-white/45">${aman(ARSIP_STATUS)}</p>` : ''}
  </div>`;
}

/** Tulis nilai ke `D` mengikuti jalur "progres.0.fisik" atau "catatan.2". */
function setJalur(jalur, nilai) {
  const bagian = jalur.split('.');
  let node = D;
  for (let i = 0; i < bagian.length - 1; i++) node = node[bagian[i]];
  node[bagian[bagian.length - 1]] = nilai;
}

function pasangPeriksa() {
  els('#baIsi [data-jalur]').forEach(inp => {
    inp.oninput = () => setJalur(inp.dataset.jalur, inp.value);
  });

  els('#baIsi [data-tambah]').forEach(t => t.onclick = () => {
    const k = t.dataset.tambah;
    if (k === 'progres')      D.progres.push({ namaRuas: '', input: '', output: '', fisik: '', keuangan: '', nilaiKontrak: '', realisasiKontrak: '' });
    else if (k === 'emon')    D.emon.push({ namaRuas: '', dataKontrak: CENTANG, dataProgres: CENTANG, dataTenagaKerja: CENTANG, fotoKegiatan: CENTANG });
    else if (k === 'infoUmum')D.infoUmum.push(kosongUmum());
    else if (k === 'tindakLanjut') D.tindakLanjut.push({ no: String(D.tindakLanjut.length + 1), permasalahan: '', tindakLanjut: '', penanggungJawab: '', targetWaktu: '' });
    else if (k === 'kesimpulan') D.kesimpulan.push({ namaRuas: '', ruasDalamRk: CENTANG, ded: CENTANG, jenisPenanganan: CENTANG, targetPenanganan: CENTANG, bahu: CENTANG, marka: CENTANG });
    else D[k].push('');
    render();
  });

  els('#baIsi [data-buang]').forEach(t => t.onclick = () => {
    const [k, i] = t.dataset.buang.split('.');
    D[k].splice(Number(i), 1);
    render();
  });

  el('#baKeTempel2').onclick = () => { GALAT = ''; KABAR = ''; LANGKAH = 'tempel'; render(); };

  el('#baMulaiBaru').onclick = () => {
    /* Isian yang belum tersimpan tidak bisa dikembalikan, jadi pertanyaannya
       menyebutkan keadaan arsipnya supaya petugas tahu apa yang hilang. */
    const pesan = 'Mulai berita acara daerah baru?\n\nIsian ' + (D.daerah || 'daerah ini')
      + ' dan screenshot-nya dikosongkan dari layar.\n\n'
      + (DARI_ARSIP
          ? 'Salinannya sudah ada di arsip dan bisa dibuka lagi kapan saja.'
          : 'Berita acara ini BELUM tersimpan di arsip — simpan dulu bila masih diperlukan.');
    if (!confirm(pesan)) return;
    mulaiBaru();
    render();
    toast('Formulir dikosongkan. Isi daerah berikutnya.');
  };
  el('#baUlangAi').onclick = async () => {
    /* Pertanyaan ini sengaja ada: sekali diklik, koreksi yang sudah diketik
       hilang dan tokennya terpakai lagi. */
    if (!confirm('Baca ulang screenshot dengan AI?\n\nSeluruh isian yang sudah diperbaiki akan ditimpa hasil pembacaan baru, dan pembacaan ini memakai token AI.')) return;
    GALAT = ''; KABAR = ''; LANGKAH = 'baca'; render();
    try { terapkanHasil(await bacaDenganAi()); await simpanDiam(); LANGKAH = 'periksa'; }
    catch (e) { GALAT = e.message; LANGKAH = 'tempel'; }
    render();
  };

  el('#baSimpanArsip').onclick = async () => {
    const tombol = el('#baSimpanArsip');
    tombol.disabled = true; tombol.textContent = 'Menyimpan…';
    try {
      await simpanArsip(false);
      toast('Berita acara ' + D.daerah + ' tersimpan di arsip.');
    } catch (e) {
      if (e.code === 'bentrok') await selesaikanBentrok(e);
      else ARSIP_STATUS = 'Gagal menyimpan: ' + (e.code || e.message);
    }
    render();
  };

  el('#baUnduh').onclick = async () => {
    const tombol = el('#baUnduh');
    tombol.disabled = true; tombol.textContent = 'Menyusun dokumen…';
    try {
      toast('Berkas ' + (await buatWord()) + ' diunduh.');
      /* Yang tersimpan di arsip selalu sama dengan yang barusan diunduh. */
      await simpanDiam();
    } catch (e) {
      GALAT = 'Gagal membuat dokumen: ' + e.message;
      render();
      return;
    }
    /* Daerah ini selesai; tombol "Mulai daerah baru" ditegaskan sebagai
       langkah berikutnya. */
    SUDAH_UNDUH = true;
    render();
  };
}


/* ═══════════════════════════════════════════════════════════════
   6b. MENU ARSIP — daftar berita acara seluruh petugas
   ═══════════════════════════════════════════════════════════════ */
function kartuArsip(r, pfid, semua) {
  const foto = r.jumlahFoto || 0;
  return `
  <div class="glass rounded-3xl p-5 md:p-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <h3 class="text-[16px] font-semibold">${aman(r.daerah)}</h3>
        <p class="mt-1 text-[13px] text-white/55">${aman(r.tanggalTeks || tanggalIndo(r.tanggalIso))}${semua && provArsip(r) ? ' · ' + aman(provArsip(r)) : ''}</p>
        <p class="mt-2 text-[12px] text-white/40">
          ${r.jumlahRuas || 0} ruas · ${foto} foto · notulis ${aman(r.notulis1 || '—')} &amp; ${aman(r.notulis2 || '—')}
        </p>
        <p class="mt-1 text-[12px] text-white/35">
          Disusun ${aman(r.penyusun || '—')}${r.diperbaruiAt ? ' · diperbarui ' + aman(waktuArsip(r.diperbaruiAt)) : ''}
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        ${ARSIP_ADMIN ? `<button data-peta="${aman(r.kunciDaerah || kunciDaerah(r.daerah || r.kab || ''))}" title="Tunjukkan daerah ini di peta" class="${KELAS_TOMBOL} !px-3 !py-1.5 !text-[12px]">Di peta</button>` : ''}
        <button data-pratinjau="${aman(r.id)}" class="${KELAS_TOMBOL} !px-3 !py-1.5 !text-[12px]">Lihat dokumen</button>
        <button data-unduh="${aman(r.id)}" class="${KELAS_TOMBOL} !px-3 !py-1.5 !text-[12px]">Unduh Word</button>
        ${pfid ? `
        <button data-buka="${aman(r.id)}" class="${KELAS_TOMBOL} !px-3 !py-1.5 !text-[12px]">Buka &amp; edit</button>
        <button data-hapus-arsip="${aman(r.id)}" class="rounded-full border border-white/12 px-3 py-1.5 text-[12px] text-white/45 transition hover:border-rose-400/40 hover:text-rose-300">Hapus</button>` : ''}
      </div>
    </div>
  </div>`;
}

const IKON_SARING = '<path d="M3 5h18l-7 8v6l-4 2v-8L3 5z"/>';
const IKON_PENYUSUN = '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/><path d="M4 21a8 8 0 0 1 16 0"/>';

/** Satu saringan arsip berbentuk pil, sebaris dengan kotak pencarian.
    Tidak ditampilkan bila arsipnya kosong — pilihannya pun tidak ada. */
function kotakSaring(id, ikon, labelSemua, labelKosong, opsi, terpilih) {
  if (!opsi.length) return '';
  return `
      <div class="glass flex items-center gap-2 rounded-full px-5 py-2.5">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 shrink-0 text-white/50">${ikon}</svg>
        <select id="${id}" class="max-w-[190px] bg-transparent text-[13px] leading-[19.5px] text-white outline-none [&>option]:bg-ink">
          <option value="">${labelSemua} (${opsi.reduce((n, o) => n + o.jumlah, 0)})</option>
          ${opsi.map(o => `<option value="${aman(o.nilai)}"${terpilih === o.nilai ? ' selected' : ''}>${aman(o.nilai === TANPA_ISI ? labelKosong : o.nilai)} (${o.jumlah})</option>`).join('')}
        </select>
      </div>`;
}

/* ── kartu provinsi (panel admin) ───────────────────────────────
   Admin melihat berita acara seluruh Indonesia sekaligus, jadi daftar
   datarnya cepat menjadi ratusan baris. Isinya dikelompokkan per provinsi:
   yang tampil mula-mula hanya kartu provinsi, daftar pemda-nya keluar setelah
   kartunya dibuka. Warna tiap provinsi berbeda supaya kartunya terbedakan
   sekilas tanpa harus membaca namanya. */
const WARNA_PROV = [
  '56 189 248',   // langit
  '52 211 153',   // zamrud
  '251 191 36',   // kuning
  '167 139 250',  // ungu
  '251 113 133',  // mawar
  '45 212 191',   // toska
  '232 121 249',  // magenta
  '250 146 60',   // jingga
  '129 140 248',  // nila
  '163 230 53',   // hijau muda
  '244 114 182',  // merah muda
  '96 165 250'    // biru
];
const WARNA_TANPA_PROV = '148 163 184';   // abu, selalu untuk yang tanpa provinsi

/** Warna tiap provinsi diambil dari urutan abjad seluruh isi arsip — bukan dari
    hasil saringan — supaya sebuah provinsi tidak berganti warna hanya karena
    kotak pencarian diketik. */
function petaWarnaProv(rekaman) {
  const peta = { [TANPA_ISI]: WARNA_TANPA_PROV };
  Array.from(new Set(rekaman.map(r => provArsip(r)).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'id'))
    .forEach((prov, i) => { peta[prov] = WARNA_PROV[i % WARNA_PROV.length]; });
  return peta;
}

/** Kelompokkan berita acara per provinsi, urut abjad, tanpa provinsi di bawah. */
function grupProvinsi(daftar) {
  const grup = {};
  daftar.forEach(r => {
    const k = provArsip(r) || TANPA_ISI;
    (grup[k] = grup[k] || []).push(r);
  });
  return Object.keys(grup)
    .sort((a, b) => (a === TANPA_ISI) - (b === TANPA_ISI) || a.localeCompare(b, 'id'))
    .map(k => ({ prov: k, rekaman: grup[k] }));
}

const IKON_PANAH = '<path d="m9 6 6 6-6 6"/>';

function kartuProvinsi(prov, rekaman, warna, terbuka, pfid) {
  const pemda = new Set(rekaman.map(r => r.kunciDaerah || kunciDaerah(r.daerah || r.kab || ''))).size;
  const nama = prov === TANPA_ISI ? 'Tanpa provinsi' : prov;
  return `
  <div class="overflow-hidden rounded-3xl border" style="--prov:${warna}; border-color:rgb(var(--prov)/.28); background:linear-gradient(180deg, rgb(var(--prov)/.10), rgb(var(--prov)/.03));">
    <button data-prov="${aman(prov)}" aria-expanded="${terbuka}" class="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-white/[.06] md:px-6 md:py-5">
      <span class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl" style="background:rgb(var(--prov)/.16); color:rgb(var(--prov));">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
             class="h-[18px] w-[18px] transition-transform duration-200" style="transform:rotate(${terbuka ? 90 : 0}deg)">${IKON_PANAH}</svg>
      </span>
      <span class="min-w-0 flex-1">
        <span class="block truncate text-[16px] font-semibold" style="color:rgb(var(--prov));">${aman(nama)}</span>
        <span class="mt-0.5 block text-[12px] text-white/50">${pemda} pemda · ${rekaman.length} berita acara</span>
      </span>
      <span class="shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold" style="background:rgb(var(--prov)/.14); color:rgb(var(--prov));">${rekaman.length}</span>
    </button>
    ${terbuka ? `<div class="space-y-3 border-t px-4 pb-5 pt-4 md:px-5" style="border-color:rgb(var(--prov)/.18);">
      ${rekaman.map(r => kartuArsip(r, pfid, false)).join('')}
    </div>` : ''}
  </div>`;
}

function renderArsip() {
  /* Satu penyaji untuk dua tempat: menu arsip di aplikasi, dan tab berita acara
     di panel admin. Keduanya tidak pernah tampil bersamaan — admin memakai
     cangkangnya sendiri — jadi keadaannya boleh dipakai bersama. */
  const admin = ARSIP_ADMIN;
  const wadah = el(admin ? '#adBa' : '#view-arsip');
  if (!wadah) return;
  if (!admin && !ME) { wadah.innerHTML = ''; return; }

  /* Petugas PFID menyusun dan mengubah; pemda hanya membaca dokumen daerahnya;
     admin melihat semuanya, tetapi hanya untuk dibaca dan diunduh. */
  const pfid = !admin && akunPfid(ME);
  const semua = admin || pfid;          // yang melihat lebih dari satu daerah
  const cari = ARSIP_CARI.trim().toLowerCase();

  /* Saringan provinsi dan penyusun tidak berguna bagi pemda: isinya cuma
     daerahnya sendiri. Pilihannya disusun dari isi arsip, bukan dari 38
     provinsi atau daftar petugas, supaya yang tampil hanya yang benar-benar
     punya berita acara. */
  if (!semua) { ARSIP_PROV = ''; ARSIP_OLEH = ''; }
  const adaNilai = (nilai, pilihan) =>
    !pilihan || ARSIP.some(r => (nilai(r) || TANPA_ISI) === pilihan);
  if (!adaNilai(provArsip, ARSIP_PROV)) ARSIP_PROV = '';
  if (!adaNilai(penyusunArsip, ARSIP_OLEH)) ARSIP_OLEH = '';

  const cocokCari = r => !cari ||
    (r.daerah + ' ' + penyusunArsip(r) + ' ' + (r.tanggalTeks || '') + ' ' + provArsip(r))
      .toLowerCase().includes(cari);
  const cocok = (nilai, pilihan) => r => !pilihan || (nilai(r) || TANPA_ISI) === pilihan;
  const cocokProv = cocok(provArsip, ARSIP_PROV);
  const cocokOleh = cocok(penyusunArsip, ARSIP_OLEH);

  /* Tiap saringan menghitung pilihannya dari berita acara yang lolos saringan
     lain, jadi angka di dalam kurung memang jumlah yang akan tampil. */
  const opsiProv = pilihanSaring(ARSIP.filter(r => cocokCari(r) && cocokOleh(r)), provArsip, ARSIP_PROV);
  const opsiOleh = pilihanSaring(ARSIP.filter(r => cocokCari(r) && cocokProv(r)), penyusunArsip, ARSIP_OLEH);

  const daftar = ARSIP.filter(r => cocokCari(r) && cocokProv(r) && cocokOleh(r));

  /* Panel admin memuat berita acara seluruh Indonesia, jadi daftarnya
     dikelompokkan menjadi kartu provinsi yang isinya keluar saat dibuka.
     Begitu ada pencarian atau saringan, kelompoknya dibuka sendiri — yang
     dicari orang adalah barisnya, bukan nama provinsinya. */
  const grup      = admin ? grupProvinsi(daftar) : [];
  const warnaProv = admin ? petaWarnaProv(ARSIP) : {};
  const paksaBuka = !!cari || !!ARSIP_PROV || !!ARSIP_OLEH || grup.length === 1;
  const bukaProv  = g => paksaBuka || !!ARSIP_BUKA[g.prov];
  const adaTertutup = grup.some(g => !bukaProv(g));

  /* Dipakai pada pesan "tidak ada yang cocok" supaya sebabnya kelihatan. */
  const saringanTerpakai = [
    ARSIP_PROV && (ARSIP_PROV === TANPA_ISI ? 'tanpa provinsi' : ARSIP_PROV),
    ARSIP_OLEH && (ARSIP_OLEH === TANPA_ISI ? 'tanpa nama penyusun' : 'susunan ' + ARSIP_OLEH)
  ].filter(Boolean);

  wadah.innerHTML = `
    ${admin ? `
    <p class="mt-7 max-w-[720px] text-[14px] leading-[1.7] text-white/60">
      Seluruh notulensi rapat pemantauan dan evaluasi yang sudah disusun petugas PFID, ${ARSIP.length} berita acara.
      Dokumennya dapat dibaca di layar dan diunduh dalam bentuk Word; penyuntingan tetap di tangan petugas penyusunnya.
    </p>` : `
    <p class="text-[12px] font-semibold uppercase tracking-[0.2em] text-white/50">${pfid ? 'Petugas PFID' : 'Pemerintah daerah'}</p>
    <h1 class="mt-3 text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] md:text-[40px]">Arsip berita acara</h1>
    <p class="mt-3 max-w-[640px] text-[15px] text-white/65">
      ${pfid
        ? 'Setiap berita acara yang selesai dibaca AI tersimpan di sini dan terlihat oleh semua petugas. Membukanya kembali tidak memanggil AI lagi, jadi tidak ada token yang terpakai untuk perbaikan.'
        : 'Notulensi rapat pemantauan dan evaluasi DAK Fisik Sub Bidang Jalan untuk ' + aman(ME.kab) + '. Dokumennya dapat dibaca dan diunduh dalam bentuk Word di sini; perubahan isi dilakukan oleh petugas PFID.'}
    </p>`}

    <div class="mt-8 flex flex-wrap items-center gap-3">
      <div class="glass flex items-center gap-2 rounded-full px-5 py-2.5">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" class="h-4 w-4 text-white/50"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input id="baArsipCari" value="${aman(ARSIP_CARI)}" placeholder="Cari daerah, tanggal, atau penyusun" class="w-56 bg-transparent text-[13px] outline-none placeholder:text-white/40" />
      </div>
      ${semua ? kotakSaring('baArsipProv', IKON_SARING, 'Semua provinsi', 'Tanpa provinsi', opsiProv, ARSIP_PROV) : ''}
      ${semua ? kotakSaring('baArsipOleh', IKON_PENYUSUN, 'Semua penyusun', 'Tanpa nama', opsiOleh, ARSIP_OLEH) : ''}
      ${admin && grup.length > 1 && !paksaBuka ? `<button id="baArsipSemuaProv" class="glass rounded-full px-5 py-2.5 text-[13px] font-medium text-white/80 transition hover:bg-white/10">${adaTertutup ? 'Buka semua provinsi' : 'Tutup semua provinsi'}</button>` : ''}
      <button id="baArsipMuat" class="glass rounded-full px-5 py-2.5 text-[13px] font-medium text-white/80 transition hover:bg-white/10">Muat ulang</button>
      ${semua ? `<button id="baArsipImpor" title="Masukkan notulensi Word yang sudah disusun manual — boleh banyak berkas, boleh satu folder sekaligus" class="glass rounded-full px-5 py-2.5 text-[13px] font-medium text-white/80 transition hover:bg-white/10">Impor dokumen Word</button>` : ''}
      ${semua ? `<button id="baArsipRekap" title="Rangkum seluruh berita acara menjadi satu lembar Excel berformat rekapitulasi rakor" class="glass rounded-full px-5 py-2.5 text-[13px] font-medium text-white/80 transition hover:bg-white/10">Rekap Excel</button>` : ''}
      ${pfid ? `<button id="baArsipBaru" class="glass rounded-full px-5 py-2.5 text-[13px] font-medium text-white/80 transition hover:bg-white/10">Buat berita acara baru</button>
      <button id="baArsipIndeks" title="Susun ulang daftar yang dilihat pemda, termasuk berita acara lama" class="glass rounded-full px-5 py-2.5 text-[13px] font-medium text-white/80 transition hover:bg-white/10">Perbarui daftar pemda</button>` : ''}
    </div>

    ${ARSIP_GALAT ? `<div class="mt-6 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 py-4 text-[13px] text-rose-200">${aman(ARSIP_GALAT)}</div>` : ''}

    <div class="mt-7 space-y-4">
      ${daftar.length ? (admin
        ? grup.map(g => kartuProvinsi(g.prov, g.rekaman, warnaProv[g.prov] || WARNA_TANPA_PROV, bukaProv(g), pfid)).join('')
        : daftar.map(r => kartuArsip(r, pfid, semua)).join('')) : `
        <div class="glass rounded-3xl px-6 py-14 text-center">
          <p class="text-[15px] font-medium text-white/75">${ARSIP.length
            ? (saringanTerpakai.length
                ? 'Tidak ada berita acara ' + aman(saringanTerpakai.join(' · ')) + ' yang cocok.'
                : 'Tidak ada yang cocok dengan pencarian itu.')
            : semua ? 'Arsip masih kosong.' : 'Belum ada berita acara untuk ' + aman(ME.kab) + '.'}</p>
          <p class="mt-2 text-[13px] text-white/45">${ARSIP.length ? (saringanTerpakai.length ? 'Kembalikan saringannya ke “Semua”, atau coba kata kunci lain.' : 'Coba kata kunci lain.')
            : semua ? 'Berita acara tersimpan sendiri begitu AI selesai membaca screenshot.'
                   : 'Dokumennya muncul di sini setelah petugas PFID menyusun notulensi rapat daerah Anda.'}</p>
        </div>`}
    </div>`;

  el('#baArsipCari').oninput = e => {
    ARSIP_CARI = e.target.value;
    const posisi = e.target.selectionStart;
    renderArsip();
    const baru = el('#baArsipCari');
    baru.focus();
    baru.setSelectionRange(posisi, posisi);
  };

  if (el('#baArsipProv')) el('#baArsipProv').onchange = e => {
    ARSIP_PROV = e.target.value;
    renderArsip();
  };

  if (el('#baArsipOleh')) el('#baArsipOleh').onchange = e => {
    ARSIP_OLEH = e.target.value;
    renderArsip();
  };

  if (el('#baArsipSemuaProv')) el('#baArsipSemuaProv').onclick = () => {
    ARSIP_BUKA = {};
    if (adaTertutup) grup.forEach(g => { ARSIP_BUKA[g.prov] = true; });
    renderArsip();
  };

  el('#baArsipMuat').onclick = async () => {
    ARSIP_DIMUAT = false;
    await tampilkanArsip();
    if (ARSIP_ADMIN) tampilkanPeta();
  };

  if (el('#baArsipImpor')) el('#baArsipImpor').onclick = bukaImporWord;

  if (el('#baArsipRekap')) el('#baArsipRekap').onclick = bukaRekapExcel;

  if (el('#baArsipBaru')) el('#baArsipBaru').onclick = () => {
    window.BA.reset();
    go('berita');
  };

  if (el('#baArsipIndeks')) el('#baArsipIndeks').onclick = async () => {
    const t = el('#baArsipIndeks');
    t.disabled = true; t.textContent = 'Menyusun…';
    try {
      const n = await perbaikiIndeks();
      toast(n + ' berita acara masuk daftar pemda.');
    } catch (e) {
      ARSIP_GALAT = 'Daftar pemda gagal disusun: ' + (e.code || e.message);
    }
    renderArsip();
  };

  /* Tombol dicari di dalam wadahnya sendiri, sebab penyaji ini dipakai juga
     oleh panel admin yang wadahnya berbeda. */
  const dalam = s => Array.from(wadah.querySelectorAll(s));

  /* Kartu provinsi dibuka/ditutup di tempat; gulirannya tidak dipindahkan
     supaya kartu yang barusan diklik tetap di bawah kursor. */
  dalam('[data-prov]').forEach(t => t.onclick = () => {
    const k = t.dataset.prov;
    if (ARSIP_BUKA[k]) delete ARSIP_BUKA[k];
    else ARSIP_BUKA[k] = true;
    renderArsip();
  });

  dalam('[data-peta]').forEach(t => t.onclick = () => {
    if (!window.PETA_DAK || !window.PETA_DAK.buka(t.dataset.peta)) {
      toast('Daerah ini tidak ada pada daftar penerima DAK, jadi belum ada di peta.');
    }
  });

  dalam('[data-pratinjau]').forEach(t => t.onclick = () => {
    const r = ARSIP.find(x => x.id === t.dataset.pratinjau) || {};
    pratinjauArsip(t.dataset.pratinjau, (r.daerah || '') + ' · ' + (r.tanggalTeks || ''));
  });

  dalam('[data-buka]').forEach(t => t.onclick = async () => {
    t.disabled = true; t.textContent = 'Membuka…';
    try {
      await bukaArsip(t.dataset.buka);
      go('berita');
      toast('Berita acara ' + D.daerah + ' dibuka. Perbaiki lalu unduh ulang.');
    } catch (e) {
      ARSIP_GALAT = e.message;
      renderArsip();
    }
  });

  /* Unduhan tidak memindahkan isinya ke formulir: pemda tidak punya formulir,
     dan petugas PFID tidak kehilangan berita acara yang sedang dikerjakan. */
  dalam('[data-unduh]').forEach(t => t.onclick = async () => {
    t.disabled = true; t.textContent = 'Menyusun…';
    try {
      toast('Berkas ' + (await unduhArsip(t.dataset.unduh)) + ' diunduh.');
      renderArsip();
    } catch (e) {
      ARSIP_GALAT = 'Gagal membuat dokumen: ' + (e.code || e.message);
      renderArsip();
    }
  });

  dalam('[data-hapus-arsip]').forEach(t => t.onclick = async () => {
    const id = t.dataset.hapusArsip;
    const r = ARSIP.find(x => x.id === id) || {};
    if (!confirm('Hapus berita acara ' + (r.daerah || id) + ' dari arsip? Semua petugas akan kehilangan salinan ini.')) return;
    t.disabled = true; t.textContent = 'Menghapus…';
    try {
      await hapusArsip(id);
      await tampilkanArsip();
      toast('Berita acara dihapus dari arsip.');
    } catch (e) {
      ARSIP_GALAT = 'Gagal menghapus: ' + (e.code || e.message);
      renderArsip();
    }
  });
}


/** Peta sebaran progres di atas daftar berita acara panel admin.
    Hanya admin yang melihatnya: petanya menyatukan seluruh pemda di Indonesia,
    sedangkan pemda hanya berhak atas daerahnya sendiri. Petanya digambar
    terpisah dari daftar supaya perbesaran dan daerah yang sedang dibuka tidak
    hilang tiap kali kotak pencarian diketik. */
function tampilkanPeta() {
  const wadah = el('#adBaPeta');
  if (!wadah || !window.PETA_DAK) return;
  window.PETA_DAK.render(wadah, {
    rekaman: ARSIP,
    kunciDari: r => r.kunciDaerah || kunciDaerah(r.daerah || r.kab || ''),
    aksi: {
      lihat: id => {
        const r = ARSIP.find(x => x.id === id) || {};
        pratinjauArsip(id, (r.daerah || '') + ' · ' + (r.tanggalTeks || ''));
      },
      unduh: async id => {
        try { toast('Berkas ' + (await unduhArsip(id)) + ' diunduh.'); }
        catch (e) { toast('Gagal membuat dokumen: ' + (e.code || e.message)); }
      }
    }
  });
}


/** Muat arsipnya bila belum, lalu tampilkan — dipakai menu arsip maupun panel
    admin, keduanya lewat penyaji dan keadaan yang sama. */
async function tampilkanArsip() {
  if (!ARSIP_DIMUAT) {
    renderArsip();          // tampilkan kerangkanya dulu supaya tidak kosong
    try {
      await muatArsip();
    } catch (e) {
      console.warn('[MonevDAK] arsip gagal dibaca:', e);
      ARSIP = [];
      ARSIP_DIMUAT = true;
      ARSIP_GALAT = (ARSIP_ADMIN || akunPfid(ME))
        ? 'Arsip tidak terbaca (' + (e.code || e.message)
          + '). Aturan Firestore untuk koleksi beritaAcara belum terpasang di Firebase Console.'
        : 'Arsip tidak terbaca (' + (e.code || e.message)
          + '). Dua sebab yang mungkin: aturan Firestore terbaru belum dipasang, atau profil Anda belum memuat kunci daerah — keluar lalu masuk lagi untuk melengkapinya.';
    }
  }
  renderArsip();
}


/* ═══════════════════════════════════════════════════════════════
   7. TITIK MASUK — dipanggil dari index.html
   ═══════════════════════════════════════════════════════════════ */
window.BA = {
  akunPfid,

  /** Menu penyusunan hanya untuk petugas PFID; arsip terbuka juga bagi pemda,
      isinya dibatasi ke daerah masing-masing. Menunya ada dua tempat —
      deretan atas dan deretan bawah untuk ponsel — jadi keduanya diatur. */
  syncNav() {
    els('[data-nav="berita"]').forEach(b => b.classList.toggle('hidden', !akunPfid(ME)));
    els('[data-nav="arsip"]').forEach(a => a.classList.toggle('hidden', !ME));
  },

  /** Dipanggil router saat berpindah ke tampilan berita acara. */
  async render() {
    if (!akunPfid(ME)) return;
    await muatKonfigAi();
    render();
  },

  /** Dipanggil router saat berpindah ke menu arsip.
      Isinya selalu diambil ulang: berita acara daerah bisa diperbaiki atau
      diimpor petugas kapan saja, dan pemda yang membuka menunya harus melihat
      versi terbaru tanpa perlu menekan "Muat ulang" atau menyegarkan halaman. */
  async renderArsip() {
    if (!ME) return;
    /* Kembali dari panel admin: isinya harus diambil ulang dengan izin akun
       yang sedang masuk, bukan sisa bacaan admin. */
    if (ARSIP_ADMIN) ARSIP_ADMIN = false;
    ARSIP_DIMUAT = false;
    await tampilkanArsip();
  },

  /** Tab "Berita Acara" pada panel admin: seluruh berita acara, baca dan unduh,
      dengan peta sebaran progres di atasnya. */
  async renderAdmin(paksa) {
    if (!ARSIP_ADMIN) { ARSIP_ADMIN = true; ARSIP_DIMUAT = false; }
    if (paksa) ARSIP_DIMUAT = false;
    await tampilkanArsip();
    tampilkanPeta();
  },

  /** Berapa berita acara yang sudah termuat — untuk angka kecil di tab admin. */
  jumlahArsip: () => (ARSIP_ADMIN && ARSIP_DIMUAT ? ARSIP.length : null),

  /** Formulir dikosongkan saat berganti akun; kunci bersama diambil lagi
      supaya akun berikutnya tidak memakai sisa kunci akun sebelumnya. */
  reset() {
    D = kosong(); FOTO = []; LANGKAH = 'identitas'; GALAT = ''; KABAR = '';
    konfigDicoba = false; AI_GALAT = ''; ARSIP_STATUS = ''; SUDAH_UNDUH = false;
    ARSIP = []; ARSIP_DIMUAT = false; ARSIP_GALAT = ''; ARSIP_ADMIN = false;
    ARSIP_CARI = ''; ARSIP_PROV = ''; ARSIP_OLEH = ''; ARSIP_BUKA = {};
    if (el('#adBaPeta')) el('#adBaPeta').innerHTML = '';
    KEMBAR = null; DARI_ARSIP = ''; ARSIP_DASAR = null; clearTimeout(jamKembar);
  }
};

})();
