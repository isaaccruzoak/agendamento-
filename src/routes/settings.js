const router = require('express').Router();
const ctrl   = require('../controllers/settingsController');
const { adminAuth } = require('../middleware/adminAuth');

router.get('/',  adminAuth, ctrl.getSettings);
router.put('/',  adminAuth, ctrl.updateSettings);

module.exports = router;
