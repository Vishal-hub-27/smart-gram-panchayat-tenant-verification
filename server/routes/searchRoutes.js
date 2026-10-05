const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Global cross-collection search is an admin tool — owners already have
// scoped search/filter on their own Tenants/Families/Houses lists.
router.use(protect, authorize('admin'));

router.get('/', searchController.globalSearch);

module.exports = router;
