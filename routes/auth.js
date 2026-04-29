const express        = require('express');
const bcrypt         = require('bcryptjs');
const { getOne, run } = require('../database/db');
const router         = express.Router();

// GET /auth/login
router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login', { title: 'Iniciar sesión' });
});

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    req.session.flash = { type: 'error', msg: 'Rellena todos los campos.' };
    return res.redirect('/auth/login');
  }
  try {
    const user = await getOne('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (!user || !bcrypt.compareSync(password, user.password)) {
      req.session.flash = { type: 'error', msg: 'Email o contraseña incorrectos.' };
      return res.redirect('/auth/login');
    }
    req.session.user = { id: Number(user.id), nombre: user.nombre, email: user.email, role: user.role };
    req.session.flash = { type: 'success', msg: `Bienvenido, ${user.nombre.split(' ')[0]}!` };
    const redirect = req.query.redirect || (user.role === 'admin' ? '/admin' : '/');
    res.redirect(redirect);
  } catch (err) {
    console.error(err);
    req.session.flash = { type: 'error', msg: 'Error al iniciar sesión.' };
    res.redirect('/auth/login');
  }
});

// GET /auth/registro
router.get('/registro', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('registro', { title: 'Crear cuenta' });
});

// POST /auth/registro
router.post('/registro', async (req, res) => {
  const { nombre, email, password, password2 } = req.body;
  if (!nombre || !email || !password || !password2) {
    req.session.flash = { type: 'error', msg: 'Rellena todos los campos.' };
    return res.redirect('/auth/registro');
  }
  if (password !== password2) {
    req.session.flash = { type: 'error', msg: 'Las contraseñas no coinciden.' };
    return res.redirect('/auth/registro');
  }
  if (password.length < 8) {
    req.session.flash = { type: 'error', msg: 'La contraseña debe tener al menos 8 caracteres.' };
    return res.redirect('/auth/registro');
  }
  try {
    const exists = await getOne('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (exists) {
      req.session.flash = { type: 'error', msg: 'Ya existe una cuenta con ese email.' };
      return res.redirect('/auth/registro');
    }
    const hash   = bcrypt.hashSync(password, 10);
    const result = await run('INSERT INTO users (nombre, email, password) VALUES (?, ?, ?)',
      [nombre.trim(), email.trim().toLowerCase(), hash]);
    req.session.user = { id: result.lastInsertRowid, nombre: nombre.trim(), email: email.trim().toLowerCase(), role: 'user' };
    req.session.flash = { type: 'success', msg: '¡Cuenta creada! Bienvenido a MotorImport.' };
    res.redirect('/');
  } catch (err) {
    console.error(err);
    req.session.flash = { type: 'error', msg: 'Error al crear la cuenta.' };
    res.redirect('/auth/registro');
  }
});

// GET /auth/logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
