// Konfigurasi Web App Pasanggiri Bojonegara

// PIN akses fitur Penilaian Juri
const PIN_JURI = "354313";

const CONFIG = {
  // Ganti URL ini setelah deploy Apps Script
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzo0NXxQBNd1j5ySm3YWh8m2RJCXdtHw0Y-rvP_lrH6_VUkRzH0wBuObtc17QXhgEB3/exec',
  SPREADSHEET_ID: '10uZMw8iPm8lVaWesOZ08r5xhUemERSzFsPORu4Qjo50',

  // Data referensi Kontingen
  KONTINGEN: [
    { nama: 'Babakan Jeruk', kode: 'BJK' },
    { nama: 'Citepus', kode: 'CTP' },
    { nama: 'Pajajaran Barat', kode: 'PJB' },
    { nama: 'Pajajaran Timur', kode: 'PJT' },
    { nama: 'Sukagalih', kode: 'SKG' },
    { nama: 'Sukaraja', kode: 'SKR' },
    { nama: 'Sukawarna', kode: 'SKW' }
  ],

  // Data referensi Golongan
  GOLONGAN: [
    { nama: 'Usia Dini', kode: 'UDN' },
    { nama: 'Pra Remaja', kode: 'PRM' },
    { nama: 'Remaja', kode: 'RMJ' },
    { nama: 'Dewasa', kode: 'DWS' },
    { nama: 'Pembina', kode: 'PBN' },
    { nama: 'Istimewa', kode: 'IST' }
  ],

  // Data referensi Kategori dengan aturan jumlah peserta
  KATEGORI: [
    { nama: 'PERORANGAN', kode: 'PER', min: 1, max: 1 },
    { nama: 'BERPASANGAN', kode: 'BPS', min: 2, max: 2 },
    { nama: 'BERKELOMPOK', kode: 'BKL', min: 3, max: 5 },
    { nama: 'MASSAL', kode: 'MSL', min: 5, max: 25 },
    { nama: 'ATT', kode: 'ATT', min: 6, max: 6 }
  ],

  // Kriteria Penilaian Juri
  KRITERIA_PENILAIAN: [
    { nama: 'ORISINALITAS', min: 39, max: 50 },
    { nama: 'STAMINA', min: 20, max: 25 },
    { nama: 'KEKOMPAKAN', min: 14, max: 25 },
    { nama: 'KREATIFITAS', min: 20, max: 25 },
    { nama: 'TEKNIK SERANG BELA', min: 45, max: 50 },
    { nama: 'PENGHAYATAN', min: 20, max: 25 }
  ],

  // Daftar Juri
  JURI_LIST: ['Juri 1', 'Juri 2', 'Juri 3', 'Juri 4', 'Juri 5']
};
