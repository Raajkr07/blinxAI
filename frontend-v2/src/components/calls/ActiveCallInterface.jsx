import { useEffect, useState, useRef } from 'react';
import { useAuthStore, useCallStore } from '../../stores';
import { Button, Avatar } from '../ui';
import { motion as Motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';


export function ActiveCallInterface() {
    const { user } = useAuthStore();
    const {
        activeCall,
        callStatus,
        isVideoEnabled,
        isAudioEnabled,
        isScreenSharing,
        remoteStream,
        localStream,
        connectionState,
        isRemoteRinging,
        toggleVideo,
        toggleAudio,
        toggleScreenShare,
        endCall,
    } = useCallStore();

    const [callDuration, setCallDuration] = useState(0);

    // Video element refs
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const remoteAudioRef = useRef(null);

    // Attach local stream to video element
    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream, isVideoEnabled]);

    // Attach remote stream to video AND audio elements
    useEffect(() => {
        if (remoteStream) {
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
                // Force play in case autoplay is blocked
                remoteVideoRef.current.play().catch(() => { });
            }
            if (remoteAudioRef.current) {
                remoteAudioRef.current.srcObject = remoteStream;
                remoteAudioRef.current.play().catch(() => { });
            }
            console.log('[ActiveCallInterface] Remote stream attached, tracks:', remoteStream.getTracks().map(t => `${t.kind}:${t.readyState}`));
        }
    }, [remoteStream]);

    // Track call duration
    useEffect(() => {
        if (callStatus === 'active' && activeCall) {
            const interval = setInterval(() => {
                setCallDuration((prev) => prev + 1);
            }, 1000);

            return () => {
                clearInterval(interval);
                setCallDuration(0);
            };
        }
    }, [callStatus, activeCall]);

    const handleEndCall = () => {
        endCall();
        toast.success('Call ended');
    };

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    if (!activeCall && callStatus !== 'ended') return null;

    const isVideo = activeCall?.type === 'VIDEO' || activeCall?.type === 'video';
    const isCalling = callStatus === 'calling';
    const isConnecting = connectionState === 'connecting' || connectionState === 'waiting';

    const getOtherUserName = () => {
        if (!activeCall || !user) return 'Unknown';
        const isIncoming = activeCall.receiverId === user.id;
        const name = isIncoming ? activeCall.callerName : activeCall.receiverName;
        return name || `User ${isIncoming ? activeCall.callerId : activeCall.receiverId}`;
    };

    const getOtherUserAvatar = () => {
        if (!activeCall || !user) return null;
        const isIncoming = activeCall.receiverId === user.id;
        return isIncoming ? activeCall.callerAvatar : activeCall.receiverAvatar;
    };

    const otherUserName = getOtherUserName();
    const otherUserAvatar = getOtherUserAvatar();

    const getStatusText = () => {
        if (callStatus === 'ended') return 'Call Ended';
        if (isCalling) {
            return isRemoteRinging ? 'Ringing...' : 'Calling...';
        }
        if (isConnecting) return 'Connecting...';
        return formatDuration(callDuration);
    };

    return (
        <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[var(--z-modal)] bg-[var(--color-background)] flex flex-col font-sans"
        >
            {/* Main View Area */}
            <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                {isVideo ? (
                    <div className="w-full h-full bg-[var(--color-background)] relative">
                        {/* Remote video (full screen) */}
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            className={cn(
                                "w-full h-full object-cover transition-opacity duration-700",
                                remoteStream ? "opacity-100" : "opacity-0"
                            )}
                        />

                        {/* Placeholder when no remote stream or calling */}
                        {(!remoteStream || isCalling) && (
                            <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-background)]">
                                <Motion.div
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="text-center"
                                >
                                    <div className="relative mb-6">
                                        <Avatar
                                            src={otherUserAvatar}
                                            name={otherUserName}
                                            size="2xl"
                                            className="mx-auto ring-4 ring-[var(--color-border)]"
                                        />
                                        {isCalling && (
                                            <Motion.div
                                                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                                                transition={{ duration: 2, repeat: Infinity }}
                                                className="absolute inset-0 rounded-full bg-blue-500/20 -z-10"
                                            />
                                        )}
                                    </div>
                                    <h2 className="text-2xl font-bold text-[var(--color-foreground)] mb-2">{otherUserName}</h2>
                                    <p className="text-blue-500 font-medium tracking-wide">
                                        {getStatusText()}
                                    </p>
                                </Motion.div>
                            </div>
                        )}

                        {/* Local video preview */}
                        {localStream && isVideoEnabled && (
                            <Motion.div
                                layout
                                initial={{ scale: 0.8, opacity: 0, x: 20, y: 20 }}
                                animate={{ scale: 1, opacity: 1, x: 0, y: 0 }}
                                className="absolute top-6 right-6 w-40 sm:w-56 aspect-video rounded-2xl overflow-hidden border border-[var(--color-border)] shadow-2xl z-20 bg-[var(--color-background)]"
                            >
                                <video
                                    ref={localVideoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-cover mirror"
                                />
                                <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-[10px] text-[var(--color-gray-400)] bg-[var(--color-background)]/80 backdrop-blur-sm">
                                    You
                                </div>
                            </Motion.div>
                        )}
                    </div>
                ) : (
                    /* Audio Call UI */
                    <div className="w-full h-full bg-[var(--color-background)] flex items-center justify-center">
                        <div className="text-center">
                            <Motion.div
                                animate={isCalling ? {
                                    scale: [1, 1.05, 1],
                                    boxShadow: ["0 0 0 0px rgba(59, 130, 246, 0)", "0 0 0 20px rgba(59, 130, 246, 0.1)", "0 0 0 40px rgba(59, 130, 246, 0)"]
                                } : {}}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="mb-8 inline-block rounded-full"
                            >
                                <Avatar
                                    src={otherUserAvatar}
                                    name={otherUserName}
                                    size="2xl"
                                    className="mx-auto ring-8 ring-[var(--color-border)]"
                                />
                            </Motion.div>
                            <h2 className="text-3xl font-bold text-[var(--color-foreground)] mb-3">
                                {otherUserName}
                            </h2>
                            <div className="flex items-center justify-center gap-2">
                                <div className={cn(
                                    "h-2 w-2 rounded-full",
                                    callStatus === 'active' ? "bg-green-500" : "bg-blue-500 animate-pulse"
                                )} />
                                <p className="text-lg text-[var(--color-gray-400)] font-medium">
                                    {getStatusText()}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Top Status Bar */}
                <div className="absolute top-6 left-6 z-30">
                    <div className="px-4 py-2 rounded-2xl flex items-center gap-3 border border-[var(--color-border)] bg-[var(--color-background)]/80 backdrop-blur-md">
                        <div className={cn(
                            'h-2 w-2 rounded-full',
                            callStatus === 'active' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-yellow-500 animate-pulse'
                        )} />
                        <span className="text-xs font-bold text-[var(--color-foreground)] tracking-widest uppercase opacity-80">
                            {getStatusText()}
                        </span>
                        {callStatus === 'active' && connectionState !== 'connected' && (
                            <span className="text-[10px] text-yellow-500 font-medium">
                                • {connectionState}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Controls Bar */}
            <div className="px-6 py-10 bg-gradient-to-t from-[var(--color-background)] via-[var(--color-background)]/90 to-transparent z-40">
                <div className="max-w-xl mx-auto flex items-center justify-center gap-4 sm:gap-8">

                    {/* Audio Toggle */}
                    <div className="flex flex-col items-center gap-2">
                        <Button
                            variant={isAudioEnabled ? 'ghost' : 'danger'}
                            size="icon"
                            onClick={toggleAudio}
                            className={cn(
                                "h-14 w-14 rounded-full transition-all duration-300 hover:scale-110 border border-[var(--color-border)]",
                                isAudioEnabled
                                    ? "bg-[var(--color-background)] text-[var(--color-foreground)] hover:bg-[var(--color-border)]"
                                    : "bg-red-500/90 border-red-500/50 text-white"
                            )}
                        >
                            {isAudioEnabled ? (
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v1a7 7 0 0 1-14 0v-1" /><line x1="12" x2="12" y1="19" y2="22" /></svg>
                            ) : (
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="2" x2="22" y1="2" y2="22" /><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-1" /><path d="M5 10v1a7 7 0 0 0 12 5" /><path d="M15 9.34V5a3 3 0 0 0-5.94-.6" /><line x1="12" x2="12" y1="19" y2="22" /></svg>
                            )}
                        </Button>
                        <span className="text-[10px] font-bold text-[var(--color-gray-500)] uppercase tracking-tighter">Mic</span>
                    </div>

                    {/* Video Toggle */}
                    {isVideo && (
                        <div className="flex flex-col items-center gap-2">
                            <Button
                                variant={isVideoEnabled ? 'ghost' : 'danger'}
                                size="icon"
                                onClick={toggleVideo}
                                className={cn(
                                    "h-14 w-14 rounded-full transition-all duration-300 hover:scale-110 border border-[var(--color-border)]",
                                    isVideoEnabled
                                        ? "bg-[var(--color-background)] text-[var(--color-foreground)] hover:bg-[var(--color-border)]"
                                        : "bg-red-500/90 border-red-500/50 text-white"
                                )}
                            >
                                {isVideoEnabled ? (
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z" /><rect width="14" height="12" x="2" y="6" rx="2" ry="2" /></svg>
                                ) : (
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="2" x2="22" y1="2" y2="22" /><path d="m22 8-6 4 6 4V8Z" /><rect width="14" height="12" x="2" y="6" rx="2" ry="2" /></svg>
                                )}
                            </Button>
                            <span className="text-[10px] font-bold text-[var(--color-gray-500)] uppercase tracking-tighter">Camera</span>
                        </div>
                    )}

                    {/* End Call Button */}
                    <div className="flex flex-col items-center gap-2">
                        <Button
                            variant="danger"
                            size="icon"
                            onClick={handleEndCall}
                            className="h-16 w-16 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)] hover:shadow-[0_0_30px_rgba(220,38,38,0.6)] transition-all duration-300 hover:scale-110 active:scale-95"
                        >
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="rotate-[135deg]"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" /></svg>
                        </Button>
                        <span className="text-[10px] font-bold text-[var(--color-gray-500)] uppercase tracking-tighter">End</span>
                    </div>

                    {/* Screen Share */}
                    {isVideo && (
                        <div className="flex flex-col items-center gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={toggleScreenShare}
                                className={cn(
                                    "h-14 w-14 rounded-full transition-all duration-300 hover:scale-110 border border-[var(--color-border)]",
                                    isScreenSharing
                                        ? "bg-blue-600 border-blue-400/50 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                                        : "bg-[var(--color-background)] text-[var(--color-foreground)] hover:bg-[var(--color-border)]"
                                )}
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" x2="12" y1="2" y2="15" /></svg>
                            </Button>
                            <span className="text-[10px] font-bold text-[var(--color-gray-500)] uppercase tracking-tighter">Share</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Hidden audio element for remote audio playback */}
            <audio
                ref={remoteAudioRef}
                autoPlay
                playsInline
                className="hidden"
            />
        </Motion.div>
    );
}
