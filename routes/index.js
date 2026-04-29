const express          = require('express');
const { getOne, getAll } = require('../database/db');
const router           = express.Router();

router.get('/', async (req, res) => {
  try {
    const featuredCars = await getAll(`
      SELECT c.*,
        (SELECT url FROM car_images WHERE car_id = c.id AND es_principal = 1 LIMIT 1) AS imagen_principal,
        (SELECT url FROM car_images WHERE car_id = c.id ORDER BY orden LIMIT 1)       AS imagen_primera,
        (SELECT COUNT(*) FROM car_images WHERE car_id = c.id)                              AS num_imagenes
      FROM cars c
      WHERE c.estado = 'disponible' AND c.destacado = 1
      ORDER BY c.created_at DESC LIMIT 6
    `);

    const recentCars = await getAll(`
      SELECT c.*,
        (SELECT url FROM car_images WHERE car_id = c.id AND es_principal = 1 LIMIT 1) AS imagen_principal,
        (SELECT url FROM car_images WHERE car_id = c.id ORDER BY orden LIMIT 1)       AS imagen_primera,
        (SELECT COUNT(*) FROM car_images WHERE car_id = c.id)                              AS num_imagenes
      FROM cars c
      WHERE c.estado = 'disponible'
      ORDER BY c.created_at DESC LIMIT 3
    `);

    const [stTotal, stDisp, stVend, stUsers] = await Promise.all([
      getOne("SELECT COUNT(*) AS n FROM cars"),
      getOne("SELECT COUNT(*) AS n FROM cars WHERE estado = 'disponible'"),
      getOne("SELECT COUNT(*) AS n FROM cars WHERE estado = 'vendido'"),
      getOne("SELECT COUNT(*) AS n FROM users WHERE role = 'user'")
    ]);

    res.render('index', {
      title: 'MotorImport - Coches importados con transparencia total',
      featuredCars,
      recentCars,
      stats: {
        total:      stTotal?.n || 0,
        disponible: stDisp?.n  || 0,
        vendido:    stVend?.n  || 0,
        usuarios:   stUsers?.n || 0
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error interno');
  }
});

module.exports = router;
