import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            'flex h-10 w-full rounded-lg border bg-white px-3 py-2 text-sm placeholder:text-gray-400 transition-theme',
            'focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500',
            'dark:bg-navy-800 dark:text-gray-100 dark:border-gray-700',
            error
              ? 'border-red-500 focus:ring-red-500/50'
              : 'border-gray-300 dark:border-gray-700',
            className,
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  },
);
Input.displayName = 'Input';

export type { InputProps };
export { Input };
