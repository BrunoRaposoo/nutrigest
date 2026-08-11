export function getApiErrorMessage(err: unknown): string {
  if (!err) return 'Erro inesperado';

  const data = (err as { response?: { data?: { message?: unknown } } }).response
    ?.data;
  if (data?.message) {
    if (typeof data.message === 'string') return data.message;
    if (Array.isArray(data.message)) return data.message.join(', ');
  }

  if (err instanceof Error) return err.message;

  return 'Ocorreu um erro inesperado';
}
