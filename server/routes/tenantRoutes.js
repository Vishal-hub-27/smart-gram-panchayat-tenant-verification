const express = require('express');
const router = express.Router();

const tenantController = require('../controllers/tenantController');
const duplicateController = require('../controllers/duplicateController');
const residenceRequestController = require('../controllers/residenceRequestController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { isValidPhone, isNonEmptyString } = require('../utils/validators');
const { makeUploader, handleFieldsUpload, ALLOWED_DOCUMENT_TYPES } = require('../middleware/uploadMiddleware');

const tenantUploader = makeUploader('tenants', ALLOWED_DOCUMENT_TYPES);

router.use(protect);

router.get('/duplicate-check', authorize('owner', 'admin'), duplicateController.checkDuplicate);

router.post(
  '/',
  authorize('owner'),
  handleFieldsUpload(tenantUploader, [
    { name: 'photo', maxCount: 1 },
    { name: 'documents', maxCount: 5 },
  ]),
  validate({
    houseId: { check: isNonEmptyString, message: 'Please select a house.' },
    roomId: { check: isNonEmptyString, message: 'Please select a room.' },
    name: { check: isNonEmptyString, message: "Please enter the tenant's name." },
    phone: { check: isValidPhone, message: 'Please enter a valid 10-digit phone number.' },
  }),
  tenantController.createTenant
);

router.get('/', authorize('owner', 'admin'), tenantController.getTenants);

router.get('/:id', authorize('owner', 'admin'), tenantController.getTenantById);

router.put(
  '/:id',
  authorize('owner'),
  handleFieldsUpload(tenantUploader, [
    { name: 'photo', maxCount: 1 },
    { name: 'documents', maxCount: 5 },
  ]),
  tenantController.resubmitTenant
);

router.post('/:id/move-out', authorize('owner'), residenceRequestController.createTenantMoveOutRequest);
router.get('/:id/history', authorize('owner', 'admin'), residenceRequestController.getTenantHistory);

module.exports = router;
