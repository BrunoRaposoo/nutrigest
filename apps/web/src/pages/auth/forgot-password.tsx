import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/api-error';

const forgotSchema = z.object({
  email: z.string().email('E-mail inválido'),
});

type ForgotForm = z.infer<typeof forgotSchema>;

export default function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
  });

  const onSubmit = async (data: ForgotForm) => {
    setError('');
    try {
      await api.post('/auth/forgot-password', data);
      setSent(true);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  if (sent) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle>E-mail enviado</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            Se o e-mail estiver cadastrado, você receberá as instruções em
            breve.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Recuperar Senha</CardTitle>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Digite seu e-mail para receber as instruções
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
          <Input
            id="email"
            type="email"
            label="E-mail"
            placeholder="seu@email.com"
            error={errors.email?.message}
            {...register('email')}
          />
          <Button type="submit" className="w-full" isLoading={isSubmitting}>
            Enviar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
