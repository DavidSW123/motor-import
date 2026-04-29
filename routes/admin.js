const express            = require('express');
const path               = require('path');
const slugify            = require('slugify');
const { getOne, getAll, run } = require('../database/db');
const { requireAdmin }   = require('../middleware/auth');
const upload             = require('../middleware/upload');
const { upload: uploadImg, deleteImage } = require('../utils/imageUpload');
const router             = express.Router();

router.use(requireAdmin);

function makeSlug(marca, modelo, anio) {
  const base = slugify(`${marca} ${modelo} ${anio}`, { lower: true, strict: true });
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Dashboard ─────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const [stDisp, stRes, stVend, stTotal, stUsers, stTickets, recentCars, recentTickets] = await Promise.all([
      getOne("SELECT COUNT(*) AS n FROM cars WHERE estado = 'disponible'"),
      getOne("SELECT COUNT(*) AS n FROM cars WHERE estado = 'reservado'"),
      getOne("SELECT COUNT(*) AS n FROM cars WHERE estado = 'vendido'"),
      getOne("SELECT COUNT(*) AS n FROM cars"),
      getOne("SELECT COUNT(*) AS n FROM users WHERE role = 'user'"),
      getOne("SELECT COUNT(*) AS n FROM support_tickets WHERE estado = 'abierto'"),
      getAll(`SELECT c.*, (SELECT url FROM car_images WHERE car_id = c.id ORDER BY orden LIMIT 1) AS imagen_primera
              FROM cars c ORDER BY c.created_at DESC LIMIT 5`),
      getAll(`SELECT t.*, u.nombre AS user_nombre FROM support_tickets t
              JOIN users u ON u.id = t.user_id ORDER BY t.created_at DESC LIMIT 5`)
    ]);
    const stats = {
      disponible: stDisp?.n || 0, reservado: stRes?.n || 0, vendido: stVend?.n || 0,
      total: stTotal?.n || 0, usuarios: stUsers?.n || 0, tickets: stTickets?.n || 0
    };
    res.render('admin/dashboard', { title: 'Dashboard', stats, recentCars, recentTickets });
  } catch (err) { console.error(err); res.status(500).send('Error interno'); }
});

// ── Coches: listado ───────────────────────────────────────────────
router.get('/coches', async (req, res) => {
  try {
    const cars = await getAll(`
      SELECT c.*,
        (SELECT url FROM car_images WHERE car_id = c.id ORDER BY orden LIMIT 1) AS imagen_primera,
        (SELECT COUNT(*) FROM car_images WHERE car_id = c.id)                   AS num_imagenes
      FROM cars c ORDER BY c.created_at DESC
    `);
    res.render('admin/coches', { title: 'Gestión de coches', cars });
  } catch (err) { console.error(err); res.status(500).send('Error interno'); }
});

// ── Coches: nuevo formulario ──────────────────────────────────────
router.get('/coches/nuevo', (req, res) => {
  res.render('admin/coche-form', { title: 'Añadir coche', car: null, images: [] });
});

