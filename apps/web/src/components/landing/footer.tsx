import { UtensilsCrossed } from 'lucide-react';

export function Footer() {
  return (
    <footer className="py-8 px-4 bg-navy-900">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-gold-500">
          <UtensilsCrossed className="h-5 w-5" />
          <span className="font-bold">Nutrigest</span>
        </div>
        <p className="text-sm text-gray-400">
          &copy; {new Date().getFullYear()} Nutrigest. Todos os direitos
          reservados.
        </p>
      </div>
    </footer>
  );
}
