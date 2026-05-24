import { UtensilsCrossed } from 'lucide-react';
import { Link, Outlet } from 'react-router-dom';
import { ThemeToggle } from '../shared/theme-toggle';

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-surface-secondary dark:bg-surface-dark flex flex-col">
      <header className="flex items-center justify-between p-4">
        <Link
          to="/"
          className="flex items-center gap-2 text-navy-700 dark:text-gold-500"
        >
          <UtensilsCrossed className="h-6 w-6" />
          <span className="font-bold text-lg">Nutrigest</span>
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
