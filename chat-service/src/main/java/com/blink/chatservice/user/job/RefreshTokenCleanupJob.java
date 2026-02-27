package com.blink.chatservice.user.job;

import com.blink.chatservice.user.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Slf4j
@Component
@RequiredArgsConstructor
public class RefreshTokenCleanupJob {

    private final RefreshTokenRepository refreshTokenRepository;

    @Scheduled(cron = "0 0 3 * * ?")
    public void cleanupExpiredTokens() {
        log.info("Starting scheduled cleanup of expired RefreshTokens");
        try {
            LocalDateTime now = LocalDateTime.now();
            refreshTokenRepository.deleteByExpiresAtBefore(now);
            log.info("Completed expired RefreshToken cleanup successfully");
        } catch (Exception e) {
            log.error("Failed to cleanup expired RefreshTokens", e);
        }
    }
}
