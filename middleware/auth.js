function requireAuth(req, res, next) {
  if (!req.session.user) {
    req.session.flash = { type: 'error', msg: 'Debes iniciar sesión para acceder a esta página.' };
    return res.redirect(`/auth/login?redirect=${encodeURIComponent(req.originalUrl)}`);
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user) {
    req.session.flash = { type: 'error', msg: 'Acceso restringido.' };
    return res.redirect('/auth/login');
  }
  if (req.session.user.role !== 'admin') {
    return res.status(403).render('404', { title: 'Acceso denegado' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
