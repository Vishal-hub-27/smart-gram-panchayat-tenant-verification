const express = require('express');
const router = express.Router();

const residenceRequestController = require('../controllers/residenceRequestController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect);

router.post('/', authorize('owner'), residenceRequestController.createTransferRequest);
router.get('/', authorize('owner', 'admin'), residenceRequestController.getTransferRequests);
router.post('/:id/approve', authorize('admin'), residenceRequestController.approveTransfer);
router.post('/:id/reject', authorize('admin'), residenceRequestController.rejectTransfer);

module.exports = router;
