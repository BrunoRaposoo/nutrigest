import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center flex-col gap-4">
      <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
        404
      </h1>
      <p className="text-gray-500 dark:text-gray-400">Página não encontrada</p>
      <Link to="/" className="text-navy-700 dark:text-gold-500 hover:underline">
        Voltar ao início
      </Link>
    </div>
  );
}
