# Prompt untuk Kiro AI — Web App "Pasanggiri Bojonegara"

---

## 🎯 Project Overview

Buat sebuah **web application mobile-friendly** bernama **"Pasanggiri Bojonegara"** — sistem pendaftaran peserta lomba seni tradisional (Pasanggiri) berbasis Google Sheets sebagai database, menggunakan Google Apps Script sebagai backend API-nya (tanpa server tambahan).

---

## 🗂️ Tech Stack

| Layer | Teknologi |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript (atau Vue 3 CDN) |
| Backend / API | Google Apps Script (Web App, deployed as public) |
| Database | Google Sheets |
| Hosting | GitHub Pages / Netlify / langsung dari Apps Script |

---

## 📋 Struktur Google Sheets

**Spreadsheet ID:** `10uZMw8iPm8lVaWesOZ08r5xhUemERSzFsPORu4Qjo50`

Gunakan **satu sheet utama** bernama `Peserta` dengan kolom berikut (urutan wajib diikuti):

| Kolom | Header | Keterangan |
|---|---|---|
| A | Nomor Urut | ID unik (auto-generate) |
| B | Kategori | PERORANGAN / BERPASANGAN / BERKELOMPOK / MASSAL / ATT |
| C | Golongan | Usia Dini / Pra Remaja / Remaja / Dewasa / Pembina / Istimewa |
| D | Kontingen | Nama Kelompok |
| E | Nama Peserta | Dipisah dengan koma (,) jika lebih dari 1 |
| F | Nama Pelatih | Nama pelatih/pendamping |
| G | Nomor WhatsApp | Format nomor WA aktif |
| H | Timestamp | Waktu pendaftaran (auto, ISO format) |

---

## 🔢 Aturan Nomor Urut (ID Unik)

Format ID: **`{KODE_KONTINGEN}-{KODE_GOLONGAN}-{KODE_KATEGORI}-{INCREMENT}`**

Contoh: `BJK-RMJ-PER-001`

### Kode Kontingen:
| Kontingen | Kode |
|---|---|
| Babakan Jeruk | BJK |
| Citepus | CTP |
| Pajajaran Barat | PJB |
| Pajajaran Timur | PJT |
| Sukagalih | SKG |
| Sukaraja | SKR |
| Sukawarna | SKW |

### Kode Golongan:
| Golongan | Kode |
|---|---|
| Usia Dini | UDN |
| Pra Remaja | PRM |
| Remaja | RMJ |
| Dewasa | DWS |
| Pembina | PBN |
| Istimewa | IST |

### Kode Kategori:
| Kategori | Kode |
|---|---|
| PERORANGAN | PER |
| BERPASANGAN | BPS |
| BERKELOMPOK | BKL |
| MASSAL | MSL |
| ATT | ATT |

> Increment adalah angka urut 3 digit (001, 002, ...) yang dihitung per kombinasi Kontingen+Golongan+Kategori. Logika pengecekan dilakukan di Apps Script saat data di-POST.

---

## 📝 Form Pendaftaran — Spesifikasi Lengkap

### Field & Validasi:

**1. Kategori** *(dropdown, required)*
- Pilihan: `PERORANGAN`, `BERPASANGAN`, `BERKELOMPOK`, `MASSAL`, `ATT`
- Perubahan kategori memperbarui jumlah input Nama Peserta secara dinamis (lihat aturan di bawah)

**2. Golongan** *(dropdown, required)*
- Pilihan: `Usia Dini`, `Pra Remaja`, `Remaja`, `Dewasa`, `Pembina`, `Istimewa`

**3. Kontingen** *(dropdown, required)*
- Pilihan: `Babakan Jeruk`, `Citepus`, `Pajajaran Barat`, `Pajajaran Timur`, `Sukagalih`, `Sukaraja`, `Sukawarna`

**4. Nama Peserta** *(input dinamis, required)*

Jumlah input Nama Peserta menyesuaikan Kategori yang dipilih:

