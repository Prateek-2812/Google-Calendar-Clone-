import axios from 'axios';
import { getStoredToken } from '@/context/AuthContext';

const rawApiUrl = (import.meta.env.VITE_API_URL as string) || '';
const baseURL = rawApiUrl
  ? rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl.replace(/\/$/, '')}/api`
  : '/api';

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach the JWT Bearer token to every outgoing request.
api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401 or 403 responses, clear the stored token so the user is
// effectively logged out on the next navigation (PrivateRoute will redirect).
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      (error.response?.status === 401 || error.response?.status === 403)
    ) {
      localStorage.removeItem('calendar_token');
    }
    return Promise.reject(error);
  }
);

export default api;
