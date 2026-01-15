/**
 * Print Cost Tracker - Data Layer
 *
 * This module provides an abstraction over localStorage that mirrors
 * Firebase/Firestore patterns for easy future migration.
 *
 * Data Schema (Firebase-ready):
 *
 * settings (single document):
 *   - machineCost: number (initial printer investment)
 *   - currency: string (USD, EUR, etc.)
 *   - createdAt: ISO timestamp
 *   - updatedAt: ISO timestamp
 *
 * filaments (collection):
 *   - id: string (UUID)
 *   - name: string (e.g., "PLA Black", "PETG White")
 *   - material: string (PLA, PETG, ABS, TPU, etc.)
 *   - brand: string
 *   - costPerKg: number
 *   - color: string (hex code for UI)
 *   - createdAt: ISO timestamp
 *   - updatedAt: ISO timestamp
 *
 * prints (collection):
 *   - id: string (UUID)
 *   - name: string (print name/file name)
 *   - filamentId: string (reference to filament)
 *   - gramsUsed: number
 *   - printTimeMinutes: number (optional)
 *   - notes: string (optional)
 *   - createdAt: ISO timestamp
 *   - updatedAt: ISO timestamp
 *
 * comparisons (collection):
 *   - id: string (UUID)
 *   - printId: string (reference to print)
 *   - productName: string
 *   - productUrl: string (optional, Amazon link)
 *   - productPrice: number
 *   - quantity: number (how many prints equal one product)
 *   - notes: string (optional)
 *   - createdAt: ISO timestamp
 *   - updatedAt: ISO timestamp
 */

const DB_PREFIX = 'print-cost-tracker';
const STORAGE_VERSION = 1;

// Generate UUID (Firebase-compatible)
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Get current ISO timestamp
function timestamp() {
  return new Date().toISOString();
}

