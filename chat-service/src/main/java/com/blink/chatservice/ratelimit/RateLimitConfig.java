package com.blink.chatservice.ratelimit;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Data
@Configuration
@ConfigurationProperties(prefix = "app.rate-limit")
public class RateLimitConfig {

    // Master switch – set to false to disable rate limiting entirely.
    private boolean enabled = true;

    // Default / global bucket applied to all authenticated API requests.
    // 120/min is generous enough for normal frontend usage (page loads make ~10-15 concurrent requests).
    private Bucket global = new Bucket(120, 60);

    // Tight bucket for auth endpoints (OTP, login, signup) – prevents brute-force.
    private Bucket auth = new Bucket(5, 60);

    // AI chat endpoints – expensive, keep low.
    private Bucket ai = new Bucket(10, 60);

    // User search – moderate.
    private Bucket search = new Bucket(20, 60);

    // Calls / video chat endpoints.
    private Bucket calls = new Bucket(30, 60);

    // Email sending – very tight to prevent spam.
    private Bucket email = new Bucket(3, 60);

    // Message sending – moderate but tighter than global read endpoints.
    private Bucket messageSend = new Bucket(30, 60);

    @Data
    public static class Bucket {
        private int maxRequests;
        private int windowSeconds;

        public Bucket() {}

        public Bucket(int maxRequests, int windowSeconds) {
            this.maxRequests = maxRequests;
            this.windowSeconds = windowSeconds;
        }

        public long windowMs() {
            return windowSeconds * 1000L;
        }
    }
}
