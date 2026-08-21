import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { PasswordInput } from '../../components/ui/password-input';
import { useAuth } from '../../contexts/auth-context';
import { getApiErrorMessage } from '../../lib/api-error';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setError('');
    try {
      await login(data.email, data.password);
      navigate('/app/dashboard');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err) || 'E-mail ou senha inválidos');
    }
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Entrar</CardTitle>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Acesse sua conta Nutrigest
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
          <PasswordInput
            id="password"
            label="Senha"
            placeholder="Sua senha"
            error={errors.password?.message}
            {...register('password')}
          />
          <div className="flex justify-end">
            <Link
              to="/recuperar-senha"
              className="text-xs text-navy-700 dark:text-gold-500 hover:underline"
            >
              Esqueceu a senha?
            </Link>
          </div>
          <Button type="submit" className="w-full" isLoading={isSubmitting}>
            Entrar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
