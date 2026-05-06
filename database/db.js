const bcrypt = require('bcryptjs');
const path   = require('path');
const fs     = require('fs');

const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const hasTurso     = !!process.env.TURSO_DATABASE_URL;
const NEEDS_SETUP  = isServerless && !hasTurso;

let client = null;

if (!NEEDS_SETUP) {
  const { createClient } = require('@libsql/client');
  if (hasTurso) {
    client = createClient({
      url:       process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN
    });
  } else {
    const DB_DIR = path.join(__dirname);
    fs.mkdirSync(DB_DIR, { recursive: true });
    const dbPath = path.join(DB_DIR, 'cars-and-campers.sqlite').replace(/\\/g, '/');
    client = createClient({ url: `file:${dbPath}` });
  }
}

// ── Query helpers ─────────────────────────────────────────────────
async function getOne(sql, args = []) {
  if (NEEDS_SETUP) throw new Error('NEEDS_TURSO_SETUP');
  const r = await client.execute({ sql, args });
  return r.rows[0] || null;
}

async function getAll(sql, args = []) {
  if (NEEDS_SETUP) throw new Error('NEEDS_TURSO_SETUP');
  const r = await client.execute({ sql, args });
  return r.rows;
}

async function run(sql, args = []) {
  if (NEEDS_SETUP) throw new Error('NEEDS_TURSO_SETUP');
  const r = await client.execute({ sql, args });
  return { lastInsertRowid: Number(r.lastInsertRowid), rowsAffected: r.rowsAffected };
}

// ── DB init ───────────────────────────────────────────────────────
async function initDB() {
  if (NEEDS_SETUP) return;
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre     TEXT    NOT NULL,
      email      TEXT    UNIQUE NOT NULL,
      password   TEXT    NOT NULL,
      role       TEXT    DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS cars (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      categoria    TEXT    DEFAULT 'coche',
      marca        TEXT    NOT NULL,
      modelo       TEXT    NOT NULL,
      anio         INTEGER NOT NULL,
      precio       REAL    NOT NULL,
      kilometraje  INTEGER NOT NULL,
      combustible  TEXT    NOT NULL,
      transmision  TEXT    NOT NULL,
      pais_origen  TEXT    NOT NULL,
      color        TEXT,
      potencia     INTEGER,
      puertas      INTEGER DEFAULT 4,
      plazas       INTEGER,
      descripcion  TEXT,
      estado       TEXT    DEFAULT 'disponible',
      destacado    INTEGER DEFAULT 0,
      slug         TEXT    UNIQUE,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS car_images (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      car_id       INTEGER NOT NULL,
      url          TEXT    NOT NULL,
      cloud_id     TEXT,
      orden        INTEGER DEFAULT 0,
      es_principal INTEGER DEFAULT 0,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  for (const sql of tables) {
    await client.execute(sql);
  }

  // ── Migración: añadir columna `categoria` a tablas antiguas ──
  try {
    const cols = await getAll('PRAGMA table_info(cars)');
    if (!cols.some(c => c.name === 'categoria')) {
      await run("ALTER TABLE cars ADD COLUMN categoria TEXT DEFAULT 'coche'");
    }
    if (!cols.some(c => c.name === 'plazas')) {
      await run('ALTER TABLE cars ADD COLUMN plazas INTEGER');
    }
  } catch (_) {}

  // ── Crear los dos administradores por defecto ─────────────────
  const admins = [
    {
      nombre:   process.env.ADMIN1_NOMBRE   || 'Administrador 1',
      email:    process.env.ADMIN1_EMAIL    || 'admin1@carsandcampers.es',
      password: process.env.ADMIN1_PASSWORD || 'Admin1234!'
    },
    {
      nombre:   process.env.ADMIN2_NOMBRE   || 'Administrador 2',
      email:    process.env.ADMIN2_EMAIL    || 'admin2@carsandcampers.es',
      password: process.env.ADMIN2_PASSWORD || 'Admin1234!'
    }
  ];

  for (const a of admins) {
    const exists = await getOne('SELECT id FROM users WHERE email = ?', [a.email]);
    if (!exists) {
      const hash = bcrypt.hashSync(a.password, 10);
      await run('INSERT INTO users (nombre, email, password, role) VALUES (?, ?, ?, ?)',
        [a.nombre, a.email, hash, 'admin']);
      console.log(`🔐 Admin creado: ${a.email}`);
    }
  }
}

module.exports = { client, getOne, getAll, run, initDB, NEEDS_SETUP };
