import { forwardRef, type LabelHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

const Label = forwardRef<
  HTMLLabelElement,
  LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  // biome-ignore lint/a11y/noLabelWithoutControl: generic label used by consumers with htmlFor
  <label
    ref={ref}
    className={cn(
      'text-sm font-medium text-gray-700 dark:text-gray-300',
      className,
    )}
    {...props}
  />
));
Label.displayName = 'Label';

export { Label };
