import {
  ArrowLeftRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Refrigerator,
  UserCircle,
  Users,
  UtensilsCrossed,
  Warehouse,
  X,
} from 'lucide-react';
import { type ComponentType, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/auth-context';
import { cn } from '../../lib/utils';
import type { Role } from '../../types/auth';
import { ThemeToggle } from '../shared/theme-toggle';
import { Button } from '../ui/button';

const navItems: Array<{
  path: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  roles: Role[];
}> = [
  {
    path: '/app/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: ['ADMIN', 'TECHNICIAN'],
  },
  {
    path: '/app/produtos',
    label: 'Produtos',
    icon: Package,
    roles: ['ADMIN', 'TECHNICIAN', 'OPERATOR'],
  },
  {
    path: '/app/estoque-central',
    label: 'Estoque Central',
    icon: Warehouse,
    roles: ['ADMIN', 'TECHNICIAN', 'OPERATOR'],
  },
  {
    path: '/app/padrao-frigobar',
    label: 'Padrão Frigobar',
    icon: Refrigerator,
    roles: ['ADMIN', 'TECHNICIAN', 'OPERATOR'],
  },
  {
    path: '/app/movimentacoes',
    label: 'Movimentações',
    icon: ArrowLeftRight,
    roles: ['ADMIN', 'TECHNICIAN', 'OPERATOR'],
  },
  { path: '/app/usuarios', label: 'Usuários', icon: Users, roles: ['ADMIN'] },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const visibleItems = navItems.filter(
    (item) => user && item.roles.includes(user.role),
  );

  return (
    <div className="min-h-screen bg-surface-secondary dark:bg-surface-dark flex transition-theme">
      {sidebarOpen && (
        <>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: mobile overlay backdrop */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: mobile overlay backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        </>
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-navy-800 border-r border-gray-200 dark:border-gray-800 transform transition-transform transition-theme lg:translate-x-0 lg:static lg:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 dark:border-gray-800">
          <Link
            to="/app/dashboard"
            className="flex items-center gap-2 text-navy-700 dark:text-gold-500"
          >
            <UtensilsCrossed className="h-6 w-6" />
            <span className="font-bold text-lg">Nutrigest</span>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="p-4 space-y-1">
          {visibleItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-navy-700 text-white dark:bg-gold-500 dark:text-navy-900'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-navy-700',
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white dark:bg-navy-800 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 lg:px-6 transition-theme">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden"
          >
            <Menu className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div className="flex items-center gap-3 ml-auto">
            <ThemeToggle />
            <Link
              to="/app/perfil"
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-navy-700 dark:hover:text-gold-500"
            >
              <UserCircle className="h-5 w-5" />
              <span className="hidden sm:inline">{user?.name}</span>
            </Link>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
