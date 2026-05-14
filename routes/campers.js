const express = require('express');
const { listVehicles } = require('./cars');
const router  = express.Router();

// listVehicles espera un objeto opts. Antes pasábamos 'camper'
// (string) y la destructuración devolvía undefined silenciosamente
// → no se filtraba por categoría y aparecían también coches.
router.get('/', (req, res) => listVehicles(req, res, { fixedCategoria: 'camper' }));

module.exports = router;
