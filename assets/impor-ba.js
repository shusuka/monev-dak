/* ═══════════════════════════════════════════════════════════════════════
   IMPOR BERITA ACARA DARI DOKUMEN WORD

   Sebelum aplikasi ini ada, notulensi rapat disusun manual di Word memakai
   format yang sama persis dengan assets/ba-template.docx. Ratusan dokumen itu
   sudah terlanjur jadi, dan mengetik ulang isinya ke aplikasi tidak masuk
   akal. Berkas ini membacanya kembali: tabel dokumen dibaca langsung — tanpa
   AI, tanpa biaya token — lalu diubah menjadi rekaman arsip yang bentuknya
   sama dengan hasil pembacaan screenshot.

   Yang dibaca (nama tabel dikenali dari baris judulnya, bukan dari urutannya,
   supaya dokumen yang bagiannya tidak lengkap tetap terbaca):
     Informasi Rapat        → daerah, tanggal, notulis
     Progres kegiatan       → ruas, input, output, fisik, keuangan, kontrak
     Kelengkapan eMonitoring→ ceklis per ruas
     Informasi Umum         → lebar/jenis perkerasan dan bahu per ruas
     Tindak Lanjut          → bila bagian itu ada di dokumennya
     Kesimpulan             → kesesuaian item per ruas
     Tim penyusun           → nama kedua notulis
   Ditambah paragraf: catatan, progres rata-rata, permasalahan utama, dan
   butir kesimpulan.

   Penyimpanannya bukan urusan berkas ini — assets/berita-acara.js yang
   menyediakannya lewat opsi `simpan`.
   ═══════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const el  = s => document.querySelector(s);
const aman = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const CDN_PIZZIP = 'https://unpkg.com/pizzip@3.2.0/dist/pizzip.min.js';
const BULAN = ['januari', 'februari', 'maret', 'april', 'mei', 'juni',
               'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];

let dimuat = null;
function muatPizzip() {
  if (window.PizZip) return Promise.resolve();
  if (dimuat) return dimuat;
  dimuat = new Promise((selesai, gagal) => {
    const s = document.createElement('script');
    s.src = CDN_PIZZIP;
    s.onload = selesai;
    s.onerror = () => { dimuat = null; gagal(new Error('PizZip tidak termuat')); };
    document.head.appendChild(s);
  });
  return dimuat;
}


/* ═══════════════════════════════════════════════════════════════
   1. MEMBACA XML DOKUMEN
   ═══════════════════════════════════════════════════════════════ */
/** Teks satu elemen Word. Tiap <w:p> di dalamnya jadi baris sendiri supaya
    isi sel bertingkat — "1. Andini" / "2. Rizky" — tidak menyatu. */
function teksElemen(node) {
  const paragraf = node.getElementsByTagName('w:p');
  if (paragraf.length && node.nodeName !== 'w:p') {
    return Array.from(paragraf).map(p => teksElemen(p)).join('\n').trim();
  }
  let out = '';
  const jalan = n => {
    for (const anak of Array.from(n.childNodes)) {
      if (anak.nodeName === 'w:t') out += anak.textContent;
      else if (anak.nodeName === 'w:tab') out += ' ';
      else if (anak.nodeName === 'w:br') out += '\n';
      else if (anak.childNodes && anak.childNodes.length) jalan(anak);
    }
  };
  jalan(node);
  return out.trim();
}

const anakLangsung = (node, nama) =>
  Array.from(node.childNodes).filter(n => n.nodeName === nama);

function barisTabel(tbl) {
  return anakLangsung(tbl, 'w:tr').map(tr =>
    anakLangsung(tr, 'w:tc').map(tc => teksElemen(tc).replace(/\s*\n\s*/g, '\n').trim()));
}

