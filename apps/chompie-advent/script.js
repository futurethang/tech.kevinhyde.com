/**
 * Chompie's December Calendar - Main Script
 *
 * Features:
 * - Calendar grid generation
 * - Date-based door locking (production mode)
 * - Test mode to unlock all days
 * - Modal for daily reveal
 * - Treat reveal interaction
 * - Local storage for tracking opened days
 */

(function () {
  'use strict';

  // DOM Elements
  const calendarGrid = document.getElementById('calendarGrid');
  const testModeToggle = document.getElementById('testMode');
  const modalOverlay = document.getElementById('modalOverlay');
  const modal = document.getElementById('modal');
  const modalClose = document.getElementById('modalClose');
  const modalDay = document.getElementById('modalDay');
  const chompieIllustration = document.getElementById('chompieIllustration');
  const modalPoem = document.getElementById('modalPoem');
  const revealTreatBtn = document.getElementById('revealTreatBtn');
  const treatContent = document.getElementById('treatContent');
  const treatIcon = document.getElementById('treatIcon');
  const treatTitle = document.getElementById('treatTitle');
  const treatDescription = document.getElementById('treatDescription');
  const sponsorBadge = document.getElementById('sponsorBadge');

  // State
  let isTestMode = false;
  let openedDays = new Set();
  let currentDayData = null;

  // Storage key
  const STORAGE_KEY = 'chompie_opened_days';
  const TEST_MODE_KEY = 'chompie_test_mode';

  /**
   * Get today's date info based on config timezone
   */
  function getTodayInfo() {
    const now = new Date();
    const month = now.getMonth(); // 0-indexed, December = 11
    const day = now.getDate();
    const year = now.getFullYear();

    return {
      month,
      day,
      year,
      isDecember: month === 11,
    };
  }

  /**
   * Check if a specific day should be accessible
   */
  function isDayAccessible(dayNumber) {
    if (isTestMode) return true;

    const today = getTodayInfo();

    // Not December? No days accessible in production
    if (!today.isDecember) {
      // For demo purposes, allow access in test mode only
      return false;
    }

    // Day must be <= today's date
    return dayNumber <= today.day;
  }

  /**
   * Check if a day is today
   */
  function isToday(dayNumber) {
    const today = getTodayInfo();
    return today.isDecember && dayNumber === today.day;
  }

  /**
   * Load opened days from storage
   */
  function loadOpenedDays() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        openedDays = new Set(parsed);
      }
    } catch (e) {
      console.warn('Could not load opened days from storage:', e);
    }
  }

  /**
   * Save opened days to storage
   */
  function saveOpenedDays() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...openedDays]));
    } catch (e) {
      console.warn('Could not save opened days to storage:', e);
    }
  }

  /**
   * Load test mode preference
   */
  function loadTestMode() {
    try {
      const stored = localStorage.getItem(TEST_MODE_KEY);
      if (stored === 'true') {
        isTestMode = true;
        testModeToggle.checked = true;
      }
    } catch (e) {
      console.warn('Could not load test mode preference:', e);
    }
  }

  /**
   * Generate the calendar grid
   */
  function generateCalendar() {
    calendarGrid.innerHTML = '';

    const decorations = ['❄️', '⭐', '🔔', '🎀', '❄️'];

    for (let i = 1; i <= CHOMPIE_DATA.config.totalDays; i++) {
      const door = document.createElement('button');
      door.className = 'calendar-door';
      door.setAttribute('data-day', i);
      door.setAttribute('aria-label', `Day ${i}`);

      const accessible = isDayAccessible(i);
      const opened = openedDays.has(i);
      const today = isToday(i);

      if (!accessible) {
        door.classList.add('locked');
        door.setAttribute('aria-disabled', 'true');
      }

      if (opened) {
        door.classList.add('opened');
      }

      if (today && !isTestMode) {
        door.classList.add('today');
      }

      // Door content
      door.innerHTML = `
        <span class="door-number">${i}</span>
        ${!accessible ? '<span class="lock-icon">🔒</span>' : ''}
        <span class="door-decoration">${decorations[i % decorations.length]}</span>
      `;

      // Click handler
      door.addEventListener('click', () => handleDoorClick(i));

      calendarGrid.appendChild(door);
    }
  }

  /**
   * Handle door click
   */
  function handleDoorClick(dayNumber) {
    if (!isDayAccessible(dayNumber)) {
      // Show locked message
      showLockedMessage(dayNumber);
      return;
    }

    // Get day data
    const dayData = CHOMPIE_DATA.days.find((d) => d.day === dayNumber);
    if (!dayData) {
      console.error('No data for day:', dayNumber);
      return;
    }

    currentDayData = dayData;

    // Mark as opened
    openedDays.add(dayNumber);
    saveOpenedDays();

    // Update door appearance
    const door = calendarGrid.querySelector(`[data-day="${dayNumber}"]`);
    if (door) {
      door.classList.add('opened');
    }

    // Show modal
    openModal(dayData, dayNumber);
  }

  /**
   * Show locked day message
   */
  function showLockedMessage(dayNumber) {
    const today = getTodayInfo();

    let message;
    if (!today.isDecember) {
      message = 'Come back in December to start the advent calendar!';
    } else {
      message = `Day ${dayNumber} isn't ready yet! Come back on December ${dayNumber}.`;
    }

    // Simple alert for now - could be replaced with custom modal
    alert(message);
  }

  /**
   * Open the modal with day content
   */
  function openModal(dayData, dayNumber) {
    // Set content
    modalDay.textContent = `Day ${dayNumber}`;

    // Set Chompie illustration (emoji placeholder)
    const chompieEmoji = CHOMPIE_DATA.chompieVariations[dayNumber - 1] || '🎅';
    chompieIllustration.innerHTML = chompieEmoji;

    // Set poem
    modalPoem.textContent = dayData.poem;

    // Reset treat section
    revealTreatBtn.classList.remove('hidden');
    treatContent.classList.add('hidden');

    // Set treat data for reveal
    treatIcon.textContent = dayData.treat.icon;
    treatTitle.textContent = dayData.treat.title;
    treatDescription.textContent = dayData.treat.description;

    // Handle sponsor info
    if (dayData.treat.sponsor) {
      const sponsor = dayData.treat.sponsor;
      sponsorBadge.innerHTML = `
        Sponsored by <a href="${sponsor.url}" target="_blank" rel="noopener">${sponsor.name}</a>
        ${sponsor.tagline ? `<br><small>${sponsor.tagline}</small>` : ''}
      `;
    } else {
      sponsorBadge.innerHTML = '';
    }

    // Show modal
    modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Focus trap
    modalClose.focus();
  }

  /**
   * Close the modal
   */
  function closeModal() {
    modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
    currentDayData = null;
  }

  /**
   * Reveal the treat
   */
  function revealTreat() {
    revealTreatBtn.classList.add('hidden');
    treatContent.classList.remove('hidden');

    // If there's additional content, show it
    if (currentDayData && currentDayData.treat.content) {
      treatDescription.innerHTML = `
        ${currentDayData.treat.description}
        <br><br>
        <strong style="color: var(--color-gold);">${currentDayData.treat.content}</strong>
      `;
    }
  }

  /**
   * Toggle test mode
   */
  function toggleTestMode() {
    isTestMode = testModeToggle.checked;

    try {
      localStorage.setItem(TEST_MODE_KEY, isTestMode);
    } catch (e) {
      console.warn('Could not save test mode preference:', e);
    }

    // Regenerate calendar
    generateCalendar();
  }

  /**
   * Initialize the calendar
   */
  function init() {
    loadOpenedDays();
    loadTestMode();
    generateCalendar();

    // Event listeners
    testModeToggle.addEventListener('change', toggleTestMode);
    modalClose.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        closeModal();
      }
    });
    revealTreatBtn.addEventListener('click', revealTreat);

    // Keyboard handling
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
        closeModal();
      }
    });

    // Check for demo/preview mode via URL param
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('test') === 'true') {
      isTestMode = true;
      testModeToggle.checked = true;
      generateCalendar();
    }

    console.log('Chompie\'s December Calendar initialized!');
    console.log('Test mode:', isTestMode);
    console.log('Opened days:', [...openedDays]);
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
