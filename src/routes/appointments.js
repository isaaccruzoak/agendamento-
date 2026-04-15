const router = require('express').Router();
const ctrl   = require('../controllers/appointmentController');
const { writeLimiter } = require('../middleware/rateLimiter');
const { adminAuth } = require('../middleware/adminAuth');

router.get('/',                  adminAuth, ctrl.getAllAppointments);
router.post('/',                 adminAuth, writeLimiter, ctrl.createAppointment);
router.put('/:id',               adminAuth, writeLimiter, ctrl.updateAppointment);
router.delete('/:id',            adminAuth, writeLimiter, ctrl.cancelAppointment);
router.get('/:id/reminder-logs', adminAuth, ctrl.getReminderLogs);

module.exports = router;
