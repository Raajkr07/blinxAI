package com.blink.chatservice.security;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
@RequiredArgsConstructor
public class TokenDenylistService {

    private final StringRedisTemplate redisTemplate;
    private static final String DENYLIST_PREFIX = "jwt:denylist:";

    public void denylistToken(String jti, long expirationMs) {
        if (jti != null) {
            redisTemplate.opsForValue().set(
                    DENYLIST_PREFIX + jti,
                    "revoked",
                    Duration.ofMillis(expirationMs)
            );
        }
    }

    public boolean isDenyListed(String jti) {
        if (jti == null) return false;
        return Boolean.TRUE.equals(redisTemplate.hasKey(DENYLIST_PREFIX + jti));
    }
}
