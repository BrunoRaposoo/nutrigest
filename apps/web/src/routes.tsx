import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/app-layout';
import { AuthLayout } from './components/layout/auth-layout';
import { PublicLayout } from './components/layout/public-layout';
import CentralStock from './pages/app/central-stock';
import Dashboard from './pages/app/dashboard';
import MinibarStandard from './pages/app/minibar-standard';
import Products from './pages/app/products';
import Profile from './pages/app/profile';
import StockMovements from './pages/app/stock-movements';
import Users from './pages/app/users';
import ForgotPassword from './pages/auth/forgot-password';
import Login from './pages/auth/login';
import Register from './pages/auth/register';
import ResetPassword from './pages/auth/reset-password';
import Landing from './pages/landing';
import NotFound from './pages/not-found';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <PublicLayout />,
    children: [{ index: true, element: <Landing /> }],
  },
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <Login /> },
      { path: '/register', element: <Register /> },
      { path: '/recuperar-senha', element: <ForgotPassword /> },
      { path: '/redefinir-senha', element: <ResetPassword /> },
    ],
  },
  {
    path: '/app',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/app/dashboard" replace /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'produtos', element: <Products /> },
      { path: 'estoque-central', element: <CentralStock /> },
      { path: 'padrao-frigobar', element: <MinibarStandard /> },
      { path: 'movimentacoes', element: <StockMovements /> },
      { path: 'usuarios', element: <Users /> },
      { path: 'perfil', element: <Profile /> },
    ],
  },
  { path: '*', element: <NotFound /> },
]);
