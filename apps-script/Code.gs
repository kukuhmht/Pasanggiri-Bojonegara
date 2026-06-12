// ============================================
// Pasanggiri Bojonegara — Google Apps Script Backend
// ============================================

const SPREADSHEET_ID = '10uZMw8iPm8lVaWesOZ08r5xhUemERSzFsPORu4Qjo50';
const SHEET_NAME = 'Peserta';
const SHEET_PENILAIAN = 'Penilaian';

// Kode referensi
const KODE_KONTINGEN = {
  'Babakan Jeruk': 'BJK', 'Citepus': 'CTP', 'Pajajaran Barat': 'PJB',
  'Pajajaran Timur': 'PJT', 'Sukagalih': 'SKG', 'Sukaraja': 'SKR', 'Sukawarna': 'SKW'
};
const KODE_GOLONGAN = {
  'Usia Dini': 'UDN', 'Pra Remaja': 'PRM', 'Remaja': 'RMJ',
  'Dewasa': 'DWS', 'Pembina': 'PBN', 'Istimewa': 'IST'
};
const KODE_KATEGORI = {
  'PERORANGAN': 'PER', 'BERPASANGAN': 'BPS', 'BERKELOMPOK': 'BKL',
  'MASSAL': 'MSL', 'ATT': 'ATT'
};

// Helper: buat JSON response
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Helper: ambil sheet (buat otomatis jika belum ada)
function getSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['Nomor Urut', 'Kategori', 'Golongan', 'Kontingen', 'Nama Peserta', 'Nama Pelatih', 'Nomor WhatsApp', 'Timestamp']);
  }
  return sheet;
}

// Helper: ambil semua data sebagai array of object
function getAllData() {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
  return data.map(row => ({
    nomorUrut: String(row[0]),
    kategori: String(row[1]),
    golongan: String(row[2]),
    kontingen: String(row[3]),
    namaPeserta: String(row[4]),
    namaPelatih: String(row[5]),
    nomorWA: String(row[6]),
    timestamp: String(row[7])
  }));
}

// Generate nomor urut berikutnya
function generateNextId(kontingen, golongan, kategori) {
  const kodeK = KODE_KONTINGEN[kontingen];
  const kodeG = KODE_GOLONGAN[golongan];
  const kodeC = KODE_KATEGORI[kategori];
  if (!kodeK || !kodeG || !kodeC) return null;

  const prefix = `${kodeK}-${kodeG}-${kodeC}-`;
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  let maxNum = 0;

  if (lastRow >= 2) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    ids.forEach(row => {
      const id = String(row[0]);
      if (id.startsWith(prefix)) {
        const num = parseInt(id.split('-')[3], 10);
        if (num > maxNum) maxNum = num;
      }
    });
  }

  const nextNum = String(maxNum + 1).padStart(3, '0');
  return prefix + nextNum;
}

// Handler GET
function doGet(e) {
  const action = e.parameter.action;

  try {
    if (action === 'getAll') {
      return jsonResponse({ success: true, data: getAllData() });
    }

    if (action === 'getByKontingen') {
      const kontingen = e.parameter.kontingen;
      const all = getAllData();
      const filtered = kontingen ? all.filter(d => d.kontingen === kontingen) : all;
      return jsonResponse({ success: true, data: filtered });
    }

    if (action === 'getNextId') {
      const { kontingen, golongan, kategori } = e.parameter;
      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      const nextId = generateNextId(kontingen, golongan, kategori);
      lock.releaseLock();
      return jsonResponse({ success: true, nextId: nextId });
    }

    // === Handler Penilaian GET ===
    if (action === 'getNilaiByPeserta') {
      const nomorUrut = e.parameter.nomorUrut;
      const data = getNilaiByPeserta(nomorUrut);
      return jsonResponse({ success: true, data: data });
    }

    if (action === 'getAllNilai') {
      const data = getAllNilai();
      return jsonResponse({ success: true, data: data });
    }

    if (action === 'getRekap') {
      const data = getRekapNilai();
      return jsonResponse({ success: true, data: data });
    }

    return jsonResponse({ success: false, error: 'Action tidak dikenali' });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

// Handler POST
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    if (action === 'add') {
      return handleAdd(body);
    }
    if (action === 'update') {
      return handleUpdate(body);
    }
    if (action === 'delete') {
      return handleDelete(body);
    }

    // === Handler Penilaian POST ===
    if (action === 'addNilai') {
      return handleAddNilai(body);
    }
    if (action === 'editNilai') {
      return handleEditNilai(body);
    }
    if (action === 'deleteNilai') {
      return handleDeleteNilai(body);
    }

    return jsonResponse({ success: false, error: 'Action tidak dikenali' });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

// Tambah data baru
function handleAdd(body) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sheet = getSheet();
    const nomorUrut = generateNextId(body.kontingen, body.golongan, body.kategori);
    if (!nomorUrut) {
      lock.releaseLock();
      return jsonResponse({ success: false, error: 'Data kontingen/golongan/kategori tidak valid' });
    }

    const timestamp = new Date().toISOString();
    const row = [
      nomorUrut,
      body.kategori,
      body.golongan,
      body.kontingen,
      body.namaPeserta,
      body.namaPelatih || '',
      body.nomorWA || '',
      timestamp
    ];

    sheet.appendRow(row);
    lock.releaseLock();
    return jsonResponse({ success: true, nomorUrut: nomorUrut, message: 'Pendaftaran berhasil!' });
  } catch (err) {
    lock.releaseLock();
    return jsonResponse({ success: false, error: err.message });
  }
}

