const express            = require('express');
const { getOne, getAll } = require('../database/db');
const router             = express.Router();

// Helper compartido por /coches/nacional, /coches/importacion y /campers
async function listVehicles(req, res, opts = {}) {
  const { fixedCategoria = null, fixedOrigen = null } = opts;
  const { marca, combustible, transmision, anio_desde, precio_max, orden, categoria, origen } = req.query;
  try {
    let sql = `
      SELECT c.*,
        (SELECT url FROM car_images WHERE car_id = c.id AND es_principal = 1 LIMIT 1) AS imagen_principal,
        (SELECT url FROM car_images WHERE car_id = c.id ORDER BY orden LIMIT 1)       AS imagen_primera,
        (SELECT COUNT(*) FROM car_images WHERE car_id = c.id)                         AS num_imagenes
      FROM cars c WHERE c.estado != 'archivado'
    `;
    const args = [];

    const cat = fixedCategoria || categoria;
    if (cat === 'coche' || cat === 'camper') {
      sql += ' AND c.categoria = ?';
      args.push(cat);
    }
    const ori = fixedOrigen || origen;
    if (ori === 'nacional' || ori === 'importacion') {
      sql += ' AND c.origen = ?';
      args.push(ori);
    }
    if (marca)       { sql += ' AND c.marca LIKE ?';     args.push(`%${marca}%`); }
    if (combustible) { sql += ' AND c.combustible = ?';  args.push(combustible); }
    if (transmision) { sql += ' AND c.transmision = ?';  args.push(transmision); }
    if (anio_desde)  { sql += ' AND c.anio >= ?';        args.push(parseInt(anio_desde)); }
    if (precio_max)  { sql += ' AND c.precio <= ?';      args.push(parseFloat(precio_max)); }

    const orderMap = {
      precio_asc: 'c.precio ASC', precio_desc: 'c.precio DESC',
      anio_desc:  'c.anio DESC',  km_asc: 'c.kilometraje ASC', nuevo: 'c.created_at DESC'
    };
    sql += ` ORDER BY c.destacado DESC, ${orderMap[orden] || 'c.created_at DESC'}`;

    // Marcas para el datalist (filtradas por la misma categoría/origen fijos)
    let marcasSql = "SELECT DISTINCT marca FROM cars WHERE estado != 'archivado'";
    const marcasArgs = [];
    if (fixedCategoria) { marcasSql += ' AND categoria = ?'; marcasArgs.push(fixedCategoria); }
    if (fixedOrigen)    { marcasSql += ' AND origen = ?';    marcasArgs.push(fixedOrigen); }
    marcasSql += ' ORDER BY marca';

    const [cars, marcas] = await Promise.all([
      getAll(sql, args),
      getAll(marcasSql, marcasArgs)
    ]);

    let titulo = 'Catálogo';
    if (fixedCategoria === 'camper') titulo = 'Campers y autocaravanas';
    else if (fixedOrigen === 'nacional') titulo = 'Coches nacionales';
    else if (fixedOrigen === 'importacion') titulo = 'Coches de importación';

    res.render('coches', {
      title: titulo,
      cars, marcas,
      filters: req.query,
      total: cars.length,
      fixedCategoria, fixedOrigen
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error interno');
  }
}

// ── GET /coches  → landing con cards de las 4 categorías ────────
router.get('/', async (req, res) => {
  try {
    const [stNacional, stImport, stCamper] = await Promise.all([
      getOne("SELECT COUNT(*) AS n FROM cars WHERE categoria = 'coche'  AND origen = 'nacional'    AND estado = 'disponible'"),
      getOne("SELECT COUNT(*) AS n FROM cars WHERE categoria = 'coche'  AND origen = 'importacion' AND estado = 'disponible'"),
      getOne("SELECT COUNT(*) AS n FROM cars WHERE categoria = 'camper' AND estado = 'disponible'")
    ]);
    res.render('coches-landing', {
      title: 'Catálogo · Cars & Campers',
      stats: {
        nacional:    stNacional?.n || 0,
        importacion: stImport?.n   || 0,
        camper:      stCamper?.n   || 0
      }
    });
  } catch (err) { console.error(err); res.status(500).send('Error interno'); }
});

// ── GET /coches/nacional ─────────────────────────────────────────
router.get('/nacional', (req, res) =>
  listVehicles(req, res, { fixedCategoria: 'coche', fixedOrigen: 'nacional' })
);

// ── GET /coches/importacion ──────────────────────────────────────
router.get('/importacion', (req, res) =>
  listVehicles(req, res, { fixedCategoria: 'coche', fixedOrigen: 'importacion' })
);

// ── /coches/a-la-carta — DEPRECATED, redirige a /servicios ───────
// Mantenemos los dos métodos por compatibilidad con enlaces antiguos
router.get('/a-la-carta', (req, res) => {
  res.redirect(301, '/servicios/vehiculos-a-la-carta');
});
router.post('/a-la-carta', (req, res) => {
  // 307 preserva el método POST y el body
  res.redirect(307, '/servicios/vehiculos-a-la-carta');
});

// ── GET /coches/:slug — detalle (ÚLTIMO porque es dinámica) ──────
router.get('/:slug', async (req, res) => {
  try {
    const car = await getOne(`
      SELECT c.*, (SELECT COUNT(*) FROM car_images WHERE car_id = c.id) AS num_imagenes
      FROM cars c WHERE c.slug = ?
    `, [req.params.slug]);

    if (!car) {
      req.session.flash = { type: 'error', msg: 'Vehículo no encontrado.' };
      return res.redirect('/coches');
    }

    const [images, related] = await Promise.all([
      getAll('SELECT * FROM car_images WHERE car_id = ? ORDER BY es_principal DESC, orden ASC', [Number(car.id)]),
      getAll(`
        SELECT c.*,
          (SELECT url FROM car_images WHERE car_id = c.id AND es_principal = 1 LIMIT 1) AS imagen_principal,
          (SELECT url FROM car_images WHERE car_id = c.id ORDER BY orden LIMIT 1)       AS imagen_primera
        FROM cars c WHERE c.id != ? AND c.categoria = ? AND c.estado = 'disponible' LIMIT 3
      `, [Number(car.id), car.categoria || 'coche'])
    ]);

    res.render('coche', { title: `${car.marca} ${car.modelo} ${car.anio}`, car, images, related });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error interno');
  }
});

module.exports = router;
module.exports.listVehicles = listVehicles;