// Storage helpers
function getCollection(name) {
  const key = `${DB_PREFIX}:${name}`;
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

function setCollection(name, data) {
  const key = `${DB_PREFIX}:${name}`;
  localStorage.setItem(key, JSON.stringify(data));
}

function getDocument(name) {
  const key = `${DB_PREFIX}:${name}`;
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
}

function setDocument(name, data) {
  const key = `${DB_PREFIX}:${name}`;
  localStorage.setItem(key, JSON.stringify(data));
}

// ============================================
// Settings
// ============================================
const Settings = {
  get() {
    return getDocument('settings') || {
      machineCost: 700,
      currency: 'USD',
      createdAt: timestamp(),
      updatedAt: timestamp()
    };
  },

  update(updates) {
    const current = this.get();
    const updated = {
      ...current,
      ...updates,
      updatedAt: timestamp()
    };
    setDocument('settings', updated);
    return updated;
  }
};

// ============================================
// Filaments
// ============================================
const Filaments = {
  getAll() {
    return getCollection('filaments');
  },

  getById(id) {
    return this.getAll().find(f => f.id === id) || null;
  },

  add(data) {
    const filaments = this.getAll();
    const filament = {
      id: generateId(),
      name: data.name,
      material: data.material || 'PLA',
      brand: data.brand || '',
      costPerKg: Number(data.costPerKg) || 0,
      color: data.color || '#808080',
      createdAt: timestamp(),
      updatedAt: timestamp()
    };
    filaments.push(filament);
    setCollection('filaments', filaments);
    return filament;
  },

  update(id, updates) {
    const filaments = this.getAll();
    const index = filaments.findIndex(f => f.id === id);
    if (index === -1) return null;

    filaments[index] = {
      ...filaments[index],
      ...updates,
      id, // Prevent id from being changed
      updatedAt: timestamp()
    };
    setCollection('filaments', filaments);
    return filaments[index];
  },

  delete(id) {
    const filaments = this.getAll().filter(f => f.id !== id);
    setCollection('filaments', filaments);
  }
};

// ============================================
// Prints
// ============================================
const Prints = {
  getAll() {
    return getCollection('prints');
  },

  getById(id) {
    return this.getAll().find(p => p.id === id) || null;
  },

  add(data) {
    const prints = this.getAll();
    const print = {
      id: generateId(),
      name: data.name,
      filamentId: data.filamentId,
      gramsUsed: Number(data.gramsUsed) || 0,
      printTimeMinutes: Number(data.printTimeMinutes) || 0,
      notes: data.notes || '',
      createdAt: timestamp(),
      updatedAt: timestamp()
    };
    prints.push(print);
    setCollection('prints', prints);
    return print;
  },

  update(id, updates) {
    const prints = this.getAll();
    const index = prints.findIndex(p => p.id === id);
    if (index === -1) return null;

    prints[index] = {
      ...prints[index],
      ...updates,
      id,
      updatedAt: timestamp()
    };
    setCollection('prints', prints);
    return prints[index];
  },

  delete(id) {
    const prints = this.getAll().filter(p => p.id !== id);
    setCollection('prints', prints);
    // Also delete related comparisons
    const comparisons = Comparisons.getAll().filter(c => c.printId !== id);
    setCollection('comparisons', comparisons);
  }
};

// ============================================
// Comparisons (Amazon products)
// ============================================
const Comparisons = {
  getAll() {
    return getCollection('comparisons');
  },

  getById(id) {
    return this.getAll().find(c => c.id === id) || null;
  },

  getByPrintId(printId) {
    return this.getAll().filter(c => c.printId === printId);
  },

  add(data) {
    const comparisons = this.getAll();
    const comparison = {
      id: generateId(),
      printId: data.printId,
      productName: data.productName,
      productUrl: data.productUrl || '',
      productPrice: Number(data.productPrice) || 0,
      quantity: Number(data.quantity) || 1,
      notes: data.notes || '',
      createdAt: timestamp(),
      updatedAt: timestamp()
    };
    comparisons.push(comparison);
    setCollection('comparisons', comparisons);
    return comparison;
  },

  update(id, updates) {
    const comparisons = this.getAll();
    const index = comparisons.findIndex(c => c.id === id);
    if (index === -1) return null;

    comparisons[index] = {
      ...comparisons[index],
      ...updates,
      id,
      updatedAt: timestamp()
    };
    setCollection('comparisons', comparisons);
    return comparisons[index];
  },

  delete(id) {
    const comparisons = this.getAll().filter(c => c.id !== id);
    setCollection('comparisons', comparisons);
  }
};

// ============================================
// Calculations
// ============================================
const Calculations = {
  // Get cost of a single print
  getPrintCost(print) {
    const filament = Filaments.getById(print.filamentId);
    if (!filament) return 0;
    return (print.gramsUsed / 1000) * filament.costPerKg;
  },

  // Get total savings for a print (comparison price - print cost)
  getPrintSavings(print) {
    const printCost = this.getPrintCost(print);
    const comparisons = Comparisons.getByPrintId(print.id);

    if (comparisons.length === 0) return 0;

    // Sum up all comparison values
    let totalComparisonValue = 0;
    comparisons.forEach(comp => {
      // If quantity > 1, it means multiple prints = 1 product
      // So savings per print = productPrice / quantity
      totalComparisonValue += comp.productPrice / comp.quantity;
    });

    return totalComparisonValue - printCost;
  },

  // Get aggregate statistics
  getStats() {
    const prints = Prints.getAll();
    const settings = Settings.get();

    let totalPrintCost = 0;
    let totalSavings = 0;
    let totalGramsUsed = 0;
    let printsWithComparisons = 0;

    prints.forEach(print => {
      const printCost = this.getPrintCost(print);
      const savings = this.getPrintSavings(print);

      totalPrintCost += printCost;
      totalGramsUsed += print.gramsUsed;

      if (Comparisons.getByPrintId(print.id).length > 0) {
        totalSavings += savings;
        printsWithComparisons++;
      }
    });

    const netSavings = totalSavings - settings.machineCost;
    const breakEvenProgress = settings.machineCost > 0
      ? Math.min(100, (totalSavings / settings.machineCost) * 100)
      : 100;

    return {
      totalPrints: prints.length,
      printsWithComparisons,
      totalPrintCost,
      totalSavings,
      netSavings,
      totalGramsUsed,
      breakEvenProgress,
      hasReachedBreakEven: totalSavings >= settings.machineCost,
      machineCost: settings.machineCost
    };
  }
};

// ============================================
// Export/Import for Migration
// ============================================
const DataMigration = {
  exportAll() {
    return {
      version: STORAGE_VERSION,
      exportedAt: timestamp(),
      settings: Settings.get(),
      filaments: Filaments.getAll(),
      prints: Prints.getAll(),
      comparisons: Comparisons.getAll()
    };
  },

  importAll(data) {
    if (!data.version) {
      throw new Error('Invalid export file: missing version');
    }

    // Handle version migrations here if needed in the future
    if (data.version > STORAGE_VERSION) {
      throw new Error('Export file is from a newer version. Please update the app.');
    }

    // Import all data
    if (data.settings) {
      setDocument('settings', data.settings);
    }
    if (data.filaments) {
      setCollection('filaments', data.filaments);
    }
    if (data.prints) {
      setCollection('prints', data.prints);
    }
    if (data.comparisons) {
      setCollection('comparisons', data.comparisons);
    }

    return true;
  },

  clearAll() {
    localStorage.removeItem(`${DB_PREFIX}:settings`);
    localStorage.removeItem(`${DB_PREFIX}:filaments`);
    localStorage.removeItem(`${DB_PREFIX}:prints`);
    localStorage.removeItem(`${DB_PREFIX}:comparisons`);
  }
};

// Initialize with default filament if empty
function initializeDefaults() {
  if (Filaments.getAll().length === 0) {
    Filaments.add({
      name: 'Generic PLA',
      material: 'PLA',
      brand: 'Generic',
      costPerKg: 20,
      color: '#4CAF50'
    });
  }
}

// Export the API
window.PrintCostDB = {
  Settings,
  Filaments,
  Prints,
  Comparisons,
  Calculations,
  DataMigration,
  initializeDefaults
};
