import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import type { ApiResponse, AuthUser } from '@calendar/shared';

// ----------------------------------------------------------------
// Per-field validation
// ----------------------------------------------------------------

interface LoginFields {
  email: string;
  password: string;
}

interface FieldErrors {
  email?: string;
  password?: string;
}

function validate(fields: LoginFields): FieldErrors {
  const errors: FieldErrors = {};
  if (!fields.email.trim()) {
    errors.email = 'Email is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    errors.email = 'Enter a valid email address.';
  }
  if (!fields.password) {
    errors.password = 'Password is required.';
  }
  return errors;
}

// ----------------------------------------------------------------
// Reusable sub-components
// ----------------------------------------------------------------

function CalendarLogo() {
  return (
    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-2"
         style={{ background: 'linear-gradient(135deg,#4285F4 0%,#1a73e8 100%)' }}>
      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24"
           stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1 text-xs text-red-600 flex items-center gap-1">
      <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd" />
      </svg>
      {message}
    </p>
  );
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10"
              stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ----------------------------------------------------------------
// LoginPage
// ----------------------------------------------------------------

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect back to the page the user originally tried to visit
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/calendar';

  const [fields, setFields] = useState<LoginFields>({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFields((f) => ({ ...f, [name]: value }));
    // Clear the inline error for this field as the user types
    if (fieldErrors[name as keyof FieldErrors]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    const errors = validate(fields);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post<ApiResponse<AuthUser>>('/auth/login', {
        email: fields.email.trim(),
        password: fields.password,
      });

      if (!data.success) {
        setServerError(data.error.message);
        return;
      }

      login(data.data);
      navigate(from, { replace: true });
    } catch {
      setServerError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
         style={{ background: 'linear-gradient(135deg,#f8faff 0%,#ffffff 50%,#f0f4ff 100%)' }}>

      {/* Card — matches Google's sign-in card width and shadow */}
      <div className="w-full max-w-[400px] bg-white rounded-2xl border border-gray-200
                      shadow-[0_2px_18px_0_rgba(60,64,67,0.12)] px-10 py-10
                      animate-slide-up">

        {/* Header */}
        <div className="text-center mb-8">
          <CalendarLogo />
          <h1 className="text-2xl font-normal text-gray-800 mt-3 tracking-tight"
              style={{ fontFamily: "'Google Sans', Inter, sans-serif" }}>
            Sign in
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            to continue to Calendar
          </p>
        </div>

        {/* Server-level error banner */}
        {serverError && (
          <div role="alert"
               className="mb-5 flex items-start gap-2.5 p-3 bg-red-50 border border-red-200
                          rounded-lg text-sm text-red-700 animate-fade-in">
            <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd" />
            </svg>
            {serverError}
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-5">
          {/* Email */}
          <div>
            <label htmlFor="login-email"
                   className="block text-sm font-medium text-gray-700 mb-1.5">
              Email address
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              autoFocus
              value={fields.email}
              onChange={handleChange}
              placeholder="you@example.com"
              aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
              aria-invalid={!!fieldErrors.email}
              className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-gray-900
                          placeholder-gray-400 outline-none transition-colors duration-150
                          focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                          ${fieldErrors.email
                            ? 'border-red-400 bg-red-50 focus:ring-red-400'
                            : 'border-gray-300 bg-white hover:border-gray-400'}`}
            />
            <FieldError message={fieldErrors.email} />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="login-password"
                   className="block text-sm font-medium text-gray-700 mb-1.5">
              Password
            </label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={fields.password}
              onChange={handleChange}
              placeholder="••••••••"
              aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
              aria-invalid={!!fieldErrors.password}
              className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-gray-900
                          placeholder-gray-400 outline-none transition-colors duration-150
                          focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                          ${fieldErrors.password
                            ? 'border-red-400 bg-red-50 focus:ring-red-400'
                            : 'border-gray-300 bg-white hover:border-gray-400'}`}
            />
            <FieldError message={fieldErrors.password} />
          </div>

          {/* Submit */}
          <button
            id="login-submit"
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-lg
                       bg-[#1a73e8] hover:bg-[#1765cc] active:bg-[#185abc]
                       text-white text-sm font-medium py-2.5
                       transition-colors duration-150
                       focus-visible:outline-none focus-visible:ring-2
                       focus-visible:ring-[#1a73e8] focus-visible:ring-offset-2
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading && <Spinner />}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {/* Divider + Register link */}
        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-sm text-gray-500">
            Don&apos;t have an account?{' '}
            <Link to="/register"
                  className="text-[#1a73e8] font-medium hover:underline
                             focus-visible:outline-none focus-visible:ring-2
                             focus-visible:ring-[#1a73e8] rounded">
              Create account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
