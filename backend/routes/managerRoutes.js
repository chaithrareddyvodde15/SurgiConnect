const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const role = require('../middlewares/roleMiddleware');
const { broadcastEmergency } = require('../controllers/managerController');

router.post('/emergency-alert', auth, role('manager'), broadcastEmergency);

module.exports = router;
