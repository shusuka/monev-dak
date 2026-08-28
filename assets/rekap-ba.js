/* ═══════════════════════════════════════════════════════════════════════
   REKAPITULASI BERITA ACARA → SATU BERKAS EXCEL

   Setiap berita acara berisi satu daerah. Yang diminta pimpinan kebalikannya:
   satu lembar berisi seluruh daerah, dengan bentuk yang sudah dipakai sejak
   dulu —

     Provinsi | Nama Daerah | Kelengkapan Data E-Mon |
     Proses Lelang | Ter-kontrak |
     Kesesuaian Item (Jenis Penanganan · Bahu · Marka) |
     Rerata Progres (Fisik · Keuangan) | PHO | Keterangan

   Berkas ini menyusunnya sendiri dari arsip berita acara. Barisnya selalu 164
   — daftar penerima DAK di assets/wilayah.js — dan urutannya mengikuti berkas
   rekap yang beredar (URUT di bawah), sehingga daerah yang belum dirapatkan
   tetap punya barisnya dan langsung kelihatan kosong.

   Isi kolomnya diturunkan dari notulensi, bukan diketik ulang:
     Data E-Mon        tabel kelengkapan eMonitoring: "Lengkap" bila seluruh
                       kolomnya tercentang untuk seluruh ruas
     Ter-kontrak       banyaknya ruas yang nilai kontraknya terisi, per jumlah ruas
     Proses Lelang     sisanya — ruas yang belum berkontrak masih di lelang
     Jenis Penanganan  tabel Kesimpulan, kolom senama; centang = sesuai
     Bahu · Marka      tabel Kesimpulan, kolom senama; centang = sesuai
     Fisik · Keuangan  progres rata-rata pada Evaluasi Pelaksanaan; bila
                       paragrafnya kosong, dirata-ratakan dari tabel progres
     PHO               banyaknya ruas yang progres fisiknya sudah 100%
     Keterangan        permasalahan utama

   Turunan itu tebakan yang masuk akal, bukan kebenaran mutlak — karena itu
   seluruhnya ditampilkan lebih dulu dan boleh diperbaiki di layar sebelum
   berkasnya diunduh.

   Satu daerah bisa punya beberapa berita acara. Yang dipakai selalu yang
   PALING BARU DIMASUKKAN ke arsip; bila ternyata bukan itu yang dikehendaki,
   berita acara lain daerah itu bisa dipilih sendiri di layar.

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

const LENGKAP = 'Lengkap';
const BELUM   = 'Belum Lengkap';


/* ═══════════════════════════════════════════════════════════════
   1. DAFTAR BARIS
   Urutan barisnya disalin dari berkas rekap yang sudah beredar — barat ke
   timur, dan di dalam provinsi mengikuti urutan berkas itu, bukan abjad.
   Yang menentukan daerah mana saja yang berhak punya baris tetap
   assets/wilayah.js; daftar ini hanya menentukan urutannya, jadi daerah baru
   yang ditambahkan di sana tetap muncul walau belum disebut di sini.
   ═══════════════════════════════════════════════════════════════ */
