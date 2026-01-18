/**
 * Print Cost Tracker - Main Application
 */

// DOM Elements - populated on init
let elements = {};

// Data layer references - populated on init
let Settings, Filaments, Prints, Comparisons, Calculations, DataMigration, initializeDefaults;

// State
let confirmCallback = null;

// Utility Functions
function formatCurrency(amount) {
  return '$' + amount.toFixed(2);
}

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
    if (container.children.length === 0) {
      container.remove();
    }
  }, 3000);
}

// Tab Navigation
function initTabs() {
  elements.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.dataset.tab;

      elements.tabs.forEach(t => t.classList.remove('active'));
      elements.tabContents.forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      document.getElementById(tabId).classList.add('active');
    });
  });
}

// Menu
function initMenu() {
  elements.menuBtn.addEventListener('click', () => {
    elements.menuOverlay.classList.add('active');
    elements.sideMenu.classList.add('active');
  });

  const closeMenu = () => {
    elements.menuOverlay.classList.remove('active');
    elements.sideMenu.classList.remove('active');
  };

  elements.menuOverlay.addEventListener('click', closeMenu);
  elements.menuClose.addEventListener('click', closeMenu);
}

// Modals
function openModal(modalId) {
  elements.modalOverlay.classList.add('active');
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
  document.getElementById(modalId).classList.add('active');
}

function closeModal() {
  elements.modalOverlay.classList.remove('active');
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
}

function initModals() {
  elements.modalOverlay.addEventListener('click', (e) => {
    if (e.target === elements.modalOverlay) {
      closeModal();
    }
  });

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', closeModal);
  });
}

// Confirm Dialog
function showConfirm(title, message, callback) {
  elements.confirmTitle.textContent = title;
  elements.confirmMessage.textContent = message;
  confirmCallback = callback;
  openModal('confirmModal');
}

function initConfirm() {
  elements.confirmBtn.addEventListener('click', () => {
    if (confirmCallback) {
      confirmCallback();
      confirmCallback = null;
    }
    closeModal();
  });
}

// Dashboard
function updateDashboard() {
  const stats = Calculations.getStats();
  const settings = Settings.get();

  // Break-even progress ring
  const circumference = 2 * Math.PI * 52;
  const offset = circumference - (stats.breakEvenProgress / 100) * circumference;
  elements.progressRing.style.strokeDashoffset = offset;

  if (stats.hasReachedBreakEven) {
    elements.progressRing.classList.add('success');
    elements.breakEvenLabel.textContent = 'Break-even reached!';
  } else {
    elements.progressRing.classList.remove('success');
    elements.breakEvenLabel.textContent = 'of break-even';
  }

  elements.breakEvenPercent.textContent = Math.round(stats.breakEvenProgress) + '%';

  // Details
  elements.machineCostDisplay.textContent = formatCurrency(stats.machineCost);
  elements.totalSavingsDisplay.textContent = formatCurrency(stats.totalSavings);

  const netPosition = stats.netSavings;
  const netPositionEl = elements.netPositionDisplay;
  netPositionEl.textContent = (netPosition >= 0 ? '+' : '') + formatCurrency(netPosition);
  netPositionEl.closest('.detail').classList.toggle('positive', netPosition >= 0);

  // Stats
  elements.totalPrintsDisplay.textContent = stats.totalPrints;
  elements.totalFilamentDisplay.textContent = Math.round(stats.totalGramsUsed) + 'g';
  elements.printCostDisplay.textContent = formatCurrency(stats.totalPrintCost);

  const avgSavings = stats.printsWithComparisons > 0
    ? stats.totalSavings / stats.printsWithComparisons
    : 0;
  elements.avgSavingsDisplay.textContent = formatCurrency(avgSavings);

  // Recent prints
  renderRecentPrints();
}

function renderRecentPrints() {
  const prints = Prints.getAll().slice(-5).reverse();

  if (prints.length === 0) {
    elements.recentPrintsList.innerHTML = '<p class="empty-state">No prints yet. Add your first print!</p>';
    return;
  }

  elements.recentPrintsList.innerHTML = prints.map(print => {
    const filament = Filaments.getById(print.filamentId);
    const savings = Calculations.getPrintSavings(print);
    const hasSavings = Comparisons.getByPrintId(print.id).length > 0;

    return `
      <div class="recent-item">
        <div class="recent-item-info">
          <div class="recent-item-name">${escapeHtml(print.name)}</div>
          <div class="recent-item-meta">${print.gramsUsed}g ${filament ? filament.material : ''}</div>
        </div>
        <span class="recent-item-savings ${hasSavings ? 'positive' : 'neutral'}">
          ${hasSavings ? '+' + formatCurrency(savings) : 'No comparison'}
        </span>
      </div>
    `;
  }).join('');
}

