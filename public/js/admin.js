/* Motor Import — Admin JS */

// ── Compresión cliente de imágenes ────────────────────────────────
// Vercel limita los requests a ~4.5MB. Las fotos de móvil suelen ser
// 8-15MB, así que reducimos al lado long ≤ 1600px y re-codificamos en
// JPEG calidad 0.80. Resultado típico: 180-450 KB por imagen — así
// caben 10+ fotos en un solo POST sin pasarse del límite.
const COMPRESS_MAX_EDGE = 1600;
const COMPRESS_QUALITY  = 0.80;

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

  const MAX_IMAGES = 15;
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
    const rawNewFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!rawNewFiles.length) return;

    // Mostrar estado "comprimiendo" en el hint
    const hint = document.querySelector(`#${zoneId || ''} .upload-zone-hint`) ||
                 zone?.querySelector('.upload-zone-hint');
    if (hint) hint.textContent = `Optimizando ${rawNewFiles.length} imagen${rawNewFiles.length !== 1 ? 'es' : ''}…`;

    const compressed = await Promise.all(rawNewFiles.map(compressImage));
    selectedFiles = [...selectedFiles, ...compressed].slice(0, MAX_IMAGES);
    renderPreviews();
    // Update input with selectedFiles (create DataTransfer)
    if (window.DataTransfer) {
      const dt = new DataTransfer();
      selectedFiles.forEach(f => dt.items.add(f));
      input.files = dt.files;
    }
  }

  function renderPreviews() {
    preview.innerHTML = '';
    selectedFiles.forEach((file, i) => {
      const reader = new FileReader();
      reader.onload = e => {
        const item = document.createElement('div');
        item.className = 'upload-preview-item';
        item.innerHTML = `
          <img src="${e.target.result}" alt="">
          <button type="button" class="remove-preview" data-index="${i}">✕</button>
          ${i === 0 ? '<div style="position:absolute;bottom:0;left:0;right:0;background:var(--gold);color:#0a0800;font-size:0.6rem;font-weight:800;text-align:center;padding:1px">PRINCIPAL</div>' : ''}
        `;
        item.querySelector('.remove-preview').addEventListener('click', () => {
          selectedFiles.splice(i, 1);
          renderPreviews();
          if (window.DataTransfer) {
            const dt = new DataTransfer();
            selectedFiles.forEach(f => dt.items.add(f));
            input.files = dt.files;
          }
        });
        preview.appendChild(item);
      };
      reader.readAsDataURL(file);
    });

    // Show count
    const hint = document.querySelector('.upload-zone-hint');
    if (hint && selectedFiles.length > 0) {
      hint.textContent = `${selectedFiles.length} imagen${selectedFiles.length !== 1 ? 'es' : ''} seleccionada${selectedFiles.length !== 1 ? 's' : ''}`;
    }
  }
}

// Initialize upload zones
setupUploadZone('imageInput', 'uploadPreview', 'uploadZone');
setupUploadZone('addImageInput', 'addUploadPreview', 'addUploadZone');

// ── Guard previo al envío: avisa si pasaría del límite de Vercel
const VERCEL_LIMIT = 4 * 1024 * 1024;  // 4MB de margen sobre el 4.5MB real

function guardFormSize(form, inputId) {
  const input = document.getElementById(inputId);
  if (!input || !input.files.length) return true;
  const totalSize = Array.from(input.files).reduce((s, f) => s + f.size, 0);
  if (totalSize <= VERCEL_LIMIT) return true;
  const mb = (totalSize / 1024 / 1024).toFixed(1);
  alert(
    `Las imágenes pesan ${mb} MB en total y el servidor solo acepta 4 MB por subida.\n\n` +
    `Solución: guarda el coche primero con menos imágenes y añade el resto desde la edición ` +
    `usando "Añadir imágenes" (puedes hacer varios envíos).`
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
