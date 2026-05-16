(() => {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- Parallax: translate hero/break backgrounds based on viewport position ---
  const parallaxRoots = Array.from(document.querySelectorAll('[data-parallax-root]'));
  const parallaxLayers = parallaxRoots.map((root) => ({
    root,
    el: root.querySelector('[data-parallax]'),
    factor: parseFloat(root.querySelector('[data-parallax]')?.dataset.parallax || '0.3'),
  })).filter((p) => p.el);

  let ticking = false;
  const updateParallax = () => {
    const vh = window.innerHeight;
    parallaxLayers.forEach(({ root, el, factor }) => {
      const rect = root.getBoundingClientRect();
      // distance from viewport center to section center, clamped to a reasonable range
      const sectionCenter = rect.top + rect.height / 2;
      const offset = (sectionCenter - vh / 2) * factor;
      el.style.transform = `translate3d(0, ${(-offset).toFixed(1)}px, 0)`;
    });
    ticking = false;
  };
  const requestParallax = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updateParallax);
    }
  };
  if (!prefersReduced) {
    updateParallax();
    window.addEventListener('scroll', requestParallax, { passive: true });
    window.addEventListener('resize', requestParallax);
  }

  // --- Sticky nav background once user scrolls past hero start ---
  const nav = document.querySelector('.nav');
  const onScroll = () => {
    if (!nav) return;
    nav.classList.toggle('is-stuck', window.scrollY > 40);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // --- Reveal on intersect ---
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !prefersReduced) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-in'));
  }

  // --- Track previews: visual-only placeholder ---
  document.querySelectorAll('.track__play').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.animate(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(0.92)' },
          { transform: 'scale(1.05)' },
          { transform: 'scale(1)' },
        ],
        { duration: 350, easing: 'ease-out' }
      );
    });
  });

  // --- Contact form: client-side only for now ---
  const form = document.querySelector('.form');
  if (form) {
    const status = form.querySelector('.form__status');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const name = (data.get('name') || '').toString().trim();
      const email = (data.get('email') || '').toString().trim();
      const message = (data.get('message') || '').toString().trim();
      if (!name || !email || !message) {
        status.textContent = 'Please fill in name, email and a short message.';
        status.style.color = '#9c3b2a';
        return;
      }
      const subject = encodeURIComponent(`Studio inquiry from ${name}`);
      const body = encodeURIComponent(`${message}\n\n— ${name}\n${email}`);
      window.location.href = `mailto:hello@dismalnitch.studio?subject=${subject}&body=${body}`;
      status.textContent = 'Opening your email — if nothing happens, write us directly at hello@dismalnitch.studio.';
      status.style.color = '';
    });
  }

  // --- Footer year ---
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();
