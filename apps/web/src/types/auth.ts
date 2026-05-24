export type Role = 'ADMIN' | 'TECHNICIAN' | 'OPERATOR';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: Pick<User, 'id' | 'name' | 'email' | 'role'>;
}

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  role: Role;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  role?: Role;
}
