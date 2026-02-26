import { cn } from '../../lib/utils';
import { forwardRef } from 'react';

export const Input = forwardRef(
    (
        {
            className,
            type = 'text',
            error = false,
            leftIcon,
            rightIcon,
            ...props
        },
        ref
    ) => {
        return (
            <div className="relative w-full">
                {leftIcon && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        {leftIcon}
                    </div>
                )}
                <input
                    ref={ref}
                    type={type}
                    className={cn(
                        'w-full h-10 px-4 rounded-lg',
                        'bg-background text-foreground placeholder:text-gray-500',
                        'border border-border',
                        'focus:outline-none focus:ring-2 focus:ring-foreground focus:border-transparent',
                        'transition-all duration-200',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        error && 'border-red-500 focus:ring-red-500',
                        leftIcon && 'pl-10',
                        rightIcon && 'pr-10',
                        className
                    )}
                    {...props}
                />
                {rightIcon && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                        {rightIcon}
                    </div>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';

export const Textarea = forwardRef(
    ({ className, error = false, ...props }, ref) => {
        return (
            <textarea
                ref={ref}
                className={cn(
                    'w-full px-4 py-3 rounded-lg',
                    'bg-background text-foreground placeholder:text-gray-500',
                    'border border-border',
                    'focus:outline-none focus:ring-2 focus:ring-foreground focus:border-transparent',
                    'transition-all duration-200',
                    'resize-none',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    error && 'border-red-500 focus:ring-red-500',
                    className
                )}
                {...props}
            />
        );
    }
);

Textarea.displayName = 'Textarea';
