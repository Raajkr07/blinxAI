package com.blink.chatservice.websocket;

import java.security.Principal;
import java.time.Instant;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
public class WebSocketSessionManager {

    // Max age before a session entry is considered stale and force-evicted.
    private static final long STALE_SESSION_THRESHOLD_MS = 24 * 60 * 60 * 1000L; // 24 hours

    // Hard cap to prevent unbounded growth even under pathological conditions.
    private static final int MAX_TRACKED_SESSIONS = 5000;

    private final ConcurrentHashMap<String, SessionInfo> activeSessions = new ConcurrentHashMap<>();

    public WebSocketSessionManager(MeterRegistry meterRegistry) {
        // Register a Prometheus gauge: websocket.sessions.active
        Gauge.builder("websocket.sessions.active", activeSessions, ConcurrentHashMap::size)
                .description("Number of active WebSocket sessions tracked by the session manager")
                .register(meterRegistry);
    }

    @EventListener
    public void handleSessionConnected(SessionConnectedEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = accessor.getSessionId();
        if (sessionId == null) return;

        Principal principal = accessor.getUser();
        String userId = principal != null ? principal.getName() : "anonymous";

        // Enforce hard cap — evict stale entries first, then reject if still full
        if (activeSessions.size() >= MAX_TRACKED_SESSIONS) {
            evictStaleSessions();
            if (activeSessions.size() >= MAX_TRACKED_SESSIONS) {
                log.warn("Session map at capacity ({}), cannot track session {} for user {}",
                        MAX_TRACKED_SESSIONS, sessionId, userId);
                return;
            }
        }

        activeSessions.put(sessionId, new SessionInfo(userId, Instant.now()));
        log.debug("Session connected: {} (user: {}, active: {})", sessionId, userId, activeSessions.size());
    }

    @EventListener
    public void handleSessionDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = accessor.getSessionId();
        if (sessionId == null) return;

        SessionInfo removed = activeSessions.remove(sessionId);
        if (removed != null) {
            log.debug("Session disconnected: {} (user: {}, active: {})",
                    sessionId, removed.userId(), activeSessions.size());
        }
    }

    /**
     * Periodic cleanup of stale sessions that missed disconnect events.
     * Runs every 5 minutes. Prevents the session map from growing unbounded
     * if SessionDisconnectEvent is lost (e.g., network partition, JVM pause).
     */
    @Scheduled(fixedRate = 300_000) // 5 minutes
    public void evictStaleSessions() {
        if (activeSessions.isEmpty()) return;

        long cutoff = System.currentTimeMillis() - STALE_SESSION_THRESHOLD_MS;
        int removed = 0;

        Iterator<Map.Entry<String, SessionInfo>> it = activeSessions.entrySet().iterator();
        while (it.hasNext()) {
            Map.Entry<String, SessionInfo> entry = it.next();
            if (entry.getValue().connectedAt().toEpochMilli() < cutoff) {
                it.remove();
                removed++;
            }
        }

        if (removed > 0) {
            log.info("Evicted {} stale WebSocket session entries, {} remaining", removed, activeSessions.size());
        }
    }

    // Current number of tracked active sessions. Exposed for health checks and testing.
    public int getActiveSessionCount() {
        return activeSessions.size();
    }

    private record SessionInfo(String userId, Instant connectedAt) {}
}
