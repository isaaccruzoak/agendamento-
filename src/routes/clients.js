const router = require('express').Router();
const ctrl   = require('../controllers/clientController');
const { writeLimiter } = require('../middleware/rateLimiter');
const { adminAuth } = require('../middleware/adminAuth');

router.get('/',       adminAuth, ctrl.getAllClients);
router.get('/:id',    adminAuth, ctrl.getClientById);
router.post('/',      adminAuth, writeLimiter, ctrl.createClient);
router.put('/:id',    adminAuth, writeLimiter, ctrl.updateClient);
router.delete('/:id', adminAuth, writeLimiter, ctrl.deleteClient);

module.exports = router;
