import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { env } from '../config/env';
import { storage, STORAGE_KEYS } from '../lib/storage';
import { useSocketStore } from '../stores/socketStore';

class SocketService {
    constructor() {
        this.client = null;
        this.connected = false;
        this.connectionPromise = null;

        // Reconnection state
        this._reconnectTimer = null;
        this._reconnectAttempts = 0;
        this._maxReconnectAttempts = Infinity;
        this._baseDelay = 1000;       // 1 s
        this._maxDelay = 30000;       // 30 s cap
        this._intentionalDisconnect = false;

        // Pending subscriptions — re-subscribed automatically on reconnect
        this._subscriptions = new Map();  // topic -> { callback, stompSub }

        // Heartbeat / keep-alive
        this._heartbeatOutgoing = 10000;  // client → server every 10 s
        this._heartbeatIncoming = 10000;  // expect server → client every 10 s

        // Visibility-based recovery
        this._onVisibilityChange = this._handleVisibilityChange.bind(this);
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', this._onVisibilityChange);
        }

        // Online/offline recovery
        this._onOnline = this._handleOnline.bind(this);
        if (typeof window !== 'undefined') {
            window.addEventListener('online', this._onOnline);
        }
    }

    // ─── Public API ──────────────────────────────────────────────────

    connect() {
        if (this.connected && this.client?.connected) return Promise.resolve();
        if (this.connectionPromise) return this.connectionPromise;

        this._intentionalDisconnect = false;
        useSocketStore.getState().setStatus('connecting');

        this.connectionPromise = new Promise((resolve, reject) => {
            const token = storage.get(STORAGE_KEYS.ACCESS_TOKEN);
            if (!token) {
                this.connectionPromise = null;
                useSocketStore.getState().setStatus('disconnected');
                return reject(new Error('No auth token'));
            }

            let socketUrl = env.WS_URL.replace(/^ws(s)?:\/\//, 'http$1://');
            if (typeof window !== 'undefined' &&
                window.location.protocol === 'https:' &&
                socketUrl.startsWith('http:')) {
                socketUrl = socketUrl.replace('http:', 'https:');
            }

            // Tear down any stale client
            if (this.client) {
                try { this.client.deactivate(); } catch { /* ignore */ }
            }

            this.client = new Client({
                webSocketFactory: () => new SockJS(socketUrl),
                connectHeaders: { Authorization: `Bearer ${token}` },

                heartbeatOutgoing: this._heartbeatOutgoing,
                heartbeatIncoming: this._heartbeatIncoming,

                onConnect: () => {
                    this.connected = true;
                    useSocketStore.getState().setStatus('connected');
                    this._reconnectAttempts = 0;
                    this._clearReconnectTimer();

                    // Re-subscribe all pending topics
                    this._resubscribeAll();

                    resolve();
                },

                onDisconnect: () => {
                    this.connected = false;
                    useSocketStore.getState().setStatus('disconnected');
                    this.connectionPromise = null;
                    if (!this._intentionalDisconnect) {
                        this._scheduleReconnect();
                    }
                },

                onStompError: (frame) => {
                    this.connected = false;
                    useSocketStore.getState().setStatus('error');
                    this.connectionPromise = null;
                    reject(frame);
                    if (!this._intentionalDisconnect) {
                        this._scheduleReconnect();
                    }
                },

                onWebSocketClose: () => {
                    this.connected = false;
                    useSocketStore.getState().setStatus('disconnected');
                    this.connectionPromise = null;
                    if (!this._intentionalDisconnect) {
                        this._scheduleReconnect();
                    }
                },

                onWebSocketError: () => {
                    // Will be followed by onWebSocketClose — reconnect handled there
                }
            });

            this.client.activate();
        });

        return this.connectionPromise;
    }

    disconnect() {
        this._intentionalDisconnect = true;
        this._clearReconnectTimer();
        this._subscriptions.clear();
        if (this.client) {
            try { this.client.deactivate(); } catch { /* ignore */ }
            this.client = null;
        }
        this.connected = false;
        useSocketStore.getState().setStatus('disconnected');
        this.connectionPromise = null;
    }

    // Subscribe to a STOMP topic. The subscription is persistent
    // it will be automatically re-established after reconnection.
    subscribe(topic, callback) {
        // Store for re-subscription on reconnect
        const entry = { callback, stompSub: null };
        this._subscriptions.set(topic, entry);

        // If already connected, subscribe immediately
        if (this.client?.connected) {
            entry.stompSub = this._doSubscribe(topic, callback);
        }

        // Return an unsubscribe handle
        return {
            unsubscribe: () => {
                if (entry.stompSub) {
                    try { entry.stompSub.unsubscribe(); } catch { /* ignore */ }
                }
                this._subscriptions.delete(topic);
            }
        };
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

    // ─── Internal helpers ────────────────────────────────────────────

    _doSubscribe(topic, callback) {
        if (!this.client?.connected) return null;
        return this.client.subscribe(topic, (message) => {
            try {
                callback(message.body ? JSON.parse(message.body) : null);
            } catch {
                // silently ignore parse errors
            }
        });
    }

    _resubscribeAll() {
        for (const [topic, entry] of this._subscriptions) {
            // Unsubscribe stale handle if any
            if (entry.stompSub) {
                try { entry.stompSub.unsubscribe(); } catch { /* ignore */ }
            }
            entry.stompSub = this._doSubscribe(topic, entry.callback);
        }
    }

    _scheduleReconnect() {
        if (this._intentionalDisconnect) return;
        if (this._reconnectTimer) return; // already scheduled

        this._reconnectAttempts++;
        // Exponential back-off with jitter, capped at _maxDelay
        const delay = Math.min(
            this._baseDelay * Math.pow(2, this._reconnectAttempts - 1) + Math.random() * 500,
            this._maxDelay
        );

        this._reconnectTimer = setTimeout(() => {
            this._reconnectTimer = null;
            if (!this._intentionalDisconnect && !this.connected) {
                useSocketStore.getState().setStatus('reconnecting');
                this.connect().catch(() => {
                    // connect() rejection triggers onStompError/onWebSocketClose
                    // which will schedule another reconnect
                });
            }
        }, delay);
    }

    _clearReconnectTimer() {
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }
    }

    // When the tab becomes visible again after being hidden (user was away),
    // check connection health and reconnect if needed.
    _handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            if (!this.connected || !this.client?.connected) {
                this._clearReconnectTimer();
                this._reconnectAttempts = 0; // reset back-off since user is back
                this.connect().catch(() => { });
            }
        }
    }

    // When the browser comes back online, reconnect immediately.
    _handleOnline() {
        if (!this.connected || !this.client?.connected) {
            this._clearReconnectTimer();
            this._reconnectAttempts = 0;
            this.connect().catch(() => { });
        }
    }
}

export const socketService = new SocketService();
