// Spinner App - Game Night Selector
// Uses crypto.getRandomValues for better randomness

class Spinner {
  constructor() {
    this.spinner = document.getElementById('spinner');
    this.spinButton = document.getElementById('spinButton');
    this.currentRotation = 0;
    this.isSpinning = false;

    this.init();
  }

  init() {
    // Bind events
    this.spinButton.addEventListener('click', () => this.spin());
    this.spinner.addEventListener('click', () => this.spin());

    // Touch events for better mobile experience
    this.spinner.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.spin();
    });

    // Register service worker
    this.registerServiceWorker();

    // Setup install prompt
    this.setupInstallPrompt();
  }

  // Generate cryptographically random number between 0 and 1
  getSecureRandom() {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] / (0xFFFFFFFF + 1);
  }

  // Generate random angle with multiple sources of entropy
  generateRandomAngle() {
    // Use multiple random values for extra randomness
    const r1 = this.getSecureRandom();
    const r2 = this.getSecureRandom();
    const r3 = this.getSecureRandom();

    // Add timing-based entropy
    const timeEntropy = (performance.now() % 1000) / 1000;

    // Combine entropy sources
    const combined = (r1 + r2 + r3 + timeEntropy) % 1;

    // Return angle between 0 and 360
    return combined * 360;
  }

  spin() {
    if (this.isSpinning) return;

    this.isSpinning = true;
    this.spinButton.disabled = true;
    this.spinner.classList.remove('celebrate');

    // Generate random final position
    const randomAngle = this.generateRandomAngle();

    // Add multiple full rotations (5-10 spins) for dramatic effect
    const minSpins = 5;
    const maxSpins = 10;
    const numberOfSpins = minSpins + Math.floor(this.getSecureRandom() * (maxSpins - minSpins + 1));
    const totalRotation = (numberOfSpins * 360) + randomAngle;

    // Calculate new rotation (always spin forward)
    this.currentRotation += totalRotation;

    // Apply rotation
    this.spinner.classList.add('spinning');
    this.spinner.style.transform = `rotate(${this.currentRotation}deg)`;

    // Trigger haptic feedback if available
    this.triggerHaptic('light');

    // Handle spin completion
    const spinDuration = 4000; // matches CSS transition

    // Haptic feedback near the end (no visual effect to avoid jitter)
    setTimeout(() => {
      this.triggerHaptic('medium');
    }, spinDuration - 500);

    // Complete the spin
    setTimeout(() => {
      this.isSpinning = false;
      this.spinButton.disabled = false;
      this.spinner.classList.remove('spinning');
      this.spinner.classList.add('celebrate');
      this.triggerHaptic('heavy');

      // Remove celebrate class after animation
      setTimeout(() => {
        this.spinner.classList.remove('celebrate');
      }, 500);
    }, spinDuration);
  }

  triggerHaptic(intensity = 'medium') {
    if (!navigator.vibrate) return;

    const patterns = {
      light: [10],
      medium: [30],
      heavy: [50, 30, 50]
    };

    navigator.vibrate(patterns[intensity] || patterns.medium);
  }

  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('sw.js');
        console.log('ServiceWorker registered:', registration.scope);
      } catch (error) {
        console.log('ServiceWorker registration failed:', error);
      }
    }
  }

  setupInstallPrompt() {
    let deferredPrompt;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      this.showInstallPrompt(deferredPrompt);
    });
  }

  showInstallPrompt(deferredPrompt) {
    // Create install prompt UI
    const promptEl = document.createElement('div');
    promptEl.className = 'install-prompt';
    promptEl.innerHTML = `
      <p>Install Spinner for quick access!</p>
      <div>
        <button class="dismiss-btn">Later</button>
        <button class="install-btn">Install</button>
      </div>
    `;

    document.body.appendChild(promptEl);

    // Show after a short delay
    setTimeout(() => promptEl.classList.add('show'), 1000);

    // Handle install
    promptEl.querySelector('.install-btn').addEventListener('click', async () => {
      promptEl.classList.remove('show');
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('Install outcome:', outcome);
      promptEl.remove();
    });

    // Handle dismiss
    promptEl.querySelector('.dismiss-btn').addEventListener('click', () => {
      promptEl.classList.remove('show');
      setTimeout(() => promptEl.remove(), 300);
    });
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new Spinner();
});