/** Dokumen dipecah jadi urutan paragraf dan tabel, sesuai urutan aslinya. */
function bacaBlok(xmlTeks) {
  const dok = new DOMParser().parseFromString(xmlTeks, 'application/xml');
  if (dok.getElementsByTagName('parsererror').length) throw new Error('isi dokumen tidak terbaca');
  const body = dok.getElementsByTagName('w:body')[0];
  if (!body) throw new Error('dokumen Word tanpa isi');

  const blok = [];
  for (const anak of Array.from(body.childNodes)) {
    if (anak.nodeName === 'w:p') {
      const t = teksElemen(anak);
      if (t) blok.push({ jenis: 'p', teks: t });
    } else if (anak.nodeName === 'w:tbl') {
      blok.push({ jenis: 'tbl', baris: barisTabel(anak) });
    }
  }
  return blok;
}


/* ═══════════════════════════════════════════════════════════════
   2. MENGENALI BAGIAN DOKUMEN
   ═══════════════════════════════════════════════════════════════ */
const kecil = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Cari tabel dari kata-kata pada baris judulnya, bukan dari urutannya. */
function cariTabel(blok, kata) {
  return blok.find(b => {
    if (b.jenis !== 'tbl' || !b.baris.length) return false;
    const judul = kecil(b.baris.slice(0, 2).map(r => r.join(' ')).join(' '));
    return kata.every(k => judul.includes(k));
  });
}

/** Baris isi sebuah tabel: semua baris sesudah baris judul terakhir.
    Tabel di dokumen ini berjudul satu atau dua baris, tergantung bagiannya. */
function barisIsi(tabel, kataJudul) {
  if (!tabel) return [];
  let mulai = 0;
  tabel.baris.forEach((r, i) => {
    const t = kecil(r.join(' '));
    if (kataJudul.some(k => t.includes(k))) mulai = i + 1;
  });
  return tabel.baris.slice(mulai).filter(r => r.some(s => s !== ''));
}

const ITEM_UMUM = [
  [/lebar perkerasan/, 'lp'],
  [/jenis perkerasan/, 'jp'],
  [/lebar bahu/,       'lb'],
  [/jenis bahu/,       'jb']
];

function kosongUmum() {
  const o = { namaRuas: '' };
  ITEM_UMUM.forEach(([, k]) => {
    o[k + 'Eksisting'] = ''; o[k + 'Rencana'] = ''; o[k + 'Realisasi'] = ''; o[k + 'Keterangan'] = '';
  });
  return o;
}

/** "Selasa/ 11 Agustus 2026" → "2026-08-11". */
function tanggalDari(teks) {
  const m = /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/.exec(String(teks || ''));
  if (!m) return '';
  const bulan = BULAN.indexOf(kecil(m[2]));
  if (bulan < 0) return '';
  return `${m[3]}-${String(bulan + 1).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`;
}

/** Paragraf di antara dua penanda; penandanya sendiri tidak ikut. */
function paragrafAntara(blok, dari, sampai) {
  const p = blok.filter(b => b.jenis === 'p').map(b => b.teks);
  let mulai = p.findIndex(t => dari.test(t));
  if (mulai < 0) return [];
  let akhir = p.findIndex((t, i) => i > mulai && sampai.test(t));
  if (akhir < 0) akhir = p.length;
  return p.slice(mulai + 1, akhir).filter(Boolean);
}

