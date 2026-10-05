const express = require('express');
const router = express.Router();

const roomController = require('../controllers/roomController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { isNonEmptyString } = require('../utils/validators');

router.use(protect);

router.post(
  '/',
  authorize('owner'),
  validate({
    houseId: { check: isNonEmptyString, message: 'Please select a house.' },
    roomNumber: { check: isNonEmptyString, message: 'Please enter a room number or name.' },
  }),
  roomController.createRoom
);

router.get('/', authorize('owner', 'admin'), roomController.getRooms);

router.get('/:id', authorize('owner', 'admin'), roomController.getRoomById);

router.put('/:id', authorize('owner'), roomController.updateRoom);

module.exports = router;