const URUT = {
  'Aceh': 'Aceh Besar,Aceh Tengah,Aceh Utara,Bireuen,Pidie,Gayo Lues,Pidie Jaya',
  'Sumatera Utara': 'Asahan,Deli Serdang,Karo,Langkat,Tapanuli Selatan,Tapanuli Utara,Toba,Nias Selatan,Serdang Bedagai,Batu Bara,Padang Lawas,Nias Utara,Nias Barat',
  'Sumatera Barat': 'Solok,Kota Padang',
  'Jambi': 'Tanjung Jabung Timur',
  'Sumatera Selatan': 'Ogan Komering Ilir,Kota Pagar Alam,Kota Lubuklinggau,Banyuasin,Ogan Komering Ulu Timur,Empat Lawang',
  'Lampung': 'Lampung Selatan,Lampung Utara,Tulang Bawang,Way Kanan,Kota Bandar Lampung,Kota Metro',
  'Jawa Barat': 'Cianjur,Kuningan,Majalengka,Sukabumi',
  'Jawa Tengah': 'Banjarnegara,Banyumas,Brebes,Cilacap,Grobogan,Jepara,Karanganyar,Klaten,Magelang,Pemalang,Rembang,Semarang,Tegal,Temanggung,Wonogiri,Wonosobo',
  'DI Yogyakarta': 'Bantul',
  'Jawa Timur': 'Bangkalan,Bojonegoro,Gresik,Jember,Lamongan,Lumajang,Magetan,Malang,Nganjuk,Ngawi,Pacitan,Pasuruan,Ponorogo,Probolinggo,Sumenep,Trenggalek,Tuban,Tulungagung,Kota Malang',
  'Kalimantan Barat': 'Bengkayang,Sambas,Sanggau,Kubu Raya',
  'Kalimantan Selatan': 'Banjar',
  'Kalimantan Timur': 'Berau,Kota Bontang',
  'Sulawesi Utara': 'Kepulauan Siau Tagulandang Biaro,Kota Kotamobagu',
  'Sulawesi Tengah': 'Buol,Sigi',
  'Sulawesi Selatan': 'Bantaeng,Bone,Bulukumba,Pangkajene dan Kepulauan,Pinrang,Sidenreng Rappang,Wajo,Kota Parepare',
  'Sulawesi Tenggara': 'Konawe,Bombana,Wakatobi,Kolaka Utara,Konawe Utara',
  'Bali': 'Bangli,Klungkung',
  'Nusa Tenggara Barat': 'Lombok Timur',
  'Nusa Tenggara Timur': 'Alor,Belu,Kupang,Sumba Barat,Sumba Timur,Timor Tengah Selatan,Timor Tengah Utara,Rote Ndao,Sumba Barat Daya,Sumba Tengah,Manggarai Timur,Sabu Raijua,Malaka',
  'Maluku': 'Kepulauan Tanimbar,Maluku Tenggara,Seram Bagian Barat,Kepulauan Aru,Maluku Barat Daya,Buru Selatan',
  'Papua': 'Biak Numfor,Kepulauan Yapen,Kota Jayapura,Sarmi,Keerom,Waropen,Supiori,Mamberamo Raya',
  'Maluku Utara': 'Halmahera Tengah,Kota Tidore Kepulauan',
  'Kepulauan Bangka Belitung': 'Belitung,Bangka Selatan',
  'Gorontalo': 'Boalemo',
  'Kepulauan Riau': 'Kepulauan Anambas,Kota Tanjungpinang',
  'Papua Barat': 'Teluk Bintuni,Teluk Wondama,Kaimana,Manokwari Selatan,Pegunungan Arfak',
  'Sulawesi Barat': 'Mamasa,Pasangkayu',
  'Kalimantan Utara': 'Malinau,Nunukan,Tana Tidung',
  'Papua Selatan': 'Merauke,Mappi,Asmat',
  'Papua Tengah': 'Puncak Jaya,Dogiyai,Puncak,Intan Jaya',
  'Papua Pegunungan': 'Jayawijaya,Yahukimo,Pegunungan Bintang,Tolikara,Mamberamo Tengah,Yalimo,Lanny Jaya,Nduga',
  'Papua Barat Daya': 'Raja Ampat,Sorong Selatan,Maybrat'
};

/* Beberapa nama ditulis lebih pendek di berkas rekap daripada di daftar
   wilayah. Yang dipakai mencocokkan tetap nama resminya; yang berbeda hanya
   tulisan di kertas. */
