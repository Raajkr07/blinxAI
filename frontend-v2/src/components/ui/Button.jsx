import { cn } from '../../lib/utils';
import { forwardRef } from 'react';

const buttonVariants = {
    default: 'bg-[var(--color-foreground)] text-[var(--color-background)] hover:opacity-90 border-[var(--color-foreground)]',
    outline: 'bg-transparent text-[var(--color-foreground)] border-[var(--color-foreground)] hover:bg-[var(--color-foreground)] hover:text-[var(--color-background)]',
    ghost: 'bg-transparent text-[var(--color-foreground)] hover:bg-[var(--color-border)] border-transparent',
    glass: 'glass text-[var(--color-foreground)] hover:glass-strong',
    danger: 'bg-red-600 text-white hover:bg-red-700 border-red-600',
};

const buttonSizes = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4 text-base',
    lg: 'h-12 px-6 text-lg',
    icon: 'h-10 w-10',
};

export const Button = forwardRef(
    (
        {
            className,
            variant = 'default',
            size = 'md',
            disabled = false,
            loading = false,
            children,
            ...props
        },
        ref
    ) => {
        return (
            <button
                ref={ref}
                type={props.type || 'button'}
                disabled={disabled || loading}
                className={cn(
                    'inline-flex items-center justify-center gap-2',
                    'rounded-lg border font-medium',
                    'transition-all duration-200',
                    'focus-ring',
                    'focus-ring',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'cursor-pointer',
                    'hover-lift',
                    buttonVariants[variant],
                    buttonSizes[size],
                    className
                )}
                {...props}
            >
                {loading && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
                {children}
            </button>
        );
    }
);

Button.displayName = 'Button';
