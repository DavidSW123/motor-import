/* Motor Import — Admin JS */

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

  function handleFiles(files) {
    const newFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    selectedFiles = [...selectedFiles, ...newFiles].slice(0, MAX_IMAGES);
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
