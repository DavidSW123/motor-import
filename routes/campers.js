const express = require('express');
const { listVehicles } = require('./cars');
const router  = express.Router();

router.get('/', (req, res) => listVehicles(req, res, 'camper'));

module.exports = router;