// Prints
function renderPrints() {
  const prints = Prints.getAll().reverse();

  if (prints.length === 0) {
    elements.printsList.innerHTML = '<p class="empty-state">No prints recorded yet.</p>';
    return;
  }

  elements.printsList.innerHTML = prints.map(print => {
    const filament = Filaments.getById(print.filamentId);
    const printCost = Calculations.getPrintCost(print);
    const comparisons = Comparisons.getByPrintId(print.id);
    const savings = Calculations.getPrintSavings(print);

    let comparisonsHtml = '';
    if (comparisons.length > 0) {
      comparisonsHtml = `
        <div class="print-comparisons">
          <div class="print-comparisons-header">
            <h4>Amazon Comparisons</h4>
            <button class="btn btn-sm btn-secondary" onclick="openComparisonModal('${print.id}')">+ Add</button>
          </div>
          ${comparisons.map(comp => `
            <div class="comparison-item">
              <div class="comparison-info">
                <div class="comparison-name">${escapeHtml(comp.productName)}</div>
                <div class="comparison-meta">${formatCurrency(comp.productPrice)}${comp.quantity > 1 ? ` (${comp.quantity} prints)` : ''}</div>
              </div>
              <div class="comparison-actions">
                ${comp.productUrl ? `<a href="${escapeHtml(comp.productUrl)}" target="_blank" class="btn-icon" title="View on Amazon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                  </svg>
                </a>` : ''}
                <button class="btn-icon" onclick="editComparison('${comp.id}')" title="Edit">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
                <button class="btn-icon danger" onclick="deleteComparison('${comp.id}')" title="Delete">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            </div>
          `).join('')}
          <div class="print-savings-total">
            <span class="print-savings-label">Total Savings</span>
            <span class="print-savings-value">+${formatCurrency(savings)}</span>
          </div>
        </div>
      `;
    } else {
      comparisonsHtml = `
        <div class="print-comparisons">
          <button class="btn btn-sm btn-secondary" onclick="openComparisonModal('${print.id}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add Amazon Comparison
          </button>
        </div>
      `;
    }

    return `
      <div class="print-card">
        <div class="print-card-header">
          <div>
            <div class="print-card-title">${escapeHtml(print.name)}</div>
            <div class="print-card-date">${formatDate(print.createdAt)}</div>
          </div>
          <div class="print-card-actions">
            <button class="btn-icon" onclick="editPrint('${print.id}')" title="Edit">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="btn-icon danger" onclick="deletePrint('${print.id}')" title="Delete">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
        <div class="print-card-details">
          <div class="print-detail">
            <span class="print-detail-label">Filament</span>
            <span class="print-detail-value">
              ${filament ? `<span class="filament-color" style="background: ${filament.color}"></span>${escapeHtml(filament.name)}` : 'Unknown'}
            </span>
          </div>
          <div class="print-detail">
            <span class="print-detail-label">Used</span>
            <span class="print-detail-value">${print.gramsUsed}g</span>
          </div>
          <div class="print-detail">
            <span class="print-detail-label">Cost</span>
            <span class="print-detail-value">${formatCurrency(printCost)}</span>
          </div>
          ${print.printTimeMinutes ? `
            <div class="print-detail">
              <span class="print-detail-label">Time</span>
              <span class="print-detail-value">${Math.floor(print.printTimeMinutes / 60)}h ${print.printTimeMinutes % 60}m</span>
            </div>
          ` : ''}
        </div>
        ${comparisonsHtml}
      </div>
    `;
  }).join('');
}

function populateFilamentSelect() {
  const filaments = Filaments.getAll();
  elements.printFilament.innerHTML = '<option value="">Select filament...</option>' +
    filaments.map(f => `<option value="${f.id}">${escapeHtml(f.name)} (${f.material})</option>`).join('');
}

function openPrintModal(printId = null) {
  populateFilamentSelect();

  if (printId) {
    const print = Prints.getById(printId);
    if (print) {
      elements.printModalTitle.textContent = 'Edit Print';
      elements.printId.value = print.id;
      elements.printName.value = print.name;
      elements.printFilament.value = print.filamentId;
      elements.printGrams.value = print.gramsUsed;
      elements.printTime.value = print.printTimeMinutes || '';
      elements.printNotes.value = print.notes || '';
    }
  } else {
    elements.printModalTitle.textContent = 'Add Print';
    elements.printForm.reset();
    elements.printId.value = '';
  }

  openModal('printModal');
}

