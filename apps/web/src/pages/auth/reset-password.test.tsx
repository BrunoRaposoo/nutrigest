import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResetPassword from './reset-password';

vi.mock('../../lib/api', () => ({
  api: { post: vi.fn() },
}));

import { api } from '../../lib/api';

const mockPost = vi.mocked(api.post);

function renderWithToken(token: string | null = 'abc123') {
  return render(
    <MemoryRouter initialEntries={[`/redefinir-senha?token=${token ?? ''}`]}>
      <ResetPassword />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ResetPassword', () => {
  it('shows the server error message when the request fails', async () => {
    mockPost.mockRejectedValueOnce({
      response: { data: { message: 'Token inválido ou expirado' } },
    });

    renderWithToken();
    await userEvent.type(screen.getByLabelText('Nova senha'), 'nova123');
    await userEvent.type(screen.getByLabelText('Confirmar senha'), 'nova123');
    await userEvent.click(screen.getByRole('button', { name: 'Redefinir' }));

    await waitFor(() =>
      expect(
        screen.getByText('Token inválido ou expirado'),
      ).toBeInTheDocument(),
    );
  });

  it('shows the fallback message when the error has no payload', async () => {
    mockPost.mockRejectedValueOnce({
      response: { data: {} },
    });

    renderWithToken();
    await userEvent.type(screen.getByLabelText('Nova senha'), 'nova123');
    await userEvent.type(screen.getByLabelText('Confirmar senha'), 'nova123');
    await userEvent.click(screen.getByRole('button', { name: 'Redefinir' }));

    await waitFor(() =>
      expect(
        screen.getByText('Ocorreu um erro inesperado'),
      ).toBeInTheDocument(),
    );
  });

  it('renders the invalid link message when no token is present', () => {
    renderWithToken(null);
    expect(screen.getByText('Link inválido ou expirado.')).toBeInTheDocument();
  });
});