function susunData(blok) {
  const D = {
    tanggalIso: '', daerah: '', notulis1: '', notulis2: '',
    progres: [], emon: [], infoUmum: [], catatan: [],
    fisikRata: '', keuanganRata: '', evaluasiPoin: [], permasalahanUtama: '',
    tindakLanjut: [], kesimpulan: [], butir: []
  };

  /* ── informasi rapat ── */
  const info = cariTabel(blok, ['hari/tanggal']);
  if (info) {
    info.baris.forEach(r => {
      const label = kecil(r[0]);
      const isi = (r[2] != null ? r[2] : r[r.length - 1]) || '';
      if (label.startsWith('hari')) D.tanggalIso = tanggalDari(isi);
      if (label.startsWith('daerah')) D.daerah = isi.replace(/\s+/g, ' ').trim();
      if (label.startsWith('notulis')) {
        const nama = isi.split('\n').map(x => x.replace(/^\s*\d+\s*[.)]\s*/, '').trim()).filter(Boolean);
        D.notulis1 = nama[0] || ''; D.notulis2 = nama[1] || '';
      }
    });
  }

  /* Nama notulis di tabel tanda tangan lebih bersih daripada yang bernomor. */
  const ttd = cariTabel(blok, ['notulis 1']);
  if (ttd) {
    const isi = ttd.baris.slice(1).find(r => r.some(s => s));
    if (isi) { D.notulis1 = isi[0] || D.notulis1; D.notulis2 = isi[1] || D.notulis2; }
  }

  /* ── progres kegiatan ── */
  barisIsi(cariTabel(blok, ['nama ruas', 'nilai kontrak']), ['nama ruas', 'input'])
    .forEach(r => {
      if (!r[0]) return;
      D.progres.push({
        namaRuas: r[0] || '', input: r[1] || '', output: r[2] || '',
        fisik: r[3] || '', keuangan: r[4] || '',
        nilaiKontrak: r[5] || '', realisasiKontrak: r[6] || ''
      });
    });

  /* ── kelengkapan eMonitoring ── */
  barisIsi(cariTabel(blok, ['data kontrak']), ['nama ruas'])
    .forEach(r => {
      if (!r[0]) return;
      D.emon.push({
        namaRuas: r[0] || '', dataKontrak: r[1] || '', dataProgres: r[2] || '',
        dataTenagaKerja: r[3] || '', fotoKegiatan: r[4] || ''
      });
    });

  /* ── informasi umum: empat baris per ruas, nama ruas hanya di baris pertama ── */
  let umum = null;
  barisIsi(cariTabel(blok, ['item pekerjaan']), ['item pekerjaan'])
    .forEach(r => {
      if (r[0]) { umum = kosongUmum(); umum.namaRuas = r[0]; D.infoUmum.push(umum); }
      if (!umum) { umum = kosongUmum(); D.infoUmum.push(umum); }
      const cocok = ITEM_UMUM.find(([pola]) => pola.test(kecil(r[1])));
      if (!cocok) return;
      const k = cocok[1];
      umum[k + 'Eksisting'] = r[2] || ''; umum[k + 'Rencana'] = r[3] || '';
      umum[k + 'Realisasi'] = r[4] || ''; umum[k + 'Keterangan'] = r[5] || '';
    });

  /* ── kesimpulan per ruas ── */
  barisIsi(cariTabel(blok, ['kesesuaian item']), ['nama ruas', 'ruas dalam rk'])
    .forEach(r => {
      if (!r[0]) return;
      D.kesimpulan.push({
        namaRuas: r[0] || '', ruasDalamRk: r[1] || '', ded: r[2] || '',
        jenisPenanganan: r[3] || '', targetPenanganan: r[4] || '',
        bahu: r[5] || '', marka: r[6] || ''
      });
    });

  /* ── tindak lanjut, hanya ada bila dokumennya memuat bagian itu ── */
  barisIsi(cariTabel(blok, ['permasalahan', 'tindak lanjut']), ['permasalahan'])
    .forEach((r, i) => {
      if (!r[1] && !r[2]) return;
      D.tindakLanjut.push({
        no: r[0] || String(i + 1), permasalahan: r[1] || '', tindakLanjut: r[2] || '',
        penanggungJawab: r[3] || '', targetWaktu: r[4] || ''
      });
    });

  /* ── paragraf ── */
  const teksSemua = blok.filter(b => b.jenis === 'p').map(b => b.teks);
  const ambil = pola => {
    const t = teksSemua.find(x => pola.test(x));
    return t ? (pola.exec(t)[1] || '').trim() : '';
  };
  D.fisikRata = ambil(/progres fisik rata-rata mencapai\s*([^%]*)%/i);
  D.keuanganRata = ambil(/progres keuangan mencapai\s*([^%]*)%/i);
  D.permasalahanUtama = ambil(/permasalahan utama berasal dari\s*:?\s*(.*)$/i);

  D.catatan = paragrafAntara(blok, /^catatan\s*:?\s*$/i, /^evaluasi pelaksanaan/i);
  D.evaluasiPoin = paragrafAntara(blok, /progres keuangan mencapai/i, /permasalahan utama berasal dari/i);
  D.butir = paragrafAntara(blok, /^kesimpulan$/i, /^tim penyusun/i);

  return D;
}


