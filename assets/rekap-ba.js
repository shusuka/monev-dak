/* ═══════════════════════════════════════════════════════════════════════
   REKAPITULASI BERITA ACARA → SATU BERKAS EXCEL

   Setiap berita acara berisi satu daerah. Yang diminta pimpinan kebalikannya:
   satu lembar berisi seluruh daerah, dengan bentuk yang sudah dipakai sejak
   dulu —

     Provinsi | Nama Daerah | Terkontrak | Proses Tender |
     Penyesuaian Penanganan (Badan Jalan · Bahu · Marka) |
     Rerata Progres (Fisik · Keuangan) | Keterangan

   Berkas ini menyusunnya sendiri dari arsip berita acara. Barisnya selalu 164
   — daftar penerima DAK di assets/wilayah.js, urut provinsi seperti berkas
   aslinya — sehingga daerah yang belum dirapatkan tetap punya barisnya dan
   langsung kelihatan kosong.

   Isi kolomnya diturunkan dari notulensi, bukan diketik ulang:
     Proses Tender     daerahnya sudah melewati atau sedang menjalani tender
     Terkontrak        ada ruas yang nilai kontraknya terisi
     Badan Jalan       tabel Kesimpulan: Jenis atau Target Penanganan tidak sesuai
     Bahu · Marka      tabel Kesimpulan: kolom senama tidak sesuai
     Fisik · Keuangan  progres rata-rata pada Evaluasi Pelaksanaan; bila
                       paragrafnya kosong, dirata-ratakan dari tabel progres
     Keterangan        permasalahan utama

   Turunan itu tebakan yang masuk akal, bukan kebenaran mutlak — karena itu
   seluruhnya ditampilkan lebih dulu dan boleh diperbaiki di layar sebelum
   berkasnya diunduh.

   Penulisan .xlsx-nya memakai PizZip, sama seperti rekap survei: tidak ada
   pustaka Excel yang perlu ikut diunduh peramban.
   ═══════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const el   = s => document.querySelector(s);
const aman = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const CDN_PIZZIP = 'https://unpkg.com/pizzip@3.2.0/dist/pizzip.min.js';

/* Centang pada berkas rekap memakai √ (U+221A), berbeda dengan ⩗ di dokumen
   Word. Sengaja dibedakan supaya berkasnya terlihat persis seperti biasa. */
const CENTANG = '√';
const STRIP   = '-';


/* ═══════════════════════════════════════════════════════════════
   1. DAFTAR BARIS
   Urutan provinsi mengikuti berkas rekap yang sudah beredar — barat ke timur,
   provinsi pemekaran di bawah — bukan urutan abjad assets/wilayah.js.
   ═══════════════════════════════════════════════════════════════ */
const URUT_PROV = [
  'Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Jambi', 'Sumatera Selatan',
  'Lampung', 'Jawa Barat', 'Jawa Tengah', 'DI Yogyakarta', 'Jawa Timur',
  'Kalimantan Barat', 'Kalimantan Selatan', 'Kalimantan Timur',
  'Sulawesi Utara', 'Sulawesi Tengah', 'Sulawesi Selatan', 'Sulawesi Tenggara',
  'Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur', 'Maluku', 'Papua',
  'Maluku Utara', 'Kepulauan Bangka Belitung', 'Gorontalo', 'Kepulauan Riau',
  'Papua Barat', 'Sulawesi Barat', 'Kalimantan Utara', 'Papua Selatan',
  'Papua Tengah', 'Papua Pegunungan', 'Papua Barat Daya'
];

/* Beberapa nama ditulis lebih pendek di berkas rekap daripada di daftar
   wilayah. Yang dipakai mencocokkan tetap nama resminya; yang berbeda hanya
   tulisan di kertas. */
const LABEL_PROV = { 'Kepulauan Bangka Belitung': 'Bangka Belitung' };
const LABEL_KAB  = {
  'Kepulauan Siau Tagulandang Biaro': 'Kab. Kep. Siau Tagulandang Biaro',
  'Pangkajene dan Kepulauan':         'Kab. Pangkajene Kepulauan',
  'Kota Lubuklinggau':                'Kota Lubuk Linggau',
  'Ogan Komering Ulu Timur':          'Kab. OKU Timur',
  'Kota Tanjungpinang':               'Kota Tanjung Pinang'
};

