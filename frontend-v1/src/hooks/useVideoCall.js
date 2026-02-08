import { useState, useRef, useCallback, useEffect } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { initiateCall as apiInitiateCall, acceptCall as apiAcceptCall, rejectCall as apiRejectCall, endCall as apiEndCall } from '../api/videoApi';

import { WS_BASE_URL } from '../config';

const WS_URL = WS_BASE_URL;

export function useVideoCall({ token, userId, onIncomingCall, onCallEnded }) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [currentCall, setCurrentCall] = useState(null);
  const [callStatus, setCallStatus] = useState('idle'); // idle, calling, ringing, connected, ended

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const wsClientRef = useRef(null);
  const streamRef = useRef(null);
  const handleWebRtcSignalRef = useRef(null);
  const onIncomingCallRef = useRef(onIncomingCall);

  // Update refs when callbacks change
  useEffect(() => {
    onIncomingCallRef.current = onIncomingCall;
  }, [onIncomingCall]);

  // WebRTC configuration (using Google's public STUN servers)
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  useEffect(() => {
    if (!userId || !token) return;

    let isMounted = true;

    const socketFactory = () => new SockJS(WS_URL);
    const client = new Client({
      webSocketFactory: socketFactory,
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        if (!isMounted) {
          client.deactivate();
          return;
        }
        console.log('Video call WebSocket connected');

        // Subscribe to incoming call notifications
        try {
          if (client.connected) {
            client.subscribe('/user/queue/video/call-notification', (frame) => {
              try {
                const notification = JSON.parse(frame.body);
                console.log('Incoming call notification:', notification);
                if (onIncomingCallRef.current && isMounted) {
                  onIncomingCallRef.current(notification);
                }
              } catch (error) {
                console.error('Error parsing call notification:', error);
              }
            });

            // Subscribe to WebRTC signals
            client.subscribe('/user/queue/video/signal', (frame) => {
              try {
                const signal = JSON.parse(frame.body);
                console.log('Received WebRTC signal:', signal);
                if (isMounted && handleWebRtcSignalRef.current) {
                  handleWebRtcSignalRef.current(signal);
                }
              } catch (error) {
                console.error('Error parsing WebRTC signal:', error);
              }
            });
          }
        } catch (error) {
          console.error('Error subscribing to video call topics:', error);
        }
      },
      onDisconnect: () => {
        if (isMounted) {
          console.log('Video call WebSocket disconnected');
        }
      },
      onStompError: (frame) => {
        console.error('STOMP error:', frame);
      },
      onWebSocketClose: () => {
        if (isMounted) {
          console.log('Video call WebSocket closed');
        }
      },
    });

    client.connectHeaders = {
      Authorization: `Bearer ${token}`,
    };

    client.activate();
    wsClientRef.current = client;

    return () => {
      isMounted = false;
      if (client && client.connected) {
        try {
          client.deactivate();
        } catch (error) {
          console.error('Error deactivating video call WebSocket:', error);
        }
      }
      wsClientRef.current = null;
    };
  }, [userId, token]);

  /**
   * Get user media (camera and microphone)
   */
  const getUserMedia = useCallback(async (video = true, audio = true) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: video ? { facingMode: 'user' } : false,
        audio: audio,
      });
      streamRef.current = stream;
      setLocalStream(stream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  }, []);

  /**
   * Stop local media stream
   */
  const stopLocalStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setLocalStream(null);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
    }
  }, []);

  /**
   * Create RTCPeerConnection
   */
  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(rtcConfig);

    // Add local stream tracks to peer connection
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, streamRef.current);
      });
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('Received remote track:', event);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
      setRemoteStream(event.streams[0]);
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && currentCall && wsClientRef.current) {
        console.log('Sending ICE candidate:', event.candidate);
        wsClientRef.current.publish({
          destination: '/app/video/signal',
          body: JSON.stringify({
            callId: currentCall.id,
            type: 'ICE_CANDIDATE',
            data: JSON.stringify(event.candidate),
            targetUserId: currentCall.callerId === userId ? currentCall.receiverId : currentCall.callerId,
          }),
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('Peer connection state:', pc.connectionState);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        endCall();
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [currentCall, userId]);

  /**
   * Handle incoming WebRTC signals
   */
  const handleWebRtcSignal = useCallback(async (signal) => {
    if (!peerConnectionRef.current) {
      console.warn('No peer connection available for signal');
      return;
    }

    const pc = peerConnectionRef.current;

    try {
      switch (signal.type) {
        case 'OFFER':
          await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(signal.data)));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          if (wsClientRef.current) {
            wsClientRef.current.publish({
              destination: '/app/video/signal',
              body: JSON.stringify({
                callId: signal.callId,
                type: 'ANSWER',
                data: JSON.stringify(answer),
                targetUserId: signal.targetUserId || currentCall?.callerId,
              }),
            });
          }
          break;

        case 'ANSWER':
          await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(signal.data)));
          break;

        case 'ICE_CANDIDATE':
          const candidate = JSON.parse(signal.data);
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
          break;

        case 'CALL_ENDED':
          endCall();
          break;
      }
    } catch (error) {
      console.error('Error handling WebRTC signal:', error);
    }
  }, [currentCall]);

  // Update handleWebRtcSignal ref when it changes
  useEffect(() => {
    handleWebRtcSignalRef.current = handleWebRtcSignal;
  }, [handleWebRtcSignal]);

  /**
   * Initiate a call
   */
  const initiateCall = useCallback(async (receiverId, type = 'VIDEO', conversationId = null) => {
    console.log('Initiating call:', { receiverId, type, conversationId });
    try {
      setCallStatus('calling');

      // Get user media
      const videoEnabled = type === 'VIDEO';
      await getUserMedia(videoEnabled, true);

      // Create peer connection
      const pc = createPeerConnection();

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Initiate call via API
      const requestBody = {
        receiverId: String(receiverId),
        type: type === 'VIDEO' ? 'VIDEO' : 'AUDIO', // Ensure enum value matches backend
      };

      // Only include conversationId if it's provided
      if (conversationId) {
        requestBody.conversationId = String(conversationId);
      }

      console.log('Call request body:', requestBody);

      const call = await apiInitiateCall(token, requestBody);
      setCurrentCall(call);

      // Send offer via WebSocket
      if (wsClientRef.current) {
        wsClientRef.current.publish({
          destination: '/app/video/signal',
          body: JSON.stringify({
            callId: call.id,
            type: 'OFFER',
            data: JSON.stringify(offer),
            targetUserId: receiverId,
          }),
        });
      }

      setCallStatus('ringing');
      return call;
    } catch (error) {
      console.error('Error initiating call:', error);
      setCallStatus('idle');
      stopLocalStream();
      throw error;
    }
  }, [token, getUserMedia, createPeerConnection, stopLocalStream]);

  /**
   * Accept an incoming call
   */
  const acceptCall = useCallback(async (call) => {
    try {
      setCurrentCall(call);
      setCallStatus('connected');

      // Get user media
      const videoEnabled = call.type === 'VIDEO';
      await getUserMedia(videoEnabled, true);

      // Create peer connection
      createPeerConnection();

      // Accept call via API
      const updatedCall = await apiAcceptCall(token, call.id);
      setCurrentCall(updatedCall);
    } catch (error) {
      console.error('Error accepting call:', error);
      setCallStatus('idle');
      stopLocalStream();
      throw error;
    }
  }, [token, getUserMedia, createPeerConnection, stopLocalStream]);

  /**
   * Reject an incoming call
   */
  const rejectCall = useCallback(async (callId) => {
    try {
      await apiRejectCall(token, callId);
      setCallStatus('idle');
      setCurrentCall(null);
    } catch (error) {
      console.error('Error rejecting call:', error);
    }
  }, [token]);

  /**
   * End the current call
   */
  const endCall = useCallback(async () => {
    try {
      if (currentCall) {
        // Send call ended signal
        if (wsClientRef.current && peerConnectionRef.current) {
          const targetUserId = currentCall.callerId === userId
            ? currentCall.receiverId
            : currentCall.callerId;

          wsClientRef.current.publish({
            destination: '/app/video/signal',
            body: JSON.stringify({
              callId: currentCall.id,
              type: 'CALL_ENDED',
              data: '',
              targetUserId,
            }),
          });

          // End call via API
          await apiEndCall(token, currentCall.id);
        }

        // Close peer connection
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
          peerConnectionRef.current = null;
        }

        // Stop streams
        stopLocalStream();
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
        setRemoteStream(null);
      }

      setCallStatus('idle');
      setCurrentCall(null);

      if (onCallEnded) {
        onCallEnded();
      }
    } catch (error) {
      console.error('Error ending call:', error);
    }
  }, [currentCall, userId, token, stopLocalStream, onCallEnded]);

  /**
   * Toggle microphone mute
   */
  const toggleMute = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  /**
   * Toggle video on/off
   */
  const toggleVideo = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !isVideoEnabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  }, [isVideoEnabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endCall();
      stopLocalStream();
    };
  }, [endCall, stopLocalStream]);

  return {
    localStream,
    remoteStream,
    localVideoRef,
    remoteVideoRef,
    isMuted,
    isVideoEnabled,
    currentCall,
    callStatus,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
  };
}