/* ═══════════════════════════════════════════════════════════════
   3. FOTO DOKUMENTASI
   Gambar kop surat tidak boleh ikut terbawa, jadi yang diambil hanya
   gambar yang dirujuk sesudah judul halaman dokumentasi.
   ═══════════════════════════════════════════════════════════════ */
function fotoDari(zip, xmlTeks) {
  const potong = xmlTeks.search(/FOTO\s*<\/w:t>|FOTO DOKUMENTASI|DOKUMENTASI/i);
  const bagian = potong > -1 ? xmlTeks.slice(potong) : xmlTeks;

  const rels = zip.file('word/_rels/document.xml.rels');
  if (!rels) return [];
  const petaRel = {};
  for (const m of rels.asText().matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) petaRel[m[1]] = m[2];

  const hasil = [];
  const terpakai = new Set();
  for (const m of bagian.matchAll(/r:embed="([^"]+)"/g)) {
    const target = petaRel[m[1]];
    if (!target || terpakai.has(target)) continue;
    terpakai.add(target);
    const jalur = 'word/' + target.replace(/^\.?\//, '');
    const berkas = zip.file(jalur);
    if (!berkas) continue;
    const jenis = /\.png$/i.test(jalur) ? 'image/png' : /\.gif$/i.test(jalur) ? 'image/gif' : 'image/jpeg';
    const biner = berkas.asUint8Array();
    if (biner.length < 20000) continue;          // gambar mungil = hiasan, bukan foto rapat
    let s = '';
    for (let i = 0; i < biner.length; i += 8192) {
      s += String.fromCharCode.apply(null, biner.subarray(i, i + 8192));
    }
    hasil.push('data:' + jenis + ';base64,' + btoa(s));
    if (hasil.length >= 3) break;                // hanya tiga yang tercetak di dokumen
  }
  return hasil;
}


/* ═══════════════════════════════════════════════════════════════
   4. SATU BERKAS → SATU REKAMAN
   ═══════════════════════════════════════════════════════════════ */
const bacaBerkas = berkas => new Promise((res, tolak) => {
  const p = new FileReader();
  p.onload = () => res(p.result);
  p.onerror = () => tolak(new Error('berkas tidak terbaca'));
  p.readAsArrayBuffer(berkas);
});

async function bacaSatu(berkas) {
  const isi = await bacaBerkas(berkas);
  let zip;
  try { zip = new window.PizZip(isi); }
  catch (e) { throw new Error('bukan dokumen Word (.docx) yang sah'); }

  const dokumen = zip.file('word/document.xml');
  if (!dokumen) throw new Error('bukan dokumen Word (.docx) yang sah');
  const xmlTeks = dokumen.asText();

  const D = susunData(bacaBlok(xmlTeks));
  if (!D.daerah) throw new Error('nama daerah tidak ditemukan pada tabel Informasi Rapat');
  if (!D.tanggalIso) throw new Error('tanggal rapat tidak terbaca pada tabel Informasi Rapat');

  let foto = [];
  try { foto = fotoDari(zip, xmlTeks); } catch (e) { /* foto boleh gagal, isinya yang penting */ }

  return { berkas: berkas.name, data: D, foto };
}


/* ═══════════════════════════════════════════════════════════════
   5. TAMPILAN
   ═══════════════════════════════════════════════════════════════ */
let ANTRE = [];        // { berkas, data, foto, galat, status, pilih }
let SIBUK = false;
let OPSI = null;
let RINGKAS = '';
let MEMBACA = null;    // { sudah, total } selama berkas sedang dibaca
let CATATAN = '';      // keterangan pilihan berkas, mis. folder tanpa .docx

