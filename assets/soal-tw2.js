/* ══════════════════════════════════════════════════════════════════
   BANK SOAL — TRIWULAN II
   Sumber : "Kuis Pilihan Ganda DAK Fisik Bidang Jalan (TW II & III)"
            SE Menteri Pekerjaan Umum Nomor 5/SE/Mn/2026
   Jumlah : 25 soal. Setiap peserta mengerjakan 20 soal yang diambil
            acak dari 25 soal ini; urutan soal dan urutan opsi diacak
            ulang pada setiap sesi.
   Format : id  = kode stabil, JANGAN diubah setelah ada nilai masuk
                  (dipakai untuk menyusun ulang pembahasan)
            q   = pertanyaan
            o   = opsi dalam urutan asli dokumen [A, B, C, D]
            a   = indeks opsi yang benar pada urutan asli (0 = A)
            ref = dasar hukum / referensi
   Catatan: dokumen sumber memuat dua soal bernomor 16 (jalan dan
            jembatan); di sini dinomori ulang menjadi tw2-13 dan tw2-14.
            Pada soal jembatan, teks opsi A dokumen tertulis
            "Meter persegi (m²)" sedangkan kuncinya "A. Meter (M)";
            teks opsi mengikuti kunci, yaitu "Meter (m)".
   ══════════════════════════════════════════════════════════════════ */
