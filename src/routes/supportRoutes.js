const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { submitMessage } = require('../controllers/supportController');

// Gym owner / staff / user submits a Contact Us message
router.post('/', protect, submitMessage);

module.exports = router;
