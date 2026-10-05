const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const familyController = require('../controllers/familyController');
const duplicateController = require('../controllers/duplicateController');
const residenceRequestController = require('../controllers/residenceRequestController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { isValidPhone, isNonEmptyString } = require('../utils/validators');
const { makeUploader, handleFieldsUpload, ALLOWED_DOCUMENT_TYPES } = require('../middleware/uploadMiddleware');
const { config } = require('../config/env');

const familyUploader = makeUploader('families', ALLOWED_DOCUMENT_TYPES);

const otpLimiter = rateLimit({
  windowMs: config.authRateLimitWindowMinutes * 60 * 1000,
  max: config.authRateLimitMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

router.use(protect);

router.get('/duplicate-check', authorize('owner', 'admin'), duplicateController.checkDuplicate);

router.get('/lookup/:familyId', authorize('owner', 'admin'), familyController.lookupFamily);
router.post('/lookup/:familyId/send-otp', authorize('owner'), otpLimiter, familyController.sendHeadOtp);
router.post('/lookup/:familyId/verify-otp', authorize('owner'), otpLimiter, familyController.verifyHeadOtp);
router.put('/:familyId/residence', authorize('owner'), familyController.updateResidence);

router.post(
  '/',
  authorize('owner'),
  handleFieldsUpload(familyUploader, [
    { name: 'headPhoto', maxCount: 1 },
    { name: 'documents', maxCount: 5 },
  ]),
  validate({
    houseId: { check: isNonEmptyString, message: 'Please select a house.' },
    roomId: { check: isNonEmptyString, message: 'Please select a room.' },
    headName: { check: isNonEmptyString, message: "Please enter the family head's name." },
    headPhone: { check: isValidPhone, message: 'Please enter a valid 10-digit phone number.' },
  }),
  familyController.createFamily
);

router.get('/', authorize('owner', 'admin'), familyController.getFamilies);

router.get('/:id', authorize('owner', 'admin'), familyController.getFamilyById);

router.put(
  '/:id',
  authorize('owner'),
  handleFieldsUpload(familyUploader, [
    { name: 'headPhoto', maxCount: 1 },
    { name: 'documents', maxCount: 5 },
  ]),
  familyController.resubmitFamily
);

router.post('/:id/move-out', authorize('owner'), residenceRequestController.createFamilyMoveOutRequest);
router.get('/:id/history', authorize('owner', 'admin'), residenceRequestController.getFamilyHistory);

module.exports = router;
