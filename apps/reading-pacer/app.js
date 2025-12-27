// ============================================
// Pure Timer Logic (testable without DOM)
// ============================================

function createTimer() {
  return {
    startTime: null,
    elapsed: 0,
    pausedAt: null,
    pages: 0,
    pageTimes: [],
    isRunning: false
  };
}

function startTimer(timer) {
  return {
    ...timer,
    startTime: Date.now(),
    isRunning: true
  };
}

function pauseTimer(timer) {
  if (!timer.isRunning) return timer;
  return {
    ...timer,
    elapsed: timer.elapsed + (Date.now() - timer.startTime),
    pausedAt: Date.now(),
    isRunning: false
  };
}

function resumeTimer(timer) {
  if (timer.isRunning) return timer;
  return {
    ...timer,
    startTime: Date.now(),
    isRunning: true
  };
}

function addPage(timer) {
  const now = Date.now();
  const currentElapsed = timer.isRunning
    ? timer.elapsed + (now - timer.startTime)
    : timer.elapsed;

  return {
    ...timer,
    pages: timer.pages + 1,
    pageTimes: [...timer.pageTimes, currentElapsed]
  };
}

function getElapsed(timer) {
  if (!timer.startTime) return 0;
  if (!timer.isRunning) return timer.elapsed;
  return timer.elapsed + (Date.now() - timer.startTime);
}

function getAveragePace(timer) {
  if (timer.pages === 0) return null;
  return getElapsed(timer) / timer.pages;
}

function getLastPace(timer) {
  if (timer.pageTimes.length === 0) return null;
  if (timer.pageTimes.length === 1) return timer.pageTimes[0];
  const times = timer.pageTimes;
  return times[times.length - 1] - times[times.length - 2];
}

// ============================================
// Formatting Utilities
// ============================================

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map(n => n.toString().padStart(2, '0'))
    .join(':');
}