const KELAS_TOMBOL = 'rounded-full border border-slate-300 px-4 py-2 text-[13px] font-medium text-slate-600 transition hover:bg-slate-100';
const KELAS_UTAMA  = 'cta-glow rounded-full bg-slate-900 px-5 py-2.5 text-[13px] font-medium text-white transition disabled:opacity-40';

function tutup() {
  const m = el('#baImpor');
  if (m) m.remove();
  document.removeEventListener('keydown', tombolEsc);
  ANTRE = []; SIBUK = false; RINGKAS = ''; MEMBACA = null; CATATAN = '';
}

function tombolEsc(e) { if (e.key === 'Escape' && !SIBUK) tutup(); }

const lencana = (teks, kelas) =>
  `<span class="rounded-full px-2 py-0.5 text-[11px] font-semibold ${kelas}">${teks}</span>`;

function barisAntre(x, i) {
  const status = x.galat
    ? lencana('Gagal dibaca', 'bg-rose-100 text-rose-700')
    : x.status === 'simpan' ? lencana('Tersimpan', 'bg-emerald-100 text-emerald-700')
    : x.status === 'gagal'  ? lencana('Gagal simpan', 'bg-rose-100 text-rose-700')
    : x.timpa ? lencana('Menimpa yang ada', 'bg-amber-100 text-amber-700')
              : lencana('Baru', 'bg-sky-100 text-sky-700');

  const d = x.data || {};
  return `
    <tr class="border-t border-slate-200 align-top">
      <td class="px-3 py-2.5">
        <input type="checkbox" data-impor-pilih="${i}" ${x.pilih ? 'checked' : ''} ${x.galat || x.status === 'simpan' ? 'disabled' : ''}
               class="h-4 w-4 accent-slate-900" />
      </td>
      <td class="px-3 py-2.5">
        <p class="text-[13px] font-medium text-slate-800">${aman(d.daerah || '—')}</p>
        <p class="mt-0.5 text-[11.5px] text-slate-500">${aman(x.berkas)}</p>
        ${x.galat ? `<p class="mt-1 text-[11.5px] text-rose-600">${aman(x.galat)}</p>` : ''}
      </td>
      <td class="whitespace-nowrap px-3 py-2.5 text-[12.5px] text-slate-600">${aman(d.tanggalIso || '—')}</td>
      <td class="px-3 py-2.5 text-[12.5px] tabular-nums text-slate-600">${d.progres ? d.progres.length : 0}</td>
      <td class="whitespace-nowrap px-3 py-2.5 text-[12.5px] tabular-nums text-slate-600">${aman(d.fisikRata || '—')}${d.fisikRata ? '%' : ''} / ${aman(d.keuanganRata || '—')}${d.keuanganRata ? '%' : ''}</td>
      <td class="px-3 py-2.5 text-[12.5px] tabular-nums text-slate-600">${x.foto ? x.foto.length : 0}</td>
      <td class="px-3 py-2.5">${status}</td>
    </tr>`;
}

