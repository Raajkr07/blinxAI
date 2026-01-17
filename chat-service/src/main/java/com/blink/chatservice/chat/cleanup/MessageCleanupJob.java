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

    // every night at 2 am it will work
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
