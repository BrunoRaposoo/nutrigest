import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Input } from './input';

describe('Input', () => {
  it('renders with label', () => {
    render(<Input id="email" label="E-mail" />);
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
  });

  it('renders error message', () => {
    render(<Input id="email" label="E-mail" error="Campo obrigatório" />);
    expect(screen.getByText('Campo obrigatório')).toBeInTheDocument();
  });

  it('forwards ref and handles change', async () => {
    const handleChange = vi.fn();
    render(<Input id="name" onChange={handleChange} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Bruno');
    expect(handleChange).toHaveBeenCalled();
  });

  it('applies error styles', () => {
    render(<Input id="test" error="Erro" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('border-red-500');
  });
});