// Update data berdasarkan Nomor Urut
function handleUpdate(body) {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse({ success: false, error: 'Data kosong' });

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === body.nomorUrut) {
      const rowIndex = i + 2;
      sheet.getRange(rowIndex, 2).setValue(body.kategori);
      sheet.getRange(rowIndex, 3).setValue(body.golongan);
      sheet.getRange(rowIndex, 4).setValue(body.kontingen);
      sheet.getRange(rowIndex, 5).setValue(body.namaPeserta);
      return jsonResponse({ success: true, message: 'Data berhasil diperbarui' });
    }
  }
  return jsonResponse({ success: false, error: 'Nomor urut tidak ditemukan' });
}

// Hapus data berdasarkan Nomor Urut
function handleDelete(body) {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse({ success: false, error: 'Data kosong' });

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === body.nomorUrut) {
      sheet.deleteRow(i + 2);
      return jsonResponse({ success: true, message: 'Data berhasil dihapus' });
    }
  }
  return jsonResponse({ success: false, error: 'Nomor urut tidak ditemukan' });
}

// ============================================
// FITUR PENILAIAN — Handler & Helper
// ============================================

// Helper: ambil atau buat sheet Penilaian
function getSheetPenilaian() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_PENILAIAN);
  if (!sheet) {
    // Coba cari dengan variasi nama (jaga-jaga ada spasi/case berbeda)
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      if (sheets[i].getName().trim().toLowerCase() === SHEET_PENILAIAN.toLowerCase()) {
        sheet = sheets[i];
        break;
      }
    }
  }
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_PENILAIAN);
    sheet.appendRow([
      'ID Penilaian', 'Nomor Urut Peserta', 'Kategori', 'Golongan', 'Kontingen',
      'Nama Peserta', 'Juri', 'Waktu',
      'Orisinalitas', 'Kemantapan', 'Stamina', 'Kekompakan',
      'Kreatifitas', 'Kekayaan Teknik', 'Teknik Serang Bela', 'Penghayatan',
      'Total Nilai', 'Timestamp'
    ]);
  }
  return sheet;
}

// Ambil semua data penilaian
function getAllNilai() {
  const sheet = getSheetPenilaian();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const data = sheet.getRange(2, 1, lastRow - 1, 18).getValues();
  var result = [];
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    // Skip baris kosong (jika kolom A kosong)
    if (!row[0] || String(row[0]).trim() === '') continue;
    result.push({
      idPenilaian: String(row[0]),
      nomorUrut: String(row[1]),
      kategori: String(row[2]),
      golongan: String(row[3]),
      kontingen: String(row[4]),
      namaPeserta: String(row[5]),
      juri: String(row[6]),
      waktu: String(row[7]),
      orisinalitas: Number(row[8]) || 0,
      kemantapan: Number(row[9]) || 0,
      stamina: Number(row[10]) || 0,
      kekompakan: Number(row[11]) || 0,
      kreatifitas: Number(row[12]) || 0,
      kekayaanTeknik: Number(row[13]) || 0,
      teknikSerangBela: Number(row[14]) || 0,
      penghayatan: Number(row[15]) || 0,
      totalNilai: Number(row[16]) || 0,
      timestamp: String(row[17])
    });
  }
  return result;
}

// Ambil data penilaian berdasarkan Nomor Urut peserta
function getNilaiByPeserta(nomorUrut) {
  const allData = getAllNilai();
  return allData.filter(d => d.nomorUrut === nomorUrut);
}

