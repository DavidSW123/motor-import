require('dotenv').config();
const express  = require('express');
const session  = require('express-session');
const path     = require('path');
const { initDB, NEEDS_SETUP } = require('./database/db');

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

// ── Página de setup si falta Turso en producción ─────────────────
if (NEEDS_SETUP) {
  app.use((req, res) => {
    res.status(503).send(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Configuración pendiente · Cars & Campers</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>
      body{margin:0;background:#08090c;color:#e6e7ea;font:16px/1.6 system-ui,-apple-system,sans-serif;padding:2rem;display:flex;align-items:center;justify-content:center;min-height:100vh}
      .box{max-width:640px;background:#10131a;border:1px solid #1f2533;border-radius:14px;padding:2.5rem}
      h1{margin:0 0 .5rem;font-size:1.6rem;color:#c9a227}
      .sub{color:#9aa1ad;margin:0 0 1.75rem}
      ol{padding-left:1.4rem;color:#cfd3db}
      ol li{margin-bottom:.85rem}
      code,kbd{background:#1c2230;color:#c9a227;padding:.15rem .45rem;border-radius:4px;font-size:.92em;font-family:ui-monospace,Menlo,monospace}
      a{color:#c9a227}
      .tag{display:inline-block;background:rgba(201,162,39,.12);color:#c9a227;border:1px solid rgba(201,162,39,.3);padding:.25rem .7rem;border-radius:999px;font-size:.78rem;letter-spacing:.04em;text-transform:uppercase;margin-bottom:1rem}
      .vars{background:#0c0f15;border:1px solid #1f2533;border-radius:8px;padding:1rem 1.25rem;margin:1rem 0}
      .vars div{padding:.4rem 0;border-bottom:1px dashed #1f2533;display:flex;gap:1rem}
      .vars div:last-child{border:none}
      .vars b{color:#c9a227;min-width:200px;font-family:ui-monospace,Menlo,monospace;font-size:.88rem}
      .footer-note{margin-top:1.75rem;padding-top:1.25rem;border-top:1px solid #1f2533;font-size:.85rem;color:#7d838f}
    </style></head><body>
    <div class="box">
      <span class="tag">⚙️ Configuración pendiente</span>
      <h1>Falta configurar Turso</h1>
      <p class="sub">La aplicación necesita una base de datos remota para funcionar en Vercel. Sigue estos pasos:</p>
      <ol>
        <li>Crea cuenta en <a href="https://app.turso.tech" target="_blank" rel="noopener">app.turso.tech</a> (es gratis).</li>
        <li><strong>Create database</strong> → nombre <code>cars-and-campers</code> → región Madrid o Frankfurt.</li>
        <li>En la página de la BBDD: copia la <strong>Database URL</strong> (empieza por <code>libsql://…</code>).</li>
        <li>Pestaña <strong>Tokens</strong> → <em>Create token</em> → copia el token (cadena larga).</li>
        <li>En Vercel: tu proyecto → <strong>Settings → Environment Variables</strong> → añade:
          <div class="vars">
            <div><b>TURSO_DATABASE_URL</b><span>la URL libsql://…</span></div>
            <div><b>TURSO_AUTH_TOKEN</b><span>el token largo</span></div>
            <div><b>SESSION_SECRET</b><span>cualquier cadena aleatoria</span></div>
          </div>
        </li>
        <li><strong>Deployments</strong> → último → menú <kbd>⋯</kbd> → <strong>Redeploy</strong>.</li>
      </ol>
      <p class="footer-note">Una vez configurado, las tablas se crean automáticamente en el primer arranque. Para imágenes en producción, configura también las variables <code>CLOUDINARY_*</code>.</p>
    </div>
    </body></html>`);
  });
} else {

// ── Rutas ────────────────────────────────────────────────────────
app.use('/',         require('./routes/index'));
app.use('/coches',   require('./routes/cars'));
app.use('/campers',  require('./routes/campers'));
app.use('/admin',    require('./routes/admin'));

}

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
