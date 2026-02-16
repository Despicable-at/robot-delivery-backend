const express = require('express');
const router = express.Router();
const robotController = require('../controllers/robotController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.get('/status', authenticateToken, robotController.getStatus);
router.put('/status', authenticateToken, robotController.updateStatus); // optionally restrict to admin

module.exports = router;