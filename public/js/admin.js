/* Motor Import — Admin JS */

// ── Compresión cliente de imágenes ────────────────────────────────
// Servidor propio (Nginx + Node en Hetzner): aguanta 50MB por archivo.
// Sólo redimensionamos las fotos muy grandes (>2400px en el lado long)
// para evitar subir cosas innecesariamente enormes, pero conservando
// calidad alta. Resultado típico: 1-3MB por foto, calidad muy buena.
const COMPRESS_MAX_EDGE = 2400;
const COMPRESS_QUALITY  = 0.92;

function compressImage(file) {
  return new Promise((resolve) => {
    // Si no es imagen o es muy pequeña, pasarla tal cual
    if (!file.type.startsWith('image/') || file.size < 500 * 1024) {
      return resolve(file);
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const longEdge = Math.max(width, height);
      if (longEdge > COMPRESS_MAX_EDGE) {
        const scale = COMPRESS_MAX_EDGE / longEdge;
        width  = Math.round(width  * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return resolve(file);
          // Si la compresión empeora el peso, devuelve el original
          if (blob.size >= file.size) return resolve(file);
          const baseName = file.name.replace(/\.[^.]+$/, '');
          const newFile = new File([blob], `${baseName}.jpg`, {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          resolve(newFile);
        },
        'image/jpeg',
        COMPRESS_QUALITY
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

// ── Image upload preview ──────────────────────────────────────────
function setupUploadZone(inputId, previewId, zoneId) {
  const input   = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  const zone    = document.getElementById(zoneId);
  if (!input || !preview) return;

  const MAX_FILES = 20;
  let selectedFiles = [];

  input.addEventListener('change', () => handleFiles(input.files));

  if (zone) {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      handleFiles(e.dataTransfer.files);
    });
  }

  async function handleFiles(files) {
    const rawNewFiles = Array.from(files).filter(f =>
      f.type.startsWith('image/') || f.type.startsWith('video/')
    );
    if (!rawNewFiles.length) return;

    const hint = document.querySelector(`#${zoneId || ''} .upload-zone-hint`) ||
                 zone?.querySelector('.upload-zone-hint');

    // Comprimir SOLO imágenes; los vídeos van tal cual (no se procesan)
    const imgs = rawNewFiles.filter(f => f.type.startsWith('image/'));
    const vids = rawNewFiles.filter(f => f.type.startsWith('video/'));

    if (imgs.length && hint) hint.textContent = `Optimizando ${imgs.length} imagen${imgs.length !== 1 ? 'es' : ''}…`;
    const compressedImgs = await Promise.all(imgs.map(compressImage));

    selectedFiles = [...selectedFiles, ...compressedImgs, ...vids].slice(0, MAX_FILES);
    renderPreviews();
    if (window.DataTransfer) {
      const dt = new DataTransfer();
      selectedFiles.forEach(f => dt.items.add(f));
      input.files = dt.files;
    }
  }

  function renderPreviews() {
    preview.innerHTML = '';
    // Calcular qué item será principal (la PRIMERA imagen, no vídeo)
    const firstImageIdx = selectedFiles.findIndex(f => f.type.startsWith('image/'));

    selectedFiles.forEach((file, i) => {
      const isVideo = file.type.startsWith('video/');
      const item = document.createElement('div');
      item.className = 'upload-preview-item' + (isVideo ? ' upload-preview-video' : '');

      const reader = new FileReader();
      reader.onload = e => {
        if (isVideo) {
          item.innerHTML = `
            <video src="${e.target.result}" muted preload="metadata" playsinline></video>
            <div class="upload-preview-video-badge">▶ Vídeo</div>
            <button type="button" class="remove-preview" data-index="${i}">✕</button>
          `;
        } else {
          const isPrincipal = i === firstImageIdx;
          item.innerHTML = `
            <img src="${e.target.result}" alt="">
            <button type="button" class="remove-preview" data-index="${i}">✕</button>
            ${isPrincipal ? '<div style="position:absolute;bottom:0;left:0;right:0;background:var(--gold);color:#0a0800;font-size:0.6rem;font-weight:800;text-align:center;padding:1px">PRINCIPAL</div>' : ''}
          `;
        }
        item.querySelector('.remove-preview').addEventListener('click', () => {
          selectedFiles.splice(i, 1);
          renderPreviews();
          if (window.DataTransfer) {
            const dt = new DataTransfer();
            selectedFiles.forEach(f => dt.items.add(f));
            input.files = dt.files;
          }
        });
      };
      reader.readAsDataURL(file);
      preview.appendChild(item);
    });

    const hint = document.querySelector(`#${zoneId || ''} .upload-zone-hint`) ||
                 zone?.querySelector('.upload-zone-hint');
    if (hint && selectedFiles.length > 0) {
      const imgs = selectedFiles.filter(f => f.type.startsWith('image/')).length;
      const vids = selectedFiles.filter(f => f.type.startsWith('video/')).length;
      const parts = [];
      if (imgs) parts.push(`${imgs} foto${imgs !== 1 ? 's' : ''}`);
      if (vids) parts.push(`${vids} vídeo${vids !== 1 ? 's' : ''}`);
      hint.textContent = parts.join(' y ');
    }
  }
}

// Initialize upload zones
setupUploadZone('imageInput', 'uploadPreview', 'uploadZone');
setupUploadZone('addImageInput', 'addUploadPreview', 'addUploadZone');

// ── Guard previo al envío: avisa si pasaría del límite del servidor
// Nginx admite client_max_body_size 150M; dejamos 140 de margen.
const UPLOAD_LIMIT = 140 * 1024 * 1024;

function guardFormSize(form, inputId) {
  const input = document.getElementById(inputId);
  if (!input || !input.files.length) return true;
  const totalSize = Array.from(input.files).reduce((s, f) => s + f.size, 0);
  if (totalSize <= UPLOAD_LIMIT) return true;
  const mb = (totalSize / 1024 / 1024).toFixed(1);
  alert(
    `Los archivos pesan ${mb} MB en total y el servidor acepta hasta 140 MB por subida.\n\n` +
    `Solución: sube los vídeos uno a uno o reduce el peso. Puedes guardar el coche con ` +
    `menos archivos y añadir el resto desde "Añadir fotos o vídeos" en varios envíos.`
  );
  return false;
}

const carForm = document.getElementById('carForm');
if (carForm) {
  carForm.addEventListener('submit', (e) => {
    if (!guardFormSize(carForm, 'imageInput')) e.preventDefault();
  });
}

const addImgForm = document.getElementById('addImgForm');
if (addImgForm) {
  addImgForm.addEventListener('submit', (e) => {
    if (!guardFormSize(addImgForm, 'addImageInput')) e.preventDefault();
  });
}

// ── Delete image confirmation ─────────────────────────────────────
document.querySelectorAll('.img-action-form').forEach(form => {
  // Already handled by onsubmit inline
});

// ── Admin sidebar active highlight ────────────────────────────────
const currentPath = window.location.pathname;
document.querySelectorAll('.admin-nav-item').forEach(link => {
  if (link.href) {
    const linkPath = new URL(link.href).pathname;
    if (linkPath !== '/admin' && currentPath.startsWith(linkPath)) {
      link.classList.add('active');
    } else if (linkPath === '/admin' && currentPath === '/admin') {
      link.classList.add('active');
    }
  }
});
