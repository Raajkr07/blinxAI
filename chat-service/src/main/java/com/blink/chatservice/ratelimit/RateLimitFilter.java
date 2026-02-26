package com.blink.chatservice.ratelimit;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.regex.Pattern;

@Slf4j
@Component
@RequiredArgsConstructor
@Order(Ordered.HIGHEST_PRECEDENCE + 101) // after CORS (HIGHEST) and JWT filter
public class RateLimitFilter extends OncePerRequestFilter {

    private final RateLimiterService rateLimiterService;
    private final RateLimitConfig config;
    private static final ObjectMapper MAPPER = new ObjectMapper();
    // Pre-compiled regex to avoid re-compilation on every POST request (GC pressure)
    private static final Pattern MESSAGE_SEND_PATTERN = Pattern.compile("/api/v1/chat/[^/]+/messages");

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!config.isEnabled()) return true;

        String path = request.getRequestURI();
        // Never rate-limit health probes, actuator, swagger, or WebSocket handshakes
        return path.startsWith("/actuator")
                || path.startsWith("/swagger-ui")
                || path.startsWith("/v3/api-docs")
                || path.startsWith("/ws")
                || path.startsWith("/api/v1/ws")
                || "OPTIONS".equalsIgnoreCase(request.getMethod());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {

        String path = request.getRequestURI();
        String clientKey = resolveClientKey(request);

        // Pick the tightest matching bucket
        String method = request.getMethod();
        RateLimitConfig.Bucket bucket = resolveBucket(path, method);
        String bucketTag = resolveBucketTag(path, method);

        String redisKey = "rl:" + bucketTag + ":" + clientKey;

        RateLimiterService.RateLimitResult result =
                rateLimiterService.tryConsume(redisKey, bucket.getMaxRequests(), bucket.windowMs());

        // Always set informational headers so clients can self-throttle
        response.setHeader("X-RateLimit-Limit", String.valueOf(result.limit()));
        response.setHeader("X-RateLimit-Remaining", String.valueOf(result.remaining()));

        if (!result.isAllowed()) {
            long retryAfterSec = Math.max(1, result.retryAfterMs() / 1000);
            response.setHeader("Retry-After", String.valueOf(retryAfterSec));
            response.setHeader("X-RateLimit-Reset", String.valueOf(retryAfterSec));
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);

            Map<String, Object> body = Map.of(
                    "error", "RATE_LIMIT_EXCEEDED",
                    "message", "Too many requests. Please retry after " + retryAfterSec + " seconds.",
                    "status", 429,
                    "path", path,
                    "timestamp", OffsetDateTime.now().toString(),
                    "retryAfterSeconds", retryAfterSec
            );
            MAPPER.writeValue(response.getOutputStream(), body);

            log.warn("Rate limit exceeded: key={}, bucket={}, limit={}/{}s",
                    clientKey, bucketTag, bucket.getMaxRequests(), bucket.getWindowSeconds());
            return;
        }

        chain.doFilter(request, response);
    }

    /* ── Helpers ── */

    // Resolve a unique key for the caller: authenticated user ID or client IP.
    private String resolveClientKey(HttpServletRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated()
                && !"anonymousUser".equals(auth.getPrincipal())) {
            return "user:" + auth.getName();
        }
        // Fall back to IP (handles X-Forwarded-For from proxies / load balancers)
        String xff = request.getHeader("X-Forwarded-For");
        String ip = (xff != null && !xff.isBlank())
                ? xff.split(",")[0].trim()
                : request.getRemoteAddr();
        return "ip:" + ip;
    }

    // Choose the rate-limit bucket based on the request path and HTTP method.
    private RateLimitConfig.Bucket resolveBucket(String path, String method) {
        if (path.startsWith("/api/v1/auth/")) {
            return config.getAuth();
        }
        if (path.startsWith("/api/v1/ai/")) {
            return config.getAi();
        }
        if (path.startsWith("/api/v1/users/search")) {
            return config.getSearch();
        }
        if (path.startsWith("/api/v1/calls/")) {
            return config.getCalls();
        }
        if (path.equals("/api/v1/chat/send-email")) {
            return config.getEmail();
        }
        if (MESSAGE_SEND_PATTERN.matcher(path).matches() && "POST".equalsIgnoreCase(method)) {
            return config.getMessageSend();
        }
        return config.getGlobal();
    }

    private String resolveBucketTag(String path, String method) {
        if (path.startsWith("/api/v1/auth/")) return "auth";
        if (path.startsWith("/api/v1/ai/"))   return "ai";
        if (path.startsWith("/api/v1/users/search")) return "search";
        if (path.startsWith("/api/v1/calls/")) return "calls";
        if (path.equals("/api/v1/chat/send-email")) return "email";
        if (MESSAGE_SEND_PATTERN.matcher(path).matches() && "POST".equalsIgnoreCase(method)) return "msg-send";
        return "global";
    }
}
