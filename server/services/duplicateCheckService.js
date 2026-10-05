const Tenant = require('../models/Tenant');
const Family = require('../models/Family');

// Spec §9: check existing records using non-sensitive identifiers before
// creating a new tenant/family. Phone number is the most reliable signal
// available in this system (no government ID numbers are collected/stored).
// Searches both Tenant.phone and Family.headPhone so a single check covers
// "is this person already registered as a single tenant OR as a family
// head anywhere in the system" — FamilyMembers aren't checked individually
// since they don't have their own phone number in this system (only the
// family head's phone is collected, per spec §8's example).
//
// Never auto-merges — just surfaces possible matches so the owner is
// warned and, ultimately, an admin resolves it during verification.
async function findPossibleDuplicates(phone) {
  const [tenantMatches, familyMatches] = await Promise.all([
    Tenant.find({ phone }).select('tenantId status name createdAt').limit(5),
    Family.find({ headPhone: phone }).select('familyId status headName createdAt').limit(5),
  ]);

  const fromTenants = tenantMatches.map((m) => ({
    recordType: 'tenant',
    id: m.tenantId || null, // null if still pending (no ID assigned yet)
    status: m.status,
    name: m.name,
    createdAt: m.createdAt,
  }));

  const fromFamilies = familyMatches.map((m) => ({
    recordType: 'family',
    id: m.familyId || null,
    status: m.status,
    name: m.headName,
    createdAt: m.createdAt,
  }));

  return [...fromTenants, ...fromFamilies];
}

module.exports = { findPossibleDuplicates };
