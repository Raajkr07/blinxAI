import { useState, useEffect } from 'react';
import { Modal, ModalFooter, Button, Input } from '../ui';
import { chatService } from '../../services';
import { useChatStore } from '../../stores';
import toast from 'react-hot-toast';

export function EmailPreviewModal({ isOpen, onClose, emailInfo }) {
    const { activeConversationId } = useChatStore();
    const [isSending, setIsSending] = useState(false);
    const [to, setTo] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');

    useEffect(() => {
        if (emailInfo) {
            setTo(emailInfo.to || '');
            setSubject(emailInfo.subject || '');
            setBody(emailInfo.body || '');
        }
    }, [emailInfo, isOpen]);

    if (!emailInfo) return null;

    const handleSend = async () => {
        if (!to.trim()) {
            toast.error('Recipient required');
            return;
        }
        setIsSending(true);
        try {
            await chatService.sendEmail(to, subject, body, activeConversationId);
            toast.success('Email sent');
            onClose();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to send');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Modal
            open={isOpen}
            onOpenChange={(open) => !open && onClose()}
            title="Send Email"
            description="Compose and send via Gmail"
            size="lg"
        >
            <div className="space-y-5 py-2">
                <div className="rounded-2xl bg-white/[0.03] border border-white/5 divide-y divide-white/5">
                    <div className="p-4">
                        <label className="text-[10px] uppercase font-medium tracking-wider text-[var(--color-gray-500)] mb-1 block">To</label>
                        <Input
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                            placeholder="recipient@example.com"
                            className="bg-transparent border-none p-0 focus-visible:ring-0 h-auto shadow-none text-[var(--color-foreground)] font-medium"
                        />
                    </div>
                    <div className="p-4">
                        <label className="text-[10px] uppercase font-medium tracking-wider text-[var(--color-gray-500)] mb-1 block">Subject</label>
                        <Input
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Email subject"
                            className="bg-transparent border-none p-0 focus-visible:ring-0 h-auto shadow-none text-[var(--color-foreground)] font-medium"
                        />
                    </div>
                </div>

                <div>
                    <label className="text-[10px] uppercase font-medium tracking-wider text-[var(--color-gray-500)] mb-2 block px-1">Message</label>
                    <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        className="w-full p-4 rounded-2xl border border-white/5 bg-white/[0.02] min-h-[240px] text-[var(--color-gray-200)] text-sm leading-relaxed outline-none focus:border-blue-500/30 transition-colors resize-none custom-scrollbar"
                    />
                </div>
            </div>

            <ModalFooter>
                <Button
                    variant="ghost"
                    onClick={onClose}
                    disabled={isSending}
                    className="text-xs font-medium text-[var(--color-gray-400)]"
                >
                    Discard
                </Button>
                <Button
                    variant="default"
                    onClick={handleSend}
                    disabled={isSending}
                    loading={isSending}
                    className="text-xs font-semibold h-9 px-6"
                >
                    Send Email
                </Button>
            </ModalFooter>
        </Modal>
    );
}
