const express            = require('express');
const { getOne, getAll } = require('../database/db');
const router             = express.Router();

// Helper compartido por /coches y /campers
async function listVehicles(req, res, fixedCategoria) {
  const { marca, combustible, transmision, anio_desde, precio_max, orden, categoria } = req.query;
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

    const baseMarcasQuery = fixedCategoria
      ? "SELECT DISTINCT marca FROM cars WHERE estado != 'archivado' AND categoria = ? ORDER BY marca"
      : "SELECT DISTINCT marca FROM cars WHERE estado != 'archivado' ORDER BY marca";

    const [cars, marcas] = await Promise.all([
      getAll(sql, args),
      getAll(baseMarcasQuery, fixedCategoria ? [fixedCategoria] : [])
    ]);

    const titulo = fixedCategoria === 'camper'
      ? 'Catálogo de campers y autocaravanas'
      : (fixedCategoria === 'coche' ? 'Catálogo de coches' : 'Catálogo completo');

    res.render('coches', {
      title: titulo,
      cars, marcas,
      filters: req.query,
      total: cars.length,
      fixedCategoria: fixedCategoria || null
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error interno');
  }
}

// GET /coches  – listado general con filtro opcional por categoría
router.get('/', (req, res) => listVehicles(req, res, null));

// GET /coches/:slug – detalle
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