function render() {
  const m = el('#baImpor');
  if (!m) return;
  const siap = ANTRE.filter(x => !x.galat && x.status !== 'simpan');
  const dipilih = siap.filter(x => x.pilih);
  const gagal = ANTRE.filter(x => x.galat).length;

  /* Satu folder bisa berisi ratusan dokumen; tanpa penghitung, layar terlihat
     berhenti padahal sedang membaca. */
  const kemajuan = MEMBACA ? `
    <div class="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p class="text-[12.5px] text-slate-600">Membaca dokumen ${MEMBACA.sudah} dari ${MEMBACA.total}…</p>
      <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div class="h-full rounded-full bg-slate-800 transition-[width]" style="width:${Math.round(MEMBACA.sudah / MEMBACA.total * 100)}%"></div>
      </div>
    </div>` : '';

  m.querySelector('#baImporIsi').innerHTML = (ANTRE.length || MEMBACA) ? kemajuan + `
    <div class="overflow-x-auto rounded-2xl border border-slate-200">
      <table class="w-full min-w-[720px] border-collapse text-left">
        <thead class="bg-slate-50">
          <tr class="text-[11px] uppercase tracking-[0.1em] text-slate-500">
            <th class="px-3 py-2.5"><input type="checkbox" data-impor-semua class="h-4 w-4 accent-slate-900" ${siap.length && dipilih.length === siap.length ? 'checked' : ''} /></th>
            <th class="px-3 py-2.5">Daerah &amp; berkas</th>
            <th class="px-3 py-2.5">Tanggal</th>
            <th class="px-3 py-2.5">Ruas</th>
            <th class="px-3 py-2.5">Fisik / Keuangan</th>
            <th class="px-3 py-2.5">Foto</th>
            <th class="px-3 py-2.5">Status</th>
          </tr>
        </thead>
        <tbody>${ANTRE.map(barisAntre).join('')}</tbody>
      </table>
    </div>
    ${gagal ? `<p class="mt-3 text-[12.5px] text-rose-600">${gagal} berkas tidak terbaca. Pastikan dokumennya memakai format notulensi PFID — tabel Informasi Rapat harus memuat baris Daerah dan Hari/Tanggal.</p>` : ''}
    ${CATATAN ? `<p class="mt-3 text-[12.5px] text-amber-700">${aman(CATATAN)}</p>` : ''}
    ${RINGKAS ? `<p class="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-[12.5px] text-emerald-800">${aman(RINGKAS)}</p>` : ''}
  ` : `
    <div id="baImporLepas" class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center transition">
      <p class="text-[14px] font-medium text-slate-700">Belum ada dokumen dipilih.</p>
      <p class="mx-auto mt-2 max-w-[460px] text-[12.5px] leading-[1.6] text-slate-500">
        Pilih berkas .docx satu per satu, atau pilih satu folder sekaligus — isinya ditelusuri
        sampai ke subfolder, jadi folder yang berisi berita acara tiap pemda cukup dipilih sekali.
        Foldernya juga boleh diseret dan dijatuhkan ke sini.
      </p>
      ${CATATAN ? `<p class="mt-3 text-[12.5px] text-amber-700">${aman(CATATAN)}</p>` : ''}
    </div>`;

  const simpan = m.querySelector('#baImporSimpan');
  simpan.disabled = SIBUK || !dipilih.length;
  simpan.textContent = SIBUK ? 'Menyimpan…' : dipilih.length ? `Simpan ${dipilih.length} dokumen` : 'Simpan';

  m.querySelectorAll('[data-impor-pilih]').forEach(c => c.onchange = () => {
    ANTRE[+c.dataset.imporPilih].pilih = c.checked;
    render();
  });
  const semua = m.querySelector('[data-impor-semua]');
  if (semua) semua.onchange = () => {
    ANTRE.forEach(x => { if (!x.galat && x.status !== 'simpan') x.pilih = semua.checked; });
    render();
  };
}

/* ── mengumpulkan berkas ────────────────────────────────────────
   Impor folder membawa jalur relatifnya. Jalur itu dipakai sebagai nama
   berkas, sehingga dua "Notulensi.docx" di folder pemda yang berbeda tidak
   saling menimpa di daftar antrean. */
const jalurBerkas = b => b.webkitRelativePath || b.jalurRelatif || b.name;

/* Hanya .docx yang diproses. Word meninggalkan berkas kunci "~$nama.docx" di
   folder yang sedang dibuka — bentuknya bukan dokumen utuh, dan kalau ikut
   terbaca hasilnya cuma baris gagal yang membingungkan. */
const berkasWord = b => /\.docx$/i.test(b.name) && !/^~\$/.test(b.name);

