// Small shared pager — used by Notifications and Audit Logs now, and
// reusable for the reports/search screens later.
export default function Pagination({ pagination, onPageChange }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page, totalPages, total } = pagination;

  return (
    <div className="pagination">
      <span className="pagination-info">
        Page {page} of {totalPages} · {total} total
      </span>
      <div className="pagination-buttons">
        <button className="btn-secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          ← Previous
        </button>
        <button className="btn-secondary" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next →
        </button>
      </div>
    </div>
  );
}
