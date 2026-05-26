import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PasswordInput } from './password-input';

describe('PasswordInput', () => {
  it('renders label and input', () => {
    render(<PasswordInput id="senha" label="Senha" />);
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
  });

  it('renders error message', () => {
    render(
      <PasswordInput id="senha" label="Senha" error="Campo obrigatório" />,
    );
    expect(screen.getByText('Campo obrigatório')).toBeInTheDocument();
  });

  it('starts with password type and Eye icon', () => {
    render(<PasswordInput id="senha" label="Senha" />);
    const input = screen.getByLabelText('Senha');
    expect(input).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'Mostrar senha',
    );
  });

  it('toggles to text type and EyeOff icon on click', async () => {
    render(<PasswordInput id="senha" label="Senha" />);
    const user = userEvent.setup();
    const button = screen.getByRole('button');

    await user.click(button);

    const input = screen.getByLabelText('Senha');
    expect(input).toHaveAttribute('type', 'text');
    expect(button).toHaveAttribute('aria-label', 'Esconder senha');
  });

  it('toggles back to password type on second click', async () => {
    render(<PasswordInput id="senha" label="Senha" />);
    const user = userEvent.setup();
    const button = screen.getByRole('button');

    await user.click(button);
    await user.click(button);

    const input = screen.getByLabelText('Senha');
    expect(input).toHaveAttribute('type', 'password');
    expect(button).toHaveAttribute('aria-label', 'Mostrar senha');
  });
});
