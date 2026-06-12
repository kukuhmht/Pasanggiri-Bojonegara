// ============================================
// Pasanggiri Bojonegara — App Logic
// ============================================

(function() {
  'use strict';

  // === State ===
  let pesertaData = [];

  // === DOM Elements ===
  const $ = id => document.getElementById(id);
  const form = $('form-pendaftaran');
  const kategoriSel = $('kategori');
  const golonganSel = $('golongan');
  const kontingenSel = $('kontingen');
  const pesertaInputs = $('peserta-inputs');
  const pesertaActions = $('peserta-actions');
  const btnAddPeserta = $('btn-add-peserta');
  const btnRemovePeserta = $('btn-remove-peserta');
  const btnSubmit = $('btn-submit');
  const filterKontingen = $('filter-kontingen');
  const summaryCards = $('summary-cards');
  const tbody = $('tbody-peserta');
  const modalEdit = $('modal-edit');
  const formEdit = $('form-edit');
  const toast = $('toast');

  // === Inisialisasi ===
  function init() {
    populateDropdowns();
    setupNavigation();
    setupFormEvents();
    setupEditModal();
    setupPeraturan();
  }

  // Isi dropdown dari config
  function populateDropdowns() {
    CONFIG.KATEGORI.forEach(k => {
      kategoriSel.add(new Option(k.nama, k.nama));
      $('edit-kategori').add(new Option(k.nama, k.nama));
      $('filter-kategori-dashboard').add(new Option(k.nama, k.nama));
    });
    CONFIG.GOLONGAN.forEach(g => {
      golonganSel.add(new Option(g.nama, g.nama));
      $('edit-golongan').add(new Option(g.nama, g.nama));
      $('filter-golongan-dashboard').add(new Option(g.nama, g.nama));
    });
    CONFIG.KONTINGEN.forEach(k => {
      kontingenSel.add(new Option(k.nama, k.nama));
      $('edit-kontingen').add(new Option(k.nama, k.nama));
      filterKontingen.add(new Option(k.nama, k.nama));
    });
  }

  // === Peraturan Toggle ===
  function setupPeraturan() {
    $('btn-toggle-peraturan').addEventListener('click', () => {
      const viewer = $('peraturan-viewer');
      viewer.classList.toggle('hidden');
      $('btn-toggle-peraturan').textContent = viewer.classList.contains('hidden')
        ? '📜 Lihat Peraturan Pasanggiri'
        : '📜 Tutup Peraturan';
    });
  }

  // === Navigasi ===
  function setupNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.page;

        // Cek PIN saat masuk ke halaman Penilaian
        if (target === 'page-penilaian' && !isJuriAuthenticated()) {
          showPinModal();
          return;
        }

        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        $(target).classList.add('active');
        // Load data saat buka dashboard
        if (target === 'page-dashboard') loadDashboard();
        // Load cache peserta saat buka penilaian (untuk autocomplete)
        if (target === 'page-penilaian') loadPesertaCache();
        // Auto-load data saat buka halaman Hasil (publik)
        if (target === 'page-hasil') loadHasil();
      });
    });
  }

  // === Form Logic ===
  function setupFormEvents() {
    // Update jumlah input peserta saat kategori berubah
    kategoriSel.addEventListener('change', updatePesertaFields);

    // Tombol tambah/kurang peserta
    btnAddPeserta.addEventListener('click', () => {
      const kat = getKategoriConfig();
      if (!kat) return;
      const count = pesertaInputs.children.length;
      if (count < kat.max) addPesertaInput(count + 1);
    });

    btnRemovePeserta.addEventListener('click', () => {
      const kat = getKategoriConfig();
      if (!kat) return;
      const count = pesertaInputs.children.length;
      if (count > kat.min) pesertaInputs.lastElementChild.remove();
    });

    // Submit form
    form.addEventListener('submit', handleSubmit);

    // Reset
    form.addEventListener('reset', () => {
      setTimeout(() => {
        pesertaInputs.innerHTML = '<div class="peserta-row"><input type="text" name="peserta[]" placeholder="Peserta 1" required></div>';
        pesertaActions.classList.add('hidden');
        clearErrors();
      }, 0);
    });
  }

  function getKategoriConfig() {
    return CONFIG.KATEGORI.find(k => k.nama === kategoriSel.value);
  }

  function updatePesertaFields() {
    const kat = getKategoriConfig();
    if (!kat) {
      pesertaInputs.innerHTML = '<div class="peserta-row"><input type="text" name="peserta[]" placeholder="Peserta 1" required></div>';
      pesertaActions.classList.add('hidden');
      return;
    }

    pesertaInputs.innerHTML = '';
    for (let i = 1; i <= kat.min; i++) addPesertaInput(i);

    // Tampilkan tombol +/- hanya jika min != max
    if (kat.min !== kat.max) {
      pesertaActions.classList.remove('hidden');
    } else {
      pesertaActions.classList.add('hidden');
    }
  }

  function addPesertaInput(num) {
    const div = document.createElement('div');
    div.className = 'peserta-row';
    div.innerHTML = `<input type="text" name="peserta[]" placeholder="Peserta ${num}" required>`;
    pesertaInputs.appendChild(div);
  }

  // === Validasi ===
  function validateForm() {
    let valid = true;
    clearErrors();

    if (!kategoriSel.value) { showError('err-kategori', 'Pilih kategori'); valid = false; }
    if (!golonganSel.value) { showError('err-golongan', 'Pilih golongan'); valid = false; }
    if (!kontingenSel.value) { showError('err-kontingen', 'Pilih kontingen'); valid = false; }

    // Validasi nama peserta
    const inputs = pesertaInputs.querySelectorAll('input');
    let emptyPeserta = false;
    inputs.forEach(inp => { if (!inp.value.trim()) emptyPeserta = true; });
    if (emptyPeserta) { showError('err-peserta', 'Semua nama peserta wajib diisi'); valid = false; }

    return valid;
  }

  function showError(id, msg) { $(id).textContent = msg; }
  function clearErrors() { document.querySelectorAll('.error-msg').forEach(el => el.textContent = ''); }

  // === Submit ===
  async function handleSubmit(e) {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    const names = Array.from(pesertaInputs.querySelectorAll('input')).map(i => i.value.trim());

    const payload = {
      action: 'add',
      kategori: kategoriSel.value,
      golongan: golonganSel.value,
      kontingen: kontingenSel.value,
      namaPeserta: names.join(', ')
    };

    try {
      const res = await apiPost(payload);
      if (res.success) {
        showToast(`Berhasil! Nomor: ${res.nomorUrut}`, 'success');
        form.reset();
      } else {
        showToast(res.error || 'Gagal mendaftar', 'error');
      }
    } catch (err) {
      showToast('Gagal menghubungi server', 'error');
    }
    setLoading(false);
  }

  function setLoading(state) {
    btnSubmit.disabled = state;
    btnSubmit.querySelector('.btn-text').classList.toggle('hidden', state);
    btnSubmit.querySelector('.btn-loading').classList.toggle('hidden', !state);
  }

  // === Dashboard ===
  async function loadDashboard() {
    tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">Memuat data...</td></tr>';
    summaryCards.innerHTML = '<div class="skeleton-card"></div><div class="skeleton-card"></div>';

    try {
      const res = await apiGet('getAll');
      if (res.success) {
        pesertaData = res.data;
        renderDashboard();
      } else {
        tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">Gagal memuat data</td></tr>';
      }
    } catch {
      tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">Gagal menghubungi server</td></tr>';
    }
  }

  // Filter listener
  filterKontingen.addEventListener('change', renderDashboard);
  $('filter-kategori-dashboard').addEventListener('change', renderDashboard);
  $('filter-golongan-dashboard').addEventListener('change', renderDashboard);

  function renderDashboard() {
    const filterKat = $('filter-kategori-dashboard').value;
    const filterGol = $('filter-golongan-dashboard').value;
    const filterKont = filterKontingen.value;

    let filtered = pesertaData;
    if (filterKat) filtered = filtered.filter(d => d.kategori === filterKat);
    if (filterGol) filtered = filtered.filter(d => d.golongan === filterGol);
    if (filterKont) filtered = filtered.filter(d => d.kontingen === filterKont);

    renderSummary(filtered);
    renderTable(filtered);
  }

  function renderSummary(data) {
    const total = data.length;
    const byKategori = {};
    CONFIG.KATEGORI.forEach(k => byKategori[k.nama] = 0);
    data.forEach(d => { if (byKategori[d.kategori] !== undefined) byKategori[d.kategori]++; });

    let html = `<div class="summary-card"><div class="card-label">Total</div><div class="card-value">${total}</div></div>`;
    Object.entries(byKategori).forEach(([nama, count]) => {
      html += `<div class="summary-card"><div class="card-label">${nama}</div><div class="card-value">${count}</div></div>`;
    });
    summaryCards.innerHTML = html;
  }

  function renderTable(data) {
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">Belum ada data</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(d => `
      <tr>
        <td>${d.nomorUrut}</td>
        <td>${d.kategori}</td>
        <td>${d.golongan}</td>
        <td>${d.namaPeserta}</td>
        <td>
          <button class="btn-edit" onclick="App.editRow('${d.nomorUrut}')">Edit</button>
          <button class="btn-delete" onclick="App.deleteRow('${d.nomorUrut}')">Hapus</button>
        </td>
      </tr>
    `).join('');
  }

  // === Edit Modal ===
  function setupEditModal() {
    $('btn-cancel-edit').addEventListener('click', closeModal);
    $('modal-edit').querySelector('.modal-overlay').addEventListener('click', closeModal);
    formEdit.addEventListener('submit', handleEditSubmit);
  }

  function openEdit(nomorUrut) {
    const item = pesertaData.find(d => d.nomorUrut === nomorUrut);
    if (!item) return;

    $('edit-nomor-urut').value = item.nomorUrut;
    $('edit-kategori').value = item.kategori;
    $('edit-golongan').value = item.golongan;
    $('edit-kontingen').value = item.kontingen;
    $('edit-peserta').value = item.namaPeserta;
    modalEdit.classList.remove('hidden');
  }

  function closeModal() { modalEdit.classList.add('hidden'); }

  async function handleEditSubmit(e) {
    e.preventDefault();
    if (!confirm('Simpan perubahan data ini?')) return;

    const payload = {
      action: 'update',
      nomorUrut: $('edit-nomor-urut').value,
      kategori: $('edit-kategori').value,
      golongan: $('edit-golongan').value,
      kontingen: $('edit-kontingen').value,
      namaPeserta: $('edit-peserta').value.trim()
    };

    try {
      const res = await apiPost(payload);
      if (res.success) {
        showToast('Data berhasil diperbarui', 'success');
        closeModal();
        loadDashboard();
      } else {
        showToast(res.error || 'Gagal memperbarui', 'error');
      }
    } catch {
      showToast('Gagal menghubungi server', 'error');
    }
  }

  // === Delete ===
  async function deleteRow(nomorUrut) {
    if (!confirm(`Hapus data ${nomorUrut}?`)) return;

    try {
      const res = await apiPost({ action: 'delete', nomorUrut });
      if (res.success) {
        showToast('Data berhasil dihapus', 'success');
        loadDashboard();
      } else {
        showToast(res.error || 'Gagal menghapus', 'error');
      }
    } catch {
      showToast('Gagal menghubungi server', 'error');
    }
  }

  // === API Helpers ===
  async function apiGet(action, params = {}) {
    const url = new URL(CONFIG.APPS_SCRIPT_URL);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString(), { redirect: 'follow' });
    const text = await res.text();
    return JSON.parse(text);
  }

  async function apiPost(payload) {
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    return JSON.parse(text);
  }

  // === Toast ===
  function showToast(msg, type = 'success') {
    toast.textContent = msg;
    toast.className = `toast ${type}`;
    setTimeout(() => toast.classList.add('hidden'), 3000);
  }

  // === Public API (untuk onclick di tabel) ===
  window.App = { editRow: openEdit, deleteRow };

  // ============================================
  // FITUR PENILAIAN
  // ============================================

  // === State Penilaian ===
  let currentPeserta = null; // data peserta yang sedang dinilai
  let nilaiJuriSudah = []; // juri yang sudah menilai peserta ini
  let rekapData = []; // data rekap dari server

  // === DOM Penilaian ===
  const modalPin = $('modal-pin');
  const inputPin = $('input-pin');
  const btnPinMasuk = $('btn-pin-masuk');
  const btnKunci = $('btn-kunci');
  const inputCariNama = $('input-cari-nama');
  const suggestionList = $('suggestion-list');
  const dataPesertaFound = $('data-peserta-found');
  const sectionJuri = $('section-juri');
  const sectionNilai = $('section-nilai');
  const selectJuri = $('select-juri');
  const kriteriaInputsDiv = $('kriteria-inputs');
  const totalNilaiBox = $('total-nilai-box');
  const totalNilaiValue = $('total-nilai-value');
  const btnSimpanNilai = $('btn-simpan-nilai');
  const btnResetNilai = $('btn-reset-nilai');
  const btnRefreshRekap = $('btn-refresh-rekap');

  // Cache data peserta untuk pencarian
  let allPesertaCache = [];

  // === Inisialisasi Penilaian ===
  function initPenilaian() {
    setupPinModal();
    setupPenilaianTabs();
    setupCariPeserta();
    setupJuriSelect();
    setupNilaiActions();
    setupRekapFilters();
    setupEditNilaiModal();
    populateRekapDropdowns();
  }

  // === Modal PIN ===
  function setupPinModal() {
    btnPinMasuk.addEventListener('click', validatePin);
    inputPin.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') validatePin();
    });
    $('modal-pin-overlay').addEventListener('click', () => {
      // Tutup modal dan kembali ke tab sebelumnya
      modalPin.classList.add('hidden');
      // Aktifkan tab form (default)
      switchToPage('page-form');
    });
    btnKunci.addEventListener('click', lockPenilaian);
  }

  function validatePin() {
    const pin = inputPin.value.trim();
    if (pin === PIN_JURI) {
      // PIN benar — simpan sesi dan masuk ke halaman Penilaian
      sessionStorage.setItem('juriAuthenticated', 'true');
      modalPin.classList.add('hidden');
      inputPin.value = '';
      $('err-pin').textContent = '';
      // Pindah ke halaman penilaian
      switchToPage('page-penilaian');
      // Load cache peserta untuk autocomplete
      loadPesertaCache();
    } else {
      // PIN salah
      $('err-pin').textContent = 'PIN tidak valid. Silakan coba lagi.';
      inputPin.value = '';
      inputPin.focus();
    }
  }

  function lockPenilaian() {
    sessionStorage.removeItem('juriAuthenticated');
    showToast('Akses penilaian dikunci', 'success');
    switchToPage('page-form');
  }

  function isJuriAuthenticated() {
    return sessionStorage.getItem('juriAuthenticated') === 'true';
  }

  function showPinModal() {
    inputPin.value = '';
    $('err-pin').textContent = '';
    modalPin.classList.remove('hidden');
    setTimeout(() => inputPin.focus(), 100);
  }

  // Helper pindah halaman
  function switchToPage(pageId) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetBtn = document.querySelector(`.nav-btn[data-page="${pageId}"]`);
    if (targetBtn) targetBtn.classList.add('active');
    $(pageId).classList.add('active');
  }

  // === Penilaian Sub-tabs ===
  function setupPenilaianTabs() {
    document.querySelectorAll('.penilaian-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.penilaian-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.subtab').forEach(s => s.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.subtab;
        $(target).classList.add('active');
        if (target === 'subtab-rekap') loadRekap();
      });
    });
  }

  // === Cari Peserta (Autocomplete by Nama) ===
  function setupCariPeserta() {
    inputCariNama.addEventListener('input', handleSearchInput);
    inputCariNama.addEventListener('focus', handleSearchInput);
    // Tutup suggestion saat klik di luar
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-peserta-wrapper')) {
        suggestionList.classList.add('hidden');
      }
    });
  }

  // Load semua peserta ke cache (dipanggil saat masuk halaman penilaian)
  async function loadPesertaCache() {
    try {
      const res = await apiGet('getAll');
      if (res.success) {
        allPesertaCache = res.data || [];
      }
    } catch {
      allPesertaCache = [];
    }
  }

  function handleSearchInput() {
    const keyword = inputCariNama.value.trim().toLowerCase();
    if (!keyword) {
      suggestionList.classList.add('hidden');
      return;
    }

    // Filter peserta berdasarkan nama
    const matches = allPesertaCache.filter(p =>
      p.namaPeserta.toLowerCase().includes(keyword)
    ).slice(0, 10); // batasi 10 hasil

    renderSuggestions(matches);
  }

  function renderSuggestions(matches) {
    if (!matches.length) {
      suggestionList.innerHTML = '<div class="suggestion-empty">Tidak ada peserta ditemukan</div>';
      suggestionList.classList.remove('hidden');
      return;
    }

    suggestionList.innerHTML = matches.map((p, idx) => `
      <div class="suggestion-item" data-idx="${idx}">
        <div class="suggestion-name">${p.namaPeserta}</div>
        <div class="suggestion-meta">${p.nomorUrut} · ${p.kategori} · ${p.golongan} · ${p.kontingen}</div>
      </div>
    `).join('');

    // Attach click handler
    suggestionList.querySelectorAll('.suggestion-item').forEach((el, idx) => {
      el.addEventListener('click', () => {
        pilihPeserta(matches[idx]);
      });
    });

    suggestionList.classList.remove('hidden');
  }

  async function pilihPeserta(data) {
    currentPeserta = data;
    inputCariNama.value = data.namaPeserta;
    suggestionList.classList.add('hidden');
    tampilkanDataPeserta(data);
    await cekJuriSudahNilai(data.nomorUrut);
  }

  function tampilkanDataPeserta(data) {
    $('info-nomor-urut').textContent = data.nomorUrut;
    $('info-kategori').textContent = data.kategori;
    $('info-golongan').textContent = data.golongan;
    $('info-kontingen').textContent = data.kontingen;
    $('input-nama-peserta').value = data.namaPeserta;
    // Waktu tampil dikosongkan, diinput manual oleh juri
    $('input-waktu-menit').value = '';
    $('input-waktu-detik').value = '';
    // Bangun input nilai sesuai kategori peserta
    buildKriteriaInputs(data.kategori);
    dataPesertaFound.classList.remove('hidden');
    sectionJuri.classList.remove('hidden');
    sectionNilai.classList.remove('hidden');
  }

  async function cekJuriSudahNilai(nomorUrut) {
    try {
      const res = await apiGet('getNilaiByPeserta', { nomorUrut });
      if (res.success && res.data) {
        nilaiJuriSudah = res.data.map(d => d.juri);
      } else {
        nilaiJuriSudah = [];
      }
    } catch {
      nilaiJuriSudah = [];
    }
    renderJuriBadges();
  }

  // === Juri Select & Badges ===
  function setupJuriSelect() {
    CONFIG.JURI_LIST.forEach(j => {
      selectJuri.add(new Option(j, j));
    });
  }

  function renderJuriBadges() {
    const container = $('juri-badges');
    container.innerHTML = CONFIG.JURI_LIST.map(j => {
      const done = nilaiJuriSudah.includes(j);
      return `<span class="juri-badge ${done ? 'done' : ''}">${done ? '✓ ' : ''}${j}</span>`;
    }).join('');
  }

  // === Kriteria Inputs (Dinamis per Kategori) ===

  // Helper: cari kriteria dari master list berdasarkan key
  function getKriteriaByKey(key) {
    return CONFIG.KRITERIA_PENILAIAN.find(k => k.key === key);
  }

  // Helper: ambil daftar kriteria aktif untuk kategori tertentu
  function getActiveKriteria(kategori) {
    const keys = CONFIG.KRITERIA_PER_KATEGORI[kategori];
    if (!keys) return CONFIG.KRITERIA_PENILAIAN.slice(); // fallback: semua
    return keys.map(getKriteriaByKey).filter(Boolean);
  }

  // Bangun input nilai sesuai kategori peserta
  function buildKriteriaInputs(kategori) {
    const kriteria = getActiveKriteria(kategori);
    kriteriaInputsDiv.innerHTML = kriteria.map((k, idx) => `
      <div class="kriteria-card" id="kriteria-card-${k.key}">
        <div class="kriteria-name">${idx + 1}. ${k.nama}</div>
        <input type="number" id="nilai-${k.key}" min="${k.min}" max="${k.max}" placeholder="${k.min}" aria-label="${k.nama}">
        <div class="kriteria-hint">(${k.min} – ${k.max})</div>
        <div class="kriteria-error" id="err-nilai-${k.key}"></div>
      </div>
    `).join('');

    // Event listener live untuk hitung total
    kriteria.forEach(k => {
      const input = $(`nilai-${k.key}`);
      input.addEventListener('input', () => {
        validateNilaiInput(k.key);
        hitungTotalNilai();
      });
    });
  }

  function validateNilaiInput(key) {
    const k = getKriteriaByKey(key);
    const input = $(`nilai-${key}`);
    const card = $(`kriteria-card-${key}`);
    const errEl = $(`err-nilai-${key}`);
    if (!input) return true;
    const val = parseFloat(input.value);

    if (input.value === '') {
      card.classList.remove('invalid');
      input.classList.remove('invalid');
      errEl.textContent = '';
      return true;
    }

    if (isNaN(val) || val < k.min || val > k.max) {
      card.classList.add('invalid');
      input.classList.add('invalid');
      errEl.textContent = `Nilai harus antara ${k.min} – ${k.max}`;
      return false;
    }

    card.classList.remove('invalid');
    input.classList.remove('invalid');
    errEl.textContent = '';
    return true;
  }

  function hitungTotalNilai() {
    let total = 0;
    let adaInput = false;
    let hasInvalid = false;

    const kriteria = currentPeserta ? getActiveKriteria(currentPeserta.kategori) : [];
    kriteria.forEach(k => {
      const input = $(`nilai-${k.key}`);
      if (!input) return;
      const val = parseFloat(input.value);
      if (input.value !== '') {
        adaInput = true;
        if (isNaN(val) || val < k.min || val > k.max) {
          hasInvalid = true;
        } else {
          total += val;
        }
      }
    });

    // Update tampilan total
    totalNilaiBox.classList.remove('total-mid', 'total-high');
    if (!adaInput) {
      totalNilaiValue.textContent = '—';
    } else if (hasInvalid) {
      totalNilaiValue.textContent = total;
    } else {
      totalNilaiValue.textContent = total;
      if (total >= 230) totalNilaiBox.classList.add('total-high');
      else if (total >= 210) totalNilaiBox.classList.add('total-mid');
    }
  }

  // Konversi 2 input menit + detik menjadi total detik (atau null jika format salah)
  function getWaktuDetik() {
    const menit = parseInt($('input-waktu-menit').value, 10);
    const detik = parseInt($('input-waktu-detik').value, 10);
    if (isNaN(menit) || isNaN(detik)) return null;
    if (menit < 0 || detik < 0 || detik > 59) return null;
    return menit * 60 + detik;
  }

  // Konversi ke string mm:ss untuk disimpan ke sheet
  function getWaktuString() {
    const m = $('input-waktu-menit').value.trim();
    const s = $('input-waktu-detik').value.trim();
    if (m === '' || s === '') return '';
    const mPad = m.padStart(2, '0');
    const sPad = s.padStart(2, '0');
    return `${mPad}:${sPad}`;
  }

  // Cek apakah waktu tampil melebihi batas, lalu set KEMANTAPAN otomatis
  function cekWaktuTampil() {
    const detik = getWaktuDetik();
    const inputKemantapan = $('nilai-kemantapan');
    const errWaktu = $('err-waktu-tampil');

    // Reset notifikasi
    errWaktu.textContent = '';

    if (detik === null) return;

    // Jika melebihi batas → KEMANTAPAN otomatis nilai default
    if (detik > CONFIG.WAKTU_TAMPIL_BATAS_DETIK && inputKemantapan) {
      inputKemantapan.value = CONFIG.KEMANTAPAN_DEFAULT_LEBIH_WAKTU;
      inputKemantapan.readOnly = true;
      inputKemantapan.classList.add('auto-filled');
      validateNilaiInput('kemantapan');
      hitungTotalNilai();
      const card = $('kriteria-card-kemantapan');
      if (card && !card.querySelector('.auto-note')) {
        const note = document.createElement('div');
        note.className = 'kriteria-hint auto-note';
        note.textContent = `⏱️ Waktu > 3:10 → KEMANTAPAN otomatis ${CONFIG.KEMANTAPAN_DEFAULT_LEBIH_WAKTU}`;
        card.appendChild(note);
      }
    } else if (inputKemantapan) {
      // Waktu dalam batas → buka kembali input KEMANTAPAN
      inputKemantapan.readOnly = false;
      inputKemantapan.classList.remove('auto-filled');
      const card = $('kriteria-card-kemantapan');
      const note = card ? card.querySelector('.auto-note') : null;
      if (note) note.remove();
      hitungTotalNilai();
    }
  }

  // === Aksi Simpan & Reset ===
  function setupNilaiActions() {
    btnSimpanNilai.addEventListener('click', simpanNilai);
    btnResetNilai.addEventListener('click', resetNilaiInputs);
    // Listener waktu tampil (2 input: menit + detik)
    $('input-waktu-menit').addEventListener('input', cekWaktuTampil);
    $('input-waktu-detik').addEventListener('input', cekWaktuTampil);
    $('input-waktu-menit').addEventListener('blur', cekWaktuTampil);
    $('input-waktu-detik').addEventListener('blur', cekWaktuTampil);
  }

  async function simpanNilai() {
    // Validasi peserta sudah dipilih
    if (!currentPeserta) {
      showToast('Cari peserta terlebih dahulu', 'error');
      return;
    }

    // Validasi juri
    const juri = selectJuri.value;
    if (!juri) {
      $('err-juri').textContent = 'Pilih juri terlebih dahulu.';
      return;
    }
    $('err-juri').textContent = '';

    // Cek duplikasi juri
    if (nilaiJuriSudah.includes(juri)) {
      showToast(`${juri} sudah memberikan penilaian untuk peserta ini.`, 'error');
      return;
    }

    // Validasi waktu tampil
    const waktu = getWaktuString();
    if (!waktu) {
      $('err-waktu-tampil').textContent = 'Waktu tampil wajib diisi.';
      showToast('Waktu tampil wajib diisi', 'error');
      return;
    }
    if (getWaktuDetik() === null) {
      $('err-waktu-tampil').textContent = 'Waktu tampil tidak valid.';
      showToast('Waktu tampil tidak valid', 'error');
      return;
    }
    $('err-waktu-tampil').textContent = '';

    // Validasi nilai: tidak wajib diisi, tapi jika diisi harus valid range
    let allValid = true;
    const kriteria = getActiveKriteria(currentPeserta.kategori);
    // Bangun objek nilai per key (default '' untuk semua kriteria master)
    const nilaiByKey = {};
    CONFIG.KRITERIA_PENILAIAN.forEach(k => { nilaiByKey[k.key] = ''; });

    kriteria.forEach(k => {
      const inputVal = $(`nilai-${k.key}`).value;
      if (inputVal === '') {
        nilaiByKey[k.key] = '';
      } else {
        if (!validateNilaiInput(k.key)) allValid = false;
        const val = parseFloat(inputVal);
        if (isNaN(val)) allValid = false;
        nilaiByKey[k.key] = val;
      }
    });

    if (!allValid) {
      showToast('Periksa kembali input nilai (di luar range)', 'error');
      return;
    }

    // Hitung total (skip yang kosong)
    const totalNilai = Object.values(nilaiByKey)
      .reduce((acc, v) => acc + (typeof v === 'number' ? v : 0), 0);

    // Buat ID Penilaian: NLP-{NomorUrut}-{Juri}
    const juriKey = juri.replace(' ', '').toUpperCase(); // "Juri 1" → "JURI1"
    const idPenilaian = `NLP-${currentPeserta.nomorUrut}-${juriKey}`;

    const namaPeserta = $('input-nama-peserta').value.trim();

    const payload = {
      action: 'addNilai',
      idPenilaian,
      nomorUrut: currentPeserta.nomorUrut,
      kategori: currentPeserta.kategori,
      golongan: currentPeserta.golongan,
      kontingen: currentPeserta.kontingen,
      namaPeserta,
      juri,
      waktu,
      orisinalitas: nilaiByKey.orisinalitas,
      kemantapan: nilaiByKey.kemantapan,
      stamina: nilaiByKey.stamina,
      kekompakan: nilaiByKey.kekompakan,
      kreatifitas: nilaiByKey.kreatifitas,
      kekayaanTeknik: nilaiByKey.kekayaanTeknik,
      teknikSerangBela: nilaiByKey.teknikSerangBela,
      penghayatan: nilaiByKey.penghayatan,
      totalNilai
    };

    // Set loading
    btnSimpanNilai.disabled = true;
    btnSimpanNilai.querySelector('.btn-text').classList.add('hidden');
    btnSimpanNilai.querySelector('.btn-loading').classList.remove('hidden');

    try {
      const res = await apiPost(payload);
      if (res.success) {
        showToast('Nilai berhasil disimpan!', 'success');
        nilaiJuriSudah.push(juri);
        renderJuriBadges();
        resetNilaiInputs();
      } else {
        showToast(res.error || 'Gagal menyimpan nilai', 'error');
      }
    } catch {
      showToast('Gagal menghubungi server', 'error');
    }

    btnSimpanNilai.disabled = false;
    btnSimpanNilai.querySelector('.btn-text').classList.remove('hidden');
    btnSimpanNilai.querySelector('.btn-loading').classList.add('hidden');
  }

  function resetNilaiInputs() {
    const kriteria = currentPeserta ? getActiveKriteria(currentPeserta.kategori) : [];
    kriteria.forEach(k => {
      const input = $(`nilai-${k.key}`);
      if (!input) return;
      input.value = '';
      input.readOnly = false;
      input.classList.remove('invalid', 'auto-filled');
      const card = $(`kriteria-card-${k.key}`);
      if (card) {
        card.classList.remove('invalid');
        const note = card.querySelector('.auto-note');
        if (note) note.remove();
      }
      const errEl = $(`err-nilai-${k.key}`);
      if (errEl) errEl.textContent = '';
    });
    selectJuri.value = '';
    $('err-juri').textContent = '';
    totalNilaiValue.textContent = '—';
    totalNilaiBox.classList.remove('total-mid', 'total-high');
  }

  function resetFormPenilaian() {
    currentPeserta = null;
    nilaiJuriSudah = [];
    inputCariNama.value = '';
    suggestionList.classList.add('hidden');
    dataPesertaFound.classList.add('hidden');
    sectionJuri.classList.add('hidden');
    sectionNilai.classList.add('hidden');
    resetNilaiInputs();
    $('juri-badges').innerHTML = '';
    $('input-waktu-menit').value = '';
    $('input-waktu-detik').value = '';
    $('err-waktu-tampil').textContent = '';
  }

  // === Rekap Nilai ===
  function populateRekapDropdowns() {
    const filterGolongan = $('filter-rekap-golongan');
    const filterKategori = $('filter-rekap-kategori');
    CONFIG.GOLONGAN.forEach(g => {
      filterGolongan.add(new Option(g.nama, g.nama));
    });
    CONFIG.KATEGORI.forEach(k => {
      filterKategori.add(new Option(k.nama, k.nama));
    });
  }

  function setupRekapFilters() {
    btnRefreshRekap.addEventListener('click', loadRekap);
    $('filter-rekap-golongan').addEventListener('change', renderRekap);
    $('filter-rekap-kategori').addEventListener('change', renderRekap);
  }

  async function loadRekap() {
    const tbodyRekap = $('tbody-rekap');
    tbodyRekap.innerHTML = '<tr><td colspan="14" class="loading-cell">Memuat data...</td></tr>';

    try {
      const res = await apiGet('getRekap');
      if (res.success) {
        rekapData = res.data || [];
        renderRekap();
      } else {
        tbodyRekap.innerHTML = '<tr><td colspan="14" class="loading-cell">Gagal memuat data</td></tr>';
      }
    } catch {
      tbodyRekap.innerHTML = '<tr><td colspan="14" class="loading-cell">Gagal menghubungi server</td></tr>';
    }
  }

  function renderRekap() {
    const golFilter = $('filter-rekap-golongan').value;
    const katFilter = $('filter-rekap-kategori').value;
    const tbodyRekap = $('tbody-rekap');

    let filtered = [...rekapData];
    if (golFilter) filtered = filtered.filter(d => d.golongan === golFilter);
    if (katFilter) filtered = filtered.filter(d => d.kategori === katFilter);

    if (!filtered.length) {
      tbodyRekap.innerHTML = '<tr><td colspan="14" class="loading-cell">Belum ada data penilaian</td></tr>';
      return;
    }

    // Tentukan peringkat 1-3 per kombinasi Kategori + Golongan
    // Hanya peserta dengan rataRata > 0 yang bisa dapat peringkat
    const groups = {};
    filtered.forEach(d => {
      if (d.rataRata <= 0) return;
      const key = d.kategori + '|' + d.golongan;
      if (!groups[key]) groups[key] = [];
      groups[key].push(d);
    });

    // Map nomorUrut → peringkat (1, 2, atau 3)
    const peringkatMap = {};
    Object.keys(groups).forEach(key => {
      const sorted = groups[key].slice().sort((a, b) => b.rataRata - a.rataRata);
      sorted.forEach((item, idx) => {
        if (idx < 3) peringkatMap[item.nomorUrut] = idx + 1;
      });
    });

    // Helper render badge & class
    const peringkatBadge = (rank) => {
      if (rank === 1) return '<span class="badge-peringkat badge-emas">🥇 Emas</span>';
      if (rank === 2) return '<span class="badge-peringkat badge-silver">🥈 Silver</span>';
      if (rank === 3) return '<span class="badge-peringkat badge-perunggu">🥉 Perunggu</span>';
      return '';
    };
    const peringkatClass = (rank) => {
      if (rank === 1) return 'highlight-emas';
      if (rank === 2) return 'highlight-silver';
      if (rank === 3) return 'highlight-perunggu';
      return '';
    };

    tbodyRekap.innerHTML = filtered.map(d => {
      const peringkat = peringkatMap[d.nomorUrut];
      const adaCukupJuri = d.jumlahJuri >= 3;
      // Render cell juri dengan tombol edit/hapus jika sudah ada nilai
      const juriCell = (juriNum) => {
        const nilai = d['juri' + juriNum];
        if (nilai === null || nilai === undefined) {
          return `<td class="juri-cell">-</td>`;
        }
        return `<td class="juri-cell has-nilai">
          <div>${nilai}</div>
          <div class="juri-actions">
            <button class="btn-mini btn-mini-edit" onclick="App.editNilai('${d.nomorUrut}','Juri ${juriNum}')" title="Edit">✏️</button>
            <button class="btn-mini btn-mini-delete" onclick="App.hapusNilai('${d.nomorUrut}','Juri ${juriNum}')" title="Hapus">🗑️</button>
          </div>
        </td>`;
      };

      return `
        <tr class="${peringkatClass(peringkat)}">
          <td>${d.nomorUrut}</td>
          <td>${d.namaPeserta}</td>
          <td>${d.kontingen}</td>
          <td>${d.kategori}</td>
          <td>${d.golongan}</td>
          ${juriCell(1)}
          ${juriCell(2)}
          ${juriCell(3)}
          ${juriCell(4)}
          ${juriCell(5)}
          <td>${adaCukupJuri && d.nilaiTertinggi ? d.nilaiTertinggi : '-'}</td>
          <td>${adaCukupJuri && d.nilaiTerendah ? d.nilaiTerendah : '-'}</td>
          <td>${d.rataRata > 0 ? d.rataRata : '-'}${peringkatBadge(peringkat)}</td>
          <td>${d.jumlahJuri}/5</td>
        </tr>
      `;
    }).join('');
  }

  // === Edit & Hapus Nilai per Juri ===
  let editingNilaiData = null; // simpan data yang sedang diedit

  function setupEditNilaiModal() {
    $('btn-cancel-edit-nilai').addEventListener('click', closeEditNilaiModal);
    $('modal-edit-nilai').querySelector('.modal-overlay').addEventListener('click', closeEditNilaiModal);
    $('btn-update-nilai').addEventListener('click', updateNilai);
    // Input kriteria dibangun dinamis saat modal dibuka (lihat openEditNilai)
  }

  // Bangun input kriteria modal edit sesuai kategori
  function buildEditKriteriaInputs(kategori) {
    const kriteria = getActiveKriteria(kategori);
    $('edit-kriteria-inputs').innerHTML = kriteria.map((k, idx) => `
      <div class="kriteria-card" id="edit-kriteria-card-${k.key}">
        <div class="kriteria-name">${idx + 1}. ${k.nama}</div>
        <input type="number" id="edit-nilai-${k.key}" min="${k.min}" max="${k.max}" placeholder="${k.min}" aria-label="${k.nama}">
        <div class="kriteria-hint">(${k.min} – ${k.max})</div>
        <div class="kriteria-error" id="err-edit-nilai-${k.key}"></div>
      </div>
    `).join('');

    kriteria.forEach(k => {
      $(`edit-nilai-${k.key}`).addEventListener('input', () => hitungTotalNilaiEdit(kategori));
    });
  }

  function hitungTotalNilaiEdit(kategori) {
    let total = 0;
    let adaInput = false;
    const kriteria = getActiveKriteria(kategori);
    kriteria.forEach(k => {
      const input = $(`edit-nilai-${k.key}`);
      if (!input) return;
      const val = parseFloat(input.value);
      const card = $(`edit-kriteria-card-${k.key}`);
      const errEl = $(`err-edit-nilai-${k.key}`);

      if (input.value === '') {
        card.classList.remove('invalid');
        input.classList.remove('invalid');
        errEl.textContent = '';
      } else {
        adaInput = true;
        if (isNaN(val) || val < k.min || val > k.max) {
          card.classList.add('invalid');
          input.classList.add('invalid');
          errEl.textContent = `Nilai harus antara ${k.min} – ${k.max}`;
        } else {
          card.classList.remove('invalid');
          input.classList.remove('invalid');
          errEl.textContent = '';
          total += val;
        }
      }
    });

    const box = $('edit-total-nilai-box');
    box.classList.remove('total-mid', 'total-high');
    if (!adaInput) {
      $('edit-total-nilai-value').textContent = '—';
    } else {
      $('edit-total-nilai-value').textContent = total;
      if (total >= 230) box.classList.add('total-high');
      else if (total >= 210) box.classList.add('total-mid');
    }
  }

  async function openEditNilai(nomorUrut, juri) {
    // Ambil data nilai juri ini
    try {
      const res = await apiGet('getNilaiByPeserta', { nomorUrut });
      if (!res.success || !res.data) {
        showToast('Gagal mengambil data nilai', 'error');
        return;
      }
      const nilaiData = res.data.find(d => d.juri === juri);
      if (!nilaiData) {
        showToast('Data nilai tidak ditemukan', 'error');
        return;
      }

      editingNilaiData = nilaiData;
      $('edit-nilai-id').value = nilaiData.idPenilaian;
      $('edit-nilai-peserta').textContent = nilaiData.namaPeserta;
      $('edit-nilai-nomor').textContent = nilaiData.nomorUrut;
      $('edit-nilai-juri').textContent = nilaiData.juri;

      // Bangun input sesuai kategori peserta lalu isi nilainya
      buildEditKriteriaInputs(nilaiData.kategori);
      const kriteria = getActiveKriteria(nilaiData.kategori);
      kriteria.forEach(k => {
        const val = nilaiData[k.key];
        const input = $(`edit-nilai-${k.key}`);
        input.value = (val !== null && val !== undefined && val !== 0 && val !== '') ? val : '';
        input.classList.remove('invalid');
        $(`edit-kriteria-card-${k.key}`).classList.remove('invalid');
        $(`err-edit-nilai-${k.key}`).textContent = '';
      });

      hitungTotalNilaiEdit(nilaiData.kategori);
      $('modal-edit-nilai').classList.remove('hidden');
    } catch (err) {
      showToast('Gagal menghubungi server', 'error');
    }
  }

  function closeEditNilaiModal() {
    $('modal-edit-nilai').classList.add('hidden');
    editingNilaiData = null;
  }

  async function updateNilai() {
    if (!editingNilaiData) return;

    const kategori = editingNilaiData.kategori;
    const kriteria = getActiveKriteria(kategori);

    // Validasi nilai (opsional, tapi kalau diisi harus dalam range)
    let allValid = true;
    const nilaiByKey = {};
    CONFIG.KRITERIA_PENILAIAN.forEach(k => { nilaiByKey[k.key] = ''; });

    kriteria.forEach(k => {
      const inputVal = $(`edit-nilai-${k.key}`).value;
      if (inputVal === '') {
        nilaiByKey[k.key] = '';
      } else {
        const val = parseFloat(inputVal);
        if (isNaN(val) || val < k.min || val > k.max) allValid = false;
        nilaiByKey[k.key] = val;
      }
    });

    if (!allValid) {
      showToast('Periksa kembali input nilai (di luar range)', 'error');
      return;
    }

    const totalNilai = Object.values(nilaiByKey)
      .reduce((acc, v) => acc + (typeof v === 'number' ? v : 0), 0);

    const payload = {
      action: 'editNilai',
      idPenilaian: editingNilaiData.idPenilaian,
      orisinalitas: nilaiByKey.orisinalitas,
      kemantapan: nilaiByKey.kemantapan,
      stamina: nilaiByKey.stamina,
      kekompakan: nilaiByKey.kekompakan,
      kreatifitas: nilaiByKey.kreatifitas,
      kekayaanTeknik: nilaiByKey.kekayaanTeknik,
      teknikSerangBela: nilaiByKey.teknikSerangBela,
      penghayatan: nilaiByKey.penghayatan,
      totalNilai
    };

    const btnUpdate = $('btn-update-nilai');
    btnUpdate.disabled = true;
    btnUpdate.querySelector('.btn-text').classList.add('hidden');
    btnUpdate.querySelector('.btn-loading').classList.remove('hidden');

    try {
      const res = await apiPost(payload);
      if (res.success) {
        showToast('Nilai berhasil diperbarui', 'success');
        closeEditNilaiModal();
        loadRekap();
      } else {
        showToast(res.error || 'Gagal memperbarui nilai', 'error');
      }
    } catch {
      showToast('Gagal menghubungi server', 'error');
    }

    btnUpdate.disabled = false;
    btnUpdate.querySelector('.btn-text').classList.remove('hidden');
    btnUpdate.querySelector('.btn-loading').classList.add('hidden');
  }

  async function hapusNilai(nomorUrut, juri) {
    if (!confirm(`Hapus nilai ${juri} untuk peserta ${nomorUrut}?`)) return;

    try {
      const res = await apiPost({
        action: 'deleteNilai',
        nomorUrut,
        juri
      });
      if (res.success) {
        showToast('Nilai berhasil dihapus', 'success');
        loadRekap();
      } else {
        showToast(res.error || 'Gagal menghapus nilai', 'error');
      }
    } catch {
      showToast('Gagal menghubungi server', 'error');
    }
  }

  // Expose ke window.App
  window.App.editNilai = openEditNilai;
  window.App.hapusNilai = hapusNilai;

  // ============================================
  // HALAMAN HASIL (PUBLIK / TV) — view-only
  // ============================================

  let hasilData = [];

  function initHasil() {
    populateHasilDropdowns();
    setupHasilFilters();
  }

  function populateHasilDropdowns() {
    const filterKategori = $('filter-hasil-kategori');
    const filterGolongan = $('filter-hasil-golongan');
    CONFIG.KATEGORI.forEach(k => filterKategori.add(new Option(k.nama, k.nama)));
    CONFIG.GOLONGAN.forEach(g => filterGolongan.add(new Option(g.nama, g.nama)));
  }

  function setupHasilFilters() {
    $('btn-refresh-hasil').addEventListener('click', loadHasil);
    $('filter-hasil-kategori').addEventListener('change', renderHasil);
    $('filter-hasil-golongan').addEventListener('change', renderHasil);
  }

  async function loadHasil() {
    const content = $('hasil-content');
    content.innerHTML = '<div class="loading-cell">Memuat data...</div>';
    try {
      const res = await apiGet('getRekap');
      if (res.success) {
        hasilData = res.data || [];
        renderHasil();
      } else {
        content.innerHTML = '<div class="hasil-empty">Gagal memuat data</div>';
      }
    } catch {
      content.innerHTML = '<div class="hasil-empty">Gagal menghubungi server</div>';
    }
  }

  function renderHasil() {
    const content = $('hasil-content');
    const katFilter = $('filter-hasil-kategori').value;
    const golFilter = $('filter-hasil-golongan').value;

    // Filter & hanya peserta yang sudah ada Nilai Akhir
    let data = hasilData.filter(d => d.rataRata > 0);
    if (katFilter) data = data.filter(d => d.kategori === katFilter);
    if (golFilter) data = data.filter(d => d.golongan === golFilter);

    if (!data.length) {
      content.innerHTML = '<div class="hasil-empty">Belum ada data hasil penilaian</div>';
      return;
    }

    // Group by Kategori + Golongan
    const groups = {};
    data.forEach(d => {
      const key = d.kategori + '||' + d.golongan;
      if (!groups[key]) groups[key] = { kategori: d.kategori, golongan: d.golongan, items: [] };
      groups[key].items.push(d);
    });

    // Hitung Juara Umum berdasarkan kontingen
    const juaraUmumHtml = renderJuaraUmum(groups);

    // Urutkan grup berdasarkan kategori, lalu golongan
    const sortedGroupKeys = Object.keys(groups).sort((a, b) => a.localeCompare(b));

    const html = sortedGroupKeys.map(key => {
      const g = groups[key];
      // Sort items berdasarkan nilai akhir desc
      const sorted = g.items.slice().sort((a, b) => b.rataRata - a.rataRata);

      const rows = sorted.map((d, idx) => {
        const peringkat = idx + 1;
        let rowClass = '';
        let peringkatHtml = `<span>${peringkat}</span>`;
        if (peringkat === 1) {
          rowClass = 'peringkat-emas';
          peringkatHtml = '<span class="badge-peringkat badge-emas">🥇 Emas</span>';
        } else if (peringkat === 2) {
          rowClass = 'peringkat-silver';
          peringkatHtml = '<span class="badge-peringkat badge-silver">🥈 Silver</span>';
        } else if (peringkat === 3) {
          rowClass = 'peringkat-perunggu';
          peringkatHtml = '<span class="badge-peringkat badge-perunggu">🥉 Perunggu</span>';
        }

        return `
          <tr class="${rowClass}">
            <td class="col-peringkat">${peringkatHtml}</td>
            <td>${d.nomorUrut}</td>
            <td>${d.namaPeserta}</td>
            <td>${d.kontingen}</td>
            <td class="col-nilai">${d.rataRata}</td>
            <td>${d.jumlahJuri}/5</td>
          </tr>
        `;
      }).join('');

      return `
        <div class="hasil-group">
          <div class="hasil-group-header">
            <span class="group-tag">Kategori:<b>${g.kategori}</b></span>
            <span class="group-tag">Golongan:<b>${g.golongan}</b></span>
            <span class="group-tag">Peserta:<b>${sorted.length}</b></span>
          </div>
          <table class="tabel-hasil">
            <thead>
              <tr>
                <th class="col-peringkat">Peringkat</th>
                <th>No. Urut</th>
                <th>Nama Peserta</th>
                <th>Kontingen</th>
                <th class="col-nilai">Nilai Akhir</th>
                <th>Juri</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    }).join('');

    content.innerHTML = juaraUmumHtml + html;
  }

  // Hitung & render Juara Umum berdasarkan medali kontingen
  function renderJuaraUmum(groups) {
    // Akumulasi medali per kontingen dari peringkat top 3 setiap grup
    const kontingenStats = {};
    Object.keys(groups).forEach(key => {
      const g = groups[key];
      const sorted = g.items.slice().sort((a, b) => b.rataRata - a.rataRata);
      sorted.forEach((item, idx) => {
        if (idx > 2) return; // hanya top 3 yang dapat medali
        const kontingen = item.kontingen;
        if (!kontingenStats[kontingen]) {
          kontingenStats[kontingen] = { kontingen, emas: 0, silver: 0, perunggu: 0, total: 0, poin: 0 };
        }
        const s = kontingenStats[kontingen];
        if (idx === 0) { s.emas++; s.poin += 3; }
        else if (idx === 1) { s.silver++; s.poin += 2; }
        else if (idx === 2) { s.perunggu++; s.poin += 1; }
        s.total = s.emas + s.silver + s.perunggu;
      });
    });

    const stats = Object.values(kontingenStats);
    if (!stats.length) return '';

    // Sort: emas desc → silver desc → perunggu desc → nama asc
    stats.sort((a, b) => {
      if (b.emas !== a.emas) return b.emas - a.emas;
      if (b.silver !== a.silver) return b.silver - a.silver;
      if (b.perunggu !== a.perunggu) return b.perunggu - a.perunggu;
      return a.kontingen.localeCompare(b.kontingen);
    });

    const rows = stats.map((s, idx) => {
      const pos = idx + 1;
      let rowClass = '';
      let posLabel = `<span class="ju-pos-num">${pos}</span>`;
      if (pos === 1) {
        rowClass = 'ju-emas';
        posLabel = '<span class="ju-crown">👑</span>';
      } else if (pos === 2) {
        rowClass = 'ju-silver';
      } else if (pos === 3) {
        rowClass = 'ju-perunggu';
      }
      return `
        <tr class="${rowClass}">
          <td class="ju-pos">${posLabel}</td>
          <td class="ju-kontingen">${s.kontingen}</td>
          <td class="ju-medal">${s.emas}</td>
          <td class="ju-medal">${s.silver}</td>
          <td class="ju-medal">${s.perunggu}</td>
          <td class="ju-total">${s.total}</td>
          <td class="ju-poin">${s.poin}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="juara-umum-section">
        <div class="juara-umum-header">
          <h3>👑 Juara Umum</h3>
          <p class="juara-umum-sub">Peringkat Kontingen berdasarkan perolehan medali</p>
        </div>
        <table class="tabel-juara-umum">
          <thead>
            <tr>
              <th class="ju-pos">Pos</th>
              <th>Kontingen</th>
              <th class="ju-medal">🥇 Emas</th>
              <th class="ju-medal">🥈 Silver</th>
              <th class="ju-medal">🥉 Perunggu</th>
              <th class="ju-total">Total</th>
              <th class="ju-poin">Poin</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="juara-umum-keterangan">Poin: Emas ×3 · Silver ×2 · Perunggu ×1 · Tiebreaker: Emas → Silver → Perunggu</div>
      </div>
    `;
  }

  // Inisialisasi modul hasil (publik)
  initHasil();

  // Inisialisasi modul penilaian
  initPenilaian();

  // Start
  init();
})();