const labelKab = nama => LABEL_KAB[nama] || (/^kota\b/i.test(nama) ? nama : 'Kab. ' + nama);

/** Seluruh baris rekap, urut seperti berkas aslinya. */
function daftarBaris(kunci) {
  const w = window.WILAYAH || {};
  const sisa = Object.keys(w).filter(p => URUT_PROV.indexOf(p) < 0).sort();
  const baris = [];
  URUT_PROV.concat(sisa).forEach(prov => {
    if (!w[prov]) return;
    String(w[prov]).split(',').map(s => s.trim()).filter(Boolean).forEach(kab => {
      baris.push({
        prov, kab,
        labelProv: 'Provinsi ' + (LABEL_PROV[prov] || prov),
        labelKab: labelKab(kab),
        kunci: kunci(kab)
      });
    });
  });
  return baris;
}


/* ═══════════════════════════════════════════════════════════════
   2. MENURUNKAN ISI KOLOM DARI NOTULENSI
   ═══════════════════════════════════════════════════════════════ */
/** "70,5%" → 70.5. Titik dianggap pemisah ribuan, sama seperti di peta. */
function angka(teks) {
  const s = String(teks == null ? '' : teks).replace(/%/g, '').replace(/\./g, '').replace(/,/g, '.').trim();
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

/** "Rp 1.250.000.000" → 1250000000; yang bukan angka jadi 0. */
function rupiah(teks) {
  const s = String(teks == null ? '' : teks).replace(/[^\d.,]/g, '').split(',')[0].replace(/\./g, '');
  const n = parseInt(s, 10);
  return isFinite(n) ? n : 0;
}

/* Kolom kesesuaian pada tabel Kesimpulan hanya berisi centang bila item itu
   sesuai. Sel kosong ikut dianggap sesuai: notulensi yang bagiannya tidak
   diisi tidak boleh berubah menjadi tuduhan adanya penyesuaian. */
const KATA_SESUAI = ['⩗', '√', '✓', 'v', 'ya', 'sesuai', 'ada'];
const sesuai = v => {
  const s = String(v == null ? '' : v).trim().toLowerCase();
  return !s || KATA_SESUAI.indexOf(s) > -1;
};

const rata = xs => {
  const a = xs.filter(x => x != null);
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
};

const bulat = v => (v == null ? null : Math.round(v * 100) / 100);

function turunkan(rekaman) {
  const d = (rekaman && rekaman.data) || {};
  const progres = Array.isArray(d.progres) ? d.progres : [];
  const kes     = Array.isArray(d.kesimpulan) ? d.kesimpulan : [];
  const kontrak = progres.some(p => rupiah(p.nilaiKontrak) > 0);
  const fisik    = angka(d.fisikRata);
  const keuangan = angka(d.keuanganRata);

  /* Tender dan kontrak bukan dua pilihan yang saling meniadakan, melainkan dua
     tahap berurutan: paket yang sudah terkontrak pasti sudah lewat tender,
     jadi centangnya ikut menyala. Daerah yang belum berkontrak pun sedang
     berada di proses tender — karena itu kolomnya menyala untuk setiap daerah
     yang sudah punya berita acara, dan dimatikan sendiri di layar bila
     ternyata tendernya memang belum jalan. */
  return {
    tender:     true,
    terkontrak: kontrak,
    badan: kes.some(k => !sesuai(k.jenisPenanganan) || !sesuai(k.targetPenanganan)),
    bahu:  kes.some(k => !sesuai(k.bahu)),
    marka: kes.some(k => !sesuai(k.marka)),
    fisik:    bulat(fisik    != null ? fisik    : rata(progres.map(p => angka(p.fisik)))),
    keuangan: bulat(keuangan != null ? keuangan : rata(progres.map(p => angka(p.keuangan)))),
    keterangan: String(d.permasalahanUtama || '').replace(/\s+/g, ' ').trim()
  };
}

const waktuAngka = t => (t && typeof t.toMillis === 'function') ? t.toMillis() : Number(t || 0);

/** Satu daerah bisa punya beberapa berita acara — rapat ulang, atau salinan
    petugas lain. Yang dipakai rekap adalah yang tanggal rapatnya paling baru;
    bila tanggalnya sama, yang paling akhir disunting. */
function pilihTerbaru(daftar) {
  return daftar.slice().sort((a, b) =>
    String(b.tanggalIso || '').localeCompare(String(a.tanggalIso || '')) ||
    waktuAngka(b.diperbaruiAt) - waktuAngka(a.diperbaruiAt))[0];
}

/** Baris rekap: daftar 164 daerah penerima digabung dengan isi yang
    diturunkan, plus daftar berita acara yang daerahnya tidak ada di daftar
    itu — yang terakhir tidak ikut ke berkas, hanya jadi peringatan di layar. */
function susun(rekaman, kunci) {
  const perDaerah = {};
  (rekaman || []).forEach(r => {
    const k = r.kunciDaerah || kunci(r.daerah || r.kab || '');
    if (!k) return;
    (perDaerah[k] = perDaerah[k] || []).push(r);
  });

  const baris = daftarBaris(kunci).map(b => {
    const punya = perDaerah[b.kunci];
    if (punya) delete perDaerah[b.kunci];
    const arsip = punya ? pilihTerbaru(punya) : null;
    return Object.assign({}, b, {
      ada: !!arsip,
      tanggalIso: arsip ? (arsip.tanggalIso || '') : '',
      jumlahBa: punya ? punya.length : 0,
      isi: arsip ? turunkan(arsip) : null
    });
  });

  /* Rekapnya harus berisi tepat 164 daerah penerima DAK — tidak lebih. Berita
     acara yang nama daerahnya di luar daftar itu (salah ketik, atau daerah
     yang memang bukan penerima) karena itu tidak ikut ke berkas. Tetapi tidak
     boleh hilang diam-diam juga: namanya disebut di layar supaya ketahuan dan
     bisa dibetulkan di arsipnya. */
  const luar = Object.keys(perDaerah).map(k => ({
    daerah: (pilihTerbaru(perDaerah[k]).daerah || '(tanpa daerah)'),
    jumlah: perDaerah[k].length
  })).sort((a, b) => a.daerah.localeCompare(b.daerah));

  return { baris, luar };
}


/* ═══════════════════════════════════════════════════════════════
   3. PENULIS .XLSX
   Bentuknya menirukan berkas rekap aslinya: judul menyatu di baris pertama,
   kepala tabel dua tingkat, seluruh sel bergaris, dan angka tetap angka
   sehingga masih bisa dihitung di Excel.
   ═══════════════════════════════════════════════════════════════ */
const xmlAman = s => String(s == null ? '' : s)
  .replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
  .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

/* Nomor gaya pada cellXfs di bawah. */
const G_JUDUL = 1, G_KEPALA = 2, G_KIRI = 3, G_TENGAH = 4, G_ANGKA = 5, G_KOSONG = 6, G_KET = 7;

const GAYA = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="4">
<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="14"/><name val="Arial"/><family val="2"/></font>
<font><b/><sz val="11"/><name val="Arial"/><family val="2"/></font>
<font><sz val="10"/><name val="Arial"/><family val="2"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFD9E2F3"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color indexed="64"/></left><right style="thin"><color indexed="64"/></right><top style="thin"><color indexed="64"/></top><bottom style="thin"><color indexed="64"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="8">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

const KOLOM = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const LEBAR = [28.28, 33.57, 12.57, 10.71, 10.71, 10.71, 10.71, 11.14, 11.14, 28.42];

/** Satu sel; `v` boleh angka, teks, atau null untuk sel kosong yang tetap
    bergaris — baris daerah tanpa berita acara memakai bentuk itu. */
function sel(ref, gaya, v) {
  if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}" s="${gaya}"><v>${v}</v></c>`;
  const t = xmlAman(v);
  if (!t) return `<c r="${ref}" s="${gaya}"/>`;
  return `<c r="${ref}" s="${gaya}" t="inlineStr"><is><t xml:space="preserve">${t}</t></is></c>`;
}

