import { X } from 'lucide-react';
import { type ReactNode, useEffect } from 'react';
import { cn } from '../../lib/utils';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  children,
  className,
}: DialogProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop overlay with Escape key handler */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onOpenChange(false);
        }}
      />
      <div
        className={cn(
          'relative z-10 w-full max-w-lg mx-4 rounded-xl border border-gray-200 bg-white shadow-xl transition-theme',
          'dark:border-gray-800 dark:bg-navy-800',
          className,
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          {title && (
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </h2>
          )}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
