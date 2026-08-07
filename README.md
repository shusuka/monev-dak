# MonevDAK

Pre test dan post test pelaksanaan monitoring & evaluasi **DAK Fisik Bidang Jalan**, berbasis Surat Edaran Menteri Pekerjaan Umum Nomor 5/SE/Mn/2026.

Situs statis tanpa proses build: HTML + Tailwind (CDN) + JavaScript biasa, dengan Firebase Firestore sebagai basis data.

---

## Aturan penilaian

| Ketentuan | Nilai |
|---|---|
| Periode yang dinilai | **Triwulan II** saja (TW I, III, IV menyusul) |
| Bank soal | 25 soal |
| Dikerjakan tiap sesi | **20 soal**, diambil acak dari 25 |
| Bobot | 5 poin per soal → **nilai maksimal 100** |
| Batas waktu | 20 menit, sesi dikirim otomatis saat habis |
| Pengacakan | Urutan soal **dan** urutan opsi A–D diacak ulang setiap kali peserta masuk |
| Sesi per peserta | 1 pre test + 1 post test; sekali kirim, tidak dapat diulang |
| Urutan sesi | **Post test terkunci** sampai pre test selesai |
| Peringkat | Jumlah jawaban **benar** terbanyak; bila sama, **waktu penyelesaian** tercepat |

Kartu sesi di dashboard peserta berwarna **hijau** bila sesi siap dikerjakan atau sudah selesai, dan **merah** bila masih terkunci.

Mengubah aturan: `assets/soal-tw2.js` → objek `window.ATURAN`.
Mengubah/menambah soal: `assets/soal-tw2.js` → array `window.SOAL_TW2`.

> Jangan mengubah nilai `id` soal setelah ada nilai yang masuk — `id` dipakai untuk menyusun ulang pembahasan dari data yang tersimpan.

---

## Struktur berkas

```
monev-dak/
├── index.html                 aplikasi (landing, login, kuis, hasil, peringkat)
├── assets/
│   ├── wilayah.js             164 daerah penerima DAK di 33 provinsi (autocomplete)
│   ├── soal-tw2.js            bank soal TW II + aturan penilaian
│   ├── firebase-config.js     konfigurasi Firebase
│   ├── berita-acara.js        menu Berita Acara eMonitoring (khusus akun PFID)
│   ├── ba-template.docx       template notulensi — JANGAN diedit di Word
│   └── logo-pu.png            logo Kementerian PU — LETAKKAN BERKASNYA DI SINI
├── firestore.rules            security rules, tempel di Firebase Console
├── vercel.json                konfigurasi hosting statis
└── README.md
```

---

## 1. Menjalankan secara lokal

Klik dua kali `index.html`, atau:

```bash
npx serve .
```

Selama `assets/firebase-config.js` masih kosong — atau berkas dibuka lewat `file://` — aplikasi berjalan dalam **mode lokal**: data tersimpan di `localStorage` peramban dan papan peringkat diisi 14 data contoh. Sebuah pita kuning muncul di kiri bawah sebagai penanda. Pada mode ini pendaftaran dan masuk tetap berjalan, tetapi kata sandi tidak diperiksa dan pengaturan ulang kata sandi tidak tersedia.

Untuk mencoba jalur Firebase, isi konfigurasi lalu jalankan lewat `npx serve .` (bukan `file://`, karena modul Firebase memerlukan http/https).

---

## 2. Menyiapkan Firebase

