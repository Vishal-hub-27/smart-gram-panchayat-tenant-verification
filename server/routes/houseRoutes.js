const express = require('express');
const router = express.Router();

const houseController = require('../controllers/houseController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { isNonEmptyString } = require('../utils/validators');
const { makeUploader, handleUpload } = require('../middleware/uploadMiddleware');

const housePhotoUploader = makeUploader('houses');

router.use(protect); // every house route requires a logged-in user

router.post(
  '/',
  authorize('owner'),
  handleUpload(housePhotoUploader, 'photo'),
  validate({
    address: { check: isNonEmptyString, message: 'Please enter the house address.' },
    village: { check: isNonEmptyString, message: 'Please enter the village.' },
  }),
  houseController.createHouse
);

router.get('/', authorize('owner', 'admin'), houseController.getHouses);

router.get('/:id', authorize('owner', 'admin'), houseController.getHouseById);

router.put(
  '/:id',
  authorize('owner'),
  handleUpload(housePhotoUploader, 'photo'),
  houseController.updateHouse
);

module.exports = router;
