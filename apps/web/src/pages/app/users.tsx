import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Dialog } from '../../components/ui/dialog';
import { ErrorBanner } from '../../components/ui/error-banner';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Skeleton } from '../../components/ui/skeleton';
import { useAuth } from '../../contexts/auth-context';
import {
  useCreateUser,
  useDeleteUser,
  useUsers,
} from '../../hooks/queries/use-auth-queries';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/api-error';
import type { User } from '../../types/auth';

const userSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  password: z
    .string()
    .min(6, 'Senha deve ter no mínimo 6 caracteres')
    .optional()
    .or(z.literal('')),
  role: z.enum(['ADMIN', 'TECHNICIAN', 'OPERATOR']),
});

type UserForm = z.infer<typeof userSchema>;

export default function Users() {
  const qc = useQueryClient();
  const { user: currentUser } = useAuth();
  const { data: users, isLoading } = useUsers();
  const createUser = useCreateUser();
  const deleteUser = useDeleteUser();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formError, setFormError] = useState('');

  const isAdmin = currentUser?.role === 'ADMIN';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserForm>({
    resolver: zodResolver(userSchema),
  });

  const openCreate = () => {
    setFormError('');
    createUser.reset();
    setEditingUser(null);
    reset({ name: '', email: '', password: '', role: 'OPERATOR' });
    setDialogOpen(true);
  };

  const openEdit = (u: User) => {
    setFormError('');
    createUser.reset();
    setEditingUser(u);
    reset({ name: u.name, email: u.email, password: '', role: u.role });
    setDialogOpen(true);
  };

  const onSubmit = async (data: UserForm) => {
    setFormError('');
    try {
      if (editingUser) {
        const payload: Record<string, string> = {
          name: data.name,
          email: data.email,
          role: data.role,
        };
        if (data.password) payload.password = data.password;
        await api.patch(`/users/${editingUser.id}`, payload);
        qc.invalidateQueries({ queryKey: ['users'] });
      } else {
        await createUser.mutateAsync(data as Required<typeof data>);
      }
      setDialogOpen(false);
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este usuário?')) {
      await deleteUser.mutateAsync(id);
    }
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        Acesso restrito a administradores.
      </div>
    );
  }

  const roleLabels: Record<string, string> = {
    ADMIN: 'Admin',
    TECHNICIAN: 'Técnico',
    OPERATOR: 'Operador',
  };

  const roleVariants: Record<string, 'danger' | 'info' | 'default'> = {
    ADMIN: 'danger',
    TECHNICIAN: 'info',
    OPERATOR: 'default',
  };

  return (
    <div className="space-y-6 transition-theme">
      {deleteUser.isError && (
        <ErrorBanner
          message={getApiErrorMessage(deleteUser.error)}
          onDismiss={() => deleteUser.reset()}
        />
      )}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Usuários
        </h1>
        <Button onClick={openCreate}>Novo Usuário</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                /* biome-ignore lint/suspicious/noArrayIndexKey: skeleton loading placeholder */
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    <th className="text-left p-3 font-medium text-gray-500 dark:text-gray-400">
                      Nome
                    </th>
                    <th className="text-left p-3 font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                      E-mail
                    </th>
                    <th className="text-left p-3 font-medium text-gray-500 dark:text-gray-400">
                      Role
                    </th>
                    <th className="text-right p-3 font-medium text-gray-500 dark:text-gray-400">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users?.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-gray-100 dark:border-gray-800/50"
                    >
                      <td className="p-3 text-gray-900 dark:text-gray-100">
                        {u.name}
                      </td>
                      <td className="p-3 text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                        {u.email}
                      </td>
                      <td className="p-3">
                        <Badge variant={roleVariants[u.role]}>
                          {roleLabels[u.role]}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(u)}
                          >
                            Editar
                          </Button>
                          {u.id !== currentUser?.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(u.id)}
                              className="text-red-500"
                            >
                              Excluir
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingUser ? 'Editar Usuário' : 'Novo Usuário'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {(formError ||
            (createUser.isError && getApiErrorMessage(createUser.error))) && (
            <ErrorBanner
              message={formError || getApiErrorMessage(createUser.error)}
              onDismiss={() => {
                setFormError('');
                createUser.reset();
              }}
            />
          )}
          <Input
            id="name"
            label="Nome"
            error={errors.name?.message}
            {...register('name')}
          />
          <Input
            id="email"
            label="E-mail"
            type="email"
            error={errors.email?.message}
            {...register('email')}
          />
          {!editingUser && (
            <Input
              id="password"
              label="Senha"
              type="password"
              error={errors.password?.message}
              {...register('password')}
            />
          )}
          {editingUser && (
            <Input
              id="password"
              label="Nova senha (deixar vazio para manter)"
              type="password"
              error={errors.password?.message}
              {...register('password')}
            />
          )}
          <Select
            id="role"
            label="Função"
            options={[
              { value: 'ADMIN', label: 'Administrador' },
              { value: 'TECHNICIAN', label: 'Técnico' },
              { value: 'OPERATOR', label: 'Operador' },
            ]}
            error={errors.role?.message}
            {...register('role')}
          />
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {editingUser ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
