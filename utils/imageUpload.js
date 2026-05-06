const path = require('path');
const fs   = require('fs');

const isCloud = !!process.env.CLOUDINARY_CLOUD_NAME;
let cloudinary;

if (isCloud) {
  cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

// ── Upload genérico a una subcarpeta ─────────────────────────────
async function uploadToFolder(buffer, originalname, subfolder) {
  if (isCloud) {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `motor-import/${subfolder}`, resource_type: 'image' },
        (error, result) => {
          if (error) return reject(error);
          resolve({ url: result.secure_url, cloud_id: result.public_id });
        }
      );
      stream.end(buffer);
    });
  }
  const ext  = path.extname(originalname).toLowerCase();
  const name = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
  const dir  = path.join(__dirname, '..', 'public', 'uploads', subfolder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), buffer);
  return { url: `/uploads/${subfolder}/${name}`, cloud_id: null };
}

// ── Upload de imágenes de un coche (compatibilidad) ──────────────
async function upload(buffer, originalname, carId) {
  return uploadToFolder(buffer, originalname, `cars/${carId}`);
}

// ── Upload del logo de la marca ──────────────────────────────────
async function uploadLogo(buffer, originalname) {
  return uploadToFolder(buffer, originalname, 'branding');
}

// ── Eliminar imagen (Cloudinary o disco local) ───────────────────
async function deleteImage(url, cloud_id) {
  if (isCloud && cloud_id) {
    try { await cloudinary.uploader.destroy(cloud_id); } catch (_) {}
    return;
  }
  if (url && url.startsWith('/uploads/')) {
    const fp = path.join(__dirname, '..', 'public', url);
    try { fs.unlinkSync(fp); } catch (_) {}
  }
}

module.exports = { upload, uploadLogo, uploadToFolder, deleteImage };
