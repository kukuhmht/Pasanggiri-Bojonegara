// ============================================
// Pasanggiri Bojonegara — Google Apps Script Backend
// ============================================

const SPREADSHEET_ID = '10uZMw8iPm8lVaWesOZ08r5xhUemERSzFsPORu4Qjo50';
const SHEET_NAME = 'Peserta';

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
      body.namaPeserta, // sudah digabung dengan koma dari frontend
      body.namaPelatih,
      body.nomorWA,
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
      sheet.getRange(rowIndex, 6).setValue(body.namaPelatih);
      sheet.getRange(rowIndex, 7).setValue(body.nomorWA);
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
