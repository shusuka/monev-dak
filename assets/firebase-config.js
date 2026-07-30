/* ══════════════════════════════════════════════════════════════════
   KONFIGURASI FIREBASE — proyek: emondak-faee8

   Ambil dari Firebase Console → Project settings → General →
   "Your apps" → Web app → SDK setup and configuration → Config.

   Masih perlu diisi: apiKey, storageBucket, messagingSenderId, appId.

   Nilai di sini BUKAN rahasia; kunci Web API Firebase memang dirancang
   untuk tampil di sisi klien. Yang mengamankan data adalah Firestore
   Security Rules (lihat firestore.rules), bukan berkas ini.

   Selama apiKey masih kosong, aplikasi berjalan dalam MODE LOKAL: data
   tersimpan di localStorage peramban dan sebuah pita penanda muncul di
   kiri bawah halaman.
   ══════════════════════════════════════════════════════════════════ */
window.FIREBASE_CONFIG = {
  apiKey: "",                                  // ← WAJIB, contoh "AIzaSy…"
  authDomain: "emondak-faee8.firebaseapp.com",
  projectId: "emondak-faee8",
  storageBucket: "",                           // ← salin apa adanya dari Console
  messagingSenderId: "",                       // ← WAJIB, deretan angka
  appId: ""                                    // ← WAJIB, contoh "1:123…:web:abc…"
};
