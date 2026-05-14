const multer = require('multer');
const path   = require('path');

const IMG_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];
const VID_EXTS = ['.mp4', '.webm', '.mov', '.m4v'];

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (IMG_EXTS.includes(ext) || VID_EXTS.includes(ext)) cb(null, true);
  else cb(new Error('Solo se permiten imágenes (JPG/PNG/WebP/AVIF) o vídeos (MP4/WebM/MOV)'), false);
};

// Helper para que las rutas detecten si el archivo es imagen o vídeo
function detectMediaType(originalname) {
  const ext = path.extname(originalname).toLowerCase();
  return VID_EXTS.includes(ext) ? 'video' : 'imagen';
}

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  // 100MB por archivo (vídeos pueden ser pesados). Nginx debe estar
  // configurado con client_max_body_size >= 100M en el server.
  limits: { fileSize: 100 * 1024 * 1024 }
});

module.exports = upload;
module.exports.detectMediaType = detectMediaType;
module.exports.IMG_EXTS = IMG_EXTS;
module.exports.VID_EXTS = VID_EXTS;
