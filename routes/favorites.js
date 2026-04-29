const express            = require('express');
const { getOne, getAll, run } = require('../database/db');
const { requireAuth }    = require('../middleware/auth');
const router             = express.Router();

router.use(requireAuth);

// GET /favoritos
router.get('/', async (req, res) => {
  try {
    const cars = await getAll(`
      SELECT c.*,
        (SELECT url FROM car_images WHERE car_id = c.id AND es_principal = 1 LIMIT 1) AS imagen_principal,
        (SELECT url FROM car_images WHERE car_id = c.id ORDER BY orden LIMIT 1)       AS imagen_primera,
        (SELECT COUNT(*) FROM car_images WHERE car_id = c.id)                              AS num_imagenes
      FROM cars c JOIN favorites f ON f.car_id = c.id
      WHERE f.user_id = ? ORDER BY f.created_at DESC
    `, [req.session.user.id]);
    res.render('favoritos', { title: 'Mis favoritos', cars });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error interno');
  }
});

// POST /favoritos/:carId/toggle
router.post('/:carId/toggle', async (req, res) => {
  const carId  = parseInt(req.params.carId);
  const userId = req.session.user.id;
  try {
    const exists = await getOne('SELECT id FROM favorites WHERE user_id = ? AND car_id = ?', [userId, carId]);
    if (exists) {
      await run('DELETE FROM favorites WHERE user_id = ? AND car_id = ?', [userId, carId]);
      return res.json({ favorited: false });
    }
    const carExists = await getOne('SELECT id FROM cars WHERE id = ?', [carId]);
    if (!carExists) return res.status(404).json({ error: 'Coche no encontrado' });
    await run('INSERT OR IGNORE INTO favorites (user_id, car_id) VALUES (?, ?)', [userId, carId]);
    res.json({ favorited: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
