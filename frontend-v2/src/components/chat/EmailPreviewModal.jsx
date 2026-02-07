import { useState, useEffect } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { Button, Input } from '../ui';
import { chatApi } from '../../api';
import toast from 'react-hot-toast';

export function EmailPreviewModal({ isOpen, onApprove, onDeny, emailInfo }) {
    const [recipient, setRecipient] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        if (emailInfo) {
            setRecipient(emailInfo.to || '');
            setSubject(emailInfo.subject || '');
            setBody(emailInfo.body || '');
        }
    }, [emailInfo]);

    const handleSend = async () => {
        if (!recipient) {
            toast.error('Recipient is required');
            return;
        }

        try {
            setIsSending(true);
            const response = await chatApi.sendEmail(recipient, subject, body);

            if (response.success) {
                toast.success('Email sent successfully!');
                onApprove();
            } else {
                toast.error('Failed to send email');
            }
        } catch {
            toast.error('Failed to send email');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <Motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden"
                    >
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    Send Email
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Review and confirm the email details
                                </p>
                            </div>
                            <div className="text-2xl">📧</div>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    To
                                </label>
                                <Input
                                    value={recipient}
                                    onChange={(e) => setRecipient(e.target.value)}
                                    placeholder="recipient@example.com"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Subject
                                </label>
                                <Input
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    placeholder="Subject"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Message
                                </label>
                                <textarea
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    className="w-full min-h-[150px] px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    placeholder="Email content..."
                                />
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-3">
                            <Button
                                variant="outline"
                                onClick={onDeny}
                                disabled={isSending}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSend}
                                disabled={isSending}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                {isSending ? 'Sending...' : 'Send Email'}
                            </Button>
                        </div>
                    </Motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