const barisXml = (nomor, isi, tinggi) =>
  `<row r="${nomor}" spans="1:10"${tinggi ? ` ht="${tinggi}" customHeight="1"` : ''}>${isi}</row>`;

function lembarXml(judul, baris) {
  const kepala =
    barisXml(1, KOLOM.map(k => sel(k + '1', G_JUDUL, k === 'A' ? judul : null)).join(''), 50.25) +
    barisXml(2, [
      sel('A2', G_KEPALA, 'Provinsi'), sel('B2', G_KEPALA, 'Nama Daerah'),
      sel('C2', G_KEPALA, 'Proses Tender'), sel('D2', G_KEPALA, 'Terkontrak'),
      sel('E2', G_KEPALA, 'Penyesuaian Penanganan'), sel('F2', G_KEPALA, null), sel('G2', G_KEPALA, null),
      sel('H2', G_KEPALA, 'Rerata Progres\n(%)'), sel('I2', G_KEPALA, null),
      sel('J2', G_KEPALA, 'Keterangan')
    ].join(''), 34.5) +
    barisXml(3, [
      sel('A3', G_KEPALA, null), sel('B3', G_KEPALA, null),
      sel('C3', G_KEPALA, null), sel('D3', G_KEPALA, null),
      sel('E3', G_KEPALA, 'Badan Jalan'), sel('F3', G_KEPALA, 'Bahu'), sel('G3', G_KEPALA, 'Marka'),
      sel('H3', G_KEPALA, 'Fisik'), sel('I3', G_KEPALA, 'Keuangan'),
      sel('J3', G_KEPALA, null)
    ].join(''), 30);

  const isi = baris.map((b, i) => {
    const n = i + 4;
    const tanda = v => (v ? CENTANG : STRIP);
    const nilai = b.ada ? [
      sel('C' + n, G_TENGAH, tanda(b.isi.tender)),
      sel('D' + n, G_TENGAH, tanda(b.isi.terkontrak)),
      sel('E' + n, G_TENGAH, tanda(b.isi.badan)),
      sel('F' + n, G_TENGAH, tanda(b.isi.bahu)),
      sel('G' + n, G_TENGAH, tanda(b.isi.marka)),
      sel('H' + n, G_ANGKA, b.isi.fisik),
      sel('I' + n, G_ANGKA, b.isi.keuangan),
      sel('J' + n, G_KET, b.isi.keterangan)
    ] : ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].map(k => sel(k + n, G_KOSONG, null));

    return barisXml(n, [
      sel('A' + n, G_KIRI, b.labelProv), sel('B' + n, G_KIRI, b.labelKab)
    ].concat(nilai).join(''), 18);
  }).join('');

  const lebar = LEBAR.map((w, j) =>
    `<col min="${j + 1}" max="${j + 1}" width="${w}" customWidth="1"/>`).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="A1:J${baris.length + 3}"/>
