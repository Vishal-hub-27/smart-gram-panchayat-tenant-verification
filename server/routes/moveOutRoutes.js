const express = require('express');
const router = express.Router();

const residenceRequestController = require('../controllers/residenceRequestController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Creation happens at POST /api/tenants/:id/move-out and
// POST /api/families/:id/move-out — this router only holds the
// admin-side queue and decision endpoints.
router.use(protect, authorize('admin'));

router.get('/', residenceRequestController.getMoveOutRequests);
router.post('/:id/approve', residenceRequestController.approveMoveOut);
router.post('/:id/reject', residenceRequestController.rejectMoveOut);

module.exports = router;
