const express            = require('express');
const bcrypt             = require('bcryptjs');
const slugify            = require('slugify');
const { getOne, getAll, run } = require('../database/db');
const { requireAdmin }   = require('../middleware/auth');
const upload             = require('../middleware/upload');
const { upload: uploadImg, deleteImage } = require('../utils/imageUpload');
const router             = express.Router();

function makeSlug(marca, modelo, anio) {
  const base = slugify(`${marca} ${modelo} ${anio}`, { lower: true, strict: true });
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

// ══════════════════════════════════════════════════════════════════
// AUTH (login / logout) – fuera del middleware requireAdmin
// ══════════════════════════════════════════════════════════════════
router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/admin');
  res.render('login', { title: 'Acceso administradores' });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    req.session.flash = { type: 'error', msg: 'Rellena todos los campos.' };
    return res.redirect('/admin/login');
  }
  try {
    const user = await getOne('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (!user || !bcrypt.compareSync(password, user.password) || user.role !== 'admin') {
      req.session.flash = { type: 'error', msg: 'Credenciales incorrectas.' };
      return res.redirect('/admin/login');
    }
    req.session.user = { id: Number(user.id), nombre: user.nombre, email: user.email, role: user.role };
    req.session.flash = { type: 'success', msg: `Bienvenido, ${user.nombre.split(' ')[0]}!` };
    res.redirect(req.query.redirect || '/admin');
  } catch (err) {
    console.error(err);
    req.session.flash = { type: 'error', msg: 'Error al iniciar sesión.' };
    res.redirect('/admin/login');
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ══════════════════════════════════════════════════════════════════
// A partir de aquí: solo administradores
// ══════════════════════════════════════════════════════════════════
router.use(requireAdmin);

// ── Dashboard ─────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const [stDisp, stRes, stVend, stTotal, stCoches, stCampers, stDest, recentCars] = await Promise.all([
      getOne("SELECT COUNT(*) AS n FROM cars WHERE estado = 'disponible'"),
      getOne("SELECT COUNT(*) AS n FROM cars WHERE estado = 'reservado'"),
      getOne("SELECT COUNT(*) AS n FROM cars WHERE estado = 'vendido'"),
      getOne("SELECT COUNT(*) AS n FROM cars"),
      getOne("SELECT COUNT(*) AS n FROM cars WHERE categoria = 'coche'"),
      getOne("SELECT COUNT(*) AS n FROM cars WHERE categoria = 'camper'"),
      getOne("SELECT COUNT(*) AS n FROM cars WHERE destacado = 1"),
      getAll(`SELECT c.*, (SELECT url FROM car_images WHERE car_id = c.id ORDER BY orden LIMIT 1) AS imagen_primera
              FROM cars c ORDER BY c.created_at DESC LIMIT 5`)
    ]);
    const stats = {
      disponible: stDisp?.n || 0, reservado: stRes?.n || 0, vendido: stVend?.n || 0,
      total: stTotal?.n || 0, coches: stCoches?.n || 0, campers: stCampers?.n || 0, destacados: stDest?.n || 0
    };
    res.render('admin/dashboard', { title: 'Dashboard', stats, recentCars });
  } catch (err) { console.error(err); res.status(500).send('Error interno'); }
});

// ── Vehículos: listado ────────────────────────────────────────────
router.get('/coches', async (req, res) => {
  try {
    const cars = await getAll(`
      SELECT c.*,
        (SELECT url FROM car_images WHERE car_id = c.id ORDER BY orden LIMIT 1) AS imagen_primera,
        (SELECT COUNT(*) FROM car_images WHERE car_id = c.id)                   AS num_imagenes
      FROM cars c ORDER BY c.created_at DESC
    `);
    res.render('admin/coches', { title: 'Gestión de vehículos', cars });
  } catch (err) { console.error(err); res.status(500).send('Error interno'); }
});

// ── Vehículos: nuevo formulario ───────────────────────────────────
router.get('/coches/nuevo', (req, res) => {
  res.render('admin/coche-form', { title: 'Añadir vehículo', car: null, images: [] });
});

