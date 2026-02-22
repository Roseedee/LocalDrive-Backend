const express = require('express');
const router = express.Router();

const statusController = require('../controllers/status.controller');

router.get('/', statusController.getStatus);

router.get("/health", statusController.getHealth);

module.exports = router;