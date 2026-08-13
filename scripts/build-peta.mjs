/**
 * Membangun assets/peta-geo.js untuk MonevDAK dari GeoJSON resmi
 * repo assai-id/nemesis (seed/geo/02-provinces).
 *
 *   node scripts/build-peta.mjs
 *
 * Keluaran: satu berkas JS biasa berisi
 *   - garis 38 provinsi (latar peta)
 *   - poligon 164 kabupaten/kota penerima DAK (lapisan yang bisa diklik)
 * Kunci tiap daerah dibentuk sama persis dengan kunciDaerah() pada
 * assets/berita-acara.js supaya bisa dipasangkan dengan arsip berita acara.
 *
 * GeoJSON aslinya ratusan megabita, jadi hasil unduhannya disinggahkan di
 * GEO_CACHE (bawaannya folder `.geo-cache/`, sudah diabaikan git) — menjalankan
 * ulang skripnya tidak mengunduh lagi. Daftar daerahnya dibaca dari
 * assets/wilayah.js, jadi kalau penerima DAK berubah tahun depan cukup berkas
 * itu yang disunting lalu skrip ini dijalankan ulang.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = process.env.GEO_CACHE ?? path.join(REPO, ".geo-cache");
const BASE = "https://raw.githubusercontent.com/assai-id/nemesis/main/seed/geo/02-provinces";

/* Proyeksi equirectangular; sama gayanya dengan bpjt-website. */
const PROJ = { lon0: 94.8, lat0: 6.3, k: 21.65 };
const px = (lon) => (lon - PROJ.lon0) * PROJ.k;
const py = (lat) => (PROJ.lat0 - lat) * PROJ.k;

const PROVINSI_SEMUA = [
  "Aceh", "Bali", "Banten", "Bengkulu", "DKI_Jakarta", "Daerah_Istimewa_Yogyakarta",
  "Gorontalo", "Jambi", "Jawa_Barat", "Jawa_Tengah", "Jawa_Timur", "Kalimantan_Barat",
  "Kalimantan_Selatan", "Kalimantan_Tengah", "Kalimantan_Timur", "Kalimantan_Utara",
  "Kepulauan_Bangka_Belitung", "Kepulauan_Riau", "Lampung", "Maluku", "Maluku_Utara",
  "Nusa_Tenggara_Barat", "Nusa_Tenggara_Timur", "Papua", "Papua_Barat", "Papua_Barat_Daya",
  "Papua_Pegunungan", "Papua_Selatan", "Papua_Tengah", "Riau", "Sulawesi_Barat",
  "Sulawesi_Selatan", "Sulawesi_Tengah", "Sulawesi_Tenggara", "Sulawesi_Utara",
  "Sumatera_Barat", "Sumatera_Selatan", "Sumatera_Utara",
];

/* Nama provinsi di assets/wilayah.js → nama berkas di repo nemesis. */
const BERKAS_PROV = { "DI Yogyakarta": "Daerah_Istimewa_Yogyakarta" };
const berkasProv = (nama) => BERKAS_PROV[nama] || nama.replace(/ /g, "_");

/* ——— muat daftar 164 daerah penerima DAK apa adanya dari repo ——— */
const src = fs.readFileSync(path.join(REPO, "assets/wilayah.js"), "utf8");
const window = {};
new Function("window", src)(window);
const WILAYAH = window.WILAYAH;

/* Sama persis dengan slugKunci/kunciDaerah di assets/berita-acara.js. */
const slugKunci = (s) => String(s == null ? "" : s).toLowerCase()
  .replace(/[^a-z0-9 ]/g, "").trim().replace(/\s+/g, "-");
const kunciDaerah = (t) => slugKunci(String(t || "").replace(/^\s*(kabupaten|kab\.?)\s+/i, ""));

/* Nama pada GeoJSON kadang berbeda ejaan dengan daftar DAK. Padanannya
   ditulis di sini supaya daftar DAK tidak perlu diubah — ejaan di
   assets/wilayah.js adalah kunci arsip berita acara. */
