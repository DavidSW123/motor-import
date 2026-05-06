# Cars & Campers

Web informativa de compraventa de coches y autocaravanas con panel de administración para dos administradores.

## Características

- Catálogo público navegable de **coches** y **campers / autocaravanas**
- Páginas de detalle con galería de hasta 15 fotos, lightbox y datos completos
- Filtros por tipo, marca, combustible, transmisión, año, precio
- Página de contacto (teléfono, email, WhatsApp)
- Panel admin con login para 2 cuentas autorizadas
  - Alta, edición, eliminación de vehículos
  - Subida y gestión de imágenes
  - Cambio de contraseña

## Stack

- **Backend**: Node.js + Express 4 (SSR)
- **Vistas**: EJS
- **Base de datos**: SQLite local (dev) / [Turso](https://turso.tech) (prod)
- **Imágenes**: disco local (dev) / [Cloudinary](https://cloudinary.com) (prod)
- **Deploy**: Vercel (serverless)

## Desarrollo local

\`\`\`bash
npm install
cp .env.example .env   # edita SESSION_SECRET, deja Turso/Cloudinary vacíos para dev
npm run dev            # http://localhost:4000
\`\`\`

Admins por defecto:
- \`admin1@carsandcampers.es\` / \`Admin1234!\`
- \`admin2@carsandcampers.es\` / \`Admin1234!\`

> Cámbialas en producción desde el panel _Administradores_, o defínelas vía env vars.

## Variables de entorno (producción)

| Variable | Descripción |
|---|---|
| \`SESSION_SECRET\` | Secreto para firmar cookies (obligatorio en prod) |
| \`TURSO_DATABASE_URL\` | URL de la base Turso (\`libsql://…\`) |
| \`TURSO_AUTH_TOKEN\` | Token de Turso |
| \`CLOUDINARY_CLOUD_NAME\` | Cloud name de Cloudinary |
| \`CLOUDINARY_API_KEY\` | API key de Cloudinary |
| \`CLOUDINARY_API_SECRET\` | API secret de Cloudinary |
| \`ADMIN1_EMAIL\` / \`ADMIN1_PASSWORD\` / \`ADMIN1_NOMBRE\` | Credenciales del admin 1 (opcional) |
| \`ADMIN2_EMAIL\` / \`ADMIN2_PASSWORD\` / \`ADMIN2_NOMBRE\` | Credenciales del admin 2 (opcional) |

## Deploy en Vercel

1. Crea una base de datos en [turso.tech](https://turso.tech) → copia URL y token.
2. Crea cuenta en [cloudinary.com](https://cloudinary.com) → copia las 3 credenciales.
3. Importa este repo en [vercel.com](https://vercel.com).
4. Añade las variables de entorno en _Settings → Environment Variables_.
5. Despliega. Las tablas se crean solas en el primer arranque.

## Estructura

\`\`\`
├─ database/db.js         # Cliente Turso/SQLite + esquema
├─ middleware/
│   ├─ auth.js            # requireAdmin
│   └─ upload.js          # Multer en memoria
├─ utils/imageUpload.js   # Cloudinary o disco local
├─ routes/
│   ├─ index.js           # /, /contacto
│   ├─ cars.js            # /coches, /coches/:slug
│   ├─ campers.js         # /campers
│   └─ admin.js           # /admin/*
├─ views/                 # EJS
└─ public/                # CSS, JS, placeholders
\`\`\`
