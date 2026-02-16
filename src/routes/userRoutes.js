const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.get('/', authenticateToken, userController.getAllUsers);
router.get('/profile', authenticateToken, userController.getProfile);
router.put('/pin', authenticateToken, userController.updateRobotPin);

module.exports = router;