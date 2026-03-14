import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          ref={ref}
          className={cn(
            'h-11 w-full rounded-2xl border border-border bg-white px-4 text-sm text-ink outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20',
            error && 'border-danger/60 focus:border-danger/60 focus:ring-danger/20',
            className
          )}
          {...props}
        />
        {error ? (
          <p className="mt-2 text-xs font-medium text-danger">{error}</p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = 'Input';
