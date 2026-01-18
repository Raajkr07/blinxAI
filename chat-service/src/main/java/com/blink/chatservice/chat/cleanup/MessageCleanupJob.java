package com.blink.chatservice.chat.cleanup;

import com.blink.chatservice.chat.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
public class MessageCleanupJob {

    private final MessageRepository messageRepository;

    // Running soft-delete at 2 AM to avoid peak hours.
    // WARNING: current implementation loads all messages. Needs refactoring to bulk update for production scale.
    @Scheduled(cron = "0 0 2 * * *")
    public void softDeleteOldMessages() {
        LocalDateTime threshold = LocalDateTime.now().minusDays(7);

        messageRepository.findAll().stream()
                .filter(m -> !m.isDeleted() && m.getCreatedAt().isBefore(threshold))
                .forEach(m -> {
                    m.setDeleted(true);
                    messageRepository.save(m);
                });
    }
}
