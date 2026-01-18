import { create } from 'zustand';

export const useCallStore = create((set, get) => ({

    activeCall: null,
    incomingCall: null,
    callStatus: 'idle',
    isVideoEnabled: true,
    isAudioEnabled: true,
    isScreenSharing: false,


    initiateCall: (conversationId, callType, participants) => {
        set({
            activeCall: {
                id: null,
                conversationId,
                callType,
                participants,
                startedAt: new Date().toISOString(),
                initiator: true,
            },
            callStatus: 'calling',
        });
    },

    receiveIncomingCall: (callData) => {
        set({
            incomingCall: callData,
            callStatus: 'ringing',
        });
    },

    acceptCall: () => {
        const { incomingCall } = get();
        if (incomingCall) {
            set({
                activeCall: incomingCall,
                incomingCall: null,
                callStatus: 'active',
            });
        }
    },

    rejectCall: () => {
        set({
            incomingCall: null,
            callStatus: 'idle',
        });
    },

    endCall: () => {
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
