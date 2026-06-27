import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

// ----------------------------------------------------------------
// Full-screen loading spinner shown while the auth context is
// verifying a stored token on first load.
// ----------------------------------------------------------------

function AuthSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <svg
          className="w-10 h-10 text-primary-500 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <p className="text-sm text-gray-400 font-medium">Loading…</p>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// PrivateRoute — renders children only when authenticated.
// Redirects to /login (preserving the intended URL) when not.
// ----------------------------------------------------------------

interface RouteProps {
  children: React.ReactNode;
}

export function PrivateRoute({ children }: RouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AuthSpinner />;

  if (!user) {
    // Preserve the intended URL so we can redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

// ----------------------------------------------------------------
// PublicRoute — renders children only when NOT authenticated.
// Redirects to /calendar if already logged in.
// ----------------------------------------------------------------

export function PublicRoute({ children }: RouteProps) {
  const { user, loading } = useAuth();

  if (loading) return <AuthSpinner />;

  if (user) {
    return <Navigate to="/calendar" replace />;
  }

  return <>{children}</>;
}