// Tambah penilaian baru
function handleAddNilai(body) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sheet = getSheetPenilaian();

    // Cek duplikasi: nomorUrut + juri tidak boleh sama
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const existing = sheet.getRange(2, 2, lastRow - 1, 6).getValues(); // kolom B-G
      for (let i = 0; i < existing.length; i++) {
        if (String(existing[i][0]) === body.nomorUrut && String(existing[i][5]) === body.juri) {
          lock.releaseLock();
          return jsonResponse({ success: false, error: body.juri + ' sudah memberikan penilaian untuk peserta ini.' });
        }
      }
    }

    const timestamp = new Date().toISOString();
    const row = [
      body.idPenilaian,
      body.nomorUrut,
      body.kategori,
      body.golongan,
      body.kontingen,
      body.namaPeserta,
      body.juri,
      body.waktu,
      body.orisinalitas,
      body.kemantapan,
      body.stamina,
      body.kekompakan,
      body.kreatifitas,
      body.kekayaanTeknik,
      body.teknikSerangBela,
      body.penghayatan,
      body.totalNilai,
      timestamp
    ];

    sheet.appendRow(row);
    lock.releaseLock();
    return jsonResponse({ success: true, message: 'Nilai berhasil disimpan!' });
  } catch (err) {
    lock.releaseLock();
    return jsonResponse({ success: false, error: err.message });
  }
}

// Edit data penilaian berdasarkan ID Penilaian
function handleEditNilai(body) {
  const sheet = getSheetPenilaian();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse({ success: false, error: 'Data penilaian kosong' });

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === body.idPenilaian) {
      const rowIndex = i + 2;
      // Update nilai-nilai (kosong = '' = tidak dinilai)
      // Kolom: I=9 Orisinalitas, J=10 Kemantapan, K=11 Stamina, L=12 Kekompakan,
      //        M=13 Kreatifitas, N=14 Kekayaan Teknik, O=15 Teknik Serang Bela, P=16 Penghayatan
      //        Q=17 Total Nilai, R=18 Timestamp
      sheet.getRange(rowIndex, 9).setValue(body.orisinalitas !== undefined ? body.orisinalitas : '');
      sheet.getRange(rowIndex, 10).setValue(body.kemantapan !== undefined ? body.kemantapan : '');
      sheet.getRange(rowIndex, 11).setValue(body.stamina !== undefined ? body.stamina : '');
      sheet.getRange(rowIndex, 12).setValue(body.kekompakan !== undefined ? body.kekompakan : '');
      sheet.getRange(rowIndex, 13).setValue(body.kreatifitas !== undefined ? body.kreatifitas : '');
      sheet.getRange(rowIndex, 14).setValue(body.kekayaanTeknik !== undefined ? body.kekayaanTeknik : '');
      sheet.getRange(rowIndex, 15).setValue(body.teknikSerangBela !== undefined ? body.teknikSerangBela : '');
      sheet.getRange(rowIndex, 16).setValue(body.penghayatan !== undefined ? body.penghayatan : '');
      sheet.getRange(rowIndex, 17).setValue(body.totalNilai);
      sheet.getRange(rowIndex, 18).setValue(new Date().toISOString());
      return jsonResponse({ success: true, message: 'Nilai berhasil diperbarui' });
    }
  }
  return jsonResponse({ success: false, error: 'ID Penilaian tidak ditemukan' });
}

// Hapus data penilaian berdasarkan Nomor Urut + Juri
function handleDeleteNilai(body) {
  const sheet = getSheetPenilaian();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse({ success: false, error: 'Data penilaian kosong' });

  // Cari berdasarkan kolom B (Nomor Urut) dan G (Juri)
  const data = sheet.getRange(2, 2, lastRow - 1, 6).getValues(); // kolom B sampai G
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]) === body.nomorUrut && String(data[i][5]) === body.juri) {
      sheet.deleteRow(i + 2);
      return jsonResponse({ success: true, message: 'Nilai berhasil dihapus' });
    }
  }
  return jsonResponse({ success: false, error: 'Data nilai tidak ditemukan' });
}

