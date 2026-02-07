import { create } from 'zustand';
import { callsApi } from '../api/calls';
import { socketService } from '../api/socket';

export const useCallStore = create((set, get) => ({

    activeCall: null,
    incomingCall: null,
    callStatus: 'idle',
    isVideoEnabled: true,
    isAudioEnabled: true,
    isScreenSharing: false,

    // Start a new call - hits the backend API and updates local state
    initiateCall: async (receiverId, callType) => {
        try {
            const response = await callsApi.initiateCall({
                receiverId,
                type: callType.toUpperCase(),
            });

            set({
                activeCall: {
                    ...response,
                    initiator: true,
                },
                callStatus: 'calling',
            });

            // Send call notification to receiver via WebSocket
            try {
                await socketService.send('/app/video/call-notification', {
                    callId: response.id,
                    callerId: response.callerId,
                    receiverId: response.receiverId,
                    type: response.type,
                    conversationId: response.conversationId,
                });
            } catch (wsError) {
                console.error('Failed to send call notification:', wsError);
                // Don't fail the call if notification fails
            }

            return response;
        } catch (error) {
            console.error('Failed to initiate call:', error);
            set({ callStatus: 'idle' });
            throw error;
        }
    },

    // When someone calls us, store their call data
    receiveIncomingCall: (callData) => {
        set({
            incomingCall: callData,
            callStatus: 'ringing',
        });
    },

    // Accept the incoming call and move it to active state
    acceptCall: async () => {
        const { incomingCall } = get();
        if (incomingCall) {
            try {
                await callsApi.acceptCall(incomingCall.id);
                set({
                    activeCall: incomingCall,
                    incomingCall: null,
                    callStatus: 'active',
                });
            } catch (error) {
                console.error('Failed to accept call:', error);
                throw error;
            }
        }
    },

    // Reject incoming call and clean up state
    rejectCall: async () => {
        const { incomingCall } = get();
        if (incomingCall) {
            try {
                await callsApi.rejectCall(incomingCall.id);
            } catch (error) {
                console.error('Failed to reject call:', error);
            }
        }
        set({
            incomingCall: null,
            callStatus: 'idle',
        });
    },

    // End the active call and reset everything
    endCall: async () => {
        const { activeCall } = get();
        if (activeCall?.id) {
            try {
                await callsApi.endCall(activeCall.id);
            } catch (error) {
                console.error('Failed to end call:', error);
            }
        }

        set({
            activeCall: null,
            incomingCall: null,
            callStatus: 'ended',
            isVideoEnabled: true,
            isAudioEnabled: true,
            isScreenSharing: false,
        });

        setTimeout(() => {
            set({ callStatus: 'idle' });
        }, 1000);
    },

    setCallActive: (callId) => {
        set((state) => ({
            activeCall: state.activeCall ? { ...state.activeCall, id: callId } : null,
            callStatus: 'active',
        }));
    },

    toggleVideo: () => {
        set((state) => ({
            isVideoEnabled: !state.isVideoEnabled,
        }));
    },

    toggleAudio: () => {
        set((state) => ({
            isAudioEnabled: !state.isAudioEnabled,
        }));
    },

    toggleScreenShare: () => {
        set((state) => ({
            isScreenSharing: !state.isScreenSharing,
        }));
    },


    getActiveCall: () => get().activeCall,
    getCallStatus: () => get().callStatus,
    hasActiveCall: () => get().activeCall !== null,
    hasIncomingCall: () => get().incomingCall !== null,
}));
