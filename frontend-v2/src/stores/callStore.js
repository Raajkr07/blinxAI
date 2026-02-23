import { create } from 'zustand';
import { callService } from '../services';
import { socketService } from '../services/socketService';
import { getWebRTCService, resetWebRTCService } from '../services/webrtc';
import toast from 'react-hot-toast';
import { reportErrorOnce } from '../lib/reportError';

export const useCallStore = create((set, get) => ({

    activeCall: null,
    incomingCall: null,
    callStatus: 'idle',
    isVideoEnabled: true,
    isAudioEnabled: true,
    isScreenSharing: false,
    remoteStream: null,
    localStream: null,
    connectionState: 'new',
    pendingOffer: null,
    orphanedSignals: {},
    isRemoteRinging: false,
    lastCallOutcome: null,

    // Initialize WebRTC listeners when store is created
    initializeWebRTC: (userId) => {
        if (!userId) {
            return () => { };
        }

        const subs = [];

        // Listen for WebRTC signals from backend
        subs.push(socketService.subscribe(`/topic/video/${userId}/signal`, (signal) => {
            get().handleWebRTCSignal(signal);
        }));

        // Listen for call notifications
        subs.push(socketService.subscribe(`/topic/video/${userId}/notification`, (notification) => {
            get().receiveIncomingCall(notification);
        }));

        // Listen for errors
        subs.push(socketService.subscribe(`/topic/video/${userId}/error`, (error) => {
            if (error) {
                reportErrorOnce('call-error-topic', error, 'Call error');
            }
        }));

        return () => {
            subs.forEach(sub => sub && sub.unsubscribe());
        };
    },

    // Receive incoming call notification
    receiveIncomingCall: (notification) => {
        const { activeCall, callStatus } = get();

        // Don't accept new calls if already in a call
        if (activeCall || callStatus !== 'idle') {
            return;
        }

        // Backend CallNotification uses "type" (not "callType")
        const callType = notification.type || notification.callType;

        set({
            incomingCall: {
                id: notification.callId,
                callerId: notification.callerId,
                receiverId: notification.receiverId,
                type: callType,
                conversationId: notification.conversationId,
                callerName: notification.callerName,
                callerAvatar: notification.callerAvatar,
            },
            callStatus: 'ringing',
        });

        // Process any orphaned signals for this call
        const { orphanedSignals } = get();
        const orphans = orphanedSignals[notification.callId];
        if (orphans && orphans.length > 0) {
            orphans.forEach(signal => get().handleWebRTCSignal(signal));
            const newOrphans = { ...orphanedSignals };
            delete newOrphans[notification.callId];
            set({ orphanedSignals: newOrphans });
        }
    },

    // Handle WebRTC signaling messages
    handleWebRTCSignal: async (signal) => {
        const webrtc = getWebRTCService();
        const { activeCall, incomingCall, callStatus } = get();
        const currentCall = activeCall || incomingCall;

        if (!currentCall || signal.callId !== currentCall.id) {
            // Buffer orphaned signals
            const { orphanedSignals } = get();

            if (['OFFER', 'ICE_CANDIDATE'].includes(signal.type)) {
                const currentOrphans = orphanedSignals[signal.callId] || [];
                set({
                    orphanedSignals: {
                        ...orphanedSignals,
                        [signal.callId]: [...currentOrphans, signal]
                    }
                });
            }
            return;
        }

        try {
            switch (signal.type) {
                case 'OFFER': {
                    // If call is still ringing, queue the offer
                    if (callStatus === 'ringing') {
                        set({ pendingOffer: signal });
                        return;
                    }

                    // Skip if we already processed an offer
                    if (webrtc.peerConnection?.remoteDescription) {
                        break;
                    }

                    // Create peer connection WITHOUT calling closePeerConnection
                    // (which would kill local stream tracks)
                    await webrtc.createPeerConnection(
                        (candidate) => get().sendIceCandidate(candidate),
                        (stream) => set({ remoteStream: stream }),
                        (state) => set({ connectionState: state })
                    );

                    // Add local stream tracks to the peer connection
                    const currentLocalStream = get().localStream;
                    if (currentLocalStream) {
                        webrtc.addLocalStream(currentLocalStream);
                    }
                    const answer = await webrtc.createAnswer(JSON.parse(signal.data));
                    await socketService.send('/app/video/signal', {
                        callId: currentCall.id,
                        type: 'ANSWER',
                        data: JSON.stringify(answer),
                        targetUserId: currentCall.callerId,
                    });
                    break;
                }

                case 'ANSWER':
                    await webrtc.setRemoteDescription(JSON.parse(signal.data));
                    set({ callStatus: 'active' });
                    toast.success('Call connected');
                    break;

                case 'RINGING':
                    set({ isRemoteRinging: true });
                    break;

                case 'ICE_CANDIDATE':
                    if (signal.data) {
                        try {
                            await webrtc.addIceCandidate(JSON.parse(signal.data));
                        } catch (error) {
                            reportErrorOnce('call-ice-candidate', error, 'Call connection issue');
                        }
                    }
                    break;

                case 'CALL_MISSED':
                    toast.error('Call missed');
                    get().endCall('missed');
                    break;

                case 'CALL_ENDED':
                    if (callStatus === 'calling') {
                        toast.error('Call was declined');
                    } else if (callStatus === 'active') {
                        toast('Call ended');
                    }
                    get().endCall('ended');
                    break;

                default:
                    break;
            }
        } catch (error) {
            reportErrorOnce('call-signal', error, 'Call connection issue');
        }
    },

    // Send ICE candidate to other peer
    sendIceCandidate: async (candidate) => {
        const { activeCall, incomingCall } = get();
        const currentCall = activeCall || incomingCall;

        if (!currentCall) return;

        const targetUserId = currentCall.callerId === socketService.getUserId()
            ? currentCall.receiverId
            : currentCall.callerId;

        try {
            await socketService.send('/app/video/signal', {
                callId: currentCall.id,
                type: 'ICE_CANDIDATE',
                data: JSON.stringify(candidate),
                targetUserId,
            });
        } catch (error) {
            reportErrorOnce('call-ice-send', error, 'Call connection issue');
        }
    },

    // Start a new call
    initiateCall: async (receiverId, callType) => {
        try {
            const isVideo = callType.toUpperCase() === 'VIDEO';

            // Clean up any existing call state
            resetWebRTCService();
            const { localStream: existingStream } = get();
            if (existingStream) {
                existingStream.getTracks().forEach(track => track.stop());
                set({ localStream: null });
            }

            const webrtc = getWebRTCService();

            // 1. Start media access in background
            const mediaPromise = webrtc.startLocalStream(isVideo, true).catch(() => null);

            // 2. Request server verification (busy check, persistence)
            const response = await callService.initiateCall({
                receiverId,
                type: callType.toUpperCase(),
            });

            // 3. Show calling UI immediately
            set({
                activeCall: {
                    ...response,
                    initiator: true,
                },
                callStatus: 'calling',
                isRemoteRinging: false,
                lastCallOutcome: null,
            });

            // 4. Wait for media
            const stream = await mediaPromise;
            if (!stream) {
                toast.error('Could not access camera/microphone');
                get().endCall('failed');
                return;
            }

            set({ localStream: stream });

            // 5. Set up WebRTC peer connection
            await webrtc.createPeerConnection(
                (candidate) => get().sendIceCandidate(candidate),
                (stream) => set({ remoteStream: stream }),
                (state) => set({ connectionState: state })
            );

            webrtc.addLocalStream(stream);

            // 6. Create and send offer
            const offer = await webrtc.createOffer();
            await socketService.send('/app/video/signal', {
                callId: response.id,
                type: 'OFFER',
                data: JSON.stringify(offer),
                targetUserId: receiverId,
            });
            return response;
        } catch (error) {
            set({ callStatus: 'idle' });

            const { localStream } = get();
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
                set({ localStream: null });
            }

            toast.error('Failed to start call');
            resetWebRTCService();
            throw error;
        }
    },

    // Accept incoming call
    acceptCall: async () => {
        const { incomingCall } = get();
        if (!incomingCall) return;

        try {
            // Clean up any existing streams
            const { localStream: existingStream } = get();
            if (existingStream) {
                existingStream.getTracks().forEach(track => track.stop());
                set({ localStream: null });
            }

            // 1. Accept call on backend
            await callService.acceptCall(incomingCall.id);

            // 2. Get a fresh WebRTC service and obtain local media
            //    DO NOT call resetWebRTCService() here — it would destroy
            //    the ICE queue. Instead, just get the service instance.
            const webrtc = getWebRTCService();
            const isVideo = incomingCall.type === 'VIDEO';
            const stream = await webrtc.startLocalStream(isVideo, true);

            // 3. Store the stream and transition to active state FIRST
            //    so OFFER handler won't re-queue the signal
            set({
                activeCall: incomingCall,
                incomingCall: null,
                callStatus: 'active',
                localStream: stream,
                isRemoteRinging: false,
            });

            // 4. Process pending offer (won't be re-queued since status is 'active')
            const { pendingOffer, orphanedSignals } = get();

            if (pendingOffer) {
                try {
                    await get().handleWebRTCSignal(pendingOffer);
                    set({ pendingOffer: null });
                } catch (error) {
                    reportErrorOnce('call-pending-offer', error, 'Call connection issue');
                }
            }

            // 5. Process orphaned signals for this call
            const orphans = orphanedSignals[incomingCall.id];
            if (orphans && orphans.length > 0) {
                for (const signal of orphans) {
                    try {
                        await get().handleWebRTCSignal(signal);
                    } catch (error) {
                        reportErrorOnce('call-orphan-signal', error, 'Call connection issue');
                    }
                }
                const newOrphans = { ...orphanedSignals };
                delete newOrphans[incomingCall.id];
                set({ orphanedSignals: newOrphans });
            }
            toast.success('Call connected');
        } catch (error) {
            const { localStream } = get();
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }

            resetWebRTCService();

            set({
                incomingCall: null,
                activeCall: null,
                callStatus: 'idle',
                localStream: null,
                remoteStream: null,
                pendingOffer: null,
            });

            toast.error('Failed to accept call');
            throw error;
        }
    },

    // Reject incoming call
    rejectCall: async () => {
        const { incomingCall } = get();
        if (incomingCall) {
            try {
                await callService.rejectCall(incomingCall.id);
            } catch (error) {
                reportErrorOnce('call-reject', error, 'Failed to reject call');
            }
        }
        set({
            incomingCall: null,
            callStatus: 'idle',
            pendingOffer: null,
            orphanedSignals: {},
        });
    },

    // End active call
    endCall: async (outcome = 'ended') => {
        const { activeCall, localStream } = get();

        if (activeCall?.id) {
            try {
                if (outcome === 'ended') {
                    await callService.endCall(activeCall.id);
                }
            } catch (error) {
                reportErrorOnce('call-end', error, 'Failed to end call');
            }
        }

        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        resetWebRTCService();

        set({
            activeCall: null,
            incomingCall: null,
            callStatus: 'idle',
            isVideoEnabled: true,
            isAudioEnabled: true,
            isScreenSharing: false,
            remoteStream: null,
            localStream: null,
            connectionState: 'new',
            isRemoteRinging: false,
            lastCallOutcome: outcome,
            pendingOffer: null,
            orphanedSignals: {},
        });
    },

    setCallActive: (callId) => {
        set((state) => ({
            activeCall: state.activeCall ? { ...state.activeCall, id: callId } : null,
            callStatus: 'active',
        }));
    },

    toggleVideo: () => {
        const webrtc = getWebRTCService();
        const newState = !get().isVideoEnabled;
        webrtc.toggleVideo(newState);
        set({ isVideoEnabled: newState });
    },

    toggleAudio: () => {
        const webrtc = getWebRTCService();
        const newState = !get().isAudioEnabled;
        webrtc.toggleAudio(newState);
        set({ isAudioEnabled: newState });
    },

    toggleScreenShare: async () => {
        const webrtc = getWebRTCService();
        const { isScreenSharing } = get();

        try {
            if (isScreenSharing) {
                await webrtc.stopScreenShare();
                set({ isScreenSharing: false });
            } else {
                await webrtc.startScreenShare();
                set({ isScreenSharing: true });
            }
        } catch (error) {
            reportErrorOnce('call-screenshare', error, 'Failed to share screen');
        }
    },

    getActiveCall: () => get().activeCall,
    getCallStatus: () => get().callStatus,
    hasActiveCall: () => get().activeCall !== null,
    hasIncomingCall: () => get().incomingCall !== null,
}));
