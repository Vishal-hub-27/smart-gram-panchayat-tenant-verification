// Shared status lifecycle for anything that goes through admin
// verification (Tenant, Family). Defined once so both models — and any
// code that branches on status — can't drift out of sync with each other.
const APPLICATION_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'CORRECTION_REQUIRED',
  'RESUBMITTED',
  'APPROVED',
  'ACTIVE',
  'REJECTED',
  'INACTIVE',
  'MOVED_OUT',
  'TRANSFERRED',
];

module.exports = { APPLICATION_STATUSES };
