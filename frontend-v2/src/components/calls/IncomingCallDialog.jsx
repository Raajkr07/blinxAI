import { useEffect, useCallback, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { callsApi } from '../../api';
import { useCallStore } from '../../stores';
import { Button, Avatar } from '../ui';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export function IncomingCallDialog() {
    const { incomingCall, acceptCall, rejectCall } = useCallStore();

    // Debug logging
    useEffect(() => {
        if (incomingCall) {
            console.log('IncomingCallDialog - Incoming call data:', incomingCall);
        }
    }, [incomingCall]);

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

    const incomingCallId = incomingCall?.id;

    const handleReject = useCallback(() => {
        if (!incomingCallId) return;
        rejectMutation.mutate(incomingCallId);
    }, [incomingCallId, rejectMutation]);

    const handleAccept = useCallback(() => {
        if (!incomingCallId) return;
        acceptMutation.mutate(incomingCallId);
    }, [incomingCallId, acceptMutation]);

    // Handle both uppercase and lowercase call types
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

    if (!incomingCall) {
        console.log('IncomingCallDialog - No incoming call, returning null');
        return null;
    }

    console.log('IncomingCallDialog - Rendering dialog for call:', incomingCallId);

    return (
        <AnimatePresence>
            <Motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/80 backdrop-blur-sm"
            >
                <Motion.div
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 20 }}
                    className="glass-strong rounded-2xl p-8 max-w-md w-full mx-4"
                >

                    <div className="text-center mb-8">
                        <div className="mb-6">
                            <Avatar
                                src={incomingCall.callerAvatar}
                                name={incomingCall.callerName}
                                size="xl"
                                className="mx-auto ring-4 ring-white/10"
                            />
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-3">
                            {incomingCall.callerName}
                        </h2>
                        <p className="text-lg text-gray-300 font-medium">
                            Incoming {isVideo ? 'video' : 'audio'} call...
                        </p>
                    </div>


                    <div className="flex justify-center mb-8">
                        <Motion.div
                            animate={{
                                scale: [1, 1.2, 1],
                                opacity: [0.5, 1, 0.5],
                            }}
                            transition={{
                                duration: 1.5,
                                repeat: Infinity,
                                ease: 'easeInOut',
                            }}
                            className="h-20 w-20 rounded-full bg-white/10 flex items-center justify-center"
                        >
                            <svg
                                width="40"
                                height="40"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                className="text-white"
                            >
                                <path
                                    d="M12 2C10.3431 2 9 3.34315 9 5V12C9 13.6569 10.3431 15 12 15C13.6569 15 15 13.6569 15 12V5C15 3.34315 13.6569 2 12 2Z"
                                    fill="currentColor"
                                />
                                <path
                                    d="M6 10C6.55228 10 7 10.4477 7 11V12C7 14.7614 9.23858 17 12 17C14.7614 17 17 14.7614 17 12V11C17 10.4477 17.4477 10 18 10C18.5523 10 19 10.4477 19 11V12C19 15.5265 16.3923 18.4439 13 18.9291V21H15C15.5523 21 16 21.4477 16 22C16 22.5523 15.5523 23 15 23H9C8.44772 23 8 22.5523 8 22C8 21.4477 8.44772 21 9 21H11V18.9291C7.60771 18.4439 5 15.5265 5 12V11C5 10.4477 5.44772 10 6 10Z"
                                    fill="currentColor"
                                />
                            </svg>
                        </Motion.div>
                    </div>


                    <div className="flex gap-4">
                        <div className="flex-1 flex flex-col items-center gap-2">
                            <Button
                                variant="danger"
                                size="lg"
                                onClick={handleReject}
                                disabled={rejectMutation.isPending}
                                className="w-full h-14 rounded-full bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/30"
                            >
                                <svg
                                    width="24"
                                    height="24"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="mr-2"
                                >
                                    <path
                                        d="M15.5 1.5C15.5 0.947715 15.0523 0.5 14.5 0.5C13.9477 0.5 13.5 0.947715 13.5 1.5V3.5C13.5 4.05228 13.9477 4.5 14.5 4.5C15.0523 4.5 15.5 4.05228 15.5 3.5V1.5ZM9.5 1.5C9.5 0.947715 9.05228 0.5 8.5 0.5C7.94772 0.5 7.5 0.947715 7.5 1.5V3.5C7.5 4.05228 7.94772 4.5 8.5 4.5C9.05228 4.5 9.5 4.05228 9.5 3.5V1.5ZM3.5 8C3.5 6.067 5.067 4.5 7 4.5H16C17.933 4.5 19.5 6.067 19.5 8V11.5C19.5 13.433 17.933 15 16 15H14.5V17H16C16.5523 17 17 17.4477 17 18C17 18.5523 16.5523 19 16 19H7C6.44772 19 6 18.5523 6 18C6 17.4477 6.44772 17 7 17H8.5V15H7C5.067 15 3.5 13.433 3.5 11.5V8ZM10.5 15H12.5V17H10.5V15Z"
                                        fill="currentColor"
                                        transform="rotate(135 12 12)"
                                    />
                                </svg>
                                <span className="font-semibold">Decline</span>
                            </Button>
                        </div>
                        <div className="flex-1 flex flex-col items-center gap-2">
                            <Button
                                variant="default"
                                size="lg"
                                onClick={handleAccept}
                                disabled={acceptMutation.isPending}
                                loading={acceptMutation.isPending}
                                className="w-full h-14 rounded-full bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/30"
                            >
                                <svg
                                    width="24"
                                    height="24"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="mr-2"
                                >
                                    <path
                                        d="M15.5 1.5C15.5 0.947715 15.0523 0.5 14.5 0.5C13.9477 0.5 13.5 0.947715 13.5 1.5V3.5C13.5 4.05228 13.9477 4.5 14.5 4.5C15.0523 4.5 15.5 4.05228 15.5 3.5V1.5ZM9.5 1.5C9.5 0.947715 9.05228 0.5 8.5 0.5C7.94772 0.5 7.5 0.947715 7.5 1.5V3.5C7.5 4.05228 7.94772 4.5 8.5 4.5C9.05228 4.5 9.5 4.05228 9.5 3.5V1.5ZM3.5 8C3.5 6.067 5.067 4.5 7 4.5H16C17.933 4.5 19.5 6.067 19.5 8V11.5C19.5 13.433 17.933 15 16 15H14.5V17H16C16.5523 17 17 17.4477 17 18C17 18.5523 16.5523 19 16 19H7C6.44772 19 6 18.5523 6 18C6 17.4477 6.44772 17 7 17H8.5V15H7C5.067 15 3.5 13.433 3.5 11.5V8ZM10.5 15H12.5V17H10.5V15Z"
                                        fill="currentColor"
                                    />
                                </svg>
                                <span className="font-semibold">Accept</span>
                            </Button>
                        </div>
                    </div>
                </Motion.div>
            </Motion.div>
        </AnimatePresence>
    );
}
