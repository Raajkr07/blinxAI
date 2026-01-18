import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Button } from './Button';

export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    onConfirm,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger',
    loading = false
}) {
    return (
        <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
            <AlertDialog.Portal forceMount>
                <AnimatePresence>
                    {open && (
                        <>
                            <AlertDialog.Overlay asChild>
                                <Motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="fixed inset-0 z-[var(--z-overlay)] bg-black/60 backdrop-blur-sm"
                                />
                            </AlertDialog.Overlay>
                            <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4">
                                <AlertDialog.Content asChild>
                                    <Motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                        className="glass-strong w-full max-w-md rounded-2xl p-6 shadow-2xl overflow-hidden relative"
                                    >
                                        <AlertDialog.Title className="text-xl font-bold text-white mb-2">
                                            {title}
                                        </AlertDialog.Title>
                                        <AlertDialog.Description className="text-gray-400 mb-6 leading-relaxed">
                                            {description}
                                        </AlertDialog.Description>
                                        <div className="flex justify-end gap-3">
                                            <AlertDialog.Cancel asChild>
                                                <Button variant="ghost" onClick={() => onOpenChange(false)}>
                                                    {cancelText}
                                                </Button>
                                            </AlertDialog.Cancel>
                                            <AlertDialog.Action asChild>
                                                <Button
                                                    variant={variant}
                                                    onClick={() => {
                                                        onConfirm();
                                                        onOpenChange(false);
                                                    }}
                                                    loading={loading}
                                                >
                                                    {confirmText}
                                                </Button>
                                            </AlertDialog.Action>
                                        </div>
                                    </Motion.div>
                                </AlertDialog.Content>
                            </div>
                        </>
                    )}
                </AnimatePresence>
            </AlertDialog.Portal>
        </AlertDialog.Root>
    );
}