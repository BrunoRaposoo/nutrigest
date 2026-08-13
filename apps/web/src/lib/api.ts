import type {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let isRefreshing = false;
let pendingQueue: Array<{
  config: RetryConfig;
  resolve: (value: AxiosResponse | Promise<AxiosResponse>) => void;
  reject: (reason?: unknown) => void;
}> = [];

function clearSession() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  window.location.href = '/login';
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

async function handleUnauthorized(error: AxiosError): Promise<AxiosResponse> {
  const config = error.config as RetryConfig | undefined;

  if (!error.response) {
    return Promise.reject(
      new Error('Servidor indisponível. Verifique sua conexão.'),
    );
  }

  if (
    error.response.status !== 401 ||
    !config ||
    config._retry ||
    config.url?.includes('/auth/login') ||
    config.url?.includes('/auth/refresh')
  ) {
    return Promise.reject(error);
  }

  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) {
    clearSession();
    return Promise.reject(error);
  }

  if (isRefreshing) {
    return new Promise<AxiosResponse>((resolve, reject) => {
      pendingQueue.push({ config, resolve, reject });
    });
  }

  isRefreshing = true;
  try {
    const { data } = await api.post('/auth/refresh', { refreshToken });
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);

    pendingQueue.forEach(({ config: queued, resolve }) => {
      resolve(api({ ...queued, _retry: true } as RetryConfig));
    });
    pendingQueue = [];

    return api({ ...config, _retry: true } as RetryConfig);
  } catch (refreshError) {
    pendingQueue.forEach(({ reject }) => {
      reject(refreshError);
    });
    pendingQueue = [];
    clearSession();
    return Promise.reject(refreshError);
  } finally {
    isRefreshing = false;
  }
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => handleUnauthorized(error),
);