const ALIAS = {
  "pangkajene-dan-kepulauan": ["pangkajene-kepulauan", "pangkajene-dan-kepulauan", "pangkep"],
  "sidenreng-rappang": ["sidenreng-rappang", "sidrap"],
  "kepulauan-siau-tagulandang-biaro": ["kep-siau-tagulandang-biaro", "siau-tagulandang-biaro", "kepulauan-sitaro"],
  "kota-tanjungpinang": ["kota-tanjungpinang", "kota-tanjung-pinang"],
  "kepulauan-tanimbar": ["kepulauan-tanimbar", "maluku-tenggara-barat"],
  "kota-lubuklinggau": ["kota-lubuklinggau", "kota-lubuk-linggau"],
  "toba": ["toba", "toba-samosir"],
  "pasangkayu": ["pasangkayu", "mamuju-utara"],
  "kota-parepare": ["kota-parepare", "kota-pare-pare"],
  "tana-tidung": ["tana-tidung", "tanah-tidung"],
  "kepulauan-yapen": ["kepulauan-yapen", "yapen-waropen"],
  "pegunungan-arfak": ["pegunungan-arfak", "arfak"],
};

async function unduh(kind, nama) {
  const dir = path.join(CACHE, kind);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${nama}.geojson`);
  if (fs.existsSync(file) && fs.statSync(file).size > 1024) return file;
  const res = await fetch(`${BASE}/${kind}/${nama}.geojson`);
  if (!res.ok) throw new Error(`${kind}/${nama}: HTTP ${res.status}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

/* ——— Ramer–Douglas–Peucker iteratif ——— */
function rdp(points, eps) {
  const n = points.length;
  if (n < 3) return points;
  const keep = new Uint8Array(n);
  keep[0] = 1; keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    if (last - first < 2) continue;
    const [ax, ay] = points[first];
    const [bx, by] = points[last];
    const dx = bx - ax, dy = by - ay;
    const norm = Math.hypot(dx, dy);
    const degenerate = norm < 1e-9;
    let maxD = 0, idx = -1;
    for (let i = first + 1; i < last; i++) {
      const [cx, cy] = points[i];
      const d = degenerate ? Math.hypot(cx - ax, cy - ay)
                           : Math.abs(dy * cx - dx * cy + bx * ay - by * ax) / norm;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > eps && idx > -1) { keep[idx] = 1; stack.push([first, idx], [idx, last]); }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(points[i]);
  return out;
}

function luas(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(a / 2);
}

const polygons = (g) =>
  g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];

/** Geometri GeoJSON → satu string path SVG. Lubang diabaikan. */
function toPath(geometry, { eps, minArea, presisi = 1 }) {
  const out = [];
  for (const poly of polygons(geometry)) {
    const ring = poly[0];
    if (!ring || luas(ring) < minArea) continue;
    const kecil = rdp(ring, eps);
    if (kecil.length < 4) continue;
    out.push(kecil.map(([lon, lat], i) =>
      `${i === 0 ? "M" : "L"}${px(lon).toFixed(presisi)} ${py(lat).toFixed(presisi)}`).join("") + "Z");
  }
  return out.join("");
}

/** Titik wakil daerah: pusat cincin terluas, dipakai untuk penanda & label. */
function titikWakil(geometris) {
  let terbaik = null, terluas = 0;
  for (const geometry of geometris) for (const poly of polygons(geometry)) {
    const ring = poly[0];
    if (!ring) continue;
    const a = luas(ring);
    if (a > terluas) { terluas = a; terbaik = ring; }
  }
  if (!terbaik) return null;
  let sx = 0, sy = 0;
  for (const [lon, lat] of terbaik) { sx += lon; sy += lat; }
  return {
    x: +px(sx / terbaik.length).toFixed(1),
    y: +py(sy / terbaik.length).toFixed(1),
    luas: terluas,
  };
}

/* ——— 1. garis provinsi ——— */
const provinsi = [];
console.log("Batas provinsi…");
for (const nama of PROVINSI_SEMUA) {
  const gj = JSON.parse(fs.readFileSync(await unduh("province-only", nama), "utf8"));
  let d = "";
  for (const f of (gj.features ?? [gj])) d += toPath(f.geometry, { eps: 0.02, minArea: 0.004 });
  provinsi.push({ nama: nama.replace(/_/g, " ").replace("Daerah Istimewa Yogyakarta", "DI Yogyakarta"), d });
  process.stdout.write(`  · ${nama} ${(d.length / 1024).toFixed(0)} KB\n`);
}

