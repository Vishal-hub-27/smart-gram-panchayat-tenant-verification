const Owner = require('../models/Owner');
const House = require('../models/House');
const Room = require('../models/Room');
const Tenant = require('../models/Tenant');
const Family = require('../models/Family');
const FamilyMember = require('../models/FamilyMember');
const Verification = require('../models/Verification');
const ResidenceRequest = require('../models/ResidenceRequest');

const { success } = require('../utils/response');
const { sendCsv } = require('../utils/csv');

// All routes here are admin-only — enforced in reportRoutes.js, not
// repeated per-handler.

// ---------------------------------------------------------------------
// GET /api/reports/dashboard  (spec §17 — the headline stat cards)
// ---------------------------------------------------------------------
async function getDashboardStats(req, res, next) {
  try {
    const [
      totalOwners,
      totalHouses,
      totalRooms,
      activeTenants,
      totalFamilies,
      pendingApplications,
      correctionRequired,
      movedOutTenants,
      movedOutFamilies,
      pendingTransfers,
      pendingMoveOuts,
      rooms,
    ] = await Promise.all([
      Owner.countDocuments({}),
      House.countDocuments({}),
      Room.countDocuments({}),
      Tenant.countDocuments({ status: 'ACTIVE' }),
      Family.countDocuments({ status: 'ACTIVE' }),
      Verification.countDocuments({ status: { $in: ['SUBMITTED', 'RESUBMITTED', 'UNDER_REVIEW'] } }),
      Verification.countDocuments({ status: 'CORRECTION_REQUIRED' }),
      Tenant.countDocuments({ status: 'MOVED_OUT' }),
      Family.countDocuments({ status: 'MOVED_OUT' }),
      ResidenceRequest.countDocuments({ requestType: 'transfer', status: 'PENDING' }),
      ResidenceRequest.countDocuments({ requestType: 'move_out', status: 'PENDING' }),
      // Only room-level fields needed — avoid pulling full documents just to sum two numbers.
      Room.find({ status: 'active' }).select('capacity currentOccupancy'),
    ]);

    // "Available Rooms" (spec §17) means rooms with at least one free
    // slot, not total empty slots — a room with 1 of 4 taken still reads
    // as "available" to an owner looking for somewhere to place someone.
    const availableRooms = rooms.filter((r) => r.currentOccupancy < r.capacity).length;

    return success(res, 200, 'Dashboard stats fetched.', {
      totalOwners,
      totalHouses,
      totalRooms,
      activeTenants,
      totalFamilies,
      singleTenants: activeTenants, // "Single Tenants" card = active Tenant records specifically
      pendingApplications,
      correctionRequired,
      availableRooms,
      movedOutTenants: movedOutTenants + movedOutFamilies,
      transferRequests: pendingTransfers,
      pendingMoveOuts,
    });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------
// GET /api/reports/charts  (spec §17 chart list)
// ---------------------------------------------------------------------
async function getDashboardCharts(req, res, next) {
  try {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const monthKey = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };

    const [
      tenantsByMonth,
      familiesByMonth,
      tenantStatusCounts,
      familyStatusCounts,
      transfersByMonth,
      moveOutsByMonth,
      verificationOutcomes,
      houseOccupancy,
    ] = await Promise.all([
      Tenant.aggregate([
        { $match: { createdAt: { $gte: twelveMonthsAgo } } },
        { $group: { _id: monthKey, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Family.aggregate([
        { $match: { createdAt: { $gte: twelveMonthsAgo } } },
        { $group: { _id: monthKey, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Tenant.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Family.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      ResidenceRequest.aggregate([
        { $match: { requestType: 'transfer', status: 'APPROVED', reviewedAt: { $gte: twelveMonthsAgo } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$reviewedAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      ResidenceRequest.aggregate([
        { $match: { requestType: 'move_out', status: 'APPROVED', reviewedAt: { $gte: twelveMonthsAgo } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$reviewedAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Verification.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      House.find({ status: 'active' }).select('address'),
    ]);

    // "Active vs inactive" folds every non-active status into "inactive"
    // for the chart, per spec §17's simple two-way split; the raw
    // per-status breakdown is still available via the Reports pages.
    const foldActiveInactive = (rows) => {
      let active = 0, inactive = 0;
      rows.forEach((r) => (r._id === 'ACTIVE' ? (active += r.count) : (inactive += r.count)));
      return { active, inactive };
    };

    // House occupancy: capacity/occupancy summed per house, computed from
    // Room rather than stored on House, since Room is the source of truth.
    const roomsByHouse = await Room.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$houseId', capacity: { $sum: '$capacity' }, occupied: { $sum: '$currentOccupancy' } } },
    ]);
    const occupancyMap = new Map(roomsByHouse.map((r) => [String(r._id), r]));
    const houseOccupancyChart = houseOccupancy.map((h) => {
      const stats = occupancyMap.get(String(h._id)) || { capacity: 0, occupied: 0 };
      return {
        house: h.address,
        capacity: stats.capacity,
        occupied: stats.occupied,
        occupancyRate: stats.capacity > 0 ? Math.round((stats.occupied / stats.capacity) * 100) : 0,
      };
    });

    return success(res, 200, 'Dashboard charts fetched.', {
      registrationsByMonth: { tenants: tenantsByMonth, families: familiesByMonth },
      activeVsInactive: {
        tenants: foldActiveInactive(tenantStatusCounts),
        families: foldActiveInactive(familyStatusCounts),
      },
      singleVsFamily: {
        single: tenantStatusCounts.reduce((s, r) => s + r.count, 0),
        family: familyStatusCounts.reduce((s, r) => s + r.count, 0),
      },
      houseOccupancy: houseOccupancyChart,
      tenantMovement: { transfersByMonth, moveOutsByMonth },
      pendingVsApproved: verificationOutcomes,
    });
  } catch (err) {
    next(err);
  }
}

/** Shared date-range filter builder for the three reports below. */
function dateRangeFilter(query, field = 'createdAt') {
  const filter = {};
  if (query.year) {
    const start = new Date(`${query.year}-01-01T00:00:00.000Z`);
    const end = new Date(`${Number(query.year) + 1}-01-01T00:00:00.000Z`);
    filter[field] = { $gte: start, $lt: end };
  } else if (query.from || query.to) {
    filter[field] = {};
    if (query.from) filter[field].$gte = new Date(query.from);
    if (query.to) {
      const end = new Date(query.to);
      end.setHours(23, 59, 59, 999);
      filter[field].$lte = end;
    }
  }
  return filter;
}

// ---------------------------------------------------------------------
// GET /api/reports/tenants  (spec §22 Tenant Report)
// ---------------------------------------------------------------------
async function getTenantReport(req, res, next) {
  try {
    const dateFilter = dateRangeFilter(req.query);
    const [total, active, inactive, single, familyRecords, familyMembers] = await Promise.all([
      Tenant.countDocuments(dateFilter),
      Tenant.countDocuments({ ...dateFilter, status: 'ACTIVE' }),
      Tenant.countDocuments({ ...dateFilter, status: { $ne: 'ACTIVE' } }),
      Tenant.countDocuments({ ...dateFilter, status: 'ACTIVE' }),
      Family.countDocuments({ ...dateFilter, status: 'ACTIVE' }),
      FamilyMember.countDocuments({}),
    ]);

    const stats = {
      totalTenants: total,
      activeTenants: active,
      inactiveTenants: inactive,
      singleTenants: single,
      activeFamilies: familyRecords,
      familyMembers: familyRecords + familyMembers, // heads + members currently on active families
    };
    if (req.query.format === 'csv') return sendCsv(res, 'tenant-report.csv', [stats]);
    return success(res, 200, 'Tenant report generated.', stats);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------
// GET /api/reports/houses  (spec §22 House Report)
// ---------------------------------------------------------------------
async function getHouseReport(req, res, next) {
  try {
    const dateFilter = dateRangeFilter(req.query);
    const [totalHouses, rooms] = await Promise.all([
      House.countDocuments(dateFilter),
      Room.find({ status: 'active' }).select('capacity currentOccupancy'),
    ]);

    const totalCapacity = rooms.reduce((s, r) => s + r.capacity, 0);
    const occupied = rooms.reduce((s, r) => s + r.currentOccupancy, 0);
    const available = totalCapacity - occupied;

    const stats = {
      totalHouses,
      totalRooms: rooms.length,
      occupiedSlots: occupied,
      availableSlots: available,
      capacityUtilization: totalCapacity > 0 ? Math.round((occupied / totalCapacity) * 100) : 0,
    };
    if (req.query.format === 'csv') return sendCsv(res, 'house-report.csv', [stats]);
    return success(res, 200, 'House report generated.', stats);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------
// GET /api/reports/movement  (spec §22 Movement Report)
// ---------------------------------------------------------------------
async function getMovementReport(req, res, next) {
  try {
    const tenantDateFilter = dateRangeFilter(req.query);
    const reviewDateFilter = dateRangeFilter(req.query, 'reviewedAt');

    const [newTenants, newFamilies, transfers, moveOuts, activeTenants, activeFamilies] = await Promise.all([
      Tenant.countDocuments(tenantDateFilter),
      Family.countDocuments(tenantDateFilter),
      ResidenceRequest.countDocuments({ requestType: 'transfer', status: 'APPROVED', ...reviewDateFilter }),
      ResidenceRequest.countDocuments({ requestType: 'move_out', status: 'APPROVED', ...reviewDateFilter }),
      Tenant.countDocuments({ status: 'ACTIVE' }),
      Family.countDocuments({ status: 'ACTIVE' }),
    ]);

    const stats = {
      newRegistrations: newTenants + newFamilies,
      transfers,
      moveOuts,
      activeResidents: activeTenants + activeFamilies,
    };
    if (req.query.format === 'csv') return sendCsv(res, 'movement-report.csv', [stats]);
    return success(res, 200, 'Movement report generated.', stats);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDashboardStats,
  getDashboardCharts,
  getTenantReport,
  getHouseReport,
  getMovementReport,
};
