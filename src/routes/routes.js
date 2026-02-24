const express = require('express');
const router = express.Router();

const statusController = require('../controllers/status.controller');

const authRoutes = require('./auth.routes');

router.get('/', statusController.getStatus);

router.get("/health", statusController.getHealth);

router.use('/auth', authRoutes);

module.exports = router;