/* ——— 2. poligon daerah penerima DAK ——— */
const daerah = [];
const hilang = [];
console.log("Batas kabupaten/kota penerima DAK…");
for (const [prov, isi] of Object.entries(WILAYAH)) {
  const gj = JSON.parse(fs.readFileSync(await unduh("with-districts", berkasProv(prov)), "utf8"));
  const fitur = gj.features ?? [gj];
  /* Satu kabupaten kadang tersebar di beberapa fitur (Wakatobi ada tiga),
     jadi fiturnya dikumpulkan, bukan ditimpa. */
  const indeks = new Map();
  for (const f of fitur) {
    const label = (f.properties || {}).WADMKK || "";
    if (!label) continue;
    const k = kunciDaerah(label);
    if (!indeks.has(k)) indeks.set(k, []);
    indeks.get(k).push(f);
  }
  for (const nama of isi.split(",")) {
    const kunci = kunciDaerah(nama);
    const calon = [kunci, ...(ALIAS[kunci] || [])];
    const fs2 = calon.map((c) => indeks.get(c)).find(Boolean);
    if (!fs2) { hilang.push(`${prov} / ${nama} (${kunci})`); continue; }
    const geo = fs2.map((f) => f.geometry);
    /* Ambang luas dilonggarkan bertahap: daerah kepulauan kecil seperti
       Wakatobi hilang seluruhnya pada ambang yang wajar untuk daratan. */
    let d = "";
    for (const [eps, minArea] of [[0.008, 0.0002], [0.004, 0.00002], [0.001, 0]]) {
      d = geo.map((g) => toPath(g, { eps, minArea, presisi: 1 })).join("");
      if (d) break;
    }
    const t = titikWakil(geo);
    if (!d || !t) { hilang.push(`${prov} / ${nama} — geometri kosong`); continue; }
    /* Daerah yang pulau/wilayah terbesarnya mungil — kota kecil dan gugusan
       kepulauan — praktis tak terlihat pada peta seluruh Indonesia. Ditandai
       di sini supaya peramban memberinya bulatan penanda. */
    daerah.push({ k: kunci, n: nama, p: prov, d, x: t.x, y: t.y, ...(t.luas < 0.03 ? { s: 1 } : {}) });
  }
  process.stdout.write(`  · ${prov} ${isi.split(",").length} daerah\n`);
}

console.log(`\nCocok: ${daerah.length} daerah`);
if (hilang.length) console.log("TIDAK KETEMU:\n  " + hilang.join("\n  "));

/* ——— 3. tulis berkasnya ——— */
const semuaX = [], semuaY = [];
for (const p of provinsi) {
  for (const m of p.d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)) { semuaX.push(+m[1]); semuaY.push(+m[2]); }
}
const kotak = {
  x: Math.floor(Math.min(...semuaX)) - 4,
  y: Math.floor(Math.min(...semuaY)) - 4,
  w: Math.ceil(Math.max(...semuaX) - Math.min(...semuaX)) + 8,
  h: Math.ceil(Math.max(...semuaY) - Math.min(...semuaY)) + 8,
};

const isi = `/* Peta wilayah Indonesia — dibuat otomatis, jangan disunting manual.
   Sumber batas wilayah: https://github.com/assai-id/nemesis (seed/geo/02-provinces),
   disederhanakan Ramer–Douglas–Peucker lalu diproyeksikan ke koordinat SVG.

   provinsi[] = garis 38 provinsi, hanya latar peta.
   daerah[]   = ${daerah.length} kabupaten/kota penerima DAK Fisik Bidang Jalan;
                k = kunci daerah (sama dengan kunciDaerah() pada berita-acara.js),
                n = nama, p = provinsi, d = path SVG, x/y = titik wakil,
                s = 1 bila wilayahnya terlalu kecil untuk terlihat tanpa penanda. */
window.PETA_GEO = {
  viewBox: ${JSON.stringify(`${kotak.x} ${kotak.y} ${kotak.w} ${kotak.h}`)},
  provinsi: ${JSON.stringify(provinsi)},
  daerah: ${JSON.stringify(daerah)}
};
`;

fs.writeFileSync(path.join(REPO, "assets/peta-geo.js"), isi);
console.log(`\nassets/peta-geo.js → ${(isi.length / 1024).toFixed(0)} KB · viewBox ${kotak.x} ${kotak.y} ${kotak.w} ${kotak.h}`);