<sheetViews><sheetView tabSelected="1" workbookViewId="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="14.25"/>
<cols>${lebar}</cols>
<sheetData>${kepala}${isi}</sheetData>
<mergeCells count="8"><mergeCell ref="A1:J1"/><mergeCell ref="A2:A3"/><mergeCell ref="B2:B3"/><mergeCell ref="C2:C3"/><mergeCell ref="D2:D3"/><mergeCell ref="E2:G2"/><mergeCell ref="H2:I2"/><mergeCell ref="J2:J3"/></mergeCells>
<pageMargins left="0.31496062992125984" right="0.23622047244094491" top="0.39370078740157483" bottom="0.74803149606299213" header="0.31496062992125984" footer="0.31496062992125984"/>
<pageSetup paperSize="9" scale="84" orientation="landscape"/>
</worksheet>`;
}

function muatPizzip() {
  if (window.PizZip) return Promise.resolve();
  return new Promise((selesai, gagal) => {
    const s = document.createElement('script');
    s.src = CDN_PIZZIP;
    s.onload = selesai;
    s.onerror = () => gagal(new Error('pustaka pembuat Excel gagal dimuat'));
    document.head.appendChild(s);
  });
}

async function buatXlsx(judul, namaLembar, baris) {
  await muatPizzip();
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
  xl.file('styles.xml', GAYA);
  xl.folder('worksheets').file('sheet1.xml', lembarXml(judul, baris));

  return zip.generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    compression: 'DEFLATE'
  });
}


/* ═══════════════════════════════════════════════════════════════
   4. TAMPILAN
   Rekapnya diperlihatkan lebih dulu, bukan langsung terunduh: tiap centang
   boleh diklik untuk dibalik, angka dan keterangannya boleh diketik ulang.
   Yang diubah di sini tidak menyentuh arsip — hanya berkas yang akan keluar.
   ═══════════════════════════════════════════════════════════════ */
let BARIS  = [];
let LUAR   = [];        // berita acara di luar 164 daerah penerima
let SEMUA  = true;      // ikutkan daerah yang belum ada berita acaranya
let SIBUK  = false;
let PESAN  = '';

const KELAS_TOMBOL = 'rounded-full border border-slate-300 px-4 py-2 text-[13px] font-medium text-slate-600 transition hover:bg-slate-100';
const KELAS_UTAMA  = 'cta-glow rounded-full bg-slate-900 px-5 py-2.5 text-[13px] font-medium text-white transition disabled:opacity-40';

/* Triwulan dan tahun anggaran diambil dari aturan aplikasi bila ada, supaya
   judul berkasnya ikut berubah saat triwulannya bergeser. */
function romawiTw() {
  try { return TW_META[TW_AKTIF].rom; } catch (e) { return 'II'; }
}
const TAHUN_ANGGARAN = 2026;

const judulRekap = () =>
  `Rekapitulasi Rapat Koordinasi DAK Fisik Sub Bidang Jalan TA ${TAHUN_ANGGARAN} Triwulan ${romawiTw()}`;

function tutup() {
  const m = el('#baRekap');
  if (m) m.remove();
  document.removeEventListener('keydown', tombolEsc);
  BARIS = []; LUAR = []; SIBUK = false; PESAN = '';
}

function tombolEsc(e) { if (e.key === 'Escape' && !SIBUK) tutup(); }

/** Baris yang benar-benar ditulis ke berkas. */
const barisTerpakai = () => (SEMUA ? BARIS : BARIS.filter(b => b.ada));

const tombolTanda = (i, k, aktif) => `
  <button type="button" data-rekap-balik="${i}" data-kolom="${k}"
          title="Klik untuk membalik"
          class="h-7 w-7 rounded-lg text-[13px] font-semibold transition ${aktif
            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
            : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}">${aktif ? CENTANG : STRIP}</button>`;