// Rekap nilai per peserta
// Rumus rata-rata (nilai akhir): jika jumlah juri >= 3 → sum semua juri - nilai tertinggi - nilai terendah
//                                jika jumlah juri < 3  → sum semua juri (data belum cukup untuk eliminasi)
function getRekapNilai() {
  const allNilai = getAllNilai();
  
  // Jika tidak ada data, return array kosong
  if (!allNilai || allNilai.length === 0) return [];
  
  // Buat map peserta
  const pesertaMap = {};

  for (var i = 0; i < allNilai.length; i++) {
    var n = allNilai[i];
    if (!pesertaMap[n.nomorUrut]) {
      pesertaMap[n.nomorUrut] = {
        nomorUrut: n.nomorUrut,
        namaPeserta: n.namaPeserta,
        kategori: n.kategori,
        golongan: n.golongan,
        kontingen: n.kontingen,
        waktuTampil: '',
        juri1: null,
        juri2: null,
        juri3: null,
        juri4: null,
        juri5: null,
        orisJuri1: null,
        orisJuri2: null,
        orisJuri3: null,
        orisJuri4: null,
        orisJuri5: null,
        nilaiTertinggi: 0,
        nilaiTerendah: 0,
        totalSemua: 0,
        jumlahJuri: 0,
        rataRata: 0,
        nilaiOrisinalitas: 0
      };
    }

    var p = pesertaMap[n.nomorUrut];
    // Ambil nomor juri dari string "Juri 1", "Juri 2", dst.
    var juriStr = String(n.juri).trim();
    var juriNum = juriStr.replace('Juri ', '');
    p['juri' + juriNum] = n.totalNilai;
    // Simpan orisinalitas per juri (untuk hitung trimmed sum)
    p['orisJuri' + juriNum] = (n.orisinalitas !== '' && n.orisinalitas !== null && n.orisinalitas !== undefined) ? Number(n.orisinalitas) : null;
    p.jumlahJuri += 1;
    // Simpan waktu tampil dari Juri 1
    if (juriNum === '1') {
      p.waktuTampil = String(n.waktu) || '';
    }
  }

  // Hitung nilai akhir sesuai rumus: sum - max - min (jika juri >= 3)
  var keys = Object.keys(pesertaMap);
  var result = [];
  for (var j = 0; j < keys.length; j++) {
    var item = pesertaMap[keys[j]];
    
    // Kumpulkan semua nilai juri yang sudah dinilai
    var nilaiJuri = [];
    if (item.juri1 !== null) nilaiJuri.push(item.juri1);
    if (item.juri2 !== null) nilaiJuri.push(item.juri2);
    if (item.juri3 !== null) nilaiJuri.push(item.juri3);
    if (item.juri4 !== null) nilaiJuri.push(item.juri4);
    if (item.juri5 !== null) nilaiJuri.push(item.juri5);

    if (nilaiJuri.length === 0) {
      item.totalSemua = 0;
      item.rataRata = 0;
      item.nilaiTertinggi = 0;
      item.nilaiTerendah = 0;
    } else {
      var sumAll = 0;
      var max = nilaiJuri[0];
      var min = nilaiJuri[0];
      for (var k = 0; k < nilaiJuri.length; k++) {
        sumAll += nilaiJuri[k];
        if (nilaiJuri[k] > max) max = nilaiJuri[k];
        if (nilaiJuri[k] < min) min = nilaiJuri[k];
      }
      
      item.totalSemua = sumAll;
      item.nilaiTertinggi = max;
      item.nilaiTerendah = min;

      if (nilaiJuri.length >= 3) {
        // Rumus: sum - max - min (eliminasi tertinggi & terendah)
        item.rataRata = sumAll - max - min;
      } else {
        // Belum cukup data untuk eliminasi, pakai sum semua
        item.rataRata = sumAll;
      }
    }

    // Hitung Nilai Orisinalitas (rumus sama: sum - max - min jika juri >= 3)
    var nilaiOris = [];
    if (item.orisJuri1 !== null) nilaiOris.push(item.orisJuri1);
    if (item.orisJuri2 !== null) nilaiOris.push(item.orisJuri2);
    if (item.orisJuri3 !== null) nilaiOris.push(item.orisJuri3);
    if (item.orisJuri4 !== null) nilaiOris.push(item.orisJuri4);
    if (item.orisJuri5 !== null) nilaiOris.push(item.orisJuri5);

    if (nilaiOris.length === 0) {
      item.nilaiOrisinalitas = 0;
    } else {
      var sumOris = 0;
      var maxOris = nilaiOris[0];
      var minOris = nilaiOris[0];
      for (var ko = 0; ko < nilaiOris.length; ko++) {
        sumOris += nilaiOris[ko];
        if (nilaiOris[ko] > maxOris) maxOris = nilaiOris[ko];
        if (nilaiOris[ko] < minOris) minOris = nilaiOris[ko];
      }
      if (nilaiOris.length >= 3) {
        item.nilaiOrisinalitas = sumOris - maxOris - minOris;
      } else {
        item.nilaiOrisinalitas = sumOris;
      }
    }

    result.push(item);
  }

  // Sort berdasarkan rata-rata tertinggi
  result.sort(function(a, b) { return b.rataRata - a.rataRata; });
  return result;
}
