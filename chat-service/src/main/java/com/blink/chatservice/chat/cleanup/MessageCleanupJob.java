package com.blink.chatservice.chat.cleanup;

import com.blink.chatservice.chat.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.ZoneId;

@Component
@RequiredArgsConstructor
public class MessageCleanupJob {

    private final MessageRepository messageRepository;

    @Scheduled(cron = "0 0 2 * * *")
    public void cleanup() {
        LocalDateTime threshold = LocalDateTime.now(ZoneId.of("UTC")).minusDays(30);
        messageRepository.deleteByCreatedAtBefore(threshold);
    }
}
