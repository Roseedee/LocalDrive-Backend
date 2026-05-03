const express = require('express');
const router = express.Router();

const fileController = require('../controllers/file.controller');

router.post('/', fileController.upload)
router.get('/', fileController.getItemsList)
router.get('/:id', fileController.serveFile)
router.get('/thumbnail/:hash', fileController.serveThumbnail)

module.exports = router;