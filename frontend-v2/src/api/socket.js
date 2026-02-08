import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { env } from '../config/env';
import { storage, STORAGE_KEYS } from '../lib/storage';

class SocketService {
    constructor() {
        this.client = null;
        this.connected = false;
        this.connectionPromise = null;
    }

    connect() {
        if (this.connected) return Promise.resolve();
        // Prevent duplicate connection attempts
        if (this.connectionPromise) return this.connectionPromise;

        this.connectionPromise = new Promise((resolve, reject) => {
            const token = storage.get(STORAGE_KEYS.ACCESS_TOKEN);
            let socketUrl = env.WS_URL.replace(/^ws(s)?:\/\//, 'http$1://');

            // Force HTTPS if running on HTTPS (to prevent Mixed Content errors)
            if (window.location.protocol === 'https:' && socketUrl.startsWith('http:')) {
                socketUrl = socketUrl.replace('http:', 'https:');
            }

            this.client = new Client({
                webSocketFactory: () => new SockJS(socketUrl),
                connectHeaders: {
                    Authorization: `Bearer ${token}`,
                },
                onConnect: () => {
                    // Force connected state true immediately
                    this.connected = true;
                    if (resolve) resolve();
                },
                onDisconnect: () => {
                    this.connected = false;
                    this.connectionPromise = null;
                },
                onStompError: (frame) => {
                    // Fatal broker error, reject connection promise
                    console.error('[WS] Broker error:', frame.headers['message']);
                    reject(frame);
                },
                onWebSocketClose: () => {
                    this.connected = false;
                    this.connectionPromise = null;
                }
            });

            this.client.activate();
        });

        return this.connectionPromise;
    }

    disconnect() {
        if (this.client) {
            this.client.deactivate();
            this.connected = false;
            this.connectionPromise = null;
        }
    }

    subscribe(topic, callback) {
        if (!this.client || !this.connected) {
            return null;
        }

        return this.client.subscribe(topic, (message) => {
            try {
                if (message.body) {
                    const body = JSON.parse(message.body);
                    callback(body);
                } else {
                    callback(null);
                }
            } catch (error) {
                console.error('[Socket] Error parsing message:', error, message);
            }
        });
    }

    send(destination, body) {
        if (!this.client || !this.connected) {
            return;
        }

        this.client.publish({
            destination,
            body: JSON.stringify(body),
        });
    }
}

export const socketService = new SocketService();
