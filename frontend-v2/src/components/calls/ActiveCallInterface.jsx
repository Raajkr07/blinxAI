import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { callsApi } from '../../api';
import { useCallStore } from '../../stores';
import { Button, Avatar } from '../ui';
import { motion as Motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';


export function ActiveCallInterface() {
    const {
        activeCall,
        callStatus,
        isVideoEnabled,
        isAudioEnabled,
        isScreenSharing,
        toggleVideo,
        toggleAudio,
        toggleScreenShare,
        endCall,
    } = useCallStore();

    const [callDuration, setCallDuration] = useState(0);

    const endCallMutation = useMutation({
        mutationFn: (callId) => callsApi.endCall(callId),
        onSuccess: () => {
            endCall();
            toast.success('Call ended');
        },
        onError: () => {
            endCall();
        },
    });


    useEffect(() => {
        if (callStatus === 'active' && activeCall) {
            const interval = setInterval(() => {
                setCallDuration((prev) => prev + 1);
            }, 1000);

            return () => clearInterval(interval);
        }
    }, [callStatus, activeCall]);

    const handleEndCall = () => {
        if (activeCall?.id) {
            endCallMutation.mutate(activeCall.id);
        } else {
            endCall();
        }
    };

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    if (!activeCall) return null;

    const isVideo = activeCall.callType === 'video';
    const isCalling = callStatus === 'calling';

    return (
        <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[var(--z-modal)] bg-black flex flex-col"
        >

            <div className="flex-1 relative flex items-center justify-center">
                {isVideo && isVideoEnabled ? (
                    <div className="w-full h-full bg-gray-900 flex items-center justify-center">

                        <div className="text-center">
                            <div className="mb-4">
                                <Avatar
                                    src={activeCall.participants?.[0]?.avatarUrl}
                                    name={activeCall.participants?.[0]?.name}
                                    size="xl"
                                    className="mx-auto"
                                />
                            </div>
                            <p className="text-gray-400 text-sm">
                                {isCalling ? 'Calling...' : 'Video stream would appear here'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="text-center">
                        <div className="mb-6">
                            <Avatar
                                src={activeCall.participants?.[0]?.avatarUrl}
                                name={activeCall.participants?.[0]?.name}
                                size="2xl"
                                className="mx-auto"
                            />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">
                            {activeCall.participants?.[0]?.name || 'Unknown'}
                        </h2>
                        <p className="text-gray-400">
                            {isCalling ? 'Calling...' : formatDuration(callDuration)}
                        </p>
                    </div>
                )}


                {isVideo && isVideoEnabled && !isCalling && (
                    <Motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="absolute top-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden border-2 border-gray-700"
                    >
                        <div className="w-full h-full flex items-center justify-center">
                            <p className="text-xs text-gray-400">Your video</p>
                        </div>
                    </Motion.div>
                )}


                <div className="absolute top-4 left-4 glass-strong px-4 py-2 rounded-full">
                    <div className="flex items-center gap-2">
                        <div className={cn(
                            'h-2 w-2 rounded-full',
                            callStatus === 'active' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500 animate-pulse'
                        )} />
                        <span className="text-sm text-white">
                            {isCalling ? 'Calling...' : formatDuration(callDuration)}
                        </span>
                    </div>
                </div>
            </div>


            <div className="p-8 bg-gradient-to-t from-black to-transparent">
                <div className="max-w-2xl mx-auto">
                    <div className="flex items-center justify-center gap-4">

                        <Button
                            variant={isAudioEnabled ? 'glass' : 'danger'}
                            size="icon"
                            onClick={toggleAudio}
                            className="h-14 w-14 rounded-full"
                            aria-label={isAudioEnabled ? 'Mute' : 'Unmute'}
                        >
                            {isAudioEnabled ? (
                                <svg
                                    width="24"
                                    height="24"
                                    viewBox="0 0 15 15"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path
                                        d="M7.5 1C6.67157 1 6 1.67157 6 2.5V7.5C6 8.32843 6.67157 9 7.5 9C8.32843 9 9 8.32843 9 7.5V2.5C9 1.67157 8.32843 1 7.5 1Z"
                                        fill="currentColor"
                                    />
                                </svg>
                            ) : (
                                <svg
                                    width="24"
                                    height="24"
                                    viewBox="0 0 15 15"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path
                                        d="M13.5 7.5L11.5 9.5M1.5 1.5L13.5 13.5M7.5 1C6.67157 1 6 1.67157 6 2.5V7.5C6 8.32843 6.67157 9 7.5 9C8.32843 9 9 8.32843 9 7.5V2.5C9 1.67157 8.32843 1 7.5 1Z"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                    />
                                </svg>
                            )}
                        </Button>


                        {isVideo && (
                            <Button
                                variant={isVideoEnabled ? 'glass' : 'danger'}
                                size="icon"
                                onClick={toggleVideo}
                                className="h-14 w-14 rounded-full"
                                aria-label={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
                            >
                                {isVideoEnabled ? (
                                    <svg
                                        width="24"
                                        height="24"
                                        viewBox="0 0 15 15"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <path
                                            d="M0 4.5C0 3.67157 0.671573 3 1.5 3H9.5C10.3284 3 11 3.67157 11 4.5V10.5C11 11.3284 10.3284 12 9.5 12H1.5C0.671573 12 0 11.3284 0 10.5V4.5ZM11.5 5.5L14.5 3.5V11.5L11.5 9.5V5.5Z"
                                            fill="currentColor"
                                        />
                                    </svg>
                                ) : (
                                    <svg
                                        width="24"
                                        height="24"
                                        viewBox="0 0 15 15"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <path
                                            d="M1.5 1.5L13.5 13.5M0 4.5C0 3.67157 0.671573 3 1.5 3H9.5C10.3284 3 11 3.67157 11 4.5V10.5C11 11.3284 10.3284 12 9.5 12H1.5C0.671573 12 0 11.3284 0 10.5V4.5Z"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                        />
                                    </svg>
                                )}
                            </Button>
                        )}


                        <Button
                            variant="danger"
                            size="icon"
                            onClick={handleEndCall}
                            disabled={endCallMutation.isPending}
                            className="h-16 w-16 rounded-full bg-red-600 hover:bg-red-700"
                            aria-label="End call"
                        >
                            <svg
                                width="24"
                                height="24"
                                viewBox="0 0 15 15"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                className="rotate-135"
                            >
                                <path
                                    d="M7.5 1C6.67157 1 6 1.67157 6 2.5V7.5C6 8.32843 6.67157 9 7.5 9C8.32843 9 9 8.32843 9 7.5V2.5C9 1.67157 8.32843 1 7.5 1Z"
                                    fill="currentColor"
                                />
                            </svg>
                        </Button>


                        {isVideo && (
                            <Button
                                variant={isScreenSharing ? 'default' : 'glass'}
                                size="icon"
                                onClick={toggleScreenShare}
                                className="h-14 w-14 rounded-full"
                                aria-label={isScreenSharing ? 'Stop sharing' : 'Share screen'}
                            >
                                <svg
                                    width="24"
                                    height="24"
                                    viewBox="0 0 15 15"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path
                                        d="M1 3C0.447715 3 0 3.44772 0 4V11C0 11.5523 0.447715 12 1 12H14C14.5523 12 15 11.5523 15 11V4C15 3.44772 14.5523 3 14 3H1ZM7.5 6L10 8.5H5L7.5 6Z"
                                        fill="currentColor"
                                    />
                                </svg>
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </Motion.div>
    );
}
