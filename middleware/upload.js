const multer = require('multer');
const path   = require('path');

const fileFilter = (_req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];
  const ext     = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Solo se permiten imágenes JPG, PNG o WebP'), false);
};

module.exports = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  // 50MB por archivo — el servidor (Nginx + Node) los aguanta sin
  // problema. Antes estaba a 8MB por la limitación de Vercel.
  limits: { fileSize: 50 * 1024 * 1024 }
});
