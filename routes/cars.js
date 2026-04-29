const express            = require('express');
const { getOne, getAll } = require('../database/db');
const router             = express.Router();

// GET /coches
router.get('/', async (req, res) => {
  const { marca, combustible, transmision, anio_desde, precio_max, orden } = req.query;
  try {
    let sql = `
      SELECT c.*,
        (SELECT url FROM car_images WHERE car_id = c.id AND es_principal = 1 LIMIT 1) AS imagen_principal,
        (SELECT url FROM car_images WHERE car_id = c.id ORDER BY orden LIMIT 1)       AS imagen_primera,
        (SELECT COUNT(*) FROM car_images WHERE car_id = c.id)                              AS num_imagenes
      FROM cars c WHERE c.estado != 'archivado'
    `;
    const args = [];

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

    const [cars, marcas] = await Promise.all([
      getAll(sql, args),
      getAll("SELECT DISTINCT marca FROM cars WHERE estado != 'archivado' ORDER BY marca")
    ]);

    res.render('coches', { title: 'Catálogo de coches', cars, marcas, filters: req.query, total: cars.length });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error interno');
  }
});

// GET /coches/:slug
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
          (SELECT filename FROM car_images WHERE car_id = c.id AND es_principal = 1 LIMIT 1) AS imagen_principal,
          (SELECT filename FROM car_images WHERE car_id = c.id ORDER BY orden LIMIT 1)       AS imagen_primera
        FROM cars c WHERE c.id != ? AND c.marca = ? AND c.estado = 'disponible' LIMIT 3
      `, [Number(car.id), car.marca])
    ]);

    let isFavorite = false;
    if (req.session.user) {
      const fav = await getOne(
        'SELECT id FROM favorites WHERE user_id = ? AND car_id = ?',
        [req.session.user.id, Number(car.id)]
      );
      isFavorite = !!fav;
    }

    res.render('coche', { title: `${car.marca} ${car.modelo} ${car.anio}`, car, images, isFavorite, related });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error interno');
  }
});

module.exports = router;
