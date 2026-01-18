import { useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { callsApi } from '../../api';
import { useCallStore } from '../../stores';
import { Button, Avatar } from '../ui';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';


export function IncomingCallDialog() {
    const { incomingCall, acceptCall, rejectCall } = useCallStore();

    const acceptMutation = useMutation({
        mutationFn: (callId) => callsApi.acceptCall(callId),
        onSuccess: () => {
            acceptCall();
            toast.success('Call accepted');
        },
        onError: () => {
            toast.error('Failed to accept call');
            rejectCall();
        },
    });

    const rejectMutation = useMutation({
        mutationFn: (callId) => callsApi.rejectCall(callId),
        onSuccess: () => {
            rejectCall();
        },
        onError: () => {
            rejectCall();
        },
    });

    const handleAccept = () => {
        if (incomingCall?.id) {
            acceptMutation.mutate(incomingCall.id);
        }
    };

    const handleReject = () => {
        if (incomingCall?.id) {
            rejectMutation.mutate(incomingCall.id);
        } else {
            rejectCall();
        }
    };


    useEffect(() => {
        if (incomingCall) {
            const timeout = setTimeout(() => {
                handleReject();
            }, 30000);

            return () => clearTimeout(timeout);
        }
    }, [incomingCall]);

    if (!incomingCall) return null;

    const isVideo = incomingCall.callType === 'video';

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/80 backdrop-blur-sm"
            >
                <motion.div
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 20 }}
                    className="glass-strong rounded-2xl p-8 max-w-md w-full mx-4"
                >

                    <div className="text-center mb-8">
                        <div className="mb-4">
                            <Avatar
                                src={incomingCall.callerAvatar}
                                name={incomingCall.callerName}
                                size="xl"
                                className="mx-auto"
                            />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">
                            {incomingCall.callerName}
                        </h2>
                        <p className="text-gray-400">
                            Incoming {isVideo ? 'video' : 'audio'} call...
                        </p>
                    </div>


                    <div className="flex justify-center mb-8">
                        <motion.div
                            animate={{
                                scale: [1, 1.2, 1],
                                opacity: [0.5, 1, 0.5],
                            }}
                            transition={{
                                duration: 1.5,
                                repeat: Infinity,
                                ease: 'easeInOut',
                            }}
                            className="h-16 w-16 rounded-full bg-white/10 flex items-center justify-center"
                        >
                            <svg
                                width="32"
                                height="32"
                                viewBox="0 0 15 15"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                className="text-white"
                            >
                                <path
                                    d="M7.5 1C6.67157 1 6 1.67157 6 2.5V7.5C6 8.32843 6.67157 9 7.5 9C8.32843 9 9 8.32843 9 7.5V2.5C9 1.67157 8.32843 1 7.5 1Z"
                                    fill="currentColor"
                                />
                            </svg>
                        </motion.div>
                    </div>


                    <div className="flex gap-4">
                        <Button
                            variant="danger"
                            size="lg"
                            onClick={handleReject}
                            disabled={rejectMutation.isPending}
                            className="flex-1"
                        >
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 15 15"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                className="mr-2"
                            >
                                <path
                                    d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z"
                                    fill="currentColor"
                                    fillRule="evenodd"
                                    clipRule="evenodd"
                                />
                            </svg>
                            Decline
                        </Button>
                        <Button
                            variant="default"
                            size="lg"
                            onClick={handleAccept}
                            disabled={acceptMutation.isPending}
                            loading={acceptMutation.isPending}
                            className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 15 15"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                className="mr-2"
                            >
                                <path
                                    d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L7.39799 11.092C7.29783 11.2452 7.13556 11.3467 6.95402 11.3699C6.77247 11.3931 6.58989 11.3355 6.45446 11.2124L3.70446 8.71241C3.44905 8.48022 3.43023 8.08494 3.66242 7.82953C3.89461 7.57412 4.28989 7.55529 4.5453 7.78749L6.75292 9.79441L10.6018 3.90792C10.7907 3.61902 11.178 3.53795 11.4669 3.72684Z"
                                    fill="currentColor"
                                    fillRule="evenodd"
                                    clipRule="evenodd"
                                />
                            </svg>
                            Accept
                        </Button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
