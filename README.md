# MotorImport

Web de compraventa de coches importados con panel de administración.

## Stack

- **Backend**: Node.js + Express 4 (SSR)
- **Vistas**: EJS
- **Base de datos**: SQLite local (dev) / [Turso](https://turso.tech) (prod)
- **Imágenes**: disco local (dev) / [Cloudinary](https://cloudinary.com) (prod)
- **Deploy**: Vercel (serverless)

## Desarrollo local

\`\`\`bash
npm install
cp .env.example .env   # edita SESSION_SECRET, deja el resto vacío para SQLite/disco local
npm run dev            # http://localhost:4000
\`\`\`

Admin por defecto: \`admin@motorimport.es\` / \`Admin2024!\`

## Variables de entorno (producción)

| Variable | Descripción |
|---|---|
| \`SESSION_SECRET\` | Secreto para firmar cookies de sesión |
| \`TURSO_DATABASE_URL\` | URL de la base de datos Turso (\`libsql://…\`) |
| \`TURSO_AUTH_TOKEN\` | Token de autenticación de Turso |
| \`CLOUDINARY_CLOUD_NAME\` | Cloud name de Cloudinary |
| \`CLOUDINARY_API_KEY\` | API key de Cloudinary |
| \`CLOUDINARY_API_SECRET\` | API secret de Cloudinary |

## Deploy en Vercel

1. Crea una base de datos en [turso.tech](https://turso.tech) y obtén la URL y el token.
2. Crea una cuenta en [cloudinary.com](https://cloudinary.com) y obtén las credenciales.
3. Importa este repositorio en [vercel.com](https://vercel.com).
4. Añade las variables de entorno en _Settings → Environment Variables_.
5. Despliega. Las tablas se crean automáticamente en el primer arranque.