| Kategori | Jumlah Input Nama |
|---|---|
| PERORANGAN | Tepat 1 (fixed) |
| BERPASANGAN | Tepat 2 (fixed) |
| BERKELOMPOK | Min 3, Maks 5 (ada tombol + / - untuk tambah/kurang peserta) |
| MASSAL | Min 5, Maks 25 (ada tombol + / - untuk tambah/kurang peserta) |
| ATT | Tepat 6 (fixed) |

- Setiap input Nama Peserta diberi label "Peserta 1", "Peserta 2", dst.
- Validasi: semua field nama yang muncul wajib diisi (tidak boleh kosong)

**5. Nama Pelatih** *(text input, required)*
- Placeholder: "Nama lengkap pelatih/pendamping"

**6. Nomor WhatsApp** *(tel input, required)*
- Format: dimulai dengan `08` atau `628`
- Validasi: hanya angka, minimal 10 digit, maksimal 15 digit
- Tampilkan pesan error inline jika format salah

### Tombol Aksi Form:
- **Daftar** — submit data baru ke Google Sheets
- **Reset** — reset semua field ke kondisi awal

---

## 📊 Dashboard — Spesifikasi

Dashboard menampilkan **rekap data peserta berdasarkan Kontingen**.

### Layout Dashboard:

**A. Filter / Tab Kontingen**
- Tampilkan tab atau dropdown untuk memfilter berdasarkan Kontingen
- Default: tampilkan semua kontingen (summary)

**B. Kartu Ringkasan (Summary Cards)**
Tampilkan untuk setiap Kontingen:
- Total pendaftar
- Jumlah per Kategori (PERORANGAN, BERPASANGAN, dst.)
- Jumlah per Golongan

**C. Tabel Data Peserta**
Kolom yang ditampilkan:
- Nomor Urut
- Kategori
- Golongan
- Nama Peserta
- Nama Pelatih
- Nomor WhatsApp
- Aksi: tombol **Edit** dan **Hapus**

**D. Fitur Edit Data (Inline / Modal)**
- Klik Edit → form modal terbuka dengan data yang sudah terisi
- User bisa ubah semua field (kecuali Nomor Urut yang sudah di-generate)
- Klik Simpan → data diupdate di Google Sheets via Apps Script
- Konfirmasi sebelum menyimpan perubahan

**E. Fitur Hapus Data**
- Klik Hapus → muncul konfirmasi dialog
- Setelah konfirmasi → baris dihapus dari Google Sheets

---

## ⚙️ Google Apps Script — Spesifikasi API

Buat file `Code.gs` dengan endpoint Web App yang menangani method berikut:

### Endpoint: `doGet(e)`
Digunakan untuk membaca data dari sheet.

```
GET ?action=getAll         → Ambil semua data peserta
GET ?action=getByKontingen&kontingen=Citepus → Filter berdasarkan kontingen
GET ?action=getNextId&kontingen=X&golongan=Y&kategori=Z → Generate Nomor Urut berikutnya
```

### Endpoint: `doPost(e)`
Digunakan untuk menulis/mengubah data.

```
POST action=add     → Tambah baris baru
POST action=update  → Update baris berdasarkan Nomor Urut
POST action=delete  → Hapus baris berdasarkan Nomor Urut
```

### Konfigurasi Apps Script:
- Deploy sebagai **Web App**
- Execute as: **Me (pemilik spreadsheet)**
- Who has access: **Anyone** (agar frontend bisa akses tanpa login)
- Tambahkan header CORS di setiap response:
  ```javascript
  .setHeader("Access-Control-Allow-Origin", "*")
  ```
- Semua response dalam format **JSON**
- Gunakan `LockService` untuk mencegah race condition saat generate ID

---

## 🎨 Desain UI/UX

