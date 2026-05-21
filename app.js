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

    if (!$('pelatih').value.trim()) { showError('err-pelatih', 'Nama pelatih wajib diisi'); valid = false; }

    const wa = $('nomorwa').value.trim();
    if (!wa) {
      showError('err-nomorwa', 'Nomor WA wajib diisi'); valid = false;
    } else if (!/^(08|628)\d{8,13}$/.test(wa)) {
      showError('err-nomorwa', 'Format: 08xx atau 628xx, 10-15 digit'); valid = false;
    }

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
      namaPeserta: names.join(', '),
      namaPelatih: $('pelatih').value.trim(),
      nomorWA: $('nomorwa').value.trim()
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
    tbody.innerHTML = '<tr><td colspan="7" class="loading-cell">Memuat data...</td></tr>';
    summaryCards.innerHTML = '<div class="skeleton-card"></div><div class="skeleton-card"></div>';

    try {
      const res = await apiGet('getAll');
      if (res.success) {
        pesertaData = res.data;
        renderDashboard();
      } else {
        tbody.innerHTML = '<tr><td colspan="7" class="loading-cell">Gagal memuat data</td></tr>';
      }
    } catch {
      tbody.innerHTML = '<tr><td colspan="7" class="loading-cell">Gagal menghubungi server</td></tr>';
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
      tbody.innerHTML = '<tr><td colspan="7" class="loading-cell">Belum ada data</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(d => `
      <tr>
        <td>${d.nomorUrut}</td>
        <td>${d.kategori}</td>
        <td>${d.golongan}</td>
        <td>${d.namaPeserta}</td>
        <td>${d.namaPelatih}</td>
        <td>${d.nomorWA}</td>
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
    $('edit-pelatih').value = item.namaPelatih;
    $('edit-nomorwa').value = item.nomorWA;
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
      namaPeserta: $('edit-peserta').value.trim(),
      namaPelatih: $('edit-pelatih').value.trim(),
      nomorWA: $('edit-nomorwa').value.trim()
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

  // Start
  init();
})();