window.SOAL_TW2 = [
  { id:"tw2-01",
    q:"Kapan batas waktu (deadline) penyampaian laporan progres fisik dan keuangan DAK Fisik Bidang Jalan melalui eMonitoring DAK PU setiap triwulan?",
    o:["Paling lambat 3 hari kerja sebelum triwulan berakhir",
       "Paling lambat 7 hari kerja setelah triwulan yang bersangkutan berakhir",
       "Paling lambat 14 hari kalender setelah triwulan berakhir",
       "Paling lambat tanggal 15 bulan berikutnya"], a:1,
    ref:"Lampiran II SE Menteri PU No. 5/SE/Mn/2026, Bagian A.1.d (Kepatuhan Pelaporan eMonitoring DAK PU)." },

  { id:"tw2-02",
    q:"Manakah di bawah ini dokumen teknis yang TIDAK termasuk diverifikasi oleh Balai (BBPJN/BPJN) saat peninjauan lapangan awal pelaksanaan konstruksi?",
    o:["Dokumen Rencana Kegiatan (RK) DAK TA berjalan",
       "Dokumen Perencanaan Teknis / DED (RAB, Gambar Rencana, Spesifikasi)",
       "Dokumen Hasil Audit BPK RI Tahun Lalu",
       "Dokumen Kontrak Pekerjaan Konstruksi dan Foto Progres 0% & 25%"], a:2,
    ref:"Lampiran II Bagian A.3.b." },

  { id:"tw2-03",
    q:"Pemerintah Daerah dengan kriteria manakah yang diprioritaskan untuk dilakukan peninjauan lapangan langsung oleh Tim Pusat (PFID & Ditjen Bina Marga)?",
    o:["Pemda dengan progres DAK Fisik terendah dan Pemda dengan progres tertinggi",
       "Seluruh Pemda di Indonesia tanpa terkecuali",
       "Hanya Pemda yang mengajukan permohonan tertulis",
       "Pemda yang memiliki alokasi anggaran di bawah Rp 1 Miliar"], a:0,
    ref:"Lampiran II Bagian A.3.d." },

  { id:"tw2-04",
    q:"Berikut ini adalah parameter teknis yang ditinjau saat peninjauan lapangan pekerjaan jalan pada Triwulan II/III, KECUALI:",
    o:["Kesesuaian ruas jalan yang dilaksanakan dengan Rencana Kegiatan (RK)",
       "Kesesuaian jenis penanganan konstruksi (bahu jalan, marka, drainase)",
       "Kesesuaian besaran tarif retribusi daerah Pemda setempat",
       "Kesesuaian target penanganan (input) dengan capaian keluaran (output)"], a:2,
    ref:"Lampiran II Bagian A.3.c." },

  { id:"tw2-05",
    q:"Sesuai ketentuan teknis SE No. 5/2026, material apakah yang wajib digunakan untuk pekerjaan marka jalan pada DAK Fisik Bidang Jalan?",
    o:["Cat Minyak biasa","Bahan Thermoplastic","Cat Air berbasis Akrilik","Stiker Reflektif biasa"], a:1,
    ref:"Lampiran I Bagian A.3.e.1." },

  { id:"tw2-06",
    q:"Sistem informasi apakah yang dikelola oleh PFID untuk pemantauan, evaluasi, dan pelaporan pelaksanaan kegiatan DAK Fisik Bidang Jalan?",
    o:["SIMPONI","eMonitoring DAK PU","SIKRI","SPSE Nasional"], a:1,
    ref:"Batang Tubuh Huruf G Angka 3 & Lampiran II Bagian A.1." },

  { id:"tw2-07",
    q:"Pihak manakah yang bertanggung jawab sepenuhnya atas kebenaran data dan informasi yang dimasukkan ke dalam aplikasi eMonitoring DAK PU?",
    o:["Pusat Fasilitasi Infrastruktur Daerah (PFID)",
       "Balai Pelaksanaan Jalan Nasional (BPJN)",
       "Pemerintah Daerah (Dinas Pelaksana)",
       "Kementerian Keuangan"], a:2,
    ref:"Batang Tubuh Huruf G Angka 3 & Lampiran I BA Survei Kondisi." },

  { id:"tw2-08",
    q:"Berapakah batas maksimal Belanja Penunjang DAK Fisik Bidang Jalan dan digunakan untuk kegiatan apa saja?",
    o:["Maksimal 10%, untuk bonus pekerja",
       "Maksimal 5%, untuk biaya pengendalian, konsultan pengawas, dan rakor provinsi",
       "Maksimal 2%, untuk pembelian alat berat",
       "Bebas sesuai keputusan Kepala Daerah"], a:1,
    ref:"Lampiran I Bagian A Format SPTJM (Halaman 18)." },

  { id:"tw2-09",
    q:"Jika terjadi deviasi negatif/keterlambatan pekerjaan fisik pada Triwulan II, rapat pembahasannya wajib diunggah ke eMonitoring beserta prosedur:",
    o:["Pemutusan hubungan kerja sepihak",
       "Show Cause Meeting (SCM) dan Rencana Tindak Lanjut",
       "Penghentian pekerjaan sementara hingga tahun depan",
       "Pengalihan anggaran ke bidang sanitasi"], a:1,
    ref:"Lampiran II Bagian A.2.a & B.1.a." },

  { id:"tw2-10",
    q:"Surat pernyataan ber-meterai Rp 10.000,- yang wajib ditandatangani Kepala Dinas PU terkait keabsahan dokumen teknis dan data adalah:",
    o:["Surat Keterangan Tanah (SKT)",
       "Surat Pernyataan Tanggung Jawab Mutlak (SPTJM)",
       "Surat Izin Usaha Perdagangan (SIUP)",
       "Berita Acara Serah Terima Aset (BASTA)"], a:1,
    ref:"Lampiran I Bagian A Format SPTJM & Lampiran II Bagian A.1.b." },

  { id:"tw2-11",
    q:"Bagaimana prinsip tuntas penanganan jembatan dalam satu tahun anggaran pada DAK Fisik Bidang Jalan?",
    o:["Cukup menyelesaikan fondasi/bangunan bawah saja",
       "Wajib tuntas menyelesaikan bangunan atas dan bangunan bawah",
       "Cukup pengadaan gelagar baja saja",
       "Dikerjakan bertahap selama 3 tahun anggaran"], a:1,
    ref:"Lampiran I Bagian A.3.e.3." },

  { id:"tw2-12",
    q:"Indikator keluaran (Output) kegiatan penanganan jalan DAK Fisik dihitung dalam satuan:",
    o:["Meter persegi (m²)","Kilometer (km)","Tonase aspal","Persentase anggaran"], a:1,
    ref:"Lampiran II Bagian A.1.b." },

  { id:"tw2-13",
    q:"Indikator keluaran (Output) kegiatan penanganan jembatan DAK Fisik dihitung dalam satuan:",
    o:["Meter (m)","Kilometer (km)","Tonase aspal","Persentase anggaran"], a:0,
    ref:"Lampiran II Bagian A.1.b." },

  { id:"tw2-14",
    q:"Manakah yang termasuk indikator Manfaat Jangka Pendek (Immediate Outcome) penanganan jalan DAK Fisik?",
    o:["Jumlah unit alat berat yang dibeli",
       "Peningkatan kemantapan jalan (%) dan kecepatan rata-rata waktu tempuh (km/jam)",
       "Jumlah tenaga kerja lokal yang diresmikan",
       "Nilai sisa tender kontraktual"], a:1,
    ref:"Lampiran II Bagian A.1.c." },

  { id:"tw2-15",
    q:"Dalam rumus perhitungan Immediate Outcome Kemantapan Jalan, penyebut (divider) dari rumus tersebut adalah:",
    o:["Panjang penanganan DAK saja",
       "Panjang Total SK Status Jalan Daerah yang bersangkutan (km)",
       "Panjang jalan nasional di provinsi tersebut",
       "Panjang jalan rusak berat saja"], a:1,
    ref:"Lampiran II Bagian A.1.c Tabel Rumus Perhitungan IO Jalan." },

  { id:"tw2-16",
    q:"Berdasarkan Sistem Manajemen Jembatan (BMS), Nilai Kondisi berapakah yang dikategorikan sebagai jembatan MANTAP?",
    o:["Nilai Kondisi 0 dan 1","Nilai Kondisi 2 dan 3","Nilai Kondisi 4 dan 5","Nilai Kondisi di atas 5"], a:0,
    ref:"Lampiran II Bagian A.1.c Tabel Rumus Perhitungan IO Jembatan." },

  { id:"tw2-17",
    q:"Dokumen resmi utama yang membuktikan pencapaian realisasi fisik (Output 100%) pekerjaan penanganan jalan adalah:",
    o:["Surat Perintah Kerja (SPK)","Provisional Hand Over (PHO)","Nota Dinas Dinas PU","Kuitansi Pembayaran Uang Muka"], a:1,
    ref:"Lampiran II Bagian A.1.a & A.1.b." },

  { id:"tw2-18",
    q:"Dokumen manakah yang WAJIB dilampirkan Pemda saat menyampaikan pelaporan Immediate Outcome di eMonitoring DAK PU?",
    o:["Dokumen Perda APBD dan Laporan Keuangan Audit BPK",
       "Data kondisi sebelum-sesudah, survei kecepatan, foto 0%-50%-100%, dan SPTJM",
       "Izin Usaha Jasa Konstruksi (IUJK) seluruh penyedia",
       "Sertifikat tanah milik warga sekitar"], a:1,
    ref:"Lampiran I Bagian A.2.c.6 & Lampiran II Bagian A.1.c." },

  { id:"tw2-19",
    q:"Berita Acara Verifikasi Output dan Immediate Outcome DAK Fisik Bidang Jalan wajib ditandatangani oleh unsur:",
    o:["PFID Pusat, Verifikator Balai, dan Kepala Daerah",
       "Verifikator I Pusat, Verifikator II Pusat, dan Petugas Teknis Pemda",
       "Kontraktor, Konsultan Pengawas, dan Camat",
       "Inspektur Daerah dan Auditor BPKP"], a:1,
    ref:"Lampiran II Bagian A Format Berita Acara Verifikasi (Halaman 49)." },

  { id:"tw2-20",
    q:"Foto dokumentasi pekerjaan fisik DAK Jalan yang diunggah ke sistem eMonitoring wajib memenuhi kriteria:",
    o:["Diambil dari kamera DSLR mahal",
       "Diambil dari sudut lokasi sama (0%, 50%, 100%), ber-geotagged (koordinat), dan mencantumkan STA & tanggal",
       "Hanya foto tampak depan kantor dinas",
       "Cukup foto editan tanpa koordinat"], a:1,
    ref:"Lampiran I Bagian A.2.c.4 & Lampiran II Bagian A.3.b.4." },

  { id:"tw2-21",
    q:"Kementerian/Lembaga mana saja yang terlibat dalam Rapat Koordinasi Evaluasi DAK Fisik Bidang Jalan tingkat Pusat?",
    o:["Kemen PU, Bappenas, dan Kementerian Keuangan",
       "Kemen PU dan Kementerian Perhubungan",
       "Kementerian Perhubungan dan Kepolisian RI",
       "Kemen PU dan Kementerian BUMN"], a:0,
    ref:"Lampiran II Bagian A.2.b." },

  { id:"tw2-22",
    q:"Jika terjadi perubahan penanganan di lapangan akibat kondisi tak terduga (force majeure) pada Triwulan II/III, prosedur administratif yang benar adalah:",
    o:["Mengubah pekerjaan secara diam-diam tanpa laporan",
       "Menyusun Justifikasi Teknis, konsultasi ke Balai Jalan dan PFID, dan usulan revisi RK di KRISNA",
       "Membatalkan seluruh kontrak pekerjaan",
       "Mengalihkan sisa uang ke proyek lain"], a:1,
    ref:"Lampiran II Bagian B.1.a & Format Pemantauan Pekerjaan Fisik." },

  { id:"tw2-23",
    q:"Pada eMonitoring DAK PU, informasi data penyerapan tenaga kerja diinput pada menu:",
    o:["Data Perencanaan","Data Kontrak","Data Usulan Bencana","Data Sertifikasi Tanah"], a:1,
    ref:"Lampiran I Bagian A.2.c.2 & Lampiran II Format Pemantauan Halaman 43." },

  { id:"tw2-24",
    q:"Apa saja komponen perkerasan lentur (aspal) yang diverifikasi ketebalannya sesuai resume DAK Jalan?",
    o:["Hanya batu kali saja",
       "Lapis Fondasi Agregat (A/B/C), AC-Base/AC-BC/AC-WC dan HRS-Base/HRS-WC",
       "Pasangan bata merah dan semen",
       "Tanah urugan lokal"], a:1,
    ref:"Lampiran I Format Resume Kegiatan DAK (Halaman 22-23)." },

  { id:"tw2-25",
    q:"Mengapa laporan evaluasi kinerja DAK Fisik Triwulan II dan III yang disusun PFID disampaikan kepada Menteri PU?",
    o:["Sekadar formalitas pengisian arsip",
       "Sebagai pertimbangan perumusan kebijakan DAK Fisik dan penghitungan alokasi DAK tahun berikutnya",
       "Untuk dipublikasikan di koran nasional",
       "Sebagai syarat kenaikan pangkat pejabat dinas"], a:1,
    ref:"Batang Tubuh Huruf G Angka 10 & 11." }
];

/* Aturan penilaian */
window.ATURAN = {
  twAktif: 2,          // hanya Triwulan II yang dinilai untuk saat ini
  jumlahSoal: 20,      // soal yang dikerjakan, diambil acak dari bank di atas
  nilaiPerSoal: 5,     // 20 x 5 = nilai maksimal 100
  durasiMenit: 20      // batas waktu; sesi dikirim otomatis saat habis
};