### Tema Visual:
- Terinspirasi dari **seni tradisional Sunda** — hangat, elegan, berkarakter lokal
- Palet warna: kombinasi **hijau tua (forest green)**, **emas/kuning kecoklatan**, dan **krem/putih gading**
- Tipografi: gunakan Google Fonts — display font berkarakter (misal: `Playfair Display`, `Cinzel`, atau sejenisnya) untuk judul, body font yang bersih untuk form
- Ornamen/motif batik atau anyaman sebagai aksen dekoratif (bisa berupa CSS pattern atau SVG sederhana)

### Mobile-First Requirements:
- Breakpoint utama: 375px (iPhone SE), 390px (iPhone 14), 414px (Android umum)
- Semua tombol minimum tinggi 44px (touch target)
- Form input minimum font-size 16px (mencegah auto-zoom di iOS)
- Bottom navigation untuk berpindah antara Form dan Dashboard
- Scroll yang smooth dan natural

### Navigasi:
- **Tab 1: Form Pendaftaran** — ikon pensil/daftar
- **Tab 2: Dashboard** — ikon tabel/statistik

### States & Feedback:
- Loading spinner saat fetch/submit data ke Apps Script
- Toast notification untuk sukses/gagal submit
- Skeleton loading untuk tabel dashboard
- Error state jika gagal koneksi ke Apps Script

---

## 🔧 Struktur File Project

```
pasanggiri-bojonegara/
│
├── index.html          # Entry point, single-page app
├── style.css           # Global styles + tema
├── app.js              # Logic utama (form, dashboard, API calls)
├── config.js           # Konfigurasi (URL Apps Script, Sheet ID, dll)
│
└── apps-script/
    └── Code.gs         # Google Apps Script backend
```

---

## 🚀 Alur Kerja yang Diharapkan

```
User buka web → Pilih tab Form → Isi data → Klik Daftar
    → Frontend validasi → POST ke Apps Script
    → Apps Script generate ID → Tulis ke Google Sheets
    → Response sukses + Nomor Urut ditampilkan ke user

User buka Dashboard → Data di-fetch dari Apps Script (GET all)
    → Ditampilkan dalam tabel per Kontingen
    → User klik Edit → Form modal → Simpan → PATCH ke Apps Script
    → Google Sheets terupdate → Tabel refresh otomatis
```

---

## ✅ Checklist Output yang Diharapkan dari Kiro

- [ ] `Code.gs` lengkap dengan semua handler (doGet, doPost, generate ID, CORS)
- [ ] `index.html` dengan struktur semantic HTML
- [ ] `style.css` dengan tema Sunda, mobile-first, responsive
- [ ] `app.js` dengan:
  - [ ] Form dengan input nama dinamis sesuai kategori
  - [ ] Validasi semua field + tampilan error
  - [ ] Submit ke Apps Script + feedback toast
  - [ ] Dashboard fetch data dari Apps Script
  - [ ] Filter per Kontingen
  - [ ] Tabel dengan Edit & Hapus
  - [ ] Modal edit dengan update ke Apps Script
- [ ] `config.js` yang mudah dikonfigurasi (ganti URL Apps Script di satu tempat)
- [ ] Instruksi deploy Apps Script (step-by-step)

---

## 📌 Catatan Penting untuk Kiro

1. **Jangan gunakan framework berat** (React/Next.js tidak perlu) — cukup Vanilla JS atau Vue 3 via CDN agar bisa di-deploy statik tanpa build step
2. **URL Apps Script** akan diisi setelah deploy — gunakan variabel `APPS_SCRIPT_URL` di `config.js`
3. **Spreadsheet ID** sudah diketahui: `10uZMw8iPm8lVaWesOZ08r5xhUemERSzFsPORu4Qjo50`
4. **Satu sheet saja** bernama `Peserta` — jangan buat multi-sheet
5. **Handle CORS** dengan benar di Apps Script karena frontend dan backend beda origin
6. **Gunakan `ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON)`** untuk semua response Apps Script
7. Pastikan semua komentar kode dalam **Bahasa Indonesia**

---