window.editPrint = function(id) {
  openPrintModal(id);
};

window.deletePrint = function(id) {
  const print = Prints.getById(id);
  if (!print) return;

  showConfirm('Delete Print', `Are you sure you want to delete "${print.name}"? This will also delete all comparisons for this print.`, () => {
    Prints.delete(id);
    renderPrints();
    updateDashboard();
    showToast('Print deleted', 'success');
  });
};

// Filaments
function renderFilaments() {
  const filaments = Filaments.getAll();

  if (filaments.length === 0) {
    elements.filamentsList.innerHTML = '<p class="empty-state">No filaments added yet.</p>';
    return;
  }

  elements.filamentsList.innerHTML = filaments.map(filament => `
    <div class="filament-card">
      <div class="filament-card-header">
        <div>
          <div class="filament-card-title">
            <span class="filament-color" style="background: ${filament.color}"></span>
            ${escapeHtml(filament.name)}
          </div>
          <div class="filament-card-meta">${filament.brand ? escapeHtml(filament.brand) + ' • ' : ''}${filament.material}</div>
        </div>
        <div class="filament-card-actions">
          <button class="btn-icon" onclick="editFilament('${filament.id}')" title="Edit">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="btn-icon danger" onclick="deleteFilament('${filament.id}')" title="Delete">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
      <div class="filament-card-cost">Cost: <strong>${formatCurrency(filament.costPerKg)}/kg</strong> (${formatCurrency(filament.costPerKg / 1000)}/g)</div>
    </div>
  `).join('');
}

function openFilamentModal(filamentId = null) {
  if (filamentId) {
    const filament = Filaments.getById(filamentId);
    if (filament) {
      elements.filamentModalTitle.textContent = 'Edit Filament';
      elements.filamentId.value = filament.id;
      elements.filamentName.value = filament.name;
      elements.filamentMaterial.value = filament.material;
      elements.filamentColor.value = filament.color;
      elements.filamentBrand.value = filament.brand || '';
      elements.filamentCost.value = filament.costPerKg;
    }
  } else {
    elements.filamentModalTitle.textContent = 'Add Filament';
    elements.filamentForm.reset();
    elements.filamentId.value = '';
    elements.filamentColor.value = '#4CAF50';
  }

  openModal('filamentModal');
}

window.editFilament = function(id) {
  openFilamentModal(id);
};

window.deleteFilament = function(id) {
  const filament = Filaments.getById(id);
  if (!filament) return;

  // Check if filament is used by any prints
  const prints = Prints.getAll().filter(p => p.filamentId === id);
  if (prints.length > 0) {
    showToast(`Cannot delete: ${prints.length} print(s) use this filament`, 'error');
    return;
  }

  showConfirm('Delete Filament', `Are you sure you want to delete "${filament.name}"?`, () => {
    Filaments.delete(id);
    renderFilaments();
    showToast('Filament deleted', 'success');
  });
};

// Comparisons
window.openComparisonModal = function(printId, comparisonId = null) {
  if (comparisonId) {
    const comparison = Comparisons.getById(comparisonId);
    if (comparison) {
      elements.comparisonModalTitle.textContent = 'Edit Comparison';
      elements.comparisonId.value = comparison.id;
      elements.comparisonPrintId.value = comparison.printId;
      elements.comparisonProduct.value = comparison.productName;
      elements.comparisonPrice.value = comparison.productPrice;
      elements.comparisonQuantity.value = comparison.quantity || 1;
      elements.comparisonUrl.value = comparison.productUrl || '';
      elements.comparisonNotes.value = comparison.notes || '';
    }
  } else {
    elements.comparisonModalTitle.textContent = 'Add Amazon Comparison';
    elements.comparisonForm.reset();
    elements.comparisonId.value = '';
    elements.comparisonPrintId.value = printId;
    elements.comparisonQuantity.value = 1;
  }

  openModal('comparisonModal');
};

window.editComparison = function(id) {
  const comparison = Comparisons.getById(id);
  if (comparison) {
    openComparisonModal(comparison.printId, id);
  }
};

window.deleteComparison = function(id) {
  showConfirm('Delete Comparison', 'Are you sure you want to delete this comparison?', () => {
    Comparisons.delete(id);
    renderPrints();
    updateDashboard();
    showToast('Comparison deleted', 'success');
  });
};

// Settings
function loadSettings() {
  const settings = Settings.get();
  elements.machineCostInput.value = settings.machineCost;
}

