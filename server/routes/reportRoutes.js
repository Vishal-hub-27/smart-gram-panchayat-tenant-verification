const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect, authorize('admin'));

router.get('/dashboard', reportController.getDashboardStats);
router.get('/charts', reportController.getDashboardCharts);
router.get('/tenants', reportController.getTenantReport);
router.get('/houses', reportController.getHouseReport);
router.get('/movement', reportController.getMovementReport);

module.exports = router;
