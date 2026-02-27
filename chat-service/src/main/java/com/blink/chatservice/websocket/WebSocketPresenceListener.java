package com.blink.chatservice.websocket;

import java.security.Principal;
import java.time.LocalDateTime;
import java.time.ZoneId;

import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import com.blink.chatservice.user.entity.User;
import com.blink.chatservice.user.repository.UserRepository;
import com.blink.chatservice.websocket.dto.PresenceEvent;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;


@Slf4j
@Component
@RequiredArgsConstructor
public class WebSocketPresenceListener {

    private static final ZoneId UTC = ZoneId.of("UTC");

    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @EventListener
    public void handleWebSocketConnectListener(SessionConnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        Principal principal = accessor.getUser();
        if (principal == null) return;

        String userId = principal.getName();
        try {
            userRepository.findById(userId).ifPresent(user -> {
                user.setOnline(true);
                userRepository.save(user);
                broadcastPresence(user);
            });
        } catch (Exception e) {
            log.warn("Failed to update presence on connect for user {}: {}", userId, e.getMessage());
        }
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        Principal principal = accessor.getUser();
        if (principal == null) return;

        String userId = principal.getName();
        try {
            userRepository.findById(userId).ifPresent(user -> {
                user.setOnline(false);
                user.setLastSeen(LocalDateTime.now(UTC));
                userRepository.save(user);
                broadcastPresence(user);
            });
        } catch (Exception e) {
            log.warn("Failed to update presence on disconnect for user {}: {}", userId, e.getMessage());
        }
    }

    private void broadcastPresence(User user) {
        PresenceEvent event = new PresenceEvent(user.getId(), user.isOnline());
        messagingTemplate.convertAndSend("/topic/presence", event);
    }
}
