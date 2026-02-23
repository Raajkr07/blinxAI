// WebRTC service for managing peer-to-peer connections
export class WebRTCService {
    constructor() {
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.iceCandidatesQueue = [];

        // Highly reliable Google STUN servers for NAT traversal
        this.iceServers = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
        ];
    }

    // Initialize peer connection
    async createPeerConnection(onIceCandidate, onTrack, onConnectionStateChange) {
        // Close ONLY the old peer connection — do NOT stop media tracks.
        // The caller may have already attached a local stream that must stay alive.
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        this.peerConnection = new RTCPeerConnection({ iceServers: this.iceServers });

        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && onIceCandidate) {
                onIceCandidate(event.candidate);
            }
        };

        // Handle remote stream
        this.peerConnection.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
                this.remoteStream = event.streams[0];
                if (onTrack) {
                    onTrack(event.streams[0]);
                }
            }
        };

        // Handle connection state changes
        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection?.connectionState;
            if (onConnectionStateChange && state) {
                onConnectionStateChange(state);
            }
        };

    }

    // Process any queued ICE candidates
    async processIceQueue() {
        if (!this.peerConnection || !this.peerConnection.remoteDescription) return;

        // Copy queue to avoid concurrent modification issues if addIceCandidate pushes back
        const queue = [...this.iceCandidatesQueue];
        this.iceCandidatesQueue = [];

        for (const candidate of queue) {
            await this.addIceCandidate(candidate);
        }
    }

    async startLocalStream(video = true, audio = true) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Camera access requires HTTPS or localhost. Please check your browser settings.');
        }

        // Stop any existing stream first
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: video,
                audio: audio
            });
            this.localStream = stream;
            return stream;
        } catch (error) {
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                throw new Error('Camera/Microphone permission denied. Please allow access.');
            }
            throw error;
        }
    }

    // Add local media stream to peer connection
    addLocalStream(stream) {
        if (!this.peerConnection) {
            throw new Error('Peer connection not initialized');
        }

        this.localStream = stream;
        stream.getTracks().forEach(track => {
            this.peerConnection.addTrack(track, stream);
        });
    }

    // Create and return an offer
    async createOffer() {
        if (!this.peerConnection) {
            throw new Error('Peer connection not initialized');
        }

        const offer = await this.peerConnection.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
        });

        await this.peerConnection.setLocalDescription(offer);
        return offer;
    }

    // Create and return an answer
    async createAnswer(offer) {
        if (!this.peerConnection) {
            throw new Error('Peer connection not initialized');
        }

        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

        // Process queued candidates now that remote description is set
        await this.processIceQueue();

        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        return answer;
    }

    // Set remote description (for receiving answer)
    async setRemoteDescription(answer) {
        if (!this.peerConnection) {
            throw new Error('Peer connection not initialized');
        }

        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));

        // Process queued candidates now that remote description is set
        await this.processIceQueue();
    }

    // Add ICE candidate
    async addIceCandidate(candidate) {
        if (!this.peerConnection) {
            // Queue candidates if peer connection not ready
            this.iceCandidatesQueue.push(candidate);
            return;
        }

        if (!this.peerConnection.remoteDescription) {
            // Queue candidates if remote description not set yet
            this.iceCandidatesQueue.push(candidate);
            return;
        }

        try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            void error;
            throw new Error('Call connection issue');
        }
    }

    // Toggle audio track
    toggleAudio(enabled) {
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = enabled;
            });
        }
    }

    // Toggle video track
    toggleVideo(enabled) {
        if (this.localStream) {
            this.localStream.getVideoTracks().forEach(track => {
                track.enabled = enabled;
            });
        }
    }

    // Replace video track with screen share
    async startScreenShare() {
        if (!this.peerConnection) {
            throw new Error('Peer connection not initialized');
        }

        const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: 'always' },
            audio: false,
        });

        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');

        if (sender) {
            await sender.replaceTrack(screenTrack);
        }

        // Stop screen share when user clicks browser's stop button
        screenTrack.onended = () => {
            this.stopScreenShare();
        };

        return screenStream;
    }

    // Stop screen share and restore camera
    async stopScreenShare() {
        if (!this.peerConnection || !this.localStream) {
            return;
        }

        const videoTrack = this.localStream.getVideoTracks()[0];
        const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');

        if (sender && videoTrack) {
            await sender.replaceTrack(videoTrack);
        }
    }

    // Close peer connection and clean up
    closePeerConnection() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => track.stop());
            this.remoteStream = null;
        }

        this.iceCandidatesQueue = [];
    }

    // Get connection stats
    async getStats() {
        if (!this.peerConnection) {
            return null;
        }

        const stats = await this.peerConnection.getStats();
        return stats;
    }
}

// Singleton instance
let webrtcServiceInstance = null;

export function getWebRTCService() {
    if (!webrtcServiceInstance) {
        webrtcServiceInstance = new WebRTCService();
    }
    return webrtcServiceInstance;
}

export function resetWebRTCService() {
    if (webrtcServiceInstance) {
        webrtcServiceInstance.closePeerConnection();
        webrtcServiceInstance = null;
    }
}
