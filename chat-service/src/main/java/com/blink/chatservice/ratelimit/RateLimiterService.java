package com.blink.chatservice.ratelimit;


import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class RateLimiterService {

    // In-memory rate limiting. 
    // WARNING: This is local to the instance. For distributed rate limiting, use Redis.
    // Also, this map grows indefinitely. Needs a cleanup job or Guava cache with expiry.
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

    private static class UserWindow {
        int count;
        long windowStart;
        UserWindow(int count, long windowStart) {
            this.count = count;
            this.windowStart = windowStart;
        }
    }
}

