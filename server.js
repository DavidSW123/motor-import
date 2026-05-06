require('dotenv').config();
const express  = require('express');
const session  = require('express-session');
const path     = require('path');
const { initDB } = require('./database/db');

const app  = express();
const PORT = process.env.PORT || 4000;

// ── View engine ──────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── Middlewares ──────────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Sesión ───────────────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'cars-and-campers-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
}));

// ── DB ready gate (esperar a initDB antes de servir) ─────────────
let dbReady = false;
const dbInit = initDB().then(() => { dbReady = true; }).catch(err => {
  console.error('Error al inicializar la base de datos:', err);
});
app.use(async (req, res, next) => {
  if (!dbReady) {
    try { await dbInit; } catch (err) { return res.status(500).send('Error al inicializar la base de datos.'); }
  }
  next();
});

// ── Locals globales ──────────────────────────────────────────────
app.use((req, res, next) => {
  res.locals.user        = req.session.user || null;
  res.locals.currentPath = req.path;
  if (req.session.flash) {
    res.locals.flash = req.session.flash;
    delete req.session.flash;
  } else {
    res.locals.flash = null;
  }
  next();
});

// ── Rutas ────────────────────────────────────────────────────────
app.use('/',         require('./routes/index'));
app.use('/coches',   require('./routes/cars'));
app.use('/campers',  require('./routes/campers'));
app.use('/admin',    require('./routes/admin'));

// ── 404 ──────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('404', { title: 'Página no encontrada' });
});

// ── Error global ─────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Error interno del servidor');
});

// ── Arranque ─────────────────────────────────────────────────────
if (require.main === module) {
  dbInit.then(() => {
    app.listen(PORT, () => {
      console.log(`\n🚐 Cars & Campers arrancado en http://localhost:${PORT}\n`);
    });
  });
}

module.exports = app;
