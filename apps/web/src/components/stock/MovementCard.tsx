import { cn, formatDate } from '../../lib/utils';
import type { StockMovement } from '../../types/stock';

interface MovementCardProps {
  movement: StockMovement;
}

const typeConfig: Record<
  StockMovement['type'],
  { label: string; color: string }
> = {
  IN: {
    label: 'Entrada',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
  CONSUMPTION: {
    label: 'Consumo',
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  },
  REPLENISH: {
    label: 'Reposição',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  MEAL_OUT: {
    label: 'Marmita',
    color:
      'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  },
};

export default function MovementCard({ movement }: MovementCardProps) {
  const cfg = typeConfig[movement.type];

  return (
    <div className="p-4 bg-white dark:bg-navy-800 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-xs font-medium',
              cfg.color,
            )}
          >
            {cfg.label}
          </span>
          {movement.room && (
            <span className="text-sm text-gray-500">
              Quarto {movement.room}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">
          {formatDate(movement.createdAt)}
        </span>
      </div>
      <div className="flex justify-between items-center">
        <span className="font-medium text-gray-900 dark:text-gray-100">
          {movement.productName}
        </span>
        <span className="text-lg font-bold text-gray-700 dark:text-gray-300">
          {movement.quantity}x
        </span>
      </div>
      {movement.description && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {movement.description}
        </p>
      )}
    </div>
  );
}
