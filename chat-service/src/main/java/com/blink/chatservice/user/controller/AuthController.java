package com.blink.chatservice.user.controller;

import com.blink.chatservice.notification.service.NotificationService;
import com.blink.chatservice.security.JwtUtil;
import com.blink.chatservice.security.TokenDenylistService;
import com.blink.chatservice.user.dto.AuthDto.*;
import com.blink.chatservice.user.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Base64;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "OTP-based auth flow")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);
    private final UserService userService;
    private final NotificationService notificationService;
    private final TokenDenylistService denylistService;
    private final JwtUtil jwtUtil;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    @Operation(summary = "Request OTP for signup/login", description = "Send OTP to phone/email. Creates/Signup user if new.")
    @PostMapping("/request-otp")
    public ResponseEntity<OtpResponse> requestOtp(@Valid @RequestBody OtpRequest request) {
        String identifier = request.identifier().trim();
        String otp = userService.requestOtp(identifier);

        log.info("OTP requested for: {}", maskIdentifier(identifier));

        try {
            String token = Base64.getEncoder().encodeToString((otp + ":" + identifier).getBytes(java.nio.charset.StandardCharsets.UTF_8));
            String fullVerifyUrl = frontendUrl + "/verify?v=" + token;
            boolean sent = notificationService.sendOtp(identifier, otp, "BlinxAI", fullVerifyUrl);
            if (!sent) {
                log.warn("OTP generated but delivery failed for: {}", maskIdentifier(identifier));
            }
        } catch (Exception e) {
            log.error("Error sending OTP notification for {}: {}", maskIdentifier(identifier), e.getMessage());
        }

        return ResponseEntity.ok(new OtpResponse("OTP sent successfully"));
    }

    @Operation(summary = "Only verify OTP", description = "OTP validation. Call Signup/Login next.")
    @PostMapping("/verify-otp")
    public ResponseEntity<VerifyOtpResponse> verifyOtp(@Valid @RequestBody VerifyOtpRequest request) {
        boolean valid = userService.verifyOtp(request.identifier(), request.otp());
        return ResponseEntity.ok(new VerifyOtpResponse(valid ? "OTP verified successfully" : "Invalid OTP", valid));
    }

    @Operation(summary = "Complete signup with refresh token", description = "Create profile and issue access + refresh tokens")
    @PostMapping("/signup")
    public ResponseEntity<TokenResponse> signup(@Valid @RequestBody SignupRequest request) {
        Map<String, String> tokens = userService.signup(
                request.identifier(), request.username(), request.avatarUrl(),
                request.bio(), request.email(), request.phone()
        );
        log.info("Signup completed with refresh token for: {}", maskIdentifier(request.identifier()));
        return ResponseEntity.ok(new TokenResponse(tokens.get("accessToken"), tokens.get("refreshToken")));
    }

    @Operation(summary = "Complete login with refresh token", description = "Issue access + refresh tokens")
    @PostMapping("/login")
    public ResponseEntity<TokenResponse> login(@Valid @RequestBody LoginRequest request) {
        Map<String, String> tokens = userService.login(request);
        return ResponseEntity.ok(new TokenResponse(tokens.get("accessToken"), tokens.get("refreshToken")));
    }

    @Operation(summary = "Refresh access token", description = "Get new access token for multi-day login")
    @PostMapping("/refresh")
    public ResponseEntity<TokenResponse> refreshToken(@Valid @RequestBody RefreshTokenRequest request) {
        Map<String, String> tokens = userService.refreshAccessToken(request.refreshToken());
        return ResponseEntity.ok(new TokenResponse(tokens.get("accessToken"), tokens.get("refreshToken")));
    }

    @Operation(summary = "Revoke tokens", description = "Logout by removing refresh token and denylisting access token")
    @PostMapping("/logout")
    public ResponseEntity<OtpResponse> logout(
            @Valid @RequestBody RefreshTokenRequest request,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        
        // 1. Revoke refresh token
        userService.revokeRefreshToken(request.refreshToken());
        
        // 2. Denylist access token
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String accessToken = authHeader.substring(7);
            String jti = jwtUtil.extractClaim(accessToken, claims -> claims.getId());
            java.util.Date expiration = jwtUtil.getExpirationDate(accessToken);
            
            if (jti != null && expiration != null) {
                long ttl = expiration.getTime() - System.currentTimeMillis();
                if (ttl > 0) {
                    denylistService.denylistToken(jti, ttl);
                }
            }
        }
        
        return ResponseEntity.ok(new OtpResponse("Logged out successfully"));
    }

    private String maskIdentifier(String id) {
        if (id == null || id.length() < 4) return "****";
        return id.substring(0, 2) + "****" + id.substring(id.length() - 2);
    }
}
