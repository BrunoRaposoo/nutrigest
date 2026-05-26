import { cn } from '../../lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded bg-gray-200 dark:bg-gray-700 transition-theme',
        className,
      )}
    />
  );
}
