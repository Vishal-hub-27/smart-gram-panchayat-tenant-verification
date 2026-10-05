/**
 * Shared shell for Login / Register / OTP pages: a left brand panel
 * (with the "seal ring" signature motif and, where relevant, a real
 * step indicator for the register -> OTP -> account flow) and a right
 * panel holding the actual form.
 */
export default function AuthLayout({ children, steps }) {
  return (
    <div className="auth-shell">
      <div className="auth-brand">
        <div className="seal-ring" />
        <div className="auth-brand-top">
          <div className="eyebrow">Gram Panchayat</div>
          <h1>Tenant Management &amp; Verification System</h1>
          <p>A single, verified record for every owner, house, and tenant in the village.</p>
        </div>

        {steps && (
          <div className="auth-steps">
            {steps.map((step) => (
              <div key={step.label} className={`auth-step ${step.status}`}>
                <span className="auth-step-dot" />
                <span>{step.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="auth-panel">
        <div className="auth-card">{children}</div>
      </div>
    </div>
  );
}
