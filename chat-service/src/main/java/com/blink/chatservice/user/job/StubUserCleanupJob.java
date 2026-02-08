package com.blink.chatservice.user.job;

import com.blink.chatservice.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.time.LocalDateTime;
import java.time.ZoneId;

@Component
@Slf4j
@RequiredArgsConstructor
public class StubUserCleanupJob {

    private final UserRepository userRepository;

    // Cleans up stub users (users with no username/incomplete profile)
    // Runs every 12 hours at Midnight and Noon UTC
    @Scheduled(cron = "0 0 0,12 * * *", zone = "UTC")
    public void cleanupStubUsers() {
        // Only delete users created more than 2 hours ago to allow finishing signup
        LocalDateTime threshold = LocalDateTime.now(ZoneId.of("UTC")).minusHours(2);
        
        log.info("[Job] Starting cleanup of stale stub users created before {}", threshold);
        
        try {
            long deletedCount = userRepository.deleteIncompleteUsers(threshold);
            if (deletedCount > 0) {
                log.info("[Job] Successfully deleted {} stale stub users", deletedCount);
            } else {
                log.info("[Job] No stale stub users found");
            }
        } catch (Exception e) {
            log.error("[Job] Error while cleaning up stub users", e);
        }
    }
}
