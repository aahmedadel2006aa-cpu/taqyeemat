import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAdmin } from '../context/AdminContext';

export function AdminLoginPage() {
  const { isAdmin, login } = useAdmin();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (isAdmin) return <Navigate to="/admin" replace />;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(password)) {
      navigate('/admin', { replace: true });
      return;
    }
    setError('كلمة المرور غير صحيحة');
  };

  return (
    <section className="page admin-login-page">
      <form className="form-card login-card" onSubmit={onSubmit}>
        <h1>دخول الأدمن</h1>
        <p className="hint">لوحة الإدارة مخصصة للمسؤول فقط</p>
        <label>
          كلمة المرور
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            required
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit" className="btn btn-primary">
          دخول
        </button>
      </form>
    </section>
  );
}
