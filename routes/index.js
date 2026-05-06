const express          = require('express');
const { getOne, getAll } = require('../database/db');
const router           = express.Router();

router.get('/', async (req, res) => {
  try {
    const featuredCars = await getAll(`
      SELECT c.*,
        (SELECT url FROM car_images WHERE car_id = c.id AND es_principal = 1 LIMIT 1) AS imagen_principal,
        (SELECT url FROM car_images WHERE car_id = c.id ORDER BY orden LIMIT 1)       AS imagen_primera,
        (SELECT COUNT(*) FROM car_images WHERE car_id = c.id)                         AS num_imagenes
      FROM cars c
      WHERE c.estado = 'disponible' AND c.destacado = 1
      ORDER BY c.created_at DESC LIMIT 6
    `);

    const recentCoches = await getAll(`
      SELECT c.*,
        (SELECT url FROM car_images WHERE car_id = c.id AND es_principal = 1 LIMIT 1) AS imagen_principal,
        (SELECT url FROM car_images WHERE car_id = c.id ORDER BY orden LIMIT 1)       AS imagen_primera,
        (SELECT COUNT(*) FROM car_images WHERE car_id = c.id)                         AS num_imagenes
      FROM cars c
      WHERE c.estado = 'disponible' AND c.categoria = 'coche'
      ORDER BY c.created_at DESC LIMIT 3
    `);

    const recentCampers = await getAll(`
      SELECT c.*,
        (SELECT url FROM car_images WHERE car_id = c.id AND es_principal = 1 LIMIT 1) AS imagen_principal,
        (SELECT url FROM car_images WHERE car_id = c.id ORDER BY orden LIMIT 1)       AS imagen_primera,
        (SELECT COUNT(*) FROM car_images WHERE car_id = c.id)                         AS num_imagenes
      FROM cars c
      WHERE c.estado = 'disponible' AND c.categoria = 'camper'
      ORDER BY c.created_at DESC LIMIT 3
    `);

    const [stTotal, stDisp, stCoches, stCampers] = await Promise.all([
      getOne("SELECT COUNT(*) AS n FROM cars"),
      getOne("SELECT COUNT(*) AS n FROM cars WHERE estado = 'disponible'"),
      getOne("SELECT COUNT(*) AS n FROM cars WHERE categoria = 'coche'  AND estado = 'disponible'"),
      getOne("SELECT COUNT(*) AS n FROM cars WHERE categoria = 'camper' AND estado = 'disponible'")
    ]);

    res.render('index', {
      title: 'Cars & Campers — Coches y autocaravanas seleccionados',
      featuredCars,
      recentCoches,
      recentCampers,
      stats: {
        total:      stTotal?.n || 0,
        disponible: stDisp?.n  || 0,
        coches:     stCoches?.n || 0,
        campers:    stCampers?.n || 0
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error interno');
  }
});

router.get('/contacto', (req, res) => {
  res.render('contacto', { title: 'Contacto' });
});

module.exports = router;