const LABEL_PROV = { 'Kepulauan Bangka Belitung': 'Bangka Belitung' };
const LABEL_KAB  = {
  'Kepulauan Siau Tagulandang Biaro': 'Kab. Kep. Siau Tagulandang Biaro',
  'Pangkajene dan Kepulauan':         'Kab. Pangkajene Kepulauan',
  'Kota Lubuklinggau':                'Kota Lubuk Linggau',
  'Ogan Komering Ulu Timur':          'Kab. OKU Timur',
  'Kota Tanjungpinang':               'Kota Tanjung Pinang',
  'Kota Parepare':                    'Kota Pare-pare'
};

const labelKab = nama => LABEL_KAB[nama] || (/^kota\b/i.test(nama) ? nama : 'Kab. ' + nama);

const pisah = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);

/** Daerah satu provinsi, urut seperti berkas rekap; yang belum disebut di
    URUT menyusul di bawahnya menurut abjad. */
function kabUrut(prov, daftarWilayah) {
  const ada = pisah(daftarWilayah);
  const mau = pisah(URUT[prov]).filter(k => ada.indexOf(k) > -1);
  return mau.concat(ada.filter(k => mau.indexOf(k) < 0).sort());
}

/** Seluruh baris rekap, urut seperti berkas aslinya. */
function daftarBaris(kunci) {
  const w = window.WILAYAH || {};
  const urutProv = Object.keys(URUT).filter(p => w[p]);
  const sisa = Object.keys(w).filter(p => urutProv.indexOf(p) < 0).sort();
  const baris = [];
  urutProv.concat(sisa).forEach(prov => {
    kabUrut(prov, w[prov]).forEach(kab => {
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

/* Kolom kesesuaian pada tabel Kesimpulan — dan kolom kelengkapan pada tabel
   eMonitoring — hanya berisi centang bila item itu sesuai. Sel kosong ikut
   dianggap sesuai: notulensi yang bagiannya tidak diisi tidak boleh berubah
   menjadi tuduhan adanya ketidaksesuaian. */
const KATA_SESUAI = ['⩗', '√', '✓', 'v', 'ya', 'sesuai', 'ada', 'lengkap'];
const sesuai = v => {
  const s = String(v == null ? '' : v).trim().toLowerCase();
  return !s || KATA_SESUAI.indexOf(s) > -1;
};

const rata = xs => {
  const a = xs.filter(x => x != null);
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
};

const bulat = v => (v == null ? null : Math.round(v * 100) / 100);

const KOLOM_EMON = ['dataKontrak', 'dataProgres', 'dataTenagaKerja', 'fotoKegiatan'];

function turunkan(rekaman) {
  const d = (rekaman && rekaman.data) || {};
  const progres = Array.isArray(d.progres) ? d.progres : [];
  const emon    = Array.isArray(d.emon) ? d.emon : [];
  const kes     = Array.isArray(d.kesimpulan) ? d.kesimpulan : [];

  /* Penyebut seluruh kolom pecahan: banyaknya ruas yang dirapatkan. Tabel
     progres yang jadi acuan; kalau kosong, tabel kesimpulan yang dipakai. */
  const ruas = progres.length || kes.length || emon.length;

  /* Lelang dan kontrak dua tahap berurutan, bukan dua pilihan: ruas yang nilai
     kontraknya sudah terisi berarti sudah lewat lelang, sisanya masih di
     dalamnya. Keduanya tetap bisa diketik ulang di layar bila kenyataannya
     lain — misalnya ruas yang lelangnya gagal dan belum diulang. */
  const kontrak = progres.filter(p => rupiah(p.nilaiKontrak) > 0).length;

  /* PHO belum punya kolomnya sendiri di notulensi; yang paling dekat adalah
     ruas yang progres fisiknya sudah penuh. */
  const pho = progres.filter(p => {
    const f = angka(p.fisik);
    return f != null && f >= 100;
  }).length;

  const fisik    = angka(d.fisikRata);
  const keuangan = angka(d.keuanganRata);

  return {
    ruas,
    emonLengkap: emon.every(r => KOLOM_EMON.every(k => sesuai(r[k]))),
    lelang:     Math.max(0, ruas - kontrak),
    terkontrak: kontrak,
    jenis: kes.every(k => sesuai(k.jenisPenanganan)),
    bahu:  kes.every(k => sesuai(k.bahu)),
    marka: kes.every(k => sesuai(k.marka)),
    fisik:    bulat(fisik    != null ? fisik    : rata(progres.map(p => angka(p.fisik)))),
    keuangan: bulat(keuangan != null ? keuangan : rata(progres.map(p => angka(p.keuangan)))),
    pho,
    keterangan: String(d.permasalahanUtama || '').replace(/\s+/g, ' ').trim()
  };
}

const waktuAngka = t => (t && typeof t.toMillis === 'function') ? t.toMillis() : Number(t || 0);

/** Satu daerah bisa punya beberapa berita acara — rapat ulang, salinan petugas
    lain, atau perbaikan yang diimpor belakangan. Yang dipakai rekap adalah
    yang PALING BARU MASUK ke arsip; bila dua-duanya masuk pada saat yang sama,
    tanggal rapat yang lebih baru menang. Urutan ini juga yang dipakai daftar
    pilihan di layar, sehingga yang teratas selalu yang terbaru. */
function urutTerbaru(daftar) {
  return daftar.slice().sort((a, b) =>
    waktuAngka(b.diperbaruiAt) - waktuAngka(a.diperbaruiAt) ||
    String(b.tanggalIso || '').localeCompare(String(a.tanggalIso || '')));
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
    const daftar = punya ? urutTerbaru(punya) : [];
    return Object.assign({}, b, {
      daftar,
      pilih: 0,
      ada: daftar.length > 0,
      isi: daftar.length ? turunkan(daftar[0]) : null
    });
  });

  /* Rekapnya harus berisi tepat 164 daerah penerima DAK — tidak lebih. Berita
     acara yang nama daerahnya di luar daftar itu (salah ketik, atau daerah
     yang memang bukan penerima) karena itu tidak ikut ke berkas. Tetapi tidak
     boleh hilang diam-diam juga: namanya disebut di layar supaya ketahuan dan
     bisa dibetulkan di arsipnya. */
  const luar = Object.keys(perDaerah).map(k => ({
    daerah: (urutTerbaru(perDaerah[k])[0].daerah || '(tanpa daerah)'),
    jumlah: perDaerah[k].length
  })).sort((a, b) => a.daerah.localeCompare(b.daerah));

  return { baris, luar };
}


/* ═══════════════════════════════════════════════════════════════
   3. PENULIS .XLSX
   Bentuknya menirukan berkas rekap aslinya sampai ke lebar kolom dan tinggi
   barisnya: judul menyatu di baris pertama, kepala tabel dua tingkat, seluruh
   sel bergaris, dan angka tetap angka sehingga masih bisa dihitung di Excel.
   ═══════════════════════════════════════════════════════════════ */
const xmlAman = s => String(s == null ? '' : s)
  .replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
  .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

/* Nomor gaya pada cellXfs di bawah. */
const G_JUDUL = 1, G_KEPALA = 2, G_KIRI = 3, G_TENGAH = 4, G_KOSONG = 5, G_KET = 6;

const GAYA = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="4">
<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="14"/><name val="Arial"/><family val="2"/></font>
<font><b/><sz val="10"/><name val="Arial"/><family val="2"/></font>
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
<cellXfs count="7">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

const KOLOM = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
const LEBAR = [26.43, 30, 23.29, 8.86, 8.86, 14, 10.71, 10.71, 11.14, 11.14, 11.14, 28.42];

/** Satu sel; `v` boleh angka, teks, atau null untuk sel kosong yang tetap
    bergaris — baris daerah tanpa berita acara memakai bentuk itu. */
function sel(ref, gaya, v) {
  if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}" s="${gaya}"><v>${v}</v></c>`;
  const t = xmlAman(v);
  if (!t) return `<c r="${ref}" s="${gaya}"/>`;
  return `<c r="${ref}" s="${gaya}" t="inlineStr"><is><t xml:space="preserve">${t}</t></is></c>`;
}

const barisXml = (nomor, isi, tinggi) =>
  `<row r="${nomor}" spans="1:12"${tinggi ? ` ht="${tinggi}" customHeight="1"` : ''}>${isi}</row>`;

function lembarXml(judul, baris) {
  const kepala =
    barisXml(1, KOLOM.map(k => sel(k + '1', G_JUDUL, k === 'A' ? judul : null)).join(''), 50.25) +
    barisXml(2, [
      sel('A2', G_KEPALA, 'Provinsi'), sel('B2', G_KEPALA, 'Nama Daerah'),
      sel('C2', G_KEPALA, 'Kelengkapan\nData E-Mon'),
      sel('D2', G_KEPALA, 'Proses Lelang'), sel('E2', G_KEPALA, 'Ter-kontrak'),
      sel('F2', G_KEPALA, 'Kesesuaian Item'), sel('G2', G_KEPALA, null), sel('H2', G_KEPALA, null),
      sel('I2', G_KEPALA, 'Rerata Progres\n(%)'), sel('J2', G_KEPALA, null),
      sel('K2', G_KEPALA, 'PHO'),
      sel('L2', G_KEPALA, 'Keterangan')
    ].join(''), 34.5) +
    barisXml(3, [
      sel('A3', G_KEPALA, null), sel('B3', G_KEPALA, null), sel('C3', G_KEPALA, null),
      sel('D3', G_KEPALA, null), sel('E3', G_KEPALA, null),
      sel('F3', G_KEPALA, 'Jenis Penanganan'), sel('G3', G_KEPALA, 'Bahu'), sel('H3', G_KEPALA, 'Marka'),
      sel('I3', G_KEPALA, 'Fisik'), sel('J3', G_KEPALA, 'Keuangan'),
      sel('K3', G_KEPALA, null), sel('L3', G_KEPALA, null)
    ].join(''), 30);

  const isi = baris.map((b, i) => {
    const n = i + 4;
    const tanda   = v => (v ? CENTANG : STRIP);
    const pecahan = v => `${v}/${b.isi.ruas}`;
    const nilai = b.ada ? [
      sel('C' + n, G_TENGAH, b.isi.emonLengkap ? LENGKAP : BELUM),
      sel('D' + n, G_TENGAH, pecahan(b.isi.lelang)),
      sel('E' + n, G_TENGAH, pecahan(b.isi.terkontrak)),
      sel('F' + n, G_TENGAH, tanda(b.isi.jenis)),
      sel('G' + n, G_TENGAH, tanda(b.isi.bahu)),
      sel('H' + n, G_TENGAH, tanda(b.isi.marka)),
      sel('I' + n, G_TENGAH, b.isi.fisik),
      sel('J' + n, G_TENGAH, b.isi.keuangan),
      sel('K' + n, G_TENGAH, pecahan(b.isi.pho)),
      sel('L' + n, G_KET, b.isi.keterangan)
    ] : ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].map(k => sel(k + n, G_KOSONG, null));

    return barisXml(n, [
      sel('A' + n, G_KIRI, b.labelProv), sel('B' + n, G_KIRI, b.labelKab)
    ].concat(nilai).join(''), 18);
  }).join('');

  const lebar = LEBAR.map((w, j) =>
    `<col min="${j + 1}" max="${j + 1}" width="${w}" customWidth="1"/>`).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="A1:L${baris.length + 3}"/>
<sheetViews><sheetView tabSelected="1" workbookViewId="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="14.25"/>
<cols>${lebar}</cols>
<sheetData>${kepala}${isi}</sheetData>
<mergeCells count="10"><mergeCell ref="A1:L1"/><mergeCell ref="A2:A3"/><mergeCell ref="B2:B3"/><mergeCell ref="C2:C3"/><mergeCell ref="D2:D3"/><mergeCell ref="E2:E3"/><mergeCell ref="F2:H2"/><mergeCell ref="I2:J2"/><mergeCell ref="K2:K3"/><mergeCell ref="L2:L3"/></mergeCells>
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
   boleh diklik untuk dibalik, angka dan keterangannya boleh diketik ulang,
   dan daerah yang punya lebih dari satu berita acara boleh dipindah ke
   berita acara lain. Yang diubah di sini tidak menyentuh arsip — hanya
   berkas yang akan keluar.
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

/** "12 Agt 14.20" — cukup untuk membedakan dua berita acara daerah yang sama. */
function waktuSingkat(t) {
  const ms = waktuAngka(t);
  if (!ms) return 'tanpa waktu simpan';
  const d = new Date(ms);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
    + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

const labelBa = r => `${r.tanggalTeks || r.tanggalIso || 'tanpa tanggal'}`
  + `${r.penyusun ? ' · ' + r.penyusun : ''} · masuk ${waktuSingkat(r.diperbaruiAt)}`;

const tombolTanda = (i, k, aktif) => `
  <button type="button" data-rekap-balik="${i}" data-kolom="${k}"
          title="Klik untuk membalik — centang berarti sesuai"
          class="h-7 w-7 rounded-lg text-[13px] font-semibold transition ${aktif
            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
            : 'bg-rose-100 text-rose-600 hover:bg-rose-200'}">${aktif ? CENTANG : STRIP}</button>`;

const kotakAngka = (i, k, v) => `
  <input type="number" step="0.01" min="0" max="100" data-rekap-angka="${i}" data-kolom="${k}"
         value="${v == null ? '' : v}" placeholder="—"
         class="w-[68px] rounded-lg border border-slate-200 px-2 py-1 text-right text-[12.5px] tabular-nums text-slate-700 outline-none focus:border-slate-400" />`;

/** Kolom pecahan "x/y": hanya pembilangnya yang diketik di sini, penyebutnya
    jumlah ruas yang dipakai bersama ketiga kolom pecahan. */
const kotakPecahan = (i, k, v, ruas) => `
  <span class="inline-flex items-center gap-1 text-[12.5px] tabular-nums text-slate-400">
    <input type="number" step="1" min="0" max="${ruas}" data-rekap-cacah="${i}" data-kolom="${k}"
           value="${v == null ? '' : v}"
           class="w-[46px] rounded-lg border border-slate-200 px-2 py-1 text-right text-[12.5px] tabular-nums text-slate-700 outline-none focus:border-slate-400" />
    /${ruas}
  </span>`;

function barisTampil(b, i) {
  if (!b.ada) {
    return `
      <tr class="border-t border-slate-100 bg-slate-50/60 align-middle text-slate-400">
        <td class="px-3 py-2 text-[12px]">${aman(b.labelProv.replace(/^Provinsi /, ''))}</td>
        <td class="px-3 py-2 text-[12.5px]">${aman(b.labelKab)}</td>
        <td colspan="9" class="px-3 py-2 text-[12px] italic">belum ada berita acara</td>
        <td class="px-3 py-2"></td>
      </tr>`;
  }
  const dipakai = b.daftar[b.pilih];
  return `
    <tr class="border-t border-slate-100 align-middle">
      <td class="px-3 py-2 text-[12px] text-slate-500">${aman(b.labelProv.replace(/^Provinsi /, ''))}</td>
      <td class="px-3 py-2">
        <p class="text-[12.5px] font-medium text-slate-800">${aman(b.labelKab)}</p>
        ${b.daftar.length > 1 ? `
          <select data-rekap-ba="${i}" title="Daerah ini punya ${b.daftar.length} berita acara — yang teratas paling baru masuk arsip"
                  class="mt-1 w-full max-w-[240px] rounded-lg border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-800 outline-none">
            ${b.daftar.map((r, j) => `<option value="${j}" ${j === b.pilih ? 'selected' : ''}>${aman(labelBa(r))}</option>`).join('')}
          </select>`
        : `<p class="mt-0.5 text-[11px] text-slate-400">${aman(labelBa(dipakai))}</p>`}
      </td>
      <td class="px-2 py-2 text-center">
        <input type="number" step="1" min="0" data-rekap-ruas="${i}" value="${b.isi.ruas}"
               title="Jumlah ruas — penyebut kolom lelang, kontrak, dan PHO"
               class="w-[52px] rounded-lg border border-slate-200 px-2 py-1 text-right text-[12.5px] tabular-nums text-slate-700 outline-none focus:border-slate-400" />
      </td>
      <td class="px-2 py-2 text-center">
        <button type="button" data-rekap-emon="${i}"
                title="Klik untuk membalik"
                class="rounded-lg px-2 py-1 text-[11.5px] font-medium transition ${b.isi.emonLengkap
                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                  : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}">${b.isi.emonLengkap ? LENGKAP : BELUM}</button>
      </td>
      <td class="px-2 py-2 text-center">${kotakPecahan(i, 'lelang', b.isi.lelang, b.isi.ruas)}</td>
      <td class="px-2 py-2 text-center">${kotakPecahan(i, 'terkontrak', b.isi.terkontrak, b.isi.ruas)}</td>
      <td class="px-2 py-2 text-center">${tombolTanda(i, 'jenis', b.isi.jenis)}</td>
      <td class="px-2 py-2 text-center">${tombolTanda(i, 'bahu', b.isi.bahu)}</td>
      <td class="px-2 py-2 text-center">${tombolTanda(i, 'marka', b.isi.marka)}</td>
      <td class="whitespace-nowrap px-2 py-2 text-center">
        ${kotakAngka(i, 'fisik', b.isi.fisik)} ${kotakAngka(i, 'keuangan', b.isi.keuangan)}
      </td>
      <td class="px-2 py-2 text-center">${kotakPecahan(i, 'pho', b.isi.pho, b.isi.ruas)}</td>
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
  const kembar = BARIS.filter(b => b.daftar.length > 1).length;

  m.querySelector('#baRekapIsi').innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-[12.5px] text-slate-500">
        <span class="font-semibold text-slate-800">${terisi}</span> daerah sudah punya berita acara,
        dari ${BARIS.length} daerah penerima DAK.${kembar
          ? ` ${kembar} daerah punya lebih dari satu — yang dipakai berita acara terbaru.`
          : ''}
      </p>
      <label class="flex cursor-pointer items-center gap-2 text-[12.5px] text-slate-600">
        <input type="checkbox" id="baRekapSemua" ${SEMUA ? 'checked' : ''} class="h-4 w-4 accent-slate-900" />
        Sertakan daerah yang belum ada berita acaranya
      </label>
    </div>

    <div class="mt-4 max-h-[52vh] overflow-auto rounded-2xl border border-slate-200">
      <table class="w-full min-w-[1180px] border-collapse text-left">
        <thead class="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_rgba(0,0,0,.06)]">
          <tr class="text-[11px] uppercase tracking-[0.08em] text-slate-500">
            <th class="px-3 py-2.5">Provinsi</th>
            <th class="px-3 py-2.5">Nama daerah</th>
            <th class="px-2 py-2.5 text-center">Ruas</th>
            <th class="px-2 py-2.5 text-center">Data e-Mon</th>
            <th class="px-2 py-2.5 text-center">Lelang</th>
            <th class="px-2 py-2.5 text-center">Terkontrak</th>
            <th class="px-2 py-2.5 text-center">Jenis</th>
            <th class="px-2 py-2.5 text-center">Bahu</th>
            <th class="px-2 py-2.5 text-center">Marka</th>
            <th class="px-2 py-2.5 text-center">Fisik / Keuangan</th>
            <th class="px-2 py-2.5 text-center">PHO</th>
            <th class="px-3 py-2.5">Keterangan</th>
          </tr>
        </thead>
        <tbody>${(SEMUA ? BARIS : BARIS.filter(b => b.ada))
          .map(b => barisTampil(b, BARIS.indexOf(b))).join('')}</tbody>
      </table>
    </div>

    ${LUAR.length ? `
      <p class="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-[12.5px] leading-[1.6] text-amber-800">
        ${LUAR.length} berita acara tidak masuk rekap karena daerahnya di luar ${BARIS.length} penerima DAK:
        ${aman(LUAR.map(x => x.daerah).join(', '))}. Betulkan nama daerahnya di arsip bila itu salah ketik.
      </p>` : ''}
    ${PESAN ? `<p class="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-[12.5px] text-emerald-800">${aman(PESAN)}</p>` : ''}`;

  const unduh = m.querySelector('#baRekapUnduh');
  unduh.disabled = SIBUK || !terisi;
  unduh.textContent = SIBUK ? 'Menyusun…' : `Unduh Excel (${barisTerpakai().length} baris)`;

  m.querySelector('#baRekapSemua').onchange = e => { SEMUA = e.target.checked; render(); };

  /* Pindah ke berita acara lain daerah yang sama: seluruh kolomnya diturunkan
     ulang dari notulensi yang dipilih, termasuk yang tadi sudah dibetulkan
     tangan — memang begitu yang diharapkan, isinya berasal dari dokumen lain. */
  m.querySelectorAll('[data-rekap-ba]').forEach(s => s.onchange = () => {
    const b = BARIS[+s.dataset.rekapBa];
    b.pilih = +s.value;
    b.isi = turunkan(b.daftar[b.pilih]);
    PESAN = '';
    render();
  });

  m.querySelectorAll('[data-rekap-balik]').forEach(t => t.onclick = () => {
    const b = BARIS[+t.dataset.rekapBalik];
    b.isi[t.dataset.kolom] = !b.isi[t.dataset.kolom];
    PESAN = '';
    render();
  });

  m.querySelectorAll('[data-rekap-emon]').forEach(t => t.onclick = () => {
    const b = BARIS[+t.dataset.rekapEmon];
    b.isi.emonLengkap = !b.isi.emonLengkap;
    PESAN = '';
    render();
  });

  /* Jumlah ruas adalah penyebut ketiga kolom pecahan; menurunkannya ikut
     memangkas pembilang yang jadi melebihi penyebutnya. */
  m.querySelectorAll('[data-rekap-ruas]').forEach(inp => inp.onchange = () => {
    const b = BARIS[+inp.dataset.rekapRuas];
    const v = Math.max(0, Math.round(Number(inp.value) || 0));
    b.isi.ruas = v;
    ['lelang', 'terkontrak', 'pho'].forEach(k => { b.isi[k] = Math.min(b.isi[k], v); });
    render();
  });

  m.querySelectorAll('[data-rekap-cacah]').forEach(inp => inp.onchange = () => {
    const b = BARIS[+inp.dataset.rekapCacah];
    const v = Math.round(Number(inp.value) || 0);
    b.isi[inp.dataset.kolom] = Math.min(Math.max(0, v), b.isi.ruas);
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
      <div class="w-full max-w-[1400px] rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-2xl md:p-8">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Berita acara</p>
            <h3 class="mt-1.5 text-[20px] font-semibold text-slate-900">Rekapitulasi ke Excel</h3>
            <p class="mt-2 max-w-[860px] text-[13px] leading-[1.65] text-slate-500">
              Seluruh berita acara dirangkum menjadi satu lembar berformat rekapitulasi rakor.
              Setiap daerah memakai berita acara yang paling baru masuk arsip; daerah yang punya
              lebih dari satu bisa dipindah lewat daftar di kolom namanya. Centang berarti
              <span class="font-medium text-slate-700">sesuai</span> — klik untuk membalik, ketik
              ulang angka atau keterangan yang perlu diperbaiki. Perubahan di sini hanya
              memengaruhi berkas yang diunduh, arsipnya tidak ikut berubah.
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