// Data Export/Import
function exportData() {
  const data = DataMigration.exportAll();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `print-cost-tracker-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('Data exported successfully', 'success');
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      DataMigration.importAll(data);
      refreshAll();
      showToast('Data imported successfully', 'success');
    } catch (error) {
      showToast('Failed to import: ' + error.message, 'error');
    }
  };
  reader.readAsText(file);
}

// Helper
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function refreshAll() {
  updateDashboard();
  renderPrints();
  renderFilaments();
  loadSettings();
}

// Event Listeners
function initEventListeners() {
  // Add buttons
  elements.addPrintBtn.addEventListener('click', () => openPrintModal());
  elements.addFilamentBtn.addEventListener('click', () => openFilamentModal());

  // Print form
  elements.printForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const data = {
      name: elements.printName.value,
      filamentId: elements.printFilament.value,
      gramsUsed: elements.printGrams.value,
      printTimeMinutes: elements.printTime.value,
      notes: elements.printNotes.value
    };

    if (elements.printId.value) {
      Prints.update(elements.printId.value, data);
      showToast('Print updated', 'success');
    } else {
      Prints.add(data);
      showToast('Print added', 'success');
    }

    closeModal();
    renderPrints();
    updateDashboard();
  });

  // Filament form
  elements.filamentForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const data = {
      name: elements.filamentName.value,
      material: elements.filamentMaterial.value,
      color: elements.filamentColor.value,
      brand: elements.filamentBrand.value,
      costPerKg: elements.filamentCost.value
    };

    if (elements.filamentId.value) {
      Filaments.update(elements.filamentId.value, data);
      showToast('Filament updated', 'success');
    } else {
      Filaments.add(data);
      showToast('Filament added', 'success');
    }

    closeModal();
    renderFilaments();
    renderPrints();
    updateDashboard();
  });

  // Comparison form
  elements.comparisonForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const data = {
      printId: elements.comparisonPrintId.value,
      productName: elements.comparisonProduct.value,
      productPrice: elements.comparisonPrice.value,
      quantity: elements.comparisonQuantity.value,
      productUrl: elements.comparisonUrl.value,
      notes: elements.comparisonNotes.value
    };

    if (elements.comparisonId.value) {
      Comparisons.update(elements.comparisonId.value, data);
      showToast('Comparison updated', 'success');
    } else {
      Comparisons.add(data);
      showToast('Comparison added', 'success');
    }

    closeModal();
    renderPrints();
    updateDashboard();
  });

  // Settings form
  elements.settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    Settings.update({
      machineCost: Number(elements.machineCostInput.value) || 0
    });
    updateDashboard();
    showToast('Settings saved', 'success');
  });

  // Export/Import
  elements.exportDataBtn.addEventListener('click', exportData);
  elements.importDataBtn.addEventListener('click', () => elements.importFileInput.click());
  elements.importFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      importData(e.target.files[0]);
      e.target.value = '';
    }
  });

  // Clear data
  elements.clearDataBtn.addEventListener('click', () => {
    showConfirm('Clear All Data', 'This will permanently delete all your prints, filaments, and settings. This cannot be undone. Are you sure?', () => {
      DataMigration.clearAll();
      initializeDefaults();
      refreshAll();
      showToast('All data cleared', 'success');
    });
  });
}

// Initialize DOM elements
function initElements() {
  elements = {
    // Tabs
    tabs: document.querySelectorAll('.tab'),
    tabContents: document.querySelectorAll('.tab-content'),

    // Dashboard
    breakEvenPercent: document.getElementById('breakEvenPercent'),
    breakEvenLabel: document.getElementById('breakEvenLabel'),
    progressRing: document.getElementById('progressRing'),
    machineCostDisplay: document.getElementById('machineCostDisplay'),
    totalSavingsDisplay: document.getElementById('totalSavingsDisplay'),
    netPositionDisplay: document.getElementById('netPositionDisplay'),
    totalPrintsDisplay: document.getElementById('totalPrintsDisplay'),
    totalFilamentDisplay: document.getElementById('totalFilamentDisplay'),
    printCostDisplay: document.getElementById('printCostDisplay'),
    avgSavingsDisplay: document.getElementById('avgSavingsDisplay'),
    recentPrintsList: document.getElementById('recentPrintsList'),

    // Lists
    printsList: document.getElementById('printsList'),
    filamentsList: document.getElementById('filamentsList'),

    // Buttons
    addPrintBtn: document.getElementById('addPrintBtn'),
    addFilamentBtn: document.getElementById('addFilamentBtn'),
    exportDataBtn: document.getElementById('exportDataBtn'),
    importDataBtn: document.getElementById('importDataBtn'),
    importFileInput: document.getElementById('importFileInput'),
    clearDataBtn: document.getElementById('clearDataBtn'),

    // Settings
    settingsForm: document.getElementById('settingsForm'),
    machineCostInput: document.getElementById('machineCostInput'),

    // Menu
    menuBtn: document.getElementById('menuBtn'),
    menuOverlay: document.getElementById('menuOverlay'),
    sideMenu: document.getElementById('sideMenu'),
    menuClose: document.getElementById('menuClose'),

    // Modals
    modalOverlay: document.getElementById('modalOverlay'),
    printModal: document.getElementById('printModal'),
    filamentModal: document.getElementById('filamentModal'),
    comparisonModal: document.getElementById('comparisonModal'),
    confirmModal: document.getElementById('confirmModal'),

    // Print Form
    printForm: document.getElementById('printForm'),
    printId: document.getElementById('printId'),
    printName: document.getElementById('printName'),
    printFilament: document.getElementById('printFilament'),
    printGrams: document.getElementById('printGrams'),
    printTime: document.getElementById('printTime'),
    printNotes: document.getElementById('printNotes'),
    printModalTitle: document.getElementById('printModalTitle'),

    // Filament Form
    filamentForm: document.getElementById('filamentForm'),
    filamentId: document.getElementById('filamentId'),
    filamentName: document.getElementById('filamentName'),
    filamentMaterial: document.getElementById('filamentMaterial'),
    filamentColor: document.getElementById('filamentColor'),
    filamentBrand: document.getElementById('filamentBrand'),
    filamentCost: document.getElementById('filamentCost'),
    filamentModalTitle: document.getElementById('filamentModalTitle'),

    // Comparison Form
    comparisonForm: document.getElementById('comparisonForm'),
    comparisonId: document.getElementById('comparisonId'),
    comparisonPrintId: document.getElementById('comparisonPrintId'),
    comparisonProduct: document.getElementById('comparisonProduct'),
    comparisonPrice: document.getElementById('comparisonPrice'),
    comparisonQuantity: document.getElementById('comparisonQuantity'),
    comparisonUrl: document.getElementById('comparisonUrl'),
    comparisonNotes: document.getElementById('comparisonNotes'),
    comparisonModalTitle: document.getElementById('comparisonModalTitle'),

    // Confirm Modal
    confirmTitle: document.getElementById('confirmTitle'),
    confirmMessage: document.getElementById('confirmMessage'),
    confirmBtn: document.getElementById('confirmBtn')
  };
}

// Initialize data layer references
function initDataLayer() {
  try {
    const db = window.PrintCostDB;
    if (!db) {
      console.error('PrintCostDB not found. Make sure data.js is loaded first.');
      console.error('window.PrintCostDB is:', typeof window.PrintCostDB);
      return false;
    }
    Settings = db.Settings;
    Filaments = db.Filaments;
    Prints = db.Prints;
    Comparisons = db.Comparisons;
    Calculations = db.Calculations;
    DataMigration = db.DataMigration;
    initializeDefaults = db.initializeDefaults;

    // Verify all components exist
    if (!Settings || !Filaments || !Prints || !Comparisons || !Calculations) {
      console.error('PrintCostDB is missing required components');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error initializing data layer:', error);
    return false;
  }
}

// Initialize
function init() {
  try {
    console.log('Print Cost Tracker: Starting initialization...');

    // Initialize data layer
    if (!initDataLayer()) {
      console.error('Print Cost Tracker: Failed to initialize data layer');
      alert('Failed to initialize data layer. Check console for errors.');
      return;
    }
    console.log('Print Cost Tracker: Data layer initialized');

    // Initialize DOM elements
    initElements();
    console.log('Print Cost Tracker: DOM elements initialized');

    // Initialize defaults
    initializeDefaults();
    console.log('Print Cost Tracker: Defaults initialized');

    // Initialize UI components
    initTabs();
    console.log('Print Cost Tracker: Tabs initialized');

    initMenu();
    console.log('Print Cost Tracker: Menu initialized');

    initModals();
    console.log('Print Cost Tracker: Modals initialized');

    initConfirm();
    console.log('Print Cost Tracker: Confirm initialized');

    initEventListeners();
    console.log('Print Cost Tracker: Event listeners initialized');

    // Render initial state
    refreshAll();
    console.log('Print Cost Tracker: Initial render complete');

  } catch (error) {
    console.error('Print Cost Tracker: Initialization error:', error);
    alert('Initialization error: ' + error.message);
  }
}

// Run init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  // DOM is already ready
  init();
}
