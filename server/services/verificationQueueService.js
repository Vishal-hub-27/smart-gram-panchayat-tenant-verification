const Verification = require('../models/Verification');

/**
 * Creates or refreshes the Verification queue entry for a subject.
 *
 * Called whenever a Tenant/Family reaches a state that needs admin
 * attention: initial submission, resubmission after correction, or a
 * family's residence being updated via the existing-family claim flow.
 * Reuses an existing open (non-resolved) Verification doc for the same
 * subject rather than creating a new one each time, so an admin queue
 * entry isn't duplicated every time an owner resubmits.
 */
async function upsertVerification({ subjectType, subjectId, ownerId, houseId, status = 'SUBMITTED' }) {
  const existing = await Verification.findOne({
    subjectType,
    subjectId,
    status: { $nin: ['APPROVED', 'REJECTED'] },
  });

  if (existing) {
    existing.ownerId = ownerId;
    existing.houseId = houseId;
    existing.status = status;
    // Resubmission clears prior review assignment so it shows as fresh
    // in the queue rather than looking like it's still "being reviewed"
    // by whichever admin last touched it.
    existing.reviewedBy = undefined;
    existing.reviewedAt = undefined;
    await existing.save();
    return existing;
  }

  return Verification.create({ subjectType, subjectId, ownerId, houseId, status });
}

module.exports = { upsertVerification };
