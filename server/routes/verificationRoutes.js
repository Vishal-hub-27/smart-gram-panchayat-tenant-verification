const express = require('express');
const router = express.Router();

const verificationController = require('../controllers/verificationController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// The entire verification queue is admin-only — owners never see this
// collection directly; they see correction notes reflected back on their
// own Tenant/Family record's statusHistory instead (see
// tenantController.resubmitTenant / familyController.resubmitFamily).
router.use(protect, authorize('admin'));

router.get('/pending', verificationController.getPendingQueue);
router.get('/:id', verificationController.getVerificationById);
router.post('/:id/approve', verificationController.approveVerification);
router.post('/:id/reject', verificationController.rejectVerification);
router.post('/:id/correction', verificationController.requestCorrection);

module.exports = router;
