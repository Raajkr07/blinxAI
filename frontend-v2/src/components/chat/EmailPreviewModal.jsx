import { Modal, ModalFooter, Button } from '../ui';

export function EmailPreviewModal({ isOpen, onClose, emailInfo }) {
    if (!emailInfo) return null;

    return (
        <Modal
            open={isOpen}
            onOpenChange={(open) => !open && onClose()}
            title="Email Sent"
            description="Preview of the dispatched notification."
            size="2xl"
        >
            <div className="space-y-6">
                {/* Email Header Info */}
                <div className="flex flex-col gap-3 p-5 rounded-lg border border-[var(--color-border)] bg-gray-50/5 dark:bg-white/5">
                    <div className="grid grid-cols-[60px_1fr] items-center text-sm">
                        <span className="text-[var(--color-gray-500)] font-medium">To</span>
                        <span className="text-blue-500 font-semibold">{emailInfo.to}</span>
                    </div>
                    <div className="h-px bg-[var(--color-border)] w-full" />
                    <div className="grid grid-cols-[60px_1fr] items-center text-sm">
                        <span className="text-[var(--color-gray-500)] font-medium">From</span>
                        <span className="text-[var(--color-gray-400)] italic text-xs">Me (via Google)</span>
                    </div>
                    <div className="h-px bg-[var(--color-border)] w-full" />
                    <div className="grid grid-cols-[60px_1fr] items-start text-sm">
                        <span className="text-[var(--color-gray-500)] font-medium">Subject</span>
                        <span className="text-[var(--color-foreground)] font-bold">{emailInfo.subject}</span>
                    </div>
                </div>

                {/* Body Content */}
                <div className="p-5 rounded-lg border border-[var(--color-border)] min-h-[180px]">
                    <p className="text-[var(--color-gray-300)] text-sm whitespace-pre-wrap leading-relaxed">
                        {emailInfo.body}
                    </p>
                </div>

                {emailInfo.error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p className="text-xs text-red-500 flex items-center gap-2">
                            <span>⚠️</span> Error: {emailInfo.error}
                        </p>
                    </div>
                )}
            </div>

            <ModalFooter>
                <Button
                    onClick={onClose}
                    variant="outline"
                    className="px-8"
                >
                    Close
                </Button>
            </ModalFooter>
        </Modal>
    );
}
