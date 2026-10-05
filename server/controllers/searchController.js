const Owner = require('../models/Owner');
const House = require('../models/House');
const Tenant = require('../models/Tenant');
const Family = require('../models/Family');

const { success, error } = require('../utils/response');
const { normalizePhone, isValidPhone } = require('../utils/validators');

// Business-ID patterns (O-2026-0001 style) — an exact match on one of these
// is unambiguous, so it's checked before falling back to fuzzy name/phone
// matching (spec §18: search by Tenant ID, Family ID, House ID, Owner ID,
// tenant name, family head name, phone number).
const ID_PATTERNS = [
  { re: /^O-\d{4}-\d{4,}$/i, label: 'owner', run: (q) => Owner.findOne({ ownerId: q.toUpperCase() }) },
  { re: /^H-\d{4}-\d{4,}$/i, label: 'house', run: (q) => House.findOne({ houseId: q.toUpperCase() }) },
  { re: /^T-\d{4}-\d{4,}$/i, label: 'tenant', run: (q) => Tenant.findOne({ tenantId: q.toUpperCase() }) },
  { re: /^F-\d{4}-\d{4,}$/i, label: 'family', run: (q) => Family.findOne({ familyId: q.toUpperCase() }) },
];

// Scope note: Owner and House browsing pages for admin don't exist yet
// (admin's day-to-day work in this build is verification/transfer/move-out
// on tenants and families — see README). Owner/House results are still
// shown, with their ID for reference, but without a link to click into.
function toResult(recordType, doc, idField, nameField) {
  const isNavigable = recordType === 'tenant' || recordType === 'family';
  return {
    recordType,
    id: doc[idField] || null,
    mongoId: doc._id,
    name: doc[nameField],
    status: doc.status,
    link: isNavigable ? `/admin/${recordType === 'tenant' ? 'tenants' : 'families'}/${doc._id}` : null,
  };
}

// ---------------------------------------------------------------------
// GET /api/search?q=...  (admin only)
// ---------------------------------------------------------------------
async function globalSearch(req, res, next) {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return error(res, 400, 'Please enter a search term.');

    // 1. Exact business-ID match — most specific, checked first.
    for (const pattern of ID_PATTERNS) {
      if (pattern.re.test(q)) {
        const doc = await pattern.run(q);
        if (!doc) return success(res, 200, 'No matching records found.', { results: [] });
        const idField = { owner: 'ownerId', house: 'houseId', tenant: 'tenantId', family: 'familyId' }[pattern.label];
        const nameField = { owner: 'name', house: 'address', tenant: 'name', family: 'headName' }[pattern.label];
        return success(res, 200, 'Match found.', { results: [toResult(pattern.label, doc, idField, nameField)] });
      }
    }

    // 2. Phone number — exact, since partial-phone search on unindexed
    // substrings would be a full collection scan at any real scale.
    const results = [];
    if (isValidPhone(q) || /^\d{10}$/.test(q.replace(/\D/g, ''))) {
      const phone = normalizePhone(q);
      const [tenantsByPhone, familiesByPhone] = await Promise.all([
        Tenant.find({ phone }).limit(10),
        Family.find({ headPhone: phone }).limit(10),
      ]);
      tenantsByPhone.forEach((t) => results.push(toResult('tenant', t, 'tenantId', 'name')));
      familiesByPhone.forEach((f) => results.push(toResult('family', f, 'familyId', 'headName')));
    }

    // 3. Fuzzy name match — tenant name, family head name, owner name.
    if (results.length === 0) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const [tenants, families, owners] = await Promise.all([
        Tenant.find({ name: regex }).limit(10),
        Family.find({ headName: regex }).limit(10),
        Owner.find({ name: regex }).limit(10),
      ]);
      tenants.forEach((t) => results.push(toResult('tenant', t, 'tenantId', 'name')));
      families.forEach((f) => results.push(toResult('family', f, 'familyId', 'headName')));
      owners.forEach((o) => results.push({ recordType: 'owner', id: o.ownerId, mongoId: o._id, name: o.name, status: null, link: null }));
    }

    return success(res, 200, results.length > 0 ? 'Results found.' : 'No matching records found.', { results });
  } catch (err) {
    next(err);
  }
}

module.exports = { globalSearch };
