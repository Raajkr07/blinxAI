package com.blink.chatservice.websocket.service;

import com.blink.chatservice.security.JwtUtil;
import com.blink.chatservice.security.TokenDenylistService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class WebSocketTokenService {

    private final JwtUtil jwtUtil;
    private final TokenDenylistService denylistService;

    public String getUserIdFromHeader(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return null;
        }

        String token = authHeader.substring(7);
        if (!jwtUtil.validateToken(token)) {
            return null;
        }

        String jti = jwtUtil.extractClaim(token, claims -> claims.getId());
        if (denylistService.isDenyListed(jti)) {
            return null;
        }

        return jwtUtil.extractUserId(token);
    }
}
