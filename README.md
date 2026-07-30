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
│   ├── wilayah.js             38 provinsi + kabupaten/kota (autocomplete)
│   ├── soal-tw2.js            bank soal TW II + aturan penilaian
│   ├── firebase-config.js     konfigurasi Firebase
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

Selama `assets/firebase-config.js` masih kosong — atau berkas dibuka lewat `file://` — aplikasi berjalan dalam **mode lokal**: data tersimpan di `localStorage` peramban dan papan peringkat diisi 14 data contoh. Sebuah pita kuning muncul di kiri bawah sebagai penanda.

Untuk mencoba jalur Firebase, isi konfigurasi lalu jalankan lewat `npx serve .` (bukan `file://`, karena modul Firebase memerlukan http/https).

---

## 2. Menyiapkan Firebase

1. Buka [console.firebase.google.com](https://console.firebase.google.com) → **Add project**.
2. **Build → Firestore Database → Create database** → pilih lokasi `asia-southeast2` (Jakarta) → mulai dalam *production mode*.
3. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable.**
   Aplikasi memakai anonymous auth agar security rules dapat membedakan penulis yang sah dari lalu lintas anonim.
4. **Project settings → General → Your apps → Web (`</>`)** → daftarkan app → salin objek `firebaseConfig`.
5. Tempel nilainya ke `assets/firebase-config.js`.
6. **Firestore Database → Rules** → tempel seluruh isi `firestore.rules` → **Publish**.
7. **Authentication → Settings → Authorized domains** → tambahkan domain Vercel Anda (mis. `monev-dak.vercel.app`).

### Koleksi yang dibuat

| Koleksi | ID dokumen | Isi |
|---|---|---|
| `peserta` | `nama_provinsi_kabupaten` (slug) | `nama`, `prov`, `kab`, `email`, `uid`, `updatedAt` |
| `hasil` | `{pid}__tw2__pre` / `{pid}__tw2__post` | `pid`, `nama`, `prov`, `kab`, `tw`, `kind`, `benar`, `total`, `nilai`, `durasiMs`, `detail[]`, `selesaiAt` |

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

1. Firebase Console → **Authentication → Sign-in method → Email/Password → Enable.**
2. **Authentication → Users → Add user** → isi email dan kata sandi admin.
3. Buka `firestore.rules`, ganti `'admin@emondak.go.id'` pada fungsi `adminEmail()` dengan email tadi (boleh lebih dari satu, pisahkan dengan koma), lalu **Publish** ulang di Console.

Langkah 3 penting: koleksi `peserta` memuat email dinas, sehingga hanya email yang terdaftar di `adminEmail()` yang boleh membacanya. Tanpa langkah itu admin tetap bisa masuk dan melihat seluruh nilai, hanya saja angka “Belum mengisi” tidak dapat dihitung — aplikasi menampilkan pemberitahuan yang menjelaskan hal ini.

### Isi halaman admin

- **Enam kartu ringkasan** — peserta terdaftar, sudah pre test, sudah post test, belum mengisi, rata-rata nilai pre → post, rata-rata peningkatan.
- **Tabel seluruh peserta** dengan penyaring status, provinsi, pengurutan, dan pencarian. Tombol **Detail** menampilkan jawaban peserta butir demi butir beserta kuncinya.
- **Analisis butir soal** — persentase jawaban benar tiap butir, diurutkan dari yang paling sering salah, untuk menentukan materi yang perlu diperkuat saat pendampingan.
- **Unduh CSV** dan **Unduh Excel**, mengikuti penyaring yang sedang aktif. Berkas Excel dibuat dari tabel HTML agar kolomnya tidak bergantung pada pengaturan pemisah daftar di masing-masing komputer.

> Gerbang admin mengatur akses ke tampilan rekap dan ekspor, bukan kerahasiaan data. Koleksi `hasil` memang berstatus baca-publik karena papan peringkat peserta memerlukannya.

---

## 5. Deploy ke GitHub + Vercel

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
- Video latar memakai `https://jumpshare.com/s/6t6K21KuNJZrELSewqEK` sebagai sumber pertama. URL tersebut adalah halaman berbagi, bukan berkas mp4, sehingga tidak dapat diputar oleh elemen `<video>`; sumber kedua (mp4) dan gradien CSS berfungsi sebagai cadangan. Ganti sumber pertama bila sudah ada tautan mp4 langsung.
