/* Motor Import — Main JS */

// ── Header scroll ────────────────────────────────────────────────
const header = document.getElementById('site-header');
if (header) {
  const onScroll = () => {
    header.classList.toggle('scrolled', window.scrollY > 40);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// ── Mobile menu ───────────────────────────────────────────────────
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileMenu    = document.getElementById('mobileMenu');
if (mobileMenuBtn && mobileMenu) {
  mobileMenuBtn.addEventListener('click', () => {
    const open = mobileMenu.classList.toggle('open');
    mobileMenuBtn.classList.toggle('open', open);
    mobileMenuBtn.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  });
}

// ── User dropdown ─────────────────────────────────────────────────
const userMenuTrigger = document.getElementById('userMenuTrigger');
const userDropdown    = document.getElementById('userDropdown');
if (userMenuTrigger && userDropdown) {
  userMenuTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = userDropdown.classList.toggle('open');
    userMenuTrigger.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', () => userDropdown.classList.remove('open'));
}

// ── Password toggle ───────────────────────────────────────────────
document.querySelectorAll('.pwd-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
  });
});

// ── Flash auto-dismiss ────────────────────────────────────────────
const flash = document.getElementById('siteFlash');
if (flash) {
  setTimeout(() => flash.classList.add('flash-fade'), 4000);
  flash.addEventListener('transitionend', () => flash.remove());
}

// ── Gallery (car detail page) ─────────────────────────────────────
const galleryMain  = document.getElementById('galleryMain');
const mainImage    = document.getElementById('mainImage');
const thumbs       = document.querySelectorAll('.gallery-thumb');
const galleryCurrent = document.getElementById('galleryCurrent');
let currentIndex = 0;

if (mainImage && thumbs.length > 0) {
  thumbs.forEach((thumb, i) => {
    thumb.addEventListener('click', () => {
      setActiveImage(i);
    });
  });

  function setActiveImage(index) {
    currentIndex = index;
    const src = thumbs[index].dataset.src;
    mainImage.src = src;
    thumbs.forEach((t, i) => t.classList.toggle('active', i === index));
    if (galleryCurrent) galleryCurrent.textContent = index + 1;
    // Scroll thumb into view
    thumbs[index].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  // Lightbox
  const lightbox        = document.getElementById('lightbox');
  const lightboxImg     = document.getElementById('lightboxImg');
  const lightboxClose   = document.getElementById('lightboxClose');
  const lightboxPrev    = document.getElementById('lightboxPrev');
  const lightboxNext    = document.getElementById('lightboxNext');
  const lightboxCurrent = document.getElementById('lightboxCurrent');
  const images = typeof CAR_IMAGES !== 'undefined' ? CAR_IMAGES : [];

  function openLightbox(index) {
    if (!lightbox || images.length === 0) return;
    currentIndex = index;
    lightboxImg.src = images[index];
    if (lightboxCurrent) lightboxCurrent.textContent = index + 1;
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
  }

  function lightboxNav(dir) {
    if (images.length < 2) return;
    currentIndex = (currentIndex + dir + images.length) % images.length;
    lightboxImg.src = images[currentIndex];
    if (lightboxCurrent) lightboxCurrent.textContent = currentIndex + 1;
    setActiveImage(currentIndex);
  }

  if (galleryMain) galleryMain.addEventListener('click', () => openLightbox(currentIndex));
  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightboxPrev)  lightboxPrev.addEventListener('click',  () => lightboxNav(-1));
  if (lightboxNext)  lightboxNext.addEventListener('click',  () => lightboxNav(1));
  if (lightbox) lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });

  document.addEventListener('keydown', e => {
    if (!lightbox?.classList.contains('open')) return;
    if (e.key === 'Escape')     closeLightbox();
    if (e.key === 'ArrowLeft')  lightboxNav(-1);
    if (e.key === 'ArrowRight') lightboxNav(1);
  });

  // Touch swipe on lightbox
  let touchStartX = 0;
  if (lightbox) {
    lightbox.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    lightbox.addEventListener('touchend', e => {
      const diff = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) lightboxNav(diff > 0 ? 1 : -1);
    });
  }
}

// ── Favorite button (car detail) ──────────────────────────────────
const favoriteBtn = document.getElementById('favoriteBtn');
if (favoriteBtn) {
  favoriteBtn.addEventListener('click', async () => {
    const carId = favoriteBtn.dataset.carId;
    favoriteBtn.disabled = true;
    try {
      const res  = await fetch(`/favoritos/${carId}/toggle`, { method: 'POST' });
      const data = await res.json();
      const heart = favoriteBtn.querySelector('svg');
      const text  = document.getElementById('favBtnText');
      if (data.favorited) {
        favoriteBtn.classList.add('is-favorite');
        if (heart) heart.setAttribute('fill', 'currentColor');
        if (text)  text.textContent = 'En favoritos';
      } else {
        favoriteBtn.classList.remove('is-favorite');
        if (heart) heart.setAttribute('fill', 'none');
        if (text)  text.textContent = 'Guardar favorito';
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
    } finally {
      favoriteBtn.disabled = false;
    }
  });
}

// ── Scroll-triggered fade animations ─────────────────────────────
if ('IntersectionObserver' in window) {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.car-card, .feature-card, .step-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    obs.observe(el);
  });
}

// ── Stat counter animation ────────────────────────────────────────
if ('IntersectionObserver' in window) {
  const counterObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el    = entry.target;
        const target = parseInt(el.dataset.count);
        if (!isNaN(target)) animateCount(el, target);
        counterObs.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('.stat-number[data-count]').forEach(el => counterObs.observe(el));

  function animateCount(el, target) {
    const duration = 1200;
    const start    = performance.now();
    const update   = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target) + (el.textContent.includes('%') ? '%' : '+');
      if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  }
}

// ── Flash CSS for fade ────────────────────────────────────────────
const flashStyle = document.createElement('style');
flashStyle.textContent = `.flash-fade { opacity: 0; transform: translateX(20px); transition: opacity 0.4s ease, transform 0.4s ease; }`;
document.head.appendChild(flashStyle);
