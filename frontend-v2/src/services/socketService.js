import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import toast from 'react-hot-toast';
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
        if (this.connectionPromise) return this.connectionPromise;

        this.connectionPromise = new Promise((resolve, reject) => {
            const token = storage.get(STORAGE_KEYS.ACCESS_TOKEN);
            let socketUrl = env.WS_URL.replace(/^ws(s)?:\/\//, 'http$1://');

            if (window.location.protocol === 'https:' && socketUrl.startsWith('http:')) {
                socketUrl = socketUrl.replace('http:', 'https:');
            }

            this.client = new Client({
                webSocketFactory: () => new SockJS(socketUrl),
                connectHeaders: { Authorization: `Bearer ${token}` },
                onConnect: () => {
                    this.connected = true;
                    resolve();
                },
                onDisconnect: () => {
                    this.connected = false;
                    this.connectionPromise = null;
                },
                onStompError: (frame) => reject(frame),
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
        if (!this.client?.connected) return null;

        return this.client.subscribe(topic, (message) => {
            try {
                callback(message.body ? JSON.parse(message.body) : null);
            } catch {
                toast.error(`Socket Error: Malformed data received on ${topic}`);
            }
        });
    }

    send(destination, body) {
        if (this.client?.connected) {
            this.client.publish({ destination, body: JSON.stringify(body) });
        }
    }

    getUserId() {
        const token = storage.get(STORAGE_KEYS.ACCESS_TOKEN);
        if (!token) return null;
        try {
            return JSON.parse(atob(token.split('.')[1])).sub;
        } catch {
            return null;
        }
    }
}

export const socketService = new SocketService();
