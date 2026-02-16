package com.blink.chatservice.user.dto;

import jakarta.validation.constraints.NotBlank;

public class AuthDto {
    public record OtpRequest(
            @NotBlank String identifier
    ) {}
    public record VerifyOtpRequest(
            @NotBlank String identifier,
            @NotBlank String otp
    ) {}
    public record SignupRequest(
            @NotBlank String identifier,
            @NotBlank String username,
            String avatarUrl,
            String bio,
            String email,
            String phone
    ) {}
    public record LoginRequest(
            @NotBlank String identifier,
            String otp
    ) {}

    public record OtpResponse(String message) {}
    public record VerifyOtpResponse(String message, boolean valid) {}
    public record RefreshTokenRequest(@NotBlank String refreshToken) {}
    public record TokenResponse(String accessToken, String refreshToken, String error) {
        public TokenResponse(String accessToken, String refreshToken) {
            this(accessToken, refreshToken, null);
        }
    }
}
