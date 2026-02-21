package com.blink.chatservice.ratelimit;


import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class RateLimiterService {

    // In-memory rate limiting (instance-local). For distributed rate limiting, use Redis.
    private final Map<String, UserWindow> windows = new ConcurrentHashMap<>();
    private final int maxRequests = 50;
    private final long windowMs = 10_000;

    public boolean tryConsume(String userId) {
        long now = Instant.now().toEpochMilli();
        UserWindow w = windows.computeIfAbsent(userId, id -> new UserWindow(0, now));

        synchronized (w) {
            if (now - w.windowStart > windowMs) {
                w.windowStart = now;
                w.count = 0;
            }
            if (w.count >= maxRequests) {
                return false;
            }
            w.count++;
            return true;
        }
    }

    // Evict stale entries every 60s to prevent unbounded memory growth
    @Scheduled(fixedRate = 60_000)
    public void evictStaleWindows() {
        long now = Instant.now().toEpochMilli();
        windows.entrySet().removeIf(e -> now - e.getValue().windowStart > windowMs * 3);
    }

    private static class UserWindow {
        int count;
        long windowStart;
        UserWindow(int count, long windowStart) {
            this.count = count;
            this.windowStart = windowStart;
        }
    }
}

