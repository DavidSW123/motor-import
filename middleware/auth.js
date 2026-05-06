function requireAdmin(req, res, next) {
  console.log('[requireAdmin]', req.method, req.originalUrl, 'session.user:', req.session?.user?.email || 'NO SESSION');
  if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
    req.session.flash = { type: 'error', msg: 'Acceso restringido. Inicia sesión como administrador.' };
    return res.redirect(`/admin/login?redirect=${encodeURIComponent(req.originalUrl)}`);
  }
  next();
}

module.exports = { requireAdmin };
