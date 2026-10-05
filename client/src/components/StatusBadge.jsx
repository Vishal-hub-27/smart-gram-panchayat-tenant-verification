const VARIANTS = {
  // House/Room
  active: { tone: 'ok', label: 'Active' },
  inactive: { tone: 'muted', label: 'Inactive' },
  full: { tone: 'warn', label: 'Full' },
  pending: { tone: 'warn', label: 'Pending' },

  // Tenant/Family application lifecycle
  DRAFT: { tone: 'muted', label: 'Draft' },
  SUBMITTED: { tone: 'warn', label: 'Submitted' },
  UNDER_REVIEW: { tone: 'warn', label: 'Under Review' },
  CORRECTION_REQUIRED: { tone: 'warn', label: 'Correction Required' },
  RESUBMITTED: { tone: 'warn', label: 'Resubmitted' },
  APPROVED: { tone: 'ok', label: 'Approved' },
  ACTIVE: { tone: 'ok', label: 'Active' },
  REJECTED: { tone: 'danger', label: 'Rejected' },
  INACTIVE: { tone: 'muted', label: 'Inactive' },
  MOVED_OUT: { tone: 'muted', label: 'Moved Out' },
  TRANSFERRED: { tone: 'muted', label: 'Transferred' },
};

export default function StatusBadge({ status, label }) {
  const variant = VARIANTS[status] || { tone: 'muted', label: label || status };
  return <span className={`status-badge status-${variant.tone}`}>{label || variant.label}</span>;
}
