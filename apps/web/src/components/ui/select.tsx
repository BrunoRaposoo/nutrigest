import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';
import { Label } from './label';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, options, placeholder, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && <Label htmlFor={id}>{label}</Label>}
        <select
          ref={ref}
          id={id}
          className={cn(
            'flex h-10 w-full rounded-lg border bg-white px-3 py-2 text-sm',
            'focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500',
            'dark:bg-navy-800 dark:text-gray-100 dark:border-gray-700',
            error
              ? 'border-red-500 focus:ring-red-500/50'
              : 'border-gray-300 dark:border-gray-700',
            className,
          )}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  },
);
Select.displayName = 'Select';

export type { SelectProps };
export { Select };
