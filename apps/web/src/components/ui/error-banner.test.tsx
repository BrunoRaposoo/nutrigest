import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBanner } from './error-banner';

describe('ErrorBanner', () => {
  it('renders the message', () => {
    render(<ErrorBanner message="Estoque insuficiente" />);
    expect(screen.getByText('Estoque insuficiente')).toBeInTheDocument();
  });

  it('calls onDismiss when close button is clicked', async () => {
    const onDismiss = vi.fn();
    render(<ErrorBanner message="Erro" onDismiss={onDismiss} />);
    await userEvent.click(screen.getByLabelText('Fechar'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders no close button when onDismiss is absent', () => {
    render(<ErrorBanner message="Erro" />);
    expect(screen.queryByLabelText('Fechar')).not.toBeInTheDocument();
  });
});
