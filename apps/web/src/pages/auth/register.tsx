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

const registerSchema = z
  .object({
    name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
    email: z.string().email('E-mail inválido'),
    password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Senhas não conferem',
    path: ['confirmPassword'],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export default function Register() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    setError('');
    try {
      await registerUser(data.name, data.email, data.password);
      navigate('/login', { state: { registered: true } });
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? ((err as { response: { data: { message: string } } }).response?.data
              ?.message ?? 'Erro ao criar conta')
          : 'Erro ao criar conta';
      setError(msg);
    }
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Criar Conta</CardTitle>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Preencha os dados para se cadastrar
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
            id="name"
            label="Nome completo"
            placeholder="Seu nome"
            error={errors.name?.message}
            {...register('name')}
          />
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
            placeholder="Mínimo 6 caracteres"
            error={errors.password?.message}
            {...register('password')}
          />
          <PasswordInput
            id="confirmPassword"
            label="Confirmar senha"
            placeholder="Repita a senha"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
          <Button type="submit" className="w-full" isLoading={isSubmitting}>
            Criar conta
          </Button>
        </form>
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
          Já tem conta?{' '}
          <Link
            to="/login"
            className="text-navy-700 dark:text-gold-500 hover:underline font-medium"
          >
            Entrar
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
