import { useEffect, useCallback, useMemo } from 'react';
import { useCallStore } from '../../stores';
import { Button, Avatar } from '../ui';
import { motion as Motion, AnimatePresence } from 'framer-motion';

export function IncomingCallDialog() {
    const { incomingCall, acceptCall, rejectCall } = useCallStore();

    const incomingCallId = incomingCall?.id;

    const handleReject = useCallback(() => {
        if (!incomingCallId) return;
        rejectCall();
    }, [incomingCallId, rejectCall]);

    const handleAccept = useCallback(async () => {
        if (!incomingCallId) return;
        try {
            await acceptCall();
        } catch (error) {
            console.error('Failed to accept call:', error);
        }
    }, [incomingCallId, acceptCall]);

    const isVideo = useMemo(() => {
        const type = incomingCall?.type || incomingCall?.callType;
        return type === 'VIDEO' || type === 'video';
    }, [incomingCall?.type, incomingCall?.callType]);

    useEffect(() => {
        if (incomingCall) {
            const timeout = setTimeout(() => {
                handleReject();
            }, 30000);

            return () => clearTimeout(timeout);
        }
    }, [incomingCall, handleReject]);

    if (!incomingCall) return null;

    return (
        <AnimatePresence>
            <Motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 sm:p-6"
            >
                {/* Backdrop */}
                <Motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-[var(--color-background)]/60 backdrop-blur-md"
                    onClick={handleReject}
                />

                {/* Dialog */}
                <Motion.div
                    initial={{ scale: 0.9, y: 20, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="rounded-[2.5rem] p-8 sm:p-12 max-w-sm w-full relative z-10 border border-[var(--color-border)] shadow-2xl overflow-hidden bg-[var(--color-background)]/80 backdrop-blur-xl"
                >
                    {/* Top accent line */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-blue-500/50 blur-xl" />

                    <div className="text-center relative">
                        {/* Avatar with pulse */}
                        <div className="mb-8 relative inline-block">
                            <Motion.div
                                animate={{
                                    scale: [1, 1.1, 1],
                                    boxShadow: ["0 0 0 0px rgba(59, 130, 246, 0)", "0 0 0 20px rgba(59, 130, 246, 0.1)", "0 0 0 40px rgba(59, 130, 246, 0)"]
                                }}
                                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                                className="rounded-full"
                            >
                                <Avatar
                                    src={incomingCall.callerAvatar}
                                    name={incomingCall.callerName}
                                    size="2xl"
                                    className="mx-auto ring-4 ring-[var(--color-border)] shadow-2xl"
                                />
                            </Motion.div>

                            {/* Call type icon badge */}
                            <div className="absolute -bottom-2 -right-2 p-2.5 rounded-2xl border border-[var(--color-border)] shadow-xl bg-[var(--color-background)]/90 backdrop-blur-sm">
                                {isVideo ? (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><path d="m22 8-6 4 6 4V8Z" /><rect width="14" height="12" x="2" y="6" rx="2" ry="2" /></svg>
                                ) : (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" /></svg>
                                )}
                            </div>
                        </div>

                        <Motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                        >
                            <h2 className="text-3xl font-bold text-[var(--color-foreground)] mb-2 tracking-tight">
                                {incomingCall.callerName}
                            </h2>
                            <p className="text-blue-500/80 font-semibold text-sm uppercase tracking-widest mb-10">
                                Incoming {isVideo ? 'Video' : 'Audio'} Call
                            </p>
                        </Motion.div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-5">
                        <Button
                            variant="danger"
                            onClick={handleReject}
                            className="flex-1 h-16 rounded-[1.5rem] bg-red-500/10 hover:bg-red-500 border-red-500/20 text-red-500 hover:text-white transition-all duration-300 group"
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="rotate-[135deg] group-hover:scale-110 transition-transform"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" /></svg>
                        </Button>
                        <Button
                            variant="default"
                            onClick={handleAccept}
                            className="flex-[2.5] h-16 rounded-[1.5rem] bg-green-500 hover:bg-green-600 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] transition-all duration-300 font-bold text-lg"
                        >
                            Accept
                        </Button>
                    </div>
                </Motion.div>
            </Motion.div>
        </AnimatePresence>
    );
}
