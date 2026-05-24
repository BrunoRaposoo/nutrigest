import { motion } from 'framer-motion';
import { BarChart3, ClipboardList, UserPlus } from 'lucide-react';

const steps = [
  {
    icon: UserPlus,
    title: 'Cadastre-se',
    desc: 'Crie sua conta em segundos e comece a usar.',
  },
  {
    icon: ClipboardList,
    title: 'Registre Movimentações',
    desc: 'Entradas, reposições e retiradas com poucos cliques.',
  },
  {
    icon: BarChart3,
    title: 'Acompanhe em Tempo Real',
    desc: 'Relatórios e gráficos atualizados automaticamente.',
  },
];

export function HowItWorks() {
  return (
    <section className="py-20 px-4 bg-surface-secondary dark:bg-surface-dark">
      <div className="max-w-4xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl md:text-4xl font-bold text-center text-navy-900 dark:text-white"
        >
          Como funciona
        </motion.h2>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2 }}
              className="flex flex-col items-center text-center"
            >
              <div className="w-16 h-16 rounded-full bg-gold-500 flex items-center justify-center mb-4">
                <step.icon className="h-8 w-8 text-navy-900" />
              </div>
              <span className="text-sm font-bold text-gold-500 mb-2">
                PASSO {i + 1}
              </span>
              <h3 className="text-lg font-semibold text-navy-900 dark:text-white">
                {step.title}
              </h3>
              <p className="mt-2 text-gray-500 dark:text-gray-400">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
