const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');
const path   = require('path');
const fs     = require('fs');

let client;
if (process.env.TURSO_DATABASE_URL) {
  client = createClient({
    url:       process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });
} else {
  const DB_DIR = path.join(__dirname);
  fs.mkdirSync(DB_DIR, { recursive: true });
  const dbPath = path.join(DB_DIR, 'motorimport.sqlite').replace(/\\/g, '/');
  client = createClient({ url: `file:${dbPath}` });
}

// ── Query helpers ─────────────────────────────────────────────────
async function getOne(sql, args = []) {
  const r = await client.execute({ sql, args });
  return r.rows[0] || null;
}

async function getAll(sql, args = []) {
  const r = await client.execute({ sql, args });
  return r.rows;
}

async function run(sql, args = []) {
  const r = await client.execute({ sql, args });
  return { lastInsertRowid: Number(r.lastInsertRowid), rowsAffected: r.rowsAffected };
}

// ── DB init ───────────────────────────────────────────────────────
async function initDB() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre     TEXT    NOT NULL,
      email      TEXT    UNIQUE NOT NULL,
      password   TEXT    NOT NULL,
      role       TEXT    DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS cars (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
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
    )`,
    `CREATE TABLE IF NOT EXISTS favorites (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      car_id     INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, car_id)
    )`,
    `CREATE TABLE IF NOT EXISTS support_tickets (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      asunto     TEXT    NOT NULL,
      mensaje    TEXT    NOT NULL,
      estado     TEXT    DEFAULT 'abierto',
      respuesta  TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  for (const sql of tables) {
    await client.execute(sql);
  }

  // Admin por defecto
  const admin = await getOne("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (!admin) {
    const pwd  = 'Admin2024!';
    const hash = bcrypt.hashSync(pwd, 10);
    await run('INSERT INTO users (nombre, email, password, role) VALUES (?, ?, ?, ?)',
      ['Administrador', 'admin@motorimport.es', hash, 'admin']);
    console.log('🔐 Admin por defecto creado:');
    console.log('   Email:      admin@motorimport.es');
    console.log('   Contraseña: Admin2024!');
    console.log('   ⚠️  Cambia la contraseña en producción!\n');
  }
}

module.exports = { client, getOne, getAll, run, initDB };
