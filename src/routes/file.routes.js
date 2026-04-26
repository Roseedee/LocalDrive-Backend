const express = require('express');
const router = express.Router();

const fileController = require('../controllers/file.controller');

router.post('/', fileController.upload)
router.get('/', fileController.getItemsList)

module.exports = router;