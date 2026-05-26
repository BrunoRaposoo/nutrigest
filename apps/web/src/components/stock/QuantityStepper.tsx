import { cn } from '../../lib/utils';

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  labelClassName?: string;
}

export default function QuantityStepper({
  value,
  onChange,
  min = 0,
  max = 99,
  label,
  labelClassName,
}: QuantityStepperProps) {
  return (
    <div className="flex items-center gap-3">
      {label && (
        <span
          className={cn(
            'text-sm min-w-20',
            labelClassName || 'text-gray-600 dark:text-gray-400',
          )}
        >
          {label}
        </span>
      )}
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-10 h-10 rounded-lg border border-gray-300 dark:border-gray-600 text-lg font-bold
                   disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-navy-700
                   transition-theme dark:text-gray-100"
      >
        −
      </button>
      <span className="w-8 text-center text-lg font-semibold text-gray-900 dark:text-gray-100">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-10 h-10 rounded-lg border border-gray-300 dark:border-gray-600 text-lg font-bold
                   disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-navy-700
                   transition-theme dark:text-gray-100"
      >
        +
      </button>
    </div>
  );
}
