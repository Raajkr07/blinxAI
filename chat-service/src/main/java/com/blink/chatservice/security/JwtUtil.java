package com.blink.chatservice.security;

import com.blink.chatservice.config.JwtConfig;
import com.blink.chatservice.user.entity.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.security.Key;
import java.util.Date;
import java.util.HashMap;
import java.util.UUID;
import java.util.Map;
import java.util.function.Function;

@Component
@RequiredArgsConstructor
public class JwtUtil {

    private final JwtConfig jwtConfig;

    // Cache the signing key – it never changes at runtime, so no need to recompute on every request.
    private volatile Key cachedKey;

    private Key getKey() {
        Key key = this.cachedKey;
        if (key != null) return key;
        synchronized (this) {
            if (this.cachedKey != null) return this.cachedKey;
            try {
                byte[] keyBytes = java.util.Base64.getDecoder().decode(jwtConfig.getSecret());
                this.cachedKey = Keys.hmacShaKeyFor(keyBytes);
            } catch (IllegalArgumentException e) {
                this.cachedKey = Keys.hmacShaKeyFor(jwtConfig.getSecret().getBytes());
            }
            return this.cachedKey;
        }
    }

    public String generateToken(User user) {
        if (user == null || user.getId() == null) {
            throw new IllegalArgumentException("User or user ID cannot be null");
        }
        Map<String, Object> claims = new HashMap<>();
        if (user.getPhone() != null) {
            claims.put("phone", user.getPhone());
        }
        if (user.getUsername() != null) {
            claims.put("username", user.getUsername());
        }
        claims.put("type", "access");
        return createToken(claims, user.getId(), jwtConfig.getExpiration());
    }

    // Minimal claims for refresh token, just needs type and userID. Keeps payload small.
    public String generateRefreshToken(String userId) {
        if (userId == null || userId.trim().isEmpty()) {
            throw new IllegalArgumentException("User ID cannot be null or empty");
        }
        Map<String, Object> claims = new HashMap<>();
        claims.put("type", "refresh");
        return createToken(claims, userId, jwtConfig.getRefreshExpiration());
    }

    private String createToken(Map<String, Object> claims, String subject, long expirationMs) {
        long now = System.currentTimeMillis();

        return Jwts.builder()
                .setClaims(claims)
                .setSubject(subject)
                // Prevent accidental token collisions under concurrency/retries.
                .setId(UUID.randomUUID().toString())
                .setIssuedAt(new Date(now))
                .setExpiration(new Date(now + expirationMs))
                .signWith(getKey(), SignatureAlgorithm.HS256)
                .compact();
    }
    
    public boolean isRefreshToken(String token) {
        String tokenType = extractClaim(token, claims -> claims.get("type", String.class));
        return "refresh".equals(tokenType);
    }
    
    public Date getExpirationDate(String token) {
        return extractClaim(token, Claims::getExpiration);
    }
    
    public boolean isTokenExpired(String token) {
        Date expiration = getExpirationDate(token);
        return expiration != null && expiration.before(new Date());
    }

    public String extractUserId(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public <T> T extractClaim(String token, Function<Claims, T> resolver) {
        try {
            Claims claims = Jwts.parserBuilder()
                    .setSigningKey(getKey())
                    .build()
                    .parseClaimsJws(token)
                    .getBody();
            return resolver.apply(claims);
        } catch (Exception e) {
            return null;
        }
    }
    
    public boolean validateToken(String token) {
        try {
            Jwts.parserBuilder()
                    .setSigningKey(getKey())
                    .build()
                    .parseClaimsJws(token);
            return true;
        } catch (Exception e) {
            // If parsing fails (expired, modified, etc.), we return false. Caller handles generic 401.
            return false;
        }
    }
}
