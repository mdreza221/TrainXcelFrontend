import axios from "axios";

// Read the base URL from your environment variables, defaulting to localhost for dev
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // CRITICAL: This allows the browser to send/receive HTTP-only cookies
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    
    // Automatically retry Network Errors once
    if (error.message === 'Network Error' && !config._retry) {
      config._retry = true;
      console.warn('[Axios] Retrying request due to Network Error:', config.url);
      
      // Add a small delay before retrying
      await new Promise(resolve => setTimeout(resolve, 500));
      return api(config);
    }

    const isAuthCheck = error.response?.status === 401 && config?.url?.includes('/auth/profile');
    const isProgressCheck = error.response?.status === 404 && config?.url?.includes('/progress/');

    // Don't clutter the console for expected unauthenticated checks or unenrolled course checks
    if (!isAuthCheck && !isProgressCheck) {
      console.error(`[Axios Error Interceptor] ${config?.method?.toUpperCase() || 'UNKNOWN'} ${config?.url || 'UNKNOWN_URL'} - ${error.message || 'Unknown Error'} (Status: ${error.response?.status || 'N/A'})`);
    }
    return Promise.reject(error);
  }
);