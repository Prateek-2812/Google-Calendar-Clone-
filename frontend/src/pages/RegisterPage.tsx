import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import type { ApiResponse, AuthUser } from '@calendar/shared';

// ----------------------------------------------------------------
// Per-field validation
// ----------------------------------------------------------------

interface RegisterFields {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

function validate(fields: RegisterFields): FieldErrors {
  const errors: FieldErrors = {};

  if (!fields.name.trim()) {
    errors.name = 'Full name is required.';
  } else if (fields.name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters.';
  }

  if (!fields.email.trim()) {
    errors.email = 'Email is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!fields.password) {
    errors.password = 'Password is required.';
  } else if (fields.password.length < 8) {
    errors.password = 'Password must be at least 8 characters.';
  } else if (!/[A-Z]/.test(fields.password) || !/[0-9]/.test(fields.password)) {
    errors.password = 'Include at least one uppercase letter and one number.';
  }

  if (!fields.confirmPassword) {
    errors.confirmPassword = 'Please confirm your password.';
  } else if (fields.confirmPassword !== fields.password) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
}

// ----------------------------------------------------------------
// Password strength indicator
// ----------------------------------------------------------------

function strengthScore(pw: string): 0 | 1 | 2 | 3 {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  return score as 0 | 1 | 2 | 3;
}

const STRENGTH_LABEL = ['', 'Weak', 'Fair', 'Strong'] as const;
const STRENGTH_COLOR = [
  '',
  'bg-red-400',
  'bg-yellow-400',
  'bg-green-500',
] as const;

function PasswordStrength({ password }: { password: string }) {
  const score = strengthScore(password);
  if (!password) return null;
  return (
    <div className="mt-2">
      <div className="flex gap-1 h-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`flex-1 rounded-full transition-colors duration-300
                        ${score >= i ? STRENGTH_COLOR[score] : 'bg-gray-200'}`}
          />
        ))}
      </div>
      <p className={`text-xs mt-1 font-medium
                     ${score === 1 ? 'text-red-500' : score === 2 ? 'text-yellow-600' : 'text-green-600'}`}>
        {STRENGTH_LABEL[score]}
      </p>
    </div>
  );
}

// ----------------------------------------------------------------
// Shared sub-components (same as LoginPage)
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
// RegisterPage
// ----------------------------------------------------------------

export default function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [fields, setFields] = useState<RegisterFields>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFields((f) => ({ ...f, [name]: value }));
    // Clear the specific field error as the user corrects it
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
      const { data } = await api.post<ApiResponse<AuthUser>>('/auth/register', {
        name: fields.name.trim(),
        email: fields.email.trim(),
        password: fields.password,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      if (!data.success) {
        setServerError(data.error.message);
        return;
      }

      login(data.data);
      navigate('/calendar', { replace: true });
    } catch {
      setServerError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const inputClass = (field: keyof FieldErrors) =>
    `w-full rounded-lg border px-3.5 py-2.5 text-sm text-gray-900
     placeholder-gray-400 outline-none transition-colors duration-150
     focus:ring-2 focus:ring-primary-500 focus:border-primary-500
     ${fieldErrors[field]
       ? 'border-red-400 bg-red-50 focus:ring-red-400'
       : 'border-gray-300 bg-white hover:border-gray-400'}`;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10"
         style={{ background: 'linear-gradient(135deg,#f8faff 0%,#ffffff 50%,#f0f4ff 100%)' }}>

      <div className="w-full max-w-[440px] bg-white rounded-2xl border border-gray-200
                      shadow-[0_2px_18px_0_rgba(60,64,67,0.12)] px-10 py-10
                      animate-slide-up">

        {/* Header */}
        <div className="text-center mb-7">
          <CalendarLogo />
          <h1 className="text-2xl font-normal text-gray-800 mt-3 tracking-tight"
              style={{ fontFamily: "'Google Sans', Inter, sans-serif" }}>
            Create your account
          </h1>
          <p className="text-sm text-gray-500 mt-1">to continue to Calendar</p>
        </div>

        {/* Server error banner */}
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

        <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-4">
          {/* Full name */}
          <div>
            <label htmlFor="reg-name"
                   className="block text-sm font-medium text-gray-700 mb-1.5">
              Full name
            </label>
            <input
              id="reg-name"
              name="name"
              type="text"
              autoComplete="name"
              autoFocus
              value={fields.name}
              onChange={handleChange}
              placeholder="Jane Smith"
              aria-invalid={!!fieldErrors.name}
              className={inputClass('name')}
            />
            <FieldError message={fieldErrors.name} />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="reg-email"
                   className="block text-sm font-medium text-gray-700 mb-1.5">
              Email address
            </label>
            <input
              id="reg-email"
              name="email"
              type="email"
              autoComplete="email"
              value={fields.email}
              onChange={handleChange}
              placeholder="you@example.com"
              aria-invalid={!!fieldErrors.email}
              className={inputClass('email')}
            />
            <FieldError message={fieldErrors.email} />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="reg-password"
                   className="block text-sm font-medium text-gray-700 mb-1.5">
              Password
            </label>
            <input
              id="reg-password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={fields.password}
              onChange={handleChange}
              placeholder="Min. 8 characters"
              aria-invalid={!!fieldErrors.password}
              className={inputClass('password')}
            />
            {fieldErrors.password
              ? <FieldError message={fieldErrors.password} />
              : <PasswordStrength password={fields.password} />}
          </div>

          {/* Confirm password */}
          <div>
            <label htmlFor="reg-confirm"
                   className="block text-sm font-medium text-gray-700 mb-1.5">
              Confirm password
            </label>
            <input
              id="reg-confirm"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={fields.confirmPassword}
              onChange={handleChange}
              placeholder="Re-enter password"
              aria-invalid={!!fieldErrors.confirmPassword}
              className={inputClass('confirmPassword')}
            />
            <FieldError message={fieldErrors.confirmPassword} />
          </div>

          {/* Submit */}
          <button
            id="register-submit"
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-lg mt-2
                       bg-[#1a73e8] hover:bg-[#1765cc] active:bg-[#185abc]
                       text-white text-sm font-medium py-2.5
                       transition-colors duration-150
                       focus-visible:outline-none focus-visible:ring-2
                       focus-visible:ring-[#1a73e8] focus-visible:ring-offset-2
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading && <Spinner />}
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        {/* Link to login */}
        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login"
                  className="text-[#1a73e8] font-medium hover:underline
                             focus-visible:outline-none focus-visible:ring-2
                             focus-visible:ring-[#1a73e8] rounded">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
