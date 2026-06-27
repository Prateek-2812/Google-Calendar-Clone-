import { Routes, Route, Navigate } from 'react-router-dom';
import { PrivateRoute, PublicRoute } from '@/components/PrivateRoute';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import CalendarPage from '@/pages/CalendarPage';

export default function App() {
  return (
    <Routes>
      {/* Root → redirect to /calendar */}
      <Route path="/" element={<Navigate to="/calendar" replace />} />

      {/* Protected routes */}
      <Route
        path="/calendar"
        element={
          <PrivateRoute>
            <CalendarPage />
          </PrivateRoute>
        }
      />

      {/* Public-only routes (redirect to /calendar if already authed) */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/calendar" replace />} />
    </Routes>
  );
}
