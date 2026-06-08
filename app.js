// ============================================
// Pasanggiri Bojonegara — App Logic
// ============================================

(function() {
  'use strict';

  // === State ===
  let pesertaData = [];
  let currentFilter = '';

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
    });
    CONFIG.GOLONGAN.forEach(g => {
      golonganSel.add(new Option(g.nama, g.nama));
      $('edit-golongan').add(new Option(g.nama, g.nama));
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
  filterKontingen.addEventListener('change', () => {
    currentFilter = filterKontingen.value;
    renderDashboard();
  });

  function renderDashboard() {
    const filtered = currentFilter ? pesertaData.filter(d => d.kontingen === currentFilter) : pesertaData;
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
  const inputNomorUrut = $('input-nomor-urut');
  const btnCariPeserta = $('btn-cari-peserta');
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

  // === Inisialisasi Penilaian ===
  function initPenilaian() {
    setupPinModal();
    setupPenilaianTabs();
    setupCariPeserta();
    setupJuriSelect();
    setupKriteriaInputs();
    setupNilaiActions();
    setupRekapFilters();
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

  // === Cari Peserta ===
  function setupCariPeserta() {
    btnCariPeserta.addEventListener('click', cariPeserta);
    inputNomorUrut.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') cariPeserta();
    });
  }

  async function cariPeserta() {
    const nomorUrut = inputNomorUrut.value.trim();
    if (!nomorUrut) {
      $('err-nomor-urut').textContent = 'Masukkan nomor urut peserta.';
      return;
    }
    $('err-nomor-urut').textContent = '';

    try {
      const res = await apiGet('getAll');
      if (res.success) {
        const found = res.data.find(d => d.nomorUrut === nomorUrut);
        if (found) {
          currentPeserta = found;
          tampilkanDataPeserta(found);
          // Ambil data juri yang sudah menilai peserta ini
          await cekJuriSudahNilai(nomorUrut);
        } else {
          $('err-nomor-urut').textContent = 'Nomor urut tidak ditemukan.';
          resetFormPenilaian();
        }
      }
    } catch {
      $('err-nomor-urut').textContent = 'Gagal menghubungi server.';
    }
  }

  function tampilkanDataPeserta(data) {
    $('info-kategori').textContent = data.kategori;
    $('info-golongan').textContent = data.golongan;
    $('info-kontingen').textContent = data.kontingen;
    $('input-nama-peserta').value = data.namaPeserta;
    // Set waktu tampil
    const now = new Date();
    const waktu = now.toTimeString().split(' ')[0]; // HH:MM:SS
    $('info-waktu-tampil').textContent = waktu;
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

  // === Kriteria Inputs ===
  function setupKriteriaInputs() {
    kriteriaInputsDiv.innerHTML = CONFIG.KRITERIA_PENILAIAN.map((k, i) => `
      <div class="kriteria-card" id="kriteria-card-${i}">
        <div class="kriteria-name">${i + 1}. ${k.nama}</div>
        <input type="number" id="nilai-${i}" min="${k.min}" max="${k.max}" placeholder="${k.min}" aria-label="${k.nama}">
        <div class="kriteria-hint">(${k.min} – ${k.max})</div>
        <div class="kriteria-error" id="err-nilai-${i}"></div>
      </div>
    `).join('');

    // Event listener live untuk hitung total
    CONFIG.KRITERIA_PENILAIAN.forEach((k, i) => {
      const input = $(`nilai-${i}`);
      input.addEventListener('input', () => {
        validateNilaiInput(i);
        hitungTotalNilai();
      });
    });
  }

  function validateNilaiInput(index) {
    const k = CONFIG.KRITERIA_PENILAIAN[index];
    const input = $(`nilai-${index}`);
    const card = $(`kriteria-card-${index}`);
    const errEl = $(`err-nilai-${index}`);
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
    let allFilled = true;
    let hasInvalid = false;

    CONFIG.KRITERIA_PENILAIAN.forEach((k, i) => {
      const input = $(`nilai-${i}`);
      const val = parseFloat(input.value);
      if (input.value === '') {
        allFilled = false;
      } else if (isNaN(val) || val < k.min || val > k.max) {
        hasInvalid = true;
      } else {
        total += val;
      }
    });

    // Update tampilan total
    totalNilaiBox.classList.remove('total-mid', 'total-high');
    if (!allFilled || hasInvalid) {
      totalNilaiValue.textContent = allFilled && !hasInvalid ? total : '—';
      if (allFilled && !hasInvalid) {
        // Warna berdasarkan total
        if (total >= 185) totalNilaiBox.classList.add('total-high');
        else if (total >= 170) totalNilaiBox.classList.add('total-mid');
      }
    } else {
      totalNilaiValue.textContent = total;
      if (total >= 185) totalNilaiBox.classList.add('total-high');
      else if (total >= 170) totalNilaiBox.classList.add('total-mid');
    }
  }

  // === Aksi Simpan & Reset ===
  function setupNilaiActions() {
    btnSimpanNilai.addEventListener('click', simpanNilai);
    btnResetNilai.addEventListener('click', resetNilaiInputs);
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

    // Validasi semua nilai
    let allValid = true;
    const nilaiArr = [];
    CONFIG.KRITERIA_PENILAIAN.forEach((k, i) => {
      if (!validateNilaiInput(i)) allValid = false;
      const val = parseFloat($(`nilai-${i}`).value);
      if (isNaN(val)) allValid = false;
      nilaiArr.push(val);
    });

    if (!allValid) {
      showToast('Periksa kembali semua input nilai', 'error');
      return;
    }

    // Hitung total
    const totalNilai = nilaiArr.reduce((a, b) => a + b, 0);

    // Buat ID Penilaian: NLP-{NomorUrut}-{Juri}
    const juriKey = juri.replace(' ', '').toUpperCase(); // "Juri 1" → "JURI1"
    const idPenilaian = `NLP-${currentPeserta.nomorUrut}-${juriKey}`;

    // Waktu
    const waktu = $('info-waktu-tampil').textContent;
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
      orisinalitas: nilaiArr[0],
      stamina: nilaiArr[1],
      kekompakan: nilaiArr[2],
      kreatifitas: nilaiArr[3],
      teknikSerangBela: nilaiArr[4],
      penghayatan: nilaiArr[5],
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
    CONFIG.KRITERIA_PENILAIAN.forEach((k, i) => {
      $(`nilai-${i}`).value = '';
      $(`kriteria-card-${i}`).classList.remove('invalid');
      $(`nilai-${i}`).classList.remove('invalid');
      $(`err-nilai-${i}`).textContent = '';
    });
    selectJuri.value = '';
    $('err-juri').textContent = '';
    totalNilaiValue.textContent = '—';
    totalNilaiBox.classList.remove('total-mid', 'total-high');
  }

  function resetFormPenilaian() {
    currentPeserta = null;
    nilaiJuriSudah = [];
    dataPesertaFound.classList.add('hidden');
    sectionJuri.classList.add('hidden');
    sectionNilai.classList.add('hidden');
    resetNilaiInputs();
    $('juri-badges').innerHTML = '';
  }

  // === Rekap Nilai ===
  function populateRekapDropdowns() {
    const filterGolongan = $('filter-rekap-golongan');
    const filterKontingen = $('filter-rekap-kontingen');
    CONFIG.GOLONGAN.forEach(g => {
      filterGolongan.add(new Option(g.nama, g.nama));
    });
    CONFIG.KONTINGEN.forEach(k => {
      filterKontingen.add(new Option(k.nama, k.nama));
    });
  }

  function setupRekapFilters() {
    btnRefreshRekap.addEventListener('click', loadRekap);
    $('filter-rekap-golongan').addEventListener('change', renderRekap);
    $('filter-rekap-kontingen').addEventListener('change', renderRekap);
  }

  async function loadRekap() {
    const tbodyRekap = $('tbody-rekap');
    tbodyRekap.innerHTML = '<tr><td colspan="11" class="loading-cell">Memuat data...</td></tr>';

    try {
      const res = await apiGet('getRekap');
      if (res.success) {
        rekapData = res.data || [];
        renderRekap();
      } else {
        tbodyRekap.innerHTML = '<tr><td colspan="11" class="loading-cell">Gagal memuat data</td></tr>';
      }
    } catch {
      tbodyRekap.innerHTML = '<tr><td colspan="11" class="loading-cell">Gagal menghubungi server</td></tr>';
    }
  }

  function renderRekap() {
    const golFilter = $('filter-rekap-golongan').value;
    const kontFilter = $('filter-rekap-kontingen').value;
    const tbodyRekap = $('tbody-rekap');

    let filtered = [...rekapData];
    if (golFilter) filtered = filtered.filter(d => d.golongan === golFilter);
    if (kontFilter) filtered = filtered.filter(d => d.kontingen === kontFilter);

    if (!filtered.length) {
      tbodyRekap.innerHTML = '<tr><td colspan="11" class="loading-cell">Belum ada data penilaian</td></tr>';
      return;
    }

    // Cari rata-rata tertinggi per golongan
    const topByGolongan = {};
    filtered.forEach(d => {
      if (d.rataRata > 0) {
        if (!topByGolongan[d.golongan] || d.rataRata > topByGolongan[d.golongan]) {
          topByGolongan[d.golongan] = d.rataRata;
        }
      }
    });

    tbodyRekap.innerHTML = filtered.map(d => {
      const isTop = d.rataRata > 0 && d.rataRata === topByGolongan[d.golongan];
      return `
        <tr class="${isTop ? 'highlight-top' : ''}">
          <td>${d.nomorUrut}</td>
          <td>${d.namaPeserta}</td>
          <td>${d.kontingen}</td>
          <td>${d.golongan}</td>
          <td>${d.juri1 || '-'}</td>
          <td>${d.juri2 || '-'}</td>
          <td>${d.juri3 || '-'}</td>
          <td>${d.juri4 || '-'}</td>
          <td>${d.juri5 || '-'}</td>
          <td>${d.rataRata > 0 ? d.rataRata.toFixed(1) : '-'}${isTop ? '<span class="badge-tertinggi">🥇 Tertinggi</span>' : ''}</td>
          <td>${d.jumlahJuri}/5</td>
        </tr>
      `;
    }).join('');
  }

  // Inisialisasi modul penilaian
  initPenilaian();

  // Start
  init();
})();