1. Buka [console.firebase.google.com](https://console.firebase.google.com) → **Add project**.
2. **Build → Firestore Database → Create database** → pilih lokasi `asia-southeast2` (Jakarta) → mulai dalam *production mode*.
3. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable.**
   **Langkah ini wajib.** Peserta mendaftar dan masuk dengan email dan kata sandi; tanpa metode ini diaktifkan, pendaftaran akan ditolak. Provider Anonymous tidak diperlukan.
4. **Project settings → General → Your apps → Web (`</>`)** → daftarkan app → salin objek `firebaseConfig`.
5. Tempel nilainya ke `assets/firebase-config.js`.
6. **Firestore Database → Rules** → tempel seluruh isi `firestore.rules` → **Publish**.
7. **Authentication → Settings → Authorized domains** → tambahkan domain Vercel Anda (mis. `monev-dak.vercel.app`).

### Koleksi yang dibuat

| Koleksi | ID dokumen | Isi |
|---|---|---|
| `peserta` | `uid` akun Firebase | `nama`, `prov`, `kab`, `email`, `uid`, `updatedAt` |
| `hasil` | `{uid}__tw2__pre` / `{uid}__tw2__post` | `pid` (= uid), `uid`, `nama`, `prov`, `kab`, `tw`, `kind`, `benar`, `total`, `nilai`, `durasiMs`, `detail[]`, `selesaiAt` |

Identitas peserta terikat pada akun Firebase, bukan pada ejaan namanya. Peserta yang keluar lalu masuk kembali dengan email dan kata sandinya akan menemukan nilainya utuh, dan `firestore.rules` memastikan seseorang hanya dapat menulis hasil miliknya sendiri.

`detail[]` menyimpan `{ id, ord, pick }` per soal — `ord` adalah urutan opsi yang ditampilkan ke peserta, sehingga halaman pembahasan dapat direproduksi persis.

Tidak ada composite index yang perlu dibuat: papan peringkat mengambil koleksi `hasil` (limit 1000) lalu diurutkan di sisi klien.

---

## 3. Logo Kementerian PU

Letakkan berkas logo resmi sebagai **`assets/logo-pu.png`** (PNG latar transparan, tinggi minimal 160 px). Berkas itu dipakai di tiga tempat: ikon di hero, lambang di header peserta, dan header admin.

Bila berkas belum ada, aplikasi otomatis menampilkan ikon cadangan berupa penanda peta — jadi halaman tidak pernah tampak rusak. Untuk memakai SVG, ubah `src="assets/logo-pu.png"` menjadi `.svg` pada `index.html` (tiga kemunculan).

---

## 4. Akun admin

Admin dapat memantau progres seluruh pemda, meninjau jawaban tiap peserta, dan mengunduh rekap (CSV dan Excel). Pintu masuknya tombol **Masuk Admin** di footer halaman depan.

### Menyiapkan akun

1. **Authentication → Users → Add user** → isi email dan kata sandi admin. (Metode Email/Password sudah diaktifkan pada langkah 2.3.)
2. Daftarkan email itu sebagai admin di `firestore.rules` — lihat rincian langkahnya di bawah.

**Kelayakan admin ditentukan sepenuhnya oleh `firestore.rules`,** bukan oleh kode aplikasi. Saat seseorang masuk lewat halaman admin, aplikasi mencoba membaca koleksi `peserta`; bila rules menolak, aplikasi langsung mengeluarkannya kembali dengan keterangan bahwa akun itu bukan admin. Jadi tanpa langkah 2, halaman admin tidak dapat dibuka sama sekali.

### Cara mendaftarkan email admin di rules

1. Buka [halaman Rules Firestore](https://console.firebase.google.com/u/0/project/emondak-faee8/firestore/rules). Yang tampil adalah satu kotak teks besar berisi aturan yang sedang berlaku.
2. Pilih semua isi kotak itu (klik di dalamnya lalu `Ctrl+A`) dan hapus.
3. Buka berkas `firestore.rules` dari repositori ini dengan Notepad, salin **seluruh** isinya, lalu tempel ke kotak tadi.
4. Cari bagian ini di dalam kotak — kira-kira sepertiga dari atas:

   ```
   function adminEmail() {
     return [
       'admin@emondak.go.id'
     ];
   }
   ```

5. Ganti `admin@emondak.go.id` dengan email admin yang Anda buat pada langkah 1. **Tanda kutip tunggal harus tetap ada.** Contoh bila emailnya `pfid.monev@pu.go.id`:

   ```
   function adminEmail() {
     return [
       'pfid.monev@pu.go.id'
     ];
   }
   ```

   Untuk dua admin atau lebih, pisahkan dengan koma:

   ```
   return [
     'pfid.monev@pu.go.id',
     'kepala.pfid@pu.go.id'
   ];
   ```

6. Klik tombol **Publish** di kanan atas halaman. Tunggu sampai muncul keterangan bahwa aturan sudah tersimpan — biasanya di bawah satu menit.

Setelah itu masuk lewat tombol **Masuk Admin** di footer halaman depan memakai email dan kata sandi tadi.

### Isi halaman admin

- **Enam kartu ringkasan** — peserta terdaftar, sudah pre test, sudah post test, belum mengisi, rata-rata nilai pre → post, rata-rata peningkatan.
- **Tabel seluruh peserta** dengan penyaring status, provinsi, pengurutan, dan pencarian. Tombol **Detail** menampilkan jawaban peserta butir demi butir beserta kuncinya.
- **Analisis butir soal** — persentase jawaban benar tiap butir, diurutkan dari yang paling sering salah, untuk menentukan materi yang perlu diperkuat saat pendampingan.
- **Menghapus peserta** — kotak centang tiap baris, kotak *pilih semua* di kepala tabel (mengikuti penyaring yang aktif), tombol **Hapus terpilih**, dan tombol **Hapus** per baris. Berguna membersihkan akun yang dibuat sembarangan.
- **Unduh CSV** dan **Unduh Excel**, mengikuti penyaring yang sedang aktif. Berkas Excel dibuat dari tabel HTML agar kolomnya tidak bergantung pada pengaturan pemisah daftar di masing-masing komputer.

> Gerbang admin mengatur akses ke tampilan rekap dan ekspor, bukan kerahasiaan data. Koleksi `hasil` memang berstatus baca-publik karena papan peringkat peserta memerlukannya.

### Tab Survei Kepuasan Pemda

Tab kedua di halaman admin merekap kuesioner kepuasan (`assets/survei.js`).

**Penyaring.** Provinsi, mutu (A–D), dan pencarian bebas atas nama pemda, penilai, email, atau nomor telepon. **Seluruh halaman ikut menyempit** — kartu ringkasan, semua grafik, tabel, dan berkas Excel yang diunduh. Tombol ungu di samping penyaring menampilkan “x dari y” sekaligus menghapus seluruh penyaring dengan sekali klik.

**Infografis**, semuanya digambar sendiri sebagai SVG — tidak ada pustaka grafik yang perlu diunduh, jadi panel tetap terbuka walau koneksi seret:

| Grafik | Isi | Interaksi |
|---|---|---|
| Jarum indeks | Indeks kepuasan gabungan, dengan pita mutu A–D di lingkar luarnya | tunjuk pita untuk melihat rentangnya |
| Radar tujuh unsur | Rata-rata tiap unsur pada skala 1–4 | **klik** salah satu sudut untuk membedah unsurnya |
| Donat mutu | Berapa pemda pada tiap kelas mutu | **klik** legendanya untuk menyaring mutu itu |
| Sebaran jawaban | Batang bertumpuk 1–4 tiap unsur | tunjuk tiap warna; klik barisnya untuk membedah |
| Peringkat wilayah | Indeks rata-rata per provinsi; **berganti sendiri menjadi peringkat kabupaten/kota** begitu satu provinsi dipilih | **klik** provinsi untuk menyaring seluruh halaman |
| Skor petugas desk | Rata-rata bintang tiap koordinator wilayah dan verifikator | tunjuk kartunya untuk jumlah penilai |

Panel **Bedah unsur** yang muncul setelah sebuah unsur diklik memperlihatkan sebaran jawabannya sebagai batang tegak, dan daftar enam daerah yang menilai paling rendah pada unsur itu — daftar inilah yang dipakai menentukan siapa yang perlu dihubungi lebih dulu.

Satu kalimat ringkasan di bawah baris grafik pertama menyebut unsur terkuat dan unsur yang paling perlu perhatian, supaya kesimpulannya terbaca tanpa menafsirkan grafik lebih dulu.

> Angka pada nama tab (“Survei Kepuasan Pemda · 24”) selalu jumlah keseluruhan, bukan hasil penyaringan.

**Batas penghapusan.** Menghapus peserta membuang dokumen `peserta` dan seluruh dokumen `hasil` miliknya, sehingga hilang dari papan peringkat dan rekap. **Akun masuknya di Authentication tidak ikut terhapus** — penghapusan akun hanya mungkin dari Firebase Console (*Authentication → Users → ⋮ → Delete account*) atau lewat Admin SDK. Selama akunnya masih ada, orang itu tetap bisa masuk tetapi akan diberi tahu bahwa akunnya bukan akun peserta, dan tidak dapat mendaftar ulang dengan email yang sama.

---

## 5. Berita Acara eMonitoring (akun PFID)

Akun yang **namanya memuat kata “jalan”** — misalnya `ahmadjalan` atau `yolan_jalan` —
otomatis dikenali sebagai petugas PFID:

- **pendaftarannya cukup nama dan kata sandi.** Begitu kata “jalan” terketik di kolom
  nama, kolom provinsi, kabupaten/kota, dan email langsung hilang;
- menu **Berita Acara eMonitoring** muncul di bilah atas, dan hanya untuk akun ini;
- pre test dan post test **tidak wajib** — setelah masuk, akun langsung diarahkan ke menu tersebut;
- namanya tercatat sebagai **penyusun laporan** pada menu itu.

**Masuknya cukup dengan user id**, tanpa `@`. Firebase Authentication tetap memerlukan
alamat email, jadi alamatnya dibentuk sendiri dari user id pada domain penanda
`@pfid.monevdak.id` — domain ini tidak pernah dikirimi surat. Konsekuensinya,
**“Lupa kata sandi?” tidak berlaku untuk akun PFID**; pengaturan ulang harus lewat
Firebase Console (*Authentication → Users*). Provinsi dan kabupaten akun ini diisi
otomatis “Pusat Fasilitasi Infrastruktur Daerah” dan “Kementerian PU”.

Alurnya empat langkah:

1. **Identitas rapat** — tanggal terisi otomatis dari tanggal hari ini (bagian kuning),
   daerah dipilih dari daftar provinsi/kabupaten, notulis dipilih dari empat pasangan
   yang tersedia (bagian ungu). Ketiganya masih bisa disunting manual.
2. **Tempel screenshot** — `Ctrl+V`, klik, atau seret berkas. Maksimal 8 gambar;
   tiga gambar pertama sekaligus dipasang di halaman **Foto Dokumentasi**.
3. **AI membaca** — tabel progres, kelengkapan eMonitoring (bagian merah), dan
   informasi umum kegiatan (bagian hijau) diisi dari gambar.
4. **Periksa & unduh** — seluruh sel dapat dikoreksi sebelum dokumen dibuat, lalu
   diunduh sebagai `.docx`.

**Penyedia AI.** Ada empat pilihan, semuanya dipanggil langsung dari peramban tanpa
server perantara:

| Penyedia | Biaya | Catatan |
|---|---|---|
| **Google Gemini** *(bawaan)* | gratis | Kunci dari [Google AI Studio](https://aistudio.google.com/apikey), tanpa kartu kredit. Kuota harian jauh melebihi kebutuhan rapat. |
| **OpenRouter** | ada yang gratis | Satu kunci untuk puluhan model; yang berakhiran `:free` tidak dipungut biaya. |
| **Anthropic (langsung)** | berbayar | Pembacaan tabel dari gambar paling teliti. Pakai bila hasil Gemini masih banyak dikoreksi. |
| **Gateway OpenAI-kompatibel lain** | tergantung gateway | AgentRouter, OpenAI, dan sejenisnya. |

Mengganti penyedia ikut mengganti Base URL dan model ke bawaannya, serta mengosongkan
kunci — kunci satu penyedia tidak berlaku di penyedia lain.

**Kalau AI menolak.** Tekan **Uji koneksi**: satu baris teks dikirim tanpa gambar. Kalau
lolos, kunci dan modelnya sah dan yang ditolak adalah bagian gambarnya — ganti model lewat
**Muat daftar model**, yang hanya menampilkan model berkemampuan gambar dan menaruh yang
gratis di urutan atas. Kalau uji koneksi pun gagal, masalahnya di kunci atau nama modelnya.

Galat `content-blocked` khas AgentRouter hampir selalu berarti **model itu tidak termasuk
paket kunci API tersebut**, bukan isi tangkapan layarnya yang bermasalah. Tangkapan layar
dikecilkan ke sisi terpanjang 1600 px dan dikirim sebagai JPEG, jadi ukuran muatan jarang
jadi penyebab; yang tercetak di dokumen tetap gambar aslinya.

**Kunci dipakai bersama.** Diisi sekali lalu disimpan di dokumen Firestore
`konfigurasi/ai` — petugas PFID lain tidak perlu mengisinya lagi di perangkat
masing-masing. `firestore.rules` membatasi baca/tulis dokumen itu hanya untuk akun PFID
dan admin; peserta biasa tidak bisa membacanya. Tetap perlu diingat bahwa **setiap petugas
PFID dapat melihat kunci itu**, jadi pakailah kunci khusus aplikasi ini, bukan kunci pribadi.

**Template.** `assets/ba-template.docx` adalah notulensi asli yang teksnya diganti
penanda docxtemplater (`{daerah}`, `{#progres}…{/progres}`, dan seterusnya). Kop,
warna, penomoran huruf, dan seluruh gaya paragrafnya tidak diubah, sehingga hasil
unduhan berformat persis sama dengan notulensi terdahulu. **Jangan membuka lalu
menyimpan ulang berkas ini dari Word** — Word memecah penanda menjadi beberapa run
dan template akan berhenti bekerja. Bila format notulensi berubah, siapkan ulang
template dari dokumen baru dengan cara yang sama.

Pustaka `pizzip` dan `docxtemplater` diambil dari unpkg saat menu ini pertama dibuka,
jadi pembuatan dokumen memerlukan koneksi internet.

---

## 6. Deploy ke GitHub + Vercel

```bash
git init
git add .
git commit -m "MonevDAK: pre/post test DAK Fisik Bidang Jalan TW II"
git branch -M main
git remote add origin https://github.com/<user>/monev-dak.git
git push -u origin main
```

Lalu di [vercel.com/new](https://vercel.com/new): **Import Git Repository** → pilih repo ini.

- Framework Preset: **Other**
- Build Command: *kosongkan*
- Output Directory: *kosongkan* (root)

Klik **Deploy**. Setelah live, jangan lupa menambahkan domain Vercel ke **Authorized domains** Firebase (langkah 2.7), kalau tidak anonymous auth akan ditolak dan aplikasi jatuh ke mode lokal.

---

## Catatan

- **Kunci Web API Firebase memang tampil di sisi klien** dan bukan rahasia. Yang mengamankan data adalah `firestore.rules`.
- **Penilaian dihitung di peramban.** Peserta yang paham DevTools secara teori bisa mengirim `benar` yang tidak sesuai. Rules sudah membatasi rentang nilai, `nilai == benar * 5`, dan durasi maksimal, serta melarang update — cukup untuk konteks monev internal. Bila diperlukan penilaian yang tidak dapat dimanipulasi, pindahkan pemeriksaan kunci jawaban ke Cloud Function dan simpan kunci di luar klien.
- **Identitas peserta = nama + provinsi + kabupaten/kota.** Dua orang dengan kombinasi identik akan dianggap satu peserta. Tambahkan NIP pada form bila hal ini menjadi masalah.
- **Hanya 164 daerah penerima DAK Fisik Bidang Jalan yang terdaftar** di `assets/wilayah.js`, tersebar di 33 provinsi. Daerah di luar daftar itu tidak muncul di mana pun — tidak di saran provinsi/kabupaten saat mendaftar, tidak pula di pemilih daerah pada Berita Acara — dan pendaftarannya ditolak. Riau, Bengkulu, Banten, DKI Jakarta, dan Kalimantan Tengah tidak menerima DAK bidang jalan, jadi kelima provinsi itu memang tidak ada. Bila daftar penerimanya berubah tahun depan, cukup berkas itu yang disunting. Ejaan namanya jangan diubah: `kunciKab` pada profil peserta dan `kunciDaerah` pada berita acara dibentuk dari nama tersebut, sehingga daerah yang berganti ejaan akan kehilangan arsipnya.
- Video latar memakai `https://jumpshare.com/s/6t6K21KuNJZrELSewqEK` sebagai sumber pertama. URL tersebut adalah halaman berbagi, bukan berkas mp4, sehingga tidak dapat diputar oleh elemen `<video>`; sumber kedua (mp4) dan gradien CSS berfungsi sebagai cadangan. Ganti sumber pertama bila sudah ada tautan mp4 langsung.
