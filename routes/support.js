const express            = require('express');
const { getAll, run }    = require('../database/db');
const { requireAuth }    = require('../middleware/auth');
const router             = express.Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const tickets = await getAll(
      'SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC',
      [req.session.user.id]
    );
    res.render('soporte', { title: 'Soporte', tickets });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error interno');
  }
});

router.post('/', async (req, res) => {
  const { asunto, mensaje } = req.body;
  if (!asunto || !mensaje) {
    req.session.flash = { type: 'error', msg: 'Rellena el asunto y el mensaje.' };
    return res.redirect('/soporte');
  }
  try {
    await run('INSERT INTO support_tickets (user_id, asunto, mensaje) VALUES (?, ?, ?)',
      [req.session.user.id, asunto.trim(), mensaje.trim()]);
    req.session.flash = { type: 'success', msg: 'Tu consulta ha sido enviada. Te responderemos en breve.' };
    res.redirect('/soporte');
  } catch (err) {
    console.error(err);
    req.session.flash = { type: 'error', msg: 'Error al enviar la consulta.' };
    res.redirect('/soporte');
  }
});

module.exports = router;