// ── Coches: crear ─────────────────────────────────────────────────
router.post('/coches', upload.array('imagenes', 15), async (req, res) => {
  const { marca, modelo, anio, precio, kilometraje, combustible, transmision,
          pais_origen, color, potencia, puertas, descripcion, estado, destacado } = req.body;
  if (!marca || !modelo || !anio || !precio || !kilometraje || !combustible || !transmision || !pais_origen) {
    req.session.flash = { type: 'error', msg: 'Rellena todos los campos obligatorios.' };
    return res.redirect('/admin/coches/nuevo');
  }
  try {
    const slug   = makeSlug(marca, modelo, anio);
    const result = await run(`
      INSERT INTO cars (marca, modelo, anio, precio, kilometraje, combustible, transmision,
        pais_origen, color, potencia, puertas, descripcion, estado, destacado, slug)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [marca, modelo, parseInt(anio), parseFloat(precio), parseInt(kilometraje),
        combustible, transmision, pais_origen, color || null,
        potencia ? parseInt(potencia) : null, parseInt(puertas) || 4,
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
    req.session.flash = { type: 'success', msg: 'Coche añadido correctamente.' };
    res.redirect(`/admin/coches/${carId}/editar`);
  } catch (err) { console.error(err); req.session.flash = { type: 'error', msg: 'Error al crear el coche.' }; res.redirect('/admin/coches/nuevo'); }
});

// ── Coches: editar formulario ─────────────────────────────────────
router.get('/coches/:id/editar', async (req, res) => {
  try {
    const car    = await getOne('SELECT * FROM cars WHERE id = ?', [req.params.id]);
    if (!car) { req.session.flash = { type: 'error', msg: 'Coche no encontrado.' }; return res.redirect('/admin/coches'); }
    const images = await getAll('SELECT * FROM car_images WHERE car_id = ? ORDER BY es_principal DESC, orden ASC', [Number(car.id)]);
    res.render('admin/coche-form', { title: `Editar: ${car.marca} ${car.modelo}`, car, images });
  } catch (err) { console.error(err); res.status(500).send('Error interno'); }
});

// ── Coches: actualizar ────────────────────────────────────────────
router.post('/coches/:id', async (req, res) => {
  const { marca, modelo, anio, precio, kilometraje, combustible, transmision,
          pais_origen, color, potencia, puertas, descripcion, estado, destacado } = req.body;
  try {
    await run(`UPDATE cars SET marca=?,modelo=?,anio=?,precio=?,kilometraje=?,combustible=?,
      transmision=?,pais_origen=?,color=?,potencia=?,puertas=?,descripcion=?,estado=?,destacado=? WHERE id=?`,
      [marca, modelo, parseInt(anio), parseFloat(precio), parseInt(kilometraje),
       combustible, transmision, pais_origen, color || null,
       potencia ? parseInt(potencia) : null, parseInt(puertas) || 4,
       descripcion || null, estado, destacado ? 1 : 0, req.params.id]);
    req.session.flash = { type: 'success', msg: 'Coche actualizado.' };
    res.redirect(`/admin/coches/${req.params.id}/editar`);
  } catch (err) { console.error(err); req.session.flash = { type: 'error', msg: 'Error al actualizar.' }; res.redirect(`/admin/coches/${req.params.id}/editar`); }
});

// ── Coches: eliminar ──────────────────────────────────────────────
router.post('/coches/:id/eliminar', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const images = await getAll('SELECT url, cloud_id FROM car_images WHERE car_id = ?', [id]);
    await Promise.all(images.map(img => deleteImage(img.url, img.cloud_id)));
    await run('DELETE FROM car_images WHERE car_id = ?', [id]);
    await run('DELETE FROM favorites WHERE car_id = ?', [id]);
    await run('DELETE FROM cars WHERE id = ?', [id]);
  } catch (err) { console.error(err); }
  req.session.flash = { type: 'success', msg: 'Coche eliminado.' };
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

// ── Usuarios ──────────────────────────────────────────────────────
router.get('/usuarios', async (req, res) => {
  try {
    const users = await getAll(`
      SELECT u.*,
        (SELECT COUNT(*) FROM favorites       WHERE user_id = u.id) AS num_favoritos,
        (SELECT COUNT(*) FROM support_tickets WHERE user_id = u.id) AS num_tickets
      FROM users u ORDER BY u.created_at DESC
    `);
    res.render('admin/usuarios', { title: 'Usuarios', users });
  } catch (err) { console.error(err); res.status(500).send('Error interno'); }
});

// ── Tickets ───────────────────────────────────────────────────────
router.get('/tickets', async (req, res) => {
  try {
    const tickets = await getAll(`
      SELECT t.*, u.nombre AS user_nombre, u.email AS user_email
      FROM support_tickets t JOIN users u ON u.id = t.user_id
      ORDER BY CASE t.estado WHEN 'abierto' THEN 0 WHEN 'en_proceso' THEN 1 ELSE 2 END, t.created_at DESC
    `);
    res.render('admin/tickets', { title: 'Tickets de soporte', tickets });
  } catch (err) { console.error(err); res.status(500).send('Error interno'); }
});

router.post('/tickets/:id/responder', async (req, res) => {
  const { respuesta, estado } = req.body;
  if (!respuesta) { req.session.flash = { type: 'error', msg: 'Escribe una respuesta.' }; return res.redirect('/admin/tickets'); }
  await run('UPDATE support_tickets SET respuesta=?,estado=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [respuesta.trim(), estado || 'cerrado', req.params.id]);
  req.session.flash = { type: 'success', msg: 'Respuesta enviada.' };
  res.redirect('/admin/tickets');
});

module.exports = router;
