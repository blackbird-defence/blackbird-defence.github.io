/**
 * Matrix rain background + BLACKBIRD decode text animation.
 * Mirrors the Flutter splash screen effect.
 */
(function () {
  'use strict';

  // ─── Constants ───
  const MATRIX_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*<>[]{}';
  const TARGET_TEXT = 'BLACKBIRD';
  const STATUS_MESSAGES = [
    'INITIALIZING SYSTEM...',
    'ESTABLISHING SECURE CONNECTION...',
    'LOADING DEFENSE DATA...',
    'SYSTEM READY',
  ];

  // ─── Matrix Rain Canvas ───
  const canvas = document.getElementById('matrixCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let columns = [];
  let fontSize = 14;
  let colCount = 0;

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    fontSize = window.innerWidth < 768 ? 12 : 14;
    colCount = Math.floor(canvas.width / fontSize);

    // Preserve existing drop positions or initialize
    const oldCols = columns.slice();
    columns = [];
    for (let i = 0; i < colCount; i++) {
      columns[i] = oldCols[i] || Math.random() * -100;
    }
  }

  const RAIN_INTERVAL = 45; // ms between frames – higher = slower rain
  let lastRainTime = 0;

  function drawMatrixRain(timestamp) {
    requestAnimationFrame(drawMatrixRain);

    if (timestamp - lastRainTime < RAIN_INTERVAL) return;
    lastRainTime = timestamp;

    // Semi-transparent background for trail effect
    ctx.fillStyle = 'rgba(10, 15, 10, 0.06)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = fontSize + 'px Courier New';

    for (let i = 0; i < colCount; i++) {
      const char = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
      const x = i * fontSize;
      const y = columns[i] * fontSize;

      // Varying green brightness
      const brightness = Math.random();
      if (brightness > 0.95) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; // Head of column
      } else if (brightness > 0.7) {
        ctx.fillStyle = 'rgba(74, 222, 128, 0.8)';
      } else {
        ctx.fillStyle = 'rgba(74, 222, 128, 0.25)';
      }

      ctx.fillText(char, x, y);

      // Reset or advance
      if (y > canvas.height && Math.random() > 0.975) {
        columns[i] = 0;
      }
      columns[i]++;
    }
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
  drawMatrixRain();

  // ─── BLACKBIRD Decode Animation ───
  const decodeChars = document.querySelectorAll('.decode-char');
  const sloganEl = document.getElementById('heroSlogan');
  const statusEl = document.getElementById('statusText');
  const statusBarFill = document.getElementById('statusBarFill');
  const heroStatus = document.querySelector('.hero-status');

  if (!decodeChars.length) return;

  const displayState = new Array(TARGET_TEXT.length).fill(false);
  let currentIndex = 0;

  // Phase 1: Random character cycling
  function startRandomCycle() {
    const cycleInterval = setInterval(() => {
      decodeChars.forEach((el, i) => {
        if (!displayState[i]) {
          el.textContent = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
        }
      });
    }, 50);

    // Phase 2: Start decoding after delay
    setTimeout(() => {
      startDecoding(cycleInterval);
    }, 1200);
  }

  function startDecoding(cycleInterval) {
    const decodeInterval = setInterval(() => {
      if (currentIndex < TARGET_TEXT.length) {
        const el = decodeChars[currentIndex];
        el.textContent = TARGET_TEXT[currentIndex];
        el.classList.add('decoded');
        displayState[currentIndex] = true;
        currentIndex++;
      } else {
        clearInterval(decodeInterval);
        clearInterval(cycleInterval);
        onDecodeComplete();
      }
    }, 180);
  }

  function onDecodeComplete() {
    // Show slogan
    setTimeout(() => {
      if (sloganEl) sloganEl.classList.add('visible');
    }, 300);

    // Show status bar
    setTimeout(() => {
      if (heroStatus) heroStatus.classList.add('visible');
      animateStatusMessages();
    }, 600);
  }

  function animateStatusMessages() {
    let msgIndex = 0;
    const interval = setInterval(() => {
      if (msgIndex < STATUS_MESSAGES.length) {
        if (statusEl) statusEl.textContent = STATUS_MESSAGES[msgIndex];
        if (statusBarFill) {
          statusBarFill.style.width = ((msgIndex + 1) / STATUS_MESSAGES.length * 100) + '%';
        }
        msgIndex++;
      } else {
        clearInterval(interval);
      }
    }, 600);
  }

  // Start after a short delay
  setTimeout(startRandomCycle, 500);

  // ─── Navbar scroll effect ───
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (navbar) {
      navbar.classList.toggle('scrolled', window.scrollY > 60);
    }
  });

  // ─── Mobile menu toggle ───
  const menuBtn = document.getElementById('navMenuBtn');
  const mobileMenu = document.getElementById('navMobile');

  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', () => {
      menuBtn.classList.toggle('active');
      mobileMenu.classList.toggle('active');
    });

    // Close on link click
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        menuBtn.classList.remove('active');
        mobileMenu.classList.remove('active');
      });
    });
  }

  // ─── Scroll-triggered animations ───
  function onIntersect(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }

  const observer = new IntersectionObserver(onIntersect, {
    threshold: 0.15,
    rootMargin: '0px 0px -40px 0px',
  });

  document.querySelectorAll('.feature-card[data-aos]').forEach(el => {
    observer.observe(el);
  });

  // ─── Counter animation ───
  function animateCounters() {
    document.querySelectorAll('.tech-stat-value[data-count]').forEach(el => {
      const target = parseInt(el.getAttribute('data-count'), 10);
      const duration = 2000;
      const start = performance.now();

      function step(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(target * eased);
        if (progress < 1) requestAnimationFrame(step);
      }

      requestAnimationFrame(step);
    });
  }

  const techSection = document.getElementById('tech');
  if (techSection) {
    const counterObserver = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        animateCounters();
        counterObserver.disconnect();
      }
    }, { threshold: 0.3 });
    counterObserver.observe(techSection);
  }
})();
