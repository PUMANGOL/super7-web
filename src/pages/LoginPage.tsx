import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { getApiErrorMessage } from '../api/client';
import { useAuth } from '../context/auth';
import { useToast } from '../context/toast';
import { canAccessBackoffice } from '../utils/auth';
import './LoginPage.css';

interface LoginForm {
  email: string;
  password: string;
}

type Destination = { pathname?: string; search?: string; hash?: string } | undefined;

function destinationPath(from: Destination): string {
  return from?.pathname ? `${from.pathname}${from.search ?? ''}${from.hash ?? ''}` : '/backoffice';
}

/** Entrada da equipa no back-office. Os clientes da loja não precisam de conta. */
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, canAccessBackoffice: hasAccess } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState<LoginForm>({ email: '', password: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof LoginForm, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const from = (location.state as { from?: Destination } | null)?.from;

  if (isAuthenticated && !submitting) {
    return <Navigate to={hasAccess ? destinationPath(from) : '/'} replace />;
  }

  const updateField = <K extends keyof LoginForm>(key: K, value: LoginForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const found: Partial<Record<keyof LoginForm, string>> = {};
    if (!form.email.trim()) found.email = 'Obrigatório';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) found.email = 'E-mail inválido';
    if (!form.password) found.password = 'Obrigatório';
    setErrors(found);
    return Object.keys(found).length === 0;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const user = await login(form.email.trim(), form.password);
      if (!canAccessBackoffice(user)) {
        showToast('A sua conta não tem acesso ao back-office.', 'error');
        navigate('/', { replace: true });
        return;
      }
      showToast(`Bem-vindo, ${user.name}.`);
      navigate(destinationPath(from), { replace: true });
    } catch (error) {
      showToast(getApiErrorMessage(error, 'E-mail ou palavra-passe inválidos.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <img src="/logo-pumangol.svg" alt="Pumangol" />
          <h1>Área reservada</h1>
          <p>Back-office da loja Super7 Digital, para as equipas Pumangol.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">E-mail</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              className={`form-input ${errors.email ? 'error' : ''}`}
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="nome@pumangol.co.ao"
            />
            {errors.email && <span className="form-error">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Palavra-passe</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              className={`form-input ${errors.password ? 'error' : ''}`}
              value={form.password}
              onChange={(e) => updateField('password', e.target.value)}
            />
            {errors.password && <span className="form-error">{errors.password}</span>}
          </div>

          <button type="submit" className="btn btn-primary btn-block login-submit" disabled={submitting}>
            <LogIn size={18} />
            {submitting ? 'A entrar…' : 'Entrar'}
          </button>
        </form>

        <p className="login-footer">
          É cliente? Não precisa de conta: <Link to="/">volte à loja</Link> e encomende directamente.
        </p>
      </div>
    </div>
  );
}
