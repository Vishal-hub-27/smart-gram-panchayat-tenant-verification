import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import { useAuth } from '../context/AuthContext';

const STEPS = [
  { label: 'Mobile & details', status: 'active' },
  { label: 'OTP verification', status: '' },
  { label: 'Account created', status: '' },
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    phone: '',
    password: '',
    village: '',
    address: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await register(form);
      // Carry the phone (and dev OTP, if present) forward to the OTP screen
      // via router state rather than the URL, so it isn't left in browser history.
      navigate('/verify-otp', { state: { phone: form.phone, devOtp: res.data?.devOtp } });
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout steps={STEPS}>
      <h2>Create your account</h2>
      <p className="subtitle">Register as a house owner to manage tenants.</p>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="name">Full name</label>
          <input id="name" type="text" value={form.name} onChange={update('name')} required />
        </div>

        <div className="field">
          <label htmlFor="phone">Phone number</label>
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            placeholder="9876543210"
            value={form.phone}
            onChange={update('phone')}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={form.password} onChange={update('password')} required />
          <div className="field-hint">At least 8 characters, with a letter and a number.</div>
        </div>

        <div className="field">
          <label htmlFor="village">Village</label>
          <input id="village" type="text" value={form.village} onChange={update('village')} required />
        </div>

        <div className="field">
          <label htmlFor="address">Address</label>
          <input id="address" type="text" value={form.address} onChange={update('address')} required />
        </div>

        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Creating account...' : 'Send OTP'}
        </button>
      </form>

      <div className="auth-switch">
        Already have an account? <Link to="/login">Log in</Link>
      </div>
    </AuthLayout>
  );
}
