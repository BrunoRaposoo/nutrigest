import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ForgotPassword from './forgot-password';

vi.mock('../../lib/api', () => ({
  api: { post: vi.fn() },
}));

import { api } from '../../lib/api';

const mockPost = vi.mocked(api.post);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ForgotPassword', () => {
  it('shows the server error message when the request fails', async () => {
    mockPost.mockRejectedValueOnce({
      response: { data: { message: 'E-mail não encontrado' } },
    });

    render(<ForgotPassword />);
    await userEvent.type(screen.getByLabelText('E-mail'), 'nao@existe.com');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    await waitFor(() =>
      expect(screen.getByText('E-mail não encontrado')).toBeInTheDocument(),
    );
  });

  it('shows the fallback message when the error has no payload', async () => {
    mockPost.mockRejectedValueOnce({
      response: { data: {} },
    });

    render(<ForgotPassword />);
    await userEvent.type(screen.getByLabelText('E-mail'), 'nao@existe.com');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    await waitFor(() =>
      expect(
        screen.getByText('Ocorreu um erro inesperado'),
      ).toBeInTheDocument(),
    );
  });

  it('marks the email as sent on success', async () => {
    mockPost.mockResolvedValueOnce({ data: {} });

    render(<ForgotPassword />);
    await userEvent.type(screen.getByLabelText('E-mail'), 'ok@existe.com');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    await waitFor(() =>
      expect(screen.getByText('E-mail enviado')).toBeInTheDocument(),
    );
  });
});
