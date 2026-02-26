package com.blink.chatservice.ratelimit;

import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;


@Slf4j
@Service
public class RateLimiterService {

    private final StringRedisTemplate redisTemplate;

    // Lua script: atomic increment-and-check inside a fixed window
    private static final String LUA_SCRIPT =
            "local key    = KEYS[1]\n" +
            "local limit  = tonumber(ARGV[1])\n" +
            "local window = tonumber(ARGV[2])\n" +
            "local current = tonumber(redis.call('GET', key) or '0')\n" +
            "if current >= limit then\n" +
            "    return 0\n" +
            "end\n" +
            "current = redis.call('INCR', key)\n" +
            "if current == 1 then\n" +
            "    redis.call('PEXPIRE', key, window)\n" +
            "end\n" +
            "return current\n";

    private final DefaultRedisScript<Long> rateLimitScript;

    // In-memory fallback (used only when Redis is unreachable)
    // Added max size cap + scheduled eviction to prevent unbounded growth
    private static final int FALLBACK_MAX_ENTRIES = 500;
    private final Map<String, FallbackWindow> fallbackWindows = new ConcurrentHashMap<>();

    // Log Redis unavailability only once to prevent log spam
    private final AtomicBoolean redisWarningLogged = new AtomicBoolean(false);

    public RateLimiterService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
        this.rateLimitScript = new DefaultRedisScript<>(LUA_SCRIPT, Long.class);
    }

    public RateLimitResult tryConsume(String key, int maxRequests, long windowMs) {
        try {
            List<String> keys = Collections.singletonList(key);
            Long current = redisTemplate.execute(
                    rateLimitScript,
                    keys,
                    String.valueOf(maxRequests),
                    String.valueOf(windowMs)
            );

            if (current == null || current == 0L) {
                // Limit exceeded
                Long ttl = redisTemplate.getExpire(key, TimeUnit.MILLISECONDS);
                long retryAfterMs = (ttl != null && ttl > 0) ? ttl : windowMs;
                return new RateLimitResult(false, 0, maxRequests, retryAfterMs);
            }

            // Redis is back — clear the fallback map to free memory
            if (redisWarningLogged.compareAndSet(true, false)) {
                log.info("Redis reconnected for rate limiting, clearing {} in-memory fallback entries", fallbackWindows.size());
                fallbackWindows.clear();
            }

            int remaining = Math.max(0, maxRequests - current.intValue());
            return new RateLimitResult(true, remaining, maxRequests, windowMs);

        } catch (Exception e) {
            // Log Redis failure only once to avoid flooding the console
            if (redisWarningLogged.compareAndSet(false, true)) {
                log.warn("Redis unavailable for rate limiting, using in-memory fallback: {}", e.getMessage());
            }
            return fallbackTryConsume(key, maxRequests, windowMs);
        }
    }

    // Thread-safe in-memory fallback using atomic compute
    private RateLimitResult fallbackTryConsume(String key, int maxRequests, long windowMs) {
        long now = Instant.now().toEpochMilli();

        // Safety cap: if the map grows too large, evict expired entries first
        if (fallbackWindows.size() > FALLBACK_MAX_ENTRIES) {
            evictExpiredFallbackEntries();
        }

        FallbackWindow w = fallbackWindows.compute(key, (k, existing) -> {
            if (existing == null || now - existing.windowStart > windowMs) {
                // New window: first request
                return new FallbackWindow(1, now, windowMs);
            }
            if (existing.count >= maxRequests) {
                // Already at limit, don't increment
                return existing;
            }
            existing.count++;
            return existing;
        });

        if (w.count > maxRequests) {
            long retryAfterMs = windowMs - (now - w.windowStart);
            return new RateLimitResult(false, 0, maxRequests, Math.max(retryAfterMs, 0));
        }

        // count == maxRequests means this was the last allowed request
        boolean allowed = w.count <= maxRequests;
        int remaining = Math.max(0, maxRequests - w.count);
        if (!allowed) {
            long retryAfterMs = windowMs - (now - w.windowStart);
            return new RateLimitResult(false, 0, maxRequests, Math.max(retryAfterMs, 0));
        }
        return new RateLimitResult(true, remaining, maxRequests, windowMs);
    }

    // Periodic cleanup of expired fallback entries.
    // Runs every 2 minutes to prevent the ConcurrentHashMap from growing unbounded
    // when Redis is down for extended periods.
    @Scheduled(fixedRate = 120_000)
    public void evictExpiredFallbackEntries() {
        if (fallbackWindows.isEmpty()) return;

        long now = Instant.now().toEpochMilli();
        int before = fallbackWindows.size();

        fallbackWindows.entrySet().removeIf(entry -> {
            FallbackWindow w = entry.getValue();
            return now - w.windowStart > w.windowMs;
        });

        int evicted = before - fallbackWindows.size();
        if (evicted > 0) {
            log.debug("Evicted {} expired rate-limit fallback entries, {} remaining", evicted, fallbackWindows.size());
        }
    }

    public static class RateLimitResult {
        private final boolean allowed;
        private final int remaining;
        private final int limit;
        private final long retryAfterMs;

        public RateLimitResult(boolean allowed, int remaining, int limit, long retryAfterMs) {
            this.allowed = allowed;
            this.remaining = remaining;
            this.limit = limit;
            this.retryAfterMs = retryAfterMs;
        }

        public boolean isAllowed() { return allowed; }
        public int remaining()     { return remaining; }
        public int limit()         { return limit; }
        public long retryAfterMs() { return retryAfterMs; }
    }

    // Fallback data holder — now includes windowMs for TTL-based eviction
    private static class FallbackWindow {
        int count;
        long windowStart;
        long windowMs;
        FallbackWindow(int count, long windowStart, long windowMs) {
            this.count = count;
            this.windowStart = windowStart;
            this.windowMs = windowMs;
        }
    }
}
