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

/* Pasangan notulis yang boleh dipilih (bagian ungu pada format). */
const PASANGAN_NOTULIS = [
  ['Frandi Sahabat',   'Dyah Nurnaningtyas'],
  ['Brigitta Yolanda', 'Roby Hidayat'],
  ['Akram',            'Yusuf'],
  ['Sinta',            'Yusrel']
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

async function muatKonfigAi() {
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
      if (x.apiKey) { AI = { ...AI, ...rapikanKonfig(x) }; AI_DARI = 'bersama'; }
    }
  } catch (e) {
    console.warn('[MonevDAK] konfigurasi AI bersama belum terbaca:', e);
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

function dataTemplate() {
  const tgl = tanggalIndo(D.tanggalIso);
  return {
    hariTanggal: tgl,
    daerah: D.daerah,
    notulis1: D.notulis1,
    notulis2: D.notulis2,
    progres: D.progres,
    emon: D.emon,
    infoUmum: D.infoUmum,
    catatan: D.catatan,
    fisikRata: D.fisikRata,
    keuanganRata: D.keuanganRata,
    evaluasiPoin: D.evaluasiPoin,
    permasalahanUtama: D.permasalahanUtama,
    tindakLanjut: D.tindakLanjut,
    kesimpulan: D.kesimpulan,
    butir: D.butir.filter(Boolean),
    adaFoto1: FOTO.length > 0,
    adaFoto2: FOTO.length > 1,
    adaFoto3: FOTO.length > 2
  };
}

async function buatWord() {
  await Promise.all([muatSkrip(CDN_PIZZIP), muatSkrip(CDN_DOCXTPL)]);

  const res = await fetch(TEMPLATE_URL);
  if (!res.ok) throw new Error('Template berita acara tidak ditemukan (' + res.status + ').');
  const bahan = await res.arrayBuffer();

  const zip = new window.PizZip(bahan);
  const doc = new window.docxtemplater(zip, {
    paragraphLoop: true, linebreaks: true, nullGetter: () => ''
  });
  doc.render(dataTemplate());

  /* Slot foto dokumentasi diisi dengan menukar byte gambar bawaan template —
     cara ini tidak butuh modul gambar docxtemplater yang berbayar. */
  const keluar = doc.getZip();
  for (let i = 0; i < SLOT_FOTO.length; i++) {
    if (!FOTO[i]) continue;
    const bit = await bingkaiFoto(FOTO[i].url, SLOT_FOTO[i].rasio);
    keluar.file(SLOT_FOTO[i].berkas, bit, { binary: true });
  }

  const blob = keluar.generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE'
  });

  const daerah = (D.daerah || 'Daerah').replace(/[\\/:*?"<>|]/g, '').trim();
  const nama = `Notulensi Rakor PE DAK Jalan TA 2026 TW II - ${daerah}.docx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nama;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return nama;
}


/* ═══════════════════════════════════════════════════════════════
   6. TAMPILAN
   ═══════════════════════════════════════════════════════════════ */
const KELAS_INPUT = 'w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-[13px] text-white outline-none transition placeholder:text-white/30 focus:border-white/40';
const KELAS_SEL   = KELAS_INPUT + ' [&>option]:bg-ink';
const KELAS_TOMBOL= 'rounded-full border border-white/20 px-4 py-2 text-[13px] font-medium text-white/80 transition hover:bg-white/10';
const KELAS_UTAMA = 'cta-glow rounded-full bg-white px-6 py-3 text-[14px] font-medium text-black transition disabled:opacity-40';

const LANGKAH_JUDUL = [
  ['identitas', 'Identitas rapat'],
  ['tempel',    'Tempel screenshot'],
  ['baca',      'AI membaca'],
  ['periksa',   'Periksa & unduh']
];

function render() {
  const wadah = el('#view-berita');
  if (!wadah) return;
  if (!akunPfid(ME)) { wadah.innerHTML = ''; return; }

  wadah.innerHTML = `
    <p class="text-[12px] font-semibold uppercase tracking-[0.2em] text-white/50">Petugas PFID</p>
    <h1 class="mt-3 text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] md:text-[40px]">Berita acara eMonitoring</h1>
    <p class="mt-3 max-w-[640px] text-[15px] text-white/65">
      Notulensi rapat koordinasi pemantauan dan evaluasi DAK Fisik Sub Bidang Jalan TA 2026 Triwulan II.
      Tempel tangkapan layar paparan dan aplikasi eMonitoring, biarkan AI mengisi tabelnya, periksa, lalu unduh sebagai Word.
    </p>
    <p class="mt-2 text-[13px] text-white/45">Penyusun laporan: <span class="font-semibold text-white/80">${aman(ME.nama)}</span></p>

    <div class="mt-8 flex flex-wrap items-center gap-2">
      ${LANGKAH_JUDUL.map(([k, t], i) => {
        const aktif = k === LANGKAH;
        return `<div class="flex items-center gap-2">
          <span class="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${aktif ? 'bg-white text-black' : 'bg-white/12 text-white/55'}">${i + 1}</span>
          <span class="text-[13px] ${aktif ? 'font-semibold text-white' : 'text-white/45'}">${t}</span>
          ${i < 3 ? '<span class="mx-1 text-white/20">›</span>' : ''}
        </div>`;
      }).join('')}
    </div>

    ${GALAT ? `<div class="mt-6 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 py-4 text-[13px] leading-relaxed text-rose-200">${aman(GALAT)}</div>` : ''}
    ${KABAR ? `<div class="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-4 text-[13px] leading-relaxed text-emerald-200">${aman(KABAR)}</div>` : ''}

    <div id="baIsi" class="mt-7"></div>`;

  const isi = el('#baIsi');
  if (LANGKAH === 'identitas')    isi.innerHTML = viewIdentitas();
  else if (LANGKAH === 'tempel')  isi.innerHTML = viewTempel();
  else if (LANGKAH === 'baca')    isi.innerHTML = viewBaca();
  else                            isi.innerHTML = viewPeriksa();

  if (LANGKAH === 'identitas') pasangIdentitas();
  if (LANGKAH === 'tempel')    pasangTempel();
  if (LANGKAH === 'periksa')   pasangPeriksa();
}

/* ── langkah 1: identitas ───────────────────────────────────── */
function viewIdentitas() {
  const prov = Object.keys(window.WILAYAH);
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
  };
  el('#baDaerah').oninput = e => { D.daerah = e.target.value; };
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
          ? 'Kunci ini tersimpan bersama — semua petugas PFID memakai kunci yang sama.'
          : 'Kunci belum tersimpan bersama. Simpan sekali supaya petugas PFID lain tidak perlu mengisinya lagi.'}
      </p>

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
      LANGKAH = 'periksa';
    } catch (e) {
      GALAT = e.message;
      LANGKAH = 'tempel';
    }
    render();
  };
}

/* ── langkah 3: menunggu AI ─────────────────────────────────── */
function viewBaca() {
  return `
  <div class="glass rounded-3xl px-6 py-16 text-center">
    <div class="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
    <p class="mt-6 text-[15px] font-medium">Membaca ${FOTO.length} tangkapan layar…</p>
    <p class="mt-2 text-[13px] text-white/50">${aman(AI.model)} sedang menyalin angka progres, kelengkapan eMonitoring, dan informasi umum kegiatan.</p>
    <p class="mt-1 text-[12px] text-white/35">Gambar besar bisa memakan waktu sampai satu menit.</p>
  </div>`;
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

function viewPeriksa() {
  return `
  <div class="space-y-5">
    <div class="glass rounded-3xl p-5 md:p-6">
      <h3 class="text-[15px] font-semibold">Ringkasan</h3>
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
    ${daftarTeks('Butir kesimpulan', 'butir', 'Butir tebal terakhir soal kelengkapan eMonitoring sudah tetap di template.', 'Butir')}

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
      <button id="baKeTempel2" class="${KELAS_TOMBOL}">Kembali ke screenshot</button>
      <div class="flex flex-wrap gap-3">
        <button id="baUlangAi" class="${KELAS_TOMBOL}">Baca ulang dengan AI</button>
        <button id="baUnduh" class="${KELAS_UTAMA}">Unduh Word</button>
      </div>
    </div>
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
  el('#baUlangAi').onclick = async () => {
    GALAT = ''; KABAR = ''; LANGKAH = 'baca'; render();
    try { terapkanHasil(await bacaDenganAi()); LANGKAH = 'periksa'; }
    catch (e) { GALAT = e.message; LANGKAH = 'tempel'; }
    render();
  };
  el('#baUnduh').onclick = async () => {
    const tombol = el('#baUnduh');
    tombol.disabled = true; tombol.textContent = 'Menyusun dokumen…';
    try {
      toast('Berkas ' + (await buatWord()) + ' diunduh.');
    } catch (e) {
      GALAT = 'Gagal membuat dokumen: ' + e.message;
      render();
      return;
    }
    tombol.disabled = false; tombol.textContent = 'Unduh Word';
  };
}


/* ═══════════════════════════════════════════════════════════════
   7. TITIK MASUK — dipanggil dari index.html
   ═══════════════════════════════════════════════════════════════ */
window.BA = {
  akunPfid,

  /** Tampilkan tombol menu hanya untuk akun PFID. */
  syncNav() {
    const b = el('[data-nav="berita"]');
    if (b) b.classList.toggle('hidden', !akunPfid(ME));
  },

  /** Dipanggil router saat berpindah ke tampilan berita acara. */
  async render() {
    if (!akunPfid(ME)) return;
    if (!AI.apiKey) await muatKonfigAi();
    render();
  },

  /** Formulir dikosongkan saat berganti akun. */
  reset() {
    D = kosong(); FOTO = []; LANGKAH = 'identitas'; GALAT = ''; KABAR = '';
  }
};

})();