function formatPace(ms) {
  if (ms === null) return '--:--';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatEstimate(ms) {
  return formatTime(ms);
}

// ============================================
// Storage
// ============================================

const STORAGE_KEY = 'readpace_sessions';

function getSavedSessions() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveSession(session) {
  const sessions = getSavedSessions();
  sessions.unshift({
    id: Date.now(),
    date: new Date().toISOString(),
    pages: session.pages,
    elapsed: session.elapsed,
    avgPace: session.avgPace
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function deleteSession(id) {
  const sessions = getSavedSessions().filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function exportSessions(currentTimer) {
  const sessions = getSavedSessions();
  const currentElapsed = getElapsed(currentTimer);

  if (currentTimer.pages > 0) {
    sessions.unshift({
      id: 'current',
      date: new Date().toISOString(),
      pages: currentTimer.pages,
      elapsed: currentElapsed,
      avgPace: currentElapsed / currentTimer.pages
    });
  }

  const blob = new Blob([JSON.stringify(sessions, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `readpace-export-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================
// App Controller
// ============================================

class ReadPaceApp {
  constructor() {
    this.timer = createTimer();
    this.wakeLock = null;
    this.updateInterval = null;

    this.bindElements();
    this.bindEvents();
    this.renderSessions();
  }

  bindElements() {
    this.timerEl = document.getElementById('timer');
    this.pageCountEl = document.getElementById('pageCount');
    this.avgPaceEl = document.getElementById('avgPace');
    this.lastPaceEl = document.getElementById('lastPace');
    this.estimateResultEl = document.getElementById('estimateResult');
    this.pagesInputEl = document.getElementById('pagesInput');

    this.tapAreaEl = document.getElementById('tapArea');
    this.pauseBtnEl = document.getElementById('pauseBtn');
    this.wakeBtnEl = document.getElementById('wakeBtn');
    this.resetBtnEl = document.getElementById('resetBtn');

    this.menuBtnEl = document.getElementById('menuBtn');
    this.menuCloseEl = document.getElementById('menuClose');
    this.menuOverlayEl = document.getElementById('menuOverlay');
    this.sideMenuEl = document.getElementById('sideMenu');
    this.saveSessionEl = document.getElementById('saveSession');
    this.exportDataEl = document.getElementById('exportData');
    this.sessionsListEl = document.getElementById('sessionsList');
  }

  bindEvents() {
    // Tap area
    this.tapAreaEl.addEventListener('click', () => this.handleTap());

    // Controls
    this.pauseBtnEl.addEventListener('click', () => this.togglePause());
    this.wakeBtnEl.addEventListener('click', () => this.toggleWakeLock());
    this.resetBtnEl.addEventListener('click', () => this.handleReset());

    // Menu
    this.menuBtnEl.addEventListener('click', () => this.openMenu());
    this.menuCloseEl.addEventListener('click', () => this.closeMenu());
    this.menuOverlayEl.addEventListener('click', () => this.closeMenu());

    // Menu actions
    this.saveSessionEl.addEventListener('click', () => this.handleSaveSession());
    this.exportDataEl.addEventListener('click', () => this.handleExport());

    // Estimate input
    this.pagesInputEl.addEventListener('input', () => this.updateEstimate());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));

    // Prevent double-tap zoom
    this.tapAreaEl.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.handleTap();
    });
  }

  handleTap() {
    // Start timer on first tap
    if (!this.timer.startTime && !this.timer.isRunning) {
      this.timer = startTimer(this.timer);
      this.startUpdating();
      this.updatePauseButton();
    }

    // Only count pages when running
    if (this.timer.isRunning) {
      this.timer = addPage(this.timer);
      this.render();
      this.hapticFeedback();
    }
  }

  togglePause() {
    if (this.timer.isRunning) {
      this.timer = pauseTimer(this.timer);
      this.stopUpdating();
    } else if (this.timer.startTime || this.timer.elapsed > 0) {
      this.timer = resumeTimer(this.timer);
      this.startUpdating();
    } else {
      // First press starts timer
      this.timer = startTimer(this.timer);
      this.startUpdating();
    }
    this.updatePauseButton();
    this.render();
  }

  updatePauseButton() {
    const playIcon = this.pauseBtnEl.querySelector('.icon-play');
    const pauseIcon = this.pauseBtnEl.querySelector('.icon-pause');

    if (this.timer.isRunning) {
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
      this.pauseBtnEl.classList.add('active');
    } else {
      playIcon.style.display = 'block';
      pauseIcon.style.display = 'none';
      this.pauseBtnEl.classList.remove('active');
    }
  }

  async toggleWakeLock() {
    if (this.wakeLock) {
      await this.wakeLock.release();
      this.wakeLock = null;
      this.wakeBtnEl.classList.remove('active');
    } else {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeBtnEl.classList.add('active');

        this.wakeLock.addEventListener('release', () => {
          this.wakeLock = null;
          this.wakeBtnEl.classList.remove('active');
        });
      } catch (err) {
        console.log('Wake Lock not supported or failed:', err);
      }
    }
  }

  handleReset() {
    if (this.timer.pages > 0) {
      if (!confirm('Reset current session? Unsaved data will be lost.')) {
        return;
      }
    }

    this.timer = createTimer();
    this.stopUpdating();
    this.updatePauseButton();
    this.render();
  }

  startUpdating() {
    if (this.updateInterval) return;
    this.updateInterval = setInterval(() => this.render(), 100);
  }

  stopUpdating() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  render() {
    const elapsed = getElapsed(this.timer);
    const avgPace = getAveragePace(this.timer);
    const lastPace = getLastPace(this.timer);

    this.timerEl.textContent = formatTime(elapsed);
    this.pageCountEl.textContent = this.timer.pages;
    this.avgPaceEl.textContent = formatPace(avgPace);
    this.lastPaceEl.textContent = formatPace(lastPace);

    this.updateEstimate();
  }

  updateEstimate() {
    const pages = parseInt(this.pagesInputEl.value) || 0;
    const avgPace = getAveragePace(this.timer);

    if (pages > 0 && avgPace !== null) {
      const estimate = pages * avgPace;
      this.estimateResultEl.textContent = formatEstimate(estimate);
    } else {
      this.estimateResultEl.textContent = '--:--:--';
    }
  }

  hapticFeedback() {
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  }

  handleKeyboard(e) {
    if (e.target.tagName === 'INPUT') return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        this.handleTap();
        break;
      case 'KeyP':
        this.togglePause();
        break;
      case 'KeyR':
        if (e.ctrlKey || e.metaKey) return;
        this.handleReset();
        break;
    }
  }

  // Menu
  openMenu() {
    this.sideMenuEl.classList.add('open');
    this.menuOverlayEl.classList.add('open');
  }

  closeMenu() {
    this.sideMenuEl.classList.remove('open');
    this.menuOverlayEl.classList.remove('open');
  }

  handleSaveSession() {
    if (this.timer.pages === 0) {
      alert('No pages recorded yet.');
      return;
    }

    const elapsed = getElapsed(this.timer);
    saveSession({
      pages: this.timer.pages,
      elapsed: elapsed,
      avgPace: elapsed / this.timer.pages
    });

    this.renderSessions();
    alert('Session saved!');
  }

  handleExport() {
    exportSessions(this.timer);
    this.closeMenu();
  }

  renderSessions() {
    const sessions = getSavedSessions();

    if (sessions.length === 0) {
      this.sessionsListEl.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.875rem;">No saved sessions</p>';
      return;
    }

    this.sessionsListEl.innerHTML = sessions.map(session => `
      <div class="session-item" data-id="${session.id}">
        <div class="session-info">
          <div>${session.pages} pages in ${formatTime(session.elapsed)}</div>
          <div class="session-date">${new Date(session.date).toLocaleDateString()}</div>
        </div>
        <button class="session-delete" aria-label="Delete session">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `).join('');

    // Bind delete handlers
    this.sessionsListEl.querySelectorAll('.session-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.closest('.session-item').dataset.id);
        if (confirm('Delete this session?')) {
          deleteSession(id);
          this.renderSessions();
        }
      });
    });
  }
}

// ============================================
// Initialize
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  new ReadPaceApp();
});

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    // Service worker registration failed, app still works
  });
}
