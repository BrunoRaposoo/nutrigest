import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from './protected-route';

vi.mock('../../contexts/auth-context', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../../contexts/auth-context';

const mockUseAuth = vi.mocked(useAuth);

function renderRoute(initialPath: string) {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <div>Login page</div> },
      {
        path: '/app',
        element: <ProtectedRoute />,
        children: [{ index: true, element: <div>Protected content</div> }],
      },
    ],
    { initialEntries: [initialPath] },
  );
  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: null,
    isAuthenticated: false,
    login: vi.fn(),
    logout: vi.fn(),
    isLoading: false,
  });
});

describe('ProtectedRoute', () => {
  it('renders the outlet when authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', name: 'Ana', email: 'ana@test.com', role: 'ADMIN' },
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      isLoading: false,
    });

    renderRoute('/app');

    expect(screen.getByText('Protected content')).toBeInTheDocument();
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
  });

  it('redirects to the login page when not authenticated', () => {
    renderRoute('/app');

    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('shows a loading state while auth is initializing', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
      isLoading: true,
    });

    renderRoute('/app');

    expect(screen.getByLabelText('Carregando')).toBeInTheDocument();
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });
});