async function kumpulkan(semua) {
  const mentah = Array.from(semua || []);
  if (!mentah.length) return;

  const daftar = mentah.filter(berkasWord);
  CATATAN = daftar.length === mentah.length ? ''
    : daftar.length
      ? `${mentah.length - daftar.length} berkas dilewati karena bukan dokumen Word (.docx).`
      : 'Tidak ada berkas .docx di dalam pilihan itu. Pastikan foldernya berisi notulensi berbentuk Word, bukan PDF atau hasil pindaian.';
  if (!daftar.length) { render(); return; }

  MEMBACA = { sudah: 0, total: daftar.length };
  render();

  await muatPizzip();
  for (const berkas of daftar) {
    const nama = jalurBerkas(berkas);
    let baris;
    try {
      baris = await bacaSatu(berkas);
      baris.berkas = nama;
      baris.pilih = true;
      baris.timpa = OPSI.sudahAda(baris.data.daerah, baris.data.tanggalIso);
    } catch (e) {
      baris = { berkas: nama, data: null, foto: [], galat: e.message, pilih: false };
    }
    /* Berkas dengan jalur sama dibaca ulang, bukan ditumpuk. */
    const lama = ANTRE.findIndex(x => x.berkas === baris.berkas);
    if (lama > -1) ANTRE[lama] = baris; else ANTRE.push(baris);
    MEMBACA.sudah++;
    render();
  }
  MEMBACA = null;
  render();
}

/** Kotak pilih berkas bawaan peramban; `folder` mengubahnya jadi pilih folder. */
function pilih(folder) {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.multiple = true;
  if (folder) {
    /* webkitdirectory menelusuri seluruh isi folder termasuk subfoldernya, jadi
       satu folder induk berisi map per pemda cukup dipilih sekali. Penyaring
       .docx sengaja tidak dipasang di sini — beberapa peramban justru
       mengosongkan pilihan folder bila `accept` ikut diisi. */
    inp.webkitdirectory = true;
    inp.directory = true;
  } else {
    inp.accept = '.docx';
  }
  inp.onchange = () => kumpulkan(inp.files);
  inp.click();
}

const pilihBerkas = () => pilih(false);
const pilihFolder = () => pilih(true);

/* ── seret dan jatuhkan ─────────────────────────────────────────
   Folder yang dijatuhkan hanya bisa ditelusuri lewat webkitGetAsEntry; tanpa
   itu peramban cuma memberikan berkas yang ada di permukaan. */
function bacaEntri(entri, awalan) {
  return new Promise(selesai => {
    if (entri.isFile) {
      entri.file(f => { f.jalurRelatif = awalan + f.name; selesai([f]); }, () => selesai([]));
      return;
    }
    if (!entri.isDirectory) { selesai([]); return; }
    const pembaca = entri.createReader();
    const isi = [];
    /* readEntries hanya memberi sebagian isi tiap panggilan; dibaca terus
       sampai jawabannya kosong. */
    const lanjut = () => pembaca.readEntries(async hasil => {
      if (!hasil.length) {
        const dalam = await Promise.all(isi.map(e => bacaEntri(e, awalan + entri.name + '/')));
        selesai([].concat.apply([], dalam));
        return;
      }
      isi.push.apply(isi, hasil);
      lanjut();
    }, () => selesai([]));
    lanjut();
  });
}

async function berkasDariJatuhan(dt) {
  const item = Array.from(dt.items || []).filter(x => x.kind === 'file');
  if (item.length && item[0].webkitGetAsEntry) {
    const entri = item.map(x => x.webkitGetAsEntry()).filter(Boolean);
    if (entri.length) {
      const kelompok = await Promise.all(entri.map(e => bacaEntri(e, '')));
      return [].concat.apply([], kelompok);
    }
  }
  return Array.from(dt.files || []);
}

function pasangJatuhan(m) {
  const sorot = nyala => {
    const zona = m.querySelector('#baImporLepas');
    if (zona) zona.classList.toggle('border-slate-500', nyala);
    if (zona) zona.classList.toggle('bg-slate-100', nyala);
  };
  m.addEventListener('dragover', e => { e.preventDefault(); if (!SIBUK) sorot(true); });
  m.addEventListener('dragleave', e => { if (e.target === m) sorot(false); });
  m.addEventListener('drop', async e => {
    e.preventDefault();
    sorot(false);
    if (SIBUK || MEMBACA) return;
    await kumpulkan(await berkasDariJatuhan(e.dataTransfer));
  });
}

