import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { env } from '../config/env';
import { storage, STORAGE_KEYS } from '../lib/storage';
import { clearReportedError, reportErrorOnce } from '../lib/reportError';
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
                try {
                    this.client.deactivate();
                } catch (error) {
                    reportErrorOnce('socket-teardown', error, 'Real-time connection error');
                }
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

                    // Clear any previously shown connection-failure toast so a future outage can surface again.
                    clearReportedError('realtime-connection');

                    // Re-subscribe all pending topics
                    this._resubscribeAll();

                    resolve();
                },

                onDisconnect: () => {
                    this.connected = false;
                    this.connectionPromise = null;
                    if (!this._intentionalDisconnect) {
                        const stillAuthed = !!storage.get(STORAGE_KEYS.ACCESS_TOKEN);
                        if (!stillAuthed) {
                            useSocketStore.getState().setStatus('disconnected');
                            return;
                        }
                        useSocketStore.getState().setStatus('error');
                        this._scheduleReconnect();
                    } else {
                        useSocketStore.getState().setStatus('disconnected');
                    }
                },

                onStompError: (frame) => {
                    this.connected = false;
                    const stillAuthed = !!storage.get(STORAGE_KEYS.ACCESS_TOKEN);
                    useSocketStore.getState().setStatus(stillAuthed ? 'error' : 'disconnected');
                    this.connectionPromise = null;
                    reject(frame);
                    if (!this._intentionalDisconnect) {
                        if (stillAuthed) {
                            this._scheduleReconnect();
                        }
                    }
                },

                onWebSocketClose: () => {
                    this.connected = false;
                    this.connectionPromise = null;
                    if (!this._intentionalDisconnect) {
                        const stillAuthed = !!storage.get(STORAGE_KEYS.ACCESS_TOKEN);
                        if (!stillAuthed) {
                            useSocketStore.getState().setStatus('disconnected');
                            return;
                        }
                        // Keep 'error' or 'reconnecting' status instead of hiding/disconnected
                        // If we are already in error or reconnecting, don't revert to disconnected
                        const currentStatus = useSocketStore.getState().status;
                        if (currentStatus !== 'reconnecting') {
                            useSocketStore.getState().setStatus('error');
                        }
                        this._scheduleReconnect();
                    } else {
                        useSocketStore.getState().setStatus('disconnected');
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
            try {
                this.client.deactivate();
            } catch (error) {
                reportErrorOnce('socket-teardown', error, 'Real-time connection error');
            }
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
                    try {
                        entry.stompSub.unsubscribe();
                    } catch (error) {
                        reportErrorOnce('socket-unsubscribe', error, 'Real-time connection error');
                    }
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
        } catch (error) {
            reportErrorOnce('auth-token-invalid', error, 'Authentication data is invalid. Please sign in again.');
            return null;
        }
    }

    // ─── Internal helpers ────────────────────────────────────────────

    _doSubscribe(topic, callback) {
        if (!this.client?.connected) return null;
        return this.client.subscribe(topic, (message) => {
            if (!message?.body) {
                callback(null);
                return;
            }

            let parsed = null;
            try {
                parsed = JSON.parse(message.body);
            } catch (error) {
                reportErrorOnce('socket-parse', error, 'Received an invalid real-time message');
                return;
            }

            callback(parsed);
        });
    }

    _resubscribeAll() {
        for (const [topic, entry] of this._subscriptions) {
            // Unsubscribe stale handle if any
            if (entry.stompSub) {
                try {
                    entry.stompSub.unsubscribe();
                } catch (error) {
                    reportErrorOnce('socket-unsubscribe', error, 'Real-time connection error');
                }
            }
            entry.stompSub = this._doSubscribe(topic, entry.callback);
        }
    }

    _scheduleReconnect() {
        if (this._intentionalDisconnect) return;
        if (this._reconnectTimer) return; // already scheduled

        // If we no longer have a token, do not keep retrying.
        if (!storage.get(STORAGE_KEYS.ACCESS_TOKEN)) {
            useSocketStore.getState().setStatus('disconnected');
            return;
        }

        this._reconnectAttempts++;
        // Exponential back-off with jitter, capped at _maxDelay
        const delay = Math.min(
            this._baseDelay * Math.pow(2, this._reconnectAttempts - 1) + Math.random() * 500,
            this._maxDelay
        );

        this._reconnectTimer = setTimeout(() => {
            this._reconnectTimer = null;
            if (!this._intentionalDisconnect && !this.connected) {
                if (!storage.get(STORAGE_KEYS.ACCESS_TOKEN)) {
                    useSocketStore.getState().setStatus('disconnected');
                    return;
                }
                useSocketStore.getState().setStatus('reconnecting');
                this.connect().catch((error) => {
                    reportErrorOnce('realtime-connection', error, 'Real-time connection failed');
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
                this.connect().catch((error) => {
                    reportErrorOnce('realtime-connection', error, 'Real-time connection failed');
                });
            }
        }
    }

    // When the browser comes back online, reconnect immediately.
    _handleOnline() {
        if (!this.connected || !this.client?.connected) {
            this._clearReconnectTimer();
            this._reconnectAttempts = 0;
            this.connect().catch((error) => {
                reportErrorOnce('realtime-connection', error, 'Real-time connection failed');
            });
        }
    }
}

export const socketService = new SocketService();
