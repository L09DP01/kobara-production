import axios from 'axios';
import { storage as SecureStore } from '@/utils/storage';
import { authService } from '@/services/auth';
import { useAuthStore } from '@/store/useAuthStore';

// Uses local environment variable or defaults to production
const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://kobara.app';
const API_BASE_URL = ENV_URL.endsWith('/api') ? ENV_URL : `${ENV_URL}/api`;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('kobara_access_token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error fetching token from SecureStore', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor (Handling Refresh Token / Errors)
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Handle 401 Unauthorized errors (auto-logout without refresh)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      useAuthStore.getState().logout();
    }
    
    return Promise.reject(error);
  }
);
