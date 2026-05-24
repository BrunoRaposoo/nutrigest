import { motion } from 'framer-motion';
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  Package,
  Refrigerator,
  Warehouse,
} from 'lucide-react';

const features = [
  {
    icon: Package,
    title: 'Gestão de Produtos',
    desc: 'Cadastre bebidas e marmitas com categorias e imagens.',
  },
  {
    icon: Warehouse,
    title: 'Estoque Central',
    desc: 'Visão unificada do saldo de todos os produtos em tempo real.',
  },
  {
    icon: Refrigerator,
    title: 'Padrão de Frigobar',
    desc: 'Defina a composição ideal de cada quarto (101-110).',
  },
  {
    icon: ArrowLeftRight,
    title: 'Movimentações',
    desc: 'Registre entradas, reposições e retiradas com um clique.',
  },
  {
    icon: BarChart3,
    title: 'Relatórios e Gráficos',
    desc: 'Acompanhe consumo por quarto, ranking de marmitas e tendências.',
  },
  {
    icon: Bell,
    title: 'Alertas Inteligentes',
    desc: 'Receba notificações de estoque baixo antes de faltar.',
  },
];

export function Features() {
  return (
    <section className="py-20 px-4 bg-white dark:bg-navy-900">
      <div className="max-w-6xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl md:text-4xl font-bold text-center text-navy-900 dark:text-white"
        >
          Tudo que você precisa
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="mt-4 text-center text-gray-500 dark:text-gray-400 max-w-2xl mx-auto"
        >
          Uma plataforma completa para gestão de estoque nutricional
        </motion.p>
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 hover:shadow-lg transition-shadow"
            >
              <feature.icon className="h-10 w-10 text-gold-500 mb-4" />
              <h3 className="text-lg font-semibold text-navy-900 dark:text-white">
                {feature.title}
              </h3>
              <p className="mt-2 text-gray-500 dark:text-gray-400">
                {feature.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
