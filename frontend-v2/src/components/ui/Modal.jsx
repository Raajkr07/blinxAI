import * as Dialog from '@radix-ui/react-dialog';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

export function Modal({
    open,
    onOpenChange,
    title,
    description,
    children,
    size = 'md',
    showClose = true,
    className,
}) {
    const sizeClasses = {
        sm: 'max-w-[90vw] sm:max-w-sm',
        md: 'max-w-[95vw] sm:max-w-md',
        lg: 'max-w-[95vw] sm:max-w-lg',
        xl: 'max-w-[95vw] sm:max-w-xl',
        '2xl': 'max-w-[95vw] sm:max-w-2xl',
        full: 'w-[calc(100%-2rem)] max-w-full mx-4',
    };

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal forceMount>
                <AnimatePresence>
                    {open && (
                        <>
                            <Dialog.Overlay asChild>
                                <Motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[var(--z-modal-backdrop)]"
                                />
                            </Dialog.Overlay>

                            <Dialog.Content asChild>
                                <Motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                    transition={{ duration: 0.2 }}
                                    className={cn(
                                        'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
                                        'w-full flex flex-col',
                                        'max-h-[90vh]',
                                        sizeClasses[size],
                                        'glass-strong rounded-2xl border border-white/10 shadow-2xl',
                                        'z-[var(--z-modal)]',
                                        'focus:outline-none',
                                        'text-[var(--color-foreground)]',
                                        className
                                    )}
                                >
                                    <div className="px-5 pt-5 pb-3 flex-none relative">
                                        {(title || description) && (
                                            <div>
                                                {title && (
                                                    <Dialog.Title className="text-lg font-bold text-[var(--color-foreground)] mb-0.5">
                                                        {title}
                                                    </Dialog.Title>
                                                )}
                                                {description && (
                                                    <Dialog.Description className="text-xs text-[var(--color-gray-500)] leading-relaxed">
                                                        {description}
                                                    </Dialog.Description>
                                                )}
                                            </div>
                                        )}

                                        {showClose && (
                                            <Dialog.Close asChild>
                                                <button
                                                    className={cn(
                                                        'absolute top-4 right-4',
                                                        'h-8 w-8 rounded-full',
                                                        'flex items-center justify-center',
                                                        'text-[var(--color-gray-400)] hover:text-[var(--color-foreground)]',
                                                        'hover:bg-white/10 transition-all duration-200',
                                                        'focus:outline-none focus:ring-2 focus:ring-white/20'
                                                    )}
                                                    aria-label="Close"
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                            </Dialog.Close>
                                        )}
                                    </div>

                                    <div className="flex-1 overflow-y-auto px-5 py-2 custom-scrollbar min-h-0">
                                        {children}
                                    </div>
                                </Motion.div>
                            </Dialog.Content>
                        </>
                    )}
                </AnimatePresence>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

export function ModalFooter({ children, className }) {
    return (
        <div
            className={cn(
                'flex items-center justify-end gap-2.5 px-5 py-3 flex-none',
                'border-t border-white/5',
                className
            )}
        >
            {children}
        </div>
    );
}