async function simpanSemua() {
  const antre = ANTRE.filter(x => x.pilih && !x.galat && x.status !== 'simpan');
  if (!antre.length) return;
  SIBUK = true; RINGKAS = ''; render();

  let berhasil = 0, gagal = 0;
  for (const x of antre) {
    try {
      await OPSI.simpan(x);
      x.status = 'simpan'; x.pilih = false; berhasil++;
    } catch (e) {
      x.status = 'gagal';
      x.galat = 'Gagal disimpan: ' + (e.code || e.message);
      gagal++;
    }
    render();
  }

  SIBUK = false;
  RINGKAS = berhasil + ' berita acara tersimpan' + (gagal ? ', ' + gagal + ' gagal' : '')
          + '. Daerahnya langsung melihat versi terbaru saat membuka menu arsip.';
  render();
  if (berhasil && OPSI.selesai) await OPSI.selesai(berhasil);
}


/* ═══════════════════════════════════════════════════════════════
   6. TITIK MASUK
   ═══════════════════════════════════════════════════════════════ */
window.IMPOR_BA = {
  /** Buka jendela impor.
      opsi.sudahAda(daerah, tanggalIso) → true bila arsipnya akan tertimpa
      opsi.simpan({ data, foto, berkas }) → Promise, menulis satu dokumen
      opsi.selesai(jumlah) → dipanggil sekali setelah semuanya tersimpan */
  buka(opsi) {
    tutup();
    OPSI = opsi;
    ANTRE = []; SIBUK = false; RINGKAS = ''; MEMBACA = null; CATATAN = '';

    const m = document.createElement('div');
    m.id = 'baImpor';
    m.className = 'fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto bg-slate-900/45 px-4 py-8 backdrop-blur-sm';
    m.innerHTML = `
      <div class="w-full max-w-4xl rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-2xl md:p-8">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Berita acara</p>
            <h3 class="mt-1.5 text-[20px] font-semibold text-slate-900">Impor dokumen Word</h3>
            <p class="mt-2 max-w-[620px] text-[13px] leading-[1.65] text-slate-500">
              Notulensi yang sudah pernah disusun manual dapat dimasukkan ke arsip apa adanya —
              tabelnya dibaca langsung dari dokumen, tanpa memakai AI. Berkasnya boleh dipilih
              satu per satu, atau satu folder sekaligus beserta seluruh subfoldernya. Bila daerah
              dan tanggalnya sudah ada di arsip, isi dari dokumen inilah yang dipakai.
            </p>
          </div>
          <button id="baImporTutup" aria-label="Tutup" class="-mr-1 -mt-1 shrink-0 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="h-5 w-5"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>

        <div class="mt-6 flex flex-wrap gap-2">
          <button id="baImporPilih" class="${KELAS_TOMBOL}">Pilih dokumen .docx…</button>
          <button id="baImporFolder" title="Seluruh .docx di dalamnya ikut terbaca, termasuk yang berada di subfolder" class="${KELAS_TOMBOL}">Pilih folder…</button>
        </div>

        <div id="baImporIsi" class="mt-5"></div>

        <div class="mt-6 flex flex-wrap items-center justify-end gap-2">
          <button id="baImporBatal" class="${KELAS_TOMBOL}">Tutup</button>
          <button id="baImporSimpan" class="${KELAS_UTAMA}" disabled>Simpan</button>
        </div>
      </div>`;
    document.body.appendChild(m);

    m.querySelector('#baImporTutup').onclick = () => { if (!SIBUK) tutup(); };
    m.querySelector('#baImporBatal').onclick = () => { if (!SIBUK) tutup(); };
    m.querySelector('#baImporPilih').onclick = pilihBerkas;
    m.querySelector('#baImporFolder').onclick = pilihFolder;
    m.querySelector('#baImporSimpan').onclick = simpanSemua;
    m.onclick = e => { if (e.target === m && !SIBUK) tutup(); };
    document.addEventListener('keydown', tombolEsc);
    pasangJatuhan(m);

    render();
  },

  /** Dibuka juga oleh pengujian: baca satu berkas tanpa tampilan. */
  async baca(berkas) { await muatPizzip(); return bacaSatu(berkas); }
};

})();
