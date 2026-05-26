import { Eye, EyeOff } from 'lucide-react';
import { forwardRef, type InputHTMLAttributes, useState } from 'react';
import { cn } from '../../lib/utils';

interface PasswordInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, label, error, id, type: _type, ...props }, ref) => {
    const [show, setShow] = useState(false);

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
        <div className="relative">
          <input
            ref={ref}
            id={id}
            type={show ? 'text' : 'password'}
            className={cn(
              'flex h-10 w-full rounded-lg border bg-white px-3 py-2 pr-10 text-sm placeholder:text-gray-400 transition-theme',
              'focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500',
              'dark:bg-navy-800 dark:text-gray-100 dark:border-gray-700',
              error
                ? 'border-red-500 focus:ring-red-500/50'
                : 'border-gray-300 dark:border-gray-700',
              className,
            )}
            {...props}
          />
          <button
            type="button"
            onClick={() => setShow((prev) => !prev)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label={show ? 'Esconder senha' : 'Mostrar senha'}
            tabIndex={-1}
          >
            {show ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';

export type { PasswordInputProps };
export { PasswordInput };
