const express = require('express');
const router = express.Router();

const auth = require('../middlewares/authMiddleware');
const authorizeRoles = require('../middlewares/roleMiddleware');

const {
  updateAvailability,
  getDoctors
} = require('../controllers/doctorController');

router.put(
  '/availability',
  auth,
  authorizeRoles('doctor'),
  updateAvailability
);

router.get('/', auth, getDoctors);

module.exports = router;