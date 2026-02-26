import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { env } from '../config/env';
import { storage, STORAGE_KEYS } from '../lib/storage';
import { hasReportedError, reportErrorOnce, reportSuccess, resetReportedError } from '../lib/reportError';
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
        this._pausedByPageLifecycle = false;

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

        // Page lifecycle (BFCache): pause sockets on pagehide so the page can be cached,
        // and restore on pageshow.
        this._onPageHide = this._handlePageHide.bind(this);
        this._onPageShow = this._handlePageShow.bind(this);
        if (typeof window !== 'undefined') {
            window.addEventListener('pagehide', this._onPageHide);
            window.addEventListener('pageshow', this._onPageShow);
        }
    }

    // ─── Public API ──────────────────────────────────────────────────

    connect() {
        if (this.connected && this.client?.connected) return Promise.resolve();
        if (this.connectionPromise) return this.connectionPromise;

        this._intentionalDisconnect = false;
        useSocketStore.getState().setStatus('connecting');

        this.connectionPromise = new Promise((resolve, reject) => {
            // Store reject so we can call it from onWebSocketClose/onDisconnect
            // to prevent orphaned promises that hang forever.
            this._pendingReject = reject;

            const token = storage.get(STORAGE_KEYS.ACCESS_TOKEN);
            if (!token) {
                this.connectionPromise = null;
                this._pendingReject = null;
                useSocketStore.getState().setStatus('disconnected');
                return reject(new Error('No auth token'));
            }

            // Use SockJS so we can fall back to HTTP transports in environments
            // where WebSocket upgrades are blocked/misconfigured in production.
            // env.WS_URL is expected to be ws(s)://.../ws by default.
            let socketUrl = env.WS_URL.replace(/^http(s)?:\/\//, 'ws$1://');
            if (typeof window !== 'undefined' && window.location.protocol === 'https:' && socketUrl.startsWith('ws:')) {
                socketUrl = socketUrl.replace('ws:', 'wss:');
            }

            // SockJS expects an http(s) URL, not ws(s).
            const sockJsUrl = socketUrl
                .replace(/^wss:\/\//, 'https://')
                .replace(/^ws:\/\//, 'http://');

            // Tear down any stale client
            if (this.client) {
                try {
                    this.client.deactivate();
                } catch (error) {
                    reportErrorOnce('socket-teardown', error, 'Real-time connection error');
                }
            }

            this.client = new Client({
                webSocketFactory: () => new SockJS(sockJsUrl),
                connectHeaders: { Authorization: `Bearer ${token}` },

                heartbeatOutgoing: this._heartbeatOutgoing,
                heartbeatIncoming: this._heartbeatIncoming,

                onConnect: () => {
                    this.connected = true;
                    this._pendingReject = null;
                    useSocketStore.getState().setStatus('connected');
                    this._reconnectAttempts = 0;
                    this._clearReconnectTimer();

                    // If we previously surfaced a real-time failure, convert it into a success toast.
                    // Use the same toast id so it updates in-place, then reset the flag so future outages can toast again.
                    if (hasReportedError('realtime-connection')) {
                        reportSuccess('realtime-connection', 'Real-time connection restored');
                        resetReportedError('realtime-connection');
                    }

                    // Re-subscribe all pending topics
                    this._resubscribeAll();

                    resolve();
                },

                onDisconnect: () => {
                    this.connected = false;
                    this.connectionPromise = null;
                    // Reject any pending connect() callers so they don't hang forever
                    if (this._pendingReject) {
                        this._pendingReject(new Error('Socket disconnected'));
                        this._pendingReject = null;
                    }
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

                onWebSocketClose: (event) => {
                    this.connected = false;
                    this.connectionPromise = null;
                    // Reject any pending connect() callers so they don't hang forever
                    if (this._pendingReject) {
                        this._pendingReject(new Error('WebSocket closed'));
                        this._pendingReject = null;
                    }
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

                        // Helpful breadcrumb for production debugging
                        if (event?.code) {
                            console.warn('WebSocket closed', { code: event.code, reason: event.reason });
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
            return true;
        }
        return false;
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

    _handlePageHide() {
        // If we keep an active WebSocket, Chrome may refuse BFCache on back/forward.
        // Pause the connection without clearing subscriptions.
        this._pausedByPageLifecycle = true;
        this._intentionalDisconnect = true;
        this._clearReconnectTimer();
        this.connected = false;
        this.connectionPromise = null;

        if (this.client) {
            try {
                // Deactivate closes the underlying WebSocket.
                void this.client.deactivate();
            } catch (error) {
                reportErrorOnce('socket-teardown', error, 'Real-time connection error');
            }
        }
    }

    _handlePageShow() {
        if (!this._pausedByPageLifecycle) return;
        this._pausedByPageLifecycle = false;

        // Allow reconnects again.
        this._intentionalDisconnect = false;
        this._reconnectAttempts = 0;

        // Only reconnect if still authenticated.
        if (storage.get(STORAGE_KEYS.ACCESS_TOKEN)) {
            this.connect().catch((error) => {
                reportErrorOnce('realtime-connection', error, 'Real-time connection failed');
            });
        } else {
            useSocketStore.getState().setStatus('disconnected');
        }
    }
}

export const socketService = new SocketService();