const kotakAngka = (i, k, v) => `
  <input type="number" step="0.01" min="0" max="100" data-rekap-angka="${i}" data-kolom="${k}"
         value="${v == null ? '' : v}" placeholder="—"
         class="w-[68px] rounded-lg border border-slate-200 px-2 py-1 text-right text-[12.5px] tabular-nums text-slate-700 outline-none focus:border-slate-400" />`;

function barisTampil(b, i) {
  if (!b.ada) {
    return `
      <tr class="border-t border-slate-100 bg-slate-50/60 align-middle text-slate-400">
        <td class="px-3 py-2 text-[12px]">${aman(b.labelProv.replace(/^Provinsi /, ''))}</td>
        <td class="px-3 py-2 text-[12.5px]">${aman(b.labelKab)}</td>
        <td colspan="6" class="px-3 py-2 text-[12px] italic">belum ada berita acara</td>
        <td class="px-3 py-2"></td>
      </tr>`;
  }
  return `
    <tr class="border-t border-slate-100 align-middle">
      <td class="px-3 py-2 text-[12px] text-slate-500">${aman(b.labelProv.replace(/^Provinsi /, ''))}</td>
      <td class="px-3 py-2">
        <p class="text-[12.5px] font-medium text-slate-800">${aman(b.labelKab)}</p>
        <p class="mt-0.5 text-[11px] text-slate-400">${aman(b.tanggalIso || 'tanpa tanggal')}${
          b.jumlahBa > 1 ? ` · ${b.jumlahBa} berita acara, dipakai yang terbaru` : ''}</p>
      </td>
      <td class="px-2 py-2 text-center">${tombolTanda(i, 'tender', b.isi.tender)}</td>
      <td class="px-2 py-2 text-center">${tombolTanda(i, 'terkontrak', b.isi.terkontrak)}</td>
      <td class="px-2 py-2 text-center">${tombolTanda(i, 'badan', b.isi.badan)}</td>
      <td class="px-2 py-2 text-center">${tombolTanda(i, 'bahu', b.isi.bahu)}</td>
      <td class="px-2 py-2 text-center">${tombolTanda(i, 'marka', b.isi.marka)}</td>
      <td class="whitespace-nowrap px-2 py-2 text-center">
        ${kotakAngka(i, 'fisik', b.isi.fisik)} ${kotakAngka(i, 'keuangan', b.isi.keuangan)}
      </td>
      <td class="px-3 py-2">
        <input type="text" data-rekap-teks="${i}" value="${aman(b.isi.keterangan)}" placeholder="—"
               class="w-full min-w-[180px] rounded-lg border border-slate-200 px-2 py-1 text-[12.5px] text-slate-700 outline-none focus:border-slate-400" />
      </td>
    </tr>`;
}

