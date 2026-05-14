const express = require('express');
const router = express.Router();

const fileController = require('../controllers/file.controller');

router.post('/', fileController.create)
router.get('/', fileController.getItemsList)
router.get('/:id/content', fileController.serveFile)
router.get('/:hash/thumbnail', fileController.serveThumbnail)
router.delete('/:id', fileController.deleteFile)
router.patch('/:id', fileController.updateFile)

module.exports = router;