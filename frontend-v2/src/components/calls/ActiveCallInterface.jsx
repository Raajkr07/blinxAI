import { useEffect, useState, useRef } from 'react';
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
    const [mediaStream, setMediaStream] = useState(null);
    const [hasRemoteStream, setHasRemoteStream] = useState(false);

    // Video element refs for displaying streams
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);

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

    // Get media stream when call starts (permissions already granted on login)
    useEffect(() => {
        if (!activeCall) return;

        const isVideo = activeCall.type === 'VIDEO' || activeCall.callType === 'video';

        const getMediaStream = async () => {
            try {
                const constraints = {
                    audio: true,
                    video: isVideo ? { width: 1280, height: 720 } : false,
                };

                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                setMediaStream(stream);

                // Attach stream to local video element
                if (localVideoRef.current && isVideo) {
                    localVideoRef.current.srcObject = stream;
                }

                console.log('Media stream acquired for call');
            } catch (error) {
                console.error('Media stream error:', error);
                toast.error('Failed to access camera/microphone. Please check permissions.');
            }
        };

        getMediaStream();

        // Clean up media stream when component unmounts
        return () => {
            if (mediaStream) {
                mediaStream.getTracks().forEach(track => track.stop());
            }
        };
    }, [activeCall, mediaStream]);

    // Update video element when stream changes
    useEffect(() => {
        if (localVideoRef.current && mediaStream) {
            localVideoRef.current.srcObject = mediaStream;
        }
    }, [mediaStream]);

    // Monitor remote video stream
    useEffect(() => {
        const checkRemoteStream = () => {
            if (remoteVideoRef.current?.srcObject) {
                setHasRemoteStream(true);
            } else {
                setHasRemoteStream(false);
            }
        };

        // Check immediately and set up an interval to keep checking
        checkRemoteStream();
        const interval = setInterval(checkRemoteStream, 1000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (callStatus === 'active' && activeCall) {
            const interval = setInterval(() => {
                setCallDuration((prev) => prev + 1);
            }, 1000);

            return () => clearInterval(interval);
        }
    }, [callStatus, activeCall]);

    const handleEndCall = () => {
        // Stop all media tracks before ending call
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
        }

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

    const isVideo = activeCall.type === 'VIDEO' || activeCall.callType === 'video';
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
                    <div className="w-full h-full bg-gray-900 relative">
                        {/* Remote video (full screen) */}
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover"
                        />

                        {/* Placeholder when no remote stream */}
                        {!hasRemoteStream && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="text-center">
                                    <div className="mb-4">
                                        <Avatar
                                            src={activeCall.participants?.[0]?.avatarUrl}
                                            name={activeCall.participants?.[0]?.name || `User ${activeCall.receiverId || activeCall.callerId}`}
                                            size="xl"
                                            className="mx-auto"
                                        />
                                    </div>
                                    <p className="text-gray-400 text-sm">
                                        {isCalling ? 'Calling...' : 'Waiting for video...'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Local video (small preview) */}
                        {mediaStream && (
                            <Motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="absolute top-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden border-2 border-gray-700 shadow-xl"
                            >
                                <video
                                    ref={localVideoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-cover mirror"
                                />
                            </Motion.div>
                        )}
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


            <div className="p-8 bg-gradient-to-t from-black via-black/80 to-transparent">
                <div className="max-w-2xl mx-auto">
                    <div className="flex items-center justify-center gap-6">

                        {/* Mute/Unmute Button */}
                        <div className="flex flex-col items-center gap-2">
                            <Button
                                variant={isAudioEnabled ? 'glass' : 'danger'}
                                size="icon"
                                onClick={toggleAudio}
                                className={cn(
                                    "h-14 w-14 rounded-full transition-all",
                                    !isAudioEnabled && "bg-red-600 hover:bg-red-700"
                                )}
                                aria-label={isAudioEnabled ? 'Mute' : 'Unmute'}
                            >
                                {isAudioEnabled ? (
                                    <svg
                                        width="24"
                                        height="24"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
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
                                ) : (
                                    <svg
                                        width="24"
                                        height="24"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <path
                                            d="M3 3L21 21M15 9.34V5C15 3.34315 13.6569 2 12 2C10.8224 2 9.80325 2.67852 9.3122 3.66593M12 15C10.3431 15 9 13.6569 9 12V9M17 12C17 12.7286 16.8445 13.4215 16.5646 14.0463M7 11V12C7 14.7614 9.23858 17 12 17C12.9045 17 13.7571 16.7614 14.4961 16.3472M11 18.9291C7.60771 18.4439 5 15.5265 5 12V11C5 10.4477 5.44772 10 6 10C6.55228 10 7 10.4477 7 11V12M13 18.9291V21H15C15.5523 21 16 21.4477 16 22C16 22.5523 15.5523 23 15 23H9C8.44772 23 8 22.5523 8 22C8 21.4477 8.44772 21 9 21H11V18.9291"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                )}
                            </Button>
                            <span className="text-xs font-medium text-white/80">
                                {isAudioEnabled ? 'Mute' : 'Unmute'}
                            </span>
                        </div>


                        {/* Video Toggle Button */}
                        {isVideo && (
                            <div className="flex flex-col items-center gap-2">
                                <Button
                                    variant={isVideoEnabled ? 'glass' : 'danger'}
                                    size="icon"
                                    onClick={toggleVideo}
                                    className={cn(
                                        "h-14 w-14 rounded-full transition-all",
                                        !isVideoEnabled && "bg-red-600 hover:bg-red-700"
                                    )}
                                    aria-label={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
                                >
                                    {isVideoEnabled ? (
                                        <svg
                                            width="24"
                                            height="24"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                        >
                                            <path
                                                d="M3 7C3 5.89543 3.89543 5 5 5H14C15.1046 5 16 5.89543 16 7V17C16 18.1046 15.1046 19 14 19H5C3.89543 19 3 18.1046 3 17V7Z"
                                                fill="currentColor"
                                            />
                                            <path
                                                d="M17 8.5L21 6V18L17 15.5V8.5Z"
                                                fill="currentColor"
                                            />
                                        </svg>
                                    ) : (
                                        <svg
                                            width="24"
                                            height="24"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                        >
                                            <path
                                                d="M3 3L21 21M16 10.5V7C16 5.89543 15.1046 5 14 5H7M3 8V17C3 18.1046 3.89543 19 5 19H14C15.1046 19 16 18.1046 16 17V14.5M17 8.5L21 6V18L17 15.5V8.5Z"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                    )}
                                </Button>
                                <span className="text-xs font-medium text-white/80">
                                    {isVideoEnabled ? 'Stop Video' : 'Start Video'}
                                </span>
                            </div>
                        )}


                        {/* End Call Button */}
                        <div className="flex flex-col items-center gap-2">
                            <Button
                                variant="danger"
                                size="icon"
                                onClick={handleEndCall}
                                disabled={endCallMutation.isPending}
                                className="h-16 w-16 rounded-full bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/50"
                                aria-label="End call"
                            >
                                <svg
                                    width="28"
                                    height="28"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path
                                        d="M15.5 1.5C15.5 0.947715 15.0523 0.5 14.5 0.5C13.9477 0.5 13.5 0.947715 13.5 1.5V3.5C13.5 4.05228 13.9477 4.5 14.5 4.5C15.0523 4.5 15.5 4.05228 15.5 3.5V1.5ZM9.5 1.5C9.5 0.947715 9.05228 0.5 8.5 0.5C7.94772 0.5 7.5 0.947715 7.5 1.5V3.5C7.5 4.05228 7.94772 4.5 8.5 4.5C9.05228 4.5 9.5 4.05228 9.5 3.5V1.5ZM3.5 8C3.5 6.067 5.067 4.5 7 4.5H16C17.933 4.5 19.5 6.067 19.5 8V11.5C19.5 13.433 17.933 15 16 15H14.5V17H16C16.5523 17 17 17.4477 17 18C17 18.5523 16.5523 19 16 19H7C6.44772 19 6 18.5523 6 18C6 17.4477 6.44772 17 7 17H8.5V15H7C5.067 15 3.5 13.433 3.5 11.5V8ZM10.5 15H12.5V17H10.5V15Z"
                                        fill="currentColor"
                                        transform="rotate(135 12 12)"
                                    />
                                </svg>
                            </Button>
                            <span className="text-xs font-semibold text-white">
                                Hang Up
                            </span>
                        </div>


                        {/* Screen Share Button */}
                        {isVideo && (
                            <div className="flex flex-col items-center gap-2">
                                <Button
                                    variant={isScreenSharing ? 'default' : 'glass'}
                                    size="icon"
                                    onClick={toggleScreenShare}
                                    className={cn(
                                        "h-14 w-14 rounded-full transition-all",
                                        isScreenSharing && "bg-blue-600 hover:bg-blue-700"
                                    )}
                                    aria-label={isScreenSharing ? 'Stop sharing' : 'Share screen'}
                                >
                                    <svg
                                        width="24"
                                        height="24"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <path
                                            d="M3 5C3 3.89543 3.89543 3 5 3H19C20.1046 3 21 3.89543 21 5V15C21 16.1046 20.1046 17 19 17H5C3.89543 17 3 16.1046 3 15V5Z"
                                            fill="currentColor"
                                            opacity="0.3"
                                        />
                                        <path
                                            d="M12 7L15 10H13V14H11V10H9L12 7Z"
                                            fill="currentColor"
                                        />
                                        <path
                                            d="M1 19H23"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                </Button>
                                <span className="text-xs font-medium text-white/80">
                                    {isScreenSharing ? 'Stop Share' : 'Share'}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Motion.div>
    );
}
