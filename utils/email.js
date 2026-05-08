// Helper de envío de emails con Resend.
// Si RESEND_API_KEY no está configurada, hace fallback a console.log
// (los datos se ven en logs de Vercel) para no perder ninguna solicitud.

// Cargar el cliente de Resend bajo demanda (lazy) para evitar problemas
// de env vars que aún no están disponibles cuando se carga el módulo.
function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  console.log('[email][diag] RESEND_API_KEY existe:', !!apiKey,
              '| longitud:', apiKey ? apiKey.length : 0,
              '| prefijo:', apiKey ? apiKey.slice(0, 4) : 'N/A');

  // Si no existe, listar todas las env vars que empiezan por R/E para
  // encontrar typos: RESEND-API-KEY, RESEND_API_KEY_, etc.
  if (!apiKey) {
    const candidatas = Object.keys(process.env)
      .filter(k => /^(RES|EMA|TUR|SES|VERC|NODE)/i.test(k))
      .sort();
    console.log('[email][diag] env vars encontradas:', candidatas.join(', ') || '(ninguna)');
  }

  if (!apiKey) return null;
  try {
    const { Resend } = require('resend');
    return new Resend(apiKey);
  } catch (err) {
    console.error('[email][diag] error cargando Resend:', err.message);
    return null;
  }
}

// ── Helpers de plantilla ─────────────────────────────────────────
const escape = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

const baseStyles = `
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; background:#f7f8fa; margin:0; padding:24px; color:#0f1419; }
    .box { max-width:600px; margin:0 auto; background:#fff; border:1px solid #e5e7eb; border-radius:14px; overflow:hidden; }
    .head { background:#b91c1c; color:#fff; padding:24px 28px; }
    .head h1 { margin:0; font-size:1.4rem; }
    .body { padding:28px; }
    table { width:100%; border-collapse:collapse; margin:16px 0; }
    table th, table td { padding:10px 12px; text-align:left; border-bottom:1px solid #e5e7eb; }
    table th { background:#f7f8fa; font-weight:600; width:38%; color:#5a6472; font-size:.9rem; }
    .msg-box { background:#f7f8fa; padding:16px; border-radius:8px; border-left:3px solid #b91c1c; margin:8px 0; white-space:pre-wrap; }
    .foot { padding:20px 28px; background:#f7f8fa; font-size:.85rem; color:#5a6472; border-top:1px solid #e5e7eb; }
    .foot a { color:#b91c1c; text-decoration:none; }
  </style>
`;

// ── Email INTERNO: contacto general ──────────────────────────────
function buildInternalContactHtml(data) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${baseStyles}</head><body>
    <div class="box">
      <div class="head"><h1>Nuevo contacto solicitado</h1></div>
      <div class="body">
        <p>Has recibido un nuevo mensaje desde la web Cars & Campers BCN:</p>
        <table>
          <tr><th>Nombre</th><td>${escape(data.nombre)}</td></tr>
          <tr><th>Email</th><td><a href="mailto:${escape(data.email)}">${escape(data.email)}</a></td></tr>
          ${data.telefono ? `<tr><th>Teléfono</th><td><a href="tel:${escape(data.telefono)}">${escape(data.telefono)}</a></td></tr>` : ''}
        </table>
        <p style="margin-top:18px;font-weight:600">Mensaje:</p>
        <div class="msg-box">${escape(data.mensaje)}</div>
      </div>
      <div class="foot">Recibido a través del formulario de contacto de carsandcampers.es</div>
    </div>
  </body></html>`;
}

// ── Email INTERNO: solicitud a la carta ──────────────────────────
function buildInternalCustomCarHtml(data) {
  const tipoLabel = data.tipo === 'camper' ? 'Camper / Autocaravana' : 'Coche';
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${baseStyles}</head><body>
    <div class="box">
      <div class="head"><h1>Solicitud de coche a la carta</h1></div>
      <div class="body">
        <p style="background:#fef3c7;padding:12px;border-radius:8px;border-left:3px solid #f59e0b;color:#92400e;font-weight:600">
          ⚠️ Recordatorio: enviar al cliente el contrato de aceptación de costes antes de iniciar la búsqueda.
        </p>
        <h2 style="margin-top:24px;font-size:1.1rem">Datos del cliente</h2>
        <table>
          <tr><th>Nombre</th><td>${escape(data.nombre)}</td></tr>
          <tr><th>Email</th><td><a href="mailto:${escape(data.email)}">${escape(data.email)}</a></td></tr>
          <tr><th>Teléfono</th><td><a href="tel:${escape(data.telefono)}">${escape(data.telefono)}</a></td></tr>
        </table>
        <h2 style="margin-top:24px;font-size:1.1rem">Vehículo solicitado</h2>
        <table>
          <tr><th>Tipo</th><td>${escape(tipoLabel)}</td></tr>
          ${data.marca    ? `<tr><th>Marca</th><td>${escape(data.marca)}</td></tr>` : ''}
          ${data.modelo   ? `<tr><th>Modelo</th><td>${escape(data.modelo)}</td></tr>` : ''}
          ${data.anio_desde ? `<tr><th>Año desde</th><td>${escape(data.anio_desde)}</td></tr>` : ''}
          ${data.combustible ? `<tr><th>Combustible</th><td>${escape(data.combustible)}</td></tr>` : ''}
          ${data.transmision ? `<tr><th>Transmisión</th><td>${escape(data.transmision)}</td></tr>` : ''}
          ${data.km_max   ? `<tr><th>Km máximo</th><td>${escape(data.km_max)} km</td></tr>` : ''}
          ${data.presupuesto ? `<tr><th>Presupuesto orientativo</th><td>${escape(data.presupuesto)} €</td></tr>` : ''}
        </table>
        ${data.comentarios ? `
          <h2 style="margin-top:24px;font-size:1.1rem">Comentarios y características</h2>
          <div class="msg-box">${escape(data.comentarios)}</div>
        ` : ''}
        <p style="margin-top:24px;color:#5a6472;font-size:.9rem">
          ✓ El cliente ha aceptado los gastos de gestión.
        </p>
      </div>
      <div class="foot">Recibido desde /coches/a-la-carta · carsandcampers.es</div>
    </div>
  </body></html>`;
}

