function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    req.session.flash = { type: 'error', msg: 'Acceso restringido. Inicia sesión como administrador.' };
    return res.redirect(`/admin/login?redirect=${encodeURIComponent(req.originalUrl)}`);
  }
  next();
}

module.exports = { requireAdmin };
