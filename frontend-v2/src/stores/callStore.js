import { create } from 'zustand';
import { callService } from '../services';
import { socketService } from '../services';
import { getWebRTCService, resetWebRTCService } from '../services/webrtc';
import toast from 'react-hot-toast';

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
            console.error('Cannot initialize WebRTC: User ID is missing');
            return () => { };
        }

        const subs = [];

        // Listen for WebRTC signals from backend
        // Switch to explicit topic subscription to avoid User Destination issues
        subs.push(socketService.subscribe(`/topic/video/${userId}/signal`, (signal) => {
            get().handleWebRTCSignal(signal);
        }));

        // Listen for call notifications
        subs.push(socketService.subscribe(`/topic/video/${userId}/notification`, (notification) => {
            get().receiveIncomingCall(notification);
        }));

        // Listen for errors
        subs.push(socketService.subscribe(`/topic/video/${userId}/error`, (error) => {
            if (error?.error) {
                toast.error(error.error);
            }
        }));

        return () => {
            subs.forEach(sub => sub && sub.unsubscribe());
        };
    },

    // Receive incoming call notification
    receiveIncomingCall: (notification) => {
        console.log('[CallStore] Incoming call notification:', notification);

        const { activeCall, callStatus } = get();

        // Don't accept new calls if already in a call
        if (activeCall || callStatus !== 'idle') {
            console.log('[CallStore] Rejecting incoming call - already in call');
            return;
        }

        set({
            incomingCall: {
                id: notification.callId,
                callerId: notification.callerId,
                receiverId: notification.receiverId,
                type: notification.callType,
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
            console.log('[CallStore] Processing orphaned signals:', orphans.length);
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
                console.log('Buffering orphaned signal:', signal.type, signal.callId);
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
                    console.log('[CallStore] Received OFFER signal, callStatus:', callStatus);
                    // If call is still ringing, queue the offer
                    if (callStatus === 'ringing') {
                        console.log('[CallStore] Call is ringing, queuing OFFER as pendingOffer');
                        set({ pendingOffer: signal });
                        return;
                    }

                    // Skip if we already processed an offer
                    if (webrtc.peerConnection?.remoteDescription) {
                        console.log('[CallStore] Ignoring duplicate OFFER - peer connection already has remote description');
                        break;
                    }

                    console.log('[CallStore] Processing OFFER - creating peer connection');
                    // Receiver gets offer from caller
                    await webrtc.createPeerConnection(
                        (candidate) => get().sendIceCandidate(candidate),
                        (stream) => set({ remoteStream: stream }),
                        (state) => set({ connectionState: state })
                    );

                    if (get().localStream) {
                        console.log('[CallStore] Adding local stream to peer connection');
                        webrtc.addLocalStream(get().localStream);
                    } else {
                        console.warn('[CallStore] No local stream available when processing OFFER');
                    }

                    console.log('[CallStore] Creating ANSWER');
                    const answer = await webrtc.createAnswer(JSON.parse(signal.data));

                    console.log('[CallStore] Processing answer results');

                    console.log('[CallStore] Sending ANSWER to caller:', currentCall.callerId);
                    // Send answer back to caller
                    await socketService.send('/app/video/signal', {
                        callId: currentCall.id,
                        type: 'ANSWER',
                        data: JSON.stringify(answer),
                        targetUserId: currentCall.callerId,
                    });
                    console.log('[CallStore] ANSWER sent successfully');
                    break;
                }

                case 'ANSWER':
                    // Caller receives answer from receiver
                    console.log('[CallStore] Received ANSWER, call is now active');
                    await webrtc.setRemoteDescription(JSON.parse(signal.data));
                    set({ callStatus: 'active' });
                    toast.success('Call connected');
                    break;

                case 'RINGING':
                    // Caller gets notification that receiver is ringing
                    set({ isRemoteRinging: true });
                    break;

                case 'ICE_CANDIDATE':
                    // Handle ICE candidates for WebRTC connection
                    if (signal.data) {
                        try {
                            await webrtc.addIceCandidate(JSON.parse(signal.data));
                        } catch (e) {
                            console.error('[CallStore] Error adding ICE candidate:', e);
                        }
                    }
                    break;

                case 'CALL_MISSED':
                    // Call timed out without answer
                    toast.error('Call missed');
                    get().endCall('missed');
                    break;

                case 'CALL_ENDED':
                    // Other party ended the call
                    console.log('[CallStore] Received CALL_ENDED signal, current callStatus:', callStatus);
                    if (callStatus === 'calling') {
                        // Call was rejected before being answered
                        toast.error('Call was declined');
                    } else if (callStatus === 'active') {
                        // Call was ended during active conversation
                        toast('Call ended');
                    }
                    get().endCall('ended');
                    break;

                default:
                    console.warn('Unknown signal type:', signal.type);
            }
        } catch (error) {
            console.error('Error handling WebRTC signal:', error);
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
            console.error('Failed to send ICE candidate:', error);
        }
    },

    // Start a new call
    initiateCall: async (receiverId, callType) => {
        const startTime = Date.now();
        console.log(`[CallStore] Initiating ${callType} call to ${receiverId}...`);

        try {
            const isVideo = callType.toUpperCase() === 'VIDEO';
            const webrtc = getWebRTCService();

            // Clean up any existing streams first
            const { localStream: existingStream } = get();
            if (existingStream) {
                existingStream.getTracks().forEach(track => track.stop());
                set({ localStream: null });
            }

            // 1. Kick off media access (don't await yet)
            console.log('[CallStore] Requesting local media stream in background...');
            const mediaPromise = webrtc.startLocalStream(isVideo, true).catch(err => {
                console.error('[CallStore] Media request failed:', err);
                return null;
            });

            // 2. Await ONLY server verification (Server side busy check, persistence etc)
            console.log('[CallStore] Requesting server verification...');
            const response = await callService.initiateCall({
                receiverId,
                type: callType.toUpperCase(),
            });

            console.log(`[CallStore] Server verified after ${Date.now() - startTime}ms. Showing UI.`);

            // 3. IMMEDIATELY show the calling UI as soon as server says OK
            set({
                activeCall: {
                    ...response,
                    initiator: true,
                },
                callStatus: 'calling',
                isRemoteRinging: false,
                lastCallOutcome: null,
            });

            // 4. Continue with media and WebRTC in the background
            const stream = await mediaPromise;
            if (!stream) {
                toast.error('Could not access camera/microphone');
                get().endCall('failed');
                return;
            }

            set({ localStream: stream });

            // Set up WebRTC peer connection
            await webrtc.createPeerConnection(
                (candidate) => get().sendIceCandidate(candidate),
                (stream) => set({ remoteStream: stream }),
                (state) => set({ connectionState: state })
            );

            webrtc.addLocalStream(stream);

            // Create and send offer
            const offer = await webrtc.createOffer();
            await socketService.send('/app/video/signal', {
                callId: response.id,
                type: 'OFFER',
                data: JSON.stringify(offer),
                targetUserId: receiverId,
            });

            console.log(`[CallStore] Call fully established after ${Date.now() - startTime}ms`);
            return response;
        } catch (error) {
            console.error('[CallStore] Failed to initiate call:', error);
            set({ callStatus: 'idle' });

            // Clean up any media that was acquired
            const { localStream } = get();
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
                set({ localStream: null });
            }

            toast.error(error.message || 'Failed to start call');
            resetWebRTCService();
            throw error;
        }
    },


    // Accept incoming call
    acceptCall: async () => {
        const { incomingCall } = get();
        if (!incomingCall) return;

        console.log('[CallStore] Accepting call:', incomingCall.id);

        try {
            // Clean up any existing streams and reset WebRTC service
            const { localStream: existingStream } = get();
            if (existingStream) {
                existingStream.getTracks().forEach(track => track.stop());
                set({ localStream: null });
            }

            // Reset WebRTC service to ensure clean state
            resetWebRTCService();

            // 1. Accept call on backend
            await callService.acceptCall(incomingCall.id);

            // 2. Get local media stream (WebRTC service is fresh now)
            const isVideo = incomingCall.type === 'VIDEO';
            const webrtc = getWebRTCService();
            const stream = await webrtc.startLocalStream(isVideo, true);

            // 3. Store the stream and update to active state FIRST
            // (so OFFER handler doesn't re-queue it)
            console.log('[CallStore] Setting state to active before processing OFFER');
            set({
                activeCall: incomingCall,
                incomingCall: null,
                callStatus: 'active',
                localStream: stream,
                isRemoteRinging: false,
            });

            // 4. NOW process pending offer (won't be re-queued since status is 'active')
            const { pendingOffer, orphanedSignals } = get();
            console.log('[CallStore] Checking for pendingOffer:', !!pendingOffer);

            if (pendingOffer) {
                console.log('[CallStore] Processing pending OFFER, current callStatus:', get().callStatus);
                try {
                    await get().handleWebRTCSignal(pendingOffer);
                    console.log('[CallStore] Finished processing OFFER');
                    set({ pendingOffer: null });
                } catch (e) {
                    console.error('[CallStore] Error processing pending offer:', e);
                }
            } else {
                console.warn('[CallStore] No pendingOffer found! ANSWER will not be sent.');
            }

            // 5. Process orphaned signals for this call
            const orphans = orphanedSignals[incomingCall.id];
            if (orphans && orphans.length > 0) {
                console.log('[CallStore] Processing orphaned signals on accept:', orphans.length);
                for (const signal of orphans) {
                    try {
                        await get().handleWebRTCSignal(signal);
                    } catch (e) {
                        console.error('[CallStore] Error processing orphaned signal:', e);
                    }
                }
                const newOrphans = { ...orphanedSignals };
                delete newOrphans[incomingCall.id];
                set({ orphanedSignals: newOrphans });
            }

            console.log('[CallStore] Call accepted successfully');
            toast.success('Call connected');
        } catch (error) {
            console.error('[CallStore] Failed to accept call:', error);

            // Clean up on error
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

            toast.error('Failed to accept call: ' + (error.message || 'Unknown error'));
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
                console.error('Failed to reject call:', error);
            }
        }
        set({
            incomingCall: null,
            callStatus: 'idle',
        });
    },

    // End active call
    endCall: async (outcome = 'ended') => {
        const { activeCall, localStream } = get();
        console.log('[CallStore] Ending call, outcome:', outcome, 'activeCall:', activeCall?.id);

        if (activeCall?.id) {
            try {
                // Only call endCall API if it wasn't already ended/missed by server
                if (outcome === 'ended') {
                    console.log('[CallStore] Calling endCall API');
                    await callService.endCall(activeCall.id);
                    console.log('[CallStore] endCall API completed');
                }
            } catch (error) {
                console.error('[CallStore] Failed to end call:', error);
            }
        }

        // Stop local media tracks
        if (localStream) {
            console.log('[CallStore] Stopping local media tracks');
            localStream.getTracks().forEach(track => track.stop());
        }

        // Clean up WebRTC
        console.log('[CallStore] Resetting WebRTC service');
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
            console.error('Failed to toggle screen share:', error);
        }
    },

    getActiveCall: () => get().activeCall,
    getCallStatus: () => get().callStatus,
    hasActiveCall: () => get().activeCall !== null,
    hasIncomingCall: () => get().incomingCall !== null,
}));
