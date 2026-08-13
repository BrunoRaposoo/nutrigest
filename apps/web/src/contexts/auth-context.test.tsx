import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './auth-context';

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import type { AxiosResponse } from 'axios';
import { api } from '../lib/api';

const mockGet = vi.mocked(api.get);

function renderAuth() {
  function Probe() {
    const { user, isAuthenticated, isLoading } = useAuth();
    const text = isLoading
      ? 'loading'
      : isAuthenticated
        ? `user:${user?.name}:${user?.role}`
        : 'anonymous';
    return <div>{text}</div>;
  }

  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('AuthProvider hydration', () => {
  it('restores the session from the stored token on load', async () => {
    localStorage.setItem('accessToken', 'stored-access');
    localStorage.setItem('refreshToken', 'stored-refresh');
    mockGet.mockResolvedValueOnce({
      data: {
        id: '1',
        name: 'Ana',
        email: 'ana@test.com',
        role: 'ADMIN',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    } as AxiosResponse);

    renderAuth();

    expect(mockGet).toHaveBeenCalledWith('/auth/me');
    await waitFor(() =>
      expect(screen.getByText('user:Ana:ADMIN')).toBeInTheDocument(),
    );
  });

  it('stays anonymous when no token is stored', async () => {
    renderAuth();

    expect(mockGet).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByText('anonymous')).toBeInTheDocument(),
    );
  });

  it('clears the session when the stored token is rejected', async () => {
    localStorage.setItem('accessToken', 'stale-access');
    localStorage.setItem('refreshToken', 'stale-refresh');
    mockGet.mockRejectedValueOnce(new Error('Unauthorized'));

    renderAuth();

    await waitFor(() =>
      expect(screen.getByText('anonymous')).toBeInTheDocument(),
    );
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });
});
