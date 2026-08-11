import { describe, expect, it } from 'vitest';
import { getApiErrorMessage } from './api-error';

describe('getApiErrorMessage', () => {
  it('returns message from AxiosError with string response message', () => {
    const err = {
      response: { data: { message: 'Insufficient stock' } },
    };
    expect(getApiErrorMessage(err)).toBe('Insufficient stock');
  });

  it('joins array response messages (Zod validation)', () => {
    const err = {
      response: {
        data: { message: ['name must be at least 2 chars', 'email invalid'] },
      },
    };
    expect(getApiErrorMessage(err)).toBe(
      'name must be at least 2 chars, email invalid',
    );
  });

  it('returns Error.message for network errors', () => {
    const err = new Error('Servidor indisponível. Verifique sua conexão.');
    expect(getApiErrorMessage(err)).toBe(
      'Servidor indisponível. Verifique sua conexão.',
    );
  });

  it('returns generic message when no response and not an Error', () => {
    expect(getApiErrorMessage({ foo: 'bar' })).toBe(
      'Ocorreu um erro inesperado',
    );
  });

  it('returns generic message for null/undefined', () => {
    expect(getApiErrorMessage(null)).toBe('Erro inesperado');
    expect(getApiErrorMessage(undefined)).toBe('Erro inesperado');
  });

  it('returns generic message when response has no message', () => {
    const err = { response: { data: {} } };
    expect(getApiErrorMessage(err)).toBe('Ocorreu um erro inesperado');
  });
});
