import { useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import { useAuth } from '../context/AuthContext';

const STEPS = [
  { label: 'Mobile & details', status: 'done' },
  { label: 'OTP verification', status: 'active' },
  { label: 'Account created', status: '' },
];

const RESEND_COOLDOWN = 30;

export default function OtpVerification() {
  const { verifyOtp, sendOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const phone = location.state?.phone;
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState(location.state?.devOtp || '');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // If someone lands here directly without registering first, send them back.
  if (!phone) {
    return <Navigate to="/register" replace />;
  }

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const user = await verifyOtp(phone, otp);
      navigate(user.role === 'admin' ? '/admin/dashboard' : '/owner/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setError('');
    setInfo('');
    try {
      const res = await sendOtp(phone);
      setDevOtp(res.data?.devOtp || '');
      setInfo('A new OTP has been sent to your phone.');
      setCooldown(RESEND_COOLDOWN);
      const timer = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) {
            clearInterval(timer);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    }
  };

  return (
    <AuthLayout steps={STEPS}>
      <h2>Verify your phone</h2>
      <p className="subtitle">
        Enter the 6-digit code sent to <strong>{phone}</strong>.
      </p>

      {devOtp && (
        <div className="dev-otp-hint">
          Development mode — SMS is mocked. Your OTP: <span className="mono">{devOtp}</span>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}
      {info && <div className="alert alert-success">{info}</div>}

      <form onSubmit={handleVerify}>
        <div className="field">
          <label htmlFor="otp">OTP code</label>
          <input
            id="otp"
            className="otp-input"
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="------"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            required
          />
        </div>

        <button className="btn btn-primary" type="submit" disabled={submitting || otp.length !== 6}>
          {submitting ? 'Verifying...' : 'Verify & continue'}
        </button>
      </form>

      <div className="auth-switch">
        Didn't get a code?{' '}
        <button className="btn-link" onClick={handleResend} disabled={cooldown > 0}>
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
        </button>
      </div>
    </AuthLayout>
  );
}