// ── Email AL CLIENTE: copia / acuse de recibo ────────────────────
function buildClientCopyHtml(data, tipo) {
  const isCustom = tipo === 'a-la-carta';
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${baseStyles}</head><body>
    <div class="box">
      <div class="head"><h1>${isCustom ? '¡Hemos recibido tu solicitud!' : '¡Hemos recibido tu mensaje!'}</h1></div>
      <div class="body">
        <p>Hola <strong>${escape(data.nombre)}</strong>,</p>
        <p>${isCustom
          ? 'Gracias por confiar en <strong>Cars & Campers BCN</strong> para encontrar tu próximo vehículo. Hemos recibido los detalles de tu búsqueda y nos pondremos en contacto contigo en breve para concretar el siguiente paso (envío del contrato de aceptación de costes y comienzo de la búsqueda).'
          : 'Gracias por escribirnos. Hemos recibido tu mensaje y te responderemos en las próximas 24 horas laborables.'}</p>

        <p style="margin-top:20px;font-weight:600">Esta es la copia de los datos que nos has enviado:</p>
        ${isCustom ? buildInternalCustomCarHtml(data).match(/<table[\s\S]*<\/table>/g)?.join('') || '' : `
          <table>
            <tr><th>Nombre</th><td>${escape(data.nombre)}</td></tr>
            <tr><th>Email</th><td>${escape(data.email)}</td></tr>
            ${data.telefono ? `<tr><th>Teléfono</th><td>${escape(data.telefono)}</td></tr>` : ''}
          </table>
          <p style="margin-top:14px;font-weight:600">Tu mensaje:</p>
          <div class="msg-box">${escape(data.mensaje)}</div>
        `}

        <p style="margin-top:24px">Si necesitas algo urgente, puedes escribirnos por WhatsApp:
          <br><a href="https://wa.me/34618105936" style="display:inline-block;margin-top:8px;background:#25D366;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">📱 +34 618 10 59 36</a>
        </p>
        <p style="margin-top:18px">Un saludo,<br><strong>El equipo de Cars & Campers BCN</strong></p>
      </div>
      <div class="foot">
        Cars & Campers BCN · <a href="tel:+34618105936">+34 618 10 59 36</a> · <a href="mailto:carscampersbcn@gmail.com">carscampersbcn@gmail.com</a>
      </div>
    </div>
  </body></html>`;
}

// ── Envío real ───────────────────────────────────────────────────
async function sendViaResend(opts) {
  const TO   = process.env.EMAIL_TO   || 'ds.qnk.88@gmail.com';
  const FROM = process.env.EMAIL_FROM || 'Cars & Campers <onboarding@resend.dev>';
  const resend = getResend();

  console.log('[email][diag] EMAIL_TO:', TO, '| FROM:', FROM, '| destinatario:', opts.to);

  if (!resend) {
    console.log('[email][FALLBACK no Resend] →', opts.subject);
    return { skipped: true, reason: 'RESEND_API_KEY not set' };
  }
  try {
    const result = await resend.emails.send({
      from: FROM,
      to:   opts.to,
      subject: opts.subject,
      html:    opts.html,
      replyTo: opts.replyTo
    });
    console.log('[email][diag] resultado Resend:', JSON.stringify(result).slice(0, 400));
    return result;
  } catch (err) {
    console.error('[email] Error enviando:', err.message || err);
    return { error: err.message || String(err) };
  }
}

// ── API pública ──────────────────────────────────────────────────
function teamEmail() {
  return process.env.EMAIL_TO || 'ds.qnk.88@gmail.com';
}

async function sendContactEmail(data) {
  // 1) Email interno al equipo
  const internal = await sendViaResend({
    to:      teamEmail(),
    subject: `Contacto solicitado por ${data.nombre}`,
    html:    buildInternalContactHtml(data),
    replyTo: data.email
  });
  // 2) Copia al cliente
  const copy = await sendViaResend({
    to:      data.email,
    subject: 'Hemos recibido tu mensaje · Cars & Campers BCN',
    html:    buildClientCopyHtml(data, 'contacto')
  });
  return { internal, copy };
}

async function sendCustomCarEmail(data) {
  const internal = await sendViaResend({
    to:      teamEmail(),
    subject: `Solicitud de coche a la carta — preparar contrato (${data.nombre})`,
    html:    buildInternalCustomCarHtml(data),
    replyTo: data.email
  });
  const copy = await sendViaResend({
    to:      data.email,
    subject: 'Hemos recibido tu solicitud a la carta · Cars & Campers BCN',
    html:    buildClientCopyHtml(data, 'a-la-carta')
  });
  return { internal, copy };
}

module.exports = { sendContactEmail, sendCustomCarEmail };