function render() {
  const m = el('#baRekap');
  if (!m) return;

  const terisi = BARIS.filter(b => b.ada).length;

  m.querySelector('#baRekapIsi').innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-[12.5px] text-slate-500">
        <span class="font-semibold text-slate-800">${terisi}</span> daerah sudah punya berita acara,
        dari ${BARIS.length} daerah penerima DAK.
      </p>
      <label class="flex cursor-pointer items-center gap-2 text-[12.5px] text-slate-600">
        <input type="checkbox" id="baRekapSemua" ${SEMUA ? 'checked' : ''} class="h-4 w-4 accent-slate-900" />
        Sertakan daerah yang belum ada berita acaranya
      </label>
    </div>

    <div class="mt-4 max-h-[52vh] overflow-auto rounded-2xl border border-slate-200">
      <table class="w-full min-w-[980px] border-collapse text-left">
        <thead class="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_rgba(0,0,0,.06)]">
          <tr class="text-[11px] uppercase tracking-[0.08em] text-slate-500">
            <th class="px-3 py-2.5">Provinsi</th>
            <th class="px-3 py-2.5">Nama daerah</th>
            <th class="px-2 py-2.5 text-center">Tender</th>
            <th class="px-2 py-2.5 text-center">Terkontrak</th>
            <th class="px-2 py-2.5 text-center">Badan jalan</th>
            <th class="px-2 py-2.5 text-center">Bahu</th>
            <th class="px-2 py-2.5 text-center">Marka</th>
            <th class="px-2 py-2.5 text-center">Fisik / Keuangan</th>
            <th class="px-3 py-2.5">Keterangan</th>
          </tr>
        </thead>
        <tbody>${(SEMUA ? BARIS : BARIS.filter(b => b.ada))
          .map(b => barisTampil(b, BARIS.indexOf(b))).join('')}</tbody>
      </table>
    </div>

    ${LUAR.length ? `
      <p class="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-[12.5px] leading-[1.6] text-amber-800">
        ${LUAR.length} berita acara tidak masuk rekap karena daerahnya di luar 164 penerima DAK:
        ${aman(LUAR.map(x => x.daerah).join(', '))}. Betulkan nama daerahnya di arsip bila itu salah ketik.
      </p>` : ''}
    ${PESAN ? `<p class="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-[12.5px] text-emerald-800">${aman(PESAN)}</p>` : ''}`;

  const unduh = m.querySelector('#baRekapUnduh');
  unduh.disabled = SIBUK || !terisi;
  unduh.textContent = SIBUK ? 'Menyusun…' : `Unduh Excel (${barisTerpakai().length} baris)`;

  m.querySelector('#baRekapSemua').onchange = e => { SEMUA = e.target.checked; render(); };

  m.querySelectorAll('[data-rekap-balik]').forEach(t => t.onclick = () => {
    const b = BARIS[+t.dataset.rekapBalik];
    const k = t.dataset.kolom;
    b.isi[k] = !b.isi[k];
    /* Terkontrak mengandaikan tendernya sudah jalan. Menyalakan kontrak ikut
       menyalakan tender; mematikan tender ikut mematikan kontrak. Arah
       sebaliknya dibiarkan — daerah boleh sudah tender tanpa berkontrak. */
    if (k === 'terkontrak' && b.isi.terkontrak) b.isi.tender = true;
    if (k === 'tender' && !b.isi.tender) b.isi.terkontrak = false;
    PESAN = '';
    render();
  });

  m.querySelectorAll('[data-rekap-angka]').forEach(inp => inp.onchange = () => {
    const b = BARIS[+inp.dataset.rekapAngka];
    const v = inp.value.trim() === '' ? null : Number(inp.value);
    b.isi[inp.dataset.kolom] = (v == null || !isFinite(v)) ? null : bulat(v);
  });

  m.querySelectorAll('[data-rekap-teks]').forEach(inp => inp.oninput = () => {
    BARIS[+inp.dataset.rekapTeks].isi.keterangan = inp.value;
  });
}

function unduhBlob(blob, nama) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nama;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function unduh() {
  const baris = barisTerpakai();
  if (!baris.length) return;
  SIBUK = true; PESAN = ''; render();
  try {
    const blob = await buatXlsx(judulRekap(), `Rekap TW ${romawiTw()}`, baris);
    const d = new Date();
    const tanggal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const nama = `Rekapitulasi laporan TW ${romawiTw()} - ${tanggal}.xlsx`;
    unduhBlob(blob, nama);
    PESAN = `${nama} tersimpan di folder unduhan. ${baris.filter(b => b.ada).length} daerah terisi.`;
  } catch (e) {
    PESAN = '';
    const isi = el('#baRekapIsi');
    if (isi) isi.insertAdjacentHTML('beforeend',
      `<p class="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-[12.5px] text-rose-700">Rekap gagal disusun: ${aman(e.message)}</p>`);
  }
  SIBUK = false;
  render();
}


/* ═══════════════════════════════════════════════════════════════
   5. TITIK MASUK
   ═══════════════════════════════════════════════════════════════ */
window.REKAP_BA = {
  /** Buka jendela rekap.
      opsi.rekaman → larik berita acara arsip, masing-masing dengan `data`
      opsi.kunci(nama) → kunci daerah, dipakai mencocokkan arsip ke daftar */
  buka(opsi) {
    tutup();
    const kunci = (opsi && opsi.kunci) || (s => String(s || '').toLowerCase().trim());
    const hasil = susun((opsi && opsi.rekaman) || [], kunci);
    BARIS = hasil.baris; LUAR = hasil.luar;
    SEMUA = true; SIBUK = false; PESAN = '';

    const m = document.createElement('div');
    m.id = 'baRekap';
    m.className = 'fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto bg-slate-900/45 px-4 py-8 backdrop-blur-sm';
    m.innerHTML = `
      <div class="w-full max-w-6xl rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-2xl md:p-8">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Berita acara</p>
            <h3 class="mt-1.5 text-[20px] font-semibold text-slate-900">Rekapitulasi ke Excel</h3>
            <p class="mt-2 max-w-[720px] text-[13px] leading-[1.65] text-slate-500">
              Seluruh berita acara dirangkum menjadi satu lembar berformat rekapitulasi rakor.
              Centang dan angkanya dibaca dari notulensi — klik centang untuk membalik, ketik ulang
              angka atau keterangan yang perlu diperbaiki. Perubahan di sini hanya memengaruhi
              berkas yang diunduh, arsipnya tidak ikut berubah.
            </p>
          </div>
          <button id="baRekapTutup" aria-label="Tutup" class="-mr-1 -mt-1 shrink-0 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="h-5 w-5"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>

        <div id="baRekapIsi" class="mt-6"></div>

        <div class="mt-6 flex flex-wrap items-center justify-end gap-2">
          <button id="baRekapBatal" class="${KELAS_TOMBOL}">Tutup</button>
          <button id="baRekapUnduh" class="${KELAS_UTAMA}">Unduh Excel</button>
        </div>
      </div>`;
    document.body.appendChild(m);

    m.querySelector('#baRekapTutup').onclick = () => { if (!SIBUK) tutup(); };
    m.querySelector('#baRekapBatal').onclick = () => { if (!SIBUK) tutup(); };
    m.querySelector('#baRekapUnduh').onclick = unduh;
    m.onclick = e => { if (e.target === m && !SIBUK) tutup(); };
    document.addEventListener('keydown', tombolEsc);

    render();
  }
};

})();