// ── Vehículos: crear ──────────────────────────────────────────────
router.post('/coches', upload.array('imagenes', 15), async (req, res) => {
  const { categoria, marca, modelo, anio, precio, kilometraje, combustible, transmision,
          pais_origen, color, potencia, puertas, plazas, descripcion, estado, destacado } = req.body;
  if (!marca || !modelo || !anio || !precio || !kilometraje || !combustible || !transmision || !pais_origen) {
    req.session.flash = { type: 'error', msg: 'Rellena todos los campos obligatorios.' };
    return res.redirect('/admin/coches/nuevo');
  }
  try {
    const slug   = makeSlug(marca, modelo, anio);
    const result = await run(`
      INSERT INTO cars (categoria, marca, modelo, anio, precio, kilometraje, combustible, transmision,
        pais_origen, color, potencia, puertas, plazas, descripcion, estado, destacado, slug)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [categoria === 'camper' ? 'camper' : 'coche',
        marca, modelo, parseInt(anio), parseFloat(precio), parseInt(kilometraje),
        combustible, transmision, pais_origen, color || null,
        potencia ? parseInt(potencia) : null, parseInt(puertas) || 4,
        plazas ? parseInt(plazas) : null,
        descripcion || null, estado || 'disponible', destacado ? 1 : 0, slug]);

    const carId = result.lastInsertRowid;

    if (req.files?.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const { url, cloud_id } = await uploadImg(file.buffer, file.originalname, carId);
        await run('INSERT INTO car_images (car_id, url, cloud_id, orden, es_principal) VALUES (?, ?, ?, ?, ?)',
          [carId, url, cloud_id, i, i === 0 ? 1 : 0]);
      }
    }
    req.session.flash = { type: 'success', msg: 'Vehículo añadido correctamente.' };
    res.redirect(`/admin/coches/${carId}/editar`);
  } catch (err) { console.error(err); req.session.flash = { type: 'error', msg: 'Error al crear el vehículo.' }; res.redirect('/admin/coches/nuevo'); }
});

// ── Vehículos: editar formulario ──────────────────────────────────
router.get('/coches/:id/editar', async (req, res) => {
  try {
    const car    = await getOne('SELECT * FROM cars WHERE id = ?', [req.params.id]);
    if (!car) { req.session.flash = { type: 'error', msg: 'Vehículo no encontrado.' }; return res.redirect('/admin/coches'); }
    const images = await getAll('SELECT * FROM car_images WHERE car_id = ? ORDER BY es_principal DESC, orden ASC', [Number(car.id)]);
    res.render('admin/coche-form', { title: `Editar: ${car.marca} ${car.modelo}`, car, images });
  } catch (err) { console.error(err); res.status(500).send('Error interno'); }
});

// ── Vehículos: actualizar ─────────────────────────────────────────
router.post('/coches/:id', async (req, res) => {
  const { categoria, marca, modelo, anio, precio, kilometraje, combustible, transmision,
          pais_origen, color, potencia, puertas, plazas, descripcion, estado, destacado } = req.body;
  try {
    await run(`UPDATE cars SET categoria=?,marca=?,modelo=?,anio=?,precio=?,kilometraje=?,combustible=?,
      transmision=?,pais_origen=?,color=?,potencia=?,puertas=?,plazas=?,descripcion=?,estado=?,destacado=? WHERE id=?`,
      [categoria === 'camper' ? 'camper' : 'coche',
       marca, modelo, parseInt(anio), parseFloat(precio), parseInt(kilometraje),
       combustible, transmision, pais_origen, color || null,
       potencia ? parseInt(potencia) : null, parseInt(puertas) || 4,
       plazas ? parseInt(plazas) : null,
       descripcion || null, estado, destacado ? 1 : 0, req.params.id]);
    req.session.flash = { type: 'success', msg: 'Vehículo actualizado.' };
    res.redirect(`/admin/coches/${req.params.id}/editar`);
  } catch (err) { console.error(err); req.session.flash = { type: 'error', msg: 'Error al actualizar.' }; res.redirect(`/admin/coches/${req.params.id}/editar`); }
});

// ── Vehículos: eliminar ───────────────────────────────────────────
router.post('/coches/:id/eliminar', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const images = await getAll('SELECT url, cloud_id FROM car_images WHERE car_id = ?', [id]);
    await Promise.all(images.map(img => deleteImage(img.url, img.cloud_id)));
    await run('DELETE FROM car_images WHERE car_id = ?', [id]);
    await run('DELETE FROM cars WHERE id = ?', [id]);
  } catch (err) { console.error(err); }
  req.session.flash = { type: 'success', msg: 'Vehículo eliminado.' };
  res.redirect('/admin/coches');
});

// ── Imágenes: subir ───────────────────────────────────────────────
router.post('/coches/:id/imagenes', upload.array('imagenes', 15), async (req, res) => {
  const carId = parseInt(req.params.id);
  const count = await getOne('SELECT COUNT(*) AS n FROM car_images WHERE car_id = ?', [carId]);
  const current = count?.n || 0;
  if (!req.files?.length) {
    req.session.flash = { type: 'error', msg: 'No se seleccionaron imágenes.' };
    return res.redirect(`/admin/coches/${carId}/editar`);
  }
  const canAdd = Math.max(0, 15 - current);
  const toAdd  = req.files.slice(0, canAdd);
  for (let i = 0; i < toAdd.length; i++) {
    const file = toAdd[i];
    const { url, cloud_id } = await uploadImg(file.buffer, file.originalname, carId);
    await run('INSERT INTO car_images (car_id, url, cloud_id, orden, es_principal) VALUES (?, ?, ?, ?, ?)',
      [carId, url, cloud_id, current + i, current === 0 && i === 0 ? 1 : 0]);
  }
  req.session.flash = { type: 'success', msg: `${toAdd.length} imagen(es) añadida(s).` };
  res.redirect(`/admin/coches/${carId}/editar`);
});

// ── Imágenes: eliminar ────────────────────────────────────────────
router.post('/imagenes/:imageId/eliminar', async (req, res) => {
  const img = await getOne('SELECT * FROM car_images WHERE id = ?', [req.params.imageId]);
  if (!img) return res.redirect('/admin/coches');
  await deleteImage(img.url, img.cloud_id);
  await run('DELETE FROM car_images WHERE id = ?', [Number(img.id)]);
  if (img.es_principal) {
    const next = await getOne('SELECT id FROM car_images WHERE car_id = ? ORDER BY orden LIMIT 1', [Number(img.car_id)]);
    if (next) await run('UPDATE car_images SET es_principal = 1 WHERE id = ?', [Number(next.id)]);
  }
  req.session.flash = { type: 'success', msg: 'Imagen eliminada.' };
  res.redirect(`/admin/coches/${img.car_id}/editar`);
});

// ── Imágenes: marcar principal ────────────────────────────────────
router.post('/imagenes/:imageId/principal', async (req, res) => {
  const img = await getOne('SELECT * FROM car_images WHERE id = ?', [req.params.imageId]);
  if (!img) return res.redirect('/admin/coches');
  await run('UPDATE car_images SET es_principal = 0 WHERE car_id = ?', [Number(img.car_id)]);
  await run('UPDATE car_images SET es_principal = 1 WHERE id = ?', [Number(img.id)]);
  req.session.flash = { type: 'success', msg: 'Imagen principal actualizada.' };
  res.redirect(`/admin/coches/${img.car_id}/editar`);
});

// ── Administradores ───────────────────────────────────────────────
router.get('/usuarios', async (req, res) => {
  try {
    const users = await getAll(`SELECT id, nombre, email, role, created_at FROM users ORDER BY created_at ASC`);
    res.render('admin/usuarios', { title: 'Administradores', users });
  } catch (err) { console.error(err); res.status(500).send('Error interno'); }
});

router.post('/usuarios/:id/password', async (req, res) => {
  const { password, password2 } = req.body;
  if (!password || password.length < 8) {
    req.session.flash = { type: 'error', msg: 'La contraseña debe tener al menos 8 caracteres.' };
    return res.redirect('/admin/usuarios');
  }
  if (password !== password2) {
    req.session.flash = { type: 'error', msg: 'Las contraseñas no coinciden.' };
    return res.redirect('/admin/usuarios');
  }
  const hash = bcrypt.hashSync(password, 10);
  await run('UPDATE users SET password = ? WHERE id = ?', [hash, req.params.id]);
  req.session.flash = { type: 'success', msg: 'Contraseña actualizada.' };
  res.redirect('/admin/usuarios');
});

module.exports = router;
