export default function LoadingSpinner({ label = 'Loading...' }) {
  return (
    <div className="loading-spinner">
      <div className="spinner" />
      <span>{label}</span>
    </div>
  );
}
