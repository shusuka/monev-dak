/* ══════════════════════════════════════════════════════════════════
   KONFIGURASI FIREBASE — proyek: emondak-faee8

   Sumber: Firebase Console → Project settings → General →
   "Your apps" → Web app → SDK setup and configuration → Config.

   Nilai di sini BUKAN rahasia; kunci Web API Firebase memang dirancang
   untuk tampil di sisi klien. Yang mengamankan data adalah Firestore
   Security Rules (lihat firestore.rules), bukan berkas ini.

   Bila apiKey dikosongkan, atau halaman dibuka lewat file://, aplikasi
   otomatis berjalan dalam MODE LOKAL: data tersimpan di localStorage
   peramban dan pita penanda muncul di kiri bawah halaman.
   ══════════════════════════════════════════════════════════════════ */
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyCA3nmnzorjN-Uv8lVbKap2Xr6pOI0FJ9Y",
  authDomain: "emondak-faee8.firebaseapp.com",
  projectId: "emondak-faee8",
  storageBucket: "emondak-faee8.firebasestorage.app",
  messagingSenderId: "336729923549",
  appId: "1:336729923549:web:e8034bbdd0d0f8d59e2034",
  measurementId: "G-1J3LRR681W"
};
