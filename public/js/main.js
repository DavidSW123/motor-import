/* Motor Import — Main JS */

// ── Header scroll + Home-hero (logo grande centrado en el hero) ─
const header = document.getElementById('site-header');
const isHome = location.pathname === '/' || location.pathname === '';
if (header) {
  // Si es home, marca el body para que el logo arranque centrado en el hero
  if (isHome) document.body.classList.add('home-hero-active');

  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle('scrolled', y > 40);
    if (isHome) {
      // Cuando el usuario empieza a scrollear, el logo abandona el hero
      // y se anima hacia el header.
      document.body.classList.toggle('home-hero-active', y < 80);
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// ── Suprimir animación del logo durante zoom / resize ────────────
// El transform del logo usa 50vw para centrarlo. Al hacer zoom, el
// vw cambia y la transición animada hace que el logo "se deslice"
// durante 0.7s hasta el nuevo centro. No queremos esa animación al
// hacer zoom (solo al scrollear). Desactivamos transitions un breve
// instante al detectar resize.
let _logoResizeTimer = null;
window.addEventListener('resize', () => {
  document.body.classList.add('disable-logo-transition');
  clearTimeout(_logoResizeTimer);
  _logoResizeTimer = setTimeout(() => {
    document.body.classList.remove('disable-logo-transition');
  }, 200);
}, { passive: true });

// ── Mobile menu ───────────────────────────────────────────────────
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileMenu    = document.getElementById('mobileMenu');
if (mobileMenuBtn && mobileMenu) {
  mobileMenuBtn.addEventListener('click', () => {
    const open = mobileMenu.classList.toggle('open');
    mobileMenuBtn.classList.toggle('open', open);
    document.body.classList.toggle('mobile-menu-open', open);
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

// ── Header dropdown "Coches" en táctil/mobile (sin hover) ───────
// En desktop ya funciona con :hover por CSS. Para tablets/móvil
// (donde no hay hover) hacemos un toggle al primer toque del padre.
document.querySelectorAll('.has-dropdown').forEach(parent => {
  const trigger = parent.querySelector('a');
  if (!trigger) return;
  trigger.addEventListener('click', (e) => {
    // Solo si NO hay hover real (touch device o pantalla pequeña)
    if (window.matchMedia('(hover: hover)').matches) return;
    if (!parent.classList.contains('open')) {
      e.preventDefault(); // primer toque: abrir dropdown
      // cerrar otros abiertos
      document.querySelectorAll('.has-dropdown.open').forEach(p => p.classList.remove('open'));
      parent.classList.add('open');
    }
    // segundo toque: el navegador sigue el href
  });
});
// Cerrar dropdown al tocar fuera
document.addEventListener('click', (e) => {
  if (!e.target.closest('.has-dropdown')) {
    document.querySelectorAll('.has-dropdown.open').forEach(p => p.classList.remove('open'));
  }
});

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

// ── Gallery (car detail page) — tabs Fotos/Vídeos + lightbox ──────
(function setupGallery() {
  const galleryMain  = document.getElementById('galleryMain');
  const mainImage    = document.getElementById('mainImage');
  const thumbs       = Array.from(document.querySelectorAll('.gallery-thumb'));
  const galleryCurrent = document.getElementById('galleryCurrent');
  const images = typeof CAR_IMAGES !== 'undefined' ? CAR_IMAGES : [];
  const videos = typeof CAR_VIDEOS !== 'undefined' ? CAR_VIDEOS : [];
  if (!mainImage && videos.length === 0) return;

  // Estado: 'image' o 'video', y el índice en su lista
  let mode = 'image';
  let currentIndex = 0;

  // ── Tabs Fotos / Vídeos ─────────────────────────────────────────
  const tabs   = Array.from(document.querySelectorAll('.gallery-tab'));
  const panels = Array.from(document.querySelectorAll('.gallery-panel'));
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach(t => t.classList.toggle('is-active', t === tab));
      panels.forEach(p => p.classList.toggle('is-active', p.dataset.panel === target));
    });
  });

  // ── Thumbs principales (fotos) ──────────────────────────────────
  function setActiveImage(index) {
    if (!mainImage || !thumbs[index]) return;
    currentIndex = index;
    mode = 'image';
    const src = thumbs[index].dataset.src;
    mainImage.src = src;
    thumbs.forEach((t, i) => t.classList.toggle('active', i === index));
    if (galleryCurrent) galleryCurrent.textContent = index + 1;
    thumbs[index].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
  thumbs.forEach((thumb, i) => thumb.addEventListener('click', () => setActiveImage(i)));

  // ── Lightbox ────────────────────────────────────────────────────
  const lightbox        = document.getElementById('lightbox');
  const lbImg           = document.getElementById('lightboxImg');
  const lbVideo         = document.getElementById('lightboxVideo');
  const lbStage         = document.getElementById('lightboxStage');
  const lbClose         = document.getElementById('lightboxClose');
  const lbPrev          = document.getElementById('lightboxPrev');
  const lbNext          = document.getElementById('lightboxNext');
  const lbCurrent       = document.getElementById('lightboxCurrent');
  const lbTotal         = document.getElementById('lightboxTotal');
  const lbZoomIn        = document.getElementById('lightboxZoomIn');
  const lbZoomOut       = document.getElementById('lightboxZoomOut');
  const lbZoomReset     = document.getElementById('lightboxZoomReset');
  const lbToolbar       = lightbox?.querySelector('.lightbox-toolbar');

  // Zoom y pan
  let zoom = 1, panX = 0, panY = 0;
  let isDragging = false, lastX = 0, lastY = 0;
  // Pinch zoom (mobile)
  let pinchStartDist = 0, pinchStartZoom = 1;

  function applyTransform() {
    if (!lbImg) return;
    lbImg.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    lbImg.style.cursor = zoom > 1 ? 'grab' : 'zoom-in';
    lbStage.classList.toggle('is-zoomed', zoom > 1);
  }
  function resetZoom() { zoom = 1; panX = 0; panY = 0; applyTransform(); }
  function setZoom(newZoom, originX, originY) {
    const oldZoom = zoom;
    zoom = Math.min(5, Math.max(0.5, newZoom));
    if (originX != null && originY != null) {
      // Mantener punto bajo el cursor estático
      const rect = lbImg.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      panX -= (originX - cx) * (zoom / oldZoom - 1);
      panY -= (originY - cy) * (zoom / oldZoom - 1);
    }
    if (zoom <= 1) { panX = 0; panY = 0; }
    applyTransform();
  }

  function showMedia(type, index) {
    mode = type;
    currentIndex = index;
    const list = type === 'video' ? videos : images;
    if (!list[index]) return;
    if (type === 'video') {
      lbImg.style.display = 'none';
      lbImg.src = '';
      lbVideo.style.display = '';
      lbVideo.src = list[index];
      try { lbVideo.play(); } catch (_) {}
      if (lbToolbar) lbToolbar.style.display = 'none';
    } else {
      lbVideo.pause();
      lbVideo.src = '';
      lbVideo.style.display = 'none';
      lbImg.style.display = '';
      lbImg.src = list[index];
      resetZoom();
      if (lbToolbar) lbToolbar.style.display = '';
    }
    if (lbCurrent) lbCurrent.textContent = index + 1;
    if (lbTotal)   lbTotal.textContent   = list.length;
    if (type === 'image') setActiveImage(index);
  }

  function openLightbox(type, index) {
    if (!lightbox) return;
    const list = type === 'video' ? videos : images;
    if (!list.length) return;
    showMedia(type, index);
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
    lbVideo.pause();
    lbVideo.src = '';
    resetZoom();
  }
  function nav(dir) {
    const list = mode === 'video' ? videos : images;
    if (list.length < 2) return;
    const next = (currentIndex + dir + list.length) % list.length;
    showMedia(mode, next);
  }

  // Click en foto principal → abre lightbox
  if (galleryMain) galleryMain.addEventListener('click', () => openLightbox('image', currentIndex));
  // Click en thumb de vídeo → abre lightbox
  document.querySelectorAll('.video-thumb').forEach(el => {
    el.addEventListener('click', () => {
      const i = parseInt(el.dataset.videoIndex, 10) || 0;
      openLightbox('video', i);
    });
  });

  // Controles
  if (lbClose) lbClose.addEventListener('click', closeLightbox);
  if (lbPrev)  lbPrev.addEventListener('click',  () => nav(-1));
  if (lbNext)  lbNext.addEventListener('click',  () => nav(1));
  if (lightbox) lightbox.addEventListener('click', e => {
    // Click en fondo (no en imagen/video/botones) cierra
    if (e.target === lightbox || e.target === lbStage) closeLightbox();
  });
  if (lbZoomIn)    lbZoomIn.addEventListener('click',    () => setZoom(zoom * 1.4));
  if (lbZoomOut)   lbZoomOut.addEventListener('click',   () => setZoom(zoom / 1.4));
  if (lbZoomReset) lbZoomReset.addEventListener('click', resetZoom);

  // Wheel = zoom centrado en cursor
  if (lbStage) lbStage.addEventListener('wheel', e => {
    if (mode !== 'image') return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setZoom(zoom * factor, e.clientX, e.clientY);
  }, { passive: false });

  // Doble click = toggle 1x ↔ 2x
  if (lbImg) lbImg.addEventListener('dblclick', e => {
    if (zoom > 1) resetZoom();
    else setZoom(2, e.clientX, e.clientY);
  });

  // Drag para pan cuando zoom > 1
  if (lbImg) {
    lbImg.addEventListener('mousedown', e => {
      if (zoom <= 1) return;
      isDragging = true; lastX = e.clientX; lastY = e.clientY;
      lbImg.style.cursor = 'grabbing';
      e.preventDefault();
    });
    window.addEventListener('mousemove', e => {
      if (!isDragging) return;
      panX += e.clientX - lastX;
      panY += e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      applyTransform();
    });
    window.addEventListener('mouseup', () => {
      if (isDragging) { isDragging = false; lbImg.style.cursor = 'grab'; }
    });
  }

  // Teclado
  document.addEventListener('keydown', e => {
    if (!lightbox?.classList.contains('open')) return;
    if (e.key === 'Escape')     closeLightbox();
    if (e.key === 'ArrowLeft')  nav(-1);
    if (e.key === 'ArrowRight') nav(1);
    if (mode === 'image') {
      if (e.key === '+' || e.key === '=') setZoom(zoom * 1.4);
      if (e.key === '-')                  setZoom(zoom / 1.4);
      if (e.key === '0')                  resetZoom();
    }
  });

  // Touch: swipe (sin pinch) + pinch-zoom + pan al mover con un dedo zoom>1
  let touchStartX = 0, touchStartY = 0;
  if (lightbox) {
    lightbox.addEventListener('touchstart', e => {
      if (e.touches.length === 2 && mode === 'image') {
        const [a, b] = e.touches;
        pinchStartDist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
        pinchStartZoom = zoom;
      } else if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        if (zoom > 1) { lastX = touchStartX; lastY = touchStartY; isDragging = true; }
      }
    }, { passive: true });
    lightbox.addEventListener('touchmove', e => {
      if (e.touches.length === 2 && mode === 'image' && pinchStartDist) {
        const [a, b] = e.touches;
        const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
        setZoom(pinchStartZoom * (dist / pinchStartDist));
      } else if (e.touches.length === 1 && isDragging && zoom > 1) {
        const t = e.touches[0];
        panX += t.clientX - lastX;
        panY += t.clientY - lastY;
        lastX = t.clientX; lastY = t.clientY;
        applyTransform();
      }
    }, { passive: true });
    lightbox.addEventListener('touchend', e => {
      isDragging = false;
      pinchStartDist = 0;
      // Si fue un swipe (sin zoom y sin pinch), navegar
      if (zoom <= 1 && e.changedTouches.length === 1) {
        const dx = touchStartX - e.changedTouches[0].clientX;
        const dy = Math.abs(touchStartY - e.changedTouches[0].clientY);
        if (Math.abs(dx) > 50 && dy < 80) nav(dx > 0 ? 1 : -1);
      }
    });
  }
})();

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
