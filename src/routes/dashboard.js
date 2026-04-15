const router = require('express').Router();
const ctrl   = require('../controllers/dashboardController');
const { adminAuth } = require('../middleware/adminAuth');

router.get('/',           adminAuth, ctrl.getDashboardStats);
router.get('/free-slots', adminAuth, ctrl.getFreeSlots);

module.exports = router;
