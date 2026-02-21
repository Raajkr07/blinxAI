package com.blink.chatservice.user.controller;

import com.blink.chatservice.config.GoogleOAuthConfig;
import com.blink.chatservice.config.JwtConfig;
import com.blink.chatservice.security.JwtUtil;
import com.blink.chatservice.user.entity.User;
import com.blink.chatservice.user.repository.UserRepository;
import com.blink.chatservice.user.service.OAuthService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.Arrays;
import java.util.Collections;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/auth/google")
@RequiredArgsConstructor
@Slf4j
public class GoogleAuthController {

    private final OAuthService oAuthService;
    private final GoogleOAuthConfig googleConfig;
    private final JwtUtil jwtUtil;
    private final JwtConfig jwtConfig;
    private final UserRepository userRepository;

    @PostMapping("/init")
    public ResponseEntity<Map<String, String>> initAuth(@RequestParam(required = false) String redirect_to) {
        String authUrl = oAuthService.generateAuthUrl(redirect_to);
        return ResponseEntity.ok(Collections.singletonMap("url", authUrl));
    }

    @GetMapping("/callback")
    public void callback(@RequestParam String code, @RequestParam String state, HttpServletResponse response) throws IOException {
        try {
            Map<String, String> result = oAuthService.processCallback(code, state);
            String accessToken = result.get("token");
            String redirectUri = result.get("redirectUri");
            
            String userId = jwtUtil.extractUserId(accessToken);
            String refreshToken = jwtUtil.generateRefreshToken(userId);

            addCookie(response, "access_token", accessToken, (int) (jwtConfig.getExpiration() / 1000));
            addCookie(response, "refresh_token", refreshToken, (int) (jwtConfig.getRefreshExpiration() / 1000));
            
            if (redirectUri == null || redirectUri.isEmpty()) {
                redirectUri = googleConfig.getDefaultRedirectUri();
            }

            response.sendRedirect(redirectUri); 
        } catch (Exception e) {
            log.error("OAuth Callback Error: {}", e.getMessage());
            response.sendRedirect(googleConfig.getErrorRedirectUri());
        }
    }

    @PostMapping("/refresh")
    public ResponseEntity<Map<String, String>> refresh(HttpServletRequest request, HttpServletResponse response) {
        String refreshToken = null;
        if (request.getCookies() != null) {
            refreshToken = Arrays.stream(request.getCookies())
                    .filter(c -> "refresh_token".equals(c.getName()))
                    .findFirst()
                    .map(Cookie::getValue)
                    .orElse(null);
        }

        if (refreshToken == null || !jwtUtil.validateToken(refreshToken) || !jwtUtil.isRefreshToken(refreshToken)) {
            return ResponseEntity.status(401).build();
        }

        String userId = jwtUtil.extractUserId(refreshToken);

        Optional<User> userOptional = userRepository.findById(userId);
        if (userOptional.isEmpty()) {
             return ResponseEntity.status(401).build();
        }
        User user = userOptional.get();
        
        try {
             oAuthService.refreshCredential(userId);
        } catch (Exception e) {
            log.warn("Failed to refresh Google token during session refresh: {}", e.getMessage());
        }

        String newAccessToken = jwtUtil.generateToken(user);
        String newRefreshToken = jwtUtil.generateRefreshToken(userId); // Rotate
        
        addCookie(response, "access_token", newAccessToken, (int) (jwtConfig.getExpiration() / 1000));
        addCookie(response, "refresh_token", newRefreshToken, (int) (jwtConfig.getRefreshExpiration() / 1000));
        
        return ResponseEntity.ok(Map.of("accessToken", newAccessToken));
    }

    @GetMapping("/session")
    public ResponseEntity<Map<String, Object>> getSession(
            HttpServletRequest request,
            HttpServletResponse response,
            Authentication authentication) {
        
        // If not authenticated, try to recover session via refresh token cookie
        if (authentication == null || !authentication.isAuthenticated()) {
            String refreshToken = null;
            if (request.getCookies() != null) {
                refreshToken = Arrays.stream(request.getCookies())
                        .filter(c -> "refresh_token".equals(c.getName()))
                        .findFirst()
                        .map(Cookie::getValue)
                        .orElse(null);
            }

            if (refreshToken != null && jwtUtil.validateToken(refreshToken) && jwtUtil.isRefreshToken(refreshToken)) {
                String userId = jwtUtil.extractUserId(refreshToken);
                Optional<User> userOptional = userRepository.findById(userId);
                
                if (userOptional.isPresent()) {
                    User user = userOptional.get();
                    log.info("Recovering session for user: {}", userId);
                    
                    try {
                        oAuthService.refreshCredential(userId);
                    } catch (Exception e) {
                        log.warn("Google credential refresh failed during session recovery: {}", e.getMessage());
                    }

                    String newAccessToken = jwtUtil.generateToken(user);
                    String newRefreshToken = jwtUtil.generateRefreshToken(userId);
                    
                    addCookie(response, "access_token", newAccessToken, (int) (jwtConfig.getExpiration() / 1000));
                    addCookie(response, "refresh_token", newRefreshToken, (int) (jwtConfig.getRefreshExpiration() / 1000));
                    
                    return ResponseEntity.ok(Map.of(
                        "user", user,
                        "accessToken", newAccessToken
                    ));
                }
            }
            return ResponseEntity.status(401).build();
        }

        String userId = (String) authentication.getPrincipal();
        Optional<User> userOptional = userRepository.findById(userId);
        if (userOptional.isEmpty()) {
            return ResponseEntity.status(401).build();
        }
        
        User user = userOptional.get();
        String accessToken = jwtUtil.generateToken(user);
        
        return ResponseEntity.ok(Map.of(
            "user", user,
            "accessToken", accessToken
        ));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletResponse response) {
        clearCookie(response, "access_token");
        clearCookie(response, "refresh_token");
        return ResponseEntity.ok().build();
    }

    @PostMapping("/revoke")
    public ResponseEntity<Void> revoke(Authentication authentication) {
        if (authentication == null) return ResponseEntity.status(401).build();
        oAuthService.revokeCredential((String) authentication.getPrincipal());
        return ResponseEntity.ok().build();
    }

    private void addCookie(HttpServletResponse response, String name, String value, int maxAge) {
        Cookie cookie = new Cookie(name, value);
        cookie.setPath("/");
        cookie.setHttpOnly(true);
        cookie.setSecure(true);
        cookie.setAttribute("SameSite", "None");
        cookie.setMaxAge(maxAge);
        response.addCookie(cookie);
    }

    private void clearCookie(HttpServletResponse response, String name) {
        Cookie cookie = new Cookie(name, "");
        cookie.setPath("/");
        cookie.setHttpOnly(true);
        cookie.setSecure(true);
        cookie.setAttribute("SameSite", "None");
        cookie.setMaxAge(0);
        response.addCookie(cookie);
    }
}
