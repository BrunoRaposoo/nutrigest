import { motion } from 'framer-motion';
import { UtensilsCrossed } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/button';

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-navy-900">
      <div className="absolute inset-0 bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700" />
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-gold-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <nav className="absolute top-0 left-0 right-0 flex items-center justify-between p-6 z-10">
        <Link to="/" className="flex items-center gap-2 text-gold-500">
          <UtensilsCrossed className="h-6 w-6" />
          <span className="font-bold text-xl">Nutrigest</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/login">
            <Button
              variant="outline"
              size="sm"
              className="text-white border-white/30 hover:bg-white/10"
            >
              Entrar
            </Button>
          </Link>
          <Link to="/register">
            <Button
              size="sm"
              className="bg-gold-500 text-navy-900 hover:bg-gold-400"
            >
              Começar
            </Button>
          </Link>
        </div>
      </nav>

      <div className="relative z-10 text-center px-4 max-w-4xl">
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-white leading-tight"
        >
          Controle Nutricional{' '}
          <span className="text-gold-500">Inteligente</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mt-6 text-lg md:text-xl text-gray-300 max-w-2xl mx-auto"
        >
          Gerencie frigobares, marmitas e estoque nutricional com
          rastreabilidade completa. Deixe o papel de lado e ganhe visibilidade
          em tempo real.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link to="/register">
            <Button
              size="lg"
              className="bg-gold-500 text-navy-900 hover:bg-gold-400 text-lg px-8"
            >
              Começar Grátis
            </Button>
          </Link>
          <Link to="/login">
            <Button
              variant="outline"
              size="lg"
              className="text-white border-white/30 hover:bg-white/10 text-lg px-8"
            >
              Entrar
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
