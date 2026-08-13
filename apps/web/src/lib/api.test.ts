import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { beforeEach, describe, expect, it } from 'vitest';
import { api } from './api';

interface MockedRoutes {
  refreshCount: number;
  refreshFail: boolean;
  protectedCalls: number;
}

function installMockAdapter(routes: MockedRoutes) {
  api.defaults.adapter = async (
    config: InternalAxiosRequestConfig,
  ): Promise<AxiosResponse> => {
    if (config.url?.includes('/auth/refresh')) {
      routes.refreshCount += 1;
      if (routes.refreshFail) {
        throw {
          config,
          response: { status: 401, data: { message: 'Invalid refresh token' } },
        };
      }
      return {
        status: 201,
        statusText: 'OK',
        headers: {},
        config,
        data: { accessToken: 'new-access', refreshToken: 'new-refresh' },
      } as AxiosResponse;
    }

    routes.protectedCalls += 1;
    if (routes.protectedCalls === 1) {
      throw {
        config,
        response: { status: 401, data: { message: 'Unauthorized' } },
      };
    }
    return {
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      data: { ok: true },
    } as AxiosResponse;
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('silent refresh interceptor', () => {
  it('refreshes once on 401, retries the original request, and stores new tokens', async () => {
    const routes: MockedRoutes = {
      refreshCount: 0,
      refreshFail: false,
      protectedCalls: 0,
    };
    installMockAdapter(routes);
    localStorage.setItem('accessToken', 'old-access');
    localStorage.setItem('refreshToken', 'old-refresh');

    const res = await api.get('/protected');

    expect(res.status).toBe(200);
    expect(routes.refreshCount).toBe(1);
    expect(routes.protectedCalls).toBe(2);
    expect(localStorage.getItem('accessToken')).toBe('new-access');
    expect(localStorage.getItem('refreshToken')).toBe('new-refresh');
  });

  it('deduplicates concurrent 401s into a single refresh call', async () => {
    const routes: MockedRoutes = {
      refreshCount: 0,
      refreshFail: false,
      protectedCalls: 0,
    };
    installMockAdapter(routes);
    localStorage.setItem('accessToken', 'old-access');
    localStorage.setItem('refreshToken', 'old-refresh');

    const results = await Promise.all([
      api.get('/protected'),
      api.get('/protected'),
      api.get('/protected'),
    ]);

    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(routes.refreshCount).toBe(1);
    expect(localStorage.getItem('accessToken')).toBe('new-access');
  });

  it('clears session and redirects, and does not retry, when refresh fails', async () => {
    const routes: MockedRoutes = {
      refreshCount: 0,
      refreshFail: true,
      protectedCalls: 0,
    };
    installMockAdapter(routes);
    localStorage.setItem('accessToken', 'old-access');
    localStorage.setItem('refreshToken', 'old-refresh');

    await expect(api.get('/protected')).rejects.toBeDefined();

    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(routes.refreshCount).toBe(1);
  });

  it('does not attempt refresh when the original request is /auth/login', async () => {
    const routes: MockedRoutes = {
      refreshCount: 0,
      refreshFail: false,
      protectedCalls: 0,
    };
    api.defaults.adapter = async (
      config: InternalAxiosRequestConfig,
    ): Promise<AxiosResponse> => {
      if (config.url?.includes('/auth/refresh')) {
        routes.refreshCount += 1;
      }
      throw {
        config,
        response: { status: 401, data: { message: 'Unauthorized' } },
      };
    };

    await expect(api.post('/auth/login')).rejects.toBeDefined();
    expect(routes.refreshCount).toBe(0);
  });

  it('maps network errors to the server-unavailable message', async () => {
    api.defaults.adapter = async (): Promise<AxiosResponse> => {
      throw new Error('socket hang up');
    };

    await expect(api.get('/protected')).rejects.toThrow(
      'Servidor indisponível. Verifique sua conexão.',
    );
  });
});
